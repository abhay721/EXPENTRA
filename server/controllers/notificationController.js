import Expense from '../models/expenseModel.js';
import Budget from '../models/budgetModel.js';
import GroupExpense from '../models/groupExpenseModel.js';
import Group from '../models/groupModel.js';

// @desc    Get all notifications and alerts (dynamic)
// @route   GET /api/notifications
// @access  Private
const getNotifications = async (req, res, next) => {
    try {
        const userId = req.user._id;
        const notifications = [];
        const today = new Date();
        const last24h = new Date(today.getTime() - 24 * 60 * 60 * 1000);

        const currentMonth = today.getMonth() + 1;
        const currentYear = today.getFullYear();

        // 1. Personal Budget Context
        const budget = await Budget.findOne({ userId, month: currentMonth, year: currentYear });
        const startDate = new Date(currentYear, currentMonth - 1, 1);
        const endDate = new Date(currentYear, currentMonth, 0, 23, 59, 59, 999);

        const personalSpend = await Expense.aggregate([
            { $match: { userId, date: { $gte: startDate, $lte: endDate } } },
            { $group: { _id: null, total: { $sum: '$amount' } } },
        ]);
        const currSpend = personalSpend.length > 0 ? personalSpend[0].total : 0;

        if (budget && currSpend > budget.limitAmount) {
            notifications.push({
                type: 'BUDGET_EXCEEDED',
                message: `Personal budget exceeded by ₹${(currSpend - budget.limitAmount).toFixed(0)}!`,
            });
        }

        // 2. Group Context: Recent Expenses
        const userGroups = await Group.find({ 'members.user': userId });
        const groupIds = userGroups.map(g => g._id);

        if (groupIds.length > 0) {
            // New expenses in last 24h
            const recentGroupExpenses = await GroupExpense.find({
                groupId: { $in: groupIds },
                createdAt: { $gte: last24h },
                'paidBy.user': { $ne: userId } // Not created by you
            }).populate('groupId', 'name');

            recentGroupExpenses.forEach(exp => {
                notifications.push({
                    type: 'GROUP_EXPENSE',
                    message: `New: ₹${exp.amount} for "${exp.title}" added in ${exp.groupId.name}`,
                    details: { groupId: exp.groupId._id, expenseId: exp._id }
                });
            });

            // 3. Settlements: Pendings & Recent Payments
            const allGroupExpenses = await GroupExpense.find({ groupId: { $in: groupIds } });

            allGroupExpenses.forEach(exp => {
                exp.settlements.forEach(s => {
                    // You owe someone
                    if (s.from.user?.toString() === userId.toString() && s.reimbursementStatus === 'pending') {
                        notifications.push({
                            type: 'SETTLEMENT_PENDING',
                            message: `Reminder: You owe ₹${s.amount} to ${s.to.name}`,
                            details: { expenseId: exp._id }
                        });
                    }
                    // You got paid recently (Confirmed in last 24h)
                    if (s.to.user?.toString() === userId.toString() && s.reimbursementStatus === 'paid' && s.paymentDate >= last24h) {
                        notifications.push({
                            type: 'PAYMENT_RECEIVED',
                            message: `Payment Received: ₹${s.amount} from ${s.from.name}`,
                            details: { expenseId: exp._id }
                        });
                    }
                });
            });
        }

        // 4. Default info if nothing else
        if (notifications.length === 0) {
            notifications.push({
                type: 'INFO',
                message: 'No new alerts. Your finances are looking good!',
            });
        }

        // Sort: Group alerts first, then Budget
        res.json(notifications);
    } catch (error) {
        next(error);
    }
};

export { getNotifications };
