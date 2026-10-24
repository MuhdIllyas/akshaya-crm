// src/components/automations/AutomationBuilder.jsx
import React, { useEffect, useMemo, useState } from 'react';
import {
  FiPlus, FiTrash2, FiClock, FiAlertCircle, FiZap, FiMessageSquare, FiUserCheck, FiX, FiCheck,
} from 'react-icons/fi';
import { previewAutomation } from '/src/services/automationService';
import {
  presetsForService, newDraft, describeTrigger, describeTriggers, validateDraft,
  formatWhen, toLocalInput, isWhatsAppPreset,
} from '@/utils/automations/automationUtils';

const inputCls =
  'w-full px-3 py-2 text-xs border border-gray-300 rounded-md focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white shadow-sm';
const labelCls = 'block text-[11px] font-semibold text-gray-600 mb-1 uppercase tracking-wide';
const chipCls =
  'inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium border border-indigo-200 text-indigo-700 bg-white hover:bg-indigo-50 transition';

/* ---------- small shared bits (also used by ScheduledActionsPanel) ---------- */

export const TypeIcon = ({ preset, actionType }) => {
  const wa = actionType ? actionType === 'whatsapp_template' : isWhatsAppPreset(preset);
  return wa ? (
    <span className="bg-green-100 text-green-700 p-1 rounded shrink-0"><FiMessageSquare className="h-3.5 w-3.5" /></span>
  ) : (
    <span className="bg-blue-100 text-blue-700 p-1 rounded shrink-0"><FiUserCheck className="h-3.5 w-3.5" /></span>
  );
};

export const TypeBadge = ({ preset }) => (
  <span
    className={`text-[10px] font-semibold px-1.5 py-0.5 rounded-full whitespace-nowrap ${
      isWhatsAppPreset(preset) ? 'bg-green-50 text-green-700' : 'bg-blue-50 text-blue-700'
    }`}
  >
    {isWhatsAppPreset(preset) ? 'System sends WhatsApp' : 'Task for staff'}
  </span>
);

export function renderWhatsAppText(text) {
  return String(text)
    .split(/(\*[^*\n]+\*|_[^_\n]+_)/g)
    .map((part, i) => {
      if (/^\*[^*\n]+\*$/.test(part)) return <strong key={i}>{part.slice(1, -1)}</strong>;
      if (/^_[^_\n]+_$/.test(part)) return <em key={i}>{part.slice(1, -1)}</em>;
      return <React.Fragment key={i}>{part}</React.Fragment>;
    });
}

/* ================================================================= */

