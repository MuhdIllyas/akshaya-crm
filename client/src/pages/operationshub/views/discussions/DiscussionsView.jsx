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
      <div className="mb-6 p-4 border border-gray-200 rounded-xl bg-gray-50 flex items-center gap-3 text-sm text-gray-500">
        <FiLoader className="animate-spin text-indigo-500" /> Loading attached application...
      </div>
    );
  }

  if (error || !record) {
    return (
      <div className="mb-6 p-4 border border-red-100 rounded-xl bg-red-50 text-sm text-red-600">
        {error || "Application details unavailable."}
      </div>
    );
  }

  return (
    <div className="mb-6 border border-indigo-100 bg-gradient-to-r from-indigo-50/50 to-white rounded-xl overflow-hidden shadow-sm animate-in fade-in slide-in-from-top-2">
      <div className="px-4 py-2.5 bg-indigo-50/80 border-b border-indigo-100 flex items-center justify-between">
        <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-800 flex items-center gap-1.5">
          <FiLayers /> Attached CRM Application
        </h4>
        <button 
          onClick={() => window.open(`/dashboard/staff/track_service/${record.trackingId}`, '_blank')}
          className="text-[11px] font-semibold bg-white border border-indigo-200 text-indigo-600 px-2.5 py-1 rounded shadow-sm hover:bg-indigo-50 flex items-center gap-1 transition"
        >
          View Full File <FiExternalLink />
        </button>
      </div>

      <div className="p-4 grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="text-sm font-bold text-gray-900">{record.id}</span>
            <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${
              record.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 
              record.status === 'rejected' ? 'bg-red-50 text-red-700 border-red-200' : 
              'bg-amber-50 text-amber-700 border-amber-200'
            }`}>
              {record.status}
            </span>
          </div>
          <div className="text-sm text-gray-800 font-medium">{record.title}</div>
          <div className="text-xs text-gray-500 flex items-center gap-1">
            <FiLayers className="inline h-3 w-3" /> {record.subcategory || 'General'}
          </div>
        </div>

        <div className="space-y-1.5 md:border-l md:border-gray-100 md:pl-6">
          <div className="text-xs text-gray-600 flex items-center gap-2">
            <FiUser className="text-gray-400" /> 
            <span className="font-semibold text-gray-800">{record.customer || 'Walk-in'}</span>
          </div>
          <div className="text-xs text-gray-600 flex items-center gap-2">
            <FiPhone className="text-gray-400" /> {record.phone || 'N/A'}
          </div>
          <div className="text-xs text-gray-600 flex items-center gap-2 pt-1">
            <FiBriefcase className="text-indigo-400" /> 
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
const DiscussionsView = ({ workspaceId }) => {
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

  if (isLoading) return <div className="p-12 flex justify-center"><FiLoader className="animate-spin h-8 w-8 text-indigo-500" /></div>;

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

      <CreateDiscussionModal 
        isOpen={isModalOpen} 
        existingDraft={null} 
        onClose={() => setIsModalOpen(false)} 
        onSubmit={handleCreateDiscussion} 
        preselectedServiceId={workspaceId} 
        preselectedServiceName="Current Workspace"
      />
    </div>
  );
};

export default DiscussionsView;