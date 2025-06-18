import React, { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Building2, MapPin, Users, Clock, Calendar } from 'lucide-react';
import { createDocument, updateDocument, deleteDocument, getDocuments, subscribeToCollection } from '../services/firestore';
import { formatTime } from '../utils/calculations';
import type { Company, Unit, Group, Shift, Holiday } from '../types';

const Master: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'companies' | 'shifts' | 'holidays'>('companies');
  const [companies, setCompanies] = useState<Company[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [groups, setGroups] = useState<Group[]>([]);
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Form states
  const [companyForm, setCompanyForm] = useState({ name: '' });
  const [unitForm, setUnitForm] = useState({ name: '', companyId: '' });
  const [groupForm, setGroupForm] = useState({ name: '', unitId: '', companyId: '' });
  const [shiftForm, setShiftForm] = useState({
    name: '',
    startTime: '',
    endTime: '',
    duration: 8,
    applicableTo: 'both' as 'staff' | 'labour' | 'both',
    isActive: true
  });
  const [holidayForm, setHolidayForm] = useState({
    name: '',
    date: '',
    type: 'company' as 'national' | 'religious' | 'company' | 'other',
    applicableTo: 'both' as 'staff' | 'labour' | 'both',
    isRecurring: false
  });

  const [editingItem, setEditingItem] = useState<any>(null);

  useEffect(() => {
    loadData();
    
    // Set up real-time listeners
    const unsubscribeCompanies = subscribeToCollection('companies', setCompanies);
    const unsubscribeUnits = subscribeToCollection('units', setUnits);
    const unsubscribeGroups = subscribeToCollection('groups', setGroups);
    const unsubscribeShifts = subscribeToCollection('shifts', setShifts);
    const unsubscribeHolidays = subscribeToCollection('holidays', setHolidays);

    return () => {
      unsubscribeCompanies();
      unsubscribeUnits();
      unsubscribeGroups();
      unsubscribeShifts();
      unsubscribeHolidays();
    };
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [companiesData, unitsData, groupsData, shiftsData, holidaysData] = await Promise.all([
        getDocuments('companies'),
        getDocuments('units'),
        getDocuments('groups'),
        getDocuments('shifts'),
        getDocuments('holidays')
      ]);

      setCompanies(companiesData);
      setUnits(unitsData);
      setGroups(groupsData);
      setShifts(shiftsData);
      setHolidays(holidaysData);
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // Company operations
  const handleCompanySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (editingItem) {
        await updateDocument('companies', editingItem.id, companyForm);
      } else {
        await createDocument('companies', companyForm);
      }
      setCompanyForm({ name: '' });
      setEditingItem(null);
    } catch (error) {
      console.error('Error saving company:', error);
      alert('Error saving company');
    } finally {
      setIsLoading(false);
    }
  };

  const handleCompanyEdit = (company: Company) => {
    setCompanyForm({ name: company.name });
    setEditingItem(company);
  };

  const handleCompanyDelete = async (id: string) => {
    if (window.confirm('Are you sure? This will also delete related units and groups.')) {
      try {
        await deleteDocument('companies', id);
        // Also delete related units and groups
        const relatedUnits = units.filter(unit => unit.companyId === id);
        const relatedGroups = groups.filter(group => group.companyId === id);
        
        await Promise.all([
          ...relatedUnits.map(unit => deleteDocument('units', unit.id)),
          ...relatedGroups.map(group => deleteDocument('groups', group.id))
        ]);
      } catch (error) {
        console.error('Error deleting company:', error);
        alert('Error deleting company');
      }
    }
  };

  // Unit operations
  const handleUnitSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (editingItem) {
        await updateDocument('units', editingItem.id, unitForm);
      } else {
        await createDocument('units', unitForm);
      }
      setUnitForm({ name: '', companyId: '' });
      setEditingItem(null);
    } catch (error) {
      console.error('Error saving unit:', error);
      alert('Error saving unit');
    } finally {
      setIsLoading(false);
    }
  };

  const handleUnitEdit = (unit: Unit) => {
    setUnitForm({ name: unit.name, companyId: unit.companyId });
    setEditingItem(unit);
  };

  const handleUnitDelete = async (id: string) => {
    if (window.confirm('Are you sure? This will also delete related groups.')) {
      try {
        await deleteDocument('units', id);
        // Also delete related groups
        const relatedGroups = groups.filter(group => group.unitId === id);
        await Promise.all(relatedGroups.map(group => deleteDocument('groups', group.id)));
      } catch (error) {
        console.error('Error deleting unit:', error);
        alert('Error deleting unit');
      }
    }
  };

  // Group operations
  const handleGroupSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (editingItem) {
        await updateDocument('groups', editingItem.id, groupForm);
      } else {
        await createDocument('groups', groupForm);
      }
      setGroupForm({ name: '', unitId: '', companyId: '' });
      setEditingItem(null);
    } catch (error) {
      console.error('Error saving group:', error);
      alert('Error saving group');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGroupEdit = (group: Group) => {
    setGroupForm({ name: group.name, unitId: group.unitId, companyId: group.companyId });
    setEditingItem(group);
  };

  const handleGroupDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this group?')) {
      try {
        await deleteDocument('groups', id);
      } catch (error) {
        console.error('Error deleting group:', error);
        alert('Error deleting group');
      }
    }
  };

  // Shift operations
  const handleShiftSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (editingItem) {
        await updateDocument('shifts', editingItem.id, shiftForm);
      } else {
        await createDocument('shifts', shiftForm);
      }
      setShiftForm({
        name: '',
        startTime: '',
        endTime: '',
        duration: 8,
        applicableTo: 'both',
        isActive: true
      });
      setEditingItem(null);
    } catch (error) {
      console.error('Error saving shift:', error);
      alert('Error saving shift');
    } finally {
      setIsLoading(false);
    }
  };

  const handleShiftEdit = (shift: Shift) => {
    setShiftForm({
      name: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
      duration: shift.duration,
      applicableTo: shift.applicableTo,
      isActive: shift.isActive
    });
    setEditingItem(shift);
  };

  const handleShiftDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this shift?')) {
      try {
        await deleteDocument('shifts', id);
      } catch (error) {
        console.error('Error deleting shift:', error);
        alert('Error deleting shift');
      }
    }
  };

  // Holiday operations
  const handleHolidaySubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const holidayData = {
        ...holidayForm,
        date: new Date(holidayForm.date)
      };
      
      if (editingItem) {
        await updateDocument('holidays', editingItem.id, holidayData);
      } else {
        await createDocument('holidays', holidayData);
      }
      setHolidayForm({
        name: '',
        date: '',
        type: 'company',
        applicableTo: 'both',
        isRecurring: false
      });
      setEditingItem(null);
    } catch (error) {
      console.error('Error saving holiday:', error);
      alert('Error saving holiday');
    } finally {
      setIsLoading(false);
    }
  };

  const handleHolidayEdit = (holiday: Holiday) => {
    setHolidayForm({
      name: holiday.name,
      date: new Date(holiday.date).toISOString().split('T')[0],
      type: holiday.type,
      applicableTo: holiday.applicableTo,
      isRecurring: holiday.isRecurring
    });
    setEditingItem(holiday);
  };

  const handleHolidayDelete = async (id: string) => {
    if (window.confirm('Are you sure you want to delete this holiday?')) {
      try {
        await deleteDocument('holidays', id);
      } catch (error) {
        console.error('Error deleting holiday:', error);
        alert('Error deleting holiday');
      }
    }
  };

  const cancelEdit = () => {
    setEditingItem(null);
    setCompanyForm({ name: '' });
    setUnitForm({ name: '', companyId: '' });
    setGroupForm({ name: '', unitId: '', companyId: '' });
    setShiftForm({
      name: '',
      startTime: '',
      endTime: '',
      duration: 8,
      applicableTo: 'both',
      isActive: true
    });
    setHolidayForm({
      name: '',
      date: '',
      type: 'company',
      applicableTo: 'both',
      isRecurring: false
    });
  };

  const getCompanyName = (companyId: string) => {
    return companies.find(c => c.id === companyId)?.name || '';
  };

  const getUnitName = (unitId: string) => {
    return units.find(u => u.id === unitId)?.name || '';
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h1 className="text-2xl font-bold text-gray-900">Master Data</h1>
        <p className="text-gray-600 mt-1">Manage companies, shifts, and holidays</p>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm">
        <div className="border-b border-gray-200">
          <nav className="-mb-px flex space-x-8 px-6">
            <button
              onClick={() => setActiveTab('companies')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'companies'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Building2 className="w-4 h-4 inline mr-2" />
              Organization Structure
            </button>
            <button
              onClick={() => setActiveTab('shifts')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'shifts'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Clock className="w-4 h-4 inline mr-2" />
              Shift Master
            </button>
            <button
              onClick={() => setActiveTab('holidays')}
              className={`py-4 px-1 border-b-2 font-medium text-sm ${
                activeTab === 'holidays'
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <Calendar className="w-4 h-4 inline mr-2" />
              Holiday Master
            </button>
          </nav>
        </div>

        <div className="p-6">
          {/* Organization Structure Tab */}
          {activeTab === 'companies' && (
            <div className="space-y-8">
              {/* Companies Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Companies</h3>
                <form onSubmit={handleCompanySubmit} className="mb-6">
                  <div className="flex gap-4">
                    <input
                      type="text"
                      value={companyForm.name}
                      onChange={(e) => setCompanyForm({ name: e.target.value })}
                      placeholder="Company name"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {editingItem ? 'Update' : 'Add'} Company
                    </button>
                    {editingItem && (
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>

                <div className="grid gap-4">
                  {companies.map((company) => (
                    <div key={company.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center">
                        <Building2 className="w-5 h-5 text-gray-400 mr-3" />
                        <span className="font-medium text-gray-900">{company.name}</span>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleCompanyEdit(company)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleCompanyDelete(company.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Units Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Units</h3>
                <form onSubmit={handleUnitSubmit} className="mb-6">
                  <div className="flex gap-4">
                    <select
                      value={unitForm.companyId}
                      onChange={(e) => setUnitForm({ ...unitForm, companyId: e.target.value })}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select Company</option>
                      {companies.map((company) => (
                        <option key={company.id} value={company.id}>{company.name}</option>
                      ))}
                    </select>
                    <input
                      type="text"
                      value={unitForm.name}
                      onChange={(e) => setUnitForm({ ...unitForm, name: e.target.value })}
                      placeholder="Unit name"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {editingItem ? 'Update' : 'Add'} Unit
                    </button>
                    {editingItem && (
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>

                <div className="grid gap-4">
                  {units.map((unit) => (
                    <div key={unit.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center">
                        <MapPin className="w-5 h-5 text-gray-400 mr-3" />
                        <div>
                          <span className="font-medium text-gray-900">{unit.name}</span>
                          <p className="text-sm text-gray-600">{getCompanyName(unit.companyId)}</p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleUnitEdit(unit)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleUnitDelete(unit.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Groups Section */}
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-4">Groups</h3>
                <form onSubmit={handleGroupSubmit} className="mb-6">
                  <div className="flex gap-4">
                    <select
                      value={groupForm.companyId}
                      onChange={(e) => {
                        setGroupForm({ ...groupForm, companyId: e.target.value, unitId: '' });
                      }}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    >
                      <option value="">Select Company</option>
                      {companies.map((company) => (
                        <option key={company.id} value={company.id}>{company.name}</option>
                      ))}
                    </select>
                    <select
                      value={groupForm.unitId}
                      onChange={(e) => setGroupForm({ ...groupForm, unitId: e.target.value })}
                      className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      disabled={!groupForm.companyId}
                      required
                    >
                      <option value="">Select Unit</option>
                      {units
                        .filter(unit => unit.companyId === groupForm.companyId)
                        .map((unit) => (
                          <option key={unit.id} value={unit.id}>{unit.name}</option>
                        ))}
                    </select>
                    <input
                      type="text"
                      value={groupForm.name}
                      onChange={(e) => setGroupForm({ ...groupForm, name: e.target.value })}
                      placeholder="Group name"
                      className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      required
                    />
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                    >
                      {editingItem ? 'Update' : 'Add'} Group
                    </button>
                    {editingItem && (
                      <button
                        type="button"
                        onClick={cancelEdit}
                        className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </form>

                <div className="grid gap-4">
                  {groups.map((group) => (
                    <div key={group.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                      <div className="flex items-center">
                        <Users className="w-5 h-5 text-gray-400 mr-3" />
                        <div>
                          <span className="font-medium text-gray-900">{group.name}</span>
                          <p className="text-sm text-gray-600">
                            {getUnitName(group.unitId)} - {getCompanyName(group.companyId)}
                          </p>
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleGroupEdit(group)}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleGroupDelete(group.id)}
                          className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Shift Master Tab */}
          {activeTab === 'shifts' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Shift Management</h3>
              <form onSubmit={handleShiftSubmit} className="mb-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <input
                    type="text"
                    value={shiftForm.name}
                    onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })}
                    placeholder="Shift name"
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <input
                    type="time"
                    value={shiftForm.startTime}
                    onChange={(e) => setShiftForm({ ...shiftForm, startTime: e.target.value })}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <input
                    type="time"
                    value={shiftForm.endTime}
                    onChange={(e) => setShiftForm({ ...shiftForm, endTime: e.target.value })}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <input
                    type="number"
                    value={shiftForm.duration}
                    onChange={(e) => setShiftForm({ ...shiftForm, duration: Number(e.target.value) })}
                    placeholder="Duration (hours)"
                    min="1"
                    max="24"
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <select
                    value={shiftForm.applicableTo}
                    onChange={(e) => setShiftForm({ ...shiftForm, applicableTo: e.target.value as any })}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="both">Both Staff & Labour</option>
                    <option value="staff">Staff Only</option>
                    <option value="labour">Labour Only</option>
                  </select>
                  <div className="flex items-center">
                    <input
                      type="checkbox"
                      id="isActive"
                      checked={shiftForm.isActive}
                      onChange={(e) => setShiftForm({ ...shiftForm, isActive: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="isActive" className="ml-2 text-sm text-gray-700">
                      Active
                    </label>
                  </div>
                </div>
                <div className="flex gap-4">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {editingItem ? 'Update' : 'Add'} Shift
                  </button>
                  {editingItem && (
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              <div className="grid gap-4">
                {shifts.map((shift) => (
                  <div key={shift.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center">
                      <Clock className="w-5 h-5 text-gray-400 mr-3" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{shift.name}</span>
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            shift.applicableTo === 'staff' ? 'bg-blue-100 text-blue-800' :
                            shift.applicableTo === 'labour' ? 'bg-purple-100 text-purple-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {shift.applicableTo}
                          </span>
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            shift.isActive ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                          }`}>
                            {shift.isActive ? 'Active' : 'Inactive'}
                          </span>
                        </div>
                        <p className="text-sm text-gray-600">
                          {formatTime(shift.startTime)} - {formatTime(shift.endTime)} ({shift.duration} hours)
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleShiftEdit(shift)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleShiftDelete(shift.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Holiday Master Tab */}
          {activeTab === 'holidays' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Holiday Management</h3>
              <form onSubmit={handleHolidaySubmit} className="mb-6 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <input
                    type="text"
                    value={holidayForm.name}
                    onChange={(e) => setHolidayForm({ ...holidayForm, name: e.target.value })}
                    placeholder="Holiday name"
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <input
                    type="date"
                    value={holidayForm.date}
                    onChange={(e) => setHolidayForm({ ...holidayForm, date: e.target.value })}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    required
                  />
                  <select
                    value={holidayForm.type}
                    onChange={(e) => setHolidayForm({ ...holidayForm, type: e.target.value as any })}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="national">National Holiday</option>
                    <option value="religious">Religious Holiday</option>
                    <option value="company">Company Holiday</option>
                    <option value="other">Other</option>
                  </select>
                  <select
                    value={holidayForm.applicableTo}
                    onChange={(e) => setHolidayForm({ ...holidayForm, applicableTo: e.target.value as any })}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="both">Both Staff & Labour</option>
                    <option value="staff">Staff Only</option>
                    <option value="labour">Labour Only</option>
                  </select>
                  <div className="flex items-center col-span-2">
                    <input
                      type="checkbox"
                      id="isRecurring"
                      checked={holidayForm.isRecurring}
                      onChange={(e) => setHolidayForm({ ...holidayForm, isRecurring: e.target.checked })}
                      className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                    <label htmlFor="isRecurring" className="ml-2 text-sm text-gray-700">
                      Recurring annually
                    </label>
                  </div>
                </div>
                <div className="flex gap-4">
                  <button
                    type="submit"
                    disabled={isLoading}
                    className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                  >
                    {editingItem ? 'Update' : 'Add'} Holiday
                  </button>
                  {editingItem && (
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  )}
                </div>
              </form>

              <div className="grid gap-4">
                {holidays.map((holiday) => (
                  <div key={holiday.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
                    <div className="flex items-center">
                      <Calendar className="w-5 h-5 text-gray-400 mr-3" />
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-gray-900">{holiday.name}</span>
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            holiday.type === 'national' ? 'bg-red-100 text-red-800' :
                            holiday.type === 'religious' ? 'bg-orange-100 text-orange-800' :
                            holiday.type === 'company' ? 'bg-blue-100 text-blue-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {holiday.type}
                          </span>
                          <span className={`px-2 py-1 text-xs font-semibold rounded-full ${
                            holiday.applicableTo === 'staff' ? 'bg-blue-100 text-blue-800' :
                            holiday.applicableTo === 'labour' ? 'bg-purple-100 text-purple-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {holiday.applicableTo}
                          </span>
                          {holiday.isRecurring && (
                            <span className="px-2 py-1 text-xs font-semibold rounded-full bg-green-100 text-green-800">
                              Recurring
                            </span>
                          )}
                        </div>
                        <p className="text-sm text-gray-600">
                          {new Date(holiday.date).toLocaleDateString('en-IN', {
                            weekday: 'long',
                            year: 'numeric',
                            month: 'long',
                            day: 'numeric'
                          })}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => handleHolidayEdit(holiday)}
                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleHolidayDelete(holiday.id)}
                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Master;