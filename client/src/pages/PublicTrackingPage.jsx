import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  FiAlertCircle,
  FiBriefcase,
  FiCalendar,
  FiCheck,
  FiChevronRight,
  FiCopy,
  FiFileText,
  FiRefreshCw,
  FiUser,
} from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import axios from 'axios';

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

const STATUS_CONFIG = {
  pending: { label: 'Pending', dot: 'bg-amber-400' },
  in_progress: { label: 'In Progress', dot: 'bg-indigo-400' },
  completed: { label: 'Completed', dot: 'bg-emerald-400' },
  paid: { label: 'Paid', dot: 'bg-emerald-400' },
  rejected: { label: 'Delayed', dot: 'bg-rose-400' },
  resubmit: { label: 'Resubmit Required', dot: 'bg-orange-400' },
};

const ACCENTS = {
  indigo: 'bg-indigo-50 text-indigo-600',
  violet: 'bg-violet-50 text-violet-600',
};

/* ------------------------------------------------------------------ */
/*  Small building blocks                                              */
/* ------------------------------------------------------------------ */

const ProgressRing = ({ value = 0, size = 84 }) => {
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const pct = Math.max(0, Math.min(100, Number(value) || 0));

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.22)"
          strokeWidth={stroke}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="white"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference - (circumference * pct) / 100}
          style={{ transition: 'stroke-dashoffset 1s cubic-bezier(.4,0,.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-lg font-bold leading-none text-white">
          {pct}
          <span className="text-[11px] font-semibold">%</span>
        </span>
        <span className="mt-1 text-[9px] font-semibold uppercase tracking-[0.12em] text-indigo-200">
          Complete
        </span>
      </div>
    </div>
  );
};

