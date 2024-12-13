import express from 'express';
import { validateFieldsZod } from '../middleware/validationMiddleware.js';
import { changeUserLevelSchema } from '../../shared/dist/schemas.js';
import { changeUserLevel } from '../controllers/userController.js';
import { authMandatory } from '../middleware/authMiddleware.js';

const router = express.Router();

// users
router.post('/level',
  authMandatory,
  validateFieldsZod(changeUserLevelSchema),
  changeUserLevel
)



export default router;