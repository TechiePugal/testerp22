import React, { useState, useRef } from 'react';
import { 
  Upload, 
  Download, 
  FileText, 
  Database, 
  CheckCircle, 
  AlertCircle, 
  X, 
  Users, 
  Building2, 
  Clock, 
  Calendar,
  DollarSign,
  UserCheck,
  Loader2,
  FileSpreadsheet,
  FileDown,
  FileUp,
  Info
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { createDocument, getDocuments } from '../services/firestore';
import type { Employee, Company, Unit, Group, Shift, Holiday } from '../types';

interface ImportResult {
  success: number;
  errors: string[];
  warnings: string[];
}

interface ImportPreview {
  data: any[];
  headers: string[];
  type: string;
}

const ImportExport: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'import' | 'export'>('import');
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [selectedDataType, setSelectedDataType] = useState<string>('employees');
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Data type configurations
  const dataTypes = [
    {
      id: 'employees',
      name: 'Employees',
      icon: Users,
      color: 'blue',
      description: 'Import employee records with personal and job information',
      requiredFields: ['name', 'employeeId', 'employeeType', 'designation'],
      sampleData: {
        name: 'John Doe',
        employeeId: 'EMP001',
        employeeType: 'staff',
        designation: 'Manager',
        phone: '9876543210',
        address: '123 Main St',
        salaryPerDay: 500,
        salaryPerMonth: 15000
      }
    },
    {
      id: 'companies',
      name: 'Companies',
      icon: Building2,
      color: 'green',
      description: 'Import company master data',
      requiredFields: ['name'],
      sampleData: {
        name: 'ABC Corporation'
      }
    },
    {
      id: 'shifts',
      name: 'Shifts',
      icon: Clock,
      color: 'purple',
      description: 'Import shift timings and configurations',
      requiredFields: ['name', 'startTime', 'endTime'],
      sampleData: {
        name: 'Morning Shift',
        startTime: '09:00',
        endTime: '17:00',
        duration: 8,
        applicableTo: 'both'
      }
    },
    {
      id: 'holidays',
      name: 'Holidays',
      icon: Calendar,
      color: 'orange',
      description: 'Import holiday calendar',
      requiredFields: ['name', 'date'],
      sampleData: {
        name: 'Independence Day',
        date: '2024-08-15',
        type: 'national',
        applicableTo: 'both'
      }
    }
  ];

  const exportOptions = [
    {
      id: 'employees',
      name: 'Employees',
      icon: Users,
      color: 'blue',
      description: 'Export all employee records'
    },
    {
      id: 'attendance',
      name: 'Attendance',
      icon: UserCheck,
      color: 'green',
      description: 'Export attendance records'
    },
    {
      id: 'allowances',
      name: 'Allowances',
      icon: DollarSign,
      color: 'yellow',
      description: 'Export allowance records'
    },
    {
      id: 'master-data',
      name: 'Master Data',
      icon: Database,
      color: 'purple',
      description: 'Export companies, units, groups, shifts, holidays'
    },
    {
      id: 'complete-backup',
      name: 'Complete Backup',
      icon: FileDown,
      color: 'indigo',
      description: 'Export all data as complete backup'
    }
  ];

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const jsonData = XLSX.utils.sheet_to_json(worksheet);
        
        if (jsonData.length === 0) {
          alert('The file appears to be empty or invalid.');
          return;
        }

        const headers = Object.keys(jsonData[0] as object);
        setImportPreview({
          data: jsonData,
          headers,
          type: selectedDataType
        });
      } catch (error) {
        console.error('Error reading file:', error);
        alert('Error reading file. Please ensure it\'s a valid Excel or CSV file.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const validateData = (data: any[], type: string) => {
    const config = dataTypes.find(dt => dt.id === type);
    if (!config) return { valid: [], errors: [] };

    const errors: string[] = [];
    const valid: any[] = [];

    data.forEach((row, index) => {
      const rowErrors: string[] = [];
      
      // Check required fields
      config.requiredFields.forEach(field => {
        if (!row[field] || row[field].toString().trim() === '') {
          rowErrors.push(`Missing required field: ${field}`);
        }
      });

      // Type-specific validations
      if (type === 'employees') {
        if (row.employeeType && !['staff', 'labour'].includes(row.employeeType.toLowerCase())) {
          rowErrors.push('Employee type must be "staff" or "labour"');
        }
        if (row.salaryPerDay && isNaN(Number(row.salaryPerDay))) {
          rowErrors.push('Salary per day must be a number');
        }
      }

      if (type === 'shifts') {
        if (row.startTime && !/^\d{2}:\d{2}$/.test(row.startTime)) {
          rowErrors.push('Start time must be in HH:MM format');
        }
        if (row.endTime && !/^\d{2}:\d{2}$/.test(row.endTime)) {
          rowErrors.push('End time must be in HH:MM format');
        }
      }

      if (rowErrors.length > 0) {
        errors.push(`Row ${index + 2}: ${rowErrors.join(', ')}`);
      } else {
        valid.push(row);
      }
    });

    return { valid, errors };
  };

  const processImport = async () => {
    if (!importPreview) return;

    setIsProcessing(true);
    const { valid, errors } = validateData(importPreview.data, importPreview.type);
    
    try {
      let successCount = 0;
      const warnings: string[] = [];

      for (const row of valid) {
        try {
          // Transform data based on type
          let transformedData = { ...row };

          if (importPreview.type === 'employees') {
            transformedData = {
              ...row,
              dob: row.dob ? new Date(row.dob) : new Date(),
              dateOfJoining: row.dateOfJoining ? new Date(row.dateOfJoining) : new Date(),
              salaryPerDay: Number(row.salaryPerDay) || 0,
              salaryPerMonth: Number(row.salaryPerMonth) || 0,
              employeeType: row.employeeType?.toLowerCase() || 'staff',
              isActive: row.isActive !== false,
              esaPf: row.esaPf === true || row.esaPf === 'true',
              maritalStatus: row.maritalStatus?.toLowerCase() || 'single',
              salaryMode: row.salaryMode?.toLowerCase() || 'cash',
              companyId: '', // Will need to be mapped
              unitId: '', // Will need to be mapped
              groupId: '', // Will need to be mapped
              shiftId: '' // Will need to be mapped
            };
          } else if (importPreview.type === 'holidays') {
            transformedData = {
              ...row,
              date: new Date(row.date),
              type: row.type?.toLowerCase() || 'company',
              applicableTo: row.applicableTo?.toLowerCase() || 'both',
              isRecurring: row.isRecurring === true || row.isRecurring === 'true'
            };
          } else if (importPreview.type === 'shifts') {
            transformedData = {
              ...row,
              duration: Number(row.duration) || 8,
              applicableTo: row.applicableTo?.toLowerCase() || 'both',
              isActive: row.isActive !== false
            };
          }

          await createDocument(importPreview.type, transformedData);
          successCount++;
        } catch (error) {
          warnings.push(`Failed to import row: ${JSON.stringify(row)}`);
        }
      }

      setImportResult({
        success: successCount,
        errors,
        warnings
      });
    } catch (error) {
      console.error('Import error:', error);
      setImportResult({
        success: 0,
        errors: ['Failed to process import'],
        warnings: []
      });
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExport = async (exportType: string) => {
    setIsProcessing(true);
    try {
      let data: any[] = [];
      let filename = '';

      switch (exportType) {
        case 'employees':
          data = await getDocuments('employees');
          filename = 'employees';
          break;
        case 'attendance':
          data = await getDocuments('attendance', 'date');
          filename = 'attendance';
          break;
        case 'allowances':
          data = await getDocuments('allowances', 'date');
          filename = 'allowances';
          break;
        case 'master-data':
          const [companies, units, groups, shifts, holidays] = await Promise.all([
            getDocuments('companies'),
            getDocuments('units'),
            getDocuments('groups'),
            getDocuments('shifts'),
            getDocuments('holidays')
          ]);
          
          // Create multiple sheets
          const wb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(companies), 'Companies');
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(units), 'Units');
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(groups), 'Groups');
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(shifts), 'Shifts');
          XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(holidays), 'Holidays');
          
          XLSX.writeFile(wb, `master-data-${new Date().toISOString().split('T')[0]}.xlsx`);
          setIsProcessing(false);
          return;
          
        case 'complete-backup':
          const [allEmployees, allAttendance, allAllowances, allCompanies, allUnits, allGroups, allShifts, allHolidays] = await Promise.all([
            getDocuments('employees'),
            getDocuments('attendance', 'date'),
            getDocuments('allowances', 'date'),
            getDocuments('companies'),
            getDocuments('units'),
            getDocuments('groups'),
            getDocuments('shifts'),
            getDocuments('holidays')
          ]);
          
          const backupWb = XLSX.utils.book_new();
          XLSX.utils.book_append_sheet(backupWb, XLSX.utils.json_to_sheet(allEmployees), 'Employees');
          XLSX.utils.book_append_sheet(backupWb, XLSX.utils.json_to_sheet(allAttendance), 'Attendance');
          XLSX.utils.book_append_sheet(backupWb, XLSX.utils.json_to_sheet(allAllowances), 'Allowances');
          XLSX.utils.book_append_sheet(backupWb, XLSX.utils.json_to_sheet(allCompanies), 'Companies');
          XLSX.utils.book_append_sheet(backupWb, XLSX.utils.json_to_sheet(allUnits), 'Units');
          XLSX.utils.book_append_sheet(backupWb, XLSX.utils.json_to_sheet(allGroups), 'Groups');
          XLSX.utils.book_append_sheet(backupWb, XLSX.utils.json_to_sheet(allShifts), 'Shifts');
          XLSX.utils.book_append_sheet(backupWb, XLSX.utils.json_to_sheet(allHolidays), 'Holidays');
          
          XLSX.writeFile(backupWb, `complete-backup-${new Date().toISOString().split('T')[0]}.xlsx`);
          setIsProcessing(false);
          return;
      }

      // Single sheet export
      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, filename);
      XLSX.writeFile(wb, `${filename}-${new Date().toISOString().split('T')[0]}.xlsx`);
    } catch (error) {
      console.error('Export error:', error);
      alert('Error exporting data');
    } finally {
      setIsProcessing(false);
    }
  };

  const downloadSampleTemplate = (type: string) => {
    const config = dataTypes.find(dt => dt.id === type);
    if (!config) return;

    const sampleData = [config.sampleData];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Template');
    XLSX.writeFile(wb, `${type}-template.xlsx`);
  };

  const resetImport = () => {
    setImportPreview(null);
    setImportResult(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Import & Export Data</h1>
            <p className="text-gray-600 mt-1">Manage your data with bulk import and export capabilities</p>
          </div>
          
          <div className="flex items-center bg-gray-100 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('import')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                activeTab === 'import'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FileUp className="w-4 h-4" />
              Import Data
            </button>
            <button
              onClick={() => setActiveTab('export')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                activeTab === 'export'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <FileDown className="w-4 h-4" />
              Export Data
            </button>
          </div>
        </div>
      </div>

      {/* Import Tab */}
      {activeTab === 'import' && (
        <div className="space-y-6">
          {/* Data Type Selection */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Data Type to Import</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {dataTypes.map((type) => {
                const Icon = type.icon;
                return (
                  <div
                    key={type.id}
                    onClick={() => setSelectedDataType(type.id)}
                    className={`p-4 border-2 rounded-lg cursor-pointer transition-all hover:shadow-md ${
                      selectedDataType === type.id
                        ? `border-${type.color}-500 bg-${type.color}-50`
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center gap-3 mb-2">
                      <Icon className={`w-6 h-6 text-${type.color}-600`} />
                      <h4 className="font-medium text-gray-900">{type.name}</h4>
                    </div>
                    <p className="text-sm text-gray-600">{type.description}</p>
                    <div className="mt-3">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          downloadSampleTemplate(type.id);
                        }}
                        className="text-xs text-blue-600 hover:text-blue-800 underline"
                      >
                        Download Template
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* File Upload */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Upload File</h3>
            
            {!importPreview ? (
              <div className="border-2 border-dashed border-gray-300 rounded-lg p-8 text-center hover:border-gray-400 transition-colors">
                <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <h4 className="text-lg font-medium text-gray-900 mb-2">Upload Excel or CSV File</h4>
                <p className="text-gray-600 mb-4">
                  Select a file to import {dataTypes.find(dt => dt.id === selectedDataType)?.name.toLowerCase()} data
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                  <Upload className="w-5 h-5" />
                  Choose File
                </button>
                <p className="text-xs text-gray-500 mt-2">
                  Supported formats: .xlsx, .xls, .csv
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Preview Header */}
                <div className="flex items-center justify-between p-4 bg-blue-50 rounded-lg">
                  <div className="flex items-center gap-3">
                    <CheckCircle className="w-6 h-6 text-blue-600" />
                    <div>
                      <h4 className="font-medium text-blue-900">File Loaded Successfully</h4>
                      <p className="text-sm text-blue-700">
                        {importPreview.data.length} rows found for {dataTypes.find(dt => dt.id === importPreview.type)?.name}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={resetImport}
                    className="text-blue-600 hover:text-blue-800"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Data Preview */}
                <div className="border border-gray-200 rounded-lg overflow-hidden">
                  <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                    <h5 className="font-medium text-gray-900">Data Preview (First 5 rows)</h5>
                  </div>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-50">
                        <tr>
                          {importPreview.headers.map((header, index) => (
                            <th key={index} className="px-4 py-2 text-left font-medium text-gray-900">
                              {header}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-gray-200">
                        {importPreview.data.slice(0, 5).map((row, index) => (
                          <tr key={index} className="hover:bg-gray-50">
                            {importPreview.headers.map((header, cellIndex) => (
                              <td key={cellIndex} className="px-4 py-2 text-gray-900">
                                {row[header]?.toString() || '-'}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>

                {/* Import Actions */}
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm text-gray-600">
                    <Info className="w-4 h-4" />
                    <span>Review the data above and click import to proceed</span>
                  </div>
                  <div className="flex gap-3">
                    <button
                      onClick={resetImport}
                      className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                    <button
                      onClick={processImport}
                      disabled={isProcessing}
                      className="flex items-center gap-2 px-6 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50"
                    >
                      {isProcessing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Upload className="w-4 h-4" />
                      )}
                      {isProcessing ? 'Importing...' : 'Import Data'}
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Import Results */}
          {importResult && (
            <div className="bg-white rounded-lg shadow-sm p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Import Results</h3>
              
              <div className="space-y-4">
                {/* Success */}
                <div className="flex items-center gap-3 p-4 bg-green-50 rounded-lg">
                  <CheckCircle className="w-6 h-6 text-green-600" />
                  <div>
                    <h4 className="font-medium text-green-900">Successfully Imported</h4>
                    <p className="text-sm text-green-700">{importResult.success} records imported successfully</p>
                  </div>
                </div>

                {/* Errors */}
                {importResult.errors.length > 0 && (
                  <div className="p-4 bg-red-50 rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <AlertCircle className="w-6 h-6 text-red-600" />
                      <h4 className="font-medium text-red-900">Errors ({importResult.errors.length})</h4>
                    </div>
                    <div className="space-y-1">
                      {importResult.errors.slice(0, 10).map((error, index) => (
                        <p key={index} className="text-sm text-red-700">• {error}</p>
                      ))}
                      {importResult.errors.length > 10 && (
                        <p className="text-sm text-red-600">... and {importResult.errors.length - 10} more errors</p>
                      )}
                    </div>
                  </div>
                )}

                {/* Warnings */}
                {importResult.warnings.length > 0 && (
                  <div className="p-4 bg-yellow-50 rounded-lg">
                    <div className="flex items-center gap-3 mb-2">
                      <AlertCircle className="w-6 h-6 text-yellow-600" />
                      <h4 className="font-medium text-yellow-900">Warnings ({importResult.warnings.length})</h4>
                    </div>
                    <div className="space-y-1">
                      {importResult.warnings.slice(0, 5).map((warning, index) => (
                        <p key={index} className="text-sm text-yellow-700">• {warning}</p>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Export Tab */}
      {activeTab === 'export' && (
        <div className="space-y-6">
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Export Data</h3>
            <p className="text-gray-600 mb-6">Choose what data you want to export from your system</p>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {exportOptions.map((option) => {
                const Icon = option.icon;
                return (
                  <div
                    key={option.id}
                    className="p-6 border border-gray-200 rounded-lg hover:shadow-md transition-all hover:border-gray-300"
                  >
                    <div className="flex items-center gap-3 mb-3">
                      <div className={`p-2 bg-${option.color}-100 rounded-lg`}>
                        <Icon className={`w-6 h-6 text-${option.color}-600`} />
                      </div>
                      <h4 className="font-medium text-gray-900">{option.name}</h4>
                    </div>
                    <p className="text-sm text-gray-600 mb-4">{option.description}</p>
                    <button
                      onClick={() => handleExport(option.id)}
                      disabled={isProcessing}
                      className={`w-full flex items-center justify-center gap-2 px-4 py-2 bg-${option.color}-600 text-white rounded-lg hover:bg-${option.color}-700 transition-colors disabled:opacity-50`}
                    >
                      {isProcessing ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Download className="w-4 h-4" />
                      )}
                      Export
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Export Instructions */}
          <div className="bg-blue-50 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <Info className="w-6 h-6 text-blue-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900 mb-2">Export Instructions</h4>
                <ul className="text-sm text-blue-800 space-y-1">
                  <li>• All exports are generated in Excel format (.xlsx)</li>
                  <li>• Master Data export includes multiple sheets for different data types</li>
                  <li>• Complete Backup includes all system data in a single file</li>
                  <li>• Exported files are automatically downloaded to your device</li>
                  <li>• File names include the current date for easy identification</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportExport;