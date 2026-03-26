import React, { useState } from "react";
import { motion } from "framer-motion";
import {
  FiDollarSign,
  FiCalendar,
  FiFileText,
  FiCreditCard,
  FiSave,
  FiTag,
  FiCheck,
} from "react-icons/fi";

const AdminExpenseEntry = ({
  initialData = {},
  onSubmit,
  onCancel,
  wallets = [],
  categories = [],
  title = "New Expense Entry",
  submitButtonText = "Submit Expense",
  isLoading = false,
}) => {
  // Default expense categories (can be overridden via props)
  const defaultCategories = [
    { id: 1, name: "Salary Advance", color: "#3B82F6", icon: "💰", requires_approval: true },
    { id: 2, name: "Rent Payment", color: "#10B981", icon: "🏠", requires_approval: true },
    { id: 3, name: "Electricity Bill", color: "#EF4444", icon: "⚡", requires_approval: false },
    { id: 4, name: "Maintenance", color: "#F59E0B", icon: "🔧", requires_approval: false },
    { id: 5, name: "Ink Purchase", color: "#8B5CF6", icon: "🖨️", requires_approval: false },
    { id: 6, name: "Paper Purchase", color: "#8B5CF6", icon: "📄", requires_approval: false },
    { id: 7, name: "Internet Bill", color: "#EC4899", icon: "🌐", requires_approval: false },
    { id: 8, name: "Transportation", color: "#14B8A6", icon: "🚗", requires_approval: false },
    { id: 9, name: "Office Supplies", color: "#84CC16", icon: "📦", requires_approval: false },
    { id: 10, name: "Cleaning Supplies", color: "#84CC16", icon: "🧹", requires_approval: false },
    { id: 11, name: "Stationery", color: "#84CC16", icon: "✏️", requires_approval: false },
    { id: 12, name: "Other Expenses", color: "#6B7280", icon: "📝", requires_approval: false }
  ];

  // Default payment methods
  const paymentMethods = [
    { id: "cash", name: "Cash", icon: "💰" },
    { id: "bank_transfer", name: "Bank Transfer", icon: "🏦" },
    { id: "cheque", name: "Cheque", icon: "📝" },
    { id: "online", name: "Online Payment", icon: "💳" }
  ];

  // Wallet type metadata
  const WALLET_TYPE_META = {
    bank: { label: "Bank Account", icon: "🏦", color: "text-blue-600", bg: "bg-blue-50" },
    cash: { label: "Cash", icon: "💰", color: "text-green-600", bg: "bg-green-50" },
    credit_card: { label: "Credit Card", icon: "💳", color: "text-purple-600", bg: "bg-purple-50" },
    digital: { label: "Digital Wallet", icon: "📱", color: "text-indigo-600", bg: "bg-indigo-50" },
    savings: { label: "Savings", icon: "🏧", color: "text-teal-600", bg: "bg-teal-50" },
  };

  // Use provided categories or defaults
  const expenseCategories = categories.length > 0 ? categories : defaultCategories;

  // Initialize form state
  const [formData, setFormData] = useState({
    category_id: initialData.category_id || "",
    amount: initialData.amount || "",
    description: initialData.description || "",
    payment_method: initialData.payment_method || "cash",
    wallet_id: initialData.wallet_id || "",
    expense_date: initialData.expense_date || new Date().toISOString().split('T')[0],
    receipt_number: initialData.receipt_number || "",
    remarks: initialData.remarks || "",
    is_recurring: initialData.is_recurring || false,
    recurrence_type: initialData.recurrence_type || "none",
    attachment: initialData.attachment || ""
  });

  const [categorySearch, setCategorySearch] = useState("");

  // Filter categories based on search
  const filteredCategories = expenseCategories.filter(category => 
    category.name.toLowerCase().includes(categorySearch.toLowerCase())
  );

  // Handle input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    
    // Get selected category details
    const selectedCategory = expenseCategories.find(
      cat => cat.id === parseInt(formData.category_id)
    );

    // Prepare payload
    const payload = {
      ...formData,
      amount: Number(formData.amount),
      wallet_id: Number(formData.wallet_id),
      category: selectedCategory?.name,
      
      // 🔥 ADMIN OVERRIDE
      requires_approval: false
    };

    onSubmit(payload);
  };

  // Get wallet metadata
  const getWalletMeta = (wallet) => {
    const type = wallet.type || wallet.wallet_type;
    return WALLET_TYPE_META[type] || {
      label: "Wallet",
      icon: "💼",
      color: "text-gray-600",
      bg: "bg-gray-50",
    };
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      minimumFractionDigits: 0,
    }).format(amount || 0);
  };

  // Calculate wallet balances (simplified - in real app, this would come from API)
  const walletBalances = wallets.reduce((acc, w) => {
    acc[w.id] = Number(w.balance) || 0;
    return acc;
  }, {});

  return (
    <div className="bg-white rounded-2xl shadow-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-purple-600 p-6">
        <h2 className="text-xl font-bold text-white">{title}</h2>
        <p className="text-sm text-blue-100 mt-1">
          Select wallet from which money will be debited
        </p>
      </div>
      
      {/* Form */}
      <form onSubmit={handleSubmit} className="p-6">
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
              
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {filteredCategories.map(category => (
                  <label
                    key={category.id}
                    className={`flex items-center p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      parseInt(formData.category_id) === category.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    } ${category.requires_approval ? 'border-l-4 border-l-yellow-500' : 'border-l-4 border-l-green-500'}`}
                  >
                    <input
                      type="radio"
                      name="category_id"
                      value={category.id}
                      checked={parseInt(formData.category_id) === category.id}
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
              <div className="relative">
                <FiDollarSign className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
                <input
                  type="number"
                  name="amount"
                  value={formData.amount}
                  onChange={handleInputChange}
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter amount"
                  required
                  min="0"
                  step="0.01"
                />
              </div>
            </div>

            {/* Description */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Description *
              </label>
              <div className="relative">
                <FiFileText className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  name="description"
                  value={formData.description}
                  onChange={handleInputChange}
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Brief description of expense"
                  required
                />
              </div>
            </div>

            {/* Date */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Expense Date *
              </label>
              <div className="relative">
                <FiCalendar className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
                <input
                  type="date"
                  name="expense_date"
                  value={formData.expense_date}
                  onChange={handleInputChange}
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div className="space-y-5">
            {/* Wallet Selection */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Select Wallet (Money will be debited from) *
              </label>
              <div className="space-y-2 max-h-60 overflow-y-auto">
                {wallets.map(wallet => (
                  <label
                    key={wallet.id}
                    className={`flex items-center justify-between p-3 rounded-xl border-2 cursor-pointer transition-all ${
                      parseInt(formData.wallet_id) === wallet.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <div className="flex items-center">
                      <input
                        type="radio"
                        name="wallet_id"
                        value={wallet.id}
                        checked={parseInt(formData.wallet_id) === wallet.id}
                        onChange={handleInputChange}
                        className="sr-only"
                        required
                      />
                      <span className="text-2xl mr-3">{getWalletMeta(wallet).icon}</span>
                      <div>
                        <p className="font-medium text-gray-900">
                          {wallet.name}
                        </p>
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
                      formData.payment_method === method.id
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-gray-200 hover:border-gray-300'
                    }`}
                  >
                    <input
                      type="radio"
                      name="payment_method"
                      value={method.id}
                      checked={formData.payment_method === method.id}
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
              <div className="relative">
                <FiTag className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  name="receipt_number"
                  value={formData.receipt_number}
                  onChange={handleInputChange}
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Enter receipt number if any"
                />
              </div>
            </div>

            {/* Recurring Expense */}
            <div className="space-y-3">
              <label className="flex items-center">
                <input
                  type="checkbox"
                  name="is_recurring"
                  checked={formData.is_recurring}
                  onChange={handleInputChange}
                  className="rounded text-blue-600 focus:ring-blue-500 h-5 w-5"
                />
                <span className="ml-3 text-sm text-gray-700 font-medium">
                  This is a recurring expense
                </span>
              </label>
              
              {formData.is_recurring && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Recurrence Type
                  </label>
                  <select
                    name="recurrence_type"
                    value={formData.recurrence_type}
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
              value={formData.remarks}
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
                    //setFormData(prev => ({ ...prev, attachment: file.name }));
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
              {formData.attachment && (
                <p className="mt-2 text-sm text-green-600">
                  ✓ {formData.attachment}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mt-8 flex justify-end gap-3 border-t border-gray-200 pt-5">
          {onCancel && (
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              type="button"
              onClick={onCancel}
              disabled={isLoading}
              className="px-5 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Cancel
            </motion.button>
          )}
          <motion.button
            whileHover={{ scale: 1.03 }}
            whileTap={{ scale: 0.98 }}
            type="submit"
            disabled={isLoading}
            className="px-5 py-3 bg-blue-600 text-white rounded-xl hover:bg-blue-700 transition-colors font-medium flex items-center disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Processing...
              </>
            ) : (
              <>
                <FiSave className="mr-2" />
                {submitButtonText}
              </>
            )}
          </motion.button>
        </div>
      </form>
    </div>
  );
};

// Also create a modal wrapper version for convenience
export const ExpenseFormModal = ({ isOpen, onClose, ...props }) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <motion.div
        initial={{ scale: 0.95, y: 20 }}
        animate={{ scale: 1, y: 0 }}
        exit={{ scale: 0.95, y: 20 }}
        className="w-full max-w-2xl max-h-[90vh] overflow-hidden"
      >
      </motion.div>
    </div>
  );
};

export default AdminExpenseEntry;