import React, { useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { ToastContainer } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import axios from 'axios';

// Configure Axios globally
const rawApiUrl = import.meta.env.VITE_API_URL || 'http://localhost:5000/api';
const API_URL = (Array.isArray(rawApiUrl) ? rawApiUrl[0] : rawApiUrl).toString().trim().replace(/,$/, '');
axios.defaults.baseURL = API_URL;
axios.defaults.withCredentials = true;

// Add a request interceptor
axios.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Add a response interceptor
axios.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Layouts and Security
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';

// Pages
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Income from './pages/Income';
import Expenses from './pages/Expenses';
import Budget from './pages/Budget';
import Reports from './pages/Reports';
import Analysis from './pages/Analysis';
import Alerts from './pages/Alerts';

// Group Pages
import GroupSelection from './pages/group/GroupSelection';
import GroupDashboard from './pages/group/GroupDashboard';
import GroupExpenses from './pages/group/GroupExpenses';
import AddGroupExpense from './pages/group/AddGroupExpense';
import Settlement from './pages/group/Settlement';
import Members from './pages/group/Members';
import GroupAnalytics from './pages/group/GroupAnalytics';
import GroupReports from './pages/group/GroupReports';

import AdminDashboard from './pages/admin/AdminDashboard';
import AdminUsers from './pages/admin/AdminUsers';
import AdminCategories from './pages/admin/AdminCategories';
import AdminReports from './pages/admin/AdminReports';
import AdminProfile from './pages/admin/AdminProfile';


function App() {
  return (
    <AuthProvider>
      <Router>
        <ToastContainer position="top-right" autoClose={3000} />

        <Routes>
          {/* Public Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />

          {/* Redirect root to dashboard */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />

          {/* Protected Routes Wrapper mapped to Layout wrapper */}
          <Route element={<ProtectedRoute />}>
            <Route element={<Layout />}>

              {/* Everyone gets these basic pages (modulo Admin who gets everything) */}
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/income" element={<Income />} />
              <Route path="/expenses" element={<Expenses />} />
              <Route path="/budget" element={<Budget />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/analysis" element={<Analysis />} />
              <Route path="/alerts" element={<Alerts />} />

              <Route path="/groups" element={<GroupSelection />} />
              <Route path="/groups/dashboard" element={<GroupDashboard />} />
              <Route path="/groups/expenses" element={<GroupExpenses />} />
              <Route path="/groups/add-expense" element={<AddGroupExpense />} />
              <Route path="/groups/expenses/edit/:expenseId" element={<AddGroupExpense />} />

              <Route path="/groups/settlement" element={<Settlement />} />
              <Route path="/groups/members" element={<Members />} />
              <Route path="/groups/analytics" element={<GroupAnalytics />} />
              <Route path="/groups/reports" element={<GroupReports />} />
              <Route path="/join-group/:inviteCode" element={<GroupSelection />} />



              <Route element={<ProtectedRoute allowedRoles={['admin']} />}>
                <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />
                <Route path="/admin/dashboard" element={<AdminDashboard />} />
                <Route path="/admin/users" element={<AdminUsers />} />
                <Route path="/admin/categories" element={<AdminCategories />} />
                <Route path="/admin/reports" element={<AdminReports />} />
                <Route path="/admin/profile" element={<AdminProfile />} />
              </Route>

            </Route>
          </Route>

          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
