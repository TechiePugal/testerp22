import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Search, DollarSign, Calendar } from 'lucide-react';
import { createDocument, updateDocument, deleteDocument, getDocuments, subscribeToCollection } from '../services/firestore';
import { formatDate, formatCurrency } from '../utils/calculations';
import type { Allowance, Employee } from '../types';

const AllowancePage: React.FC = () => {
  const [allowances, setAllowances] = useState<Allowance[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const [editingAllowance, setEditingAllowance] = useState<Allowance | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [allowanceForm, setAllowanceForm] = useState({
    employeeId: '',
    date: new Date().toISOString().split('T')[0],
    type: 'food' as 'food' | 'advance',
    amount: 30
  });

  useEffect(() => {
    loadData();
    
    // Set up real-time listeners
    const unsubscribeAllowances = subscribeToCollection('allowances', setAllowances, 'date');
    const unsubscribeEmployees = subscribeToCollection('employees', setEmployees);

    return () => {
      unsubscribeAllowances();
      unsubscribeEmployees();
    };
  }, []);

  // Auto-set amount based on type
  useEffect(() => {
    if (allowanceForm.type === 'food') {
      setAllowanceForm(prev => ({ ...prev, amount: 30 }));
    } else if (allowanceForm.type === 'advance' && allowanceForm.amount === 30) {
      setAllowanceForm(prev => ({ ...prev, amount: 0 }));
    }
  }, [allowanceForm.type]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [allowancesData, employeesData] = await Promise.all([
        getDocuments('allowances', 'date'),
        getDocuments('employees')
      ]);

      setAllowances(allowancesData);
      setEmployees(employeesData);
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
      const allowanceData = {
        ...allowanceForm,
        date: new Date(allowanceForm.date),
        amount: Number(allowanceForm.amount)
      };

      if (editingAllowance) {
        await updateDocument('allowances', editingAllowance.id, allowanceData);
      } else {
        await createDocument('allowances', allowanceData);
      }

      resetForm();
      setShowForm(false);
    } catch (error) {
      console.error('Error saving allowance:', error);
      alert('Error saving allowance');
    } finally {
      setIsLoading(false);
    }
  };

  const handleEdit = (allowance: Allowance) => {
    setAllowanceForm({
      employeeId: allowance.employeeId,
      date: new Date(allowance.date).toISOString().split('T')[0],
      type: allowance.type,
      amount: allowance.amount
    });
    setEditingAllowance(allowance);
    setShowForm(true);
  };

  const handleDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this allowance record?')) {
      try {
        await deleteDocument('allowances', id);
      } catch (error) {
        console.error('Error deleting allowance:', error);
        alert('Error deleting allowance');
      }
    }
  };

  const resetForm = () => {
    setAllowanceForm({
      employeeId: '',
      date: new Date().toISOString().split('T')[0],
      type: 'food',
      amount: 30
    });
    setEditingAllowance(null);
  };

  const getEmployeeById = (employeeId: string) => {
    return employees.find(emp => emp.id === employeeId);
  };

  const filteredAllowances = allowances.filter(allowance => {
    const employee = getEmployeeById(allowance.employeeId);
    if (!employee) return false;
    
    return employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
           employee.employeeId.toLowerCase().includes(searchTerm.toLowerCase());
  });

  // Calculate statistics
  const stats = {
    totalAllowances: filteredAllowances.length,
    totalAmount: filteredAllowances.reduce((sum, all) => sum + all.amount, 0),
    foodAllowances: filteredAllowances.filter(all => all.type === 'food').length,
    advanceAllowances: filteredAllowances.filter(all => all.type === 'advance').length,
    todayAllowances: filteredAllowances.filter(all => {
      const today = new Date().toDateString();
      return new Date(all.date).toDateString() === today;
    }).length
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Allowance Management</h1>
            <p className="text-gray-600 mt-1">Manage employee allowances and advances</p>
          </div>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-5 h-5" />
            Add Allowance
          </button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center gap-3">
            <DollarSign className="w-8 h-8 text-blue-600" />
            <div>
              <p className="text-sm text-gray-600">Total Records</p>
              <p className="text-xl font-bold text-gray-900">{stats.totalAllowances}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
              <DollarSign className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <p className="text-sm text-gray-600">Total Amount</p>
              <p className="text-xl font-bold text-green-600">{formatCurrency(stats.totalAmount)}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-orange-100 rounded-full flex items-center justify-center">
              <div className="w-4 h-4 bg-orange-600 rounded-full"></div>
            </div>
            <div>
              <p className="text-sm text-gray-600">Food</p>
              <p className="text-xl font-bold text-orange-600">{stats.foodAllowances}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
              <div className="w-4 h-4 bg-purple-600 rounded-full"></div>
            </div>
            <div>
              <p className="text-sm text-gray-600">Advance</p>
              <p className="text-xl font-bold text-purple-600">{stats.advanceAllowances}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm">
          <div className="flex items-center gap-3">
            <Calendar className="w-8 h-8 text-indigo-600" />
            <div>
              <p className="text-sm text-gray-600">Today</p>
              <p className="text-xl font-bold text-indigo-600">{stats.todayAllowances}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="relative">
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

      {/* Allowance Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200">
              <h2 className="text-xl font-bold text-gray-900">
                {editingAllowance ? 'Edit Allowance' : 'Add New Allowance'}
              </h2>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Employee</label>
                <select
                  value={allowanceForm.employeeId}
                  onChange={(e) => setAllowanceForm({ ...allowanceForm, employeeId: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="">Select Employee</option>
                  {employees
                    .filter(emp => emp.isActive)
                    .map(employee => (
                      <option key={employee.id} value={employee.id}>
                        {employee.name} ({employee.employeeId})
                      </option>
                    ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  value={allowanceForm.date}
                  onChange={(e) => setAllowanceForm({ ...allowanceForm, date: e.target.value })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                <select
                  value={allowanceForm.type}
                  onChange={(e) => setAllowanceForm({ ...allowanceForm, type: e.target.value as any })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                >
                  <option value="food">Food Allowance</option>
                  <option value="advance">Advance Payment</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount
                  {allowanceForm.type === 'food' && (
                    <span className="text-xs text-blue-600 ml-1">(Auto ₹30)</span>
                  )}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={allowanceForm.amount}
                  onChange={(e) => setAllowanceForm({ ...allowanceForm, amount: Number(e.target.value) })}
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  required
                  readOnly={allowanceForm.type === 'food'}
                />
                {allowanceForm.type === 'food' && (
                  <p className="text-xs text-gray-500 mt-1">Food allowance is fixed at ₹30</p>
                )}
              </div>

              {/* Form Actions */}
              <div className="flex justify-end gap-4 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => {
                    setShowForm(false);
                    resetForm();
                  }}
                  className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isLoading ? 'Saving...' : editingAllowance ? 'Update' : 'Add'} Allowance
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Allowance List */}
      <div className="bg-white rounded-lg shadow-sm overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">
            Allowance Records ({filteredAllowances.length})
          </h3>
        </div>
        
        {isLoading ? (
          <div className="p-8 text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
            <p className="text-gray-600 mt-2">Loading allowances...</p>
          </div>
        ) : filteredAllowances.length === 0 ? (
          <div className="p-8 text-center text-gray-500">
            <DollarSign className="w-12 h-12 mx-auto mb-4 opacity-50" />
            <p>No allowance records found.</p>
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredAllowances.map((allowance) => {
                  const employee = getEmployeeById(allowance.employeeId);
                  
                  return (
                    <tr key={allowance.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-10 w-10">
                            <div className="h-10 w-10 rounded-full bg-blue-100 flex items-center justify-center">
                              <DollarSign className="h-5 w-5 text-blue-600" />
                            </div>
                          </div>
                          <div className="ml-4">
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
                            {formatDate(new Date(allowance.date))}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                          allowance.type === 'food' 
                            ? 'bg-orange-100 text-orange-800' 
                            : 'bg-purple-100 text-purple-800'
                        }`}>
                          {allowance.type === 'food' ? 'Food' : 'Advance'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <span className="text-sm font-medium text-gray-900">
                          {formatCurrency(allowance.amount)}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right text-sm font-medium">
                        <div className="flex justify-end gap-2">
                          <button
                            onClick={() => handleEdit(allowance)}
                            className="text-blue-600 hover:text-blue-900 p-1 rounded"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleDelete(allowance.id)}
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

export default AllowancePage;