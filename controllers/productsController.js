import asyncHandler from 'express-async-handler';
import Product from '../models/Product.js';
import {v2 as cloudinary} from 'cloudinary'
import { AuthorizationError, CloudinaryError, CustomError, NotFoundError, TransactionError } from '../errors/errors.js';
import mongoose from 'mongoose';
import Category from '../models/Category.js';
import { generatePreSignedUrl, markAsUploaded } from '../services/cloudinary.js';

import _ from 'lodash'
// IMPORTANT. when using 'cloudinary.api' methods, we are using the admin api,
// which has rate limit of 500 calls per hour on free tier. 2000 per hour for paid acc

export const getProductById = asyncHandler(async (req, res) => {
  console.log('---------LOGGGG')
  const { id } = req.params;
  const product = await Product.findOne({_id: id, visibility: 'public'}).populate('createdBy');
  if(!product){
    throw new NotFoundError('Product not found');
  }
  return res.json({product});
})

export const getProductsPublic = asyncHandler(async (req, res) => {
  let products = await Product.find({visibility: 'public'}).populate('categories');
  return res.json({products});
})

export const getProducts = asyncHandler(async (req, res) => {
  if(!req.user.isUserLevelMoreThanOrEqualTo('admin')){
    throw new AuthorizationError('User Level of Admin required to access this resource')
  }
  let products = await Product.find().populate(['createdBy', 'categories']);
  return res.json({products});
})


export const getPresignedUrl = asyncHandler(async (req, res) => {
  if(!req.user.isUserLevelMoreThanOrEqualTo('admin')){
    throw new AuthorizationError('User Level of Admin required to access this resource')
  }
 
  const out = await generatePreSignedUrl();
  res.json(out)
})


export const addProduct = asyncHandler(async (req, res) => {
  if(!req.user.isUserLevelMoreThanOrEqualTo('admin')){
    throw new AuthorizationError('User Level of Admin required to access this resource')
  }
  const {name, description, price, images, visibility, categories} = req.validatedData;
  
  const { responsesSuccessful } = await markAsUploaded(images)

  try {
    const product = new Product({
      createdBy: req.user,
      name,
      description,
      price,
      categories,
      images: responsesSuccessful.map(({cloudinaryResponse, order, publicId}) => ({
        url: cloudinaryResponse.secure_url,
        publicId: cloudinaryResponse.public_id,
        order
      })),
      visibility,
    });

    const newProduct = await product.save();
    res.json({product: newProduct})

  } catch (error) {
    const imagesDeleted = await Promise.allSettled(
      images.map(({publicId}) =>cloudinary.uploader.destroy(publicId))
    );
    throw new CustomError('Could not store product details into database', {imagesDeleted});
    // const out = await cloudinary.uploader.destroy(publicId);
    // throw new CustomError('Could not store product details into database', {imageDeletedStatus: {...out}});
    // out.result can be "ok" || "not found", maybe more
  }
})


export const deleteProduct = asyncHandler(async (req, res) => {
  if(!req.user.isUserLevelMoreThanOrEqualTo('admin')){
    throw new AuthorizationError('User Level of Admin required to access this resource')
  }
  const { id } = req.params;
  // Transaction so that if image deletion fails, then document rolls back to not deleted
  // If our delete order was instead image deletion first, then we would
  // end up with no images but existing document
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // delete document
      // const product = await Product.findOneAndDelete({_id: id}).session(session);
      const product = await Product.findById(id).populate('createdBy').session(session);
      if(!product){
        throw new NotFoundError('Product not found');
      }

      const userLevel = req.user.userLevel
      const creatorLevel = product.createdBy.userLevel;
      if(!req.user.isUserLevelMoreThanOrEqualTo(creatorLevel)){
        throw new AuthorizationError(`You do not have a higher user level than the product creator. ${userLevel} tried to delete product by ${creatorLevel}`);
      }
      // delete document
      await product.deleteOne().session(session);

      // delete all images
      const imagesIds = product.images.map(p => p.publicId);
      const imageDeleteResult = await cloudinary.api.delete_resources(imagesIds);
      // Its ok if no images are found, a product might somehow end up with some images pointing to
      // resources that have already been deleted. And in this case, we still want the req to return sucess and product doc to be altered
      // const hasDeletedAtLeastOne =  Object.values(imageDeleteResult.deleted).some(value => value === 'deleted');
      // if(!hasDeletedAtLeastOne){
      //   throw new CustomError('No Product Images could be deleted. Product was not deleted', {error: imageDeleteResult})
      // }

      return res.json({message: `success`, result: imageDeleteResult})
    });
  } catch (error) {
    const {message, errors, stack} = error;
    if(error instanceof CustomError){
      throw error;
    }
    throw new TransactionError(message);
  } finally {
    session.endSession();
  }
});

