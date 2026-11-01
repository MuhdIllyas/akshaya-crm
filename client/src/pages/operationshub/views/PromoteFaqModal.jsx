import React, { useState } from 'react';
import { FiX, FiHelpCircle } from 'react-icons/fi';
import { toast } from 'react-toastify';
import { promoteDiscussionToFaq } from '@/services/knowledge';

// "@[Ramesh](12) please check" → "@Ramesh please check"
const stripMentions = (text = '') => text.replace(/@\[(.*?)\]\(\d+\)/g, '@$1');

/**
 * Turns a solved discussion into an FAQ entry.
 * Editors/admins → added to the FAQ straight away.
 * Everyone else  → sent to the review queue as a suggestion.
 */
const PromoteFaqModal = ({ discussion, onClose, onDone }) => {
  const best = (discussion.replies || []).find(r => r.is_best || r.is_best_answer);
  const [question, setQuestion] = useState(discussion.title || '');
  const [answer, setAnswer] = useState(stripMentions(best?.content || ''));
  const [saving, setSaving] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      const res = await promoteDiscussionToFaq(discussion.id, { question, answer });
      toast.success(res.mode === 'published'
        ? 'Added to the FAQ!'
        : 'Sent to the reviewers. It will appear in the FAQ once approved.');
      onDone?.(res);
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to add to FAQ');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm" onClick={onClose}>
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900">
            <FiHelpCircle className="text-navy-700" /> Add to FAQ
          </h2>
          <button onClick={onClose} className="rounded-xl p-2 text-slate-500 hover:bg-slate-100"><FiX className="h-5 w-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 p-6">
          <p className="text-sm text-slate-500">
            Rewrite this as a clear question and answer that anyone at any centre can follow. Remove customer names and personal details.
          </p>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Question</label>
            <input
              required
              value={question}
              onChange={e => setQuestion(e.target.value)}
              className="min-h-[44px] w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-base outline-none focus:bg-white focus:ring-2 focus:ring-navy-500 sm:text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-sm font-semibold text-slate-700">Answer</label>
            <textarea
              required
              rows={6}
              value={answer}
              onChange={e => setAnswer(e.target.value)}
              placeholder="The solution that worked..."
              className="w-full resize-y rounded-xl border border-slate-200 bg-slate-50 px-4 py-2 text-sm outline-none focus:bg-white focus:ring-2 focus:ring-navy-500"
            />
            {!best && <p className="mt-1 text-xs text-slate-400">No best answer was marked, so write the solution here.</p>}
          </div>
          <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
            <button type="button" onClick={onClose} className="rounded-xl px-5 py-2.5 text-sm font-medium text-slate-600 hover:bg-slate-100">Cancel</button>
            <button
              type="submit"
              disabled={saving || !question.trim() || !answer.trim()}
              className="rounded-xl bg-navy-700 px-6 py-2.5 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-50"
            >
              {saving ? 'Saving...' : 'Add to FAQ'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default PromoteFaqModal;