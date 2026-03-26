import React, { useState, useEffect } from "react";
import TransactionsSection from "./TransactionsSection";

/**
 * SuperAdmin adapter for TransactionsSection
 * - centreId is mandatory
 * - readOnly enforced
 */
const SuperAdminTransactionsSection = ({ centreId }) => {
    const [data, setData] = useState(null);
    const [transactionsData, setTransactionsData] = useState({
        transactions: [],
        page: 1,
        limit: 50
      });
    const [selectedTransaction, setSelectedTransaction] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [sortBy, setSortBy] = useState('date');
    const [sortOrder, setSortOrder] = useState('desc');
    const [viewMode, setViewMode] = useState('grid');
    const resetFilters = () => {
        setSearchTerm('');
        alert('Filters reset');
      };
    const [dateFilter, setDateFilter] = useState(() => {
        const today = new Date().toISOString().split('T')[0];
        return { fromDate: today, toDate: today };
      });

  if (!centreId) {
    return (
      <div className="bg-white p-6 rounded-lg border text-gray-600">
        Select a centre to view transactions
      </div>
    );
  }

  useEffect(() => {
    if (!centreId) return;

    const controller = new AbortController();
    const signal = controller.signal;

    // ⛔ Clear old data immediately when centre changes
    setTransactionsData({
    transactions: [],
    page: 1,
    limit: 50
    });

    const params = new URLSearchParams({
    sort_by: sortBy,
    sort_order: sortOrder,
    centreId
    });

    if (searchTerm) params.append("search", searchTerm);
    if (dateFilter?.fromDate) params.append("from", dateFilter.fromDate);
    if (dateFilter?.toDate) params.append("to", dateFilter.toDate);

    fetch(
    `http://localhost:5000/api/transaction/transactions?${params.toString()}`,
    {
    headers: {
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    },
    signal
    }
    )
    .then(res => res.json())
    .then(data => {
    // 🧠 Only update if request wasn't aborted
    setTransactionsData(data);
    })
    .catch(err => {
    if (err.name !== "AbortError") {
    console.error("Failed to load transactions", err);
    }
    });

    // 🧹 Cleanup: cancel previous request
    return () => controller.abort();
}, [centreId, searchTerm, sortBy, sortOrder, dateFilter]);

  return (
    <TransactionsSection
      centreId={centreId}
      isSuperAdmin={true}
      readOnly={true}
      data={transactionsData}
      setSelectedTransaction={setSelectedTransaction}
      searchTerm={searchTerm}
      setSearchTerm={setSearchTerm}
      sortBy={sortBy}
      setSortBy={setSortBy}
      sortOrder={sortOrder}
      setSortOrder={setSortOrder}
      viewMode={viewMode}
      setViewMode={setViewMode}
      resetFilters={resetFilters}
      dateFilter={dateFilter}
      setDateFilter={setDateFilter}
    />
  );
};

export default SuperAdminTransactionsSection;