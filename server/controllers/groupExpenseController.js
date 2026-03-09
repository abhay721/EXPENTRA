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

        const expenses = await GroupExpense.find({ groupId });

        // Calculate balances
        // For each user, we calculate: Total Paid - Total Share
        // If balance > 0, they get money back. If balance < 0, they owe money.
        const balances = {};

        group.members.forEach(member => {
            // Use user ID if available, otherwise name (for unregistered)
            const identifier = member.user ? member.user.toString() : member.name;
            balances[identifier] = {
                memberInfo: member,
                balance: 0,
            };
        });

        expenses.forEach(exp => {
            // Credit the people who paid
            if (Array.isArray(exp.paidBy)) {
                exp.paidBy.forEach(payer => {
                    const payerId = payer.user ? payer.user.toString() : payer.name;
                    if (balances[payerId]) {
                        balances[payerId].balance += payer.amount;
                    }
                });
            } else {
                // Backward compatibility for old records where paidBy was an ObjectId
                const payerId = exp.paidBy.toString();
                if (balances[payerId]) {
                    balances[payerId].balance += exp.amount;
                }
            }

            // Debit the members who share the expense
            exp.splitBetween.forEach(split => {
                const splitUserId = split.user ? split.user.toString() : split.name;
                if (balances[splitUserId]) {
                    balances[splitUserId].balance -= split.amount;
                }
            });
        });

        // We can also calculate a simplified "who owes whom" array
        const debtors = [];
        const creditors = [];

        Object.keys(balances).forEach(identifier => {
            const bal = balances[identifier];
            bal.balance = Math.round(bal.balance * 100) / 100;
            if (bal.balance < 0) debtors.push({ ...bal, identifier });
            else if (bal.balance > 0) creditors.push({ ...bal, identifier });
        });

        debtors.sort((a, b) => a.balance - b.balance); // most negative first
        creditors.sort((a, b) => b.balance - a.balance); // most positive first

        const simplifiedDebts = [];

        let i = 0; // debtors index
        let j = 0; // creditors index

        while (i < debtors.length && j < creditors.length) {
            const debtor = debtors[i];
            const creditor = creditors[j];

            let amountToSettle = Math.min(Math.abs(debtor.balance), creditor.balance);
            amountToSettle = Math.round(amountToSettle * 100) / 100;

            simplifiedDebts.push({
                from: debtor.memberInfo,
                to: creditor.memberInfo,
                amount: amountToSettle,
            });

            debtor.balance = Math.round((debtor.balance + amountToSettle) * 100) / 100;
            creditor.balance = Math.round((creditor.balance - amountToSettle) * 100) / 100;

            if (Math.abs(debtor.balance) === 0) i++;
            if (creditor.balance === 0) j++;
        }

        res.json({
            balances: Object.values(balances),
            simplifiedDebts
        });
    } catch (error) {
        next(error);
    }
};
