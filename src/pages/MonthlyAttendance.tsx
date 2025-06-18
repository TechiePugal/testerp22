import React, { useState, useEffect } from 'react';
import { Calendar, Search, Filter, Users, Clock, Download, RefreshCw, Calculator, ChevronLeft, ChevronRight } from 'lucide-react';
import { getAttendanceByMonth, getDocuments } from '../services/firestore';
import { formatDate, formatTime, calculateAttendanceDuration, getWorkingDaysInMonth } from '../utils/calculations';
import type { Attendance, Employee, Shift, Company, Unit, Group, Holiday } from '../types';

const MonthlyAttendance: React.FC = () => {
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  });
  
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'present' | 'absent'>('all');
  const [employeeTypeFilter, setEmployeeTypeFilter] = useState<'all' | 'staff' | 'labour'>('all');
  const [companyFilter, setCompanyFilter] = useState('');
  const [unitFilter, setUnitFilter] = useState('');
  const [groupFilter, setGroupFilter] = useState('');
  const [shiftFilter, setShiftFilter] = useState('');

  useEffect(() => {
    loadMasterData();
  }, []);

  useEffect(() => {
    if (selectedMonth) {
      loadMonthlyAttendance();
    }
  }, [selectedMonth]);

  const loadMasterData = async () => {
    try {
      const [employeesData, shiftsData, companiesData, unitsData, groupsData, holidaysData] = await Promise.all([
        getDocuments('employees'),
        getDocuments('shifts'),
        getDocuments('companies'),
        getDocuments('units'),
        getDocuments('groups'),
        getDocuments('holidays')
      ]);
      
      setEmployees(employeesData);
      setShifts(shiftsData);
      setCompanies(companiesData);
      setUnits(unitsData);
      setGroups(groupsData);
      setHolidays(holidaysData);
    } catch (error) {
      console.error('Error loading master data:', error);
    }
  };

  const loadMonthlyAttendance = async () => {
    setIsLoading(true);
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const attendanceData = await getAttendanceByMonth(year, month - 1);
      setAttendance(attendanceData);
    } catch (error) {
      console.error('Error loading attendance:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const navigateMonth = (direction: 'prev' | 'next') => {
    const [year, month] = selectedMonth.split('-').map(Number);
    const newDate = new Date(year, month - 1);
    
    if (direction === 'next') {
      newDate.setMonth(newDate.getMonth() + 1);
    } else {
      newDate.setMonth(newDate.getMonth() - 1);
    }
    
    const newMonth = `${newDate.getFullYear()}-${String(newDate.getMonth() + 1).padStart(2, '0')}`;
    setSelectedMonth(newMonth);
  };

  const getEmployeeById = (employeeId: string) => {
    return employees.find(emp => emp.id === employeeId);
  };

  const getShiftById = (shiftId: string) => {
    return shifts.find(shift => shift.id === shiftId);
  };

  const getCompanyById = (companyId: string) => {
    return companies.find(company => company.id === companyId);
  };

  const getUnitById = (unitId: string) => {
    return units.find(unit => unit.id === unitId);
  };

  const getGroupById = (groupId: string) => {
    return groups.find(group => group.id === groupId);
  };

  const getAttendanceStatus = (fnStatus: string, anStatus: string) => {
    if (fnStatus === 'present' && anStatus === 'present') return 'Full Day';
    if (fnStatus === 'present' || anStatus === 'present') return 'Half Day';
    return 'Absent';
  };

  const getStatusBadgeColor = (status: string) => {
    switch (status) {
      case 'Full Day': return 'bg-green-100 text-green-800';
      case 'Half Day': return 'bg-yellow-100 text-yellow-800';
      case 'Absent': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  // Group attendance by employee
  const groupedAttendance = employees.reduce((acc, employee) => {
    const employeeAttendance = attendance.filter(att => att.employeeId === employee.id);
    if (employeeAttendance.length > 0) {
      acc[employee.id] = {
        employee,
        attendance: employeeAttendance
      };
    }
    return acc;
  }, {} as Record<string, { employee: Employee; attendance: Attendance[] }>);

  const filteredEmployeeData = Object.values(groupedAttendance).filter(({ employee }) => {
    const company = getCompanyById(employee.companyId);
    const unit = getUnitById(employee.unitId);
    const group = getGroupById(employee.groupId);
    
    const matchesSearch = 
      employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.designation.toLowerCase().includes(searchTerm.toLowerCase());
    
    const matchesEmployeeType = employeeTypeFilter === 'all' || employee.employeeType === employeeTypeFilter;
    const matchesCompany = !companyFilter || employee.companyId === companyFilter;
    const matchesUnit = !unitFilter || employee.unitId === unitFilter;
    const matchesGroup = !groupFilter || employee.groupId === groupFilter;

    return matchesSearch && matchesEmployeeType && matchesCompany && matchesUnit && matchesGroup;
  });

  const exportToCSV = () => {
    const headers = [
      'Employee ID',
      'Employee Name',
      'Employee Type',
      'Company',
      'Unit',
      'Group',
      'Total Days',
      'Present Days',
      'Absent Days',
      'FN Present',
      'AN Present',
      'Total OT Hours',
      'Total Permission Hours',
      'Attendance Rate'
    ];

    const csvData = filteredEmployeeData.map(({ employee, attendance: empAttendance }) => {
      const company = getCompanyById(employee.companyId);
      const unit = getUnitById(employee.unitId);
      const group = getGroupById(employee.groupId);
      
      const totalDays = empAttendance.length;
      const presentDays = empAttendance.filter(att => 
        getAttendanceStatus(att.fnStatus, att.anStatus) !== 'Absent'
      ).length;
      const absentDays = totalDays - presentDays;
      const fnPresent = empAttendance.filter(att => att.fnStatus === 'present').length;
      const anPresent = empAttendance.filter(att => att.anStatus === 'present').length;
      const totalOtHours = empAttendance.reduce((sum, att) => sum + (att.otHours || 0), 0);
      const totalPermissionHours = empAttendance.reduce((sum, att) => sum + (att.permissionHours || 0), 0);
      const attendanceRate = totalDays > 0 ? ((presentDays / totalDays) * 100).toFixed(1) : '0';
      
      return [
        employee.employeeId,
        employee.name,
        employee.employeeType,
        company?.name || '',
        unit?.name || '',
        group?.name || '',
        totalDays,
        presentDays,
        absentDays,
        fnPresent,
        anPresent,
        totalOtHours,
        totalPermissionHours,
        `${attendanceRate}%`
      ];
    });

    const csvContent = [headers, ...csvData]
      .map(row => row.map(cell => `"${cell}"`).join(','))
      .join('\n');

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `monthly-attendance-${selectedMonth}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
  };

  const [year, month] = selectedMonth.split('-').map(Number);
  const workingDays = getWorkingDaysInMonth(year, month - 1, holidays);
  const monthName = new Date(year, month - 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  // Calculate summary statistics
  const stats = {
    totalEmployees: filteredEmployeeData.length,
    totalAttendanceRecords: attendance.length,
    averageAttendanceRate: filteredEmployeeData.length > 0 
      ? filteredEmployeeData.reduce((sum, { attendance: empAttendance }) => {
          const presentDays = empAttendance.filter(att => 
            getAttendanceStatus(att.fnStatus, att.anStatus) !== 'Absent'
          ).length;
          return sum + (empAttendance.length > 0 ? (presentDays / empAttendance.length) * 100 : 0);
        }, 0) / filteredEmployeeData.length
      : 0,
    totalOtHours: attendance.reduce((sum, att) => sum + (att.otHours || 0), 0),
    totalPermissionHours: attendance.reduce((sum, att) => sum + (att.permissionHours || 0), 0)
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Monthly Attendance</h1>
            <p className="text-gray-600 mt-1">View and analyze monthly attendance patterns with comprehensive filtering</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={loadMonthlyAttendance}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            
            <button
              onClick={exportToCSV}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              <Download className="w-4 h-4" />
              Export CSV
            </button>
          </div>
        </div>
      </div>

      {/* Month Navigation */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigateMonth('prev')}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous Month
          </button>
          
          <div className="text-center">
            <h2 className="text-lg font-semibold text-gray-900">{monthName}</h2>
            <p className="text-sm text-gray-600">Working Days: {workingDays}</p>
          </div>
          
          <button
            onClick={() => navigateMonth('next')}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Next Month
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Month Selector */}
        <div className="flex justify-center">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-500" />
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">Employees</p>
              <p className="text-xl font-bold text-gray-900">{stats.totalEmployees}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">Avg Attendance</p>
              <p className="text-xl font-bold text-green-600">{stats.averageAttendanceRate.toFixed(1)}%</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center gap-3">
            <Calendar className="w-8 h-8 text-purple-600" />
            <div>
              <p className="text-sm text-gray-600">Records</p>
              <p className="text-xl font-bold text-purple-600">{stats.totalAttendanceRecords}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center gap-3">
            <Calculator className="w-8 h-8 text-orange-600" />
            <div>
              <p className="text-sm text-gray-600">Total OT</p>
              <p className="text-xl font-bold text-orange-600">{stats.totalOtHours.toFixed(1)}h</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-indigo-600" />
            <div>
              <p className="text-sm text-gray-600">Permission</p>
              <p className="text-xl font-bold text-indigo-600">{stats.totalPermissionHours.toFixed(1)}h</p>
            </div>
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-500" />
          <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6 gap-4">
          {/* Search */}
          <div className="col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-1">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="Search by name, ID, or designation..."
                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>
          
          {/* Employee Type Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
            <select
              value={employeeTypeFilter}
              onChange={(e) => setEmployeeTypeFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Types</option>
              <option value="staff">Staff</option>
              <option value="labour">Labour</option>
            </select>
          </div>
          
          {/* Company Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Company</label>
            <select
              value={companyFilter}
              onChange={(e) => setCompanyFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Companies</option>
              {companies.map(company => (
                <option key={company.id} value={company.id}>{company.name}</option>
              ))}
            </select>
          </div>
          
          {/* Unit Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Unit</label>
            <select
              value={unitFilter}
              onChange={(e) => setUnitFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Units</option>
              {units
                .filter(unit => !companyFilter || unit.companyId === companyFilter)
                .map(unit => (
                  <option key={unit.id} value={unit.id}>{unit.name}</option>
                ))}
            </select>
          </div>
          
          {/* Group Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Group</label>
            <select
              value={groupFilter}
              onChange={(e) => setGroupFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Groups</option>
              {groups
                .filter(group => !unitFilter || group.unitId === unitFilter)
                .map(group => (
                  <option key={group.id} value={group.id}>{group.name}</option>
                ))}
            </select>
          </div>
        </div>
      </div>

      {/* Monthly Attendance Summary Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Monthly Attendance Summary for {monthName}
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Showing {filteredEmployeeData.length} employees with attendance records
          </p>
        </div>
        
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading monthly attendance...</p>
          </div>
        ) : filteredEmployeeData.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No attendance records found for the selected month and filters.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Employee
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Company/Unit
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total Days
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-green-600 uppercase tracking-wider">
                    Present Days
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-red-600 uppercase tracking-wider">
                    Absent Days
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-blue-600 uppercase tracking-wider">
                    FN Present
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-purple-600 uppercase tracking-wider">
                    AN Present
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-orange-600 uppercase tracking-wider">
                    OT Hours
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-indigo-600 uppercase tracking-wider">
                    Permission
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Attendance Rate
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredEmployeeData.map(({ employee, attendance: empAttendance }) => {
                  const company = getCompanyById(employee.companyId);
                  const unit = getUnitById(employee.unitId);
                  
                  const totalDays = empAttendance.length;
                  const presentDays = empAttendance.filter(att => 
                    getAttendanceStatus(att.fnStatus, att.anStatus) !== 'Absent'
                  ).length;
                  const absentDays = totalDays - presentDays;
                  const fnPresent = empAttendance.filter(att => att.fnStatus === 'present').length;
                  const anPresent = empAttendance.filter(att => att.anStatus === 'present').length;
                  const totalOtHours = empAttendance.reduce((sum, att) => sum + (att.otHours || 0), 0);
                  const totalPermissionHours = empAttendance.reduce((sum, att) => sum + (att.permissionHours || 0), 0);
                  const attendanceRate = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;
                  
                  return (
                    <tr key={employee.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {employee.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: {employee.employeeId}
                          </div>
                          <div className="text-xs text-gray-400">
                            {employee.designation}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          employee.employeeType === 'staff' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {employee.employeeType}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{company?.name}</div>
                        <div className="text-sm text-gray-500">{unit?.name}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-medium text-gray-900">{totalDays}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-medium text-green-600">{presentDays}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-medium text-red-600">{absentDays}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-medium text-blue-600">{fnPresent}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-medium text-purple-600">{anPresent}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-medium text-orange-600">{totalOtHours.toFixed(1)}</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm font-medium text-indigo-600">{totalPermissionHours.toFixed(1)}h</span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center">
                          <div className={`w-16 h-2 rounded-full mr-2 ${
                            attendanceRate >= 90 ? 'bg-green-200' :
                            attendanceRate >= 75 ? 'bg-yellow-200' : 'bg-red-200'
                          }`}>
                            <div 
                              className={`h-2 rounded-full ${
                                attendanceRate >= 90 ? 'bg-green-500' :
                                attendanceRate >= 75 ? 'bg-yellow-500' : 'bg-red-500'
                              }`}
                              style={{ width: `${Math.min(attendanceRate, 100)}%` }}
                            ></div>
                          </div>
                          <span className={`text-sm font-medium ${
                            attendanceRate >= 90 ? 'text-green-600' :
                            attendanceRate >= 75 ? 'text-yellow-600' : 'text-red-600'
                          }`}>
                            {attendanceRate.toFixed(1)}%
                          </span>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default MonthlyAttendance;