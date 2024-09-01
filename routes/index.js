import express from 'express';
import asyncHandler from 'express-async-handler';
import Product from '../models/Product.js';
import '../config/cloudinary.js'
import '../config/database.js'
import {v2 as cloudinary} from 'cloudinary'
import { CloudinaryError, CustomError } from '../errors/errors.js';
// const multer = require('multer');

const router = express.Router();

router.get('/',
  // authOptional,
  asyncHandler(async (req, res) => {
    res.json({messsage:`success`})
  })
)


// options for upload:
//https://cloudinary.com/documentation/image_upload_api_reference#upload_optional_parameters
router.get('/products/generate-presigned-url', async (req, res) => {
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
    console.log(err);
    res.status(500).json({ error: 'Failed to generate pre-signed URL' });
  }
});

//https://cloudinary.com/documentation/update_assets
//https://cloudinary.com/documentation/image_upload_api_reference#explicit
router.post('/products',
  asyncHandler(async (req, res) => {
    const {name, description, price, imageId} = req.body;
    // const out = await cloudinary.uploader.remove_tag('unlinked', [imageId]);
    // above just returns an array  like: "public_ids": ["omero_vs_yassuo_old_icon_NAMES_CLOSER_1_vpntlt"]
    // if(out.public_ids.length === 0){
    //   throw new Error('image not found')
    // }
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
        image: {
          url: cloudinaryResponse.secure_url,
          publicId: cloudinaryResponse.public_id,
        },
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
)

export default router;