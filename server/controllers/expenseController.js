import Expense from '../models/expenseModel.js';
import { checkAndNotifyBudgetOverflow } from '../controllers/budgetController.js';

// @desc    Create new expense
// @route   POST /api/expenses
// @access  Private
const createExpense = async (req, res, next) => {
    const { amount, category, note, location, date, groupId, paymentMethod, recurring } = req.body;

    try {
        if (!amount) {
            res.status(400);
            return next(new Error('Amount is required and must be a number'));
        }
        if (!category) {
            res.status(400);
            return next(new Error('Category is required'));
        }
        if (Number(amount) <= 0) {
            res.status(400);
            return next(new Error('Amount must be greater than 0'));
        }

        const expense = new Expense({
            userId: req.user._id,
            groupId: groupId || null,
            amount: Number(amount),
            category,
            note: note || '',
            location: location || '',
            date: date || Date.now(),
            paymentMethod: paymentMethod || 'cash',
            recurring: recurring === true || recurring === 'true',
        });

        const createdExpense = await expense.save();

        // Check for budget overflow (non-blocking)
        const budgetDate = new Date(createdExpense.date);
        checkAndNotifyBudgetOverflow(req.user._id, budgetDate.getMonth() + 1, budgetDate.getFullYear());

        res.status(201).json(createdExpense);
    } catch (error) {
        next(error);
    }
};


// @desc    Get all expenses for user
// @route   GET /api/expenses
// @access  Private
const getExpenses = async (req, res, next) => {
    try {
        const { month, year, category } = req.query;

        let query = { userId: req.user._id };

        if (month && year) {
            const startDate = new Date(year, month - 1, 1);
            const endDate = new Date(year, month, 0);
            query.date = { $gte: startDate, $lte: endDate };
        }

        if (category) {
            query.category = category;
        }

        const expenses = await Expense.find(query).sort({ date: -1 });
        res.json(expenses);
    } catch (error) {
        next(error);
    }
};

// @desc    Update expense
// @route   PUT /api/expenses/:id
// @access  Private
const updateExpense = async (req, res, next) => {
    try {
        const expense = await Expense.findById(req.params.id);

        if (expense) {
            if (expense.userId.toString() !== req.user._id.toString()) {
                res.status(401);
                throw new Error('Not authorized to update this expense');
            }

            expense.amount = req.body.amount ? Number(req.body.amount) : expense.amount;
            expense.category = req.body.category || expense.category;
            expense.description = req.body.description || expense.description;
            expense.note = req.body.note !== undefined ? req.body.note : expense.note;
            expense.location = req.body.location || expense.location;
            expense.date = req.body.date || expense.date;
            expense.groupId = req.body.groupId || expense.groupId;
            expense.paymentMethod = req.body.paymentMethod || expense.paymentMethod;
            if (req.body.recurring !== undefined) expense.recurring = req.body.recurring === true || req.body.recurring === 'true';

            const updatedExpense = await expense.save();

            // Check for budget overflow (non-blocking)
            const budgetDate = new Date(updatedExpense.date);
            checkAndNotifyBudgetOverflow(req.user._id, budgetDate.getMonth() + 1, budgetDate.getFullYear());

            res.json(updatedExpense);
        } else {
            res.status(404);
            throw new Error('Expense not found');
        }
    } catch (error) {
        next(error);
    }
};

// @desc    Delete expense
// @route   DELETE /api/expenses/:id
// @access  Private
const deleteExpense = async (req, res, next) => {
    try {
        const expense = await Expense.findById(req.params.id);

        if (expense) {
            if (expense.userId.toString() !== req.user._id.toString()) {
                res.status(401);
                throw new Error('Not authorized to delete this expense');
            }

            const budgetDate = new Date(expense.date);
            await Expense.deleteOne({ _id: req.params.id });

            // Check for budget overflow (non-blocking) - though deletion might bring it back under limit
            checkAndNotifyBudgetOverflow(req.user._id, budgetDate.getMonth() + 1, budgetDate.getFullYear());

            res.json({ message: 'Expense removed' });
        } else {
            res.status(404);
            throw new Error('Expense not found');
        }
    } catch (error) {
        next(error);
    }
};

export { createExpense, getExpenses, updateExpense, deleteExpense };
