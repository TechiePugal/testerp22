import React, { useState, useEffect } from 'react';
import { Calendar, Search, Filter, Users, Clock, Download, RefreshCw, Calculator, X } from 'lucide-react';
import { getAttendanceByDate, getDocuments } from '../services/firestore';
import { formatDate, formatTime, calculateAttendanceDuration } from '../utils/calculations';
import type { Attendance, Employee, Shift, Company, Unit, Group } from '../types';

const DailyAttendance: React.FC = () => {
  const [selectedFromDate, setSelectedFromDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [selectedToDate, setSelectedToDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [showDateRangeModal, setShowDateRangeModal] = useState(false);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
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
    if (selectedFromDate && selectedToDate) {
      loadAttendanceRange();
    }
  }, [selectedFromDate, selectedToDate]);

  const handleUpToTodayClick = () => {
    const today = new Date().toISOString().split('T')[0];
    const firstDayOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0];
    
    setSelectedFromDate(firstDayOfMonth);
    setSelectedToDate(today);
    setShowDateRangeModal(true);
  };

  const loadMasterData = async () => {
    try {
      const [employeesData, shiftsData, companiesData, unitsData, groupsData] = await Promise.all([
        getDocuments('employees'),
        getDocuments('shifts'),
        getDocuments('companies'),
        getDocuments('units'),
        getDocuments('groups')
      ]);
      
      setEmployees(employeesData);
      setShifts(shiftsData);
      setCompanies(companiesData);
      setUnits(unitsData);
      setGroups(groupsData);
    } catch (error) {
      console.error('Error loading master data:', error);
    }
  };

  const loadAttendanceRange = async () => {
    setIsLoading(true);
    try {
      const attendanceData = [];
      const fromDate = new Date(selectedFromDate);
      const toDate = new Date(selectedToDate);
      
      // Load attendance for each day in the range
      for (let d = new Date(fromDate); d <= toDate; d.setDate(d.getDate() + 1)) {
        const dailyAttendance = await getAttendanceByDate(new Date(d));
        attendanceData.push(...dailyAttendance);
      }
      
      setAttendance(attendanceData);
    } catch (error) {
      console.error('Error loading attendance:', error);
    } finally {
      setIsLoading(false);
    }
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

  const filteredAttendance = attendance.filter(att => {
    const employee = getEmployeeById(att.employeeId);
    if (!employee) return false;

    const company = getCompanyById(employee.companyId);
    const unit = getUnitById(employee.unitId);
    const group = getGroupById(employee.groupId);
    const shift = getShiftById(att.shiftId);
    
    const matchesSearch = 
      employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.employeeId.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.designation.toLowerCase().includes(searchTerm.toLowerCase());
    
    const status = getAttendanceStatus(att.fnStatus, att.anStatus);
    const matchesStatus = statusFilter === 'all' || 
      (statusFilter === 'present' && status !== 'Absent') ||
      (statusFilter === 'absent' && status === 'Absent');
    
    const matchesEmployeeType = employeeTypeFilter === 'all' || 
      employee.employeeType === employeeTypeFilter;
    
    const matchesCompany = !companyFilter || employee.companyId === companyFilter;
    const matchesUnit = !unitFilter || employee.unitId === unitFilter;
    const matchesGroup = !groupFilter || employee.groupId === groupFilter;
    const matchesShift = !shiftFilter || att.shiftId === shiftFilter;

    return matchesSearch && matchesStatus && matchesEmployeeType && 
           matchesCompany && matchesUnit && matchesGroup && matchesShift;
  });

const exportToCSV = () => {
  // Group attendance by employee
  const employeeAttendanceMap = new Map();
  
  filteredAttendance.forEach(att => {
    const employee = getEmployeeById(att.employeeId);
    if (!employee) return;
    
    const attendanceDate = att.date instanceof Date ? att.date : new Date(att.date);
    const dateStr = attendanceDate.toISOString().split('T')[0];
    
    if (!employeeAttendanceMap.has(employee.id)) {
      employeeAttendanceMap.set(employee.id, {
        employee,
        attendanceByDate: new Map()
      });
    }
    
    employeeAttendanceMap.get(employee.id).attendanceByDate.set(dateStr, att);
  });
  
  // Get all unique dates and sort them
  const allDates = new Set();
  employeeAttendanceMap.forEach(data => {
    data.attendanceByDate.forEach((_, date) => {
      allDates.add(date);
    });
  });
  const sortedDates = Array.from(allDates).sort();
  
  // Create headers
  const headers = ['Name', 'Roll No'];
  const subHeaders = ['', ''];
  
  // Add date columns
  sortedDates.forEach(date => {
    const formattedDate = formatDate(new Date(date));
    headers.push(formattedDate, '', '', '');
    subHeaders.push('FN Status', 'AN Status', 'Overall Status', 'OT Hours');
  });
  
  // Sort employees by name
  const sortedEmployees = Array.from(employeeAttendanceMap.values()).sort((a, b) => 
    a.employee.name.localeCompare(b.employee.name)
  );
  
  const csvData = sortedEmployees.map(data => {
    const { employee, attendanceByDate } = data;
    const row = [employee.name, employee.employeeId];
    
    // Add data for each date
    sortedDates.forEach(date => {
      const attendance = attendanceByDate.get(date);
      
      if (attendance) {
        const status = getAttendanceStatus(attendance.fnStatus, attendance.anStatus);
        
        // Calculate OT hours
        let otHours = attendance.otHours || 0;
        if (!otHours && attendance.actualStartTime && attendance.actualEndTime) {
          const duration = calculateAttendanceDuration(attendance.actualStartTime, attendance.actualEndTime);
          otHours = duration.otHours;
        }
        
        row.push(
          attendance.fnStatus.toUpperCase(),
          attendance.anStatus.toUpperCase(),
          status,
          otHours.toFixed(1)
        );
      } else {
        // No attendance record for this date
        row.push('ABSENT', 'ABSENT', 'Absent', '0.0');
      }
    });
    
    return row;
  });

  // Create CSV content
  const csvContent = [
    headers,
    subHeaders,
    ...csvData
  ]
    .map(row => row.map(cell => `"${cell}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = window.URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `attendance-report-${selectedFromDate}-to-${selectedToDate}.csv`;
  a.click();
  window.URL.revokeObjectURL(url);
};

  const stats = {
    total: filteredAttendance.length,
    present: filteredAttendance.filter(att => 
      getAttendanceStatus(att.fnStatus, att.anStatus) !== 'Absent'
    ).length,
    fullDay: filteredAttendance.filter(att => 
      getAttendanceStatus(att.fnStatus, att.anStatus) === 'Full Day'
    ).length,
    halfDay: filteredAttendance.filter(att => 
      getAttendanceStatus(att.fnStatus, att.anStatus) === 'Half Day'
    ).length,
    absent: filteredAttendance.filter(att => 
      getAttendanceStatus(att.fnStatus, att.anStatus) === 'Absent'
    ).length,
    totalOtHours: filteredAttendance.reduce((sum, att) => {
      if (att.otHours) return sum + att.otHours;
      if (att.actualStartTime && att.actualEndTime) {
        const duration = calculateAttendanceDuration(att.actualStartTime, att.actualEndTime);
        return sum + duration.otHours;
      }
      return sum;
    }, 0)
  };

  return (
    <div className="space-y-6">
      {/* Date Range Modal */}
      {showDateRangeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-md mx-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Select Date Range</h3>
              <button
                onClick={() => setShowDateRangeModal(false)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  From Date
                </label>
                <input
                  type="date"
                  value={selectedFromDate}
                  onChange={(e) => setSelectedFromDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  To Date
                </label>
                <input
                  type="date"
                  value={selectedToDate}
                  onChange={(e) => setSelectedToDate(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowDateRangeModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  setShowDateRangeModal(false);
                  loadAttendanceRange();
                }}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Apply
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Attendance Report</h1>
            <p className="text-gray-600 mt-1">
              View and export attendance records from {formatDate(new Date(selectedFromDate))} to {formatDate(new Date(selectedToDate))}
            </p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleUpToTodayClick}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              <Calendar className="w-4 h-4" />
              Up to Today
            </button>
            
            <button
              onClick={loadAttendanceRange}
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

      {/* Date Range Display */}
      <div className="bg-white rounded-lg shadow-sm p-4">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex items-center gap-2">
            <Calendar className="w-5 h-5 text-gray-500" />
            <span className="text-sm font-medium text-gray-700">Date Range:</span>
          </div>
          <div className="flex items-center gap-2">
            <input
              type="date"
              value={selectedFromDate}
              onChange={(e) => setSelectedFromDate(e.target.value)}
              className="px-3 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
            <span className="text-gray-500">to</span>
            <input
              type="date"
              value={selectedToDate}
              onChange={(e) => setSelectedToDate(e.target.value)}
              className="px-3 py-1 text-sm border border-gray-300 rounded focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-6 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center gap-3">
            <Users className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">Total</p>
              <p className="text-xl font-bold text-gray-900">{stats.total}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center gap-3">
            <Clock className="w-8 h-8 text-green-600" />
            <div>
              <p className="text-sm text-gray-600">Present</p>
              <p className="text-xl font-bold text-green-600">{stats.present}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <div className="w-4 h-4 bg-green-600 rounded-full"></div>
            </div>
            <div>
              <p className="text-sm text-gray-600">Full Day</p>
              <p className="text-xl font-bold text-green-600">{stats.fullDay}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-yellow-100 rounded-full flex items-center justify-center">
              <div className="w-4 h-4 bg-yellow-600 rounded-full"></div>
            </div>
            <div>
              <p className="text-sm text-gray-600">Half Day</p>
              <p className="text-xl font-bold text-yellow-600">{stats.halfDay}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center">
              <div className="w-4 h-4 bg-red-600 rounded-full"></div>
            </div>
            <div>
              <p className="text-sm text-gray-600">Absent</p>
              <p className="text-xl font-bold text-red-600">{stats.absent}</p>
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
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center gap-2 mb-4">
          <Filter className="w-5 h-5 text-gray-500" />
          <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7 gap-4">
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
          
          {/* Status Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="all">All Status</option>
              <option value="present">Present</option>
              <option value="absent">Absent</option>
            </select>
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
          
          {/* Shift Filter */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Shift</label>
            <select
              value={shiftFilter}
              onChange={(e) => setShiftFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">All Shifts</option>
              {shifts.map(shift => (
                <option key={shift.id} value={shift.id}>{shift.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Attendance Records ({formatDate(new Date(selectedFromDate))} - {formatDate(new Date(selectedToDate))})
          </h3>
          <p className="text-sm text-gray-600 mt-1">
            Showing {filteredAttendance.length} of {attendance.length} records
          </p>
        </div>
        
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading attendance...</p>
          </div>
        ) : filteredAttendance.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No attendance records found for the selected date range and filters.</p>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Shift
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    FN
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    AN
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Duration
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    OT Hours
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAttendance.map((att) => {
                  const employee = getEmployeeById(att.employeeId);
                  const company = getCompanyById(employee?.companyId || '');
                  const unit = getUnitById(employee?.unitId || '');
                  const shift = getShiftById(att.shiftId);
                  const status = getAttendanceStatus(att.fnStatus, att.anStatus);
                  
                  // Calculate duration if times are available
                  const duration = att.actualStartTime && att.actualEndTime 
                    ? calculateAttendanceDuration(att.actualStartTime, att.actualEndTime)
                    : null;
                  
                  const attendanceDate = att.date instanceof Date ? att.date : new Date(att.date);
                  
                  return (
                    <tr key={att.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div>
                          <div className="text-sm font-medium text-gray-900">
                            {employee?.name}
                          </div>
                          <div className="text-sm text-gray-500">
                            ID: {employee?.employeeId}
                          </div>
                          <div className="text-xs text-gray-400">
                            {employee?.designation}
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          employee?.employeeType === 'staff' 
                            ? 'bg-blue-100 text-blue-800' 
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {employee?.employeeType}
                        </span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{company?.name}</div>
                        <div className="text-sm text-gray-500">{unit?.name}</div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">
                          {formatDate(attendanceDate)}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="text-sm text-gray-900">{shift?.name}</div>
                        <div className="text-xs text-gray-500">
                          {shift && `${formatTime(shift.startTime)} - ${formatTime(shift.endTime)}`}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          att.fnStatus === 'present' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {att.fnStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          att.anStatus === 'present' 
                            ? 'bg-green-100 text-green-800' 
                            : 'bg-red-100 text-red-800'
                        }`}>
                          {att.anStatus}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(status)}`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {duration ? (
                          <div className="text-sm">
                            <div className="text-gray-900 font-medium">{duration.workingDuration}</div>
                            {duration.isOtEligible && (
                              <div className="text-xs text-green-600">+{duration.otDuration} OT</div>
                            )}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">No duration</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-900">
                        <div>
                          {att.otHours || 0}
                          {duration && duration.isOtEligible && !att.otHours && (
                            <div className="text-xs text-green-600">({duration.otHours}h calc)</div>
                          )}
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

export default DailyAttendance;