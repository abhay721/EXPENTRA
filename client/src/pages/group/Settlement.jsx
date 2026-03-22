import React, { useState, useEffect, useContext } from 'react';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import {
    MdHandshake,
    MdAccountBalanceWallet,
    MdCallMade,
    MdCallReceived,
    MdCheckCircle,
    MdSchedule,
    MdPriorityHigh,
    MdMoreTime,
    MdPayment,
    MdClose
} from 'react-icons/md';

const Settlement = () => {
    const { selectedGroupId, user } = useContext(AuthContext);
    const [data, setData] = useState(null);
    const [groupData, setGroupData] = useState(null);
    const [loading, setLoading] = useState(true);

    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedSettlement, setSelectedSettlement] = useState(null);
    const [paymentMethod, setPaymentMethod] = useState('cash');

    const fetchData = async () => {
        try {
            const [groupRes, settleRes] = await Promise.all([
                api.get(`/groups/${selectedGroupId}`),
                api.get(`/group-expenses/${selectedGroupId}/settlements`)
            ]);
            setGroupData(groupRes.data);
            setData(settleRes.data);
        } catch (error) {
            toast.error("Failed to load settlements");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!selectedGroupId) return;
        fetchData();
    }, [selectedGroupId]);

    const handleMarkAsPaid = async () => {
        if (!selectedSettlement) return;
        try {
            await api.patch(`/group-expenses/${selectedGroupId}/settlements/${selectedSettlement.expenseId}/${selectedSettlement._id}/paid`, {
                paymentMethod
            });
            toast.success("Settlement recorded!");
            setIsModalOpen(false);
            fetchData();
        } catch (error) {
            toast.error("Failed to record payment");
        }
    };

    if (!selectedGroupId) {
        return <div className="p-8 text-center bg-white rounded-xl shadow mt-8">Please select a group first.</div>;
    }

    if (loading) return <div className="p-8 text-center">Loading reimbursement data...</div>;

    const {
        balances = [],
        totalOwedToUser = 0,
        totalUserOwes = 0,
        pendingReimbursements = [],
        overdueReimbursements = []
    } = data || {};

    const SettlementCard = ({ settlement, status }) => {
        const isFromMe = settlement.from.user === (user?._id || user?.id);
        const isToMe = settlement.to.user === (user?._id || user?.id);
        const isInvolved = isFromMe || isToMe;

        const statusColors = {
            pending: 'border-amber-200 bg-amber-50/30 text-amber-700',
            overdue: 'border-rose-200 bg-rose-50/30 text-rose-700',
            paid: 'border-emerald-200 bg-emerald-50/30 text-emerald-700'
        };

        return (
            <div className={`p-4 rounded-2xl border transition-all hover:shadow-md ${statusColors[status]}`}>
                <div className="flex justify-between items-start mb-3">
                    <div className="flex items-center space-x-3">
                        <div className={`p-2 rounded-xl ${isFromMe ? 'bg-rose-100 text-rose-600' : isToMe ? 'bg-emerald-100 text-emerald-600' : 'bg-gray-100 text-gray-400'}`}>
                            {isFromMe ? <MdCallMade className="w-5 h-5" /> : isToMe ? <MdCallReceived className="w-5 h-5" /> : <MdHandshake className="w-5 h-5" />}
                        </div>
                        <div>
                            <p className="text-sm font-bold opacity-70 uppercase tracking-wider">
                                {isFromMe ? `You owe ${settlement.to.name}` : isToMe ? `${settlement.from.name} owes you` : `${settlement.from.name} owes ${settlement.to.name}`}
                            </p>
                            <h4 className="text-2xl font-black">₹{settlement.amount.toLocaleString()}</h4>
                        </div>
                    </div>
                    {status === 'overdue' && <span className="flex items-center text-[10px] font-black bg-rose-600 text-white px-2 py-0.5 rounded-full uppercase tracking-tighter"><MdPriorityHigh className="mr-0.5" /> Overdue</span>}
                </div>

                {/* Removed expense title and due date as per request */}

                {status !== 'paid' && (
                    <div className="flex space-x-2">
                        <button
                            onClick={() => {
                                setSelectedSettlement(settlement);
                                setIsModalOpen(true);
                            }}
                            className="flex-1 py-2 bg-indigo-600 text-white rounded-xl text-sm font-bold hover:bg-indigo-700 transition active:scale-95 flex items-center justify-center"
                        >
                            <MdPayment className="mr-2" /> Mark as Paid
                        </button>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="max-w-5xl mx-auto space-y-8 pb-12">
            <div className="flex justify-between items-end">
                <div>
                    <h1 className="text-3xl font-black text-gray-900 leading-none mb-2">Settlements</h1>
                    <p className="text-gray-500 font-medium">{groupData?.name} Group</p>
                </div>
            </div>

            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="bg-emerald-500 rounded-3xl p-6 text-white shadow-xl shadow-emerald-100 relative overflow-hidden group">
                    <div className="relative z-10">
                        <p className="text-emerald-100 font-bold text-xs uppercase tracking-widest mb-1">You are owed</p>
                        <h2 className="text-5xl font-black">₹{totalOwedToUser.toLocaleString()}</h2>
                    </div>
                    <MdCallReceived className="absolute -bottom-4 -right-4 w-32 h-32 text-emerald-400 opacity-20 group-hover:scale-110 transition-transform duration-700" />
                </div>
                <div className="bg-rose-500 rounded-3xl p-6 text-white shadow-xl shadow-rose-100 relative overflow-hidden group">
                    <div className="relative z-10">
                        <p className="text-rose-100 font-bold text-xs uppercase tracking-widest mb-1">You owe</p>
                        <h2 className="text-5xl font-black">₹{totalUserOwes.toLocaleString()}</h2>
                    </div>
                    <MdCallMade className="absolute -bottom-4 -right-4 w-32 h-32 text-rose-400 opacity-20 group-hover:scale-110 transition-transform duration-700" />
                </div>
            </div>

            {/* Sections */}
            <div className="space-y-10 mt-8">
                {/* Overdue Section */}
                {overdueReimbursements.length > 0 && (
                    <section>
                        <div className="flex items-center space-x-3 mb-4">
                            <span className="w-2 h-8 bg-rose-500 rounded-full"></span>
                            <h3 className="text-xl font-black text-gray-900 flex items-center uppercase tracking-tight">
                                Overdue <span className="ml-2 px-2 py-0.5 bg-rose-100 text-rose-600 text-xs rounded-lg">{overdueReimbursements.length}</span>
                            </h3>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {overdueReimbursements.map(s => <SettlementCard key={s._id} settlement={s} status="overdue" />)}
                        </div>
                    </section>
                )}

                {/* Pending Section */}
                <section>
                    <div className="flex items-center space-x-3 mb-4">
                        <span className="w-2 h-8 bg-amber-500 rounded-full"></span>
                        <h3 className="text-xl font-black text-gray-900 flex items-center uppercase tracking-tight">
                            Pending Reimbursements <span className="ml-2 px-2 py-0.5 bg-amber-100 text-amber-600 text-xs rounded-lg">{pendingReimbursements.length}</span>
                        </h3>
                    </div>
                    {pendingReimbursements.length === 0 && overdueReimbursements.length === 0 ? (
                        <div className="bg-white rounded-3xl p-12 text-center border-2 border-dashed border-gray-100">
                            <MdCheckCircle className="w-16 h-16 text-emerald-300 mx-auto mb-4" />
                            <h4 className="text-xl font-bold text-gray-800">No Pending Debts</h4>
                            <p className="text-gray-500">You're all squared away for now!</p>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {pendingReimbursements.map(s => <SettlementCard key={s._id} settlement={s} status="pending" />)}
                        </div>
                    )}
                </section>
            </div>

            {/* Balances Sidebar-style table */}
            <div className="bg-white p-8 rounded-3xl border border-gray-100 shadow-sm">
                <h3 className="text-xl font-black text-gray-900 mb-6 flex items-center uppercase tracking-tight">
                    <MdAccountBalanceWallet className="mr-3 text-indigo-600" /> Group Net Balances
                </h3>
                <div className="divide-y divide-gray-50">
                    {balances.map((bal, idx) => {
                        const amount = bal.balance;
                        const isPositive = amount > 0.01;
                        const isNegative = amount < -0.01;
                        return (
                            <div key={idx} className="py-4 flex items-center justify-between">
                                <div className="flex items-center">
                                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm mr-4 ${isPositive ? 'bg-emerald-100 text-emerald-600' : isNegative ? 'bg-rose-100 text-rose-600' : 'bg-gray-100 text-gray-400'}`}>
                                        {bal.memberInfo.name.charAt(0)}
                                    </div>
                                    <span className="font-bold text-gray-700">{bal.memberInfo.name}</span>
                                </div>
                                <div className="text-right">
                                    <p className={`font-black text-lg ${isPositive ? 'text-emerald-600' : isNegative ? 'text-rose-600' : 'text-gray-400'}`}>
                                        {isPositive ? '+' : ''}₹{Math.abs(amount).toLocaleString()}
                                    </p>
                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest leading-none">
                                        {isPositive ? 'is owed' : isNegative ? 'owes' : 'settled'}
                                    </p>
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>

            {/* Mark as Paid Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm animate-in fade-in duration-300">
                    <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in duration-300">
                        <div className="p-6 border-b border-gray-50 flex justify-between items-center bg-indigo-600 text-white">
                            <h3 className="text-xl font-black">Confirm Payment</h3>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition">
                                <MdClose className="w-6 h-6" />
                            </button>
                        </div>
                        <div className="p-8 space-y-6">
                            <div className="text-center">
                                <p className="text-gray-500 font-bold text-xs uppercase tracking-widest mb-1">Paying {selectedSettlement?.to.name}</p>
                                <h2 className="text-5xl font-black text-gray-900 tracking-tighter">₹{selectedSettlement?.amount.toLocaleString()}</h2>
                            </div>

                            <div className="space-y-3">
                                <label className="block text-xs font-black text-gray-400 uppercase tracking-widest ml-1">Payment Method</label>
                                <div className="grid grid-cols-1 gap-2">
                                    {['cash', 'upi', 'bank_transfer'].map(method => (
                                        <button
                                            key={method}
                                            onClick={() => setPaymentMethod(method)}
                                            className={`p-4 rounded-2xl border-2 text-left transition-all flex items-center justify-between ${paymentMethod === method ? 'border-indigo-600 bg-indigo-50 text-indigo-700 shadow-md' : 'border-gray-100 hover:border-gray-200 text-gray-500'}`}
                                        >
                                            <span className="font-black capitalize text-sm">{method.replace('_', ' ')}</span>
                                            {paymentMethod === method && <MdCheckCircle className="w-6 h-6" />}
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <button
                                onClick={handleMarkAsPaid}
                                className="w-full py-4 bg-indigo-600 text-white rounded-2xl font-black text-lg hover:bg-indigo-700 transition shadow-xl shadow-indigo-100 active:scale-95"
                            >
                                Confirm Settlement
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default Settlement;