export default function AutomationBuilder({
  value = [],
  onChange,
  presets = [],
  categoryId,
  subcategoryId,
  staffList = [],
  suggestedDocs = [],
  customerName = '',
  serviceName = '',
  defaultAssignee = '',
  showErrors = false,
}) {
  const available = useMemo(
    () => presetsForService(presets, categoryId, subcategoryId),
    [presets, categoryId, subcategoryId]
  );
  const [picking, setPicking] = useState(false);

  const update = (localId, patch) =>
    onChange(value.map((d) => (d.localId === localId ? { ...d, ...patch } : d)));
  const remove = (localId) => onChange(value.filter((d) => d.localId !== localId));
  const add = (preset) => {
    onChange([...value, newDraft(preset, { suggestedDocs, defaultAssignee })]);
    setPicking(false);
  };

  if (!categoryId) {
    return (
      <p className="text-xs text-gray-400 text-center py-6">
        Select a service first to see the reminders available for it.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <FiZap className="text-indigo-500 h-4 w-4" />
        <span className="text-sm font-semibold text-gray-800">Scheduled reminders</span>
      </div>

      {value.map((draft) => {
        const preset = presets.find((p) => p.id === draft.presetId);
        if (!preset) return null;
        return (
          <DraftCard
            key={draft.localId}
            draft={draft}
            preset={preset}
            onChange={(patch) => update(draft.localId, patch)}
            onRemove={() => remove(draft.localId)}
            staffList={staffList}
            suggestedDocs={suggestedDocs}
            customerName={customerName}
            serviceName={serviceName}
            showErrors={showErrors}
          />
        );
      })}

      {available.length === 0 ? (
        <p className="text-xs text-gray-400 text-center py-3 bg-gray-50 rounded-lg border border-dashed border-gray-200">
          No reminders are set up for this service yet.
        </p>
      ) : picking ? (
        <div className="border border-indigo-200 rounded-lg p-2 bg-indigo-50/40 space-y-1.5">
          <div className="flex justify-between items-center px-1">
            <span className="text-[11px] font-semibold text-indigo-700 uppercase tracking-wide">
              What should happen?
            </span>
            <button type="button" onClick={() => setPicking(false)} className="text-gray-400 hover:text-gray-600 p-0.5">
              <FiX className="h-3.5 w-3.5" />
            </button>
          </div>
          {available.map((p) => (
            <button
              key={p.id}
              type="button"
              onClick={() => add(p)}
              className="w-full flex items-center gap-2 text-left px-3 py-2 rounded-md bg-white border border-gray-200 hover:border-indigo-300 hover:bg-indigo-50 text-xs transition"
            >
              <TypeIcon preset={p} />
              <span className="font-medium text-gray-800 flex-1">{p.name}</span>
              <TypeBadge preset={p} />
            </button>
          ))}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setPicking(true)}
          className="w-full py-2.5 border-2 border-dashed border-indigo-200 rounded-lg text-indigo-600 text-xs font-semibold hover:bg-indigo-50 hover:border-indigo-300 transition flex items-center justify-center gap-1.5"
        >
          <FiPlus className="h-3.5 w-3.5" /> Schedule a reminder
        </button>
      )}
    </div>
  );
}

/* ================================================================= */

