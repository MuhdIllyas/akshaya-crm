// src/components/automations/ScheduledActionsPanel.jsx
// Shows the reminders scheduled for one service entry, lets staff
// cancel / send now / retry / move them, and schedule new ones later
// (e.g. when the passport appointment gets booked after the entry).

import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { FiZap, FiPlus, FiSend, FiX, FiClock, FiAlertCircle, FiRotateCcw, FiEdit2, FiCheck } from 'react-icons/fi';
import AutomationBuilder, { TypeIcon } from './AutomationBuilder';
import { validateDraft, toApiAction, formatWhen, toLocalInput } from '@/utils/automations/automationUtils';
import {
  getEntryAutomations, createAutomations, cancelAutomation,
  runAutomationNow, rescheduleAutomation, getPresets,
} from '/src/services/automationService';

const STATUS = {
  pending:    { label: 'Scheduled', cls: 'bg-amber-50 text-amber-700 border-amber-200' },
  processing: { label: 'Sending…',  cls: 'bg-blue-50 text-blue-700 border-blue-200' },
  done:       { label: 'Done',      cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  failed:     { label: 'Failed',    cls: 'bg-rose-50 text-rose-700 border-rose-200' },
  cancelled:  { label: 'Cancelled', cls: 'bg-gray-100 text-gray-500 border-gray-200' },
};

const btnCls =
  'inline-flex items-center gap-1 px-2 py-1 rounded text-[11px] font-medium border transition disabled:opacity-50';

export default function ScheduledActionsPanel({
  serviceEntryId,
  categoryId,
  subcategoryId,
  customerName,
  serviceName,
  staffList = [],
  suggestedDocs = [],
  presets: presetsProp,
  defaultAssignee = '',
}) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [presets, setPresets] = useState(presetsProp || []);
  const [adding, setAdding] = useState(false);
  const [drafts, setDrafts] = useState([]);
  const [showErrors, setShowErrors] = useState(false);
  const [saving, setSaving] = useState(false);
  const [busyId, setBusyId] = useState(null);
  const [editing, setEditing] = useState({ id: null, value: '' });

  useEffect(() => {
    if (presetsProp && presetsProp.length) setPresets(presetsProp);
    else getPresets().then(setPresets).catch(() => {});
  }, [presetsProp]);

  const load = useCallback(async () => {
    if (!serviceEntryId) return;
    setLoading(true);
    try {
      setItems(await getEntryAutomations(serviceEntryId));
    } catch {
      toast.error('Failed to load scheduled reminders');
    } finally {
      setLoading(false);
    }
  }, [serviceEntryId]);

  useEffect(() => {
    load();
  }, [load]);

  const act = async (id, fn, successMsg) => {
    setBusyId(id);
    try {
      const res = await fn();
      toast.success(res?.message || successMsg);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Action failed');
    } finally {
      setBusyId(null);
    }
  };

  const save = async () => {
    if (!drafts.length) return;
    const errs = drafts.flatMap((d) => {
      const p = presets.find((x) => x.id === d.presetId);
      return p ? validateDraft(p, d) : ['Reminder type not found'];
    });
    if (errs.length) {
      setShowErrors(true);
      toast.error('Please fix the highlighted fields');
      return;
    }
    setSaving(true);
    try {
      const res = await createAutomations(
        serviceEntryId,
        drafts.map((d) => toApiAction(d, { service_name: serviceName }))
      );
      toast.success(`⏰ ${res.created.length} reminder(s) scheduled`);
      setDrafts([]);
      setAdding(false);
      setShowErrors(false);
      await load();
    } catch (e) {
      toast.error(e.response?.data?.error || 'Failed to schedule', { autoClose: 8000 });
    } finally {
      setSaving(false);
    }
  };

  const label = (a) => a.payload?.label || a.template_key || 'Scheduled action';
  const isWA = (a) => a.action_type === 'whatsapp_template';

  return (
    <div>
      <div className="flex items-center gap-2 mb-3">
        <FiZap className="h-4 w-4 text-indigo-500" />
        <h4 className="font-semibold text-gray-800">Scheduled Reminders</h4>
        {items.filter((i) => i.status === 'pending').length > 0 && (
          <span className="text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">
            {items.filter((i) => i.status === 'pending').length} upcoming
          </span>
        )}
        {!adding && (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="ml-auto text-xs font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
          >
            <FiPlus className="h-3.5 w-3.5" /> Schedule
          </button>
        )}
      </div>

      {loading ? (
        <div className="flex justify-center py-4">
          <div className="w-5 h-5 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : items.length === 0 && !adding ? (
        <p className="text-xs text-gray-400 bg-gray-50 border border-dashed border-gray-200 rounded-lg p-3 text-center">
          No reminders scheduled for this entry.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((a) => {
            const st = STATUS[a.status] || STATUS.pending;
            const busy = busyId === a.id;
            const when = new Date(a.run_at);
            return (
              <div key={a.id} className="border border-gray-200 rounded-lg p-2.5 bg-white">
                <div className="flex items-start gap-2">
                  <TypeIcon actionType={a.action_type} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-semibold text-gray-800">{label(a)}</span>
                      <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full border ${st.cls}`}>
                        {a.status === 'done' && !isWA(a) ? 'Task created' : a.status === 'done' ? 'Sent' : st.label}
                      </span>
                    </div>
                    <div className="text-[11px] text-gray-500 mt-0.5 flex items-center gap-1">
                      <FiClock className="h-3 w-3" />
                      {a.status === 'done' && a.executed_at
                        ? `${isWA(a) ? 'Sent' : 'Created'} ${formatWhen(new Date(a.executed_at))}`
                        : formatWhen(when)}
                      {a.created_by_name && <span className="text-gray-400">· by {a.created_by_name}</span>}
                    </div>
                    {a.task_id && (
                      <div className="text-[11px] text-blue-600 mt-0.5">
                        Task #{a.task_id}{a.task_status ? ` · ${a.task_status}` : ''}
                      </div>
                    )}
                    {a.last_error && ['failed', 'pending', 'cancelled'].includes(a.status) && (
                      <div className={`text-[11px] mt-0.5 flex gap-1 ${a.status === 'failed' ? 'text-rose-600' : 'text-gray-500'}`}>
                        <FiAlertCircle className="h-3 w-3 mt-0.5 shrink-0" />
                        {a.status === 'pending' ? `Retrying: ${a.last_error}` : a.last_error}
                      </div>
                    )}

                    {editing.id === a.id && (
                      <div className="flex items-center gap-2 mt-2">
                        <input
                          type="datetime-local"
                          value={editing.value}
                          min={toLocalInput(new Date())}
                          onChange={(e) => setEditing({ id: a.id, value: e.target.value })}
                          className="px-2 py-1 text-xs border border-gray-300 rounded-md"
                        />
                        <button
                          type="button"
                          disabled={busy || !editing.value}
                          onClick={() =>
                            act(a.id, () => rescheduleAutomation(a.id, editing.value), 'Rescheduled').then(() =>
                              setEditing({ id: null, value: '' })
                            )
                          }
                          className={`${btnCls} border-indigo-200 text-indigo-700 hover:bg-indigo-50`}
                        >
                          <FiCheck className="h-3 w-3" /> Save
                        </button>
                        <button type="button" onClick={() => setEditing({ id: null, value: '' })}
                          className="text-gray-400 hover:text-gray-600 p-1">
                          <FiX className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {['pending', 'failed'].includes(a.status) && editing.id !== a.id && (
                  <div className="flex flex-wrap gap-1.5 mt-2 pl-8">
                    {a.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => {
                            if (isWA(a) && !window.confirm(`Send "${label(a)}" to the customer now?`)) return;
                            act(a.id, () => runAutomationNow(a.id), 'Queued');
                          }}
                          className={`${btnCls} border-emerald-200 text-emerald-700 hover:bg-emerald-50`}
                        >
                          <FiSend className="h-3 w-3" /> {isWA(a) ? 'Send now' : 'Create now'}
                        </button>
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() => setEditing({ id: a.id, value: toLocalInput(when) })}
                          className={`${btnCls} border-gray-200 text-gray-600 hover:bg-gray-50`}
                        >
                          <FiEdit2 className="h-3 w-3" /> Change time
                        </button>
                      </>
                    )}
                    {a.status === 'failed' && (
                      <button
                        type="button"
                        disabled={busy}
                        onClick={() => {
                          if (
                            isWA(a) &&
                            !window.confirm('Retry sending? Check the customer chat first to avoid sending it twice.')
                          )
                            return;
                          act(a.id, () => runAutomationNow(a.id), 'Queued for retry');
                        }}
                        className={`${btnCls} border-indigo-200 text-indigo-700 hover:bg-indigo-50`}
                      >
                        <FiRotateCcw className="h-3 w-3" /> Retry
                      </button>
                    )}
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        if (!window.confirm(`Cancel "${label(a)}"?`)) return;
                        act(a.id, () => cancelAutomation(a.id), 'Cancelled');
                      }}
                      className={`${btnCls} border-rose-200 text-rose-600 hover:bg-rose-50`}
                    >
                      <FiX className="h-3 w-3" /> {a.status === 'failed' ? 'Dismiss' : 'Cancel'}
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {adding && (
        <div className="mt-3 border border-indigo-100 rounded-lg p-3 bg-indigo-50/30 space-y-3">
          <AutomationBuilder
            value={drafts}
            onChange={setDrafts}
            presets={presets}
            categoryId={categoryId}
            subcategoryId={subcategoryId}
            staffList={staffList}
            suggestedDocs={suggestedDocs}
            customerName={customerName}
            serviceName={serviceName}
            defaultAssignee={defaultAssignee}
            showErrors={showErrors}
          />
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => {
                setAdding(false);
                setDrafts([]);
                setShowErrors(false);
              }}
              className="px-3 py-1.5 text-xs bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={save}
              disabled={saving || drafts.length === 0}
              className="px-3 py-1.5 text-xs bg-indigo-600 text-white rounded-md hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-1.5"
            >
              {saving ? (
                <div className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              ) : (
                <FiZap className="h-3 w-3" />
              )}
              Save reminders
            </button>
          </div>
        </div>
      )}
    </div>
  );
}