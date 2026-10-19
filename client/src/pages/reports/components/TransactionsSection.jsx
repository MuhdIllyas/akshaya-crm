import React, { useState, useEffect } from "react";
import {
  FiDatabase,
  FiGrid,
  FiList,
  FiUser,
  FiCalendar,
  FiDollarSign,
  FiCreditCard,
  FiSearch,
  FiRefreshCw,
  FiTrendingUp,
  FiTrendingDown, 
  FiSmartphone,
  FiFileText,
  FiCheckCircle,
  FiAlertCircle,
  FiXCircle,
  FiFilter,
  FiDownload,
  FiChevronRight,
  FiEye,
  FiUsers,
  FiBriefcase,
  FiHome,
  FiBook,
  FiClock,
  FiMessageSquare,
  FiPlus,
  FiMinus,
  FiInfo,
  FiTag // Added for category icon
} from "react-icons/fi";
import { motion, AnimatePresence } from "framer-motion";
import { istDayStart, addDays } from "@/utils/dates";

/* =========================
   Shared style tokens (UI only)
========================= */
const fieldCls =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500';
const cardCls = 'rounded-2xl border border-slate-200 bg-white shadow-sm';
const thCls = 'px-3 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500';

/* =========================
   Transaction Stats Card
========================= */
const TransactionStatCard = ({ title, value, icon: Icon, color, subtitle, trend }) => (
  <motion.div
    whileHover={{ y: -2 }}
    className={`${cardCls} p-4 transition-shadow hover:shadow-md`}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="mb-1 text-xs font-medium text-slate-500">{title}</p>
        <p className="mb-1 truncate text-xl font-bold text-slate-900">{value}</p>
        <div className="flex items-center">
          <p className="text-xs text-slate-500">{subtitle}</p>
          {trend && (
            <span className={`ml-2 flex items-center text-xs font-medium ${trend > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {trend > 0 ? <FiTrendingUp className="mr-1 h-2 w-2" /> : <FiTrendingDown className="mr-1 h-2 w-2" />}
              {Math.abs(trend)}%
            </span>
          )}
        </div>
      </div>
      <div className={`shrink-0 rounded-xl ${color} p-2.5`}>
        <Icon className="h-4 w-4 text-white" />
      </div>
    </div>
  </motion.div>
);

/* =========================
   Main Transactions Section - Redesigned
========================= */
const TransactionsSection = ({
  data,
  setSelectedTransaction,
  searchTerm,
  setSearchTerm,
  sortBy,
  setSortBy,
  sortOrder,
  setSortOrder,
  viewMode,
  setViewMode,
  resetFilters,
  staffList = [], // Add staff list prop
  dateFilter = { fromDate: '', toDate: '' }, // Add date filter prop with default
  setDateFilter, // Add set date filter prop
  // 🆕 NEW PROPS FOR PAGINATION
  currentPage = 1,
  totalPages = 1,
  onPageChange

}) => {
  const transactions = data?.transactions || [];
  const [expandedRow, setExpandedRow] = useState(null);
  const [activeFilters, setActiveFilters] = useState({
    status: '',
    paymentMethod: '',
    transactionType: '',
    staffId: '',
    dateRange: 'today'
  });

  // Calculate metrics
  const totalTransactions = transactions.length;
  const totalAmount = transactions.reduce((sum, tx) => sum + (tx.amount || 0), 0);
  
  // Status breakdown
  const statusBreakdown = transactions.reduce((acc, tx) => {
    const status = tx.status || 'Unknown';
    if (!acc[status]) acc[status] = { count: 0, amount: 0 };
    acc[status].count += 1;
    acc[status].amount += tx.amount || 0;
    return acc;
  }, {});

  // Category breakdown
  const categoryBreakdown = transactions.reduce((acc, tx) => {
    const category = tx.category || 'Other';
    if (!acc[category]) acc[category] = { count: 0, amount: 0 };
    acc[category].count += 1;
    acc[category].amount += tx.amount || 0;
    return acc;
  }, {});

  // Sort categories by amount (highest first)
  const sortedCategories = Object.entries(categoryBreakdown)
    .sort(([, a], [, b]) => b.amount - a.amount);

  // Staff breakdown (with staff name)
  const staffBreakdown = transactions.reduce((acc, tx) => {
    const staffName = tx.staffName || 'Unknown';
    if (!acc[staffName]) acc[staffName] = { 
      name: staffName, 
      count: 0, 
      amount: 0,
      transactions: [] 
    };
    acc[staffName].count += 1;
    acc[staffName].amount += tx.amount || 0;
    acc[staffName].transactions.push(tx);
    return acc;
  }, {});

  // Top staff by transaction count
  const topStaff = Object.values(staffBreakdown)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Toggle row expansion
  const toggleRow = (transactionId) => {
    setExpandedRow(prev => prev === transactionId ? null : transactionId);
  };

  // Filter transactions based on active filters and date filter
  const filteredTransactions = transactions.filter(tx => {
    if (activeFilters.status && tx.status !== activeFilters.status) return false;
    if (activeFilters.paymentMethod && tx.paymentMethod !== activeFilters.paymentMethod) return false;
    if (activeFilters.transactionType && tx.category !== activeFilters.transactionType) return false;
    if (activeFilters.staffId && tx.staffName !== activeFilters.staffId) return false;
    
    // IST day bounds (new Date("2026-10-20") is 05:30 IST, which hid early-morning entries)
    if (dateFilter?.fromDate && tx.date) {
      if (new Date(tx.date) < istDayStart(dateFilter.fromDate)) return false;
     }
       
    if (dateFilter?.toDate && tx.date) {
      if (new Date(tx.date) >= istDayStart(addDays(dateFilter.toDate, 1))) return false;
    }
    
    if (searchTerm) {
      const searchLower = searchTerm.toLowerCase();
      return (
        (tx.description?.toLowerCase().includes(searchLower)) ||
        (tx.customerName?.toLowerCase().includes(searchLower)) ||
        (tx.staffName?.toLowerCase().includes(searchLower)) ||
        (tx.category?.toLowerCase().includes(searchLower))
      );
    }
    return true;
  });

  // Sort transactions
  const sortedTransactions = [...filteredTransactions].sort((a, b) => {
    if (sortBy === 'date') {
      return sortOrder === 'asc' 
        ? new Date(a.date) - new Date(b.date)
        : new Date(b.date) - new Date(a.date);
    }
    if (sortBy === 'amount') {
      return sortOrder === 'asc' ? a.amount - b.amount : b.amount - a.amount;
    }
    if (sortBy === 'status') {
      return sortOrder === 'asc' 
        ? (a.status || '').localeCompare(b.status || '')
        : (b.status || '').localeCompare(a.status || '');
    }
    return 0;
  });

  const handleFilterChange = (filterName, value) => {
    setActiveFilters(prev => ({
      ...prev,
      [filterName]: value
    }));
  };

  const handleResetFilters = () => {
    setActiveFilters({
      status: '',
      paymentMethod: '',
      transactionType: '',
      staffId: '',
      dateRange: 'today'
    });
    setSearchTerm('');
    // Reset date filter if setDateFilter is provided
    if (setDateFilter) {
      setDateFilter({ fromDate: '', toDate: '' });
    }
    resetFilters();
  };

  // Handle date filter change
  const handleDateFilterChange = (type, value) => {
    if (setDateFilter) {
      setDateFilter(prev => ({
        ...prev,
        [type]: value
      }));
    }
  };

  // Get status color
  const getStatusColor = (status) => {
    switch(status?.toLowerCase()) {
      case 'completed': return 'bg-emerald-100 text-emerald-700';
      case 'pending': return 'bg-yellow-100 text-yellow-700';
      case 'failed': return 'bg-rose-100 text-rose-700';
      default: return 'bg-gray-100 text-gray-700';
    }
  };

  // Get category color and icon
  const getCategoryColor = (category) => {
    const cat = category?.toLowerCase() || '';
    if (cat.includes('service') || cat.includes('payment')) return 'bg-blue-100 text-blue-600';
    if (cat.includes('transfer')) return 'bg-purple-100 text-purple-600';
    if (cat.includes('expense')) return 'bg-rose-100 text-rose-600';
    if (cat.includes('salary') || cat.includes('department')) return 'bg-amber-100 text-amber-600';
    if (cat.includes('deposit')) return 'bg-emerald-100 text-emerald-600';
    if (cat.includes('withdrawal')) return 'bg-orange-100 text-orange-600';
    return 'bg-gray-100 text-gray-600';
  };

  // Get category icon
  const getCategoryIcon = (category) => {
    const cat = category?.toLowerCase() || '';
    if (cat.includes('service') || cat.includes('payment')) return FiCreditCard;
    if (cat.includes('transfer')) return FiTrendingUp;
    if (cat.includes('expense')) return FiMinus;
    if (cat.includes('salary')) return FiUsers;
    if (cat.includes('department')) return FiBriefcase;
    if (cat.includes('deposit')) return FiPlus;
    return FiTag;
  };

  // UI helpers for the expanded row (same data and toggle as before)
  const renderDetails = (transaction) => (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-3 flex items-center justify-between">
        <h4 className="text-xs font-bold text-slate-900">Transaction Details</h4>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">ID:</span>
          <span className="font-mono text-xs text-slate-700">{transaction.id}</span>
        </div>
      </div>

      <div className="mb-3 grid grid-cols-2 gap-3">
        <div>
          <p className="mb-1 text-xs text-slate-500">Transaction Type</p>
          <p className="text-xs font-medium text-slate-900">
            {transaction.transactionType === 'credit' ? 'Credit (Incoming)' : 'Debit (Outgoing)'}
          </p>
        </div>
        <div>
          <p className="mb-1 text-xs text-slate-500">Payment Method</p>
          <div className="flex items-center">
            <div className="mr-2 rounded bg-slate-100 p-1">
              <FiCreditCard className="h-3 w-3 text-slate-600" />
            </div>
            <p className="text-xs font-medium text-slate-900">{transaction.paymentMethod || '—'}</p>
          </div>
        </div>
        {transaction.walletId && (
          <div>
            <p className="mb-1 text-xs text-slate-500">Wallet</p>
            <p className="text-xs font-medium text-slate-900">{transaction.walletName || transaction.walletId}</p>
          </div>
        )}
        <div>
          <p className="mb-1 text-xs text-slate-500">Category</p>
          <p className="text-xs font-medium text-slate-900">{transaction.category || '—'}</p>
        </div>
      </div>

      {/* Staff and Customer Info */}
      {(transaction.staffName || transaction.customerName) && (
        <div className="border-t border-slate-200 pt-3">
          <h5 className="mb-2 text-xs font-semibold text-slate-700">Involved Parties</h5>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {transaction.staffName && (
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100">
                  <FiBriefcase className="h-3 w-3 text-emerald-600" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-900">Staff</p>
                  <p className="text-xs text-slate-700">{transaction.staffName}</p>
                </div>
              </div>
            )}
            {transaction.customerName && (
              <div className="flex items-center gap-2">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100">
                  <FiUser className="h-3 w-3 text-navy-700" />
                </div>
                <div>
                  <p className="text-xs font-medium text-slate-900">Customer</p>
                  <p className="text-xs text-slate-700">{transaction.customerName}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Description */}
      {transaction.description && (
        <div className="mt-3 border-t border-slate-200 pt-3">
          <h5 className="mb-2 text-xs font-semibold text-slate-700">Description</h5>
          <p className="text-xs text-slate-700">{transaction.description}</p>
        </div>
      )}
    </div>
  );

  const renderRowActions = (transaction, isExpanded) => (
    <div className="flex items-center gap-1">
      <button
        onClick={() => toggleRow(transaction.id)}
        className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700"
        title="View details"
        aria-label={isExpanded ? 'Collapse details' : 'Expand details'}
        aria-expanded={isExpanded}
      >
        {isExpanded ? (
          <FiMinus className="h-4 w-4" />
        ) : (
          <FiPlus className="h-4 w-4" />
        )}
      </button>
      <button
        onClick={() => setSelectedTransaction(transaction)}
        className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-navy-700"
        title="View full details"
        aria-label="View full details"
      >
        <FiEye className="h-4 w-4" />
      </button>
    </div>
  );

  const statusBadge = (transaction) => (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getStatusColor(transaction.status)}`}>
      {transaction.status === 'Completed' && <FiCheckCircle className="mr-1 h-2.5 w-2.5" />}
      {transaction.status === 'Pending' && <FiClock className="mr-1 h-2.5 w-2.5" />}
      {transaction.status === 'Failed' && <FiXCircle className="mr-1 h-2.5 w-2.5" />}
      {transaction.status || '—'}
    </span>
  );

  return (
    <div className="space-y-4">
      {/* Search and Filter Bar */}
      <div className={`${cardCls} grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 lg:grid-cols-4 2xl:grid-cols-8`}>
        <div className="sm:col-span-2">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search transactions, customer, staff..."
              aria-label="Search transactions"
              className={`${fieldCls} pl-10`}
            />
          </div>
        </div>
        
        {/* Date From Filter */}
        <div className="relative">
          <FiCalendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="date"
            value={dateFilter?.fromDate || ''}
            onChange={(e) => handleDateFilterChange('fromDate', e.target.value)}
            aria-label="From date"
            className={`${fieldCls} pl-10`}
            placeholder="From Date"
          />
        </div>
        
        {/* Date To Filter */}
        <div className="relative">
          <FiCalendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="date"
            value={dateFilter?.toDate || ''}
            onChange={(e) => handleDateFilterChange('toDate', e.target.value)}
            aria-label="To date"
            className={`${fieldCls} pl-10`}
            placeholder="To Date"
          />
        </div>

        <select
          value={activeFilters.status}
          onChange={(e) => handleFilterChange('status', e.target.value)}
          aria-label="Status filter"
          className={fieldCls}
        >
          <option value="">All Status</option>
          <option value="Completed">Completed</option>
          <option value="Pending">Pending</option>
          <option value="Failed">Failed</option>
        </select>

        <select
          value={activeFilters.paymentMethod}
          onChange={(e) => handleFilterChange('paymentMethod', e.target.value)}
          aria-label="Payment method filter"
          className={fieldCls}
        >
          <option value="">All Payment Methods</option>
          <option value="Cash">Cash</option>
          <option value="Credit Card">Credit Card</option>
          <option value="Bank Transfer">Bank Transfer</option>
          <option value="UPI">UPI</option>
          <option value="Digital Wallet">Digital Wallet</option>
        </select>

        <select
          value={activeFilters.staffId}
          onChange={(e) => handleFilterChange('staffId', e.target.value)}
          aria-label="Staff filter"
          className={fieldCls}
        >
          <option value="">All Staff</option>
          {staffList.map(staff => (
            <option key={staff.id} value={staff.name}>{staff.name}</option>
          ))}
          {Object.keys(staffBreakdown).map(staffName => (
            <option key={staffName} value={staffName}>{staffName}</option>
          ))}
        </select>

        <div className="flex gap-2">
          <button
            onClick={handleResetFilters}
            className="flex flex-1 items-center justify-center gap-1 rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
          >
            <FiRefreshCw className="h-4 w-4" />
            Reset
          </button>
          <button className="flex flex-1 items-center justify-center gap-1 rounded-xl bg-navy-700 px-3 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-navy-800">
            <FiDownload className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Two-Column Layout (table first on small screens) */}
      <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
        {/* Left Column - Metrics */}
        <div className="order-2 space-y-4 xl:order-1 xl:col-span-1">
          {/* Total Transactions Card */}
          <div className={`${cardCls} p-4`}>
            <div className="mb-3 flex items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-slate-100 p-2">
                  <FiDatabase className="h-4 w-4 text-navy-700" />
                </div>
                <div>
                  <p className="text-xs text-slate-500">Total Transactions</p>
                  <p className="text-lg font-bold text-slate-900">{totalTransactions}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-1 text-xs font-semibold text-navy-700">
                  ₹{totalAmount.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              {Object.entries(statusBreakdown).map(([status, data]) => (
                <div key={status} className="flex items-center justify-between text-xs">
                  <span className="text-slate-600">{status}</span>
                  <span className="font-medium text-slate-900">
                    {data.count} (₹{data.amount.toLocaleString()})
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Category Breakdown */}
          <div className={`${cardCls} p-4`}>
            <h3 className="mb-3 flex items-center text-sm font-bold text-slate-900">
              <FiTag className="mr-2 h-4 w-4 text-purple-600" />
              Category Breakdown
            </h3>
            <div className="space-y-1">
              {sortedCategories.map(([category, data]) => {
                const CategoryIcon = getCategoryIcon(category);
                const colorClass = getCategoryColor(category);
                
                return (
                  <div key={category} className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-slate-50">
                    <div className="flex items-center gap-2">
                      <div className={`rounded-lg p-1.5 ${colorClass}`}>
                        <CategoryIcon className="h-3 w-3" />
                      </div>
                      <div className="max-w-[140px]">
                        <p className="truncate text-xs font-medium text-slate-700">{category}</p>
                        <p className="text-xs text-slate-500">{data.count} transactions</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-slate-900">₹{data.amount.toLocaleString()}</p>
                      <p className="text-xs text-slate-500">
                        Avg: ₹{data.count > 0 ? (data.amount / data.count).toFixed(0) : 0}
                      </p>
                    </div>
                  </div>
                );
              })}
              
              {sortedCategories.length === 0 && (
                <div className="py-3 text-center">
                  <p className="text-xs text-slate-500">No categories found</p>
                </div>
              )}
            </div>
          </div>

          {/* Top Staff */}
          <div className={`${cardCls} p-4`}>
            <h3 className="mb-3 flex items-center text-sm font-bold text-slate-900">
              <FiUsers className="mr-2 h-4 w-4 text-amber-600" />
              Top Staff by Transactions
            </h3>
            <div className="space-y-1">
              {topStaff.map((staff, index) => (
                <div key={staff.name} className="flex items-center justify-between rounded-lg p-2 transition-colors hover:bg-slate-50">
                  <div className="flex items-center gap-2">
                    <div className={`flex h-7 w-7 items-center justify-center rounded-full text-xs font-bold ${
                      index === 0 ? 'bg-amber-100 text-amber-600' :
                      index === 1 ? 'bg-emerald-100 text-emerald-600' :
                      index === 2 ? 'bg-blue-100 text-blue-600' :
                      'bg-slate-100 text-slate-600'
                    }`}>
                      {staff.name.charAt(0)}
                    </div>
                    <div>
                      <p className="max-w-[110px] truncate text-xs font-medium text-slate-900">{staff.name}</p>
                      <p className="text-xs text-slate-500">{staff.count} transactions</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-slate-900">₹{staff.amount.toLocaleString()}</p>
                    <p className="text-xs text-slate-500">Avg: ₹{staff.count > 0 ? (staff.amount / staff.count).toFixed(0) : 0}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className={`${cardCls} p-4`}>
            <h3 className="mb-3 flex items-center text-sm font-bold text-slate-900">
              <FiFilter className="mr-2 h-4 w-4 text-blue-600" />
              Quick Actions
            </h3>
            <div className="space-y-1">
              <button className="flex w-full items-center justify-between rounded-lg p-2 transition-colors hover:bg-blue-50">
                <div className="flex items-center gap-2">
                  <FiEye className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-medium text-slate-900">View All Pending</span>
                </div>
                <FiChevronRight className="h-3 w-3 text-slate-400" />
              </button>
              <button className="flex w-full items-center justify-between rounded-lg p-2 transition-colors hover:bg-emerald-50">
                <div className="flex items-center gap-2">
                  <FiCheckCircle className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-medium text-slate-900">Today's Completed</span>
                </div>
                <FiChevronRight className="h-3 w-3 text-slate-400" />
              </button>
              <button className="flex w-full items-center justify-between rounded-lg p-2 transition-colors hover:bg-rose-50">
                <div className="flex items-center gap-2">
                  <FiAlertCircle className="h-4 w-4 text-rose-600" />
                  <span className="text-xs font-medium text-slate-900">Failed Transactions</span>
                </div>
                <FiChevronRight className="h-3 w-3 text-slate-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column - Transaction Table */}
        <div className="order-1 min-w-0 xl:order-2 xl:col-span-2">
          <div className={`${cardCls} overflow-hidden`}>
            <div className="border-b border-slate-200 bg-slate-50/60 p-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h3 className="flex items-center text-sm font-bold text-slate-900">
                  <FiFileText className="mr-2 h-4 w-4 text-slate-500" />
                  Transaction History
                </h3>
                <div className="flex flex-wrap items-center gap-3">
                  <span className="text-xs text-slate-600">
                    {filteredTransactions.length} of {totalTransactions} transactions
                  </span>
                  <div className="flex items-center gap-2">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      aria-label="Sort by"
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs focus:outline-none focus:ring-2 focus:ring-navy-500/30"
                    >
                      <option value="date">Date</option>
                      <option value="amount">Amount</option>
                      <option value="status">Status</option>
                    </select>
                    <button
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                      className="rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs transition-colors hover:bg-slate-100"
                    >
                      {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* Mobile cards */}
            <div className="max-h-[600px] divide-y divide-slate-100 overflow-y-auto md:hidden">
              {sortedTransactions.length === 0 && (
                <div className="flex flex-col items-center justify-center py-8 text-xs text-slate-500">
                  <FiSearch className="mb-2 h-8 w-8 text-slate-300" />
                  No transactions found matching your filters
                </div>
              )}
              {sortedTransactions.map((transaction) => {
                const isExpanded = expandedRow === transaction.id;
                return (
                  <div key={transaction.id} className={`p-4 ${isExpanded ? 'bg-slate-50' : ''}`}>
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <p className="truncate text-sm font-medium text-slate-900">{transaction.description || 'Transaction'}</p>
                        <p className="text-xs text-slate-500">{transaction.date || '—'} · {transaction.time || '—'}</p>
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={`text-sm font-bold ${transaction.transactionType === 'debit' ? 'text-rose-600' : 'text-emerald-600'}`}>
                          {transaction.transactionType === 'debit' ? '-' : '+'}₹{transaction.amount?.toLocaleString() || '0'}
                        </p>
                        <p className="text-xs text-slate-500">{transaction.paymentMethod || '—'}</p>
                      </div>
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-2">
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getCategoryColor(transaction.category)}`}>
                        {transaction.category || '—'}
                      </span>
                      {statusBadge(transaction)}
                    </div>
                    <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                      <span className="truncate">{transaction.staffName || '—'}{transaction.customerName ? ` · ${transaction.customerName}` : ''}</span>
                      {renderRowActions(transaction, isExpanded)}
                    </div>
                    {isExpanded && <div className="mt-3">{renderDetails(transaction)}</div>}
                  </div>
                );
              })}
            </div>
            
            {/* Desktop table */}
            <div className="hidden max-h-[500px] overflow-auto md:block">
              <table className="w-full min-w-[860px]">
                <thead className="sticky top-0 z-10 border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className={thCls}>Date & Time</th>
                    <th className={thCls}>Description</th>
                    <th className={thCls}>Staff</th>
                    <th className={thCls}>Customer</th>
                    <th className={thCls}>Category</th>
                    <th className={thCls}>Amount</th>
                    <th className={thCls}>Status</th>
                    <th className={thCls}></th>
                  </tr>
                </thead>

                <tbody>
                  {sortedTransactions.length === 0 && (
                    <tr>
                      <td colSpan="8" className="py-8 text-center text-xs text-slate-500">
                        <div className="flex flex-col items-center justify-center">
                          <FiSearch className="mb-2 h-8 w-8 text-slate-300" />
                          No transactions found matching your filters
                        </div>
                      </td>
                    </tr>
                  )}

                  {sortedTransactions.map((transaction) => {
                    const isExpanded = expandedRow === transaction.id;
                    
                    return (
                      <React.Fragment key={transaction.id}>
                        <tr
                          className={`border-b border-slate-100 transition-colors hover:bg-slate-50 ${isExpanded ? 'bg-slate-50' : ''}`}
                        >
                          <td className="px-3 py-3">
                            <div className="flex flex-col">
                              <span className="whitespace-nowrap text-xs font-medium text-slate-900">
                                {transaction.date || '—'}
                              </span>
                              <span className="text-xs text-slate-500">
                                {transaction.time || '—'}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center">
                              <div className="mr-2 rounded bg-slate-100 p-1">
                                <FiFileText className="h-3 w-3 text-slate-600" />
                              </div>
                              <span className="max-w-[150px] truncate text-xs text-slate-900">
                                {transaction.description || 'Transaction'}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            {transaction.staffName ? (
                              <div className="flex items-center">
                                <div className="mr-2 flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100">
                                  <FiBriefcase className="h-3 w-3 text-emerald-600" />
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-xs font-medium text-slate-900">
                                    {transaction.staffName}
                                  </span>
                                  <span className="text-xs text-slate-500">
                                    Staff
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            {transaction.customerName ? (
                              <div className="flex items-center">
                                <div className="mr-2 flex h-6 w-6 items-center justify-center rounded-full bg-slate-100">
                                  <FiUser className="h-3 w-3 text-navy-700" />
                                </div>
                                <div className="flex flex-col">
                                  <span className="max-w-[120px] truncate text-xs font-medium text-slate-900">
                                    {transaction.customerName}
                                  </span>
                                  <span className="text-xs text-slate-500">
                                    Customer
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-slate-500">—</span>
                            )}
                          </td>
                          <td className="px-3 py-3">
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${getCategoryColor(transaction.category)}`}>
                              {transaction.category || '—'}
                            </span>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-col">
                              <span className={`text-xs font-bold ${
                                transaction.transactionType === 'debit' ? 'text-rose-600' : 'text-emerald-600'
                              }`}>
                                {transaction.transactionType === 'debit' ? '-' : '+'}₹{transaction.amount?.toLocaleString() || '0'}
                              </span>
                              <span className="text-xs text-slate-500">
                                {transaction.paymentMethod || '—'}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            {statusBadge(transaction)}
                          </td>
                          <td className="px-3 py-3">
                            {renderRowActions(transaction, isExpanded)}
                          </td>
                        </tr>
                        
                        {isExpanded && (
                          <tr className="bg-slate-50">
                            <td colSpan="8" className="px-3 py-3">
                              {renderDetails(transaction)}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Summary Footer */}
            {sortedTransactions.length > 0 && (
              <div className="border-t border-slate-200 bg-slate-50 p-3">
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <div>
                      <span className="text-slate-600">Showing:</span>
                      <span className="ml-1 font-bold text-slate-900">
                        {sortedTransactions.length} items on this page
                      </span>
                    </div>
                    <div>
                      <span className="text-slate-600">Page Total:</span>
                      <span className="ml-1 font-bold text-emerald-600">
                        ₹{totalAmount.toLocaleString()}
                      </span>
                    </div>
                  </div>
                  
                  {/* Pagination controls */}
                  {onPageChange && (
                    <div className="flex items-center gap-3">
                      <button
                        onClick={() => onPageChange(currentPage - 1)}
                        disabled={currentPage <= 1}
                        className={`flex items-center rounded-lg border px-3 py-1.5 transition-colors ${
                          currentPage <= 1 
                            ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400' 
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-navy-700'
                        }`}
                      >
                        Previous
                      </button>
                      
                      <span className="font-medium text-slate-600">
                        Page {currentPage} of {totalPages}
                      </span>
                      
                      <button
                        onClick={() => onPageChange(currentPage + 1)}
                        disabled={currentPage >= totalPages}
                        className={`flex items-center rounded-lg border px-3 py-1.5 transition-colors ${
                          currentPage >= totalPages 
                            ? 'cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400' 
                            : 'border-slate-300 bg-white text-slate-700 hover:bg-slate-100 hover:text-navy-700'
                        }`}
                      >
                        Next
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default TransactionsSection;