import React, { useState, useEffect } from 'react';
import {
  Plus, Edit2, Trash2, Search, DollarSign, Calendar,
} from 'lucide-react';
import * as XLSX from 'xlsx';
import {
  createDocument,
  updateDocument,
  deleteDocument,
  getDocuments,
  subscribeToCollection,
} from '../services/firestore';
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
    amount: 30,
  });

  useEffect(() => {
    loadData();
    const unsubscribeAllowances = subscribeToCollection('allowances', setAllowances, 'date');
    const unsubscribeEmployees = subscribeToCollection('employees', setEmployees);
    return () => {
      unsubscribeAllowances();
      unsubscribeEmployees();
    };
  }, []);

  useEffect(() => {
    if (allowanceForm.type === 'food') {
      setAllowanceForm((prev) => ({ ...prev, amount: 30 }));
    } else if (allowanceForm.type === 'advance' && allowanceForm.amount === 30) {
      setAllowanceForm((prev) => ({ ...prev, amount: 0 }));
    }
  }, [allowanceForm.type]);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [allowancesData, employeesData] = await Promise.all([
        getDocuments('allowances', 'date'),
        getDocuments('employees'),
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
        amount: Number(allowanceForm.amount),
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
      amount: allowance.amount,
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
      amount: 30,
    });
    setEditingAllowance(null);
  };

  const getEmployeeById = (employeeId: string) => {
    return employees.find((emp) => emp.id === employeeId);
  };

  const filteredAllowances = allowances.filter((allowance) => {
    const employee = getEmployeeById(allowance.employeeId);
    if (!employee) return false;
    return (
      employee.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      employee.employeeId.toLowerCase().includes(searchTerm.toLowerCase())
    );
  });

  const stats = {
    totalAllowances: filteredAllowances.length,
    totalAmount: filteredAllowances.reduce((sum, all) => sum + all.amount, 0),
    foodAllowances: filteredAllowances.filter((all) => all.type === 'food').length,
    advanceAllowances: filteredAllowances.filter((all) => all.type === 'advance').length,
    todayAllowances: filteredAllowances.filter((all) => {
      const today = new Date().toDateString();
      return new Date(all.date).toDateString() === today;
    }).length,
  };

  const exportMonthlyData = () => {
    const groupedByMonth: Record<string, Allowance[]> = {};

    filteredAllowances.forEach((allowance) => {
      const monthKey = new Date(allowance.date).toLocaleString('default', {
        year: 'numeric',
        month: 'long',
      });

      if (!groupedByMonth[monthKey]) {
        groupedByMonth[monthKey] = [];
      }
      groupedByMonth[monthKey].push(allowance);
    });

    const workbook = XLSX.utils.book_new();

    Object.entries(groupedByMonth).forEach(([month, records]) => {
      const data = records.map((rec) => {
        const employee = getEmployeeById(rec.employeeId);
        return {
          'Employee Name': employee?.name || 'Unknown',
          'Employee ID': employee?.employeeId || '',
          Date: formatDate(new Date(rec.date)),
          Type: rec.type === 'food' ? 'Food' : 'Advance',
          Amount: rec.amount,
        };
      });

      // Summary
      data.push({});
      data.push({
        'Employee Name': 'Total Records',
        'Employee ID': records.length,
        Amount: records.reduce((sum, rec) => sum + rec.amount, 0),
      });

      const sheet = XLSX.utils.json_to_sheet(data);
      XLSX.utils.book_append_sheet(workbook, sheet, month);
    });

    XLSX.writeFile(workbook, 'Allowance_Report.xlsx');
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
          <div className="flex gap-2">
            <button
              onClick={exportMonthlyData}
              className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
            >
              Export Monthly Excel
            </button>
            <button
              onClick={() => setShowForm(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-5 h-5" />
              Add Allowance
            </button>
          </div>
        </div>
      </div>

      {/* Continue with statistics cards, form modal, allowance table... */}
      {/* Keep the rest of your code below unchanged... */}
    </div>
  );
};

export default AllowancePage;
