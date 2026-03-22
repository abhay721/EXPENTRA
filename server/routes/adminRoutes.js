import express from 'express';
import { protect, admin } from '../middleware/authMiddleware.js';
import {
    getAdminDashboardStats,
    getUsers,
    updateUser,
    deleteUser,
    getUserExpenses,
    deleteUserExpense,
    getCategories,
    createCategory,
    updateCategory,
    deleteCategory,
    getReports,
    getAdminAnalytics
} from '../controllers/adminController.js';

const router = express.Router();

// All routes require authentication and admin role
router.use(protect, admin);

// Dashboard
router.get('/dashboard', getAdminDashboardStats);

// Users
router.get('/users', getUsers);
router.put('/users/:id', updateUser);
router.put('/users/:id', deleteUser);
router.get('/users/:id/expenses', getUserExpenses);
router.delete('/users/:userId/expenses/:expenseId', deleteUserExpense);

// Categories
router.get('/categories', getCategories);
router.post('/categories', createCategory);
router.put('/categories/:id', updateCategory);
router.delete('/categories/:id', deleteCategory);

// Reports
router.get('/reports', getReports);

// Advanced Analytics
router.get('/analytics/overview', getAdminAnalytics);

export default router;
