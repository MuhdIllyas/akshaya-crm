import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { FiLoader, FiAlertCircle } from 'react-icons/fi';
import { fetchWorkspace } from '../../services/knowledge';
import WorkspaceSidebar from './WorkspaceSidebar';
import WorkspaceHeader from './WorkspaceHeader';
import DocumentEditor from './DocumentEditor'; 

const OperationsHub = () => { 
  const { serviceId } = useParams(); 
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Data State - Initialize with safe defaults (empty arrays)
  const [workspace, setWorkspace] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [stats, setStats] = useState(null);
  const [contributors, setContributors] = useState([]);
  
  // UI State
  const [activeDocumentId, setActiveDocumentId] = useState(null);
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    loadWorkspace();
  }, [serviceId]);

  const loadWorkspace = async () => {
    try {
      setLoading(true);
      const data = await fetchWorkspace(serviceId);
      
      // Update state with safety fallbacks (|| []) so it never crashes
      setWorkspace(data.workspace);
      setDocuments(data.documents || data.pages || []); 
      setStats(data.stats || {});
      setContributors(data.contributors || []);
      
      const safeDocuments = data.documents || data.pages || [];
      
      // Auto-select the 'overview' system document on first load
      if (safeDocuments.length > 0) {
        const overviewDoc = safeDocuments.find(d => d.system_key === 'overview') || safeDocuments[0];
        setActiveDocumentId(overviewDoc.id);
      }
    } catch (err) {
      console.error("Workspace Load Error:", err);
      setError('Failed to load the Operations Workspace. Please check your backend connection.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <FiLoader className="animate-spin h-8 w-8 text-indigo-600" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-red-500 flex items-center justify-center gap-2 h-screen bg-gray-50">
        <FiAlertCircle className="h-6 w-6" /> {error}
      </div>
    );
  }

  // BULLETPROOF FINDER: Always fallback to an empty array before using .find()
  const activeDocument = (documents || []).find(d => d.id === activeDocumentId);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 text-gray-900 font-sans">
      
      {/* 1. Left Sidebar Navigation */}
      <WorkspaceSidebar 
        workspace={workspace}
        documents={documents || []} 
        activeDocumentId={activeDocumentId}
        onSelectDocument={(id) => {
          setActiveDocumentId(id);
          setIsEditMode(false); // Reset edit mode when changing tabs
        }}
      />

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        
        {/* Top Header */}
        <WorkspaceHeader 
          workspace={workspace} 
          stats={stats}
          contributors={contributors}
          isEditMode={isEditMode}
          setIsEditMode={setIsEditMode}
          onStatusChange={loadWorkspace} // Reload if published
        />
        
        {/* Document Editor / Viewer */}
        <div className="flex-1 overflow-y-auto p-6 lg:p-10">
          <div className="max-w-4xl mx-auto">
            {activeDocument ? (
              <DocumentEditor 
                key={activeDocument.id} // Forces React to reset state on doc change
                workspaceId={workspace.id}
                document={activeDocument}
                isEditMode={isEditMode}
                onSaveSuccess={loadWorkspace} // Reload fresh data after save
              />
            ) : (
              <div className="text-center text-gray-400 mt-20">Select a document from the sidebar to view.</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OperationsHub;