const InfoTile = ({ icon, label, value, accent = 'indigo' }) => (
  <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${ACCENTS[accent]}`}>
      {icon}
    </span>
    <div className="min-w-0">
      <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-0.5 truncate text-sm font-bold text-slate-800">{value}</p>
    </div>
  </div>
);

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
        const response = await axios.get(
          `${API_URL}/api/servicetracking/public/status/${encodeURIComponent(trackingId.trim())}`
        );

        // If the request hit the frontend host, the SPA fallback returns index.html (a string).
        // Treat that as a failure instead of rendering an empty page.
        if (!response.data || typeof response.data !== 'object') {
          throw new Error('Unexpected response from server');
        }

        setData(response.data);
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
    } catch {
      /* clipboard not available — silently ignore */
    }
  };

  const formatWhatsAppLink = () => {
    const phone = data.centrePhone ? data.centrePhone.replace(/\D/g, '') : '';
    const message = encodeURIComponent(
      `Hi ${data.centreName}, I have a query regarding my application ${data.applicationNumber}.`
    );
    return phone ? `https://wa.me/${phone}?text=${message}` : '#';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Pending Confirmation';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  };

  const formatDateTime = (dateStr) => {
    if (!dateStr) return '';
    return new Date(dateStr).toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  /* ---------------------------- loading ---------------------------- */
  /*  Mirrors the final layout: single column on mobile, 3-col on lg  */

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-6xl space-y-5 px-4 py-10 sm:px-6 lg:py-14">
          <div className="flex items-center gap-3">
            <div className="h-11 w-11 animate-pulse rounded-2xl bg-slate-200" />
            <div className="space-y-2">
              <div className="h-3 w-36 animate-pulse rounded-full bg-slate-200" />
              <div className="h-2.5 w-20 animate-pulse rounded-full bg-slate-200/70" />
            </div>
          </div>

          <div className="h-56 animate-pulse rounded-3xl bg-gradient-to-br from-slate-200 to-slate-100" />

          <div className="grid gap-5 lg:grid-cols-3">
            <div className="space-y-6 rounded-3xl border border-slate-100 bg-white p-6 lg:col-span-2">
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="flex gap-4" style={{ opacity: 1 - i * 0.18 }}>
                  <div className="h-7 w-7 shrink-0 animate-pulse rounded-full bg-slate-200" />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="h-3 w-1/2 animate-pulse rounded-full bg-slate-200" />
                    <div className="h-2.5 w-1/3 animate-pulse rounded-full bg-slate-100" />
                  </div>
                </div>
              ))}
            </div>
            <div className="h-48 animate-pulse rounded-3xl border border-slate-100 bg-white lg:col-span-1" />
          </div>

          <p className="text-center text-xs font-medium text-slate-400">
            Locating your application…
          </p>
        </div>
      </div>
    );
  }

  /* ----------------------------- error ----------------------------- */

  if (error && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-5 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-rose-50 to-red-50 text-rose-500 ring-1 ring-rose-100">
            <FiAlertCircle className="h-7 w-7" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Application not found</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">{error}</p>

          <button
            onClick={() => fetchStatus(true)}
            disabled={refreshing}
            className="mt-6 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-600 transition hover:border-indigo-200 hover:text-indigo-600 disabled:opacity-60"
          >
            <FiRefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Try again
          </button>
        </div>
      </div>
    );
  }

  /* ----------------------------- success --------------------------- */

  const statusCfg = STATUS_CONFIG[data.status] || {
    label: data.status || 'Pending',
    dot: 'bg-slate-300',
  };

  const steps = Array.isArray(data.steps) ? data.steps : [];
  const updates = Array.isArray(data.updates) ? data.updates : [];

  const initials = (data.centreName || 'AS')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-slate-50 text-slate-900 antialiased">
      {/* ambient background glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-indigo-100/70 via-indigo-50/30 to-transparent" />

      {/* max-w-6xl → gives laptops a wide, landscape canvas */}
      <div className="relative mx-auto max-w-6xl px-4 pb-14 pt-8 sm:px-6 sm:pt-10 lg:pt-12">
        {/* ------------------------- header ------------------------- */}
        <header className="mb-5 flex items-center justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-indigo-500 to-violet-600 text-sm font-bold text-white shadow-lg shadow-indigo-500/25">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-bold text-slate-900">
                {data.centreName || 'Akshaya Sahayi'}
              </p>
              <p className="text-xs text-slate-500">Application tracker</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-emerald-600 ring-1 ring-emerald-100">
              <span className="relative flex h-1.5 w-1.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-emerald-500" />
              </span>
              Live
            </span>

            <button
              onClick={() => fetchStatus(true)}
              disabled={refreshing}
              aria-label="Refresh status"
              className="grid h-9 w-9 place-items-center rounded-full border border-slate-200 bg-white text-slate-500 shadow-sm transition hover:border-indigo-200 hover:text-indigo-600 disabled:opacity-60"
            >
              <FiRefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        {/* ============================================================
            HERO — full width on every screen, horizontal on laptop
           ============================================================ */}
        <section className="relative mb-5 overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 p-6 text-white shadow-xl shadow-indigo-900/15 sm:p-7 lg:p-8">
          <div className="pointer-events-none absolute -right-16 -top-20 h-56 w-56 rounded-full bg-white/10 blur-2xl" />
          <div className="pointer-events-none absolute -bottom-24 -left-12 h-56 w-56 rounded-full bg-fuchsia-400/20 blur-3xl" />

          <div className="relative flex flex-col gap-7 lg:flex-row lg:items-center lg:justify-between lg:gap-10">
            {/* ---- left: identity ---- */}
            <div className="min-w-0 flex-1">
              <div className="flex items-start justify-between gap-4 lg:justify-start">
                <div className="min-w-0">
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-200">
                    Application number
                  </p>
                  <button
                    onClick={handleCopy}
                    title="Copy application number"
                    className="group mt-1 flex max-w-full items-center gap-2 rounded-lg text-left transition hover:opacity-90"
                  >
                    <span className="truncate font-mono text-lg font-bold tracking-wide lg:text-xl">
                      {data.applicationNumber || 'N/A'}
                    </span>
                    {copied ? (
                      <FiCheck className="h-4 w-4 shrink-0 text-emerald-300" />
                    ) : (
                      <FiCopy className="h-3.5 w-3.5 shrink-0 text-white/50 transition group-hover:text-white" />
                    )}
                  </button>
                  {copied && (
                    <p className="mt-0.5 text-[10px] font-medium text-emerald-300">Copied!</p>
                  )}
                </div>

                {/* status pill — inline on mobile, sits next to the number on laptop */}
                <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset ring-white/25 backdrop-blur lg:hidden">
                  <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />
                  {statusCfg.label}
                </span>
              </div>

              <div className="mt-5 flex items-center gap-3">
                <h2 className="text-xl font-bold leading-snug sm:text-2xl lg:text-3xl">
                  {data.serviceName || 'Service Request'}
                </h2>

                <span className="hidden shrink-0 items-center gap-1.5 rounded-full bg-white/15 px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider ring-1 ring-inset ring-white/25 backdrop-blur lg:inline-flex">
                  <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />
                  {statusCfg.label}
                </span>
              </div>

              {data.subcategoryName && (
                <p className="mt-1.5 text-sm font-medium text-indigo-200">
                  {data.subcategoryName}
                </p>
              )}

              <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-2 text-[13px] text-indigo-100">
                <span className="inline-flex items-center gap-1.5">
                  <FiUser className="h-3.5 w-3.5 opacity-70" />
                  {data.customerName || 'Customer'}
                </span>

                {data.handledBy && (
                  <span className="inline-flex items-center gap-1.5">
                    <FiBriefcase className="h-3.5 w-3.5 opacity-70" />
                    {data.handledBy}
                  </span>
                )}

                {data.estimatedDelivery && (
                  <span className="inline-flex items-center gap-1.5">
                    <FiCalendar className="h-3.5 w-3.5 opacity-70" />
                    ETA {formatDate(data.estimatedDelivery)}
                  </span>
                )}
              </div>
            </div>

            {/* ---- right: progress ring ---- */}
            <div className="flex items-center justify-between gap-6 border-t border-white/15 pt-6 lg:border-l lg:border-t-0 lg:pl-10 lg:pt-0">
              <div className="lg:hidden">
                <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-indigo-200">
                  Overall progress
                </p>
                <p className="mt-1 text-sm text-indigo-100">
                  {data.currentStep ? `Currently at: ${data.currentStep}` : 'Being processed'}
                </p>
              </div>

              <ProgressRing value={data.progress} />
            </div>
          </div>
        </section>

        {/* ============================================================
            BODY — 1 column on phone, 3 columns (2 + 1) on laptop
           ============================================================ */}
        <div className="grid gap-5 lg:grid-cols-3">
          {/* ------------------ LEFT / MAIN ------------------ */}
          <div className="space-y-5 lg:col-span-2">
            {/* timeline */}
            <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm sm:p-7">
              <div className="mb-5 flex items-center justify-between gap-4">
                <h3 className="text-sm font-bold text-slate-900">Progress timeline</h3>
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
                  {steps.filter((s) => s.completed).length} / {steps.length || 0} done
                </span>
              </div>

              {steps.length > 0 ? (
                <ol className="relative lg:grid lg:grid-cols-2 lg:gap-x-10 lg:gap-y-0">
                  {steps.map((step, index) => {
                    const isDone = !!step.completed;
                    const isCurrent = !isDone && step.name === data.currentStep;
                    const isLast = index === steps.length - 1;

                    return (
                      <li key={index} className="relative flex gap-4 pb-7 last:pb-0">
                        {/* connector */}
                        {!isLast && (
                          <span
                            className={`absolute bottom-0 left-[13px] top-9 w-[2px] rounded-full lg:hidden ${
                              isDone ? 'bg-emerald-300' : 'bg-slate-200'
                            }`}
                          />
                        )}

                        {/* node */}
                        <span
                          className={`relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full ring-4 ring-white ${
                            isDone
                              ? 'bg-emerald-500 text-white'
                              : isCurrent
                              ? 'bg-indigo-600 text-white'
                              : 'bg-slate-100 text-slate-300'
                          }`}
                        >
                          {isCurrent && (
                            <span className="absolute -inset-1 animate-ping rounded-full bg-indigo-400/30" />
                          )}
                          {isDone ? (
                            <FiCheck className="relative h-3.5 w-3.5" strokeWidth={3} />
                          ) : (
                            <span
                              className={`relative h-1.5 w-1.5 rounded-full ${
                                isCurrent ? 'bg-white' : 'bg-slate-300'
                              }`}
                            />
                          )}
                        </span>

                        {/* text */}
                        <div className="min-w-0 flex-1 pt-0.5">
                          <div className="flex items-center justify-between gap-3">
                            <p
                              className={`text-sm font-semibold ${
                                isDone || isCurrent ? 'text-slate-900' : 'text-slate-400'
                              }`}
                            >
                              {step.name}
                            </p>

                            {isCurrent && (
                              <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-indigo-600">
                                In progress
                              </span>
                            )}
                          </div>

                          {isDone && step.date && (
                            <p className="mt-1 text-xs text-slate-400">{formatDate(step.date)}</p>
                          )}
                        </div>
                      </li>
                    );
                  })}
                </ol>
              ) : (
                <p className="text-sm text-slate-400">
                  Milestones for this application haven’t been published yet.
                </p>
              )}
            </section>

            {/* updates — on laptop this fills the empty space under the timeline */}
            {updates.length > 0 && (
              <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm sm:p-7">
                <h3 className="mb-5 text-sm font-bold text-slate-900">Recent updates</h3>

                <div className="space-y-5">
                  {updates.map((u, i) => (
                    <div key={i} className="flex gap-3.5">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-400 ring-4 ring-indigo-50" />
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-800">{u.title}</p>
                        {u.detail && (
                          <p className="mt-0.5 text-sm leading-relaxed text-slate-500">
                            {u.detail}
                          </p>
                        )}
                        <p className="mt-1 text-[11px] font-medium uppercase tracking-wide text-slate-400">
                          {formatDateTime(u.date)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}
          </div>

          {/* ------------------ RIGHT / SIDEBAR ------------------ */}
          <aside className="space-y-5 lg:col-span-1">
            {/* key facts — 2-up on tablet, stacked in the narrow laptop rail */}
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1">
              <InfoTile
                icon={<FiCalendar className="h-4 w-4" />}
                label="Estimated completion"
                value={
                  data.estimatedDelivery ? formatDate(data.estimatedDelivery) : 'Pending confirmation'
                }
                accent="indigo"
              />
              <InfoTile
                icon={<FiFileText className="h-4 w-4" />}
                label="Submitted on"
                value={data.createdAt ? formatDate(data.createdAt) : '—'}
                accent="violet"
              />
            </div>

            {/* current stage card — gives the sidebar substance on laptop */}
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
              <h3 className="mb-4 text-sm font-bold text-slate-900">Current stage</h3>

              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                  <FiBriefcase className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-sm font-bold text-slate-800">
                    {data.currentStep || 'Submitted'}
                  </p>
                  <p className="text-xs text-slate-400">
                    {statusCfg.label} · {Number(data.progress) || 0}% complete
                  </p>
                </div>
              </div>

              <div className="mt-4 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-1000 ease-out"
                  style={{ width: `${Math.max(0, Math.min(100, Number(data.progress) || 0))}%` }}
                />
              </div>
            </div>

            {/* WhatsApp CTA */}
            {data.centrePhone && (
              <a
                href={formatWhatsAppLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex w-full items-center justify-between gap-3 rounded-2xl bg-gradient-to-r from-[#25D366] to-[#1ebe5b] p-4 text-white shadow-lg shadow-emerald-500/25 transition hover:brightness-[1.04] active:scale-[0.99]"
              >
                <span className="flex items-center gap-3">
                  <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/20">
                    <FaWhatsapp className="h-5 w-5" />
                  </span>
                  <span className="text-left">
                    <span className="block text-sm font-bold">Have a question?</span>
                    <span className="block text-xs text-white/85">
                      Chat with {data.centreName}
                    </span>
                  </span>
                </span>
                <FiChevronRight className="h-5 w-5 shrink-0 transition group-hover:translate-x-0.5" />
              </a>
            )}

            <p className="px-1 text-[11px] leading-relaxed text-slate-400">
              This page updates automatically as your application progresses. Please keep your
              application number handy for enquiries.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default PublicTrackingPage;