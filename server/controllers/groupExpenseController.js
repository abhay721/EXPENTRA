import GroupExpense from '../models/groupExpenseModel.js';
import Group from '../models/groupModel.js';

// @desc    Add group expense
// @route   POST /api/group-expenses
// @access  Private
export const addGroupExpense = async (req, res, next) => {
    try {
        const { groupId, title, amount, paidBy, splitType, splitDetails, category, note, date } = req.body;

        if (!groupId || !title || !amount || !paidBy || paidBy.length === 0) {
            res.status(400);
            throw new Error('Please fill all required fields');
        }

        const totalPaid = paidBy.reduce((sum, p) => sum + Number(p.amount), 0);
        if (Math.abs(totalPaid - amount) > 0.01) {
            res.status(400);
            throw new Error('Sum of amounts paid must equal total expense amount');
        }

        const group = await Group.findById(groupId);
        if (!group) {
            res.status(404);
            throw new Error('Group not found');
        }

        const isMember = group.members.some(m => m.user && m.user.toString() === req.user._id.toString());
        if (!isMember) {
            res.status(401);
            throw new Error('Not authorized to add expense to this group');
        }

        let calculatedSplitBetween = [];

        if (splitType === 'equal') {
            // splitDetails must contain members involved
            const membersInvolved = splitDetails && splitDetails.length > 0
                ? splitDetails
                : group.members.map(m => ({ user: m.user, name: m.name }));

            const share = Math.round((amount / membersInvolved.length) * 100) / 100;
            calculatedSplitBetween = membersInvolved.map(m => ({
                user: m.user,
                name: m.name,
                amount: share
            }));

            // Adjust for rounding
            const currentSum = calculatedSplitBetween.reduce((s, m) => s + m.amount, 0);
            if (currentSum !== amount) {
                calculatedSplitBetween[0].amount = Math.round((calculatedSplitBetween[0].amount + (amount - currentSum)) * 100) / 100;
            }
        } else if (splitType === 'exact') {
            calculatedSplitBetween = splitDetails.map(m => ({
                user: m.user,
                name: m.name,
                amount: m.share
            }));
            const currentSum = calculatedSplitBetween.reduce((s, m) => s + m.amount, 0);
            if (Math.abs(currentSum - amount) > 0.1) {
                res.status(400);
                throw new Error('Sum of exact shares must equal total amount');
            }
        } else if (splitType === 'percentage') {
            calculatedSplitBetween = splitDetails.map(m => ({
                user: m.user,
                name: m.name,
                amount: Math.round((amount * m.share / 100) * 100) / 100
            }));
            const currentSum = calculatedSplitBetween.reduce((s, m) => s + m.amount, 0);
            if (currentSum !== amount) {
                calculatedSplitBetween[0].amount = Math.round((calculatedSplitBetween[0].amount + (amount - currentSum)) * 100) / 100;
            }
        } else {
            // custom/mixed - splitDetails already contains absolute amounts
            calculatedSplitBetween = splitDetails.map(m => ({
                user: m.user,
                name: m.name,
                amount: m.share
            }));
        }

        // Calculate Settlements for this specific expense
        const balances = {};
        paidBy.forEach(p => {
            const id = p.user ? p.user.toString() : p.name;
            balances[id] = (balances[id] || 0) + p.amount;
        });
        calculatedSplitBetween.forEach(s => {
            const id = s.user ? s.user.toString() : s.name;
            balances[id] = (balances[id] || 0) - s.amount;
        });

        const debtors = [];
        const creditors = [];
        Object.keys(balances).forEach(id => {
            const bal = Math.round(balances[id] * 100) / 100;
            if (bal < 0) debtors.push({ id, balance: bal });
            else if (bal > 0) creditors.push({ id, balance: bal });
        });

        const settlements = [];
        let i = 0, j = 0;
        const findName = (id) => group.members.find(m => (m.user && m.user.toString() === id) || m.name === id)?.name || id;

        while (i < debtors.length && j < creditors.length) {
            const debtor = debtors[i];
            const creditor = creditors[j];
            const settleAmt = Math.min(Math.abs(debtor.balance), creditor.balance);

            settlements.push({
                from: { user: debtor.id.length === 24 ? debtor.id : null, name: findName(debtor.id) },
                to: { user: creditor.id.length === 24 ? creditor.id : null, name: findName(creditor.id) },
                amount: Math.round(settleAmt * 100) / 100
            });

            debtor.balance += settleAmt;
            creditor.balance -= settleAmt;
            if (Math.abs(debtor.balance) < 0.01) i++;
            if (Math.abs(creditor.balance) < 0.01) j++;
        }

        const expense = await GroupExpense.create({
            groupId,
            title,
            amount,
            paidBy: paidBy.map(p => ({
                user: (p.user && typeof p.user === 'string' && p.user.length === 24) ? p.user : null,
                name: p.name,
                amount: p.amount
            })),
            splitType: splitType || 'equal',
            splitDetails: splitDetails.map(s => ({
                user: (s.user && typeof s.user === 'string' && s.user.length === 24) ? s.user : null,
                name: s.name,
                share: s.share
            })),
            splitBetween: calculatedSplitBetween,
            settlements,
            category: category || 'General',
            note,
            date: date ? new Date(date) : Date.now(),
        });

        res.status(201).json(expense);
    } catch (error) {
        next(error);
    }
};

