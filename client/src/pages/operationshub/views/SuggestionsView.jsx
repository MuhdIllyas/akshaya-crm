import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  FiInbox, FiUser, FiClock, FiCheck, FiX, FiLoader, FiAlertTriangle, FiFileText,
  FiMessageSquare, FiRotateCcw, FiChevronRight, FiLayers, FiPlus, FiMinus, FiEdit2,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import {
  fetchSuggestions, fetchSuggestion, approveSuggestion, rejectSuggestion, withdrawSuggestion,
} from '@/services/knowledge';
import { BlockView } from './knowledgeBlocks';
import { diffBlocks, diffSummary } from './suggestionDiff';

const STATUS_STYLES = {
  pending:   'bg-amber-100 text-amber-700',
  approved:  'bg-emerald-100 text-emerald-700',
  rejected:  'bg-rose-100 text-rose-700',
  withdrawn: 'bg-slate-100 text-slate-600',
};

const fmt = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '');

// ---------------------------------------------------------------------
// One row of the diff
// ---------------------------------------------------------------------
const DiffEntry = ({ entry }) => {
  if (entry.kind === 'same') return null;

  if (entry.kind === 'added') {
    return (
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-3">
        <div className="mb-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-emerald-700"><FiPlus /> Added</div>
        <BlockView block={entry.after} />
      </div>
    );
  }
  if (entry.kind === 'removed') {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50/40 p-3">
        <div className="mb-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-rose-700"><FiMinus /> Removed</div>
        <div className="opacity-60 line-through decoration-rose-400"><BlockView block={entry.before} /></div>
      </div>
    );
  }
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-3">
      <div className="mb-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-wider text-amber-700"><FiEdit2 /> Changed</div>
      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">Before</div>
          <div className="opacity-70"><BlockView block={entry.before} /></div>
        </div>
        <div className="rounded-lg border border-emerald-200 bg-white p-3">
          <div className="mb-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600">After</div>
          <BlockView block={entry.after} />
        </div>
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// Detail panel: diff + approve / reject / withdraw
// ---------------------------------------------------------------------
const SuggestionDetail = ({ suggestionId, onClose, onDone }) => {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState('');
  const [rejecting, setRejecting] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        setLoading(true);
        setDetail(await fetchSuggestion(suggestionId));
      } catch (err) {
        toast.error(err.response?.data?.error || 'Failed to load suggestion');
        onClose();
      } finally {
        setLoading(false);
      }
    })();
  }, [suggestionId]);

  const entries = useMemo(
    () => (detail ? diffBlocks(detail.base_blocks || [], detail.proposed_blocks || []) : []),
    [detail]
  );
  const summary = diffSummary(entries);

  const run = async (fn, successMsg) => {
    try {
      setBusy(true);
      await fn();
      toast.success(successMsg);
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.error || 'Something went wrong');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-end bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="flex h-full w-full max-w-3xl flex-col bg-white shadow-2xl animate-in slide-in-from-right duration-200" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-bold text-slate-900">Review Suggestion</h2>
          <button onClick={onClose} className="rounded-lg p-2 text-slate-500 hover:bg-slate-100"><FiX className="h-5 w-5" /></button>
        </div>

        {loading || !detail ? (
          <div className="flex flex-1 items-center justify-center"><FiLoader className="h-8 w-8 animate-spin text-navy-500" /></div>
        ) : (
          <>
            <div className="flex-1 space-y-4 overflow-y-auto p-5">
              {/* Summary */}
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLES[detail.status]}`}>{detail.status}</span>
                  {detail.source_type === 'discussion' && (
                    <span className="flex items-center gap-1 rounded-full bg-navy-500/10 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-navy-700">
                      <FiMessageSquare className="h-3 w-3" /> From a solved discussion
                    </span>
                  )}
                </div>
                <h3 className="mt-2 font-bold text-slate-900">{detail.document_title}</h3>
                <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span className="flex items-center gap-1"><FiLayers className="h-3 w-3" /> {detail.service_name || 'Service'}</span>
                  <span className="flex items-center gap-1"><FiUser className="h-3 w-3" /> {detail.author_name}</span>
                  <span className="flex items-center gap-1"><FiClock className="h-3 w-3" /> {fmt(detail.updated_at || detail.created_at)}</span>
                </div>
                {detail.note && (
                  <p className="mt-3 whitespace-pre-wrap rounded-lg border border-slate-200 bg-white p-3 text-sm text-slate-700">
                    "{detail.note}"
                  </p>
                )}
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold">
                  {summary.added > 0 && <span className="rounded bg-emerald-100 px-2 py-0.5 text-emerald-700">+{summary.added} added</span>}
                  {summary.changed > 0 && <span className="rounded bg-amber-100 px-2 py-0.5 text-amber-700">{summary.changed} changed</span>}
                  {summary.removed > 0 && <span className="rounded bg-rose-100 px-2 py-0.5 text-rose-700">−{summary.removed} removed</span>}
                </div>
              </div>

              {detail.document_changed && (
                <div className="flex gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
                  <FiAlertTriangle className="mt-0.5 h-4 w-4 flex-shrink-0" />
                  The document was edited after this suggestion was made. Approving will replace the current version with this one, so check nothing newer gets lost.
                </div>
              )}

              {detail.status !== 'pending' && detail.reviewer_name && (
                <div className={`rounded-xl border p-3 text-sm ${detail.status === 'approved' ? 'border-emerald-200 bg-emerald-50 text-emerald-900' : 'border-rose-200 bg-rose-50 text-rose-900'}`}>
                  <strong>{detail.status === 'approved' ? 'Approved' : 'Rejected'}</strong> by {detail.reviewer_name} · {fmt(detail.reviewed_at)}
                  {detail.review_note && <p className="mt-1 whitespace-pre-wrap">"{detail.review_note}"</p>}
                </div>
              )}

              {/* Diff */}
              <div className="space-y-3">
                {entries.filter(e => e.kind !== 'same').length === 0 ? (
                  <p className="py-8 text-center text-sm text-slate-500">No visible differences.</p>
                ) : entries.map((e, i) => <DiffEntry key={i} entry={e} />)}
                {entries.some(e => e.kind === 'same') && (
                  <p className="text-center text-xs text-slate-400">{entries.filter(e => e.kind === 'same').length} unchanged block(s) hidden</p>
                )}
              </div>
            </div>

            {/* Actions */}
            {(detail.can_review || detail.can_withdraw) && (
              <div className="space-y-3 border-t border-slate-200 bg-white p-4">
                {detail.can_review && (
                  <>
                    <textarea
                      value={note}
                      onChange={e => setNote(e.target.value)}
                      rows={2}
                      placeholder={rejecting ? 'Reason for rejecting (required) — tell the author what to fix' : 'Note for the author (optional)'}
                      className={`w-full resize-none rounded-xl border px-3 py-2 text-sm outline-none focus:ring-2 ${rejecting ? 'border-rose-300 focus:ring-rose-400' : 'border-slate-200 focus:ring-navy-500'}`}
                    />
                    <div className="flex flex-wrap justify-end gap-2">
                      {rejecting ? (
                        <>
                          <button onClick={() => setRejecting(false)} className="rounded-xl px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">Back</button>
                          <button
                            disabled={busy || !note.trim()}
                            onClick={() => run(() => rejectSuggestion(detail.id, note), 'Suggestion rejected')}
                            className="flex items-center gap-1.5 rounded-xl bg-rose-600 px-5 py-2 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-50"
                          >
                            <FiX className="h-4 w-4" /> Confirm Reject
                          </button>
                        </>
                      ) : (
                        <>
                          <button onClick={() => setRejecting(true)} className="flex items-center gap-1.5 rounded-xl border border-rose-200 px-4 py-2 text-sm font-medium text-rose-600 hover:bg-rose-50">
                            <FiX className="h-4 w-4" /> Reject
                          </button>
                          <button
                            disabled={busy}
                            onClick={() => run(() => approveSuggestion(detail.id, note), 'Approved and published!')}
                            className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-5 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50"
                          >
                            <FiCheck className="h-4 w-4" /> {busy ? 'Publishing...' : 'Approve & Publish'}
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
                {detail.can_withdraw && (
                  <div className="flex justify-end">
                    <button
                      disabled={busy}
                      onClick={() => window.confirm('Withdraw this suggestion?') && run(() => withdrawSuggestion(detail.id), 'Suggestion withdrawn')}
                      className="flex items-center gap-1.5 rounded-xl border border-slate-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
                    >
                      <FiRotateCcw className="h-4 w-4" /> Withdraw
                    </button>
                  </div>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

// ---------------------------------------------------------------------
// List: "To review" and "My suggestions"
//   workspaceId → only this service (workspace tab)
//   no workspaceId → every service (hub page)
// ---------------------------------------------------------------------
const SuggestionsView = ({ workspaceId = null, defaultScope = 'review', showReviewTab = true, onChanged }) => {
  const [scope, setScope] = useState(showReviewTab ? defaultScope : 'mine');
  const [status, setStatus] = useState('pending');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const params = { scope, status };
      if (workspaceId) params.workspaceId = workspaceId;
      setItems(await fetchSuggestions(params));
    } catch (err) {
      toast.error(err.response?.data?.error || 'Failed to load suggestions');
    } finally {
      setLoading(false);
    }
  }, [scope, status, workspaceId]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="animate-in fade-in duration-300">
      <div className="mb-6 flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
        <div>
          <h2 className="flex items-center gap-2 text-2xl font-bold text-slate-900"><FiInbox className="text-navy-700" /> Suggestions</h2>
          <p className="mt-1 text-sm text-slate-500">
            Staff improvements to SOPs and FAQs. Nothing goes live until a reviewer approves it.
          </p>
        </div>
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="flex rounded-xl border border-slate-200 bg-white p-1">
          {showReviewTab && (
            <button onClick={() => setScope('review')} className={`rounded-lg px-4 py-1.5 text-sm font-medium ${scope === 'review' ? 'bg-navy-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
              To Review
            </button>
          )}
          <button onClick={() => setScope('mine')} className={`rounded-lg px-4 py-1.5 text-sm font-medium ${scope === 'mine' ? 'bg-navy-700 text-white' : 'text-slate-600 hover:bg-slate-100'}`}>
            My Suggestions
          </button>
        </div>
        <select value={status} onChange={e => setStatus(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none">
          <option value="pending">Waiting for review</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="withdrawn">Withdrawn</option>
          <option value="all">All</option>
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center p-12"><FiLoader className="h-8 w-8 animate-spin text-navy-500" /></div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-white py-16 text-center">
          <FiInbox className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <h3 className="mb-1 font-bold text-slate-900">
            {scope === 'review' && status === 'pending' ? 'Nothing to review' : 'No suggestions here'}
          </h3>
          <p className="text-sm text-slate-500">
            {scope === 'mine'
              ? 'Open an SOP or FAQ and click "Suggest an Edit" to share what you know.'
              : 'You are all caught up.'}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map(s => (
            <button
              key={s.id}
              onClick={() => setOpenId(s.id)}
              className="group flex w-full items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left transition-all hover:border-navy-500/30 hover:shadow-md"
            >
              <div className={`mt-1 flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full ${s.source_type === 'discussion' ? 'bg-navy-500/10 text-navy-700' : 'bg-amber-50 text-amber-600'}`}>
                {s.source_type === 'discussion' ? <FiMessageSquare className="h-4 w-4" /> : <FiFileText className="h-4 w-4" />}
              </div>
              <div className="min-w-0 flex-1">
                <div className="mb-1 flex flex-wrap items-center gap-2">
                  {!workspaceId && (
                    <span className="flex items-center gap-1 rounded bg-slate-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-slate-600">
                      <FiLayers className="h-3 w-3" /> {s.service_name || 'Service'}
                    </span>
                  )}
                  <span className={`rounded px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider ${STATUS_STYLES[s.status]}`}>{s.status}</span>
                </div>
                <h3 className="font-bold text-slate-900 group-hover:text-navy-700">
                  {s.source_type === 'discussion' ? 'New FAQ entry for ' : 'Edit to '}{s.document_title}
                </h3>
                {s.note && <p className="mt-0.5 line-clamp-1 text-sm text-slate-600">{s.note}</p>}
                <div className="mt-2 flex flex-wrap items-center gap-4 text-xs font-medium text-slate-500">
                  <span className="flex items-center gap-1"><FiUser className="h-3.5 w-3.5" /> {s.author_name}</span>
                  <span className="flex items-center gap-1"><FiClock className="h-3.5 w-3.5" /> {fmt(s.updated_at || s.created_at)}</span>
                  {s.reviewer_name && <span>Reviewed by {s.reviewer_name}</span>}
                </div>
              </div>
              <FiChevronRight className="mt-3 h-5 w-5 text-slate-300 group-hover:text-navy-500" />
            </button>
          ))}
        </div>
      )}

      {openId && (
        <SuggestionDetail
          suggestionId={openId}
          onClose={() => setOpenId(null)}
          onDone={() => { setOpenId(null); load(); onChanged?.(); }}
        />
      )}
    </div>
  );
};

export default SuggestionsView;