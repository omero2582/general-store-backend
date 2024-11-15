import asyncHandler from 'express-async-handler';
import Product from '../models/Product.js';
import {v2 as cloudinary} from 'cloudinary'
import { AuthorizationError, CloudinaryError, CustomError, NotFoundError, TransactionError } from '../errors/errors.js';
import mongoose from 'mongoose';
import Category from '../models/Category.js';
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
  // if (!products.length) {
  //   throw new NotFoundError('No products found');
  // }
  // prob just return empty array if no products
  return res.json({products});
})

export const getProducts = asyncHandler(async (req, res) => {
  if(!req.user.isUserLevelMoreThanOrEqualTo('admin')){
    throw new AuthorizationError('User Level of Admin required to access this resource')
  }
  let products = await Product.find().populate(['createdBy', 'categories']);
  return res.json({products});
})

// options for upload:
//https://cloudinary.com/documentation/image_upload_api_reference#upload_optional_parameters
export const getPresignedUrl = asyncHandler(async (req, res) => {
  if(!req.user.isUserLevelMoreThanOrEqualTo('admin')){
    throw new AuthorizationError('User Level of Admin required to access this resource')
  }
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
export const addProduct = asyncHandler(async (req, res) => {
  if(!req.user.isUserLevelMoreThanOrEqualTo('admin')){
    throw new AuthorizationError('User Level of Admin required to access this resource')
  }
  const {name, description, price, images, visibility, categories} = req.validatedData;
  // const out = await cloudinary.uploader.remove_tag('unlinked', [imageId]);
  // above just returns an array  like: "public_ids": ["omero_vs_yassuo_old_icon_NAMES_CLOSER_1_vpntlt"]
  // if(out.public_ids.length === 0){
  //   throw new Error('image not found')
  // }
  // I prefer context instead of tags, like below, because maybe in the future maybe I want to
  // allow tags input, and then it would be problematic to keep them here
  // I would be forced to use uploader.remove_tag, then api.resource (2 calls),
  // Or i would have to trust the client to send in the approporate tags
    
  let responsesAllSettled = await Promise.allSettled(
    images.map(async (image) => {
      try {
        let cloudinaryResponse = await cloudinary.uploader.explicit(image.imageId, {
          type:'upload',
          context: 'linked=true'  
          // this deletes all other context besides this, right now we dont have any
        })
        return {...image, cloudinaryResponse}
        // we need the inner async awaits inside the .map above, because we need the result in the object we return
      } catch (error) {
        throw {...image, cloudinaryResponse: error}
      }
    })
  );

  // Separate successful and failed responses
  let responsesSuccessful = [];
  let responsesFailed = [];
  responsesAllSettled.forEach((promise) => {
    if(promise.status === 'fulfilled'){
      responsesSuccessful.push(promise.value);
    }else{
      responsesFailed.push(promise.reason)
    }
  });

  // If some failed to add tag on explicit(), then take all the successful ones, and revert them to 'linked=false
  // Since above we set 'linked=true', then we know that the assets DO exist, so if below throws error, its a network problem
  if(responsesFailed.length > 0){
    await Promise.allSettled( // if these result in errors, then network problem
      responsesSuccessful.map(({cloudinaryResponse}) => {
        return cloudinary.uploader.explicit(cloudinaryResponse.public_id, {
          type:'upload',
          context: 'linked=false'  
        })
      })
    )
    // TODO allSettled() above can result in err responses too, not much we can do. We are forced to add a second cron job,
    // which will look up all the product images in our database, then compare them to our cloudinary images,
    // and then delete the ones that arent used in any products. Not sure tho bc in the future we might wish
    // to just show the user all their cloudinary images, and let them handle it. We'd just show them their storage limits
    throw new CustomError('Error setting context tags for image assets', {responsesFailed})
  }

  

  try {
    const product = new Product({
      createdBy: req.user,
      name,
      description,
      price,
      categories,
      images: responsesSuccessful.map(({cloudinaryResponse, order, imageId}) => ({
        url: cloudinaryResponse.secure_url,
        publicId: cloudinaryResponse.public_id,
        order
      })),
      visibility,
    });
    await product.save();
    res.json({messsage:`success`, product})
  } catch (error) {
    const imagesDeleted = await Promise.allSettled(
      images.map(({imageId}) =>cloudinary.uploader.destroy(imageId))
    );
    throw new CustomError('Could not store product details into database', {imagesDeleted});
    // const out = await cloudinary.uploader.destroy(imageId);
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

// TODO new new oct 3 - For editProduct, will also have to check if req.user.userLevel
// is higher level than product.createdBy.userLevel, in the same way we check in deleteProduct.
// Make sure to await and pass session to all transactions
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
  if(!req.user.isUserLevelMoreThanOrEqualTo('admin')){
    throw new AuthorizationError('User Level of Admin required to access this resource')
  }
  const { id } = req.params;
  const {name, description, price, imageId, visibility} = req.validatedData;
  // everything is optional

  const product = await Product.findById(id).populate('createdBy').session(session);
  if(!product){
    throw new NotFoundError('Product not found');
  }

  const userLevel = req.user.userLevel
  const creatorLevel = product.createdBy.userLevel;
  if(!req.user.isUserLevelMoreThanOrEqualTo(creatorLevel)){
    throw new AuthorizationError(`You do not have a higher user level than the product creator. ${userLevel} tried to delete product by ${creatorLevel}`);
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

// Categories
export const getCategories = asyncHandler(async (req, res) => {
  const categories = await Category.find().populate('createdBy');
  return res.json({categories})
});

export const addCategory = asyncHandler(async (req, res) => {
  if(!req.user.isUserLevelMoreThanOrEqualTo('admin')){
    throw new AuthorizationError('User Level of Admin required to access this resource')
  }
  const { name } = req.body;
  const categoryFound = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } })
  if(categoryFound){
    throw new CustomError(`Category '${name}' Already Exists`)
  }

  const newCategory = new Category({name, createdBy: req.user})
  const category = await newCategory.save();
  return res.json({category})
});

// Deletes Category + Removes Category from all Products that contain this category
export const deleteCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  if(!req.user.isUserLevelMoreThanOrEqualTo('admin')){
    throw new AuthorizationError('User Level of Admin required to access this resource')
  }
  // const { name } = req.body;
  // const categoryFound = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } })
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {

      const categoryFound = await Category.findById(id);
      if(!categoryFound){
        throw new NotFoundError(`Category Not Found`)
      }
      const category = await categoryFound.deleteOne().session(session);

      await Product.updateMany(
        { categories: id },
        { $pull: { categories: id } }
      ).session(session);
      
      return res.json({category})
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

export const editCategory = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name } = req.body;
  
  if(!req.user.isUserLevelMoreThanOrEqualTo('admin')){
    throw new AuthorizationError('User Level of Admin required to access this resource')
  }
  // const categoryFound = await Category.findOne({ name: { $regex: new RegExp(`^${name}$`, 'i') } })
  const categoryFound = await Category.findById(id);
  if(!categoryFound){
    throw new NotFoundError(`Category Not Found`)
  }

  categoryFound.name = name;
  const category = await categoryFound.save();
  return res.json({category})
});