import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { FiLoader, FiAlertCircle } from 'react-icons/fi';
import { fetchWorkspace } from '../../services/knowledge';
import WorkspaceSidebar from './WorkspaceSidebar';
import WorkspaceHeader from './WorkspaceHeader';

// The Bespoke Views
import OverviewDashboard from './views/OverviewDashboard';
import ResourcesGrid from './views/ResourcesGrid';
import DocumentView from './views/DocumentView';
import ComingSoon from './views/ComingSoon';

const OperationsHub = () => { 
  const { serviceId } = useParams(); 
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Data State
  const [workspace, setWorkspace] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [resources, setResources] = useState([]);
  const [stats, setStats] = useState({});
  const [contributors, setContributors] = useState([]);
  
  // UI State: Now strictly relies on a string 'tab' identifier
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    loadWorkspace();
  }, [serviceId]);

  const loadWorkspace = async () => {
    try {
      setLoading(true);
      const data = await fetchWorkspace(serviceId);
      
      setWorkspace(data.workspace);
      setDocuments(data.documents || data.pages || []); 
      setResources(data.resources || []);
      setStats(data.stats || {});
      setContributors(data.contributors || []);
      
    } catch (err) {
      setError('Failed to load the Operations Workspace.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="flex h-screen items-center justify-center"><FiLoader className="animate-spin h-8 w-8 text-indigo-600" /></div>;
  if (error) return <div className="p-8 text-red-500 flex justify-center gap-2"><FiAlertCircle /> {error}</div>;

  // ==========================================
  // THE DOCUMENT ROUTER
  // ==========================================
  const renderContent = () => {
    // 1. Bespoke Dashboards & Grids
    if (activeTab === 'overview') return <OverviewDashboard stats={stats} contributors={contributors} workspace={workspace} documents={documents} setActiveTab={setActiveTab} />;
    if (activeTab === 'resources') return <ResourcesGrid resources={resources} workspaceId={workspace.id} onUpdate={loadWorkspace} />;
    if (['discussions', 'cases', 'tasks'].includes(activeTab)) return <ComingSoon moduleName={activeTab} />;

    // 2. Document Rendering (SOP, FAQ, Custom Pages)
    // Find the document by system_key OR by the dynamic doc-id
    const activeDoc = documents.find(d => d.system_key === activeTab || `doc-${d.id}` === activeTab);
    
    if (activeDoc) {
      return <DocumentView key={activeDoc.id} document={activeDoc} workspaceId={workspace.id} onUpdate={loadWorkspace} />;
    }

    return <div className="text-center text-gray-400 mt-20">Document not found.</div>;
  };

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50 text-gray-900 font-sans">
      <WorkspaceSidebar 
        workspace={workspace}
        documents={documents} 
        activeTab={activeTab}
        setActiveTab={setActiveTab}
      />
      <div className="flex-1 flex flex-col overflow-hidden">
        <WorkspaceHeader 
          workspace={workspace} 
          stats={stats}
          onStatusChange={loadWorkspace} 
        />
        <div className="flex-1 overflow-y-auto p-6 lg:p-10">
          <div className="max-w-5xl mx-auto">
            {renderContent()}
          </div>
        </div>
      </div>
    </div>
  );
};

export default OperationsHub;