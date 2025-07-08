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
  Info,
  Shield,
  RotateCcw,
  HardDrive,
  Cloud,
  Archive
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

interface BackupData {
  collections: string[];
  totalDocuments: number;
  fileSize: string;
  data: any;
}

// Firebase configuration for backup/restore
const firebaseConfig = {
  apiKey: 'AIzaSyDicQksIDusUdMK7k2fIt2cvxyCY8yZg3c',
  authDomain: 'erpv02.firebaseapp.com',
  projectId: 'erpv02',
  storageBucket: 'erpv02.appspot.com',
  messagingSenderId: '453487579197',
  appId: '1:453487579197:web:255e8fb9745dc61e7c9a54',
  measurementId: 'G-VP7GPT0J7J',
};

const ImportExport: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'import' | 'export' | 'backup'>('import');
  const [isProcessing, setIsProcessing] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [selectedDataType, setSelectedDataType] = useState<string>('employees');
  const [backupData, setBackupData] = useState<BackupData | null>(null);
  const [backupStatus, setBackupStatus] = useState('');
  const [restoreFile, setRestoreFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const restoreFileInputRef = useRef<HTMLInputElement>(null);

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

  // Initialize Firebase dynamically for backup/restore
  const initializeFirebase = async () => {
    try {
      const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
      const { getFirestore, collection, getDocs, doc, setDoc, writeBatch } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
      
      const app = initializeApp(firebaseConfig);
      const db = getFirestore(app);
      
      return { db, collection, getDocs, doc, setDoc, writeBatch };
    } catch (error) {
      console.error('Failed to initialize Firebase:', error);
      throw error;
    }
  };

  // Get all documents from a collection
  const getAllDocuments = async (db: any, getDocs: any, collection: any, collectionName: string) => {
    try {
      const querySnapshot = await getDocs(collection(db, collectionName));
      const documents: any[] = [];
      
      querySnapshot.forEach((doc: any) => {
        documents.push({
          id: doc.id,
          ...doc.data()
        });
      });
      
      return documents;
    } catch (error) {
      console.error(`Error getting documents from ${collectionName}:`, error);
      return [];
    }
  };

  // Create complete Firebase backup
  const createFirebaseBackup = async () => {
    setIsProcessing(true);
    setBackupStatus('Initializing Firebase connection...');
    
    try {
      const { db, collection, getDocs } = await initializeFirebase();
      
      // All possible collection names
      const collectionNames = [
        'employees',
        'attendance',
        'allowances',
        'holidays',
        'companies',
        'units',
        'groups',
        'shifts',
        'shiftAssignments',
        'users',
        'settings'
      ];

      const allData: any = {};
      const foundCollections: string[] = [];

      setBackupStatus('Scanning collections...');

      // Fetch data from each collection
      for (const collectionName of collectionNames) {
        try {
          setBackupStatus(`Fetching ${collectionName}...`);
          const documents = await getAllDocuments(db, getDocs, collection, collectionName);
          
          if (documents.length > 0) {
            allData[collectionName] = documents;
            foundCollections.push(collectionName);
          }
        } catch (error) {
          console.log(`Collection ${collectionName} not found or empty`);
        }
      }

      const totalDocuments = Object.values(allData).reduce((total: number, docs: any) => total + docs.length, 0);
      const fileSize = formatFileSize(allData);

      setBackupData({
        collections: foundCollections,
        totalDocuments,
        fileSize,
        data: allData
      });

      setBackupStatus(`✅ Successfully backed up ${foundCollections.length} collections with ${totalDocuments} total documents`);

    } catch (error) {
      console.error('Backup failed:', error);
      setBackupStatus(`❌ Backup failed: ${error}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Download backup as JSON
  const downloadBackup = () => {
    if (!backupData) return;

    const backupContent = {
      metadata: {
        exportDate: new Date().toISOString(),
        version: '1.0',
        collections: backupData.collections,
        totalDocuments: backupData.totalDocuments
      },
      data: backupData.data
    };

    const dataStr = JSON.stringify(backupContent, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `firebase-backup-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  };

  // Handle restore file selection
  const handleRestoreFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type === 'application/json') {
      setRestoreFile(file);
    } else {
      alert('Please select a valid JSON backup file');
    }
  };

  // Restore data from backup file
  const restoreFromBackup = async () => {
    if (!restoreFile) {
      alert('Please select a backup file first');
      return;
    }

    if (!window.confirm('⚠️ WARNING: This will replace ALL existing data with the backup data. This action cannot be undone. Are you sure you want to continue?')) {
      return;
    }

    setIsProcessing(true);
    setBackupStatus('Reading backup file...');

    try {
      const fileContent = await restoreFile.text();
      const backupContent = JSON.parse(fileContent);
      
      // Handle different backup file formats
      let collectionsData: any = {};
      
      // Check if it's the new format with metadata and data properties
      if (backupContent.data && backupContent.metadata) {
        collectionsData = backupContent.data;
      } 
      // Check if it's a direct export format (collections as top-level keys)
      else if (typeof backupContent === 'object' && backupContent !== null) {
        // Validate that it contains collection-like data
        const possibleCollections = ['employees', 'attendance', 'allowances', 'holidays', 'companies', 'units', 'groups', 'shifts', 'shiftAssignments', 'users', 'settings'];
        const hasValidCollections = Object.keys(backupContent).some(key => 
          possibleCollections.includes(key) && Array.isArray(backupContent[key])
        );
        
        if (hasValidCollections) {
          collectionsData = backupContent;
        } else {
          throw new Error('Invalid backup file format - no recognizable collections found');
        }
      } else {
        throw new Error('Invalid backup file format - file must contain valid JSON data');
      }

      setBackupStatus('Initializing Firebase connection...');
      const { db, collection, doc, setDoc, writeBatch } = await initializeFirebase();

      const collections = Object.keys(collectionsData);
      let restoredCount = 0;

      setBackupStatus('Restoring data...');

      // Restore each collection
      for (const collectionName of collections) {
        setBackupStatus(`Restoring ${collectionName}...`);
        const documents = collectionsData[collectionName];
        
        // Skip if not an array or empty
        if (!Array.isArray(documents) || documents.length === 0) {
          continue;
        }
        
        // Use batch writes for better performance
        let batch = writeBatch(db);
        let batchCount = 0;
        
        for (const document of documents) {
          const { id, ...data } = document;
          
          // Generate ID if not present
          const docId = id || crypto.randomUUID();
          const docRef = doc(collection(db, collectionName), docId);
          batch.set(docRef, data);
          batchCount++;
          
          // Commit batch every 500 documents (Firestore limit)
          if (batchCount >= 500) {
            await batch.commit();
            // Create a new batch for subsequent operations
            batch = writeBatch(db);
            batchCount = 0;
          }
        }
        
        // Commit remaining documents
        if (batchCount > 0) {
          await batch.commit();
        }
        
        restoredCount += documents.length;
      }

      setBackupStatus(`✅ Successfully restored ${restoredCount} documents across ${collections.length} collections`);
      setRestoreFile(null);
      if (restoreFileInputRef.current) {
        restoreFileInputRef.current.value = '';
      }

    } catch (error) {
      console.error('Restore failed:', error);
      setBackupStatus(`❌ Restore failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsProcessing(false);
    }
  };

  // Format file size helper
  const formatFileSize = (data: any) => {
    const size = new Blob([JSON.stringify(data)]).size;
    return size < 1024 ? `${size} B` : 
           size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : 
           `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

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
          
          XLSX.writeFile(wb, `complete-backup-${new Date().toISOString().split('T')[0]}.xlsx`);
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
            <h1 className="text-2xl font-bold text-gray-900">Data Management Center</h1>
            <p className="text-gray-600 mt-1">Import, export, backup, and restore your system data</p>
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
              Import
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
              Export
            </button>
            <button
              onClick={() => setActiveTab('backup')}
              className={`flex items-center gap-2 px-4 py-2 rounded-md transition-colors ${
                activeTab === 'backup'
                  ? 'bg-white text-blue-600 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <Shield className="w-4 h-4" />
              Backup & Restore
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

      {/* Backup & Restore Tab */}
      {activeTab === 'backup' && (
        <div className="space-y-6">
          {/* Backup Section */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-blue-100 rounded-lg">
                <HardDrive className="w-8 h-8 text-blue-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Create System Backup</h3>
                <p className="text-gray-600">Create a complete backup of all your Firebase data</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Backup Actions */}
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-2">What's included in backup:</h4>
                  <ul className="text-sm text-blue-800 space-y-1">
                    <li>• All employee records and personal data</li>
                    <li>• Complete attendance history</li>
                    <li>• Allowance and payment records</li>
                    <li>• Master data (companies, units, groups, shifts)</li>
                    <li>• Holiday calendar and configurations</li>
                    <li>• User accounts and permissions</li>
                  </ul>
                </div>

                <button
                  onClick={createFirebaseBackup}
                  disabled={isProcessing}
                  className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                >
                  {isProcessing ? (
                    <Loader2 className="w-6 h-6 animate-spin" />
                  ) : (
                    <Cloud className="w-6 h-6" />
                  )}
                  {isProcessing ? 'Creating Backup...' : 'Create Backup'}
                </button>

                {backupData && (
                  <button
                    onClick={downloadBackup}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                  >
                    <Download className="w-6 h-6" />
                    Download Backup File
                  </button>
                )}
              </div>

              {/* Backup Status */}
              <div className="space-y-4">
                {backupStatus && (
                  <div className={`p-4 rounded-lg flex items-center gap-3 ${
                    backupStatus.includes('failed') || backupStatus.includes('❌') ? 'bg-red-50 border border-red-200' : 
                    backupStatus.includes('Successfully') || backupStatus.includes('✅') ? 'bg-green-50 border border-green-200' : 
                    'bg-blue-50 border border-blue-200'
                  }`}>
                    {backupStatus.includes('failed') || backupStatus.includes('❌') ? (
                      <AlertCircle className="w-6 h-6 text-red-600" />
                    ) : backupStatus.includes('Successfully') || backupStatus.includes('✅') ? (
                      <CheckCircle className="w-6 h-6 text-green-600" />
                    ) : (
                      <Loader2 className="w-6 h-6 animate-spin text-blue-600" />
                    )}
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${
                        backupStatus.includes('failed') || backupStatus.includes('❌') ? 'text-red-900' : 
                        backupStatus.includes('Successfully') || backupStatus.includes('✅') ? 'text-green-900' : 
                        'text-blue-900'
                      }`}>
                        {backupStatus}
                      </p>
                    </div>
                  </div>
                )}

                {backupData && (
                  <div className="p-4 bg-gray-50 rounded-lg border border-gray-200">
                    <h4 className="font-medium text-gray-900 mb-3">Backup Summary</h4>
                    <div className="grid grid-cols-3 gap-4 mb-4">
                      <div className="text-center">
                        <div className="text-2xl font-bold text-blue-600">{backupData.collections.length}</div>
                        <div className="text-xs text-gray-600">Collections</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-green-600">{backupData.totalDocuments}</div>
                        <div className="text-xs text-gray-600">Documents</div>
                      </div>
                      <div className="text-center">
                        <div className="text-2xl font-bold text-purple-600">{backupData.fileSize}</div>
                        <div className="text-xs text-gray-600">File Size</div>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <h5 className="text-sm font-medium text-gray-700">Collections backed up:</h5>
                      <div className="flex flex-wrap gap-1">
                        {backupData.collections.map((collection) => (
                          <span key={collection} className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                            {collection}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Restore Section */}
          <div className="bg-white rounded-lg shadow-sm p-6">
            <div className="flex items-center gap-3 mb-6">
              <div className="p-3 bg-orange-100 rounded-lg">
                <RotateCcw className="w-8 h-8 text-orange-600" />
              </div>
              <div>
                <h3 className="text-xl font-semibold text-gray-900">Restore from Backup</h3>
                <p className="text-gray-600">Restore your system from a previously created backup file</p>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Restore Actions */}
              <div className="space-y-4">
                <div className="p-4 bg-red-50 rounded-lg border border-red-200">
                  <div className="flex items-center gap-2 mb-2">
                    <AlertCircle className="w-5 h-5 text-red-600" />
                    <h4 className="font-medium text-red-900">⚠️ Important Warning</h4>
                  </div>
                  <ul className="text-sm text-red-800 space-y-1">
                    <li>• This will REPLACE ALL existing data</li>
                    <li>• This action cannot be undone</li>
                    <li>• Create a backup before restoring</li>
                    <li>• Only use trusted backup files</li>
                  </ul>
                </div>

                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
                  <Archive className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                  <h4 className="text-lg font-medium text-gray-900 mb-2">Select Backup File</h4>
                  <p className="text-gray-600 mb-4">Choose a JSON backup file to restore</p>
                  
                  <input
                    ref={restoreFileInputRef}
                    type="file"
                    accept=".json"
                    onChange={handleRestoreFileSelect}
                    className="hidden"
                  />
                  
                  <button
                    onClick={() => restoreFileInputRef.current?.click()}
                    className="inline-flex items-center gap-2 px-6 py-3 bg-orange-600 text-white rounded-lg hover:bg-orange-700 transition-colors"
                  >
                    <Upload className="w-5 h-5" />
                    Choose Backup File
                  </button>
                  
                  {restoreFile && (
                    <div className="mt-4 p-3 bg-green-50 rounded-lg border border-green-200">
                      <p className="text-sm text-green-800">
                        Selected: {restoreFile.name} ({(restoreFile.size / 1024 / 1024).toFixed(2)} MB)
                      </p>
                    </div>
                  )}
                </div>

                {restoreFile && (
                  <button
                    onClick={restoreFromBackup}
                    disabled={isProcessing}
                    className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50"
                  >
                    {isProcessing ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <RotateCcw className="w-6 h-6" />
                    )}
                    {isProcessing ? 'Restoring...' : 'Restore Data'}
                  </button>
                )}
              </div>

              {/* Restore Instructions */}
              <div className="space-y-4">
                <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                  <h4 className="font-medium text-blue-900 mb-2">Restore Process:</h4>
                  <ol className="text-sm text-blue-800 space-y-1 list-decimal list-inside">
                    <li>Select a valid JSON backup file</li>
                    <li>Review the warning and confirm</li>
                    <li>Click "Restore Data" to begin</li>
                    <li>Wait for the process to complete</li>
                    <li>Verify your data after restoration</li>
                  </ol>
                </div>

                <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                  <h4 className="font-medium text-yellow-900 mb-2">Best Practices:</h4>
                  <ul className="text-sm text-yellow-800 space-y-1">
                    <li>• Always create a backup before restoring</li>
                    <li>• Test restore on a development environment first</li>
                    <li>• Verify backup file integrity</li>
                    <li>• Inform users about the maintenance window</li>
                  </ul>
                </div>

                {backupStatus && activeTab === 'backup' && (
                  <div className={`p-4 rounded-lg ${
                    backupStatus.includes('failed') || backupStatus.includes('❌') ? 'bg-red-50 border border-red-200' : 
                    backupStatus.includes('Successfully') || backupStatus.includes('✅') ? 'bg-green-50 border border-green-200' : 
                    'bg-blue-50 border border-blue-200'
                  }`}>
                    <p className={`text-sm ${
                      backupStatus.includes('failed') || backupStatus.includes('❌') ? 'text-red-800' : 
                      backupStatus.includes('Successfully') || backupStatus.includes('✅') ? 'text-green-800' : 
                      'text-blue-800'
                    }`}>
                      {backupStatus}
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Backup Instructions */}
          <div className="bg-gray-50 rounded-lg p-6">
            <div className="flex items-start gap-3">
              <Info className="w-6 h-6 text-gray-600 mt-0.5" />
              <div>
                <h4 className="font-medium text-gray-900 mb-2">Backup & Restore Instructions</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm text-gray-700">
                  <div>
                    <h5 className="font-medium mb-2">Creating Backups:</h5>
                    <ul className="space-y-1">
                      <li>• Backups include all Firebase collections</li>
                      <li>• Files are saved in JSON format</li>
                      <li>• Include metadata for verification</li>
                      <li>• Store backups in secure locations</li>
                      <li>• Create regular automated backups</li>
                    </ul>
                  </div>
                  <div>
                    <h5 className="font-medium mb-2">Restoring Data:</h5>
                    <ul className="space-y-1">
                      <li>• Only use trusted backup files</li>
                      <li>• Verify file integrity before restore</li>
                      <li>• Process replaces ALL existing data</li>
                      <li>• Large restores may take several minutes</li>
                      <li>• Test restore process regularly</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ImportExport;