function DraftCard({ draft, preset, onChange, onRemove, staffList, suggestedDocs, customerName, serviceName, showErrors }) {
  const errors = showErrors ? validateDraft(preset, draft) : [];
  const setField = (key, val) => onChange({ fields: { ...draft.fields, [key]: val } });

  return (
    <div className={`rounded-lg border bg-white shadow-sm ${errors.length ? 'border-rose-300' : 'border-gray-200'}`}>
      <div className="flex items-center justify-between gap-2 px-3 py-2 border-b border-gray-100 bg-gray-50 rounded-t-lg">
        <div className="flex items-center gap-2 min-w-0">
          <TypeIcon preset={preset} />
          <span className="text-xs font-semibold text-gray-800 truncate">{preset.name}</span>
          <TypeBadge preset={preset} />
        </div>
        <button type="button" onClick={onRemove} className="text-gray-400 hover:text-rose-500 hover:bg-rose-50 p-1 rounded transition">
          <FiTrash2 className="h-3.5 w-3.5" />
        </button>
      </div>

      <div className="p-3 space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {(preset.fields || []).map((f) => (
            <div key={f.key} className={['documents', 'textarea'].includes(f.type) ? 'md:col-span-2' : ''}>
              <label className={labelCls}>
                {f.label}
                {f.required && <span className="text-rose-500"> *</span>}
              </label>
              <FieldInput
                field={f}
                value={draft.fields[f.key]}
                onChange={(v) => setField(f.key, v)}
                staffList={staffList}
                suggestedDocs={suggestedDocs}
              />
            </div>
          ))}
        </div>

        <TriggerEditor preset={preset} draft={draft} onChange={(triggers) => onChange({ triggers })} />

        {isWhatsAppPreset(preset) && (
          <WhatsAppPreview preset={preset} draft={draft} customerName={customerName} serviceName={serviceName} />
        )}

        {errors.length > 0 && (
          <ul className="text-[11px] text-rose-600 space-y-0.5">
            {errors.map((e, i) => (
              <li key={i} className="flex gap-1">
                <FiAlertCircle className="mt-0.5 shrink-0" /> {e}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

/* ================================================================= */

function FieldInput({ field, value, onChange, staffList, suggestedDocs }) {
  const now = toLocalInput(new Date());
  switch (field.type) {
    case 'datetime':
      return (
        <input type="datetime-local" className={inputCls} value={value || ''} min={now}
          onChange={(e) => onChange(e.target.value)} />
      );
    case 'date':
      return (
        <input type="date" className={inputCls} value={value || ''} min={now.slice(0, 10)}
          onChange={(e) => onChange(e.target.value)} />
      );
    case 'textarea':
      return (
        <textarea rows={2} className={`${inputCls} resize-none`} placeholder={field.placeholder || ''}
          value={value || ''} onChange={(e) => onChange(e.target.value)} />
      );
    case 'staff':
      return (
        <select className={inputCls} value={value || ''} onChange={(e) => onChange(e.target.value)}>
          <option value="">Select staff</option>
          {staffList.map((s) => (
            <option key={s.id} value={s.id}>{s.display}</option>
          ))}
        </select>
      );
    case 'documents':
      return <DocumentsInput value={Array.isArray(value) ? value : []} onChange={onChange} suggestions={suggestedDocs} />;
    default:
      return (
        <input type="text" className={inputCls} placeholder={field.placeholder || ''} value={value || ''}
          onChange={(e) => onChange(e.target.value)} />
      );
  }
}

function DocumentsInput({ value, onChange, suggestions }) {
  const [text, setText] = useState('');
  const toggle = (doc) => onChange(value.includes(doc) ? value.filter((d) => d !== doc) : [...value, doc]);
  const addCustom = () => {
    const t = text.trim();
    if (t && !value.includes(t)) onChange([...value, t]);
    setText('');
  };
  const all = [...suggestions, ...value.filter((d) => !suggestions.includes(d))];

  return (
    <div className="space-y-2">
      {all.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {all.map((doc) => {
            const on = value.includes(doc);
            return (
              <button
                key={doc}
                type="button"
                onClick={() => toggle(doc)}
                className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] border transition ${
                  on
                    ? 'bg-indigo-600 text-white border-indigo-600'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-indigo-300'
                }`}
              >
                {on ? <FiCheck className="h-3 w-3" /> : <FiPlus className="h-3 w-3" />}
                {doc}
              </button>
            );
          })}
        </div>
      )}
      <div className="flex gap-2">
        <input
          type="text"
          className={inputCls}
          placeholder="Add another document and press Enter"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              addCustom();
            }
          }}
        />
        <button type="button" onClick={addCustom}
          className="px-3 text-xs rounded-md border border-indigo-200 text-indigo-700 hover:bg-indigo-50 shrink-0">
          Add
        </button>
      </div>
    </div>
  );
}

/* ================================================================= */

function TriggerEditor({ preset, draft, onChange }) {
  const anchorKey = preset.default_trigger?.anchor;
  const offsets = preset.default_trigger?.offsets || [];
  const triggers = draft.triggers;
  const rows = describeTriggers(preset, draft);
  const whatsapp = isWhatsAppPreset(preset);

  const offsetIndex = (m) =>
    triggers.findIndex((t) => t.kind === 'offset' && Number(t.minutes_before) === Number(m));

  const toggleOffset = (o) => {
    const i = offsetIndex(o.minutes_before);
    onChange(
      i >= 0
        ? triggers.filter((_, j) => j !== i)
        : [...triggers, { kind: 'offset', minutes_before: o.minutes_before, label: o.label }]
    );
  };

  const addAt = (date) => onChange([...triggers, { kind: 'at', at: date ? toLocalInput(date) : '' }]);
  const setAt = (i, v) => onChange(triggers.map((t, j) => (j === i ? { ...t, at: v } : t)));
  const removeAt = (i) => onChange(triggers.filter((_, j) => j !== i));
  const quick = (days) => {
    const d = new Date();
    d.setDate(d.getDate() + days);
    d.setHours(10, 0, 0, 0);
    addAt(d);
  };

  return (
    <div className="bg-gray-50 border border-gray-200 rounded-md p-2.5 space-y-2">
      <div className="text-[11px] font-semibold text-gray-600 uppercase tracking-wide flex items-center gap-1">
        <FiClock className="h-3 w-3" /> {whatsapp ? 'When to send' : 'When to remind'}
      </div>

      {offsets.map((o) => {
        const i = offsetIndex(o.minutes_before);
        const on = i >= 0;
        const info = describeTrigger(preset, draft, { kind: 'offset', minutes_before: o.minutes_before });
        return (
          <label key={o.minutes_before} className="flex items-start gap-2 text-xs cursor-pointer">
            <input type="checkbox" checked={on} onChange={() => toggleOffset(o)} className="mt-0.5 rounded text-indigo-600" />
            <span className="flex-1">
              <span className="font-medium text-gray-800">{o.label || `${o.minutes_before} min before`}</span>
              {info.date && <span className="ml-1.5 text-gray-500">→ {formatWhen(info.date)}</span>}
              {info.problem && (
                <span className={`block text-[11px] ${on ? 'text-rose-600' : 'text-amber-600'}`}>{info.problem}</span>
              )}
            </span>
          </label>
        );
      })}

      {triggers.map((t, i) =>
        t.kind === 'at' ? (
          <div key={`at-${i}`}>
            <div className="flex items-center gap-2">
              <input type="datetime-local" className={inputCls} value={t.at || ''} min={toLocalInput(new Date())}
                onChange={(e) => setAt(i, e.target.value)} />
              <button type="button" onClick={() => removeAt(i)}
                className="text-gray-400 hover:text-rose-500 p-1 shrink-0">
                <FiX className="h-3.5 w-3.5" />
              </button>
            </div>
            {rows[i]?.problem && t.at && <p className="text-[11px] text-rose-600 mt-0.5">{rows[i].problem}</p>}
          </div>
        ) : null
      )}

      <div className="flex flex-wrap gap-1.5">
        {!anchorKey &&
          [
            { label: 'Tomorrow 10 AM', days: 1 },
            { label: 'In 3 days', days: 3 },
            { label: 'In 1 week', days: 7 },
          ].map((q) => (
            <button key={q.days} type="button" onClick={() => quick(q.days)} className={chipCls}>
              {q.label}
            </button>
          ))}
        <button type="button" onClick={() => addAt(null)} className={chipCls}>
          <FiPlus className="h-3 w-3" /> Custom time
        </button>
      </div>

      {whatsapp && <p className="text-[10px] text-gray-400">Customers are not messaged between 9 PM and 8 AM.</p>}
    </div>
  );
}

/* ================================================================= */

function WhatsAppPreview({ preset, draft, customerName, serviceName }) {
  const [state, setState] = useState({ loading: false, text: null, missing: [] });
  const fieldsKey = JSON.stringify(draft.fields);

  useEffect(() => {
    let cancelled = false;
    const timer = setTimeout(async () => {
      setState((s) => ({ ...s, loading: true }));
      try {
        const res = await previewAutomation({
          preset_id: preset.id,
          fields: draft.fields,
          customer_name: customerName,
          service_name: serviceName,
        });
        if (!cancelled) setState({ loading: false, text: res.text, missing: res.missing || [] });
      } catch {
        if (!cancelled) setState({ loading: false, text: null, missing: [] });
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [preset.id, fieldsKey, customerName, serviceName]);

  if (!state.text && !state.loading) return null;

  return (
    <div className="rounded-md p-3" style={{ backgroundColor: '#ECE5DD' }}>
      <div className="text-[10px] uppercase font-semibold text-gray-600 mb-1.5 flex items-center gap-1">
        <FiMessageSquare className="h-3 w-3" /> Customer will receive{state.loading && ' …'}
      </div>
      {state.text && (
        <div className="bg-white rounded-lg rounded-tl-none shadow-sm px-3 py-2 text-[12px] leading-relaxed text-gray-800 whitespace-pre-wrap max-w-[95%]">
          {renderWhatsAppText(state.text)}
        </div>
      )}
      {state.missing.length > 0 && (
        <p className="text-[11px] text-amber-700 mt-1.5">Still needed: {state.missing.join(', ')}</p>
      )}
    </div>
  );
}