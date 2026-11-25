import React, { useEffect, useState } from "react";
import { FiBook } from "react-icons/fi";
import AccountingSection from "../reports/components/AccountingSection";

/* The supervisor's Accounts page: the same accounting tools the admin has on
   Reports → Accounting (daily summary, cash count, nightly close, ledger,
   reconciliation, bank statements, UPI check), for the supervisor's own
   centre. The server keeps them to that centre. */

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });
const getJson = (path) =>
  fetch(`${import.meta.env.VITE_API_URL}${path}`, { headers: authHeaders() }).then((r) => (r.ok ? r.json() : []));

const SupervisorAccounts = () => {
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
      <div className="mb-6">
        <h1 className="flex items-center text-2xl font-bold text-slate-900">
          <FiBook className="mr-2 h-6 w-6 text-navy-700" aria-hidden="true" />
          Accounts
        </h1>
        <p className="text-sm text-slate-500">Daily close, cash count, ledger, reconciliation, bank statements and UPI check</p>
      </div>
      <AccountingSection
        accountingData={accountingData}
        onUpdateAccounting={handleUpdateAccounting}
        wallets={wallets}
        staff={staff}
      />
    </div>
  );
};

export default SupervisorAccounts;
