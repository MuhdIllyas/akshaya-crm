import React, { useState } from 'react';
import { 
  FiType, FiInfo, FiAlertTriangle, FiList, FiPlus, 
  FiTrash2, FiArrowUp, FiArrowDown, FiSave, FiX 
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import { batchUpdateBlocks } from '@/services/knowledge'; 

const BLOCK_TYPES = [
  { id: 'h1', label: 'Heading 1', icon: FiType },
  { id: 'h2', label: 'Heading 2', icon: FiType },
  { id: 'h3', label: 'Heading 3', icon: FiType },
  { id: 'paragraph', label: 'Paragraph', icon: FiType },
  { id: 'list', label: 'Bulleted List', icon: FiList },
  { id: 'callout', label: 'Callout Box', icon: FiInfo },
];

const BlockEditor = ({ document, workspaceId, onCancel, onSaveSuccess }) => {
  // Initialize blocks, parsing JSON content if it came as a string from DB
  const [blocks, setBlocks] = useState(() => {
    return (document.blocks || []).map(b => ({
      ...b,
      id: b.id || b.block_key || crypto.randomUUID(),
      content: typeof b.content === 'string' ? JSON.parse(b.content) : (b.content || { text: '' })
    }));
  });
  
  const [isSaving, setIsSaving] = useState(false);

  // --- Block Actions ---
  const handleUpdateContent = (id, newContent) => {
    setBlocks(blocks.map(b => b.id === id ? { ...b, content: newContent } : b));
  };

  const addBlock = (type) => {
    const newBlock = {
      id: crypto.randomUUID(),
      block_key: crypto.randomUUID(), // Used by DB
      block_type: type,
      content: type === 'list' ? { items: [''] } : { text: '', style: 'info' },
      sort_order: blocks.length + 1
    };
    setBlocks([...blocks, newBlock]);
  };

  const removeBlock = (id) => setBlocks(blocks.filter(b => b.id !== id));

  const moveBlock = (index, direction) => {
    if ((direction === -1 && index === 0) || (direction === 1 && index === blocks.length - 1)) return;
    const newBlocks = [...blocks];
    const temp = newBlocks[index];
    newBlocks[index] = newBlocks[index + direction];
    newBlocks[index + direction] = temp;
    setBlocks(newBlocks);
  };

  // --- Save to Database ---
  const handleSave = async () => {
    try {
      setIsSaving(true);
      // Re-assign sort_order based on array index before saving
      const payload = blocks.map((b, index) => ({
        block_key: b.block_key || b.id,
        block_type: b.block_type,
        content: b.content,
        sort_order: index + 1
      }));

      await batchUpdateBlocks(workspaceId, document.id, payload);
      toast.success('Document saved successfully!');
      onSaveSuccess(); // Closes editor and reloads DocumentView
    } catch (err) {
      toast.error('Failed to save document.');
    } finally {
      setIsSaving(false);
    }
  };

  // --- Dynamic Input Renderers ---
  const renderInput = (block) => {
    if (block.block_type === 'list') {
      const items = block.content.items || [];
      return (
        <textarea
          value={items.join('\n')}
          onChange={(e) => handleUpdateContent(block.id, { items: e.target.value.split('\n') })}
          placeholder="Enter list items (one per line)..."
          className="w-full bg-transparent outline-none resize-none min-h-[100px] text-gray-700 leading-relaxed"
        />
      );
    }
    
    // Auto-resizing textarea for paragraphs and headers
    return (
      <textarea
        value={block.content.text || ''}
        onChange={(e) => handleUpdateContent(block.id, { ...block.content, text: e.target.value })}
        placeholder={`Type ${block.block_type} here...`}
        rows={block.block_type === 'paragraph' ? 3 : 1}
        className={`w-full bg-transparent outline-none resize-none overflow-hidden ${
          block.block_type === 'h1' ? 'text-3xl font-bold text-gray-900 tracking-tight' :
          block.block_type === 'h2' ? 'text-2xl font-bold text-gray-800' :
          block.block_type === 'h3' ? 'text-xl font-bold text-gray-800' :
          block.block_type === 'callout' ? 'text-[15px] font-medium' :
          'text-[15px] text-gray-700 leading-relaxed'
        }`}
      />
    );
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden animate-in fade-in duration-300">
      {/* Editor Header */}
      <div className="px-8 py-4 border-b border-gray-100 flex justify-between items-center bg-gray-50/50 sticky top-0 z-10">
        <div>
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider">Editing: {document.title}</h2>
          <p className="text-xs text-gray-500 mt-0.5">Use the controls on the right to reorder or delete blocks.</p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-xl transition-colors">
            Cancel
          </button>
          <button onClick={handleSave} disabled={isSaving} className="flex items-center gap-2 px-6 py-2 bg-indigo-600 text-white text-sm font-medium rounded-xl hover:bg-indigo-700 transition-all disabled:opacity-50 shadow-sm">
            <FiSave className="h-4 w-4" /> {isSaving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>
      </div>

      {/* Editor Body */}
      <div className="px-8 py-8 max-w-4xl mx-auto min-h-[400px]">
        <div className="space-y-4">
          {blocks.map((block, index) => (
            <div key={block.id} className="group relative flex gap-4 p-4 rounded-xl border border-transparent hover:border-gray-200 hover:bg-gray-50/50 transition-all">
              
              {/* The Input Field */}
              <div className={`flex-1 ${block.block_type === 'callout' ? (block.content.style === 'warning' ? 'bg-amber-50 text-amber-900 p-4 rounded-xl border border-amber-100' : 'bg-blue-50 text-blue-900 p-4 rounded-xl border border-blue-100') : ''}`}>
                {block.block_type === 'callout' && (
                  <div className="flex gap-4 mb-3">
                    <button onClick={() => handleUpdateContent(block.id, { ...block.content, style: 'info' })} className={`text-xs px-2 py-1 rounded font-bold ${block.content.style !== 'warning' ? 'bg-blue-200 text-blue-800' : 'bg-white text-gray-400'}`}>INFO</button>
                    <button onClick={() => handleUpdateContent(block.id, { ...block.content, style: 'warning' })} className={`text-xs px-2 py-1 rounded font-bold ${block.content.style === 'warning' ? 'bg-amber-200 text-amber-800' : 'bg-white text-gray-400'}`}>WARNING</button>
                  </div>
                )}
                {renderInput(block)}
              </div>

              {/* Block Controls (Hover to reveal) */}
              <div className="w-8 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity pt-1">
                <button onClick={() => moveBlock(index, -1)} disabled={index === 0} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded disabled:opacity-30"><FiArrowUp className="h-4 w-4" /></button>
                <button onClick={() => moveBlock(index, 1)} disabled={index === blocks.length - 1} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded disabled:opacity-30"><FiArrowDown className="h-4 w-4" /></button>
                <button onClick={() => removeBlock(block.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded mt-auto"><FiTrash2 className="h-4 w-4" /></button>
              </div>
            </div>
          ))}
        </div>

        {/* Add Block Menu */}
        <div className="mt-8 pt-8 border-t border-gray-100">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-4">Add New Block</p>
          <div className="flex flex-wrap gap-2">
            {BLOCK_TYPES.map(type => (
              <button
                key={type.id}
                onClick={() => addBlock(type.id)}
                className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg hover:border-indigo-300 hover:text-indigo-600 hover:shadow-sm transition-all text-sm font-medium"
              >
                <type.icon className="h-4 w-4" /> {type.label}
              </button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

export default BlockEditor;