// @desc    Get expenses for a group
// @route   GET /api/group-expenses/:groupId
// @access  Private
export const getGroupExpenses = async (req, res, next) => {
    try {
        const { groupId } = req.params;

        const group = await Group.findById(groupId);
        if (!group) {
            res.status(404);
            throw new Error('Group not found');
        }

        const isMember = group.members.some(m => m.user && m.user.toString() === req.user._id.toString());
        if (!isMember) {
            res.status(401);
            throw new Error('Not authorized');
        }

        const expenses = await GroupExpense.find({ groupId }).sort({ date: -1 });
        res.json(expenses);
    } catch (error) {
        next(error);
    }
};

// @desc    Get settlements for a group
// @route   GET /api/group-expenses/:groupId/settlements
// @access  Private
export const getGroupSettlements = async (req, res, next) => {
    try {
        const { groupId } = req.params;
        const userId = req.user._id.toString();

        const group = await Group.findById(groupId);
        if (!group) {
            res.status(404);
            throw new Error('Group not found');
        }

        const isMember = group.members.some(m => m.user && m.user.toString() === userId);
        if (!isMember) {
            res.status(401);
            throw new Error('Not authorized');
        }

        const expenses = await GroupExpense.find({ groupId });

        // Calculate balances
        const balances = {};
        group.members.forEach(member => {
            const identifier = member.user ? member.user.toString() : member.name;
            balances[identifier] = {
                memberInfo: member,
                balance: 0,
            };
        });

        const allSettlements = [];
        const now = new Date();

        expenses.forEach(exp => {
            // Credit/Debit from original expense
            exp.paidBy.forEach(payer => {
                const id = payer.user ? payer.user.toString() : payer.name;
                if (balances[id]) balances[id].balance += payer.amount;
            });
            exp.splitBetween.forEach(split => {
                const id = split.user ? split.user.toString() : split.name;
                if (balances[id]) balances[id].balance -= split.amount;
            });

            // Handle settlements within this expense
            exp.settlements.forEach(s => {
                let status = s.reimbursementStatus;
                // Auto-overdue logic
                if (status === 'pending' && s.dueDate && s.dueDate < now) {
                    status = 'overdue';
                }

                const fromId = s.from.user ? s.from.user.toString() : s.from.name;
                const toId = s.to.user ? s.to.user.toString() : s.to.name;

                // If settlement is paid, it cancels out the debt it settled
                if (status === 'paid') {
                    if (balances[fromId]) balances[fromId].balance += s.amount;
                    if (balances[toId]) balances[toId].balance -= s.amount;
                }

                allSettlements.push({
                    ...s.toObject(),
                    _id: s._id,
                    expenseId: exp._id,
                    expenseTitle: exp.title,
                    reimbursementStatus: status
                });
            });
        });

        // Filter and categorize for the current user
        let totalOwedToUser = 0;
        let totalUserOwes = 0;
        const pendingGrouped = {};
        const paidReimbursements = [];
        const overdueReimbursements = [];

        allSettlements.forEach(s => {
            const isFromUsr = s.from.user && s.from.user.toString() === userId;
            const isToUsr = s.to.user && s.to.user.toString() === userId;

            // Update user-specific totals (only for unpaid)
            if (s.reimbursementStatus !== 'paid') {
                if (isFromUsr) totalUserOwes += s.amount;
                if (isToUsr) totalOwedToUser += s.amount;
            }

            // Categorize and Group
            if (s.reimbursementStatus === 'paid') {
                paidReimbursements.push(s);
            } else if (s.reimbursementStatus === 'overdue') {
                overdueReimbursements.push(s);
            } else {
                // Grouping Pending settlements
                const fromKey = s.from.user ? s.from.user.toString() : s.from.name;
                const toKey = s.to.user ? s.to.user.toString() : s.to.name;
                const key = `${fromKey}_${toKey}`;

                if (!pendingGrouped[key]) {
                    pendingGrouped[key] = {
                        ...s,
                        isGrouped: true,
                        underlyingIds: [s._id],
                        count: 1
                    };
                } else {
                    pendingGrouped[key].amount += s.amount;
                    pendingGrouped[key].underlyingIds.push(s._id);
                    pendingGrouped[key].count += 1;
                }
            }
        });

        res.json({
            balances: Object.values(balances),
            totalOwedToUser,
            totalUserOwes,
            pendingReimbursements: Object.values(pendingGrouped),
            paidReimbursements,
            overdueReimbursements
        });
    } catch (error) {
        next(error);
    }
};

