import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { MdAdd, MdReceipt, MdKeyboardArrowDown, MdKeyboardArrowUp, MdCompareArrows } from 'react-icons/md';

const GroupExpenses = () => {
    const navigate = useNavigate();
    const { selectedGroupId } = useContext(AuthContext);
    const [activities, setActivities] = useState([]);
    const [groupData, setGroupData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [expandedActivity, setExpandedActivity] = useState(null);

    useEffect(() => {
        if (!selectedGroupId) return;

        const fetchData = async () => {
            try {
                const [expRes, groupRes] = await Promise.all([
                    api.get(`/group-expenses/${selectedGroupId}`),
                    api.get(`/groups/${selectedGroupId}`)
                ]);

                const rawExpenses = expRes.data;
                const transformedActivities = [];

                rawExpenses.forEach(exp => {
                    // Add the expense
                    transformedActivities.push({
                        ...exp,
                        activityType: 'expense'
                    });

                    // Add paid settlements from this expense
                    if (exp.settlements && exp.settlements.length > 0) {
                        exp.settlements.forEach(s => {
                            if (s.reimbursementStatus === 'paid') {
                                transformedActivities.push({
                                    _id: s._id,
                                    expenseId: exp._id,
                                    activityType: 'settlement',
                                    title: `Settled: ${s.from.name} → ${s.to.name}`,
                                    amount: s.amount,
                                    date: s.paymentDate || exp.date,
                                    from: s.from,
                                    to: s.to,
                                    paymentMethod: s.paymentMethod,
                                    note: `Settlement for ${exp.title}`
                                });
                            }
                        });
                    }
                });

                // Sort by date descending
                transformedActivities.sort((a, b) => new Date(b.date) - new Date(a.date));

                setActivities(transformedActivities);
                setGroupData(groupRes.data);
            } catch (error) {
                toast.error("Failed to load activities");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [selectedGroupId]);

    if (!selectedGroupId) {
        return <div className="p-8 text-center bg-white rounded-xl shadow mt-8">Please select a group first.</div>;
    }

    if (loading) return <div className="p-8">Loading expenses...</div>;

    return (
        <div className="max-w-4xl mx-auto space-y-8 pb-12">
            <div className="flex justify-between items-center bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                <div>
                    <h1 className="text-3xl font-bold text-gray-900">{groupData?.name}</h1>
                    <p className="text-gray-500 font-medium">History & Settlements</p>
                </div>
                <button
                    onClick={() => navigate('/groups/add-expense')}
                    className="flex items-center px-6 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition shadow-lg hover:shadow-xl font-bold"
                >
                    <MdAdd className="mr-2 text-xl" /> Add Expense
                </button>
            </div>

            <div className="space-y-4">
                {activities.map(act => {
                    const isExpense = act.activityType === 'expense';
                    const isExpanded = expandedActivity === act._id;

                    if (isExpense) {
                        const payers = act.paidBy.map(p => p.name).join(', ');
                        return (
                            <div key={act._id} className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden transition-all hover:shadow-md">
                                <div
                                    className="p-5 flex items-center justify-between cursor-pointer"
                                    onClick={() => setExpandedActivity(isExpanded ? null : act._id)}
                                >
                                    <div className="flex items-center space-x-4">
                                        <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center shrink-0">
                                            <MdReceipt className="w-6 h-6" />
                                        </div>
                                        <div className="truncate">
                                            <h3 className="font-bold text-gray-900 text-lg truncate">{act.title}</h3>
                                            <p className="text-sm text-gray-500 flex items-center">
                                                {new Date(act.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                <span className="mx-2">•</span>
                                                Paid by <span className="font-semibold text-indigo-600 ml-1 truncate max-w-[150px]">{payers}</span>
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center space-x-6">
                                        <div className="text-right">
                                            <p className="text-xl font-black text-gray-900">₹{act.amount.toLocaleString()}</p>
                                            <p className="text-[10px] uppercase tracking-wider font-bold text-gray-400">Total Amount</p>
                                        </div>
                                        <div className="text-gray-400">
                                            {isExpanded ? <MdKeyboardArrowUp className="w-6 h-6" /> : <MdKeyboardArrowDown className="w-6 h-6" />}
                                        </div>
                                    </div>
                                </div>

                                {isExpanded && (
                                    <div className="px-5 pb-5 border-t border-gray-50 pt-5 space-y-6 animate-fadeIn">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                                            {/* Payments Info */}
                                            <div className="space-y-3">
                                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Payment Breakdown</h4>
                                                <div className="space-y-2">
                                                    {act.paidBy.map((p, i) => (
                                                        <div key={i} className="flex justify-between items-center text-sm p-2 bg-gray-50 rounded-lg">
                                                            <span className="text-gray-700 font-medium">{p.name}</span>
                                                            <span className="font-bold text-gray-900 italic">paid ₹{p.amount.toLocaleString()}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Split Info */}
                                            <div className="space-y-3">
                                                <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest">Shares</h4>
                                                <div className="space-y-2">
                                                    {act.splitBetween.map((s, i) => (
                                                        <div key={i} className="flex justify-between items-center text-sm p-2 bg-indigo-50/30 rounded-lg">
                                                            <span className="text-gray-700 font-medium">{s.name}</span>
                                                            <span className="font-bold text-indigo-700">₹{s.amount.toLocaleString()}</span>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Settlement Area */}
                                        {act.settlements && act.settlements.length > 0 && (
                                            <div className="bg-green-50 rounded-xl p-4 border border-green-100">
                                                <h4 className="text-xs font-bold text-green-700 uppercase tracking-widest mb-3 flex items-center">
                                                    <MdCompareArrows className="mr-2 w-4 h-4" /> Recommended Settlement for this expense
                                                </h4>
                                                <div className="flex flex-wrap gap-3">
                                                    {act.settlements.map((s, i) => (
                                                        <div key={i} className={`bg-white px-4 py-2 rounded-lg border text-sm shadow-sm flex items-center ${s.reimbursementStatus === 'paid' ? 'border-green-500 ring-1 ring-green-100' : 'border-green-200'}`}>
                                                            <span className="font-bold text-gray-900">{s.from.name}</span>
                                                            <span className="mx-2 text-gray-400">→</span>
                                                            <span className="font-bold text-gray-900">{s.to.name}</span>
                                                            <span className="ml-3 font-black text-green-600">₹{s.amount.toLocaleString()}</span>
                                                            {s.reimbursementStatus === 'paid' && <MdCompareArrows className="ml-2 text-green-500" title="Paid" />}
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        )}

                                        {act.note && (
                                            <div className="text-xs text-gray-500 italic bg-gray-50 p-3 rounded-xl border border-dashed">
                                                Note: {act.note}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        );
                    } else {
                        // Settlement Log Entry
                        return (
                            <div key={act._id} className="bg-emerald-50/30 rounded-2xl shadow-sm border border-emerald-100 overflow-hidden transition-all hover:shadow-md">
                                <div className="p-5 flex items-center justify-between">
                                    <div className="flex items-center space-x-4">
                                        <div className="w-12 h-12 bg-emerald-100 text-emerald-600 rounded-xl flex items-center justify-center shrink-0">
                                            <MdCompareArrows className="w-6 h-6" />
                                        </div>
                                        <div className="truncate">
                                            <h3 className="font-bold text-gray-900 text-lg truncate">{act.title}</h3>
                                            <p className="text-sm text-gray-500 flex items-center">
                                                {new Date(act.date).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                                                <span className="mx-2">•</span>
                                                Method: <span className="font-semibold text-emerald-600 ml-1 uppercase text-[10px] tracking-wider">{act.paymentMethod || 'cash'}</span>
                                            </p>
                                        </div>
                                    </div>

                                    <div className="flex items-center space-x-6">
                                        <div className="text-right">
                                            <p className="text-xl font-black text-emerald-600">₹{act.amount.toLocaleString()}</p>
                                            <p className="text-[10px] uppercase tracking-wider font-bold text-emerald-400">Settled Amount</p>
                                        </div>
                                        <div className="w-6"></div> {/* Spacer to align with expense cards */}
                                    </div>
                                </div>
                            </div>
                        );
                    }
                })}

                {activities.length === 0 && (
                    <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
                        <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                            <MdReceipt className="w-10 h-10 text-gray-300" />
                        </div>
                        <h3 className="text-xl font-bold text-gray-900">No Activity Yet</h3>
                        <p className="text-gray-500 mt-2">Add your first expense or settle dues to start tracking!</p>
                    </div>
                )}
            </div>

            <style dangerouslySetInnerHTML={{
                __html: `
                @keyframes fadeIn {
                    from { opacity: 0; transform: translateY(-10px); }
                    to { opacity: 1; transform: translateY(0); }
                }
                .animate-fadeIn {
                    animation: fadeIn 0.3s ease-out forwards;
                }
            ` }} />
        </div>
    );
};

export default GroupExpenses;
