import React, { useEffect, useState } from "react";
import { FiBook, FiClock } from "react-icons/fi";
import AccountingSection from "../reports/components/AccountingSection";
import PendingPaymentsSection from "../reports/components/PendingPaymentsSection";

/* The supervisor's Accounts page: the same tools the admin has on
   Reports → Accounting (daily summary, cash count, nightly close, ledger,
   reconciliation, bank statements, UPI check) and Reports → Pending Payments
   (every staff member's unpaid services, collected here for them), for the
   supervisor's own centre. The server keeps them to that centre. */

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });
const getJson = (path) =>
  fetch(`${import.meta.env.VITE_API_URL}${path}`, { headers: authHeaders() }).then((r) => (r.ok ? r.json() : []));

const TABS = [
  { id: "accounting", label: "Accounting", icon: FiBook },
  { id: "pending", label: "Pending payments", icon: FiClock },
];

const SupervisorAccounts = () => {
  const [tab, setTab] = useState("accounting");
  const [wallets, setWallets] = useState([]);
  const [staff, setStaff] = useState([]);
  const [accountingData, setAccountingData] = useState({
    dailySummary: {},
    income: [],
    ledger: { rows: [] },
    expenses: [],
    wallets: [],
    nightlyAccounting: {},
    walletReconciliations: [],
  });

  useEffect(() => {
    getJson("/api/wallet/my-centre-wallets")
      .then((d) => setWallets(Array.isArray(d) ? d : []))
      .catch((err) => console.error("Failed to load wallets", err));
    // Names only (own centre), for the ledger's staff filter
    getJson("/api/wallet/all")
      .then((d) => setStaff(Array.isArray(d) ? d : []))
      .catch((err) => console.error("Failed to load staff", err));
  }, []);

  const handleUpdateAccounting = (type, updatedData) =>
    setAccountingData((prev) => ({ ...prev, [type]: updatedData }));

  return (
    <div className="min-h-screen bg-slate-50 p-4 sm:p-6">
      <div className="mb-4">
        <h1 className="flex items-center text-2xl font-bold text-slate-900">
          <FiBook className="mr-2 h-6 w-6 text-navy-700" aria-hidden="true" />
          Accounts
        </h1>
        <p className="text-sm text-slate-500">Daily close, cash count, ledger, reconciliation, bank statements, UPI check and pending payments</p>
      </div>

      <div className="mb-5 flex gap-2 overflow-x-auto" role="tablist" aria-label="Accounts sections">
        {TABS.map((t) => {
          const TabIcon = t.icon;
          const active = tab === t.id;
          return (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(t.id)}
              className={`inline-flex min-h-[44px] shrink-0 items-center gap-2 rounded-xl px-4 text-sm font-semibold transition ${
                active ? "bg-navy-700 text-white" : "border border-slate-200 bg-white text-slate-600 hover:bg-slate-100"
              }`}
            >
              <TabIcon className="h-4 w-4" aria-hidden="true" />
              {t.label}
            </button>
          );
        })}
      </div>

      {tab === "accounting" && (
        <AccountingSection
          accountingData={accountingData}
          onUpdateAccounting={handleUpdateAccounting}
          wallets={wallets}
          staff={staff}
        />
      )}
      {tab === "pending" && <PendingPaymentsSection />}
    </div>
  );
};

export default SupervisorAccounts;
