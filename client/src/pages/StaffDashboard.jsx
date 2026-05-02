import React, { useState, useEffect, useMemo } from 'react';
import { 
  FiFileText, FiCalendar, FiTrendingUp, FiTrendingDown,
  FiSmartphone, FiCheckCircle, FiAlertCircle, FiDollarSign,
  FiCreditCard, FiActivity, FiBarChart2, FiTarget,
  FiDatabase, FiArrowUpCircle, FiCheck, FiX,
  FiEdit, FiSave, FiPlusCircle, FiShield, FiTag,
  FiMessageSquare, FiTool, FiDroplet, FiPackage,
  FiUsers, FiSettings, FiCircle, FiAlertTriangle,
  FiClock, FiBook, FiRefreshCw, FiPlus, FiMinus, FiInfo,
  FiCheck as FiCheckIcon, FiXCircle, FiUser, FiBriefcase, FiHome,
  FiFilter, FiDownload, FiChevronRight, FiEye, FiPieChart, FiStar,
  FiRotateCcw
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { toast } from 'react-toastify';
import AdminExpenseEntry from './AdminExpenseEntry';

// Compact StatCard Component
const StatCard = ({ title, value, icon: Icon, color, subtitle, onClick, trend }) => (
  <motion.div
    whileHover={{ y: -2 }}
    className="bg-white rounded-lg border border-gray-200 hover:shadow-md transition-all duration-200 cursor-pointer p-3"
    onClick={onClick}
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

// Nightly Accounting Checklist Component (unchanged - full code)
const NightlyAccountingChecklist = ({ date, onComplete, existingData }) => {
  const [checklist, setChecklist] = useState(
    existingData?.checklist || {
      incomeEntryVerified: false,
      expenseEntryVerified: false,
      bankEntryReconciled: false,
      dailySummaryCompleted: false,
      cashReconciled: false,
      walletBalancesVerified: false
    }
  );

  const [notes, setNotes] = useState(existingData?.notes || '');
  const [closingCash, setClosingCash] = useState(existingData?.closingCash?.toString() || '');
  const [actualCashCount, setActualCashCount] = useState(existingData?.actualCashCount?.toString() || '');

  const handleChecklistToggle = (key) => {
    setChecklist(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const allCompleted = Object.values(checklist).every(item => item);

  const handleCompleteAccounting = async () => {
    if (!allCompleted) {
      toast.error('Please complete all checklist items');
      return;
    }
    
    if (!closingCash || !actualCashCount) {
      toast.error('Please enter both calculated cash and actual cash count');
      return;
    }
    
    const variance = parseFloat(closingCash) - parseFloat(actualCashCount);
    
    const payload = {
      date: date,
      opening_balance: 0,
      closing_balance: parseFloat(closingCash),
      actual_cash: parseFloat(actualCashCount),
      cash_variance: variance,
      checklist: checklist,
      notes: notes
    };
    
    try {
      await onComplete(payload);
    } catch (error) {
      console.error('Error completing nightly accounting:', error);
    }
  };

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4 mb-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-gray-900 text-sm flex items-center">
            <FiCheckCircle className="h-4 w-4 mr-2 text-indigo-600" />
            Nightly Accounting Checklist
          </h3>
          <p className="text-xs text-gray-600">Date: {date}</p>
          {existingData && (
            <div className="mt-1">
              <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-emerald-100 text-emerald-800">
                <FiCheckCircle className="h-3 w-3 mr-1" />
                Closed on {new Date(existingData.timestamp).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
        <div className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
          allCompleted ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-yellow-50 text-yellow-700 border border-yellow-200'
        }`}>
          {allCompleted ? 'Ready to Close' : 'Pending Items'}
        </div>
      </div>

      <div className="space-y-4">
        {/* Checklist Items */}
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: 'incomeEntryVerified', label: 'Income Entry Verified', description: 'Service charges & fees' },
            { key: 'expenseEntryVerified', label: 'Expense Entry Verified', description: 'All expenses approved' },
            { key: 'bankEntryReconciled', label: 'Bank Reconciled', description: 'Bank credits matched' },
            { key: 'dailySummaryCompleted', label: 'Daily Summary', description: 'Transactions summarized' },
            { key: 'cashReconciled', label: 'Cash Reconciled', description: 'Cash matches count' },
            { key: 'walletBalancesVerified', label: 'Wallets Verified', description: 'Digital wallets checked' }
          ].map((item) => (
            <div key={item.key} className="flex items-start space-x-2 p-3 border border-gray-200 rounded-lg hover:bg-gray-50">
              <button
                onClick={() => handleChecklistToggle(item.key)}
                className={`mt-1 flex-shrink-0 w-4 h-4 rounded border flex items-center justify-center ${
                  checklist[item.key]
                    ? 'bg-emerald-500 border-emerald-500'
                    : 'border-gray-300'
                }`}
              >
                {checklist[item.key] && <FiCheckIcon className="h-2 w-2 text-white" />}
              </button>
              <div className="flex-1 min-w-0">
                <label className="font-medium text-gray-900 text-sm cursor-pointer truncate" onClick={() => handleChecklistToggle(item.key)}>
                  {item.label}
                </label>
                <p className="text-xs text-gray-600 truncate">{item.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Cash Reconciliation */}
        <div className="pt-4 border-t border-gray-200">
          <h4 className="font-medium text-gray-900 text-sm mb-3 flex items-center">
            <FiDollarSign className="h-3 w-3 mr-2 text-emerald-600" />
            Cash Reconciliation
          </h4>
          <div className="grid gap-3 grid-cols-2">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Calculated Cash
              </label>
              <input
                type="number"
                value={closingCash}
                onChange={(e) => setClosingCash(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                placeholder="₹0.00"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Actual Count
              </label>
              <input
                type="number"
                value={actualCashCount}
                onChange={(e) => setActualCashCount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                placeholder="₹0.00"
              />
            </div>
          </div>
          {closingCash && actualCashCount && (
            <div className="mt-2">
              <span className={`text-xs font-medium ${
                Math.abs(parseFloat(closingCash) - parseFloat(actualCashCount)) <= 100
                  ? 'text-emerald-600'
                  : 'text-rose-600'
              }`}>
                Variance: ₹{(parseFloat(closingCash) - parseFloat(actualCashCount)).toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-2 flex items-center">
            <FiMessageSquare className="h-3 w-3 mr-1 text-gray-500" />
            Notes & Observations
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows="2"
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
            placeholder="Enter any notes or observations..."
          />
        </div>

        {/* Complete Button */}
        <div className="flex justify-end">
          <button
            onClick={handleCompleteAccounting}
            disabled={!allCompleted}
            className={`px-4 py-2 rounded-lg text-sm font-medium ${
              allCompleted
                ? existingData
                  ? 'bg-blue-600 hover:bg-blue-700 text-white'
                  : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                : 'bg-gray-100 text-gray-400 cursor-not-allowed'
            }`}
          >
            {existingData ? 'Update Nightly Accounting' : 'Complete Nightly Accounting'}
          </button>
        </div>
      </div>
    </div>
  );
};

// Daily Summary Component (unchanged - full code)
const DailySummaryComponent = ({ summaryData, onUpdate }) => {
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    derived: summaryData?.derived || {},
    manual: {
      actualCashInHand: summaryData?.actualCashInHand || 0
    }
  });

  useEffect(() => {
    setFormData({
      derived: summaryData?.derived || {},
      manual: {
        actualCashInHand: summaryData?.actualCashInHand || 0
      }
    });
  }, [summaryData]);

  const calculateTotals = () => {
    const {
      openingBalance = 0,
      cashInflow = 0,
      digitalInflow = 0,
      bankInflow = 0,
      cashOutflow = 0,
      digitalOutflow = 0,
      bankOutflow = 0
    } = formData.derived || {};

    const totalInflow = cashInflow + digitalInflow + bankInflow;
    const totalOutflow = cashOutflow + digitalOutflow + bankOutflow;
    const closingBalance = openingBalance + totalInflow - totalOutflow;
    const variance = closingBalance - (formData.manual.actualCashInHand || 0);

    return {
      totalInflow,
      totalOutflow,
      closingBalance,
      variance
    };
  };

  const totals = calculateTotals();

  const handleSave = () => {
    onUpdate({
      actualCashInHand: formData.manual.actualCashInHand
    });
    setEditing(false);
    toast.success('Daily summary saved');
  };

  const fields = [
    { key: 'openingBalance', label: 'Opening Balance', type: 'balance', category: 'system' },
    { key: 'cashInflow', label: 'Cash Collections', type: 'cash', category: 'inflow' },
    { key: 'digitalInflow', label: 'Digital Collections', type: 'digital', category: 'inflow' },
    { key: 'bankInflow', label: 'Bank Collections', type: 'bank', category: 'inflow' },
    { key: 'cashOutflow', label: 'Cash Outflow', type: 'cash', category: 'outflow' },
    { key: 'digitalOutflow', label: 'Digital Outflow', type: 'digital', category: 'outflow' },
    { key: 'bankOutflow', label: 'Bank Outflow', type: 'bank', category: 'outflow' },
    { key: 'actualCashInHand', label: 'Actual Cash in Hand', type: 'cash', category: 'manual' }
  ];

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-bold text-gray-900 text-sm flex items-center">
            <FiBarChart2 className="h-4 w-4 mr-2 text-indigo-600" />
            Daily Summary
          </h3>
          <p className="text-xs text-gray-600">Date: {summaryData?.date || '-'}</p>
        </div>
        <div className="flex space-x-2">
          {editing ? (
            <>
              <button
                onClick={handleSave}
                className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center space-x-1 text-sm"
              >
                <FiSave className="h-3 w-3" />
                <span>Save</span>
              </button>
              <button
                onClick={() => {
                  setFormData({
                    derived: summaryData?.derived || {},
                    manual: {
                      actualCashInHand: summaryData?.actualCashInHand || 0
                    }
                  });
                  setEditing(false);
                }}
                className="px-3 py-1.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors flex items-center space-x-1 text-sm"
              >
                <FiX className="h-3 w-3" />
                <span>Cancel</span>
              </button>
            </>
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center space-x-1 text-sm"
            >
              <FiEdit className="h-3 w-3" />
              <span>Edit Summary</span>
            </button>
          )}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="grid gap-3 mb-4 grid-cols-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-700 mb-1">Total Inflow</p>
          <p className="font-bold text-blue-900 text-sm">
            ₹{totals.totalInflow.toLocaleString()}
          </p>
        </div>

        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
          <p className="text-xs text-rose-700 mb-1">Total Outflow</p>
          <p className="font-bold text-rose-900 text-sm">
            ₹{totals.totalOutflow.toLocaleString()}
          </p>
        </div>

        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
          <p className="text-xs text-emerald-700 mb-1">Closing Balance</p>
          <p className="font-bold text-emerald-900 text-sm">
            ₹{totals.closingBalance.toLocaleString()}
          </p>
        </div>

        <div className={`border rounded-lg p-3 ${
          Math.abs(totals.variance) <= 100
            ? 'bg-emerald-50 border-emerald-200'
            : 'bg-rose-50 border-rose-200'
        }`}>
          <p className="text-xs mb-1">Cash Variance</p>
          <p className="font-bold text-sm">
            ₹{totals.variance.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Summary Table */}
      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Item
              </th>
              <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Type
              </th>
              <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Category
              </th>
              <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                Amount (₹)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {fields.map((field) => (
              <tr key={field.key} className="hover:bg-gray-50 transition-colors">
                <td className="py-2 px-3">
                  <span className="font-medium text-gray-900 text-xs">{field.label}</span>
                </td>
                <td className="py-2 px-3">
                  <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                    field.type === 'cash' ? 'bg-blue-100 text-blue-800' :
                    field.type === 'digital' ? 'bg-purple-100 text-purple-800' :
                    field.type === 'bank' ? 'bg-indigo-100 text-indigo-800' :
                    'bg-amber-100 text-amber-800'
                  }`}>
                    {field.type === 'cash' && <FiDollarSign className="h-2 w-2 mr-1" />}
                    {field.type === 'digital' && <FiSmartphone className="h-2 w-2 mr-1" />}
                    {field.type === 'bank' && <FiCreditCard className="h-2 w-2 mr-1" />}
                    {field.type}
                  </span>
                </td>
                <td className="py-2 px-3">
                  <span className={`inline-flex items-center text-xs ${
                    field.category === 'inflow' ? 'text-emerald-600' :
                    field.category === 'outflow' ? 'text-rose-600' :
                    'text-gray-600'
                  }`}>
                    {field.category === 'inflow' && <FiTrendingUp className="h-2 w-2 mr-1" />}
                    {field.category === 'outflow' && <FiTrendingDown className="h-2 w-2 mr-1" />}
                    {field.category}
                  </span>
                </td>
                <td className="py-2 px-3">
                  {editing && field.key === 'actualCashInHand' ? (
                    <input
                      type="number"
                      value={formData.manual.actualCashInHand}
                      onChange={(e) =>
                        setFormData(prev => ({
                          ...prev,
                          manual: {
                            ...prev.manual,
                            actualCashInHand: parseFloat(e.target.value) || 0
                          }
                        }))
                      }
                      className="w-28 px-2 py-1 border border-gray-300 rounded text-right text-xs"
                    />
                  ) : (
                    <span className="font-medium text-xs text-gray-800">
                      ₹{(field.key === 'actualCashInHand' ? formData.manual.actualCashInHand : formData.derived[field.key])?.toLocaleString() || '0'}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

// Income View Component (unchanged - full code)
const IncomeViewComponent = ({ transactions = [] }) => {
  const rows = Array.isArray(transactions)
    ? transactions
    : transactions?.rows || [];

  let totalServiceCharge = 0;
  let totalDepartmentFee = 0;
  let totalCollected = 0;

  rows.forEach(row => {
    const received = Number(row.received_amount || 0);
    const serviceCharge = Number(row.service_charges || 0);
    const departmentCharge = Number(row.department_charges || 0);
    const totalBilled = serviceCharge + departmentCharge;
    
    totalCollected += received;
    
    if (totalBilled > 0 && received > 0) {
      const paymentRatio = received / totalBilled;
      totalServiceCharge += serviceCharge * paymentRatio;
      totalDepartmentFee += departmentCharge * paymentRatio;
    } else if (received > 0 && totalBilled === 0) {
      totalServiceCharge += received;
    }
  });

  totalServiceCharge = Math.round(totalServiceCharge * 100) / 100;
  totalDepartmentFee = Math.round(totalDepartmentFee * 100) / 100;

  const staffIncome = rows.reduce((acc, transaction) => {
    const staffName = transaction.staff_name || 'Unknown';
    if (!acc[staffName]) {
      acc[staffName] = {
        name: staffName,
        total: 0,
        serviceCharge: 0,
        departmentFee: 0,
        count: 0
      };
    }
    
    const received = Number(transaction.received_amount || 0);
    const serviceCharge = Number(transaction.service_charges || 0);
    const departmentCharge = Number(transaction.department_charges || 0);
    const totalBilled = serviceCharge + departmentCharge;
    
    if (totalBilled > 0 && received > 0) {
      const paymentRatio = received / totalBilled;
      acc[staffName].serviceCharge += serviceCharge * paymentRatio;
      acc[staffName].departmentFee += departmentCharge * paymentRatio;
      acc[staffName].total += serviceCharge * paymentRatio + departmentCharge * paymentRatio;
    } else if (received > 0 && totalBilled === 0) {
      acc[staffName].serviceCharge += received;
      acc[staffName].total += received;
    }
    
    acc[staffName].count += 1;
    return acc;
  }, {});

  const topStaff = Object.values(staffIncome)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);

  const walletTotals = rows.reduce((acc, transaction) => {
    if (transaction.wallet_breakdown && Array.isArray(transaction.wallet_breakdown)) {
      transaction.wallet_breakdown.forEach(walletTx => {
        const walletName = walletTx.wallet || 'Unknown';
        if (!acc[walletName]) {
          acc[walletName] = { name: walletName, total: 0, count: 0 };
        }
        acc[walletName].total += Number(walletTx.amount || 0);
        acc[walletName].count += 1;
      });
    }
    return acc;
  }, {});

  const paymentMethods = rows.reduce((acc, transaction) => {
    if (transaction.wallet_breakdown && Array.isArray(transaction.wallet_breakdown)) {
      transaction.wallet_breakdown.forEach(walletTx => {
        const walletName = walletTx.wallet || 'Unknown';
        if (!acc[walletName]) {
          acc[walletName] = { name: walletName, total: 0, count: 0 };
        }
        acc[walletName].total += Number(walletTx.amount || 0);
        acc[walletName].count += 1;
      });
    }
    return acc;
  }, {});

  const analyzeTransaction = (row) => {
    if (!row.wallet_breakdown || !Array.isArray(row.wallet_breakdown)) {
      return {
        customerPayment: 0,
        internalTransfer: 0,
        totalReceived: Number(row.received_amount || 0)
      };
    }

    let customerPayment = 0;
    let internalTransfer = 0;

    row.wallet_breakdown.forEach(walletTx => {
      const amount = Number(walletTx.amount || 0);
      
      if (row.payment_wallets && row.payment_wallets.includes(walletTx.wallet) && 
          row.payment_wallets.split(',').length > 1) {
        internalTransfer += amount;
      } else {
        customerPayment += amount;
      }
    });

    return {
      customerPayment: customerPayment || Number(row.received_amount || 0),
      internalTransfer,
      totalReceived: Number(row.received_amount || 0)
    };
  };

  const [expandedRow, setExpandedRow] = useState(null);
  const toggleRow = (serviceEntryId) => {
    setExpandedRow(prev =>
      prev === serviceEntryId ? null : serviceEntryId
    );
  };

  const trend = 12.5;

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Left Column - Key Metrics */}
      <div className="col-span-1 space-y-4">
        {/* Total Collected Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-emerald-100 rounded-lg">
                <FiDollarSign className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Total Collected</p>
                <p className="font-bold text-gray-900 text-lg">₹{totalCollected.toLocaleString()}</p>
              </div>
            </div>
            <div className="text-right">
              <span className="inline-flex items-center px-2 py-1 rounded text-xs font-medium bg-emerald-50 text-emerald-700">
                <FiTrendingUp className="h-2 w-2 mr-1" />
                +{trend}%
              </span>
            </div>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Service Charges (Received)</span>
            <span className="font-medium">₹{totalServiceCharge.toLocaleString()}</span>
          </div>
          <div className="flex items-center justify-between text-xs mt-1">
            <span className="text-gray-600">Department Charges (Debitted)</span>
            <span className="font-medium">₹{totalDepartmentFee.toLocaleString()}</span>
          </div>
          <div className="mt-2 pt-2 border-t border-gray-100">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">Net Customer Payment</span>
              <span className="font-bold text-emerald-600">₹{totalCollected.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Wallet Summary */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-bold text-gray-900 text-sm mb-3 flex items-center">
            <FiDatabase className="h-4 w-4 mr-2 text-blue-600" />
            Wallet Activity
          </h3>
          <div className="space-y-2">
            {Object.values(walletTotals).map((wallet, index) => (
              <div key={wallet.name} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    index === 0 ? 'bg-blue-500' : 
                    index === 1 ? 'bg-purple-500' : 
                    index === 2 ? 'bg-emerald-500' : 'bg-gray-300'
                  }`} />
                  <span className="text-xs font-medium text-gray-700 truncate max-w-[100px]">{wallet.name}</span>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-gray-900">₹{wallet.total.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">{wallet.count} txn</p>
                </div>
              </div>
            ))}
            {Object.keys(walletTotals).length === 0 && (
              <p className="text-xs text-gray-500 text-center py-2">No wallet activity</p>
            )}
          </div>
        </div>

        {/* Top Performing Staff */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-bold text-gray-900 text-sm mb-3 flex items-center">
            <FiUsers className="h-4 w-4 mr-2 text-indigo-600" />
            Top Performing Staff
          </h3>
          <div className="space-y-2">
            {topStaff.map((staff, index) => (
              <div key={staff.name} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                <div className="flex items-center space-x-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    index === 0 ? 'bg-yellow-100 text-yellow-700' :
                    index === 1 ? 'bg-gray-100 text-gray-700' :
                    index === 2 ? 'bg-amber-100 text-amber-700' :
                    'bg-blue-50 text-blue-600'
                  }`}>
                    {index + 1}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-900">{staff.name}</p>
                    <p className="text-xs text-gray-500">{staff.count} services</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-gray-900">₹{Math.round(staff.total).toLocaleString()}</p>
                  <div className="text-xs text-gray-500">
                    <span>S: ₹{Math.round(staff.serviceCharge).toLocaleString()}</span>
                    {staff.departmentFee > 0 && (
                      <span className="ml-1">D: ₹{Math.round(staff.departmentFee).toLocaleString()}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {topStaff.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-2">No staff data available</p>
            )}
          </div>
        </div>

        {/* Payment Method Distribution */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-bold text-gray-900 text-sm mb-3 flex items-center">
            <FiCreditCard className="h-4 w-4 mr-2 text-purple-600" />
            Wallet Distribution
          </h3>
          <div className="space-y-2">
            {Object.values(paymentMethods).map((method, index) => (
              <div key={method.name} className="flex items-center justify-between p-2">
                <div className="flex items-center space-x-2">
                  <div className={`p-1 rounded ${
                    method.name.toLowerCase().includes('cash') ? 'bg-emerald-100 text-emerald-600' :
                    method.name.toLowerCase().includes('counter') ? 'bg-blue-100 text-blue-600' :
                    method.name.toLowerCase().includes('bank') ? 'bg-purple-100 text-purple-600' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {method.name.toLowerCase().includes('cash') ? <FiDollarSign className="h-3 w-3" /> :
                     method.name.toLowerCase().includes('counter') ? <FiCreditCard className="h-3 w-3" /> :
                     method.name.toLowerCase().includes('bank') ? <FiDatabase className="h-3 w-3" /> :
                     <FiCreditCard className="h-3 w-3" />}
                  </div>
                  <span className="text-xs font-medium text-gray-700 truncate max-w-[80px]">{method.name}</span>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-gray-900">₹{method.total.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">{method.count} txn</p>
                </div>
              </div>
            ))}
            {Object.keys(paymentMethods).length === 0 && (
              <p className="text-xs text-gray-500 text-center py-2">No wallet data</p>
            )}
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
                Income Transactions (Corrected View)
              </h3>
              <span className="text-xs text-gray-600">
                {rows.length} transactions • ₹{totalCollected.toLocaleString()} total
              </span>
            </div>
          </div>
          
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full min-w-full">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Staff</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"></th>
                </tr>
              </thead>

              <tbody>
                {rows.length === 0 && (
                  <tr>
                    <td colSpan="7" className="text-center py-6 text-gray-500 text-xs">
                      <div className="flex flex-col items-center justify-center">
                        <FiFileText className="h-8 w-8 text-gray-300 mb-2" />
                        No income data for this date
                      </div>
                    </td>
                  </tr>
                )}

                {rows.map((row, index) => {
                  const rowKey = row.service_entry_id != null
                    ? `se-${row.service_entry_id}`
                    : `income-fallback-${index}`;

                  const isExpanded = expandedRow === row.service_entry_id;
                  const transactionAnalysis = analyzeTransaction(row);
                  
                  const displayAmount = Number(row.received_amount || 0);
                  
                  const totalBilled = Number(row.service_charges || 0) + Number(row.department_charges || 0);
                  let receivedServiceCharge = 0;
                  let receivedDepartmentCharge = 0;
                  
                  if (totalBilled > 0 && displayAmount > 0) {
                    const paymentRatio = displayAmount / totalBilled;
                    receivedServiceCharge = Number(row.service_charges || 0) * paymentRatio;
                    receivedDepartmentCharge = Number(row.department_charges || 0) * paymentRatio;
                  } else if (displayAmount > 0 && totalBilled === 0) {
                    receivedServiceCharge = displayAmount;
                  }

                  return (
                    <React.Fragment key={rowKey}>
                      <tr
                        className={`hover:bg-gray-50 ${isExpanded ? 'bg-blue-50' : ''}`}
                      >
                        <td className="py-3 px-3">
                          <div className="flex flex-col">
                            <span className="text-xs font-medium text-gray-900">
                              {row.received_at ? new Date(row.received_at).toLocaleDateString() : '—'}
                            </span>
                            <span className="text-xs text-gray-500">
                              {row.received_at ? new Date(row.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center mr-2">
                              <FiUser className="h-3 w-3 text-indigo-600" />
                            </div>
                            <span className="text-xs font-medium text-gray-900 truncate max-w-[120px]">
                              {row.customer_name || '—'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="text-xs text-gray-900">{row.service_name || '—'}</span>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center">
                            <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center mr-2">
                              <FiBriefcase className="h-3 w-3 text-emerald-600" />
                            </div>
                            <span className="text-xs font-medium text-gray-900">
                              {row.staff_name || '—'}
                            </span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-gray-900">
                              ₹{displayAmount.toLocaleString()}
                            </span>
                            <div className="flex items-center text-xs text-gray-500">
                              <span className="mr-2">Service: ₹{Math.round(receivedServiceCharge).toLocaleString()}</span>
                              {receivedDepartmentCharge > 0 && (
                                <span>Dept: ₹{Math.round(receivedDepartmentCharge).toLocaleString()}</span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                            <FiCheck className="h-2 w-2 mr-1" />
                            Completed
                          </span>
                          {row.was_pending && (
                            <div className="mt-1">
                              <span className="text-xs px-2 py-0.5 rounded-full bg-amber-100 text-amber-700 flex items-center">
                                <FiRotateCcw className="h-2 w-2 mr-1" />
                                Was Pending
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="py-3 px-3">
                          <button
                            onClick={() => toggleRow(row.service_entry_id)}
                            className="text-gray-500 hover:text-gray-700"
                          >
                            {isExpanded ? (
                              <FiMinus className="h-4 w-4" />
                            ) : (
                              <FiPlus className="h-4 w-4" />
                            )}
                          </button>
                        </td>
                      </tr>
                      
                      {isExpanded && (
                        <tr className="bg-blue-50">
                          <td colSpan="7" className="px-3 py-3">
                            <div className="bg-white rounded-lg border border-gray-200 p-3">
                              <div className="flex items-center justify-between mb-3">
                                <h4 className="text-xs font-bold text-gray-900">Transaction Details</h4>
                                <div className="flex items-center space-x-2">
                                  <span className="text-xs text-gray-600">ID:</span>
                                  <span className="text-xs font-mono text-gray-700">{row.service_entry_id}</span>
                                </div>
                              </div>
                              
                              <div className="grid grid-cols-2 gap-3 mb-3">
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Service Charge (Received)</p>
                                  <p className="text-xs font-medium text-gray-900">₹{Math.round(receivedServiceCharge).toLocaleString()}</p>
                                  <p className="text-xs text-gray-500">
                                    (Billed: ₹{Number(row.service_charges || 0).toLocaleString()})
                                  </p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Department Charge (Received)</p>
                                  <p className="text-xs font-medium text-gray-900">₹{Math.round(receivedDepartmentCharge).toLocaleString()}</p>
                                  <p className="text-xs text-gray-500">
                                    (Billed: ₹{Number(row.department_charges || 0).toLocaleString()})
                                  </p>
                                </div>
                                <div className="col-span-2">
                                  <p className="text-xs text-gray-500 mb-1">Total from Customer</p>
                                  <p className="text-xs font-bold text-emerald-600">₹{displayAmount.toLocaleString()}</p>
                                  <p className="text-xs text-gray-500">
                                    {totalBilled > 0 ? (
                                      <>
                                        {((displayAmount / totalBilled) * 100).toFixed(1)}% of total billed 
                                        (₹{totalBilled.toLocaleString()})
                                      </>
                                    ) : (
                                      'Full payment'
                                    )}
                                  </p>
                                </div>
                              </div>
                              
                              {row.wallet_breakdown && Array.isArray(row.wallet_breakdown) && row.wallet_breakdown.length > 0 && (
                                <div className="mt-3">
                                  <p className="text-xs font-medium text-gray-700 mb-2">Wallet Transactions</p>
                                  <div className="space-y-1">
                                    {row.wallet_breakdown.map((w, i) => {
                                      const isCustomerPayment = 
                                        (Number(w.amount) === displayAmount) || 
                                        (Number(w.amount) === Number(row.service_charges || 0));
                                      
                                      return (
                                        <div
                                          key={`${row.service_entry_id}-${w.wallet}-${i}`}
                                          className={`flex justify-between items-center text-xs p-2 rounded ${
                                            isCustomerPayment ? 'bg-emerald-50 border border-emerald-100' : 'bg-gray-50'
                                          }`}
                                        >
                                          <div className="flex items-center space-x-2">
                                            <span className="font-medium">{w.wallet || 'Unknown'}</span>
                                            <span className={`px-1.5 py-0.5 rounded-full text-xs ${
                                              isCustomerPayment 
                                                ? 'bg-emerald-100 text-emerald-700'
                                                : 'bg-blue-100 text-blue-700'
                                            }`}>
                                              {isCustomerPayment ? 'Customer Payment' : 'Internal Transfer'}
                                            </span>
                                            {w.received_at && (
                                              <span className="text-gray-500 text-xs">
                                                {new Date(w.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                              </span>
                                            )}
                                          </div>
                                          <div className={`font-semibold ${
                                            isCustomerPayment ? 'text-emerald-600' : 'text-blue-600'
                                          }`}>
                                            ₹{Number(w.amount || 0).toLocaleString()}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                </div>
                              )}
                              
                              <div className="mt-3 pt-3 border-t border-gray-200">
                                <div className="flex justify-between text-xs">
                                  <span className="text-gray-600">Note:</span>
                                  <span className="text-gray-700">
                                    Customer paid ₹{displayAmount.toLocaleString()} total 
                                    ({receivedServiceCharge > 0 ? `₹${Math.round(receivedServiceCharge).toLocaleString()} service` : ''}
                                    {receivedDepartmentCharge > 0 ? ` + ₹${Math.round(receivedDepartmentCharge).toLocaleString()} department` : ''})
                                  </span>
                                </div>
                              </div>
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
        </div>
      </div>
    </div>
  );
};

// Ledger View Component (unchanged - full code)
const LedgerView = ({ ledger, onLedgerRowClick }) => {
  const totalCredits = ledger.reduce((sum, tx) => 
    sum + (tx.type === 'credit' ? Number(tx.amount || 0) : 0), 0);
  
  const totalDebits = ledger.reduce((sum, tx) => 
    sum + (tx.type === 'debit' ? Number(tx.amount || 0) : 0), 0);
  
  const netBalance = totalCredits - totalDebits;
  
  const walletTotals = ledger.reduce((acc, tx) => {
    const walletName = tx.wallet_name || 'Unknown';
    if (!acc[walletName]) {
      acc[walletName] = {
        name: walletName,
        type: tx.wallet_type,
        credits: 0,
        debits: 0,
        count: 0
      };
    }
    
    if (tx.type === 'credit') {
      acc[walletName].credits += Number(tx.amount || 0);
    } else {
      acc[walletName].debits += Number(tx.amount || 0);
    }
    acc[walletName].count += 1;
    acc[walletName].net = acc[walletName].credits - acc[walletName].debits;
    
    return acc;
  }, {});
  
  const topWallets = Object.values(walletTotals)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  const categoryBreakdown = ledger.reduce((acc, tx) => {
    const category = tx.category || 'Unknown';
    if (!acc[category]) {
      acc[category] = { name: category, total: 0, count: 0 };
    }
    acc[category].total += Number(tx.amount || 0);
    acc[category].count += 1;
    return acc;
  }, {});
  
  const topCategories = Object.values(categoryBreakdown)
    .sort((a, b) => b.total - a.total)
    .slice(0, 5);
  
  const staffActivity = ledger.reduce((acc, tx) => {
    const staffName = tx.staff_name || 'System';
    if (!acc[staffName]) {
      acc[staffName] = { name: staffName, total: 0, count: 0 };
    }
    acc[staffName].total += Number(tx.amount || 0);
    acc[staffName].count += 1;
    return acc;
  }, {});
  
  const topStaff = Object.values(staffActivity)
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  const dailyTrend = 8.2;

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Left Column - Key Metrics */}
      <div className="col-span-1 space-y-4">
        {/* Net Balance Card */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className={`p-2 rounded-lg ${netBalance >= 0 ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                {netBalance >= 0 ? (
                  <FiTrendingUp className="h-4 w-4 text-emerald-600" />
                ) : (
                  <FiTrendingDown className="h-4 w-4 text-rose-600" />
                )}
              </div>
              <div>
                <p className="text-xs text-gray-500">Net Balance</p>
                <p className={`font-bold text-lg ${netBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  ₹{Math.abs(netBalance).toLocaleString()}
                  {netBalance >= 0 ? ' (Credit)' : ' (Debit)'}
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                dailyTrend >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
              }`}>
                {dailyTrend >= 0 ? (
                  <FiTrendingUp className="h-2 w-2 mr-1" />
                ) : (
                  <FiTrendingDown className="h-2 w-2 mr-1" />
                )}
                {Math.abs(dailyTrend)}%
              </span>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="text-xs text-gray-600 mb-1">Total Credits</p>
              <p className="font-semibold text-emerald-600 text-sm">₹{totalCredits.toLocaleString()}</p>
            </div>
            <div>
              <p className="text-xs text-gray-600 mb-1">Total Debits</p>
              <p className="font-semibold text-rose-600 text-sm">₹{totalDebits.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Top Wallets by Activity */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-bold text-gray-900 text-sm mb-3 flex items-center">
            <FiCreditCard className="h-4 w-4 mr-2 text-indigo-600" />
            Top Wallets
          </h3>
          <div className="space-y-2">
            {topWallets.map((wallet, index) => (
              <div key={wallet.name} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                <div className="flex items-center space-x-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${
                    index === 0 ? 'bg-indigo-100 text-indigo-600' :
                    index === 1 ? 'bg-purple-100 text-purple-600' :
                    index === 2 ? 'bg-blue-100 text-blue-600' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {wallet.type === 'cash' ? <FiDollarSign className="h-3 w-3" /> :
                     wallet.type === 'bank' ? <FiCreditCard className="h-3 w-3" /> :
                     <FiSmartphone className="h-3 w-3" />}
                  </div>
                  <div>
                    <p className="text-xs font-medium text-gray-900 truncate max-w-[100px]">{wallet.name}</p>
                    <p className="text-xs text-gray-500">{wallet.type}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-gray-900">{wallet.count} txns</p>
                  <p className={`text-xs ${wallet.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {wallet.net >= 0 ? '+' : '-'}₹{Math.abs(wallet.net).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
            {topWallets.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-2">No wallet data</p>
            )}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-bold text-gray-900 text-sm mb-3 flex items-center">
            <FiTag className="h-4 w-4 mr-2 text-purple-600" />
            Category Breakdown
          </h3>
          <div className="space-y-2">
            {topCategories.map((category, index) => (
              <div key={category.name} className="flex items-center justify-between p-2">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${
                    category.name.includes('Service') ? 'bg-emerald-500' :
                    category.name.includes('Expense') ? 'bg-rose-500' :
                    category.name.includes('Salary') ? 'bg-blue-500' :
                    category.name.includes('Transfer') ? 'bg-indigo-500' :
                    'bg-gray-400'
                  }`} />
                  <span className="text-xs font-medium text-gray-700 truncate max-w-[80px]">
                    {category.name}
                  </span>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-gray-900">₹{category.total.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">{category.count} txns</p>
                </div>
              </div>
            ))}
            {topCategories.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-2">No category data</p>
            )}
          </div>
        </div>

        {/* Staff Activity */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-bold text-gray-900 text-sm mb-3 flex items-center">
            <FiUsers className="h-4 w-4 mr-2 text-amber-600" />
            Staff Activity
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
                    <p className="text-xs text-gray-500">Transactions: {staff.count}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-gray-900">₹{staff.total.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">Avg: ₹{(staff.total / staff.count).toFixed(0)}</p>
                </div>
              </div>
            ))}
            {topStaff.length === 0 && (
              <p className="text-xs text-gray-500 text-center py-2">No staff activity</p>
            )}
          </div>
        </div>
      </div>

      {/* Right Column - Ledger Table */}
      <div className="col-span-2">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-sm flex items-center">
                <FiBook className="h-4 w-4 mr-2 text-gray-600" />
                Ledger Transactions (Corrected View)
              </h3>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-600">
                  {ledger.length} transactions
                </span>
                <span className="text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-700">
                  Net: ₹{netBalance.toLocaleString()}
                </span>
              </div>
            </div>
            <p className="text-xs text-gray-500 mt-1 flex items-center">
              <FiInfo className="h-3 w-3 mr-1" />
              Showing corrected transactions only (reversals hidden)
            </p>
          </div>
          
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full min-w-full">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Wallet</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service/Staff</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>

              <tbody>
                {ledger.length === 0 && (
                  <tr>
                    <td colSpan="7" className="text-center py-6 text-gray-500 text-xs">
                      <div className="flex flex-col items-center justify-center">
                        <FiBook className="h-8 w-8 text-gray-300 mb-2" />
                        No ledger transactions found
                      </div>
                    </td>
                  </tr>
                )}

                {ledger.map((tx, index) => {
                  const isCredit = tx.type === 'credit';
                  const transactionDate = new Date(tx.created_at);
                  const rowKey = `ledger-${tx.id || index}`;
                  const isReversal = tx.is_reversal;

                  return (
                    <tr
                      key={rowKey}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => onLedgerRowClick(tx)}
                    >
                      <td className="py-3 px-3">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-gray-900">
                            {transactionDate.toLocaleDateString()}
                          </span>
                          <span className="text-xs text-gray-500">
                            {transactionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center">
                          <div className={`w-6 h-6 rounded-full flex items-center justify-center mr-2 ${
                            tx.wallet_type === 'cash' ? 'bg-emerald-100 text-emerald-600' :
                            tx.wallet_type === 'bank' ? 'bg-blue-100 text-blue-600' :
                            'bg-purple-100 text-purple-600'
                          }`}>
                            {tx.wallet_type === 'cash' ? <FiDollarSign className="h-3 w-3" /> :
                             tx.wallet_type === 'bank' ? <FiCreditCard className="h-3 w-3" /> :
                             <FiSmartphone className="h-3 w-3" />}
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-900">{tx.wallet_name}</p>
                            <p className="text-xs text-gray-500 capitalize">{tx.wallet_type}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          isCredit ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
                        }`}>
                          {isCredit ? (
                            <>
                              <FiTrendingUp className="h-2 w-2 mr-1" />
                              Credit
                            </>
                          ) : (
                            <>
                              <FiTrendingDown className="h-2 w-2 mr-1" />
                              Debit
                            </>
                          )}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-col">
                          <span className={`text-xs font-bold ${isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {isCredit ? '+' : '-'}₹{Number(tx.amount || 0).toLocaleString()}
                          </span>
                          {tx.balance_after && (
                            <span className="text-xs text-gray-500">
                              Balance: ₹{Number(tx.balance_after).toLocaleString()}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-gray-900">{tx.category}</span>
                          {tx.service_name && (
                            <span className="text-xs text-gray-500 truncate max-w-[120px]">
                              {tx.service_name}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className="flex items-center">
                          <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center mr-2">
                            <FiUser className="h-3 w-3 text-indigo-600" />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-900">
                              {tx.staff_name || 'System'}
                            </p>
                            {tx.customer_name && (
                              <p className="text-xs text-gray-500 truncate max-w-[100px]">
                                {tx.customer_name}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                          <FiCheckCircle className="h-2 w-2 mr-1" />
                          Processed
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Summary Footer */}
          {ledger.length > 0 && (
            <div className="border-t border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center justify-between text-xs">
                <div className="flex items-center space-x-4">
                  <div>
                    <span className="text-gray-600">Total Credits:</span>
                    <span className="font-bold text-emerald-600 ml-1">₹{totalCredits.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Total Debits:</span>
                    <span className="font-bold text-rose-600 ml-1">₹{totalDebits.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-gray-600">Net Balance:</span>
                    <span className={`font-bold ml-1 ${
                      netBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'
                    }`}>
                      {netBalance >= 0 ? '+' : '-'}₹{Math.abs(netBalance).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="text-gray-600">
                  Showing {ledger.length} transactions
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Wallet Reconciliation Component (unchanged - full code)
const WalletReconciliation = ({ wallets, onRefreshWallets }) => {
  const [walletBalances, setWalletBalances] = useState({});
  const [isReconciling, setIsReconciling] = useState(false);

  const reconciledWallets = wallets.filter(w => 
    walletBalances[w.id] !== undefined && 
    Math.abs((walletBalances[w.id] || 0) - (w.book_balance || 0)) <= 10
  ).length;

  const totalVariance = wallets.reduce((sum, w) => {
    const actual = walletBalances[w.id] || 0;
    const book = w.book_balance || 0;
    return sum + Math.abs(actual - book);
  }, 0);

  const handleBalanceChange = (walletId, balance) => {
    setWalletBalances(prev => ({
      ...prev,
      [walletId]: parseFloat(balance) || 0
    }));
  };

  const handleReconcileWallets = async () => {
    setIsReconciling(true);
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/accounting/wallet-ledger-balances`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`
          }
        }
      );

      const ledgerBalances = await res.json();

      const reconciliations = wallets.map(w => {
        const ledger = ledgerBalances.find(
          lb => Number(lb.id) === Number(w.id)
        );

        const bookBalance = Number(ledger?.book_balance ?? 0);
        const actualBalance = Number(walletBalances[String(w.id)] ?? 0);

        return {
          wallet_id: w.id,
          book_balance: bookBalance,
          actual_balance: actualBalance,
          variance: actualBalance - bookBalance
        };
      });

      await fetch(
        `${import.meta.env.VITE_API_URL}/api/accounting/wallet-reconcile`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`
          },
          body: JSON.stringify({ reconciliations })
        }
      );
      
      await onRefreshWallets();
      toast.success('Wallets reconciled successfully!');
    } catch (error) {
      toast.error('Failed to reconcile wallets');
      console.error(error);
    } finally {
      setIsReconciling(false);
    }
  };

  const walletIcons = {
    cash: FiDollarSign,
    bank: FiCreditCard,
    digital: FiSmartphone,
    SBI: FiCreditCard,
    Counter: FiHome,
    'Counter Cash': FiHome,
    Edistrict: FiSmartphone,
    'Pan Card': FiDatabase,
    'PAN Card': FiDatabase,
    'Paper 70 GSM': FiPackage,
    PVC: FiPackage,
    'Digital Wallet': FiSmartphone,
    'Cash in Hand': FiDollarSign,
  };

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Left Column - Reconciliation Stats */}
      <div className="col-span-1 space-y-4">
        {/* Reconciliation Summary */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-indigo-100 rounded-lg">
                <FiCheckCircle className="h-4 w-4 text-indigo-600" />
              </div>
              <div>
                <p className="text-xs text-gray-500">Reconciliation Status</p>
                <p className="font-bold text-gray-900 text-lg">
                  {reconciledWallets}/{wallets.length} Wallets
                </p>
              </div>
            </div>
            <div className="text-right">
              <span className={`inline-flex items-center px-2 py-1 rounded text-xs font-medium ${
                reconciledWallets === wallets.length ? 'bg-emerald-50 text-emerald-700' : 'bg-yellow-50 text-yellow-700'
              }`}>
                {reconciledWallets === wallets.length ? 'All Synced' : 'Pending'}
              </span>
            </div>
          </div>
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">Total Variance</span>
              <span className={`font-bold ${totalVariance === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                ₹{totalVariance.toFixed(2)}
              </span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">Wallets Pending</span>
              <span className="font-bold text-rose-600">{wallets.length - reconciledWallets}</span>
            </div>
            <div className="flex items-center justify-between text-xs">
              <span className="text-gray-600">Last Reconciled</span>
              <span className="font-medium text-gray-900">Today</span>
            </div>
          </div>
        </div>

        {/* Wallet Types Distribution */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-bold text-gray-900 text-sm mb-3 flex items-center">
            <FiPieChart className="h-4 w-4 mr-2 text-purple-600" />
            Wallet Types
          </h3>
          <div className="space-y-2">
            {Object.entries(wallets.reduce((acc, w) => {
              const type = w.wallet_type || w.type || 'unknown';
              acc[type] = (acc[type] || 0) + 1;
              return acc;
            }, {})).map(([type, count], index) => (
              <div key={type} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                <div className="flex items-center space-x-2">
                  <div className={`p-1 rounded ${
                    type === 'cash' ? 'bg-emerald-100 text-emerald-600' :
                    type === 'bank' ? 'bg-blue-100 text-blue-600' :
                    type === 'digital' ? 'bg-purple-100 text-purple-600' :
                    'bg-gray-100 text-gray-600'
                  }`}>
                    {type === 'cash' ? <FiDollarSign className="h-3 w-3" /> :
                     type === 'bank' ? <FiCreditCard className="h-3 w-3" /> :
                     <FiSmartphone className="h-3 w-3" />}
                  </div>
                  <span className="text-xs font-medium text-gray-700 capitalize">{type}</span>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-gray-900">{count} wallets</p>
                  <p className="text-xs text-gray-500">
                    ₹{wallets
                      .filter(w => (w.wallet_type || w.type) === type)
                      .reduce((sum, w) => sum + (w.book_balance || 0), 0)
                      .toLocaleString()} 
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quick Actions */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-bold text-gray-900 text-sm mb-3 flex items-center">
            <FiRefreshCw className="h-4 w-4 mr-2 text-blue-600" />
            Quick Actions
          </h3>
          <div className="space-y-2">
            <button
              onClick={onRefreshWallets}
              className="w-full flex items-center justify-between p-2 hover:bg-blue-50 rounded transition-colors"
            >
              <div className="flex items-center space-x-2">
                <FiRefreshCw className="h-4 w-4 text-blue-600" />
                <span className="text-xs font-medium text-gray-900">Refresh Balances</span>
              </div>
              <FiChevronRight className="h-3 w-3 text-gray-400" />
            </button>
            
            <button
              onClick={handleReconcileWallets}
              disabled={isReconciling}
              className={`w-full flex items-center justify-between p-2 rounded transition-colors ${
                isReconciling 
                  ? 'bg-gray-100 cursor-not-allowed' 
                  : 'hover:bg-emerald-50'
              }`}
            >
              <div className="flex items-center space-x-2">
                <FiCheckCircle className={`h-4 w-4 ${
                  isReconciling ? 'text-gray-400' : 'text-emerald-600'
                }`} />
                <span className={`text-xs font-medium ${
                  isReconciling ? 'text-gray-400' : 'text-gray-900'
                }`}>
                  {isReconciling ? 'Reconciling...' : 'Reconcile All Wallets'}
                </span>
              </div>
              {!isReconciling && <FiChevronRight className="h-3 w-3 text-gray-400" />}
            </button>
            
            <button className="w-full flex items-center justify-between p-2 hover:bg-amber-50 rounded transition-colors">
              <div className="flex items-center space-x-2">
                <FiAlertTriangle className="h-4 w-4 text-amber-600" />
                <span className="text-xs font-medium text-gray-900">View Discrepancies</span>
              </div>
              <FiChevronRight className="h-3 w-3 text-gray-400" />
            </button>
          </div>
        </div>
      </div>

      {/* Right Column - Wallet Reconciliation Table */}
      <div className="col-span-2">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-sm flex items-center">
                <FiSmartphone className="h-4 w-4 mr-2 text-indigo-600" />
                Wallet Reconciliation
              </h3>
              <div className="flex items-center space-x-2">
                <span className="text-xs text-gray-600">
                  {wallets.length} wallets to reconcile
                </span>
                <button
                  onClick={onRefreshWallets}
                  className="p-1 hover:bg-gray-200 rounded transition-colors"
                >
                  <FiRefreshCw className="h-3 w-3 text-gray-600" />
                </button>
              </div>
            </div>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full min-w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Wallet</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Book Balance</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actual Balance</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Variance</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                </tr>
              </thead>

              <tbody>
                {wallets.map((wallet, index) => {
                  const walletType = wallet.wallet_type || wallet.type || 'unknown';
                  const WalletIcon = walletIcons[wallet.name] || walletIcons[walletType] || FiSmartphone;
                  const actualBalance = walletBalances[String(wallet.id)] ?? wallet.currentBalance ?? 0;
                  const bookBalance = wallet.book_balance ?? 0;
                  const variance = actualBalance - bookBalance;
                  const isReconciled = Math.abs(variance) <= 10;
                  
                  return (
                    <tr key={wallet.id} className="hover:bg-gray-50">
                      <td className="py-3 px-3">
                        <div className="flex items-center">
                          <div className={`w-8 h-8 rounded-lg flex items-center justify-center mr-2 ${
                            walletType === 'cash' ? 'bg-emerald-500' :
                            walletType === 'bank' ? 'bg-blue-500' :
                            walletType === 'digital' ? 'bg-purple-500' :
                            'bg-indigo-500'
                          }`}>
                            <WalletIcon className="h-4 w-4 text-white" />
                          </div>
                          <div>
                            <p className="text-xs font-medium text-gray-900">{wallet.name}</p>
                            <p className="text-xs text-gray-500 capitalize">{walletType}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          walletType === 'cash' ? 'bg-emerald-100 text-emerald-700' :
                          walletType === 'bank' ? 'bg-blue-100 text-blue-700' :
                          'bg-purple-100 text-purple-700'
                        }`}>
                          {walletType}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <div className="text-left">
                          <p className="text-xs font-bold text-gray-900">
                            ₹{Number(bookBalance).toLocaleString('en-IN')}
                          </p>
                          <p className="text-xs text-gray-500 flex items-center">
                            <FiBook className="h-2 w-2 mr-1" />
                            Ledger
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div>
                          <div className="relative">
                            <span className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-500 text-xs">₹</span>
                            <input
                              type="number"
                              value={actualBalance}
                              onChange={e => handleBalanceChange(String(wallet.id), e.target.value)}
                              className="pl-6 pr-2 py-1 border border-gray-300 rounded text-sm w-32 focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                              placeholder="Enter actual balance"
                            />
                          </div>
                          <p className="text-xs text-gray-500 mt-1 flex items-center">
                            <FiSmartphone className="h-2 w-2 mr-1" />
                            Physical/Digital
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <div className={`text-center ${
                          isReconciled ? 'text-emerald-600' : 'text-rose-600'
                        }`}>
                          <p className={`text-xs font-bold ${isReconciled ? 'text-emerald-600' : 'text-rose-600'}`}>
                            {variance >= 0 ? '+' : ''}₹{variance.toFixed(2)}
                          </p>
                          <p className="text-xs">
                            {isReconciled ? 'Within Limit' : 'Review Needed'}
                          </p>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${
                          isReconciled 
                            ? 'bg-emerald-50 text-emerald-700' 
                            : 'bg-rose-50 text-rose-700'
                        }`}>
                          {isReconciled ? (
                            <>
                              <FiCheck className="h-2 w-2 mr-1" />
                              Reconciled
                            </>
                          ) : (
                            <>
                              <FiAlertCircle className="h-2 w-2 mr-1" />
                              Pending
                            </>
                          )}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Action Bar */}
          <div className="border-t border-gray-200 bg-gray-50 p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2 text-xs text-gray-600">
                <FiInfo className="h-3 w-3" />
                <span>Enter actual balances and click Reconcile to sync all wallets</span>
              </div>
              <button
                onClick={handleReconcileWallets}
                disabled={isReconciling}
                className={`flex items-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium ${
                  isReconciling
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-emerald-600 hover:bg-emerald-700 text-white'
                }`}
              >
                {isReconciling ? (
                  <>
                    <FiRefreshCw className="h-4 w-4 animate-spin" />
                    <span>Reconciling...</span>
                  </>
                ) : (
                  <>
                    <FiCheckCircle className="h-4 w-4" />
                    <span>Reconcile All Wallets</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ======================================================
   EXPENSE MANAGEMENT – UPDATED WITH CORRECTION SUPPORT
====================================================== */
const ExpenseManagement = ({
  expenses,
  onApprove,
  onReject,
  allowAdd = true,
  onAddClick,
  wallets = [],
  onCorrect,
}) => {
  const [newExpense, setNewExpense] = useState({
    description: '',
    amount: '',
    category: 'operational',
    paymentMethod: 'cash',
    requiresApproval: false,
    notes: ''
  });
  const [showAddForm, setShowAddForm] = useState(false);

  // Correction state
  const [showCorrectModal, setShowCorrectModal] = useState(false);
  const [correctingExpense, setCorrectingExpense] = useState(null);
  const [correctionForm, setCorrectionForm] = useState({
    amount: '',
    wallet_id: '',
    reason: ''
  });

  const pendingExpenses = expenses.filter(exp => exp.status === 'pending');
  const nonPendingExpenses = expenses.filter(exp => exp.status !== 'pending');
  const approvedExpenses = nonPendingExpenses.filter(exp => exp.status === 'approved' || exp.status === 'auto_approved');
  const rejectedExpenses = nonPendingExpenses.filter(exp => exp.status === 'rejected');

  const openCorrection = (expense) => {
    setCorrectingExpense(expense);
    setCorrectionForm({
      amount: expense.amount?.toString() || '',
      wallet_id: expense.wallet_id?.toString() || '',
      reason: ''
    });
    setShowCorrectModal(true);
  };

  const handleCorrectionSubmit = (e) => {
    e.preventDefault();
    if (!correctionForm.amount || !correctionForm.wallet_id) {
      alert('Please enter amount and choose a wallet');
      return;
    }
    if (onCorrect) {
      onCorrect(correctingExpense.id, {
        amount: Number(correctionForm.amount),
        wallet_id: Number(correctionForm.wallet_id),
        reason: correctionForm.reason || 'Admin correction'
      });
    }
    setShowCorrectModal(false);
    setCorrectingExpense(null);
  };

  const handleSubmitExpense = () => {
    // not used in admin context
  };

  const expenseCategories = [
    { id: 'operational', label: 'Operational', color: 'bg-blue-100 text-blue-800', icon: FiSettings },
    { id: 'salary', label: 'Salary', color: 'bg-purple-100 text-purple-800', icon: FiUsers },
    { id: 'office', label: 'Office Supplies', color: 'bg-emerald-100 text-emerald-800', icon: FiPackage },
    { id: 'utility', label: 'Utilities', color: 'bg-amber-100 text-amber-800', icon: FiDroplet },
    { id: 'maintenance', label: 'Maintenance', color: 'bg-rose-100 text-rose-800', icon: FiTool },
    { id: 'other', label: 'Other', color: 'bg-gray-100 text-gray-800', icon: FiCircle },
  ];

  const paymentMethodIcons = {
    cash: FiDollarSign,
    bank: FiCreditCard,
    upi: FiSmartphone,
    wallet: FiCreditCard,
  };

  const WALLET_TYPE_META = {
    bank: { label: 'Bank Account', icon: '🏦', color: 'text-blue-600', bg: 'bg-blue-50' },
    cash: { label: 'Cash', icon: '💰', color: 'text-green-600', bg: 'bg-green-50' },
    credit_card: { label: 'Credit Card', icon: '💳', color: 'text-purple-600', bg: 'bg-purple-50' },
    digital: { label: 'Digital Wallet', icon: '📱', color: 'text-indigo-600', bg: 'bg-indigo-50' },
    savings: { label: 'Savings', icon: '🏧', color: 'text-teal-600', bg: 'bg-teal-50' },
  };
  const getWalletMeta = (wallet) => {
    const type = wallet.type || wallet.wallet_type;
    return WALLET_TYPE_META[type] || {
      label: 'Wallet',
      icon: '💼',
      color: 'text-gray-600',
      bg: 'bg-gray-50',
    };
  };
  const formatCurrency = (amount) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(amount || 0);

  const walletBalances = wallets.reduce((acc, w) => {
    acc[w.id] = Number(w.currentBalance ?? w.balance ?? 0);
    return acc;
  }, {});

  return (
    <div className="space-y-4">
      {/* Pending Approvals */}
      {pendingExpenses.length > 0 && (
        <div className="bg-white rounded-lg border border-yellow-200 p-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <FiAlertTriangle className="h-4 w-4 text-yellow-600" />
              </div>
              <div>
                <h4 className="font-bold text-gray-900 text-sm">Pending Approvals</h4>
                <p className="text-xs text-yellow-600 font-medium">{pendingExpenses.length} items require action</p>
              </div>
            </div>
            <span className="text-xs text-yellow-600 font-medium flex items-center">
              <FiClock className="h-3 w-3 mr-1" />
              Requires Action
            </span>
          </div>

          <div className="space-y-2">
            {pendingExpenses.map(expense => {
              const category = expenseCategories.find(cat => cat.id === expense.category);
              const PaymentIcon = paymentMethodIcons[expense.paymentMethod] || FiCreditCard;
              return (
                <motion.div
                  key={expense.id}
                  initial={{ opacity: 0, x: -10 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg border border-yellow-200"
                >
                  <div className="flex-1">
                    <div className="flex items-center space-x-2 mb-2">
                      <div className="p-1 bg-white rounded border border-yellow-200">
                        {category && React.createElement(category.icon, { className: "h-3 w-3 text-yellow-600" })}
                      </div>
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{expense.description}</p>
                        <div className="flex flex-wrap items-center gap-1 mt-0.5">
                          <span className="text-xs text-gray-600 flex items-center">
                            <PaymentIcon className="h-2 w-2 mr-1" />
                            {expense.paymentMethod}
                          </span>
                          <span className="text-xs text-gray-600">•</span>
                          <span className="text-xs text-gray-600">by {expense.submittedBy}</span>
                          <span className="text-xs text-gray-600">•</span>
                          <span className="text-xs text-gray-600">{expense.date}</span>
                        </div>
                      </div>
                    </div>
                    {expense.notes && (
                      <p className="text-xs text-gray-600 mt-1 flex items-start">
                        <FiMessageSquare className="h-2 w-2 mr-1 mt-0.5 flex-shrink-0" />
                        {expense.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex flex-col items-end space-y-1 ml-2">
                    <p className="font-bold text-gray-900 text-sm">
                      ₹{Number(expense.amount || 0).toLocaleString('en-IN', {
                        minimumFractionDigits: 2
                      })}
                    </p>
                    <div className="flex space-x-1">
                      <button
                        onClick={() => onApprove(expense.id)}
                        className="px-2 py-1 bg-emerald-600 text-white rounded hover:bg-emerald-700 text-xs flex items-center space-x-1"
                      >
                        <FiCheck className="h-2 w-2" />
                        <span>Approve</span>
                      </button>
                      <button
                        onClick={() => onReject(expense.id)}
                        className="px-2 py-1 bg-rose-600 text-white rounded hover:bg-rose-700 text-xs flex items-center space-x-1"
                      >
                        <FiX className="h-2 w-2" />
                        <span>Reject</span>
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </div>
      )}

      {/* Non‑Pending with correct option */}
      {nonPendingExpenses.length > 0 && (
        <div className="space-y-2">
          {/* Approved / Auto‑Approved */}
          {approvedExpenses.length > 0 && (
            <div className="bg-white rounded-lg border border-emerald-200 p-4">
              <h4 className="font-semibold text-gray-900 text-sm mb-3 flex items-center">
                <FiCheckCircle className="h-4 w-4 mr-2 text-emerald-600" />
                Approved / Auto‑Approved ({approvedExpenses.length})
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {approvedExpenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="p-3 rounded-lg border border-emerald-100 bg-emerald-50 flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {expense.description || expense.category}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                        <span>{expense.date}</span>
                        <span>•</span>
                        <span>{expense.staff_name || 'Staff'}</span>
                        <span>•</span>
                        <span>{expense.wallet_name || 'Wallet'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-emerald-700 text-sm whitespace-nowrap">
                        {formatCurrency(expense.amount)}
                      </span>
                      {onCorrect && (
                        <button
                          onClick={() => openCorrection(expense)}
                          className="p-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                          title="Correct this expense"
                        >
                          <FiRefreshCw className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Rejected */}
          {rejectedExpenses.length > 0 && (
            <div className="bg-white rounded-lg border border-rose-200 p-4">
              <h4 className="font-semibold text-gray-900 text-sm mb-3 flex items-center">
                <FiXCircle className="h-4 w-4 mr-2 text-rose-600" />
                Rejected ({rejectedExpenses.length})
              </h4>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {rejectedExpenses.map((expense) => (
                  <div
                    key={expense.id}
                    className="p-3 rounded-lg border border-rose-100 bg-rose-50 flex items-center justify-between"
                  >
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">
                        {expense.description || expense.category}
                      </p>
                      <div className="flex items-center gap-2 text-xs text-gray-500 mt-1">
                        <span>{expense.date}</span>
                        <span>•</span>
                        <span>{expense.staff_name || 'Staff'}</span>
                        <span>•</span>
                        <span>{expense.wallet_name || 'Wallet'}</span>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="font-semibold text-rose-700 text-sm whitespace-nowrap">
                        {formatCurrency(expense.amount)}
                      </span>
                      {onCorrect && (
                        <button
                          onClick={() => openCorrection(expense)}
                          className="p-1.5 rounded-lg bg-blue-100 text-blue-700 hover:bg-blue-200 transition-colors"
                          title="Correct this expense"
                        >
                          <FiRefreshCw className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Expense Summary Cards */}
      <div className="grid gap-3 grid-cols-3">
        <div className="bg-white rounded-lg border border-emerald-200 p-3 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-1">
            <h5 className="font-medium text-gray-900 text-xs flex items-center">
              <FiCheckCircle className="h-3 w-3 mr-1 text-emerald-600" />
              Approved
            </h5>
          </div>
          <p className="font-bold text-emerald-600 text-sm">
            {formatCurrency(
              expenses
                .filter(e => e.status === 'approved' || e.status === 'auto_approved')
                .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
            )}
          </p>
          <p className="text-xs text-gray-600 mt-0.5 flex items-center">
            <FiPackage className="h-2 w-2 mr-1" />
            {expenses.filter(e => e.status === 'approved' || e.status === 'auto_approved').length} items
          </p>
        </div>

        <div className="bg-white rounded-lg border border-yellow-200 p-3 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-1">
            <h5 className="font-medium text-gray-900 text-xs flex items-center">
              <FiClock className="h-3 w-3 mr-1 text-yellow-600" />
              Pending
            </h5>
          </div>
          <p className="font-bold text-yellow-600 text-sm">
            {formatCurrency(
              expenses
                .filter(e => e.status === 'pending')
                .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
            )}
          </p>
          <p className="text-xs text-gray-600 mt-0.5 flex items-center">
            <FiAlertCircle className="h-2 w-2 mr-1" />
            {expenses.filter(e => e.status === 'pending').length} items
          </p>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-3 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-1">
            <h5 className="font-medium text-gray-900 text-xs flex items-center">
              <FiDollarSign className="h-3 w-3 mr-1 text-gray-600" />
              Total
            </h5>
          </div>
          <p className="font-bold text-gray-900 text-sm">
            {formatCurrency(
              expenses
                .filter(e => e.status !== 'rejected')
                .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
            )}
          </p>
          <p className="text-xs text-gray-600 mt-0.5 flex items-center">
            <FiDatabase className="h-2 w-2 mr-1" />
            {expenses.length} items
          </p>
        </div>
      </div>

      {/* Add Expense Button */}
      {allowAdd && !showAddForm && onAddClick && (
        <div className="flex justify-center">
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onAddClick}
            className="flex items-center space-x-2 px-3 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-all text-sm"
          >
            <FiPlusCircle className="h-4 w-4" />
            <span className="font-medium">Add New Expense</span>
          </motion.button>
        </div>
      )}

      {/* Correction Modal */}
      <AnimatePresence>
        {showCorrectModal && correctingExpense && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-40 z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-gray-200"
            >
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">Correct Expense</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Original: {correctingExpense.description} – {formatCurrency(correctingExpense.amount)} on {correctingExpense.expense_date || correctingExpense.date}
                </p>
              </div>
              <form onSubmit={handleCorrectionSubmit} className="p-6 space-y-4">
                {/* New Amount */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    New Amount (₹) *
                  </label>
                  <input
                    type="number"
                    value={correctionForm.amount}
                    onChange={(e) =>
                      setCorrectionForm((prev) => ({ ...prev, amount: e.target.value }))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    required
                    min="0"
                    step="0.01"
                  />
                </div>

                {/* New Wallet */}
                {wallets.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      New Wallet *
                    </label>
                    <div className="space-y-2 max-h-40 overflow-y-auto">
                      {wallets.map((wallet) => (
                        <label
                          key={wallet.id}
                          className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${
                            correctionForm.wallet_id === wallet.id.toString()
                              ? 'border-blue-500 bg-blue-50'
                              : 'border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <input
                              type="radio"
                              name="correction_wallet"
                              value={wallet.id.toString()}
                              checked={correctionForm.wallet_id === wallet.id.toString()}
                              onChange={(e) =>
                                setCorrectionForm((prev) => ({
                                  ...prev,
                                  wallet_id: e.target.value,
                                }))
                              }
                              className="sr-only"
                              required
                            />
                            <span className="text-xl">{getWalletMeta(wallet).icon}</span>
                            <div>
                              <p className="font-medium text-gray-900 text-sm">{wallet.name}</p>
                              <p className="text-xs text-gray-500">{getWalletMeta(wallet).label}</p>
                            </div>
                          </div>
                          <span className="text-sm font-semibold text-gray-700">
                            {formatCurrency(walletBalances[wallet.id] ?? 0)}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reason */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Reason for Correction
                  </label>
                  <textarea
                    value={correctionForm.reason}
                    onChange={(e) =>
                      setCorrectionForm((prev) => ({ ...prev, reason: e.target.value }))
                    }
                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    rows="3"
                    placeholder="Explain why you are correcting this expense..."
                  />
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button
                    type="button"
                    onClick={() => setShowCorrectModal(false)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium text-sm"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium text-sm flex items-center gap-2"
                  >
                    <FiRefreshCw className="h-4 w-4" />
                    Submit Correction
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

/* ======================================================
   MAIN ACCOUNTING SECTION
====================================================== */
const AccountingSection = ({ 
  user,
  accountingData = {
    wallets: [],
    income: { rows: [] },
    ledger: { rows: [] },
    expenses: [],
    dailySummary: {},
    nightlyAccounting: {},
    walletReconciliations: []
  },
  onUpdateAccounting = () => {},
  wallets = [],
  staff = [],
  centreId,
  readOnly = false,
  isSuperAdmin = false
}) => {
  const [activeAccountingTab, setActiveAccountingTab] = useState('daily');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [showAdminExpenseModal, setShowAdminExpenseModal] = useState(false);
  const [showMiscIncomeModal, setShowMiscIncomeModal] = useState(false);
  const [miscIncomeForm, setMiscIncomeForm] = useState({
    amount: '',
    wallet_id: '',
    description: '',
    date: new Date().toISOString().split('T')[0]
  });

  const handleMiscIncomeSubmit = async (e) => {
    e.preventDefault();
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/accounting/misc-income`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(miscIncomeForm)
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Failed to add misc income');
      }
      toast.success('Misc Income recorded successfully!');
      setShowMiscIncomeModal(false);
      setMiscIncomeForm({ amount: '', wallet_id: '', description: '', date: new Date().toISOString().split('T')[0] });
      
      // Force a full refresh so Wallet balances and the Ledger update instantly
      handleRefreshAllData(); 
    } catch (err) {
      toast.error(err.message);
    }
  };
  const [loading, setLoading] = useState(false);

  const [ledgerFilters, setLedgerFilters] = useState({
    from: date,
    to: date,
    staff_id: '',
    wallet_id: '',
    category: ''
  });

  useEffect(() => {
    if (activeAccountingTab === 'ledger') {
      setLedgerFilters(prev => ({
        ...prev,
        from: date,
        to: date
      }));
    }
  }, [date, activeAccountingTab]);

  const derivedWallets = Array.isArray(accountingData?.wallets) && accountingData.wallets.length > 0
    ? accountingData.wallets
    : wallets;

  const calculateCashInHand = () => {
    return derivedWallets
      .filter(wallet => wallet.type?.toLowerCase() === 'cash')
      .reduce((sum, wallet) => sum + (Number(wallet.currentBalance) || 0), 0);
  };

  const calculateBankBalance = () => {
    return derivedWallets
      .filter(wallet => wallet.type?.toLowerCase() === 'bank')
      .reduce((sum, wallet) => sum + (Number(wallet.currentBalance) || 0), 0);
  };

  const calculateDigitalBalance = () => {
    return derivedWallets
      .filter(wallet => wallet.type?.toLowerCase() === 'digital')
      .reduce((sum, wallet) => sum + (Number(wallet.currentBalance) || 0), 0);
  };

  const calculateTotalWalletBalance = () => {
    return derivedWallets.reduce((sum, wallet) => 
      sum + (Number(wallet.currentBalance) || 0), 0);
  };

  const refreshWalletBookBalances = async () => {
    const walletParams = new URLSearchParams();
    
    if (isSuperAdmin && centreId) {
      walletParams.append("centreId", centreId);
    }

    const res = await fetch(
      `${import.meta.env.VITE_API_URL}/api/accounting/wallet-book-balances?${walletParams.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`
        }
      }
    );

    const data = await res.json();
    
    console.log("Raw wallet data from backend:", data);

    const merged = data.map(item => ({
      id: item.id,
      name: item.name,
      type: item.wallet_type || 'unknown',
      wallet_type: item.wallet_type || 'unknown',
      currentBalance: Number(item.book_balance || 0),
      book_balance: Number(item.book_balance || 0)
    }));

    console.log("Processed wallet data:", merged);

    onUpdateAccounting("wallets", merged);
  };

  const getExpensesForDate = useMemo(() => {
    return (expenses, targetDate) => {
      return expenses.filter(e => e.date === targetDate);
    };
  }, []);

  const expensesForCurrentDate = useMemo(() => {
    return getExpensesForDate(accountingData.expenses, date);
  }, [accountingData.expenses, date, getExpensesForDate]);

  const buildQueryString = (params = {}) => {
    const allParams = { ...params };
    
    if (isSuperAdmin && centreId) {
      allParams.centreId = centreId;
    }
    
    return new URLSearchParams(allParams).toString();
  };

  // ---------- Fetch initial data ----------
  useEffect(() => {
    const fetchAllInitialData = async () => {
      setLoading(true);
      try {
        // Fetch daily summary
        const dailyRes = await fetch(
          `${import.meta.env.VITE_API_URL}/api/accounting/daily-summary?${buildQueryString({ date })}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`
            }
          }
        );
        if (dailyRes.ok) {
          const dailyData = await dailyRes.json();
          onUpdateAccounting("dailySummary", dailyData);
        }
        
        // Fetch income
        const incomeRes = await fetch(
          `${import.meta.env.VITE_API_URL}/api/accounting/income?${buildQueryString({ date })}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`
            }
          }
        );

        if (incomeRes.ok) {
          const incomeData = await incomeRes.json();
          onUpdateAccounting?.("income", incomeData);
        }

        // Fetch ledger data
        const ledgerRes = await fetch(
          `${import.meta.env.VITE_API_URL}/api/accounting/ledger?${buildQueryString({
            from: date,
            to: date
          })}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`
            }
          }
        );
        if (ledgerRes.ok) {
          const ledgerData = await ledgerRes.json();
          onUpdateAccounting('ledger', ledgerData);
        }

        // Fetch expenses
        const expenseRes = await fetch(
          `${import.meta.env.VITE_API_URL}/api/expense?${buildQueryString()}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`
            }
          }
        );

        if (expenseRes.ok) {
          const rawExpenseData = await expenseRes.json();
          const mappedExpenseData = rawExpenseData.map(item => ({
            ...item,
            date: item.expense_date
              ? item.expense_date.slice(0, 10)
              : item.date,
            status: item.status === 'auto_approved'
              ? 'approved'
              : item.status?.toLowerCase()
          }));

          onUpdateAccounting?.('expenses', mappedExpenseData);
        }

        // Refresh wallet balances
        await refreshWalletBookBalances();

        // Fetch nightly closure data
        const nightlyRes = await fetch(
          `${import.meta.env.VITE_API_URL}/api/accounting/nightly-close?${buildQueryString({ date })}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem("token")}`
            }
          }
        );

        if (nightlyRes.ok) {
          const closureData = await nightlyRes.json();

          if (closureData) {
            const existingData = {
              checklist: closureData.checklist || {
                incomeEntryVerified: false,
                expenseEntryVerified: false,
                bankEntryReconciled: false,
                dailySummaryCompleted: false,
                cashReconciled: false,
                walletBalancesVerified: false
              },
              notes: closureData.notes || '',
              closingCash: closureData.closing_balance?.toString() || '',
              actualCashCount: closureData.actual_cash?.toString() || '',
              timestamp: closureData.closed_at || closureData.created_at
            };

            onUpdateAccounting?.('nightlyAccounting', {
              ...accountingData.nightlyAccounting,
              [date]: existingData
            });
          }
        }
        toast.success("Accounting data loaded successfully!");
      } catch (error) {
        console.error("Error fetching initial accounting data:", error);
        toast.error("Failed to load some accounting data");
      } finally {
        setLoading(false);
      }
    };

    fetchAllInitialData();
  }, [date, centreId, isSuperAdmin]);

  // ---------- Tab‑specific data ----------
  useEffect(() => {
    if (activeAccountingTab === 'income' && !accountingData.income?.rows) {
      fetchIncome();
    }
  }, [activeAccountingTab]);

  useEffect(() => {
    if (activeAccountingTab === 'ledger') {
      fetchLedger();
    }
  }, [activeAccountingTab, ledgerFilters, date]);

  useEffect(() => {
    if (activeAccountingTab === 'expenses' && !accountingData.expenses.length) {
      fetchExpenses();
    }
  }, [activeAccountingTab]);

  useEffect(() => {
    if (activeAccountingTab === 'wallets') {
      refreshWalletBookBalances();
    }
  }, [activeAccountingTab]);

  const fetchIncome = async () => {
    const res = await fetch(
      `${import.meta.env.VITE_API_URL}/api/accounting/income?${buildQueryString({ date })}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`
        }
      }
    );

    const data = await res.json();
    onUpdateAccounting('income', data);
  };

  const fetchLedger = async () => {
    const params = {
      from: ledgerFilters.from || date,
      to: ledgerFilters.to || date,
    };

    if (ledgerFilters.staff_id) params.staff_id = ledgerFilters.staff_id;
    if (ledgerFilters.wallet_id) params.wallet_id = ledgerFilters.wallet_id;
    if (ledgerFilters.category) params.category = ledgerFilters.category;

    const res = await fetch(
      `${import.meta.env.VITE_API_URL}/api/accounting/ledger?${buildQueryString(params)}`,
      {
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`
        }
      }
    );

    const data = await res.json();
    onUpdateAccounting('ledger', data);
  };

  const fetchExpenses = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/expense?${buildQueryString()}`, 
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`
          }
        }
      );

      if (!res.ok) {
        console.error("Expense fetch failed");
        return;
      }

      const rawData = await res.json();
      
      const mappedData = rawData.map(item => ({
        ...item,
        date: item.expense_date
          ? item.expense_date.slice(0, 10)
          : item.date,

        status: item.status === 'auto_approved'
          ? 'approved'
          : item.status?.toLowerCase()
      }));
      
      onUpdateAccounting('expenses', mappedData);
      
    } catch (error) {
      console.error("Error fetching expenses:", error);
    }
  };

  const accountingTabs = [
    { id: 'daily', label: 'Daily Accounting', icon: FiCalendar },
    { id: 'income', label: 'Income View', icon: FiTrendingUp },
    { id: 'ledger', label: 'Ledger', icon: FiBook },
    { id: 'expenses', label: 'Expenses', icon: FiTrendingDown },
    { id: 'wallets', label: 'Wallet Recon', icon: FiSmartphone },
    { id: 'reports', label: 'Reports', icon: FiFileText }
  ];

  const handleLedgerRowClick = (tx) => {
    const category = tx.category;

    if (category === 'Service Payment' || category === 'Department Payment') {
      openServiceFromLedger(tx);
      return;
    }

    if (category === 'Expense' || category === 'Salary Advance') {
      openExpenseFromLedger(tx);
      return;
    }

    if (category === 'Transfer') {
      toast.info('This is an internal wallet transfer');
      return;
    }

    toast.info('No detailed view available for this transaction');
  };

  const openServiceFromLedger = (tx) => {
    setActiveAccountingTab('income');
    toast.info(
      `Showing service entries for ${tx.staff_name || 'staff'} on ${new Date(tx.created_at).toLocaleDateString()}`
    );
  };

  const openExpenseFromLedger = (tx) => {
    setActiveAccountingTab('expenses');
    toast.info(
      `Showing expenses for ${tx.staff_name || 'staff'} on ${new Date(tx.created_at).toLocaleDateString()}`
    );
  };

  const handleApproveExpense = async (expenseId) => {
    await fetch(
      `${import.meta.env.VITE_API_URL}/api/expense/${expenseId}/approve`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`
        }
      }
    );

    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/expense?${buildQueryString()}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
    });
    onUpdateAccounting('expenses', await res.json());
  };

  const handleRejectExpense = async (expenseId) => {
    await fetch(
      `${import.meta.env.VITE_API_URL}/api/expense/${expenseId}/reject`,
      {
        method: 'PUT',
        headers: {
          Authorization: `Bearer ${localStorage.getItem("token")}`
        }
      }
    );

    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/expense?${buildQueryString()}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
    });
    onUpdateAccounting('expenses', await res.json());
  };

  // ---------- CORRECTION HANDLER ----------
  const handleCorrectExpense = async (expenseId, payload) => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/expense/${expenseId}/correct`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify(payload),
        }
      );
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Correction failed');
      }
      toast.success('Expense corrected successfully');
      // Refresh both expenses and wallets
      await fetchExpenses();
      await refreshWalletBookBalances();
    } catch (error) {
      toast.error(error.message || 'Failed to correct expense');
    }
  };

  const handleAdminExpenseSubmit = async (payload) => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/expense?${buildQueryString()}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || "Failed to create expense");
      }

      // 🔥 FIX: Use your existing fetchExpenses function so the data gets mapped correctly!
      await fetchExpenses();
      
      // 🔥 FIX: Also refresh wallet balances so the UI updates the deducted amount instantly
      await refreshWalletBookBalances();
      
      toast.success("Expense added successfully!");
      setShowAdminExpenseModal(false);
      
    } catch (err) {
      toast.error(err.message || "Failed to add expense");
    }
  };

  const handleUpdateDailySummary = async (summary) => {
      // 1. Update UI instantly
      onUpdateAccounting('dailySummary', {
        ...accountingData.dailySummary,
        ...summary
      });

      // 2. 🔥 Send the new value to our newly created backend route
      if (summary.actualCashInHand !== undefined) {
        try {
          await fetch(`${import.meta.env.VITE_API_URL}/api/accounting/daily-summary/actual-cash`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${localStorage.getItem('token')}`
            },
            body: JSON.stringify({
              date: date,
              actual_cash: summary.actualCashInHand
            })
          });
        } catch (error) {
          console.error('Failed to save actual cash in hand:', error);
          toast.error('Failed to save Actual Cash to the database.');
        }
      }
    };

  const handleCompleteNightlyAccounting = async (payload) => {
    try {
      const openingBalance = accountingData.dailySummary?.derived?.openingBalance || 0;
      
      const finalPayload = {
        ...payload,
        opening_balance: openingBalance
      };

      const saveRes = await fetch(`${import.meta.env.VITE_API_URL}/api/accounting/nightly-close?${buildQueryString()}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`
        },
        body: JSON.stringify(finalPayload)
      });

      if (!saveRes.ok) {
        throw new Error('Failed to save nightly accounting closure');
      }

      const result = await saveRes.json();

      const existingData = {
        checklist: payload.checklist,
        notes: payload.notes,
        closingCash: payload.closing_balance?.toString(),
        actualCashCount: payload.actual_cash?.toString(),
        timestamp: new Date().toISOString()
      };

      onUpdateAccounting('nightlyAccounting', {
        ...accountingData.nightlyAccounting,
        [date]: existingData
      });

      toast.success('Nightly accounting completed and saved successfully!');
      
    } catch (error) {
      console.error('Error completing nightly accounting:', error);
      toast.error('Failed to save nightly accounting closure');
    }
  };

  const handleReconcileWallets = (reconciliations) => {
    onUpdateAccounting('walletReconciliations', [
      ...accountingData.walletReconciliations,
      ...reconciliations.map(r => ({
        ...r,
        date,
        reconciledBy: 'Admin'
      }))
    ]);
  };

  const totalRevenue = accountingData.income?.rows?.reduce((sum, row) => 
    sum + Number(row.received_amount || 0), 0) || 0;
  
  const totalServiceCharges = accountingData.income?.rows?.reduce((sum, row) => {
    const received = Number(row.received_amount || 0);
    const serviceCharge = Number(row.service_charges || 0);
    const departmentCharge = Number(row.department_charges || 0);
    const totalBilled = serviceCharge + departmentCharge;
    
    if (totalBilled > 0 && received > 0) {
      const paymentRatio = received / totalBilled;
      return sum + (serviceCharge * paymentRatio);
    } else if (received > 0 && totalBilled === 0) {
      return sum + received;
    }
    return sum;
  }, 0) || 0;
  
  const todayExpenses = expensesForCurrentDate
    .filter(e => e.status === 'approved')
    .reduce((sum, e) => sum + Number(e.amount || 0), 0);
  
  const todayProfit = totalServiceCharges - todayExpenses;

  const pendingApprovals = expensesForCurrentDate
    .filter(e => e.status === 'pending').length;

  const handleRefreshAllData = async () => {
    setLoading(true);
    try {
      const headers = {
        Authorization: `Bearer ${localStorage.getItem("token")}`
      };

      // 1. Refresh Daily Summary
      const dailyRes = await fetch(
        `${import.meta.env.VITE_API_URL}/api/accounting/daily-summary?${buildQueryString({ date })}`,
        { headers }
      );
      if (dailyRes.ok) {
        const dailyData = await dailyRes.json();
        onUpdateAccounting("dailySummary", dailyData);
      }

      // 2. Refresh Income
      const incomeRes = await fetch(
        `${import.meta.env.VITE_API_URL}/api/accounting/income?${buildQueryString({ date })}`,
        { headers }
      );
      if (incomeRes.ok) {
        const incomeData = await incomeRes.json();
        onUpdateAccounting('income', incomeData);
      }

      // 3. Refresh Wallet Balances
      await refreshWalletBookBalances();

      toast.success("All data refreshed!");
    } catch (error) {
      console.error("Refresh error:", error);
      toast.error("Failed to refresh data");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Accounting Dashboard Header */}
      <div className="bg-white rounded-lg border border-gray-200 p-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-gray-900 mb-1 flex items-center">
              <FiFileText className="h-5 w-5 mr-2 text-indigo-600" />
              Accounting Center
            </h2>
            <p className="text-gray-600 text-xs">Daily financial management and reconciliation</p>
          </div>
          <div className="flex items-center space-x-3">
            <div className="relative">
              <FiCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
              />
            </div>
            <button
              onClick={handleRefreshAllData}
              disabled={loading}
              className="p-2 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200 disabled:opacity-50 disabled:cursor-not-allowed"
              title="Refresh all data"
            >
              <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-5 gap-3 mt-4">
          <StatCard
            title="Today's Revenue"
            value={`₹${totalRevenue.toLocaleString()}`}
            subtitle="Total collected amount"
            icon={FiDollarSign}
            color="bg-emerald-600"
          />
          <StatCard
            title="Today's Profit"
            value={`₹${todayProfit.toLocaleString()}`}
            subtitle="Service charges minus expenses"
            icon={FiTrendingUp}
            color="bg-indigo-600"
          />
          <StatCard
            title="Pending Approvals"
            value={pendingApprovals}
            subtitle="Requires action"
            icon={FiAlertCircle}
            color="bg-yellow-600"
          />
          <StatCard
            title="Cash in Hand"
            value={`₹${calculateCashInHand().toLocaleString()}`}
            subtitle="Physical cash wallets"
            icon={FiDollarSign}
            color="bg-amber-600"
          />
          <StatCard
            title="Total Wallet Balance"
            value={`₹${calculateTotalWalletBalance().toLocaleString()}`}
            subtitle="All wallets combined"
            icon={FiSmartphone}
            color="bg-purple-600"
          />
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 flex items-center justify-center">
          <FiRefreshCw className="animate-spin h-6 w-6 text-indigo-600" />
          <span className="ml-2 text-gray-600">Loading accounting data...</span>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="border-b border-gray-200 bg-gray-50">
            <div className="flex overflow-x-auto px-2">
              {accountingTabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeAccountingTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveAccountingTab(tab.id)}
                    className={`flex items-center space-x-2 px-4 py-3 font-medium whitespace-nowrap border-b-2 transition-colors text-sm ${
                      isActive
                        ? 'border-indigo-500 text-indigo-600 bg-white'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="p-4">
            {/* Daily Accounting */}
            {activeAccountingTab === 'daily' && (
              <div className="space-y-4">
                <NightlyAccountingChecklist
                  date={date}
                  onComplete={handleCompleteNightlyAccounting}
                  existingData={accountingData.nightlyAccounting?.[date]}
                />
                
                <DailySummaryComponent
                  summaryData={accountingData.dailySummary}
                  onUpdate={handleUpdateDailySummary}
                />
              </div>
            )}

            {/* Income View */}
            {activeAccountingTab === 'income' && (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-sm font-semibold text-gray-900 flex items-center">
                    <FiTrendingUp className="h-4 w-4 mr-2 text-emerald-600" />
                    Income & Collections
                  </h2>
                  <button
                    onClick={() => setShowMiscIncomeModal(true)}
                    className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center space-x-1 text-sm shadow-sm"
                  >
                    <FiPlusCircle className="h-4 w-4" />
                    <span>Add Misc Income</span>
                  </button>
                </div>
                <IncomeViewComponent
                  transactions={accountingData.income || []}
                />
              </>
            )}

            {/* Ledger View */}
            {activeAccountingTab === 'ledger' && (
              <div className="space-y-4">
                {/* Ledger Filters */}
                <div className="grid grid-cols-6 gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <input
                    type="date"
                    value={ledgerFilters.from || date}
                    onChange={(e) =>
                      setLedgerFilters(prev => ({ ...prev, from: e.target.value }))
                    }
                    className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="From date"
                  />

                  <input
                    type="date"
                    value={ledgerFilters.to || date}
                    onChange={(e) =>
                      setLedgerFilters(prev => ({ ...prev, to: e.target.value }))
                    }
                    className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    placeholder="To date"
                  />

                  <select
                    value={ledgerFilters.staff_id}
                    onChange={(e) =>
                      setLedgerFilters(prev => ({ ...prev, staff_id: e.target.value }))
                    }
                    className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">All Staff</option>
                      {staff?.map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                  </select>

                  <select
                    value={ledgerFilters.wallet_id}
                    onChange={(e) =>
                      setLedgerFilters(prev => ({ ...prev, wallet_id: e.target.value }))
                    }
                    className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">All Wallets</option>
                      {wallets?.map(w => (
                       <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                  </select>

                  <select
                    value={ledgerFilters.category}
                    onChange={(e) =>
                      setLedgerFilters(prev => ({ ...prev, category: e.target.value }))
                    }
                    className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-indigo-500"
                  >
                    <option value="">All Categories</option>
                    <option value="Service Payment">Service Payment</option>
                    <option value="Department Payment">Department Payment</option>
                    <option value="Expense">Expense</option>
                    <option value="Salary">Salary</option>
                    <option value="Salary Advance">Salary Advance</option>
                    <option value="Transfer">Transfer</option>
                  </select>

                  <button
                    onClick={() => {
                      setLedgerFilters({
                        from: date,
                        to: date,
                        staff_id: '',
                        wallet_id: '',
                        category: ''
                      });
                    }}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 flex items-center justify-center"
                  >
                    <FiRefreshCw className="h-3 w-3 mr-1" />
                    Reset to Current Filter
                  </button>
                </div>

                {/* Ledger Table */}
                <LedgerView
                  ledger={accountingData.ledger?.rows || []}
                  onLedgerRowClick={handleLedgerRowClick}
                />
              </div>
            )}

            {/* Expenses (with correction) */}
            {activeAccountingTab === 'expenses' && (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-sm font-semibold text-gray-900 flex items-center">
                    <FiTrendingDown className="h-4 w-4 mr-2 text-indigo-600" />
                    Expenses
                  </h2>

                  <button
                    onClick={() => setShowAdminExpenseModal(true)}
                    className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center space-x-1 text-sm"
                  >
                    <FiPlusCircle className="h-4 w-4" />
                    <span>Add Expense</span>
                  </button>
                </div>

                <ExpenseManagement
                  expenses={expensesForCurrentDate}
                  onApprove={handleApproveExpense}
                  onReject={handleRejectExpense}
                  onCorrect={handleCorrectExpense}
                  wallets={derivedWallets}
                  allowAdd={false}
                />
              </>
            )}

            {/* Wallet Reconciliation */}
            {activeAccountingTab === 'wallets' && (
              <WalletReconciliation
                wallets={derivedWallets}
                onReconcile={handleReconcileWallets}
                onRefreshWallets={refreshWalletBookBalances}
              />
            )}

{/* Reports */}
            {activeAccountingTab === 'reports' && (
              <div className="space-y-6">
                {/* Report Header with Export Options */}
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 flex items-center">
                      <FiFileText className="h-5 w-5 mr-2 text-indigo-600" />
                      Financial Reports & Analytics
                    </h2>
                    <p className="text-gray-600 text-sm mt-1">Comprehensive financial insights and analysis</p>
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-600">Period:</span>
                      <select className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500">
                        <option>Today</option>
                        <option>This Week</option>
                        <option>This Month</option>
                        <option>This Quarter</option>
                        <option>This Year</option>
                        <option>Custom Range</option>
                      </select>
                    </div>
                    <button className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm">
                      <FiDownload className="h-4 w-4" />
                      <span>Export Report</span>
                    </button>
                  </div>
                </div>

                {/* Key Performance Indicators */}
                <div className="grid grid-cols-4 gap-4">
                  {/* Revenue KPI */}
                  <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 bg-emerald-100 rounded-lg">
                        <FiTrendingUp className="h-5 w-5 text-emerald-600" />
                      </div>
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">+12.5%</span>
                    </div>
                    <p className="text-sm text-gray-600">Total Revenue</p>
                    <p className="text-2xl font-bold text-gray-900">₹{totalRevenue.toLocaleString()}</p>
                    <div className="mt-2 flex items-center text-xs text-gray-500">
                      <span>Services: {(accountingData.income?.rows?.length || 0)}</span>
                      <div className="w-1 h-1 mx-2 bg-gray-300 rounded-full"></div>
                      <span>Avg: ₹{(totalRevenue/(accountingData.income?.rows?.length || 1)).toFixed(2)}</span>
                    </div>
                  </div>

                  {/* Expenses KPI */}
                  <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 bg-rose-100 rounded-lg">
                        <FiTrendingDown className="h-5 w-5 text-rose-600" />
                      </div>
                      <span className="text-xs bg-rose-100 text-rose-700 px-2 py-1 rounded-full">-8.2%</span>
                    </div>
                    <p className="text-sm text-gray-600">Total Expenses</p>
                    <p className="text-2xl font-bold text-gray-900">₹{todayExpenses.toLocaleString()}</p>
                    <div className="mt-2 flex items-center text-xs text-gray-500">
                      <span>Approved: {expensesForCurrentDate.filter(e => e.status === 'approved').length}</span>
                      <div className="w-1 h-1 mx-2 bg-gray-300 rounded-full"></div>
                      <span>Pending: {pendingApprovals}</span>
                    </div>
                  </div>

                  {/* Profit KPI */}
                  <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 bg-indigo-100 rounded-lg">
                        <FiDollarSign className="h-5 w-5 text-indigo-600" />
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${todayProfit >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {todayProfit >= 0 ? '+' : ''}{totalServiceCharges > 0 ? ((todayProfit/totalServiceCharges)*100).toFixed(1) : '0'}%
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">Net Profit</p>
                    <p className="text-2xl font-bold text-gray-900">₹{totalServiceCharges.toLocaleString()}</p>
                    <div className="mt-2 text-xs text-gray-500">
                      Service Charges • {(accountingData.income?.rows?.length || 0)} services
                    </div>
                  </div>

                  {/* Cash Flow KPI */}
                  <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 bg-blue-100 rounded-lg">
                        <FiActivity className="h-5 w-5 text-blue-600" />
                      </div>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">Real-time</span>
                    </div>
                    <p className="text-sm text-gray-600">Cash in Hand</p>
                    <p className="text-2xl font-bold text-gray-900">₹{calculateCashInHand().toLocaleString()}</p>
                    <div className="mt-2 text-xs text-gray-500">
                      From {derivedWallets.filter(w => w.type?.toLowerCase() === 'cash').length} cash wallets
                    </div>
                  </div>
                </div>

                {/* Detailed Reports Grid */}
                <div className="grid grid-cols-2 gap-6">
                  {/* Income Breakdown */}
                  <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-gray-900 text-sm flex items-center">
                        <FiTrendingUp className="h-4 w-4 mr-2 text-emerald-600" />
                        Income Breakdown
                      </h3>
                      <button className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center">
                        <FiEye className="h-3 w-3 mr-1" />
                        View Details
                      </button>
                    </div>
                    
                    <div className="space-y-4">
                      {/* Service Charges vs Department Charges */}
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                            <div>
                              <span className="text-xs font-medium text-gray-900">Service Charges (Profit)</span>
                              <p className="text-xs text-gray-500">Our earnings from services</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-gray-900">
                              ₹{totalServiceCharges.toLocaleString()}
                            </p>
                            <p className="text-xs text-emerald-600 font-medium">
                              {totalRevenue > 0 ? 
                                `${((totalServiceCharges/totalRevenue)*100).toFixed(1)}% of revenue` : 
                                '0%'}
                            </p>
                          </div>
                        </div>
                        
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                            <div>
                              <span className="text-xs font-medium text-gray-900">Department Charge (Cost)</span>
                              <p className="text-xs text-gray-500">Payable to departments</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-gray-900">
                              ₹{(accountingData.income?.rows?.reduce((sum, row) => {
                                const received = Number(row.received_amount || 0);
                                const serviceCharge = Number(row.service_charges || 0);
                                const departmentCharge = Number(row.department_charges || 0);
                                const totalBilled = serviceCharge + departmentCharge;
                                
                                if (totalBilled > 0 && received > 0) {
                                  const paymentRatio = received / totalBilled;
                                  return sum + (departmentCharge * paymentRatio);
                                }
                                return sum;
                              }, 0) || 0).toLocaleString()}
                            </p>
                            <p className="text-xs text-blue-600">
                              {totalRevenue > 0 ? 
                                `${((accountingData.income?.rows?.reduce((sum, row) => {
                                  const received = Number(row.received_amount || 0);
                                  const serviceCharge = Number(row.service_charges || 0);
                                  const departmentCharge = Number(row.department_charges || 0);
                                  const totalBilled = serviceCharge + departmentCharge;
                                  
                                  if (totalBilled > 0 && received > 0) {
                                    const paymentRatio = received / totalBilled;
                                    return sum + (departmentCharge * paymentRatio);
                                  }
                                  return sum;
                                }, 0) / totalRevenue) * 100).toFixed(1)}% of revenue` : 
                                '0%'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar */}
                      <div className="pt-2">
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500"
                            style={{ width: `${totalRevenue > 0 ? 
                              (totalServiceCharges/totalRevenue) * 100 : 0}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>Our Profit (Service Charges)</span>
                          <span>Cost (Department Charges)</span>
                        </div>
                      </div>

                      {/* Top Services by Profit */}
                      <div className="pt-4 border-t border-gray-100">
                        <h4 className="text-xs font-semibold text-gray-700 mb-3">Top 5 Services by Profit</h4>
                        <div className="space-y-2">
                          {(() => {
                            const serviceProfit = accountingData.income?.rows?.reduce((acc, row) => {
                              const service = row.service_name || 'Unknown';
                              if (!acc[service]) acc[service] = { name: service, profit: 0, department: 0, total: 0 };
                              
                              const received = Number(row.received_amount || 0);
                              const serviceCharge = Number(row.service_charges || 0);
                              const departmentCharge = Number(row.department_charges || 0);
                              const totalBilled = serviceCharge + departmentCharge;
                              
                              if (totalBilled > 0 && received > 0) {
                                const paymentRatio = received / totalBilled;
                                acc[service].profit += serviceCharge * paymentRatio;
                                acc[service].department += departmentCharge * paymentRatio;
                              } else if (received > 0 && totalBilled === 0) {
                                acc[service].profit += received;
                              }
                              
                              acc[service].total += Number(row.received_amount || 0);
                              return acc;
                            }, {}) || {};
                            
                            const topServices = Object.values(serviceProfit)
                              .sort((a, b) => b.profit - a.profit)
                              .slice(0, 5);
                            
                            if (topServices.length === 0) {
                              return <p className="text-xs text-gray-500 text-center py-2">No service data</p>;
                            }
                            
                            const totalProfit = topServices.reduce((sum, s) => sum + s.profit, 0);
                            
                            return topServices.map((service, index) => (
                              <div key={service.name} className="flex items-center justify-between hover:bg-gray-50 p-2 rounded">
                                <div className="flex items-center space-x-3">
                                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${
                                    index === 0 ? 'bg-yellow-100 text-yellow-700' :
                                    index === 1 ? 'bg-gray-100 text-gray-700' :
                                    index === 2 ? 'bg-amber-100 text-amber-700' :
                                    'bg-indigo-100 text-indigo-700'
                                  }`}>
                                    {index + 1}
                                  </div>
                                  <div className="max-w-[140px]">
                                    <span className="text-xs font-medium text-gray-900 truncate block">
                                      {service.name}
                                    </span>
                                    <span className="text-xs text-gray-500">
                                      Total: ₹{service.total.toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs font-bold text-emerald-600">₹{Math.round(service.profit).toLocaleString()}</p>
                                  <div className="flex items-center space-x-1 text-xs text-gray-500">
                                    <span>Dept: ₹{Math.round(service.department).toLocaleString()}</span>
                                    <span>•</span>
                                    <span>{totalProfit > 0 ? `${((service.profit/totalProfit)*100).toFixed(1)}%` : '0%'}</span>
                                  </div>
                                </div>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Expense Analysis */}
                  <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-gray-900 text-sm flex items-center">
                        <FiTrendingDown className="h-4 w-4 mr-2 text-rose-600" />
                        Expense Analysis
                      </h3>
                      <button className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center">
                        <FiEye className="h-3 w-3 mr-1" />
                        View Details
                      </button>
                    </div>
                    
                    <div className="space-y-4">
                      {/* Expense Status */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                          <p className="text-xs text-emerald-700 mb-1">Approved</p>
                          <p className="font-bold text-emerald-900 text-sm">
                            ₹{expensesForCurrentDate
                              .filter(e => e.status === 'approved')
                              .reduce((sum, e) => sum + Number(e.amount || 0), 0)
                              .toLocaleString()}
                          </p>
                          <p className="text-xs text-emerald-600 mt-1">
                            {expensesForCurrentDate.filter(e => e.status === 'approved').length} items
                          </p>
                        </div>
                        
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                          <p className="text-xs text-yellow-700 mb-1">Pending</p>
                          <p className="font-bold text-yellow-900 text-sm">
                            ₹{expensesForCurrentDate
                              .filter(e => e.status === 'pending')
                              .reduce((sum, e) => sum + Number(e.amount || 0), 0)
                              .toLocaleString()}
                          </p>
                          <p className="text-xs text-yellow-600 mt-1">
                            {pendingApprovals} items
                          </p>
                        </div>
                        
                        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-center">
                          <p className="text-xs text-rose-700 mb-1">Rejected</p>
                          <p className="font-bold text-rose-900 text-sm">
                            ₹{expensesForCurrentDate
                              .filter(e => e.status === 'rejected')
                              .reduce((sum, e) => sum + Number(e.amount || 0), 0)
                              .toLocaleString()}
                          </p>
                          <p className="text-xs text-rose-600 mt-1">
                            {expensesForCurrentDate.filter(e => e.status === 'rejected').length} items
                          </p>
                        </div>
                      </div>

                      {/* Expense Categories */}
                      <div className="pt-4">
                        <h4 className="text-xs font-semibold text-gray-700 mb-3">Expense by Category</h4>
                        <div className="space-y-2">
                          {(() => {
                            const categoryTotals = expensesForCurrentDate.reduce((acc, expense) => {
                              const category = expense.category || 'Uncategorized';
                              if (!acc[category]) acc[category] = 0;
                              if (expense.status !== 'rejected') {
                                acc[category] += Number(expense.amount || 0);
                              }
                              return acc;
                            }, {});
                            
                            const totalExpenses = Object.values(categoryTotals).reduce((sum, val) => sum + val, 0);
                            const sortedCategories = Object.entries(categoryTotals)
                              .sort(([,a], [,b]) => b - a);
                            
                            if (sortedCategories.length === 0) {
                              return <p className="text-xs text-gray-500 text-center py-2">No expense data for this date</p>;
                            }
                            
                            return sortedCategories.map(([category, amount]) => (
                              <div key={category} className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <div className="flex items-center space-x-2">
                                    <span className="font-medium text-gray-700 capitalize">{category}</span>
                                    <span className="text-gray-400">•</span>
                                    <span className="text-gray-500">
                                      {expensesForCurrentDate.filter(e => e.category === category && e.status !== 'rejected').length} items
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    <span className="font-bold text-gray-900">
                                      ₹{amount.toLocaleString()}
                                    </span>
                                    {totalExpenses > 0 && (
                                      <span className="text-gray-500 ml-1">
                                        ({((amount/totalExpenses)*100).toFixed(1)}%)
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${
                                      category.includes('Salary') ? 'bg-purple-500' :
                                      category.includes('Operational') ? 'bg-blue-500' :
                                      category.includes('Office') ? 'bg-emerald-500' :
                                      category.includes('Utility') ? 'bg-amber-500' :
                                      category.includes('Maintenance') ? 'bg-rose-500' :
                                      'bg-gray-500'
                                    }`}
                                    style={{ width: `${totalExpenses > 0 ? (amount/totalExpenses)*100 : 0}%` }}
                                  ></div>
                                </div>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>

                      {/* Payment Methods */}
                      <div className="pt-4 border-t border-gray-100">
                        <h4 className="text-xs font-semibold text-gray-700 mb-3">Payment Methods</h4>
                        <div className="grid grid-cols-3 gap-3">
                          {(() => {
                            const paymentMethods = expensesForCurrentDate.reduce((acc, expense) => {
                              const method = expense.payment_method || 'cash';
                              if (!acc[method]) acc[method] = 0;
                              if (expense.status !== 'rejected') {
                                acc[method] += Number(expense.amount || 0);
                              }
                              return acc;
                            }, {});
                            
                            const methods = Object.entries(paymentMethods);
                            
                            if (methods.length === 0) {
                              return <p className="text-xs text-gray-500 col-span-3 text-center py-2">No payment data for this date</p>;
                            }
                            
                            return methods.map(([method, amount]) => (
                              <div key={method} className="text-center p-2 border border-gray-200 rounded-lg">
                                <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full mb-1 ${
                                  method === 'cash' ? 'bg-emerald-100 text-emerald-600' :
                                  method === 'bank' ? 'bg-blue-100 text-blue-600' :
                                  method === 'upi' ? 'bg-purple-100 text-purple-600' :
                                  'bg-gray-100 text-gray-600'
                                }`}>
                                  {method === 'cash' ? <FiDollarSign className="h-4 w-4" /> :
                                  method === 'bank' ? <FiCreditCard className="h-4 w-4" /> :
                                  <FiSmartphone className="h-4 w-4" />}
                                </div>
                                <p className="text-xs font-medium text-gray-900 capitalize">{method}</p>
                                <p className="text-xs font-bold text-gray-800">₹{amount.toLocaleString()}</p>
                                <p className="text-xs text-gray-500">
                                  {expensesForCurrentDate.filter(e => e.payment_method === method && e.status !== 'rejected').length} txn
                                </p>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Performance Metrics */}
                  <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-gray-900 text-sm flex items-center">
                        <FiActivity className="h-4 w-4 mr-2 text-indigo-600" />
                        Performance Metrics
                      </h3>
                      <button className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center">
                        <FiRefreshCw className="h-3 w-3 mr-1" />
                        Refresh
                      </button>
                    </div>
                    
                    <div className="space-y-4">
                      {/* Efficiency Metrics */}
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-indigo-700">Profit Margin</span>
                            <span className={`text-xs font-bold ${todayProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {totalRevenue > 0 ? ((todayProfit/totalRevenue)*100).toFixed(1) : '0'}%
                            </span>
                          </div>
                          <div className="h-1.5 bg-indigo-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${todayProfit >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                              style={{ width: `${Math.min(Math.abs((todayProfit/totalRevenue)*100), 100)}%` }}
                            ></div>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Net Profit: ₹{todayProfit.toLocaleString()}
                          </p>
                        </div>
                        
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-blue-700">Expense Ratio</span>
                            <span className="text-xs font-bold text-blue-600">
                              {totalRevenue > 0 ? ((todayExpenses/totalRevenue)*100).toFixed(1) : '0'}%
                            </span>
                          </div>
                          <div className="h-1.5 bg-blue-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-blue-500"
                              style={{ width: `${Math.min((todayExpenses/totalRevenue)*100, 100)}%` }}
                            ></div>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">
                            Expenses: ₹{todayExpenses.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      {/* Staff Performance */}
                      <div className="pt-4">
                        <h4 className="text-xs font-semibold text-gray-700 mb-3">Top Staff by Service Profit</h4>
                        <div className="space-y-2">
                          {(() => {
                            const staffPerformance = accountingData.income?.rows?.reduce((acc, row) => {
                              const staff = row.staff_name || 'Unknown';
                              if (!acc[staff]) {
                                acc[staff] = { 
                                  name: staff, 
                                  profit: 0,
                                  department: 0,
                                  count: 0,
                                  avg: 0 
                                };
                              }
                              
                              const received = Number(row.received_amount || 0);
                              const serviceCharge = Number(row.service_charges || 0);
                              const departmentCharge = Number(row.department_charges || 0);
                              const totalBilled = serviceCharge + departmentCharge;
                              
                              if (totalBilled > 0 && received > 0) {
                                const paymentRatio = received / totalBilled;
                                acc[staff].profit += serviceCharge * paymentRatio;
                                acc[staff].department += departmentCharge * paymentRatio;
                              } else if (received > 0 && totalBilled === 0) {
                                acc[staff].profit += received;
                              }
                              
                              acc[staff].count += 1;
                              acc[staff].avg = acc[staff].profit / acc[staff].count;
                              return acc;
                            }, {}) || {};
                            
                            const topStaff = Object.values(staffPerformance)
                              .sort((a, b) => b.profit - a.profit)
                              .slice(0, 5);
                            
                            if (topStaff.length === 0) {
                              return <p className="text-xs text-gray-500 text-center py-2">No staff performance data</p>;
                            }
                            
                            return topStaff.map((staff, index) => (
                              <div key={staff.name} className="flex items-center justify-between hover:bg-gray-50 p-2 rounded border border-gray-100">
                                <div className="flex items-center space-x-3">
                                  <div className="relative">
                                    <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center text-xs font-bold text-indigo-600 border border-indigo-200">
                                      {staff.name.charAt(0)}
                                    </div>
                                    {index === 0 && (
                                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-yellow-400 rounded-full flex items-center justify-center border border-white">
                                        <FiStar className="h-2 w-2 text-white" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium text-gray-900 truncate max-w-[120px]">{staff.name}</p>
                                    <div className="flex items-center space-x-1 text-xs text-gray-500">
                                      <span>{staff.count} services</span>
                                      <span>•</span>
                                      <span>Dept: ₹{Math.round(staff.department).toLocaleString()}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs font-bold text-emerald-600">₹{Math.round(staff.profit).toLocaleString()}</p>
                                  <p className="text-xs text-gray-500">Avg: ₹{Math.round(staff.avg).toFixed(0)}</p>
                                </div>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>

                      {/* Transaction Stats */}
                      <div className="pt-4 border-t border-gray-100">
                        <h4 className="text-xs font-semibold text-gray-700 mb-3">Transaction Statistics</h4>
                        <div className="grid grid-cols-3 gap-3">
                          <div className="text-center p-3 border border-gray-200 rounded-lg">
                            <p className="text-lg font-bold text-gray-900">{accountingData.income?.rows?.length || 0}</p>
                            <p className="text-xs text-gray-600">Services</p>
                            <p className="text-xs text-emerald-600 font-medium mt-1">
                              Profit: ₹{totalServiceCharges.toLocaleString()}
                            </p>
                          </div>
                          <div className="text-center p-3 border border-gray-200 rounded-lg">
                            <p className="text-lg font-bold text-gray-900">{expensesForCurrentDate.length}</p>
                            <p className="text-xs text-gray-600">Expenses</p>
                            <p className="text-xs text-rose-600 font-medium mt-1">
                              Cost: ₹{todayExpenses.toLocaleString()}
                            </p>
                          </div>
                          <div className="text-center p-3 border border-gray-200 rounded-lg">
                            <p className="text-lg font-bold text-gray-900">{accountingData.ledger?.rows?.length || 0}</p>
                            <p className="text-xs text-gray-600">Ledger Entries</p>
                            <p className="text-xs text-blue-600 font-medium mt-1">
                              Total: ₹{totalRevenue.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Cash Flow & Wallet Summary */}
                  <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-gray-900 text-sm flex items-center">
                        <FiSmartphone className="h-4 w-4 mr-2 text-purple-600" />
                        Wallet Balances
                      </h3>
                      <button className="text-xs text-indigo-600 hover:text-indigo-800 flex items-center">
                        <FiEye className="h-3 w-3 mr-1" />
                        Details
                      </button>
                    </div>
                    
                    <div className="space-y-4">
                      {/* Wallet Summary Cards */}
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center">
                              <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center mr-2">
                                <FiDollarSign className="h-4 w-4 text-emerald-600" />
                              </div>
                              <div>
                                <p className="text-xs font-medium text-emerald-700">Cash in Hand</p>
                                <p className="text-lg font-bold text-emerald-900">
                                  ₹{calculateCashInHand().toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>
                          <p className="text-xs text-emerald-600">
                            {derivedWallets.filter(w => w.type?.toLowerCase() === 'cash').length} cash wallets
                          </p>
                        </div>
                        
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center">
                              <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center mr-2">
                                <FiCreditCard className="h-4 w-4 text-blue-600" />
                              </div>
                              <div>
                                <p className="text-xs font-medium text-blue-700">Bank Balance</p>
                                <p className="text-lg font-bold text-blue-900">
                                  ₹{calculateBankBalance().toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>
                          <p className="text-xs text-blue-600">
                            {derivedWallets.filter(w => w.type?.toLowerCase() === 'bank').length} bank accounts
                          </p>
                        </div>
                        
                        <div className="bg-purple-50 border border-purple-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center">
                              <div className="w-8 h-8 rounded-full bg-purple-100 flex items-center justify-center mr-2">
                                <FiSmartphone className="h-4 w-4 text-purple-600" />
                              </div>
                              <div>
                                <p className="text-xs font-medium text-purple-700">Digital Balance</p>
                                <p className="text-lg font-bold text-purple-900">
                                  ₹{calculateDigitalBalance().toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>
                          <p className="text-xs text-purple-600">
                            {derivedWallets.filter(w => w.type?.toLowerCase() === 'digital').length} digital wallets
                          </p>
                        </div>
                      </div>

                      {/* Wallet Distribution */}
                      <div className="pt-4">
                        <h4 className="text-xs font-semibold text-gray-700 mb-3">Wallet Distribution</h4>
                        <div className="space-y-2">
                          {derivedWallets.map((wallet, index) => {
                            const isCash = wallet.type?.toLowerCase() === 'cash';
                            const isBank = wallet.type?.toLowerCase() === 'bank';
                            const isDigital = wallet.type?.toLowerCase() === 'digital';
                            
                            return (
                              <div key={wallet.id} className="flex items-center justify-between hover:bg-gray-50 p-2 rounded border border-gray-100">
                                <div className="flex items-center space-x-3">
                                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center border ${
                                    isCash ? 'border-emerald-200 bg-emerald-50 text-emerald-600' :
                                    isBank ? 'border-blue-200 bg-blue-50 text-blue-600' :
                                    'border-purple-200 bg-purple-50 text-purple-600'
                                  }`}>
                                    {isCash ? <FiDollarSign className="h-4 w-4" /> :
                                    isBank ? <FiCreditCard className="h-4 w-4" /> :
                                    <FiSmartphone className="h-4 w-4" />}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium text-gray-900 truncate max-w-[120px]">{wallet.name}</p>
                                    <div className="flex items-center space-x-1 text-xs text-gray-500">
                                      <span className="capitalize">{wallet.type}</span>
                                      <span>•</span>
                                      <span>Book: ₹{(wallet.book_balance || 0).toLocaleString()}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs font-bold text-gray-900">
                                    ₹{(wallet.currentBalance || 0).toLocaleString()}
                                  </p>
                                  <p className={`text-xs ${Math.abs((wallet.book_balance || 0) - (wallet.currentBalance || 0)) <= 10 ? 'text-emerald-600' : 'text-rose-600'}`}>
                                    {Math.abs((wallet.book_balance || 0) - (wallet.currentBalance || 0)) <= 10 ? '✓ Reconciled' : 'Reconcile'}
                                  </p>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>

                      {/* Quick Stats */}
                      <div className="pt-4 border-t border-gray-100">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="text-center p-3 border border-gray-200 rounded-lg">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-1">
                              <FiCheckCircle className="h-4 w-4 text-emerald-600" />
                            </div>
                            <p className="text-xs font-bold text-gray-900">
                              {derivedWallets.filter(w => Math.abs((w.book_balance || 0) - (w.currentBalance || 0)) <= 10).length}
                            </p>
                            <p className="text-xs text-gray-600">Reconciled Wallets</p>
                          </div>
                          <div className="text-center p-3 border border-gray-200 rounded-lg">
                            <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-1">
                              <FiAlertCircle className="h-4 w-4 text-rose-600" />
                            </div>
                            <p className="text-xs font-bold text-gray-900">
                              {derivedWallets.filter(w => Math.abs((w.book_balance || 0) - (w.currentBalance || 0)) > 10).length}
                            </p>
                            <p className="text-xs text-gray-600">Pending Reconciliation</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Report Summary & Notes */}
                <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                  <h3 className="font-bold text-gray-900 text-sm flex items-center mb-3">
                    <FiMessageSquare className="h-4 w-4 mr-2 text-gray-600" />
                    Report Summary & Notes
                  </h3>
                  <div className="grid grid-cols-3 gap-4">
                    <div className="col-span-2">
                      <textarea
                        className="w-full h-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm"
                        placeholder="Add your observations, insights, or notes about this financial period..."
                        defaultValue={accountingData.nightlyAccounting?.[date]?.notes || ''}
                      ></textarea>
                      <div className="flex justify-end mt-2">
                        <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 text-sm">
                          Save Notes
                        </button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm p-2 border border-gray-200 rounded">
                        <span className="text-gray-600">Report Date:</span>
                        <span className="font-medium text-gray-900">{date}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm p-2 border border-gray-200 rounded">
                        <span className="text-gray-600">Generated:</span>
                        <span className="font-medium text-gray-900">{new Date().toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm p-2 border border-gray-200 rounded">
                        <span className="text-gray-600">Status:</span>
                        <span className="font-medium text-emerald-600">Complete</span>
                      </div>
                      <div className="pt-2">
                        <button className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm">
                          <FiDownload className="h-4 w-4" />
                          <span>Generate Full Report (PDF)</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Misc Income Modal */}
      <AnimatePresence>
        {showMiscIncomeModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowMiscIncomeModal(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-lg">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center">
                    <FiTrendingUp className="mr-2 text-emerald-600 h-5 w-5" />
                    Add Misc Income / Overage
                  </h2>
                  <button onClick={() => setShowMiscIncomeModal(false)} className="text-gray-400 hover:text-gray-600">
                    <FiX className="h-5 w-5" />
                  </button>
                </div>
                <form onSubmit={handleMiscIncomeSubmit} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input type="date" value={miscIncomeForm.date} onChange={(e) => setMiscIncomeForm(prev => ({...prev, date: e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                    <input type="number" min="0" step="0.01" value={miscIncomeForm.amount} onChange={(e) => setMiscIncomeForm(prev => ({...prev, amount: e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm" required placeholder="Enter amount" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Wallet to Credit</label>
                    <select value={miscIncomeForm.wallet_id} onChange={(e) => setMiscIncomeForm(prev => ({...prev, wallet_id: e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm" required>
                      <option value="">Select a wallet...</option>
                      {derivedWallets.map(w => (
                        <option key={w.id} value={w.id}>{w.name} ({w.wallet_type || w.type})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description / Reason</label>
                    <textarea value={miscIncomeForm.description} onChange={(e) => setMiscIncomeForm(prev => ({...prev, description: e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-emerald-500 focus:border-emerald-500 text-sm" required placeholder="e.g., Cash drawer overage for 29/04, Sale of scrap paper, etc." rows="3" />
                  </div>
                  <div className="flex justify-end pt-4 border-t border-gray-100">
                    <button type="button" onClick={() => setShowMiscIncomeModal(false)} className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg mr-3 hover:bg-gray-50 text-sm font-medium transition-colors">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 text-sm font-medium transition-colors">Record Income</button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      {/* Admin Expense Modal */}
      <AnimatePresence>
        {showAdminExpenseModal && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setShowAdminExpenseModal(false)}
              className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="fixed inset-0 z-50 flex items-center justify-center p-4"
            >
              <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <AdminExpenseEntry
                  wallets={wallets}
                  categories={[]}
                  onSubmit={handleAdminExpenseSubmit}
                  onCancel={() => setShowAdminExpenseModal(false)}
                  submitButtonText="Add Expense"
                  title="Admin Expense Entry"
                />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AccountingSection;