import React, { useState } from 'react';
import { FiEdit2, FiEye, FiCheck, FiUsers, FiClock } from 'react-icons/fi';
import { updateWorkspaceStatus } from '../../api/knowledge';
import { toast } from 'react-toastify';

const WorkspaceHeader = ({ workspace, stats, contributors, isEditMode, setIsEditMode, onStatusChange }) => {
  const [isPublishing, setIsPublishing] = useState(false);

  const handlePublish = async () => {
    try {
      setIsPublishing(true);
      await updateWorkspaceStatus(workspace.id, 'published');
      toast.success('Workspace published successfully!');
      onStatusChange(); // Reload data
    } catch (err) {
      toast.error('Failed to publish workspace.');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between flex-shrink-0">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <FiClock className="h-4 w-4" />
          <span>Updated {new Date(stats?.lastUpdated).toLocaleDateString()}</span>
        </div>
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <FiUsers className="h-4 w-4" />
          <span>{stats?.contributors} Contributors</span>
        </div>
      </div>

      <div className="flex items-center gap-3">
        {/* Toggle Edit Mode */}
        <button
          onClick={() => setIsEditMode(!isEditMode)}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
            isEditMode 
              ? 'bg-gray-100 text-gray-700 hover:bg-gray-200' 
              : 'bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
          }`}
        >
          {isEditMode ? <><FiEye className="h-4 w-4" /> View Mode</> : <><FiEdit2 className="h-4 w-4" /> Edit Content</>}
        </button>

        {/* Publish Button (Only show if draft/in_review) */}
        {workspace?.status !== 'published' && (
          <button
            onClick={handlePublish}
            disabled={isPublishing}
            className="flex items-center gap-2 bg-emerald-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-emerald-700 transition-all disabled:opacity-50"
          >
            <FiCheck className="h-4 w-4" /> {isPublishing ? 'Publishing...' : 'Publish'}
          </button>
        )}
      </div>
    </div>
  );
};

export default WorkspaceHeader;