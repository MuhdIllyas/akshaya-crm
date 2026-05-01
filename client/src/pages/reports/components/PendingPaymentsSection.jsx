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
  FiTrendingUp as FiTrendingUpIcon, FiTrendingDown as FiTrendingDownIcon,
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

// Pending Payments Stat Card
const PendingPaymentsStatCard = ({ title, value, icon: Icon, color, subtitle, trend, onClick, compact = false }) => (
  <motion.div
    whileHover={{ y: -2 }}
    className={`bg-white rounded-xl border border-gray-200 hover:shadow-lg transition-all duration-300 cursor-pointer ${
      compact ? 'p-4' : 'p-6'
    }`}
    onClick={onClick}
  >
    <div className="flex items-center justify-between">
      <div className={`${compact ? 'w-4/5' : ''}`}>
        <p className={`font-medium text-gray-600 mb-1 ${compact ? 'text-xs' : 'text-sm'}`}>{title}</p>
        <p className={`font-bold text-gray-900 mb-1 ${compact ? 'text-lg' : 'text-2xl'}`}>{value}</p>
        <p className={`text-gray-500 ${compact ? 'text-xs' : 'text-sm'}`}>{subtitle}</p>
        {trend !== undefined && (
          <p className={`text-xs font-medium ${trend > 0 ? 'text-emerald-600' : trend < 0 ? 'text-rose-600' : 'text-gray-600'}`}>
            {trend > 0 ? '+' : ''}{trend}% from last month
          </p>
        )}
      </div>
      <div className={`rounded-xl ${color} ${compact ? 'p-2' : 'p-3'}`}>
        <Icon className={`text-white ${compact ? 'h-4 w-4' : 'h-6 w-6'}`} />
      </div>
    </div>
  </motion.div>
);

