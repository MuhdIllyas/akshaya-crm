import React, { useState, useEffect } from 'react';
import { toast } from 'react-toastify';
import { FiLoader } from 'react-icons/fi';
import DiscussionsList from './DiscussionsList';
import DiscussionThread from './DiscussionThread';
import CreateDiscussionModal from './CreateDiscussionModal';
import { fetchDiscussions, createDiscussion } from '@/services/knowledge'; // Adjust path if needed

const DiscussionsView = ({ workspaceId }) => {
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  
  // Real Database State
  const [discussions, setDiscussions] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadDiscussions = async () => {
    try {
      setIsLoading(true);
      const data = await fetchDiscussions(workspaceId);
      
      // Format backend data to match our UI expectations
      const formatted = data.map(d => ({
        ...d,
        preview: d.content ? d.content.substring(0, 100) + '...' : '',
        description: d.content,
        solved: d.status === 'solved',
        author: d.author_name || 'Staff',
        lastReply: new Date(d.updated_at).toLocaleDateString(),
        replies_count: d.replies ? d.replies.length : 0,
        tags: d.tags || [],
        // Format replies
        replies: (d.replies || []).map(r => ({
          id: r.id,
          author: r.author_name || 'Staff',
          time: new Date(r.created_at).toLocaleDateString(),
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
      loadDiscussions(); // Refresh the list from the database
    } catch (err) {
      toast.error('Failed to post discussion.');
    }
  };

  if (isLoading) return <div className="p-12 flex justify-center"><FiLoader className="animate-spin h-8 w-8 text-indigo-500" /></div>;

  const activeDiscussion = discussions.find(d => d.id === activeThreadId);

  return (
    <div className="relative animate-in fade-in duration-300">
      {activeThreadId && activeDiscussion ? (
        <DiscussionThread 
          discussion={activeDiscussion} 
          onBack={() => setActiveThreadId(null)} 
          onUpdate={loadDiscussions} // Passes down so Thread can refresh after reply/solve
        />
      ) : (
        <DiscussionsList 
          discussions={discussions} 
          onOpenThread={(id) => setActiveThreadId(id)} 
          onCreateNew={() => setIsModalOpen(true)} 
        />
      )}

      <CreateDiscussionModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSubmit={handleCreateDiscussion} 
      />
    </div>
  );
};

export default DiscussionsView;