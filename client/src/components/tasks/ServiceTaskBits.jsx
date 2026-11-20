// src/components/tasks/ServiceTaskBits.jsx
// Pieces for "service tasks": an admin / superadmin assigns a service (and
// customer) to a staff member as a task. The staff member opens it in a
// pre-filled Service Entry form; saving the entry completes the task.
// Staff can hand it back or cancel it with a note, which admins can see.

import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { FiBriefcase, FiPlayCircle, FiCornerUpLeft, FiXCircle, FiUserPlus, FiMessageSquare } from 'react-icons/fi';

const API = import.meta.env.VITE_API_URL;
const authHeaders = () => ({
  'Content-Type': 'application/json',
  Authorization: `Bearer ${localStorage.getItem('token')}`,
});

export const SERVICE_ENTRY_PATH = '/dashboard/staff/service_entry';

export const isServiceTask = (task) => task?.task_kind === 'service';
export const isClosedTask = (task) => ['declined', 'cancelled'].includes(task?.status);
export const isOpenTask = (task) => !task?.status || ['pending', 'in_progress'].includes(task.status);

export const serviceLabel = (task) =>
  [task?.service_name, task?.service_subcategory_name].filter(Boolean).join(' – ');

/* ───────────── Create-task form fields ───────────── */

/**
 * Service + sub-category pickers and customer fields.
 * `centreId`: the assignee's centre (so only services set up there are listed).
 */
