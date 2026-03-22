import React, { useContext, useState, useEffect } from 'react';
import { AuthContext } from '../context/AuthContext';
import { MdLogout, MdAccountCircle, MdMenu, MdNotifications } from 'react-icons/md';
import { Link } from 'react-router-dom';
import api from '../services/api';

const Navbar = ({ user, setIsSidebarOpen }) => {
    const { logout, appMode, activeGroup, notifications } = useContext(AuthContext);

    return (
        <header className="flex justify-between items-center py-4 px-4 md:px-6 bg-white border-b border-gray-200 shrink-0">
            <div className="flex items-center">
                <button
                    className="mr-4 md:hidden text-gray-500 hover:text-gray-700"
                    onClick={() => setIsSidebarOpen(true)}
                >
                    <MdMenu className="w-6 h-6" />
                </button>
                <h2 className="text-xl md:text-2xl font-bold text-gray-900 border-l-4 border-indigo-600 pl-4 capitalize truncate">
                    {appMode === 'group' && activeGroup ? activeGroup.name : `${user?.role} Portal`}
                </h2>
                {appMode === 'group' && (
                    <Link
                        to="/groups"
                        className="ml-4 px-3 py-1 bg-indigo-50 text-indigo-600 text-xs font-bold rounded-full hover:bg-indigo-100 transition-colors border border-indigo-100 flex items-center whitespace-nowrap"
                    >
                        Change Group
                    </Link>
                )}
            </div>

            <div className="flex items-center space-x-6">
                <div className="flex items-center">
                    <Link to="/alerts" className="relative text-gray-400 hover:text-gray-600 mr-4 transition-colors">
                        <MdNotifications className="w-7 h-7" />
                        {notifications.length > 0 && (
                            <span className="absolute top-0 right-0 inline-flex items-center justify-center px-1.5 py-0.5 text-[10px] font-bold leading-none text-white bg-red-500 rounded-full transform translate-x-1/4 -translate-y-1/4">
                                {notifications.length > 99 ? '99+' : notifications.length}
                            </span>
                        )}
                    </Link>

                    <MdAccountCircle className="h-8 w-8 text-gray-400" />
                    <span className="text-gray-700 text-sm font-medium ml-2 mr-4 hidden sm:inline-block">
                        Hi, {user?.name}
                    </span>
                    <button
                        onClick={logout}
                        className="flex items-center text-red-600 hover:text-red-800 transition-colors"
                    >
                        <MdLogout className="h-5 w-5 sm:mr-1" />
                        <span className="text-sm font-medium hidden sm:inline-block">Logout</span>
                    </button>
                </div>
            </div>
        </header>
    );
};

export default Navbar;
