import React from 'react';
import { 
  FiGrid, FiBook, FiHelpCircle, FiAward, FiBriefcase, 
  FiMessageSquare, FiShield, FiCheckSquare, FiLink, 
  FiFileText, FiFolder, FiZap
} from 'react-icons/fi';

const WorkspaceSidebar = ({ workspace, documents, activeTab, setActiveTab }) => {
  
  // Icon mapper for system documents
  const getIcon = (key, defaultIcon) => {
    const icons = {
      'overview': FiGrid,
      'sop': FiBook,
      'faq': FiHelpCircle,
      'training': FiAward,
      'government_orders': FiBriefcase
    };
    const Icon = icons[key] || defaultIcon;
    return <Icon className="h-4 w-4" />;
  };

  // Safe split of documents
  const systemDocs = documents.filter(d => d.type === 'SYSTEM');
  const customDocs = documents.filter(d => d.type === 'CUSTOM');

  const NavButton = ({ id, label, icon }) => (
    <button
      onClick={() => setActiveTab(id)}
      className={`w-full flex items-center gap-2.5 px-3 py-2 mb-0.5 rounded-lg text-sm font-medium transition-all ${
        activeTab === id ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
      }`}
    >
      {icon} {label}
    </button>
  );

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full flex-shrink-0">
      <div className="px-5 py-6 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white">
            <FiZap className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-bold text-gray-900">Operations</h1>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-6">
        
        {/* WORKSPACE */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-3 mb-2">Workspace</div>
          <NavButton id="overview" label="Overview" icon={<FiGrid className="h-4 w-4" />} />
        </div>

        {/* KNOWLEDGE */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-3 mb-2">Knowledge Base</div>
          {systemDocs.filter(d => d.system_key !== 'overview').map(doc => (
            <NavButton key={doc.id} id={doc.system_key} label={doc.title} icon={getIcon(doc.system_key, FiFileText)} />
          ))}
          {customDocs.map(doc => (
            <NavButton key={doc.id} id={`doc-${doc.id}`} label={doc.title} icon={<FiFolder className="h-4 w-4" />} />
          ))}
        </div>

        {/* COLLABORATION */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-3 mb-2">Collaboration</div>
          <NavButton id="discussions" label="Discussions" icon={<FiMessageSquare className="h-4 w-4" />} />
          <NavButton id="cases" label="Solved Cases" icon={<FiShield className="h-4 w-4" />} />
          <NavButton id="tasks" label="Tasks" icon={<FiCheckSquare className="h-4 w-4" />} />
        </div>

        {/* RESOURCES */}
        <div>
          <div className="text-[10px] font-bold uppercase tracking-wider text-gray-400 px-3 mb-2">Assets</div>
          <NavButton id="resources" label="Resources & Links" icon={<FiLink className="h-4 w-4" />} />
        </div>

      </div>
    </div>
  );
};

export default WorkspaceSidebar;