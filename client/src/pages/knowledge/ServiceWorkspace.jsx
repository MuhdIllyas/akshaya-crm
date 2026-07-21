import React, { useState, useEffect } from 'react';
import { 
  FiGrid, FiFileText, FiMessageSquare, FiLink, 
  FiGlobe, FiCheckCircle, FiClock, FiChevronLeft, FiLoader, FiAlertCircle 
} from 'react-icons/fi';
import { fetchWorkspace } from '@/services/knowledge'; 
import DocumentEditor from './DocumentEditor'; 

const ServiceWorkspace = ({ serviceId, navigateTo }) => {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  // Dynamic State from Backend
  const [workspace, setWorkspace] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [resources, setResources] = useState([]);
  const [stats, setStats] = useState(null);
  
  // UI State
  const [activeTab, setActiveTab] = useState('dashboard');
  const [isEditMode, setIsEditMode] = useState(false);

  useEffect(() => {
    loadWorkspaceData();
  }, [serviceId]);

  const loadWorkspaceData = async () => {
    try {
      setLoading(true);
      const data = await fetchWorkspace(serviceId);
      setWorkspace(data.workspace);
      setDocuments(data.documents || data.pages || []);
      setResources(data.resources);
      setStats(data.stats);
    } catch (err) {
      setError('Failed to load workspace.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) return <div className="p-12 flex justify-center"><FiLoader className="animate-spin h-8 w-8 text-indigo-500" /></div>;
  if (error) return <div className="p-12 flex justify-center text-red-500 gap-2"><FiAlertCircle /> {error}</div>;

  // We map the dynamic documents into tabs, alongside the static Dashboard/Cases tabs
  const documentTabs = documents.map(doc => ({
    id: `doc-${doc.id}`,
    documentId: doc.id,
    label: doc.title,
    icon: doc.system_key === 'faq' ? FiMessageSquare : FiFileText
  }));

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: FiGrid },
    ...documentTabs, // Dynamically insert documents (Overview, SOP, FAQ, etc.)
    { id: 'resources', label: 'Resources', icon: FiLink },
    { id: 'cases', label: 'Cases', icon: FiCheckCircle },
  ];

  // Helper to find if the current active tab is a Document
  const activeDocument = (documents || []).find(d => d.id === activeDocumentId);

  return (
    <div className="max-w-6xl mx-auto">
      {/* Header (Kept exactly from your code) */}
      <div className="flex items-center gap-3 mb-4">
        <button className="p-2 hover:bg-gray-100 rounded-lg transition" onClick={() => navigateTo('services')}>
          <FiChevronLeft className="h-5 w-5 text-gray-500" />
        </button>
        <div className="p-2.5 bg-indigo-50 text-indigo-600 rounded-xl">
          <FiFileText className="h-6 w-6" />
        </div>
        <h2 className="text-xl font-bold text-gray-900">Workspace {workspace.scope === 'CENTRE' ? '(Local Override)' : '(Global)'}</h2>
        <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
          workspace.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-700'
        }`}>
          {workspace.status.toUpperCase()}
        </span>
      </div>

      {/* Tabs Navigation (Kept exactly from your code) */}
      <div className="border-b border-gray-200 mb-4">
        <div className="flex flex-wrap gap-2 overflow-x-auto">
          {tabs.map(tab => (
            <button
              key={tab.id}
              className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium border-b-2 transition whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
              onClick={() => {
                setActiveTab(tab.id);
                setIsEditMode(false); // Reset edit mode on tab change
              }}
            >
              <tab.icon className="h-4 w-4" /> {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Main Content Area */}
      <div className="bg-white border border-gray-200 rounded-xl p-4 sm:p-6 min-h-[500px]">
        
        {/* 1. DASHBOARD VIEW (Wired to dynamic stats) */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-indigo-50 p-4 rounded-xl text-center">
                <div className="text-2xl font-bold text-indigo-600">{stats.contributors}</div>
                <div className="text-xs text-gray-600 mt-1">Contributors</div>
              </div>
              <div className="bg-amber-50 p-4 rounded-xl text-center">
                <div className="text-2xl font-bold text-amber-600">{stats.resourceCount}</div>
                <div className="text-xs text-gray-600 mt-1">Resources</div>
              </div>
              <div className="bg-green-50 p-4 rounded-xl text-center">
                <div className="text-2xl font-bold text-green-600">{stats.discussionCount}</div>
                <div className="text-xs text-gray-600 mt-1">Discussions</div>
              </div>
              <div className="bg-purple-50 p-4 rounded-xl text-center">
                <div className="text-2xl font-bold text-purple-600">{stats.caseCount}</div>
                <div className="text-xs text-gray-600 mt-1">Solved Cases</div>
              </div>
            </div>
            
            <div>
              <h4 className="font-semibold text-sm text-gray-900 mb-3">Workspace Details</h4>
              <div className="text-sm text-gray-600 space-y-2">
                <p><strong>Last Updated:</strong> {new Date(stats.lastUpdated).toLocaleDateString()}</p>
                <p><strong>Scope:</strong> {workspace.scope}</p>
              </div>
            </div>
          </div>
        )}

        {/* 2. DYNAMIC DOCUMENT VIEW (Replaces hardcoded SOP/FAQ) */}
        {activeDocument && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-900">{activeDocument.title}</h3>
              <button 
                onClick={() => setIsEditMode(!isEditMode)}
                className="text-sm bg-gray-100 text-gray-700 px-3 py-1.5 rounded-lg hover:bg-gray-200"
              >
                {isEditMode ? 'Cancel Edit' : 'Edit Document'}
              </button>
            </div>
            
            {/* We will build this DocumentEditor component next! */}
            <DocumentEditor 
              workspaceId={workspace.id}
              document={activeDocument}
              isEditMode={isEditMode}
              onSaveSuccess={() => {
                setIsEditMode(false);
                loadWorkspaceData();
              }}
            />
          </div>
        )}

        {/* 3. RESOURCES VIEW */}
        {activeTab === 'resources' && (
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-semibold text-gray-900">Resources & Links</h3>
              <button className="text-sm text-indigo-600 hover:text-indigo-800 font-medium">+ Add Resource</button>
            </div>
            {resources.length > 0 ? (
              <ul className="space-y-3">
                {resources.map((res) => (
                  <li key={res.id} className="flex items-center gap-3 p-3 border border-gray-100 rounded-lg hover:bg-gray-50">
                    <FiLink className="h-5 w-5 text-indigo-500" />
                    <div>
                      <a href={res.url} target="_blank" rel="noopener noreferrer" className="text-sm font-medium text-indigo-600 hover:underline">
                        {res.title}
                      </a>
                      <p className="text-xs text-gray-500">{res.type}</p>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm text-gray-500 text-center py-8">No resources added yet.</p>
            )}
          </div>
        )}

        {/* 4. CASES VIEW */}
        {activeTab === 'cases' && (
          <div className="text-center py-12 text-gray-500">
            <FiCheckCircle className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>Cases module coming soon.</p>
          </div>
        )}

      </div>
    </div>
  );
};

export default ServiceWorkspace;