import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Sidebar from './Sidebar';
import LoginForm from './auth/LoginForm';
import Dashboard from '../pages/Dashboard';
import Master from '../pages/Master';
import Employees from '../pages/Employees';
import Attendance from '../pages/Attendance';
import DailyAttendance from '../pages/DailyAttendance';
import MonthlyAttendance from '../pages/MonthlyAttendance';
import ShiftAssignment from '../pages/ShiftAssignment';
import Allowance from '../pages/Allowance';
import Reports from '../pages/Reports';

const Layout: React.FC = () => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    // Check if user is already logged in
    const authStatus = localStorage.getItem('isAuthenticated');
    if (authStatus === 'true') {
      setIsAuthenticated(true);
    }
    setIsLoading(false);
  }, []);

  const handleLogin = (success: boolean) => {
    if (success) {
      setIsAuthenticated(true);
      localStorage.setItem('isAuthenticated', 'true');
    }
  };

  const handleLogout = () => {
    setIsAuthenticated(false);
    localStorage.removeItem('isAuthenticated');
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return <LoginForm onLogin={handleLogin} />;
  }

  return (
    <Router>
      <div className="min-h-screen bg-gray-100 flex">
        <Sidebar onLogout={handleLogout} />
        <main className="flex-1 p-6 ml-0 lg:ml-64">
          <Routes>
            <Route path="/" element={<Navigate to="/dashboard" replace />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/master" element={<Master />} />
            <Route path="/employees" element={<Employees />} />
            <Route path="/attendance" element={<Attendance />} />
            <Route path="/daily-attendance" element={<DailyAttendance />} />
            <Route path="/monthly-attendance" element={<MonthlyAttendance />} />
            <Route path="/shift-assignment" element={<ShiftAssignment />} />
            <Route path="/allowance" element={<Allowance />} />
            <Route path="/reports" element={<Reports />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
};

export default Layout;