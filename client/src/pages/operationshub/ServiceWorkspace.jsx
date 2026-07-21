import React, { useState, useEffect } from 'react';
import { 
  FiGrid, FiFileText, FiMessageSquare, FiLink, 
  FiGlobe, FiCheckCircle, FiClock, FiChevronLeft, FiLoader, FiAlertCircle, FiAward, FiBriefcase, FiFolder
} from 'react-icons/fi';
import { fetchWorkspace, updateWorkspaceStatus } from '@/services/knowledge'; 
import { toast } from 'react-toastify';

// Import our modular views
import OverviewDashboard from './views/OverviewDashboard';
import DocumentView from './views/DocumentView';
import ResourcesGrid from './views/ResourcesGrid';
import ComingSoon from './views/ComingSoon';
import DiscussionsView from './views/discussions/DiscussionsView';

const ServiceWorkspace = ({ serviceId, navigateTo, mockService }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Real Database State
  const [workspace, setWorkspace] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [resources, setResources] = useState([]);
  const [stats, setStats] = useState({});
  const [contributors, setContributors] = useState([]);
  
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isPublishing, setIsPublishing] = useState(false);

  useEffect(() => {
    loadWorkspaceData();
  }, [serviceId]);

  const loadWorkspaceData = async () => {
    try {
      setLoading(true);
      const data = await fetchWorkspace(serviceId);
      setWorkspace(data.workspace);
      setDocuments(data.documents || data.pages || []);
      setResources(data.resources || []);
      setStats(data.stats || {});
      setContributors(data.contributors || []);
    } catch (err) {
      console.error(err);
      setError('Failed to load workspace from database.');
    } finally {
      setLoading(false);
    }
  };

  const handlePublish = async () => {
    try {
      setIsPublishing(true);
      await updateWorkspaceStatus(workspace.id, 'published');
      toast.success('Workspace published successfully!');
      loadWorkspaceData(); // Refresh UI
    } catch (err) {
      toast.error('Failed to publish workspace.');
    } finally {
      setIsPublishing(false);
    }
  };

  if (loading) return <div className="p-12 flex justify-center"><FiLoader className="animate-spin h-8 w-8 text-indigo-500" /></div>;
  if (error) return <div className="p-12 flex justify-center text-red-500 gap-2"><FiAlertCircle /> {error}</div>;
  if (!workspace) return <div className="p-12 flex justify-center text-gray-500"><FiLoader className="animate-spin h-5 w-5 mr-2" /> Initializing Workspace Data...</div>;

  // 1. Map Documents to Tabs
  const documentTabs = documents.map(doc => {
    let icon = FiFileText;
    if (doc.system_key === 'faq') icon = FiMessageSquare;
    if (doc.system_key === 'training') icon = FiAward;
    if (doc.system_key === 'government_orders') icon = FiBriefcase;
    if (doc.type === 'CUSTOM') icon = FiFolder;

    return {
      id: doc.system_key || `doc-${doc.id}`,
      label: doc.title,
      icon: icon
    };
  }).filter(tab => tab.id !== 'overview'); // Keep Overview separate as 'dashboard'

  // 2. Build Final Tabs Array
  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: FiGrid },
    ...documentTabs,
    { id: 'discussions', label: 'Discussions', icon: FiMessageSquare }, // <--- Add this!
    { id: 'resources', label: 'Resources', icon: FiLink },
    { id: 'cases', label: 'Cases', icon: FiCheckCircle },
  ];

  // 3. Document Router
  const renderContent = () => {
    if (activeTab === 'dashboard') {
      return <OverviewDashboard stats={stats} contributors={contributors} workspace={workspace} documents={documents} setActiveTab={setActiveTab} />;
    }
    if (activeTab === 'discussions') { 
      return <DiscussionsView workspaceId={workspace.id} serviceId={serviceId} />;
    }
    if (activeTab === 'resources') {
      return <ResourcesGrid resources={resources} workspaceId={workspace.id} onUpdate={loadWorkspaceData} />;
    }
    if (activeTab === 'cases') {
      return <ComingSoon moduleName="Solved Cases" />;
    }
    
    const activeDoc = documents.find(d => d.system_key === activeTab || `doc-${d.id}` === activeTab);
    if (activeDoc) {
      // DocumentView now handles its own Edit mode and block rendering!
      return <DocumentView key={activeDoc.id} document={activeDoc} workspaceId={workspace.id} onUpdate={loadWorkspaceData} />;
    }

    return <div className="text-center text-gray-500 py-12">Tab content not found.</div>;
  };

  return (
    <div className="max-w-6xl mx-auto font-sans">
      {/* HEADER (Restored Original Layout) */}
      <div className="flex flex-wrap items-center justify-between mb-6 gap-4">
        <div className="flex items-center gap-3">
          <button className="p-2 hover:bg-gray-100 rounded-lg transition" onClick={() => navigateTo('services')}>
            <FiChevronLeft className="h-5 w-5 text-gray-500" />
          </button>
          <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
            {mockService ? <mockService.icon className="h-6 w-6" /> : <FiFileText className="h-6 w-6" />}
          </div>
          <h2 className="text-xl font-bold text-gray-900">{mockService ? mockService.name : 'Workspace'}</h2>
          
          <span className={`text-xs px-2.5 py-1 rounded-full font-bold uppercase tracking-wide ${
            workspace.scope === 'GLOBAL' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {workspace.scope}
          </span>
        </div>

        {/* Publish Controls moved to the top right of the workspace */}
        <div className="flex items-center gap-3">
          <span className={`text-[11px] font-bold uppercase tracking-wider px-3 py-1.5 rounded-lg border ${
            workspace.status === 'published' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-gray-100 text-gray-700 border-gray-200'
          }`}>
            {workspace.status.replace('_', ' ')}
          </span>
          {workspace.status !== 'published' && (
            <button 
              onClick={handlePublish} 
              disabled={isPublishing} 
              className="bg-emerald-600 text-white px-4 py-1.5 rounded-lg text-sm font-medium hover:bg-emerald-700 transition disabled:opacity-50"
            >
              {isPublishing ? 'Publishing...' : 'Publish'}
            </button>
          )}
        </div>
      </div>

      {/* HORIZONTAL TABS */}
      <div className="border-b border-gray-200 mb-6">
        <div className="flex flex-wrap gap-2 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600 bg-indigo-50/50 rounded-t-lg'
                  : 'border-transparent text-gray-500 hover:text-gray-900 hover:border-gray-300'
              }`}
              onClick={() => setActiveTab(tab.id)}
            >
              <tab.icon className="h-4 w-4" /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* MAIN CONTENT ROUTER */}
      <div className="min-h-[500px]">
        {renderContent()}
      </div>
    </div>
  );
};

export default ServiceWorkspace;