// ==========================================
// 1. SERVICE DETAIL MODAL
// ==========================================
const PendingPaymentDetailModal = ({ isOpen, onClose, serviceEntry }) => {
  if (!serviceEntry) return null;

  // Format date helper
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-xl p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Service Details</h3>
                <p className="text-sm text-gray-600">ID: {serviceEntry.id} • Staff: {serviceEntry.staff?.name}</p>
              </div>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                <FiX className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            <div className="space-y-6">
              {/* Customer & Service Info */}
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Customer Name</p>
                  <p className="font-semibold text-gray-900">{serviceEntry.customer.name}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Phone Number</p>
                  <p className="font-semibold text-gray-900">{serviceEntry.customer.phone}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Service Type</p>
                  <p className="font-semibold text-gray-900">{serviceEntry.service.type}</p>
                </div>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="text-sm text-gray-500 mb-1">Subcategory</p>
                  <p className="font-semibold text-gray-900">{serviceEntry.service.subcategory || "—"}</p>
                </div>
              </div>

              {/* Financials */}
              <div className="border border-gray-200 rounded-lg p-4">
                <h4 className="font-bold text-gray-900 mb-3 border-b pb-2">Financial Summary</h4>
                <div className="flex justify-between py-1">
                  <span className="text-gray-600">Total Amount</span>
                  <span className="font-bold text-gray-900">₹{serviceEntry.total.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1">
                  <span className="text-gray-600">Amount Paid</span>
                  <span className="font-bold text-emerald-600">₹{serviceEntry.paid.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between py-1 border-t mt-2 pt-2">
                  <span className="font-bold text-gray-900">Balance Due</span>
                  <span className="font-bold text-rose-600 text-lg">₹{serviceEntry.due.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Payment History */}
              <div>
                <h4 className="font-bold text-gray-900 mb-3">Payment History</h4>
                {serviceEntry.paymentHistory && serviceEntry.paymentHistory.length > 0 ? (
                  <div className="space-y-3">
                    {serviceEntry.paymentHistory.map((ph, idx) => (
                      <div key={idx} className="flex justify-between items-center p-3 bg-gray-50 rounded-lg border border-gray-100">
                        <div>
                          <p className="font-medium text-gray-900">{formatDate(ph.created_at)}</p>
                          <p className="text-xs text-gray-500">{ph.wallet_name || 'Wallet'}</p>
                        </div>
                        <span className="font-bold text-emerald-600">+₹{Number(ph.amount).toLocaleString('en-IN')}</span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-sm text-gray-500 italic">No payments recorded yet.</p>
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

  // Fetch wallets when modal opens
  useEffect(() => {
    if (isOpen && payment) {
      setFormData(prev => ({ ...prev, amount: payment.due })); // Auto-fill due amount
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
      onSuccess(); // Refresh table
      onClose();   // Close modal
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
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="bg-white rounded-xl p-6 max-w-md w-full"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-gray-900">Receive Payment</h3>
              <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                <FiX className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            <div className="bg-rose-50 p-3 rounded-lg mb-4 flex justify-between items-center border border-rose-100">
              <span className="text-rose-800 font-medium">Balance Due</span>
              <span className="text-rose-800 font-bold text-xl">₹{payment.due.toLocaleString('en-IN')}</span>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Collection Amount (₹)</label>
                <input
                  type="number"
                  max={payment.due}
                  value={formData.amount}
                  onChange={(e) => setFormData(prev => ({ ...prev, amount: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Credit to Wallet</label>
                <select
                  value={formData.wallet}
                  onChange={(e) => setFormData(prev => ({ ...prev, wallet: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select a wallet...</option>
                  {wallets.map(w => (
                    <option key={w.id} value={w.id}>{w.name}</option>
                  ))}
                </select>
              </div>

              <div className="pt-4 flex space-x-3">
                <button onClick={onClose} className="flex-1 px-4 py-2 border rounded-lg text-gray-700 hover:bg-gray-50">
                  Cancel
                </button>
                <button 
                  onClick={handleSubmit} 
                  disabled={loading || !formData.amount || !formData.wallet}
                  className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 flex justify-center items-center"
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

  const payments = isSuperAdmin ? externalPayments : pendingPayments;
  const isLoading = isSuperAdmin ? externalLoading : loading;

  const activeFilter = isSuperAdmin ? externalFilter : filter;
  const setActiveFilter = isSuperAdmin ? setExternalFilter : setFilter;

  const activeFromDate = isSuperAdmin ? externalFromDate : fromDate;
  const setActiveFromDate = isSuperAdmin ? setExternalFromDate : setFromDate;

  const activeToDate = isSuperAdmin ? externalToDate : toDate;
  const setActiveToDate = isSuperAdmin ? setExternalToDate : setToDate;

  // Format date function
  const formatDate = (date) => {
    if (!date) return "—";
    const d = new Date(date);
    return isNaN(d) ? "—" : d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // Check if payment is overdue
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

      // ✅ ADD THIS
      staff: {
        id: r.staff_id || null,
        name: r.staff_name || "—"
      },

      total: Number(r.total_charges || 0),
      paid: Number(r.paid_amount || 0),
      due: Number(r.pending_amount || 0),

      createdAt: r.created_at,
      paymentHistory: Array.isArray(r.payment_history)
        ? r.payment_history
        : []
    }));
  };

  const fetchPendingPayments = async () => {
    try {
      setLoading(true);

      const response =
        filter === "history"
          ? await getPendingPaymentsHistory({
              from: fromDate,
              to: toDate
            })
          : await getPendingPayments({
              from: fromDate,
              to: toDate
            });

      const rows = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response)
          ? response
          : [];

      const normalized = normalizePayments(rows);

      setPendingPayments(normalized);

      // ✅ update stats here (important)
      setStats({
        totalReceivables: normalized.reduce((s, p) => s + p.total, 0),
        totalDue: normalized.reduce((s, p) => s + p.due, 0),
        pendingCount: normalized.filter(p => p.due > 0).length,
        overdueCount: normalized.filter(p => isOverdue(p.createdAt)).length,
        averageDue:
          normalized.length > 0
            ? Math.round(
                normalized.reduce((s, p) => s + p.due, 0) /
                normalized.length
              )
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

  const filteredPayments = useMemo(() => {
    let filtered = [...payments];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(payment =>
        payment.customer.name.toLowerCase().includes(query) ||
        payment.customer.phone.includes(query) ||
        payment.service.type.toLowerCase().includes(query) ||
        payment.id.includes(query)
      );
    }

    // Date filter - FIXED: Use activeFromDate and activeToDate
    if (activeFromDate || activeToDate) {
      filtered = filtered.filter(payment => {
        const paymentDate = new Date(payment.createdAt);
        const from = activeFromDate ? new Date(activeFromDate) : null;
        const to = activeToDate ? new Date(activeToDate) : null;
        
        let include = true;
        if (from) {
          include = include && paymentDate >= from;
        }
        if (to) {
          const toEndOfDay = new Date(to);
          toEndOfDay.setHours(23, 59, 59, 999);
          include = include && paymentDate <= toEndOfDay;
        }
        return include;
      });
    }

    // Status filter
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

  return (
    <div className="space-y-6">
      {/* Stats Cards */}
      <div className={`grid gap-3 mb-6 ${
        isMobile ? 'grid-cols-2' : 
        'grid-cols-2 md:grid-cols-4'
      }`}>
        <PendingPaymentsStatCard
          title="Total Receivables"
          value={`₹${stats.totalReceivables.toLocaleString('en-IN')}`}
          subtitle="Sum of all service amounts"
          icon={FiBarChart2}
          color="bg-purple-500"
          compact={isMobile}
        />
        <PendingPaymentsStatCard
          title="Pending Amount"
          value={`₹${stats.totalDue.toLocaleString('en-IN')}`}
          subtitle="Balance to be collected"
          icon={FiDollarSign}
          color="bg-rose-500"
          compact={isMobile}
        />
        <PendingPaymentsStatCard
          title="Pending Services"
          value={stats.pendingCount}
          subtitle="Services awaiting payment"
          icon={FiAlertCircle}
          color="bg-amber-500"
          compact={isMobile}
        />
        <PendingPaymentsStatCard
          title="Overdue"
          value={stats.overdueCount}
          subtitle="Past due date"
          icon={FiClock}
          color="bg-red-500"
          compact={isMobile}
        />
      </div>

      {/* Collection Progress */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-semibold text-gray-900">Payment Collection Progress</h3>
          <span className="text-sm font-medium">{calculatePaymentProgress()}%</span>
        </div>
        <div className="w-full bg-gray-200 rounded-full h-3">
          <div 
            className="bg-gradient-to-r from-emerald-500 to-emerald-600 h-3 rounded-full"
            style={{ width: `${calculatePaymentProgress()}%` }}
          ></div>
        </div>
        <div className="flex justify-between text-sm text-gray-600 mt-2">
          <span>₹{payments.reduce((sum, p) => sum + p.paid, 0).toLocaleString('en-IN')} Collected</span>
          <span>₹{stats.totalReceivables.toLocaleString('en-IN')} Total</span>
        </div>
      </div>

      {/* Filters and Search */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-6">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between space-y-4 lg:space-y-0">
          <div className="flex flex-col lg:flex-row lg:items-center lg:space-x-4 space-y-4 lg:space-y-0">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search by customer, phone, service, or ID..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 w-full lg:w-80"
              />
            </div>
            <div className="flex items-center space-x-2">
              <FiFilter className="h-4 w-4 text-gray-500" />
              <select
                value={activeFilter}  // FIXED: Use activeFilter
                onChange={(e) => setActiveFilter(e.target.value)}  // FIXED: Use setActiveFilter
                className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                <option value="all">All Payments</option>
                <option value="overdue">Overdue Only</option>
                <option value="pending">Unpaid Only</option>
                <option value="partially_paid">Partially Paid</option>
                <option value="history">Cleared History</option>
              </select>
            </div>
            {/* Date Filter - FIXED: Use active date variables */}
            <div className="flex flex-wrap items-center gap-3">
              <div className="relative">
                <FiCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="date"
                  value={activeFromDate}  // FIXED: Use activeFromDate
                  onChange={(e) => setActiveFromDate(e.target.value)}  // FIXED: Use setActiveFromDate
                  className="pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm w-full lg:w-auto"
                />
              </div>
              <span className="text-gray-500">to</span>
              <div className="relative">
                <FiCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="date"
                  value={activeToDate}  // FIXED: Use activeToDate
                  onChange={(e) => setActiveToDate(e.target.value)}  // FIXED: Use setActiveToDate
                  className="pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm w-full lg:w-auto"
                />
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => {
                    if (!isSuperAdmin) fetchPendingPayments();
                  }}
                  className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                >
                  Apply
                </button>
                <button
                  onClick={() => {
                    setActiveFromDate('');  // FIXED: Clear active dates
                    setActiveToDate('');
                    if (!isSuperAdmin) fetchPendingPayments();
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors text-sm font-medium"
                >
                  Clear
                </button>
              </div>
            </div>
          </div>
          <div className="flex items-center space-x-3">
            <button 
              onClick={() => {
                if (!isSuperAdmin) fetchPendingPayments();
              }}
              className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <FiRefreshCw className={`h-4 w-4 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
          </div>
        </div>
      </div>

      {/* Payments Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200 bg-gray-50">
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Phone
                </th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Service
                </th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Total (₹)
                </th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Paid (₹)
                </th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due (₹)
                </th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Due Since
                </th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Staff
                </th>
                <th className="py-3 px-4 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan="9" className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                      <p className="text-gray-600">Loading pending payments...</p>
                    </div>
                  </td>
                </tr>
              ) : filteredPayments.length > 0 ? (
                filteredPayments.map((payment) => (
                  <tr key={payment.id} className={`border-b border-gray-200 hover:bg-gray-50 transition-colors ${isOverdue(payment.createdAt) ? 'bg-rose-50 hover:bg-rose-100' : ''}`}>
                    <td className="py-4 px-4">
                      <button
                        onClick={() => setSelectedService(payment)}
                        className="text-left hover:text-indigo-600 transition-colors group w-full"
                      >
                        <div className="flex items-center space-x-3">
                          <div className="w-8 h-8 bg-blue-900 rounded-full flex items-center justify-center">
                            <span className="text-white font-bold text-xs">
                              {(payment.customer.name || "U")
                                .split(' ')
                                .filter(Boolean)
                                .map(n => n[0])
                                .join('')
                              }
                            </span>
                          </div>
                          <div className="text-left">
                            <p className="font-medium text-gray-900 group-hover:text-indigo-600 truncate">
                              {payment.customer.name}
                            </p>
                            <p className="text-xs text-gray-500">ID: {payment.id}</p>
                          </div>
                        </div>
                      </button>
                    </td>
                    <td className="py-4 px-4">
                      <a
                        href={`https://wa.me/${payment.customer.phone.replace(/\D/g, '')}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center space-x-2 text-gray-600 hover:text-emerald-600 transition-colors group"
                      >
                        <div className="p-1.5 bg-emerald-50 rounded-lg group-hover:bg-emerald-100">
                          <FiPhone className="h-3.5 w-3.5" />
                        </div>
                        <span className="text-sm">{payment.customer.phone}</span>
                      </a>
                    </td>
                    <td className="py-4 px-4">
                      <div>
                        <p className="font-medium text-gray-900 text-sm">{payment.service.type}</p>
                        <p className="text-xs text-gray-500 truncate max-w-xs">
                          {payment.service.subcategory}
                        </p>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <p className="font-bold text-gray-900">
                        ₹{payment.total.toLocaleString('en-IN')}
                      </p>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-2">
                        <div className={`p-1.5 rounded-lg ${payment.paid > 0 ? 'bg-emerald-50' : 'bg-gray-100'}`}>
                          <FiCreditCard className={`h-3.5 w-3.5 ${payment.paid > 0 ? 'text-emerald-600' : 'text-gray-400'}`} />
                        </div>
                        <p className={`font-medium ${payment.paid > 0 ? 'text-emerald-600' : 'text-gray-500'}`}>
                          ₹{payment.paid.toLocaleString('en-IN')}
                        </p>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-2">
                        <div className={`p-1.5 rounded-lg ${payment.due > 0 ? 'bg-rose-50' : 'bg-emerald-50'}`}>
                          <FiAlertCircle className={`h-3.5 w-3.5 ${payment.due > 0 ? 'text-rose-600' : 'text-emerald-600'}`} />
                        </div>
                        <p className={`font-bold ${payment.due > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>
                          ₹{payment.due.toLocaleString('en-IN')}
                        </p>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-2">
                        <FiCalendar className={`h-4 w-4 ${isOverdue(payment.createdAt) ? 'text-rose-500' : 'text-amber-500'}`} />
                        <div>
                          <span className="text-sm">{formatDate(payment.createdAt)}</span>
                          {isOverdue(payment.createdAt) && (
                            <p className="text-xs text-rose-500 mt-0.5">Overdue</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>{payment.staff.name}</td>
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-1">
                        <button
                          onClick={() => setSelectedService(payment)}
                          className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors group"
                          title="View Details"
                        >
                          <FiEye className="h-4 w-4 group-hover:scale-110 transition-transform" />
                        </button>
                        <button
                          onClick={() => setSelectedPayment(payment)}
                          className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors group"
                          title="Receive Payment"
                          disabled={payment.due === 0}
                        >
                          <FiCreditCard className={`h-4 w-4 group-hover:scale-110 transition-transform ${payment.due === 0 ? 'opacity-50' : ''}`} />
                        </button>
                        <button
                          onClick={() => {
                            const message = `Dear ${payment.customer.name},\n\nThis is a reminder for your pending payment of ₹${payment.due} for service ${payment.id}.\n\nPlease make the payment at your earliest convenience.\n\nThank you!`;
                            const whatsappLink = `https://wa.me/${payment.customer.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
                            window.open(whatsappLink, '_blank');
                          }}
                          className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors group"
                          title="Send WhatsApp Reminder"
                        >
                          <FiMail className="h-4 w-4 group-hover:scale-110 transition-transform" />
                        </button>
                        {isOverdue(payment.createdAt) && (
                          <button
                            onClick={() => {
                              // toast.info(`Marked ${payment.customer.name}'s payment as high priority`);
                            }}
                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors group"
                            title="Mark as High Priority"
                          >
                            <FiBell className="h-4 w-4 group-hover:scale-110 transition-transform" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="py-12 text-center">
                    <div className="flex flex-col items-center justify-center">
                      <FiFileText className="h-16 w-16 text-gray-300 mb-4" />
                      <p className="text-gray-500 text-lg font-medium mb-2">
                        {searchQuery || activeFilter !== 'all'
                          ? 'No matching payments found'
                          : 'No pending payments'}
                      </p>
                      {searchQuery && (
                        <button
                          onClick={() => setSearchQuery('')}
                          className="text-indigo-600 hover:text-indigo-800 text-sm"
                        >
                          Clear search
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Summary Footer */}
        {filteredPayments.length > 0 && (
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-600">
                  Showing <span className="font-medium">{filteredPayments.length}</span> of{' '}
                  <span className="font-medium">{payments.length}</span> pending payments
                </p>
                <p className="text-sm text-gray-600 mt-1">
                  Total due amount: <span className="font-bold text-rose-600">
                    ₹{filteredPayments.reduce((sum, p) => sum + p.due, 0).toLocaleString('en-IN')}
                  </span>
                </p>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">Showing all records</span>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Quick Stats */}
      <div className={`mt-8 grid gap-6 ${
        isMobile ? 'grid-cols-1' : 
        'grid-cols-1 md:grid-cols-3'
      }`}>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Payment Distribution</h4>
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Fully Paid</span>
              <span className="font-medium text-emerald-600">
                {payments.filter(p => p.due === 0).length} services
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Partially Paid</span>
              <span className="font-medium text-blue-600">
                {payments.filter(p => p.paid > 0 && p.due > 0).length} services
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Unpaid</span>
              <span className="font-medium text-amber-600">
                {payments.filter(p => p.paid === 0).length} services
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Top Due Amounts</h4>
          <div className="space-y-3">
            {payments
              .sort((a, b) => b.due - a.due)
              .slice(0, 3)
              .map(payment => (
                <div key={payment.id} className="flex justify-between items-center py-2 border-b border-gray-100">
                  <div>
                    <p className="text-sm font-medium text-gray-900">{payment.customer.name}</p>
                    <p className="text-xs text-gray-500">{payment.service.type}</p>
                  </div>
                  <span className="font-bold text-rose-600">
                    ₹{payment.due.toLocaleString('en-IN')}
                  </span>
                </div>
              ))
            }
          </div>
        </div>

        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h4 className="font-semibold text-gray-900 mb-4">Quick Actions</h4>
          <div className="space-y-3">
            <button 
              onClick={() => {
                const overduePayments = payments.filter(p => isOverdue(p.createdAt));
                if (overduePayments.length === 0) {
                  // toast.info('No overdue payments to send reminders');
                  return;
                }
                // toast.success(`Reminders sent to ${overduePayments.length} customers`);
              }}
              className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <span className="text-gray-700">Send Bulk Reminders</span>
              <FiMail className="h-4 w-4 text-blue-600" />
            </button>
            <button 
              onClick={() => {
                // toast.info('Report generation would be implemented here');
              }}
              className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <span className="text-gray-700">Generate Report</span>
              <FiFileText className="h-4 w-4 text-purple-600" />
            </button>
            <button 
              onClick={() => {
                if (!isSuperAdmin) fetchPendingPayments();
              }}
              className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <span className="text-gray-700">Refresh Data</span>
              <FiRefreshCw className="h-4 w-4 text-indigo-600" />
            </button>
          </div>
        </div>
      </div>
      {/* Modals */}
      <PendingPaymentDetailModal
        isOpen={showServiceModal}
        onClose={() => {
          setShowServiceModal(false);
          setSelectedService(null);
        }}
        serviceEntry={selectedService}
      />

      <ReceivePaymentModal
        isOpen={showPaymentModal}
        onClose={() => {
          setShowPaymentModal(false);
          setSelectedPayment(null);
        }}
        onSuccess={() => {
          if (!isSuperAdmin) fetchPendingPayments();
          // Note: For superadmin, triggering a re-render/refetch 
          // usually happens automatically if they change the date/filter,
          // but you can also alert("Payment received, please refresh");
        }}
        payment={selectedPayment}
      />
    </div>
  );
};

export default PendingPaymentsSection;