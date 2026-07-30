import React, { useState } from 'react';
import { FiGlobe, FiFileText, FiVideo, FiImage, FiExternalLink, FiPlus, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { addResource, deleteResource } from '@/services/knowledge'; // Adjust path
import AddResourceModal from './AddResourceModal';

const TYPE_CONFIG = {
  portal: { icon: FiGlobe, color: 'bg-blue-50 text-blue-600', border: 'hover:border-blue-300' },
  pdf: { icon: FiFileText, color: 'bg-rose-50 text-rose-600', border: 'hover:border-rose-300' },
  video: { icon: FiVideo, color: 'bg-purple-50 text-purple-600', border: 'hover:border-purple-300' },
  image: { icon: FiImage, color: 'bg-emerald-50 text-emerald-600', border: 'hover:border-emerald-300' }
};

const ResourcesGrid = ({ resources, workspaceId, onUpdate }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleAddResource = async (formData) => {
    try {
      setIsSubmitting(true);
      await addResource(workspaceId, formData);
      toast.success('Resource added successfully!');
      setIsModalOpen(false);
      onUpdate(); // Reload workspace data
    } catch (err) {
      toast.error('Failed to add resource.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (e, id) => {
    e.stopPropagation(); // Prevent opening the link
    if (!window.confirm('Are you sure you want to delete this resource?')) return;
    
    try {
      await deleteResource(id);
      toast.success('Resource deleted.');
      onUpdate();
    } catch (err) {
      toast.error('Failed to delete resource.');
    }
  };

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Important Links & Files</h2>
          <p className="text-sm text-gray-500 mt-1">Official portals, forms, and training materials for this service.</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)} 
          className="flex items-center gap-2 bg-indigo-600 text-white px-5 py-2.5 rounded-xl text-sm font-medium hover:bg-indigo-700 transition-all shadow-sm"
        >
          <FiPlus className="h-4 w-4" /> Add Resource
        </button>
      </div>

      {(!resources || resources.length === 0) ? (
        <div className="text-center py-16 bg-white border border-gray-200 rounded-2xl border-dashed">
          <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
            <FiGlobe className="h-8 w-8" />
          </div>
          <h3 className="text-gray-900 font-bold mb-1">No Resources Yet</h3>
          <p className="text-gray-500 text-sm">Add official portals and PDFs to help your staff.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {resources.map(res => {
            const config = TYPE_CONFIG[res.type] || TYPE_CONFIG.portal;
            const Icon = config.icon;
            
            return (
              <div 
                key={res.id} 
                className={`group bg-white border border-gray-200 rounded-2xl p-5 hover:shadow-md transition-all cursor-pointer relative ${config.border}`}
                onClick={() => window.open(res.url, '_blank')}
              >
                <div className="flex items-start justify-between mb-4">
                  <div className={`p-3 rounded-xl ${config.color}`}>
                    <Icon className="h-6 w-6" />
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={(e) => handleDelete(e, res.id)} 
                      className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                      title="Delete Resource"
                    >
                      <FiTrash2 className="h-4 w-4" />
                    </button>
                    <FiExternalLink className="text-gray-300 group-hover:text-gray-500 transition-colors" />
                  </div>
                </div>
                
                <h3 className="font-bold text-gray-900 mb-1">{res.title}</h3>
                <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">{res.type}</p>
              </div>
            );
          })}
        </div>
      )}

      <AddResourceModal 
        isOpen={isModalOpen} 
        onClose={() => setIsModalOpen(false)} 
        onSubmit={handleAddResource}
        isSubmitting={isSubmitting}
      />
    </div>
  );
};

export default ResourcesGrid;