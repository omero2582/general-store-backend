import asyncHandler from 'express-async-handler';
import Product from '../models/Product.js';
import {v2 as cloudinary} from 'cloudinary'
import { CloudinaryError, CustomError, NotFoundError, TransactionError } from '../errors/errors.js';
import mongoose from 'mongoose';
// TODO
// IMPORTANT. when using 'cloudinary.api' methods, we are using the admin api,
// which has rate limit of 500 calls per hour on free tier. 2000 per hour for paid acc


// options for upload:
//https://cloudinary.com/documentation/image_upload_api_reference#upload_optional_parameters
export const getPresignedUrl = asyncHandler(async (req, res) => {
  try {
    const options = {
      timestamp: Math.round(new Date().getTime() / 1000),
      asset_folder: 'products',
      allowed_formats: ['jpg', 'png', 'webp', 'jfif'],
      use_filename: true,
      context: 'linked=false|test=true'
      // to add more context, separate them with pipe, for ex: 'linked=false|abc=true'
      // not sure how else to add multiple contexts . Object doesnt work
    }
    // tags: 'unlinked',
    // eager: 'c_pad,h_300,w_400|c_crop,h_200,w_260',
    // access_mode: can be public or authenticated. defaults to public
    // access_control
    // context
    // metadata

    // context, metadata, and tags are all types of metadata:
    // https://cloudinary.com/documentation/custom_metadata
    // The main differeneces are:
    // tags = array of string
    // context = array of key/value pairs
    // metadata = same as context, but the fields are defined GLOBALLY on a project
    // not sure if I should add metadata besides tags. If I do, I could
    // add things like 'title' and 'description'. But I will already be 
    // addding this to the database, where I prefer it, so I don't see the point
    // of adding it here too, since we will always be browsing products by looking
    // at our database and each prducts url there, not by browsing cloudinary
    
    const signature = cloudinary.utils.api_sign_request({
    ...options
    },  cloudinary.config().api_secret);

    res.json({ 
      cloudname: cloudinary.config().cloud_name,
      options: {
        api_key: cloudinary.config().api_key,
        signature,
        ...options
      }
    });
  } catch (err) {
    throw new CustomError('Failed to generate pre-signed URL');
  }
})

//https://cloudinary.com/documentation/update_assets
//https://cloudinary.com/documentation/image_upload_api_reference#explicit
// TODO after changing DB schema from image to images, this still works correctly,
// but now change this to actually support uplaoding multiple images.
// Will have to change whole process of upolading
export const addProduct = asyncHandler(async (req, res) => {
  const {name, description, price, images, visibility} = req.body;
  // const out = await cloudinary.uploader.remove_tag('unlinked', [imageId]);
  // above just returns an array  like: "public_ids": ["omero_vs_yassuo_old_icon_NAMES_CLOSER_1_vpntlt"]
  // if(out.public_ids.length === 0){
  //   throw new Error('image not found')
  // }
  const {imageId, order} = images[0];
  let cloudinaryResponse;
  try {
    cloudinaryResponse = await cloudinary.uploader.explicit(imageId, {
      type:'upload',
      context: 'linked=true'  
      // this deletes all other context besides this, right now we dont have any
    })
  } catch (err) {
    throw new CloudinaryError(err);
  }
  // I think at the end of the day though, its better to do it like rn where
  // we use context instead of tags, because maybe in the future I want to
  // allow tags input, and then it would be problematic to keep them here
  // I would be forced to use uploader.remove_tag, then api.resource (2 calls),
  // Or i would have to trust the client to send in the approporate tags

  try {
    const product = new Product({
      name,
      description,
      price,
      images: [{
        url: cloudinaryResponse.secure_url,
        publicId: cloudinaryResponse.public_id,
        order
      }],
      visibility,
    });
    await product.save();
    res.json({messsage:`success`, product})
  } catch (error) {
    const out = await cloudinary.uploader.destroy(imageId);
    // out.result can be "ok" || "not found", maybe more
    throw new CustomError('Could not store product details into database', {imageDeletedStatus: {...out}});
    // Wont be a validation error since fields passed validation
    // In the future maybe don't delete nor give context of linked to any image
    // Instead give the user an image viewer. Then by design, we would be
    // allowing ghost files on purpose but displaying them to the user...
    // not sure, maybe its better but this is in long long future bc image
    // viewer would me complicated to implement
  }
})

export const getProducts = asyncHandler(async (req, res) => {
  const isAdmin = true; // req.user.isAdmin
  let products;
  if(isAdmin){
    products = await Product.find();
  }else{
    products = await Product.find({visibility: 'public'});
  }
  // if (!products.length) {
  //   throw new NotFoundError('No products found');
  // }
  // prob just return empty array if no products
  return res.json({products});
})


export const deleteProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  // Transaction so that if image deletion fails, then document rolls back to not deleted
  // If our delete order was instead image deletion first, then we would
  // end up with no images but existing document
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      // delete document
      const product = await Product.findOneAndDelete({_id: id}).session(session);
      if(!product){
        throw new NotFoundError('Product not found');
      }

      // delete all images
      const imagesIds = product.images.map(p => p.publicId);
      const imageDeleteResult = await cloudinary.api.delete_resources(imagesIds);
      const hasDeletedAtLeastOne =  Object.values(imageDeleteResult.deleted).some(value => value === 'deleted');
      if(!hasDeletedAtLeastOne){
        throw new CustomError('No Product Images could be deleted. Product was not deleted', {error: imageDeleteResult})
      }

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

// TODO now fix after changeng DB schema from image to images
// What im thinking is, the frontend would allow you to be in 'Edit Mode'
// for a post, and remove/add whichever images. Then when you click on 'Save'
// it would start the porcess:
// 1- Get a presigned URL to upload any new images
// 2- Use the presign URL in the frontend to upload the new images
// 3- Backend recieves an array of 'imagesIds'. It retrives the prduct, and
// diffs the new imagesIds vs the existing imagesIds, to find which images to delete.
// 4- Backend starts a transaction where it sets the new imagesIds, then it deletes
// the images that need to be deleted from cloudinary
export const editProduct = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const {name, description, price, imageId, visibility} = req.body;
  // everything is optional

  const product = await Product.findById(id);
  if(!product){
    throw new NotFoundError('Product not found');
  }

  // delete old image
  const imageIdOld = product.image.publicId;
  const imageDeleteResult = await cloudinary.uploader.destroy(imageIdOld);

  if(imageDeleteResult?.result!== 'ok'){
    throw new CustomError('Old Product Image could not be deleted')
  }

  //tag new image as linked in cloudnary
  if(imageId){
    let cloudinaryResponse;
    try {
      cloudinaryResponse = await cloudinary.uploader.explicit(imageId, {
        type:'upload',
        context: 'linked=true'  
        // this deletes all other context besides this, right now we dont have any
      })
      // replace image DB entry
      product.image = {
        url: cloudinaryResponse.secure_url,
        publicId: cloudinaryResponse.public_id,
      }
    } catch (err) {
      throw new CloudinaryError(err);
    }
  }

  // Edit rest of document
  product.name = name ?? product.name;
  product.description = description ?? product.description;
  product.price = price ?? product.price;
  product.visibility = visibility?? product.visibility;

  try {
    await product.save()
  } catch (error) {
    const out = await cloudinary.uploader.destroy(imageId);
    // out.result can be "ok" || "not found", maybe more
    throw new CustomError('Could not edit product details into database', {error, imageDeletedStatus: {...out}});
  }

  return res.json({message: `success`, id, imageId})
})