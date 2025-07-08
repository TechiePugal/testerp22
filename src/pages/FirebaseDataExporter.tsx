import React, { useState } from 'react';
import { Download, Database, FileText, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

// Firebase configuration (replace with your actual config)
const firebaseConfig = {
  apiKey: "AIzaSyDSHZAKsRFrHer7lno6Rknr3w5j-xVglVc",
  authDomain: "employeemanagement-16dba.firebaseapp.com",
  projectId: "employeemanagement-16dba",
  storageBucket: "employeemanagement-16dba.firebasestorage.app",
  messagingSenderId: "723276151197",
  appId: "1:723276151197:web:5df89d54869fc42dd4d774",
  measurementId: "G-BT1YLST16T"
};

const FirebaseDataExporter = () => {
  const [isExporting, setIsExporting] = useState(false);
  const [exportStatus, setExportStatus] = useState('');
  const [exportedData, setExportedData] = useState(null);
  const [collections, setCollections] = useState([]);

  // Initialize Firebase dynamically
  const initializeFirebase = async () => {
    try {
      const { initializeApp } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js');
      const { getFirestore, collection, getDocs } = await import('https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js');
      
      const app = initializeApp(firebaseConfig);
      const db = getFirestore(app);
      
      return { db, collection, getDocs };
    } catch (error) {
      console.error('Failed to initialize Firebase:', error);
      throw error;
    }
  };

  // Get all documents from a collection
  const getAllDocuments = async (db, getDocs, collection, collectionName) => {
    try {
      const querySnapshot = await getDocs(collection(db, collectionName));
      const documents = [];
      
      querySnapshot.forEach((doc) => {
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

  // Export all data from Firebase
  const exportAllData = async () => {
    setIsExporting(true);
    setExportStatus('Initializing Firebase...');
    
    try {
      const { db, collection, getDocs } = await initializeFirebase();
      
      // Common collection names for employee management system
      const collectionNames = [
        'employees',
        'attendance',
        'allowances',
        'holidays',
        'departments',
        'positions',
        'salaries',
        'leaves',
        'overtime',
        'users',
        'settings',
        'reports'
      ];

      const allData = {};
      const foundCollections = [];

      setExportStatus('Fetching data from collections...');

      // Try to fetch data from each collection
      for (const collectionName of collectionNames) {
        try {
          setExportStatus(`Fetching ${collectionName}...`);
          const documents = await getAllDocuments(db, getDocs, collection, collectionName);
          
          if (documents.length > 0) {
            allData[collectionName] = documents;
            foundCollections.push(collectionName);
          }
        } catch (error) {
          console.log(`Collection ${collectionName} not found or empty`);
        }
      }

      setCollections(foundCollections);
      setExportedData(allData);
      setExportStatus(`Successfully exported ${foundCollections.length} collections with ${Object.values(allData).reduce((total, docs) => total + docs.length, 0)} total documents`);

    } catch (error) {
      console.error('Export failed:', error);
      setExportStatus(`Export failed: ${error.message}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Download JSON file
  const downloadJSON = () => {
    if (!exportedData) return;

    const dataStr = JSON.stringify(exportedData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    
    const link = document.createElement('a');
    link.href = url;
    link.download = `firebase-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    URL.revokeObjectURL(url);
  };

  // Format file size
  const formatFileSize = (data) => {
    const size = new Blob([JSON.stringify(data)]).size;
    return size < 1024 ? `${size} B` : 
           size < 1024 * 1024 ? `${(size / 1024).toFixed(1)} KB` : 
           `${(size / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center gap-3 mb-4">
            <Database className="w-8 h-8 text-blue-600" />
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Firebase Data Exporter</h1>
              <p className="text-gray-600">Export all your Firebase Firestore data as JSON</p>
            </div>
          </div>

          {/* Export Button */}
          <div className="flex gap-4">
            <button
              onClick={exportAllData}
              disabled={isExporting}
              className="flex items-center gap-2 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {isExporting ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <Database className="w-5 h-5" />
              )}
              {isExporting ? 'Exporting...' : 'Export All Data'}
            </button>

            {exportedData && (
              <button
                onClick={downloadJSON}
                className="flex items-center gap-2 bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors"
              >
                <Download className="w-5 h-5" />
                Download JSON
              </button>
            )}
          </div>

          {/* Status */}
          {exportStatus && (
            <div className={`mt-4 p-3 rounded-lg flex items-center gap-2 ${
              exportStatus.includes('failed') ? 'bg-red-50 text-red-800' : 
              exportStatus.includes('Successfully') ? 'bg-green-50 text-green-800' : 
              'bg-blue-50 text-blue-800'
            }`}>
              {exportStatus.includes('failed') ? (
                <AlertCircle className="w-5 h-5" />
              ) : exportStatus.includes('Successfully') ? (
                <CheckCircle className="w-5 h-5" />
              ) : (
                <Loader2 className="w-5 h-5 animate-spin" />
              )}
              {exportStatus}
            </div>
          )}
        </div>

        {/* Export Summary */}
        {exportedData && (
          <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Export Summary</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              <div className="bg-blue-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-blue-600">{collections.length}</div>
                <div className="text-sm text-blue-800">Collections Found</div>
              </div>
              <div className="bg-green-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-green-600">
                  {Object.values(exportedData).reduce((total, docs) => total + docs.length, 0)}
                </div>
                <div className="text-sm text-green-800">Total Documents</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-lg">
                <div className="text-2xl font-bold text-purple-600">{formatFileSize(exportedData)}</div>
                <div className="text-sm text-purple-800">File Size</div>
              </div>
            </div>

            {/* Collections List */}
            <div className="space-y-3">
              <h3 className="font-medium text-gray-900">Collections Exported:</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {collections.map((collectionName) => (
                  <div key={collectionName} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center gap-2">
                      <FileText className="w-4 h-4 text-gray-600" />
                      <span className="font-medium text-gray-900">{collectionName}</span>
                    </div>
                    <span className="text-sm text-gray-600">
                      {exportedData[collectionName]?.length || 0} docs
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Data Preview */}
        {exportedData && (
          <div className="bg-white rounded-lg shadow-sm p-6">
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Data Preview</h2>
            <div className="bg-gray-100 rounded-lg p-4 overflow-auto max-h-96">
              <pre className="text-sm text-gray-800">
                {JSON.stringify(exportedData, null, 2)}
              </pre>
            </div>
          </div>
        )}

        {/* Instructions */}
        <div className="bg-white rounded-lg shadow-sm p-6 mt-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4">Instructions</h2>
          <div className="space-y-2 text-sm text-gray-600">
            <p>1. Click "Export All Data" to fetch all collections from your Firebase Firestore database.</p>
            <p>2. The system will automatically scan for common collection names used in employee management systems.</p>
            <p>3. Once the export is complete, click "Download JSON" to save the data to your computer.</p>
            <p>4. The exported file will include all documents with their IDs and data in JSON format.</p>
            <p>5. You can use this exported data for backups, data migration, or analysis purposes.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FirebaseDataExporter;