// @desc    Mark a settlement as paid
// @route   PATCH /api/group-expenses/:groupId/settlements/:expenseId/:settlementId/paid
// @access  Private
export const markSettlementAsPaid = async (req, res, next) => {
    try {
        const { groupId, expenseId, settlementId } = req.params;
        const { paymentMethod } = req.body;

        const expense = await GroupExpense.findById(expenseId);
        if (!expense) {
            res.status(404);
            throw new Error('Expense not found');
        }

        const settlement = expense.settlements.id(settlementId);
        if (!settlement) {
            res.status(404);
            throw new Error('Settlement record not found');
        }

        const from = settlement.from.user ? settlement.from.user.toString() : settlement.from.name;
        const to = settlement.to.user ? settlement.to.user.toString() : settlement.to.name;

        // Implementation of bulk update: Find all pending settlements between this pair in this group
        const expenses = await GroupExpense.find({ groupId });
        const now = new Date();
        const updatePromises = [];

        expenses.forEach(exp => {
            let hasChanges = false;
            exp.settlements.forEach(s => {
                const sFrom = s.from.user ? s.from.user.toString() : s.from.name;
                const sTo = s.to.user ? s.to.user.toString() : s.to.name;

                if (s.reimbursementStatus === 'pending' && sFrom === from && sTo === to) {
                    s.reimbursementStatus = 'paid';
                    s.paymentMethod = paymentMethod || 'cash';
                    s.paymentDate = now;
                    hasChanges = true;
                }
            });
            if (hasChanges) {
                updatePromises.push(exp.save());
            }
        });

        await Promise.all(updatePromises);

        res.json({ message: 'All related settlements marked as paid successfully' });
    } catch (error) {
        next(error);
    }
};

// @desc    Delete a group expense
// @route   DELETE /api/group-expenses/:groupId/:expenseId
// @access  Private
export const deleteGroupExpense = async (req, res, next) => {
    try {
        const { groupId, expenseId } = req.params;

        const group = await Group.findById(groupId);
        if (!group) {
            res.status(404);
            throw new Error('Group not found');
        }

        const isMember = group.members.some(m => m.user && m.user.toString() === req.user._id.toString());
        if (!isMember) {
            res.status(401);
            throw new Error('Not authorized to delete expenses in this group');
        }

        const expense = await GroupExpense.findOneAndDelete({ _id: expenseId, groupId });
        if (!expense) {
            res.status(404);
            throw new Error('Expense not found');
        }

        res.json({ message: 'Expense removed successfully' });
    } catch (error) {
        next(error);
    }
};

