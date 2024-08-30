import express from 'express';
import asyncHandler from 'express-async-handler';
import Product from '../models/Product';

import {v2 as cloudinary} from 'cloudinary'

const router = express.Router();

router.get('/',
  // authOptional,
  asyncHandler(async (req, res) => {
    res.json({messsage:`success`})
  })
)


router.post('/products',
  asyncHandler(async (req, res) => {
    const {name, description, price, image} = req.body;
    const product = new Product({
      name,
      description,
      price,
      // image,
    });
    await product.save();
    res.json({messsage:`success`, product})
  })
)

const uploadImage = async () => {
  const timestamp = new Date().getTime();
  const signature = cloudinary.utils.api_sign_request(
    {
      timestamp,
    },
    process.env.CLOUDINARY_SECRET
  );
  return { timestamp, signature }
}

export default router;