import React, { useState } from 'react';
import DiscussionsList from './DiscussionsList';
import DiscussionThread from './DiscussionThread';
import CreateDiscussionModal from './CreateDiscussionModal';

// Temporary Mock Data until backend is wired
const MOCK_DISCUSSIONS = [
  {
    id: 1, title: 'Police Verification taking more than 15 days', preview: 'Customer traveled out of state, how do we handle the pending status?',
    category: 'question', solved: false, priority: 'high', author: 'Admin', lastReply: '2 hours ago', replies_count: 3,
    crm_customer: 'Muhammed I.', crm_application: 'APP-9021', tags: ['Police', 'Delay'], created_at: 'Yesterday at 10:00 AM',
    description: "The customer applied via Tatkal but the police verification officer hasn't visited the home yet. The customer is currently out of state for a week.\n\nShould we cancel and re-apply or can we hold the application?",
    replies: [
      { id: 101, author: 'Sneha M', time: '1 hour ago', content: 'You can hold it. Ask the customer to visit the station immediately upon return with a written request.', is_best: false },
    ]
  },
  {
    id: 2, title: 'Name mismatch in Aadhaar vs SSLC', preview: 'Passport office rejected application due to spelling error in Aadhaar.',
    category: 'customer_issue', solved: true, priority: 'medium', author: 'Rahul K', lastReply: 'Yesterday', replies_count: 5,
    crm_customer: 'Anjali V.', tags: ['Rejection', 'Name Update'], created_at: 'Jan 15, 2026',
    description: 'Application rejected because SSLC says "Anjali V" but Aadhaar says "Anjali Varma".',
    replies: [
      { id: 102, author: 'Admin', time: 'Yesterday', content: 'We must do an Aadhaar demographic update first. It takes 3-5 days. Use the SSLC as the proof document for the Aadhaar update.', is_best: true }
    ]
  }
];

const DiscussionsView = ({ workspaceId, serviceId }) => {
  const [activeThreadId, setActiveThreadId] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [discussions, setDiscussions] = useState(MOCK_DISCUSSIONS); // Replaced by API call later

  const handleCreateDiscussion = (formData) => {
    // Optimistic UI Update (Replaced by POST /api/discussions later)
    const newDiscussion = {
      id: Date.now(),
      title: formData.title,
      preview: formData.content.substring(0, 80) + '...',
      description: formData.content,
      category: formData.category,
      priority: formData.priority,
      solved: false,
      author: 'You', // Get from context
      lastReply: 'Just now',
      replies_count: 0,
      tags: formData.tags,
      created_at: new Date().toLocaleDateString(),
      replies: []
    };
    
    setDiscussions([newDiscussion, ...discussions]);
    setIsModalOpen(false);
  };

  const activeDiscussion = discussions.find(d => d.id === activeThreadId);

  return (
    <div className="relative">
      {/* Router Logic */}
      {activeThreadId && activeDiscussion ? (
        <DiscussionThread 
          discussion={activeDiscussion} 
          onBack={() => setActiveThreadId(null)} 
        />
      ) : (
        <DiscussionsList 
          discussions={discussions} 
          onOpenThread={(id) => setActiveThreadId(id)} 
          onCreateNew={() => setIsModalOpen(true)} 
        />
      )}

      {/* Floating Modal */}
      <CreateDiscussionModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSubmit={handleCreateDiscussion} 
      />
    </div>
  );
};

export default DiscussionsView;