// services/statementMatcher.js — matches bank DEBITS against the app's debits for the same
// bank wallet. Pure function, no database, no AI. Amounts are compared in paise (integers).
//
// Order (each step only uses what is still unmatched):
//   1. exact      1 bank debit = 1 app entry, same amount, same day        → auto
//                 (±1 day: auto when the type fits, otherwise a suggestion)
//   2. many_bank  2–5 bank debits of the SAME type, same day = 1 app entry → suggestion
//                 e.g. e-Treasury ₹300 + ₹200 + ₹300 = Land Tax entry ₹800
//   3. many_app   1 bank debit = 2–5 app entries of the same day           → suggestion
//                 e.g. one ₹811 payment = ₹300 + ₹311 + ₹200
//   4. amount_diff 1 = 1 with a small difference (≤ ₹10 or 2%, ±1 day)    → suggestion
//                 e.g. bank ₹505.90 ↔ entered ₹500
//   5. what is left: bank_only (in the bank, not in the app) / app_only

const paise = (n) => Math.round(Number(n || 0) * 100);
const dayDiff = (a, b) => Math.round(Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / 86400000);

export const DEFAULT_OPTIONS = {
  dateWindowDays: 1,     // bank may post a day later
  closeAbs: 10,          // amount_diff: up to ₹10 …
  closePct: 0.02,        // … or 2 %, whichever is larger
  maxCombo: 5,           // at most 5 items in a combination
  maxSearch: 20000,      // safety cap for the combination search
};

/* Does an app entry fit a bank narration type?
   learned: { [type_key]: { [service_id]: hits } } built from confirmed matches. */
function typeFit(bankRow, app, learned = {}) {
  const t = bankRow.type_key;
  const name = `${app.service_name || ''} ${app.category || ''} ${app.description || ''}`.toLowerCase();
  if (bankRow.bank_ref && app.description && app.description.includes(bankRow.bank_ref)) return 10; // same reference
  const hits = learned[t]?.[app.service_id];
  if (hits) return 3 + Math.min(hits, 5) / 5; // learned from confirmed matches
  if ((t === 'money_transfer' || t === 'upi') && /money\s*transfer|transfer/.test(name)) return 2;
  if (t === 'charges' && /charge|bank/.test(name)) return 2;
  if (t === 'e_treasury' && /treasury|land\s*tax|building\s*tax|tax/.test(name)) return 1;
  if (t === 'ikm' && /ksmart|k-smart|edistrict|e-district|certificate/.test(name)) return 1;
  if (t === 'scert' && /scert|sslc|exam/.test(name)) return 1;
  return 0;
}

// find a subset of `items` (each {id, p}) whose p sums exactly to target
function findSubset(items, target, maxCombo, budget) {
  const sorted = [...items].filter((i) => i.p > 0 && i.p <= target).sort((a, b) => b.p - a.p);
  let steps = 0;
  const pick = [];
  const dfs = (start, remaining) => {
    if (remaining === 0) return pick.length >= 2;
    if (pick.length >= maxCombo || ++steps > budget) return false;
    for (let i = start; i < sorted.length; i++) {
      if (sorted[i].p > remaining) continue;
      if (i > start && sorted[i].p === sorted[i - 1].p && !pick.includes(sorted[i - 1])) continue; // skip same-value repeats
      pick.push(sorted[i]);
      if (dfs(i + 1, remaining - sorted[i].p)) return true;
      pick.pop();
    }
    return false;
  };
  return dfs(0, target) ? [...pick] : null;
}

/**
 * @param bankRows [{id, value_date, debit, type_key, type_label, details, bank_ref}]  (debits only are used)
 * @param appRows  [{id, date, amount, category, service_id, service_name, description, ...}]
 * @param learned  { type_key: { service_id: hits } }
 * @returns { matches:[{kind, bank_ids, app_ids, bank_total, app_total, diff, confidence, reason}], bank_only:[ids], app_only:[ids] }
 */
