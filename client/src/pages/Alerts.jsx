import React, { useState, useEffect, useContext } from 'react';
import api from '../services/api';
import { AuthContext } from '../context/AuthContext';
import { MdNotificationsActive, MdClose } from 'react-icons/md';

const Alerts = () => {
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchAlerts = async () => {
            try {
                const res = await api.get('/notifications');
                setNotifications(res.data);
            } catch (error) {
                console.error('Failed to load notifications', error);
            } finally {
                setLoading(false);
            }
        };
        fetchAlerts();
    }, []);

    const getAlertStyle = (type) => {
        switch (type) {
            case 'BUDGET_EXCEEDED':
                return 'bg-rose-50 border-rose-500 text-rose-800';
            case 'SETTLEMENT_PENDING':
                return 'bg-amber-50 border-amber-500 text-amber-800';
            case 'GROUP_EXPENSE':
                return 'bg-indigo-50 border-indigo-500 text-indigo-800';
            case 'PAYMENT_RECEIVED':
                return 'bg-emerald-50 border-emerald-500 text-emerald-800';
            case 'BUDGET_WARNING':
            case 'OVERSPENDING_WARNING':
                return 'bg-orange-50 border-orange-500 text-orange-800';
            case 'RECURRING_SUBSCRIPTION':
                return 'bg-blue-50 border-blue-500 text-blue-800';
            case 'INFO':
                return 'bg-slate-50 border-slate-300 text-slate-600';
            default:
                return 'bg-indigo-50 border-indigo-500 text-indigo-800';
        }
    };

    if (loading) return <div className="p-8">Checking for alerts...</div>;

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex items-center pb-4 border-b border-gray-200">
                <MdNotificationsActive className="text-amber-500 w-8 h-8 mr-3" />
                <h1 className="text-2xl font-bold text-gray-900">System Alerts & Notifications</h1>
            </div>

            <div className="space-y-4 shadow-sm bg-white p-6 rounded-xl">
                {notifications.length === 0 ? (
                    <p className="text-gray-500 text-center py-4">No alerts right now. You are doing great!</p>
                ) : (
                    notifications.map((note, index) => (
                        <div key={index} className={`border-l-4 p-4 rounded shadow-sm flex justify-between items-start ${getAlertStyle(note.type)}`}>
                            <div>
                                <h3 className="font-bold text-sm uppercase tracking-wide mb-1">{note.type.replace('_', ' ')}</h3>
                                <p>{note.message}</p>

                                {/* Specific details rendering like subscription lists if available */}
                                {note.details && note.details.length > 0 && (
                                    <ul className="mt-2 text-sm ml-4 list-disc opacity-80">
                                        {note.details.map((d, i) => (
                                            <li key={i}>{d._id.category}: ~${d._id.amount} ({d.count} times recently)</li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                            <button className="opacity-50 hover:opacity-100"><MdClose /></button>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
};

export default Alerts;
