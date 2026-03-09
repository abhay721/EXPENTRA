import React, { useState, useEffect, useContext } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { MdArrowBack, MdCalculate, MdCheckCircle, MdInfoOutline } from 'react-icons/md';

const AddGroupExpense = () => {
    const navigate = useNavigate();
    const { selectedGroupId } = useContext(AuthContext);
    const [groupData, setGroupData] = useState(null);
    const [loading, setLoading] = useState(true);

    const [title, setTitle] = useState('');
    const [amount, setAmount] = useState('');
    const [category, setCategory] = useState('General');
    const [note, setNote] = useState('');

    const [paidBy, setPaidBy] = useState([]); // [{ user, name, amount }]
    const [splitType, setSplitType] = useState('equal');
    const [splitDetails, setSplitDetails] = useState([]); // [{ user, name, share, involved }]

    const [previewSettlements, setPreviewSettlements] = useState(null);

    useEffect(() => {
        if (!selectedGroupId) {
            navigate('/groups');
            return;
        }
        const fetchGroup = async () => {
            try {
                const res = await api.get(`/groups/${selectedGroupId}`);
                setGroupData(res.data);

                // Initialize splitDetails with all members involved by default
                const initialSplit = res.data.members.map(m => ({
                    mid: m._id, // Internal member ID
                    user: m.user,
                    name: m.name,
                    share: 0,
                    involved: true
                }));
                setSplitDetails(initialSplit);

                // Initialize paidBy with empty array (will be handled by UI)
                setPaidBy([]);
            } catch (error) {
                toast.error("Failed to load group data");
            } finally {
                setLoading(false);
            }
        };
        fetchGroup();
    }, [selectedGroupId, navigate]);

    const handleInvolvementToggle = (mId) => {
        setSplitDetails(splitDetails.map(item =>
            item.mid === mId ? { ...item, involved: !item.involved } : item
        ));
    };

    const handleShareChange = (mId, value) => {
        setSplitDetails(splitDetails.map(item =>
            item.mid === mId ? { ...item, share: Number(value) } : item
        ));
    };

    const handlePayerChange = (mId, name, userId, value) => {
        const val = Number(value);
        if (val === 0) {
            setPaidBy(paidBy.filter(p => p.mid !== mId));
        } else {
            const existing = paidBy.find(p => p.mid === mId);
            if (existing) {
                setPaidBy(paidBy.map(p => p.mid === mId ? { ...p, amount: val } : p));
            } else {
                setPaidBy([...paidBy, { mid: mId, user: userId, name, amount: val }]);
            }
        }
    };

    const validateAndCalculate = (e) => {
        if (e) e.preventDefault();

        if (!title || !amount || Number(amount) <= 0) {
            toast.error("Please enter a valid title and amount");
            return false;
        }

        const totalPaid = paidBy.reduce((sum, p) => sum + p.amount, 0);
        if (Math.abs(totalPaid - Number(amount)) > 0.01) {
            toast.error(`Total paid (₹${totalPaid}) must equal expense amount (₹${amount})`);
            return false;
        }

        const involvedMembers = splitDetails.filter(s => s.involved);
        if (involvedMembers.length === 0) {
            toast.error("At least one member must be involved in the split");
            return false;
        }

        if (splitType === 'exact') {
            const totalShare = involvedMembers.reduce((sum, s) => sum + s.share, 0);
            if (Math.abs(totalShare - Number(amount)) > 0.1) {
                toast.error("Total exact shares must equal total amount");
                return false;
            }
        } else if (splitType === 'percentage') {
            const totalPct = involvedMembers.reduce((sum, s) => sum + s.share, 0);
            if (Math.abs(totalPct - 100) > 0.1) {
                toast.error("Total percentage must equal 100%");
                return false;
            }
        }

        return true;
    };

    const handleSubmit = async () => {
        if (!validateAndCalculate()) return;

        try {
            const finalSplitDetails = splitDetails
                .filter(s => s.involved)
                .map(s => ({
                    user: (s.user && typeof s.user === 'string' && s.user.length === 24) ? s.user : null,
                    name: s.name,
                    share: s.share
                }));

            const finalPaidBy = paidBy.map(p => ({
                user: (p.user && typeof p.user === 'string' && p.user.length === 24) ? p.user : null,
                name: p.name,
                amount: p.amount
            }));

            await api.post('/group-expenses', {
                groupId: selectedGroupId,
                title,
                amount: Number(amount),
                paidBy: finalPaidBy,
                splitType,
                splitDetails: finalSplitDetails,
                category,
                note
            });

            toast.success("Expense added successfully");
            navigate('/groups/expenses');
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to add expense");
        }
    };

    if (loading) return <div className="p-8">Loading...</div>;

    const involvedCount = splitDetails.filter(s => s.involved).length;

    return (
        <div className="max-w-4xl mx-auto pb-12">
            <div className="flex items-center space-x-4 mb-8">
                <button onClick={() => navigate('/groups/expenses')} className="p-2 bg-gray-100 rounded-full hover:bg-gray-200 transition">
                    <MdArrowBack className="w-6 h-6 text-gray-700" />
                </button>
                <h1 className="text-3xl font-bold text-gray-900">Add Group Expense</h1>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Left Column: Basic Info & Paid By */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Expense Title</label>
                                <input
                                    type="text"
                                    value={title}
                                    onChange={e => setTitle(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition outline-none"
                                    placeholder="e.g. Pizza Night"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-semibold text-gray-700 mb-2">Total Amount (₹)</label>
                                <input
                                    type="number"
                                    value={amount}
                                    onChange={e => setAmount(e.target.value)}
                                    className="w-full px-4 py-2.5 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 transition outline-none font-bold text-lg"
                                    placeholder="0.00"
                                />
                            </div>
                        </div>

                        <div>
                            <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                                <span className="w-8 h-8 bg-indigo-100 text-indigo-600 rounded-lg flex items-center justify-center mr-3 text-sm">1</span>
                                Paid By
                            </h3>
                            <div className="space-y-3">
                                {groupData?.members.map(m => {
                                    const mId = m._id;
                                    const payer = paidBy.find(p => p.mid === mId);
                                    return (
                                        <div key={mId} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                                            <span className="font-medium text-gray-700">{m.name}</span>
                                            <div className="flex items-center space-x-2">
                                                <span className="text-gray-400">₹</span>
                                                <input
                                                    type="number"
                                                    value={payer ? payer.amount : ''}
                                                    onChange={e => handlePayerChange(mId, m.name, m.user, e.target.value)}
                                                    className="w-28 px-3 py-1.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-right"
                                                    placeholder="0.00"
                                                />
                                            </div>
                                        </div>
                                    )
                                })}
                            </div>
                        </div>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h3 className="text-lg font-bold text-gray-800 mb-4 flex items-center">
                            <span className="w-8 h-8 bg-teal-100 text-teal-600 rounded-lg flex items-center justify-center mr-3 text-sm">2</span>
                            Split Method
                        </h3>

                        <div className="flex flex-wrap gap-2 mb-6">
                            {['equal', 'exact', 'percentage'].map((type) => (
                                <button
                                    key={type}
                                    onClick={() => setSplitType(type)}
                                    className={`px-4 py-2 rounded-xl text-sm font-semibold capitalize transition-all ${splitType === type ? 'bg-indigo-600 text-white shadow-md' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                                        }`}
                                >
                                    {type}
                                </button>
                            ))}
                        </div>

                        <div className="space-y-4">
                            {splitDetails.map((m) => (
                                <div key={m.mid} className={`flex items-center justify-between p-4 rounded-xl border transition-all ${m.involved ? 'bg-indigo-50/30 border-indigo-100' : 'bg-gray-50/50 border-transparent grayscale opacity-50'}`}>
                                    <div className="flex items-center space-x-3">
                                        <input
                                            type="checkbox"
                                            checked={m.involved}
                                            onChange={() => handleInvolvementToggle(m.mid)}
                                            className="w-5 h-5 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                                        />
                                        <span className={`font-semibold ${m.involved ? 'text-indigo-900' : 'text-gray-500'}`}>{m.name}</span>
                                    </div>

                                    {m.involved && (
                                        <div className="flex items-center space-x-2">
                                            {splitType === 'equal' ? (
                                                <span className="text-indigo-600 font-bold px-3 py-1 bg-white rounded-lg border border-indigo-100 shadow-sm">
                                                    ₹{(Number(amount) / involvedCount || 0).toFixed(2)}
                                                </span>
                                            ) : (
                                                <>
                                                    <span className="text-gray-400">{splitType === 'percentage' ? '%' : '₹'}</span>
                                                    <input
                                                        type="number"
                                                        value={m.share || ''}
                                                        onChange={e => handleShareChange(m.mid, e.target.value)}
                                                        className="w-24 px-3 py-1.5 bg-white border border-gray-200 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none text-right font-medium"
                                                        placeholder="0"
                                                    />
                                                </>
                                            )}
                                        </div>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Right Column: Actions & Additional Info */}
                <div className="space-y-6">
                    <div className="bg-indigo-600 p-6 rounded-2xl shadow-xl text-white">
                        <h3 className="text-xl font-bold mb-4 flex items-center">
                            <MdCalculate className="mr-2" /> Summary
                        </h3>
                        <div className="space-y-4 text-indigo-100">
                            <div className="flex justify-between border-b border-indigo-500 pb-2">
                                <span>Total Amount</span>
                                <span className="text-white font-bold">₹{amount || '0.00'}</span>
                            </div>
                            <div className="flex justify-between border-b border-indigo-500 pb-2">
                                <span>Total Paid</span>
                                <span className={`font-bold ${Math.abs(paidBy.reduce((s, p) => s + p.amount, 0) - Number(amount)) < 0.01 ? 'text-green-300' : 'text-red-300'}`}>
                                    ₹{paidBy.reduce((s, p) => s + p.amount, 0).toFixed(2)}
                                </span>
                            </div>
                            <div className="flex justify-between">
                                <span>Splitting Between</span>
                                <span className="text-white font-bold">{involvedCount} members</span>
                            </div>
                        </div>

                        <button
                            onClick={handleSubmit}
                            className="w-full mt-8 py-4 bg-white text-indigo-600 rounded-xl font-bold text-lg hover:bg-indigo-50 transition shadow-lg active:scale-95 flex items-center justify-center"
                        >
                            <MdCheckCircle className="mr-2 text-xl" /> Save Expense
                        </button>
                    </div>

                    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100">
                        <h4 className="text-sm font-bold text-gray-700 uppercase tracking-widest mb-4">Details</h4>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1 ml-1">Category</label>
                                <select
                                    value={category}
                                    onChange={e => setCategory(e.target.value)}
                                    className="w-full px-4 py-2 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none"
                                >
                                    <option value="General">General</option>
                                    <option value="Food">Food</option>
                                    <option value="Travel">Travel</option>
                                    <option value="Entertainment">Entertainment</option>
                                    <option value="Shopping">Shopping</option>
                                    <option value="Household">Household</option>
                                </select>
                            </div>
                            <div>
                                <label className="block text-xs font-semibold text-gray-500 mb-1 ml-1">Notes</label>
                                <textarea
                                    rows="3"
                                    value={note}
                                    onChange={e => setNote(e.target.value)}
                                    className="w-full px-4 py-2 bg-gray-50 border border-transparent rounded-xl focus:bg-white focus:ring-2 focus:ring-indigo-500 outline-none resize-none"
                                    placeholder="Add any extra details..."
                                ></textarea>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default AddGroupExpense;