// Frontend allows you to edit product to remove/add whichever images.
// Submitting the form starts the process:
// 1- Get a presigned URL to upload any new images
// 2- Use the presign URL in the frontend to upload the new images
// 3- Backend recieves an array of 'imagesIds' with entire set of imageIds to save to db.
// It retrives the prduct, and diffs the new imagesIds vs the existing imagesIds,
// to find which images to delete.
// 4- Backend starts a transaction where it sets the new imagesIds, then it deletes
// the images that need to be deleted from cloudinary
export const editProduct = asyncHandler(async (req, res) => {
  if(!req.user.isUserLevelMoreThanOrEqualTo('admin')){
    throw new AuthorizationError('User Level of Admin required to access this resource')
  }
  const { id } = req.params;
  const {name, description, price, images, visibility, categories} = req.validatedData;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const product = await Product.findById(id).populate('createdBy').session(session);
      if(!product){
        throw new NotFoundError('Product not found');
      }
    
      const userLevel = req.user.userLevel
      const creatorLevel = product.createdBy.userLevel;
      if(!req.user.isUserLevelMoreThanOrEqualTo(creatorLevel)){
        throw new AuthorizationError(`You do not have a higher user level than the product creator. ${userLevel} tried to delete product by ${creatorLevel}`);
      }
      
      const imagesToDelete = [] //images previously in DB but not in input
      const imagesToAdd = [] // images not in DB but in input
      const imagesInBothDbAndInput = [] // images in both DB and input
      
      // if input is not the same as DB doc images. Also keep in mind someone could
      // just change the img.order, and we would still run this (this is ok)
      if (!_.isEqual(product.images, images)) {
        // TODO maybe move below to after the document is saved, because if we delete
        // image first, then run into an error later, then we can end up with a
        // document that was not edited, but its images have been deleted from cloudinary
        
        // Sort input images
        const inputImageIds = new Set(images.map(inputImg => inputImg.publicId));
        product.images.forEach(dbImg => {
          if (inputImageIds.has(dbImg.publicId)) {
            imagesInBothDbAndInput.push(dbImg);
          } else {
            imagesToDelete.push(dbImg);
          }
        });

        const dbImageIds = new Set(product.images.map(dbImg => dbImg.publicId));
        images.forEach(inputImg => {
          if (!dbImageIds.has(inputImg.publicId)) {
            imagesToAdd.push(inputImg);
          }
        });
      
        // 2. Mark new images as uploaded. Old images have already been marked before.
        // If imagesToAdd is empty array, then this will also be empty array
        const { responsesSuccessful } = await markAsUploaded(imagesToAdd);
      
        // 3. Update value for DB Doc.images
        const imagesMarkedAsUploaded = responsesSuccessful.map(({cloudinaryResponse, order, publicId}) => ({
          url: cloudinaryResponse.secure_url,
          publicId: cloudinaryResponse.public_id,
          order
        }))
        const newImages = [...imagesMarkedAsUploaded, ...imagesInBothDbAndInput];
        
        
        product.images = newImages;
      }
      product.name = name ?? product.name;
      product.description = description ?? product.description;
      product.price = price ?? product.price;
      product.visibility = visibility?? product.visibility;
      product.categories = categories ?? product.categories;
      product.visibility = visibility ?? product.visibility;
    
      try {
        if (product.isModified()) {
          const newProduct = await product.save({session});

          // 4. Delete Images that were in DB Doc, but are not in the input
          let imageDeleteResult;
          if(imagesToDelete.length > 0){
            const imagesIds = imagesToDelete.map(p => p.publicId);
            imageDeleteResult = await cloudinary.api.delete_resources(imagesIds);
            // Its ok if no images are found, a product might somehow end up pointing to some images
            // resources that have already been deleted. And in this case, we still want the req to
            // return sucess and product doc to be altered
            // const hasDeletedAtLeastOne =  Object.values(imageDeleteResult.deleted).some(value => value === 'deleted');
            // if(!hasDeletedAtLeastOne){
            //   throw new CustomError('Old Products Images could be deleted. Product changed couldnot be saved', {error: imageDeleteResult})
            // }
          }

          return res.json({ product: newProduct, imageDeleteResult });
        }
        return res.json({ product });
    
      } catch (error) {
        const imagesDeleted = await Promise.allSettled(
          imagesToAdd.map(({publicId}) =>cloudinary.uploader.destroy(publicId))
        );
        throw new CustomError('Could not store product details into database', {imagesDeleted});
        // const out = await cloudinary.uploader.destroy(publicId);
        // throw new CustomError('Could not store product details into database', {imageDeletedStatus: {...out}});
        // out.result can be "ok" || "not found", maybe more
      }
    });
  } catch (error) {
    const {message, errors, stack} = error;
    if(error instanceof CustomError){
      throw error;
    }
    throw new TransactionError(message);
  } finally {
    session.endSession();
  }

  
})

