import React, { useState } from 'react';
import { FiEdit2, FiFileText, FiEdit3, FiClock, FiInbox, FiAward } from 'react-icons/fi';
import { toast } from 'react-toastify';
import BlockEditor from './BlockEditor';
import { BlocksView } from './knowledgeBlocks';
import ChargesCard from './ChargesCard';
import { can } from '@/utils/knowledgePermissions';
import { fetchMySuggestionForDocument } from '@/services/knowledge';

const DocumentView = ({ document, workspace, workspaceId, contributorRole, onUpdate, onOpenSuggestions }) => {
  // 'edit' (admins / service editors), 'suggest' (everyone else), or null
  const [editorMode, setEditorMode] = useState(null);
  const [draft, setDraft] = useState(null); // my pending suggestion, when continuing it
  const [opening, setOpening] = useState(false);

  // PHASE 2/3: admins + the service's OWNER/EDITOR edit directly; everyone else suggests
  const canEdit = can('document.edit', { workspace, contributorRole });
  const canReview = can('suggestion.review', { workspace, contributorRole });
  const pendingCount = document.pending_suggestions || 0;

  const openSuggest = async () => {
    if (!document.my_pending_suggestion) {
      setDraft(null);
      setEditorMode('suggest');
      return;
    }
    // Continue editing my waiting suggestion instead of starting over
    try {
      setOpening(true);
      const mine = await fetchMySuggestionForDocument(document.id);
      setDraft(mine || null);
      setEditorMode('suggest');
    } catch (err) {
      toast.error('Could not load your suggestion');
    } finally {
      setOpening(false);
    }
  };

  if (editorMode) {
    return (
      <BlockEditor
        document={document}
        workspaceId={workspaceId}
        mode={editorMode}
        initialBlocks={editorMode === 'suggest' && draft ? draft.proposed_blocks : null}
        initialNote={editorMode === 'suggest' && draft ? (draft.note || '') : ''}
        onCancel={() => setEditorMode(null)}
        onSaveSuccess={() => {
          setEditorMode(null);
          onUpdate(); // reload the latest document + suggestion counts
        }}
      />
    );
  }

  const last = document.last_contribution;

  return (
    <div className="animate-in fade-in overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm duration-300">
      {/* Header */}
      <div className="flex flex-col gap-3 border-b border-slate-100 bg-slate-50/50 px-4 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div className="flex items-center gap-3">
          <div className="rounded-lg bg-navy-500/10 p-2 text-navy-700">
            <FiFileText className="h-5 w-5" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-slate-900">{document.title}</h2>
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-xs font-medium text-slate-500">
              <span className="flex items-center gap-1">
                <FiClock className="h-3 w-3" />
                Updated {new Date(document.updated_at || document.created_at).toLocaleDateString('en-IN')}
              </span>
              {last?.author && (
                <span className="flex items-center gap-1">
                  <FiAward className="h-3 w-3 text-amber-500" />
                  Last improved by {last.author}{last.reviewer ? `, approved by ${last.reviewer}` : ''}
                </span>
              )}
            </p>
          </div>
        </div>

        {canEdit ? (
          <button
            onClick={() => setEditorMode('edit')}
            className="flex items-center justify-center gap-2 rounded-xl bg-navy-500/10 px-4 py-2 text-sm font-medium text-navy-700 transition-colors hover:bg-navy-500/20"
          >
            <FiEdit2 className="h-4 w-4" /> Edit Document
          </button>
        ) : (
          <button
            onClick={openSuggest}
            disabled={opening}
            className="flex items-center justify-center gap-2 rounded-xl bg-amber-50 px-4 py-2 text-sm font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50"
          >
            <FiEdit3 className="h-4 w-4" />
            {document.my_pending_suggestion ? 'Edit My Suggestion' : 'Suggest an Edit'}
          </button>
        )}
      </div>

      {/* Banners */}
      {document.my_pending_suggestion && !canEdit && (
        <div className="flex items-center gap-2 border-b border-amber-100 bg-amber-50/60 px-4 py-2.5 text-sm text-amber-800 sm:px-8">
          <FiClock className="h-4 w-4 flex-shrink-0" />
          Your suggestion for this document is waiting for review.
        </div>
      )}
      {canReview && pendingCount > 0 && (
        <button
          onClick={onOpenSuggestions}
          className="flex w-full items-center gap-2 border-b border-navy-500/10 bg-navy-500/5 px-4 py-2.5 text-left text-sm font-medium text-navy-700 hover:bg-navy-500/10 sm:px-8"
        >
          <FiInbox className="h-4 w-4 flex-shrink-0" />
          {pendingCount} suggestion{pendingCount > 1 ? 's' : ''} waiting for review on this document →
        </button>
      )}

      {/* Body */}
      <div className="mx-auto min-h-[400px] max-w-3xl px-4 py-8 sm:px-8">
        {/* Live charges from the centre's configuration (never typed into the SOP) */}
        {document.system_key === 'sop' && workspace?.service_id && (
          <ChargesCard serviceId={workspace.service_id} />
        )}
        {!document.blocks || document.blocks.length === 0 ? (
          <div className="py-20 text-center">
            <p className="text-lg text-slate-400">This document is currently empty.</p>
            <p className="mt-2 text-sm text-slate-400">
              {document.system_key === 'sop'
                ? (canEdit
                    ? 'Click "Edit Document", then "Import from service setup" to start with the required documents already filled in.'
                    : 'Click "Suggest an Edit", then "Import from service setup" to start with the required documents already filled in.')
                : (canEdit
                    ? 'Click "Edit Document" to start adding questions and answers.'
                    : 'Know the answer to a common question? Click "Suggest an Edit" to help your team.')}
            </p>
          </div>
        ) : (
          <div className="pb-12">
            <BlocksView blocks={document.blocks} showCredit />
          </div>
        )}
      </div>
    </div>
  );
};

export default DocumentView;