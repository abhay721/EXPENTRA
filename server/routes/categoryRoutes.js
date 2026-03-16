import express from 'express';
import { protect } from '../middleware/authMiddleware.js';
import { getCategories } from '../controllers/adminController.js';

const router = express.Router();

// Allow all authenticated users to GET predefined categories
router.get('/', protect, getCategories);

export default router;
