import express from 'express';
import '../config/cloudinary.js'
import productsRouter from '../routes/products.js'
import usersRouter from '../routes/users.js'
import categoriesRouter from '../routes/categories.js'
import cartRouter from '../routes/cart.js'
import authRouter from '../routes/auth.js'
import asyncHandler from 'express-async-handler';

// const multer = require('multer');
// TODO custom icon on tab that serves files:
//https://cloudinary.com/documentation/advanced_url_delivery_options#custom_favicons
const router = express.Router();

router.use('/products', productsRouter);
router.use('/users', usersRouter);
router.use('/categories', categoriesRouter);
router.use('/cart', cartRouter);
router.use('/auth', authRouter);


router.use('/', asyncHandler(async (req, res) => {
  res.json({message: 'success'})
}))


export default router;