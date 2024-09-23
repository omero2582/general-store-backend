import express from 'express';
import asyncHandler from 'express-async-handler';
import '../config/cloudinary.js'
import '../config/database.js'
import { z } from "zod";
import { validateFieldsZod } from '../middleware/validationMiddleware.js';
import { addProduct, deleteProduct, editProduct, getPresignedUrl, getProducts } from '../controllers/productsController.js';
import { productSchema } from '../../general-store-shared/schemas/schemas.js';

// const multer = require('multer');
// TODO custom icon on tab that serves files:
//https://cloudinary.com/documentation/advanced_url_delivery_options#custom_favicons
const router = express.Router();

router.post('/products/upload-presigned',
  validateFieldsZod(productSchema.omit({images: true})),
  getPresignedUrl,
);

router.post('/products',
  validateFieldsZod(productSchema),
  addProduct,
)

//
router.patch('/products',
  // validateFieldsZod(productSchema.extend({
  //   imageId: z.string().min(1, "imageId is required").optional(),
  // })),
  validateFieldsZod(productSchema.partial()), // all fields optional to edit
  editProduct,
)
router.delete('/products/:id',
  deleteProduct
)
//

router.get('/products',
  getProducts
)


router.get('/',
  // authOptional,
  asyncHandler(async (req, res) => {
    res.json({messsage:`success`})
  })
)

export default router;