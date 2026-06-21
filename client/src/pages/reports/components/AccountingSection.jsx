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

// Nightly Accounting Checklist Component
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

// Daily Summary Component
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

    const totalInflow = cashInflow + bankInflow + digitalInflow;
    const totalOutflow = cashOutflow + bankOutflow + digitalOutflow;
    const closingBalance = openingBalance + totalInflow - totalOutflow;

    const expectedCash = cashOpening + cashInflow + cashTransferIn - cashOutflow - cashTransferOut;
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
    { key: 'cashTransferIn', label: 'Cash Transfer In (Received)', type: 'cash', category: 'transfer' },
    { key: 'cashTransferOut', label: 'Cash Transfer Out (Deposited)', type: 'cash', category: 'transfer' },
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
              <button onClick={handleSave} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors flex items-center space-x-1 text-sm">
                <FiSave className="h-3 w-3" />
                <span>Save</span>
              </button>
              <button onClick={() => {
                  setFormData({
                    derived: summaryData?.derived || {},
                    manual: { actualCashInHand: summaryData?.actualCashInHand || 0 }
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
            <button onClick={() => setEditing(true)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center space-x-1 text-sm">
              <FiEdit className="h-3 w-3" />
              <span>Edit Summary</span>
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-3 mb-4 grid-cols-4">
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
          <p className="text-xs text-blue-700 mb-1">Business Inflow</p>
          <p className="font-bold text-blue-900 text-sm">₹{totals.totalInflow.toLocaleString()}</p>
        </div>
        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3">
          <p className="text-xs text-rose-700 mb-1">Business Outflow</p>
          <p className="font-bold text-rose-900 text-sm">₹{totals.totalOutflow.toLocaleString()}</p>
        </div>
        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3">
          <p className="text-xs text-emerald-700 mb-1">Closing Ledger Balance</p>
          <p className="font-bold text-emerald-900 text-sm">₹{totals.closingBalance.toLocaleString()}</p>
        </div>
        <div className={`border rounded-lg p-3 ${Math.abs(totals.variance) <= 100 ? 'bg-emerald-50 border-emerald-200' : 'bg-rose-50 border-rose-200'}`}>
          <p className="text-xs mb-1">Cash Variance</p>
          <p className="font-bold text-sm">₹{totals.variance.toFixed(2)}</p>
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-gray-200">
        <table className="w-full min-w-full">
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50">
              <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Item</th>
              <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Type</th>
              <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Category</th>
              <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount (₹)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {fields.map((field) => (
              <tr key={field.key} className="hover:bg-gray-50 transition-colors">
                <td className="py-2 px-3"><span className="font-medium text-gray-900 text-xs">{field.label}</span></td>
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
                    field.category === 'transfer' ? 'text-indigo-600' :
                    'text-gray-600'
                  }`}>
                    {field.category === 'inflow' && <FiTrendingUp className="h-2 w-2 mr-1" />}
                    {field.category === 'outflow' && <FiTrendingDown className="h-2 w-2 mr-1" />}
                    {field.category === 'transfer' && <FiRefreshCw className="h-2 w-2 mr-1" />}
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
                          manual: { ...prev.manual, actualCashInHand: parseFloat(e.target.value) || 0 }
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

const IncomeViewComponent = ({ transactions = [] }) => {
  const rows = Array.isArray(transactions) ? transactions : transactions?.rows || [];

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
      acc[staffName] = { name: staffName, total: 0, serviceCharge: 0, departmentFee: 0, count: 0 };
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

  const topStaff = Object.values(staffIncome).sort((a, b) => b.total - a.total).slice(0, 5);

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
      return { customerPayment: 0, internalTransfer: 0, totalReceived: Number(row.received_amount || 0) };
    }

    let customerPayment = 0;
    let internalTransfer = 0;

    row.wallet_breakdown.forEach(walletTx => {
      const amount = Number(walletTx.amount || 0);
      if (row.payment_wallets && row.payment_wallets.includes(walletTx.wallet) && row.payment_wallets.split(',').length > 1) {
        internalTransfer += amount;
      } else {
        customerPayment += amount;
      }
    });

    return { customerPayment: customerPayment || Number(row.received_amount || 0), internalTransfer, totalReceived: Number(row.received_amount || 0) };
  };

  const [expandedRow, setExpandedRow] = useState(null);
  const toggleRow = (serviceEntryId) => {
    setExpandedRow(prev => prev === serviceEntryId ? null : serviceEntryId);
  };

  const trend = 12.5;

  return (
    <div className="grid grid-cols-3 gap-4">
      {/* Left Column - Key Metrics */}
      <div className="col-span-1 space-y-4">
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

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-bold text-gray-900 text-sm mb-3 flex items-center">
            <FiDatabase className="h-4 w-4 mr-2 text-blue-600" /> Wallet Activity
          </h3>
          <div className="space-y-2">
            {Object.values(walletTotals).map((wallet, index) => (
              <div key={wallet.name} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                <div className="flex items-center space-x-2">
                  <div className={`w-2 h-2 rounded-full ${index === 0 ? 'bg-blue-500' : index === 1 ? 'bg-purple-500' : index === 2 ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                  <span className="text-xs font-medium text-gray-700 truncate max-w-[100px]">{wallet.name}</span>
                </div>
                <div className="text-right">
                  <p className="text-xs font-bold text-gray-900">₹{wallet.total.toLocaleString()}</p>
                  <p className="text-xs text-gray-500">{wallet.count} txn</p>
                </div>
              </div>
            ))}
            {Object.keys(walletTotals).length === 0 && <p className="text-xs text-gray-500 text-center py-2">No wallet activity</p>}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <h3 className="font-bold text-gray-900 text-sm mb-3 flex items-center">
            <FiUsers className="h-4 w-4 mr-2 text-indigo-600" /> Top Performing Staff
          </h3>
          <div className="space-y-2">
            {topStaff.map((staff, index) => (
              <div key={staff.name} className="flex items-center justify-between p-2 hover:bg-gray-50 rounded">
                <div className="flex items-center space-x-2">
                  <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold ${index === 0 ? 'bg-yellow-100 text-yellow-700' : index === 1 ? 'bg-gray-100 text-gray-700' : index === 2 ? 'bg-amber-100 text-amber-700' : 'bg-blue-50 text-blue-600'}`}>
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
                    {staff.departmentFee > 0 && <span className="ml-1">D: ₹{Math.round(staff.departmentFee).toLocaleString()}</span>}
                  </div>
                </div>
              </div>
            ))}
            {topStaff.length === 0 && <p className="text-xs text-gray-500 text-center py-2">No staff data available</p>}
          </div>
        </div>
      </div>

      {/* Right Column - Transaction Table */}
      <div className="col-span-2">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-gray-900 text-sm flex items-center">
                <FiFileText className="h-4 w-4 mr-2 text-gray-600" /> Income Transactions
              </h3>
              <span className="text-xs text-gray-600">{rows.length} transactions • ₹{totalCollected.toLocaleString()} total</span>
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
                        No income data
                      </div>
                    </td>
                  </tr>
                )}
                {rows.map((row, index) => {
                  const rowKey = row.service_entry_id != null ? `se-${row.service_entry_id}` : `income-fallback-${index}`;
                  const isExpanded = expandedRow === row.service_entry_id;
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
                      <tr className={`hover:bg-gray-50 ${isExpanded ? 'bg-blue-50' : ''}`}>
                        <td className="py-3 px-3">
                          <div className="flex flex-col">
                            <span className="text-xs font-medium text-gray-900">{row.received_at ? new Date(row.received_at).toLocaleDateString() : '—'}</span>
                            <span className="text-xs text-gray-500">{row.received_at ? new Date(row.received_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '—'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex items-center">
                            <div className="w-6 h-6 rounded-full bg-indigo-100 flex items-center justify-center mr-2">
                              <FiUser className="h-3 w-3 text-indigo-600" />
                            </div>
                            <span className="text-xs font-medium text-gray-900 truncate max-w-[120px]">{row.customer_name || '—'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3"><span className="text-xs text-gray-900">{row.service_name || '—'}</span></td>
                        <td className="py-3 px-3">
                          <div className="flex items-center">
                            <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center mr-2">
                              <FiBriefcase className="h-3 w-3 text-emerald-600" />
                            </div>
                            <span className="text-xs font-medium text-gray-900">{row.staff_name || '—'}</span>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <div className="flex flex-col">
                            <span className="text-xs font-bold text-gray-900">₹{displayAmount.toLocaleString()}</span>
                            <div className="flex items-center text-xs text-gray-500">
                              <span className="mr-2">Service: ₹{Math.round(receivedServiceCharge).toLocaleString()}</span>
                              {receivedDepartmentCharge > 0 && <span>Dept: ₹{Math.round(receivedDepartmentCharge).toLocaleString()}</span>}
                            </div>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-emerald-50 text-emerald-700">
                            <FiCheck className="h-2 w-2 mr-1" /> Completed
                          </span>
                        </td>
                        <td className="py-3 px-3">
                          <button onClick={() => toggleRow(row.service_entry_id)} className="text-gray-500 hover:text-gray-700">
                            {isExpanded ? <FiMinus className="h-4 w-4" /> : <FiPlus className="h-4 w-4" />}
                          </button>
                        </td>
                      </tr>
                      {isExpanded && (
                        <tr className="bg-blue-50">
                          <td colSpan="7" className="px-3 py-3">
                            <div className="bg-white rounded-lg border border-gray-200 p-3">
                              <h4 className="text-xs font-bold text-gray-900 mb-3">Transaction Details</h4>
                              <div className="grid grid-cols-2 gap-3 mb-3">
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Service Charge</p>
                                  <p className="text-xs font-medium text-gray-900">₹{Math.round(receivedServiceCharge).toLocaleString()}</p>
                                </div>
                                <div>
                                  <p className="text-xs text-gray-500 mb-1">Department Charge</p>
                                  <p className="text-xs font-medium text-gray-900">₹{Math.round(receivedDepartmentCharge).toLocaleString()}</p>
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

const LedgerView = ({ ledger, onLedgerRowClick }) => {
  const totalCredits = ledger.reduce((sum, tx) => sum + (tx.type === 'credit' ? Number(tx.amount || 0) : 0), 0);
  const totalDebits = ledger.reduce((sum, tx) => sum + (tx.type === 'debit' ? Number(tx.amount || 0) : 0), 0);
  const netBalance = totalCredits - totalDebits;
  
  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="col-span-1 space-y-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center space-x-2">
              <div className={`p-2 rounded-lg ${netBalance >= 0 ? 'bg-emerald-100' : 'bg-rose-100'}`}>
                {netBalance >= 0 ? <FiTrendingUp className="h-4 w-4 text-emerald-600" /> : <FiTrendingDown className="h-4 w-4 text-rose-600" />}
              </div>
              <div>
                <p className="text-xs text-gray-500">Net Balance</p>
                <p className={`font-bold text-lg ${netBalance >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  ₹{Math.abs(netBalance).toLocaleString()} {netBalance >= 0 ? '(Credit)' : '(Debit)'}
                </p>
              </div>
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
      </div>

      <div className="col-span-2">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="p-4 border-b border-gray-200 bg-gray-50 flex items-center justify-between">
            <h3 className="font-bold text-gray-900 text-sm flex items-center">
              <FiBook className="h-4 w-4 mr-2 text-gray-600" /> Ledger Transactions
            </h3>
            <span className="text-xs px-2 py-1 rounded bg-emerald-50 text-emerald-700">Net: ₹{netBalance.toLocaleString()}</span>
          </div>
          
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full min-w-full">
              <thead className="bg-gray-50 border-b border-gray-200 sticky top-0">
                <tr>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase">Wallet</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase">Category</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase">Staff</th>
                </tr>
              </thead>
              <tbody>
                {ledger.map((tx, index) => {
                  const isCredit = tx.type === 'credit';
                  const transactionDate = new Date(tx.created_at);
                  return (
                    <tr key={`ledger-${tx.id || index}`} className="hover:bg-gray-50 cursor-pointer" onClick={() => onLedgerRowClick(tx)}>
                      <td className="py-3 px-3">
                        <div className="flex flex-col">
                          <span className="text-xs font-medium text-gray-900">{transactionDate.toLocaleDateString()}</span>
                          <span className="text-xs text-gray-500">{transactionDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                      </td>
                      <td className="py-3 px-3">
                        <p className="text-xs font-medium text-gray-900">{tx.wallet_name}</p>
                        <p className="text-xs text-gray-500 capitalize">{tx.wallet_type}</p>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${isCredit ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {isCredit ? 'Credit' : 'Debit'}
                        </span>
                      </td>
                      <td className="py-3 px-3">
                        <span className={`text-xs font-bold ${isCredit ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {isCredit ? '+' : '-'}₹{Number(tx.amount || 0).toLocaleString()}
                        </span>
                      </td>
                      <td className="py-3 px-3"><span className="text-xs font-medium text-gray-900">{tx.category}</span></td>
                      <td className="py-3 px-3"><span className="text-xs font-medium text-gray-900">{tx.staff_name || 'System'}</span></td>
                    </tr>
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

const WalletReconciliation = ({ wallets, onRefreshWallets, date }) => {
  const [walletBalances, setWalletBalances] = useState({});
  const [historicalBookBalances, setHistoricalBookBalances] = useState({});
  const [isReconciling, setIsReconciling] = useState(false);

  useEffect(() => {
    const loadSavedBalances = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/accounting/wallet-reconciliations?date=${date}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });
        if (res.ok) {
          const savedData = await res.json();
          const restoredBalances = {};
          const restoredBooks = {};
          savedData.forEach(row => {
            restoredBalances[row.wallet_id] = Number(row.actual_balance);
            if (row.book_balance !== undefined && row.book_balance !== null) {
              restoredBooks[row.wallet_id] = Number(row.book_balance);
            }
          });
          setWalletBalances(restoredBalances);
          setHistoricalBookBalances(restoredBooks);
        }
      } catch (error) { console.error("Failed to load saved reconciliations", error); }
    };
    if (date) { setWalletBalances({}); setHistoricalBookBalances({}); loadSavedBalances(); }
  }, [date]);

  const isToday = date === new Date().toISOString().split('T')[0];

  const processedWallets = useMemo(() => {
    return wallets.map(w => {
      const actual = walletBalances[String(w.id)] ?? w.currentBalance ?? 0;
      const book = isToday ? (w.book_balance ?? 0) : (historicalBookBalances[String(w.id)] ?? w.book_balance ?? 0);
      const variance = actual - book;
      return { ...w, displayActual: actual, displayBook: book, variance: variance, isReconciled: Math.abs(variance) <= 10 };
    });
  }, [wallets, walletBalances, historicalBookBalances, isToday]);

  const reconciledWallets = processedWallets.filter(w => w.isReconciled).length;
  const totalVariance = processedWallets.reduce((sum, w) => sum + Math.abs(w.variance), 0);

  const handleBalanceChange = (walletId, balance) => {
    setWalletBalances(prev => ({ ...prev, [walletId]: parseFloat(balance) || 0 }));
  };

  const handleReconcileWallets = async () => {
    setIsReconciling(true);
    try {
      const reconciliations = processedWallets.map(w => ({
        wallet_id: w.id, book_balance: w.displayBook, actual_balance: w.displayActual, variance: w.variance
      }));
      await fetch(`${import.meta.env.VITE_API_URL}/api/accounting/wallet-reconcile`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ reconciliations })
      });
      await onRefreshWallets(date);
      toast.success('Wallets reconciled successfully!');
    } catch (error) { toast.error('Failed to reconcile wallets'); }
    finally { setIsReconciling(false); }
  };

  return (
    <div className="grid grid-cols-3 gap-4">
      <div className="col-span-1 space-y-4">
        <div className="bg-white rounded-lg border border-gray-200 p-4 hover:shadow-sm transition-all">
          <div className="flex items-center justify-between mb-3">
            <h3 className="font-bold text-gray-900 text-sm flex items-center">
              <FiCheckCircle className="h-4 w-4 mr-2 text-indigo-600" /> Status
            </h3>
            <span className={`px-2 py-1 rounded text-xs font-medium ${reconciledWallets === wallets.length ? 'bg-emerald-50 text-emerald-700' : 'bg-yellow-50 text-yellow-700'}`}>
              {reconciledWallets}/{wallets.length} Reconciled
            </span>
          </div>
          <div className="flex items-center justify-between text-xs">
            <span className="text-gray-600">Total Variance</span>
            <span className={`font-bold ${totalVariance === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>₹{totalVariance.toFixed(2)}</span>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <button onClick={handleReconcileWallets} disabled={isReconciling} className={`w-full flex items-center justify-center space-x-2 px-4 py-2 rounded-lg text-sm font-medium ${isReconciling ? 'bg-gray-300 text-gray-500 cursor-not-allowed' : 'bg-emerald-600 hover:bg-emerald-700 text-white'}`}>
            {isReconciling ? <FiRefreshCw className="h-4 w-4 animate-spin" /> : <FiCheckCircle className="h-4 w-4" />}
            <span>{isReconciling ? 'Reconciling...' : 'Reconcile All'}</span>
          </button>
        </div>
      </div>
      <div className="col-span-2">
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase">Wallet</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase">Book</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase">Actual</th>
                  <th className="py-2 px-3 text-left text-xs font-medium text-gray-500 uppercase">Variance</th>
                </tr>
              </thead>
              <tbody>
                {processedWallets.map(wallet => (
                  <tr key={wallet.id} className="hover:bg-gray-50">
                    <td className="py-3 px-3"><p className="text-xs font-medium text-gray-900">{wallet.name}</p></td>
                    <td className="py-3 px-3"><p className="text-xs font-bold text-gray-900">₹{Number(wallet.displayBook).toLocaleString()}</p></td>
                    <td className="py-3 px-3">
                      <input type="number" value={wallet.displayActual} onChange={e => handleBalanceChange(String(wallet.id), e.target.value)}
                        className="w-24 px-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-indigo-500" />
                    </td>
                    <td className="py-3 px-3">
                      <p className={`text-xs font-bold ${wallet.isReconciled ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {wallet.variance >= 0 ? '+' : ''}₹{wallet.variance.toFixed(2)}
                      </p>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};

const ExpenseManagement = ({ expenses, onApprove, onReject, allowAdd = true, onAddClick, wallets = [], onCorrect }) => {
  return <div className="p-4 border border-gray-200 rounded-lg text-sm text-gray-500 text-center">Expense management module loaded.</div>;
};

/* ======================================================
   MAIN ACCOUNTING SECTION (with Date Range Reports)
====================================================== */
const AccountingSection = ({ 
  user,
  accountingData = { wallets: [], income: { rows: [] }, ledger: { rows: [] }, expenses: [], dailySummary: {}, nightlyAccounting: {}, walletReconciliations: [] },
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
  const [teams, setTeams] = useState([]);
  const [showMiscIncomeModal, setShowMiscIncomeModal] = useState(false);
  const [loading, setLoading] = useState(false);

  // --- REPORT TAB STATES ---
  const [reportPeriod, setReportPeriod] = useState('This Month');
  const [customDateRange, setCustomDateRange] = useState({ from: date, to: date });
  const [reportData, setReportData] = useState({ income: [], expenses: [], ledger: [], loading: false });

  const [miscIncomeForm, setMiscIncomeForm] = useState({ amount: '', wallet_id: '', description: '', date: new Date().toISOString().split('T')[0] });
  const [ledgerFilters, setLedgerFilters] = useState({ from: date, to: date, staff_id: '', wallet_id: '', category: '' });

  const fetchTeams = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/teams`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
      setTeams(await res.json() || []);
    } catch (err) { console.error(err); }
  };

  useEffect(() => {
    if (showAdminExpenseModal && teams.length === 0) fetchTeams();
  }, [showAdminExpenseModal]);

  const handleMiscIncomeSubmit = async (e) => {
    e.preventDefault();
    try {
      const [year, month, day] = miscIncomeForm.date.split('-');
      const now = new Date();
      const submissionDate = new Date(year, month - 1, day, now.getHours(), now.getMinutes(), now.getSeconds());
      const res = await fetch(`${import.meta.env.VITE_API_URL}/api/accounting/misc-income`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ ...miscIncomeForm, date: submissionDate.toISOString() })
      });
      if (!res.ok) throw new Error((await res.json()).error || 'Failed to add misc income');
      toast.success('Misc Income recorded successfully!');
      setShowMiscIncomeModal(false);
      setMiscIncomeForm({ amount: '', wallet_id: '', description: '', date: new Date().toISOString().split('T')[0] });
      handleRefreshAllData(); 
    } catch (err) { toast.error(err.message); }
  };

  useEffect(() => {
    if (activeAccountingTab === 'ledger') setLedgerFilters(prev => ({ ...prev, from: date, to: date }));
  }, [date, activeAccountingTab]);

  const derivedWallets = Array.isArray(accountingData?.wallets) && accountingData.wallets.length > 0 ? accountingData.wallets : wallets;
  const calculateCashInHand = () => derivedWallets.filter(w => w.type?.toLowerCase() === 'cash').reduce((sum, w) => sum + (Number(w.currentBalance) || 0), 0);
  const calculateBankBalance = () => derivedWallets.filter(w => w.type?.toLowerCase() === 'bank').reduce((sum, w) => sum + (Number(w.currentBalance) || 0), 0);
  const calculateDigitalBalance = () => derivedWallets.filter(w => w.type?.toLowerCase() === 'digital').reduce((sum, w) => sum + (Number(w.currentBalance) || 0), 0);
  const calculateTotalWalletBalance = () => derivedWallets.reduce((sum, w) => sum + (Number(w.currentBalance) || 0), 0);

  const refreshWalletBookBalances = async (targetDate) => { 
    const p = new URLSearchParams();
    if (isSuperAdmin && centreId) p.append("centreId", centreId);
    if (targetDate) p.append("date", targetDate);
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/accounting/wallet-book-balances?${p.toString()}`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
    const data = await res.json();
    onUpdateAccounting("wallets", data.map(item => ({ id: item.id, name: item.name, type: item.wallet_type || 'unknown', wallet_type: item.wallet_type || 'unknown', currentBalance: Number(item.book_balance || 0), book_balance: Number(item.book_balance || 0) })));
  };

  const expensesForCurrentDate = useMemo(() => accountingData.expenses.filter(e => e.date === date), [accountingData.expenses, date]);

  const buildQueryString = (params = {}) => {
    const allParams = { ...params };
    if (isSuperAdmin && centreId) allParams.centreId = centreId;
    return new URLSearchParams(allParams).toString();
  };

  useEffect(() => {
    const fetchAllInitialData = async () => {
      setLoading(true);
      try {
        const h = { Authorization: `Bearer ${localStorage.getItem("token")}` };
        const dRes = await fetch(`${import.meta.env.VITE_API_URL}/api/accounting/daily-summary?${buildQueryString({ date })}`, { headers: h });
        if (dRes.ok) onUpdateAccounting("dailySummary", await dRes.json());
        
        const iRes = await fetch(`${import.meta.env.VITE_API_URL}/api/accounting/income?${buildQueryString({ date })}`, { headers: h });
        if (iRes.ok) onUpdateAccounting("income", await iRes.json());

        const lRes = await fetch(`${import.meta.env.VITE_API_URL}/api/accounting/ledger?${buildQueryString({ from: date, to: date })}`, { headers: h });
        if (lRes.ok) onUpdateAccounting('ledger', await lRes.json());

        const eRes = await fetch(`${import.meta.env.VITE_API_URL}/api/expense?${buildQueryString()}`, { headers: h });
        if (eRes.ok) {
          const raw = await eRes.json();
          onUpdateAccounting('expenses', raw.map(item => ({ ...item, date: item.expense_date ? item.expense_date.slice(0, 10) : item.date, status: item.status === 'auto_approved' ? 'approved' : item.status?.toLowerCase() })));
        }

        await refreshWalletBookBalances(date);

        const nRes = await fetch(`${import.meta.env.VITE_API_URL}/api/accounting/nightly-close?${buildQueryString({ date })}`, { headers: h });
        if (nRes.ok) {
          const cData = await nRes.json();
          if (cData) onUpdateAccounting('nightlyAccounting', { ...accountingData.nightlyAccounting, [date]: { checklist: cData.checklist || {}, notes: cData.notes || '', closingCash: cData.closing_balance?.toString() || '', actualCashCount: cData.actual_cash?.toString() || '', timestamp: cData.closed_at || cData.created_at } });
        }
        toast.success("Data loaded!");
      } catch (error) { toast.error("Failed to load data"); } 
      finally { setLoading(false); }
    };
    fetchAllInitialData();
  }, [date, centreId, isSuperAdmin]);

  // --- REPORT PERIOD EFFECTS ---
  const formatDateForAPI = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const getReportDateRange = (period) => {
    const now = new Date();
    let from, to;
    
    if (period === 'Today') {
      from = date; 
      to = date;
    } else if (period === 'This Week') {
      const first = now.getDate() - now.getDay() + 1;
      from = formatDateForAPI(new Date(now.setDate(first)));
      to = formatDateForAPI(new Date(now.setDate(first + 6)));
    } else if (period === 'This Month') {
      from = formatDateForAPI(new Date(now.getFullYear(), now.getMonth(), 1));
      to = formatDateForAPI(new Date(now.getFullYear(), now.getMonth() + 1, 0));
    } else if (period === 'This Quarter') {
      const quarter = Math.floor(now.getMonth() / 3);
      from = formatDateForAPI(new Date(now.getFullYear(), quarter * 3, 1));
      to = formatDateForAPI(new Date(now.getFullYear(), quarter * 3 + 3, 0));
    } else if (period === 'This Year') {
      from = formatDateForAPI(new Date(now.getFullYear(), 0, 1));
      to = formatDateForAPI(new Date(now.getFullYear(), 11, 31));
    } else if (period === 'Custom Range') {
      from = customDateRange.from;
      to = customDateRange.to;
    } else {
      from = date;
      to = date;
    }
    return { from, to };
  };

  useEffect(() => {
    if (activeAccountingTab === 'reports') {
      const fetchReportData = async () => {
        setReportData(prev => ({ ...prev, loading: true }));
        const { from, to } = getReportDateRange(reportPeriod);
        
        try {
          const h = { Authorization: `Bearer ${localStorage.getItem("token")}` };
          
          const iRes = await fetch(`${import.meta.env.VITE_API_URL}/api/accounting/income?${buildQueryString({ from, to })}`, { headers: h });
          const incomeData = await iRes.json();

          const lRes = await fetch(`${import.meta.env.VITE_API_URL}/api/accounting/ledger?${buildQueryString({ from, to })}`, { headers: h });
          const ledgerData = await lRes.json();

          const filteredExpenses = accountingData.expenses.filter(e => e.date >= from && e.date <= to);

          setReportData({ 
            income: incomeData.rows || [], 
            expenses: filteredExpenses, 
            ledger: ledgerData.rows || [], 
            loading: false 
          });
        } catch (error) {
          console.error('Failed to fetch report data', error);
          setReportData(prev => ({ ...prev, loading: false }));
        }
      };

      fetchReportData();
    }
  }, [activeAccountingTab, reportPeriod, date, customDateRange.from, customDateRange.to, isSuperAdmin, centreId]);


  const fetchLedger = async () => {
    const params = { from: ledgerFilters.from || date, to: ledgerFilters.to || date };
    if (ledgerFilters.staff_id) params.staff_id = ledgerFilters.staff_id;
    if (ledgerFilters.wallet_id) params.wallet_id = ledgerFilters.wallet_id;
    if (ledgerFilters.category) params.category = ledgerFilters.category;
    const res = await fetch(`${import.meta.env.VITE_API_URL}/api/accounting/ledger?${buildQueryString(params)}`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });
    onUpdateAccounting('ledger', await res.json());
  };

  const accountingTabs = [
    { id: 'daily', label: 'Daily Accounting', icon: FiCalendar },
    { id: 'income', label: 'Income View', icon: FiTrendingUp },
    { id: 'ledger', label: 'Ledger', icon: FiBook },
    { id: 'expenses', label: 'Expenses', icon: FiTrendingDown },
    { id: 'wallets', label: 'Wallet Recon', icon: FiSmartphone },
    { id: 'reports', label: 'Reports', icon: FiFileText }
  ];

  const handleUpdateDailySummary = async (summary) => {
    onUpdateAccounting('dailySummary', { ...accountingData.dailySummary, ...summary });
    if (summary.actualCashInHand !== undefined) {
      try {
        await fetch(`${import.meta.env.VITE_API_URL}/api/accounting/daily-summary/actual-cash`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
          body: JSON.stringify({ date: date, actual_cash: summary.actualCashInHand })
        });
      } catch (error) { toast.error('Failed to save Actual Cash.'); }
    }
  };

  const handleCompleteNightlyAccounting = async (payload) => {
    try {
      const saveRes = await fetch(`${import.meta.env.VITE_API_URL}/api/accounting/nightly-close?${buildQueryString()}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` },
        body: JSON.stringify({ ...payload, opening_balance: accountingData.dailySummary?.derived?.openingBalance || 0 })
      });
      if (!saveRes.ok) throw new Error('Failed to save');
      onUpdateAccounting('nightlyAccounting', { ...accountingData.nightlyAccounting, [date]: { checklist: payload.checklist, notes: payload.notes, closingCash: payload.closing_balance?.toString(), actualCashCount: payload.actual_cash?.toString(), timestamp: new Date().toISOString() } });
      toast.success('Nightly accounting completed!');
    } catch (error) { toast.error('Failed to save closure'); }
  };

  const handleReconcileWallets = (reconciliations) => {
    onUpdateAccounting('walletReconciliations', [...accountingData.walletReconciliations, ...reconciliations.map(r => ({ ...r, date, reconciledBy: 'Admin' }))]);
  };

  const handleRefreshAllData = async () => {
    setLoading(true);
    try {
      const h = { Authorization: `Bearer ${localStorage.getItem("token")}` };
      const dRes = await fetch(`${import.meta.env.VITE_API_URL}/api/accounting/daily-summary?${buildQueryString({ date })}`, { headers: h });
      if (dRes.ok) onUpdateAccounting("dailySummary", await dRes.json());
      const iRes = await fetch(`${import.meta.env.VITE_API_URL}/api/accounting/income?${buildQueryString({ date })}`, { headers: h });
      if (iRes.ok) onUpdateAccounting('income', await iRes.json());
      await refreshWalletBookBalances(date);
      toast.success("All data refreshed!");
    } catch (error) { toast.error("Failed to refresh"); } finally { setLoading(false); }
  };

  // --- TOP QUICK STATS (Always tied to Global Date) ---
  const totalRevenue = accountingData.income?.rows?.reduce((sum, row) => sum + Number(row.received_amount || 0), 0) || 0;
  const totalServiceCharges = accountingData.income?.rows?.reduce((sum, row) => {
    const r = Number(row.received_amount || 0), s = Number(row.service_charges || 0), d = Number(row.department_charges || 0);
    if (s+d > 0 && r > 0) return sum + (s * (r / (s+d)));
    else if (r > 0 && s+d === 0) return sum + r;
    return sum;
  }, 0) || 0;
  const todayExpenses = expensesForCurrentDate.filter(e => e.status === 'approved').reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const todayProfit = totalServiceCharges - todayExpenses;
  const pendingApprovals = expensesForCurrentDate.filter(e => e.status === 'pending').length;

  // --- REPORT TAB SPECIFIC STATS ---
  const reportRevenue = reportData.income.reduce((sum, row) => sum + Number(row.received_amount || 0), 0);
  const reportServiceCharges = reportData.income.reduce((sum, row) => {
    const r = Number(row.received_amount || 0), s = Number(row.service_charges || 0), d = Number(row.department_charges || 0);
    if (s+d > 0 && r > 0) return sum + (s * (r / (s+d)));
    else if (r > 0 && s+d === 0) return sum + r;
    return sum;
  }, 0);
  const reportDeptCharges = reportData.income.reduce((sum, row) => {
    const r = Number(row.received_amount || 0), s = Number(row.service_charges || 0), d = Number(row.department_charges || 0);
    if (s+d > 0 && r > 0) return sum + (d * (r / (s+d)));
    return sum;
  }, 0);
  const reportExpensesTotal = reportData.expenses.filter(e => e.status === 'approved').reduce((sum, e) => sum + Number(e.amount || 0), 0);
  const reportProfit = reportServiceCharges - reportExpensesTotal;
  const reportPendingApprovals = reportData.expenses.filter(e => e.status === 'pending').length;

  const handleExportExcel = () => {
    try {
      const formatAmount = (val) => val ? Number(val).toLocaleString('en-IN') : '0';
      const rIncome = reportData.income.map(row => ({ 'Date': row.received_at ? new Date(row.received_at).toLocaleDateString() : '', 'Time': row.received_at ? new Date(row.received_at).toLocaleTimeString() : '', 'Customer': row.customer_name || '', 'Service': row.service_name || '', 'Staff': row.staff_name || '', 'Received Amount (₹)': formatAmount(row.received_amount), 'Service Charges (₹)': formatAmount(row.service_charges), 'Department Charges (₹)': formatAmount(row.department_charges), 'Status': 'Completed' }));
      const rExp = reportData.expenses.filter(e => e.status !== 'rejected').map(exp => ({ 'Date': exp.date || '', 'Description': exp.description || '', 'Category': exp.category || '', 'Amount (₹)': formatAmount(exp.amount), 'Payment Method': exp.payment_method || '', 'Wallet': exp.wallet_name || '', 'Staff': exp.staff_name || '', 'Status': exp.status || '', 'Notes': exp.notes || '' }));
      const rLedger = reportData.ledger.map(tx => ({ 'Date': tx.created_at ? new Date(tx.created_at).toLocaleDateString() : '', 'Time': tx.created_at ? new Date(tx.created_at).toLocaleTimeString() : '', 'Wallet': tx.wallet_name || '', 'Type': tx.type || '', 'Amount (₹)': formatAmount(tx.amount), 'Category': tx.category || '', 'Staff': tx.staff_name || '', 'Customer': tx.customer_name || '', 'Service': tx.service_name || '' }));
      
      const wb = XLSX.utils.book_new();
      const w1 = XLSX.utils.json_to_sheet(rIncome), w2 = XLSX.utils.json_to_sheet(rExp), w3 = XLSX.utils.json_to_sheet(rLedger);
      
      XLSX.utils.book_append_sheet(wb, w1, 'Income');
      XLSX.utils.book_append_sheet(wb, w2, 'Expenses');
      XLSX.utils.book_append_sheet(wb, w3, 'Ledger');
      
      const pName = reportPeriod === 'Custom Range' ? `${customDateRange.from}_to_${customDateRange.to}` : reportPeriod.replace(/\s+/g, '_');
      const fileName = `Accounting_Report_${pName}.xlsx`;
      
      const excelBuffer = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
      const dataBlob = new Blob([excelBuffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet;charset=UTF-8' });
      const url = window.URL.createObjectURL(dataBlob);
      const link = document.createElement('a');
      link.href = url; link.setAttribute('download', fileName);
      document.body.appendChild(link); link.click(); document.body.removeChild(link); window.URL.revokeObjectURL(url);
      toast.success(`Report exported as ${fileName}`);
    } catch (error) { toast.error('Failed to generate Excel report'); }
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
              <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="pl-10 pr-4 py-2 bg-white border border-gray-300 rounded-lg text-gray-900 placeholder-gray-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500 text-sm" />
            </div>
            <button onClick={handleRefreshAllData} disabled={loading} className="p-2 bg-indigo-100 text-indigo-600 rounded-lg hover:bg-indigo-200 disabled:opacity-50">
              <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Quick Stats (Always Today based on global date) */}
        <div className="grid grid-cols-5 gap-3 mt-4">
          <StatCard title="Today's Revenue" value={`₹${totalRevenue.toLocaleString()}`} subtitle="Total collected amount" icon={FiDollarSign} color="bg-emerald-600" />
          <StatCard title="Today's Profit" value={`₹${todayProfit.toLocaleString()}`} subtitle="Service charges minus expenses" icon={FiTrendingUp} color="bg-indigo-600" />
          <StatCard title="Pending Approvals" value={pendingApprovals} subtitle="Requires action" icon={FiAlertCircle} color="bg-yellow-600" />
          <StatCard title="Cash in Hand" value={`₹${calculateCashInHand().toLocaleString()}`} subtitle="Physical cash wallets" icon={FiDollarSign} color="bg-amber-600" />
          <StatCard title="Total Wallet Balance" value={`₹${calculateTotalWalletBalance().toLocaleString()}`} subtitle="All wallets combined" icon={FiSmartphone} color="bg-purple-600" />
        </div>
      </div>

      {loading ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 flex items-center justify-center">
          <FiRefreshCw className="animate-spin h-6 w-6 text-indigo-600" />
          <span className="ml-2 text-gray-600">Loading accounting data...</span>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden relative">
          <div className="border-b border-gray-200 bg-gray-50">
            <div className="flex overflow-x-auto px-2">
              {accountingTabs.map(tab => (
                <button key={tab.id} onClick={() => setActiveAccountingTab(tab.id)} className={`flex items-center space-x-2 px-4 py-3 font-medium whitespace-nowrap border-b-2 transition-colors text-sm ${activeAccountingTab === tab.id ? 'border-indigo-500 text-indigo-600 bg-white' : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'}`}>
                  <tab.icon className="h-4 w-4" /> <span>{tab.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 relative">
            {reportData.loading && activeAccountingTab === 'reports' && (
              <div className="absolute inset-0 bg-white/60 backdrop-blur-sm z-10 flex items-center justify-center rounded-b-lg">
                <FiRefreshCw className="animate-spin h-8 w-8 text-indigo-600" />
              </div>
            )}

            {activeAccountingTab === 'daily' && (
              <div className="space-y-4">
                <NightlyAccountingChecklist date={date} onComplete={handleCompleteNightlyAccounting} existingData={accountingData.nightlyAccounting?.[date]} />
                <DailySummaryComponent summaryData={accountingData.dailySummary} onUpdate={handleUpdateDailySummary} />
              </div>
            )}

            {activeAccountingTab === 'income' && (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-sm font-semibold text-gray-900 flex items-center"><FiTrendingUp className="h-4 w-4 mr-2 text-emerald-600" /> Income & Collections</h2>
                  <button onClick={() => setShowMiscIncomeModal(true)} className="px-3 py-1.5 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 flex items-center space-x-1 text-sm shadow-sm"><FiPlusCircle className="h-4 w-4" /> <span>Add Misc Income</span></button>
                </div>
                <IncomeViewComponent transactions={accountingData.income || []} />
              </>
            )}

            {activeAccountingTab === 'ledger' && (
              <div className="space-y-4">
                <div className="grid grid-cols-6 gap-3 bg-gray-50 p-3 rounded-lg border border-gray-200">
                  <input type="date" value={ledgerFilters.from || date} onChange={(e) => setLedgerFilters(p => ({ ...p, from: e.target.value }))} className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-1 focus:ring-indigo-500" />
                  <input type="date" value={ledgerFilters.to || date} onChange={(e) => setLedgerFilters(p => ({ ...p, to: e.target.value }))} className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-1 focus:ring-indigo-500" />
                  <select value={ledgerFilters.staff_id} onChange={(e) => setLedgerFilters(p => ({ ...p, staff_id: e.target.value }))} className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-1 focus:ring-indigo-500">
                    <option value="">All Staff</option>{staff?.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                  <select value={ledgerFilters.wallet_id} onChange={(e) => setLedgerFilters(p => ({ ...p, wallet_id: e.target.value }))} className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-1 focus:ring-indigo-500">
                    <option value="">All Wallets</option>{derivedWallets?.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                  </select>
                  <select value={ledgerFilters.category} onChange={(e) => setLedgerFilters(p => ({ ...p, category: e.target.value }))} className="border border-gray-300 rounded px-3 py-1.5 text-sm focus:ring-1 focus:ring-indigo-500">
                    <option value="">All Categories</option>
                    <option value="Service Payment">Service Payment</option>
                    <option value="Department Payment">Department Payment</option>
                    <option value="Expense">Expense</option>
                    <option value="Salary">Salary</option>
                    <option value="Salary Advance">Salary Advance</option>
                    <option value="Transfer">Transfer</option>
                  </select>
                  <button onClick={() => setLedgerFilters({ from: date, to: date, staff_id: '', wallet_id: '', category: '' })} className="px-3 py-1.5 bg-indigo-600 text-white rounded text-sm hover:bg-indigo-700 flex justify-center"><FiRefreshCw className="h-3 w-3 mr-1" /> Reset</button>
                </div>
                <LedgerView ledger={accountingData.ledger?.rows || []} onLedgerRowClick={() => {}} />
              </div>
            )}

            {activeAccountingTab === 'expenses' && (
              <>
                <div className="flex justify-between items-center mb-4">
                  <h2 className="text-sm font-semibold text-gray-900 flex items-center"><FiTrendingDown className="h-4 w-4 mr-2 text-indigo-600" /> Expenses</h2>
                  <button onClick={() => setShowAdminExpenseModal(true)} className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 flex items-center space-x-1 text-sm"><FiPlusCircle className="h-4 w-4" /> <span>Add Expense</span></button>
                </div>
                <ExpenseManagement expenses={expensesForCurrentDate} allowAdd={false} />
              </>
            )}

            {activeAccountingTab === 'wallets' && (
              <WalletReconciliation wallets={derivedWallets} onRefreshWallets={refreshWalletBookBalances} date={date} />
            )}

            {activeAccountingTab === 'reports' && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900 flex items-center"><FiFileText className="h-5 w-5 mr-2 text-indigo-600" /> Financial Reports & Analytics</h2>
                    <p className="text-gray-600 text-sm mt-1">Comprehensive financial insights and analysis</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center space-x-2">
                      <span className="text-xs text-gray-600">Period:</span>
                      <select 
                        value={reportPeriod}
                        onChange={(e) => setReportPeriod(e.target.value)}
                        className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:ring-1 focus:ring-indigo-500 focus:border-indigo-500"
                      >
                        <option value="Today">Today</option>
                        <option value="This Week">This Week</option>
                        <option value="This Month">This Month</option>
                        <option value="This Quarter">This Quarter</option>
                        <option value="This Year">This Year</option>
                        <option value="Custom Range">Custom Range</option>
                      </select>
                    </div>

                    {reportPeriod === 'Custom Range' && (
                      <div className="flex items-center space-x-2">
                        <input 
                          type="date" 
                          value={customDateRange.from}
                          onChange={(e) => setCustomDateRange(p => ({...p, from: e.target.value}))}
                          className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-1 focus:ring-indigo-500"
                        />
                        <span className="text-xs text-gray-500">to</span>
                        <input 
                          type="date" 
                          value={customDateRange.to}
                          onChange={(e) => setCustomDateRange(p => ({...p, to: e.target.value}))}
                          className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:ring-1 focus:ring-indigo-500"
                        />
                      </div>
                    )}

                    <button onClick={handleExportExcel} className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors text-sm">
                      <FiDownload className="h-4 w-4" /> <span>Export Report</span>
                    </button>
                  </div>
                </div>

                {/* Key Performance Indicators */}
                <div className="grid grid-cols-4 gap-4">
                  <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 bg-emerald-100 rounded-lg"><FiTrendingUp className="h-5 w-5 text-emerald-600" /></div>
                    </div>
                    <p className="text-sm text-gray-600">Total Revenue</p>
                    <p className="text-2xl font-bold text-gray-900">₹{reportRevenue.toLocaleString()}</p>
                    <div className="mt-2 flex items-center text-xs text-gray-500">
                      <span>Services: {reportData.income.length}</span>
                      <div className="w-1 h-1 mx-2 bg-gray-300 rounded-full"></div>
                      <span>Avg: ₹{(reportRevenue / (reportData.income.length || 1)).toFixed(2)}</span>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 bg-rose-100 rounded-lg"><FiTrendingDown className="h-5 w-5 text-rose-600" /></div>
                    </div>
                    <p className="text-sm text-gray-600">Total Expenses</p>
                    <p className="text-2xl font-bold text-gray-900">₹{reportExpensesTotal.toLocaleString()}</p>
                    <div className="mt-2 flex items-center text-xs text-gray-500">
                      <span>Approved: {reportData.expenses.filter(e => e.status === 'approved').length}</span>
                      <div className="w-1 h-1 mx-2 bg-gray-300 rounded-full"></div>
                      <span>Pending: {reportPendingApprovals}</span>
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 bg-indigo-100 rounded-lg"><FiDollarSign className="h-5 w-5 text-indigo-600" /></div>
                      <span className={`text-xs px-2 py-1 rounded-full ${reportProfit >= 0 ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                        {reportProfit >= 0 ? '+' : ''}{reportServiceCharges > 0 ? ((reportProfit / reportServiceCharges) * 100).toFixed(1) : '0'}%
                      </span>
                    </div>
                    <p className="text-sm text-gray-600">Net Profit</p>
                    <p className="text-2xl font-bold text-gray-900">₹{reportProfit.toLocaleString()}</p>
                    <div className="mt-2 text-xs text-gray-500">
                      Service Charges (Profit) - Business Expenses
                    </div>
                  </div>

                  <div className="bg-white border border-gray-200 rounded-xl p-4 shadow-sm">
                    <div className="flex items-center justify-between mb-2">
                      <div className="p-2 bg-blue-100 rounded-lg"><FiActivity className="h-5 w-5 text-blue-600" /></div>
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded-full">Timeframe</span>
                    </div>
                    <p className="text-sm text-gray-600">Ledger Activity</p>
                    <p className="text-2xl font-bold text-gray-900">{reportData.ledger.length}</p>
                    <div className="mt-2 text-xs text-gray-500">
                      Total transactions processed
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  {/* Income Breakdown */}
                  <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
                    <div className="flex items-center justify-between mb-4">
                      <h3 className="font-bold text-gray-900 text-sm flex items-center"><FiTrendingUp className="h-4 w-4 mr-2 text-emerald-600" /> Income Breakdown</h3>
                    </div>
                    
                    <div className="space-y-4">
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
                            <p className="text-xs font-bold text-gray-900">₹{Math.round(reportServiceCharges).toLocaleString()}</p>
                            <p className="text-xs text-emerald-600 font-medium">
                              {reportRevenue > 0 ? `${((reportServiceCharges/reportRevenue)*100).toFixed(1)}% of revenue` : '0%'}
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
                            <p className="text-xs font-bold text-gray-900">₹{Math.round(reportDeptCharges).toLocaleString()}</p>
                            <p className="text-xs text-blue-600">
                              {reportRevenue > 0 ? `${((reportDeptCharges / reportRevenue) * 100).toFixed(1)}% of revenue` : '0%'}
                            </p>
                          </div>
                        </div>
                      </div>

                      <div className="pt-2">
                        <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                          <div className="h-full bg-emerald-500" style={{ width: `${reportRevenue > 0 ? (reportServiceCharges/reportRevenue) * 100 : 0}%` }}></div>
                        </div>
                        <div className="flex justify-between text-xs text-gray-500 mt-1">
                          <span>Our Profit</span>
                          <span>Cost</span>
                        </div>
                      </div>

                      <div className="pt-4 border-t border-gray-100">
                        <h4 className="text-xs font-semibold text-gray-700 mb-3">Top 5 Services by Profit</h4>
                        <div className="space-y-2">
                          {(() => {
                            const serviceProfit = reportData.income.reduce((acc, row) => {
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
                            }, {});
                            const topServices = Object.values(serviceProfit).sort((a, b) => b.profit - a.profit).slice(0, 5);
                            if (topServices.length === 0) return <p className="text-xs text-gray-500 text-center py-2">No service data</p>;
                            const totalProfit = topServices.reduce((sum, s) => sum + s.profit, 0);
                            return topServices.map((service, index) => (
                              <div key={service.name} className="flex items-center justify-between hover:bg-gray-50 p-2 rounded">
                                <div className="flex items-center space-x-3">
                                  <div className={`w-6 h-6 rounded-lg flex items-center justify-center text-xs font-bold ${index === 0 ? 'bg-yellow-100 text-yellow-700' : index === 1 ? 'bg-gray-100 text-gray-700' : index === 2 ? 'bg-amber-100 text-amber-700' : 'bg-indigo-100 text-indigo-700'}`}>
                                    {index + 1}
                                  </div>
                                  <div className="max-w-[140px]">
                                    <span className="text-xs font-medium text-gray-900 truncate block">{service.name}</span>
                                    <span className="text-xs text-gray-500">Total: ₹{service.total.toLocaleString()}</span>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <p className="text-xs font-bold text-emerald-600">₹{Math.round(service.profit).toLocaleString()}</p>
                                  <div className="flex items-center space-x-1 text-xs text-gray-500">
                                    <span>Dept: ₹{Math.round(service.department).toLocaleString()}</span>
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
                      <h3 className="font-bold text-gray-900 text-sm flex items-center"><FiTrendingDown className="h-4 w-4 mr-2 text-rose-600" /> Expense Analysis</h3>
                    </div>
                    <div className="space-y-4">
                      <div className="grid grid-cols-3 gap-3">
                        <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 text-center">
                          <p className="text-xs text-emerald-700 mb-1">Approved</p>
                          <p className="font-bold text-emerald-900 text-sm">₹{reportExpensesTotal.toLocaleString()}</p>
                          <p className="text-xs text-emerald-600 mt-1">{reportData.expenses.filter(e => e.status === 'approved').length} items</p>
                        </div>
                        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 text-center">
                          <p className="text-xs text-yellow-700 mb-1">Pending</p>
                          <p className="font-bold text-yellow-900 text-sm">₹{reportData.expenses.filter(e => e.status === 'pending').reduce((sum, e) => sum + Number(e.amount || 0), 0).toLocaleString()}</p>
                          <p className="text-xs text-yellow-600 mt-1">{reportPendingApprovals} items</p>
                        </div>
                        <div className="bg-rose-50 border border-rose-200 rounded-lg p-3 text-center">
                          <p className="text-xs text-rose-700 mb-1">Rejected</p>
                          <p className="font-bold text-rose-900 text-sm">₹{reportData.expenses.filter(e => e.status === 'rejected').reduce((sum, e) => sum + Number(e.amount || 0), 0).toLocaleString()}</p>
                          <p className="text-xs text-rose-600 mt-1">{reportData.expenses.filter(e => e.status === 'rejected').length} items</p>
                        </div>
                      </div>

                      <div className="pt-4">
                        <h4 className="text-xs font-semibold text-gray-700 mb-3">Expense by Category</h4>
                        <div className="space-y-2">
                          {(() => {
                            const categoryTotals = reportData.expenses.reduce((acc, expense) => {
                              const category = expense.category || 'Uncategorized';
                              if (!acc[category]) acc[category] = 0;
                              if (expense.status !== 'rejected') acc[category] += Number(expense.amount || 0);
                              return acc;
                            }, {});
                            const sortedCategories = Object.entries(categoryTotals).sort(([,a], [,b]) => b - a);
                            if (sortedCategories.length === 0) return <p className="text-xs text-gray-500 text-center py-2">No expense data</p>;
                            const tExp = Object.values(categoryTotals).reduce((s, v) => s + v, 0);
                            return sortedCategories.map(([category, amount]) => (
                              <div key={category} className="space-y-1">
                                <div className="flex items-center justify-between text-xs">
                                  <div className="flex items-center space-x-2">
                                    <span className="font-medium text-gray-700 capitalize">{category}</span>
                                    <span className="text-gray-500">{reportData.expenses.filter(e => e.category === category && e.status !== 'rejected').length} items</span>
                                  </div>
                                  <div className="text-right">
                                    <span className="font-bold text-gray-900">₹{amount.toLocaleString()}</span>
                                    {tExp > 0 && <span className="text-gray-500 ml-1">({((amount/tExp)*100).toFixed(1)}%)</span>}
                                  </div>
                                </div>
                                <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                                  <div className="h-full rounded-full bg-blue-500" style={{ width: `${tExp > 0 ? (amount/tExp)*100 : 0}%` }}></div>
                                </div>
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
                      <h3 className="font-bold text-gray-900 text-sm flex items-center"><FiActivity className="h-4 w-4 mr-2 text-indigo-600" /> Performance Metrics</h3>
                    </div>
                    <div className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-indigo-700">Profit Margin</span>
                            <span className={`text-xs font-bold ${reportProfit >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                              {reportRevenue > 0 ? ((reportProfit/reportRevenue)*100).toFixed(1) : '0'}%
                            </span>
                          </div>
                          <div className="h-1.5 bg-indigo-200 rounded-full overflow-hidden">
                            <div className={`h-full ${reportProfit >= 0 ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${Math.min(Math.abs((reportProfit/reportRevenue)*100), 100)}%` }}></div>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">Net Profit: ₹{reportProfit.toLocaleString()}</p>
                        </div>
                        <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                          <div className="flex items-center justify-between mb-2">
                            <span className="text-xs font-medium text-blue-700">Expense Ratio</span>
                            <span className="text-xs font-bold text-blue-600">
                              {reportRevenue > 0 ? ((reportExpensesTotal/reportRevenue)*100).toFixed(1) : '0'}%
                            </span>
                          </div>
                          <div className="h-1.5 bg-blue-200 rounded-full overflow-hidden">
                            <div className="h-full bg-blue-500" style={{ width: `${Math.min((reportExpensesTotal/reportRevenue)*100, 100)}%` }}></div>
                          </div>
                          <p className="text-xs text-gray-500 mt-1">Expenses: ₹{reportExpensesTotal.toLocaleString()}</p>
                        </div>
                      </div>

                      <div className="pt-4">
                        <h4 className="text-xs font-semibold text-gray-700 mb-3">Top Staff by Service Profit</h4>
                        <div className="space-y-2">
                          {(() => {
                            const staffPerformance = reportData.income.reduce((acc, row) => {
                              const staff = row.staff_name || 'Unknown';
                              if (!acc[staff]) acc[staff] = { name: staff, profit: 0, department: 0, count: 0, avg: 0 };
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
                            }, {});
                            const topStaff = Object.values(staffPerformance).sort((a, b) => b.profit - a.profit).slice(0, 5);
                            if (topStaff.length === 0) return <p className="text-xs text-gray-500 text-center py-2">No staff performance data</p>;
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
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Modals... */}
      <AnimatePresence>
        {showMiscIncomeModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowMiscIncomeModal(false)} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
                <div className="p-5 border-b border-gray-200 flex justify-between items-center bg-gray-50 rounded-t-lg">
                  <h2 className="text-lg font-bold text-gray-900 flex items-center"><FiTrendingUp className="mr-2 text-emerald-600 h-5 w-5" /> Add Misc Income</h2>
                  <button onClick={() => setShowMiscIncomeModal(false)} className="text-gray-400 hover:text-gray-600"><FiX className="h-5 w-5" /></button>
                </div>
                <form onSubmit={handleMiscIncomeSubmit} className="p-6 space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                    <input type="date" value={miscIncomeForm.date} onChange={(e) => setMiscIncomeForm(p => ({...p, date: e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-emerald-500" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Amount (₹)</label>
                    <input type="number" min="0" step="0.01" value={miscIncomeForm.amount} onChange={(e) => setMiscIncomeForm(p => ({...p, amount: e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-emerald-500" required />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Wallet to Credit</label>
                    <select value={miscIncomeForm.wallet_id} onChange={(e) => setMiscIncomeForm(p => ({...p, wallet_id: e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-emerald-500" required>
                      <option value="">Select a wallet...</option>
                      {derivedWallets.map(w => <option key={w.id} value={w.id}>{w.name}</option>)}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <textarea value={miscIncomeForm.description} onChange={(e) => setMiscIncomeForm(p => ({...p, description: e.target.value}))} className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-1 focus:ring-emerald-500" required rows="3" />
                  </div>
                  <div className="flex justify-end pt-4 border-t border-gray-100">
                    <button type="button" onClick={() => setShowMiscIncomeModal(false)} className="px-4 py-2 border text-gray-700 rounded-lg mr-3">Cancel</button>
                    <button type="submit" className="px-4 py-2 bg-emerald-600 text-white rounded-lg">Record Income</button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {showAdminExpenseModal && (
          <>
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setShowAdminExpenseModal(false)} className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40" />
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.95 }} className="fixed inset-0 z-50 flex items-center justify-center p-4">
              <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
                <AdminExpenseEntry wallets={wallets} categories={[]} teams={teams} onSubmit={async (p) => {
                  try {
                    await fetch(`${import.meta.env.VITE_API_URL}/api/expense?${buildQueryString()}`, {
                      method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` }, body: JSON.stringify(p)
                    });
                    setShowAdminExpenseModal(false);
                    handleRefreshAllData();
                    toast.success("Expense added");
                  } catch(e) { toast.error("Failed to add"); }
                }} onCancel={() => setShowAdminExpenseModal(false)} submitButtonText="Add Expense" title="Admin Expense Entry" />
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};

export default AccountingSection;