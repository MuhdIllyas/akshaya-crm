import React, { useState, useEffect } from 'react';
import { FiLoader, FiAlertCircle } from 'react-icons/fi';
import { fetchDiscussionById } from '@/services/knowledge';
import DiscussionThread from './DiscussionThread'; // Your existing component!

const DiscussionDetailPage = ({ discussionId, navigateTo }) => {
  const [discussion, setDiscussion] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const loadDiscussion = async () => {
    if (!discussionId) return;
    try {
      setLoading(true);
      const data = await fetchDiscussionById(discussionId);
      
      // Format it exactly how DiscussionThread.jsx expects it
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

  if (loading) return <div className="p-12 flex justify-center"><FiLoader className="animate-spin h-8 w-8 text-indigo-500" /></div>;
  if (error) return <div className="p-12 text-center text-red-500"><FiAlertCircle className="mx-auto h-8 w-8 mb-2" />{error}</div>;
  if (!discussion) return null;

  return (
    <div className="max-w-4xl mx-auto p-4 sm:p-6">
      <DiscussionThread 
        discussion={discussion} 
        onBack={() => navigateTo('discussions')} 
        onUpdate={loadDiscussion} 
      />
    </div>
  );
};

export default DiscussionDetailPage;