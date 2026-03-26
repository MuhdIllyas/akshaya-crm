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

/* =========================
   Transaction Stats Card
========================= */
const TransactionStatCard = ({ title, value, icon: Icon, color, subtitle, trend }) => (
  <motion.div
    whileHover={{ y: -2 }}
    className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-all duration-200 p-3"
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium text-gray-600 mb-1 text-xs">{title}</p>
        <p className="font-bold text-gray-900 mb-1 text-lg">{value}</p>
        <div className="flex items-center">
          <p className="text-gray-500 text-xs">{subtitle}</p>
          {trend && (
            <span className={`ml-2 flex items-center text-xs font-medium ${trend > 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              {trend > 0 ? <FiTrendingUp className="mr-1 h-2 w-2" /> : <FiTrendingDown className="mr-1 h-2 w-2" />}
              {Math.abs(trend)}%
            </span>
          )}
        </div>
      </div>
      <div className={`rounded-lg ${color} p-2`}>
        <Icon className="text-white h-4 w-4" />
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
  setDateFilter // Add set date filter prop
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
    
    // Apply date filter
    if (dateFilter?.fromDate && tx.date) {
      const txDate = new Date(tx.date);
      const fromDate = new Date(dateFilter.fromDate);
      if (txDate < fromDate) return false;
    }
    
    if (dateFilter?.toDate && tx.date) {
      const txDate = new Date(tx.date);
      const toDate = new Date(dateFilter.toDate);
      // Add one day to include the entire toDate
      toDate.setDate(toDate.getDate() + 1);
      if (txDate >= toDate) return false;
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

  return (
    <div className="space-y-4">
      {/* Search and Filter Bar */}
      <div className="grid grid-cols-8 gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
        <div className="col-span-2">
          <div className="relative">
            <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search transactions, customer, staff..."
              className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            />
          </div>
        </div>
        
        {/* Date From Filter */}
        <div className="relative">
          <FiCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="date"
            value={dateFilter?.fromDate || ''}
            onChange={(e) => handleDateFilterChange('fromDate', e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            placeholder="From Date"
          />
        </div>
        
        {/* Date To Filter */}
        <div className="relative">
          <FiCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4" />
          <input
            type="date"
            value={dateFilter?.toDate || ''}
            onChange={(e) => handleDateFilterChange('toDate', e.target.value)}
            className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            placeholder="To Date"
          />
        </div>

        <select
          value={activeFilters.status}
          onChange={(e) => handleFilterChange('status', e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
        >
          <option value="">All Status</option>
          <option value="Completed">Completed</option>
          <option value="Pending">Pending</option>
          <option value="Failed">Failed</option>
        </select>

        <select
          value={activeFilters.paymentMethod}
          onChange={(e) => handleFilterChange('paymentMethod', e.target.value)}
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
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
          className="border border-gray-300 rounded px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
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
            className="flex items-center gap-1 px-3 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 text-sm"
          >
            <FiRefreshCw className="h-4 w-4" />
            Reset
          </button>
          <button className="flex items-center gap-1 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
            <FiDownload className="h-4 w-4" />
            Export
          </button>
        </div>
      </div>

      {/* Two-Column Layout */}
      <div className="grid grid-cols-3 gap-4">
        {/* Left Column - Metrics */}
        <div className="col-span-1 space-y-4">
          {/* Total Transactions Card */}
          <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-2">
                <div className="p-2 bg-indigo-100 rounded-lg">
                  <FiDatabase className="h-4 w-4 text-indigo-600" />
                </div>
                <div>
                  <p className="text-xs text-gray-500">Total Transactions</p>
                  <p className="font-bold text-gray-900 text-lg">{totalTransactions}</p>
                </div>
              </div>
              <div className="text-right">
                <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-indigo-50 text-indigo-700">
                  ₹{totalAmount.toLocaleString()}
                </span>
              </div>
            </div>
            <div className="space-y-2">
              {Object.entries(statusBreakdown).map(([status, data]) => (
                <div key={status} className="flex items-center justify-between text-xs">
                  <span className="text-gray-600">{status}</span>
                  <span className="font-medium text-gray-900">
                    {data.count} (₹{data.amount.toLocaleString()})
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Category Breakdown - REPLACED Payment Methods */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-bold text-gray-900 text-sm mb-3 flex items-center">
              <FiTag className="h-4 w-4 mr-2 text-purple-600" />
              Category Breakdown
            </h3>
            <div className="space-y-2">
              {sortedCategories.map(([category, data]) => {
                const CategoryIcon = getCategoryIcon(category);
                const colorClass = getCategoryColor(category);
                
                return (
                  <div key={category} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                    <div className="flex items-center space-x-2">
                      <div className={`p-1 rounded ${colorClass}`}>
                        <CategoryIcon className="h-3 w-3" />
                      </div>
                      <div className="max-w-[120px]">
                        <p className="text-xs font-medium text-gray-700 truncate">{category}</p>
                        <p className="text-xs text-gray-500">{data.count} transactions</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-xs font-bold text-gray-900">₹{data.amount.toLocaleString()}</p>
                      <p className="text-xs text-gray-500">
                        Avg: ₹{data.count > 0 ? (data.amount / data.count).toFixed(0) : 0}
                      </p>
                    </div>
                  </div>
                );
              })}
              
              {sortedCategories.length === 0 && (
                <div className="text-center py-3">
                  <p className="text-xs text-gray-500">No categories found</p>
                </div>
              )}
            </div>
          </div>

          {/* Top Staff */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-bold text-gray-900 text-sm mb-3 flex items-center">
              <FiUsers className="h-4 w-4 mr-2 text-amber-600" />
              Top Staff by Transactions
            </h3>
            <div className="space-y-2">
              {topStaff.map((staff, index) => (
                <div key={staff.name} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                  <div className="flex items-center space-x-2">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                      index === 0 ? 'bg-amber-100 text-amber-600' :
                      index === 1 ? 'bg-emerald-100 text-emerald-600' :
                      index === 2 ? 'bg-blue-100 text-blue-600' :
                      'bg-gray-100 text-gray-600'
                    }`}>
                      {staff.name.charAt(0)}
                    </div>
                    <div>
                      <p className="text-xs font-medium text-gray-900 truncate max-w-[100px]">{staff.name}</p>
                      <p className="text-xs text-gray-500">{staff.count} transactions</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-xs font-bold text-gray-900">₹{staff.amount.toLocaleString()}</p>
                    <p className="text-xs text-gray-500">Avg: ₹{staff.count > 0 ? (staff.amount / staff.count).toFixed(0) : 0}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-lg border border-gray-200 p-4">
            <h3 className="font-bold text-gray-900 text-sm mb-3 flex items-center">
              <FiFilter className="h-4 w-4 mr-2 text-blue-600" />
              Quick Actions
            </h3>
            <div className="space-y-2">
              <button className="w-full flex items-center justify-between p-2 hover:bg-blue-50 rounded transition-colors">
                <div className="flex items-center space-x-2">
                  <FiEye className="h-4 w-4 text-blue-600" />
                  <span className="text-xs font-medium text-gray-900">View All Pending</span>
                </div>
                <FiChevronRight className="h-3 w-3 text-gray-400" />
              </button>
              <button className="w-full flex items-center justify-between p-2 hover:bg-emerald-50 rounded transition-colors">
                <div className="flex items-center space-x-2">
                  <FiCheckCircle className="h-4 w-4 text-emerald-600" />
                  <span className="text-xs font-medium text-gray-900">Today's Completed</span>
                </div>
                <FiChevronRight className="h-3 w-3 text-gray-400" />
              </button>
              <button className="w-full flex items-center justify-between p-2 hover:bg-rose-50 rounded transition-colors">
                <div className="flex items-center space-x-2">
                  <FiAlertCircle className="h-4 w-4 text-rose-600" />
                  <span className="text-xs font-medium text-gray-900">Failed Transactions</span>
                </div>
                <FiChevronRight className="h-3 w-3 text-gray-400" />
              </button>
            </div>
          </div>
        </div>

        {/* Right Column - Transaction Table */}
        <div className="col-span-2">
          <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
            <div className="p-4 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-gray-900 text-sm flex items-center">
                  <FiFileText className="h-4 w-4 mr-2 text-gray-600" />
                  Transaction History
                </h3>
                <div className="flex items-center space-x-3">
                  <span className="text-xs text-gray-600">
                    {filteredTransactions.length} of {totalTransactions} transactions
                  </span>
                  <div className="flex items-center space-x-2">
                    <select
                      value={sortBy}
                      onChange={(e) => setSortBy(e.target.value)}
                      className="border border-gray-300 rounded px-2 py-1 text-xs focus:ring-1 focus:ring-indigo-500"
                    >
                      <option value="date">Date</option>
                      <option value="amount">Amount</option>
                      <option value="status">Status</option>
                    </select>
                    <button
                      onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
                      className="border border-gray-300 rounded px-2 py-1 text-xs hover:bg-gray-100"
                    >
                      {sortOrder === 'asc' ? '↑ Asc' : '↓ Desc'}
                    </button>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="overflow-x-auto max-h-[500px]">
              <table className="w-full min-w-full">
                <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                  <tr>
                    <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date & Time</th>
                    <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                    <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff</th>
                    <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                    <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                    <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                    <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                  </tr>
                </thead>

                <tbody>
                  {sortedTransactions.length === 0 && (
                    <tr>
                      <td colSpan="8" className="text-center py-6 text-gray-500 text-xs">
                        <div className="flex flex-col items-center justify-center">
                          <FiSearch className="h-8 w-8 text-gray-300 mb-2" />
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
                          className={`hover:bg-gray-50 ${isExpanded ? 'bg-blue-50' : ''}`}
                        >
                          <td className="py-3 px-3">
                            <div className="flex flex-col">
                              <span className="text-xs font-medium text-gray-900">
                                {transaction.date || '—'}
                              </span>
                              <span className="text-xs text-gray-500">
                                {transaction.time || '—'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center">
                              <div className="p-1 bg-gray-100 rounded mr-2">
                                <FiFileText className="h-3 w-3 text-gray-600" />
                              </div>
                              <span className="text-xs text-gray-900 truncate max-w-[150px]">
                                {transaction.description || 'Transaction'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            {transaction.staffName ? (
                              <div className="flex items-center">
                                <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center mr-2">
                                  <FiBriefcase className="h-3 w-3 text-emerald-600" />
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-xs font-medium text-gray-900">
                                    {transaction.staffName}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    Staff
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-500">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            {transaction.customerName ? (
                              <div className="flex items-center">
                                <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center mr-2">
                                  <FiUser className="h-3 w-3 text-indigo-600" />
                                </div>
                                <div className="flex flex-col">
                                  <span className="text-xs font-medium text-gray-900 truncate max-w-[120px]">
                                    {transaction.customerName}
                                  </span>
                                  <span className="text-xs text-gray-500">
                                    Customer
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <span className="text-xs text-gray-500">—</span>
                            )}
                          </td>
                          <td className="py-3 px-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getCategoryColor(transaction.category)}`}>
                              {transaction.category || '—'}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex flex-col">
                              <span className={`text-xs font-bold ${
                                transaction.transactionType === 'debit' ? 'text-rose-600' : 'text-emerald-600'
                              }`}>
                                {transaction.transactionType === 'debit' ? '-' : '+'}₹{transaction.amount?.toLocaleString() || '0'}
                              </span>
                              <span className="text-xs text-gray-500">
                                {transaction.paymentMethod || '—'}
                              </span>
                            </div>
                          </td>
                          <td className="py-3 px-3">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${getStatusColor(transaction.status)}`}>
                              {transaction.status === 'Completed' && <FiCheckCircle className="h-2 w-2 mr-1" />}
                              {transaction.status === 'Pending' && <FiClock className="h-2 w-2 mr-1" />}
                              {transaction.status === 'Failed' && <FiXCircle className="h-2 w-2 mr-1" />}
                              {transaction.status || '—'}
                            </span>
                          </td>
                          <td className="py-3 px-3">
                            <div className="flex items-center space-x-2">
                              <button
                                onClick={() => toggleRow(transaction.id)}
                                className="text-gray-500 hover:text-gray-700"
                                title="View details"
                              >
                                {isExpanded ? (
                                  <FiMinus className="h-4 w-4" />
                                ) : (
                                  <FiPlus className="h-4 w-4" />
                                )}
                              </button>
                              <button
                                onClick={() => setSelectedTransaction(transaction)}
                                className="text-gray-500 hover:text-indigo-600"
                                title="View full details"
                              >
                                <FiEye className="h-4 w-4" />
                              </button>
                            </div>
                          </td>
                        </tr>
                        
                        {isExpanded && (
                          <tr className="bg-blue-50">
                            <td colSpan="8" className="px-3 py-3">
                              <div className="bg-white rounded-lg border border-gray-200 p-3">
                                <div className="flex items-center justify-between mb-3">
                                  <h4 className="text-xs font-bold text-gray-900">Transaction Details</h4>
                                  <div className="flex items-center space-x-2">
                                    <span className="text-xs text-gray-600">ID:</span>
                                    <span className="text-xs font-mono text-gray-700">{transaction.id}</span>
                                  </div>
                                </div>
                                
                                <div className="grid grid-cols-2 gap-3 mb-3">
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1">Transaction Type</p>
                                    <p className="text-xs font-medium text-gray-900">
                                      {transaction.transactionType === 'credit' ? 'Credit (Incoming)' : 'Debit (Outgoing)'}
                                    </p>
                                  </div>
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1">Payment Method</p>
                                    <div className="flex items-center">
                                      <div className="p-1 bg-gray-100 rounded mr-2">
                                        <FiCreditCard className="h-3 w-3 text-gray-600" />
                                      </div>
                                      <p className="text-xs font-medium text-gray-900">{transaction.paymentMethod || '—'}</p>
                                    </div>
                                  </div>
                                  {transaction.walletId && (
                                    <div>
                                      <p className="text-xs text-gray-500 mb-1">Wallet</p>
                                      <p className="text-xs font-medium text-gray-900">{transaction.walletName || transaction.walletId}</p>
                                    </div>
                                  )}
                                  <div>
                                    <p className="text-xs text-gray-500 mb-1">Category</p>
                                    <p className="text-xs font-medium text-gray-900">{transaction.category || '—'}</p>
                                  </div>
                                </div>
                                
                                {/* Staff and Customer Info */}
                                {(transaction.staffName || transaction.customerName) && (
                                  <div className="border-t border-gray-200 pt-3">
                                    <h5 className="text-xs font-semibold text-gray-700 mb-2">Involved Parties</h5>
                                    <div className="grid grid-cols-2 gap-3">
                                      {transaction.staffName && (
                                        <div className="flex items-center space-x-2">
                                          <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center">
                                            <FiBriefcase className="h-3 w-3 text-emerald-600" />
                                          </div>
                                          <div>
                                            <p className="text-xs font-medium text-gray-900">Staff</p>
                                            <p className="text-xs text-gray-700">{transaction.staffName}</p>
                                          </div>
                                        </div>
                                      )}
                                      {transaction.customerName && (
                                        <div className="flex items-center space-x-2">
                                          <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center">
                                            <FiUser className="h-3 w-3 text-indigo-600" />
                                          </div>
                                          <div>
                                            <p className="text-xs font-medium text-gray-900">Customer</p>
                                            <p className="text-xs text-gray-700">{transaction.customerName}</p>
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                )}
                                
                                {/* Description */}
                                {transaction.description && (
                                  <div className="mt-3 pt-3 border-t border-gray-200">
                                    <h5 className="text-xs font-semibold text-gray-700 mb-2">Description</h5>
                                    <p className="text-xs text-gray-700">{transaction.description}</p>
                                  </div>
                                )}
                              </div>
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
              <div className="border-t border-gray-200 bg-gray-50 p-3">
                <div className="flex items-center justify-between text-xs">
                  <div className="flex items-center space-x-4">
                    <div>
                      <span className="text-gray-600">Showing:</span>
                      <span className="font-bold text-gray-900 ml-1">
                        {sortedTransactions.length} of {totalTransactions}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Total Amount:</span>
                      <span className="font-bold text-emerald-600 ml-1">
                        ₹{totalAmount.toLocaleString()}
                      </span>
                    </div>
                    <div>
                      <span className="text-gray-600">Filtered:</span>
                      <span className={`font-bold ml-1 ${
                        filteredTransactions.length === totalTransactions ? 'text-gray-600' : 'text-indigo-600'
                      }`}>
                        {filteredTransactions.length} transactions
                      </span>
                    </div>
                  </div>
                  <div className="text-gray-600">
                    Last updated: {new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </div>
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