import React, { useState, useEffect, useMemo } from 'react';
import {
  FiDollarSign, FiUser, FiPhone, FiClock, FiCalendar,
  FiEye, FiDownload, FiFilter, FiSearch, FiX,
  FiMessageSquare, FiFileText, FiCreditCard, FiCheck,
  FiAlertCircle, FiTrendingUp, FiBarChart2, FiRefreshCw,
  FiSend, FiPrinter, FiMail, FiBell,
  FiCheckCircle, FiFile, FiArchive, FiPercent
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import { getPendingPayments, receiveServicePayment, getWallets, getPendingPaymentsHistory } from '@/services/serviceService';

const role = localStorage.getItem("role");

const isStaff = role === "staff";
const isAdmin = role === "admin";
const isSuperadmin = role === "superadmin";

// Error Boundary Component
class ErrorBoundary extends React.Component {
  state = { hasError: false };

  static getDerivedStateFromError(error) {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error in PendingPayments:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="p-6 text-center">
          <h3 className="text-lg font-bold text-red-600">Something went wrong</h3>
          <p className="text-gray-600">Please try refreshing the page or contact support.</p>
        </div>
      );
    }
    return this.props.children;
  }
}

const formatDate = (date) => {
  if (!date) return "—";
  const d = new Date(date);
  return isNaN(d) ? "—" : d.toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
};

// Stat Card Component
const StatCard = ({ title, value, icon: Icon, color, subtitle, trend }) => (
  <motion.div
    whileHover={{ y: -2 }}
    className="bg-white rounded-xl border border-gray-200 p-6 hover:shadow-lg transition-all duration-300"
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-medium text-gray-600 mb-1">{title}</p>
        <p className="text-2xl font-bold text-gray-900 mb-1">{value}</p>
        <p className="text-sm text-gray-500">{subtitle}</p>
        {trend !== undefined && (
          <p className={`text-xs font-medium ${trend > 0 ? 'text-emerald-600' : trend < 0 ? 'text-rose-600' : 'text-gray-600'}`}>
            {trend > 0 ? '+' : ''}{trend}% from last month
          </p>
        )}
      </div>
      <div className={`p-3 rounded-xl ${color}`}>
        <Icon className="h-6 w-6 text-white" />
      </div>
    </div>
  </motion.div>
);

