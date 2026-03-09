import React, { useState, useEffect, useContext } from 'react';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { MdGroup, MdAccountBalanceWallet, MdTrendingUp, MdPriorityHigh, MdShowChart } from 'react-icons/md';

const GroupDashboard = () => {
    const { selectedGroupId, user } = useContext(AuthContext);
    const [groupData, setGroupData] = useState(null);
    const [settlements, setSettlements] = useState(null);
    const [expenses, setExpenses] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!selectedGroupId) return;

        const fetchGroupDashboard = async () => {
            try {
                const [groupRes, settleRes, expRes] = await Promise.all([
                    api.get(`/groups/${selectedGroupId}`),
                    api.get(`/group-expenses/${selectedGroupId}/settlements`),
                    api.get(`/group-expenses/${selectedGroupId}`)
                ]);
                setGroupData(groupRes.data);
                setSettlements(settleRes.data);
                setExpenses(expRes.data);
            } catch (error) {
                toast.error("Failed to load group dashboard");
            } finally {
                setLoading(false);
            }
        };

        fetchGroupDashboard();
    }, [selectedGroupId]);

    if (!selectedGroupId) {
        return <div className="p-8 text-center bg-white rounded-xl shadow mt-8">Please select a group from the Groups menu first.</div>;
    }

    if (loading) return <div className="p-8">Loading dashboard...</div>;

    const totalGroupExpense = expenses.reduce((acc, exp) => acc + exp.amount, 0);

    // Find who paid most
    const paymentMap = {};
    expenses.forEach(exp => {
        exp.paidBy.forEach(p => {
            const id = p.user ? p.user.toString() : p.name;
            paymentMap[id] = (paymentMap[id] || 0) + p.amount;
        });
    });

    let topPayer = { name: 'N/A', amount: 0 };
    Object.keys(paymentMap).forEach(id => {
        if (paymentMap[id] > topPayer.amount) {
            topPayer = {
                name: groupData.members.find(m => (m.user && m.user.toString() === id) || m.name === id)?.name || 'Member',
                amount: paymentMap[id]
            };
        }
    });

    // Find who owes most (most negative balance)
    let topDebtor = { name: 'All Settled', amount: 0 };
    settlements?.balances.forEach(b => {
        if (b.balance < topDebtor.amount) {
            topDebtor = { name: b.memberInfo.name, amount: b.balance };
        }
    });

    return (
        <div className="max-w-5xl mx-auto space-y-6 pb-12">
            <h1 className="text-3xl font-extrabold text-gray-900">{groupData?.name}</h1>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-white rounded-2xl shadow-sm p-6 border-l-4 border-indigo-500">
                    <div className="flex items-center text-gray-400 mb-2">
                        <MdGroup className="w-5 h-5 mr-2" />
                        <span className="text-xs font-bold uppercase tracking-widest">Members</span>
                    </div>
                    <p className="text-3xl font-black text-gray-900">{groupData?.members?.length || 0}</p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm p-6 border-l-4 border-teal-500">
                    {(() => {
                        const myBal = settlements?.balances.find(b => b.memberInfo.user && user && b.memberInfo.user.toString() === user._id.toString())?.balance || 0;
                        const isOwed = myBal > 0;
                        const owes = myBal < 0;
                        const label = isOwed ? "You Get Back" : owes ? "You Owe" : "Your Balance";
                        const amountColor = isOwed ? 'text-green-600' : owes ? 'text-red-600' : 'text-gray-900';
                        return (
                            <>
                                <div className="flex items-center text-gray-400 mb-2">
                                    <MdAccountBalanceWallet className="w-5 h-5 mr-2" />
                                    <span className="text-xs font-bold uppercase tracking-widest">{label}</span>
                                </div>
                                <p className={`text-3xl font-black ${amountColor}`}>
                                    ₹{Math.abs(myBal).toLocaleString()}
                                </p>
                            </>
                        );
                    })()}
                </div>

                <div className="bg-white rounded-2xl shadow-sm p-6 border-l-4 border-amber-500">
                    <div className="flex items-center text-gray-400 mb-2">
                        <MdShowChart className="w-5 h-5 mr-2" />
                        <span className="text-xs font-bold uppercase tracking-widest">Total Group</span>
                    </div>
                    <p className="text-3xl font-black text-gray-900">₹{totalGroupExpense.toLocaleString()}</p>
                </div>

                <div className="bg-white rounded-2xl shadow-sm p-6 border-l-4 border-rose-500">
                    <div className="flex items-center text-gray-400 mb-2">
                        <MdTrendingUp className="w-5 h-5 mr-2" />
                        <span className="text-xs font-bold uppercase tracking-widest">Top Payer</span>
                    </div>
                    <p className="text-2xl font-black text-gray-900 truncate" title={topPayer.name}>{topPayer.name}</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold mb-6 text-gray-800 flex items-center">
                            <MdPriorityHigh className="mr-2 text-rose-500" /> Member Contributions
                        </h3>
                        <div className="space-y-4">
                            {groupData?.members.map(m => {
                                const id = m._id;
                                const participantId = m.user ? m.user.toString() : m.name;
                                const paid = paymentMap[participantId] || 0;
                                const percentage = totalGroupExpense > 0 ? (paid / totalGroupExpense) * 100 : 0;

                                return (
                                    <div key={id} className="space-y-1">
                                        <div className="flex justify-between text-sm">
                                            <span className="font-bold text-gray-700">{m.name}</span>
                                            <span className="font-black text-gray-900">₹{paid.toLocaleString()} ({percentage.toFixed(1)}%)</span>
                                        </div>
                                        <div className="w-full bg-gray-100 h-3 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-indigo-600 transition-all duration-1000"
                                                style={{ width: `${percentage}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                )
                            })}
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold mb-4 text-gray-800">Pending Settlements</h3>
                        {((settlements?.pendingReimbursements?.length || 0) + (settlements?.overdueReimbursements?.length || 0)) === 0 ? (
                            <div className="text-center py-10">
                                <span className="text-4xl">🎉</span>
                                <p className="text-gray-500 mt-2 font-medium">Everyone is all settled up!</p>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {[...(settlements?.overdueReimbursements || []), ...(settlements?.pendingReimbursements || [])].map((debt, i) => (
                                    <div key={i} className={`flex flex-col p-4 bg-gray-50 rounded-xl border relative overflow-hidden group ${debt.reimbursementStatus === 'overdue' ? 'border-rose-200 bg-rose-50/30' : 'border-gray-100'}`}>
                                        <div className="absolute top-0 right-0 p-2 opacity-10 group-hover:opacity-20 transition">
                                            <MdPriorityHigh className="w-12 h-12" />
                                        </div>
                                        <div className="flex items-center text-sm mb-2">
                                            <span className="font-bold text-gray-900">{debt.from.name}</span>
                                            <span className="mx-2 text-gray-400">pays</span>
                                            <span className="font-bold text-gray-900">{debt.to.name}</span>
                                        </div>
                                        <div className="flex items-end justify-between">
                                            <span className={`text-xl font-black ${debt.reimbursementStatus === 'overdue' ? 'text-rose-600' : 'text-gray-900'}`}>
                                                ₹{debt.amount.toLocaleString()}
                                            </span>
                                            {debt.reimbursementStatus === 'overdue' && (
                                                <span className="text-[10px] font-black bg-rose-600 text-white px-2 py-0.5 rounded-full uppercase tracking-tighter animate-pulse">Overdue</span>
                                            )}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="bg-rose-600 p-6 rounded-2xl shadow-xl text-white">
                        <h3 className="text-lg font-bold mb-4">Urgent Settlement</h3>
                        <div className="space-y-4">
                            <div className="p-4 bg-white/10 rounded-xl border border-white/20">
                                <p className="text-xs uppercase font-bold text-rose-200 tracking-widest mb-1">Most Owed To Group</p>
                                <p className="text-2xl font-black">{topDebtor.name}</p>
                                <p className="text-rose-200 font-bold mt-1">₹{Math.abs(topDebtor.amount).toLocaleString()}</p>
                            </div>
                            <p className="text-sm text-rose-100 italic">
                                Hey {topDebtor.name}, time to clear your debts!
                            </p>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest mb-4">Group Members</h3>
                        <div className="space-y-3">
                            {groupData?.members.map(m => (
                                <div key={m._id || m.name} className="flex items-center justify-between">
                                    <div className="flex items-center">
                                        <div className="w-8 h-8 bg-indigo-100 text-indigo-700 rounded-lg flex items-center justify-center font-bold text-xs mr-3">
                                            {m.name.charAt(0)}
                                        </div>
                                        <span className="text-sm font-bold text-gray-700 truncate max-w-[120px]">{m.name}</span>
                                    </div>
                                    <span className="text-[10px] text-gray-400 font-bold">{new Date(m.joinedAt).toLocaleDateString()}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default GroupDashboard;
