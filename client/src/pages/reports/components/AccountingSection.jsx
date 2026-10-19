import React, { useState, useEffect, useMemo } from 'react';
import * as XLSX from 'xlsx';
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
import WalletReconciliation from './WalletReconciliation';

// Today's date in IST (YYYY-MM-DD)
const todayIST = () => new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });

// Shared style tokens (UI only)
const inputCls =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 disabled:bg-slate-50 disabled:text-slate-500 disabled:cursor-not-allowed';

// Compact StatCard Component
const StatCard = ({ title, value, icon: Icon, color, subtitle, onClick, trend }) => (
  <motion.div
    whileHover={{ y: -2 }}
    className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md ${onClick ? 'cursor-pointer' : ''}`}
    onClick={onClick}
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

// Nightly Accounting Checklist Component
const NightlyAccountingChecklist = ({ date, onComplete, existingData, readOnly = false }) => {
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
    if (readOnly) return;
    setChecklist(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const allCompleted = Object.values(checklist).every(item => item);

  const handleCompleteAccounting = async () => {
    if (readOnly) return;
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
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center text-sm font-bold text-slate-900">
            <FiCheckCircle className="mr-2 h-4 w-4 text-navy-700" />
            Nightly Accounting Checklist
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">Date: {date}</p>
          {existingData && (
            <div className="mt-1.5">
              <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-200">
                <FiCheckCircle className="mr-1 h-3 w-3" />
                Closed on {new Date(existingData.timestamp).toLocaleDateString()}
              </span>
            </div>
          )}
        </div>
        <div className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium ring-1 ${
          allCompleted ? 'bg-emerald-50 text-emerald-700 ring-emerald-200' : 'bg-amber-50 text-amber-700 ring-amber-200'
        }`}>
          {allCompleted ? 'Ready to Close' : 'Pending Items'}
        </div>
      </div>

      <div className="space-y-5">
        {/* Checklist Items */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {[
            { key: 'incomeEntryVerified', label: 'Income Entry Verified', description: 'Service charges & fees' },
            { key: 'expenseEntryVerified', label: 'Expense Entry Verified', description: 'All expenses approved' },
            { key: 'bankEntryReconciled', label: 'Bank Reconciled', description: 'Bank credits matched' },
            { key: 'dailySummaryCompleted', label: 'Daily Summary', description: 'Transactions summarized' },
            { key: 'cashReconciled', label: 'Cash Reconciled', description: 'Cash matches count' },
            { key: 'walletBalancesVerified', label: 'Wallets Verified', description: 'Digital wallets checked' }
          ].map((item) => (
            <div
              key={item.key}
              className={`flex items-start gap-3 rounded-xl border p-3 transition-colors ${
                checklist[item.key] ? 'border-emerald-200 bg-emerald-50/50' : 'border-slate-200 hover:bg-slate-50'
              }`}
            >
              <button
                type="button"
                role="checkbox"
                aria-checked={!!checklist[item.key]}
                aria-label={item.label}
                onClick={() => handleChecklistToggle(item.key)}
                className={`mt-0.5 flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-md border transition-colors ${
                  checklist[item.key]
                    ? 'border-emerald-500 bg-emerald-500'
                    : 'border-slate-300 bg-white'
                } ${readOnly ? 'cursor-default' : 'cursor-pointer'}`}
              >
                {checklist[item.key] && <FiCheckIcon className="h-3 w-3 text-white" />}
              </button>
              <div className="min-w-0 flex-1">
                <label
                  className={`block truncate text-sm font-medium text-slate-900 ${readOnly ? '' : 'cursor-pointer'}`}
                  onClick={() => handleChecklistToggle(item.key)}
                >
                  {item.label}
                </label>
                <p className="truncate text-xs text-slate-500">{item.description}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Cash Reconciliation */}
        <div className="border-t border-slate-200 pt-5">
          <h4 className="mb-3 flex items-center text-sm font-semibold text-slate-900">
            <FiDollarSign className="mr-2 h-3.5 w-3.5 text-emerald-600" />
            Cash Reconciliation
          </h4>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Calculated Cash
              </label>
              <input
                type="number"
                value={closingCash}
                onChange={(e) => setClosingCash(e.target.value)}
                disabled={readOnly}
                className={inputCls}
                placeholder="₹0.00"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-600">
                Actual Count
              </label>
              <input
                type="number"
                value={actualCashCount}
                onChange={(e) => setActualCashCount(e.target.value)}
                disabled={readOnly}
                className={inputCls}
                placeholder="₹0.00"
              />
            </div>
          </div>
          {closingCash && actualCashCount && (
            <div className="mt-2">
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${
                Math.abs(parseFloat(closingCash) - parseFloat(actualCashCount)) <= 100
                  ? 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                  : 'bg-rose-50 text-rose-700 ring-rose-200'
              }`}>
                Variance: ₹{(parseFloat(closingCash) - parseFloat(actualCashCount)).toFixed(2)}
              </span>
            </div>
          )}
        </div>

        {/* Notes */}
        <div>
          <label className="mb-1.5 flex items-center text-xs font-medium text-slate-600">
            <FiMessageSquare className="mr-1 h-3 w-3 text-slate-400" />
            Notes & Observations
          </label>
          <textarea
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            disabled={readOnly}
            rows="2"
            className={inputCls}
            placeholder="Enter any notes or observations..."
          />
        </div>

        {/* Complete Button */}
        {!readOnly && (
        <div className="flex justify-end">
          <button
            onClick={handleCompleteAccounting}
            disabled={!allCompleted}
            className={`rounded-xl px-4 py-2 text-sm font-semibold shadow-sm transition-colors ${
              allCompleted
                ? existingData
                  ? 'bg-navy-700 text-white hover:bg-navy-800'
                  : 'bg-emerald-600 text-white hover:bg-emerald-700'
                : 'cursor-not-allowed bg-slate-100 text-slate-400 shadow-none'
            }`}
          >
            {existingData ? 'Update Nightly Accounting' : 'Complete Nightly Accounting'}
          </button>
        </div>
        )}
      </div>
    </div>
  );
};

// Daily Summary Component
const DailySummaryComponent = ({ summaryData, onUpdate, readOnly = false }) => {
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
      cashOpening = 0,
      cashInflow = 0,
      digitalInflow = 0,
      bankInflow = 0,
      cashOutflow = 0,
      digitalOutflow = 0,
      bankOutflow = 0,
      cashTransferIn = 0,   
      cashTransferOut = 0
    } = formData.derived || {};

    const actualCashInHand = formData.manual?.actualCashInHand || 0;

    // Business Inflow/Outflow (strictly revenue and expenses)
    const totalInflow = cashInflow + bankInflow + digitalInflow;
    const totalOutflow = cashOutflow + bankOutflow + digitalOutflow;
    const closingBalance = openingBalance + totalInflow - totalOutflow;

    // 🔥 Physical Cash Calculation: Opening + Inflow + TransfersIn - Outflow - TransfersOut
    const expectedCash = cashOpening + cashInflow + cashTransferIn - cashOutflow - cashTransferOut;

    // Variance = Expected Physical Cash - Actual Count
    const variance = expectedCash - actualCashInHand;

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
    { key: 'cashOpening', label: 'Cash Opening Balance', type: 'cash', category: 'system' },
    { key: 'cashInflow', label: 'Cash Collections', type: 'cash', category: 'inflow' },
    { key: 'digitalInflow', label: 'Digital Collections', type: 'digital', category: 'inflow' },
    { key: 'bankInflow', label: 'Bank Collections', type: 'bank', category: 'inflow' },
    { key: 'cashOutflow', label: 'Cash Outflow', type: 'cash', category: 'outflow' },
    { key: 'digitalOutflow', label: 'Digital Outflow', type: 'digital', category: 'outflow' },
    { key: 'bankOutflow', label: 'Bank Outflow', type: 'bank', category: 'outflow' },
    { key: 'cashTransferIn', label: 'Cash Transfer In', type: 'cash', category: 'transfer' },
    { key: 'cashTransferOut', label: 'Cash Transfer Out', type: 'cash', category: 'transfer' },
    { key: 'actualCashInHand', label: 'Actual Cash in Hand', type: 'cash', category: 'manual' }
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="flex items-center text-sm font-bold text-slate-900">
            <FiBarChart2 className="mr-2 h-4 w-4 text-navy-700" />
            Daily Summary
          </h3>
          <p className="mt-0.5 text-xs text-slate-500">Date: {summaryData?.date || '-'}</p>
        </div>
        <div className="flex gap-2">
          {editing ? (
            <>
              <button
                onClick={handleSave}
                className="flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700"
              >
                <FiSave className="h-3.5 w-3.5" />
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
                className="flex items-center gap-1.5 rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
              >
                <FiX className="h-3.5 w-3.5" />
                <span>Cancel</span>
              </button>
            </>
          ) : !readOnly ? (
            <button
              onClick={() => setEditing(true)}
              className="flex items-center gap-1.5 rounded-xl bg-navy-700 px-3 py-1.5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-navy-800"
            >
              <FiEdit className="h-3.5 w-3.5" />
              <span>Edit Summary</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* Summary Stats */}
      <div className="mb-5 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-xl border border-blue-200 bg-blue-50 p-3">
          <p className="mb-1 text-xs font-medium text-blue-700">Total Inflow</p>
          <p className="text-base font-bold text-blue-900">
            ₹{totals.totalInflow.toLocaleString()}
          </p>
        </div>

        <div className="rounded-xl border border-rose-200 bg-rose-50 p-3">
          <p className="mb-1 text-xs font-medium text-rose-700">Total Outflow</p>
          <p className="text-base font-bold text-rose-900">
            ₹{totals.totalOutflow.toLocaleString()}
          </p>
        </div>

        <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
          <p className="mb-1 text-xs font-medium text-emerald-700">Closing Balance</p>
          <p className="text-base font-bold text-emerald-900">
            ₹{totals.closingBalance.toLocaleString()}
          </p>
        </div>

        <div className={`rounded-xl border p-3 ${
          Math.abs(totals.variance) <= 100
            ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
            : 'border-rose-200 bg-rose-50 text-rose-900'
        }`}>
          <p className="mb-1 text-xs font-medium">Cash Variance</p>
          <p className="text-base font-bold">
            ₹{totals.variance.toFixed(2)}
          </p>
        </div>
      </div>

      {/* Summary Table */}
      <div className="overflow-x-auto rounded-xl border border-slate-200">
        <table className="w-full min-w-[480px]">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50">
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Item
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Type
              </th>
              <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wider text-slate-500">
                Category
              </th>
              <th className="px-3 py-2.5 text-right text-xs font-semibold uppercase tracking-wider text-slate-500">
                Amount (₹)
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {fields.map((field) => (
              <tr key={field.key} className="transition-colors hover:bg-slate-50">
                <td className="px-3 py-2.5">
                  <span className="text-xs font-medium text-slate-900">{field.label}</span>
                </td>
                <td className="px-3 py-2.5">
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                    field.type === 'cash' ? 'bg-blue-50 text-blue-700' :
                    field.type === 'digital' ? 'bg-purple-50 text-purple-700' :
                    field.type === 'bank' ? 'bg-slate-100 text-navy-700' :
                    'bg-amber-50 text-amber-700'
                  }`}>
                    {field.type === 'cash' && <FiDollarSign className="mr-1 h-2.5 w-2.5" />}
                    {field.type === 'digital' && <FiSmartphone className="mr-1 h-2.5 w-2.5" />}
                    {field.type === 'bank' && <FiCreditCard className="mr-1 h-2.5 w-2.5" />}
                    {field.type}
                  </span>
                </td>
                <td className="px-3 py-2.5">
                  <span className={`inline-flex items-center text-xs ${
                    field.category === 'inflow' ? 'text-emerald-600' :
                    field.category === 'outflow' ? 'text-rose-600' :
                    'text-slate-500'
                  }`}>
                    {field.category === 'inflow' && <FiTrendingUp className="mr-1 h-2.5 w-2.5" />}
                    {field.category === 'outflow' && <FiTrendingDown className="mr-1 h-2.5 w-2.5" />}
                    {field.category}
                  </span>
                </td>
                <td className="px-3 py-2.5 text-right">
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
                      className="w-28 rounded-lg border border-slate-300 px-2 py-1 text-right text-xs focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500"
                    />
                  ) : (
                    <span className="text-xs font-semibold text-slate-800">
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

// Income View Component
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

  const rowCalc = (row) => {
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
    return { displayAmount, totalBilled, receivedServiceCharge, receivedDepartmentCharge };
  };

  const fmtDate = (v) => (v ? new Date(v).toLocaleDateString() : '—');
  const fmtTime = (v) => (v ? new Date(v).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—');

  const renderDetails = (row) => {
    const { displayAmount, totalBilled, receivedServiceCharge, receivedDepartmentCharge } = rowCalc(row);
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-3">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h4 className="text-xs font-bold text-slate-900">Transaction Details</h4>
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-500">ID:</span>
            <span className="font-mono text-xs text-slate-700">{row.service_entry_id}</span>
          </div>
        </div>

        <div className="mb-3 grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <p className="mb-1 text-xs text-slate-500">Service Charge (Received)</p>
            <p className="text-xs font-medium text-slate-900">₹{Math.round(receivedServiceCharge).toLocaleString()}</p>
            <p className="text-xs text-slate-500">(Billed: ₹{Number(row.service_charges || 0).toLocaleString()})</p>
          </div>
          <div>
            <p className="mb-1 text-xs text-slate-500">Department Charge (Received)</p>
            <p className="text-xs font-medium text-slate-900">₹{Math.round(receivedDepartmentCharge).toLocaleString()}</p>
            <p className="text-xs text-slate-500">(Billed: ₹{Number(row.department_charges || 0).toLocaleString()})</p>
          </div>
          <div className="sm:col-span-2">
            <p className="mb-1 text-xs text-slate-500">Total from Customer</p>
            <p className="text-xs font-bold text-emerald-600">₹{displayAmount.toLocaleString()}</p>
            <p className="text-xs text-slate-500">
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
            <p className="mb-2 text-xs font-medium text-slate-700">Wallet Transactions</p>
            <div className="space-y-1">
              {row.wallet_breakdown.map((w, i) => {
                const isCustomerPayment =
                  (Number(w.amount) === displayAmount) ||
                  (Number(w.amount) === Number(row.service_charges || 0));

                return (
                  <div
                    key={`${row.service_entry_id}-${w.wallet}-${i}`}
                    className={`flex flex-wrap items-center justify-between gap-2 rounded-lg p-2 text-xs ${
                      isCustomerPayment ? 'border border-emerald-100 bg-emerald-50' : 'bg-slate-50'
                    }`}
                  >
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-medium text-slate-900">{w.wallet || 'Unknown'}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-xs ${
                        isCustomerPayment
                          ? 'bg-emerald-100 text-emerald-700'
                          : 'bg-slate-200 text-slate-700'
                      }`}>
                        {isCustomerPayment ? 'Customer Payment' : 'Internal Transfer'}
                      </span>
                      {w.received_at && (
                        <span className="text-xs text-slate-500">
                          {new Date(w.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        </span>
                      )}
                    </div>
                    <div className={`font-semibold ${isCustomerPayment ? 'text-emerald-600' : 'text-navy-700'}`}>
                      ₹{Number(w.amount || 0).toLocaleString()}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        <div className="mt-3 border-t border-slate-200 pt-3">
          <div className="flex flex-col gap-1 text-xs sm:flex-row sm:justify-between">
            <span className="text-slate-500">Note:</span>
            <span className="text-slate-700">
              Customer paid ₹{displayAmount.toLocaleString()} total
              ({receivedServiceCharge > 0 ? `₹${Math.round(receivedServiceCharge).toLocaleString()} service` : ''}
              {receivedDepartmentCharge > 0 ? ` + ₹${Math.round(receivedDepartmentCharge).toLocaleString()} department` : ''})
            </span>
          </div>
        </div>
      </div>
    );
  };

  const renderToggle = (row, isExpanded) => (
    <button
      type="button"
      onClick={() => toggleRow(row.service_entry_id)}
      aria-label={isExpanded ? 'Hide transaction details' : 'Show transaction details'}
      aria-expanded={isExpanded}
      className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-navy-700 focus:outline-none focus:ring-2 focus:ring-navy-500/30"
    >
      {isExpanded ? <FiMinus className="h-4 w-4" /> : <FiPlus className="h-4 w-4" />}
    </button>
  );

  const renderStatus = (row) => (
    <>
      <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
        <FiCheck className="mr-1 h-2 w-2" />
        Completed
      </span>
      {row.was_pending && (
        <div className="mt-1">
          <span className="flex w-fit items-center rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-700">
            <FiRotateCcw className="mr-1 h-2 w-2" />
            Was Pending
          </span>
        </div>
      )}
    </>
  );

  const sideCardCls = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm';
  const sideTitleCls = 'mb-3 flex items-center text-sm font-bold text-slate-900';
  const emptyCls = 'py-2 text-center text-xs text-slate-500';
  const thCls = 'px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-500';

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Left Column - Key Metrics */}
      <div className="order-2 space-y-4 lg:order-1 lg:col-span-1">
        {/* Total Collected Card */}
        <div className={`${sideCardCls} transition-shadow hover:shadow-md`}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-emerald-100 p-2">
                <FiDollarSign className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-slate-500">Total Collected</p>
                <p className="text-lg font-bold text-slate-900">₹{totalCollected.toLocaleString()}</p>
              </div>
            </div>
            <span className="inline-flex items-center rounded-lg bg-emerald-50 px-2 py-1 text-xs font-medium text-emerald-700">
              <FiTrendingUp className="mr-1 h-2 w-2" />
              +{trend}%
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-slate-600">Service Charges (Received)</span>
            <span className="font-medium text-slate-900">₹{totalServiceCharge.toLocaleString()}</span>
          </div>
          <div className="mt-1 flex items-center justify-between text-xs">
            <span className="text-slate-600">Department Charges (Debitted)</span>
            <span className="font-medium text-slate-900">₹{totalDepartmentFee.toLocaleString()}</span>
          </div>
          <div className="mt-2 border-t border-slate-100 pt-2">
            <div className="flex items-center justify-between text-xs">
              <span className="text-slate-600">Net Customer Payment</span>
              <span className="font-bold text-emerald-600">₹{totalCollected.toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Wallet Summary */}
        <div className={sideCardCls}>
          <h3 className={sideTitleCls}>
            <FiDatabase className="mr-2 h-4 w-4 text-navy-700" />
            Wallet Activity
          </h3>
          <div className="space-y-2">
            {Object.values(walletTotals).map((wallet, index) => (
              <div key={wallet.name} className="flex items-center justify-between gap-2 rounded-lg p-2 hover:bg-slate-50">
                <div className="flex min-w-0 items-center gap-2">
                  <div className={`h-2 w-2 shrink-0 rounded-full ${
                    index === 0 ? 'bg-navy-500' :
                    index === 1 ? 'bg-slate-500' :
                    index === 2 ? 'bg-emerald-500' : 'bg-slate-300'
                  }`} />
                  <span className="truncate text-xs font-medium text-slate-700">{wallet.name}</span>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-bold text-slate-900">₹{wallet.total.toLocaleString()}</p>
                  <p className="text-xs text-slate-500">{wallet.count} txn</p>
                </div>
              </div>
            ))}
            {Object.keys(walletTotals).length === 0 && (
              <p className={emptyCls}>No wallet activity</p>
            )}
          </div>
        </div>

        {/* Top Performing Staff */}
        <div className={sideCardCls}>
          <h3 className={sideTitleCls}>
            <FiUsers className="mr-2 h-4 w-4 text-navy-700" />
            Top Performing Staff
          </h3>
          <div className="space-y-2">
            {topStaff.map((staff, index) => (
              <div key={staff.name} className="flex items-center justify-between gap-2 rounded-lg p-2 hover:bg-slate-50">
                <div className="flex min-w-0 items-center gap-2">
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    index === 0 ? 'bg-amber-100 text-amber-700' :
                    index === 1 ? 'bg-slate-200 text-slate-700' :
                    index === 2 ? 'bg-orange-100 text-orange-700' :
                    'bg-slate-100 text-navy-700'
                  }`}>
                    {index + 1}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-slate-900">{staff.name}</p>
                    <p className="text-xs text-slate-500">{staff.count} services</p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-bold text-slate-900">₹{Math.round(staff.total).toLocaleString()}</p>
                  <div className="text-xs text-slate-500">
                    <span>S: ₹{Math.round(staff.serviceCharge).toLocaleString()}</span>
                    {staff.departmentFee > 0 && (
                      <span className="ml-1">D: ₹{Math.round(staff.departmentFee).toLocaleString()}</span>
                    )}
                  </div>
                </div>
              </div>
            ))}
            {topStaff.length === 0 && (
              <p className={emptyCls}>No staff data available</p>
            )}
          </div>
        </div>

        {/* Payment Method Distribution */}
        <div className={sideCardCls}>
          <h3 className={sideTitleCls}>
            <FiCreditCard className="mr-2 h-4 w-4 text-navy-700" />
            Wallet Distribution
          </h3>
          <div className="space-y-2">
            {Object.values(paymentMethods).map((method) => (
              <div key={method.name} className="flex items-center justify-between gap-2 p-2">
                <div className="flex min-w-0 items-center gap-2">
                  <div className={`shrink-0 rounded-lg p-1 ${
                    method.name.toLowerCase().includes('cash') ? 'bg-emerald-100 text-emerald-600' :
                    method.name.toLowerCase().includes('counter') ? 'bg-slate-100 text-navy-700' :
                    method.name.toLowerCase().includes('bank') ? 'bg-slate-200 text-slate-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {method.name.toLowerCase().includes('cash') ? <FiDollarSign className="h-3 w-3" /> :
                     method.name.toLowerCase().includes('counter') ? <FiCreditCard className="h-3 w-3" /> :
                     method.name.toLowerCase().includes('bank') ? <FiDatabase className="h-3 w-3" /> :
                     <FiCreditCard className="h-3 w-3" />}
                  </div>
                  <span className="truncate text-xs font-medium text-slate-700">{method.name}</span>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-bold text-slate-900">₹{method.total.toLocaleString()}</p>
                  <p className="text-xs text-slate-500">{method.count} txn</p>
                </div>
              </div>
            ))}
            {Object.keys(paymentMethods).length === 0 && (
              <p className={emptyCls}>No wallet data</p>
            )}
          </div>
        </div>
      </div>

      {/* Right Column - Transactions */}
      <div className="order-1 min-w-0 lg:order-2 lg:col-span-2">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center text-sm font-bold text-slate-900">
                <FiFileText className="mr-2 h-4 w-4 text-navy-700" />
                Income Transactions (Corrected View)
              </h3>
              <span className="text-xs text-slate-600">
                {rows.length} transactions • ₹{totalCollected.toLocaleString()} total
              </span>
            </div>
          </div>

          {rows.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-xs text-slate-500">
              <FiFileText className="mb-2 h-8 w-8 text-slate-300" />
              No income data for this date
            </div>
          )}

          {/* Mobile cards */}
          <div className="divide-y divide-slate-100 md:hidden">
            {rows.map((row, index) => {
              const rowKey = row.service_entry_id != null
                ? `se-${row.service_entry_id}`
                : `income-fallback-${index}`;
              const isExpanded = expandedRow === row.service_entry_id;
              const { displayAmount, receivedServiceCharge, receivedDepartmentCharge } = rowCalc(row);

              return (
                <div key={`m-${rowKey}`} className={`p-4 ${isExpanded ? 'bg-slate-50' : ''}`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-slate-900">{row.customer_name || '—'}</p>
                      <p className="truncate text-xs text-slate-600">{row.service_name || '—'}</p>
                      <p className="mt-0.5 text-xs text-slate-500">
                        {fmtDate(row.received_at)} · {fmtTime(row.received_at)}
                      </p>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className="text-sm font-bold text-slate-900">₹{displayAmount.toLocaleString()}</p>
                      <p className="text-xs text-slate-500">Service: ₹{Math.round(receivedServiceCharge).toLocaleString()}</p>
                      {receivedDepartmentCharge > 0 && (
                        <p className="text-xs text-slate-500">Dept: ₹{Math.round(receivedDepartmentCharge).toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2">
                    <div className="flex min-w-0 flex-wrap items-center gap-2">
                      <span className="flex items-center text-xs text-slate-600">
                        <FiBriefcase className="mr-1 h-3 w-3 text-slate-400" />
                        {row.staff_name || '—'}
                      </span>
                      {renderStatus(row)}
                    </div>
                    {renderToggle(row, isExpanded)}
                  </div>
                  {isExpanded && <div className="mt-3">{renderDetails(row)}</div>}
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          {rows.length > 0 && (
            <div className="hidden max-h-[500px] overflow-auto md:block">
              <table className="w-full min-w-full">
                <thead className="sticky top-0 border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className={thCls}>Date</th>
                    <th className={thCls}>Customer</th>
                    <th className={thCls}>Service</th>
                    <th className={thCls}>Staff</th>
                    <th className={thCls}>Amount</th>
                    <th className={thCls}>Status</th>
                    <th className={thCls}><span className="sr-only">Details</span></th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {rows.map((row, index) => {
                    const rowKey = row.service_entry_id != null
                      ? `se-${row.service_entry_id}`
                      : `income-fallback-${index}`;

                    const isExpanded = expandedRow === row.service_entry_id;
                    const { displayAmount, receivedServiceCharge, receivedDepartmentCharge } = rowCalc(row);

                    return (
                      <React.Fragment key={rowKey}>
                        <tr className={`hover:bg-slate-50 ${isExpanded ? 'bg-slate-50' : ''}`}>
                          <td className="px-3 py-3">
                            <div className="flex flex-col">
                              <span className="text-xs font-medium text-slate-900">{fmtDate(row.received_at)}</span>
                              <span className="text-xs text-slate-500">{fmtTime(row.received_at)}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center">
                              <div className="mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100">
                                <FiUser className="h-3 w-3 text-navy-700" />
                              </div>
                              <span className="max-w-[140px] truncate text-xs font-medium text-slate-900">
                                {row.customer_name || '—'}
                              </span>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <span className="text-xs text-slate-900">{row.service_name || '—'}</span>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex items-center">
                              <div className="mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100">
                                <FiBriefcase className="h-3 w-3 text-emerald-600" />
                              </div>
                              <span className="text-xs font-medium text-slate-900">{row.staff_name || '—'}</span>
                            </div>
                          </td>
                          <td className="px-3 py-3">
                            <div className="flex flex-col">
                              <span className="text-xs font-bold text-slate-900">₹{displayAmount.toLocaleString()}</span>
                              <div className="flex items-center text-xs text-slate-500">
                                <span className="mr-2">Service: ₹{Math.round(receivedServiceCharge).toLocaleString()}</span>
                                {receivedDepartmentCharge > 0 && (
                                  <span>Dept: ₹{Math.round(receivedDepartmentCharge).toLocaleString()}</span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td className="px-3 py-3">{renderStatus(row)}</td>
                          <td className="px-3 py-3">{renderToggle(row, isExpanded)}</td>
                        </tr>

                        {isExpanded && (
                          <tr className="bg-slate-50">
                            <td colSpan="7" className="px-3 py-3">{renderDetails(row)}</td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

// Ledger View Component
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

  const sideCardCls = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm';
  const sideTitleCls = 'mb-3 flex items-center text-sm font-bold text-slate-900';
  const emptyCls = 'py-2 text-center text-xs text-slate-500';
  const thCls = 'px-3 py-2 text-left text-xs font-medium uppercase tracking-wider text-slate-500';

  const walletIcon = (type) => (
    type === 'cash' ? <FiDollarSign className="h-3 w-3" /> :
    type === 'bank' ? <FiCreditCard className="h-3 w-3" /> :
    <FiSmartphone className="h-3 w-3" />
  );
  const walletTone = (type) => (
    type === 'cash' ? 'bg-emerald-100 text-emerald-600' :
    type === 'bank' ? 'bg-slate-100 text-navy-700' :
    'bg-slate-200 text-slate-700'
  );
  const typeBadge = (isCredit) => (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
      isCredit ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
    }`}>
      {isCredit ? (
        <>
          <FiTrendingUp className="mr-1 h-2 w-2" />
          Credit
        </>
      ) : (
        <>
          <FiTrendingDown className="mr-1 h-2 w-2" />
          Debit
        </>
      )}
    </span>
  );
  const statusBadge = (
    <span className="inline-flex items-center rounded-full bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">
      <FiCheckCircle className="mr-1 h-2 w-2" />
      Processed
    </span>
  );
  const rowKeyDown = (e, tx) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      onLedgerRowClick(tx);
    }
  };

  return (
    <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
      {/* Left Column - Key Metrics */}
      <div className="order-2 space-y-4 lg:order-1 lg:col-span-1">
        {/* Net Balance Card */}
        <div className={`${sideCardCls} transition-shadow hover:shadow-md`}>
          <div className="mb-3 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className={`rounded-xl p-2 ${netBalance >= 0 ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                {netBalance >= 0 ? (
                  <FiTrendingUp className="h-4 w-4 text-emerald-600" />
                ) : (
                  <FiTrendingDown className="h-4 w-4 text-rose-600" />
                )}
              </div>
              <div>
                <p className="text-xs text-slate-500">Net Balance</p>
                <p className={`text-lg font-bold ${netBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  ₹{Math.abs(netBalance).toLocaleString()}
                  {netBalance >= 0 ? ' (Credit)' : ' (Debit)'}
                </p>
              </div>
            </div>
            <span className={`inline-flex items-center rounded-lg px-2 py-1 text-xs font-medium ${
              dailyTrend >= 0 ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
            }`}>
              {dailyTrend >= 0 ? (
                <FiTrendingUp className="mr-1 h-2 w-2" />
              ) : (
                <FiTrendingDown className="mr-1 h-2 w-2" />
              )}
              {Math.abs(dailyTrend)}%
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <p className="mb-1 text-xs text-slate-600">Total Credits</p>
              <p className="text-sm font-semibold text-emerald-600">₹{totalCredits.toLocaleString()}</p>
            </div>
            <div>
              <p className="mb-1 text-xs text-slate-600">Total Debits</p>
              <p className="text-sm font-semibold text-rose-600">₹{totalDebits.toLocaleString()}</p>
            </div>
          </div>
        </div>

        {/* Top Wallets by Activity */}
        <div className={sideCardCls}>
          <h3 className={sideTitleCls}>
            <FiCreditCard className="mr-2 h-4 w-4 text-navy-700" />
            Top Wallets
          </h3>
          <div className="space-y-2">
            {topWallets.map((wallet, index) => (
              <div key={wallet.name} className="flex items-center justify-between gap-2 rounded-lg p-2 hover:bg-slate-50">
                <div className="flex min-w-0 items-center gap-2">
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    index === 0 ? 'bg-navy-700 text-white' :
                    index === 1 ? 'bg-navy-500 text-white' :
                    index === 2 ? 'bg-slate-300 text-slate-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {walletIcon(wallet.type)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-slate-900">{wallet.name}</p>
                    <p className="text-xs text-slate-500">{wallet.type}</p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-bold text-slate-900">{wallet.count} txns</p>
                  <p className={`text-xs ${wallet.net >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                    {wallet.net >= 0 ? '+' : '-'}₹{Math.abs(wallet.net).toLocaleString()}
                  </p>
                </div>
              </div>
            ))}
            {topWallets.length === 0 && (
              <p className={emptyCls}>No wallet data</p>
            )}
          </div>
        </div>

        {/* Category Breakdown */}
        <div className={sideCardCls}>
          <h3 className={sideTitleCls}>
            <FiTag className="mr-2 h-4 w-4 text-navy-700" />
            Category Breakdown
          </h3>
          <div className="space-y-2">
            {topCategories.map((category) => (
              <div key={category.name} className="flex items-center justify-between gap-2 p-2">
                <div className="flex min-w-0 items-center gap-2">
                  <div className={`h-2 w-2 shrink-0 rounded-full ${
                    category.name.includes('Service') ? 'bg-emerald-500' :
                    category.name.includes('Expense') ? 'bg-rose-500' :
                    category.name.includes('Salary') ? 'bg-navy-500' :
                    category.name.includes('Transfer') ? 'bg-navy-700' :
                    'bg-slate-400'
                  }`} />
                  <span className="truncate text-xs font-medium text-slate-700">{category.name}</span>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-bold text-slate-900">₹{category.total.toLocaleString()}</p>
                  <p className="text-xs text-slate-500">{category.count} txns</p>
                </div>
              </div>
            ))}
            {topCategories.length === 0 && (
              <p className={emptyCls}>No category data</p>
            )}
          </div>
        </div>

        {/* Staff Activity */}
        <div className={sideCardCls}>
          <h3 className={sideTitleCls}>
            <FiUsers className="mr-2 h-4 w-4 text-navy-700" />
            Staff Activity
          </h3>
          <div className="space-y-2">
            {topStaff.map((staff, index) => (
              <div key={staff.name} className="flex items-center justify-between gap-2 rounded-lg p-2 hover:bg-slate-50">
                <div className="flex min-w-0 items-center gap-2">
                  <div className={`flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                    index === 0 ? 'bg-amber-100 text-amber-700' :
                    index === 1 ? 'bg-emerald-100 text-emerald-700' :
                    index === 2 ? 'bg-slate-200 text-slate-700' :
                    'bg-slate-100 text-slate-600'
                  }`}>
                    {staff.name.charAt(0)}
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-slate-900">{staff.name}</p>
                    <p className="text-xs text-slate-500">Transactions: {staff.count}</p>
                  </div>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs font-bold text-slate-900">₹{staff.total.toLocaleString()}</p>
                  <p className="text-xs text-slate-500">Avg: ₹{(staff.total / staff.count).toFixed(0)}</p>
                </div>
              </div>
            ))}
            {topStaff.length === 0 && (
              <p className={emptyCls}>No staff activity</p>
            )}
          </div>
        </div>
      </div>

      {/* Right Column - Ledger */}
      <div className="order-1 min-w-0 lg:order-2 lg:col-span-2">
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="flex items-center text-sm font-bold text-slate-900">
                <FiBook className="mr-2 h-4 w-4 text-navy-700" />
                Ledger Transactions (Corrected View)
              </h3>
              <div className="flex items-center gap-2">
                <span className="text-xs text-slate-600">{ledger.length} transactions</span>
                <span className="rounded-lg bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                  Net: ₹{netBalance.toLocaleString()}
                </span>
              </div>
            </div>
            <p className="mt-1 flex items-center text-xs text-slate-500">
              <FiInfo className="mr-1 h-3 w-3" />
              Showing corrected transactions only (reversals hidden)
            </p>
          </div>

          {ledger.length === 0 && (
            <div className="flex flex-col items-center justify-center py-10 text-xs text-slate-500">
              <FiBook className="mb-2 h-8 w-8 text-slate-300" />
              No ledger transactions found
            </div>
          )}

          {/* Mobile cards */}
          <div className="divide-y divide-slate-100 md:hidden">
            {ledger.map((tx, index) => {
              const isCredit = tx.type === 'credit';
              const transactionDate = new Date(tx.created_at);
              const rowKey = `ledger-${tx.id || index}`;

              return (
                <div
                  key={`m-${rowKey}`}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => rowKeyDown(e, tx)}
                  className="cursor-pointer p-4 transition-colors hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                  onClick={() => onLedgerRowClick(tx)}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-center gap-2">
                      <div className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full ${walletTone(tx.wallet_type)}`}>
                        {walletIcon(tx.wallet_type)}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{tx.wallet_name}</p>
                        <p className="text-xs capitalize text-slate-500">{tx.wallet_type}</p>
                      </div>
                    </div>
                    <div className="shrink-0 text-right">
                      <p className={`text-sm font-bold ${isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isCredit ? '+' : '-'}₹{Number(tx.amount || 0).toLocaleString()}
                      </p>
                      {tx.balance_after && (
                        <p className="text-xs text-slate-500">Balance: ₹{Number(tx.balance_after).toLocaleString()}</p>
                      )}
                    </div>
                  </div>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {typeBadge(isCredit)}
                    {statusBadge}
                    <span className="text-xs font-medium text-slate-700">{tx.category}</span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs text-slate-500">
                    <span className="flex min-w-0 items-center truncate">
                      <FiUser className="mr-1 h-3 w-3 shrink-0 text-slate-400" />
                      <span className="truncate">
                        {tx.staff_name || 'System'}
                        {tx.customer_name ? ` · ${tx.customer_name}` : ''}
                      </span>
                    </span>
                    <span className="shrink-0">
                      {transactionDate.toLocaleDateString()} {transactionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                  {tx.service_name && (
                    <p className="mt-1 truncate text-xs text-slate-500">{tx.service_name}</p>
                  )}
                </div>
              );
            })}
          </div>

          {/* Desktop table */}
          {ledger.length > 0 && (
            <div className="hidden max-h-[500px] overflow-auto md:block">
              <table className="w-full min-w-full">
                <thead className="sticky top-0 border-b border-slate-200 bg-slate-50">
                  <tr>
                    <th className={thCls}>Date</th>
                    <th className={thCls}>Wallet</th>
                    <th className={thCls}>Type</th>
                    <th className={thCls}>Amount</th>
                    <th className={thCls}>Category</th>
                    <th className={thCls}>Service/Staff</th>
                    <th className={thCls}>Status</th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-slate-100">
                  {ledger.map((tx, index) => {
                    const isCredit = tx.type === 'credit';
                    const transactionDate = new Date(tx.created_at);
                    const rowKey = `ledger-${tx.id || index}`;

                    return (
                      <tr
                        key={rowKey}
                        tabIndex={0}
                        onKeyDown={(e) => rowKeyDown(e, tx)}
                        className="cursor-pointer hover:bg-slate-50 focus:bg-slate-50 focus:outline-none"
                        onClick={() => onLedgerRowClick(tx)}
                      >
                        <td className="px-3 py-3">
                          <div className="flex flex-col">
                            <span className="text-xs font-medium text-slate-900">{transactionDate.toLocaleDateString()}</span>
                            <span className="text-xs text-slate-500">
                              {transactionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                            </span>
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center">
                            <div className={`mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full ${walletTone(tx.wallet_type)}`}>
                              {walletIcon(tx.wallet_type)}
                            </div>
                            <div>
                              <p className="text-xs font-medium text-slate-900">{tx.wallet_name}</p>
                              <p className="text-xs capitalize text-slate-500">{tx.wallet_type}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">{typeBadge(isCredit)}</td>
                        <td className="px-3 py-3">
                          <div className="flex flex-col">
                            <span className={`text-xs font-bold ${isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {isCredit ? '+' : '-'}₹{Number(tx.amount || 0).toLocaleString()}
                            </span>
                            {tx.balance_after && (
                              <span className="text-xs text-slate-500">
                                Balance: ₹{Number(tx.balance_after).toLocaleString()}
                              </span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex flex-col">
                            <span className="text-xs font-medium text-slate-900">{tx.category}</span>
                            {tx.service_name && (
                              <span className="max-w-[140px] truncate text-xs text-slate-500">{tx.service_name}</span>
                            )}
                          </div>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center">
                            <div className="mr-2 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-slate-100">
                              <FiUser className="h-3 w-3 text-navy-700" />
                            </div>
                            <div>
                              <p className="text-xs font-medium text-slate-900">{tx.staff_name || 'System'}</p>
                              {tx.customer_name && (
                                <p className="max-w-[120px] truncate text-xs text-slate-500">{tx.customer_name}</p>
                              )}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3">{statusBadge}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* Summary Footer */}
          {ledger.length > 0 && (
            <div className="border-t border-slate-200 bg-slate-50 p-3">
              <div className="flex flex-col gap-2 text-xs sm:flex-row sm:items-center sm:justify-between">
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                  <div>
                    <span className="text-slate-600">Total Credits:</span>
                    <span className="ml-1 font-bold text-emerald-600">₹{totalCredits.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-600">Total Debits:</span>
                    <span className="ml-1 font-bold text-rose-600">₹{totalDebits.toLocaleString()}</span>
                  </div>
                  <div>
                    <span className="text-slate-600">Net Balance:</span>
                    <span className={`ml-1 font-bold ${netBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {netBalance >= 0 ? '+' : '-'}₹{Math.abs(netBalance).toLocaleString()}
                    </span>
                  </div>
                </div>
                <div className="text-slate-600">Showing {ledger.length} transactions</div>
              </div>
            </div>
          )}
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
  readOnly = false,
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

  const cardCls = 'rounded-2xl border border-slate-200 bg-white p-4 shadow-sm';
  const labelCls = 'mb-1 block text-sm font-medium text-slate-700';
  const dotSep = <span className="text-xs text-slate-400">•</span>;

  const renderHistoryList = (list, tone) => (
    <div className="max-h-60 space-y-2 overflow-y-auto">
      {list.map((expense) => (
        <div
          key={expense.id}
          className={`flex flex-col gap-2 rounded-xl border p-3 sm:flex-row sm:items-center sm:justify-between ${
            tone === 'rose' ? 'border-rose-100 bg-rose-50' : 'border-emerald-100 bg-emerald-50'
          }`}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">
              {expense.description || expense.category}
            </p>
            <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-slate-500">
              <span>{expense.date}</span>
              {dotSep}
              <span>{expense.staff_name || 'Staff'}</span>
              {dotSep}
              <span>{expense.wallet_name || 'Wallet'}</span>
            </div>
          </div>
          <div className="flex items-center justify-between gap-3 sm:justify-end">
            <span className={`whitespace-nowrap text-sm font-semibold ${tone === 'rose' ? 'text-rose-700' : 'text-emerald-700'}`}>
              {formatCurrency(expense.amount)}
            </span>
            {onCorrect && tone !== 'rose' && (
              <button
                type="button"
                onClick={() => openCorrection(expense)}
                title="Correct this expense"
                aria-label="Correct this expense"
                className="rounded-lg bg-white p-1.5 text-navy-700 ring-1 ring-slate-200 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-2 focus:ring-navy-500/40"
              >
                <FiRefreshCw className="h-4 w-4" />
              </button>
            )}
          </div>
        </div>
      ))}
    </div>
  );

  return (
    <div className="space-y-4">
      {/* Pending Approvals */}
      {pendingExpenses.length > 0 && (
        <div className="rounded-2xl border border-amber-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2">
              <div className="rounded-xl bg-amber-100 p-2">
                <FiAlertTriangle className="h-4 w-4 text-amber-600" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-slate-900">Pending Approvals</h4>
                <p className="text-xs font-medium text-amber-600">{pendingExpenses.length} items require action</p>
              </div>
            </div>
            <span className="flex items-center text-xs font-medium text-amber-600">
              <FiClock className="mr-1 h-3 w-3" />
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
                  className="flex flex-col gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 sm:flex-row sm:items-center sm:justify-between"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 rounded-lg border border-amber-200 bg-white p-1">
                        {category && React.createElement(category.icon, { className: "h-3 w-3 text-amber-600" })}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-slate-900">{expense.description}</p>
                        <div className="mt-0.5 flex flex-wrap items-center gap-1">
                          <span className="flex items-center text-xs text-slate-600">
                            <PaymentIcon className="mr-1 h-2 w-2" />
                            {expense.paymentMethod}
                          </span>
                          {dotSep}
                          <span className="text-xs text-slate-600">by {expense.staff_name || 'Staff'}</span>
                          {dotSep}
                          <span className="text-xs text-slate-600">{expense.date}</span>
                        </div>
                      </div>
                    </div>
                    {expense.notes && (
                      <p className="mt-1 flex items-start text-xs text-slate-600">
                        <FiMessageSquare className="mr-1 mt-0.5 h-2 w-2 shrink-0" />
                        {expense.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center justify-between gap-3 sm:flex-col sm:items-end sm:justify-start sm:gap-1">
                    <p className="text-sm font-bold text-slate-900">
                      ₹{Number(expense.amount || 0).toLocaleString('en-IN', {
                        minimumFractionDigits: 2
                      })}
                    </p>
                    {!readOnly && (
                    <div className="flex gap-1">
                      <button
                        type="button"
                        onClick={() => onApprove(expense.id)}
                        className="flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1 text-xs text-white hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-500/40"
                      >
                        <FiCheck className="h-2 w-2" />
                        <span>Approve</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => onReject(expense.id)}
                        className="flex items-center gap-1 rounded-lg bg-rose-600 px-2.5 py-1 text-xs text-white hover:bg-rose-700 focus:outline-none focus:ring-2 focus:ring-rose-500/40"
                      >
                        <FiX className="h-2 w-2" />
                        <span>Reject</span>
                      </button>
                    </div>
                    )}
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
            <div className="rounded-2xl border border-emerald-200 bg-white p-4 shadow-sm">
              <h4 className="mb-3 flex items-center text-sm font-semibold text-slate-900">
                <FiCheckCircle className="mr-2 h-4 w-4 text-emerald-600" />
                Approved / Auto‑Approved ({approvedExpenses.length})
              </h4>
              {renderHistoryList(approvedExpenses, 'emerald')}
            </div>
          )}

          {/* Rejected */}
          {rejectedExpenses.length > 0 && (
            <div className="rounded-2xl border border-rose-200 bg-white p-4 shadow-sm">
              <h4 className="mb-3 flex items-center text-sm font-semibold text-slate-900">
                <FiXCircle className="mr-2 h-4 w-4 text-rose-600" />
                Rejected ({rejectedExpenses.length})
              </h4>
              {renderHistoryList(rejectedExpenses, 'rose')}
            </div>
          )}
        </div>
      )}

      {/* Expense Summary Cards */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        <div className="rounded-2xl border border-emerald-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
          <h5 className="mb-1 flex items-center text-xs font-medium text-slate-900">
            <FiCheckCircle className="mr-1 h-3 w-3 text-emerald-600" />
            Approved
          </h5>
          <p className="text-sm font-bold text-emerald-600">
            {formatCurrency(
              expenses
                .filter(e => e.status === 'approved' || e.status === 'auto_approved')
                .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
            )}
          </p>
          <p className="mt-0.5 flex items-center text-xs text-slate-600">
            <FiPackage className="mr-1 h-2 w-2" />
            {expenses.filter(e => e.status === 'approved' || e.status === 'auto_approved').length} items
          </p>
        </div>

        <div className="rounded-2xl border border-amber-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
          <h5 className="mb-1 flex items-center text-xs font-medium text-slate-900">
            <FiClock className="mr-1 h-3 w-3 text-amber-600" />
            Pending
          </h5>
          <p className="text-sm font-bold text-amber-600">
            {formatCurrency(
              expenses
                .filter(e => e.status === 'pending')
                .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
            )}
          </p>
          <p className="mt-0.5 flex items-center text-xs text-slate-600">
            <FiAlertCircle className="mr-1 h-2 w-2" />
            {expenses.filter(e => e.status === 'pending').length} items
          </p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-3 shadow-sm transition-shadow hover:shadow-md">
          <h5 className="mb-1 flex items-center text-xs font-medium text-slate-900">
            <FiDollarSign className="mr-1 h-3 w-3 text-navy-700" />
            Total
          </h5>
          <p className="text-sm font-bold text-slate-900">
            {formatCurrency(
              expenses
                .filter(e => e.status !== 'rejected')
                .reduce((sum, e) => sum + (Number(e.amount) || 0), 0)
            )}
          </p>
          <p className="mt-0.5 flex items-center text-xs text-slate-600">
            <FiDatabase className="mr-1 h-2 w-2" />
            {expenses.length} items
          </p>
        </div>
      </div>

      {/* Add Expense Button */}
      {allowAdd && !showAddForm && onAddClick && (
        <div className="flex justify-center">
          <motion.button
            type="button"
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={onAddClick}
            className="flex items-center gap-2 rounded-xl bg-navy-700 px-4 py-2 text-sm text-white shadow-sm transition-colors hover:bg-navy-800 focus:outline-none focus:ring-2 focus:ring-navy-500/40"
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
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4"
            role="dialog"
            aria-modal="true"
            aria-label="Correct expense"
          >
            <motion.div
              initial={{ scale: 0.95 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0.95 }}
              className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl"
            >
              <div className="border-b border-slate-200 p-6">
                <h2 className="text-lg font-bold text-slate-900">Correct Expense</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Original: {correctingExpense.description} – {formatCurrency(correctingExpense.amount)} on {correctingExpense.expense_date || correctingExpense.date}
                </p>
              </div>
              <form onSubmit={handleCorrectionSubmit} className="space-y-4 p-6">
                {/* New Amount */}
                <div>
                  <label htmlFor="correction-amount" className={labelCls}>
                    New Amount (₹) *
                  </label>
                  <input
                    id="correction-amount"
                    type="number"
                    value={correctionForm.amount}
                    onChange={(e) =>
                      setCorrectionForm((prev) => ({ ...prev, amount: e.target.value }))
                    }
                    className={inputCls}
                    required
                    min="0"
                    step="0.01"
                  />
                </div>

                {/* New Wallet */}
                {wallets.length > 0 && (
                  <div>
                    <span className={labelCls}>New Wallet *</span>
                    <div className="max-h-40 space-y-2 overflow-y-auto pr-1" role="radiogroup" aria-label="New wallet">
                      {wallets.map((wallet) => (
                        <label
                          key={wallet.id}
                          className={`flex cursor-pointer items-center justify-between gap-3 rounded-xl border-2 p-3 transition-colors focus-within:ring-2 focus-within:ring-navy-500/40 ${
                            correctionForm.wallet_id === wallet.id.toString()
                              ? 'border-navy-500 bg-slate-50'
                              : 'border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex min-w-0 items-center gap-2">
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
                            <div className="min-w-0">
                              <p className="truncate text-sm font-medium text-slate-900">{wallet.name}</p>
                              <p className="text-xs text-slate-500">{getWalletMeta(wallet).label}</p>
                            </div>
                          </div>
                          <span className="shrink-0 text-sm font-semibold text-slate-700">
                            {formatCurrency(walletBalances[wallet.id] ?? 0)}
                          </span>
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                {/* Reason */}
                <div>
                  <label htmlFor="correction-reason" className={labelCls}>
                    Reason for Correction
                  </label>
                  <textarea
                    id="correction-reason"
                    value={correctionForm.reason}
                    onChange={(e) =>
                      setCorrectionForm((prev) => ({ ...prev, reason: e.target.value }))
                    }
                    className={inputCls}
                    rows="3"
                    placeholder="Explain why you are correcting this expense..."
                  />
                </div>

                <div className="flex justify-end gap-3 border-t border-slate-200 pt-4">
                  <button
                    type="button"
                    onClick={() => setShowCorrectModal(false)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-navy-500/30"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="flex items-center gap-2 rounded-xl bg-navy-700 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-navy-800 focus:outline-none focus:ring-2 focus:ring-navy-500/40"
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
   MAIN ACCOUNTING SECTION (with Excel export)
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
  const [date, setDate] = useState(todayIST());
  const [showAdminExpenseModal, setShowAdminExpenseModal] = useState(false);

  // Teams related state
  const [teams, setTeams] = useState([]);

  const fetchTeams = async () => {
    try {
      const res = await fetch(
        `${import.meta.env.VITE_API_URL}/api/teams`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`
          }
        }
      );
      const data = await res.json();
      setTeams(data || []);
    } catch (err) {
      console.error("Failed to load teams", err);
    }
  };

  useEffect(() => {
    if (showAdminExpenseModal && teams.length === 0) {
      fetchTeams();
    }
  }, [showAdminExpenseModal]);

  const [showMiscIncomeModal, setShowMiscIncomeModal] = useState(false);
  const [miscIncomeForm, setMiscIncomeForm] = useState({
    amount: '',
    wallet_id: '',
    description: '',
    date: todayIST()
  });

  const handleMiscIncomeSubmit = async (e) => {
      e.preventDefault();
      if (readOnly) return;
      try {
        const [year, month, day] = miscIncomeForm.date.split('-');
        const now = new Date();
        const submissionDate = new Date(
          year, 
          month - 1,
          day, 
          now.getHours(), 
          now.getMinutes(), 
          now.getSeconds()
        );

        const payload = {
          ...miscIncomeForm,
          date: submissionDate.toISOString() 
        };

        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/accounting/misc-income`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`
          },
          body: JSON.stringify(payload)
        });
        
        if (!res.ok) {
          const err = await res.json();
          throw new Error(err.error || 'Failed to add misc income');
        }
        
        toast.success('Misc Income recorded successfully!');
        setShowMiscIncomeModal(false);
        setMiscIncomeForm({ amount: '', wallet_id: '', description: '', date: todayIST() });
        
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

  const refreshWalletBookBalances = async (targetDate) => { 
    const walletParams = new URLSearchParams();
    
    if (isSuperAdmin && centreId) {
      walletParams.append("centreId", centreId);
    }
    if (targetDate) {
      walletParams.append("date", targetDate);
    }

    const res = await fetch(
      `${import.meta.env.VITE_API_URL}/api/accounting/wallet-book-balances?${walletParams.toString()}`, 
      {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      }
    );

    const data = await res.json();

    const merged = data.map(item => ({
      id: item.id,
      name: item.name,
      type: item.wallet_type || 'unknown',
      wallet_type: item.wallet_type || 'unknown',
      currentBalance: Number(item.book_balance || 0),
      book_balance: Number(item.book_balance || 0)
    }));

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

        await refreshWalletBookBalances(date);

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
      refreshWalletBookBalances(date);
    }
  }, [activeAccountingTab, date]);

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
    if (readOnly) return;
    try {
      const approveRes = await fetch(
        `${import.meta.env.VITE_API_URL}/api/expense/${expenseId}/approve`,
        {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem("token")}`
          }
        }
      );

      // 🔥 FIX: Read the exact error message from your backend!
      if (!approveRes.ok) {
        const errorData = await approveRes.json();
        toast.error(errorData.error || 'Failed to approve expense');
        return; // Stop the function here so it doesn't refresh blindly
      }

      toast.success('Expense approved successfully!');

      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/expense?${buildQueryString()}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      onUpdateAccounting('expenses', await res.json());
      
      // Refresh wallets since money just left the account!
      await refreshWalletBookBalances(date); 
      
    } catch (err) {
      console.error("Approval error:", err);
      toast.error('Network error while trying to approve expense.');
    }
  };

  const handleRejectExpense = async (expenseId) => {
    if (readOnly) return;
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

  const handleCorrectExpense = async (expenseId, payload) => {
    if (readOnly) return;
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
      await fetchExpenses();
      await refreshWalletBookBalances(date);
    } catch (error) {
      toast.error(error.message || 'Failed to correct expense');
    }
  };

  const handleAdminExpenseSubmit = async (payload) => {
    if (readOnly) return;
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

      await fetchExpenses();
      await refreshWalletBookBalances(date);
      toast.success("Expense added successfully!");
      setShowAdminExpenseModal(false);
      
    } catch (err) {
      toast.error(err.message || "Failed to add expense");
    }
  };

  const handleUpdateDailySummary = async (summary) => {
      if (readOnly) return;
      onUpdateAccounting('dailySummary', {
        ...accountingData.dailySummary,
        ...summary
      });

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
    if (readOnly) return;
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

      const dailyRes = await fetch(
        `${import.meta.env.VITE_API_URL}/api/accounting/daily-summary?${buildQueryString({ date })}`,
        { headers }
      );
      if (dailyRes.ok) {
        const dailyData = await dailyRes.json();
        onUpdateAccounting("dailySummary", dailyData);
      }

      const incomeRes = await fetch(
        `${import.meta.env.VITE_API_URL}/api/accounting/income?${buildQueryString({ date })}`,
        { headers }
      );
      if (incomeRes.ok) {
        const incomeData = await incomeRes.json();
        onUpdateAccounting('income', incomeData);
      }

      await refreshWalletBookBalances(date);

      toast.success("All data refreshed!");
    } catch (error) {
      console.error("Refresh error:", error);
      toast.error("Failed to refresh data");
    } finally {
      setLoading(false);
    }
  };

  // ---------- NEW: Excel export handler ----------
const handleExportExcel = () => {
    try {
      const formatAmount = (val) => val ? Number(val).toLocaleString('en-IN') : '0';
      
      const incomeRows = (accountingData.income?.rows || []).map(row => ({
        'Date': row.received_at ? new Date(row.received_at).toLocaleDateString() : '',
        'Time': row.received_at ? new Date(row.received_at).toLocaleTimeString() : '',
        'Customer': row.customer_name || '',
        'Service': row.service_name || '',
        'Staff': row.staff_name || '',
        'Received Amount (₹)': formatAmount(row.received_amount),
        'Service Charges (₹)': formatAmount(row.service_charges),
        'Department Charges (₹)': formatAmount(row.department_charges),
        'Status': 'Completed'
      }));
      
      const expensesForDate = accountingData.expenses.filter(e => e.date === date && e.status !== 'rejected');
      const expenseRows = expensesForDate.map(exp => ({
        'Date': exp.date || '',
        'Description': exp.description || '',
        'Category': exp.category || '',
        'Amount (₹)': formatAmount(exp.amount),
        'Payment Method': exp.payment_method || '',
        'Wallet': exp.wallet_name || '',
        'Staff': exp.staff_name || '',
        'Status': exp.status || '',
        'Notes': exp.notes || ''
      }));
      
      const ledgerRows = (accountingData.ledger?.rows || []).map(tx => ({
        'Date': tx.created_at ? new Date(tx.created_at).toLocaleDateString() : '',
        'Time': tx.created_at ? new Date(tx.created_at).toLocaleTimeString() : '',
        'Wallet': tx.wallet_name || '',
        'Type': tx.type || '',
        'Amount (₹)': formatAmount(tx.amount),
        'Category': tx.category || '',
        'Staff': tx.staff_name || '',
        'Customer': tx.customer_name || '',
        'Service': tx.service_name || ''
      }));
      
      const walletsData = derivedWallets.map(w => ({
        'Wallet Name': w.name,
        'Type': w.type || w.wallet_type,
        'Book Balance (₹)': formatAmount(w.book_balance),
        'Current Balance (₹)': formatAmount(w.currentBalance),
        'Variance (₹)': formatAmount((w.currentBalance || 0) - (w.book_balance || 0)),
        'Reconciled': Math.abs((w.currentBalance || 0) - (w.book_balance || 0)) <= 10 ? 'Yes' : 'No'
      }));
      
      const derived = accountingData.dailySummary?.derived || {};
      const manual = accountingData.dailySummary?.manual || {};
      const summaryRows = [{
        'Date': date,
        'Opening Balance (₹)': formatAmount(derived.openingBalance),
        'Cash Opening (₹)': formatAmount(derived.cashOpening),
        'Cash Inflow (₹)': formatAmount(derived.cashInflow),
        'Digital Inflow (₹)': formatAmount(derived.digitalInflow),
        'Bank Inflow (₹)': formatAmount(derived.bankInflow),
        'Cash Outflow (₹)': formatAmount(derived.cashOutflow),
        'Digital Outflow (₹)': formatAmount(derived.digitalOutflow),
        'Bank Outflow (₹)': formatAmount(derived.bankOutflow),
        'Actual Cash in Hand (₹)': formatAmount(manual.actualCashInHand),
        'Total Inflow (₹)': formatAmount((derived.cashInflow||0)+(derived.digitalInflow||0)+(derived.bankInflow||0)),
        'Total Outflow (₹)': formatAmount((derived.cashOutflow||0)+(derived.digitalOutflow||0)+(derived.bankOutflow||0)),
        'Closing Balance (₹)': formatAmount((derived.openingBalance||0) + (derived.cashInflow||0)+(derived.digitalInflow||0)+(derived.bankInflow||0) - ((derived.cashOutflow||0)+(derived.digitalOutflow||0)+(derived.bankOutflow||0))),
        'Cash Variance (₹)': formatAmount(((derived.cashOpening||0)+(derived.cashInflow||0)-(derived.cashOutflow||0)) - (manual.actualCashInHand||0))
      }];
      
      const nightly = accountingData.nightlyAccounting?.[date] || {};
      const nightlyRows = [{
        'Date': date,
        'Closing Cash (Calculated) (₹)': formatAmount(nightly.closingCash),
        'Actual Cash Count (₹)': formatAmount(nightly.actualCashCount),
        'Cash Variance (₹)': formatAmount((nightly.closingCash||0) - (nightly.actualCashCount||0)),
        'Income Entry Verified': nightly.checklist?.incomeEntryVerified ? 'Yes' : 'No',
        'Expense Entry Verified': nightly.checklist?.expenseEntryVerified ? 'Yes' : 'No',
        'Bank Entry Reconciled': nightly.checklist?.bankEntryReconciled ? 'Yes' : 'No',
        'Daily Summary Completed': nightly.checklist?.dailySummaryCompleted ? 'Yes' : 'No',
        'Cash Reconciled': nightly.checklist?.cashReconciled ? 'Yes' : 'No',
        'Wallet Balances Verified': nightly.checklist?.walletBalancesVerified ? 'Yes' : 'No',
        'Notes': nightly.notes || '',
        'Closed Timestamp': nightly.timestamp ? new Date(nightly.timestamp).toLocaleString() : ''
      }];
      
      const wb = XLSX.utils.book_new();
      const wsIncome = XLSX.utils.json_to_sheet(incomeRows);
      const wsExpenses = XLSX.utils.json_to_sheet(expenseRows);
      const wsLedger = XLSX.utils.json_to_sheet(ledgerRows);
      const wsWallets = XLSX.utils.json_to_sheet(walletsData);
      const wsSummary = XLSX.utils.json_to_sheet(summaryRows);
      const wsNightly = XLSX.utils.json_to_sheet(nightlyRows);
      
      const autoSizeColumns = (ws) => {
        if (!ws['!cols']) ws['!cols'] = [];
        const range = XLSX.utils.decode_range(ws['!ref']);
        for (let C = range.s.c; C <= range.e.c; ++C) {
          let maxLen = 0;
          for (let R = range.s.r; R <= range.e.r; ++R) {
            const cell = ws[XLSX.utils.encode_cell({ r: R, c: C })];
            if (cell && cell.v) {
              let len = String(cell.v).length;
              if (len > maxLen) maxLen = len;
            }
          }
          ws['!cols'][C] = { wch: Math.min(maxLen + 2, 40) };
        }
      };
      
      autoSizeColumns(wsIncome);
      autoSizeColumns(wsExpenses);
      autoSizeColumns(wsLedger);
      autoSizeColumns(wsWallets);
      autoSizeColumns(wsSummary);
      autoSizeColumns(wsNightly);
      
      XLSX.utils.book_append_sheet(wb, wsIncome, 'Income');
      XLSX.utils.book_append_sheet(wb, wsExpenses, 'Expenses');
      XLSX.utils.book_append_sheet(wb, wsLedger, 'Ledger');
      XLSX.utils.book_append_sheet(wb, wsWallets, 'Wallets');
      XLSX.utils.book_append_sheet(wb, wsSummary, 'Daily Summary');
      XLSX.utils.book_append_sheet(wb, wsNightly, 'Nightly Accounting');
      
      const fileName = `Accounting_Report_${date}.xlsx`;
      
      // --- BROWSER-SAFE EXPORT LOGIC ---
      // Generate the Excel file as an array buffer
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      
      // Create a Blob from the array buffer
      const dataBlob = new Blob([excelBuffer], { 
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' 
      });
      
      // Create a temporary download link and click it
      const url = window.URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', fileName);
      document.body.appendChild(link);
      link.click();
      
      // Clean up the DOM and URL object
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      toast.success(`Report exported as ${fileName}`);
    } catch (error) {
      console.error('Export failed:', error);
      toast.error('Failed to generate Excel report');
    }
  };

  const ledgerFieldCls = 'w-full rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-900 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/30';

  return (
    <div className="space-y-4">
      {/* Accounting Dashboard Header */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="mb-1 flex items-center text-lg font-bold text-slate-900">
              <FiFileText className="mr-2 h-5 w-5 text-navy-700" />
              Accounting Center
            </h2>
            <p className="text-xs text-slate-600">Daily financial management and reconciliation</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="relative">
              <FiCalendar className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                aria-label="Accounting date"
                className="rounded-xl border border-slate-300 bg-white py-2 pl-10 pr-3 text-sm text-slate-900 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/30"
              />
            </div>
            <button
              type="button"
              onClick={handleRefreshAllData}
              disabled={loading}
              className="rounded-xl bg-slate-100 p-2.5 text-navy-700 transition-colors hover:bg-slate-200 focus:outline-none focus:ring-2 focus:ring-navy-500/30 disabled:cursor-not-allowed disabled:opacity-50"
              title="Refresh all data"
              aria-label="Refresh all data"
            >
              <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-5">
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
            color="bg-navy-700"
          />
          <StatCard
            title="Pending Approvals"
            value={pendingApprovals}
            subtitle="Requires action"
            icon={FiAlertCircle}
            color="bg-amber-600"
          />
          <StatCard
            title="Cash in Hand"
            value={`₹${calculateCashInHand().toLocaleString()}`}
            subtitle="Physical cash wallets"
            icon={FiDollarSign}
            color="bg-navy-500"
          />
          <StatCard
            title="Total Wallet Balance"
            value={`₹${calculateTotalWalletBalance().toLocaleString()}`}
            subtitle="All wallets combined"
            icon={FiSmartphone}
            color="bg-slate-600"
          />
        </div>
      </div>

      {loading ? (
        <div role="status" className="flex items-center justify-center rounded-2xl border border-slate-200 bg-white p-8 shadow-sm">
          <FiRefreshCw className="h-6 w-6 animate-spin text-navy-700" />
          <span className="ml-2 text-slate-600">Loading accounting data...</span>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="border-b border-slate-200 bg-slate-50">
            <div className="flex overflow-x-auto px-2" role="tablist" aria-label="Accounting sections">
              {accountingTabs.map(tab => {
                const Icon = tab.icon;
                const isActive = activeAccountingTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveAccountingTab(tab.id)}
                    className={`flex items-center gap-2 whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-navy-500/40 ${
                      isActive
                        ? 'border-navy-700 bg-white text-navy-700'
                        : 'border-transparent text-slate-500 hover:bg-slate-100 hover:text-slate-700'
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
                  readOnly={readOnly}
                />
                
                <DailySummaryComponent
                  summaryData={accountingData.dailySummary}
                  onUpdate={handleUpdateDailySummary}
                  readOnly={readOnly}
                />
              </div>
            )}

            {/* Income View */}
            {activeAccountingTab === 'income' && (
              <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="flex items-center text-sm font-semibold text-slate-900">
                    <FiTrendingUp className="mr-2 h-4 w-4 text-emerald-600" />
                    Income & Collections
                  </h2>
                  {!readOnly && (
                  <button
                    type="button"
                    onClick={() => setShowMiscIncomeModal(true)}
                    className="flex items-center gap-1 rounded-xl bg-navy-700 px-3 py-1.5 text-sm text-white shadow-sm hover:bg-navy-800 focus:outline-none focus:ring-2 focus:ring-navy-500/40"
                  >
                    <FiPlusCircle className="h-4 w-4" />
                    <span>Add Misc Income</span>
                  </button>
                  )}
                </div>
                <IncomeViewComponent
                  transactions={accountingData.income || []}
                />
              </>
            )}

            {/* Ledger View */}
            {activeAccountingTab === 'ledger' && (
              <div className="space-y-4">
                <div className="grid grid-cols-1 gap-3 rounded-2xl border border-slate-200 bg-slate-50 p-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
                  <input
                    type="date"
                    value={ledgerFilters.from || date}
                    onChange={(e) =>
                      setLedgerFilters(prev => ({ ...prev, from: e.target.value }))
                    }
                    aria-label="From date"
                    className={ledgerFieldCls}
                    placeholder="From date"
                  />

                  <input
                    type="date"
                    value={ledgerFilters.to || date}
                    onChange={(e) =>
                      setLedgerFilters(prev => ({ ...prev, to: e.target.value }))
                    }
                    aria-label="To date"
                    className={ledgerFieldCls}
                    placeholder="To date"
                  />

                  <select
                    value={ledgerFilters.staff_id}
                    onChange={(e) =>
                      setLedgerFilters(prev => ({ ...prev, staff_id: e.target.value }))
                    }
                    aria-label="Staff"
                    className={ledgerFieldCls}
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
                    aria-label="Wallet"
                    className={ledgerFieldCls}
                  >
                    <option value="">All Wallets</option>
                      {derivedWallets?.map(w => (
                      <option key={w.id} value={w.id}>{w.name}</option>
                      ))}
                  </select>

                  <select
                    value={ledgerFilters.category}
                    onChange={(e) =>
                      setLedgerFilters(prev => ({ ...prev, category: e.target.value }))
                    }
                    aria-label="Category"
                    className={ledgerFieldCls}
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
                    type="button"
                    onClick={() => {
                      setLedgerFilters({
                        from: date,
                        to: date,
                        staff_id: '',
                        wallet_id: '',
                        category: ''
                      });
                    }}
                    className="flex items-center justify-center rounded-xl bg-navy-700 px-3 py-1.5 text-sm text-white hover:bg-navy-800 focus:outline-none focus:ring-2 focus:ring-navy-500/40"
                  >
                    <FiRefreshCw className="mr-1 h-3 w-3" />
                    Reset to Current Filter
                  </button>
                </div>

                <LedgerView
                  ledger={accountingData.ledger?.rows || []}
                  onLedgerRowClick={handleLedgerRowClick}
                />
              </div>
            )}

            {/* Expenses */}
            {activeAccountingTab === 'expenses' && (
              <>
                <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                  <h2 className="flex items-center text-sm font-semibold text-slate-900">
                    <FiTrendingDown className="mr-2 h-4 w-4 text-navy-700" />
                    Expenses
                  </h2>

                  {!readOnly && (
                  <button
                    type="button"
                    onClick={() => setShowAdminExpenseModal(true)}
                    className="flex items-center gap-1 rounded-xl bg-navy-700 px-3 py-1.5 text-sm text-white shadow-sm hover:bg-navy-800 focus:outline-none focus:ring-2 focus:ring-navy-500/40"
                  >
                    <FiPlusCircle className="h-4 w-4" />
                    <span>Add Expense</span>
                  </button>
                  )}
                </div>

                <ExpenseManagement
                  expenses={expensesForCurrentDate}
                  onApprove={handleApproveExpense}
                  onReject={handleRejectExpense}
                  onCorrect={readOnly ? undefined : handleCorrectExpense}
                  readOnly={readOnly}
                  wallets={derivedWallets}
                  allowAdd={false}
                />
              </>
            )}

            {/* Wallet Reconciliation */}
            {activeAccountingTab === 'wallets' && (
              <WalletReconciliation
                wallets={derivedWallets}
                onRefreshWallets={refreshWalletBookBalances}
                onAdjusted={fetchExpenses}
                date={date}
                centreId={centreId}
                isSuperAdmin={isSuperAdmin}
                readOnly={readOnly}
              />
            )}

            {/* Reports */}
            {activeAccountingTab === 'reports' && (
              <div className="space-y-6">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h2 className="flex items-center text-lg font-bold text-slate-900">
                      <FiFileText className="mr-2 h-5 w-5 text-navy-700" />
                      Financial Reports & Analytics
                    </h2>
                    <p className="mt-1 text-sm text-slate-600">Comprehensive financial insights and analysis</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <span className="text-xs text-slate-600">Period:</span>
                      <select aria-label="Report period" className="rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/30">
                        <option>Today</option>
                        <option>This Week</option>
                        <option>This Month</option>
                        <option>This Quarter</option>
                        <option>This Year</option>
                        <option>Custom Range</option>
                      </select>
                    </div>
                    <button
                      type="button"
                      onClick={handleExportExcel}
                      className="flex items-center gap-2 rounded-xl bg-navy-700 px-4 py-2 text-sm text-white transition-colors hover:bg-navy-800 focus:outline-none focus:ring-2 focus:ring-navy-500/40"
                    >
                      <FiDownload className="h-4 w-4" />
                      <span>Export Report</span>
                    </button>
                  </div>
                </div>

                {/* Key Performance Indicators */}
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 bg-emerald-100 rounded-xl">
                        <FiTrendingUp className="h-5 w-5 text-emerald-600" />
                      </div>
                      <span className="text-xs bg-emerald-100 text-emerald-700 px-2 py-1 rounded-full">+12.5%</span>
                    </div>
                    <p className="text-sm text-slate-600">Total Revenue</p>
                    <p className="text-2xl font-bold text-slate-900">₹{totalRevenue.toLocaleString()}</p>
                    <div className="mt-2 flex items-center text-xs text-slate-500">
                      <span>Services: {(accountingData.income?.rows?.length || 0)}</span>
                      <div className="w-1 h-1 mx-2 bg-slate-300 rounded-full"></div>
                      <span>Avg: ₹{(totalRevenue/(accountingData.income?.rows?.length || 1)).toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 bg-rose-100 rounded-xl">
                        <FiTrendingDown className="h-5 w-5 text-rose-600" />
                      </div>
                      <span className="text-xs bg-rose-100 text-rose-700 px-2 py-1 rounded-full">-8.2%</span>
                    </div>
                    <p className="text-sm text-slate-600">Total Expenses</p>
                    <p className="text-2xl font-bold text-slate-900">₹{todayExpenses.toLocaleString()}</p>
                    <div className="mt-2 flex items-center text-xs text-slate-500">
                      <span>Approved: {expensesForCurrentDate.filter(e => e.status === 'approved').length}</span>
                      <div className="w-1 h-1 mx-2 bg-slate-300 rounded-full"></div>
                      <span>Pending: {pendingApprovals}</span>
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 bg-slate-100 rounded-xl">
                        <FiDollarSign className="h-5 w-5 text-navy-700" />
                      </div>
                      <span className={`text-xs px-2 py-1 rounded-full ${todayProfit >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {todayProfit >= 0 ? '+' : ''}{totalServiceCharges > 0 ? ((todayProfit/totalServiceCharges)*100).toFixed(1) : '0'}%
                      </span>
                    </div>
                    <p className="text-sm text-slate-600">Net Profit</p>
                    <p className="text-2xl font-bold text-slate-900">₹{totalServiceCharges.toLocaleString()}</p>
                    <div className="mt-2 text-xs text-slate-500">
                      Service Charges • {(accountingData.income?.rows?.length || 0)} services
                    </div>
                  </div>

                  <div className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 bg-slate-100 rounded-xl">
                        <FiActivity className="h-5 w-5 text-navy-700" />
                      </div>
                      <span className="text-xs bg-slate-100 text-navy-700 px-2 py-1 rounded-full">Real-time</span>
                    </div>
                    <p className="text-sm text-slate-600">Cash in Hand</p>
                    <p className="text-2xl font-bold text-slate-900">₹{calculateCashInHand().toLocaleString()}</p>
                    <div className="mt-2 text-xs text-slate-500">
                      From {derivedWallets.filter(w => w.type?.toLowerCase() === 'cash').length} cash wallets
                    </div>
                  </div>
                </div>

                {/* Detailed Reports Grid (collapsed for brevity, same as original) */}
                <div className="grid grid-cols-1 gap-6 xl:grid-cols-2">
                  {/* Income Breakdown */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-slate-900 text-sm flex items-center">
                        <FiTrendingUp className="h-4 w-4 mr-2 text-emerald-600" />
                        Income Breakdown
                      </h3>
                      <button className="text-xs text-navy-700 hover:text-navy-800 flex items-center">
                        <FiEye className="h-3 w-3 mr-1" />
                        View Details
                      </button>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-2">
                            <div className="w-3 h-3 rounded-full bg-emerald-500"></div>
                            <div>
                              <span className="text-xs font-medium text-slate-900">Service Charges (Profit)</span>
                              <p className="text-xs text-slate-500">Our earnings from services</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-slate-900">
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
                            <div className="w-3 h-3 rounded-full bg-navy-500"></div>
                            <div>
                              <span className="text-xs font-medium text-slate-900">Department Charge (Cost)</span>
                              <p className="text-xs text-slate-500">Payable to departments</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <p className="text-xs font-bold text-slate-900">
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
                            <p className="text-xs text-navy-700">
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

                      <div className="pt-2">
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div 
                            className="h-full bg-emerald-500"
                            style={{ width: `${totalRevenue > 0 ? 
                              (totalServiceCharges/totalRevenue) * 100 : 0}%` }}
                          ></div>
                        </div>
                        <div className="flex justify-between text-xs text-slate-500 mt-1">
                          <span>Our Profit (Service Charges)</span>
                          <span>Cost (Department Charges)</span>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-100">
                        <h4 className="text-xs font-semibold text-slate-700 mb-3">Top 5 Services by Profit</h4>
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
                              return <p className="text-xs text-slate-500 text-center py-2">No service data</p>;
                            }
                            
                            const totalProfit = topServices.reduce((sum, s) => sum + s.profit, 0);
                            
                            return topServices.map((service, index) => (
                              <div key={service.name} className="flex items-center justify-between hover:bg-slate-50 p-2 rounded">
                                <div className="flex items-center space-x-3">
                                  <div className={`w-6 h-6 rounded-xl flex items-center justify-center text-xs font-bold ${
                                    index === 0 ? 'bg-amber-100 text-amber-700' :
                                    index === 1 ? 'bg-slate-100 text-slate-700' :
                                    index === 2 ? 'bg-amber-100 text-amber-700' :
                                    'bg-slate-100 text-navy-700'
                                  }`}>
                                    {index + 1}
                                  </div>
                                  <div className="max-w-[140px]">
                                    <span className="text-xs font-medium text-slate-900 truncate block">
                                      {service.name}
                                    </span>
                                    <span className="text-xs text-slate-500">
                                      Total: ₹{service.total.toLocaleString()}
                                    </span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs font-bold text-emerald-600">₹{Math.round(service.profit).toLocaleString()}</p>
                                  <div className="flex items-center space-x-1 text-xs text-slate-500">
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

                  {/* Expense Analysis - same as original, omitted for brevity */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-slate-900 text-sm flex items-center">
                        <FiTrendingDown className="h-4 w-4 mr-2 text-rose-600" />
                        Expense Analysis
                      </h3>
                      <button className="text-xs text-navy-700 hover:text-navy-800 flex items-center">
                        <FiEye className="h-3 w-3 mr-1" />
                        View Details
                      </button>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3 text-center">
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
                        
                        <div className="bg-amber-50 border border-amber-200 rounded-xl p-3 text-center">
                          <p className="text-xs text-amber-700 mb-1">Pending</p>
                          <p className="font-bold text-amber-900 text-sm">
                            ₹{expensesForCurrentDate
                              .filter(e => e.status === 'pending')
                              .reduce((sum, e) => sum + Number(e.amount || 0), 0)
                              .toLocaleString()}
                          </p>
                          <p className="text-xs text-amber-600 mt-1">
                            {pendingApprovals} items
                          </p>
                        </div>
                        
                        <div className="bg-rose-50 border border-rose-200 rounded-xl p-3 text-center">
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

                      <div className="pt-4">
                        <h4 className="text-xs font-semibold text-slate-700 mb-3">Expense by Category</h4>
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
                              return <p className="text-xs text-slate-500 text-center py-2">No expense data for this date</p>;
                            }
                            
                            return sortedCategories.map(([category, amount]) => (
                              <div key={category} className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <div className="flex items-center space-x-2">
                                    <span className="font-medium text-slate-700 capitalize">{category}</span>
                                    <span className="text-slate-400">•</span>
                                    <span className="text-slate-500">
                                      {expensesForCurrentDate.filter(e => e.category === category && e.status !== 'rejected').length} items
                                    </span>
                                  </div>
                                  <div className="text-right">
                                    <span className="font-bold text-slate-900">
                                      ₹{amount.toLocaleString()}
                                    </span>
                                    {totalExpenses > 0 && (
                                      <span className="text-slate-500 ml-1">
                                        ({((amount/totalExpenses)*100).toFixed(1)}%)
                                      </span>
                                    )}
                                  </div>
                                </div>
                                <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                                  <div 
                                    className={`h-full rounded-full ${
                                      category.includes('Salary') ? 'bg-slate-500' :
                                      category.includes('Operational') ? 'bg-navy-500' :
                                      category.includes('Office') ? 'bg-emerald-500' :
                                      category.includes('Utility') ? 'bg-amber-500' :
                                      category.includes('Maintenance') ? 'bg-rose-500' :
                                      'bg-slate-500'
                                    }`}
                                    style={{ width: `${totalExpenses > 0 ? (amount/totalExpenses)*100 : 0}%` }}
                                  ></div>
                                </div>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-100">
                        <h4 className="text-xs font-semibold text-slate-700 mb-3">Payment Methods</h4>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
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
                              return <p className="text-xs text-slate-500 col-span-full text-center py-2">No payment data for this date</p>;
                            }
                            
                            return methods.map(([method, amount]) => (
                              <div key={method} className="text-center p-2 border border-slate-200 rounded-xl">
                                <div className={`inline-flex items-center justify-center w-8 h-8 rounded-full mb-1 ${
                                  method === 'cash' ? 'bg-emerald-100 text-emerald-600' :
                                  method === 'bank' ? 'bg-slate-100 text-navy-700' :
                                  method === 'upi' ? 'bg-slate-100 text-slate-600' :
                                  'bg-slate-100 text-slate-600'
                                }`}>
                                  {method === 'cash' ? <FiDollarSign className="h-4 w-4" /> :
                                  method === 'bank' ? <FiCreditCard className="h-4 w-4" /> :
                                  <FiSmartphone className="h-4 w-4" />}
                                </div>
                                <p className="text-xs font-medium text-slate-900 capitalize">{method}</p>
                                <p className="text-xs font-bold text-slate-800">₹{amount.toLocaleString()}</p>
                                <p className="text-xs text-slate-500">
                                  {expensesForCurrentDate.filter(e => e.payment_method === method && e.status !== 'rejected').length} txn
                                </p>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Performance Metrics - omitted for brevity, same as original */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-slate-900 text-sm flex items-center">
                        <FiActivity className="h-4 w-4 mr-2 text-navy-700" />
                        Performance Metrics
                      </h3>
                      <button className="text-xs text-navy-700 hover:text-navy-800 flex items-center">
                        <FiRefreshCw className="h-3 w-3 mr-1" />
                        Refresh
                      </button>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-navy-700">Profit Margin</span>
                            <span className={`text-xs font-bold ${todayProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {totalRevenue > 0 ? ((todayProfit/totalRevenue)*100).toFixed(1) : '0'}%
                            </span>
                          </div>
                          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className={`h-full ${todayProfit >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`}
                              style={{ width: `${Math.min(Math.abs((todayProfit/totalRevenue)*100), 100)}%` }}
                            ></div>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Net Profit: ₹{todayProfit.toLocaleString()}
                          </p>
                        </div>
                        
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-navy-700">Expense Ratio</span>
                            <span className="text-xs font-bold text-navy-700">
                              {totalRevenue > 0 ? ((todayExpenses/totalRevenue)*100).toFixed(1) : '0'}%
                            </span>
                          </div>
                          <div className="h-1.5 bg-slate-200 rounded-full overflow-hidden">
                            <div 
                              className="h-full bg-navy-500"
                              style={{ width: `${Math.min((todayExpenses/totalRevenue)*100, 100)}%` }}
                            ></div>
                          </div>
                          <p className="text-xs text-slate-500 mt-1">
                            Expenses: ₹{todayExpenses.toLocaleString()}
                          </p>
                        </div>
                      </div>

                      <div className="pt-4">
                        <h4 className="text-xs font-semibold text-slate-700 mb-3">Top Staff by Service Profit</h4>
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
                              return <p className="text-xs text-slate-500 text-center py-2">No staff performance data</p>;
                            }
                            
                            return topStaff.map((staff, index) => (
                              <div key={staff.name} className="flex items-center justify-between hover:bg-slate-50 p-2 rounded border border-slate-100">
                                <div className="flex items-center space-x-3">
                                  <div className="relative">
                                    <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-xs font-bold text-navy-700 border border-slate-200">
                                      {staff.name.charAt(0)}
                                    </div>
                                    {index === 0 && (
                                      <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center border border-white">
                                        <FiStar className="h-2 w-2 text-white" />
                                      </div>
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium text-slate-900 truncate max-w-[120px]">{staff.name}</p>
                                    <div className="flex items-center space-x-1 text-xs text-slate-500">
                                      <span>{staff.count} services</span>
                                      <span>•</span>
                                      <span>Dept: ₹{Math.round(staff.department).toLocaleString()}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs font-bold text-emerald-600">₹{Math.round(staff.profit).toLocaleString()}</p>
                                  <p className="text-xs text-slate-500">Avg: ₹{Math.round(staff.avg).toFixed(0)}</p>
                                </div>
                              </div>
                            ));
                          })()}
                        </div>
                      </div>

                      <div className="pt-4 border-t border-slate-100">
                        <h4 className="text-xs font-semibold text-slate-700 mb-3">Transaction Statistics</h4>
                        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                          <div className="text-center p-3 border border-slate-200 rounded-xl">
                            <p className="text-lg font-bold text-slate-900">{accountingData.income?.rows?.length || 0}</p>
                            <p className="text-xs text-slate-600">Services</p>
                            <p className="text-xs text-emerald-600 font-medium mt-1">
                              Profit: ₹{totalServiceCharges.toLocaleString()}
                            </p>
                          </div>
                          <div className="text-center p-3 border border-slate-200 rounded-xl">
                            <p className="text-lg font-bold text-slate-900">{expensesForCurrentDate.length}</p>
                            <p className="text-xs text-slate-600">Expenses</p>
                            <p className="text-xs text-rose-600 font-medium mt-1">
                              Cost: ₹{todayExpenses.toLocaleString()}
                            </p>
                          </div>
                          <div className="text-center p-3 border border-slate-200 rounded-xl">
                            <p className="text-lg font-bold text-slate-900">{accountingData.ledger?.rows?.length || 0}</p>
                            <p className="text-xs text-slate-600">Ledger Entries</p>
                            <p className="text-xs text-navy-700 font-medium mt-1">
                              Total: ₹{totalRevenue.toLocaleString()}
                            </p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Cash Flow & Wallet Summary - omitted for brevity, same as original */}
                  <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-slate-900 text-sm flex items-center">
                        <FiSmartphone className="h-4 w-4 mr-2 text-slate-600" />
                        Wallet Balances
                      </h3>
                      <button className="text-xs text-navy-700 hover:text-navy-800 flex items-center">
                        <FiEye className="h-3 w-3 mr-1" />
                        Details
                      </button>
                    </div>
                    
                    <div className="space-y-4">
                      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
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
                        
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center">
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center mr-2">
                                <FiCreditCard className="h-4 w-4 text-navy-700" />
                              </div>
                              <div>
                                <p className="text-xs font-medium text-navy-700">Bank Balance</p>
                                <p className="text-lg font-bold text-navy-800">
                                  ₹{calculateBankBalance().toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>
                          <p className="text-xs text-navy-700">
                            {derivedWallets.filter(w => w.type?.toLowerCase() === 'bank').length} bank accounts
                          </p>
                        </div>
                        
                        <div className="bg-slate-50 border border-slate-200 rounded-xl p-3">
                          <div className="flex items-center justify-between mb-2">
                            <div className="flex items-center">
                              <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center mr-2">
                                <FiSmartphone className="h-4 w-4 text-slate-600" />
                              </div>
                              <div>
                                <p className="text-xs font-medium text-slate-700">Digital Balance</p>
                                <p className="text-lg font-bold text-slate-800">
                                  ₹{calculateDigitalBalance().toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>
                          <p className="text-xs text-slate-600">
                            {derivedWallets.filter(w => w.type?.toLowerCase() === 'digital').length} digital wallets
                          </p>
                        </div>
                      </div>

                      <div className="pt-4">
                        <h4 className="text-xs font-semibold text-slate-700 mb-3">Wallet Distribution</h4>
                        <div className="space-y-2">
                          {derivedWallets.map((wallet, index) => {
                            const isCash = wallet.type?.toLowerCase() === 'cash';
                            const isBank = wallet.type?.toLowerCase() === 'bank';
                            const isDigital = wallet.type?.toLowerCase() === 'digital';
                            
                            return (
                              <div key={wallet.id} className="flex items-center justify-between hover:bg-slate-50 p-2 rounded border border-slate-100">
                                <div className="flex items-center space-x-3">
                                  <div className={`w-8 h-8 rounded-xl flex items-center justify-center border ${
                                    isCash ? 'border-emerald-200 bg-emerald-50 text-emerald-600' :
                                    isBank ? 'border-slate-200 bg-slate-50 text-navy-700' :
                                    'border-slate-200 bg-slate-50 text-slate-600'
                                  }`}>
                                    {isCash ? <FiDollarSign className="h-4 w-4" /> :
                                    isBank ? <FiCreditCard className="h-4 w-4" /> :
                                    <FiSmartphone className="h-4 w-4" />}
                                  </div>
                                  <div className="min-w-0">
                                    <p className="text-xs font-medium text-slate-900 truncate max-w-[120px]">{wallet.name}</p>
                                    <div className="flex items-center space-x-1 text-xs text-slate-500">
                                      <span className="capitalize">{wallet.type}</span>
                                      <span>•</span>
                                      <span>Book: ₹{(wallet.book_balance || 0).toLocaleString()}</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs font-bold text-slate-900">
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

                      <div className="pt-4 border-t border-slate-100">
                        <div className="grid grid-cols-2 gap-3">
                          <div className="text-center p-3 border border-slate-200 rounded-xl">
                            <div className="w-8 h-8 rounded-full bg-emerald-100 flex items-center justify-center mx-auto mb-1">
                              <FiCheckCircle className="h-4 w-4 text-emerald-600" />
                            </div>
                            <p className="text-xs font-bold text-slate-900">
                              {derivedWallets.filter(w => Math.abs((w.book_balance || 0) - (w.currentBalance || 0)) <= 10).length}
                            </p>
                            <p className="text-xs text-slate-600">Reconciled Wallets</p>
                          </div>
                          <div className="text-center p-3 border border-slate-200 rounded-xl">
                            <div className="w-8 h-8 rounded-full bg-rose-100 flex items-center justify-center mx-auto mb-1">
                              <FiAlertCircle className="h-4 w-4 text-rose-600" />
                            </div>
                            <p className="text-xs font-bold text-slate-900">
                              {derivedWallets.filter(w => Math.abs((w.book_balance || 0) - (w.currentBalance || 0)) > 10).length}
                            </p>
                            <p className="text-xs text-slate-600">Pending Reconciliation</p>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-2xl border border-slate-200 p-5 shadow-sm">
                  <h3 className="font-bold text-slate-900 text-sm flex items-center mb-3">
                    <FiMessageSquare className="h-4 w-4 mr-2 text-slate-600" />
                    Report Summary & Notes
                  </h3>
                  <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
                    <div className="lg:col-span-2">
                      <textarea
                        className="w-full h-32 px-3 py-2 border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 text-sm"
                        placeholder="Add your observations, insights, or notes about this financial period..."
                        defaultValue={accountingData.nightlyAccounting?.[date]?.notes || ''}
                      ></textarea>
                      <div className="flex justify-end mt-2">
                        <button className="px-4 py-2 bg-navy-700 text-white rounded-xl hover:bg-navy-700 text-sm">
                          Save Notes
                        </button>
                      </div>
                    </div>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between text-sm p-2 border border-slate-200 rounded">
                        <span className="text-slate-600">Report Date:</span>
                        <span className="font-medium text-slate-900">{date}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm p-2 border border-slate-200 rounded">
                        <span className="text-slate-600">Generated:</span>
                        <span className="font-medium text-slate-900">{new Date().toLocaleDateString()}</span>
                      </div>
                      <div className="flex items-center justify-between text-sm p-2 border border-slate-200 rounded">
                        <span className="text-slate-600">Status:</span>
                        <span className="font-medium text-emerald-600">Complete</span>
                      </div>
                      <div className="pt-2">
                        <button className="w-full flex items-center justify-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-xl hover:bg-emerald-700 text-sm">
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
              className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-label="Add misc income"
            >
              <div className="pointer-events-auto max-h-[90vh] w-full max-w-md overflow-y-auto rounded-2xl border border-slate-200 bg-white shadow-xl">
                <div className="flex items-center justify-between rounded-t-2xl border-b border-slate-200 bg-slate-50 p-5">
                  <h2 className="flex items-center text-lg font-bold text-slate-900">
                    <FiTrendingUp className="mr-2 h-5 w-5 text-emerald-600" />
                    Add Misc Income / Overage
                  </h2>
                  <button type="button" onClick={() => setShowMiscIncomeModal(false)} aria-label="Close" className="rounded-lg p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-600 focus:outline-none focus:ring-2 focus:ring-navy-500/30">
                    <FiX className="h-5 w-5" />
                  </button>
                </div>
                <form onSubmit={handleMiscIncomeSubmit} className="space-y-4 p-6">
                  <div>
                    <label htmlFor="misc-date" className="mb-1 block text-sm font-medium text-slate-700">Date</label>
                    <input id="misc-date" type="date" value={miscIncomeForm.date} onChange={(e) => setMiscIncomeForm(prev => ({...prev, date: e.target.value}))} className={inputCls} required />
                  </div>
                  <div>
                    <label htmlFor="misc-amount" className="mb-1 block text-sm font-medium text-slate-700">Amount (₹)</label>
                    <input id="misc-amount" type="number" min="0" step="0.01" value={miscIncomeForm.amount} onChange={(e) => setMiscIncomeForm(prev => ({...prev, amount: e.target.value}))} className={inputCls} required placeholder="Enter amount" />
                  </div>
                  <div>
                    <label htmlFor="misc-wallet" className="mb-1 block text-sm font-medium text-slate-700">Wallet to Credit</label>
                    <select id="misc-wallet" value={miscIncomeForm.wallet_id} onChange={(e) => setMiscIncomeForm(prev => ({...prev, wallet_id: e.target.value}))} className={inputCls} required>
                      <option value="">Select a wallet...</option>
                      {derivedWallets.map(w => (
                        <option key={w.id} value={w.id}>{w.name} ({w.wallet_type || w.type})</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label htmlFor="misc-desc" className="mb-1 block text-sm font-medium text-slate-700">Description / Reason</label>
                    <textarea id="misc-desc" value={miscIncomeForm.description} onChange={(e) => setMiscIncomeForm(prev => ({...prev, description: e.target.value}))} className={inputCls} required placeholder="e.g., Cash drawer overage for 29/04, Sale of scrap paper, etc." rows="3" />
                  </div>
                  <div className="flex justify-end gap-3 border-t border-slate-100 pt-4">
                    <button type="button" onClick={() => setShowMiscIncomeModal(false)} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-navy-500/30">Cancel</button>
                    <button type="submit" className="rounded-xl bg-navy-700 px-4 py-2 text-sm font-medium text-white shadow-sm transition-colors hover:bg-navy-800 focus:outline-none focus:ring-2 focus:ring-navy-500/40">Record Income</button>
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
              className="fixed inset-0 z-40 bg-slate-900/50 backdrop-blur-sm"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="pointer-events-none fixed inset-0 z-50 flex items-center justify-center p-4"
              role="dialog"
              aria-modal="true"
              aria-label="Admin expense entry"
            >
              <div className="pointer-events-auto max-h-[90vh] w-full max-w-4xl overflow-y-auto rounded-2xl bg-white shadow-xl">
                <AdminExpenseEntry
                  wallets={wallets}
                  categories={[]}
                  teams={teams}
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