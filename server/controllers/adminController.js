import User from '../models/userModel.js';
import Expense from '../models/expenseModel.js';
import Category from '../models/categoryModel.js';

// @desc    Get admin dashboard stats
// @route   GET /api/admin/dashboard
// @access  Private/Admin
export const getAdminDashboardStats = async (req, res, next) => {
    try {
        const totalUsers = await User.countDocuments();

        const expensesObj = await Expense.aggregate([
            { $group: { _id: null, total: { $sum: '$amount' } } }
        ]);
        const totalSystemExpenses = expensesObj[0]?.total || 0;

        // Note: For income we could calculate similarly if tracked in a separate collection or marked by category type
        const totalSystemIncome = 0; // Placeholder based on requirements

        const recentUsers = await User.find().sort({ createdAt: -1 }).limit(5).select('-password');

        // Usage Graph: System expenses over time
        const expensesByMonth = await Expense.aggregate([
            {
                $group: {
                    _id: { month: { $month: "$date" }, year: { $year: "$date" } },
                    total: { $sum: "$amount" }
                }
            },
            { $sort: { "_id.year": 1, "_id.month": 1 } }
        ]);

        const usageGraph = expensesByMonth.map(item => ({
            name: `${item._id.month}/${item._id.year}`,
            amount: item.total
        }));

        res.json({
            totalUsers,
            totalSystemExpenses,
            totalSystemIncome,
            recentUsers,
            usageGraph
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Get all users
// @route   GET /api/admin/users
// @access  Private/Admin
export const getUsers = async (req, res, next) => {
    try {
        const users = await User.find({}).select('-password');
        res.json(users);
    } catch (error) {
        next(error);
    }
};



// @desc    Update user (block/unblock, edit details)
// @route   PUT /api/admin/users/:id
// @access  Private/Admin
export const updateUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);

        if (user) {
            user.name = req.body.name || user.name;
            user.email = req.body.email || user.email;
            user.role = req.body.role || user.role;

            // Password Reset explicit tool
            if (req.body.password) {
                user.password = req.body.password; // bcrypt hashing handled in Mongoose pre-save hook 
            }

            if (req.body.status !== undefined) {
                const oldStatus = user.status;
                user.status = req.body.status;
                user.isBlocked = (req.body.status === 'blocked'); // Retain boolean compatibility flag


            }

            const updatedUser = await user.save();
            res.json({
                _id: updatedUser._id,
                name: updatedUser.name,
                email: updatedUser.email,
                role: updatedUser.role,
                status: updatedUser.status,
                isBlocked: updatedUser.isBlocked,
            });
        } else {
            res.status(404);
            throw new Error('User not found');
        }
    } catch (error) {
        next(error);
    }
};

// @desc    Delete user
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
export const deleteUser = async (req, res, next) => {
    try {
        const user = await User.findById(req.params.id);

        if (user) {
            await Expense.deleteMany({ userId: user._id }); // cleanup
            await User.deleteOne({ _id: user._id });
            res.json({ message: 'User removed' });
        } else {
            res.status(404);
            throw new Error('User not found');
        }
    } catch (error) {
        next(error);
    }
};

// @desc    Get specific user expenses
// @route   GET /api/admin/users/:id/expenses
// @access  Private/Admin
export const getUserExpenses = async (req, res, next) => {
    try {
        const expenses = await Expense.find({ userId: req.params.id });
        res.json(expenses);
    } catch (error) {
        next(error);
    }
};

// @desc    Delete specific user expense
// @route   DELETE /api/admin/users/:userId/expenses/:expenseId
// @access  Private/Admin
export const deleteUserExpense = async (req, res, next) => {
    try {
        const expense = await Expense.findOne({ _id: req.params.expenseId, userId: req.params.userId });

        if (expense) {
            await Expense.deleteOne({ _id: expense._id });
            res.json({ message: 'Expense removed' });
        } else {
            res.status(404);
            throw new Error('Expense not found');
        }
    } catch (error) {
        next(error);
    }
};

// CATEGORY CONTROLLERS

// @desc    Get categories
// @route   GET /api/admin/categories
// @access  Private/Admin
export const getCategories = async (req, res, next) => {
    try {
        const categories = await Category.find({});
        res.json(categories);
    } catch (error) {
        next(error);
    }
};

// @desc    Create category
// @route   POST /api/admin/categories
// @access  Private/Admin
export const createCategory = async (req, res, next) => {
    try {
        const { name, type, isActive } = req.body;
        const categoryExists = await Category.findOne({ name });
        if (categoryExists) {
            res.status(400);
            throw new Error('Category already exists');
        }

        const category = await Category.create({ name, type, isActive });
        res.status(201).json(category);
    } catch (error) {
        next(error);
    }
};

// @desc    Update category
// @route   PUT /api/admin/categories/:id
// @access  Private/Admin
export const updateCategory = async (req, res, next) => {
    try {
        const category = await Category.findById(req.params.id);
        if (category) {
            category.name = req.body.name || category.name;
            category.type = req.body.type || category.type;
            if (req.body.isActive !== undefined) {
                category.isActive = req.body.isActive;
            }

            const updatedCategory = await category.save();
            res.json(updatedCategory);
        } else {
            res.status(404);
            throw new Error('Category not found');
        }
    } catch (error) {
        next(error);
    }
};

// @desc    Delete category
// @route   DELETE /api/admin/categories/:id
// @access  Private/Admin
export const deleteCategory = async (req, res, next) => {
    try {
        const category = await Category.findById(req.params.id);
        if (category) {
            await Category.deleteOne({ _id: category._id });
            res.json({ message: 'Category removed' });
        } else {
            res.status(404);
            throw new Error('Category not found');
        }
    } catch (error) {
        next(error);
    }
};

// @desc    Get admin reports (system wide)
// @route   GET /api/admin/reports
// @access  Private/Admin
export const getReports = async (req, res, next) => {
    try {
        // Example system wide date-wise or user-wise depending on query
        const { startDate, endDate, userId } = req.query;
        let query = {};

        if (startDate && endDate) {
            query.date = { $gte: new Date(startDate), $lte: new Date(endDate) };
        }
        if (userId) {
            query.userId = userId;
        }

        const expenses = await Expense.find(query).populate('userId', 'name email');
        res.json(expenses);
    } catch (error) {
        next(error);
    }
};

// @desc    Get Advanced Overview Analytics
// @route   GET /api/admin/analytics/overview
// @access  Private/Admin
export const getAdminAnalytics = async (req, res, next) => {
    try {
        const totalUsers = await User.countDocuments({});
        const dailyActiveUsers = totalUsers;

        const expenses = await Expense.find({});
        const totalExpensesCount = expenses.length;
        const totalTransactionAmount = expenses.reduce((acc, curr) => acc + curr.amount, 0);

        // Top Used Categories
        const catMap = {};
        expenses.forEach(e => {
            if (!catMap[e.category]) catMap[e.category] = 0;
            catMap[e.category] += 1;
        });

        const topCategories = Object.entries(catMap)
            .sort((a, b) => b[1] - a[1])
            .slice(0, 5)
            .map(([name, count]) => ({ name, count }));

        res.json({
            totalUsers,
            dailyActiveUsers,
            totalExpensesCount,
            totalTransactionAmount,
            topCategories
        });
    } catch (error) {
        next(error);
    }
};
