import React from 'react';
import { 
  FiUsers, FiMessageSquare, FiCheckCircle, FiLink, 
  FiFileText, FiArrowRight, FiPlus 
} from 'react-icons/fi';

const OverviewDashboard = ({ stats = {}, contributors = [], workspace, documents = [], setActiveTab }) => {
  
  // Find specific system documents for quick access
  const sopDoc = documents.find(d => d.system_key === 'sop');
  const faqDoc = documents.find(d => d.system_key === 'faq');

  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      
      {/* Header Section */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Service Overview</h2>
        <p className="text-sm text-gray-500 mt-1">
          {workspace?.scope === 'GLOBAL' ? 'Global standard operating procedures and service metrics.' : 'Centre-specific guidelines and overrides.'}
        </p>
      </div>

      {/* Top Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-5 text-center flex flex-col items-center justify-center hover:border-blue-200 transition-colors">
          <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center mb-3">
            <FiUsers className="h-5 w-5" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.contributors || 0}</div>
          <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mt-1">Contributors</div>
        </div>
        
        <div className="bg-white border border-gray-200 rounded-2xl p-5 text-center flex flex-col items-center justify-center hover:border-emerald-200 transition-colors">
          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-3">
            <FiMessageSquare className="h-5 w-5" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.discussionCount || 0}</div>
          <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mt-1">Discussions</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 text-center flex flex-col items-center justify-center hover:border-purple-200 transition-colors">
          <div className="w-10 h-10 bg-purple-50 text-purple-600 rounded-xl flex items-center justify-center mb-3">
            <FiCheckCircle className="h-5 w-5" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.caseCount || 0}</div>
          <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mt-1">Solved Cases</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5 text-center flex flex-col items-center justify-center hover:border-amber-200 transition-colors">
          <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-3">
            <FiLink className="h-5 w-5" />
          </div>
          <div className="text-2xl font-bold text-gray-900">{stats.resourceCount || 0}</div>
          <div className="text-xs text-gray-500 font-medium uppercase tracking-wider mt-1">Resources</div>
        </div>
      </div>

      {/* Quick Actions Panel */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button 
            onClick={() => setActiveTab('discussions')}
            className="flex flex-col items-center justify-center gap-2 p-4 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-700 text-gray-600 rounded-xl border border-transparent hover:border-indigo-100 transition-all"
          >
            <FiMessageSquare className="h-5 w-5" />
            <span className="text-xs font-semibold">Join Discussion</span>
          </button>
          <button 
            onClick={() => setActiveTab('resources')}
            className="flex flex-col items-center justify-center gap-2 p-4 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-700 text-gray-600 rounded-xl border border-transparent hover:border-indigo-100 transition-all"
          >
            <FiLink className="h-5 w-5" />
            <span className="text-xs font-semibold">Add Resource</span>
          </button>
          <button 
            onClick={() => sopDoc && setActiveTab(sopDoc.system_key || `doc-${sopDoc.id}`)}
            className="flex flex-col items-center justify-center gap-2 p-4 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-700 text-gray-600 rounded-xl border border-transparent hover:border-indigo-100 transition-all disabled:opacity-50"
            disabled={!sopDoc}
          >
            <FiFileText className="h-5 w-5" />
            <span className="text-xs font-semibold">Update SOP</span>
          </button>
          <button 
            onClick={() => faqDoc && setActiveTab(faqDoc.system_key || `doc-${faqDoc.id}`)}
            className="flex flex-col items-center justify-center gap-2 p-4 bg-gray-50 hover:bg-indigo-50 hover:text-indigo-700 text-gray-600 rounded-xl border border-transparent hover:border-indigo-100 transition-all disabled:opacity-50"
            disabled={!faqDoc}
          >
            <FiCheckCircle className="h-5 w-5" />
            <span className="text-xs font-semibold">Edit FAQ</span>
          </button>
        </div>
      </div>

      {/* Two Column Layout: Documents & Contributors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Core Documentation */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-gray-900 mb-4">Core Documentation</h3>
          <div className="space-y-3">
            {documents.length === 0 ? (
              <p className="text-sm text-gray-500 italic">No documents available.</p>
            ) : (
              documents.map(doc => (
                <div 
                  key={doc.id} 
                  onClick={() => setActiveTab(doc.system_key || `doc-${doc.id}`)}
                  className="group flex items-center justify-between p-3 rounded-xl border border-gray-100 hover:border-indigo-200 hover:bg-indigo-50/30 cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-indigo-50 text-indigo-600 rounded-lg group-hover:bg-indigo-100 transition-colors">
                      <FiFileText className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-gray-900 group-hover:text-indigo-700 transition-colors">{doc.title}</h4>
                      <p className="text-[11px] text-gray-500 uppercase tracking-wider font-semibold mt-0.5">
                        {doc.type === 'SYSTEM' ? 'Official Standard' : 'Custom Guide'}
                      </p>
                    </div>
                  </div>
                  <FiArrowRight className="text-gray-300 group-hover:text-indigo-500 transition-colors" />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Ownership & Contributors */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-gray-900">Ownership & Contributors</h3>
            <button className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 flex items-center gap-1">
              <FiPlus className="h-3 w-3" /> Add Staff
            </button>
          </div>
          
          {contributors.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-gray-200 rounded-xl bg-gray-50">
              <p className="text-sm text-gray-500">No contributors assigned.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {contributors.map(c => (
                <div key={c.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-transparent hover:border-gray-200 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">
                      {c.staff_name ? c.staff_name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-gray-900">{c.staff_name || 'Unknown Staff'}</div>
                      <div className="text-[11px] font-semibold text-indigo-600 uppercase tracking-wider">{c.role}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
};

export default OverviewDashboard;