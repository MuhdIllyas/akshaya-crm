import React, { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  FiPlus,
  FiDollarSign,
  FiCalendar,
  FiFileText,
  FiTag,
  FiCreditCard,
  FiSave,
  FiEdit2,
  FiTrash2,
  FiFilter,
  FiDownload,
  FiPrinter,
  FiUser,
  FiCheck,
  FiX,
  FiClock,
  FiCreditCard as FiWallet
} from "react-icons/fi";
import { createExpense , getMyExpenses , deleteExpense } from "@/services/expenseService";
import { getWalletsForCentre } from "@/services/walletService";

const ExpenseEntry = () => {

  // Hardcoded expense categories with approval requirement flag
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
    { id: 13, name: "Other Expenses", color: "#6B7280", icon: "📝", requires_approval: false }
  ];

  useEffect(() => {
  const loadData = async () => {
    try {
      setLoading(true);

      const walletsData = await getWalletsForCentre();
      setWallets(walletsData);

      const expenseData = await getMyExpenses();
      setExpenses(expenseData);
    } catch (err) {
      toast.error("Failed to load expenses or wallets");
    } finally {
      setLoading(false);
    }
  };

  loadData();
}, []);

  // State variables
  const [expenses, setExpenses] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [editingExpense, setEditingExpense] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("all");
  const [selectedStatus, setSelectedStatus] = useState("all");
  const [selectedMonth, setSelectedMonth] = useState(new Date().getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [selectedWallet, setSelectedWallet] = useState("all");
  const [wallets, setWallets] = useState([]);

  // Expense statuses (UI helper)
const statuses = [
  { id: "pending", name: "Pending", color: "bg-yellow-100 text-yellow-800" },
  { id: "approved", name: "Approved", color: "bg-green-100 text-green-800" },
  { id: "rejected", name: "Rejected", color: "bg-red-100 text-red-800" },
  { id: "paid", name: "Paid", color: "bg-blue-100 text-blue-800" },
  { id: "auto_approved", name: "Auto Approved", color: "bg-purple-100 text-purple-800" }
];

const WALLET_TYPE_META = {
    bank: {
      label: "Bank Account",
      icon: "🏦",
      color: "text-blue-600",
      bg: "bg-blue-50",
    },
    cash: {
      label: "Cash",
      icon: "💰",
      color: "text-green-600",
      bg: "bg-green-50",
    },
    credit_card: {
      label: "Credit Card",
      icon: "💳",
      color: "text-purple-600",
      bg: "bg-purple-50",
    },
    digital: {
      label: "Digital Wallet",
      icon: "📱",
      color: "text-indigo-600",
      bg: "bg-indigo-50",
    },
    savings: {
      label: "Savings",
      icon: "🏧",
      color: "text-teal-600",
      bg: "bg-teal-50",
    },
  };

const getWalletMeta = (wallet) => {
  const type = wallet.type || wallet.wallet_type;

  return WALLET_TYPE_META[type] || {
    label: "Wallet",
    icon: "💼",
    color: "text-gray-600",
    bg: "bg-gray-50",
  };
};

// Payment methods (UI only)
const paymentMethods = [
  { id: "cash", name: "Cash", icon: "💰" },
  { id: "bank_transfer", name: "Bank Transfer", icon: "🏦" },
  { id: "cheque", name: "Cheque", icon: "📝" },
  { id: "online", name: "Online Payment", icon: "💳" }
];
  
  // New expense form data
  const [newExpense, setNewExpense] = useState({
    category_id: "",
    amount: "",
    description: "",
    payment_method: "cash",
    wallet_id: "",
    expense_date: new Date().toISOString().split('T')[0],
    receipt_number: "",
    remarks: "",
    is_recurring: false,
    recurrence_type: "none",
    attachment: ""
  });

  // Calculate wallet balances based on expenses
  const walletBalances = wallets.reduce((acc, w) => {
    acc[w.id] = Number(w.balance);
    return acc;
  }, {});


  // Stats calculation
  const calculateStats = () => {
  const currentMonthExpenses = expenses.filter(exp => {
    if (!exp.expense_date) return false;

    const expenseDate = new Date(exp.expense_date);
    return (
      expenseDate.getMonth() + 1 === selectedMonth &&
      expenseDate.getFullYear() === selectedYear
    );
  });

  const totalAmount = currentMonthExpenses.reduce((sum, exp) => {
    const amount = Number(exp.amount);
    return sum + (isNaN(amount) ? 0 : amount);
  }, 0);

  const pendingCount = currentMonthExpenses.filter(exp => exp.status === "pending").length;
  const autoApprovedCount = currentMonthExpenses.filter(exp => exp.status === "auto_approved").length;
  const approvedCount = currentMonthExpenses.filter(exp => exp.status === "approved").length;
  const paidCount = currentMonthExpenses.filter(exp => exp.status === "paid").length;

  return {
    totalAmount,
    pendingCount,
    autoApprovedCount,
    approvedCount,
    paidCount,
    totalCount: currentMonthExpenses.length
  };
};

  const stats = calculateStats();

  // Filter expenses
  const filteredExpenses = expenses.filter(expense => {
    // Search query filter
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      const matchesSearch = 
        expense.description.toLowerCase().includes(query) ||
        expense.receipt_number.toLowerCase().includes(query) ||
        expense.category.toLowerCase().includes(query) ||
        expense.remarks.toLowerCase().includes(query) ||
        expense.wallet_name.toLowerCase().includes(query);
      if (!matchesSearch) return false;
    }

    // Category filter
    if (selectedCategory !== "all" && expense.category_id !== parseInt(selectedCategory)) {
      return false;
    }

    // Status filter
    if (selectedStatus !== "all" && expense.status !== selectedStatus) {
      return false;
    }

    // Wallet filter
    if (selectedWallet !== "all" && expense.wallet_id !== parseInt(selectedWallet)) {
      return false;
    }

    // Month filter
    const expenseDate = new Date(expense.expense_date);
    if (expenseDate.getMonth() + 1 !== selectedMonth || 
        expenseDate.getFullYear() !== selectedYear) {
      return false;
    }

    return true;
  });

  // Handle form input change
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setNewExpense(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Handle edit form input change
  const handleEditInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setEditingExpense(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Get category by ID
  const getCategoryById = (id) => {
    return categories.find(cat => cat.id === id);
  };

  // Handle add expense
const handleAddExpense = async (e) => {
  e.preventDefault();

  try {
    const categoryObj = categories.find(
      (c) => c.id === parseInt(newExpense.category_id)
    );

    if (!categoryObj) {
      toast.error("Invalid category selected");
      return;
    }

    const payload = {
      category: categoryObj.name,
      category_id: categoryObj.id,
      amount: Number(newExpense.amount),
      description: newExpense.description,
      payment_method: newExpense.payment_method,
      wallet_id: Number(newExpense.wallet_id),
      expense_date: newExpense.expense_date,
      receipt_number: newExpense.receipt_number,
      remarks: newExpense.remarks,
      requires_approval: categoryObj.requires_approval,
    };

    await createExpense(payload);

    toast.success(
      categoryObj.requires_approval
        ? "Expense submitted for admin approval"
        : "Expense auto-approved and wallet debited"
    );

    setShowAddModal(false);
    resetForm();

    // 🔁 Reload expenses + wallets
    const [updatedExpenses, updatedWallets] = await Promise.all([
      getMyExpenses(),
      getWalletsForCentre(),
    ]);

    setExpenses(updatedExpenses);
    setWallets(updatedWallets);
  } catch (err) {
    toast.error(err.response?.data?.error || "Failed to add expense");
  }
};


  // Handle edit expense
  const handleEditExpense = (e) => {
    e.preventDefault();
    
    const selectedCategoryObj = getCategoryById(parseInt(editingExpense.category_id));
    const selectedWalletObj = wallets.find(w => w.id === parseInt(editingExpense.wallet_id));
    
    if (!selectedWalletObj) {
      toast.error("Please select a wallet!");
      return;
    }

    // Determine status - if it was auto_approved before, keep it, otherwise set to pending
    const requiresApproval = selectedCategoryObj?.requires_approval || false;
    const status = requiresApproval ? "pending" : editingExpense.status === "auto_approved" ? "auto_approved" : "pending";
    const approvedBy = requiresApproval ? null : "System";
    const approvedDate = requiresApproval ? null : new Date().toISOString().split('T')[0];

    const updatedExpense = {
      ...editingExpense,
      category: selectedCategoryObj.name,
      category_id: editingExpense.category_id,
      amount: parseFloat(editingExpense.amount),
      wallet_name: selectedWalletObj.name,
      status: status,
      approved_date: approvedDate,
      approved_by: approvedBy,
      requires_approval: requiresApproval
    };

    setExpenses(expenses.map(exp => exp.id === updatedExpense.id ? updatedExpense : exp));
    setShowEditModal(false);
    setEditingExpense(null);
    
    if (requiresApproval) {
      toast.success("Expense updated and resubmitted for admin approval!");
    } else {
      toast.success("Expense updated and auto-approved!");
    }
  };

  // Handle delete expense
  const handleDeleteExpense = async (expenseId) => {
    if (!window.confirm("Are you sure you want to delete this expense?")) {
      return;
    }

    try {
      await deleteExpense(expenseId);
      toast.success("Expense deleted successfully");

      // Refresh list
      const updatedExpenses = await getMyExpenses();
      setExpenses(updatedExpenses);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to delete expense");
    }
  };

  // Reset form
  const resetForm = () => {
    setNewExpense({
      category_id: "",
      amount: "",
      description: "",
      payment_method: "cash",
      wallet_id: "",
      expense_date: new Date().toISOString().split('T')[0],
      receipt_number: "",
      remarks: "",
      is_recurring: false,
      recurrence_type: "none",
      attachment: ""
    });
  };

  // Open edit modal
  const openEditModal = (expense) => {
    // Only allow editing of pending or auto_approved expenses
    if (expense.status === "approved" || expense.status === "paid") {
      toast.info("Approved or paid expenses cannot be edited.");
      return;
    }
    setEditingExpense({...expense});
    setShowEditModal(true);
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  // Format date
  const formatDate = (dateString) => {
    if (!dateString) return "-";
    const d = new Date(dateString);
    return isNaN(d) ? "-" : d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  };

  // Get status icon
  const getStatusIcon = (status) => {
    switch(status) {
      case 'approved': return <FiCheck className="text-green-500" />;
      case 'rejected': return <FiX className="text-red-500" />;
      case 'pending': return <FiClock className="text-yellow-500" />;
      case 'paid': return <FiDollarSign className="text-blue-500" />;
      case 'auto_approved': return <FiCheck className="text-purple-500" />;
      default: return null;
    }
  };

  // Get payment method icon
  const getPaymentIcon = (method) => {
    const payment = paymentMethods.find(p => p.id === method);
    return payment ? payment.icon : '💵';
  };

  // Months for dropdown
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];

  // Generate years (last 3 years)
  const currentYear = new Date().getFullYear();
  const years = Array.from({ length: 3 }, (_, i) => currentYear - i);

  // Export expenses to CSV
  const exportToCSV = () => {
    const csvContent = [
      ["Date", "Category", "Description", "Amount", "Wallet", "Payment Method", "Receipt No", "Status", "Remarks"],
      ...filteredExpenses.map(exp => [
        exp.expense_date,
        exp.category,
        exp.description,
        exp.amount,
        exp.wallet_name,
        exp.payment_method,
        exp.receipt_number,
        exp.status,
        exp.remarks
      ])
    ].map(row => row.join(",")).join("\n");

    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `expenses_${selectedMonth}_${selectedYear}.csv`;
    a.click();
    toast.success("Expenses exported successfully!");
  };

  // Filter categories based on search in modal
  const [categorySearch, setCategorySearch] = useState("");
  const filteredCategories = categories.filter(category => 
    category.name.toLowerCase().includes(categorySearch.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 p-4 sm:p-6">
      <ToastContainer />
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 pb-4 border-b border-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Expense Entry - Staff Portal</h1>
            <p className="text-gray-600 mt-1">
              Enter and track your expense claims - {new Date().toLocaleDateString('en-IN', { 
                weekday: 'long', 
                year: 'numeric', 
                month: 'long', 
                day: 'numeric' 
              })}
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setShowAddModal(true)}
            className="mt-4 md:mt-0 bg-[#1e3a5f] hover:bg-[#172a45] text-white font-medium px-4 py-2.5 rounded-xl flex items-center transition-all duration-300 shadow-md hover:shadow-lg"
          >
            <FiPlus className="mr-2" />
            New Expense Entry
          </motion.button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <motion.div 
            className="rounded-2xl shadow-lg p-5 border border-blue-200 bg-gradient-to-br from-blue-100 to-blue-50"
            whileHover={{ y: -5, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)" }}
          >
            <div className="flex items-center">
              <FiDollarSign className="text-3xl text-blue-600 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Monthly Total</p>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(stats.totalAmount)}</p>
              </div>
            </div>
          </motion.div>

          <motion.div 
            className="rounded-2xl shadow-lg p-5 border border-yellow-200 bg-gradient-to-br from-yellow-100 to-yellow-50"
            whileHover={{ y: -5, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)" }}
          >
            <div className="flex items-center">
              <FiClock className="text-3xl text-yellow-600 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Pending Approval</p>
                <p className="text-2xl font-bold text-gray-900">{stats.pendingCount}</p>
              </div>
            </div>
          </motion.div>

          <motion.div 
            className="rounded-2xl shadow-lg p-5 border border-purple-200 bg-gradient-to-br from-purple-100 to-purple-50"
            whileHover={{ y: -5, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)" }}
          >
            <div className="flex items-center">
              <FiCheck className="text-3xl text-purple-600 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Auto Approved</p>
                <p className="text-2xl font-bold text-gray-900">{stats.autoApprovedCount}</p>
              </div>
            </div>
          </motion.div>

          <motion.div 
            className="rounded-2xl shadow-lg p-5 border border-green-200 bg-gradient-to-br from-green-100 to-green-50"
            whileHover={{ y: -5, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)" }}
          >
            <div className="flex items-center">
              <FiFileText className="text-3xl text-green-600 mr-3" />
              <div>
                <p className="text-sm text-gray-600">Total Entries</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalCount}</p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Wallet Balances */}
        <div className="bg-white p-5 rounded-2xl shadow-lg border border-gray-100 mb-8">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">Wallet Balances</h3>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {wallets.map(wallet => (
              <div key={wallet.id} className="border border-gray-100 rounded-xl p-4 bg-gray-50">
                <div className="flex items-center mb-2">
                  <span className="text-xl mr-2">{getWalletMeta(wallet).icon}</span>
                  <span className="font-medium text-gray-900">{wallet.name}</span>
                </div>
                <div className="text-xs text-gray-500 mt-1">{getWalletMeta(wallet).label}</div>
                <div className="text-sm text-gray-600">Balance:</div>
                <div className="text-lg font-bold text-gray-900">{formatCurrency(walletBalances[wallet.id])}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Filters & Actions */}
        <div className="bg-white p-5 rounded-2xl shadow-lg border border-gray-100 mb-8">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 flex-1">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Month</label>
                <select
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(parseInt(e.target.value))}
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  {months.map((month, index) => (
                    <option key={index} value={index + 1}>
                      {month}
                    </option>
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
                  {years.map(year => (
                    <option key={year} value={year}>{year}</option>
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
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name} {category.requires_approval ? '👑' : '✅'}
                    </option>
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
                  {wallets.map(wallet => (
                    <option key={wallet.id} value={wallet.id}>
                      {wallet.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="flex gap-3">
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

          <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Status</label>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">All Status</option>
                {statuses.map(status => (
                  <option key={status.id} value={status.id}>
                    {status.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Search expenses
              </label>
              <div className="relative">
                <input
                  type="text"
                  placeholder="Search by description, receipt, wallet..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <svg
                  className="absolute left-4 top-3.5 h-5 w-5 text-gray-400"
                  xmlns="http://www.w3.org/2000/svg"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                  />
                </svg>
              </div>
            </div>
          </div>

          <div className="mt-4 text-sm text-gray-600">
            <span className="font-medium">Legend:</span> 
            <span className="ml-3">👑 = Requires Admin Approval</span>
            <span className="ml-3">✅ = Auto Approved</span>
          </div>
        </div>

        {/* Expenses Table */}
        <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50">
            <div className="flex justify-between items-center">
              <h2 className="text-lg font-semibold text-gray-800">My Expense Entries</h2>
              <span className="text-sm text-gray-600">
                Showing {filteredExpenses.length} of {expenses.length} entries
              </span>
            </div>
          </div>

          {filteredExpenses.length === 0 ? (
            <div className="text-center py-12">
              <FiFileText className="mx-auto h-12 w-12 text-gray-400" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">No expenses found</h3>
              <p className="mt-2 text-gray-600">
                {searchQuery || selectedCategory !== "all" || selectedStatus !== "all"
                  ? "Try changing your filters or search query."
                  : "Get started by adding your first expense entry."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Date & Details
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Amount & Wallet
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status & Approval
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {filteredExpenses.map((expense) => {

                    const canDelete = expense.status === "pending" && expense.requires_approval === true;
                    
                    const status = statuses.find(s => s.id === expense.status);
                    const category = categories.find(c => c.id === expense.category_id);
                    const wallet = wallets.find(w => w.id === expense.wallet_id);
                    
                    return (
                      <tr key={expense.id} className="hover:bg-gray-50 transition-colors">
                        <td className="px-6 py-4">
                          <div>
                            <div className="flex items-center">
                              <span className="text-xl mr-3">{category?.icon || "📝"}</span>
                              <div>
                                <p className="font-medium text-gray-900">{expense.description}</p>
                                <div className="flex items-center gap-3 mt-1">
                                  <span className="text-sm text-gray-600 flex items-center">
                                    <FiCalendar className="mr-1 h-4 w-4" />
                                    {formatDate(expense.expense_date)}
                                  </span>
                                  <span className={`px-2.5 py-1 rounded-full text-xs font-medium`}
                                        style={{ 
                                          backgroundColor: `${category?.color}20`, 
                                          color: category?.color 
                                        }}>
                                    {expense.category}
                                    {category?.requires_approval ? ' 👑' : ''}
                                  </span>
                                </div>
                              </div>
                            </div>
                            
                            <div className="mt-2 grid grid-cols-2 gap-2">
                              {expense.receipt_number && (
                                <div className="flex items-center text-sm text-gray-600">
                                  <FiFileText className="mr-1 h-4 w-4" />
                                  Receipt: {expense.receipt_number}
                                </div>
                              )}
                              
                              <div className="flex items-center text-sm text-gray-600">
                                <span className="mr-1 text-lg">{getPaymentIcon(expense.payment_method)}</span>
                                <span className="capitalize">{expense.payment_method.replace('_', ' ')}</span>
                              </div>
                            </div>
                            
                            {expense.remarks && (
                              <p className="mt-2 text-sm text-gray-600 bg-gray-50 p-2 rounded-lg">
                                {expense.remarks}
                              </p>
                            )}
                            
                            {expense.is_recurring && (
                              <span className="inline-block mt-2 px-2 py-1 text-xs font-medium bg-purple-100 text-purple-800 rounded-full">
                                🔄 Recurring ({expense.recurrence_type})
                              </span>
                            )}
                          </div>
                        </td>
                        
                        <td className="px-6 py-4">
                          <div className="space-y-2">
                            <div>
                              <p className="text-2xl font-bold text-gray-900">
                                {formatCurrency(expense.amount)}
                              </p>
                            </div>
                            
                            <div className="flex items-center p-3 bg-gray-50 rounded-lg">
                              <span className="text-xl mr-3">{getWalletMeta(wallet).icon}</span>
                              <div>
                                <p className="font-medium text-gray-900">{expense.wallet_name}</p>
                                <p className="text-xs text-gray-600">
                                  Balance: {formatCurrency(walletBalances[expense.wallet_id])}
                                </p>
                              </div>
                            </div>
                            
                            <div className="text-xs text-gray-500">
                              Submitted: {formatDate(expense.submitted_at)}
                            </div>
                            
                            {expense.approved_at && (
                              <div className="text-xs text-gray-500">
                                Approved: {formatDate(expense.approved_at)}
                              </div>
                            )}
                          </div>
                        </td>
                        
                        <td className="px-6 py-4">
                          <div className="flex items-center">
                            {getStatusIcon(expense.status)}
                            <span className={`ml-2 px-3 py-1 rounded-full text-sm font-medium ${status?.color}`}>
                              {status?.name}
                            </span>
                          </div>
                          
                          {expense.requires_approval ? (
                            <div className="mt-2 flex items-center text-sm text-yellow-600 bg-yellow-50 p-2 rounded-lg">
                              👑 Requires Admin Approval
                            </div>
                          ) : (
                            <div className="mt-2 flex items-center text-sm text-green-600 bg-green-50 p-2 rounded-lg">
                              ✅ Auto Approved
                            </div>
                          )}
                          
                          {expense.approved_by && (
                            <div className="mt-2 text-sm text-gray-600 flex items-center">
                              <FiUser className="mr-1 h-4 w-4" />
                              By: {expense.approved_by}
                            </div>
                          )}
                          
                          {expense.attachment && (
                            <a 
                              href="#" 
                              onClick={(e) => {
                                e.preventDefault();
                                toast.info("Attachment would open in real implementation");
                              }}
                              className="inline-block mt-2 text-sm text-blue-600 hover:text-blue-800"
                            >
                              📎 View Attachment
                            </a>
                          )}
                        </td>
                        
                        <td className="px-6 py-4">
                          <div className="flex items-center space-x-3">
                            <span className="text-sm text-gray-500 italic">
                              Editing disabled (Admin approval pending)
                            </span>

                            {(expense.status === "approved" || expense.status === "paid") && (
                              <span className="text-sm text-gray-500 italic">
                                Read-only (Approved/Paid)
                              </span>
                            )}

                            {expense.status === "pending" && expense.requires_approval === true && (
                              <button
                                onClick={() => handleDeleteExpense(expense.id)}
                                title="Delete expense"
                                className="text-red-600 hover:text-red-800 transition-colors"
                              >
                                <FiTrash2 size={22} />
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

      {/* Add Expense Modal - HEADER MATCHES MAIN PAGE */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
            >
              <div className="bg-white border-b border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-900">New Expense Entry</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Select wallet from which money will be debited
                </p>
              </div>
              
              {/* Form container with hidden scrollbar */}
              <div className="overflow-y-auto flex-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <form onSubmit={handleAddExpense} className="p-6">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Left Column */}
                    <div className="space-y-5">
                      {/* Category Search */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Expense Category *
                          <span className="ml-2 text-xs text-gray-500">
                            👑 = Needs Admin Approval | ✅ = Auto Approved
                          </span>
                        </label>
                        <div className="relative mb-2">
                          <input
                            type="text"
                            placeholder="Search categories..."
                            value={categorySearch}
                            onChange={(e) => setCategorySearch(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                          />
                          <svg
                            className="absolute right-4 top-3.5 h-5 w-5 text-gray-400"
                            xmlns="http://www.w3.org/2000/svg"
                            fill="none"
                            viewBox="0 0 24 24"
                            stroke="currentColor"
                          >
                            <path
                              strokeLinecap="round"
                              strokeLinejoin="round"
                              strokeWidth={2}
                              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                            />
                          </svg>
                        </div>
                        
                        <div className="space-y-2 max-h-48 overflow-y-auto [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                          {filteredCategories.map(category => (
                            <label
                              key={category.id}
                              className={`flex items-center p-3 rounded-xl border-2 cursor-pointer transition-all ${
                                parseInt(newExpense.category_id) === category.id
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              } ${category.requires_approval ? 'border-l-4 border-l-yellow-500' : 'border-l-4 border-l-green-500'}`}
                            >
                              <input
                                type="radio"
                                name="category_id"
                                value={category.id}
                                checked={parseInt(newExpense.category_id) === category.id}
                                onChange={handleInputChange}
                                className="sr-only"
                                required
                              />
                              <span className="text-xl mr-3">{category.icon}</span>
                              <div className="flex-1">
                                <p className="font-medium text-gray-900">{category.name}</p>
                                <p className="text-xs text-gray-600 mt-1">
                                  {category.requires_approval 
                                    ? '👑 Requires admin approval' 
                                    : '✅ Auto approved (no approval needed)'}
                                </p>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Amount */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Amount (₹) *
                        </label>
                        <input
                          type="number"
                          name="amount"
                          value={newExpense.amount}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter amount"
                          required
                          min="0"
                          step="0.01"
                        />
                      </div>

                      {/* Description */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Description *
                        </label>
                        <input
                          type="text"
                          name="description"
                          value={newExpense.description}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Brief description of expense"
                          required
                        />
                      </div>

                      {/* Date */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Expense Date *
                        </label>
                        <input
                          type="date"
                          name="expense_date"
                          value={newExpense.expense_date}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                          required
                        />
                      </div>
                    </div>

                    {/* Right Column */}
                    <div className="space-y-5">
                      {/* Wallet Selection */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Select Wallet (Money will be debited from) *
                        </label>
                        <div className="space-y-2">
                          {wallets.map(wallet => (
                            <label
                              key={wallet.id}
                              className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${
                                parseInt(newExpense.wallet_id) === wallet.id
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <div className="flex items-center">
                                <input
                                  type="radio"
                                  name="wallet_id"
                                  value={wallet.id}
                                  checked={parseInt(newExpense.wallet_id) === wallet.id}
                                  onChange={handleInputChange}
                                  className="sr-only"
                                  required
                                />
                                <span className="text-2xl mr-3">{getWalletMeta(wallet).icon}</span>
                                <div>
                                  <p className="font-medium text-gray-900">
                                    {wallet.name}</p>
                                  <p className="text-xs text-gray-600">
                                    {getWalletMeta(wallet).label}
                                  </p>
                                </div>
                              </div>
                              <div className="text-right">
                                <p className="text-sm font-bold text-gray-900">
                                  {formatCurrency(walletBalances[wallet.id])}
                                </p>
                                <p className="text-xs text-gray-600">Available</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Payment Method */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Payment Method *
                        </label>
                        <div className="grid grid-cols-2 gap-2">
                          {paymentMethods.map(method => (
                            <label
                              key={method.id}
                              className={`flex items-center p-3 rounded-xl border-2 cursor-pointer transition-all ${
                                newExpense.payment_method === method.id
                                  ? 'border-blue-500 bg-blue-50'
                                  : 'border-gray-200 hover:border-gray-300'
                              }`}
                            >
                              <input
                                type="radio"
                                name="payment_method"
                                value={method.id}
                                checked={newExpense.payment_method === method.id}
                                onChange={handleInputChange}
                                className="sr-only"
                                required
                              />
                              <span className="text-xl mr-3">{method.icon}</span>
                              <div>
                                <p className="font-medium text-gray-900">{method.name}</p>
                              </div>
                            </label>
                          ))}
                        </div>
                      </div>

                      {/* Receipt Number */}
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                          Receipt/Bill Number
                        </label>
                        <input
                          type="text"
                          name="receipt_number"
                          value={newExpense.receipt_number}
                          onChange={handleInputChange}
                          className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                          placeholder="Enter receipt number if any"
                        />
                      </div>

                      {/* Recurring Expense */}
                      <div className="space-y-3">
                        <label className="flex items-center">
                          <input
                            type="checkbox"
                            name="is_recurring"
                            checked={newExpense.is_recurring}
                            onChange={handleInputChange}
                            className="rounded text-blue-600 focus:ring-blue-500 h-5 w-5"
                          />
                          <span className="ml-3 text-sm text-gray-700 font-medium">
                            This is a recurring expense
                          </span>
                        </label>
                        
                        {newExpense.is_recurring && (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Recurrence Type
                            </label>
                            <select
                              name="recurrence_type"
                              value={newExpense.recurrence_type}
                              onChange={handleInputChange}
                              className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                            >
                              <option value="none">Select type</option>
                              <option value="monthly">Monthly</option>
                              <option value="quarterly">Quarterly</option>
                              <option value="yearly">Yearly</option>
                            </select>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Remarks & Attachment - Full Width */}
                  <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Remarks */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Remarks / Additional Notes
                      </label>
                      <textarea
                        name="remarks"
                        value={newExpense.remarks}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Any additional notes or explanation..."
                        rows={3}
                      ></textarea>
                    </div>

                    {/* Attachment */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Attachment (Optional)
                      </label>
                      <div className="border-2 border-dashed border-gray-300 rounded-xl p-4 text-center hover:border-gray-400 transition-colors">
                        <FiFileText className="mx-auto h-10 w-10 text-gray-400" />
                        <p className="mt-2 text-sm text-gray-600">
                          Drag & drop receipt/bill image or click to upload
                        </p>
                        <input
                          type="file"
                          className="hidden"
                          accept="image/*,.pdf"
                          onChange={(e) => {
                            const file = e.target.files[0];
                            if (file) {
                              setNewExpense(prev => ({ ...prev, attachment: file.name }));
                              toast.info("File selected: " + file.name);
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => document.querySelector('input[type="file"]').click()}
                          className="mt-3 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors text-sm font-medium"
                        >
                          Choose File
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-8 flex justify-end gap-3 border-t border-gray-200 pt-5">
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={() => {
                        setShowAddModal(false);
                        resetForm();
                        setCategorySearch("");
                      }}
                      className="px-5 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      className="px-5 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium flex items-center"
                    >
                      <FiSave className="mr-2" />
                      Submit Expense
                    </motion.button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Edit Expense Modal - HEADER MATCHES MAIN PAGE */}
      <AnimatePresence>
        {showEditModal && editingExpense && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] shadow-2xl border border-gray-200 flex flex-col overflow-hidden"
            >
              <div className="bg-white border-b border-gray-200 p-6">
                <h2 className="text-xl font-bold text-gray-900">Edit Expense Entry</h2>
                <p className="text-sm text-gray-500 mt-1">
                  Status: {statuses.find(s => s.id === editingExpense.status)?.name}
                </p>
              </div>
              
              {/* Form container with hidden scrollbar */}
              <div className="overflow-y-auto flex-1 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
                <form onSubmit={handleEditExpense} className="p-6">
                  <div className="space-y-5">
                    {/* Category */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Expense Category *
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {categories.map(category => (
                          <label
                            key={category.id}
                            className={`flex items-center p-3 rounded-xl border-2 cursor-pointer transition-all ${
                              parseInt(editingExpense.category_id) === category.id
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                            } ${category.requires_approval ? 'border-l-4 border-l-yellow-500' : 'border-l-4 border-l-green-500'}`}
                          >
                            <input
                              type="radio"
                              name="category_id"
                              value={category.id}
                              checked={parseInt(editingExpense.category_id) === category.id}
                              onChange={handleEditInputChange}
                              className="sr-only"
                              required
                            />
                            <span className="text-xl mr-3">{category.icon}</span>
                            <div>
                              <p className="font-medium text-gray-900">{category.name}</p>
                              <p className="text-xs text-gray-600">
                                {category.requires_approval ? '👑 Needs Approval' : '✅ Auto Approved'}
                              </p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Amount */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Amount (₹) *
                      </label>
                      <input
                        type="number"
                        name="amount"
                        value={editingExpense.amount || ""}
                        onChange={handleEditInputChange}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                        min="0"
                        step="0.01"
                      />
                    </div>

                    {/* Description */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Description *
                      </label>
                      <input
                        type="text"
                        name="description"
                        value={editingExpense.description || ""}
                        onChange={handleEditInputChange}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        required
                      />
                    </div>

                    {/* Wallet Selection */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Select Wallet *
                      </label>
                      <div className="space-y-2">
                        {wallets.map(wallet => (
                          <label
                            key={wallet.id}
                            className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${
                              parseInt(editingExpense.wallet_id) === wallet.id
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-center">
                              <input
                                type="radio"
                                name="wallet_id"
                                value={wallet.id}
                                checked={parseInt(editingExpense.wallet_id) === wallet.id}
                                onChange={handleEditInputChange}
                                className="sr-only"
                                required
                              />
                              <span className="text-2xl mr-3">{getWalletMeta(wallet).icon}</span>
                              <div>
                                <p className="font-medium text-gray-900">{wallet.name}</p>
                                <p className="text-xs text-gray-600">
                                  {getWalletMeta(wallet).label}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-sm font-bold text-gray-900">
                                {formatCurrency(walletBalances[wallet.id])}
                              </p>
                              <p className="text-xs text-gray-600">Available</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Payment Method */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Payment Method *
                      </label>
                      <div className="grid grid-cols-2 gap-2">
                        {paymentMethods.map(method => (
                          <label
                            key={method.id}
                            className={`flex items-center p-3 rounded-xl border-2 cursor-pointer transition-all ${
                              editingExpense.payment_method === method.id
                                ? 'border-blue-500 bg-blue-50'
                                : 'border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <input
                              type="radio"
                              name="payment_method"
                              value={method.id}
                              checked={editingExpense.payment_method === method.id}
                              onChange={handleEditInputChange}
                              className="sr-only"
                              required
                            />
                            <span className="text-xl mr-3">{method.icon}</span>
                            <div>
                              <p className="font-medium text-gray-900">{method.name}</p>
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>

                    {/* Remarks */}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Remarks / Additional Notes
                      </label>
                      <textarea
                        name="remarks"
                        value={editingExpense.remarks || ""}
                        onChange={handleEditInputChange}
                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                        placeholder="Any additional notes or explanation..."
                        rows={3}
                      ></textarea>
                    </div>
                  </div>

                  <div className="mt-8 flex justify-end gap-3 border-t border-gray-200 pt-5">
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.98 }}
                      type="button"
                      onClick={() => {
                        setShowEditModal(false);
                        setEditingExpense(null);
                      }}
                      className="px-5 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.98 }}
                      type="submit"
                      className="px-5 py-3 bg-green-600 text-white rounded-xl hover:bg-green-700 transition-colors font-medium flex items-center"
                    >
                      <FiSave className="mr-2" />
                      Update Expense
                    </motion.button>
                  </div>
                </form>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default ExpenseEntry;
