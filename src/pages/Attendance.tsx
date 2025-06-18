import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, Clock, User, Calendar, Calculator } from 'lucide-react';
import { createDocument, updateDocument, deleteDocument, getDocuments, subscribeToCollection } from '../services/firestore';
import { formatDate, formatTime, calculateAttendanceDuration } from '../utils/calculations';
import type { Attendance, Employee, Shift } from '../types';
import EmployeeSearchDropdown from './EmployeeDropdown';

const AttendancePage: React.FC = () => {
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingAttendance, setEditingAttendance] = useState<Attendance | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

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

  // Real-time duration calculation
  const [calculatedDuration, setCalculatedDuration] = useState({
    workingDuration: '0h 0m',
    otDuration: '0h 0m',
    otHours: 0,
    isOtEligible: false
  });

  useEffect(() => {
    loadData();
    
    // Set up real-time listeners
    const unsubscribeAttendance = subscribeToCollection('attendance', setAttendance, 'date');
    const unsubscribeEmployees = subscribeToCollection('employees', setEmployees);
    const unsubscribeShifts = subscribeToCollection('shifts', setShifts);

    return () => {
      unsubscribeAttendance();
      unsubscribeEmployees();
      unsubscribeShifts();
    };
  }, []);

  // Calculate duration when start/end times change
  useEffect(() => {
    if (attendanceForm.actualStartTime && attendanceForm.actualEndTime) {
      const duration = calculateAttendanceDuration(
        attendanceForm.actualStartTime,
        attendanceForm.actualEndTime
      );
      setCalculatedDuration({
        workingDuration: duration.workingDuration,
        otDuration: duration.otDuration,
        otHours: duration.otHours,
        isOtEligible: duration.isOtEligible
      });
      
      // Auto-update OT hours if calculated
      if (duration.isOtEligible && !attendanceForm.otHours) {
        setAttendanceForm(prev => ({ ...prev, otHours: duration.otHours }));
      }
    } else {
      setCalculatedDuration({
        workingDuration: '0h 0m',
        otDuration: '0h 0m',
        otHours: 0,
        isOtEligible: false
      });
    }
  }, [attendanceForm.actualStartTime, attendanceForm.actualEndTime]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [attendanceData, employeesData, shiftsData] = await Promise.all([
        getDocuments('attendance', 'date'),
        getDocuments('employees'),
        getDocuments('shifts')
      ]);

      setAttendance(attendanceData);
      setEmployees(employeesData);
      setShifts(shiftsData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
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
      otHours: 0,
      isOtEligible: false
    });
  };

  const getEmployeeById = (employeeId: string) => {
    return employees.find(emp => emp.id === employeeId);
  };

  const getShiftById = (shiftId: string) => {
    return shifts.find(shift => shift.id === shiftId);
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

  const filteredAttendance = attendance.filter(att => {
    const employee = getEmployeeById(att.employeeId);
    if (!employee) return false;
    
    return employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           employee.employeeId.toLowerCase().includes(searchTerm.toLowerCase());
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
          Record and manage employee attendance with automatic duration calculation
        </p>
      </div>
      <button
        onClick={() => setShowForm(true)}
        className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
      >
        <Plus className="w-5 h-5" />
        Mark Attendance
      </button>
    </div>
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

  {/* Search */}

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
                  {/* <label className="block text-sm font-medium text-gray-700 mb-2">Employee</label> */}
<EmployeeSearchDropdown
  employees={employees}
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
                    return (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
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
                          <span className="font-medium text-gray-700">Shift:</span>
                          <span className="ml-2 text-gray-900">{shift?.name}</span>
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

              {/* Actual Times for Duration Calculation */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-4">
                  <Calculator className="w-4 h-4 inline mr-2" />
                  Time Tracking & Duration Calculation
                </label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Actual Start Time</label>
                    <input
                      type="time"
                      value={attendanceForm.actualStartTime}
                      onChange={(e) => setAttendanceForm({ ...attendanceForm, actualStartTime: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-600 mb-2">Actual End Time</label>
                    <input
                      type="time"
                      value={attendanceForm.actualEndTime}
                      onChange={(e) => setAttendanceForm({ ...attendanceForm, actualEndTime: e.target.value })}
                      className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                  </div>
                </div>

                {/* Duration Display */}
                {(attendanceForm.actualStartTime && attendanceForm.actualEndTime) && (
                  <div className="mt-4 p-4 bg-blue-50 rounded-lg">
                    <h4 className="text-sm font-semibold text-blue-900 mb-2">Calculated Duration:</h4>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                      <div>
                        <span className="font-medium text-blue-700">Working Hours:</span>
                        <span className="ml-2 text-blue-900">{calculatedDuration.workingDuration}</span>
                        <div className="text-xs text-blue-600">(After 45min lunch deduction)</div>
                      </div>
                      <div>
                        <span className="font-medium text-blue-700">Overtime:</span>
                        <span className={`ml-2 ${calculatedDuration.isOtEligible ? 'text-green-700 font-semibold' : 'text-gray-500'}`}>
                          {calculatedDuration.otDuration}
                        </span>
                        <div className="text-xs text-blue-600">
                          {calculatedDuration.isOtEligible ? '(Eligible for OT)' : '(No OT - need ≥9h working time)'}
                        </div>
                      </div>
                      <div>
                        <span className="font-medium text-blue-700">Standard:</span>
                        <span className="ml-2 text-blue-900">8h 45m</span>
                        <div className="text-xs text-blue-600">(Regular working hours)</div>
                      </div>
                    </div>
                    <div className="mt-2 p-2 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                      <strong>OT Rule:</strong> OT only applies if working time ≥ 9 hours. OT = Working Time - 8h 45m
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

              {/* Additional Details */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    OT Hours
                    {calculatedDuration.isOtEligible && (
                      <span className="text-xs text-green-600 ml-1">
                        (Auto: {calculatedDuration.otHours}h)
                      </span>
                    )}
                  </label>
                  <input
                    type="number"
                    step="0.25"
                    min="0"
                    max="12"
                    value={attendanceForm.otHours}
                    onChange={(e) => setAttendanceForm({ ...attendanceForm, otHours: Number(e.target.value) })}
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder={calculatedDuration.otHours}
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Manual entry overrides calculated OT. Leave empty to use calculated value.
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
                  {/* <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    FN
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    AN
                  </th> */}
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