import React, { createContext, useState, useEffect } from 'react';
import api from '../services/api';
import { toast } from 'react-toastify';

export const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Group Mode State
    const [appMode, setAppModeState] = useState(localStorage.getItem('appMode') || 'personal'); // 'personal' | 'group'
    const [selectedGroupId, setSelectedGroupIdState] = useState(localStorage.getItem('selectedGroupId') || null);
    const [activeGroup, setActiveGroup] = useState(null);

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
            } finally {
                setLoading(false);
            }
        };

        checkLoggedIn();
    }, []);

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
        setUser(null);
        toast.info('Logged out');
    };

    return (
        <AuthContext.Provider value={{
            user, setUser, login, register, logout, loading,
            appMode, setAppMode, selectedGroupId, setSelectedGroupId, activeGroup
        }}>
            {!loading && children}
        </AuthContext.Provider>
    );
};
