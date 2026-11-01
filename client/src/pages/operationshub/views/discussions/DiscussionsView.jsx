//handle Service Workspace Discussion View
import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { 
  FiLoader, 
  FiLayers, 
  FiUser, 
  FiPhone, 
  FiBriefcase, 
  FiExternalLink 
} from 'react-icons/fi';
import DiscussionsList from './DiscussionsList';
import DiscussionThread from './DiscussionThread';
import CreateDiscussionModal from './CreateDiscussionModal';
import { fetchDiscussions, createDiscussion, lookupCrmRecord } from '@/services/knowledge';

// =====================================================================
// 1. THE LINKED CRM CARD COMPONENT (Added for Workspace View!)
// =====================================================================
const LinkedCrmCard = ({ crmId }) => {
  const [record, setRecord] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!crmId) return;
    
    const fetchDetails = async () => {
      try {
        setLoading(true);
        const data = await lookupCrmRecord('serviceEntry', crmId);
        setRecord(data);
      } catch (err) {
        setError("Could not load linked CRM record. It may have been deleted or belongs to another centre.");
      } finally {
        setLoading(false);
      }
    };

    fetchDetails();
  }, [crmId]);

  if (loading) {
    return (
      <div className="mb-6 p-4 border border-slate-200 rounded-xl bg-slate-50 flex items-center gap-3 text-sm text-slate-500">
        <FiLoader className="animate-spin text-navy-500" /> Loading attached application...
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="mb-6 p-4 border border-rose-100 rounded-xl bg-rose-50 text-sm text-rose-600">
        {error || "Application details unavailable."}
      </div>
    );
  }

  return (
    <div className="mb-6 border border-navy-500/10 bg-gradient-to-r from-navy-500/10/50 to-white rounded-xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-top-2">
      <div className="px-4 py-2.5 bg-navy-500/10/80 border-b border-navy-500/10 flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-navy-700 flex items-center gap-1.5">
          <FiLayers /> Attached CRM Application
        </h4>
        <button 
          onClick={() => window.open(`/dashboard/staff/track_service/${record.trackingId}`, '_blank')}
          className="text-[11px] font-semibold bg-white border border-navy-500/20 text-navy-700 px-2.5 py-1 rounded shadow-sm hover:bg-navy-500/10 flex items-center gap-1 transition"
        >
          View Full File <FiExternalLink />
        </button>
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-slate-900">{record.id}</span>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
              record.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
              record.status === 'rejected' ? 'bg-rose-50 text-rose-700 border-rose-200' : 
              'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              {record.status}
            </span>
          </div>
          <div className="text-sm text-slate-800 font-medium">{record.title}</div>
          <div className="text-xs text-slate-500 flex items-center gap-1">
            <FiLayers className="inline h-3 w-3" /> {record.subcategory || 'General'}
          </div>
        </div>

        <div className="space-y-1.5 md:border-l md:border-slate-100 md:pl-6">
          <div className="text-xs text-slate-600 flex items-center gap-2">
            <FiUser className="text-slate-400" /> 
            <span className="font-semibold text-slate-800">{record.customer || 'Walk-in'}</span>
          </div>
          <div className="text-xs text-slate-600 flex items-center gap-2">
            <FiPhone className="text-slate-400" /> {record.phone || 'N/A'}
          </div>
          <div className="text-xs text-slate-600 flex items-center gap-2 pt-1">
            <FiBriefcase className="text-navy-500" /> 
            Assigned to: <span className="font-medium">{record.assignedTo || 'Unassigned'}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// =====================================================================
// 2. MAIN PAGE COMPONENT
// =====================================================================
const DiscussionsView = ({ workspaceId, serviceId, serviceName }) => {
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  const [discussions, setDiscussions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadDiscussions = async () => {
    try {
      setIsLoading(true);
      const data = await fetchDiscussions(workspaceId);
      
      const formatted = data.map(d => ({
        ...d,
        preview: d.content ? d.content.substring(0, 100) + '...' : '',
        description: d.content,
        solved: d.status === 'solved',
        author: d.author_name || 'Staff',
        lastReply: new Date(d.updated_at).toLocaleDateString(),
        replies_count: d.replies ? d.replies.length : 0,
        tags: d.tags || [],
        replies: (d.replies || []).map(r => ({
          ...r,
          id: r.id,
          author: r.author_name || 'Staff',
          content: r.content,
          is_best: r.is_best_answer
        }))
      }));

      setDiscussions(formatted);
    } catch (err) {
      console.error(err);
      toast.error('Failed to load discussions from database.');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (workspaceId) loadDiscussions();
  }, [workspaceId]);

  const handleCreateDiscussion = async (formData) => {
    try {
      await createDiscussion(workspaceId, formData);
      toast.success('Discussion posted successfully!');
      setIsModalOpen(false);
      loadDiscussions(); 
    } catch (err) {
      throw err; 
    }
  };

  if (isLoading) return <div className="p-12 flex justify-center"><FiLoader className="animate-spin h-8 w-8 text-navy-500" /></div>;

  const activeDiscussion = discussions.find(d => d.id === activeThreadId);

  return (
    <div className="relative animate-in fade-in duration-300">
      {activeThreadId && activeDiscussion ? (
        
        <div className="space-y-4">
          {/* 🔥 THE FIX: Now rendering the beautiful CRM card inside the Workspace View! */}
          {activeDiscussion.crm_application && (
            <LinkedCrmCard crmId={activeDiscussion.crm_application} />
          )}

          <DiscussionThread 
            discussion={activeDiscussion} 
            onBack={() => setActiveThreadId(null)} 
            onUpdate={loadDiscussions} 
          />
        </div>

      ) : (
        <DiscussionsList 
          discussions={discussions} 
          onOpenThread={(id) => setActiveThreadId(id)} 
          onCreateNew={() => setIsModalOpen(true)} 
        />
      )}

      {/* PHASE 1 FIX:
          - correct prop names (the modal reads lockedServiceId / lockedWorkspaceId),
            so the service is locked and the CRM check runs against THIS service
          - only mounted while open, so the form starts empty every time */}
      {isModalOpen && (
        <CreateDiscussionModal
          isOpen={isModalOpen}
          existingDraft={null}
          onClose={() => setIsModalOpen(false)}
          onSubmit={handleCreateDiscussion}
          lockedServiceId={serviceId}
          lockedServiceName={serviceName || 'Current Service'}
          lockedWorkspaceId={workspaceId}
        />
      )}
    </div>
  );
};

export default DiscussionsView;