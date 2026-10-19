import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiDollarSign, FiTrendingUp, FiTrendingDown, FiShoppingBag,
  FiUsers, FiCalendar, FiFilter, FiDownload, FiEye, FiFileText, FiBarChart2,
  FiPieChart, FiRefreshCw, FiChevronDown, FiSearch, FiCheckCircle,
  FiAlertCircle, FiClock, FiUser, FiMapPin, FiMessageSquare, FiX,
  FiPrinter, FiShare2, FiCopy, FiLink, FiList, FiGrid, FiArrowLeft,
  FiArrowRight, FiDownloadCloud, FiTag, FiFlag, FiArchive, FiStar,
  FiBriefcase, FiPackage, FiShield, FiTarget,
  FiPercent, FiActivity, FiPieChart as FiPie, FiUserCheck, FiAward,
  FiBarChart, FiTrendingUp as FiTrendUp, FiTrendingDown as FiTrendDown,
  FiDollarSign as FiDollar, FiCreditCard as FiCard,
  FiSmartphone, FiLayers, FiDroplet, FiBell, FiSettings, FiGlobe,
  FiLock, FiUnlock, FiPlus, FiMinus, FiEdit, FiTrash, FiSave,
  FiMenu, FiChevronRight, FiChevronLeft, FiMoreVertical, FiMinimize,
  FiCheck, FiXCircle, FiAlertTriangle, FiLock as FiLockIcon,
  FiUnlock as FiUnlockIcon, FiCalendar as FiCalendarIcon,
  FiUserPlus, FiUsers as FiUsersIcon, FiClock as FiClockIcon,
  FiMail, FiPhone, FiMap, FiGlobe as FiGlobeIcon,
  FiCreditCard as FiCreditCardIcon, FiDollarSign as FiDollarSignIcon,
  FiShoppingCart, FiPackage as FiPackageIcon, FiTruck,
  FiHeart, FiStar as FiStarIcon, FiThumbsUp, FiThumbsDown,
  FiCornerUpLeft, FiCornerUpRight, FiCornerDownLeft, FiCornerDownRight,
  FiMinusCircle, FiPlusCircle, FiDivideCircle, FiPercent as FiPercentIcon,
  FiBarChart as FiBarChartIcon, FiPieChart as FiPieChartIcon,
  FiActivity as FiActivityIcon, FiTarget as FiTargetIcon,
  FiAward as FiAwardIcon, FiBriefcase as FiBriefcaseIcon,
  FiHome as FiHomeIcon, FiDatabase as FiDatabaseIcon,
  FiServer, FiHardDrive, FiCpu, FiWifi, FiWifiOff, FiBook,
  FiCloud, FiCloudRain, FiCloudSnow, FiCloudLightning,
  FiSun, FiMoon, FiWatch, FiWatch as FiWatchIcon, FiCircle,
  FiDatabase, FiCreditCard, FiHome, FiLoader, FiArrowUpCircle, FiTool
} from 'react-icons/fi';
import { getPendingPayments, getPendingPaymentsHistory, receiveServicePayment, getWallets } from '@/services/serviceService';
import { toast } from "react-toastify";
import { istDayStart, addDays } from "@/utils/dates.js";

// Shared style tokens (UI only)
const fieldCls =
  'w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500';
const thCls = 'px-4 py-3 text-left text-xs font-semibold uppercase tracking-wider text-slate-500';

// Pending Payments Stat Card
const PendingPaymentsStatCard = ({ title, value, icon: Icon, color, subtitle, trend, onClick, compact = false }) => (
  <motion.div
    whileHover={{ y: -2 }}
    className={`rounded-2xl border border-slate-200 bg-white shadow-sm transition-shadow hover:shadow-md ${onClick ? 'cursor-pointer' : ''} ${
      compact ? 'p-3' : 'p-4 sm:p-5'
    }`}
    onClick={onClick}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="mb-1 text-xs font-medium text-slate-500">{title}</p>
        <p className={`mb-1 truncate font-bold text-slate-900 ${compact ? 'text-lg' : 'text-2xl'}`}>{value}</p>
        <p className="text-xs text-slate-500">{subtitle}</p>
        {trend !== undefined && (
          <p className={`text-xs font-medium ${trend > 0 ? 'text-emerald-600' : trend < 0 ? 'text-rose-600' : 'text-slate-600'}`}>
            {trend > 0 ? '+' : ''}{trend}% from last month
          </p>
        )}
      </div>
      <div className={`shrink-0 rounded-xl ${color} ${compact ? 'p-2' : 'p-2.5'}`}>
        <Icon className={`text-white ${compact ? 'h-4 w-4' : 'h-5 w-5'}`} />
      </div>
    </div>
  </motion.div>
);

