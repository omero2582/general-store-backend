import express from 'express';
import asyncHandler from 'express-async-handler';
import Product from '../models/Product.js';

import {v2 as cloudinary} from 'cloudinary'
//

//
const multer = require('multer');
const { CloudinaryStorage } = require('multer-storage-cloudinary');
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
  cloud_name: 'your-cloud-name',
  api_key: 'your-api-key',
  api_secret: 'your-api-secret',
});

const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'products',
    format: async (req, file) => 'png', // supports promises
    public_id: (req, file) => 'computed-filename-using-request',
  },
});

const upload = multer({ storage });


router.post('/products',
  asyncHandler(async (req, res) => {
    upload.single('image')(req, res, async function (err) {
      if (err) {
        // Handle any errors from Multer or Cloudinary
        console.error('Upload Error:', err);
        return res.status(500).json({ error: 'Failed to upload image to Cloudinary' });
      }
  
      try {
        // Proceed with saving the document if upload was successful
        const {name, description, price, image} = req.body;
        const product = new Product({
          name,
          description,
          price,
          // image,
        });
        await product.save();
        res.json({messsage:`success`, product})
      } catch (error) {
        // If saving to the database fails, delete the uploaded file from Cloudinary
        if (req.file && req.file.filename) {
          await cloudinary.uploader.destroy(req.file.filename);
        }
        res.status(500).json({ error: 'Failed to save document to the database' });
      }
    });
  })
);


//

export default router;