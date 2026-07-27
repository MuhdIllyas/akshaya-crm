import React, { useState, useEffect } from 'react';
import { 
  FiLoader, 
  FiAlertCircle, 
  FiLayers, 
  FiUser, 
  FiPhone, 
  FiBriefcase, 
  FiExternalLink 
} from 'react-icons/fi';
import { fetchDiscussionById, logRecentView, lookupCrmRecord } from '@/services/knowledge';
import DiscussionThread from './discussions/DiscussionThread';

// =====================================================================
// 1. THE LINKED CRM CARD COMPONENT
// =====================================================================
const LinkedCrmCard = ({ crmId, navigateTo }) => {
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
          onClick={() => navigateTo('track_service', record.trackingId)}
          className="text-[11px] font-semibold bg-white border border-indigo-200 text-indigo-600 px-2.5 py-1 rounded shadow-sm hover:bg-indigo-50 flex items-center gap-1 transition"
        >
          View Full File <FiExternalLink />
        </button>
      </div>

      <div className="p-4 flex flex-col md:flex-row gap-4 justify-between">
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
            <FiLayers className="inline h-3 w-3" /> {record.subcategory}
          </div>
        </div>

        <div className="space-y-1.5 md:border-l md:border-gray-100 md:pl-6">
          <div className="text-xs text-gray-600 flex items-center gap-2">
            <FiUser className="text-gray-400" /> 
            <span className="font-semibold text-gray-800">{record.customer}</span>
          </div>
          <div className="text-xs text-gray-600 flex items-center gap-2">
            <FiPhone className="text-gray-400" /> {record.phone}
          </div>
          <div className="text-xs text-gray-600 flex items-center gap-2 pt-1">
            <FiBriefcase className="text-indigo-400" /> 
            Assigned to: <span className="font-medium">{record.assignedTo}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

// =====================================================================
// 2. MAIN PAGE COMPONENT
// =====================================================================
const DiscussionDetailPage = ({ discussionId, navigateTo }) => {
  const [discussion, setDiscussion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadDiscussion = async () => {
    if (!discussionId) return;
    try {
      setLoading(true);
      const data = await fetchDiscussionById(discussionId);
      
      const formatted = {
        ...data,
        description: data.content,
        solved: data.status === 'solved',
        author: data.author_name || 'Staff',
        lastReply: new Date(data.updated_at).toLocaleDateString(),
        tags: data.tags || [],
        replies: (data.replies || []).map(r => ({
          id: r.id,
          author: r.author_name || 'Staff',
          time: new Date(r.created_at).toLocaleDateString(),
          content: r.content,
          is_best: r.is_best_answer
        }))
      };

      setDiscussion(formatted);
    } catch (err) {
      setError("Discussion not found or failed to load.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDiscussion();
  }, [discussionId]);

  useEffect(() => {
    if (discussionId) {
      logRecentView('discussion', discussionId).catch(console.error);
    }
  }, [discussionId]);

  if (loading) return <div className="p-12 flex justify-center"><FiLoader className="animate-spin h-8 w-8 text-indigo-500" /></div>;
  if (error) return <div className="p-12 text-center text-red-500"><FiAlertCircle className="mx-auto h-8 w-8 mb-2" />{error}</div>;
  if (!discussion) return null;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      
      {/* THE INTEGRATION: Render the linked CRM record if it exists! */}
      {discussion.crm_application && (
        <LinkedCrmCard 
          crmId={discussion.crm_application} 
          navigateTo={navigateTo} 
        />
      )}

      <DiscussionThread 
        discussion={discussion} 
        onBack={() => navigateTo('discussions')} 
        onUpdate={loadDiscussion} 
      />
    </div>
  );
};

export default DiscussionDetailPage;