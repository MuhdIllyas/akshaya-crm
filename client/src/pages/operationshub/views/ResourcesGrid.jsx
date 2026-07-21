import React from 'react';
import { FiGlobe, FiFileText, FiVideo, FiPhoneCall, FiGrid, FiExternalLink } from 'react-icons/fi';

const ResourcesGrid = ({ resources }) => {
  const getResourceMeta = (type) => {
    switch (type) {
      case 'OFFICIAL_PORTAL': return { icon: FiGrid, color: 'text-indigo-600', bg: 'bg-indigo-50', label: 'Portal' };
      case 'OFFICIAL_WEBSITE': return { icon: FiGlobe, color: 'text-blue-600', bg: 'bg-blue-50', label: 'Website' };
      case 'PDF': return { icon: FiFileText, color: 'text-rose-600', bg: 'bg-rose-50', label: 'PDF' };
      case 'VIDEO': return { icon: FiVideo, color: 'text-purple-600', bg: 'bg-purple-50', label: 'Video' };
      case 'HELPDESK': return { icon: FiPhoneCall, color: 'text-emerald-600', bg: 'bg-emerald-50', label: 'Contact' };
      default: return { icon: FiLink, color: 'text-gray-600', bg: 'bg-gray-100', label: 'Link' };
    }
  };

  return (
    <div className="animate-in fade-in duration-300">
      <div className="flex items-center justify-between border-b border-gray-200 pb-6 mb-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Official Resources</h1>
          <p className="text-sm text-gray-500 mt-1">Portals, forms, and official references.</p>
        </div>
        <button className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-indigo-700">
          + Add Resource
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {resources.map((res) => {
          const meta = getResourceMeta(res.type);
          return (
            <a 
              key={res.id} 
              href={res.url} 
              target="_blank" 
              rel="noopener noreferrer"
              className="bg-white border border-gray-200 rounded-xl p-5 hover:shadow-md hover:border-indigo-300 transition-all group"
            >
              <div className="flex items-start justify-between mb-3">
                <div className={`p-2.5 rounded-lg ${meta.bg} ${meta.color}`}>
                  <meta.icon className="h-5 w-5" />
                </div>
                <FiExternalLink className="text-gray-300 group-hover:text-indigo-500 transition-colors" />
              </div>
              <h3 className="font-bold text-gray-900 mb-1">{res.title}</h3>
              <p className="text-xs text-gray-500 line-clamp-2">{res.description}</p>
              <div className="mt-4 inline-block text-[10px] font-bold uppercase tracking-wider bg-gray-100 text-gray-600 px-2 py-1 rounded">
                {meta.label}
              </div>
            </a>
          );
        })}
        {resources.length === 0 && (
          <div className="col-span-full text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
            <p className="text-gray-500">No resources have been added to this workspace yet.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default ResourcesGrid;