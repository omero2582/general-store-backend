import asyncHandler from 'express-async-handler';
import Product from '../models/Product.js';
import {v2 as cloudinary} from 'cloudinary'
import { AuthorizationError, CloudinaryError, CustomError, NotFoundError, TransactionError } from '../errors/errors.js';
import mongoose from 'mongoose';
import Category from '../models/Category.js';
import { generatePreSignedUrl, markAsUploaded } from '../services/cloudinary.js';

import _ from 'lodash'
import ProductRating from '../models/ProductRating.js';
// IMPORTANT. when using 'cloudinary.api' methods, we are using the admin api,
// which has rate limit of 500 calls per hour on free tier. 2000 per hour for paid acc

export const extractProductsSortAndFilter =  asyncHandler(async (req, res, next) => {
  const { categories, sort, minPrice, maxPrice } = req.query;

  let filter = {};

  // Category filtering
  if (categories) {
    const categoryNames = categories.split(',').map(name => name.trim());
    const categoryRegexes = categoryNames.map(name => new RegExp(`^${name}$`, 'i'));
    
    const matchedCategories = await Category.find({ name: { $in: categoryRegexes } }).select('_id');
    const categoryIds = matchedCategories.map(cat => cat._id);
    filter.categories = { $in: categoryIds }; // Split comma-separated categories
  }

  // Price filtering
  if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
  }

  // Sorting
  let sortOption = {};
  const allowedSortFields = ['price', 'rating', 'name'];
  if (sort) {
      const [field, order] = sort.split('-');
      if (allowedSortFields.includes(field)) {
        sortOption[field] = order === 'asc' ? 1 : -1;
      }
  }
  req.sortAndFilter = {sortOption, filter}
  next()
})

export const getProductById = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const product = await Product.findOne({_id: id, visibility: 'public'}).populate(['createdBy', 'categories']);
  if(!product){
    throw new NotFoundError('Product not found');
  }
  return res.json({product});
})

export const getProductsPublic = asyncHandler(async (req, res) => {
  const {sortOption, filter} = req.sortAndFilter;
  
  const products = await Product.find({...filter, visibility: 'public'})
    .populate('categories')
    .sort(sortOption);
  return res.json({products});
})

export const getProducts = asyncHandler(async (req, res) => {
  const {sortOption, filter} = req.sortAndFilter;

  if(!req.user.isUserLevelMoreThanOrEqualTo('admin')){
    throw new AuthorizationError('User Level of Admin required to access this resource')
  }
  const products = await Product.find(filter)
    .populate(['createdBy', 'categories'])
    .sort(sortOption);
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
      minUserLevelForActions: req.user.userLevel,
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
      const requiredLevel = product.minUserLevelForActions;
      if(!req.user.isUserLevelMoreThanOrEqualTo(requiredLevel)){
        throw new AuthorizationError(`You do not have meet the user level requirement to delete this product. ${userLevel} tried to delete product requiring ${requiredLevel}`);
      }
      // delete document
      await product.deleteOne().session(session);
      //delete product ratings
      await ProductRating.deleteMany({ product: id }).session(session)

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
      const requiredLevel = product.minUserLevelForActions;
      if(!req.user.isUserLevelMoreThanOrEqualTo(requiredLevel)){
        throw new AuthorizationError(`You do not have meet the user level requirement to edit this product. ${userLevel} tried to edit product requiring ${requiredLevel}`);
      }
      
      const imagesToDelete = [] //images previously in DB but not in input
      const imagesToAdd = [] // images not in DB but in input
      const imagesInBothDbAndInput = [] // images in both DB and input
      
      // if input is not the same as DB doc images. Also keep in mind someone could
      // just change the img.order, and we would still run this (this is ok)
      // TODO Nov 28, just added this ccheck of if(images). Since images is optional, only run this part of the code if images is specified
      if (images && !_.isEqual(product.images, images)) {
        // TODO maybe move below to after the document is saved, because if we delete
        // image first, then run into an error later, then we can end up with a
        // document that was not edited, but its images have been deleted from cloudinary
        
        // Sort input images
        // const inputImageIds = new Set(images.map(inputImg => inputImg.publicId));
        const inputImageMap = new Map(images.map(inputImg => [inputImg.publicId, inputImg])); // Create a map for quick lookup of input images by publicId
        product.images.forEach(dbImg => {
          if (inputImageMap.has(dbImg.publicId)) {
            const inputImg = inputImageMap.get(dbImg.publicId);
            imagesInBothDbAndInput.push({
              ...dbImg,
              order: inputImg.order,
            }); // corrected?, we do want to push an object containing the dbImg.url, however we also want in to use the inputImg.order
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
        const newImages = [...imagesMarkedAsUploaded, ...imagesInBothDbAndInput]
          .sort((a, b) => a?.order - b?.order); // stores array in right order just in case,
          // althought in the frotnend we should never rely on this and always sort order manually
        
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

export const addOrEditProductRating = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { rating, review } = req.validatedData;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const product = await Product.findById(id).populate('createdBy').session(session);
      if(!product){
        throw new NotFoundError('Product not found');
      }

      if(product.createdBy.equals(req.user)){
        throw new AuthorizationError('You cannot add a rating to a Product you created')
      }
    
     const productRating = await ProductRating.findOne({product: id, user: req.user.id})
      .session(session);

     if(productRating){
      // already has rated this product
      console.log(`EDIT: old rating = ${productRating.rating}, new rating: ${rating}`)
      const oldRating = productRating.rating;   // this will be modified below, so we are preserving the value here
      productRating.rating = rating;
      productRating.review = review || productRating.review;
      //update product.rating
      if(productRating.isModified()){
        await productRating.save({session});
        const newAverage = (product.rating * product.numRatings - oldRating + rating) / product.numRatings;
        console.log(`${product.rating} * ${product.numRatings} - ${oldRating} + ${rating} = ${newAverage}`)
        console.log('edited productRating has different values than previously.')
        console.log(`Old avg: ${product.rating}. New avg: ${newAverage}`)
        await product.updateOne({ 
          rating: newAverage 
        }).session(session);
      }  

      return res.json({ message: "Rating updated successfully." });
     }else {
      // new product Rating
      const newProductRating = new ProductRating({
        user: req.user,
        product: id,
        rating,
        review,
      });
      const out = await newProductRating.save({session});

      // add rating to product.rating
      const newAverage = (product.rating * product.numRatings + rating) / (product.numRatings + 1);
      await product.updateOne({ 
        rating: newAverage, 
        numRatings: product.numRatings + 1 
      }).session(session);

      return res.json({newProductRating: out})
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

// TODO test this below
export const removeProductRating = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      const product = await Product.findById(id).populate('createdBy').session(session);
      if(!product){
        throw new NotFoundError('Product not found');
      }
    
     const productRating = await ProductRating.findOne({product: id, user: req.user.id})
      .session(session);

     if(productRating){
      // already has rated this product
      await productRating.deleteOne({session});

      //update product.rating
      const newAverage =
        product.numRatings > 1
          ? (product.rating * product.numRatings - this.rating) / (product.numRatings - 1)
          : 0;
      await product.updateOne({ 
        rating: newAverage, 
        numRatings: product.numRatings - 1 
      });

      return res.json({ message: "Rating removed successfully." });
     }else {
      throw new NotFoundError('Rating by this user does not exist')
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