import React, { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  FiPlus,
  FiDollarSign,
  FiCalendar,
  FiFileText,
  FiDownload,
  FiUser,
  FiCheck,
  FiX,
  FiClock,
  FiRefreshCw,
  FiTrash2,
  FiTrendingUp,
  FiAlertCircle,
  FiPackage,
  FiDatabase,
  FiSettings,
  FiUsers,
  FiDroplet,
  FiTool,
  FiCreditCard,
  FiSmartphone,
  FiHome,
  FiBriefcase,
} from "react-icons/fi";
import {
  getCentreExpenses,
  approveExpense,
  rejectExpense,
  correctExpense,
  deleteExpense,
  createExpense,
} from "@/services/expenseService";
import { getWalletsForCentre } from "@/services/walletService";
import AdminExpenseEntry from "./AdminExpenseEntry";

const AdminExpenseManagement = () => {
  // -------------------- State --------------------
  const [expenses, setExpenses] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showCorrectModal, setShowCorrectModal] = useState(false);
  const [correctingExpense, setCorrectingExpense] = useState(null);

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedWallet, setSelectedWallet] = useState("all");

  // Correction form
  const [correctionForm, setCorrectionForm] = useState({
    amount: "",
    wallet_id: "",
    reason: "",
  });

  // Future analysis visibility
  const [showFutureAnalysis, setShowFutureAnalysis] = useState(false);

  // -------------------- Categories & Statuses --------------------
  const categories = [
    { id: 1, name: "Salary Advance", color: "#3B82F6", icon: "💰", requires_approval: true },
    { id: 2, name: "Rent Payment", color: "#10B981", icon: "🏠", requires_approval: true },
    { id: 3, name: "Electricity Bill", color: "#EF4444", icon: "⚡", requires_approval: false },
    { id: 4, name: "Maintenance", color: "#F59E0B", icon: "🔧", requires_approval: false },
    { id: 5, name: "Ink Purchase", color: "#8B5CF6", icon: "🖨️", requires_approval: false },
    { id: 6, name: "Paper Purchase", color: "#8B5CF6", icon: "📄", requires_approval: false },
    { id: 7, name: "Internet Bill", color: "#EC4899", icon: "🌐", requires_approval: false },
    { id: 9, name: "Transportation", color: "#14B8A6", icon: "🚗", requires_approval: false },
    { id: 10, name: "Office Supplies", color: "#84CC16", icon: "📦", requires_approval: false },
    { id: 11, name: "Cleaning Supplies", color: "#84CC16", icon: "🧹", requires_approval: false },
    { id: 12, name: "Stationery", color: "#84CC16", icon: "✏️", requires_approval: false },
    { id: 13, name: "Other Expenses", color: "#6B7280", icon: "📝", requires_approval: false },
  ];

  const statuses = [
    { id: "pending", name: "Pending", color: "bg-yellow-100 text-yellow-800" },
    { id: "approved", name: "Approved", color: "bg-green-100 text-green-800" },
    { id: "rejected", name: "Rejected", color: "bg-red-100 text-red-800" },
    { id: "paid", name: "Paid", color: "bg-blue-100 text-blue-800" },
    { id: "auto_approved", name: "Auto Approved", color: "bg-purple-100 text-purple-800" },
  ];

  const paymentMethods = [
    { id: "cash", name: "Cash", icon: "💰" },
    { id: "bank_transfer", name: "Bank Transfer", icon: "🏦" },
    { id: "cheque", name: "Cheque", icon: "📝" },
    { id: "online", name: "Online Payment", icon: "💳" },
  ];

  const WALLET_TYPE_META = {
    bank: { label: "Bank Account", icon: "🏦", color: "text-blue-600", bg: "bg-blue-50" },
    cash: { label: "Cash", icon: "💰", color: "text-green-600", bg: "bg-green-50" },
    credit_card: { label: "Credit Card", icon: "💳", color: "text-purple-600", bg: "bg-purple-50" },
    digital: { label: "Digital Wallet", icon: "📱", color: "text-indigo-600", bg: "bg-indigo-50" },
    savings: { label: "Savings", icon: "🏧", color: "text-teal-600", bg: "bg-teal-50" },
  };

  const getWalletMeta = (wallet) => {
    const type = wallet.type || wallet.wallet_type;
    return WALLET_TYPE_META[type] || {
      label: "Wallet", icon: "💼", color: "text-gray-600", bg: "bg-gray-50",
    };
  };
  const getCategoryById = (id) => categories.find((c) => c.id === id);

  // -------------------- Data loading --------------------
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    try {
      const [expenseData, walletData] = await Promise.all([
        getCentreExpenses(),
        getWalletsForCentre(),
      ]);
      setExpenses(expenseData);
      setWallets(walletData);
    } catch (err) {
      toast.error("Failed to load expenses or wallets");
    } finally {
      setLoading(false);
    }
  };

  // -------------------- Filtering --------------------
  const filteredExpenses = useMemo(() => {
    return expenses.filter((expense) => {
      if (searchQuery) {
        const q = searchQuery.toLowerCase();
        if (
          !expense.description?.toLowerCase().includes(q) &&
          !expense.receipt_number?.toLowerCase().includes(q) &&
          !expense.category?.toLowerCase().includes(q) &&
          !expense.remarks?.toLowerCase().includes(q) &&
          !expense.wallet_name?.toLowerCase().includes(q)
        )
          return false;
      }
      if (selectedCategory !== "all" && expense.category_id !== parseInt(selectedCategory))
        return false;
      if (selectedStatus !== "all" && expense.status !== selectedStatus)
        return false;
      if (selectedWallet !== "all" && expense.wallet_id !== parseInt(selectedWallet))
        return false;
      if (selectedMonth && selectedYear) {
        const expDate = new Date(expense.expense_date);
        if (expDate.getMonth() + 1 !== selectedMonth || expDate.getFullYear() !== selectedYear)
          return false;
      }
      return true;
    });
  }, [expenses, searchQuery, selectedCategory, selectedStatus, selectedWallet, selectedMonth, selectedYear]);

  // -------------------- Stats --------------------
  const stats = useMemo(() => {
    const totalAmount = filteredExpenses.reduce((sum, e) => sum + Number(e.amount || 0), 0);
    const pendingCount = filteredExpenses.filter((e) => e.status === "pending").length;
    const approvedCount = filteredExpenses.filter(
      (e) => e.status === "approved" || e.status === "auto_approved"
    ).length;
    const rejectedCount = filteredExpenses.filter((e) => e.status === "rejected").length;
    return { totalAmount, pendingCount, approvedCount, rejectedCount, totalCount: filteredExpenses.length };
  }, [filteredExpenses]);

  // -------------------- Future Payments Prediction --------------------
  const futureProjections = useMemo(() => {
    const recurringExpenses = expenses.filter((e) => e.is_recurring && e.recurrence_type !== "none");
    const now = new Date();
    const projections = [];
    recurringExpenses.forEach((exp) => {
      const lastDate = new Date(exp.expense_date);
      const interval = exp.recurrence_type; // monthly, quarterly, yearly
      let nextDate = new Date(lastDate);
      // Advance at least one period
      do {
        if (interval === "monthly") nextDate.setMonth(nextDate.getMonth() + 1);
        if (interval === "quarterly") nextDate.setMonth(nextDate.getMonth() + 3);
        if (interval === "yearly") nextDate.setFullYear(nextDate.getFullYear() + 1);
      } while (nextDate <= now);

      // Generate next 6 occurrences
      for (let i = 0; i < 6; i++) {
        projections.push({
          expense_id: exp.id,
          description: exp.description,
          category: exp.category,
          amount: exp.amount,
          due_date: new Date(nextDate).toISOString().slice(0, 10),
          wallet_name: exp.wallet_name,
        });
        if (interval === "monthly") nextDate.setMonth(nextDate.getMonth() + 1);
        if (interval === "quarterly") nextDate.setMonth(nextDate.getMonth() + 3);
        if (interval === "yearly") nextDate.setFullYear(nextDate.getFullYear() + 1);
      }
    });
    projections.sort((a, b) => new Date(a.due_date) - new Date(b.due_date));
    return projections;
  }, [expenses]);

  const futureTotal = futureProjections.reduce((sum, p) => sum + Number(p.amount || 0), 0);

  // -------------------- Actions --------------------
  const handleApprove = async (id) => {
    try {
      await approveExpense(id);
      toast.success("Expense approved");
      loadAllData();
    } catch (err) {
      toast.error(err.response?.data?.error || "Approval failed");
    }
  };

  const handleReject = async (id) => {
    try {
      await rejectExpense(id);
      toast.success("Expense rejected");
      loadAllData();
    } catch (err) {
      toast.error(err.response?.data?.error || "Rejection failed");
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm("Delete this expense? Only pending expenses can be deleted.")) return;
    try {
      await deleteExpense(id);
      toast.success("Expense deleted");
      loadAllData();
    } catch (err) {
      toast.error(err.response?.data?.error || "Delete failed");
    }
  };

  const openCorrectModal = (expense) => {
    setCorrectingExpense(expense);
    setCorrectionForm({
      amount: expense.amount.toString(),
      wallet_id: expense.wallet_id.toString(),
      reason: "",
    });
    setShowCorrectModal(true);
  };

  const handleCorrectExpense = async (e) => {
    e.preventDefault();
    if (!correctionForm.amount || !correctionForm.wallet_id) {
      toast.error("Please fill amount and select a wallet");
      return;
    }
    try {
      await correctExpense(correctingExpense.id, {
        amount: Number(correctionForm.amount),
        wallet_id: Number(correctionForm.wallet_id),
        reason: correctionForm.reason || "Admin correction",
      });
      toast.success("Expense corrected successfully");
      setShowCorrectModal(false);
      loadAllData();
    } catch (err) {
      toast.error(err.response?.data?.error || "Correction failed");
    }
  };

  const handleAddExpenseSubmit = async (payload) => {
    try {
      await createExpense(payload);
      toast.success("Expense created and auto-approved");
      setShowAddModal(false);
      loadAllData();
    } catch (err) {
      toast.error(err.response?.data?.error || "Creation failed");
    }
  };

  // -------------------- Export CSV --------------------
  const exportToCSV = () => {
    const csvContent = [
      ["Date", "Category", "Description", "Amount", "Wallet", "Status", "Receipt", "Remarks"],
      ...filteredExpenses.map((e) => [
        e.expense_date,
        e.category,
        e.description,
        e.amount,
        e.wallet_name,
        e.status,
        e.receipt_number,
        e.remarks,
      ]),
    ]
      .map((row) => row.join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `expenses_${selectedMonth}_${selectedYear}.csv`;
    a.click();
    toast.success("Expenses exported");
  };

  // -------------------- Formatters --------------------
  const formatCurrency = (amount) =>
    new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
    }).format(amount || 0);

  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const d = new Date(dateString);
    return isNaN(d) ? "-" : d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
  };

  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  const years = Array.from({ length: 5 }, (_, i) => new Date().getFullYear() - i);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 sm:p-6">
      <ToastContainer />
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 pb-4 border-b border-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Expense Manager</h1>
            <p className="text-gray-600 mt-1">
              Full centre expense oversight, corrections, and future payment forecasting
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowAddModal(true)}
            className="mt-4 md:mt-0 bg-[#1e3a5f] hover:bg-[#172a45] text-white font-medium px-4 py-2.5 rounded-xl flex items-center transition-all duration-300 shadow-md hover:shadow-lg"
          >
            <FiPlus className="mr-2" />
            Add New Expense
          </motion.button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <div className="rounded-2xl shadow-lg p-5 border border-blue-200 bg-gradient-to-br from-blue-100 to-blue-50">
            <div className="flex items-center">
              <FiDollarSign className="text-3xl text-blue-600 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Total Expenses (Filtered)</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalAmount)}</p>
                <p className="text-xs text-gray-500">{stats.totalCount} entries</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl shadow-lg p-5 border border-yellow-200 bg-gradient-to-br from-yellow-100 to-yellow-50">
            <div className="flex items-center">
              <FiClock className="text-3xl text-yellow-600 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Pending Approval</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pendingCount}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl shadow-lg p-5 border border-green-200 bg-gradient-to-br from-green-100 to-green-50">
            <div className="flex items-center">
              <FiCheck className="text-3xl text-green-600 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Approved / Auto-Approved</p>
                <p className="text-2xl font-bold text-gray-900">{stats.approvedCount}</p>
              </div>
            </div>
          </div>

          <div className="rounded-2xl shadow-lg p-5 border border-indigo-200 bg-gradient-to-br from-indigo-100 to-indigo-50">
            <div className="flex items-center">
              <FiTrendingUp className="text-3xl text-indigo-600 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Future Recurring (6m)</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(futureTotal)}</p>
                <button
                  onClick={() => setShowFutureAnalysis(!showFutureAnalysis)}
                  className="text-xs text-indigo-600 underline hover:text-indigo-800"
                >
                  {showFutureAnalysis ? "Hide Analysis" : "View Details"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="bg-white p-5 rounded-2xl shadow-lg border border-gray-100 mb-8">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Month</label>
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {months.map((m, idx) => (
                  <option key={idx} value={idx + 1}>{m}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Year</label>
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(parseInt(e.target.value))}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                {years.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
              <select
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Categories</option>
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Wallet</label>
              <select
                value={selectedWallet}
                onChange={(e) => setSelectedWallet(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Wallets</option>
                {wallets.map((w) => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                {statuses.map((s) => (
                  <option key={s.id} value={s.id}>{s.name}</option>
                ))}
              </select>
            </div>
          </div>
          <div className="mt-4 flex flex-col md:flex-row gap-4 items-center">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Search by description, receipt, remarks..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <svg className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              onClick={exportToCSV}
              className="px-4 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-medium flex items-center"
            >
              <FiDownload className="mr-2" />
              Export CSV
            </motion.button>
          </div>
        </div>

        {/* Future Payments Analysis */}
        <AnimatePresence>
          {showFutureAnalysis && (
            <motion.div
              initial={{ opacity: 0, y: -20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="bg-white p-5 rounded-2xl shadow-lg border border-gray-100 mb-8"
            >
              <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
                <FiTrendingUp className="mr-2 h-5 w-5 text-indigo-600" />
                Projected Recurring Payments (Next 6 Months)
              </h3>
              {futureProjections.length === 0 ? (
                <p className="text-gray-600">No recurring expenses found.</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="text-left px-4 py-2">Due Date</th>
                        <th className="text-left px-4 py-2">Description</th>
                        <th className="text-left px-4 py-2">Category</th>
                        <th className="text-right px-4 py-2">Amount</th>
                        <th className="text-left px-4 py-2">Wallet</th>
                      </tr>
                    </thead>
                    <tbody>
                      {futureProjections.map((p, i) => (
                        <tr key={i} className="border-t border-gray-100 hover:bg-gray-50">
                          <td className="px-4 py-2">{p.due_date}</td>
                          <td className="px-4 py-2">{p.description}</td>
                          <td className="px-4 py-2">{p.category}</td>
                          <td className="px-4 py-2 text-right font-medium">{formatCurrency(p.amount)}</td>
                          <td className="px-4 py-2">{p.wallet_name}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <div className="mt-3 text-right font-semibold text-gray-700">
                    Total Projected Outflow: {formatCurrency(futureTotal)}
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Expenses Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <h2 className="text-lg font-semibold text-gray-800">Expense Entries</h2>
            <span className="text-sm text-gray-600">
              Showing {filteredExpenses.length} of {expenses.length} total entries
            </span>
          </div>

          {filteredExpenses.length === 0 ? (
            <div className="text-center py-12">
              <FiFileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">No expenses found</h3>
              <p className="mt-2 text-gray-600">Try adjusting your filters or add a new expense.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date & Details</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Amount & Wallet</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Staff</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {filteredExpenses.map((expense) => {
                    const category = getCategoryById(expense.category_id);
                    const wallet = wallets.find((w) => w.id === expense.wallet_id);
                    const statusObj = statuses.find((s) => s.id === expense.status);
                    const canApprove = expense.status === "pending";
                    const canCorrect = expense.status !== "pending";
                    const canDelete = expense.status === "pending";

                    return (
                      <tr key={expense.id} className="hover:bg-gray-50">
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <span className="text-xl mr-3">{category?.icon || "📝"}</span>
                            <div>
                              <p className="font-medium text-gray-900">{expense.description}</p>
                              <div className="flex items-center gap-2 text-sm text-gray-600 mt-1">
                                <FiCalendar className="h-4 w-4" />
                                {formatDate(expense.expense_date)}
                                <span className="px-2 py-0.5 rounded-full text-xs font-medium"
                                  style={{ backgroundColor: category?.color + "20", color: category?.color }}>
                                  {expense.category}
                                </span>
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <p className="text-2xl font-bold text-gray-900">{formatCurrency(expense.amount)}</p>
                          <div className="flex items-center mt-1">
                            <span className="text-lg mr-2">{getWalletMeta(wallet).icon}</span>
                            <span className="text-sm text-gray-700">{expense.wallet_name}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${statusObj?.color}`}>
                            {statusObj?.name}
                          </span>
                          {expense.requires_approval && (
                            <div className="mt-1 text-xs text-yellow-600">👑 Requires Approval</div>
                          )}
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            <FiUser className="h-4 w-4 mr-1 text-gray-500" />
                            <span className="text-sm">{expense.staff_name || "N/A"}</span>
                          </div>
                        </td>
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-2">
                            {canApprove && (
                              <>
                                <button onClick={() => handleApprove(expense.id)} className="text-green-600 hover:text-green-800" title="Approve">
                                  <FiCheck size={20} />
                                </button>
                                <button onClick={() => handleReject(expense.id)} className="text-red-600 hover:text-red-800" title="Reject">
                                  <FiX size={20} />
                                </button>
                              </>
                            )}
                            {canCorrect && (
                              <button onClick={() => openCorrectModal(expense)} className="text-blue-600 hover:text-blue-800" title="Correct">
                                <FiRefreshCw size={20} />
                              </button>
                            )}
                            {canDelete && (
                              <button onClick={() => handleDelete(expense.id)} className="text-red-600 hover:text-red-800" title="Delete">
                                <FiTrash2 size={20} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Add Expense Modal */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <motion.div className="bg-white rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
              <AdminExpenseEntry
                title="Add New Expense"
                submitButtonText="Create Expense"
                wallets={wallets}
                categories={categories}
                onSubmit={handleAddExpenseSubmit}
                onCancel={() => setShowAddModal(false)}
                isLoading={loading}
              />
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Correction Modal */}
      <AnimatePresence>
        {showCorrectModal && correctingExpense && (
          <motion.div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <motion.div className="bg-white rounded-2xl shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto border border-gray-200">
              <div className="p-6 border-b border-gray-200">
                <h2 className="text-lg font-bold text-gray-900">Correct Expense</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Original: {correctingExpense.description} – {formatCurrency(correctingExpense.amount)} on {formatDate(correctingExpense.expense_date)}
                </p>
              </div>
              <form onSubmit={handleCorrectExpense} className="p-6 space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Amount (₹) *</label>
                  <input type="number" value={correctionForm.amount} onChange={(e) => setCorrectionForm(p => ({...p, amount: e.target.value}))} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" required min="0" step="0.01" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">New Wallet *</label>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {wallets.map((wallet) => (
                      <label key={wallet.id} className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer ${correctionForm.wallet_id === wallet.id.toString() ? 'border-blue-500 bg-blue-50' : 'border-gray-200'}`}>
                        <div className="flex items-center gap-2">
                          <input type="radio" name="correction_wallet" value={wallet.id.toString()} checked={correctionForm.wallet_id === wallet.id.toString()} onChange={(e) => setCorrectionForm(p => ({...p, wallet_id: e.target.value}))} className="sr-only" required />
                          <span className="text-xl">{getWalletMeta(wallet).icon}</span>
                          <div>
                            <p className="font-medium text-gray-900 text-sm">{wallet.name}</p>
                            <p className="text-xs text-gray-500">{getWalletMeta(wallet).label}</p>
                          </div>
                        </div>
                        <span className="text-sm font-semibold text-gray-700">{formatCurrency(wallet.currentBalance ?? wallet.balance)}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Reason for Correction</label>
                  <textarea value={correctionForm.reason} onChange={(e) => setCorrectionForm(p => ({...p, reason: e.target.value}))} className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500" rows="3" placeholder="Explain why..." />
                </div>
                <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                  <button type="button" onClick={() => setShowCorrectModal(false)} className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200">Cancel</button>
                  <button type="submit" className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2">
                    <FiRefreshCw className="h-4 w-4" /> Submit Correction
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

export default AdminExpenseManagement;
