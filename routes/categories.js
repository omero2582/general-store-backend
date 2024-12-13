import express from 'express';
import { authMandatory } from '../middleware/authMiddleware.js';
import { addCategory, deleteCategory, editCategory, getCategories } from '../controllers/categoryController.js';

const router = express.Router();

// Categories
router.get('/',
  getCategories,
)

router.post('/',
  authMandatory,
  addCategory,
)
router.delete('/:id',
  authMandatory,
  deleteCategory,
)
router.patch('/:id',
  authMandatory,
  editCategory,
)


export default router;