// Service Entry Detail Modal
const PendingPaymentDetailModal = ({ isOpen, onClose, serviceEntry }) => {
  if (!serviceEntry) return null;

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Service Entry Details</h3>
                <p className="text-sm text-gray-600">ID: {serviceEntry.id}</p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FiX className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Customer Info */}
              <div className="lg:col-span-2 space-y-6">
                <div className="bg-gray-50 rounded-lg p-6">
                  <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <FiUser className="h-4 w-4" />
                    Customer Information
                  </h4>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-gray-600">Name</p>
                      <p className="font-medium">{serviceEntry.customer.name}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Phone</p>
                      <a 
                        href={`tel:${serviceEntry.customer.phone}`}
                        className="font-medium text-indigo-600 hover:text-indigo-800"
                      >
                        {serviceEntry.customer.phone}
                      </a>
                    </div>
                  </div>
                </div>

                {/* Service Details */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <FiCheckCircle className="h-4 w-4" />
                    Service Details
                  </h4>
                  <div className="space-y-4">
                    <div className="flex justify-between">
                      <span className="text-gray-600">Service Type</span>
                      <span className="font-medium">{serviceEntry.service.type}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Subcategory</span>
                      <span className="font-medium">{serviceEntry.service.subcategory}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Description</span>
                      <span className="font-medium">{serviceEntry.service.description}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Service Date</span>
                     <span className="font-medium">{formatDate(serviceEntry.createdAt)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-600">Due Since</span>
                      <span className="font-medium text-rose-600">
                        {Math.floor(
                          (Date.now() - new Date(serviceEntry.createdAt)) /
                          (1000 * 60 * 60 * 24)
                        )} days
                      </span>
                    </div>
                  </div>
                </div>

                {/* Workflow & Notes */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <FiMessageSquare className="h-4 w-4" />
                    Workflow & Notes
                  </h4>
                  <div className="space-y-3">
                    {serviceEntry.notes?.map((note, index) => (
                      <div key={index} className="flex items-start space-x-3 p-3 bg-white rounded border border-gray-200">
                        <div className="flex-shrink-0 w-2 h-2 bg-indigo-500 rounded-full mt-2"></div>
                        <div className="flex-1">
                          <p className="text-sm">{note.text}</p>
                          <p className="text-xs text-gray-500 mt-1">{note.date}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Payment History & Documents */}
              <div className="space-y-6">
                {/* Latest Payment (formerly Payment History) */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <FiCreditCard className="h-4 w-4" />
                    Latest Payment
                  </h4>
                  <div className="space-y-3">
                    {serviceEntry.paymentHistory?.length > 0 ? (
                      // Since backend returns only the latest payment per chain, we show the first (and only) entry.
                      <div className="border-b border-gray-200 pb-3">
                        <div className="flex justify-between items-start">
                          <div>
                            <span className="text-sm font-medium">{serviceEntry.paymentHistory[0].date}</span>
                            <p className="text-xs text-gray-500">{serviceEntry.paymentHistory[0].method}</p>
                          </div>
                          <span className="text-sm font-bold text-emerald-600">
                            ₹{serviceEntry.paymentHistory[0].amount.toLocaleString('en-IN')}
                          </span>
                        </div>
                        {serviceEntry.paymentHistory[0].remarks && (
                          <p className="text-xs text-gray-600 mt-1">{serviceEntry.paymentHistory[0].remarks}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-gray-500">No payment recorded yet</p>
                    )}
                  </div>
                </div>

                {/* Documents */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <FiFileText className="h-4 w-4" />
                    Documents
                  </h4>
                  <div className="space-y-2">
                    {serviceEntry.documents?.map((doc, index) => (
                      <div key={index} className="flex items-center justify-between p-2 hover:bg-white rounded border border-gray-200">
                        <div className="flex items-center space-x-2">
                          <FiFile className="h-4 w-4 text-gray-500" />
                          <span className="text-sm">{doc.name}</span>
                        </div>
                        <button className="text-indigo-600 hover:text-indigo-800 text-sm p-1">
                          <FiDownload className="h-4 w-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Summary */}
                <div className="bg-gray-50 rounded-lg p-6">
                  <h4 className="font-semibold text-gray-900 mb-4 flex items-center gap-2">
                    <FiBarChart2 className="h-4 w-4" />
                    Payment Summary
                  </h4>
                  <div className="space-y-2">
                    <div className="flex justify-between py-2">
                      <span className="text-gray-600">Total Amount</span>
                      <span className="font-bold">₹{serviceEntry.total.toLocaleString('en-IN')}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-gray-600">Amount Paid</span>
                      <span className="font-bold text-emerald-600">
                        ₹{serviceEntry.paid.toLocaleString('en-IN')}
                      </span>
                    </div>
                    <div className="flex justify-between py-2 border-t border-gray-300 pt-3">
                      <span className="text-gray-600 font-semibold">Balance Due</span>
                      <span className="font-bold text-rose-600">
                        ₹{serviceEntry.due.toLocaleString('en-IN')}
                      </span>
                    </div>
                    {serviceEntry.total > 0 && (
                      <div className="mt-3 pt-3 border-t border-gray-300">
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-gray-600">Payment Progress</span>
                          <span className="text-sm font-medium">
                            {Math.round((serviceEntry.paid / serviceEntry.total) * 100)}%
                          </span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-2 mt-1">
                          <div 
                            className="bg-emerald-600 h-2 rounded-full"
                            style={{ width: `${(serviceEntry.paid / serviceEntry.total) * 100}%` }}
                          ></div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className="flex space-x-3 mt-6 pt-6 border-t border-gray-200">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Close
              </button>
              <button
                onClick={() => {
                  // In real app, this would trigger receive payment modal
                  alert('Redirecting to receive payment...');
                  onClose();
                }}
                className="flex-1 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
              >
                Record Payment
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// Receive Payment Modal
const ReceivePaymentModal = ({ isOpen, onClose, onSuccess, payment, wallets }) => {
  const [formData, setFormData] = useState({
    amount: payment?.due || 0,
    wallet: '',
    paymentMethod: 'cash',
    remarks: '',
    receiptNumber: `REC-${Date.now().toString().slice(-6)}`,
    date: new Date().toISOString().split('T')[0]
  });

const handleSubmit = async () => {
  try {
    await receiveServicePayment(payment.id, {
      amount: formData.amount,
      wallet_id: formData.wallet,
      payment_method: formData.paymentMethod,
      remarks: formData.remarks
    });

    alert("Payment recorded successfully");
    onSuccess();
    onClose();

  } catch (err) {
    alert(err.response?.data?.error || "Payment failed");
  }
};

  const paymentMethods = [
    { value: 'cash', label: 'Cash' },
    { value: 'upi', label: 'UPI' },
    { value: 'bank_transfer', label: 'Bank Transfer' },
    { value: 'credit_card', label: 'Credit Card' },
    { value: 'debit_card', label: 'Debit Card' },
    { value: 'cheque', label: 'Cheque' },
    { value: 'other', label: 'Other' }
  ];

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white rounded-xl p-6 max-w-md w-full"
          >
            <div className="flex items-center justify-between mb-6">
              <div>
                <h3 className="text-lg font-bold text-gray-900">Receive Payment</h3>
                <p className="text-sm text-gray-600">
                  {payment?.customer?.name} • {payment?.id}
                </p>
              </div>
              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <FiX className="h-5 w-5 text-gray-600" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Payment Summary */}
              <div className="bg-gray-50 rounded-lg p-4">
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Total Amount:</span>
                  <span className="font-bold">₹{payment?.total?.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between mb-2">
                  <span className="text-gray-600">Already Paid:</span>
                  <span className="text-emerald-600 font-bold">₹{payment?.paid?.toLocaleString('en-IN')}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-gray-300">
                  <span className="text-gray-700 font-semibold">Balance Due:</span>
                  <span className="text-rose-600 font-bold text-lg">
                    ₹{payment?.due?.toLocaleString('en-IN')}
                  </span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Amount (₹)
                </label>
                <input
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData(prev => ({ 
                    ...prev, 
                    amount: Math.min(parseFloat(e.target.value) || 0, payment?.due || 0)
                  }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  max={payment?.due || 0}
                />
                <p className="text-xs text-gray-500 mt-1">
                  Maximum: ₹{payment?.due?.toLocaleString('en-IN') || 0}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Payment Date
                  </label>
                  <input
                    type="date"
                    value={formData.date}
                    onChange={(e) => setFormData(prev => ({ ...prev, date: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Receipt No.
                  </label>
                  <input
                    type="text"
                    value={formData.receiptNumber}
                    onChange={(e) => setFormData(prev => ({ ...prev, receiptNumber: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Payment Method
                </label>
                <select
                  value={formData.paymentMethod}
                  onChange={(e) => setFormData(prev => ({ ...prev, paymentMethod: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  {paymentMethods.map(method => (
                    <option key={method.value} value={method.value}>
                      {method.label}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Credit to Wallet
                </label>
                <select
                  value={formData.wallet}
                  onChange={(e) =>
                    setFormData(prev => ({ ...prev, wallet: e.target.value }))
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select wallet</option>
                  {wallets.map(w => (
                    <option key={w.id} value={w.id}>
                      {w.name} - ₹{Number(w.balance).toLocaleString('en-IN')}
                    </option>
                  ))}
                  {wallets.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">
                    No wallets available
                  </p>
                )}
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Remarks
                </label>
                <textarea
                  value={formData.remarks}
                  onChange={(e) => setFormData(prev => ({ ...prev, remarks: e.target.value }))}
                  rows={3}
                  placeholder="Add any remarks about this payment..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                />
              </div>
            </div>

            <div className="flex space-x-3 mt-6">
              <button
                onClick={onClose}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmit}
                disabled={!formData.amount || formData.amount <= 0}
                className="flex-1 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Record Payment
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

// Get status badge color
const getStatusBadge = (status, createdAt) => {
  if (status === 'overdue' || isOverdue(createdAt)) {
    return 'bg-rose-100 text-rose-800 border border-rose-200';
  }

  switch (status) {
    case 'pending':
      return 'bg-amber-100 text-amber-800 border border-amber-200';
    case 'partially_paid':
      return 'bg-blue-100 text-blue-800 border border-blue-200';
    default:
      return 'bg-gray-100 text-gray-800 border border-gray-200';
  }
};

const isOverdue = (createdAt, days = 7) => {
  if (!createdAt) return false;
  const diffDays =
    (Date.now() - new Date(createdAt)) / (1000 * 60 * 60 * 24);
  return diffDays > days;
};

const PendingPayments = () => {
  const [pendingPayments, setPendingPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState('all');
  const [selectedService, setSelectedService] = useState(null);
  const [showServiceModal, setShowServiceModal] = useState(false);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [showPaymentModal, setShowPaymentModal] = useState(false);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [wallets, setWallets] = useState([]);
  const [stats, setStats] = useState({
    totalDue: 0,
    overdueCount: 0,
    pendingCount: 0,
    averageDue: 0,
    totalReceivables: 0,
    collectionRate: 0
  });

  // Filtered payments - now includes sorting by due descending
  const filteredPayments = useMemo(() => {
    let filtered = [...pendingPayments];

    // Search filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(payment =>
        payment.customer.name.toLowerCase().includes(query) ||
        payment.customer.phone.includes(query) ||
        payment.service.type.toLowerCase().includes(query) ||
        String(payment.id).includes(query)  // Fixed: convert id to string
      );
    }

    // Date filter
    if (fromDate || toDate) {
      filtered = filtered.filter(payment => {
        const paymentDate = new Date(payment.createdAt);
        const from = fromDate ? new Date(fromDate) : null;
        const to = toDate ? new Date(toDate) : null;
        
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
    if (filter === 'overdue') {
      filtered = filtered.filter(payment =>
        isOverdue(payment.createdAt)
      );
    } else if (filter === 'pending') {
      filtered = filtered.filter(payment => payment.paid === 0);
    } else if (filter === 'partially_paid') {
      filtered = filtered.filter(payment => payment.paid > 0 && payment.due > 0);
    }

    // Sort by due amount descending (highest pending first)
    filtered.sort((a, b) => b.due - a.due);

    return filtered;
  }, [pendingPayments, searchQuery, filter, fromDate, toDate]);

const fetchPendingPayments = async () => {
  try {
    setLoading(true);
    console.log("Fetching pending payments with filter:", filter);

    const response =
      filter === "history"
        ? await getPendingPaymentsHistory()
        : await getPendingPayments();

    console.log("API Response received:", response);

    const rows = Array.isArray(response?.data)
      ? response.data
      : Array.isArray(response)
        ? response
        : [];

    console.log(`Processing ${rows.length} rows`);
    
    const normalized = normalizePayments(rows);
    console.log("Normalized payments:", normalized);
    setPendingPayments(normalized);

    // Calculate stats
    if (rows.length > 0) {
      console.log("Calculating stats from", rows.length, "rows");
      
      const totalDue = rows.reduce((sum, row) => {
        const pending = Number(row.pending_amount || 0);
        return sum + pending;
      }, 0);

      const totalReceivables = rows.reduce((sum, row) => {
        return sum + Number(row.total_charges || 0);
      }, 0);

      const overdueCount = rows.filter(row => {
        if (!row.created_at) return false;
        const createdDate = new Date(row.created_at);
        const diffDays = (Date.now() - createdDate.getTime()) / (1000 * 60 * 60 * 24);
        return diffDays > 7;
      }).length;

      const pendingCount = rows.filter(row => {
        const paid = Number(row.paid_amount || 0);
        return paid === 0;
      }).length;

      const paidTotal = rows.reduce((sum, row) => {
        return sum + Number(row.paid_amount || 0);
      }, 0);

      const collectionRate = totalReceivables > 0 
        ? Math.round((paidTotal / totalReceivables) * 100)
        : 0;

      console.log("Calculated stats:", {
        totalDue,
        totalReceivables,
        overdueCount,
        pendingCount,
        collectionRate
      });

      setStats({
        totalDue,
        overdueCount,
        pendingCount,
        averageDue: rows.length > 0 ? totalDue / rows.length : 0,
        totalReceivables,
        collectionRate
      });
    } else {
      console.log("No rows found, resetting stats");
      setStats({
        totalDue: 0,
        overdueCount: 0,
        pendingCount: 0,
        averageDue: 0,
        totalReceivables: 0,
        collectionRate: 0
      });
    }

  } catch (err) {
    console.error("Pending payments fetch error:", err);
    alert("Failed to load payments: " + (err.response?.data?.error || err.message));
  } finally {
    setLoading(false);
  }
};

  // Fetch pending payments on mount or filter change
  useEffect(() => {
    fetchPendingPayments();
  }, [filter]);

  // Wallets Dropdown
  useEffect(() => {
    if (showPaymentModal) {
      getWallets().then(res => setWallets(res.data));
    }
  }, [showPaymentModal]);

  // Update stats when filtered payments change
  useEffect(() => {
    if (filteredPayments.length > 0) {
      const totalDue = filteredPayments.reduce((sum, p) => sum + p.due, 0);
      const totalReceivables = filteredPayments.reduce((sum, p) => sum + p.total, 0);
      const overdueCount = filteredPayments.filter(p => 
        isOverdue(p.createdAt)
      ).length;
      const pendingCount = filteredPayments.filter(p => p.paid === 0).length;
      const paidTotal = filteredPayments.reduce((sum, p) => sum + p.paid, 0);
      const collectionRate = totalReceivables > 0 
        ? Math.round((paidTotal / totalReceivables) * 100)
        : 0;

      setStats({
        totalDue,
        overdueCount,
        pendingCount,
        averageDue: filteredPayments.length > 0 ? totalDue / filteredPayments.length : 0,
        totalReceivables,
        collectionRate
      });
    }
  }, [filteredPayments]);

  // Handle view service details
  const handleViewService = async (payment) => {
    try {
      setSelectedService(payment);
      setShowServiceModal(true);
    } catch (error) {
      console.error('Error fetching service details:', error);
      alert('Failed to load service details');
    }
  };

  // Handle receive payment
  const handleReceivePayment = (payment) => {
    setSelectedPayment(payment);
    setShowPaymentModal(true);
  };

  // Handle send reminder
  const handleSendReminder = async (payment) => {
    try {
      // Create WhatsApp message
      const message = `Dear ${payment.customer.name},\n\nThis is a reminder for your pending payment of ₹${payment.due} for service ${payment.id}.\n\nPlease make the payment at your earliest convenience.\n\nThank you!`;
      const whatsappLink = `https://wa.me/${payment.customer.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`;
      
      // Open WhatsApp in new tab
      window.open(whatsappLink, '_blank');
      
      // Log reminder
      // await mockAPI.sendReminder(payment.id);
      alert(`WhatsApp reminder opened for ${payment.customer.name}`);
      
    } catch (error) {
      console.error('Error sending reminder:', error);
      alert('Failed to send reminder');
    }
  };

  // Handle payment success
  const handlePaymentSuccess = () => {
    fetchPendingPayments(); // Refresh the list
    alert('Payment recorded successfully!');
  };

const normalizePayments = (rows = []) =>
  rows.map(r => {
    const total = Number(r.total_charges || 0);
    const paid = Number(r.paid_amount || 0);
    const due  = Number(r.pending_amount || 0);

    let status = "pending";
    if (paid > 0 && due > 0) status = "partially_paid";
    if (due === 0 && paid >= total) status = "completed";

    return {
      // Use service_entry_id as the primary id
      id: String(r.service_entry_id),

      customer: {
        name: r.customer_name || "Unknown Customer",
        phone: r.customer_phone || ""
      },

      service: {
        type: r.service_name || "—",
        subcategory: r.subcategory_name || "",
        description: r.description || ""
      },

      total,
      paid,
      due,
      createdAt: r.created_at,
      status,

      // Payment history (now an array, but usually contains latest)
      paymentHistory: Array.isArray(r.payment_history)
        ? r.payment_history.map(p => ({
            id: p.id,
            amount: Number(p.amount),
            status: p.status,
            method: p.wallet_name || "—",
            date: formatDate(p.created_at),
            remarks:
              p.status === "received"
                ? "Payment received"
                : "Pending payment"
          }))
        : [],

      notes: r.notes || [],
      documents: r.documents || []
    };
  });

  // Calculate payment progress
  const calculatePaymentProgress = () => {
    if (pendingPayments.length === 0) return 0;
    const total = pendingPayments.reduce((sum, p) => sum + p.total, 0);
    const paid = pendingPayments.reduce((sum, p) => sum + p.paid, 0);
    return total > 0 ? Math.round((paid / total) * 100) : 0;
  };

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-30">
          <div className="max-w-7xl mx-auto px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-4">
                <div className="w-10 h-10 bg-indigo-500 rounded-xl flex items-center justify-center">
                  <FiDollarSign className="h-5 w-5 text-white" />
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">Pending Payments</h1>
                  <p className="text-gray-600">Manage customer payments and due amounts</p>
                </div>
              </div>
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => {
                    fetchPendingPayments();
                    alert("Refreshing data...");
                  }}
                  className="flex items-center space-x-2 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <FiRefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
                <button 
                  onClick={() => alert('Export functionality would be implemented here')}
                  className="flex items-center space-x-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
                >
                  <FiDownload className="h-4 w-4" />
                  <span>Export</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="max-w-7xl mx-auto px-6 py-8">
          {/* Stats Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
            <StatCard
              title="Total Receivables"
              value={`₹${stats.totalReceivables.toLocaleString('en-IN')}`}
              subtitle="Sum of all service amounts"
              icon={FiBarChart2}
              color="bg-purple-500"
            />
            <StatCard
              title="Pending Amount"
              value={`₹${stats.totalDue.toLocaleString('en-IN')}`}
              subtitle="Balance to be collected"
              icon={FiDollarSign}
              color="bg-rose-500"
            />
            <StatCard
              title="Pending Services"
              value={stats.pendingCount}
              subtitle="Services awaiting payment"
              icon={FiAlertCircle}
              color="bg-amber-500"
            />
            <StatCard
              title="Overdue"
              value={stats.pendingCount}
              subtitle="Past due date"
              icon={FiClock}
              color="bg-red-500"
            />
            <StatCard
              title="Collection Rate"
              value={`${stats.collectionRate}%`}
              subtitle="Amount collected"
              icon={FiPercent}
              color="bg-emerald-500"
            />
          </div>

          {/* Collection Progress */}
          <div className="bg-white rounded-xl border border-gray-200 p-6 mb-6">
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
              <span>₹{pendingPayments.reduce((sum, p) => sum + p.paid, 0).toLocaleString('en-IN')} Collected</span>
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
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    className="border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  >
                    <option value="all">All Payments</option>
                    <option value="overdue">Overdue Only</option>
                    <option value="pending">Unpaid Only</option>
                    <option value="partially_paid">Partially Paid</option>
                    <option value="history">Cleared Pending History</option>
                  </select>
                </div>
                {/* Date Filter */}
                <div className="flex flex-wrap items-center gap-3">
                  <div className="relative">
                    <FiCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="date"
                      value={fromDate}
                      onChange={(e) => setFromDate(e.target.value)}
                      className="pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm w-full lg:w-auto"
                    />
                  </div>
                  <span className="text-gray-500">to</span>
                  <div className="relative">
                    <FiCalendar className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                      type="date"
                      value={toDate}
                      onChange={(e) => setToDate(e.target.value)}
                      className="pl-10 pr-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm w-full lg:w-auto"
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      onClick={fetchPendingPayments}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
                    >
                      Apply
                    </button>
                    <button
                      onClick={() => {
                        setFromDate('');
                        setToDate('');
                        fetchPendingPayments();
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
                  onClick={() => alert('Bulk reminders would be implemented here')}
                  className="flex items-center space-x-2 px-4 py-2 bg-emerald-600 text-white rounded-lg hover:bg-emerald-700 transition-colors"
                >
                  <FiSend className="h-4 w-4" />
                  <span>Bulk Reminders</span>
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
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan="8" className="py-12 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600 mb-4"></div>
                          <p className="text-gray-600">Loading pending payments...</p>
                        </div>
                      </td>
                    </tr>
                  ) : filteredPayments.length > 0 ? (
                    filteredPayments.map((payment) => {
                      const overdue = isOverdue(payment.createdAt);
                      return (
                        <tr 
                          key={payment.id} 
                          className={`border-b border-gray-200 hover:bg-gray-50 transition-colors ${overdue ? 'bg-rose-50 hover:bg-rose-100' : ''}`}
                        >
                          {/* Customer Cell - Clickable */}
                          <td className="py-4 px-4">
                            <button
                              onClick={() => handleViewService(payment)}
                              className="text-left hover:text-indigo-600 transition-colors group"
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
                                <div>
                                  <p className="font-medium text-gray-900 group-hover:text-indigo-600">
                                    {payment.customer.name}
                                  </p>
                                  <p className="text-xs text-gray-500">ID: {payment.id}</p>
                                </div>
                              </div>
                            </button>
                          </td>
                          
                          {/* Phone Cell - WhatsApp Link */}
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
                              <span>{payment.customer.phone}</span>
                            </a>
                          </td>
                          
                          {/* Service */}
                          <td className="py-4 px-4">
                            <div>
                              <p className="font-medium text-gray-900">{payment.service.type}</p>
                              <p className="text-xs text-gray-500 truncate max-w-xs">
                                {payment.service.subcategory}
                              </p>
                            </div>
                          </td>
                          
                          {/* Total */}
                          <td className="py-4 px-4">
                            <p className="font-bold text-gray-900">
                              ₹{payment.total.toLocaleString('en-IN')}
                            </p>
                          </td>
                          
                          {/* Paid */}
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
                          
                          {/* Due - Highlighted */}
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
                          
                          {/* Due Since */}
                          <td className="py-4 px-4">
                            <div className="flex items-center space-x-2">
                              <FiCalendar className={`h-4 w-4 ${overdue ? 'text-rose-500' : 'text-amber-500'}`} />
                              <div>
                                <span>{formatDate(payment.createdAt)}</span>
                                {overdue && (
                                  <p className="text-xs text-rose-500 mt-0.5">Overdue</p>
                                )}
                              </div>
                            </div>
                          </td>
                          
                          {/* Actions */}
                          <td className="py-4 px-4">
                            <div className="flex items-center space-x-1">
                              {/* View Button */}
                              <button
                                onClick={() => handleViewService(payment)}
                                className="p-2 text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors group"
                                title="View Service Details"
                              >
                                <FiEye className="h-4 w-4 group-hover:scale-110 transition-transform" />
                              </button>
                              
                              {/* Receive Payment Button */}
                              <button
                                onClick={() => handleReceivePayment(payment)}
                                className="p-2 text-emerald-600 hover:bg-emerald-50 rounded-lg transition-colors group"
                                title="Receive Payment"
                                disabled={payment.due === 0}
                              >
                                <FiCreditCard className={`h-4 w-4 group-hover:scale-110 transition-transform ${payment.due === 0 ? 'opacity-50' : ''}`} />
                              </button>
                              
                              {/* Send Reminder Button */}
                              <button
                                onClick={() => handleSendReminder(payment)}
                                className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors group"
                                title="Send WhatsApp Reminder"
                              >
                                <FiSend className="h-4 w-4 group-hover:scale-110 transition-transform" />
                              </button>

                              {/* Additional action for overdue */}
                              {overdue && (
                                <button
                                  onClick={() => alert('Priority action for overdue payment')}
                                  className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors group"
                                  title="Mark as High Priority"
                                >
                                  <FiBell className="h-4 w-4 group-hover:scale-110 transition-transform" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  ) : (
                    <tr>
                      <td colSpan="8" className="py-12 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <FiFileText className="h-16 w-16 text-gray-300 mb-4" />
                          <p className="text-gray-500 text-lg font-medium mb-2">
                            {searchQuery || filter !== 'all'
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
                      <span className="font-medium">{pendingPayments.length}</span> pending payments
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
          <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h4 className="font-semibold text-gray-900 mb-4">Payment Distribution</h4>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Fully Paid</span>
                  <span className="font-medium text-emerald-600">
                    {pendingPayments.filter(p => p.due === 0).length} services
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Partially Paid</span>
                  <span className="font-medium text-blue-600">
                    {pendingPayments.filter(p => p.paid > 0 && p.due > 0).length} services
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Unpaid</span>
                  <span className="font-medium text-amber-600">
                    {pendingPayments.filter(p => p.paid === 0).length} services
                  </span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h4 className="font-semibold text-gray-900 mb-4">Top Due Amounts</h4>
              <div className="space-y-3">
                {pendingPayments
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
                  onClick={() => alert('Send reminders to all overdue customers')}
                  className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <span className="text-gray-700">Send Bulk Reminders</span>
                  <FiSend className="h-4 w-4 text-blue-600" />
                </button>
                <button 
                  onClick={() => alert('Generate monthly report')}
                  className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <span className="text-gray-700">Generate Report</span>
                  <FiFileText className="h-4 w-4 text-purple-600" />
                </button>
                <button 
                  onClick={() => alert('View collection analytics')}
                  className="w-full flex items-center justify-between p-3 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  <span className="text-gray-700">View Analytics</span>
                  <FiBarChart2 className="h-4 w-4 text-indigo-600" />
                </button>
              </div>
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
          onSuccess={handlePaymentSuccess}
          payment={selectedPayment}
          wallets={wallets}
        />
      </div>
    </ErrorBoundary>
  );
};

export default PendingPayments;
