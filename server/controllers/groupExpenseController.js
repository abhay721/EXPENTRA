import GroupExpense from '../models/groupExpenseModel.js';
import Group from '../models/groupModel.js';
import { sendPushNotification, notifyGroupMembers, getTokensFromUsers } from '../utils/notificationHelper.js';

// Helper to calculate settlements for an expense
const calculateSettlements = (amount, paidBy, splitBetween, group) => {
    const balances = {};
    const memberMap = {};
    group.members.forEach(m => {
        const id = m.user ? m.user.toString() : m.name;
        balances[id] = 0;
        memberMap[id] = m.name;
    });

    paidBy.forEach(p => {
        const id = p.user ? p.user.toString() : p.name;
        if (balances[id] !== undefined) balances[id] += p.amount;
    });
    splitBetween.forEach(s => {
        const id = s.user ? s.user.toString() : s.name;
        if (balances[id] !== undefined) balances[id] -= s.amount;
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
    while (i < debtors.length && j < creditors.length) {
        const debtor = debtors[i];
        const creditor = creditors[j];
        const settleAmt = Math.min(Math.abs(debtor.balance), creditor.balance);

        settlements.push({
            from: { user: debtor.id.length === 24 ? debtor.id : null, name: memberMap[debtor.id] || debtor.id },
            to: { user: creditor.id.length === 24 ? creditor.id : null, name: memberMap[creditor.id] || creditor.id },
            amount: Math.round(settleAmt * 100) / 100,
            reimbursementStatus: 'pending'
        });

        debtor.balance += settleAmt;
        creditor.balance -= settleAmt;
        if (Math.abs(debtor.balance) < 0.01) i++;
        if (Math.abs(creditor.balance) < 0.01) j++;
    }
    return settlements;
};

// @desc    Add group expense
export const addGroupExpense = async (req, res, next) => {
    try {
        const { groupId, title, amount, paidBy, splitType, splitDetails, category, note, date } = req.body;
        const group = await Group.findById(groupId);
        if (!group) throw new Error('Group not found');

        // Logic for calculating splitBetween
        let splitBetween = [];
        if (splitType === 'equal') {
            const membersInvolved = splitDetails?.length > 0 ? splitDetails : group.members.map(m => ({ user: m.user, name: m.name }));
            const share = Math.round((amount / membersInvolved.length) * 100) / 100;
            splitBetween = membersInvolved.map(m => ({ user: m.user, name: m.name, amount: share }));
            const diff = amount - splitBetween.reduce((s, m) => s + m.amount, 0);
            if (diff !== 0) splitBetween[0].amount = Math.round((splitBetween[0].amount + diff) * 100) / 100;
        } else {
            // exact/percentage / mixed
            splitBetween = splitDetails.map(m => ({ user: m.user, name: m.name, amount: m.share || m.amount }));
        }

        const settlements = calculateSettlements(amount, paidBy, splitBetween, group);

        const expense = await GroupExpense.create({
            groupId, title, amount, paidBy, splitType, splitDetails, splitBetween, settlements, category, note, date: date || Date.now()
        });

        // Notifications
        notifyGroupMembers(groupId, req.user._id, {
            title: "New Expense Added 🧾",
            body: `${req.user.name} added ₹${amount} for "${title}" in ${group.name}`,
            data: { url: `/group/${groupId}` }
        });

        settlements.forEach(async (s) => {
            if (s.from.user && s.from.user.toString() !== req.user._id.toString()) {
                const debtorTokens = await getTokensFromUsers([s.from.user]);
                sendPushNotification(debtorTokens, {
                    title: "Payment Reminder ⚠️",
                    body: `You need to pay ₹${s.amount} to ${s.to.name}`,
                    data: { url: "/groups/settlement" }
                });
            }
        });

        res.status(201).json(expense);
    } catch (error) { next(error); }
};

// REST OF THE CONTROLLER (RESTORED FROM BACKUP IN THOUGHT PROCESS)
export const getGroupExpenses = async (req, res, next) => {
    try {
        const expenses = await GroupExpense.find({ groupId: req.params.groupId }).sort({ date: -1 });
        res.json(expenses);
    } catch (error) { next(error); }
};

export const getGroupSettlements = async (req, res, next) => {
    try {
        const { groupId } = req.params;
        const userId = req.user._id.toString();
        const expenses = await GroupExpense.find({ groupId });
        const group = await Group.findById(groupId);
        
        const balances = {};
        group.members.forEach(m => {
            const id = m.user ? m.user.toString() : m.name;
            balances[id] = { memberInfo: m, balance: 0 };
        });

        const allSettlements = [];
        expenses.forEach(exp => {
            exp.paidBy.forEach(p => { if (balances[p.user || p.name]) balances[p.user || p.name].balance += p.amount; });
            exp.splitBetween.forEach(s => { if (balances[s.user || s.name]) balances[s.user || s.name].balance -= s.amount; });
            exp.settlements.forEach(s => {
                if (s.reimbursementStatus === 'paid') {
                    if (balances[s.from.user || s.from.name]) balances[s.from.user || s.from.name].balance += s.amount;
                    if (balances[s.to.user || s.to.name]) balances[s.to.user || s.to.name].balance -= s.amount;
                }
                allSettlements.push({ ...s.toObject(), expenseTitle: exp.title, expenseId: exp._id });
            });
        });

        let totalOwedToUser = 0; let totalUserOwes = 0;
        const pending = []; const paid = [];
        allSettlements.forEach(s => {
            const isFrom = s.from.user?.toString() === userId;
            const isTo = s.to.user?.toString() === userId;
            if (s.reimbursementStatus === 'paid') paid.push(s);
            else {
                if (isFrom) totalUserOwes += s.amount;
                if (isTo) totalOwedToUser += s.amount;
                pending.push(s);
            }
        });

        res.json({ balances: Object.values(balances), totalOwedToUser, totalUserOwes, pendingReimbursements: pending, paidReimbursements: paid });
    } catch (error) { next(error); }
};

export const markSettlementAsPaid = async (req, res, next) => {
    try {
        const { groupId, expenseId, settlementId } = req.params;
        const expense = await GroupExpense.findById(expenseId);
        const settlement = expense.settlements.id(settlementId);
        
        settlement.reimbursementStatus = 'paid';
        settlement.paymentDate = new Date();
        await expense.save();

        if (settlement.to.user) {
            const receiverTokens = await getTokensFromUsers([settlement.to.user]);
            sendPushNotification(receiverTokens, {
                title: "Payment Received 💰",
                body: `${req.user.name} paid you ₹${settlement.amount}`,
                data: { url: "/groups/settlement" }
            });
        }
        res.json({ message: 'Marked as paid' });
    } catch (error) { next(error); }
};

export const deleteGroupExpense = async (req, res, next) => {
    try {
        const expense = await GroupExpense.findByIdAndDelete(req.params.expenseId);
        const group = await Group.findById(req.params.groupId);
        notifyGroupMembers(req.params.groupId, req.user._id, {
            title: "Expense Deleted 🗑️",
            body: `${req.user.name} removed "${expense.title}" from ${group.name}`
        });
        res.json({ message: 'Deleted' });
    } catch (error) { next(error); }
};

export const updateGroupExpense = async (req, res, next) => {
    try {
        const { groupId, expenseId } = req.params;
        const { title, amount, paidBy, splitType, splitDetails, category, note, date } = req.body;
        const group = await Group.findById(groupId);
        const expense = await GroupExpense.findById(expenseId);

        let splitBetween = [];
        if (splitType === 'equal') {
            const membersInvolved = splitDetails?.length > 0 ? splitDetails : group.members.map(m => ({ user: m.user, name: m.name }));
            const share = Math.round((amount / membersInvolved.length) * 100) / 100;
            splitBetween = membersInvolved.map(m => ({ user: m.user, name: m.name, amount: share }));
            const diff = amount - splitBetween.reduce((s, m) => s + m.amount, 0);
            if (diff !== 0) splitBetween[0].amount = Math.round((splitBetween[0].amount + diff) * 100) / 100;
        } else {
            splitBetween = splitDetails.map(m => ({ user: m.user, name: m.name, amount: m.share || m.amount }));
        }

        const settlements = calculateSettlements(amount, paidBy, splitBetween, group);

        expense.title = title; expense.amount = amount; expense.paidBy = paidBy;
        expense.splitType = splitType; expense.splitDetails = splitDetails;
        expense.splitBetween = splitBetween; expense.settlements = settlements;
        expense.category = category; expense.note = note; if (date) expense.date = new Date(date);

        await expense.save();

        notifyGroupMembers(groupId, req.user._id, {
            title: "Expense Updated ✏️",
            body: `${req.user.name} updated "${title}" in ${group.name}`
        });

        res.json(expense);
    } catch (error) { next(error); }
};