// @desc    Update a group expense
// @route   PUT /api/group-expenses/:groupId/:expenseId
// @access  Private
export const updateGroupExpense = async (req, res, next) => {
    try {
        const { groupId, expenseId } = req.params;
        const { title, amount, paidBy, splitType, splitDetails, category, note, date } = req.body;

        if (!title || !amount || !paidBy || paidBy.length === 0) {
            res.status(400);
            throw new Error('Please fill all required fields');
        }

        const totalPaid = paidBy.reduce((sum, p) => sum + Number(p.amount), 0);
        if (Math.abs(totalPaid - amount) > 0.01) {
            res.status(400);
            throw new Error('Sum of amounts paid must equal total expense amount');
        }

        const group = await Group.findById(groupId);
        if (!group) {
            res.status(404);
            throw new Error('Group not found');
        }

        const isMember = group.members.some(m => m.user && m.user.toString() === req.user._id.toString());
        if (!isMember) {
            res.status(401);
            throw new Error('Not authorized to update expenses in this group');
        }

        const expense = await GroupExpense.findOne({ _id: expenseId, groupId });
        if (!expense) {
            res.status(404);
            throw new Error('Expense not found');
        }

        let calculatedSplitBetween = [];

        if (splitType === 'equal') {
            const membersInvolved = splitDetails && splitDetails.length > 0
                ? splitDetails
                : group.members.map(m => ({ user: m.user, name: m.name }));

            const share = Math.round((amount / membersInvolved.length) * 100) / 100;
            calculatedSplitBetween = membersInvolved.map(m => ({
                user: m.user,
                name: m.name,
                amount: share
            }));

            const currentSum = calculatedSplitBetween.reduce((s, m) => s + m.amount, 0);
            if (currentSum !== amount) {
                calculatedSplitBetween[0].amount = Math.round((calculatedSplitBetween[0].amount + (amount - currentSum)) * 100) / 100;
            }
        } else if (splitType === 'exact') {
            calculatedSplitBetween = splitDetails.map(m => ({
                user: m.user,
                name: m.name,
                amount: m.share
            }));
            const currentSum = calculatedSplitBetween.reduce((s, m) => s + m.amount, 0);
            if (Math.abs(currentSum - amount) > 0.1) {
                res.status(400);
                throw new Error('Sum of exact shares must equal total amount');
            }
        } else if (splitType === 'percentage') {
            calculatedSplitBetween = splitDetails.map(m => ({
                user: m.user,
                name: m.name,
                amount: Math.round((amount * m.share / 100) * 100) / 100
            }));
            const currentSum = calculatedSplitBetween.reduce((s, m) => s + m.amount, 0);
            if (currentSum !== amount) {
                calculatedSplitBetween[0].amount = Math.round((calculatedSplitBetween[0].amount + (amount - currentSum)) * 100) / 100;
            }
        } else {
            calculatedSplitBetween = splitDetails.map(m => ({
                user: m.user,
                name: m.name,
                amount: m.share
            }));
        }

        // Calculate Settlements
        const balances = {};
        paidBy.forEach(p => {
            const id = p.user ? p.user.toString() : p.name;
            balances[id] = (balances[id] || 0) + p.amount;
        });
        calculatedSplitBetween.forEach(s => {
            const id = s.user ? s.user.toString() : s.name;
            balances[id] = (balances[id] || 0) - s.amount;
        });

        const debtors = [];
        const creditors = [];
        Object.keys(balances).forEach(id => {
            const bal = Math.round(balances[id] * 100) / 100;
            if (bal < 0) debtors.push({ id, balance: bal });
            else if (bal > 0) creditors.push({ id, balance: bal });
        });

        const settlements = [];
        let i = 0, j = 0;
        const findName = (id) => group.members.find(m => (m.user && m.user.toString() === id) || m.name === id)?.name || id;

        // Preserve existing paid statuses if possible (simplification: we just recreate pending ones)
        // A more complex implementation would try to map old paid settlements to new ones, but for now we reset them.
        while (i < debtors.length && j < creditors.length) {
            const debtor = debtors[i];
            const creditor = creditors[j];
            const settleAmt = Math.min(Math.abs(debtor.balance), creditor.balance);

            settlements.push({
                from: { user: debtor.id.length === 24 ? debtor.id : null, name: findName(debtor.id) },
                to: { user: creditor.id.length === 24 ? creditor.id : null, name: findName(creditor.id) },
                amount: Math.round(settleAmt * 100) / 100,
                reimbursementStatus: 'pending' // Note: Resetting to pending on edit
            });

            debtor.balance += settleAmt;
            creditor.balance -= settleAmt;
            if (Math.abs(debtor.balance) < 0.01) i++;
            if (Math.abs(creditor.balance) < 0.01) j++;
        }

        expense.title = title;
        expense.amount = amount;
        expense.paidBy = paidBy.map(p => ({
            user: (p.user && typeof p.user === 'string' && p.user.length === 24) ? p.user : null,
            name: p.name,
            amount: p.amount
        }));
        expense.splitType = splitType || 'equal';
        expense.splitDetails = splitDetails.map(s => ({
            user: (s.user && typeof s.user === 'string' && s.user.length === 24) ? s.user : null,
            name: s.name,
            share: s.share
        }));
        expense.splitBetween = calculatedSplitBetween;
        expense.settlements = settlements;
        expense.category = category || 'General';
        expense.note = note;
        if (date) expense.date = new Date(date);

        const updatedExpense = await expense.save();

        res.json(updatedExpense);
    } catch (error) {
        next(error);
    }
};

