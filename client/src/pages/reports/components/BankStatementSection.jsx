// BankStatementSection.jsx — put next to AccountingSection.jsx
// Upload an SBI statement PDF for a bank wallet and check its DEBITS against the app.
//   To review  → suggestions from the rules (combinations, small differences)
//   Bank only  → in the bank, nothing in the app (book it, or mark as checked)
//   App only   → in the app, not in the bank (usually the wrong wallet; mark as checked)
//   Matched / Checked → done (can be undone)
// Rules only, no AI. Server: /api/bankstatements (routes/bankStatements.js).
import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'react-toastify';
import {
  FiUploadCloud, FiRefreshCw, FiCheck, FiX, FiLink, FiFileText, FiAlertTriangle,
  FiChevronDown, FiChevronRight, FiRotateCcw, FiInfo, FiCreditCard,
} from 'react-icons/fi';

const API = `${import.meta.env.VITE_API_URL}/api/bankstatements`;
// What happens to a difference: it is added to / taken off the SAME entry (department fee or
// expense) under the staff who made it — never a separate expense or misc income.
const diffLabel = (d) => (Number(d) > 0 ? `Match & add ${inr(Math.abs(d))} to entry` : `Match & take ${inr(Math.abs(d))} off entry`);
// The difference goes onto the largest department-fee entry; if it is more than that entry's
// service charge the server refuses (the entry must be fixed by hand), so don't offer it.
const diffBlocked = (d, entries) => {
  if (!(Number(d) > 0)) return null;
  const dep = entries.filter((a) => a && a.category === 'Department Payment' && a.entry_id)
    .sort((x, y) => Number(y.amount) - Number(x.amount))[0];
  if (!dep || dep.service_charges == null) return null;
  return Number(d) > Number(dep.service_charges)
    ? `The difference is more than the service charge of entry #${dep.entry_id} (${inr(dep.service_charges)}). Use "Match only" and correct the entry by hand.`
    : null;
};
const diffDone = (d) => `Matched — ${inr(Math.abs(d))} ${Number(d) > 0 ? 'added to' : 'taken off'} the entry, under the same staff`;
const auth = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}` });
const inr = (v) => `₹${Number(v || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const fmtDate = (ymd) => (ymd ? new Date(`${ymd}T00:00:00+05:30`).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' }) : '—');

async function api(path, { method = 'GET', body, raw, headers = {} } = {}) {
  const res = await fetch(`${API}${path}`, {
    method,
    headers: { ...auth(), ...(raw ? {} : body !== undefined ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: raw || (body !== undefined ? JSON.stringify(body) : undefined),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = new Error(data.error || `Request failed (${res.status})`);
    err.details = data.details;
    err.data = data;
    throw err;
  }
  return data;
}

const KIND_LABEL = {
  exact: 'Same amount',
  many_bank: 'Several bank debits → 1 entry',
  many_app: '1 bank debit → several entries',
  amount_diff: 'Amount differs',
  manual: 'Matched by hand',
  booked: 'Booked from bank',
};

const btn = 'inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus-visible:ring-2 disabled:cursor-not-allowed disabled:opacity-50';
const btnPrimary = `${btn} bg-navy-700 text-white hover:bg-navy-800 focus-visible:ring-navy-500/40`;
const btnGood = `${btn} bg-emerald-600 text-white hover:bg-emerald-700 focus-visible:ring-emerald-500/40`;
const btnGhost = `${btn} border border-slate-300 bg-white text-slate-700 hover:bg-slate-50 focus-visible:ring-navy-500/30`;
const card = 'rounded-2xl border border-slate-200 bg-white shadow-sm';

// small modal for notes (no window.prompt — it blocks the page)
const NoteModal = ({ title, hint, withCategory, confirmLabel, onCancel, onSave, busy }) => {
  const [note, setNote] = useState('');
  const [category, setCategory] = useState('Bank / CDM Charges');
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" role="dialog" aria-modal="true" aria-label={title} onClick={() => !busy && onCancel()}>
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white shadow-xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-slate-200 p-4">
          <h3 className="text-base font-bold text-slate-900">{title}</h3>
          {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
        </div>
        <div className="space-y-3 p-4">
          {withCategory && (
            <label className="block text-sm font-medium text-slate-700">
              Expense category
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm">
                {/* same names as the Expense module, so reports group them together */}
                <option>Bank / CDM Charges</option>
                <option>Other Expenses</option>
              </select>
            </label>
          )}
          <label className="block text-sm font-medium text-slate-700">
            Note *
            <textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} autoFocus
              className="mt-1 w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" placeholder="e.g. SMS charges, transfer to own Federal account…" />
          </label>
        </div>
        <div className="flex justify-end gap-2 border-t border-slate-200 p-3">
          <button type="button" className={btnGhost} onClick={onCancel} disabled={busy}>Cancel</button>
          <button type="button" className={btnPrimary} disabled={busy || note.trim().length < 3} onClick={() => onSave({ note: note.trim(), category })}>
            {busy && <FiRefreshCw className="h-3.5 w-3.5 animate-spin" />}{confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
};

const BankRow = ({ l, selectable, selected, onToggle }) => (
  <div className="flex items-start gap-2 rounded-lg bg-slate-50 px-2.5 py-2">
    {selectable && <input type="checkbox" className="mt-0.5" checked={selected} onChange={onToggle} aria-label="Select bank row" />}
    <FiCreditCard className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-slate-400" />
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-slate-900">{fmtDate(l.value_date)} · {l.type_label}</span>
        <span className="text-sm font-bold tabular-nums text-rose-600">−{inr(l.debit)}</span>
      </div>
      <p className="truncate text-[11px] text-slate-500" title={l.details}>{l.details}</p>
    </div>
  </div>
);

const AppRow = ({ a, selectable, selected, onToggle }) => (
  <div className="flex items-start gap-2 rounded-lg bg-indigo-50/50 px-2.5 py-2">
    {selectable && <input type="checkbox" className="mt-0.5" checked={selected} onChange={onToggle} aria-label="Select app entry" />}
    <FiFileText className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-indigo-400" />
    <div className="min-w-0 flex-1">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <span className="text-xs font-semibold text-slate-900">
          {fmtDate(a.date)} {a.time || ''} · {a.service_name ? `${a.service_name}${a.subcategory_name ? ` – ${a.subcategory_name}` : ''}` : a.category}
        </span>
        <span className="text-sm font-bold tabular-nums text-slate-900">{inr(a.amount)}</span>
      </div>
      <p className="truncate text-[11px] text-slate-500">
        {[a.staff_name, a.customer_name, a.entry_id ? `#${a.entry_id}` : null].filter(Boolean).join(' · ') || a.description}
      </p>
    </div>
  </div>
);

const Section = ({ title, count, tone = 'slate', open, onToggle, children, hint }) => (
  <div className={card}>
    <button type="button" onClick={onToggle} className="flex w-full items-center justify-between gap-2 p-4 text-left" aria-expanded={open}>
      <span className="flex items-center gap-2">
        {open ? <FiChevronDown className="h-4 w-4 text-slate-400" /> : <FiChevronRight className="h-4 w-4 text-slate-400" />}
        <span className="text-sm font-bold text-slate-900">{title}</span>
        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
          count === 0 ? 'bg-slate-100 text-slate-500'
            : tone === 'rose' ? 'bg-rose-50 text-rose-700' : tone === 'amber' ? 'bg-amber-50 text-amber-700'
            : tone === 'emerald' ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>{count}</span>
      </span>
      {hint && <span className="hidden text-xs text-slate-500 sm:block">{hint}</span>}
    </button>
    {open && <div className="space-y-3 border-t border-slate-100 p-4">{children}</div>}
  </div>
);

const BankStatementSection = ({ wallets = [], readOnly = false }) => {
  const bankWallets = useMemo(
    () => wallets.filter((w) => String(w.type || w.wallet_type).toLowerCase() === 'bank'),
    [wallets]
  );
  const [walletId, setWalletId] = useState('');
  const [statements, setStatements] = useState([]);
  const [statementId, setStatementId] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [busy, setBusy] = useState(null); // id of the action running
  const [modal, setModal] = useState(null); // { kind:'bank-book'|'bank-check'|'app-check', id }
  const [selBank, setSelBank] = useState([]);
  const [selApp, setSelApp] = useState([]);
  const [open, setOpen] = useState({ review: true, bank: true, app: true, matched: false, checked: false });
  const [uploadErrors, setUploadErrors] = useState(null);
  const [pwFile, setPwFile] = useState(null); // { file, wrong } — a locked file waiting for its password
  const [pw, setPw] = useState('');

  useEffect(() => {
    if (!walletId && bankWallets.length) {
      // all centres use SBI for department fees — open on it; remember the admin's last choice
      let last = null;
      try { last = localStorage.getItem('bankstmt_wallet'); } catch { /* storage blocked */ }
      const pick = bankWallets.find((w) => String(w.id) === last)
        || bankWallets.find((w) => /sbi|state bank/i.test(w.name))
        || bankWallets[0];
      setWalletId(String(pick.id));
    }
  }, [bankWallets, walletId]);

  const loadStatements = useCallback(async (selectId) => {
    if (!walletId) return;
    try {
      const list = await api(`/?wallet_id=${walletId}`);
      setStatements(list);
      setStatementId(selectId ? String(selectId) : list[0] ? String(list[0].id) : '');
    } catch (e) {
      toast.error(e.message);
    }
  }, [walletId]);

  useEffect(() => { setData(null); setStatementId(''); loadStatements(); }, [walletId, loadStatements]);

  const loadDetail = useCallback(async () => {
    if (!statementId) { setData(null); return; }
    setLoading(true);
    try {
      setData(await api(`/${statementId}`));
      setSelBank([]); setSelApp([]);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setLoading(false);
    }
  }, [statementId]);

  useEffect(() => { loadDetail(); }, [loadDetail]);

  const onUpload = async (file, password) => {
    if (!file) return;
    if (!/\.(pdf|xlsx|xls)$/i.test(file.name)) return toast.error('Choose the statement PDF or Excel file');
    const isPdf = /\.pdf$/i.test(file.name);
    setUploading(true); setUploadErrors(null);
    try {
      const r = await api(`/upload?wallet_id=${walletId}&file_name=${encodeURIComponent(file.name)}`, {
        method: 'POST', raw: file,
        headers: {
          'Content-Type': isPdf ? 'application/pdf' : 'application/octet-stream',
          // only sent for a locked file; never kept anywhere
          ...(password ? { 'X-File-Password': encodeURIComponent(password) } : {}),
        },
      });
      setPwFile(null); setPw('');
      toast.success(`Read ${r.rows} rows: ${r.auto} matched automatically, ${r.suggested} to review${r.already_uploaded_rows ? `, ${r.already_uploaded_rows} already uploaded before` : ''}`);
      await loadStatements(r.statement_id);
    } catch (e) {
      if (e.data?.needs_password) {
        setPwFile({ file, wrong: !!e.data.wrong_password }); setPw('');
        if (e.data.wrong_password) toast.error('Wrong password');
      } else if (e.data?.statement_id) {
        setPwFile(null); setPw('');
        toast.info('This statement was already uploaded — opening it'); await loadStatements(e.data.statement_id);
      } else {
        setPwFile(null); setPw('');
        setUploadErrors({ message: e.message, details: e.details || [] }); toast.error(e.message);
      }
    } finally {
      setUploading(false);
    }
  };

  const act = async (key, fn, okMsg) => {
    setBusy(key);
    try {
      await fn();
      if (okMsg) toast.success(okMsg);
      await loadDetail();
      loadStatements(statementId);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(null);
    }
  };

  // ---------- derived ----------
  const L = useMemo(() => Object.fromEntries((data?.lines || []).map((l) => [l.id, l])), [data]);
  const A = data?.app || {};
  const proposed = (data?.matches || []).filter((m) => m.status === 'proposed');
  const confirmed = (data?.matches || []).filter((m) => m.status === 'confirmed');
  const bankOnly = (data?.bank_only || []).map((id) => L[id]).filter(Boolean);
  const appOnly = (data?.app_only || []).map((id) => A[id]).filter(Boolean);
  const bankChecked = (data?.lines || []).filter((l) => l.status === 'checked');
  const appChecked = (data?.app_checked || []).map((c) => ({ ...A[c.id], note: c.note })).filter((a) => a.id);
  const selBankTotal = selBank.reduce((s, id) => s + Number(L[id]?.debit || 0), 0);
  const selAppTotal = selApp.reduce((s, id) => s + Number(A[id]?.amount || 0), 0);
  const selDiff = Math.round((selBankTotal - selAppTotal) * 100) / 100;
  const selBlocked = selBank.length && selApp.length ? diffBlocked(selDiff, selApp.map((id) => A[id])) : null;
  const toggle = (setter) => (id) => setter((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));

  const manualMatch = (bookDifference) => act('manual', async () => {
    const r = await api('/manual-match', { method: 'POST', body: { line_ids: selBank, wallet_tx_ids: selApp } });
    await api(`/matches/${r.match_id}/confirm`, { method: 'POST', body: { book_difference: !!bookDifference } });
  }, 'Matched');

  // ---------- render ----------
  if (bankWallets.length === 0) {
    return <div className={`${card} p-6 text-center text-sm text-slate-500`}>No bank wallets in this centre.</div>;
  }

  const s = data?.statement;
  const c = data?.counts;

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className={`${card} p-4`}>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h3 className="flex items-center text-sm font-bold text-slate-900"><FiCreditCard className="mr-2 h-4 w-4 text-navy-700" />Bank Statement Check</h3>
            <p className="mt-0.5 text-xs text-slate-500">Upload the SBI statement (PDF or Excel, as downloaded from net banking). Debits are checked against what was entered in the app.</p>
          </div>
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-xs font-medium text-slate-600">
              Bank wallet
              <select value={walletId} onChange={(e) => { setWalletId(e.target.value); try { localStorage.setItem('bankstmt_wallet', e.target.value); } catch { /* ignore */ } }} className="mt-1 block rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm">
                {bankWallets.map((w) => <option key={w.id} value={w.id}>{w.name}</option>)}
              </select>
            </label>
            <label className="text-xs font-medium text-slate-600">
              Statement
              <select value={statementId} onChange={(e) => setStatementId(e.target.value)} disabled={!statements.length}
                className="mt-1 block max-w-[240px] rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm">
                {!statements.length && <option value="">None uploaded yet</option>}
                {statements.map((st) => (
                  <option key={st.id} value={st.id}>
                    {fmtDate(st.period_from)}{st.period_to !== st.period_from ? ` – ${fmtDate(st.period_to)}` : ''} · {st.open_debits ? `${st.open_debits} open` : 'done ✓'}
                  </option>
                ))}
              </select>
            </label>
            {!readOnly && (
              <label className={`${btnPrimary} cursor-pointer py-2`}>
                {uploading ? <FiRefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FiUploadCloud className="h-3.5 w-3.5" />}
                {uploading ? 'Reading…' : 'Upload statement'}
                <input type="file" className="hidden" disabled={uploading}
                  accept=".pdf,.xlsx,.xls,application/pdf,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-excel"
                  onChange={(e) => { onUpload(e.target.files?.[0]); e.target.value = ''; }} />
              </label>
            )}
            {statementId && !readOnly && (
              <button type="button" className={`${btnGhost} py-2`} disabled={busy === 'rematch'}
                onClick={() => act('rematch', () => api(`/${statementId}/rematch`, { method: 'POST', body: {} }), 'Matching re-run')}
                title="Run the rules again, e.g. after entries were added">
                <FiRefreshCw className={`h-3.5 w-3.5 ${busy === 'rematch' ? 'animate-spin' : ''}`} />Re-run
              </button>
            )}
          </div>
        </div>

        {pwFile && (
          <form
            className="mt-3 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"
            onSubmit={(e) => { e.preventDefault(); if (pw) onUpload(pwFile.file, pw); }}
          >
            <p className="flex items-center gap-1.5 font-semibold">
              <FiAlertTriangle className="h-3.5 w-3.5" />
              {pwFile.wrong ? 'Wrong password — try again' : 'This file is password protected'}
            </p>
            <p className="mt-0.5 text-amber-800">{pwFile.file.name} · the password is only used to open the file now; it is not saved.</p>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <label htmlFor="stmt-file-pw" className="sr-only">File password</label>
              <input
                id="stmt-file-pw" type="password" autoComplete="off" autoFocus value={pw}
                onChange={(e) => setPw(e.target.value)} disabled={uploading}
                placeholder="File password"
                className="w-56 rounded-lg border border-amber-300 bg-white px-2 py-1.5 text-sm text-slate-900"
              />
              <button type="submit" className={`${btnPrimary} py-1.5`} disabled={!pw || uploading}>
                {uploading ? <FiRefreshCw className="h-3.5 w-3.5 animate-spin" /> : <FiUploadCloud className="h-3.5 w-3.5" />}
                Open & read
              </button>
              <button type="button" className={`${btnGhost} py-1.5`} disabled={uploading} onClick={() => { setPwFile(null); setPw(''); }}>
                Cancel
              </button>
            </div>
          </form>
        )}

        {uploadErrors && (
          <div className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-xs text-rose-800">
            <p className="flex items-center gap-1.5 font-semibold"><FiAlertTriangle className="h-3.5 w-3.5" />{uploadErrors.message}</p>
            {uploadErrors.details?.length > 0 && <ul className="mt-1 list-disc pl-5">{uploadErrors.details.map((d, i) => <li key={i}>{d}</li>)}</ul>}
            <p className="mt-1 text-rose-700">Nothing was saved. Download the statement again from net banking (PDF or Excel) and upload that file as it is — not a "Print to PDF" copy, photo or scan.</p>
          </div>
        )}

        {s && c && (
          <div className="mt-4 grid grid-cols-2 gap-3 lg:grid-cols-5">
            <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
              <p className="text-xs text-slate-500">Statement</p>
              <p className="text-sm font-bold text-slate-900">{fmtDate(s.period_from)}{s.period_to !== s.period_from ? ` – ${fmtDate(s.period_to)}` : ''}</p>
              <p className="text-[11px] text-slate-500">Balances verified ✓ · {inr(s.opening_balance)} → {inr(s.closing_balance)}</p>
            </div>
            <div className="rounded-xl border border-slate-200 p-3">
              <p className="text-xs text-slate-500">Debits</p>
              <p className="text-lg font-bold text-slate-900">{c.debits}</p>
              <p className="text-[11px] text-slate-500">{inr(s.total_debits)}</p>
            </div>
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
              <p className="text-xs text-emerald-700">Matched</p>
              <p className="text-lg font-bold text-emerald-900">{c.matched}</p>
              <p className="text-[11px] text-emerald-700">{c.debits ? Math.round((c.matched / c.debits) * 100) : 0}% of debits</p>
            </div>
            <div className={`rounded-xl border p-3 ${proposed.length ? 'border-amber-200 bg-amber-50' : 'border-slate-200'}`}>
              <p className="text-xs text-amber-700">To review</p>
              <p className="text-lg font-bold text-slate-900">{proposed.length}</p>
              <p className="text-[11px] text-slate-500">Suggestions</p>
            </div>
            <div className={`rounded-xl border p-3 ${bankOnly.length || appOnly.length ? 'border-rose-200 bg-rose-50' : 'border-slate-200'}`}>
              <p className="text-xs text-rose-700">Unmatched</p>
              <p className="text-lg font-bold text-slate-900">{bankOnly.length + appOnly.length}</p>
              <p className="text-[11px] text-slate-500">{bankOnly.length} bank only · {appOnly.length} app only</p>
            </div>
          </div>
        )}
      </div>

      {loading && <div className="flex justify-center py-6"><FiRefreshCw className="h-5 w-5 animate-spin text-navy-700" /></div>}
      {!loading && !data && statements.length === 0 && (
        <div className={`${card} p-6 text-center text-sm text-slate-500`}>
          <FiUploadCloud className="mx-auto mb-2 h-8 w-8 text-slate-300" />
          No statement uploaded for this wallet yet.
        </div>
      )}

      {data && (
        <>
          {/* To review */}
          <Section title="To review" count={proposed.length} tone="amber" open={open.review} onToggle={() => setOpen((o) => ({ ...o, review: !o.review }))}
            hint="The rules found a likely pair — confirm or reject">
            {proposed.length === 0 && <p className="text-xs text-slate-500">Nothing to review.</p>}
            {proposed.map((m) => (
              <div key={m.id} className="rounded-xl border border-slate-200 p-3">
                <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                  <span className="inline-flex items-center gap-2">
                    <span className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${m.kind === 'amount_diff' ? 'bg-rose-50 text-rose-700' : 'bg-amber-50 text-amber-700'}`}>{KIND_LABEL[m.kind] || m.kind}</span>
                    <span className="text-xs text-slate-500">{m.reason}</span>
                  </span>
                  {Number(m.diff) !== 0 && (
                    <span className="text-xs font-semibold text-rose-700">Difference {Number(m.diff) > 0 ? '+' : '−'}{inr(Math.abs(m.diff))}</span>
                  )}
                </div>
                <div className="grid grid-cols-1 gap-2 md:grid-cols-2">
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">Bank</p>
                    {m.line_ids.map((id) => L[id] && <BankRow key={id} l={L[id]} />)}
                  </div>
                  <div className="space-y-1.5">
                    <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">App</p>
                    {m.tx_ids.map((id) => A[id] && <AppRow key={id} a={A[id]} />)}
                  </div>
                </div>
                {!readOnly && (
                  <div className="mt-3 flex flex-wrap justify-end gap-2">
                    <button type="button" className={btnGhost} disabled={!!busy}
                      onClick={() => act(`r${m.id}`, () => api(`/matches/${m.id}/reject`, { method: 'POST', body: {} }), 'Rejected — it won’t be suggested again')}>
                      <FiX className="h-3.5 w-3.5" />Not a match
                    </button>
                    {Number(m.diff) !== 0 ? (
                      <>
                        <button type="button" className={btnGhost} disabled={!!busy}
                          title="The pair is right but the difference is handled another way"
                          onClick={() => act(`c${m.id}`, () => api(`/matches/${m.id}/confirm`, { method: 'POST', body: {} }), 'Matched')}>
                          <FiCheck className="h-3.5 w-3.5" />Match only
                        </button>
                        {diffBlocked(m.diff, m.tx_ids.map((id) => A[id])) ? (
                          <span className="flex items-center gap-1 text-[11px] text-amber-700">
                            <FiAlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />{diffBlocked(m.diff, m.tx_ids.map((id) => A[id]))}
                          </span>
                        ) : (
                        <button type="button" className={btnGood} disabled={!!busy}
                          title={Number(m.diff) > 0
                            ? 'The bank paid more: the department fee / expense of this entry goes up, under the same staff'
                            : 'The bank paid less: the department fee / expense of this entry goes down, under the same staff'}
                          onClick={() => act(`b${m.id}`, () => api(`/matches/${m.id}/confirm`, { method: 'POST', body: { book_difference: true } }),
                            diffDone(m.diff))}>
                          <FiCheck className="h-3.5 w-3.5" />{diffLabel(m.diff)}
                        </button>
                        )}
                      </>
                    ) : (
                      <button type="button" className={btnGood} disabled={!!busy}
                        onClick={() => act(`c${m.id}`, () => api(`/matches/${m.id}/confirm`, { method: 'POST', body: {} }), 'Matched')}>
                        <FiCheck className="h-3.5 w-3.5" />Confirm match
                      </button>
                    )}
                  </div>
                )}
              </div>
            ))}
          </Section>

          {/* Manual match bar */}
          {!readOnly && (selBank.length > 0 || selApp.length > 0) && (
            <div className="sticky bottom-2 z-10 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-navy-200 bg-white p-3 shadow-lg">
              <p className="text-xs text-slate-700">
                <FiLink className="mr-1 inline h-3.5 w-3.5" />
                Bank {selBank.length} ({inr(selBankTotal)}) ↔ App {selApp.length} ({inr(selAppTotal)})
                {selBank.length > 0 && selApp.length > 0 && (selDiff === 0
                  ? <span className="ml-2 font-semibold text-emerald-700">amounts agree ✓</span>
                  : <span className="ml-2 font-semibold text-rose-700">difference {selDiff > 0 ? '+' : '−'}{inr(Math.abs(selDiff))}</span>)}
              </p>
              <div className="flex gap-2">
                <button type="button" className={btnGhost} onClick={() => { setSelBank([]); setSelApp([]); }}>Clear</button>
                {selDiff !== 0 && (
                  <button type="button" className={btnGhost} disabled={!selBank.length || !selApp.length || !!busy} onClick={() => manualMatch(false)}>Match only</button>
                )}
                {selBlocked && <span className="max-w-xs self-center text-[11px] text-amber-700">{selBlocked}</span>}
                {!selBlocked && (
                <button type="button" className={btnPrimary} disabled={!selBank.length || !selApp.length || !!busy} onClick={() => manualMatch(selDiff !== 0)}>
                  <FiLink className="h-3.5 w-3.5" />{selDiff !== 0 ? diffLabel(selDiff) : 'Match selected'}
                </button>
                )}
              </div>
            </div>
          )}

          {/* Bank only */}
          <Section title="In bank, not in app" count={bankOnly.length} tone="rose" open={open.bank} onToggle={() => setOpen((o) => ({ ...o, bank: !o.bank }))}
            hint="Tick rows on both sides to match by hand">
            {bankOnly.length === 0 && <p className="text-xs text-slate-500">Every bank debit is accounted for.</p>}
            {bankOnly.map((l) => (
              <div key={l.id} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1"><BankRow l={l} selectable={!readOnly} selected={selBank.includes(l.id)} onToggle={() => toggle(setSelBank)(l.id)} /></div>
                {!readOnly && (
                  <div className="flex flex-shrink-0 gap-2">
                    <button type="button" className={btnGhost} disabled={!!busy} onClick={() => setModal({ kind: 'bank-check', id: l.id, l })}>Mark checked</button>
                    <button type="button" className={btnPrimary} disabled={!!busy} onClick={() => setModal({ kind: 'bank-book', id: l.id, l })}>Book as expense</button>
                  </div>
                )}
              </div>
            ))}
          </Section>

          {/* App only */}
          <Section title="In app, not in bank" count={appOnly.length} tone="rose" open={open.app} onToggle={() => setOpen((o) => ({ ...o, app: !o.app }))}
            hint="Often the wrong wallet was picked when entering">
            {appOnly.length === 0 && <p className="text-xs text-slate-500">Every app debit on this wallet is in the bank.</p>}
            {appOnly.map((a) => (
              <div key={a.id} className="flex flex-col gap-2 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1"><AppRow a={a} selectable={!readOnly} selected={selApp.includes(a.id)} onToggle={() => toggle(setSelApp)(a.id)} /></div>
                {!readOnly && (
                  <button type="button" className={`${btnGhost} flex-shrink-0`} disabled={!!busy} onClick={() => setModal({ kind: 'app-check', id: a.id, a })}>Mark checked</button>
                )}
              </div>
            ))}
            {appOnly.length > 0 && (
              <p className="flex items-start gap-1.5 text-[11px] text-slate-500">
                <FiInfo className="mt-0.5 h-3 w-3 flex-shrink-0" />
                If it was really paid from another wallet, fix the entry with the usual correction (wallet change), then press Re-run.
              </p>
            )}
          </Section>

          {/* Matched */}
          <Section title="Matched" count={confirmed.length} tone="emerald" open={open.matched} onToggle={() => setOpen((o) => ({ ...o, matched: !o.matched }))}>
            {confirmed.map((m) => (
              <div key={m.id} className="flex flex-col gap-2 rounded-xl border border-slate-100 p-2.5 sm:flex-row sm:items-center">
                <div className="min-w-0 flex-1 text-xs text-slate-700">
                  <span className="mr-2 rounded-full bg-emerald-50 px-2 py-0.5 text-[11px] font-semibold text-emerald-700">{KIND_LABEL[m.kind] || m.kind}</span>
                  {m.line_ids.map((id) => L[id] && `${fmtDate(L[id].value_date)} ${L[id].type_label} ${inr(L[id].debit)}`).filter(Boolean).join(' + ')}
                  <span className="mx-1 text-slate-400">↔</span>
                  {m.tx_ids.map((id) => A[id] && `${A[id].service_name || A[id].category} ${inr(A[id].amount)}`).filter(Boolean).join(' + ')}
                  {m.adjustment_tx_id && Number(m.diff) !== 0 && <span className="ml-2 text-amber-700">· {Number(m.diff) > 0 ? '+' : '−'}{inr(Math.abs(m.diff))} {Number(m.diff) > 0 ? 'added to' : 'taken off'} entry</span>}
                  {m.moved?.length > 0 && (
                    <span className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-rose-700">
                      <FiAlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                      The entry was moved to another wallet after matching — this bank debit is no longer covered. Undo the match.
                    </span>
                  )}
                  {m.changed?.length > 0 && (
                    <span className="mt-1 flex items-center gap-1 text-[11px] font-semibold text-amber-700">
                      <FiAlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                      Entry corrected after matching: now {m.changed.map((c) => inr(c.now)).join(' + ')}
                      {Math.abs(m.changed.reduce((t, c) => t + c.now, 0) + m.tx_ids.filter((t) => !m.changed.some((c) => c.id === t)).reduce((t, id) => t + Number(A[id]?.amount || 0), 0) - Number(m.bank_total)) < 0.005
                        ? ' — agrees with the bank ✓' : ' — still differs from the bank'}
                    </span>
                  )}
                </div>
                {!readOnly && !m.adjustment_tx_id && (
                  <button type="button" className={`${btnGhost} flex-shrink-0`} disabled={!!busy}
                    onClick={() => act(`u${m.id}`, () => api(`/matches/${m.id}/reject`, { method: 'POST', body: {} }), 'Match undone')}>
                    <FiRotateCcw className="h-3.5 w-3.5" />Undo
                  </button>
                )}
              </div>
            ))}
            {confirmed.length === 0 && <p className="text-xs text-slate-500">Nothing matched yet.</p>}
          </Section>

          {/* Checked */}
          <Section title="Checked by hand" count={bankChecked.length + appChecked.length} open={open.checked} onToggle={() => setOpen((o) => ({ ...o, checked: !o.checked }))}>
            {bankChecked.map((l) => (
              <div key={`l${l.id}`} className="flex items-center gap-2">
                <div className="min-w-0 flex-1"><BankRow l={l} /><p className="mt-0.5 pl-2 text-[11px] text-slate-600">Note: {l.note}</p></div>
                {!readOnly && <button type="button" className={btnGhost} disabled={!!busy} onClick={() => act(`ul${l.id}`, () => api(`/lines/${l.id}/uncheck`, { method: 'POST', body: {} }))}><FiRotateCcw className="h-3.5 w-3.5" /></button>}
              </div>
            ))}
            {appChecked.map((a) => (
              <div key={`a${a.id}`} className="flex items-center gap-2">
                <div className="min-w-0 flex-1"><AppRow a={a} /><p className="mt-0.5 pl-2 text-[11px] text-slate-600">Note: {a.note}</p></div>
                {!readOnly && <button type="button" className={btnGhost} disabled={!!busy} onClick={() => act(`ua${a.id}`, () => api(`/app/${a.id}/check`, { method: 'DELETE' }))}><FiRotateCcw className="h-3.5 w-3.5" /></button>}
              </div>
            ))}
            {bankChecked.length + appChecked.length === 0 && <p className="text-xs text-slate-500">Nothing marked.</p>}
          </Section>
        </>
      )}

      {modal?.kind === 'bank-book' && (
        <NoteModal
          title={`Book ${inr(modal.l.debit)} as an expense`}
          hint={`${fmtDate(modal.l.value_date)} · ${modal.l.type_label}. Taken from ${data?.wallet?.name || 'the bank wallet'} today and matched to this bank row.`}
          withCategory confirmLabel="Book expense" busy={busy === 'modal'}
          onCancel={() => setModal(null)}
          onSave={({ note, category }) => act('modal', () => api(`/lines/${modal.id}/book`, { method: 'POST', body: { note, category } }), 'Booked and matched').then(() => setModal(null))}
        />
      )}
      {modal?.kind === 'bank-check' && (
        <NoteModal
          title="Mark bank row as checked"
          hint="For a debit that needs no entry here (e.g. already recorded in another way). Nothing is booked."
          confirmLabel="Mark checked" busy={busy === 'modal'}
          onCancel={() => setModal(null)}
          onSave={({ note }) => act('modal', () => api(`/lines/${modal.id}/check`, { method: 'POST', body: { note } }), 'Marked as checked').then(() => setModal(null))}
        />
      )}
      {modal?.kind === 'app-check' && (
        <NoteModal
          title="Mark app entry as checked"
          hint="For an entry that is right even though it is not in this statement. Nothing is changed."
          confirmLabel="Mark checked" busy={busy === 'modal'}
          onCancel={() => setModal(null)}
          onSave={({ note }) => act('modal', () => api(`/app/${modal.id}/check`, { method: 'POST', body: { note } }), 'Marked as checked').then(() => setModal(null))}
        />
      )}
    </div>
  );
};

export default BankStatementSection;