import express from 'express';
import asyncHandler from 'express-async-handler';
import Product from '../models/Product.js';
import '../config/cloudinary.js'
import {v2 as cloudinary} from 'cloudinary'
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
      tags: 'unlinked',
      allowed_formats: ['jpg', 'png', 'webp', 'jfif'],
      use_filename: true,
    }
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
// currently just using uploader.remove_tag. This doesnt return the image values,
// so alternatively we can use uploader.explicit. The only problem is this doesnt
// let you remove 1 specific tag. It only lets you overrride ALL tags.
// It does however let you change context. So maybe I can switch to using
// something like 'linked: false' in context, and just toggling that
router.post('/products',
  asyncHandler(async (req, res) => {
    const {name, description, price, imageId} = req.body;
    const out = await cloudinary.uploader.remove_tag('unlinked', [imageId]);
    // above just returns an array  like: "public_ids": ["omero_vs_yassuo_old_icon_NAMES_CLOSER_1_vpntlt"]
    if(out.public_ids.length === 0){
      throw new Error('image not found')
    }

    // TODO TODO. Just realized we cant do it this way and need slight change..
    // We need to store the image URL below, but we are only acceptin imageId (cloudinary public Id)
    // We cant accept 2 body poarams imageID and imageURL, because then when we
    // save the document, we'd be trusting that the imageURL corresponds to the imageID....
    // So instead, we should either swithc to accepting a imageURL and extracting the publicID from it,
    // or we can switch to using uploader.explicit and switching to using adding a context
    // linked=false instead.
    // I think just switch to above, because I can just foresee problems with url input inconsitencies
    // for example they send in wrongUrl/correctPublicId.jpg, and I'd be extracting and
    // finding the image at correctPublicId, but then storing the wrongUrl in database
    try {
      const product = new Product({
        name,
        description,
        price,
        imageId,
      });
      await product.save();
    } catch (error) {
      const out = await cloudinary.uploader.destroy(imageId);
      return res.status(500).json({out, message: 'Error saving to DB. deleted file?'})
      // Error saving to DB. Shouldnt be validation error since fields passed validation
      // maybe delete the image in cloudinary and say DB error?
      // Or dont delete. If we don't delete then we'd have to give the user
      // some sort of image folder that they can alternatively use
      // The problem is that now by design, we would be allowing ghost files
      // on purpose... its just that we would be displaying them to the user...
      // so maybe its not bad ???
    }

    // res.json({messsage:`success`, product})
  })
)
// not sure if this should have some sort of way of veryfying that it comes
// from a rewues that was just signed? I guess access the url first, and then 
// check that it comes from my cloud name and that it was generated in the last 24 hours??

export default router;