// ==========================================
// 1. SERVICE DETAIL MODAL
// ==========================================
const PendingPaymentDetailModal = ({ isOpen, onClose, serviceEntry }) => {
  if (!serviceEntry) return null;

  const formatDate = (date) => {
    if (!date) return "—";
    const d = new Date(date);
    return isNaN(d) ? "—" : d.toLocaleDateString("en-IN", {
      day: "2-digit", month: "short", year: "numeric",
    });
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={onClose}>
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Service details"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-5 shadow-xl sm:p-6"
          >
            <div className="mb-5 flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-bold text-slate-900">Service Details</h3>
                <p className="text-sm text-slate-500">ID: {serviceEntry.id} • Staff: {serviceEntry.staff?.name}</p>
              </div>
              <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 transition-colors hover:bg-slate-100">
                <FiX className="h-5 w-5 text-slate-600" />
              </button>
            </div>

            <div className="space-y-5">
              {/* Customer & Service Info */}
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="mb-1 text-xs text-slate-500">Customer Name</p>
                  <p className="font-semibold text-slate-900">{serviceEntry.customer.name}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="mb-1 text-xs text-slate-500">Phone Number</p>
                  <p className="font-semibold text-slate-900">{serviceEntry.customer.phone}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="mb-1 text-xs text-slate-500">Service Type</p>
                  <p className="font-semibold text-slate-900">{serviceEntry.service.type}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4">
                  <p className="mb-1 text-xs text-slate-500">Subcategory</p>
                  <p className="font-semibold text-slate-900">{serviceEntry.service.subcategory || "—"}</p>
                </div>
              </div>

              {/* Financials */}
              <div className="rounded-xl border border-slate-200 p-4">
                <h4 className="mb-3 border-b border-slate-100 pb-2 text-sm font-bold text-slate-900">Financial Summary</h4>
                <div className="flex justify-between py-1 text-sm">
                  <span className="text-slate-600">Total Amount</span>
                  <span className="font-bold text-slate-900">₹{serviceEntry.total.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1 text-sm">
                  <span className="text-slate-600">Amount Paid</span>
                  <span className="font-bold text-emerald-600">₹{serviceEntry.paid.toLocaleString('en-IN')}</span>
                </div>
                <div className="mt-2 flex justify-between border-t border-slate-100 pt-2">
                  <span className="font-bold text-slate-900">Balance Due</span>
                  <span className="text-lg font-bold text-rose-600">₹{serviceEntry.due.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Payment History */}
              <div>
                <h4 className="mb-3 text-sm font-bold text-slate-900">Payment History</h4>
                {serviceEntry.paymentHistory && serviceEntry.paymentHistory.length > 0 ? (
                  <div className="space-y-2">
                    {serviceEntry.paymentHistory.map((ph, idx) => (
                      <div key={idx} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 p-3">
                        <div>
                          <p className="text-sm font-medium text-slate-900">{formatDate(ph.created_at)}</p>
                          <p className="text-xs text-slate-500">{ph.wallet_name || 'Wallet'}</p>
                        </div>
                        <span className="font-bold text-emerald-600">+₹{Number(ph.amount).toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm italic text-slate-500">No payments recorded yet.</p>
                )}
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// ==========================================
// 2. RECEIVE PAYMENT MODAL
// ==========================================
const ReceivePaymentModal = ({ isOpen, onClose, onSuccess, payment }) => {
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    amount: '',
    wallet: '',
    paymentMethod: 'cash',
    remarks: ''
  });

  useEffect(() => {
    if (isOpen && payment) {
      setFormData(prev => ({ ...prev, amount: payment.due })); 
      getWallets().then(res => setWallets(res.data || [])).catch(console.error);
    }
  }, [isOpen, payment]);

  const handleSubmit = async () => {
    try {
      setLoading(true);
      await receiveServicePayment(payment.id, {
        amount: formData.amount,
        wallet_id: formData.wallet,
        payment_method: formData.paymentMethod,
        remarks: formData.remarks
      });
      onSuccess(); 
      onClose();   
    } catch (err) {
      alert(err.response?.data?.error || "Payment failed");
    } finally {
      setLoading(false);
    }
  };

  if (!payment) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm" onClick={onClose}>
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Receive payment"
            onClick={(e) => e.stopPropagation()}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="w-full max-w-md rounded-2xl bg-white p-5 shadow-xl sm:p-6"
          >
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-lg font-bold text-slate-900">Receive Payment</h3>
              <button onClick={onClose} aria-label="Close" className="rounded-lg p-2 transition-colors hover:bg-slate-100">
                <FiX className="h-5 w-5 text-slate-600" />
              </button>
            </div>

            <div className="mb-4 flex items-center justify-between rounded-xl border border-rose-100 bg-rose-50 p-3">
              <span className="text-sm font-medium text-rose-800">Balance Due</span>
              <span className="text-xl font-bold text-rose-800">₹{payment.due.toLocaleString('en-IN')}</span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Collection Amount (₹)</label>
                <input
                  type="number"
                  max={payment.due}
                  value={formData.amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                  className={fieldCls}
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-600">Credit to Wallet</label>
                <select
                  value={formData.wallet}
                  onChange={(e) => setFormData(prev => ({ ...prev, wallet: e.target.value }))}
                  className={fieldCls}
                >
                  <option value="">Select a wallet...</option>
                  {wallets.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div className="flex gap-3 pt-2">
                <button onClick={onClose} className="flex-1 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50">
                  Cancel
                </button>
                <button 
                  onClick={handleSubmit} 
                  disabled={loading || !formData.amount || !formData.wallet}
                  className="flex flex-1 items-center justify-center rounded-xl bg-emerald-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {loading ? <FiRefreshCw className="animate-spin" /> : "Record Payment"}
                </button>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

const PendingPaymentsSection = ({
  isMobile,
  pendingPayments: externalPayments,
  loading: externalLoading,
  filter: externalFilter,
  setFilter: setExternalFilter,
  fromDate: externalFromDate,
  setFromDate: setExternalFromDate,
  toDate: externalToDate,
  setToDate: setExternalToDate,
  isSuperAdmin = false,
  readOnly = false
}) => {

  const [pendingPayments, setPendingPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [selectedService, setSelectedService] = useState(null);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [wallets, setWallets] = useState([]);
  const [stats, setStats] = useState({
    totalDue: 0,
    overdueCount: 0,
    pendingCount: 0,
    totalReceivables: 0
  });

  const [sendingWhatsappId, setSendingWhatsappId] = useState(null);

  const payments = isSuperAdmin ? externalPayments : pendingPayments;
  const isLoading = isSuperAdmin ? externalLoading : loading;

  const activeFilter = isSuperAdmin ? externalFilter : filter;
  const setActiveFilter = isSuperAdmin ? setExternalFilter : setFilter;

  const activeFromDate = isSuperAdmin ? externalFromDate : fromDate;
  const setActiveFromDate = isSuperAdmin ? setExternalFromDate : setFromDate;

  const activeToDate = isSuperAdmin ? externalToDate : toDate;
  const setActiveToDate = isSuperAdmin ? setExternalToDate : setToDate;

  const formatDate = (date) => {
    if (!date) return "—";
    const d = new Date(date);
    return isNaN(d) ? "—" : d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  const isOverdue = (createdAt, days = 7) => {
    if (!createdAt) return false;
    const diffDays =
      (Date.now() - new Date(createdAt)) / (1000 * 60 * 60 * 24);
    return diffDays > days;
  };

  const normalizePayments = (rows = []) => {
    return rows.map(r => ({
      id: String(r.service_entry_id || r.id),
      customer: {
        name: r.customer_name || "—",
        phone: r.customer_phone || ""
      },
      service: {
        type: r.service_name || "—",
        subcategory: r.subcategory_name || ""
      },
      staff: {
        id: r.staff_id || null,
        name: r.staff_name || "—"
      },
      total: Number(r.total_charges || 0),
      paid: Number(r.paid_amount || 0),
      due: Number(r.pending_amount || 0),
      createdAt: r.created_at,
      paymentHistory: Array.isArray(r.payment_history) ? r.payment_history : []
    }));
  };

  const fetchPendingPayments = async () => {
    try {
      setLoading(true);

      const response =
        filter === "history"
          ? await getPendingPaymentsHistory({ from: fromDate, to: toDate })
          : await getPendingPayments({ from: fromDate, to: toDate });

      const rows = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response)
          ? response
          : [];

      const normalized = normalizePayments(rows);

      setPendingPayments(normalized);
      setStats({
        totalReceivables: normalized.reduce((s, p) => s + p.total, 0),
        totalDue: normalized.reduce((s, p) => s + p.due, 0),
        pendingCount: normalized.filter(p => p.due > 0).length,
        overdueCount: normalized.filter(p => isOverdue(p.createdAt)).length,
        averageDue:
          normalized.length > 0
            ? Math.round(normalized.reduce((s, p) => s + p.due, 0) / normalized.length)
            : 0
      });
    } catch (err) {
      console.error("Pending payments fetch error:", err);
      alert("Failed to load pending payments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isSuperAdmin) return;
    fetchPendingPayments();
  }, [filter]);

  useEffect(() => {
    if (payments && payments.length >= 0) {
      setStats({
        totalReceivables: payments.reduce((s, p) => s + p.total, 0),
        totalDue: payments.reduce((s, p) => s + p.due, 0),
        pendingCount: payments.filter(p => p.due > 0).length,
        overdueCount: payments.filter(p => isOverdue(p.createdAt)).length,
      });
    }
  }, [payments]);

  const handleSendReminder = async (payment) => {
    try {
      setSendingWhatsappId(payment.id);

      const token = localStorage.getItem("token");

      const response = await fetch(
        `${import.meta.env.VITE_API_URL}/api/servicemanagement/pending-payments/${payment.id}/send-whatsapp`,
        {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
            "Content-Type": "application/json",
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to send WhatsApp");
      }

      toast.success(
        `WhatsApp reminder sent to ${payment.customer.name}`
      );

    } catch (error) {
      console.error("WhatsApp reminder error:", error);

      toast.error(
        error.message || "Failed to send WhatsApp reminder"
      );

    } finally {
      setSendingWhatsappId(null);
    }
  };

  const filteredPayments = useMemo(() => {
    let filtered = [...payments];

    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(payment =>
        payment.customer.name.toLowerCase().includes(query) ||
        payment.customer.phone.includes(query) ||
        payment.service.type.toLowerCase().includes(query) ||
        payment.id.includes(query)
      );
    }

    if (activeFromDate || activeToDate) {
      filtered = filtered.filter(payment => {
        // IST day bounds. new Date("2026-10-19") is 05:30 IST, which hid entries made
        // between midnight and 05:30 on the from-day.
        const paymentDate = new Date(payment.createdAt);
        let include = true;
        if (activeFromDate) include = include && paymentDate >= istDayStart(activeFromDate);
        if (activeToDate) include = include && paymentDate < istDayStart(addDays(activeToDate, 1));
        return include;
      });
    }

    if (activeFilter === 'overdue') {
      filtered = filtered.filter(payment => isOverdue(payment.createdAt));
    } else if (activeFilter === 'pending') {
      filtered = filtered.filter(payment => payment.paid === 0);
    } else if (activeFilter === 'partially_paid') {
      filtered = filtered.filter(payment => payment.paid > 0 && payment.due > 0);
    }
    return filtered;
  }, [payments, searchQuery, activeFilter, activeFromDate, activeToDate]);

  const calculatePaymentProgress = () => {
    if (payments.length === 0) return 0;
    const total = payments.reduce((sum, p) => sum + p.total, 0);
    const paid = payments.reduce((sum, p) => sum + p.paid, 0);
    return total > 0 ? Math.round((paid / total) * 100) : 0;
  };

  // UI helpers (open modals / row actions) — same state setters and handlers as before
  const openDetails = (payment) => {
    setSelectedService(payment);
    setShowServiceModal(true);
  };

  const renderActions = (payment) => (
    <div className="flex items-center gap-1">
      <button
        onClick={() => openDetails(payment)}
        className="rounded-lg p-2 text-navy-700 transition-colors hover:bg-slate-100"
        title="View Details"
        aria-label="View details"
      >
        <FiEye className="h-4 w-4" />
      </button>

      {!readOnly && (
      <button
        onClick={() => {
          setSelectedPayment(payment);
          setShowPaymentModal(true);
        }}
        className="rounded-lg p-2 text-emerald-600 transition-colors hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:bg-transparent"
        title="Receive Payment"
        aria-label="Receive payment"
        disabled={payment.due === 0}
      >
        <FiCreditCard className="h-4 w-4" />
      </button>
      )}

      {!readOnly && (
      <button
        onClick={() => handleSendReminder(payment)}
        disabled={sendingWhatsappId === payment.id}
        className="rounded-lg p-2 text-green-600 transition-colors hover:bg-green-50 disabled:opacity-50"
        title="Send WhatsApp Reminder"
        aria-label="Send WhatsApp reminder"
      >
        {sendingWhatsappId === payment.id ? (
          <FiRefreshCw className="h-4 w-4 animate-spin" />
        ) : (
          <FiMessageSquare className="h-4 w-4" />
        )}
      </button>
      )}
      {!readOnly && isOverdue(payment.createdAt) && (
        <button
          onClick={() => {}}
          className="rounded-lg p-2 text-rose-600 transition-colors hover:bg-rose-50"
          title="Mark as High Priority"
          aria-label="Mark as high priority"
        >
          <FiBell className="h-4 w-4" />
        </button>
      )}
    </div>
  );

  const initials = (name) =>
    (name || "U")
      .split(' ')
      .filter(Boolean)
      .map(n => n[0])
      .join('');

  return (
    <div className="space-y-5">
      {/* Stats Cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <PendingPaymentsStatCard
          title="Total Receivables"
          value={`₹${stats.totalReceivables.toLocaleString('en-IN')}`}
          subtitle="Sum of all service amounts"
          icon={FiBarChart2}
          color="bg-navy-700"
          compact={isMobile}
        />
        <PendingPaymentsStatCard
          title="Pending Amount"
          value={`₹${stats.totalDue.toLocaleString('en-IN')}`}
          subtitle="Balance to be collected"
          icon={FiDollarSign}
          color="bg-rose-600"
          compact={isMobile}
        />
        <PendingPaymentsStatCard
          title="Pending Services"
          value={stats.pendingCount}
          subtitle="Services awaiting payment"
          icon={FiAlertCircle}
          color="bg-amber-600"
          compact={isMobile}
        />
        <PendingPaymentsStatCard
          title="Overdue"
          value={stats.overdueCount}
          subtitle="Past due date"
          icon={FiClock}
          color="bg-red-600"
          compact={isMobile}
        />
      </div>

      {/* Collection Progress */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <div className="mb-3 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-slate-900">Payment Collection Progress</h3>
          <span className="text-sm font-semibold text-slate-700">{calculatePaymentProgress()}%</span>
        </div>
        <div
          className="h-2.5 w-full overflow-hidden rounded-full bg-slate-200"
          role="progressbar"
          aria-valuenow={calculatePaymentProgress()}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div
            className="h-2.5 rounded-full bg-emerald-500 transition-all duration-500"
            style={{ width: `${calculatePaymentProgress()}%` }}
          ></div>
        </div>
        <div className="mt-2 flex justify-between text-xs text-slate-500">
          <span>₹{payments.reduce((sum, p) => sum + p.paid, 0).toLocaleString('en-IN')} Collected</span>
          <span>₹{stats.totalReceivables.toLocaleString('en-IN')} Total</span>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-center">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                placeholder="Search by customer, phone, service, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                aria-label="Search payments"
                className={`${fieldCls} pl-10 lg:w-80`}
              />
            </div>
            <div className="flex items-center gap-2">
              <FiFilter className="h-4 w-4 text-slate-400" />
              <select
                value={activeFilter}
                onChange={(e) => setActiveFilter(e.target.value)}
                aria-label="Payment filter"
                className={`${fieldCls} lg:w-auto`}
              >
                <option value="all">All Payments</option>
                <option value="overdue">Overdue Only</option>
                <option value="pending">Unpaid Only</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="history">Cleared History</option>
              </select>
            </div>
            {/* Date Filter */}
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative flex-1 sm:flex-none">
                <FiCalendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={activeFromDate}
                  onChange={(e) => setActiveFromDate(e.target.value)}
                  aria-label="From date"
                  className={`${fieldCls} pl-10 lg:w-auto`}
                />
              </div>
              <span className="text-sm text-slate-500">to</span>
              <div className="relative flex-1 sm:flex-none">
                <FiCalendar className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                <input
                  type="date"
                  value={activeToDate}
                  onChange={(e) => setActiveToDate(e.target.value)}
                  aria-label="To date"
                  className={`${fieldCls} pl-10 lg:w-auto`}
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (!isSuperAdmin) fetchPendingPayments();
                  }}
                  className="rounded-xl bg-navy-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-navy-800"
                >
                  Apply
                </button>
                <button
                  onClick={() => {
                    setActiveFromDate('');
                    setActiveToDate('');
                    if (!isSuperAdmin) fetchPendingPayments();
                  }}
                  className="rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center">
            <button 
              onClick={() => {
                if (!isSuperAdmin) fetchPendingPayments();
              }}
              className="flex items-center gap-2 rounded-xl border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition-colors hover:bg-slate-50"
            >
              <FiRefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Payments */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        {/* Mobile cards */}
        <div className="divide-y divide-slate-100 md:hidden">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-12">
              <div className="mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-navy-700"></div>
              <p className="text-sm text-slate-600">Loading pending payments...</p>
            </div>
          ) : filteredPayments.length > 0 ? (
            filteredPayments.map((payment) => (
              <div key={payment.id} className={`p-4 ${isOverdue(payment.createdAt) ? 'bg-rose-50/60' : ''}`}>
                <div className="flex items-start justify-between gap-3">
                  <button onClick={() => openDetails(payment)} className="flex min-w-0 items-center gap-3 text-left">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-navy-700">
                      <span className="text-xs font-bold text-white">{initials(payment.customer.name)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="truncate font-medium text-slate-900">{payment.customer.name}</p>
                      <p className="text-xs text-slate-500">ID: {payment.id}</p>
                    </div>
                  </button>
                  <div className="shrink-0 text-right">
                    <p className={`font-bold ${payment.due > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>₹{payment.due.toLocaleString('en-IN')}</p>
                    <p className="text-xs text-slate-500">due</p>
                  </div>
                </div>
                <div className="mt-3 text-sm">
                  <p className="font-medium text-slate-900">{payment.service.type}</p>
                  {payment.service.subcategory && <p className="truncate text-xs text-slate-500">{payment.service.subcategory}</p>}
                </div>
                <div className="mt-2 grid grid-cols-2 gap-2 text-xs text-slate-500">
                  <span>Total: <span className="font-semibold text-slate-800">₹{payment.total.toLocaleString('en-IN')}</span></span>
                  <span>Paid: <span className={`font-semibold ${payment.paid > 0 ? 'text-emerald-600' : 'text-slate-600'}`}>₹{payment.paid.toLocaleString('en-IN')}</span></span>
                  <span>Since: <span className="font-semibold text-slate-800">{formatDate(payment.createdAt)}</span></span>
                  <span>Staff: <span className="font-semibold text-slate-800">{payment.staff.name}</span></span>
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <a
                    href={`https://wa.me/${payment.customer.phone.replace(/\D/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-slate-600 hover:text-emerald-600"
                  >
                    <FiPhone className="h-3.5 w-3.5" />
                    <span>{payment.customer.phone}</span>
                  </a>
                  {isOverdue(payment.createdAt) && <span className="rounded-full bg-rose-100 px-2 py-0.5 text-xs font-medium text-rose-700">Overdue</span>}
                </div>
                <div className="mt-2 border-t border-slate-100 pt-2">{renderActions(payment)}</div>
              </div>
            ))
          ) : (
            <div className="flex flex-col items-center justify-center py-12">
              <FiFileText className="mb-3 h-12 w-12 text-slate-300" />
              <p className="text-base font-medium text-slate-500">
                {searchQuery || activeFilter !== 'all'
                  ? 'No matching payments found'
                  : 'No pending payments'}
              </p>
            </div>
          )}
        </div>

        {/* Desktop table */}
        <div className="hidden overflow-x-auto md:block">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className={thCls}>Customer</th>
                <th className={thCls}>Phone</th>
                <th className={thCls}>Service</th>
                <th className={thCls}>Total (₹)</th>
                <th className={thCls}>Paid (₹)</th>
                <th className={thCls}>Due (₹)</th>
                <th className={thCls}>Due Since</th>
                <th className={thCls}>Staff</th>
                <th className={thCls}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="mb-4 h-10 w-10 animate-spin rounded-full border-b-2 border-navy-700"></div>
                      <p className="text-sm text-slate-600">Loading pending payments...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredPayments.length > 0 ? (
                filteredPayments.map((payment) => (
                  <tr key={payment.id} className={`border-b border-slate-100 transition-colors ${isOverdue(payment.createdAt) ? 'bg-rose-50/60 hover:bg-rose-50' : 'hover:bg-slate-50'}`}>
                    <td className="px-4 py-3.5">
                      <button
                        onClick={() => openDetails(payment)}
                        className="group w-full text-left"
                      >
                        <div className="flex items-center gap-3">
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-navy-700">
                            <span className="text-xs font-bold text-white">{initials(payment.customer.name)}</span>
                          </div>
                          <div className="min-w-0 text-left">
                            <p className="truncate font-medium text-slate-900 group-hover:text-navy-700">
                              {payment.customer.name}
                            </p>
                            <p className="text-xs text-slate-500">ID: {payment.id}</p>
                          </div>
                        </div>
                      </button>
                    </td>
                    <td className="px-4 py-3.5">
                      <a
                        href={`https://wa.me/${payment.customer.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="group flex items-center gap-2 text-slate-600 transition-colors hover:text-emerald-600"
                      >
                        <div className="rounded-lg bg-emerald-50 p-1.5 group-hover:bg-emerald-100">
                          <FiPhone className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-sm">{payment.customer.phone}</span>
                      </a>
                    </td>
                    <td className="px-4 py-3.5">
                      <div>
                        <p className="text-sm font-medium text-slate-900">{payment.service.type}</p>
                        <p className="max-w-xs truncate text-xs text-slate-500">
                          {payment.service.subcategory}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <p className="font-bold text-slate-900">
                        ₹{payment.total.toLocaleString('en-IN')}
                      </p>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className={`rounded-lg p-1.5 ${payment.paid > 0 ? 'bg-emerald-50' : 'bg-slate-100'}`}>
                          <FiCreditCard className={`h-3.5 w-3.5 ${payment.paid > 0 ? 'text-emerald-600' : 'text-slate-400'}`} />
                        </div>
                        <p className={`font-medium ${payment.paid > 0 ? 'text-emerald-600' : 'text-slate-500'}`}>
                          ₹{payment.paid.toLocaleString('en-IN')}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <div className={`rounded-lg p-1.5 ${payment.due > 0 ? 'bg-rose-50' : 'bg-emerald-50'}`}>
                          <FiAlertCircle className={`h-3.5 w-3.5 ${payment.due > 0 ? 'text-rose-600' : 'text-emerald-600'}`} />
                        </div>
                        <p className={`font-bold ${payment.due > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          ₹{payment.due.toLocaleString('en-IN')}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3.5">
                      <div className="flex items-center gap-2">
                        <FiCalendar className={`h-4 w-4 ${isOverdue(payment.createdAt) ? 'text-rose-500' : 'text-amber-500'}`} />
                        <div>
                          <span className="text-sm text-slate-700">{formatDate(payment.createdAt)}</span>
                          {isOverdue(payment.createdAt) && (
                            <p className="mt-0.5 text-xs text-rose-500">Overdue</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-sm text-slate-700">{payment.staff.name}</td>
                    <td className="px-4 py-3.5">
                      {renderActions(payment)}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <FiFileText className="mb-3 h-12 w-12 text-slate-300" />
                      <p className="text-base font-medium text-slate-500">
                        {searchQuery || activeFilter !== 'all'
                          ? 'No matching payments found'
                          : 'No pending payments'}
                      </p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Summary Footer */}
        {filteredPayments.length > 0 && (
          <div className="border-t border-slate-200 bg-slate-50 px-4 py-4 sm:px-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-slate-600">
                  Showing <span className="font-medium">{filteredPayments.length}</span> of{' '}
                  <span className="font-medium">{payments.length}</span> pending payments
                </p>
                <p className="mt-1 text-sm text-slate-600">
                  Total due amount: <span className="font-bold text-rose-600">
                    ₹{filteredPayments.reduce((sum, p) => sum + p.due, 0).toLocaleString('en-IN')}
                  </span>
                </p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h4 className="mb-4 text-sm font-semibold text-slate-900">Payment Distribution</h4>
          <div className="space-y-3 text-sm">
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Fully Paid</span>
              <span className="font-medium text-emerald-600">
                {payments.filter(p => p.due === 0).length} services
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Partially Paid</span>
              <span className="font-medium text-blue-600">
                {payments.filter(p => p.paid > 0 && p.due > 0).length} services
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-600">Unpaid</span>
              <span className="font-medium text-amber-600">
                {payments.filter(p => p.paid === 0).length} services
              </span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h4 className="mb-4 text-sm font-semibold text-slate-900">Top Due Amounts</h4>
          <div className="space-y-1">
            {[...payments] /* copy: .sort() on the state array re-ordered the main list */
              .sort((a, b) => b.due - a.due)
              .slice(0, 3)
              .map(payment => (
                <div key={payment.id} className="flex items-center justify-between gap-3 border-b border-slate-100 py-2 last:border-0">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{payment.customer.name}</p>
                    <p className="truncate text-xs text-slate-500">{payment.service.type}</p>
                  </div>
                  <span className="shrink-0 font-bold text-rose-600">
                    ₹{payment.due.toLocaleString('en-IN')}
                  </span>
                </div>
              ))
            }
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h4 className="mb-4 text-sm font-semibold text-slate-900">Quick Actions</h4>
          <div className="space-y-2">
            {!readOnly && (
            <button className="flex w-full items-center justify-between rounded-xl border border-slate-200 p-3 text-sm transition-colors hover:bg-slate-50">
              <span className="text-slate-700">Send Bulk Reminders</span>
              <FiMail className="h-4 w-4 text-blue-600" />
            </button>
            )}
            <button className="flex w-full items-center justify-between rounded-xl border border-slate-200 p-3 text-sm transition-colors hover:bg-slate-50">
              <span className="text-slate-700">Generate Report</span>
              <FiFileText className="h-4 w-4 text-purple-600" />
            </button>
            <button 
              onClick={() => {
                if (!isSuperAdmin) fetchPendingPayments();
              }}
              className="flex w-full items-center justify-between rounded-xl border border-slate-200 p-3 text-sm transition-colors hover:bg-slate-50"
            >
              <span className="text-slate-700">Refresh Data</span>
              <FiRefreshCw className="h-4 w-4 text-navy-700" />
            </button>
          </div>
        </div>
      </div>

      {showServiceModal && (
        <PendingPaymentDetailModal
          isOpen={showServiceModal}
          onClose={() => {
            setShowServiceModal(false);
            setSelectedService(null);
          }}
          serviceEntry={selectedService}
        />
      )}

      {showPaymentModal && (
        <ReceivePaymentModal
          isOpen={showPaymentModal}
          onClose={() => {
            setShowPaymentModal(false);
            setSelectedPayment(null);
          }}
          onSuccess={() => {
            if (!isSuperAdmin) fetchPendingPayments();
          }}
          payment={selectedPayment}
        />
      )}
    </div>
  );
};

export default PendingPaymentsSection;