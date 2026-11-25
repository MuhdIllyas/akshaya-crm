import React, { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FiAlertTriangle, FiCheck, FiClock, FiCreditCard, FiFileText, FiRefreshCw } from "react-icons/fi";
import StaffDashboard from "./StaffDashboard";
import { todayIST, addDays } from "../utils/dates";

/* Supervisor home: the normal staff dashboard (a supervisor does staff work
   too) with the centre's accounts shown as chips inside its welcome banner.
   Every number comes from the same server routes the Accounts and Expense
   Approvals pages use, so it is limited to the supervisor's centre. */

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

async function loadSummary() {
  const today = todayIST();
  const yesterday = addDays(today, -1);
  const me = Number(myId());

  const [yClose, expenses, upi, wallets] = await Promise.allSettled([
    getJson(`/api/accounting/closing-status?date=${yesterday}`),
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
    toApprove: val(expenses) ? toApprove.length : null,
    toApproveTotal: toApprove.reduce((s, e) => s + Number(e.amount || 0), 0),
    oldestToApprove: oldest ? { id: oldest.id, date: String(oldest.expense_date).slice(0, 10) } : null,
    upiUnclaimed: val(upi)?.summary ? val(upi).summary.unclaimed : null,
    bankOpen,
    // bankOpen is also null when there are no bank wallets; this tells the two apart
    walletsLoaded: wallets.status === "fulfilled",
  };
}

// Light chips on the navy banner. "unknown" = that number couldn't be loaded.
const TONES = {
  bad: "bg-red-50 text-red-800 hover:bg-red-100",
  warn: "bg-amber-50 text-amber-800 hover:bg-amber-100",
  ok: "bg-emerald-50 text-emerald-800 hover:bg-emerald-100",
  unknown: "bg-white/15 text-white hover:bg-white/25",
};
const TONE_ORDER = { bad: 0, warn: 1, unknown: 2, ok: 3 };

function buildChips(d) {
  const chips = [];
  const day = shortDate(d.yesterday);

  // Yesterday's close
  const y = d.yClose;
  if (!y) chips.push({ key: "close", to: ACCOUNTS, icon: FiClock, tone: "unknown", text: `${day} close: couldn't load` });
  else if (y.status === "closed") {
    const diff = Number(y.cash_variance || 0);
    chips.push({
      key: "close", to: ACCOUNTS, icon: diff ? FiAlertTriangle : FiCheck, tone: diff ? "warn" : "ok",
      text: diff ? `${day} closed · cash off by ${rupees(Math.abs(diff))}` : `${day} closed`,
    });
  } else {
    chips.push({
      key: "close", to: ACCOUNTS, icon: FiClock, tone: "bad",
      text: y.status === "incomplete" ? `${day} checklist not done` : `${day} not closed`,
    });
  }

  // Wallet differences still to settle
  if (y) {
    const open = Number(y.open_short || 0) + Number(y.open_excess || 0);
    chips.push(
      open > 0
        ? { key: "diff", to: ACCOUNTS, icon: FiAlertTriangle, tone: "warn", text: `${rupees(open)} wallet differences` }
        : { key: "diff", to: ACCOUNTS, icon: FiCheck, tone: "ok", text: "No wallet differences" }
    );
  }

  // Expenses waiting for this supervisor
  if (d.toApprove === null) chips.push({ key: "exp", to: EXPENSES, icon: FiFileText, tone: "unknown", text: "Expenses: couldn't load" });
  else if (d.toApprove > 0) {
    const old = d.oldestToApprove && d.oldestToApprove.date.slice(0, 7) !== todayIST().slice(0, 7);
    chips.push({
      key: "exp", to: EXPENSES, icon: FiFileText, tone: "warn",
      state: d.oldestToApprove ? { openExpenseId: d.oldestToApprove.id } : undefined,
      text: `${d.toApprove} expense${d.toApprove > 1 ? "s" : ""} · ${rupees(d.toApproveTotal)}${old ? ` · since ${shortDate(d.oldestToApprove.date)}` : ""}`,
    });
  } else chips.push({ key: "exp", to: EXPENSES, icon: FiCheck, tone: "ok", text: "No expenses to approve" });

  // Payments to match (UPI from the last 7 days + open bank lines)
  if (d.upiUnclaimed === null && !d.walletsLoaded) {
    chips.push({ key: "match", to: ACCOUNTS, icon: FiCreditCard, tone: "unknown", text: "Payments: couldn't load" });
  } else {
    const open = (d.upiUnclaimed || 0) + (d.bankOpen || 0);
    chips.push(
      open > 0
        ? { key: "match", to: ACCOUNTS, icon: FiCreditCard, tone: "warn", text: `${open} payment${open > 1 ? "s" : ""} to match` }
        : { key: "match", to: ACCOUNTS, icon: FiCheck, tone: "ok", text: "All payments matched" }
    );
  }

  // Things to do first, the all-clear ones last
  return chips.sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone]);
}

const AccountsChips = () => {
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

  const chips = data ? buildChips(data) : [];

  return (
    <section aria-labelledby="sv-accounts-title" className="mb-5 border-t border-white/15 pt-4">
      <div className="mb-2 flex items-center gap-2">
        <h3 id="sv-accounts-title" className="text-xs font-semibold uppercase tracking-wider text-white/70">
          Centre accounts
        </h3>
        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          aria-label="Refresh centre accounts"
          className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-white/70 hover:bg-white/15 hover:text-white disabled:opacity-50"
        >
          <FiRefreshCw className={`h-3.5 w-3.5 ${loading ? "animate-spin" : ""}`} aria-hidden="true" />
        </button>
      </div>
      {failed ? (
        <p className="text-sm text-white/90">
          Couldn&apos;t load the accounts.{" "}
          <Link to={ACCOUNTS} className="font-semibold underline">
            Open Accounts
          </Link>
        </p>
      ) : !data ? (
        <div className="flex flex-wrap gap-2" aria-busy="true">
          {[150, 170, 140, 160].map((w) => (
            <span key={w} className="h-9 animate-pulse rounded-full bg-white/15" style={{ width: w }} />
          ))}
        </div>
      ) : (
        <ul className="flex flex-wrap gap-2">
          {chips.map((c) => {
            const ChipIcon = c.icon;
            return (
              <li key={c.key}>
                <Link
                  to={c.to}
                  state={c.state}
                  className={`inline-flex min-h-[36px] items-center gap-2 rounded-full px-3.5 py-1.5 text-sm font-semibold transition ${TONES[c.tone]}`}
                >
                  <ChipIcon className="h-4 w-4 shrink-0" aria-hidden="true" />
                  {c.text}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
};

const SupervisorDashboard = () => <StaffDashboard bannerSlot={<AccountsChips />} />;

export default SupervisorDashboard;
