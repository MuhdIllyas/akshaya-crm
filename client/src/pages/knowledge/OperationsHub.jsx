import React, { useState, useEffect } from 'react';
import { FiLoader, FiAlertCircle } from 'react-icons/fi';
import { fetchWorkspace } from '@/services/knowledge';
import WorkspaceSidebar from './WorkspaceSidebar';
import DocumentEditor from './DocumentEditor';
import WorkspaceHeader from './WorkspaceHeader';

const OperationsHub = ({ serviceId = 10 }) => { // serviceId passed from CRM route
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [workspaceData, setWorkspaceData] = useState(null);
  
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
      setWorkspaceData(data);
      
      // Auto-select the 'Overview' document (or the first available)
      if (data.documents && data.documents.length > 0) {
        const overview = data.documents.find(d => d.system_key === 'overview') || data.documents[0];
        setActiveDocumentId(overview.id);
      }
    } catch (err) {
      setError('Failed to load workspace.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><FiLoader className="animate-spin h-8 w-8 text-indigo-600" /></div>;
  if (error) return <div className="p-8 text-red-500 flex items-center gap-2"><FiAlertCircle /> {error}</div>;

  const activeDocument = workspaceData.documents.find(d => d.id === activeDocumentId);

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 text-gray-900">
      {/* 1. Sidebar for Document Navigation */}
      <WorkspaceSidebar 
        workspace={workspaceData.workspace}
        documents={workspaceData.documents} 
        activeDocumentId={activeDocumentId}
        onSelectDocument={(id) => {
          setActiveDocumentId(id);
          setIsEditMode(false); // Reset edit mode on tab switch
        }}
      />

      {/* 2. Main Content Area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        <WorkspaceHeader 
          workspace={workspaceData.workspace} 
          stats={workspaceData.stats}
          isEditMode={isEditMode}
          setIsEditMode={setIsEditMode}
        />
        
        <div className="flex-1 overflow-y-auto p-6 lg:p-10">
          <div className="max-w-4xl mx-auto">
            {activeDocument ? (
              <DocumentEditor 
                key={activeDocument.id} // Forces re-render on document change
                workspaceId={workspaceData.workspace.id}
                document={activeDocument}
                isEditMode={isEditMode}
                onSaveSuccess={loadWorkspace} // Reload fresh data after save
              />
            ) : (
              <div className="text-center text-gray-400 mt-20">Select a document to view</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OperationsHub;