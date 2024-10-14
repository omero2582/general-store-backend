import express from 'express';
import asyncHandler from 'express-async-handler';
import '../config/cloudinary.js'
import { z } from "zod";
import { validateFieldsZod } from '../middleware/validationMiddleware.js';
import { addProduct, deleteProduct, editProduct, getPresignedUrl, getProductById, getProducts, getProductsPublic } from '../controllers/productsController.js';
import { productSchema } from '../../general-store-shared/schemas/schemas.js';
import { changeUserLevelSchema } from '../../general-store-shared/schemas/schemas.js';
import { changeUserLevel } from '../controllers/userController.js';
import { authMandatory } from '../middleware/authMiddleware.js';
import { addCartProduct, deleteCartProduct, editCartProduct, getCart } from '../controllers/cartController.js';

// const multer = require('multer');
// TODO custom icon on tab that serves files:
//https://cloudinary.com/documentation/advanced_url_delivery_options#custom_favicons
const router = express.Router();


router.get('/products',
  getProductsPublic
)

router.get('/products/admin',
  (req, res, next) => {console.log('ADMIN PRODCUCTSSSSSWSSS'); next()},
  authMandatory,
  getProducts
)

router.get('/products/:id',
  (req, res, next) => {console.log('LOGGG'); next()},
  getProductById
)

router.post('/products/upload-presigned',
  authMandatory,
  validateFieldsZod(productSchema.omit({images: true})),
  getPresignedUrl,
);

router.post('/products',
  authMandatory,
  validateFieldsZod(productSchema),
  addProduct,
)

//
router.patch('/products',
  // validateFieldsZod(productSchema.extend({
  //   imageId: z.string().min(1, "imageId is required").optional(),
  // })),
  authMandatory,
  validateFieldsZod(productSchema.partial()), // all fields optional to edit
  editProduct,
)
router.delete('/products/:id',
  authMandatory,
  deleteProduct
)

router.post('/users/level',
  authMandatory,
  validateFieldsZod(changeUserLevelSchema),
  changeUserLevel
)

// TODO add validation to below
// its just quanity and productId
// productId must be mongoId, quantity must not be less than 1 ?? unless we want
// and editing to 0 to remove from cart??? we can do that
// Yeah I prefer if on editCartProduct, editing quantity to 0 just deletes item
// but on addCartProduct, adding less than 1 is a problem 
router.get('/cart',
  authMandatory,
  getCart
)

router.post('/cart',
  authMandatory,
  addCartProduct,
)

router.patch('/cart',
  authMandatory,
  editCartProduct,
)

router.delete('/cart/:id',
  authMandatory,
  deleteCartProduct,
)


export default router;