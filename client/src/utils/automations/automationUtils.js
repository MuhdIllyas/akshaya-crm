// src/utils/automations/automationUtils.js
// All times here are the browser's local time (your staff are in IST).
// Values are sent to the API as 'YYYY-MM-DDTHH:mm' and treated as IST there.

export const QUIET_START = 21; // 9 PM
export const QUIET_END = 8;    // 8 AM
const DATE_ONLY_HOUR = 10;     // a date-only reference counts as 10 AM (matches backend)

export const isWhatsAppPreset = (preset) => preset?.action_type === 'whatsapp_template';

const specificity = (p) => (p.subcategory_id ? 2 : 0) + (p.category_id ? 1 : 0);

export function presetsForService(presets, categoryId, subcategoryId) {
  if (!categoryId) return [];
  return presets
    .filter(
      (p) =>
        (p.category_id == null || String(p.category_id) === String(categoryId)) &&
        (p.subcategory_id == null || String(p.subcategory_id) === String(subcategoryId))
    )
    .sort((a, b) => specificity(b) - specificity(a) || a.name.localeCompare(b.name));
}

export function parseLocal(value) {
  if (!value) return null;
  const s = String(value).trim();
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s)
    ? new Date(`${s}T${String(DATE_ONLY_HOUR).padStart(2, '0')}:00`)
    : new Date(s);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const isQuietHour = (d) => {
  const h = d.getHours();
  return h >= QUIET_START || h < QUIET_END;
};

export const formatWhen = (d) =>
  d.toLocaleString('en-IN', {
    weekday: 'short', day: 'numeric', month: 'short',
    hour: 'numeric', minute: '2-digit', hour12: true,
  });

export const toLocalInput = (d) => {
  const p = (n) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
};

const isBlank = (v) =>
  v === null || v === undefined || (Array.isArray(v) ? v.length === 0 : String(v).trim() === '');

export function newDraft(preset, { suggestedDocs = [], defaultAssignee = '' } = {}) {
  const fields = {};
  for (const f of preset.fields || []) {
    if (f.type === 'documents') fields[f.key] = [...suggestedDocs];
    else if (f.type === 'staff') fields[f.key] = defaultAssignee ? String(defaultAssignee) : '';
    else fields[f.key] = '';
  }
  const triggers = (preset.default_trigger?.offsets || []).map((o) => ({
    kind: 'offset',
    minutes_before: o.minutes_before,
    label: o.label,
  }));
  return { localId: crypto.randomUUID(), presetId: preset.id, fields, triggers };
}

const anchorField = (preset) => {
  const key = preset.default_trigger?.anchor;
  return key ? (preset.fields || []).find((f) => f.key === key) || { key, label: key } : null;
};

/** Resolve one trigger to a Date and an optional problem message. */
export function describeTrigger(preset, draft, trigger) {
  const anchor = anchorField(preset);
  let date = null;

  if (trigger.kind === 'offset') {
    const base = anchor ? parseLocal(draft.fields[anchor.key]) : null;
    if (!base) return { date: null, problem: `Set "${anchor?.label || 'the reference time'}" first` };
    date = new Date(base.getTime() - Number(trigger.minutes_before) * 60000);
  } else {
    date = parseLocal(trigger.at);
    if (!date) return { date: null, problem: 'Pick a date and time' };
  }

  if (date.getTime() < Date.now()) return { date, problem: 'This time has already passed' };
  if (isWhatsAppPreset(preset) && isQuietHour(date)) {
    return { date, problem: 'Falls between 9 PM and 8 AM — customers are not messaged at night' };
  }
  return { date, problem: null };
}

export const describeTriggers = (preset, draft) =>
  draft.triggers.map((t) => describeTrigger(preset, draft, t));

export function validateDraft(preset, draft) {
  const errors = [];
  for (const f of preset.fields || []) {
    if (f.required && isBlank(draft.fields[f.key])) errors.push(`${f.label || f.key} is required`);
  }
  if (draft.triggers.length === 0) errors.push('Choose at least one time');
  describeTriggers(preset, draft).forEach((r, i) => {
    if (r.problem) {
      const t = draft.triggers[i];
      errors.push(`${t.kind === 'offset' ? t.label || 'Reminder' : 'Custom time'}: ${r.problem}`);
    }
  });
  return errors;
}

export const toApiAction = (draft, extraFields = {}) => ({
  preset_id: draft.presetId,
  fields: { ...draft.fields, ...extraFields },
  triggers: draft.triggers.map((t) =>
    t.kind === 'offset'
      ? { kind: 'offset', minutes_before: t.minutes_before, label: t.label }
      : { kind: 'at', at: t.at }
  ),
});