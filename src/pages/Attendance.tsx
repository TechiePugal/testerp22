import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Clock, User, Calendar, Calculator, RefreshCw, Building, Users, Filter } from 'lucide-react';
import { createDocument, updateDocument, deleteDocument, getDocuments, subscribeToCollection } from '../services/firestore';
import { formatDate, formatTime, calculateAttendanceDuration } from '../utils/calculations';
import type { Attendance, Employee, Shift, Company, Unit, Group } from '../types';
import EmployeeSearchDropdown from './EmployeeDropdown';

const AttendancePage: React.FC = () => {
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isRecalculating, setIsRecalculating] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingAttendance, setEditingAttendance] = useState<Attendance | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Filter states
  const [filters, setFilters] = useState({
    companyId: '',
    unitId: '',
    groupId: '',
    startDate: '',
    endDate: ''
  });

  const [attendanceForm, setAttendanceForm] = useState({
    employeeId: '',
    date: new Date().toISOString().split('T')[0],
    shiftId: '',
    fnStatus: 'present' as 'present' | 'absent',
    anStatus: 'present' as 'present' | 'absent',
    otHours: 0,
    permissionHours: 0,
    actualStartTime: '',
    actualEndTime: ''
  });

  // Simplified duration calculation state
  const [calculatedDuration, setCalculatedDuration] = useState({
    workingDuration: '0h 0m',
    otDuration: '0h 0m',
    otHours: 0
  });

  useEffect(() => {
    loadData();
    
    // Set up real-time listeners
    const unsubscribeAttendance = subscribeToCollection('attendance', setAttendance, 'date');
    const unsubscribeEmployees = subscribeToCollection('employees', setEmployees);
    const unsubscribeShifts = subscribeToCollection('shifts', setShifts);
    const unsubscribeCompanies = subscribeToCollection('companies', setCompanies);
    const unsubscribeUnits = subscribeToCollection('units', setUnits);
    const unsubscribeGroups = subscribeToCollection('groups', setGroups);

    return () => {
      unsubscribeAttendance();
      unsubscribeEmployees();
      unsubscribeShifts();
      unsubscribeCompanies();
      unsubscribeUnits();
      unsubscribeGroups();
    };
  }, []);

  // Calculate OT directly when times change
  useEffect(() => {
    if (attendanceForm.actualStartTime && attendanceForm.actualEndTime) {
      const duration = calculateAttendanceDuration(
        attendanceForm.actualStartTime,
        attendanceForm.actualEndTime
      );
      
      setCalculatedDuration({
        workingDuration: duration.workingDuration,
        otDuration: duration.otDuration,
        otHours: duration.otHours
      });
      
      // AUTO-UPDATE OT field with calculated value
      setAttendanceForm(prev => ({ 
        ...prev, 
        otHours: duration.otHours 
      }));
    } else {
      setCalculatedDuration({
        workingDuration: '0h 0m',
        otDuration: '0h 0m',
        otHours: 0
      });
      setAttendanceForm(prev => ({ ...prev, otHours: 0 }));
    }
  }, [attendanceForm.actualStartTime, attendanceForm.actualEndTime]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [attendanceData, employeesData, shiftsData, companiesData, unitsData, groupsData] = await Promise.all([
        getDocuments('attendance', 'date'),
        getDocuments('employees'),
        getDocuments('shifts'),
        getDocuments('companies'),
        getDocuments('units'),
        getDocuments('groups')
      ]);

      setAttendance(attendanceData);
      setEmployees(employeesData);
      setShifts(shiftsData);
      setCompanies(companiesData);
      setUnits(unitsData);
      setGroups(groupsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Batch OT Recalculation Function
  const handleBatchOTRecalculation = async () => {
    if (!window.confirm('This will recalculate OT hours for all attendance records with start/end times. Continue?')) {
      return;
    }

    setIsRecalculating(true);
    let updatedCount = 0;
    let errorCount = 0;

    try {
      // Filter attendance records that have both start and end times
      const recordsToUpdate = attendance.filter(att => 
        att.actualStartTime && att.actualEndTime
      );

      console.log(`Starting batch OT recalculation for ${recordsToUpdate.length} records...`);

      // Process each record
      for (const att of recordsToUpdate) {
        try {
          // Calculate new OT hours
          const duration = calculateAttendanceDuration(
            att.actualStartTime!,
            att.actualEndTime!
          );

          // Only update if OT hours have changed
          if (duration.otHours !== (att.otHours || 0)) {
            await updateDocument('attendance', att.id, {
              ...att,
              otHours: duration.otHours,
              // Add a timestamp to track when this was auto-calculated
              lastOTCalculation: new Date()
            });
            updatedCount++;
            console.log(`Updated record ${att.id}: OT ${att.otHours || 0}h → ${duration.otHours}h`);
          }
        } catch (error) {
          console.error(`Error updating record ${att.id}:`, error);
          errorCount++;
        }
      }

      // Show success message
      if (updatedCount > 0) {
        alert(`✅ Successfully recalculated OT for ${updatedCount} records!${errorCount > 0 ? ` (${errorCount} errors)` : ''}`);
      } else {
        alert('ℹ️ No records needed OT recalculation.');
      }

    } catch (error) {
      console.error('Batch OT recalculation error:', error);
      alert('❌ Error during batch recalculation. Check console for details.');
    } finally {
      setIsRecalculating(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const attendanceData = {
        ...attendanceForm,
        date: new Date(attendanceForm.date),
        otHours: Number(attendanceForm.otHours),
        permissionHours: Number(attendanceForm.permissionHours)
      };

      if (editingAttendance) {
        await updateDocument('attendance', editingAttendance.id, attendanceData);
      } else {
        await createDocument('attendance', attendanceData);
      }

      resetForm();
      setShowForm(false);
    } catch (error) {
      console.error('Error saving attendance:', error);
      alert('Error saving attendance');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (att: Attendance) => {
    setAttendanceForm({
      employeeId: att.employeeId,
      date: new Date(att.date).toISOString().split('T')[0],
      shiftId: att.shiftId,
      fnStatus: att.fnStatus,
      anStatus: att.anStatus,
      otHours: att.otHours || 0,
      permissionHours: att.permissionHours || 0,
      actualStartTime: att.actualStartTime || '',
      actualEndTime: att.actualEndTime || ''
    });
    setEditingAttendance(att);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this attendance record?')) {
      try {
        await deleteDocument('attendance', id);
      } catch (error) {
        console.error('Error deleting attendance:', error);
        alert('Error deleting attendance');
      }
    }
  };

  const resetForm = () => {
    setAttendanceForm({
      employeeId: '',
      date: new Date().toISOString().split('T')[0],
      shiftId: '',
      fnStatus: 'present',
      anStatus: 'present',
      otHours: 0,
      permissionHours: 0,
      actualStartTime: '',
      actualEndTime: ''
    });
    setEditingAttendance(null);
    setCalculatedDuration({
      workingDuration: '0h 0m',
      otDuration: '0h 0m',
      otHours: 0
    });
  };

  const clearFilters = () => {
    setFilters({
      companyId: '',
      unitId: '',
      groupId: '',
      startDate: '',
      endDate: ''
    });
  };

  // Helper functions
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

  // Auto-assign shift when employee is selected
  useEffect(() => {
    if (attendanceForm.employeeId) {
      const employee = getEmployeeById(attendanceForm.employeeId);
      if (employee && employee.shiftId) {
        setAttendanceForm(prev => ({ ...prev, shiftId: employee.shiftId }));
      }
    }
  }, [attendanceForm.employeeId, employees]);

  // Get filtered units based on selected company
  const getFilteredUnits = () => {
    if (!filters.companyId) return units;
    return units.filter(unit => unit.companyId === filters.companyId);
  };

  // Get filtered groups based on selected unit
  const getFilteredGroups = () => {
    if (!filters.unitId) return groups;
    return groups.filter(group => group.unitId === filters.unitId);
  };

  // Get filtered employees based on all filters
  const getFilteredEmployees = () => {
    return employees.filter(emp => {
      if (filters.companyId && emp.companyId !== filters.companyId) return false;
      if (filters.unitId && emp.unitId !== filters.unitId) return false;
      if (filters.groupId && emp.groupId !== filters.groupId) return false;
      return true;
    });
  };

  // Main filtering logic for attendance records
  const filteredAttendance = attendance.filter(att => {
    const employee = getEmployeeById(att.employeeId);
    if (!employee) return false;

    // Text search filter
    const matchesSearch = employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         employee.employeeId.toLowerCase().includes(searchTerm.toLowerCase());
    
    // Company filter
    const matchesCompany = !filters.companyId || employee.companyId === filters.companyId;
    
    // Unit filter
    const matchesUnit = !filters.unitId || employee.unitId === filters.unitId;
    
    // Group filter
    const matchesGroup = !filters.groupId || employee.groupId === filters.groupId;
    
    // Date range filter
    const attDate = new Date(att.date);
    const matchesStartDate = !filters.startDate || attDate >= new Date(filters.startDate);
    const matchesEndDate = !filters.endDate || attDate <= new Date(filters.endDate);
    
    return matchesSearch && matchesCompany && matchesUnit && matchesGroup && matchesStartDate && matchesEndDate;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-white space-y-4 pb-4">
        {/* Header */}
        <div className="bg-gray-200 rounded-lg shadow-sm p-6">
          <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Attendance Management</h1>
              <p className="text-gray-600 mt-1">
                Record and manage employee attendance with automatic OT calculation
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3">
              {/* Batch OT Recalculation Button */}
              <button
                onClick={handleBatchOTRecalculation}
                disabled={isRecalculating || attendance.length === 0}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                title="Recalculate OT hours for all attendance records"
              >
                <RefreshCw className={`w-5 h-5 ${isRecalculating ? 'animate-spin' : ''}`} />
                {isRecalculating ? 'Recalculating...' : 'Recalc OT'}
              </button>
              
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                <Plus className="w-5 h-5" />
                Mark Attendance
              </button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="relative mt-5">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by employee name or ID..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Filters Section */}
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center gap-2 mb-4">
            <Filter className="w-5 h-5 text-gray-600" />
            <h3 className="text-lg font-semibold text-gray-900">Filters</h3>
            <div className="ml-auto">
              <button
                onClick={clearFilters}
                className="text-sm text-blue-600 hover:text-blue-800 underline"
              >
                Clear All Filters
              </button>
            </div>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {/* Company Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Building className="w-4 h-4 inline mr-1" />
                Company
              </label>
              <select
                value={filters.companyId}
                onChange={(e) => setFilters(prev => ({
                  ...prev,
                  companyId: e.target.value,
                  unitId: '', // Reset unit when company changes
                  groupId: '' // Reset group when company changes
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              >
                <option value="">All Companies</option>
                {companies.map(company => (
                  <option key={company.id} value={company.id}>
                    {company.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Unit Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Building className="w-4 h-4 inline mr-1" />
                Unit
              </label>
              <select
                value={filters.unitId}
                onChange={(e) => setFilters(prev => ({
                  ...prev,
                  unitId: e.target.value,
                  groupId: '' // Reset group when unit changes
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                disabled={!filters.companyId}
              >
                <option value="">All Units</option>
                {getFilteredUnits().map(unit => (
                  <option key={unit.id} value={unit.id}>
                    {unit.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Group Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Users className="w-4 h-4 inline mr-1" />
                Group
              </label>
              <select
                value={filters.groupId}
                onChange={(e) => setFilters(prev => ({
                  ...prev,
                  groupId: e.target.value
                }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                disabled={!filters.unitId}
              >
                <option value="">All Groups</option>
                {getFilteredGroups().map(group => (
                  <option key={group.id} value={group.id}>
                    {group.name}
                  </option>
                ))}
              </select>
            </div>

            {/* Start Date Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                Start Date
              </label>
              <input
                type="date"
                value={filters.startDate}
                onChange={(e) => setFilters(prev => ({ ...prev, startDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>

            {/* End Date Filter */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                <Calendar className="w-4 h-4 inline mr-1" />
                End Date
              </label>
              <input
                type="date"
                value={filters.endDate}
                onChange={(e) => setFilters(prev => ({ ...prev, endDate: e.target.value }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
              />
            </div>
          </div>

          {/* Filter Summary */}
          {(filters.companyId || filters.unitId || filters.groupId || filters.startDate || filters.endDate) && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <span className="font-medium text-blue-900">Active Filters:</span>
                {filters.companyId && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                    Company: {getCompanyById(filters.companyId)?.name}
                  </span>
                )}
                {filters.unitId && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                    Unit: {getUnitById(filters.unitId)?.name}
                  </span>
                )}
                {filters.groupId && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                    Group: {getGroupById(filters.groupId)?.name}
                  </span>
                )}
                {filters.startDate && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                    From: {formatDate(new Date(filters.startDate))}
                  </span>
                )}
                {filters.endDate && (
                  <span className="px-2 py-1 bg-blue-100 text-blue-800 rounded-full">
                    To: {formatDate(new Date(filters.endDate))}
                  </span>
                )}
                <span className="text-blue-700">
                  ({filteredAttendance.length} records found)
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Attendance Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {editingAttendance ? 'Edit Attendance' : 'Mark Attendance'}
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Employee and Date */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <EmployeeSearchDropdown
                    employees={getFilteredEmployees()}
                    attendanceForm={attendanceForm}
                    setAttendanceForm={setAttendanceForm}
                    editingAttendance={editingAttendance}
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                  <input
                    type="date"
                    value={attendanceForm.date}
                    onChange={(e) => setAttendanceForm({ ...attendanceForm, date: e.target.value })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                    disabled={!!editingAttendance}
                  />
                </div>
              </div>

              {/* Employee Info Display */}
              {attendanceForm.employeeId && (
                <div className="bg-gray-50 p-4 rounded-lg">
                  {(() => {
                    const employee = getEmployeeById(attendanceForm.employeeId);
                    const shift = getShiftById(employee?.shiftId || '');
                    const company = getCompanyById(employee?.companyId || '');
                    const unit = getUnitById(employee?.unitId || '');
                    const group = getGroupById(employee?.groupId || '');
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 text-sm">
                        <div>
                          <span className="font-medium text-gray-700">Type:</span>
                          <span className={`ml-2 px-2 py-1 text-xs font-semibold rounded-full ${
                            employee?.employeeType === 'staff' 
                              ? 'bg-blue-100 text-blue-800' 
                              : 'bg-purple-100 text-purple-800'
                          }`}>
                            {employee?.employeeType}
                          </span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Company:</span>
                          <span className="ml-2 text-gray-900">{company?.name || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Unit:</span>
                          <span className="ml-2 text-gray-900">{unit?.name || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Group:</span>
                          <span className="ml-2 text-gray-900">{group?.name || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Shift:</span>
                          <span className="ml-2 text-gray-900">{shift?.name || 'N/A'}</span>
                        </div>
                        <div>
                          <span className="font-medium text-gray-700">Timing:</span>
                          <span className="ml-2 text-gray-900">
                            {shift && `${formatTime(shift.startTime)} - ${formatTime(shift.endTime)}`}
                          </span>
                        </div>
                        {employee?.employeeType === 'staff' && (
                          <div className="md:col-span-3">
                            <span className="text-blue-600 text-xs">
                              ℹ️ Staff members get 2 hours free permission per month. Excess will be deducted.
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
                </div>
              )}

              {/* Shift (Auto-filled but editable) */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Shift</label>
                <select
                  value={attendanceForm.shiftId}
                  onChange={(e) => setAttendanceForm({ ...attendanceForm, shiftId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select Shift</option>
                  {shifts
                    .filter(shift => shift.isActive)
                    .map(shift => (
                      <option key={shift.id} value={shift.id}>
                        {shift.name} ({formatTime(shift.startTime)} - {formatTime(shift.endTime)})
                      </option>
                    ))}
                </select>
              </div>

              {/* Time Tracking Section */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-4">
                  <Calculator className="w-4 h-4 inline mr-2" />
                  Time Tracking & OT Calculation
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Start Time</label>
                    <input
                      type="time"
                      value={attendanceForm.actualStartTime}
                      onChange={(e) => setAttendanceForm({ ...attendanceForm, actualStartTime: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">End Time</label>
                    <input
                      type="time"
                      value={attendanceForm.actualEndTime}
                      onChange={(e) => setAttendanceForm({ ...attendanceForm, actualEndTime: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>


                {/* ✅ SIMPLIFIED: Duration Display */}
                {(attendanceForm.actualStartTime && attendanceForm.actualEndTime) && (
                  <div className="mt-4 p-4 bg-green-50 rounded-lg border border-green-200">
                    <h4 className="text-sm font-semibold text-green-900 mb-2">📊 Calculated Duration:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-green-700">Working Time:</span>
                        <span className="ml-2 text-green-900 font-semibold">{calculatedDuration.workingDuration}</span>
                        <div className="text-xs text-green-600">(After 45min lunch break)</div>
                      </div>
                      <div>
                        <span className="font-medium text-green-700">Overtime:</span>
                        <span className="ml-2 text-green-900 font-semibold">{calculatedDuration.otDuration}</span>
                        <div className="text-xs text-green-600">(Anything over 8 hours)</div>
                      </div>
                    </div>
                    <div className="mt-3 p-2 bg-blue-50 border border-blue-200 rounded text-xs text-blue-800">
                      <strong>Simple Rule:</strong> Total Time - 45min lunch = Working Time. Working Time - 8 hours = OT
                    </div>
                  </div>
                )}
              </div>

              {/* Attendance Status */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-4">Attendance Status</label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Forenoon (FN)</label>
                    <div className="flex gap-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="fnStatus"
                          value="present"
                          checked={attendanceForm.fnStatus === 'present'}
                          onChange={(e) => setAttendanceForm({ ...attendanceForm, fnStatus: e.target.value as any })}
                          className="mr-2"
                        />
                        <span className="text-green-600">Present</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="fnStatus"
                          value="absent"
                          checked={attendanceForm.fnStatus === 'absent'}
                          onChange={(e) => setAttendanceForm({ ...attendanceForm, fnStatus: e.target.value as any })}
                          className="mr-2"
                        />
                        <span className="text-red-600">Absent</span>
                      </label>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Afternoon (AN)</label>
                    <div className="flex gap-4">
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="anStatus"
                          value="present"
                          checked={attendanceForm.anStatus === 'present'}
                          onChange={(e) => setAttendanceForm({ ...attendanceForm, anStatus: e.target.value as any })}
                          className="mr-2"
                        />
                        <span className="text-green-600">Present</span>
                      </label>
                      <label className="flex items-center">
                        <input
                          type="radio"
                          name="anStatus"
                          value="absent"
                          checked={attendanceForm.anStatus === 'absent'}
                          onChange={(e) => setAttendanceForm({ ...attendanceForm, anStatus: e.target.value as any })}
                          className="mr-2"
                        />
                        <span className="text-red-600">Absent</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* ✅ SIMPLIFIED: OT Hours & Permission */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    OT Hours
                  </label>
                  <input
                    type="text"
                    value={`Overtime: ${calculatedDuration.otDuration}`}
                    readOnly
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-green-50"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    (Anything over 8 hours)
                  </p>
                </div>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Permission Hours
                    {(() => {
                      const employee = getEmployeeById(attendanceForm.employeeId);
                      return employee?.employeeType === 'staff' ? (
                        <span className="text-xs text-blue-600 ml-1">(2h free/month)</span>
                      ) : null;
                    })()}
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="8"
                    value={attendanceForm.permissionHours}
                    onChange={(e) => setAttendanceForm({ ...attendanceForm, permissionHours: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                </div>
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-4 pt-6 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Saving...' : editingAttendance ? 'Update Attendance' : 'Mark Attendance'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Attendance List */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Attendance Records ({filteredAttendance.length})
          </h3>
        </div>
        
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading attendance...</p>
          </div>
        ) : filteredAttendance.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No attendance records found.</p>
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
                    Date
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Start Time
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    End Time
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
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Permission
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAttendance.map((att) => {
                  const employee = getEmployeeById(att.employeeId);
                  const shift = getShiftById(att.shiftId);
                  const status = getAttendanceStatus(att.fnStatus, att.anStatus);
                  
                  // Calculate duration if times are available
                  const duration = att.actualStartTime && att.actualEndTime 
                    ? calculateAttendanceDuration(att.actualStartTime, att.actualEndTime)
                    : null;
                  
                  
                  return (
                    <tr key={att.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <User className="w-8 h-8 text-gray-400 mr-3" />
                          <div>
                            <div className="text-sm font-medium text-gray-900">
                              {employee?.name}
                            </div>
                            <div className="text-sm text-gray-500">
                              ID: {employee?.employeeId}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <Calendar className="w-4 h-4 text-gray-400 mr-2" />
                          <span className="text-sm text-gray-900">
                            {formatDate(new Date(att.date))}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="text-sm text-gray-900">
                          {att.actualStartTime ? formatTime(att.actualStartTime) : (
                            <span className="text-gray-400">--:--</span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="text-sm text-gray-900">
                          {att.actualEndTime ? formatTime(att.actualEndTime) : (
                            <span className="text-gray-400">--:--</span>
                          )}
                        </div>
                      </td>
                      {/* <td className="px-6 py-4 text-center">
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
                      </td> */}
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusBadgeColor(status)}`}>
                          {status}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        {duration ? (
                          <div className="text-sm">
                            <div className="text-gray-900">{duration.workingDuration}</div>
                            {duration.isOtEligible && (
                              <div className="text-xs text-green-600">+{duration.otDuration} OT</div>
                            )}
                          </div>
                        ) : att.actualStartTime && att.actualEndTime ? (
                          <div className="text-xs text-gray-500">
                            {formatTime(att.actualStartTime)} - {formatTime(att.actualEndTime)}
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">No times</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-900">
                        {att.otHours || 0}
                        {duration && duration.isOtEligible && !att.otHours && (
                          <div className="text-xs text-green-600">({duration.otHours}h calc)</div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center text-sm text-gray-900">
                        {att.permissionHours || 0}h
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEdit(att)}
                            className="text-blue-600 hover:text-blue-900 p-1 rounded"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(att.id)}
                            className="text-red-600 hover:text-red-900 p-1 rounded"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
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

export default AttendancePage;