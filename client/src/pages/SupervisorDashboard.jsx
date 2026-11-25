import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "react-toastify";
import {
  FiAlertTriangle, FiArrowRight, FiBriefcase, FiCalendar, FiCheck, FiClock,
  FiRefreshCw, FiShield, FiTrendingUp, FiUserPlus, FiZap,
} from "react-icons/fi";
import QuickServiceModal from "@/components/QuickServiceModal";
import { getTokens } from "/src/services/serviceService";
import { getWalletsForCentre } from "@/services/walletService";
import { postAttendance } from "/src/services/salaryService";
import { todayIST, addDays } from "../utils/dates";

/* Supervisor home (navy and gold): the centre's accounts first, then the
   supervisor's own work, applications, performance and events. The full
   staff dashboard (token queue, online work and so on) is under My Work.
   Every number comes from the same routes the Accounts, Expense Approvals
   and staff pages use, so it is limited to the supervisor's centre. */

const API = import.meta.env.VITE_API_URL;
const ACCOUNTS = "/dashboard/supervisor/accounts";
const EXPENSES = "/dashboard/supervisor/expenses";
const MY_WORK = "/dashboard/supervisor/mywork";

const getJson = async (path) => {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
};
const val = (r) => (r.status === "fulfilled" ? r.value : null);

const rupees = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const shortDate = (d) =>
  new Date(String(d).length === 10 ? `${d}T00:00:00+05:30` : d).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });
const greeting = (h) => (h < 12 ? "Good morning" : h < 17 ? "Good afternoon" : "Good evening");
const CLOSE_LABEL = { closed: "Closed", incomplete: "Checklist not done", not_closed: "Not closed" };

async function loadCentre(me) {
  const today = todayIST();
  const yesterday = addDays(today, -1);
  const [yClose, tClose, expenses, pending, upi, wallets] = await Promise.allSettled([
    getJson(`/api/accounting/closing-status?date=${yesterday}`),
    getJson(`/api/accounting/closing-status?date=${today}`),
    getJson(`/api/expense`),
    getJson(`/api/servicemanagement/pending-payments?scope=centre`),
    getJson(`/api/upi-credits?status=unclaimed&window=7d`),
    getWalletsForCentre(),
  ]);

  const walletList = Array.isArray(val(wallets)) ? val(wallets) : [];
  let bankOpen = null;
  const bankWallets = walletList.filter((w) => w.wallet_type === "bank" && w.status !== "inactive");
  if (bankWallets.length) {
    const lists = await Promise.allSettled(bankWallets.map((w) => getJson(`/api/bankstatements?wallet_id=${w.id}`)));
    bankOpen = lists.reduce((s, r) => s + (r.status === "fulfilled" && r.value[0] ? r.value[0].open_debits || 0 : 0), 0);
  }

  const toApprove = (val(expenses) || []).filter((e) => e.status === "pending" && Number(e.staff_id) !== me);
  const oldestExpense = [...toApprove].sort((a, b) => String(a.expense_date).localeCompare(String(b.expense_date)))[0];
  const pendingList = Array.isArray(val(pending)) ? val(pending) : null;

  // Centre money by wallet type
  const byType = {};
  for (const w of walletList.filter((w) => w.status !== "inactive")) {
    const k = w.wallet_type || "other";
    byType[k] = byType[k] || { count: 0, total: 0 };
    byType[k].count += 1;
    byType[k].total += Number(w.balance) || 0;
  }

  return {
    yesterday, today,
    yClose: val(yClose), tClose: val(tClose),
    toApprove: val(expenses) ? toApprove.length : null,
    toApproveTotal: toApprove.reduce((s, e) => s + Number(e.amount || 0), 0),
    oldestExpense: oldestExpense ? { id: oldestExpense.id, date: String(oldestExpense.expense_date).slice(0, 10) } : null,
    pending: pendingList,
    pendingDue: (pendingList || []).reduce((s, p) => s + Number(p.pending_amount || 0), 0),
    upiUnclaimed: val(upi)?.summary ? val(upi).summary.unclaimed : null,
    bankOpen,
    walletsLoaded: wallets.status === "fulfilled",
    walletList,
    byType,
  };
}