export function matchStatement(bankRows, appRows, learned = {}, opts = {}) {
  const o = { ...DEFAULT_OPTIONS, ...opts };
  const bank = bankRows.filter((b) => paise(b.debit) > 0).map((b) => ({ ...b, p: paise(b.debit) }));
  const app = appRows.filter((a) => paise(a.amount) > 0).map((a) => ({ ...a, p: paise(a.amount) }));
  const usedBank = new Set();
  const usedApp = new Set();
  const matches = [];
  const freeBank = () => bank.filter((b) => !usedBank.has(b.id));
  const freeApp = () => app.filter((a) => !usedApp.has(a.id));
  const take = (m) => {
    m.bank_ids.forEach((id) => usedBank.add(id));
    m.app_ids.forEach((id) => usedApp.add(id));
    matches.push(m);
  };
  const label = (b) => b.type_label || b.type_key || 'debit';

  // ---- 1. exact, 1 = 1 (same day first, then ±1 day); best type fit wins
  for (const window of [0, o.dateWindowDays]) {
    for (const b of freeBank()) {
      const cands = freeApp()
        .filter((a) => a.p === b.p && dayDiff(a.date, b.value_date) <= window)
        .map((a) => ({ a, fit: typeFit(b, a, learned), dd: dayDiff(a.date, b.value_date) }))
        .sort((x, y) => y.fit - x.fit || x.dd - y.dd);
      if (!cands.length) continue;
      const best = cands[0];
      const auto = best.dd === 0 || best.fit >= 2;
      take({
        kind: 'exact',
        bank_ids: [b.id],
        app_ids: [best.a.id],
        bank_total: b.debit,
        app_total: best.a.amount,
        diff: 0,
        confidence: auto ? 'auto' : 'suggest',
        reason: best.dd === 0 ? 'Same amount, same day' : 'Same amount, 1 day apart',
      });
    }
  }

  // ---- 2. several bank debits (same type, same day) = 1 app entry
  for (const a of freeApp().sort((x, y) => y.p - x.p)) {
    const pool = freeBank().filter((b) => dayDiff(b.value_date, a.date) <= o.dateWindowDays);
    // try each narration type separately — never mix e-Treasury with KSmart
    const byType = {};
    pool.forEach((b) => (byType[b.type_key] = byType[b.type_key] || []).push(b));
    const types = Object.keys(byType).sort((x, y) => typeFit({ type_key: y }, a, learned) - typeFit({ type_key: x }, a, learned));
    for (const t of types) {
      const same = byType[t].filter((b) => dayDiff(b.value_date, a.date) === 0);
      const subset = findSubset(same.length >= 2 ? same : byType[t], a.p, o.maxCombo, o.maxSearch);
      if (subset) {
        take({
          kind: 'many_bank',
          bank_ids: subset.map((b) => b.id),
          app_ids: [a.id],
          bank_total: subset.reduce((s, b) => s + b.p, 0) / 100,
          app_total: a.amount,
          diff: 0,
          confidence: 'suggest',
          reason: `${subset.length} ${label(subset[0])} debits add up to this entry`,
        });
        break;
      }
    }
  }

  // ---- 3. one bank debit = several app entries of the same day
  for (const b of freeBank().sort((x, y) => y.p - x.p)) {
    const pool = freeApp().filter((a) => dayDiff(a.date, b.value_date) === 0);
    // Only combine entries that plausibly belong together — with many small entries a day,
    // "any entries that add up" would almost always find a meaningless combination.
    //   a) entries whose service fits the narration type (learned or by name), or
    //   b) entries of one and the same service
    const fitting = pool.filter((a) => typeFit(b, a, learned) > 0);
    let subset = fitting.length >= 2 ? findSubset(fitting, b.p, o.maxCombo, o.maxSearch) : null;
    if (!subset) {
      const byService = {};
      pool.forEach((a) => { if (a.service_id) (byService[a.service_id] = byService[a.service_id] || []).push(a); });
      for (const group of Object.values(byService)) {
        if (group.length < 2) continue;
        subset = findSubset(group, b.p, o.maxCombo, o.maxSearch);
        if (subset) break;
      }
    }
    if (subset) {
      take({
        kind: 'many_app',
        bank_ids: [b.id],
        app_ids: subset.map((a) => a.id),
        bank_total: b.debit,
        app_total: subset.reduce((s, a) => s + a.p, 0) / 100,
        diff: 0,
        confidence: 'suggest',
        reason: `${subset.length} entries add up to one ${label(b)} debit`,
      });
    }
  }

  // ---- 4. small difference, 1 = 1
  for (const b of freeBank()) {
    const limit = Math.max(paise(o.closeAbs), Math.round(b.p * o.closePct));
    const cands = freeApp()
      .filter((a) => Math.abs(a.p - b.p) <= limit && dayDiff(a.date, b.value_date) <= o.dateWindowDays)
      .map((a) => ({ a, fit: typeFit(b, a, learned), gap: Math.abs(a.p - b.p), dd: dayDiff(a.date, b.value_date) }))
      .sort((x, y) => y.fit - x.fit || x.gap - y.gap || x.dd - y.dd);
    if (!cands.length) continue;
    const best = cands[0];
    const diff = (b.p - best.a.p) / 100; // + bank paid more than entered
    take({
      kind: 'amount_diff',
      bank_ids: [b.id],
      app_ids: [best.a.id],
      bank_total: b.debit,
      app_total: best.a.amount,
      diff,
      confidence: 'suggest',
      reason: `Bank ₹${b.debit.toFixed(2)} vs entered ₹${Number(best.a.amount).toFixed(2)} (${diff > 0 ? '+' : '−'}₹${Math.abs(diff).toFixed(2)})`,
    });
  }

  return {
    matches,
    bank_only: freeBank().map((b) => b.id),
    app_only: freeApp().map((a) => a.id),
  };
}

export default matchStatement;