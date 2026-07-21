import React from 'react';
import { FiPlus, FiTrash2, FiAlignLeft, FiAlertTriangle } from 'react-icons/fi';

const BlockRenderer = ({ blocks, setBlocks, isEditMode }) => {
  
  const handleContentChange = (index, text) => {
    const updated = [...blocks];
    updated[index].content = { ...updated[index].content, text };
    setBlocks(updated);
  };

  const addBlock = (type) => {
    const newBlock = {
      block_key: `block-${Date.now()}`,
      block_type: type,
      content: { text: '' },
      metadata: {},
      sort_order: (blocks.length > 0 ? blocks[blocks.length - 1].sort_order : 0) + 1000
    };
    setBlocks([...blocks, newBlock]);
  };

  const removeBlock = (index) => {
    setBlocks(blocks.filter((_, i) => i !== index));
  };

  return (
    <div className="space-y-6">
      {blocks.length === 0 && !isEditMode && (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
          <p className="text-gray-500">This document is empty.</p>
        </div>
      )}

      {blocks.map((block, index) => (
        <div key={block.block_key || index} className="group relative">
          
          {/* --- EDIT MODE --- */}
          {isEditMode ? (
            <div className="flex gap-3 items-start bg-gray-50 p-3 rounded-xl border border-gray-200 focus-within:border-indigo-400 focus-within:ring-1 focus-within:ring-indigo-400 transition-all">
              <div className="flex-1">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400 mb-1 block">
                  {block.block_type}
                </span>
                {block.block_type === 'heading' ? (
                  <input
                    type="text"
                    value={block.content.text || ''}
                    onChange={(e) => handleContentChange(index, e.target.value)}
                    placeholder="Enter heading..."
                    className="w-full bg-transparent border-none focus:ring-0 text-xl font-bold text-gray-900 p-0"
                  />
                ) : block.block_type === 'warning' ? (
                  <textarea
                    value={block.content.text || ''}
                    onChange={(e) => handleContentChange(index, e.target.value)}
                    placeholder="Enter warning text..."
                    className="w-full bg-transparent border-none focus:ring-0 text-amber-900 p-0 resize-y min-h-[60px]"
                  />
                ) : (
                  <textarea
                    value={block.content.text || ''}
                    onChange={(e) => handleContentChange(index, e.target.value)}
                    placeholder="Write your paragraph..."
                    className="w-full bg-transparent border-none focus:ring-0 text-gray-700 p-0 resize-y min-h-[80px]"
                  />
                )}
              </div>
              <button onClick={() => removeBlock(index)} className="p-2 text-gray-400 hover:text-red-600 hover:bg-white rounded-lg transition-colors shadow-sm border border-transparent hover:border-red-100">
                <FiTrash2 className="h-4 w-4" />
              </button>
            </div>

          /* --- VIEW MODE --- */
          ) : (
            <div className="text-gray-800 leading-relaxed">
              {block.block_type === 'heading' && (
                <h3 className="text-2xl font-bold text-gray-900 mt-6 mb-3">{block.content.text}</h3>
              )}
              {block.block_type === 'paragraph' && (
                <p className="mb-4 text-gray-700 whitespace-pre-wrap">{block.content.text}</p>
              )}
              {block.block_type === 'warning' && (
                <div className="bg-amber-50 border-l-4 border-amber-500 p-4 rounded-r-lg my-4 flex gap-3">
                  <FiAlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <p className="text-amber-900 text-sm whitespace-pre-wrap">{block.content.text}</p>
                </div>
              )}
            </div>
          )}
        </div>
      ))}

      {/* --- ADD BLOCK MENU --- */}
      {isEditMode && (
        <div className="pt-6 mt-8 border-t border-dashed border-gray-200 flex gap-2">
          <button onClick={() => addBlock('paragraph')} className="flex items-center gap-2 text-sm text-gray-600 bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 font-medium transition-all shadow-sm">
            <FiAlignLeft className="h-4 w-4" /> Add Paragraph
          </button>
          <button onClick={() => addBlock('heading')} className="flex items-center gap-2 text-sm text-gray-600 bg-white border border-gray-300 px-4 py-2 rounded-lg hover:bg-gray-50 font-medium transition-all shadow-sm">
            <span className="font-bold font-serif leading-none">H</span> Add Heading
          </button>
          <button onClick={() => addBlock('warning')} className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 border border-amber-200 px-4 py-2 rounded-lg hover:bg-amber-100 font-medium transition-all shadow-sm">
            <FiAlertTriangle className="h-4 w-4" /> Add Warning
          </button>
        </div>
      )}
    </div>
  );
};

export default BlockRenderer;