import React, { useState, useEffect } from 'react';
import { Calendar, Users, Clock, ChevronLeft, ChevronRight, UserCheck, RotateCcw } from 'lucide-react';
import { createDocument, updateDocument, deleteDocument, getDocuments, getDocumentsWhere } from '../services/firestore';
import { formatDate, formatTime, isWorkingDay } from '../utils/calculations';
import type { Employee, Shift, ShiftAssignment, Holiday } from '../types';

const ShiftAssignmentPage: React.FC = () => {
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  
  // Week navigation
  const [currentWeekStart, setCurrentWeekStart] = useState(() => {
    const today = new Date();
    const monday = new Date(today);
    monday.setDate(today.getDate() - today.getDay() + 1);
    return monday;
  });

  const [selectedEmployees, setSelectedEmployees] = useState<string[]>([]);
  const [selectedShift, setSelectedShift] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  useEffect(() => {
    loadWeekAssignments();
  }, [currentWeekStart]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [employeesData, shiftsData, holidaysData] = await Promise.all([
        getDocuments('employees'),
        getDocuments('shifts'),
        getDocuments('holidays')
      ]);

      // Filter only labour employees for shift assignment
      const labourEmployees = employeesData.filter(emp => 
        emp.employeeType === 'labour' && emp.isActive
      );
      
      // Filter only labour-applicable shifts
      const labourShifts = shiftsData.filter(shift => 
        shift.isActive && (shift.applicableTo === 'labour' || shift.applicableTo === 'both')
      );

      setEmployees(labourEmployees);
      setShifts(labourShifts);
      setHolidays(holidaysData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const loadWeekAssignments = async () => {
    try {
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(currentWeekStart.getDate() + 6);
      
      const assignmentsData = await getDocumentsWhere(
        'shiftAssignments',
        'weekStartDate',
        '>=',
        currentWeekStart
      );
      
      const weekAssignments = assignmentsData.filter(assignment => {
        const assignmentWeekStart = new Date(assignment.weekStartDate);
        return assignmentWeekStart.getTime() === currentWeekStart.getTime();
      });
      
      setAssignments(weekAssignments);
    } catch (error) {
      console.error('Error loading week assignments:', error);
    }
  };

  const getWeekDates = () => {
    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(currentWeekStart);
      date.setDate(currentWeekStart.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const getWorkingDaysInWeek = () => {
    return getWeekDates().filter(date => isWorkingDay(date, holidays));
  };

  const navigateWeek = (direction: 'prev' | 'next') => {
    const newWeekStart = new Date(currentWeekStart);
    newWeekStart.setDate(currentWeekStart.getDate() + (direction === 'next' ? 7 : -7));
    setCurrentWeekStart(newWeekStart);
  };

  const handleBulkAssignment = async () => {
    if (!selectedShift || selectedEmployees.length === 0) {
      alert('Please select employees and a shift');
      return;
    }

    setIsLoading(true);
    try {
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(currentWeekStart.getDate() + 6);

      const assignmentPromises = selectedEmployees.map(employeeId => {
        // Check if assignment already exists
        const existingAssignment = assignments.find(a => a.employeeId === employeeId);
        
        const assignmentData = {
          employeeId,
          shiftId: selectedShift,
          weekStartDate: currentWeekStart,
          weekEndDate: weekEnd
        };

        if (existingAssignment) {
          return updateDocument('shiftAssignments', existingAssignment.id, assignmentData);
        } else {
          return createDocument('shiftAssignments', assignmentData);
        }
      });

      await Promise.all(assignmentPromises);
      await loadWeekAssignments();
      
      setSelectedEmployees([]);
      setSelectedShift('');
      alert('Shift assignments updated successfully!');
    } catch (error) {
      console.error('Error assigning shifts:', error);
      alert('Error assigning shifts');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAutoRotation = async () => {
    if (employees.length === 0 || shifts.length === 0) {
      alert('No employees or shifts available for rotation');
      return;
    }

    setIsLoading(true);
    try {
      const weekEnd = new Date(currentWeekStart);
      weekEnd.setDate(currentWeekStart.getDate() + 6);

      // Simple rotation logic: assign shifts in round-robin fashion
      const assignmentPromises = employees.map((employee, index) => {
        const shiftIndex = index % shifts.length;
        const assignedShift = shifts[shiftIndex];
        
        const existingAssignment = assignments.find(a => a.employeeId === employee.id);
        
        const assignmentData = {
          employeeId: employee.id,
          shiftId: assignedShift.id,
          weekStartDate: currentWeekStart,
          weekEndDate: weekEnd
        };

        if (existingAssignment) {
          return updateDocument('shiftAssignments', existingAssignment.id, assignmentData);
        } else {
          return createDocument('shiftAssignments', assignmentData);
        }
      });

      await Promise.all(assignmentPromises);
      await loadWeekAssignments();
      
      alert('Auto rotation completed successfully!');
    } catch (error) {
      console.error('Error in auto rotation:', error);
      alert('Error in auto rotation');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRemoveAssignment = async (assignmentId: string) => {
    if (window.confirm('Are you sure you want to remove this shift assignment?')) {
      try {
        await deleteDocument('shiftAssignments', assignmentId);
        await loadWeekAssignments();
      } catch (error) {
        console.error('Error removing assignment:', error);
        alert('Error removing assignment');
      }
    }
  };

  const getEmployeeAssignment = (employeeId: string) => {
    return assignments.find(a => a.employeeId === employeeId);
  };

  const getShiftById = (shiftId: string) => {
    return shifts.find(s => s.id === shiftId);
  };

  const getAssignedEmployeesCount = () => {
    return assignments.length;
  };

  const getUnassignedEmployeesCount = () => {
    return employees.length - assignments.length;
  };

  const weekDates = getWeekDates();
  const workingDays = getWorkingDaysInWeek();

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Shift Assignment</h1>
            <p className="text-gray-600 mt-1">Assign weekly shifts to labour employees</p>
          </div>
          
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={handleAutoRotation}
              disabled={isLoading}
              className="flex items-center gap-2 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50"
            >
              <RotateCcw className="w-4 h-4" />
              Auto Rotation
            </button>
          </div>
        </div>
      </div>

      {/* Week Navigation */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <button
            onClick={() => navigateWeek('prev')}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
            Previous Week
          </button>
          
          <div className="text-center">
            <h2 className="text-lg font-semibold text-gray-900">
              Week of {formatDate(currentWeekStart)}
            </h2>
            <p className="text-sm text-gray-600">
              {formatDate(currentWeekStart)} - {formatDate(weekDates[6])}
            </p>
          </div>
          
          <button
            onClick={() => navigateWeek('next')}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
          >
            Next Week
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        {/* Week Overview */}
        <div className="grid grid-cols-7 gap-2 mb-6">
          {weekDates.map((date, index) => {
            const isWorkingDay = !date.getDay() === 0 && !holidays.some(h => 
              new Date(h.date).toDateString() === date.toDateString()
            );
            
            return (
              <div
                key={index}
                className={`p-3 text-center rounded-lg border ${
                  isWorkingDay 
                    ? 'bg-green-50 border-green-200' 
                    : 'bg-red-50 border-red-200'
                }`}
              >
                <div className="text-xs font-medium text-gray-600">
                  {date.toLocaleDateString('en-US', { weekday: 'short' })}
                </div>
                <div className="text-sm font-semibold text-gray-900">
                  {date.getDate()}
                </div>
                <div className={`text-xs ${
                  isWorkingDay ? 'text-green-600' : 'text-red-600'
                }`}>
                  {isWorkingDay ? 'Working' : 'Off'}
                </div>
              </div>
            );
          })}
        </div>

        {/* Statistics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-blue-600" />
              <div>
                <p className="text-sm text-blue-600">Total Labour</p>
                <p className="text-xl font-bold text-blue-900">{employees.length}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-green-50 p-4 rounded-lg">
            <div className="flex items-center gap-3">
              <UserCheck className="w-8 h-8 text-green-600" />
              <div>
                <p className="text-sm text-green-600">Assigned</p>
                <p className="text-xl font-bold text-green-900">{getAssignedEmployeesCount()}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-orange-50 p-4 rounded-lg">
            <div className="flex items-center gap-3">
              <Users className="w-8 h-8 text-orange-600" />
              <div>
                <p className="text-sm text-orange-600">Unassigned</p>
                <p className="text-xl font-bold text-orange-900">{getUnassignedEmployeesCount()}</p>
              </div>
            </div>
          </div>
          
          <div className="bg-purple-50 p-4 rounded-lg">
            <div className="flex items-center gap-3">
              <Calendar className="w-8 h-8 text-purple-600" />
              <div>
                <p className="text-sm text-purple-600">Working Days</p>
                <p className="text-xl font-bold text-purple-900">{workingDays.length}</p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Bulk Assignment */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Bulk Shift Assignment</h3>
        
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-4">
          <div className="lg:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Employees</label>
            <div className="max-h-40 overflow-y-auto border border-gray-300 rounded-lg p-3">
              <div className="space-y-2">
                <label className="flex items-center">
                  <input
                    type="checkbox"
                    checked={selectedEmployees.length === employees.length}
                    onChange={(e) => {
                      if (e.target.checked) {
                        setSelectedEmployees(employees.map(emp => emp.id));
                      } else {
                        setSelectedEmployees([]);
                      }
                    }}
                    className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="ml-2 text-sm font-medium text-gray-900">Select All</span>
                </label>
                {employees.map(employee => (
                  <label key={employee.id} className="flex items-center">
                    <input
                      type="checkbox"
                      checked={selectedEmployees.includes(employee.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setSelectedEmployees([...selectedEmployees, employee.id]);
                        } else {
                          setSelectedEmployees(selectedEmployees.filter(id => id !== employee.id));
                        }
                      }}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <span className="ml-2 text-sm text-gray-700">
                      {employee.name} ({employee.employeeId})
                    </span>
                  </label>
                ))}
              </div>
            </div>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Select Shift</label>
            <select
              value={selectedShift}
              onChange={(e) => setSelectedShift(e.target.value)}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Choose a shift</option>
              {shifts.map(shift => (
                <option key={shift.id} value={shift.id}>
                  {shift.name} ({formatTime(shift.startTime)} - {formatTime(shift.endTime)})
                </option>
              ))}
            </select>
          </div>
        </div>
        
        <button
          onClick={handleBulkAssignment}
          disabled={isLoading || !selectedShift || selectedEmployees.length === 0}
          className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
        >
          {isLoading ? 'Assigning...' : 'Assign Selected Employees'}
        </button>
      </div>

      {/* Assignment Table */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Current Week Assignments</h3>
          <p className="text-sm text-gray-600 mt-1">
            Showing assignments for {formatDate(currentWeekStart)} - {formatDate(weekDates[6])}
          </p>
        </div>
        
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading assignments...</p>
          </div>
        ) : employees.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <Users className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No labour employees found for shift assignment.</p>
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
                    Assigned Shift
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Shift Timing
                  </th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Working Days
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {employees.map((employee) => {
                  const assignment = getEmployeeAssignment(employee.id);
                  const shift = assignment ? getShiftById(assignment.shiftId) : null;
                  
                  return (
                    <tr key={employee.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-purple-100 flex items-center justify-center">
                              <Users className="h-5 w-5 text-purple-600" />
                            </div>
                          </div>
                          <div className="ml-4">
                            <div className="text-sm font-medium text-gray-900">{employee.name}</div>
                            <div className="text-sm text-gray-500">ID: {employee.employeeId}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {shift ? (
                          <div>
                            <div className="text-sm font-medium text-gray-900">{shift.name}</div>
                            <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                              Assigned
                            </span>
                          </div>
                        ) : (
                          <span className="inline-flex px-2 py-1 text-xs font-semibold rounded-full bg-red-100 text-red-800">
                            Not Assigned
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4">
                        {shift ? (
                          <div className="flex items-center text-sm text-gray-900">
                            <Clock className="w-4 h-4 mr-2 text-gray-400" />
                            {formatTime(shift.startTime)} - {formatTime(shift.endTime)}
                          </div>
                        ) : (
                          <span className="text-sm text-gray-500">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className="text-sm text-gray-900">{workingDays.length} days</span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium">
                        {assignment && (
                          <button
                            onClick={() => handleRemoveAssignment(assignment.id)}
                            className="text-red-600 hover:text-red-900 text-sm"
                          >
                            Remove
                          </button>
                        )}
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

export default ShiftAssignmentPage;