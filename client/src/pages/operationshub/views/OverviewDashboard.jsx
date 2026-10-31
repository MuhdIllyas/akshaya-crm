import React, { useState } from 'react';
import { 
  FiUsers, FiMessageSquare, FiCheckCircle, FiLink, 
  FiFileText, FiArrowRight, FiPlus, FiX 
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import { can } from '@/utils/knowledgePermissions';
import { removeContributor } from '@/services/knowledge';
import AddContributorModal from './AddContributorModal';

const OverviewDashboard = ({ stats = {}, contributors = [], workspace, documents = [], setActiveTab, onUpdate }) => {
  const [showAddContributor, setShowAddContributor] = useState(false);
  
  // Find specific system documents for quick access
  const sopDoc = documents.find(d => d.system_key === 'sop');
  const faqDoc = documents.find(d => d.system_key === 'faq');

  // PHASE 2: labels match what this user can actually do
  const canEditDocs = can('document.edit', { workspace });
  const canAddResource = can('resource.add', { workspace });
  const canManageContributors = can('contributor.manage', { workspace });

  const handleRemoveContributor = async (c) => {
    if (!window.confirm(`Remove ${c.staff_name} from this service's contributors?`)) return;
    try {
      await removeContributor(workspace.id, c.staff_id);
      toast.success(`${c.staff_name} removed`);
      onUpdate?.();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to remove contributor');
    }
  };

  return (
    <div className="animate-in fade-in duration-300 space-y-6">
      
      {/* Header Section */}
      <div>
        <h2 className="text-2xl font-bold text-slate-900">Service Overview</h2>
        <p className="text-sm text-slate-500 mt-1">
          {workspace?.scope === 'GLOBAL' ? 'Global standard operating procedures and service metrics.' : 'Centre-specific guidelines and overrides.'}
        </p>
      </div>

      {/* Top Metrics Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-2xl p-5 text-center flex flex-col items-center justify-center hover:border-navy-500/20 transition-colors">
          <div className="w-10 h-10 bg-navy-500/10 text-navy-700 rounded-xl flex items-center justify-center mb-3">
            <FiUsers className="h-5 w-5" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.contributors || 0}</div>
          <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">Contributors</div>
        </div>
        
        <div className="bg-white border border-slate-200 rounded-2xl p-5 text-center flex flex-col items-center justify-center hover:border-emerald-200 transition-colors">
          <div className="w-10 h-10 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center mb-3">
            <FiMessageSquare className="h-5 w-5" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.discussionCount || 0}</div>
          <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">Discussions</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 text-center flex flex-col items-center justify-center hover:border-navy-500/20 transition-colors">
          <div className="w-10 h-10 bg-navy-500/10 text-navy-700 rounded-xl flex items-center justify-center mb-3">
            <FiCheckCircle className="h-5 w-5" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.caseCount || 0}</div>
          <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">Solved Cases</div>
        </div>

        <div className="bg-white border border-slate-200 rounded-2xl p-5 text-center flex flex-col items-center justify-center hover:border-amber-200 transition-colors">
          <div className="w-10 h-10 bg-amber-50 text-amber-600 rounded-xl flex items-center justify-center mb-3">
            <FiLink className="h-5 w-5" />
          </div>
          <div className="text-2xl font-bold text-slate-900">{stats.resourceCount || 0}</div>
          <div className="text-xs text-slate-500 font-medium uppercase tracking-wider mt-1">Resources</div>
        </div>
      </div>

      {/* Quick Actions Panel */}
      <div className="bg-white border border-slate-200 rounded-2xl p-5">
        <h3 className="text-sm font-bold text-slate-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <button 
            onClick={() => setActiveTab('discussions')}
            className="flex flex-col items-center justify-center gap-2 p-4 bg-slate-50 hover:bg-navy-500/10 hover:text-navy-700 text-slate-600 rounded-xl border border-transparent hover:border-navy-500/10 transition-all"
          >
            <FiMessageSquare className="h-5 w-5" />
            <span className="text-xs font-semibold">Join Discussion</span>
          </button>
          <button 
            onClick={() => setActiveTab('resources')}
            className="flex flex-col items-center justify-center gap-2 p-4 bg-slate-50 hover:bg-navy-500/10 hover:text-navy-700 text-slate-600 rounded-xl border border-transparent hover:border-navy-500/10 transition-all"
          >
            <FiLink className="h-5 w-5" />
            <span className="text-xs font-semibold">{canAddResource ? 'Add Resource' : 'View Resources'}</span>
          </button>
          <button 
            onClick={() => sopDoc && setActiveTab(sopDoc.system_key || `doc-${sopDoc.id}`)}
            className="flex flex-col items-center justify-center gap-2 p-4 bg-slate-50 hover:bg-navy-500/10 hover:text-navy-700 text-slate-600 rounded-xl border border-transparent hover:border-navy-500/10 transition-all disabled:opacity-50"
            disabled={!sopDoc}
          >
            <FiFileText className="h-5 w-5" />
            <span className="text-xs font-semibold">{canEditDocs ? 'Update SOP' : 'Read SOP'}</span>
          </button>
          <button 
            onClick={() => faqDoc && setActiveTab(faqDoc.system_key || `doc-${faqDoc.id}`)}
            className="flex flex-col items-center justify-center gap-2 p-4 bg-slate-50 hover:bg-navy-500/10 hover:text-navy-700 text-slate-600 rounded-xl border border-transparent hover:border-navy-500/10 transition-all disabled:opacity-50"
            disabled={!faqDoc}
          >
            <FiCheckCircle className="h-5 w-5" />
            <span className="text-xs font-semibold">{canEditDocs ? 'Edit FAQ' : 'Read FAQ'}</span>
          </button>
        </div>
      </div>

      {/* Two Column Layout: Documents & Contributors */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Core Documentation */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <h3 className="text-sm font-bold text-slate-900 mb-4">Core Documentation</h3>
          <div className="space-y-3">
            {documents.length === 0 ? (
              <p className="text-sm text-slate-500 italic">No documents available.</p>
            ) : (
              documents.map(doc => (
                <div 
                  key={doc.id} 
                  onClick={() => setActiveTab(doc.system_key || `doc-${doc.id}`)}
                  className="group flex items-center justify-between p-3 rounded-xl border border-slate-100 hover:border-navy-500/20 hover:bg-navy-500/10/30 cursor-pointer transition-all"
                >
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-navy-500/10 text-navy-700 rounded-lg group-hover:bg-navy-500/10 transition-colors">
                      <FiFileText className="h-4 w-4" />
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-slate-900 group-hover:text-navy-700 transition-colors">{doc.title}</h4>
                      <p className="text-[11px] text-slate-500 uppercase tracking-wider font-semibold mt-0.5">
                        {doc.type === 'SYSTEM' ? 'Official Standard' : 'Custom Guide'}
                      </p>
                    </div>
                  </div>
                  <FiArrowRight className="text-slate-300 group-hover:text-navy-500 transition-colors" />
                </div>
              ))
            )}
          </div>
        </div>

        {/* Ownership & Contributors */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-bold text-slate-900">Ownership & Contributors</h3>
            {canManageContributors && (
              <button
                onClick={() => setShowAddContributor(true)}
                className="text-xs font-semibold text-navy-700 hover:underline flex items-center gap-1"
              >
                <FiPlus className="h-3 w-3" /> Add Staff
              </button>
            )}
          </div>
          
          {contributors.length === 0 ? (
            <div className="text-center py-8 border border-dashed border-slate-200 rounded-xl bg-slate-50">
              <p className="text-sm text-slate-500">No contributors assigned.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {contributors.map(c => (
                <div key={c.id || c.staff_id} className="group flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-transparent hover:border-slate-200 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 bg-gradient-to-br from-navy-500 to-navy-700 rounded-full flex items-center justify-center text-white text-xs font-bold shadow-sm">
                      {c.staff_name ? c.staff_name.charAt(0).toUpperCase() : 'U'}
                    </div>
                    <div>
                      <div className="text-sm font-bold text-slate-900">{c.staff_name || 'Unknown Staff'}</div>
                      <div className="text-[11px] font-semibold text-navy-700 uppercase tracking-wider">{c.role}</div>
                    </div>
                  </div>
                  {canManageContributors && (
                    <button
                      onClick={() => handleRemoveContributor(c)}
                      className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition"
                      title="Remove contributor"
                    >
                      <FiX className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

      </div>

      {showAddContributor && (
        <AddContributorModal
          workspaceId={workspace.id}
          existingStaffIds={contributors.map(c => c.staff_id)}
          onClose={() => setShowAddContributor(false)}
          onAdded={() => { setShowAddContributor(false); onUpdate?.(); }}
        />
      )}
    </div>
  );
};

export default OverviewDashboard;