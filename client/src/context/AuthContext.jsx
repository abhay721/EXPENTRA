import React, { createContext, useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';
import { getFCMToken } from '../utils/getFCMToken';
import { messaging, onMessage } from '../firebase';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Group Mode State
    const [appMode, setAppModeState] = useState(localStorage.getItem('appMode') || 'personal'); // 'personal' | 'group'
    const [selectedGroupId, setSelectedGroupIdState] = useState(localStorage.getItem('selectedGroupId') || null);
    const [activeGroup, setActiveGroup] = useState(null);
    const [notifications, setNotifications] = useState([]);

    const fetchNotifications = async () => {
        try {
            const res = await api.get('/notifications');
            if (res.data) setNotifications(res.data);
        } catch (error) {
            console.error('Failed to load notifications', error);
        }
    };

    const setAppMode = (mode) => {
        setAppModeState(mode);
        localStorage.setItem('appMode', mode);
    };

    const setSelectedGroupId = (groupId) => {
        setSelectedGroupIdState(groupId);
        if (groupId) {
            localStorage.setItem('selectedGroupId', groupId);
            fetchGroupName(groupId);
        } else {
            localStorage.removeItem('selectedGroupId');
            setActiveGroup(null);
        }
    };

    const fetchGroupName = async (groupId) => {
        try {
            const res = await api.get(`/groups/${groupId}`);
            setActiveGroup(res.data);
        } catch (error) {
            console.error("Failed to fetch group name", error);
            setActiveGroup(null);
        }
    };

    useEffect(() => {
        if (selectedGroupId && !activeGroup) {
            fetchGroupName(selectedGroupId);
        }
    }, [selectedGroupId]);

    useEffect(() => {
        const checkLoggedIn = async () => {
            try {
                const token = localStorage.getItem('token');
                if (token) {
                    const res = await api.get('/auth/profile');
                    setUser(res.data);
                } else {
                    setUser(null);
                }
            } catch (error) {
                setUser(null);
                localStorage.removeItem('token');
                localStorage.removeItem('appMode');
                localStorage.removeItem('selectedGroupId');
                setAppModeState('personal');
                setSelectedGroupIdState(null);
                setActiveGroup(null);
            } finally {
                setLoading(false);
            }
        };

        checkLoggedIn();
        if (user) fetchNotifications();
    }, [user]);

    const notificationSetupDone = React.useRef(null);

    useEffect(() => {
        if (user && !loading && notificationSetupDone.current !== user._id) {
            const setupNotifications = async () => {
                try {
                    const fcmToken = await getFCMToken();
                    if (fcmToken) {
                        console.log('Current FCM Token:', fcmToken);
                        await api.post('/auth/fcm-token', { fcmToken });
                        notificationSetupDone.current = user._id; // Mark as done for this user
                    }

                    // Foreground messages listener
                    const unsubscribe = onMessage(messaging, (payload) => {
                        toast.info(`${payload.notification.title}: ${payload.notification.body}`, {
                            position: "top-right",
                            autoClose: 5000,
                        });
                        fetchNotifications();
                    });

                    return unsubscribe;
                } catch (error) {
                    console.error("FCM setup failed:", error);
                }
            };
            setupNotifications();
        }
    }, [user, loading]);

    const login = async (email, password) => {
        try {
            const res = await api.post('/auth/login', { email, password });
            localStorage.setItem('token', res.data.token);
            setUser(res.data);
            toast.success('Logged in successfully!');
            return { success: true, role: res.data.role };
        } catch (error) {
            toast.error(error.response?.data?.message || 'Login failed');
            return { success: false };
        }
    };

    const register = async (name, email, password, role) => {
        try {
            const res = await api.post('/auth/register', { name, email, password, role });
            localStorage.setItem('token', res.data.token);
            setUser(res.data);
            toast.success('Registration successful!');
            return { success: true, role: res.data.role };
        } catch (error) {
            toast.error(error.response?.data?.message || 'Registration failed');
            return { success: false };
        }
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('appMode');
        localStorage.removeItem('selectedGroupId');
        setAppModeState('personal');
        setSelectedGroupIdState(null);
        setActiveGroup(null);
        setUser(null);
        toast.info('Logged out');
    };

    return (
        <AuthContext.Provider value={{
            user, setUser, login, register, logout, loading,
            appMode, setAppMode, selectedGroupId, setSelectedGroupId, activeGroup,
            notifications, fetchNotifications
        }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
