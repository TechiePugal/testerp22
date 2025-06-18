import React, { useState, useEffect } from 'react';
import { Users, Clock, DollarSign, Calendar, TrendingUp, UserCheck, Building2, AlertCircle } from 'lucide-react';
import { getDocuments, getAttendanceByDate } from '../services/firestore';
import { formatCurrency, isWorkingDay, isHoliday } from '../utils/calculations';
import type { Employee, Attendance, Allowance, Holiday } from '../types';

const Dashboard: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<Attendance[]>([]);
  const [allowances, setAllowances] = useState<Allowance[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      const [employeesData, allowancesData, holidaysData] = await Promise.all([
        getDocuments('employees'),
        getDocuments('allowances'),
        getDocuments('holidays')
      ]);

      const today = new Date();
      const attendanceData = await getAttendanceByDate(today);

      setEmployees(employeesData);
      setTodayAttendance(attendanceData);
      setAllowances(allowancesData);
      setHolidays(holidaysData);
    } catch (error) {
      console.error('Error loading dashboard data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const today = new Date();
  const isToday = isWorkingDay(today, holidays);
  const todayHoliday = holidays.find(h => isHoliday(today, [h]));

  // Calculate statistics
  const stats = {
    totalEmployees: employees.length,
    activeEmployees: employees.filter(emp => emp.isActive).length,
    staffCount: employees.filter(emp => emp.employeeType === 'staff').length,
    labourCount: employees.filter(emp => emp.employeeType === 'labour').length,
    todayPresent: todayAttendance.filter(att => 
      att.fnStatus === 'present' || att.anStatus === 'present'
    ).length,
    todayAbsent: todayAttendance.filter(att => 
      att.fnStatus === 'absent' && att.anStatus === 'absent'
    ).length,
    todayFullDay: todayAttendance.filter(att => 
      att.fnStatus === 'present' && att.anStatus === 'present'
    ).length,
    todayHalfDay: todayAttendance.filter(att => 
      (att.fnStatus === 'present' && att.anStatus === 'absent') ||
      (att.fnStatus === 'absent' && att.anStatus === 'present')
    ).length,
    monthlyAllowances: allowances.filter(all => {
      const allDate = new Date(all.date);
      return allDate.getMonth() === today.getMonth() && 
             allDate.getFullYear() === today.getFullYear();
    }).reduce((sum, all) => sum + all.amount, 0),
    totalOtHours: todayAttendance.reduce((sum, att) => sum + (att.otHours || 0), 0)
  };

  const attendanceRate = stats.totalEmployees > 0 
    ? ((stats.todayPresent / stats.totalEmployees) * 100).toFixed(1)
    : 0;

  // Recent activities (mock data for demo)
  const recentActivities = [
    { type: 'attendance', message: `${stats.todayPresent} employees marked present today`, time: '2 hours ago' },
    { type: 'employee', message: 'New employee registration completed', time: '4 hours ago' },
    { type: 'allowance', message: 'Monthly food allowances processed', time: '1 day ago' },
    { type: 'report', message: 'Salary report generated for last month', time: '2 days ago' }
  ];

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">Welcome to Employee Management System</p>
          </div>
          <div className="text-right">
            <p className="text-lg font-semibold text-gray-900">
              {today.toLocaleDateString('en-IN', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
            <div className="flex items-center gap-2 mt-1">
              {!isToday ? (
                <>
                  <AlertCircle className="w-4 h-4 text-amber-600" />
                  <span className="text-sm text-amber-600">
                    {todayHoliday ? `Holiday: ${todayHoliday.name}` : 'Sunday - Weekly Off'}
                  </span>
                </>
              ) : (
                <>
                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                  <span className="text-sm text-green-600">Working Day</span>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Employees */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Total Employees</h3>
              <div className="flex items-baseline">
                <p className="text-2xl font-semibold text-gray-900">{stats.totalEmployees}</p>
                <p className="ml-2 text-sm text-green-600">Active: {stats.activeEmployees}</p>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Staff: {stats.staffCount}</span>
              <span>Labour: {stats.labourCount}</span>
            </div>
          </div>
        </div>

        {/* Today's Attendance */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <UserCheck className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Today's Attendance</h3>
              <div className="flex items-baseline">
                <p className="text-2xl font-semibold text-gray-900">{stats.todayPresent}</p>
                <p className="ml-2 text-sm text-gray-600">/{stats.totalEmployees}</p>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-sm">
              <span className="text-green-600">Present: {stats.todayPresent}</span>
              <span className="text-red-600">Absent: {stats.todayAbsent}</span>
            </div>
            <div className="mt-2 bg-gray-200 rounded-full h-2">
              <div 
                className="bg-green-500 h-2 rounded-full transition-all duration-300"
                style={{ width: `${attendanceRate}%` }}
              ></div>
            </div>
            <p className="text-xs text-gray-500 mt-1">{attendanceRate}% attendance rate</p>
          </div>
        </div>

        {/* Overtime Hours */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-3 bg-orange-100 rounded-lg">
              <Clock className="w-6 h-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Today's OT Hours</h3>
              <div className="flex items-baseline">
                <p className="text-2xl font-semibold text-gray-900">{stats.totalOtHours}</p>
                <p className="ml-2 text-sm text-gray-600">hours</p>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <div className="flex justify-between text-sm text-gray-600">
              <span>Full Day: {stats.todayFullDay}</span>
              <span>Half Day: {stats.todayHalfDay}</span>
            </div>
          </div>
        </div>

        {/* Monthly Allowances */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Monthly Allowances</h3>
              <div className="flex items-baseline">
                <p className="text-2xl font-semibold text-gray-900">
                  {formatCurrency(stats.monthlyAllowances)}
                </p>
              </div>
            </div>
          </div>
          <div className="mt-4">
            <p className="text-sm text-gray-600">
              This month's total allowances
            </p>
          </div>
        </div>
      </div>

      {/* Charts and Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Attendance Summary */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Attendance Summary</h3>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-green-500 rounded-full mr-3"></div>
                <span className="text-sm text-gray-600">Full Day Present</span>
              </div>
              <span className="text-sm font-medium text-gray-900">{stats.todayFullDay}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-yellow-500 rounded-full mr-3"></div>
                <span className="text-sm text-gray-600">Half Day Present</span>
              </div>
              <span className="text-sm font-medium text-gray-900">{stats.todayHalfDay}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-red-500 rounded-full mr-3"></div>
                <span className="text-sm text-gray-600">Absent</span>
              </div>
              <span className="text-sm font-medium text-gray-900">{stats.todayAbsent}</span>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <div className="w-3 h-3 bg-gray-400 rounded-full mr-3"></div>
                <span className="text-sm text-gray-600">Not Marked</span>
              </div>
              <span className="text-sm font-medium text-gray-900">
                {stats.totalEmployees - todayAttendance.length}
              </span>
            </div>
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Activity</h3>
          <div className="space-y-4">
            {recentActivities.map((activity, index) => (
              <div key={index} className="flex items-start">
                <div className={`p-2 rounded-full mr-3 ${
                  activity.type === 'attendance' ? 'bg-green-100' :
                  activity.type === 'employee' ? 'bg-blue-100' :
                  activity.type === 'allowance' ? 'bg-purple-100' :
                  'bg-orange-100'
                }`}>
                  {activity.type === 'attendance' && <UserCheck className="w-4 h-4 text-green-600" />}
                  {activity.type === 'employee' && <Users className="w-4 h-4 text-blue-600" />}
                  {activity.type === 'allowance' && <DollarSign className="w-4 h-4 text-purple-600" />}
                  {activity.type === 'report' && <TrendingUp className="w-4 h-4 text-orange-600" />}
                </div>
                <div className="flex-1">
                  <p className="text-sm text-gray-900">{activity.message}</p>
                  <p className="text-xs text-gray-500 mt-1">{activity.time}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Users className="w-8 h-8 text-blue-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-900">Add Employee</p>
          </button>
          <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <Clock className="w-8 h-8 text-green-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-900">Mark Attendance</p>
          </button>
          <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <DollarSign className="w-8 h-8 text-purple-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-900">Add Allowance</p>
          </button>
          <button className="p-4 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors">
            <TrendingUp className="w-8 h-8 text-orange-600 mx-auto mb-2" />
            <p className="text-sm font-medium text-gray-900">Generate Report</p>
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;