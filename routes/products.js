import express from 'express';
import { validateFieldsZod } from '../middleware/validationMiddleware.js';
import {  addOrEditProductRating, addProduct, deleteProduct, editProduct, getPresignedUrl, getProductById, getProducts, getProductsPublic } from '../controllers/productsController.js';
import { productRatingSchema, productSchema } from '../../shared/dist/schemas.js';
import { authMandatory } from '../middleware/authMiddleware.js';


const router = express.Router();


router.get('/',
  getProductsPublic
)

router.get('/admin',
  authMandatory,
  getProducts
)

router.get('/:id',
  getProductById
)

router.post('/upload-presigned',
  authMandatory,
  validateFieldsZod(productSchema.omit({images: true})),
  getPresignedUrl,
);

router.post('/',
  authMandatory,
  validateFieldsZod(productSchema),
  addProduct,
)

router.patch('/:id',
  authMandatory,
  validateFieldsZod(productSchema.partial()), // all fields optional to edit
  editProduct,
)
router.delete('/:id',
  authMandatory,
  deleteProduct
)


// product ratings
router.post('/:id/my-rating',
  authMandatory,
  validateFieldsZod(productRatingSchema),
  addOrEditProductRating,
)

router.delete('/:id/my-rating',
  authMandatory,
  addOrEditProductRating,
)


export default router;