import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  FiAlertCircle,
  FiBriefcase,
  FiCalendar,
  FiCheck,
  FiCopy,
  FiFileText,
  FiRefreshCw,
} from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import axios from 'axios';

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

const STATUS = {
  pending:     { label: 'Pending',           tone: 'bg-amber-100 text-amber-700',     dot: 'bg-amber-500' },
  in_progress: { label: 'In Progress',       tone: 'bg-indigo-100 text-indigo-700',   dot: 'bg-indigo-500' },
  completed:   { label: 'Completed',         tone: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  paid:        { label: 'Paid',              tone: 'bg-emerald-100 text-emerald-700', dot: 'bg-emerald-500' },
  rejected:    { label: 'Delayed',           tone: 'bg-rose-100 text-rose-700',       dot: 'bg-rose-500' },
  resubmit:    { label: 'Resubmit Required', tone: 'bg-orange-100 text-orange-700',   dot: 'bg-orange-500' },
};

const ACCENTS = {
  indigo: 'bg-indigo-50 text-indigo-600',
  violet: 'bg-violet-50 text-violet-600',
};

const clamp = (n) => Math.max(0, Math.min(100, Number(n) || 0));

/* ------------------------------------------------------------------ */
/*  Progress ring — scales for both compact (mobile) and full (lg)    */
/* ------------------------------------------------------------------ */

const Ring = ({ value = 0, size = 104, compact = false }) => {
  const stroke = compact ? 5 : 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = clamp(value);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="white"
          strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100}
          style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(.4,0,.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`font-bold leading-none text-white ${compact ? 'text-sm' : 'text-2xl'}`}>
          {pct}
          <span className={`font-semibold ${compact ? 'text-[9px]' : 'text-sm'}`}>%</span>
        </span>
        <span className={`mt-1 font-semibold uppercase tracking-[0.16em] text-indigo-200 ${compact ? 'text-[7px]' : 'text-[9px]'}`}>
          Done
        </span>
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Small pieces                                                       */
/* ------------------------------------------------------------------ */

const HeroStat = ({ label, value, mono, onCopy, copied }) => (
  <div className="min-w-0">
    <p className="text-[9px] font-semibold uppercase tracking-[0.16em] text-indigo-200 sm:text-[10px]">
      {label}
    </p>
    <div className="mt-1 flex items-center gap-1.5 sm:mt-1.5 sm:gap-2">
      <p className={`truncate text-[13px] font-semibold text-white sm:text-[15px] ${mono ? 'font-mono tracking-wide' : ''}`}>
        {value}
      </p>
      {mono && (
        <button
          onClick={onCopy}
          title="Copy application number"
          className="shrink-0 rounded-md p-0.5 text-white/50 transition hover:bg-white/10 hover:text-white"
        >
          {copied ? <FiCheck className="h-3.5 w-3.5 text-emerald-300" /> : <FiCopy className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
  </div>
);

const Tile = ({ icon, label, value, accent = 'indigo' }) => (
  <div className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-white p-5 shadow-sm">
    <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-xl ${ACCENTS[accent]}`}>
      {icon}
    </span>
    <div className="min-w-0">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-400">
        {label}
      </p>
      <p className="mt-1 truncate text-[15px] font-semibold text-slate-900">{value}</p>
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
        const res = await axios.get(
          `${API_URL}/api/servicetracking/public/status/${encodeURIComponent(trackingId.trim())}`
        );

        // If the request hit the frontend host, the SPA fallback returns index.html (a string).
        // Treat that as a failure instead of rendering an empty page.
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
    } catch { /* clipboard unavailable — ignore */ }
  };

  /* -------- WhatsApp message: rich & meaningful context -------- */
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
    if (!s) return 'Pending confirmation';
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
      <div className="min-h-screen bg-slate-50">
        <div className="mx-auto max-w-6xl space-y-4 px-4 py-6 sm:space-y-5 sm:px-6 sm:py-8 lg:px-8 lg:py-12">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-200" />
              <div className="space-y-2">
                <div className="h-3 w-32 animate-pulse rounded-full bg-slate-200" />
                <div className="h-2.5 w-20 animate-pulse rounded-full bg-slate-200/70" />
              </div>
            </div>
            <div className="h-9 w-9 animate-pulse rounded-full bg-slate-200" />
          </div>

          <div className="h-52 animate-pulse rounded-[24px] bg-gradient-to-br from-slate-300 to-slate-200 sm:h-72 sm:rounded-[28px]" />
          <div className="h-40 animate-pulse rounded-3xl bg-white shadow-sm ring-1 ring-slate-100" />

          <div className="grid gap-4 sm:gap-5 lg:grid-cols-3">
            <div className="h-56 animate-pulse rounded-3xl bg-white shadow-sm ring-1 ring-slate-100 lg:col-span-2" />
            <div className="h-56 animate-pulse rounded-3xl bg-white shadow-sm ring-1 ring-slate-100" />
          </div>
        </div>
      </div>
    );
  }

  /* ----------------------------- error ----------------------------- */

  if (error && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
        <div className="w-full max-w-md rounded-3xl border border-slate-100 bg-white p-8 text-center shadow-sm">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-500 ring-1 ring-rose-100">
            <FiAlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-slate-900">Application not found</h2>
          <p className="mt-2 text-sm leading-relaxed text-slate-500">{error}</p>
          <button
            onClick={() => fetchStatus(true)}
            disabled={refreshing}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-indigo-500/25 transition hover:bg-indigo-700 disabled:opacity-60"
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

  const initials = (data.centreName || 'AS')
    .split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  return (
    <div className="relative min-h-screen overflow-x-hidden bg-slate-50 text-slate-900 antialiased">
      {/* ambient indigo glow */}
      <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-gradient-to-b from-indigo-100/70 via-indigo-50/30 to-transparent" />

      <div className="relative mx-auto max-w-6xl px-4 py-5 sm:px-6 sm:py-6 lg:px-8 lg:py-10">

        {/* ------------------------- header ------------------------- */}
        <header className="mb-4 flex items-center justify-between gap-4 sm:mb-5 lg:mb-7">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-indigo-500 to-violet-600 text-[13px] font-bold text-white shadow-lg shadow-indigo-500/25">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">
                {data.centreName || 'Akshaya Sahayi'}
              </p>
              <p className="text-[11px] text-slate-500">Application tracker</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className={`hidden items-center gap-1.5 rounded-full px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.14em] sm:inline-flex ${statusCfg.tone}`}>
              <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />
              {statusCfg.label}
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
            HERO
            - mobile: compact landscape card (pill + ring in one row,
              2-col stat grid → roughly half the height)
            - desktop: full layout with large ring on the right
           ============================================================ */}
        <section className="relative mb-4 overflow-hidden rounded-[24px] bg-gradient-to-br from-indigo-600 via-indigo-600 to-violet-700 p-5 text-white shadow-xl shadow-indigo-900/15 sm:mb-5 sm:rounded-[28px] sm:p-9 lg:mb-6 lg:p-10">
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-white/10 blur-[80px]" />
          <div aria-hidden className="pointer-events-none absolute -bottom-28 -left-20 h-72 w-72 rounded-full bg-fuchsia-400/20 blur-[90px]" />

          <div className="relative flex flex-col lg:flex-row lg:items-center lg:gap-12">
            {/* ---- left column ---- */}
            <div className="min-w-0 flex-1">
              {/* Mobile: pill on the left, small ring on the right — saves a whole block of height */}
              <div className="flex items-center justify-between gap-4">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ring-1 ring-inset ring-white/25 backdrop-blur sm:px-3">
                  <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />
                  {statusCfg.label}
                </span>

                {/* Compact ring — mobile / tablet only */}
                <div className="lg:hidden">
                  <Ring value={pct} size={72} compact />
                </div>
              </div>

              <h1 className="mt-3.5 text-xl font-bold leading-tight tracking-tight sm:mt-5 sm:text-3xl lg:text-[40px]">
                {data.serviceName || 'Service Request'}
              </h1>

              {data.subcategoryName && (
                <p className="mt-1 text-[13px] font-medium text-indigo-200 sm:mt-2 sm:text-sm lg:text-base">
                  {data.subcategoryName}
                </p>
              )}

              {/* Labelled stat row — 2 cols on mobile so it takes 2 short rows, not 3 tall ones */}
              <div className="mt-4 grid grid-cols-2 gap-x-4 gap-y-4 border-t border-white/15 pt-4 sm:mt-8 sm:grid-cols-3 sm:gap-6 sm:pt-6 lg:mt-10">
                <HeroStat
                  label="Applicant"
                  value={data.customerName || 'Customer'}
                />
                <HeroStat
                  label="Handled by"
                  value={data.handledBy || 'Not assigned yet'}
                />
                <div className="col-span-2 sm:col-span-1">
                  <HeroStat
                    label="Application No"
                    value={data.applicationNumber || 'N/A'}
                    mono
                    onCopy={handleCopy}
                    copied={copied}
                  />
                </div>
              </div>
            </div>

            {/* ---- right column: full ring, desktop only ---- */}
            <div className="hidden shrink-0 items-center border-l border-white/15 pl-12 lg:flex">
              <Ring value={pct} size={104} />
            </div>
          </div>
        </section>

        {/* ============================================================
            STEPPER — horizontal on desktop, vertical on mobile
           ============================================================ */}
        <section className="mb-4 rounded-3xl border border-slate-100 bg-white p-6 shadow-sm sm:mb-5 sm:p-8 lg:mb-6">
          <div className="mb-6 flex items-center justify-between gap-4 sm:mb-7">
            <h2 className="text-sm font-bold text-slate-900">Progress</h2>
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
              {pct}% · {steps.filter((s) => s.completed).length}/{steps.length || 0} steps
            </span>
          </div>

          {steps.length > 0 ? (
            <ol className="relative lg:grid lg:auto-cols-fr lg:grid-flow-col">
              {steps.map((step, i) => {
                const isDone = !!step.completed;
                const isCurrent = !isDone && step.name === data.currentStep;
                const isLast = i === steps.length - 1;

                return (
                  <li
                    key={i}
                    className="relative flex gap-4 pb-6 last:pb-0 sm:pb-7 lg:flex-col lg:items-center lg:gap-0 lg:px-2 lg:pb-0 lg:text-center"
                  >
                    {/* mobile vertical connector */}
                    {!isLast && (
                      <span
                        aria-hidden
                        className={`absolute bottom-0 left-[13px] top-9 w-[2px] rounded-full lg:hidden ${
                          isDone ? 'bg-emerald-400' : 'bg-slate-200'
                        }`}
                      />
                    )}

                    {/* desktop horizontal connector */}
                    {!isLast && (
                      <span
                        aria-hidden
                        className={`absolute left-1/2 top-[13px] hidden h-[2px] w-full lg:block ${
                          isDone ? 'bg-emerald-400' : 'bg-slate-200'
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
                        <span className={`relative h-1.5 w-1.5 rounded-full ${isCurrent ? 'bg-white' : 'bg-slate-300'}`} />
                      )}
                    </span>

                    {/* text */}
                    <div className="min-w-0 pt-0.5 lg:mt-3.5 lg:pt-0">
                      <p
                        className={`text-[13px] font-semibold ${
                          isDone || isCurrent ? 'text-slate-900' : 'text-slate-400'
                        }`}
                      >
                        {step.name}
                      </p>

                      {isDone && step.date && (
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {formatDate(step.date)}
                        </p>
                      )}

                      {isCurrent && (
                        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-indigo-600">
                          In progress
                        </p>
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

        {/* ============================================================
            BENTO BODY
           ============================================================ */}
        <div className="grid gap-4 sm:gap-5 lg:grid-cols-3">
          {/* ------------------ MAIN ------------------ */}
          <div className="space-y-4 sm:space-y-5 lg:col-span-2">
            <section className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm sm:p-8">
              <div className="mb-6 flex items-center justify-between gap-4">
                <h2 className="text-sm font-bold text-slate-900">Recent updates</h2>
                {updates.length > 0 && (
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-400">
                    {updates.length} {updates.length === 1 ? 'entry' : 'entries'}
                  </span>
                )}
              </div>

              {updates.length > 0 ? (
                <ol className="space-y-6">
                  {updates.map((u, i) => (
                    <li key={i} className="relative flex gap-4">
                      <div className="flex flex-col items-center">
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500 ring-4 ring-indigo-50" />
                        {i < updates.length - 1 && (
                          <span className="mt-2 w-px flex-1 bg-slate-200" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 pb-1">
                        <p className="text-sm font-semibold text-slate-900">{u.title}</p>
                        {u.detail && (
                          <p className="mt-1 text-sm leading-relaxed text-slate-500">
                            {u.detail}
                          </p>
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
          </div>

          {/* ------------------ SIDEBAR ------------------ */}
          <aside className="space-y-4 sm:space-y-5 lg:col-span-1">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <Tile
                icon={<FiCalendar className="h-4 w-4" />}
                label="Estimated completion"
                value={data.estimatedDelivery ? formatDate(data.estimatedDelivery) : 'Pending'}
                accent="indigo"
              />
              <Tile
                icon={<FiFileText className="h-4 w-4" />}
                label="Submitted on"
                value={data.createdAt ? formatDate(data.createdAt) : '—'}
                accent="violet"
              />
            </div>

            {/* current stage */}
            <div className="rounded-3xl border border-slate-100 bg-white p-6 shadow-sm">
              <div className="flex items-center gap-3">
                <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-indigo-50 text-indigo-600">
                  <FiBriefcase className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Currently at
                  </p>
                  <p className="truncate text-lg font-bold text-slate-900">
                    {data.currentStep || 'Submitted'}
                  </p>
                </div>
              </div>

              <div className="mt-5 h-1.5 w-full overflow-hidden rounded-full bg-slate-100">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-violet-500 transition-all duration-1000 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] font-medium text-slate-400">
                <span>{statusCfg.label}</span>
                <span>{pct}%</span>
              </div>
            </div>

            {/* WhatsApp CTA */}
            {data.centrePhone && (
              <a
                href={formatWhatsAppLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 rounded-2xl bg-gradient-to-r from-[#25D366] to-[#1ebe5b] p-4 text-white shadow-lg shadow-emerald-500/25 transition hover:brightness-[1.04] active:scale-[0.99]"
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
                <span className="text-white/70 transition group-hover:translate-x-0.5 group-hover:text-white">
                  →
                </span>
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