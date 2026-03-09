import React, { useState, useEffect, useContext } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import api from '../../services/api';
import { AuthContext } from '../../context/AuthContext';
import { MdAdd, MdGroup, MdEdit, MdDelete, MdClose, MdCheck } from 'react-icons/md';
import { toast } from 'react-toastify';

const GroupSelection = () => {
    const { inviteCode: urlInviteCode } = useParams();
    const [groups, setGroups] = useState([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState(urlInviteCode ? 'join' : 'select'); // 'select', 'create', 'join'
    const [newGroup, setNewGroup] = useState({ name: '', description: '' });
    const [inviteCode, setInviteCode] = useState(urlInviteCode || '');

    // Edit states
    const [editingGroup, setEditingGroup] = useState(null);
    const [editData, setEditData] = useState({ name: '', description: '' });

    const { setAppMode, setSelectedGroupId, user } = useContext(AuthContext);
    const navigate = useNavigate();

    useEffect(() => {
        fetchGroups();
        if (urlInviteCode) {
            setActiveTab('join');
            setInviteCode(urlInviteCode);
        }
    }, [urlInviteCode]);

    const fetchGroups = async () => {
        try {
            const res = await api.get('/groups');
            setGroups(res.data);
        } catch (error) {
            toast.error("Failed to load groups");
        } finally {
            setLoading(false);
        }
    };

    const handleCreateGroup = async (e) => {
        e.preventDefault();
        try {
            const res = await api.post('/groups', newGroup);
            setGroups([res.data, ...groups]);
            setNewGroup({ name: '', description: '' });
            setActiveTab('select');
            toast.success("Group created successfully!");
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to create group");
        }
    };

    const handleJoinGroup = async (e) => {
        e.preventDefault();
        try {
            await api.post('/groups/join', { inviteCode });
            setInviteCode('');
            setActiveTab('select');
            fetchGroups();
            toast.success("Joined group successfully!");
        } catch (error) {
            toast.error(error.response?.data?.message || "Invalid invite code");
        }
    };

    const handleSelectGroup = (groupId) => {
        setSelectedGroupId(groupId);
        setAppMode('group');
        navigate('/groups/dashboard');
    };

    const handleUpdateGroup = async (e) => {
        e.preventDefault();
        try {
            const res = await api.put(`/groups/${editingGroup._id}`, editData);
            setGroups(groups.map(g => g._id === editingGroup._id ? res.data : g));
            setEditingGroup(null);
            toast.success("Group updated successfully!");
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to update group");
        }
    };

    const handleDeleteGroup = async (groupId, groupName) => {
        if (!window.confirm(`Are you sure you want to delete "${groupName}"? This action cannot be undone.`)) return;
        try {
            await api.delete(`/groups/${groupId}`);
            setGroups(groups.filter(g => g._id !== groupId));
            toast.success("Group deleted successfully");
        } catch (error) {
            toast.error(error.response?.data?.message || "Failed to delete group");
        }
    };

    const startEditing = (e, group) => {
        e.stopPropagation();
        setEditingGroup(group);
        setEditData({ name: group.name, description: group.description || '' });
    };

    if (loading) return <div className="flex justify-center items-center h-screen"><div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div></div>;

    return (
        <div className="max-w-5xl mx-auto p-6 md:p-10 space-y-10">
            <header className="text-center space-y-4">
                <h1 className="text-5xl font-black text-gray-900 tracking-tight">Group Mode</h1>
                <p className="text-lg text-gray-500 max-w-2xl mx-auto">Collaborate, split bills, and track shared expenses with ease.</p>
            </header>

            <div className="flex justify-center">
                <div className="bg-gray-100 p-1.5 rounded-2xl flex space-x-1 shadow-inner">
                    <button
                        onClick={() => setActiveTab('select')}
                        className={`px-8 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'select' ? 'bg-white shadow-md text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        My Groups
                    </button>
                    <button
                        onClick={() => setActiveTab('create')}
                        className={`px-8 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'create' ? 'bg-white shadow-md text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Create Group
                    </button>
                    <button
                        onClick={() => setActiveTab('join')}
                        className={`px-8 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'join' ? 'bg-white shadow-md text-indigo-600' : 'text-gray-500 hover:text-gray-700'}`}
                    >
                        Join Group
                    </button>
                </div>
            </div>

            <div className="transition-all duration-300">
                {activeTab === 'select' && (
                    <div className="space-y-6">
                        {groups.length === 0 ? (
                            <div className="text-center py-24 bg-white rounded-3xl border-2 border-dashed border-gray-200">
                                <MdGroup className="w-16 h-16 text-gray-300 mx-auto mb-4" />
                                <h3 className="text-2xl font-bold text-gray-900">No groups yet</h3>
                                <p className="text-gray-500 mt-2">Get started by creating or joining a group.</p>
                                <div className="mt-8 space-x-4">
                                    <button onClick={() => setActiveTab('create')} className="px-6 py-3 bg-indigo-600 text-white rounded-xl font-bold hover:bg-indigo-700 shadow-lg shadow-indigo-200 transition">Create Group</button>
                                    <button onClick={() => setActiveTab('join')} className="px-6 py-3 bg-white border-2 border-gray-100 text-gray-700 rounded-xl font-bold hover:border-indigo-200 transition">Join Group</button>
                                </div>
                            </div>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                                {groups.map(group => {
                                    const isCreator = user && group.createdBy && group.createdBy.toString() === (user._id || user.id).toString();
                                    return (
                                        <div
                                            key={group._id}
                                            onClick={() => handleSelectGroup(group._id)}
                                            className="group bg-white p-8 rounded-3xl shadow-sm border border-gray-100 cursor-pointer hover:shadow-2xl hover:-translate-y-2 transition-all duration-300 relative"
                                        >
                                            {isCreator && (
                                                <div className="absolute top-4 right-4 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={(e) => startEditing(e, group)}
                                                        className="p-2 bg-indigo-50 text-indigo-600 rounded-lg hover:bg-indigo-100"
                                                        title="Edit Group"
                                                    >
                                                        <MdEdit className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={(e) => {
                                                            e.stopPropagation();
                                                            handleDeleteGroup(group._id, group.name);
                                                        }}
                                                        className="p-2 bg-red-50 text-red-600 rounded-lg hover:bg-red-100"
                                                        title="Delete Group"
                                                    >
                                                        <MdDelete className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            )}
                                            <div className="w-16 h-16 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 mb-6 group-hover:scale-110 transition-transform">
                                                <MdGroup className="w-8 h-8" />
                                            </div>
                                            <h3 className="text-2xl font-black text-gray-900 mb-2 truncate">{group.name}</h3>
                                            <p className="text-gray-500 text-sm line-clamp-2 min-h-[40px] mb-6">{group.description || 'No description provided.'}</p>
                                            <div className="flex items-center justify-between pt-6 border-t border-gray-50">
                                                <span className="text-xs font-black uppercase tracking-widest text-indigo-500">{group.members?.length || 1} Members</span>
                                                <div className="w-8 h-8 rounded-full bg-gray-50 flex items-center justify-center group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                                                    <MdAdd className="rotate-45" />
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}

                                {/* Edit Modal Overlay */}
                                {editingGroup && (
                                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
                                        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-lg overflow-hidden animate-in fade-in zoom-in duration-200">
                                            <div className="p-8 border-b border-gray-100 flex justify-between items-center">
                                                <h2 className="text-2xl font-black text-gray-900">Edit Group</h2>
                                                <button onClick={() => setEditingGroup(null)} className="p-2 hover:bg-gray-100 rounded-xl transition">
                                                    <MdClose className="w-6 h-6 text-gray-400" />
                                                </button>
                                            </div>
                                            <form onSubmit={handleUpdateGroup} className="p-8 space-y-6">
                                                <div className="space-y-2">
                                                    <label className="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Group Name</label>
                                                    <input
                                                        type="text"
                                                        value={editData.name}
                                                        onChange={(e) => setEditData({ ...editData, name: e.target.value })}
                                                        className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-4 focus:ring-indigo-100 transition"
                                                        required
                                                    />
                                                </div>
                                                <div className="space-y-2">
                                                    <label className="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Description</label>
                                                    <textarea
                                                        value={editData.description}
                                                        onChange={(e) => setEditData({ ...editData, description: e.target.value })}
                                                        className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-4 focus:ring-indigo-100 transition h-32 resize-none"
                                                    />
                                                </div>
                                                <div className="flex gap-4 pt-2">
                                                    <button type="button" onClick={() => setEditingGroup(null)} className="flex-1 py-4 bg-gray-100 text-gray-600 rounded-2xl font-black hover:bg-gray-200 transition">
                                                        Cancel
                                                    </button>
                                                    <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-black hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition">
                                                        Save Changes
                                                    </button>
                                                </div>
                                            </form>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                )}

                {activeTab === 'create' && (
                    <div className="max-w-2xl mx-auto bg-white p-10 rounded-3xl shadow-2xl shadow-indigo-100 border border-gray-100">
                        <h2 className="text-3xl font-black mb-8 text-gray-900 border-b pb-4">Create New Group</h2>
                        <form onSubmit={handleCreateGroup} className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Group Name</label>
                                <input
                                    type="text"
                                    value={newGroup.name}
                                    onChange={(e) => setNewGroup({ ...newGroup, name: e.target.value })}
                                    placeholder="e.g. Goa Trip 2024"
                                    className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-4 focus:ring-indigo-100 transition"
                                    required
                                />
                            </div>
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Description</label>
                                <textarea
                                    value={newGroup.description}
                                    onChange={(e) => setNewGroup({ ...newGroup, description: e.target.value })}
                                    placeholder="What is this group for?"
                                    className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-4 focus:ring-indigo-100 transition h-32 resize-none"
                                />
                            </div>
                            <button type="submit" className="w-full py-5 bg-indigo-600 text-white rounded-2xl font-black text-lg hover:bg-indigo-700 shadow-xl shadow-indigo-200 transition active:scale-[0.98]">
                                Create Group
                            </button>
                        </form>
                    </div>
                )}

                {activeTab === 'join' && (
                    <div className="max-w-lg mx-auto bg-white p-10 rounded-3xl shadow-2xl shadow-indigo-100 border border-gray-100 text-center">
                        <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto mb-8">
                            <MdAdd className="w-10 h-10" />
                        </div>
                        <h2 className="text-3xl font-black mb-4 text-gray-900">Join a Group</h2>
                        <p className="text-gray-500 mb-8">Enter the 6-digit invite code shared by your friend.</p>
                        <form onSubmit={handleJoinGroup} className="space-y-6 text-left">
                            <div className="space-y-2">
                                <label className="text-xs font-black uppercase tracking-widest text-gray-400 ml-1">Invite Code</label>
                                <input
                                    type="text"
                                    value={inviteCode}
                                    onChange={(e) => setInviteCode(e.target.value.toUpperCase())}
                                    placeholder="e.g. 8F4K29"
                                    className="w-full px-6 py-4 bg-gray-50 border-none rounded-2xl focus:ring-4 focus:ring-indigo-100 transition text-center text-2xl font-black tracking-[0.5em]"
                                    maxLength={6}
                                    required
                                />
                            </div>
                            <button type="submit" className="w-full py-5 bg-emerald-600 text-white rounded-2xl font-black text-lg hover:bg-emerald-700 shadow-xl shadow-emerald-200 transition active:scale-[0.98]">
                                Join Group
                            </button>
                        </form>
                    </div>
                )}
            </div>
        </div>
    );
};

export default GroupSelection;
