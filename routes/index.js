import express from 'express';
import asyncHandler from 'express-async-handler';
import Product from '../models/Product.js';

import {v2 as cloudinary} from 'cloudinary'
//

//
// const multer = require('multer');
//


const router = express.Router();

router.get('/',
  // authOptional,
  asyncHandler(async (req, res) => {
    res.json({messsage:`success`})
  })
)


// router.post('/products',
//   asyncHandler(async (req, res) => {
//     const {name, description, price, image} = req.body;
//     const product = new Product({
//       name,
//       description,
//       price,
//       // image,
//     });
//     await product.save();
//     res.json({messsage:`success`, product})
//   })
// )

// const uploadImage = async () => {
//   const timestamp = new Date().getTime();
//   const signature = cloudinary.utils.api_sign_request(
//     {
//       timestamp,
//     },
//     process.env.CLOUDINARY_SECRET
//   );
//   return { timestamp, signature }
// }

//

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_NAME,
  api_key: process.env.CLOUDINARY_KEY,
  api_secret: process.env.CLOUDINARY_SECRET,
});
//
// is it possible to use above and oimit them below?

// options for upload:
//https://cloudinary.com/documentation/image_upload_api_reference#upload_optional_parameters
router.get('/generate-presigned-url', async (req, res) => {
  try {
    const timestamp = Math.round(new Date().getTime() / 1000);
    const asset_folder = 'products';
    const tags = 'unlinked';
    const allowed_formats = ['jpg', 'png', 'webp', 'jfif'];
    const use_filename= true;
    
    const signature = cloudinary.utils.api_sign_request({
      timestamp,
      asset_folder,
      tags,
      allowed_formats,
      use_filename,
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
    },  process.env.CLOUDINARY_SECRET);

    res.json({ 
      signature,
      timestamp,
      asset_folder,
      tags,
      allowed_formats,
      use_filename,
      cloudname: process.env.CLOUDINARY_NAME,
      apikey: process.env.CLOUDINARY_KEY
     });
  } catch (err) {
    console.log(err);
    res.status(500).json({ error: 'Failed to generate pre-signed URL' });
  }
});


// router.post('/products',
//   asyncHandler(async (req, res) => {
//     upload.single('image')(req, res, async function (err) {
//       if (err) {
//         // Handle any errors from Multer or Cloudinary
//         console.error('Upload Error:', err);
//         return res.status(500).json({ error: 'Failed to upload image to Cloudinary' });
//       }
  
//       try {
//         // Proceed with saving the document if upload was successful
//         const {name, description, price, image} = req.body;
//         const product = new Product({
//           name,
//           description,
//           price,
//           // image,
//         });
//         await product.save();
//         res.json({messsage:`success`, product})
//       } catch (error) {
//         // If saving to the database fails, delete the uploaded file from Cloudinary
//         if (req.file && req.file.filename) {
//           await cloudinary.uploader.destroy(req.file.filename);
//         }
//         res.status(500).json({ error: 'Failed to save document to the database' });
//       }
//     });
//   })
// );


//

export default router;