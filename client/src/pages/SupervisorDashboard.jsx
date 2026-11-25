import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiAlertTriangle, FiCheckCircle, FiClock, FiCreditCard, FiFileText, FiRefreshCw } from "react-icons/fi";
import StaffDashboard from "./StaffDashboard";
import { todayIST, addDays } from "../utils/dates";

/* Supervisor home: what's waiting in the centre's accounts, then the normal
   staff dashboard below (a supervisor does staff work too).
   Every number here comes from the same server routes the Accounts and
   Expense Approvals pages use, so it is limited to the supervisor's centre. */

const API = import.meta.env.VITE_API_URL;
const ACCOUNTS = "/dashboard/supervisor/accounts";
const EXPENSES = "/dashboard/supervisor/expenses";

const getJson = async (path) => {
  const res = await fetch(`${API}${path}`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
  if (!res.ok) throw new Error(`${path}: ${res.status}`);
  return res.json();
};

const myId = () => {
  try {
    return JSON.parse(atob(localStorage.getItem("token").split(".")[1])).id;
  } catch {
    return null;
  }
};

const rupees = (n) => `₹${Math.round(Number(n) || 0).toLocaleString("en-IN")}`;
const shortDate = (ymd) =>
  new Date(`${ymd}T00:00:00+05:30`).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "Asia/Kolkata" });

const CLOSE_LABEL = { closed: "Closed", incomplete: "Cash counted, checklist not done", not_closed: "Not closed" };

async function loadSummary() {
  const today = todayIST();
  const yesterday = addDays(today, -1);
  const me = Number(myId());

  const [yClose, tClose, expenses, upi, wallets] = await Promise.allSettled([
    getJson(`/api/accounting/closing-status?date=${yesterday}`),
    getJson(`/api/accounting/closing-status?date=${today}`),
    getJson(`/api/expense`),
    getJson(`/api/upi-credits?status=unclaimed&window=7d`),
    getJson(`/api/wallet/my-centre-wallets`),
  ]);
  const val = (r) => (r.status === "fulfilled" ? r.value : null);

  // Open bank lines: the newest statement of each bank wallet
  let bankOpen = null;
  const bankWallets = (val(wallets) || []).filter((w) => w.wallet_type === "bank" && w.status !== "inactive");
  if (bankWallets.length) {
    const lists = await Promise.allSettled(bankWallets.map((w) => getJson(`/api/bankstatements?wallet_id=${w.id}`)));
    bankOpen = lists.reduce((sum, r) => sum + (r.status === "fulfilled" && r.value[0] ? r.value[0].open_debits || 0 : 0), 0);
  }

  const pending = (val(expenses) || []).filter((e) => e.status === "pending");
  const toApprove = pending.filter((e) => Number(e.staff_id) !== me);
  // The expense page opens on the current month; link to the oldest one so older months aren't missed
  const oldest = [...toApprove].sort((a, b) => String(a.expense_date).localeCompare(String(b.expense_date)))[0];

  return {
    yesterday,
    yClose: val(yClose),
    tClose: val(tClose),
    toApprove: val(expenses) ? toApprove.length : null,
    toApproveTotal: toApprove.reduce((s, e) => s + Number(e.amount || 0), 0),
    oldestToApprove: oldest ? { id: oldest.id, date: String(oldest.expense_date).slice(0, 10) } : null,
    ownWaiting: pending.length - toApprove.length,
    upiUnclaimed: val(upi)?.summary ? val(upi).summary.unclaimed : null,
    upiUnclaimedTotal: val(upi)?.summary?.unclaimed_total || 0,
    bankOpen,
    // bankOpen is also null when there are no bank wallets; this tells the two apart
    walletsLoaded: wallets.status === "fulfilled",
  };
}

const TONES = {
  ok: "border-emerald-200 bg-emerald-50/60 text-emerald-700",
  warn: "border-amber-200 bg-amber-50/70 text-amber-700",
  bad: "border-rose-200 bg-rose-50/70 text-rose-700",
  idle: "border-slate-200 bg-white text-slate-600",
};

const Tile = ({ to, state, icon, tone, label, value, sub }) => {
  const TileIcon = icon;
  return (
  <Link
    to={to}
    state={state}
    className={`flex min-h-[112px] flex-col justify-between rounded-2xl border p-4 transition hover:shadow-md ${TONES[tone]}`}
  >
    <span className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wide">
      <TileIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
      {label}
    </span>
    <span className="mt-2 text-lg font-bold text-slate-900 leading-tight">{value}</span>
    {sub && <span className="mt-1 text-xs text-slate-600">{sub}</span>}
  </Link>
  );
};

