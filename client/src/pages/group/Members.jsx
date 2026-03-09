import React, { useState, useEffect, useContext } from 'react';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import { toast } from 'react-toastify';
import { MdGroupAdd, MdPerson, MdEdit, MdDelete, MdCheck, MdClose } from 'react-icons/md';

const Members = () => {
    const { selectedGroupId } = useContext(AuthContext);
    const [groupData, setGroupData] = useState(null);
    const [loading, setLoading] = useState(true);

    // Form states
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);

    // Edit states
    const [editingMemberId, setEditingMemberId] = useState(null);
    const [editName, setEditName] = useState('');
    const [editEmail, setEditEmail] = useState('');
    const { user } = useContext(AuthContext);

    const isAdmin = groupData && user && groupData.createdBy.toString() === user._id.toString();

    const fetchGroupData = async () => {
        try {
            const res = await api.get(`/groups/${selectedGroupId}`);
            setGroupData(res.data);
        } catch (error) {
            toast.error("Failed to load group members");
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        if (!selectedGroupId) return;
        fetchGroupData();
    }, [selectedGroupId]);

    const handleAddMember = async (e) => {
        e.preventDefault();

        if (!name.trim()) {
            return toast.error("Name is required");
        }

        setIsSubmitting(true);
        try {
            await api.put(`/groups/${selectedGroupId}/members`, {
                name: name.trim(),
                email: email.trim() || undefined
            });

            toast.success(`${name} added to the group!`);
            setName('');
            setEmail('');

            // Refresh member list
            await fetchGroupData();
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to add member");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleUpdateMember = async (memberId) => {
        if (!editName.trim()) return toast.error("Name is required");
        setIsSubmitting(true);
        try {
            await api.put(`/groups/${selectedGroupId}/members/${memberId}`, {
                name: editName.trim(),
                email: editEmail.trim() || ''
            });
            toast.success("Member updated");
            setEditingMemberId(null);
            await fetchGroupData();
        } catch (error) {
            toast.error(error.response?.data?.message || "Update failed");
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeleteMember = async (memberId, memberName) => {
        if (!window.confirm(`Are you sure you want to remove ${memberName} from the group?`)) return;
        try {
            await api.delete(`/groups/${selectedGroupId}/members/${memberId}`);
            toast.success("Member removed");
            await fetchGroupData();
        } catch (error) {
            toast.error(error.response?.data?.message || "Delete failed");
        }
    };

    const startEditing = (member) => {
        setEditingMemberId(member._id);
        setEditName(member.name);
        setEditEmail(member.email || '');
    };

    if (!selectedGroupId) {
        return <div className="p-8 text-center bg-white rounded-xl shadow mt-8">Please select a group first.</div>;
    }

    if (loading) return <div className="p-8">Loading members...</div>;

    return (
        <div className="space-y-6">
            <h1 className="text-2xl font-bold text-gray-900">{groupData?.name} - Members</h1>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

                {/* Invite Members Section */}
                <div className="md:col-span-1 border border-emerald-100 bg-white rounded-xl shadow-sm p-6 self-start text-sm">
                    <h2 className="text-base font-semibold mb-4 flex items-center text-emerald-900 border-b pb-2">
                        <MdGroupAdd className="mr-2 w-5 h-5 text-emerald-500" />
                        Invite Options
                    </h2>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Invite Code</label>
                            <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-50 px-4 py-3 rounded-xl font-black text-lg text-center tracking-widest border border-gray-100">
                                    {groupData?.inviteCode || 'N/A'}
                                </div>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(groupData?.inviteCode);
                                        toast.success("Code copied!");
                                    }}
                                    className="p-3 bg-gray-100 rounded-xl hover:bg-gray-200 transition"
                                    title="Copy Code"
                                >
                                    <MdCheck className="w-5 h-5 text-gray-600" />
                                </button>
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black uppercase tracking-widest text-gray-400">Invite Link</label>
                            <div className="flex items-center gap-2">
                                <div className="flex-1 bg-gray-50 px-3 py-2 rounded-lg text-xs truncate border border-gray-100 text-gray-500">
                                    {groupData?.inviteLink || 'N/A'}
                                </div>
                                <button
                                    onClick={() => {
                                        navigator.clipboard.writeText(groupData?.inviteLink);
                                        toast.success("Link copied!");
                                    }}
                                    className="p-2 bg-gray-100 rounded-lg hover:bg-gray-200 transition"
                                    title="Copy Link"
                                >
                                    <MdCheck className="w-4 h-4 text-gray-600" />
                                </button>
                            </div>
                        </div>

                        <div className="pt-2">
                            <button
                                onClick={() => toast.info("Email invitation feature coming soon!")}
                                className="w-full py-3 bg-indigo-600 text-white rounded-xl font-bold text-sm hover:bg-indigo-700 transition"
                            >
                                Invite via Email
                            </button>
                        </div>
                    </div>
                </div>

                {/* Add Member Form (Manual) */}
                <div className="md:col-span-1 border border-indigo-100 bg-white rounded-xl shadow-sm p-6 self-start text-sm">
                    <h2 className="text-base font-semibold mb-4 flex items-center text-indigo-900 border-b pb-2">
                        <MdPerson className="mr-2 w-5 h-5 text-indigo-500" />
                        Add Manually
                    </h2>

                    <form onSubmit={handleAddMember} className="space-y-4">
                        <div>
                            <label className="block text-gray-700 font-medium mb-1">Name <span className="text-red-500">*</span></label>
                            <input
                                type="text"
                                value={name}
                                onChange={e => setName(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition"
                                placeholder="e.g. John Doe"
                                required
                            />
                        </div>

                        <div>
                            <label className="block text-gray-700 font-medium mb-1">Email <span className="text-gray-400 font-normal text-xs">(optional)</span></label>
                            <input
                                type="email"
                                value={email}
                                onChange={e => setEmail(e.target.value)}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 outline-none transition"
                                placeholder="john@example.com"
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={isSubmitting}
                            className={`w-full py-3 px-4 rounded-xl font-bold text-white transition-colors
                                ${isSubmitting ? 'bg-indigo-400 cursor-not-allowed' : 'bg-indigo-600 hover:bg-indigo-700'}`}
                        >
                            {isSubmitting ? 'Adding...' : 'Add Member'}
                        </button>
                    </form>
                </div>

                {/* Member List */}
                <div className="md:col-span-2 bg-white rounded-xl shadow-sm p-6 border border-gray-100 text-sm">
                    <h2 className="text-base font-semibold mb-4 text-gray-800 border-b pb-2">
                        Current Group Members ({groupData?.members?.length || 0})
                    </h2>

                    <div className="space-y-3 mt-4">
                        {groupData?.members.map(member => (
                            <div key={member._id} className="flex flex-col sm:flex-row sm:items-center justify-between p-3 border border-gray-100 rounded-lg bg-gray-50 hover:bg-white transition hover:shadow-sm gap-3">
                                <div className="flex items-center flex-1 truncate">
                                    <div className="w-10 h-10 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-700 font-bold mr-3 shrink-0">
                                        {member.name.charAt(0).toUpperCase()}
                                    </div>
                                    {editingMemberId === member._id ? (
                                        <div className="flex flex-wrap gap-2 flex-1">
                                            <input
                                                type="text"
                                                value={editName}
                                                onChange={e => setEditName(e.target.value)}
                                                className="px-2 py-1 border rounded text-xs"
                                                placeholder="Name"
                                            />
                                            <input
                                                type="email"
                                                value={editEmail}
                                                onChange={e => setEditEmail(e.target.value)}
                                                className="px-2 py-1 border rounded text-xs"
                                                placeholder="Email"
                                            />
                                        </div>
                                    ) : (
                                        <div className="truncate">
                                            <p className="font-semibold text-gray-900 truncate" title={member.name}>
                                                {member.name}
                                                {groupData.createdBy.toString() === (member.user && member.user.toString()) && (
                                                    <span className="ml-2 text-[10px] bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full uppercase tracking-wide">Admin</span>
                                                )}
                                            </p>
                                            <p className="text-xs text-gray-500 truncate" title={member.email || 'Unregistered User'}>
                                                {member.email || 'Unregistered User'}
                                            </p>
                                        </div>
                                    )}
                                </div>

                                {isAdmin && (
                                    <div className="flex items-center gap-2 self-end sm:self-center">
                                        {editingMemberId === member._id ? (
                                            <>
                                                <button onClick={() => handleUpdateMember(member._id)} className="p-1.5 text-green-600 hover:bg-green-50 rounded" title="Save">
                                                    <MdCheck className="w-5 h-5" />
                                                </button>
                                                <button onClick={() => setEditingMemberId(null)} className="p-1.5 text-gray-500 hover:bg-gray-100 rounded" title="Cancel">
                                                    <MdClose className="w-5 h-5" />
                                                </button>
                                            </>
                                        ) : (
                                            <>
                                                <button onClick={() => startEditing(member)} className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded" title="Edit">
                                                    <MdEdit className="w-5 h-5" />
                                                </button>
                                                {/* Only show delete if NOT the creator themselves */}
                                                {groupData.createdBy.toString() !== (member.user && member.user.toString()) && (
                                                    <button onClick={() => handleDeleteMember(member._id, member.name)} className="p-1.5 text-red-600 hover:bg-red-50 rounded" title="Delete">
                                                        <MdDelete className="w-5 h-5" />
                                                    </button>
                                                )}
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>

            </div>
        </div>
    );
};

export default Members;
