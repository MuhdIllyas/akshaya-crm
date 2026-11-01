import React, { useState } from 'react';
import {
  FiPlus, FiTrash2, FiArrowUp, FiArrowDown, FiSave, FiSend, FiX, FiDownloadCloud,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import { batchUpdateBlocks, createSuggestion, fetchSetupImport } from '@/services/knowledge';
import {
  BLOCK_TYPES, BLOCK_GROUPS, emptyContent, parseContent, parseMetadata, isBlockEmpty,
} from './knowledgeBlocks';

const newKey = () => (crypto.randomUUID ? crypto.randomUUID() : `blk-${Date.now()}-${Math.random().toString(36).slice(2)}`);

const inputCls = 'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-[15px] outline-none focus:border-navy-500 focus:ring-1 focus:ring-navy-500';
const labelCls = 'mb-1 block text-[11px] font-semibold uppercase tracking-wider text-slate-400';

// ---------------------------------------------------------------------
// The "Add block" menu (used at the bottom and for "insert below")
// ---------------------------------------------------------------------
const AddBlockMenu = ({ onAdd, onClose }) => (
  <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
    <div className="space-y-3">
      {BLOCK_GROUPS.map(group => (
        <div key={group.label}>
          <p className="mb-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">{group.label}</p>
          <div className="flex flex-wrap gap-2">
            {group.types.map(type => {
              const T = BLOCK_TYPES[type];
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => onAdd(type)}
                  className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition-all hover:border-navy-500/30 hover:text-navy-700 hover:shadow-sm"
                >
                  <T.icon className="h-4 w-4" /> {T.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
    {onClose && (
      <div className="mt-2 text-right">
        <button type="button" onClick={onClose} className="text-xs font-medium text-slate-500 hover:text-slate-800">Close</button>
      </div>
    )}
  </div>
);

// ---------------------------------------------------------------------
// One input form per block type
// ---------------------------------------------------------------------
const BlockInput = ({ block, onChange }) => {
  const c = block.content;
  const set = (patch) => onChange({ ...c, ...patch });

  switch (block.block_type) {
    case 'list':
      return (
        <textarea
          value={(c.items || []).join('\n')}
          onChange={(e) => onChange({ items: e.target.value.split('\n') })}
          placeholder="One item per line..."
          className="min-h-[100px] w-full resize-y bg-transparent leading-relaxed text-slate-700 outline-none"
        />
      );

    case 'checklist':
      return (
        <textarea
          value={(c.items || []).map(i => i?.text ?? i).join('\n')}
          onChange={(e) => onChange({ items: e.target.value.split('\n').map(text => ({ text })) })}
          placeholder="One check per line, e.g. 'Original Aadhaar seen'..."
          className="min-h-[100px] w-full resize-y bg-transparent leading-relaxed text-slate-700 outline-none"
        />
      );

    case 'step':
      return (
        <div className="space-y-2">
          <div>
            <label className={labelCls}>Step title</label>
            <input value={c.title || ''} onChange={e => set({ title: e.target.value })} placeholder="e.g. Verify the customer's mobile number" className={inputCls} />
          </div>
          <div>
            <label className={labelCls}>Details</label>
            <textarea value={c.text || ''} onChange={e => set({ text: e.target.value })} rows={2} placeholder="What exactly to do in this step..." className={`${inputCls} resize-y`} />
          </div>
        </div>
      );

    case 'required_document':
      return (
        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1">
              <label className={labelCls}>Document</label>
              <input value={c.name || ''} onChange={e => set({ name: e.target.value })} placeholder="e.g. Original Aadhaar card" className={inputCls} />
            </div>
            <div className="flex overflow-hidden rounded-lg border border-slate-200 text-xs font-bold">
              <button type="button" onClick={() => set({ mandatory: true })} className={`px-3 py-2.5 ${c.mandatory !== false ? 'bg-rose-50 text-rose-700' : 'bg-white text-slate-400'}`}>REQUIRED</button>
              <button type="button" onClick={() => set({ mandatory: false })} className={`border-l border-slate-200 px-3 py-2.5 ${c.mandatory === false ? 'bg-slate-100 text-slate-700' : 'bg-white text-slate-400'}`}>OPTIONAL</button>
            </div>
          </div>
          <div>
            <label className={labelCls}>Note (optional)</label>
            <input value={c.note || ''} onChange={e => set({ note: e.target.value })} placeholder="e.g. Self-attested copy also accepted" className={inputCls} />
          </div>
        </div>
      );

    case 'fee':
      return (
        <div className="space-y-2">
          <div className="flex flex-col gap-2 sm:flex-row">
            <div className="flex-1">
              <label className={labelCls}>What the fee is for</label>
              <input value={c.label || ''} onChange={e => set({ label: e.target.value })} placeholder="e.g. Government fee" className={inputCls} />
            </div>
            <div className="sm:w-40">
              <label className={labelCls}>Amount (₹)</label>
              <input inputMode="decimal" value={c.amount ?? ''} onChange={e => set({ amount: e.target.value })} placeholder="50" className={inputCls} />
            </div>
          </div>
          <div>
            <label className={labelCls}>Note (optional)</label>
            <input value={c.note || ''} onChange={e => set({ note: e.target.value })} placeholder="e.g. Paid online through the portal" className={inputCls} />
          </div>
        </div>
      );

    case 'faq_item':
      return (
        <div className="space-y-2">
          <div>
            <label className={labelCls}>Question</label>
            <input value={c.question || ''} onChange={e => set({ question: e.target.value })} placeholder="What do customers or staff usually ask?" className={`${inputCls} font-semibold`} />
          </div>
          <div>
            <label className={labelCls}>Answer</label>
            <textarea value={c.answer || ''} onChange={e => set({ answer: e.target.value })} rows={3} placeholder="The correct, checked answer..." className={`${inputCls} resize-y`} />
          </div>
        </div>
      );

    case 'link':
      return (
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="sm:w-1/3">
            <label className={labelCls}>Label</label>
            <input value={c.label || ''} onChange={e => set({ label: e.target.value })} placeholder="e.g. UIDAI portal" className={inputCls} />
          </div>
          <div className="flex-1">
            <label className={labelCls}>URL</label>
            <input type="url" value={c.url || ''} onChange={e => set({ url: e.target.value })} placeholder="https://..." className={inputCls} />
          </div>
        </div>
      );

    default: {
      // h1 / h2 / h3 / paragraph / callout
      const big =
        block.block_type === 'h1' ? 'text-3xl font-bold text-slate-900 tracking-tight' :
        block.block_type === 'h2' ? 'text-2xl font-bold text-slate-800' :
        block.block_type === 'h3' ? 'text-xl font-bold text-slate-800' :
        block.block_type === 'callout' ? 'text-[15px] font-medium' :
        'text-[15px] text-slate-700 leading-relaxed';
      return (
        <textarea
          value={c.text || ''}
          onChange={(e) => set({ text: e.target.value })}
          placeholder={`Type ${BLOCK_TYPES[block.block_type]?.label.toLowerCase() || 'text'} here...`}
          rows={block.block_type === 'paragraph' || block.block_type === 'callout' ? 3 : 1}
          className={`w-full resize-y bg-transparent outline-none ${big}`}
        />
      );
    }
  }
};

// ---------------------------------------------------------------------
// Main editor
//   mode="edit"    → saves straight to the document (admins / editors)
//   mode="suggest" → sends a suggestion to the review queue (everyone else)
// ---------------------------------------------------------------------
const BlockEditor = ({ document, workspaceId, mode = 'edit', initialBlocks = null, initialNote = '', onCancel, onSaveSuccess }) => {
  const isSuggest = mode === 'suggest';

  const [blocks, setBlocks] = useState(() =>
    (initialBlocks || document.blocks || []).map(b => ({
      ...b,
      _id: newKey(),
      block_key: b.block_key || newKey(),
      content: parseContent(b.content),
      metadata: parseMetadata(b.metadata),
    }))
  );
  const [note, setNote] = useState(initialNote || '');
  const [isSaving, setIsSaving] = useState(false);
  const [insertAfter, setInsertAfter] = useState(null); // index, or null
  const [showBottomMenu, setShowBottomMenu] = useState(blocks.length === 0);
  const [importing, setImporting] = useState(false);

  // Import is offered on the SOP (that's where documents and fees belong)
  const canImport = document.system_key === 'sop';

  // Adds required documents, department fees and the portal link from
  // Service Management. Blocks already in the editor are skipped, so
  // importing again only adds what's new. Nothing is saved until the
  // person clicks Save / Send for Review.
  const handleImport = async () => {
    try {
      setImporting(true);
      const data = await fetchSetupImport(document.id);
      const existing = new Set(blocks.map(b => String(b.block_key)));
      const fresh = (data.blocks || [])
        .filter(b => !existing.has(String(b.block_key)))
        .map(b => ({ ...b, _id: newKey(), content: parseContent(b.content), metadata: parseMetadata(b.metadata) }));

      if ((data.blocks || []).length === 0) {
        toast.info(`${data.service?.name || 'This service'} has no required documents, fees or website in Service Management yet.`);
        return;
      }
      if (fresh.length === 0) {
        toast.info('Everything from service setup is already in this document.');
        return;
      }
      setBlocks(prev => [...prev, ...fresh]);
      setShowBottomMenu(false);
      const skipped = data.blocks.length - fresh.length;
      toast.success(`Added ${fresh.length} block${fresh.length > 1 ? 's' : ''} from service setup${skipped ? ` (${skipped} already here)` : ''}. Review them, add the steps, then save.`);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Could not read the service setup.');
    } finally {
      setImporting(false);
    }
  };

  const updateContent = (id, content) => setBlocks(prev => prev.map(b => (b._id === id ? { ...b, content } : b)));

  const addBlock = (type, afterIndex = null) => {
    const block = { _id: newKey(), block_key: newKey(), block_type: type, content: emptyContent(type), metadata: {} };
    setBlocks(prev => {
      if (afterIndex === null) return [...prev, block];
      const next = [...prev];
      next.splice(afterIndex + 1, 0, block);
      return next;
    });
    setInsertAfter(null);
  };

  const removeBlock = (id) => setBlocks(prev => prev.filter(b => b._id !== id));

  const moveBlock = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= blocks.length) return;
    setBlocks(prev => {
      const next = [...prev];
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  };

  const buildPayload = () =>
    blocks
      .filter(b => !isBlockEmpty(b)) // drop blocks left empty
      .map((b, index) => ({
        block_key: b.block_key,
        block_type: b.block_type,
        content: b.block_type === 'list'
          ? { items: (b.content.items || []).map(i => String(i).trim()).filter(Boolean) }
          : b.block_type === 'checklist'
            ? { items: (b.content.items || []).map(i => ({ text: String(i?.text ?? i).trim() })).filter(i => i.text) }
            : b.content,
        metadata: b.metadata || {}, // keeps "suggested by / approved by" credit
        sort_order: index + 1,
      }));

  const handleSave = async () => {
    const payload = buildPayload();
    const badLink = payload.find(b => b.block_type === 'link' && !/^https?:\/\//i.test(b.content.url || ''));
    if (badLink) {
      toast.error('Links must start with http:// or https://');
      return;
    }

    try {
      setIsSaving(true);
      if (isSuggest) {
        const res = await createSuggestion(document.id, { blocks: payload, note });
        toast.success(res?.updated ? 'Your suggestion was updated.' : 'Suggestion sent for review. Thank you!');
      } else {
        await batchUpdateBlocks(workspaceId, document.id, payload);
        toast.success('Document saved successfully!');
      }
      onSaveSuccess();
    } catch (err) {
      toast.error(err.response?.data?.error || (isSuggest ? 'Failed to send suggestion.' : 'Failed to save document.'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    // FIX: no overflow-hidden here, because it stops the header below from staying
    // stuck to the top while scrolling (Save button scrolled out of view).
    <div className="animate-in fade-in rounded-2xl border border-slate-200 bg-white shadow-sm duration-300">
      {/* Header */}
      <div className={`sticky top-0 z-20 flex flex-col gap-3 rounded-t-2xl border-b px-4 py-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:px-8 ${
        isSuggest ? 'border-amber-100 bg-amber-50' : 'border-slate-100 bg-slate-50'
      }`}>
        <div>
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-900">
            {isSuggest ? 'Suggesting changes to' : 'Editing'}: {document.title}
          </h2>
          <p className="mt-0.5 text-xs text-slate-500">
            {isSuggest
              ? 'A reviewer for this service will check your changes before they go live.'
              : 'Use the arrows to reorder, + to insert a block below.'}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {canImport && (
            <button
              type="button"
              onClick={handleImport}
              disabled={importing}
              title="Fill in required documents, department fees and the portal link from Service Management"
              className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-navy-500/30 hover:text-navy-700 disabled:opacity-50"
            >
              <FiDownloadCloud className="h-4 w-4" />
              {importing ? 'Importing...' : 'Import from service setup'}
            </button>
          )}
          <button onClick={onCancel} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={isSaving}
            className={`flex items-center gap-2 rounded-xl px-5 py-2 text-sm font-medium text-white shadow-sm transition-all disabled:opacity-50 ${
              isSuggest ? 'bg-amber-600 hover:bg-amber-700' : 'bg-navy-700 hover:bg-navy-800'
            }`}
          >
            {isSuggest ? <FiSend className="h-4 w-4" /> : <FiSave className="h-4 w-4" />}
            {isSaving ? (isSuggest ? 'Sending...' : 'Saving...') : (isSuggest ? 'Send for Review' : 'Save Changes')}
          </button>
        </div>
      </div>

      {/* Suggestion note */}
      {isSuggest && (
        <div className="border-b border-slate-100 px-4 py-4 sm:px-8">
          <label className={labelCls}>What did you change and why? (helps the reviewer)</label>
          <textarea
            value={note}
            onChange={e => setNote(e.target.value)}
            rows={2}
            placeholder="e.g. The fee changed to ₹100 from 1 Nov as per the new circular."
            className={`${inputCls} resize-y`}
          />
        </div>
      )}

      {/* Blocks */}
      <div className="mx-auto min-h-[400px] max-w-4xl px-4 py-8 sm:px-8">
        <div className="space-y-3">
          {blocks.map((block, index) => {
            const T = BLOCK_TYPES[block.block_type] || { label: block.block_type, icon: FiPlus };
            const isCallout = block.block_type === 'callout';
            const isWarning = block.content.style === 'warning';
            return (
              <React.Fragment key={block._id}>
                <div className="group relative flex gap-3 rounded-xl border border-slate-100 p-3 transition-all hover:border-slate-200 hover:bg-slate-50/50 sm:p-4">
                  <div className={`min-w-0 flex-1 ${isCallout ? (isWarning ? 'rounded-xl border border-amber-100 bg-amber-50 p-4 text-amber-900' : 'rounded-xl border border-navy-500/10 bg-navy-500/10 p-4 text-navy-700') : ''}`}>
                    <div className="mb-2 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      <T.icon className="h-3 w-3" /> {T.label}
                    </div>
                    {isCallout && (
                      <div className="mb-3 flex gap-2">
                        <button type="button" onClick={() => updateContent(block._id, { ...block.content, style: 'info' })} className={`rounded px-2 py-1 text-xs font-bold ${!isWarning ? 'bg-navy-500/20 text-navy-700' : 'bg-white text-slate-400'}`}>INFO</button>
                        <button type="button" onClick={() => updateContent(block._id, { ...block.content, style: 'warning' })} className={`rounded px-2 py-1 text-xs font-bold ${isWarning ? 'bg-amber-200 text-amber-800' : 'bg-white text-slate-400'}`}>WARNING</button>
                      </div>
                    )}
                    <BlockInput block={block} onChange={(content) => updateContent(block._id, content)} />
                  </div>

                  {/* Controls (always visible on touch screens) */}
                  <div className="flex w-8 flex-col gap-1 pt-5 opacity-100 transition-opacity sm:opacity-0 sm:group-hover:opacity-100">
                    <button type="button" onClick={() => moveBlock(index, -1)} disabled={index === 0} className="rounded p-1.5 text-slate-400 hover:bg-navy-500/10 hover:text-navy-700 disabled:opacity-30" title="Move up"><FiArrowUp className="h-4 w-4" /></button>
                    <button type="button" onClick={() => moveBlock(index, 1)} disabled={index === blocks.length - 1} className="rounded p-1.5 text-slate-400 hover:bg-navy-500/10 hover:text-navy-700 disabled:opacity-30" title="Move down"><FiArrowDown className="h-4 w-4" /></button>
                    <button type="button" onClick={() => setInsertAfter(insertAfter === index ? null : index)} className="rounded p-1.5 text-slate-400 hover:bg-navy-500/10 hover:text-navy-700" title="Insert block below"><FiPlus className="h-4 w-4" /></button>
                    <button type="button" onClick={() => removeBlock(block._id)} className="rounded p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600" title="Delete block"><FiTrash2 className="h-4 w-4" /></button>
                  </div>
                </div>

                {insertAfter === index && (
                  <AddBlockMenu onAdd={(type) => addBlock(type, index)} onClose={() => setInsertAfter(null)} />
                )}
              </React.Fragment>
            );
          })}
        </div>

        {/* Bottom add menu */}
        <div className="mt-8 border-t border-slate-100 pt-6">
          {showBottomMenu ? (
            <AddBlockMenu
              onAdd={(type) => addBlock(type)}
              onClose={blocks.length > 0 ? () => setShowBottomMenu(false) : null}
            />
          ) : (
            <button
              type="button"
              onClick={() => setShowBottomMenu(true)}
              className="flex w-full items-center justify-center gap-2 rounded-xl border-2 border-dashed border-slate-200 py-3 text-sm font-medium text-slate-500 hover:border-navy-500/30 hover:text-navy-700"
            >
              <FiPlus className="h-4 w-4" /> Add block
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export default BlockEditor;