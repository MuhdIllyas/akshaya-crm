import React, { useState } from 'react';
import { FiEdit2, FiInfo, FiAlertTriangle, FiCheckCircle, FiFileText } from 'react-icons/fi';
import BlockEditor from './BlockEditor';

const DocumentView = ({ document, workspaceId, onUpdate }) => {
  const [isEditing, setIsEditing] = useState(false);

  // If the user clicks Edit, we will eventually show the interactive Block Editor
  if (isEditing) {
      return (
        <BlockEditor 
          document={document} 
          workspaceId={workspaceId} 
          onCancel={() => setIsEditing(false)} 
          onSaveSuccess={() => {
            setIsEditing(false);
            onUpdate(); // Reloads the latest JSON from Postgres!
          }} 
        />
      );
    }

  // ==========================================
  // THE RENDERING ENGINE
  // Translates database JSON into beautiful UI
  // ==========================================
  const renderBlock = (block) => {
    // Safely parse the JSON content if it came back as a string from the DB
    let content = block.content;
    if (typeof content === 'string') {
      try { content = JSON.parse(content); } catch (e) { content = { text: content }; }
    }

    switch (block.block_type) {
      case 'h1':
        return <h1 className="text-3xl font-bold text-gray-900 mt-8 mb-4 tracking-tight">{content.text}</h1>;
      case 'h2':
        return <h2 className="text-2xl font-bold text-gray-800 mt-8 mb-3 border-b border-gray-100 pb-2">{content.text}</h2>;
      case 'h3':
        return <h3 className="text-xl font-bold text-gray-800 mt-6 mb-2">{content.text}</h3>;
      case 'paragraph':
        return <p className="text-gray-700 leading-relaxed mb-4 text-[15px]">{content.text}</p>;
      case 'list':
        return (
          <ul className="list-disc list-inside space-y-2 mb-4 text-gray-700 ml-2">
            {content.items?.map((item, i) => <li key={i} className="leading-relaxed">{item}</li>)}
          </ul>
        );
      case 'callout':
        const isWarning = content.style === 'warning';
        return (
          <div className={`p-4 rounded-xl mb-6 flex gap-3 ${isWarning ? 'bg-amber-50 text-amber-900' : 'bg-blue-50 text-blue-900'}`}>
            {isWarning ? <FiAlertTriangle className="flex-shrink-0 mt-0.5 text-amber-600 h-5 w-5" /> : <FiInfo className="flex-shrink-0 mt-0.5 text-blue-600 h-5 w-5" />}
            <div className="text-[15px] leading-relaxed font-medium">{content.text}</div>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden animate-in fade-in duration-300">
      {/* Document Header */}
      <div className="px-8 py-6 border-b border-gray-100 flex justify-between items-center bg-gray-50/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-100 text-indigo-600 rounded-lg">
            <FiFileText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-gray-900">{document.title}</h2>
            <p className="text-xs text-gray-500 uppercase tracking-wider font-semibold mt-0.5">
              Last updated: {new Date(document.updated_at || document.created_at).toLocaleDateString()}
            </p>
          </div>
        </div>
        
        <button 
          onClick={() => setIsEditing(true)} 
          className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 font-medium text-sm rounded-xl hover:bg-indigo-100 transition-colors"
        >
          <FiEdit2 className="h-4 w-4" /> Edit Document
        </button>
      </div>

      {/* Document Body (Block Renderer) */}
      <div className="px-8 py-8 max-w-3xl mx-auto min-h-[400px]">
        {!document.blocks || document.blocks.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-gray-400 text-lg">This document is currently empty.</p>
            <p className="text-gray-400 text-sm mt-2">Click edit to start adding content.</p>
          </div>
        ) : (
          <div className="pb-12">
            {document.blocks.map(block => (
              <React.Fragment key={block.id || block.block_key}>
                {renderBlock(block)}
              </React.Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentView;