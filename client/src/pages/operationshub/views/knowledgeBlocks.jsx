// knowledgeBlocks.jsx
// =====================================================================
// One place that knows every block type: its label, icon, empty content,
// how it looks when read, and a plain-text summary (used by the review
// diff now, and by the AI later).
// =====================================================================
import React from 'react';
import {
  FiType, FiList, FiInfo, FiAlertTriangle, FiHelpCircle, FiChevronDown,
  FiFileText, FiCreditCard, FiCheckSquare, FiExternalLink, FiHash, FiAlignLeft, FiLink,
} from 'react-icons/fi';

export const BLOCK_TYPES = {
  h1:                { label: 'Heading 1',         icon: FiType },
  h2:                { label: 'Heading 2',         icon: FiType },
  h3:                { label: 'Heading 3',         icon: FiType },
  paragraph:         { label: 'Paragraph',         icon: FiAlignLeft },
  list:              { label: 'Bulleted List',     icon: FiList },
  callout:           { label: 'Callout Box',       icon: FiInfo },
  step:              { label: 'Step',              icon: FiHash },
  required_document: { label: 'Required Document', icon: FiFileText },
  fee:               { label: 'Fee',               icon: FiCreditCard },
  checklist:         { label: 'Checklist',         icon: FiCheckSquare },
  faq_item:          { label: 'FAQ (Q & A)',       icon: FiHelpCircle },
  link:              { label: 'Link',              icon: FiLink },
};

// How the "Add block" menu is grouped
export const BLOCK_GROUPS = [
  { label: 'Text',          types: ['h2', 'h3', 'paragraph', 'list', 'callout'] },
  { label: 'Service facts', types: ['step', 'required_document', 'fee', 'checklist', 'faq_item', 'link'] },
];

export const emptyContent = (type) => {
  switch (type) {
    case 'list':              return { items: [''] };
    case 'callout':           return { text: '', style: 'info' };
    case 'step':              return { title: '', text: '' };
    case 'required_document': return { name: '', note: '', mandatory: true };
    case 'fee':               return { label: '', amount: '', note: '' };
    case 'checklist':         return { items: [] };
    case 'faq_item':          return { question: '', answer: '' };
    case 'link':              return { label: '', url: '' };
    default:                  return { text: '' };
  }
};

export const parseContent = (content) => {
  if (typeof content === 'string') {
    try { return JSON.parse(content); } catch { return { text: content }; }
  }
  return content || {};
};

export const parseMetadata = (metadata) => {
  if (typeof metadata === 'string') {
    try { return JSON.parse(metadata); } catch { return {}; }
  }
  return metadata || {};
};

// True when a block has nothing worth saving
export const isBlockEmpty = (block) => {
  const c = parseContent(block.content);
  switch (block.block_type) {
    case 'list':              return !(c.items || []).some(i => String(i).trim());
    case 'checklist':         return !(c.items || []).some(i => String(i?.text ?? i).trim());
    case 'step':              return !c.title?.trim() && !c.text?.trim();
    case 'required_document': return !c.name?.trim();
    case 'fee':               return !c.label?.trim() && !String(c.amount ?? '').trim();
    case 'faq_item':          return !c.question?.trim() && !c.answer?.trim();
    case 'link':              return !c.url?.trim();
    default:                  return !c.text?.trim();
  }
};

// Plain-text version of a block (review diff + future AI)
export const blockToText = (block) => {
  const c = parseContent(block.content);
  switch (block.block_type) {
    case 'list':              return (c.items || []).filter(Boolean).map(i => `• ${i}`).join('\n');
    case 'checklist':         return (c.items || []).map(i => `☐ ${i?.text ?? i}`).join('\n');
    case 'step':              return [c.title, c.text].filter(Boolean).join(' — ');
    case 'required_document': return `${c.name}${c.mandatory === false ? ' (optional)' : ' (required)'}${c.note ? ` — ${c.note}` : ''}`;
    case 'fee':               return `${c.label}: ${formatAmount(c.amount)}${c.note ? ` — ${c.note}` : ''}`;
    case 'faq_item':          return `Q: ${c.question}\nA: ${c.answer}`;
    case 'link':              return `${c.label || c.url} (${c.url})`;
    default:                  return c.text || '';
  }
};

export const formatAmount = (amount) => {
  if (amount === '' || amount == null) return '—';
  const n = Number(amount);
  return Number.isFinite(n) ? `₹${n.toLocaleString('en-IN')}` : String(amount);
};

// ---------------------------------------------------------------------
// Read-only rendering
// ---------------------------------------------------------------------
const FaqItem = ({ c }) => (
  <details className="group mb-3 rounded-xl border border-slate-200 bg-white open:shadow-sm">
    <summary className="flex cursor-pointer list-none items-start gap-3 p-4">
      <FiHelpCircle className="mt-0.5 h-5 w-5 flex-shrink-0 text-navy-700" />
      <span className="flex-1 font-semibold text-slate-900">{c.question}</span>
      <FiChevronDown className="mt-1 h-4 w-4 flex-shrink-0 text-slate-400 transition-transform group-open:rotate-180" />
    </summary>
    <div className="whitespace-pre-wrap border-t border-slate-100 px-4 pb-4 pl-12 pt-3 text-[15px] leading-relaxed text-slate-700">
      {c.answer}
    </div>
  </details>
);

export const BlockView = ({ block, stepNumber }) => {
  const c = parseContent(block.content);

  switch (block.block_type) {
    case 'h1':
      return <h1 className="mb-4 mt-8 text-3xl font-bold tracking-tight text-slate-900">{c.text}</h1>;
    case 'h2':
      return <h2 className="mb-3 mt-8 border-b border-slate-100 pb-2 text-2xl font-bold text-slate-800">{c.text}</h2>;
    case 'h3':
      return <h3 className="mb-2 mt-6 text-xl font-bold text-slate-800">{c.text}</h3>;
    case 'paragraph':
      return <p className="mb-4 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700">{c.text}</p>;
    case 'list':
      return (
        <ul className="mb-4 ml-2 list-inside list-disc space-y-2 text-slate-700">
          {(c.items || []).filter(i => String(i).trim()).map((item, i) => <li key={i} className="leading-relaxed">{item}</li>)}
        </ul>
      );
    case 'callout': {
      const isWarning = c.style === 'warning';
      return (
        <div className={`mb-6 flex gap-3 rounded-xl p-4 ${isWarning ? 'bg-amber-50 text-amber-900' : 'bg-navy-500/10 text-navy-700'}`}>
          {isWarning
            ? <FiAlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
            : <FiInfo className="mt-0.5 h-5 w-5 flex-shrink-0 text-navy-700" />}
          <div className="whitespace-pre-wrap text-[15px] font-medium leading-relaxed">{c.text}</div>
        </div>
      );
    }
    case 'step':
      return (
        <div className="mb-3 flex gap-4">
          <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-navy-700 text-sm font-bold text-white">
            {stepNumber || '•'}
          </div>
          <div className="flex-1 pt-1">
            {c.title && <div className="font-semibold text-slate-900">{c.title}</div>}
            {c.text && <div className="mt-0.5 whitespace-pre-wrap text-[15px] leading-relaxed text-slate-700">{c.text}</div>}
          </div>
        </div>
      );
    case 'required_document':
      return (
        <div className="mb-2 flex items-start gap-3 rounded-xl border border-slate-200 bg-white p-3">
          <div className="rounded-lg bg-navy-500/10 p-2 text-navy-700"><FiFileText className="h-4 w-4" /></div>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold text-slate-900">{c.name}</span>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                c.mandatory === false ? 'bg-slate-100 text-slate-600' : 'bg-rose-50 text-rose-700'
              }`}>
                {c.mandatory === false ? 'Optional' : 'Required'}
              </span>
            </div>
            {c.note && <div className="mt-0.5 text-sm text-slate-500">{c.note}</div>}
          </div>
        </div>
      );
    case 'fee':
      return (
        <div className="mb-2 flex items-center justify-between gap-4 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
          <div className="min-w-0">
            <div className="font-semibold text-slate-900">{c.label}</div>
            {c.note && <div className="text-sm text-slate-500">{c.note}</div>}
          </div>
          <div className="whitespace-nowrap text-lg font-bold text-emerald-700">{formatAmount(c.amount)}</div>
        </div>
      );
    case 'checklist':
      return (
        <ul className="mb-4 space-y-2">
          {(c.items || []).map((item, i) => (
            <li key={i} className="flex items-start gap-2.5 text-[15px] text-slate-700">
              <FiCheckSquare className="mt-0.5 h-4 w-4 flex-shrink-0 text-emerald-600" />
              <span>{item?.text ?? item}</span>
            </li>
          ))}
        </ul>
      );
    case 'faq_item':
      return <FaqItem c={c} />;
    case 'link':
      return (
        <a
          href={c.url}
          target="_blank"
          rel="noopener noreferrer"
          className="mb-2 flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-navy-500/30 hover:shadow-sm"
        >
          <span className="font-semibold text-navy-700">{c.label || c.url}</span>
          <FiExternalLink className="h-4 w-4 flex-shrink-0 text-slate-400" />
        </a>
      );
    default:
      return null;
  }
};

// Renders a list of blocks, numbering consecutive steps 1, 2, 3...
export const BlocksView = ({ blocks = [], showCredit = false }) => {
  let step = 0;
  return (
    <>
      {blocks.map((block, idx) => {
        step = block.block_type === 'step' ? step + 1 : 0;
        const meta = parseMetadata(block.metadata);
        return (
          <div key={block.id || block.block_key || idx} className="group/block relative">
            <BlockView block={block} stepNumber={step || undefined} />
            {showCredit && meta.suggested_by && (
              <div className="-mt-1 mb-3 text-[11px] text-slate-400 opacity-0 transition-opacity group-hover/block:opacity-100">
                Suggested by {meta.suggested_by}{meta.approved_by ? ` · approved by ${meta.approved_by}` : ''}
              </div>
            )}
          </div>
        );
      })}
    </>
  );
};