const AccountsToday = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);

  const refresh = useCallback(() => {
    setLoading(true);
    setFailed(false);
    loadSummary()
      .then(setData)
      .catch((err) => {
        console.error("Supervisor summary failed", err);
        setFailed(true);
      })
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  let tiles = null;
  if (data) {
    const y = data.yClose;
    const yStatus = y?.status || "not_closed";
    const variance = Number(y?.cash_variance || 0);
    const openDiff = Number(y?.open_short || 0) + Number(y?.open_excess || 0);
    const todayClosed = data.tClose?.status === "closed";
    const toMatch = (data.upiUnclaimed || 0) + (data.bankOpen || 0);
    const matchUnknown = data.upiUnclaimed === null && !data.walletsLoaded;

    tiles = [
      {
        to: ACCOUNTS,
        icon: yStatus === "closed" ? FiCheckCircle : FiClock,
        tone: !y ? "idle" : yStatus === "closed" ? (variance !== 0 ? "warn" : "ok") : "bad",
        label: `Close · ${shortDate(data.yesterday)}`,
        value: !y ? "Couldn't load" : CLOSE_LABEL[yStatus],
        sub:
          yStatus === "closed"
            ? `${y.closed_by_name ? `By ${y.closed_by_name}. ` : ""}${variance ? `Cash difference ${rupees(variance)}` : "No cash difference"}`
            : `Today: ${todayClosed ? "closed" : "not closed yet"}`,
      },
      {
        to: ACCOUNTS,
        icon: FiAlertTriangle,
        tone: !y ? "idle" : openDiff > 0 ? "warn" : "ok",
        label: "Wallet differences",
        value: !y ? "Couldn't load" : openDiff > 0 ? `${rupees(openDiff)} open` : "None open",
        sub:
          openDiff > 0
            ? `Short ${rupees(y?.open_short)} · Excess ${rupees(y?.open_excess)}`
            : `${y?.wallets_counted || 0} wallets counted`,
      },
      {
        to: EXPENSES,
        state: data.oldestToApprove ? { openExpenseId: data.oldestToApprove.id } : undefined,
        icon: FiFileText,
        tone: data.toApprove === null ? "idle" : data.toApprove > 0 ? "warn" : "ok",
        label: "Expenses to approve",
        value: data.toApprove === null ? "Couldn't load" : data.toApprove > 0 ? `${data.toApprove} waiting` : "All done",
        sub:
          data.toApprove > 0
            ? `${rupees(data.toApproveTotal)} in total${
                data.oldestToApprove && data.oldestToApprove.date.slice(0, 7) !== todayIST().slice(0, 7)
                  ? ` · oldest from ${shortDate(data.oldestToApprove.date)}`
                  : ""
              }`
            : data.ownWaiting > 0
              ? `${data.ownWaiting} of yours waiting for admin`
              : null,
      },
      {
        to: ACCOUNTS,
        icon: FiCreditCard,
        tone: matchUnknown ? "idle" : toMatch > 0 ? "warn" : "ok",
        label: "Payments to match",
        value: matchUnknown ? "Couldn't load" : toMatch > 0 ? `${toMatch} open` : "All matched",
        sub: [
          data.upiUnclaimed !== null && `UPI (7 days): ${data.upiUnclaimed}${data.upiUnclaimed ? ` · ${rupees(data.upiUnclaimedTotal)}` : ""}`,
          data.bankOpen !== null && `Bank lines: ${data.bankOpen}`,
        ]
          .filter(Boolean)
          .join(" · ") || null,
      },
    ];
  }

  return (
    <section aria-labelledby="sv-accounts-title" className="px-4 pt-4 sm:px-6 sm:pt-6">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h2 id="sv-accounts-title" className="text-lg font-bold text-slate-900">
          Centre accounts
        </h2>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="inline-flex min-h-[40px] items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-50 disabled:opacity-50"
        >
          <FiRefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
          Refresh
        </button>
      </div>
      {failed ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
          Couldn&apos;t load the accounts summary. Try Refresh, or open{" "}
          <Link to={ACCOUNTS} className="font-semibold underline">
            Accounts
          </Link>
          .
        </p>
      ) : !tiles ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-busy="true">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[112px] animate-pulse rounded-2xl border border-slate-200 bg-white" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {tiles.map((t) => (
            <Tile key={t.label} {...t} />
          ))}
        </div>
      )}
    </section>
  );
};

const SupervisorDashboard = () => (
  <div className="bg-slate-50">
    <AccountsToday />
    <StaffDashboard />
  </div>
);

export default SupervisorDashboard;
