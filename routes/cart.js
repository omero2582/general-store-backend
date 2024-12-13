import express from 'express';
import { authMandatory } from '../middleware/authMiddleware.js';
import { addCartProduct, deleteCartProduct, editCartProduct, getCart } from '../controllers/cartController.js';

const router = express.Router();

// TODO add validation to below
// its just quanity and productId
// productId must be mongoId, quantity must not be less than 1 ?? unless we want
// and editing to 0 to remove from cart??? we can do that
// Yeah I prefer if on editCartProduct, editing quantity to 0 just deletes item
// but on addCartProduct, adding less than 1 is a problem 
router.get('/',
  authMandatory,
  getCart
)

router.post('/',
  authMandatory,
  addCartProduct,
)

router.patch('/',
  authMandatory,
  editCartProduct,
)

router.delete('/:id',
  authMandatory,
  deleteCartProduct,
)

export default router;