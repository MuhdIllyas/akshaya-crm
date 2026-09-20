import React, { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  FiAlertCircle,
  FiCalendar,
  FiCheck,
  FiCopy,
  FiFileText,
  FiRefreshCw,
  FiUser,
  FiUserCheck,
} from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import axios from 'axios';

/* ------------------------------------------------------------------ */
/*  Config                                                             */
/* ------------------------------------------------------------------ */

const STATUS = {
  pending:     { label: 'Pending',           tone: 'bg-amber-100 text-amber-800',     dot: 'bg-amber-500' },
  in_progress: { label: 'In Progress',       tone: 'bg-sky-100 text-sky-800',         dot: 'bg-sky-500' },
  completed:   { label: 'Completed',         tone: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500' },
  paid:        { label: 'Paid',              tone: 'bg-emerald-100 text-emerald-800', dot: 'bg-emerald-500' },
  rejected:    { label: 'Delayed',           tone: 'bg-rose-100 text-rose-800',       dot: 'bg-rose-500' },
  resubmit:    { label: 'Resubmit Required', tone: 'bg-orange-100 text-orange-800',   dot: 'bg-orange-500' },
};

const clamp = (n) => Math.max(0, Math.min(100, Number(n) || 0));

/* ------------------------------------------------------------------ */
/*  Progress ring (dark hero version)                                  */
/* ------------------------------------------------------------------ */

const Ring = ({ value = 0, size = 104 }) => {
  const stroke = 6;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = clamp(value);

  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth={stroke} />
        <circle
          cx={size / 2} cy={size / 2} r={r} fill="none" stroke="#34d399"
          strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (c * pct) / 100}
          style={{ transition: 'stroke-dashoffset 900ms cubic-bezier(.4,0,.2,1)' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-2xl font-bold leading-none text-white">
          {pct}<span className="text-sm font-semibold">%</span>
        </span>
        <span className="mt-1.5 text-[9px] font-semibold uppercase tracking-[0.18em] text-white/45">
          Complete
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
    <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-white/40">
      {label}
    </p>
    <div className="mt-1.5 flex items-center gap-2">
      <p className={`truncate text-[15px] font-semibold text-white ${mono ? 'font-mono tracking-wide' : ''}`}>
        {value}
      </p>
      {mono && (
        <button
          onClick={onCopy}
          title="Copy"
          className="shrink-0 rounded-md p-1 text-white/40 transition hover:bg-white/10 hover:text-white"
        >
          {copied ? <FiCheck className="h-3.5 w-3.5 text-emerald-400" /> : <FiCopy className="h-3.5 w-3.5" />}
        </button>
      )}
    </div>
  </div>
);

const Tile = ({ icon, label, value }) => (
  <div className="rounded-2xl border border-stone-200/80 bg-white p-5">
    <div className="flex items-center gap-2 text-stone-400">
      {icon}
      <span className="text-[10px] font-semibold uppercase tracking-[0.14em]">{label}</span>
    </div>
    <p className="mt-2.5 text-[15px] font-semibold text-stone-900">{value}</p>
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
      <div className="min-h-screen bg-stone-50">
        <div className="mx-auto max-w-6xl space-y-5 px-4 py-8 sm:px-6 lg:px-8 lg:py-12">
          <div className="flex items-center justify-between">
            <div className="h-10 w-40 animate-pulse rounded-xl bg-stone-200" />
            <div className="h-9 w-24 animate-pulse rounded-full bg-stone-200" />
          </div>
          <div className="h-72 animate-pulse rounded-[28px] bg-stone-900/90" />
          <div className="h-40 animate-pulse rounded-3xl bg-white ring-1 ring-stone-200/80" />
          <div className="grid gap-5 lg:grid-cols-3">
            <div className="h-56 animate-pulse rounded-3xl bg-white ring-1 ring-stone-200/80 lg:col-span-2" />
            <div className="h-56 animate-pulse rounded-3xl bg-white ring-1 ring-stone-200/80" />
          </div>
        </div>
      </div>
    );
  }

  /* ----------------------------- error ----------------------------- */

  if (error && !data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4">
        <div className="w-full max-w-md rounded-3xl border border-stone-200/80 bg-white p-8 text-center">
          <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-rose-50 text-rose-500">
            <FiAlertCircle className="h-6 w-6" />
          </div>
          <h2 className="text-lg font-bold text-stone-900">Application not found</h2>
          <p className="mt-2 text-sm leading-relaxed text-stone-500">{error}</p>
          <button
            onClick={() => fetchStatus(true)}
            disabled={refreshing}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-stone-900 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800 disabled:opacity-60"
          >
            <FiRefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            Try again
          </button>
        </div>
      </div>
    );
  }

  /* ----------------------------- success --------------------------- */

  const statusCfg = STATUS[data.status] || { label: data.status || 'Pending', tone: 'bg-stone-100 text-stone-700', dot: 'bg-stone-400' };
  const steps = Array.isArray(data.steps) ? data.steps : [];
  const updates = Array.isArray(data.updates) ? data.updates : [];
  const pct = clamp(data.progress);

  const initials = (data.centreName || 'AS')
    .split(' ').filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase();

  return (
    <div className="min-h-screen bg-stone-50 text-stone-900 antialiased">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8 lg:py-10">

        {/* ------------------------- header ------------------------- */}
        <header className="mb-5 flex items-center justify-between gap-4 lg:mb-7">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-stone-900 text-[13px] font-bold text-white">
              {initials}
            </div>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-stone-900">
                {data.centreName || 'Akshaya Sahayi'}
              </p>
              <p className="text-[11px] text-stone-500">Application tracker</p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-500 sm:inline-flex">
              <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />
              {statusCfg.label}
            </span>
            <button
              onClick={() => fetchStatus(true)}
              disabled={refreshing}
              aria-label="Refresh"
              className="grid h-9 w-9 place-items-center rounded-full border border-stone-200 bg-white text-stone-500 transition hover:border-stone-300 hover:text-stone-900 disabled:opacity-60"
            >
              <FiRefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </header>

        {/* ============================================================
            DARK HERO
           ============================================================ */}
        <section className="relative mb-5 overflow-hidden rounded-[28px] bg-stone-950 p-7 text-white sm:p-9 lg:mb-6 lg:p-10">
          {/* subtle grid texture */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 opacity-[0.05]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,.6) 1px, transparent 1px)',
              backgroundSize: '44px 44px',
            }}
          />
          <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-72 w-72 rounded-full bg-emerald-500/15 blur-[80px]" />

          <div className="relative grid gap-8 lg:grid-cols-[1fr_auto] lg:items-center lg:gap-12">
            {/* left */}
            <div className="min-w-0">
              <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-[0.14em] ${statusCfg.tone}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${statusCfg.dot}`} />
                {statusCfg.label}
              </span>

              <h1 className="mt-5 text-2xl font-bold leading-[1.15] tracking-tight sm:text-3xl lg:text-[40px]">
                {data.serviceName || 'Service Request'}
              </h1>

              {data.subcategoryName && (
                <p className="mt-2 text-sm font-medium text-white/50 lg:text-base">
                  {data.subcategoryName}
                </p>
              )}

              {/* labelled stat row */}
              <div className="mt-8 grid gap-6 border-t border-white/10 pt-6 sm:grid-cols-3 lg:mt-10">
                <HeroStat
                  label="Applicant"
                  value={data.customerName || 'Customer'}
                />
                <HeroStat
                  label="Handled by"
                  value={data.handledBy || 'Not assigned yet'}
                />
                <HeroStat
                  label="Application No"
                  value={data.applicationNumber || 'N/A'}
                  mono
                  onCopy={handleCopy}
                  copied={copied}
                />
              </div>
            </div>

            {/* right: ring */}
            <div className="flex items-center justify-center border-t border-white/10 pt-7 lg:border-l lg:border-t-0 lg:pl-12 lg:pt-0">
              <Ring value={pct} />
            </div>
          </div>
        </section>

        {/* ============================================================
            STEPPER CARD
           ============================================================ */}
        <section className="mb-5 rounded-3xl border border-stone-200/80 bg-white p-6 sm:p-8 lg:mb-6">
          <div className="mb-7 flex items-center justify-between gap-4">
            <h2 className="text-sm font-bold text-stone-900">Progress</h2>
            <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">
              {pct}% complete · {steps.filter((s) => s.completed).length}/{steps.length || 0} steps
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
                    className="relative flex gap-4 pb-7 last:pb-0 lg:flex-col lg:items-center lg:gap-0 lg:px-2 lg:pb-0 lg:text-center"
                  >
                    {/* mobile vertical connector */}
                    {!isLast && (
                      <span
                        aria-hidden
                        className={`absolute bottom-0 left-[13px] top-9 w-[2px] lg:hidden ${
                          isDone ? 'bg-emerald-400' : 'bg-stone-200'
                        }`}
                      />
                    )}

                    {/* desktop horizontal connector */}
                    {!isLast && (
                      <span
                        aria-hidden
                        className={`absolute left-1/2 top-[13px] hidden h-[2px] w-full lg:block ${
                          isDone ? 'bg-emerald-400' : 'bg-stone-200'
                        }`}
                      />
                    )}

                    {/* node */}
                    <span
                      className={`relative z-10 grid h-7 w-7 shrink-0 place-items-center rounded-full ${
                        isDone
                          ? 'bg-emerald-500 text-white'
                          : isCurrent
                          ? 'bg-stone-900 text-white ring-4 ring-stone-900/10'
                          : 'bg-stone-100 text-stone-400'
                      }`}
                    >
                      {isDone ? (
                        <FiCheck className="h-3.5 w-3.5" strokeWidth={3} />
                      ) : (
                        <span className={`h-1.5 w-1.5 rounded-full ${isCurrent ? 'bg-white' : 'bg-stone-400'}`} />
                      )}
                    </span>

                    {/* text */}
                    <div className="min-w-0 pt-0.5 lg:mt-3.5 lg:pt-0">
                      <p
                        className={`text-[13px] font-semibold ${
                          isDone || isCurrent ? 'text-stone-900' : 'text-stone-400'
                        }`}
                      >
                        {step.name}
                      </p>

                      {isDone && step.date && (
                        <p className="mt-0.5 text-[11px] text-stone-400">
                          {formatDate(step.date)}
                        </p>
                      )}

                      {isCurrent && (
                        <p className="mt-0.5 text-[10px] font-bold uppercase tracking-[0.12em] text-emerald-600">
                          In progress
                        </p>
                      )}
                    </div>
                  </li>
                );
              })}
            </ol>
          ) : (
            <p className="text-sm text-stone-400">
              Milestones haven’t been published yet.
            </p>
          )}
        </section>

        {/* ============================================================
            BENTO BODY
           ============================================================ */}
        <div className="grid gap-5 lg:grid-cols-3">
          {/* main */}
          <div className="space-y-5 lg:col-span-2">
            <section className="rounded-3xl border border-stone-200/80 bg-white p-6 sm:p-8">
              <div className="mb-6 flex items-center justify-between gap-4">
                <h2 className="text-sm font-bold text-stone-900">Recent updates</h2>
                {updates.length > 0 && (
                  <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-stone-400">
                    {updates.length} {updates.length === 1 ? 'entry' : 'entries'}
                  </span>
                )}
              </div>

              {updates.length > 0 ? (
                <ol className="space-y-6">
                  {updates.map((u, i) => (
                    <li key={i} className="relative flex gap-4">
                      <div className="flex flex-col items-center">
                        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-stone-900" />
                        {i < updates.length - 1 && (
                          <span className="mt-2 w-px flex-1 bg-stone-200" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1 pb-1">
                        <p className="text-sm font-semibold text-stone-900">{u.title}</p>
                        {u.detail && (
                          <p className="mt-1 text-sm leading-relaxed text-stone-500">
                            {u.detail}
                          </p>
                        )}
                        <p className="mt-1.5 text-[11px] font-medium text-stone-400">
                          {formatDateTime(u.date)}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              ) : (
                <p className="text-sm text-stone-400">
                  No updates have been posted yet. Check back soon.
                </p>
              )}
            </section>
          </div>

          {/* sidebar */}
          <aside className="space-y-5 lg:col-span-1">
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1">
              <Tile
                icon={<FiCalendar className="h-3.5 w-3.5" />}
                label="Estimated completion"
                value={data.estimatedDelivery ? formatDate(data.estimatedDelivery) : 'Pending'}
              />
              <Tile
                icon={<FiFileText className="h-3.5 w-3.5" />}
                label="Submitted on"
                value={data.createdAt ? formatDate(data.createdAt) : '—'}
              />
            </div>

            {/* current stage */}
            <div className="rounded-3xl border border-stone-200/80 bg-white p-6">
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-stone-400">
                Currently at
              </p>
              <p className="mt-2 text-lg font-bold text-stone-900">
                {data.currentStep || 'Submitted'}
              </p>
              <div className="mt-5 h-1 w-full overflow-hidden rounded-full bg-stone-100">
                <div
                  className="h-full rounded-full bg-emerald-500 transition-all duration-1000 ease-out"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="mt-3 flex items-center justify-between text-[11px] font-medium text-stone-400">
                <span>{statusCfg.label}</span>
                <span>{pct}%</span>
              </div>
            </div>

            {/* WhatsApp */}
            {data.centrePhone && (
              <a
                href={formatWhatsAppLink()}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-3 rounded-2xl bg-stone-900 p-4 text-white transition hover:bg-stone-800 active:scale-[0.99]"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-[#25D366]">
                  <FaWhatsapp className="h-5 w-5 text-white" />
                </span>
                <span className="min-w-0 flex-1 text-left">
                  <span className="block text-sm font-bold">Have a question?</span>
                  <span className="block truncate text-xs text-white/55">
                    Chat with {data.centreName}
                  </span>
                </span>
                <span className="text-white/40 transition group-hover:translate-x-0.5 group-hover:text-white">
                  →
                </span>
              </a>
            )}

            <p className="px-1 text-[11px] leading-relaxed text-stone-400">
              This page updates automatically as your application progresses.
            </p>
          </aside>
        </div>
      </div>
    </div>
  );
};

export default PublicTrackingPage;