export function ServiceTaskFields({ form, onChange, centreId }) {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    const url = `${API}/api/servicemanagement/categories${centreId ? `?centre_id=${centreId}` : ''}`;
    fetch(url, { headers: authHeaders() })
      .then((r) => (r.ok ? r.json() : []))
      .then((d) => alive && setCategories(Array.isArray(d) ? d : []))
      .catch(() => alive && setCategories([]))
      .finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, [centreId]);

  const selected = categories.find((c) => String(c.id) === String(form.serviceId));
  const subs = selected?.subcategories || [];
  const set = (name, value) => onChange({ target: { name, value } });
  const input = 'w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-navy-700 focus:border-transparent';

  return (
    <div className="space-y-3 rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Service *</label>
        <select
          value={form.serviceId}
          onChange={(e) => { set('serviceId', e.target.value); set('subcategoryId', ''); }}
          className={input}
          disabled={loading}
        >
          <option value="">{loading ? 'Loading services…' : centreId ? 'Select service' : 'Pick the staff member first'}</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
      {subs.length > 0 && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sub-category</label>
          <select value={form.subcategoryId} onChange={(e) => set('subcategoryId', e.target.value)} className={input}>
            <option value="">Let staff choose</option>
            {subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Customer name</label>
          <input name="customerName" value={form.customerName} onChange={onChange} className={input} placeholder="Customer name" />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Customer phone</label>
          <input name="customerPhone" value={form.customerPhone} onChange={onChange} className={input}
                 inputMode="numeric" maxLength={14} placeholder="10-digit mobile" />
        </div>
      </div>
      <p className="text-xs text-gray-500">
        Charges come from the service setup when the staff member saves the entry. Saving it completes this task.
      </p>
    </div>
  );
}

/** Find a category name for a default task title. */
export async function fetchServiceTitle(centreId, serviceId, subcategoryId) {
  try {
    const r = await fetch(`${API}/api/servicemanagement/categories${centreId ? `?centre_id=${centreId}` : ''}`, { headers: authHeaders() });
    const cats = r.ok ? await r.json() : [];
    const c = cats.find((x) => String(x.id) === String(serviceId));
    const s = c?.subcategories?.find((x) => String(x.id) === String(subcategoryId));
    return [c?.name, s?.name].filter(Boolean).join(' – ');
  } catch {
    return '';
  }
}

/* ───────────── Badges and notes on a task card ───────────── */

export function ServiceTaskBadge({ task }) {
  if (!isServiceTask(task)) return null;
  return (
    <span className="inline-flex items-center gap-1 text-[9px] bg-indigo-50 text-indigo-700 border border-indigo-100 px-1.5 py-0.5 rounded uppercase font-bold tracking-wider">
      <FiBriefcase size={8} /> Service
    </span>
  );
}

/** Service + customer line for a service task that has no entry yet. */
export function ServiceTaskSummary({ task }) {
  if (!isServiceTask(task) || task.related_service_entry_id) return null;
  const customer = [task.service_customer_name, task.service_phone].filter(Boolean).join(' · ');
  return (
    <p className="text-[11px] text-indigo-700 font-medium truncate">
      {serviceLabel(task) || 'Service'}{customer ? ` · ${customer}` : ''}
    </p>
  );
}

/** The note left when a task was handed back or cancelled. */
export function TaskCloseNote({ task }) {
  if (!isClosedTask(task) || !task.close_reason) return null;
  const declined = task.status === 'declined';
  return (
    <div className={`mt-1.5 rounded-md border px-2 py-1.5 text-[11px] ${declined ? 'bg-amber-50 border-amber-200 text-amber-900' : 'bg-rose-50 border-rose-200 text-rose-900'}`}>
      <p className="font-bold flex items-center gap-1">
        <FiMessageSquare size={10} />
        {declined ? 'Handed back' : 'Cancelled'}
        {task.closed_by_name ? ` by ${task.closed_by_name}` : ''}
        {task.closed_at ? ` · ${new Date(task.closed_at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })}` : ''}
      </p>
      <p className="whitespace-pre-line break-words">{task.close_reason}</p>
    </div>
  );
}

export const closedStatusStyles = (status) =>
  status === 'declined' ? 'bg-amber-100 text-amber-800' : status === 'cancelled' ? 'bg-rose-100 text-rose-700' : null;

/* ───────────── Actions ───────────── */

export async function closeTask(taskId, action, reason) {
  const res = await fetch(`${API}/api/tasks/${taskId}/close`, {
    method: 'POST',
    headers: authHeaders(),
    body: JSON.stringify({ action, reason }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data.task;
}

export async function reassignTask(taskId, assignedTo) {
  const res = await fetch(`${API}/api/tasks/${taskId}/reassign`, {
    method: 'PATCH',
    headers: authHeaders(),
    body: JSON.stringify({ assigned_to: assignedTo }),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
  return data.task;
}

/** Open the Service Entry form pre-filled from a service task. */
export const startServiceEntry = (navigate, task) =>
  navigate(SERVICE_ENTRY_PATH, {
    state: {
      fromTask: {
        id: task.id,
        title: task.title,
        description: task.description,
        service_id: task.related_service_id,
        subcategory_id: task.related_subcategory_id,
        service_label: serviceLabel(task),
        customer_name: task.customer_name || task.service_customer_name,
        customer_phone: task.customer_phone || task.service_phone,
      },
    },
  });

/**
 * Buttons for a task card. Shows what the current user may do:
 *  - assignee of an open service task: Start entry, Hand back
 *  - assignee (any open task) or admin: Cancel with note
 *  - admin on a handed-back / cancelled task: Reassign
 */
export function TaskActionButtons({ task, currentUser, staffList = [], onChanged, compact = false }) {
  const navigate = useNavigate();
  const [dialog, setDialog] = useState(null); // 'decline' | 'cancel' | 'reassign'

  const isAssignee = String(task.assigned_to) === String(currentUser.id);
  const isAdmin = ['admin', 'superadmin'].includes(currentUser.role);
  const open = isOpenTask(task);

  const canStart = isServiceTask(task) && open && isAssignee;
  const canDecline = open && isAssignee && isServiceTask(task);
  const canCancel = open && (isAssignee || isAdmin);
  const canReassign = isAdmin && isClosedTask(task);

  if (!canStart && !canDecline && !canCancel && !canReassign) return null;

  const btn = `inline-flex items-center gap-1 rounded-md border font-semibold transition ${compact ? 'text-[10px] px-1.5 py-0.5' : 'text-xs px-2 py-1'}`;
  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };

  return (
    <>
      <div className="flex flex-wrap items-center gap-1.5" onMouseDown={(e) => e.stopPropagation()}>
        {canStart && (
          <button type="button" onClick={stop(() => startServiceEntry(navigate, task))}
                  className={`${btn} bg-indigo-600 border-indigo-600 text-white hover:bg-indigo-700`}>
            <FiPlayCircle size={11} /> Start entry
          </button>
        )}
        {canDecline && (
          <button type="button" onClick={stop(() => setDialog('decline'))}
                  className={`${btn} bg-white border-amber-300 text-amber-700 hover:bg-amber-50`}>
            <FiCornerUpLeft size={11} /> Hand back
          </button>
        )}
        {canCancel && (
          <button type="button" onClick={stop(() => setDialog('cancel'))}
                  className={`${btn} bg-white border-rose-200 text-rose-600 hover:bg-rose-50`}>
            <FiXCircle size={11} /> Cancel
          </button>
        )}
        {canReassign && (
          <button type="button" onClick={stop(() => setDialog('reassign'))}
                  className={`${btn} bg-white border-navy-200 text-navy-700 hover:bg-gray-50`}>
            <FiUserPlus size={11} /> Reassign
          </button>
        )}
      </div>

      {(dialog === 'decline' || dialog === 'cancel') && (
        <CloseTaskDialog task={task} action={dialog} onClose={() => setDialog(null)}
                         onDone={(t) => { setDialog(null); onChanged?.(t); }} />
      )}
      {dialog === 'reassign' && (
        <ReassignDialog task={task} staffList={staffList} onClose={() => setDialog(null)}
                        onDone={(t) => { setDialog(null); onChanged?.(t); }} />
      )}
    </>
  );
}

const QUICK_REASONS = {
  cancel: ['Customer does not have the required documents', 'Customer no longer needs the service', 'Customer not reachable'],
  decline: ['Not trained for this service', 'Too much work today', 'Needs a different centre'],
};

function Modal({ children, onClose }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[60] p-4"
         onClick={(e) => { e.stopPropagation(); onClose(); }} onMouseDown={(e) => e.stopPropagation()}>
      <div className="bg-white rounded-xl w-full max-w-md shadow-xl p-5" onClick={(e) => e.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function CloseTaskDialog({ task, action, onClose, onDone }) {
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const cancel = action === 'cancel';

  const submit = async () => {
    if (reason.trim().length < 5) return toast.error('Please write a short note explaining why');
    setSaving(true);
    try {
      const t = await closeTask(task.id, action, reason.trim());
      toast.success(cancel ? 'Task cancelled' : 'Task handed back to the admin');
      onDone(t);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <h3 className="text-lg font-bold text-gray-800">{cancel ? 'Cancel task' : 'Hand task back'}</h3>
      <p className="text-sm text-gray-500 mt-0.5 mb-3 truncate">{task.title}</p>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {QUICK_REASONS[action].map((r) => (
          <button key={r} type="button" onClick={() => setReason(r)}
                  className="text-[11px] px-2 py-1 rounded-full border border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100">
            {r}
          </button>
        ))}
      </div>
      <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4} maxLength={1000} autoFocus
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-navy-700 focus:border-transparent"
                placeholder={cancel ? 'Why is this being cancelled? (e.g. which documents are missing)' : 'Why are you handing this back?'} />
      <p className="text-xs text-gray-500 mt-1">
        {cancel ? 'The note is saved on the task and sent to the admin who assigned it.'
                : 'The admin is notified and can give the task to someone else.'}
      </p>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">Back</button>
        <button type="button" onClick={submit} disabled={saving}
                className={`px-4 py-2 text-sm text-white rounded-lg font-medium disabled:opacity-50 ${cancel ? 'bg-rose-600 hover:bg-rose-700' : 'bg-amber-600 hover:bg-amber-700'}`}>
          {saving ? 'Saving…' : cancel ? 'Cancel task' : 'Hand back'}
        </button>
      </div>
    </Modal>
  );
}

function ReassignDialog({ task, staffList, onClose, onDone }) {
  const [staffId, setStaffId] = useState('');
  const [saving, setSaving] = useState(false);
  const sameCentre = staffList.filter((s) => String(s.centre_id) === String(task.centre_id));

  const submit = async () => {
    if (!staffId) return toast.error('Pick a staff member');
    setSaving(true);
    try {
      const t = await reassignTask(task.id, parseInt(staffId, 10));
      toast.success('Task reassigned');
      onDone(t);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Modal onClose={onClose}>
      <h3 className="text-lg font-bold text-gray-800">Reassign task</h3>
      <p className="text-sm text-gray-500 mt-0.5 mb-3 truncate">{task.title}</p>
      <TaskCloseNote task={task} />
      <select value={staffId} onChange={(e) => setStaffId(e.target.value)}
              className="mt-3 w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-navy-700 focus:border-transparent">
        <option value="">Select staff</option>
        {sameCentre.map((s) => (
          <option key={s.id} value={s.id}>{s.name}{String(s.id) === String(task.assigned_to) ? ' (previous)' : ''}</option>
        ))}
      </select>
      <p className="text-xs text-gray-500 mt-1">The task opens again as To Do for the new staff member.</p>
      <div className="mt-4 flex justify-end gap-2">
        <button type="button" onClick={onClose} className="px-3 py-2 text-sm text-gray-600 hover:text-gray-800 font-medium">Back</button>
        <button type="button" onClick={submit} disabled={saving}
                className="px-4 py-2 text-sm text-white rounded-lg font-medium bg-navy-700 hover:bg-navy-800 disabled:opacity-50">
          {saving ? 'Saving…' : 'Reassign'}
        </button>
      </div>
    </Modal>
  );
}
