import React, { useState, useEffect } from 'react';
import { Download, Calendar, Filter, TrendingUp, Users, DollarSign } from 'lucide-react';
import { getDocuments, getAttendanceByDateRange, getAllowancesByDateRange } from '../services/firestore';
import { calculateSalary, formatCurrency, getWorkingDaysInMonth } from '../utils/calculations';
import type { Employee, Attendance, Allowance, Holiday, SalaryReport } from '../types';

const Reports: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [allowances, setAllowances] = useState<Allowance[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [salaryReports, setSalaryReports] = useState<SalaryReport[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [employeeTypeFilter, setEmployeeTypeFilter] = useState<'all' | 'staff' | 'labour'>('all');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    if (selectedMonth) {
      generateSalaryReports();
    }
  }, [selectedMonth, employees, attendance, allowances, holidays, employeeTypeFilter]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [employeesData, holidaysData] = await Promise.all([
        getDocuments('employees'),
        getDocuments('holidays')
      ]);

      setEmployees(employeesData);
      setHolidays(holidaysData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const generateSalaryReports = async () => {
    if (!selectedMonth) return;

    setIsLoading(true);
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const startDate = new Date(year, month - 1, 1);
      const endDate = new Date(year, month, 0);

      const [attendanceData, allowancesData] = await Promise.all([
        getAttendanceByDateRange(startDate, endDate),
        getAllowancesByDateRange(startDate, endDate)
      ]);

      setAttendance(attendanceData);
      setAllowances(allowancesData);

      // Filter employees based on type filter
      const filteredEmployees = employees.filter(emp => 
        emp.isActive && (employeeTypeFilter === 'all' || emp.employeeType === employeeTypeFilter)
      );

      const reports = filteredEmployees.map(employee => 
        calculateSalary(employee, attendanceData, allowancesData, holidays, year, month - 1)
      );

      setSalaryReports(reports);
    } catch (error) {
      console.error('Error generating salary reports:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const exportToCSV = () => {
    const headers = [
      'Employee ID',
      'Employee Name',
      'Employee Type',
      'Working Days',
      'FN Present',
      'AN Present',
      'Total Sessions',
      'FN Salary (₹)',
      'AN Salary (₹)',
      'Basic Salary (₹)',
      'OT Hours',
      'OT Amount (₹)',
      'Allowances Deducted (₹)',
      'Permission Hours',
      'Excess Permission Deduction (₹)',
      'ESA/PF Deduction (₹)',
      'Net Salary (₹)'
    ];

    const csvData = salaryReports.map(report => [
      report.employee.employeeId,
      report.employee.name,
      report.employee.employeeType,
      report.totalWorkingDays,
      report.fnPresentDays,
      report.anPresentDays,
      report.totalPresentSessions,
      report.fnSalary.toFixed(2),
      report.anSalary.toFixed(2),
      report.basicSalary.toFixed(2),
      report.otHours,
      report.otAmount.toFixed(2),
      report.totalAllowances.toFixed(2),
      report.permissionHours,
      report.excessPermissionDeduction.toFixed(2),
      report.esaPfDeduction.toFixed(2),
      report.netSalary.toFixed(2)
    ]);

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `salary-report-${selectedMonth}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  // Calculate summary statistics
  const summary = {
    totalEmployees: salaryReports.length,
    totalBasicSalary: salaryReports.reduce((sum, report) => sum + report.basicSalary, 0),
    totalOtAmount: salaryReports.reduce((sum, report) => sum + report.otAmount, 0),
    totalAllowances: salaryReports.reduce((sum, report) => sum + report.totalAllowances, 0),
    totalDeductions: salaryReports.reduce((sum, report) => 
      sum + report.excessPermissionDeduction + report.esaPfDeduction, 0),
    totalNetSalary: salaryReports.reduce((sum, report) => sum + report.netSalary, 0),
    averageAttendance: salaryReports.length > 0 
      ? (salaryReports.reduce((sum, report) => sum + report.totalPresentSessions, 0) / 
         salaryReports.reduce((sum, report) => sum + (report.totalWorkingDays * 2), 0)) * 100
      : 0
  };

  const [year, month] = selectedMonth ? selectedMonth.split('-').map(Number) : [0, 0];
  const workingDays = year && month ? getWorkingDaysInMonth(year, month - 1, holidays) : 0;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Salary Reports</h1>
            <p className="text-gray-600 mt-1">Generate and export monthly salary reports</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={exportToCSV}
              disabled={salaryReports.length === 0}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-500" />
          <h3 className="text-lg font-semibold text-gray-900">Report Filters</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Month & Year</label>
            <div className="relative">
              <Calendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Employee Type</label>
            <select
              value={employeeTypeFilter}
              onChange={(e) => setEmployeeTypeFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="staff">Staff Only</option>
              <option value="labour">Labour Only</option>
            </select>
          </div>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center">
            <div className="p-3 bg-blue-100 rounded-lg">
              <Users className="w-6 h-6 text-blue-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Total Employees</h3>
              <p className="text-2xl font-semibold text-gray-900">{summary.totalEmployees}</p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center">
            <div className="p-3 bg-green-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-green-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Total Basic Salary</h3>
              <p className="text-2xl font-semibold text-green-600">
                {formatCurrency(summary.totalBasicSalary)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center">
            <div className="p-3 bg-orange-100 rounded-lg">
              <TrendingUp className="w-6 h-6 text-orange-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Total OT Amount</h3>
              <p className="text-2xl font-semibold text-orange-600">
                {formatCurrency(summary.totalOtAmount)}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm">
          <div className="flex items-center">
            <div className="p-3 bg-purple-100 rounded-lg">
              <DollarSign className="w-6 h-6 text-purple-600" />
            </div>
            <div className="ml-4">
              <h3 className="text-sm font-medium text-gray-500">Net Payable</h3>
              <p className="text-2xl font-semibold text-purple-600">
                {formatCurrency(summary.totalNetSalary)}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Detailed Report */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-gray-900">
                Salary Report for {new Date(year, month - 1).toLocaleDateString('en-US', { 
                  month: 'long', 
                  year: 'numeric' 
                })}
              </h3>
              <p className="text-sm text-gray-600 mt-1">
                Working Days: {workingDays} | Total Sessions: {workingDays * 2} | 
                Average Attendance: {summary.averageAttendance.toFixed(1)}%
              </p>
            </div>
          </div>
          
          {/* Calculation Formula */}
          <div className="mt-4 p-4 bg-blue-50 rounded-lg">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">Salary Calculation Formula:</h4>
            <div className="text-xs text-blue-800 space-y-1">
              <p><strong>Basic Salary:</strong> FN Present × (Daily Salary ÷ 2) + AN Present × (Daily Salary ÷ 2)</p>
              <p><strong>OT Amount:</strong> OT Hours × (Daily Salary ÷ 8) × 1.5</p>
              <p><strong>Deductions:</strong> Allowances + Excess Permission (Staff only) + ESA/PF (if applicable)</p>
              <p><strong>Net Salary:</strong> Basic Salary + OT Amount - Total Deductions</p>
            </div>
          </div>
        </div>
        
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Generating salary reports...</p>
          </div>
        ) : salaryReports.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <TrendingUp className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No salary data found for the selected month and filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-green-600 uppercase tracking-wider">
                    FN Present
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-blue-600 uppercase tracking-wider">
                    AN Present
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-green-600 uppercase tracking-wider">
                    FN Salary
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-blue-600 uppercase tracking-wider">
                    AN Salary
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Basic Salary
                  </th>
                  <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    OT Hours
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    OT Amount
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-red-600 uppercase tracking-wider">
                    Allowances
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-red-600 uppercase tracking-wider">
                    Permission
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-red-600 uppercase tracking-wider">
                    ESA/PF
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Net Salary
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {salaryReports.map((report) => (
                  <tr key={report.employee.id} className="hover:bg-gray-50">
                    <td className="px-4 py-4">
                      <div>
                        <div className="text-sm font-medium text-gray-900">
                          {report.employee.name}
                        </div>
                        <div className="text-xs text-gray-500">
                          ID: {report.employee.employeeId}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                        report.employee.employeeType === 'staff' 
                          ? 'bg-blue-100 text-blue-800' 
                          : 'bg-purple-100 text-purple-800'
                      }`}>
                        {report.employee.employeeType}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-sm font-medium text-green-600">
                        {report.fnPresentDays}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-sm font-medium text-blue-600">
                        {report.anPresentDays}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="text-sm text-green-600">
                        {formatCurrency(report.fnSalary)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="text-sm text-blue-600">
                        {formatCurrency(report.anSalary)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="text-sm font-medium text-gray-900">
                        {formatCurrency(report.basicSalary)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-center">
                      <span className="text-sm text-gray-900">
                        {report.otHours}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="text-sm text-gray-900">
                        {formatCurrency(report.otAmount)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="text-sm text-red-600">
                        -{formatCurrency(report.totalAllowances)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="text-sm text-red-600">
                        -{formatCurrency(report.excessPermissionDeduction)}
                      </span>
                      {report.employee.employeeType === 'staff' && report.permissionHours > 0 && (
                        <div className="text-xs text-gray-500">
                          {report.permissionHours}h
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="text-sm text-red-600">
                        -{formatCurrency(report.esaPfDeduction)}
                      </span>
                    </td>
                    <td className="px-4 py-4 text-right">
                      <span className="text-sm font-bold text-gray-900">
                        {formatCurrency(report.netSalary)}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-gray-50">
                <tr>
                  <td colSpan={6} className="px-4 py-4 text-right font-medium text-gray-900">
                    Totals:
                  </td>
                  <td className="px-4 py-4 text-right font-bold text-gray-900">
                    {formatCurrency(summary.totalBasicSalary)}
                  </td>
                  <td className="px-4 py-4"></td>
                  <td className="px-4 py-4 text-right font-bold text-gray-900">
                    {formatCurrency(summary.totalOtAmount)}
                  </td>
                  <td className="px-4 py-4 text-right font-bold text-red-600">
                    -{formatCurrency(summary.totalAllowances)}
                  </td>
                  <td className="px-4 py-4 text-right font-bold text-red-600">
                    -{formatCurrency(summary.totalDeductions - summary.totalAllowances)}
                  </td>
                  <td className="px-4 py-4"></td>
                  <td className="px-4 py-4 text-right font-bold text-gray-900">
                    {formatCurrency(summary.totalNetSalary)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default Reports;