// src/pages/staff/ServiceRequirementsPrint.jsx
// Staff page: pick one or more services, print/download a branded "required documents" checklist for the customer.

import React, { useEffect, useMemo, useState } from 'react';
import {
  FiSearch, FiX, FiPlus, FiTrash2, FiPrinter, FiDownload, FiFileText, FiChevronDown,
  FiLoader, FiAlertCircle, FiCheck, FiUser, FiPhone,
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import { getCategories } from '@/services/serviceService';
import {
  collectRequiredDocuments, printServiceChecklist, DEFAULT_CHECKLIST_NOTE,
} from '@/utils/pdf/requiredDocumentsPdf';

const inputCls =
  'w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/20';
const btnBase =
  'inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-medium focus:outline-none focus-visible:ring-2 focus-visible:ring-navy-500 focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50 transition-colors';
const btnPrimary = `${btnBase} bg-navy-700 text-white shadow-sm hover:bg-navy-800`;
const btnGhost = `${btnBase} border border-slate-200 bg-white text-slate-700 hover:bg-slate-50`;

const formatCurrency = (amount) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(amount || 0);

const keyOf = (cid, sid) => `${cid}-${sid ?? 'none'}`;

const ServiceRequirementsPrint = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  const [search, setSearch] = useState('');
  const [openCatId, setOpenCatId] = useState(null);
  const [picked, setPicked] = useState([]); // [{ key, categoryId, subcategoryId }]

  const [customerName, setCustomerName] = useState('');
  const [phone, setPhone] = useState('');
  const [showCharges, setShowCharges] = useState(false);
  const [notes, setNotes] = useState(DEFAULT_CHECKLIST_NOTE);

  const [busy, setBusy] = useState(null); // 'print' | 'download'
  const [previewUrl, setPreviewUrl] = useState(null);

  /* ---------- data ---------- */
  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const res = await getCategories();
        if (cancelled) return;
        setCategories(Array.isArray(res.data) ? res.data : []);
        setLoadError(null);
      } catch (err) {
        if (cancelled) return;
        console.error('ServiceRequirementsPrint: failed to load services', err.response?.data || err.message);
        setLoadError('Failed to load services. Please try again.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [reloadKey]);

  const catById = useMemo(() => new Map(categories.map((c) => [c.id, c])), [categories]);

  const resolved = useMemo(
    () =>
      picked
        .map((p) => {
          const category = catById.get(p.categoryId);
          const subcategory = category?.subcategories?.find((s) => s.id === p.subcategoryId) || null;
          return { ...p, category, subcategory };
        })
        .filter((p) => p.category),
    [picked, catById]
  );

  const q = search.trim().toLowerCase();
  const filtered = useMemo(
    () =>
      categories
        .filter((c) => c.status !== 'inactive')
        .filter(
          (c) =>
            !q ||
            c.name?.toLowerCase().includes(q) ||
            (c.subcategories || []).some((s) => s.name?.toLowerCase().includes(q))
        ),
    [categories, q]
  );

  const isPicked = (cid, sid) => picked.some((p) => p.key === keyOf(cid, sid));

  const togglePick = (cid, sid = null) => {
    const key = keyOf(cid, sid);
    setPicked((prev) =>
      prev.some((p) => p.key === key)
        ? prev.filter((p) => p.key !== key)
        : [...prev, { key, categoryId: cid, subcategoryId: sid }]
    );
  };

  /* ---------- live preview (debounced) ---------- */
  useEffect(() => {
    if (resolved.length === 0) {
      setPreviewUrl(null);
      return;
    }
    let cancelled = false;
    const t = setTimeout(async () => {
      try {
        const url = await printServiceChecklist({ items: resolved, customerName, phone, showCharges, notes, mode: 'preview' });
        if (cancelled) URL.revokeObjectURL(url);
        else setPreviewUrl(url);
      } catch (err) {
        console.warn('Preview failed', err);
      }
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [resolved, customerName, phone, showCharges, notes]);

  // free the previous blob when a new preview replaces it
  useEffect(() => () => previewUrl && URL.revokeObjectURL(previewUrl), [previewUrl]);

  const run = async (mode) => {
    if (resolved.length === 0) return toast.error('Add at least one service.');
    setBusy(mode);
    try {
      await printServiceChecklist({ items: resolved, customerName, phone, showCharges, notes, mode });
    } catch (err) {
      console.error(err);
      toast.error(err.message || 'Could not create the PDF.');
    } finally {
      setBusy(null);
    }
  };

  const clearAll = () => {
    setPicked([]);
    setCustomerName('');
    setPhone('');
  };

  /* ---------- render ---------- */
  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <div>
          <h1 className="text-xl font-semibold text-slate-900">Document Checklist</h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Print the documents a customer needs to bring, on the centre letterhead
          </p>
        </div>

        <div className="grid grid-cols-1 items-start gap-5 lg:grid-cols-5">
          {/* ---------- LEFT: service picker ---------- */}
          <div className="space-y-3 lg:col-span-2">
            <div className="relative">
              <FiSearch className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search services or sub-categories"
                className={`${inputCls} pl-9 pr-9`}
                aria-label="Search services"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-1 text-slate-400 hover:text-slate-600"
                  aria-label="Clear search"
                >
                  <FiX className="h-4 w-4" />
                </button>
              )}
            </div>

            {loadError && (
              <div className="flex items-center justify-between gap-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">
                <span className="flex items-center gap-2"><FiAlertCircle className="h-4 w-4" />{loadError}</span>
                <button onClick={() => setReloadKey((k) => k + 1)} className={btnGhost}>Retry</button>
              </div>
            )}

            {loading ? (
              <div className="space-y-2" aria-busy="true">
                {[0, 1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-xl border border-slate-200 bg-white" />)}
              </div>
            ) : (
              <div className="max-h-[70vh] space-y-2 overflow-y-auto pr-1">
                {filtered.length === 0 && !loadError && (
                  <p className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
                    No services match.
                  </p>
                )}

                {filtered.map((cat) => {
                  const subs = cat.subcategories || [];
                  const subMatch = q && subs.some((s) => s.name?.toLowerCase().includes(q));
                  const open = openCatId === cat.id || subMatch;
                  const visibleSubs = q && !cat.name?.toLowerCase().includes(q)
                    ? subs.filter((s) => s.name?.toLowerCase().includes(q))
                    : subs;

                  return (
                    <div key={cat.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
                      <div className="flex items-center gap-2 px-3 py-2.5">
                        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-navy-700">
                          <FiFileText className="h-4 w-4" />
                        </span>
                        <button
                          onClick={() => subs.length && setOpenCatId(open ? null : cat.id)}
                          className="min-w-0 flex-1 text-left"
                          aria-expanded={open}
                        >
                          <p className="truncate text-sm font-semibold text-slate-900">{cat.name}</p>
                          <p className="text-xs text-slate-500">
                            {subs.length
                              ? `${subs.length} sub-categor${subs.length === 1 ? 'y' : 'ies'}`
                              : `${collectRequiredDocuments(cat, null).length} documents`}
                          </p>
                        </button>
                        {subs.length > 0 ? (
                          <FiChevronDown className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${open ? 'rotate-180' : ''}`} />
                        ) : (
                          <PickButton picked={isPicked(cat.id, null)} onClick={() => togglePick(cat.id, null)} />
                        )}
                      </div>

                      {open && subs.length > 0 && (
                        <div className="divide-y divide-slate-100 border-t border-slate-100 bg-slate-50/60">
                          {visibleSubs.map((sub) => (
                            <div key={sub.id} className="flex items-center gap-3 px-3 py-2 pl-[3.25rem]">
                              <div className="min-w-0 flex-1">
                                <p className="truncate text-sm text-slate-800">{sub.name}</p>
                                <p className="text-xs text-slate-500">
                                  {collectRequiredDocuments(cat, sub).length} documents
                                </p>
                              </div>
                              <PickButton picked={isPicked(cat.id, sub.id)} onClick={() => togglePick(cat.id, sub.id)} />
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* ---------- RIGHT: checklist + options + preview ---------- */}
          <div className="space-y-4 lg:col-span-3">
            <div className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="relative">
                  <FiUser className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input value={customerName} onChange={(e) => setCustomerName(e.target.value)}
                    placeholder="Customer name (optional)" className={`${inputCls} pl-9`} />
                </div>
                <div className="relative">
                  <FiPhone className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="tel"
                    placeholder="Phone (optional)" className={`${inputCls} pl-9`} />
                </div>
              </div>

              <div>
                <div className="mb-2 flex items-center justify-between">
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                    Services on this checklist <span className="ml-1 font-medium text-slate-400">{resolved.length}</span>
                  </h2>
                  {(resolved.length > 0 || customerName || phone) && (
                    <button onClick={clearAll} className="text-xs font-medium text-slate-500 hover:text-rose-600">Clear all</button>
                  )}
                </div>

                {resolved.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-slate-300 px-4 py-8 text-center text-sm text-slate-500">
                    Add a service from the list to see its documents here.
                  </p>
                ) : (
                  <div className="space-y-2">
                    {resolved.map(({ key, category, subcategory }) => {
                      const docs = collectRequiredDocuments(category, subcategory);
                      const src = subcategory || category;
                      const total = (parseFloat(src.service_charges) || 0) + (parseFloat(src.department_charges) || 0);
                      return (
                        <div key={key} className="rounded-lg border border-slate-200 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <p className="truncate text-sm font-semibold text-slate-900">
                                {category.name}{subcategory ? ` - ${subcategory.name}` : ''}
                              </p>
                              {showCharges && (
                                <p className="text-xs font-medium tabular-nums text-emerald-700">{formatCurrency(total)}</p>
                              )}
                            </div>
                            <button
                              onClick={() => togglePick(category.id, subcategory?.id ?? null)}
                              className="rounded-md p-1.5 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                              aria-label="Remove"
                            >
                              <FiTrash2 className="h-4 w-4" />
                            </button>
                          </div>
                          {docs.length > 0 ? (
                            <ul className="mt-2 flex flex-wrap gap-1.5">
                              {docs.map((d) => (
                                <li key={d} className="rounded-md bg-amber-50 px-2 py-1 text-xs text-amber-800 ring-1 ring-amber-100">{d}</li>
                              ))}
                            </ul>
                          ) : (
                            <p className="mt-2 text-xs text-rose-600">No documents listed for this service. Add them in Service Management.</p>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              <label className="flex cursor-pointer items-center gap-3 rounded-lg border border-slate-200 p-3 hover:bg-slate-50">
                <input type="checkbox" checked={showCharges} onChange={(e) => setShowCharges(e.target.checked)}
                  className="h-4 w-4 rounded border-slate-300 text-navy-700 focus:ring-navy-500" />
                <span>
                  <span className="block text-sm font-medium text-slate-800">Show fees</span>
                  <span className="block text-xs text-slate-500">Service and department charges for each service</span>
                </span>
              </label>

              <div>
                <label className="mb-1.5 block text-sm font-medium text-slate-700">Note printed at the bottom</label>
                <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={3} className={inputCls} />
              </div>

              <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
                <button onClick={() => run('download')} disabled={!resolved.length || !!busy} className={btnGhost}>
                  {busy === 'download' ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiDownload className="h-4 w-4" />}
                  Download PDF
                </button>
                <button onClick={() => run('print')} disabled={!resolved.length || !!busy} className={btnPrimary}>
                  {busy === 'print' ? <FiLoader className="h-4 w-4 animate-spin" /> : <FiPrinter className="h-4 w-4" />}
                  Print checklist
                </button>
              </div>
            </div>

            {/* Preview (desktop browsers render PDFs inline; phones usually don't) */}
            {previewUrl && (
              <div className="hidden overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:block">
                <div className="border-b border-slate-100 px-4 py-2 text-xs font-medium text-slate-500">Preview</div>
                <iframe title="Checklist preview" src={`${previewUrl}#toolbar=0&view=FitH`} className="h-[640px] w-full" />
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

const PickButton = ({ picked, onClick }) => (
  <button
    onClick={onClick}
    className={`inline-flex shrink-0 items-center gap-1 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors ${
      picked
        ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200 hover:bg-emerald-100'
        : 'border border-slate-200 bg-white text-navy-700 hover:bg-slate-50'
    }`}
  >
    {picked ? <FiCheck className="h-3.5 w-3.5" /> : <FiPlus className="h-3.5 w-3.5" />}
    {picked ? 'Added' : 'Add'}
  </button>
);

export default ServiceRequirementsPrint;