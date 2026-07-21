import React from 'react';
import { FiFileText, FiFolder, FiZap, FiSettings } from 'react-icons/fi';

const WorkspaceSidebar = ({ workspace, documents, activeDocumentId, onSelectDocument }) => {
  if (!workspace || !documents) return null;

  // Separate documents by type
  const systemDocs = documents.filter(d => d.type === 'SYSTEM');
  const customDocs = documents.filter(d => d.type === 'CUSTOM');

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-full flex-shrink-0">
      {/* Brand & Workspace Info */}
      <div className="px-5 py-6 border-b border-gray-200">
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white">
            <FiZap className="h-5 w-5" />
          </div>
          <h1 className="text-lg font-bold text-gray-900">Operations Hub</h1>
        </div>
        <div className="flex items-center gap-2">
          <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
            workspace.scope === 'GLOBAL' ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {workspace.scope}
          </span>
          <span className={`text-[10px] font-bold uppercase tracking-wide px-2 py-0.5 rounded-full ${
            workspace.status === 'published' ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-100 text-gray-600'
          }`}>
            {workspace.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {/* System Documents */}
        <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-3 mb-2 mt-2">Core Documents</div>
        {systemDocs.map(doc => (
          <button
            key={doc.id}
            onClick={() => onSelectDocument(doc.id)}
            className={`w-full flex items-center gap-2.5 px-3 py-2 mb-1 rounded-lg text-sm font-medium transition-all ${
              activeDocumentId === doc.id ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            <FiFileText className="h-4 w-4" /> {doc.title}
          </button>
        ))}

        {/* Custom Documents */}
        {customDocs.length > 0 && (
          <>
            <div className="text-[10px] font-semibold uppercase tracking-wider text-gray-400 px-3 mb-2 mt-6">Custom Pages</div>
            {customDocs.map(doc => (
              <button
                key={doc.id}
                onClick={() => onSelectDocument(doc.id)}
                className={`w-full flex items-center gap-2.5 px-3 py-2 mb-1 rounded-lg text-sm font-medium transition-all ${
                  activeDocumentId === doc.id ? 'bg-indigo-50 text-indigo-700' : 'text-gray-600 hover:bg-gray-50'
                }`}
              >
                <FiFolder className="h-4 w-4" /> {doc.title}
              </button>
            ))}
          </>
        )}
      </div>

      <div className="p-4 border-t border-gray-200">
        <button className="w-full flex items-center gap-2 text-sm text-gray-600 hover:text-gray-900 px-2 py-1.5 transition-colors">
          <FiSettings className="h-4 w-4" /> Workspace Settings
        </button>
      </div>
    </div>
  );
};

export default WorkspaceSidebar;