async function loadMine(me, centreId) {
  const [ws, stats, tokens] = await Promise.allSettled([
    getJson(`/api/staffperformance/workspace-init?period=month`),
    getJson(`/api/servicetracking/stats?staff=${me}`),
    getTokens(centreId, "all", { scope: "mine" }),
  ]);
  const data = val(ws)?.data || {};
  const tokenList = val(tokens)?.data || [];
  const activeTokens = tokenList.filter((t) => {
    const s = String(t.staffId || "").trim();
    return (s === String(me) || !s || s === "null") && t.status !== "completed" && t.status !== "cancelled";
  }).length;
  const now = new Date(); now.setHours(0, 0, 0, 0);
  const events = (data.events || [])
    .filter((e) => !e.assigned_to || String(e.assigned_to) === String(me))
    .map((e) => ({ ...e, _d: new Date(e.date || e.start_datetime) }))
    .filter((e) => !isNaN(e._d) && e._d >= now)
    .sort((a, b) => a._d - b._d);
  return {
    loaded: ws.status === "fulfilled",
    perf: data.performance || null,
    attendance: data.todayAttendance || null,
    tasks: (data.tasks || []).length,
    onlineQueue: (data.onlinePending || []).length,
    onlineMine: (data.onlineProcessing || []).length,
    events,
    stats: val(stats),
    activeTokens: val(tokens) ? activeTokens : null,
  };
}

// ---------- small building blocks ----------

