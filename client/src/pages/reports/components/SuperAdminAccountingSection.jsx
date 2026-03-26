import React, { useState, useEffect } from "react";
import AccountingSection from "./AccountingSection";

const SuperAdminAccountingSection = ({ centreId }) => {
  const [accountingData, setAccountingData] = useState({
    dailySummary: {},
    income: [],
    ledger: { rows: [] },
    expenses: [],
    wallets: [],
    nightlyAccounting: {},
    walletReconciliations: []
  });

  const [wallets, setWallets] = useState([]);
  const [staff, setStaff] = useState([]);

  const handleUpdateAccounting = (type, updatedData) => {
    setAccountingData(prev => ({
      ...prev,
      [type]: updatedData
    }));
  };

  // load staff (centre-aware)
  useEffect(() => {
    fetch(`http://localhost:5000/api/staff/all?centreId=${centreId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
    })
      .then(res => res.json())
      .then(setStaff);
  }, [centreId]);

  // load wallets (centre-aware)
  useEffect(() => {
    fetch(`http://localhost:5000/api/wallet/my-centre-wallets?centreId=${centreId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
    })
      .then(res => res.json())
      .then(setWallets);
  }, [centreId]);

  return (
    <AccountingSection
      centreId={centreId}
      accountingData={accountingData}
      onUpdateAccounting={handleUpdateAccounting}
      wallets={wallets}
      staff={staff}
      readOnly
      isSuperAdmin
    />
  );
};

export default SuperAdminAccountingSection;