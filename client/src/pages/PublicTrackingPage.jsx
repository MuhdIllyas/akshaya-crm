//for public TO tracking - 
import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  FiAlertCircle,
  FiCalendar,
  FiCheck,
  FiCopy,
  FiDownload,
  FiFileText,
  FiMessageSquare,
  FiRefreshCw,
} from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import axios from 'axios';

/* ------------------------------------------------------------------ */
/*  Brand — Navy #0F2B5B · Teal #14B8A6                                */
/* ------------------------------------------------------------------ */

const STATUS = {
  pending:     { label: 'Pending',           tone: 'bg-amber-100 text-amber-800',        dot: 'bg-amber-500' },
  in_progress: { label: 'In Progress',       tone: 'bg-[#DDE5F0] text-[#0F2B5B]',        dot: 'bg-[#0F2B5B]' },
  completed:   { label: 'Completed',         tone: 'bg-teal-100 text-teal-800',           dot: 'bg-teal-500' },
  paid:        { label: 'Paid',              tone: 'bg-teal-100 text-teal-800',           dot: 'bg-teal-500' },
  rejected:    { label: 'Delayed',           tone: 'bg-rose-100 text-rose-800',           dot: 'bg-rose-500' },
  resubmit:    { label: 'Resubmit Required', tone: 'bg-orange-100 text-orange-800',       dot: 'bg-orange-500' },
};

const clamp = (n) => Math.max(0, Math.min(100, Number(n) || 0));

/* ------------------------------------------------------------------ */
/*  Progress ring                                                      */
/* ------------------------------------------------------------------ */