const Card = ({ title, id, action, children, className = "" }) => (
  <section aria-labelledby={id} className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm ${className}`}>
    <div className="mb-4 flex flex-wrap items-baseline justify-between gap-2">
      <h2 id={id} className="text-lg font-bold text-slate-900">{title}</h2>
      {action}
    </div>
    {children}
  </section>
);

const GoldLink = ({ to, state, children }) => (
  <Link to={to} state={state} className="inline-flex items-center gap-1 text-sm font-semibold text-amber-700 hover:text-amber-800">
    {children} <FiArrowRight className="h-4 w-4" aria-hidden="true" />
  </Link>
);

const TONE = {
  bad: "border-red-200 bg-red-50/60",
  warn: "border-amber-200 bg-amber-50/60",
  ok: "border-emerald-200 bg-emerald-50/50",
  idle: "border-slate-200 bg-slate-50",
};
const TONE_LABEL = { bad: "text-red-700", warn: "text-amber-800", ok: "text-emerald-700", idle: "text-slate-600" };

const Tile = ({ to, state, tone, label, value, sub }) => (
  <Link to={to} state={state} className={`flex flex-col gap-1 rounded-xl border p-4 transition hover:shadow-md ${TONE[tone]}`}>
    <span className={`text-xs font-bold uppercase tracking-wide ${TONE_LABEL[tone]}`}>{label}</span>
    <span className="text-2xl font-bold leading-tight text-slate-900">{value}</span>
    {sub && <span className="text-xs text-slate-600">{sub}</span>}
  </Link>
);

const Stat = ({ label, value }) => (
  <div className="rounded-xl bg-slate-50 p-3">
    <div className="text-xs text-slate-500">{label}</div>
    <div className="text-2xl font-bold text-slate-900">{value ?? "–"}</div>
  </div>
);

// ---------- page ----------

const SupervisorDashboard = () => {
  const me = Number(localStorage.getItem("id"));
  const centreId = localStorage.getItem("centre_id");
  const firstName = (localStorage.getItem("name") || "").split(" ")[0] || "there";

  const [centre, setCentre] = useState(null);
  const [mine, setMine] = useState(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());
  const [punching, setPunching] = useState(false);
  const [showQuick, setShowQuick] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    Promise.allSettled([loadCentre(me), loadMine(me, centreId)])
      .then(([c, m]) => {
        if (c.status === "fulfilled") setCentre(c.value);
        if (m.status === "fulfilled") setMine(m.value);
        if (c.status === "rejected" && m.status === "rejected") toast.error("Couldn't load the dashboard");
      })
      .finally(() => setLoading(false));
  }, [me, centreId]);

  useEffect(() => { refresh(); }, [refresh]);
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 60000);
    return () => clearInterval(t);
  }, []);

  const myWallets = useMemo(
    () => (centre?.walletList || []).filter((w) => String(w.assigned_staff_id) === String(me)),
    [centre, me]
  );
  const myWalletsTotal = myWallets.reduce((s, w) => s + (Number(w.balance) || 0), 0);

  const att = mine?.attendance;
  const punchState = !att || !att.punch_in ? "out" : !att.punch_out ? "in" : "done";
  const punch = async () => {
    setPunching(true);
    try {
      const d = new Date();
      await postAttendance({
        punch_type: punchState === "in" ? "out" : "in",
        date: d.toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }),
        time: d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: "Asia/Kolkata" }),
      });
      toast.success(punchState === "in" ? "Punched out" : "Punched in");
      setMine(await loadMine(me, centreId));
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to update attendance");
    } finally {
      setPunching(false);
    }
  };

  // ----- centre accounts -----
  const y = centre?.yClose;
  const yStatus = y?.status || "not_closed";
  const variance = Number(y?.cash_variance || 0);
  const openDiff = Number(y?.open_short || 0) + Number(y?.open_excess || 0);
  const toMatch = (centre?.upiUnclaimed || 0) + (centre?.bankOpen || 0);
  const matchUnknown = centre && centre.upiUnclaimed === null && !centre.walletsLoaded;
  const pendingOldest = useMemo(
    () => [...(centre?.pending || [])].sort((a, b) => new Date(a.created_at) - new Date(b.created_at)).slice(0, 5),
    [centre]
  );
  const typeLabel = { cash: "Cash", digital: "Digital", bank: "Bank" };
  // null = unknown (wallets not loaded), so nothing shows a false ₹0
  const cashTotal = centre?.walletsLoaded ? (centre.byType.cash?.total ?? 0) : null;
  const allTotal = centre?.walletsLoaded ? Object.values(centre.byType).reduce((s, t) => s + t.total, 0) : null;

  // ----- my work -----
  const stats = mine?.stats;
  const appsTotal = Number(stats?.total || 0);
  const pct = (n) => (appsTotal ? `${(Number(n || 0) / appsTotal) * 100}%` : "0%");
  const score = Math.round(Number(mine?.perf?.summary?.incentive_score || 0));
  const scoreLabel = score >= 80 ? "Excellent" : score >= 60 ? "Good" : score >= 40 ? "Average" : "Needs improvement";
  const target = mine?.perf?.target;

  return (
    <div className="space-y-5">
      {/* ===== Welcome banner (navy and gold) ===== */}
      <section aria-label="Welcome" className="flex flex-wrap justify-between gap-5 rounded-2xl bg-navy-700 p-6 text-white">
        <div className="flex min-w-[280px] flex-1 flex-col gap-4">
          <span className="inline-flex items-center gap-1.5 self-start rounded-full bg-amber-300 px-3 py-1 text-xs font-bold tracking-wide text-navy-900">
            <FiShield className="h-3.5 w-3.5" aria-hidden="true" /> SUPERVISOR · CENTRE ACCOUNTS
          </span>
          <div>
            <h1 className="text-2xl font-bold sm:text-3xl">{greeting(now.getHours())}, {firstName}</h1>
            <p className="mt-1 text-sm text-slate-200">
              {now.toLocaleDateString("en-IN", { weekday: "long", day: "numeric", month: "long" })} ·{" "}
              {now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to={ACCOUNTS} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-amber-300 px-4 text-sm font-bold text-navy-900 hover:bg-amber-200">
              <FiClock className="h-4 w-4" aria-hidden="true" /> Tonight's close
            </Link>
            <button type="button" onClick={() => setShowQuick(true)} className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-white/15 px-4 text-sm font-semibold hover:bg-white/25">
              <FiZap className="h-4 w-4" aria-hidden="true" /> Quick Service
            </button>
            <Link to="/dashboard/staff/service_entry" className="inline-flex min-h-[44px] items-center gap-2 rounded-xl bg-white/15 px-4 text-sm font-semibold hover:bg-white/25">
              <FiUserPlus className="h-4 w-4" aria-hidden="true" /> Entry for a staff member
            </Link>
          </div>
        </div>

        <div className="grid min-w-[260px] flex-1 grid-cols-2 gap-3 sm:max-w-[420px]">
          <div className="rounded-xl bg-white/10 p-4 ring-1 ring-white/20">
            <div className="flex items-center gap-1.5 text-xs font-bold tracking-wide text-amber-300">
              <FiBriefcase className="h-3.5 w-3.5" aria-hidden="true" /> {myWallets.length > 1 ? `MY WALLETS · ${myWallets.length}` : "MY WALLET"}
            </div>
            {myWallets.length === 0 ? (
              <div className="mt-1 text-sm text-slate-200">{!centre ? "…" : centre.walletsLoaded ? "None assigned" : "Couldn't load"}</div>
            ) : (
              <>
                <div className="mt-1 text-2xl font-bold">{rupees(myWalletsTotal)}</div>
                <div className="truncate text-xs text-slate-200">{myWallets.map((w) => w.name).join(", ")}</div>
              </>
            )}
          </div>
          <div className="flex flex-col gap-2 rounded-xl bg-white/10 p-4 ring-1 ring-white/20">
            <div className="text-xs font-bold tracking-wide text-amber-300">ATTENDANCE</div>
            <div className="text-sm font-semibold">
              {!mine ? "…" : punchState === "out" ? "Not punched in" : punchState === "in" ? `In since ${String(att.punch_in).slice(0, 5)}` : `Out at ${String(att.punch_out).slice(0, 5)}`}
            </div>
            {mine && punchState !== "done" && (
              <button type="button" onClick={punch} disabled={punching}
                className={`min-h-[36px] self-start rounded-lg px-3 text-sm font-bold disabled:opacity-60 ${punchState === "out" ? "bg-rose-300 text-rose-950 hover:bg-rose-200" : "bg-white/20 text-white hover:bg-white/30"}`}>
                {punching ? "Saving…" : punchState === "out" ? "Punch in" : "Punch out"}
              </button>
            )}
          </div>
        </div>
      </section>

      {/* ===== Centre accounts ===== */}
      <Card
        id="sv-centre"
        title="Centre accounts"
        action={
          <div className="flex items-center gap-3">
            <button type="button" onClick={refresh} disabled={loading} aria-label="Refresh"
              className="grid h-10 w-10 place-items-center rounded-lg border border-slate-200 text-slate-500 hover:bg-slate-50 disabled:opacity-50">
              <FiRefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
            </button>
            <GoldLink to={ACCOUNTS}>Open Accounts</GoldLink>
          </div>
        }
      >
        {!centre ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true">
            {[0, 1, 2, 3].map((i) => <div key={i} className="h-28 animate-pulse rounded-xl bg-slate-100" />)}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[minmax(0,1.1fr)_minmax(0,2fr)_minmax(0,1.1fr)]">
            {/* close */}
            <div className={`flex flex-col gap-3 rounded-xl border p-4 ${!y ? TONE.idle : yStatus === "closed" ? (variance ? TONE.warn : TONE.ok) : TONE.bad}`}>
              <span className={`text-xs font-bold uppercase tracking-wide ${!y ? TONE_LABEL.idle : yStatus === "closed" ? (variance ? TONE_LABEL.warn : TONE_LABEL.ok) : TONE_LABEL.bad}`}>
                Close · {shortDate(centre.yesterday)}
              </span>
              <span className="text-2xl font-bold text-slate-900">{!y ? "Couldn't load" : CLOSE_LABEL[yStatus]}</span>
              <span className="text-sm text-slate-600">
                {y && yStatus === "closed"
                  ? `${y.closed_by_name ? `By ${y.closed_by_name}. ` : ""}${variance ? `Cash off by ${rupees(Math.abs(variance))}` : "No cash difference"}`
                  : "Count the cash and finish the nightly checklist"}
              </span>
              <span className="text-sm text-slate-600">
                Today ({shortDate(centre.today)}): <strong className="font-semibold">{centre.tClose?.status === "closed" ? "closed" : "open"}</strong>
              </span>
              <Link to={ACCOUNTS} className="mt-auto inline-flex min-h-[40px] items-center justify-center self-start rounded-lg bg-navy-700 px-4 text-sm font-semibold text-white hover:bg-navy-800">
                {y && yStatus === "closed" ? "Open Accounts" : "Close the day"}
              </Link>
            </div>

            {/* tiles */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Tile to={ACCOUNTS} state={{ tab: "pending" }}
                tone={centre.pending === null ? "idle" : centre.pending.length ? "warn" : "ok"}
                label="Pending payments"
                value={centre.pending === null ? "Couldn't load" : centre.pending.length || "None"}
                sub={centre.pending?.length ? `${rupees(centre.pendingDue)} due · all staff` : "Nothing to collect"} />
              <Tile to={EXPENSES} state={centre.oldestExpense ? { openExpenseId: centre.oldestExpense.id } : undefined}
                tone={centre.toApprove === null ? "idle" : centre.toApprove ? "warn" : "ok"}
                label="Expenses to approve"
                value={centre.toApprove === null ? "Couldn't load" : centre.toApprove ? `${centre.toApprove} · ${rupees(centre.toApproveTotal)}` : "None"}
                sub={centre.oldestExpense ? `Oldest from ${shortDate(centre.oldestExpense.date)}` : "All approved"} />
              <Tile to={ACCOUNTS}
                tone={matchUnknown ? "idle" : toMatch ? "warn" : "ok"}
                label="Payments to match"
                value={matchUnknown ? "Couldn't load" : toMatch || "None"}
                sub={`Bank lines ${centre.bankOpen ?? "–"} · UPI (7 days) ${centre.upiUnclaimed ?? "–"}`} />
              <Tile to={ACCOUNTS}
                tone={!y ? "idle" : openDiff ? "warn" : "ok"}
                label="Wallet differences"
                value={!y ? "Couldn't load" : openDiff ? rupees(openDiff) : "None"}
                sub={openDiff ? `Short ${rupees(y.open_short)} · Excess ${rupees(y.open_excess)}` : "Nothing to settle"} />
            </div>

            {/* money */}
            <div className="flex flex-col gap-3 rounded-xl border border-slate-200 p-4">
              <span className="text-xs font-bold uppercase tracking-wide text-slate-500">Centre money</span>
              {!centre.walletsLoaded && <span className="text-sm text-slate-600">Couldn't load the wallets.</span>}
              <div className="flex items-baseline justify-between"><span className="text-sm text-slate-600">Cash</span><span className="text-xl font-bold">{cashTotal === null ? "–" : rupees(cashTotal)}</span></div>
              <div className="flex items-baseline justify-between"><span className="text-sm text-slate-600">All wallets</span><span className="text-xl font-bold">{allTotal === null ? "–" : rupees(allTotal)}</span></div>
              <ul className="flex flex-col gap-1.5 border-t border-slate-100 pt-3 text-sm">
                {Object.entries(centre.byType).map(([k, t]) => (
                  <li key={k} className="flex justify-between">
                    <span className="text-slate-600">{typeLabel[k] || k} · {t.count} wallet{t.count === 1 ? "" : "s"}</span>
                    <span className="font-semibold">{rupees(t.total)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}
      </Card>

      {/* ===== My work, performance, events ===== */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-2 2xl:grid-cols-3">
        <Card id="sv-work" title="My work" action={<GoldLink to={MY_WORK}>Open My Work</GoldLink>}>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="My tokens" value={mine?.activeTokens} />
            <Stat label="Online queue" value={mine ? mine.onlineQueue : null} />
            <Stat label="My online work" value={mine ? mine.onlineMine : null} />
            <Stat label="Pending tasks" value={mine ? mine.tasks : null} />
          </div>
          <div className="mt-5">
            <div className="mb-2 flex items-baseline justify-between">
              <span className="text-sm font-semibold text-slate-900">My applications</span>
              <span className="text-sm text-slate-500">{stats ? `${appsTotal} in all` : "–"}</span>
            </div>
            <div className="flex h-3 overflow-hidden rounded-full bg-slate-200" role="img"
              aria-label={stats ? `${stats.pending || 0} pending, ${stats.in_progress || 0} in progress, ${stats.completed || 0} completed, ${stats.delayed || 0} delayed` : "Loading"}>
              <div className="bg-amber-400" style={{ width: pct(stats?.pending) }} />
              <div className="bg-sky-500" style={{ width: pct(stats?.in_progress) }} />
              <div className="bg-emerald-500" style={{ width: pct(stats?.completed) }} />
              <div className="bg-rose-500" style={{ width: pct(stats?.delayed) }} />
            </div>
            <ul className="mt-3 grid grid-cols-2 gap-2 text-sm">
              <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-amber-400" />Pending <strong>{stats?.pending ?? "–"}</strong></li>
              <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-sky-500" />In progress <strong>{stats?.in_progress ?? "–"}</strong></li>
              <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-emerald-500" />Completed <strong>{stats?.completed ?? "–"}</strong></li>
              <li className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-sm bg-rose-500" />Delayed <strong>{stats?.delayed ?? "–"}</strong></li>
            </ul>
            <div className="mt-3"><GoldLink to="/dashboard/staff/track_service">Track my applications</GoldLink></div>
          </div>
        </Card>

        <Card id="sv-perf" title="My performance" action={<GoldLink to="/dashboard/staff/performance">Performance</GoldLink>}>
          {!mine ? (
            <div className="h-40 animate-pulse rounded-xl bg-slate-100" aria-busy="true" />
          ) : !mine.perf ? (
            <p className="text-sm text-slate-600">Couldn't load your performance.</p>
          ) : (
            <>
              <div className="flex items-center gap-5">
                <div className="relative grid h-24 w-24 shrink-0 place-items-center rounded-full"
                  style={{ background: `conic-gradient(#f59e0b ${score * 3.6}deg, #e2e8f0 0deg)` }}
                  role="img" aria-label={`Performance score ${score} percent`}>
                  <span className="grid h-[76px] w-[76px] place-items-center rounded-full bg-white text-xl font-bold">{score}%</span>
                </div>
                <div>
                  <div className="font-semibold text-slate-900">{scoreLabel}</div>
                  <div className="mt-1 text-sm text-slate-600">Collection rate {Math.round(mine.perf.summary?.collection_rate || 0)}% · {mine.perf.summary?.total_services || 0} services this month</div>
                </div>
              </div>
              <div className="mt-5 rounded-xl bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900"><FiTrendingUp className="h-4 w-4 text-amber-600" aria-hidden="true" /> Monthly target</div>
                {target?.monthly_target ? (
                  <>
                    <div className="mt-2 text-sm text-slate-600">{rupees(target.current_achieved)} of {rupees(target.monthly_target)}</div>
                    <div className="mt-2 h-2 overflow-hidden rounded-full bg-slate-200">
                      <div className="h-full rounded-full bg-amber-400" style={{ width: `${Math.min(Number(target.progress_percentage || 0), 100)}%` }} />
                    </div>
                  </>
                ) : (
                  <div className="mt-1 text-sm text-slate-600">No target set for this month yet</div>
                )}
              </div>
            </>
          )}
        </Card>

        <Card id="sv-events" title="Events" action={<GoldLink to="/dashboard/staff/calendar">Calendar</GoldLink>} className="lg:col-span-2 2xl:col-span-1">
          {!mine ? (
            <div className="h-40 animate-pulse rounded-xl bg-slate-100" aria-busy="true" />
          ) : mine.events.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-slate-600"><FiCalendar className="h-4 w-4" aria-hidden="true" /> No upcoming events</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {mine.events.slice(0, 4).map((e) => (
                <li key={e.id} className="flex items-center gap-3 rounded-xl border border-slate-200 p-3">
                  <div className="w-14 shrink-0 rounded-lg bg-amber-50 py-1.5 text-center text-navy-800">
                    <div className="text-[11px] font-bold uppercase">{e._d.toLocaleDateString("en-IN", { weekday: "short" })}</div>
                    <div className="text-xl font-bold leading-tight">{e._d.getDate()}</div>
                    <div className="text-[11px]">{e._d.toLocaleDateString("en-IN", { month: "short" })}</div>
                  </div>
                  <span className="text-sm font-semibold text-slate-900">{e.title}</span>
                </li>
              ))}
            </ul>
          )}
        </Card>
      </div>

      {/* ===== Pending payments to collect ===== */}
      <Card
        id="sv-pending"
        title="Pending payments to collect"
        action={centre?.pending?.length ? <GoldLink to={ACCOUNTS} state={{ tab: "pending" }}>See all {centre.pending.length}</GoldLink> : null}
      >
        {!centre ? (
          <div className="h-32 animate-pulse rounded-xl bg-slate-100" aria-busy="true" />
        ) : centre.pending === null ? (
          <p className="text-sm text-slate-600">Couldn't load pending payments.</p>
        ) : centre.pending.length === 0 ? (
          <p className="flex items-center gap-2 text-sm text-emerald-700"><FiCheck className="h-4 w-4" aria-hidden="true" /> Nothing pending in the centre</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="px-3 py-2 font-semibold">Service</th>
                  <th className="px-3 py-2 font-semibold">Staff</th>
                  <th className="px-3 py-2 font-semibold">Date</th>
                  <th className="px-3 py-2 text-right font-semibold">Total</th>
                  <th className="px-3 py-2 text-right font-semibold">Due</th>
                  <th className="px-3 py-2"><span className="sr-only">Action</span></th>
                </tr>
              </thead>
              <tbody>
                {pendingOldest.map((p) => (
                  <tr key={p.service_entry_id} className="border-t border-slate-100">
                    <td className="px-3 py-3">
                      <div className="font-semibold text-slate-900">{p.service_name || "Service"}{p.subcategory_name ? ` · ${p.subcategory_name}` : ""}</div>
                      <div className="text-xs text-slate-500">{p.customer_name || "Customer"} · ID {p.service_entry_id}</div>
                    </td>
                    <td className="px-3 py-3">{p.staff_name}</td>
                    <td className="px-3 py-3 text-slate-600">{shortDate(p.created_at)}</td>
                    <td className="px-3 py-3 text-right">{rupees(p.total_charges)}</td>
                    <td className="px-3 py-3 text-right font-bold text-amber-700">{rupees(p.pending_amount)}</td>
                    <td className="px-3 py-3 text-right">
                      <Link to={ACCOUNTS} state={{ tab: "pending" }} className="inline-flex min-h-[36px] items-center rounded-lg border border-amber-300 px-3 font-semibold text-navy-800 hover:bg-amber-50">
                        Receive
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-slate-500">Oldest first. The money counts for each staff member, whoever collects it.</p>
          </div>
        )}
      </Card>

      {centre && centre.toApprove === null && centre.pending === null && (
        <p className="flex items-center gap-2 text-sm text-red-700"><FiAlertTriangle className="h-4 w-4" aria-hidden="true" /> Some numbers couldn't load. Try Refresh.</p>
      )}

      <QuickServiceModal open={showQuick} onClose={() => setShowQuick(false)} wallets={centre?.walletList || []} />
    </div>
  );
};

export default SupervisorDashboard;
