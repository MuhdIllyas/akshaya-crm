import React, { useState, useEffect } from 'react';
import { FiEdit2, FiSave, FiX } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { batchUpdateBlocks } from '@/services/knowledge';
import BlockRenderer from '../blocks/BlockRenderer';

const DocumentView = ({ document, workspaceId, onUpdate }) => {
  const [isEditMode, setIsEditMode] = useState(false);
  const [blocks, setBlocks] = useState([]);
  const [isSaving, setIsSaving] = useState(false);

  // Sync state when switching documents
  useEffect(() => {
    setBlocks(document?.blocks || []);
    setIsEditMode(false); // Always start in view mode
  }, [document]);

  const handleSave = async () => {
    try {
      setIsSaving(true);
      await batchUpdateBlocks(workspaceId, document.id, blocks);
      toast.success('Document saved successfully!');
      setIsEditMode(false);
      onUpdate(); // Refresh data in OperationsHub shell
    } catch (err) {
      toast.error('Failed to save document.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!document) return null;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 min-h-[60vh] animate-in fade-in duration-300">
      <div className="border-b border-gray-100 pb-6 mb-6 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">{document.title}</h1>
          <p className="text-sm text-gray-400 mt-2">
            Last updated {new Date(document.updated_at).toLocaleDateString()}
          </p>
        </div>
        
        {/* Document-specific Edit/Save Controls */}
        <div className="flex gap-2">
          {isEditMode ? (
            <>
              <button 
                onClick={() => { setBlocks(document.blocks || []); setIsEditMode(false); }} 
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-gray-600 bg-gray-100 hover:bg-gray-200 transition-colors"
              >
                <FiX /> Cancel
              </button>
              <button 
                onClick={handleSave} 
                disabled={isSaving} 
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 transition-colors"
              >
                <FiSave /> {isSaving ? 'Saving...' : 'Save Document'}
              </button>
            </>
          ) : (
            <button 
              onClick={() => setIsEditMode(true)} 
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-indigo-700 bg-indigo-50 hover:bg-indigo-100 transition-colors"
            >
              <FiEdit2 /> Edit Document
            </button>
          )}
        </div>
      </div>

      {/* The Modular Block Engine */}
      <BlockRenderer 
        blocks={blocks} 
        setBlocks={setBlocks} 
        isEditMode={isEditMode} 
      />
    </div>
  );
};

export default DocumentView;