const Ring = ({ value = 0, size = 132, compact = false }) => {
  const stroke = compact ? 6 : 9;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = clamp(value);

  return (
    <div className="relative mx-auto shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#E5EAF2" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#14B8A6"
          strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100}
          style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(.4,0,.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-black leading-none text-[#0F2B5B] ${compact ? 'text-lg' : 'text-3xl'}`}>
          {pct}
          <span className={`font-bold ${compact ? 'text-[10px]' : 'text-base'}`}>%</span>
        </span>
        <span className={`mt-1.5 font-bold uppercase tracking-[0.2em] text-slate-400 ${compact ? 'text-[7px]' : 'text-[10px]'}`}>
          Complete
        </span>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Fact row                                                           */
/* ------------------------------------------------------------------ */

const FactRow = ({ icon, label, value }) => (
  <div>
    <div className="flex items-center gap-2 text-slate-400">
      <span className="shrink-0">{icon}</span>
      <span className="text-[10px] font-bold uppercase tracking-[0.16em]">
        {label}
      </span>
    </div>
    <p className="mt-1.5 text-sm font-bold text-[#0F2B5B]">{value}</p>
  </div>
);

const FactsCard = ({ data }) => (
  <div className="rounded-2xl border border-slate-200/70 bg-white p-5">
    <FactRow
      icon={<FiCalendar className="h-3.5 w-3.5" />}
      label="Estimated completion"
      value={
        data.estimatedDelivery
          ? new Date(data.estimatedDelivery).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'short', year: 'numeric',
            })
          : 'Pending'
      }
    />

    <div className="my-4 h-px bg-slate-100" />

    <FactRow
      icon={<FiFileText className="h-3.5 w-3.5" />}
      label="Submitted on"
      value={
        data.createdAt
          ? new Date(data.createdAt).toLocaleDateString('en-IN', {
              day: 'numeric', month: 'short', year: 'numeric',
            })
          : '—'
      }
    />
  </div>
);

const DocumentsCard = ({ documents, trackingId, apiUrl }) => {
  if (!documents || documents.length === 0) return null;

  return (
    <section className="rounded-3xl border border-slate-200/70 bg-white p-6 sm:p-8">
      <div className="mb-5 flex items-center gap-2.5">
        <FiFileText className="h-4 w-4 text-[#0F2B5B]" />
        <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
          Documents ready for download
        </h2>
      </div>
      <div className="space-y-2">
        {documents.map((doc) => (
          <div
            key={doc.id}
            className="rounded-2xl border border-slate-200/70 bg-slate-50/60 p-4"
          >
            <a
              href={`${apiUrl}/api/servicetracking/public/status/${encodeURIComponent(trackingId)}/documents/${doc.id}/download`}
              className="flex items-center justify-between"
              target="_blank"
              rel="noopener noreferrer"
            >
              <span className="min-w-0 truncate text-sm font-bold text-[#0F2B5B]">{doc.label}</span>
              <span className="ml-3 grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-white text-[#0F2B5B] ring-1 ring-slate-200/70">
                <FiDownload className="h-4 w-4" />
              </span>
            </a>
            {doc.remark && (
              <p className="mt-2 text-xs font-medium text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-2.5 py-1.5">
                {doc.remark}
              </p>
            )}
          </div>
        ))}
      </div>
    </section>
  );
};

/* ------------------------------------------------------------------ */
/*  Page                                                               */
/* ------------------------------------------------------------------ */

const PublicTrackingPage = () => {
  const { trackingId } = useParams();

  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [copied, setCopied] = useState(false);

  const API_URL = import.meta.env.VITE_API_URL || '';

  const fetchStatus = useCallback(
    async (isRefresh = false) => {
      if (!trackingId || trackingId === 'undefined') {
        setError('No tracking ID provided in the link.');
        setLoading(false);
        return;
      }

      if (isRefresh) setRefreshing(true);
      else setLoading(true);

      try {
        const res = await axios.get(
          `${API_URL}/api/servicetracking/public/status/${encodeURIComponent(trackingId.trim())}`
        );

        if (!res.data || typeof res.data !== 'object') {
          throw new Error('Unexpected response from server');
        }

        setData(res.data);
        setError(null);
      } catch (err) {
        console.error('Tracking fetch error:', err);
        setError(
          err.response?.data?.error ||
            'We could not find an application. Please check your link.'
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [trackingId, API_URL]
  );

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  /* ---------------------------- helpers ---------------------------- */

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(data.applicationNumber);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch { /* ignore */ }
  };

  const formatWhatsAppLink = () => {
    const phone = data.centrePhone ? data.centrePhone.replace(/\D/g, '') : '';
    if (!phone) return '#';

    const lines = [
      `Hi ${data.centreName || 'Team'},`,
      '',
      'I have a query regarding my application. Here are the details:',
      '',
      `• Applicant Name: ${data.customerName || 'N/A'}`,
      `• Service: ${data.serviceName || 'N/A'}`,
    ];
    if (data.subcategoryName) lines.push(`• Sub-category: ${data.subcategoryName}`);
    lines.push(`• Application No: ${data.applicationNumber || 'N/A'}`);
    lines.push('', 'Please assist.');

    return `https://wa.me/${phone}?text=${encodeURIComponent(lines.join('\n'))}`;
  };

  const formatDate = (s) => {
    if (!s) return 'Pending';
    return new Date(s).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatDateTime = (s) => {
    if (!s) return '';
    return new Date(s).toLocaleString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric',
      hour: 'numeric', minute: '2-digit', hour12: true,
    });
  };

  /* ---------------------------- loading ---------------------------- */

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F7F9FC]">
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 animate-pulse rounded-xl bg-slate-200" />
              <div className="space-y-2">
                <div className="h-3 w-32 animate-pulse rounded-full bg-slate-200" />
                <div className="h-2.5 w-20 animate-pulse rounded-full bg-slate-200/70" />
              </div>
            </div>
            <div className="h-9 w-9 animate-pulse rounded-full bg-slate-200" />
          </div>

          <div className="lg:grid lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start lg:gap-6">
            <div className="hidden h-96 animate-pulse rounded-3xl bg-white ring-1 ring-slate-200/70 lg:block" />
            <div className="space-y-4 lg:space-y-5">
              <div className="h-48 animate-pulse rounded-3xl bg-white ring-1 ring-slate-200/70" />
              <div className="h-40 animate-pulse rounded-3xl bg-white ring-1 ring-slate-200/70" />
              <div className="h-32 animate-pulse rounded-3xl bg-white ring-1 ring-slate-200/70" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  /* ----------------------------- error ----------------------------- */

  if (error && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#F7F9FC] px-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-200/70 bg-white p-8 text-center">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-500">
            <FiAlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-[#0F2B5B]">Application not found</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">{error}</p>
          <button
            onClick={() => fetchStatus(true)}
            disabled={refreshing}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#0F2B5B] px-5 py-2.5 text-sm font-bold text-white transition hover:bg-[#0A1F44] disabled:opacity-60"
          >
            <FiRefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Try again
          </button>
        </div>
      </div>
    );
  }

  /* ----------------------------- success --------------------------- */

  const statusCfg = STATUS[data.status] || {
    label: data.status || 'Pending',
    tone: 'bg-slate-100 text-slate-700',
    dot: 'bg-slate-400',
  };

  const steps = Array.isArray(data.steps) ? data.steps : [];
  const updates = Array.isArray(data.updates) ? data.updates : [];
  const pct = clamp(data.progress);

  return (
    <div className="min-h-screen bg-[#F7F9FC] text-slate-900 antialiased">
      <div className="mx-auto max-w-7xl px-4 py-5 sm:px-6 lg:px-8 lg:py-8">

        {/* ------------------------- header ------------------------- */}
        <header className="mb-5 flex items-center justify-between gap-4 lg:mb-6">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center overflow-hidden rounded-xl bg-white ring-1 ring-slate-200/70">
              <img
                src="/logo-light.png"
                alt={data.centreName || 'Akshaya Sahayi'}
                className="h-full w-full object-contain p-0.5"
              />
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-[#0F2B5B]">
                {data.centreName || 'Akshaya Sahayi'}
              </p>
              <p className="text-[11px] text-slate-500">Application tracker</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full bg-white px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-slate-500 ring-1 ring-slate-200/70 sm:inline-flex">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-teal-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-teal-500" />
              </span>
              Live
            </span>
            <button
              onClick={() => fetchStatus(true)}
              disabled={refreshing}
              aria-label="Refresh status"
              className="grid h-9 w-9 place-items-center rounded-full border border-slate-200/70 bg-white text-slate-500 transition hover:border-[#0F2B5B]/30 hover:text-[#0F2B5B] disabled:opacity-60"
            >
              <FiRefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        {/* ============================================================
            APP SHELL
           ============================================================ */}
        <div className="lg:grid lg:grid-cols-[320px_minmax(0,1fr)] lg:items-start lg:gap-6">

          {/* ------------------ LEFT RAIL (desktop only) ------------------ */}
          <aside className="hidden lg:block">
            <div className="sticky top-6 space-y-4">

              <div className="relative overflow-hidden rounded-3xl border border-slate-200/70 bg-gradient-to-b from-white to-teal-50/60 p-6 text-center">
                <div aria-hidden className="pointer-events-none absolute -right-16 -top-16 h-40 w-40 rounded-full bg-teal-300/20 blur-3xl" />

                <div className="relative">
                  <Ring value={pct} size={132} />

                  <p className="mt-5 text-lg font-black leading-tight text-[#0F2B5B]">
                    {data.currentStep || 'Submitted'}
                  </p>
                  <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    Current stage
                  </p>

                  <div className="mt-5 flex items-center justify-center">
                    <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] ${statusCfg.tone}`}>
                      <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />
                      {statusCfg.label}
                    </span>
                  </div>
                </div>
              </div>

              <FactsCard data={data} />

              {data.centrePhone && (
                <a
                  href={formatWhatsAppLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="group flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#25D366] to-[#1ebe5b] p-4 text-white shadow-lg shadow-teal-500/20 transition hover:brightness-[1.04] active:scale-[0.99]"
                >
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/20">
                    <FaWhatsapp className="h-5 w-5" />
                  </span>
                  <span className="min-w-0 flex-1 text-left">
                    <span className="block text-sm font-bold">Have a question?</span>
                    <span className="block truncate text-xs text-white/85">
                      Chat with {data.centreName}
                    </span>
                  </span>
                  <span className="text-white/70 transition group-hover:translate-x-0.5 group-hover:text-white">→</span>
                </a>
              )}
            </div>
          </aside>

          {/* ------------------ MAIN COLUMN ------------------ */}
          <main className="min-w-0 space-y-4 lg:space-y-5">

            {/* ---- Title card ---- */}
            <section className="rounded-3xl border border-slate-200/70 bg-white p-6 sm:p-8">
              <div className="flex items-start justify-between gap-6">
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                    Application
                  </p>
                  <h1 className="mt-2.5 text-2xl font-black leading-[1.15] tracking-tight text-[#0F2B5B] sm:text-3xl">
                    {data.serviceName || 'Service Request'}
                  </h1>
                  {data.subcategoryName && (
                    <p className="mt-1.5 text-sm font-semibold text-teal-600">
                      {data.subcategoryName}
                    </p>
                  )}
                </div>

                {/* Mobile-only compact ring */}
                <div className="shrink-0 lg:hidden">
                  <Ring value={pct} size={76} compact />
                </div>
              </div>

              {/* ✅ Unified stat grid — visible on ALL screen sizes */}
              <div className="mt-6 grid grid-cols-2 gap-x-4 gap-y-5 border-t border-slate-100 pt-5 sm:gap-x-6 lg:grid-cols-3 lg:pt-6">
                {/* Applicant */}
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    Applicant
                  </p>
                  <p className="mt-1.5 truncate text-sm font-bold text-[#0F2B5B]">
                    {data.customerName || 'Customer'}
                  </p>
                </div>

                {/* Handled by */}
                <div className="min-w-0">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    Handled by
                  </p>
                  <p className="mt-1.5 truncate text-sm font-bold text-[#0F2B5B]">
                    {data.handledBy || 'Not assigned yet'}
                  </p>
                </div>

                {/* Application No — spans 2 cols on mobile so the number has room */}
                <div className="col-span-2 min-w-0 lg:col-span-1">
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    Application no
                  </p>
                  <div className="mt-1.5 flex items-center gap-2">
                    <code className="truncate font-mono text-sm font-bold tracking-wide text-[#0F2B5B]">
                      {data.applicationNumber || 'N/A'}
                    </code>
                    <button
                      onClick={handleCopy}
                      title="Copy application number"
                      className="shrink-0 rounded-md p-0.5 text-slate-400 transition hover:bg-slate-100 hover:text-[#0F2B5B]"
                    >
                      {copied ? <FiCheck className="h-3.5 w-3.5 text-teal-500" /> : <FiCopy className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
              </div>
            </section>

            {/* ---- Stepper ---- */}
            <section className="rounded-3xl border border-slate-200/70 bg-white p-6 sm:p-8">
              <div className="mb-6 flex items-center justify-between gap-4">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  Progress
                </h2>
                <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                  {steps.filter((s) => s.completed).length}/{steps.length || 0} · {pct}%
                </span>
              </div>

              {steps.length > 0 ? (
                <>
                  <ol
                    className="hidden lg:grid lg:gap-3"
                    style={{ gridTemplateColumns: `repeat(${steps.length}, minmax(0,1fr))` }}
                  >
                    {steps.map((step, i) => {
                      const isDone = !!step.completed;
                      const isCurrent = !isDone && step.name === data.currentStep;

                      return (
                        <li key={i} className="relative min-w-0">
                          <div className="relative">
                            <span
                              className={`absolute -top-[3px] left-0 z-10 h-3 w-3 rounded-full ring-4 ring-white ${
                                isDone ? 'bg-teal-500' : isCurrent ? 'bg-[#0F2B5B]' : 'bg-slate-300'
                              }`}
                            />
                            <div
                              className={`h-1.5 w-full rounded-full ${
                                isDone ? 'bg-teal-400' : isCurrent ? 'bg-[#0F2B5B]' : 'bg-slate-200'
                              }`}
                            />
                            {i === steps.length - 1 && (
                              <span
                                className={`absolute -top-[3px] right-0 h-3 w-3 rounded-full ring-4 ring-white ${
                                  isDone ? 'bg-teal-500' : 'bg-slate-200'
                                }`}
                              />
                            )}
                          </div>

                          <p
                            className={`mt-3 truncate text-[12px] font-bold ${
                              isDone || isCurrent ? 'text-[#0F2B5B]' : 'text-slate-400'
                            }`}
                          >
                            {step.name}
                          </p>
                          {isDone && step.date ? (
                            <p className="mt-0.5 text-[11px] text-slate-400">{formatDate(step.date)}</p>
                          ) : isCurrent ? (
                            <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-teal-600">
                              In progress
                            </p>
                          ) : (
                            <p className="mt-0.5 text-[11px] text-slate-300">Pending</p>
                          )}
                        </li>
                      );
                    })}
                  </ol>

                  <ol className="relative lg:hidden">
                    {steps.map((step, i) => {
                      const isDone = !!step.completed;
                      const isCurrent = !isDone && step.name === data.currentStep;
                      const isLast = i === steps.length - 1;

                      return (
                        <li key={i} className="relative flex gap-4 pb-6 last:pb-0">
                          {!isLast && (
                            <span
                              aria-hidden
                              className={`absolute bottom-0 left-[13px] top-8 w-[2px] rounded-full ${
                                isDone ? 'bg-teal-400' : 'bg-slate-200'
                              }`}
                            />
                          )}
                          <span
                            className={`relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full ring-4 ring-white ${
                              isDone
                                ? 'bg-teal-500 text-white'
                                : isCurrent
                                ? 'bg-[#0F2B5B] text-white'
                                : 'bg-slate-100 text-slate-400 text-[11px] font-bold'
                            }`}
                          >
                            {isCurrent && (
                              <span className="absolute -inset-1 animate-ping rounded-full bg-[#0F2B5B]/20" />
                            )}
                            {isDone ? (
                              <FiCheck className="relative h-3.5 w-3.5" strokeWidth={3} />
                            ) : (
                              <span className="relative">{i + 1}</span>
                            )}
                          </span>

                          <div className="min-w-0 pt-0.5">
                            <p
                              className={`text-[13px] font-bold ${
                                isDone || isCurrent ? 'text-[#0F2B5B]' : 'text-slate-400'
                              }`}
                            >
                              {step.name}
                            </p>
                            {isDone && step.date && (
                              <p className="mt-0.5 text-[11px] text-slate-400">{formatDate(step.date)}</p>
                            )}
                            {isCurrent && (
                              <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-teal-600">
                                In progress
                              </p>
                            )}
                          </div>
                        </li>
                      );
                    })}
                  </ol>
                </>
              ) : (
                <p className="text-sm text-slate-400">
                  Milestones for this application haven’t been published yet.
                </p>
              )}
            </section>

            {/* ---- Documents ---- */}
            <DocumentsCard documents={data.documents} trackingId={trackingId} apiUrl={API_URL} />

            {/* ---- Note ---- */}
            {data.notes && (
              <section className="relative overflow-hidden rounded-3xl border border-teal-100 bg-teal-50/50 p-6 sm:p-7">
                <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 w-1 bg-teal-400" />
                <div className="mb-3 flex items-center gap-2.5 pl-2">
                  <FiMessageSquare className="h-3.5 w-3.5 text-teal-600" />
                  <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-teal-700">
                    Note from our team
                  </h2>
                </div>
                <p className="whitespace-pre-line break-words pl-2 text-sm leading-relaxed text-[#0F2B5B]/85">
                  {data.notes}
                </p>
              </section>
            )}

            {/* ---- Updates ---- */}
            <section className="rounded-3xl border border-slate-200/70 bg-white p-6 sm:p-8">
              <div className="mb-6 flex items-center justify-between gap-4">
                <h2 className="text-[10px] font-bold uppercase tracking-[0.2em] text-slate-400">
                  Recent updates
                </h2>
                {updates.length > 0 && (
                  <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-slate-400">
                    {updates.length} {updates.length === 1 ? 'entry' : 'entries'}
                  </span>
                )}
              </div>

              {updates.length > 0 ? (
                <ol className="space-y-6">
                  {updates.map((u, i) => (
                    <li key={i} className="relative flex gap-4">
                      <div className="flex flex-col items-center">
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[#0F2B5B] ring-4 ring-[#EEF2F8]" />
                        {i < updates.length - 1 && (
                          <span className="mt-2 w-px flex-1 bg-slate-200" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 pb-1">
                        <p className="text-sm font-bold text-[#0F2B5B]">{u.title}</p>
                        {u.detail && (
                          <p className="mt-1 text-sm leading-relaxed text-slate-500">{u.detail}</p>
                        )}
                        <p className="mt-1.5 text-[11px] font-medium text-slate-400">
                          {formatDateTime(u.date)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-slate-400">
                  No updates have been posted yet. Check back soon.
                </p>
              )}
            </section>
          </main>
        </div>

        {/* ------------------ MOBILE-ONLY footer block ------------------ */}
        <div className="mt-4 space-y-4 lg:hidden">
          <FactsCard data={data} />

          {data.centrePhone && (
            <a
              href={formatWhatsAppLink()}
              target="_blank"
              rel="noopener noreferrer"
              className="group flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#25D366] to-[#1ebe5b] p-4 text-white shadow-lg shadow-teal-500/20 transition hover:brightness-[1.04] active:scale-[0.99]"
            >
              <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/20">
                <FaWhatsapp className="h-5 w-5" />
              </span>
              <span className="min-w-0 flex-1 text-left">
                <span className="block text-sm font-bold">Have a question?</span>
                <span className="block truncate text-xs text-white/85">
                  Chat with {data.centreName}
                </span>
              </span>
              <span className="text-white/70 transition group-hover:translate-x-0.5 group-hover:text-white">→</span>
            </a>
          )}

          <p className="px-1 text-[11px] leading-relaxed text-slate-400">
            This page updates automatically as your application progresses. Please keep your
            application number handy for enquiries.
          </p>
        </div>
      </div>
    </div>
  );
};

export default PublicTrackingPage;