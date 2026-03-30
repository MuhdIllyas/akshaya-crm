import { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiPlus, FiRefreshCw, FiChevronDown, FiChevronUp, FiSearch,
  FiX, FiEdit, FiTrash, FiArrowDown, FiArrowUp, FiMapPin
} from "react-icons/fi";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  getWallets,
  createWallet,
  getTransactions,
  updateWallet,
  getStaff,
  rechargeWallet,
  transferWallet,
  getWalletTodayBalance
} from "@/services/walletService";
import { Link, useNavigate } from "react-router-dom";

// Icons
const WalletIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-indigo-500" viewBox="0 0 20 20" fill="currentColor">
    <path d="M4 4a2 2 0 00-2 2v1h16V6a2 2 0 00-2-2H4z" />
    <path fillRule="evenodd" d="M18 9H2v5a2 2 0 002 2h12a2 2 0 002-2V9zM4 13a1 1 0 011-1h1a1 1 0 110 2H5a1 1 0 01-1-1z" clipRule="evenodd" />
  </svg>
);

const FeeIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-teal-500" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.736 6.979C9.208 6.193 9.696 6 10 6c.304 0 .792.193 1.264.979a1 1 0 001.715-1.029C12.279 4.784 11.232 4 10 4s-2.279.784-2.979 1.95a1 1 0 101.715 1.029zM6 9a1 1 0 000 2h8a1 1 0 100-2H6z" clipRule="evenodd" />
  </svg>
);

const UserIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-purple-500" viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
  </svg>
);

const ChevronIcon = ({ open }) => (
  <svg xmlns="http://www.w3.org/2000/svg" className={`h-5 w-5 text-gray-500 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 20 20" fill="currentColor">
    <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
  </svg>
);

const WalletManagement = () => {
  const navigate = useNavigate();
  const storedId = localStorage.getItem("id");
  const storedUser = localStorage.getItem("username");
  const storedRole = localStorage.getItem("role");
  const storedPhoto = localStorage.getItem("photoUrl");
  const storedCentreId = localStorage.getItem("centre_id");

  const currentStaff = {
    id: storedId ? Number(storedId) : null,
    username: storedUser || "Unknown",
    role: storedRole || "",
    centreId: storedCentreId ? Number(storedCentreId) : null
  };

  // Get admin's center ID
  const adminCentreId = currentStaff.centreId;

  const walletTypes = [
    { id: "bank", name: "Bank Account", icon: WalletIcon, color: "bg-blue-50 text-blue-700" },
    { id: "cash", name: "Cash", icon: FeeIcon, color: "bg-green-50 text-green-700" },
    { id: "card", name: "Credit Card", icon: FeeIcon, color: "bg-purple-50 text-purple-700" },
    { id: "digital", name: "Digital Wallet", icon: WalletIcon, color: "bg-amber-50 text-amber-700" },
    { id: "savings", name: "Savings", icon: WalletIcon, color: "bg-yellow-50 text-yellow-700" },
  ];

  const [staffMembers, setStaffMembers] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [todayBalances, setTodayBalances] = useState({});
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const transactionsPerPage = 5;
  const [searchQuery, setSearchQuery] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    balance: "",
    type: "personal",
    isOnline: true,
    staffId: "",
    walletType: "bank"
  });
  const [newWallet, setNewWallet] = useState({
    name: "",
    balance: "",
    type: "personal",
    isOnline: true,
    staffId: "",
    walletType: "bank"
  });
  const [rechargingId, setRechargingId] = useState(null);
  const [rechargeAmount, setRechargeAmount] = useState("");
  const [rechargeDescription, setRechargeDescription] = useState("");
  const [transferringId, setTransferringId] = useState(null);
  const [transferFromWalletId, setTransferFromWalletId] = useState("");
  const [transferToWalletId, setTransferToWalletId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDescription, setTransferDescription] = useState("");
  const [showAddForm, setShowAddForm] = useState(false);
  const [selectedDepartment, setSelectedDepartment] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [viewMode, setViewMode] = useState("table");

  const departments = ["All", "Accounts", "Reception", "Front Office", "Aadhaar", "Staff Executive", "Customer Relations"];
  const statuses = ["All", "Active", "On Leave", "Terminated"];

  useEffect(() => {
    if (currentStaff.role !== "superadmin" && !currentStaff.centreId) {
      toast.error("Centre ID is missing. Please log in again.");
      navigate("/login");
      return;
    }
    fetchWalletData();
    fetchStaffData();
  }, [navigate, currentStaff.role, currentStaff.centreId]);

  // OPTIMIZED: Parallel fetching of today's balances
  const fetchWalletData = async () => {
    try {
      setLoading(true);
      const walletRes = await getWallets();
      const filteredWallets = currentStaff.role === "superadmin" ? walletRes.data : walletRes.data.filter(wallet => wallet.centre_id === adminCentreId);
      setWallets(filteredWallets || []);

      // Fetch all today balances in parallel
      const balancesMap = {};
      if (filteredWallets.length > 0) {
        const balancePromises = filteredWallets.map(async (wallet) => {
          try {
            const balance = await getWalletTodayBalance(wallet.id);
            return { id: wallet.id, balance };
          } catch (e) {
            console.error(`Failed to fetch balance for wallet ${wallet.id}:`, e);
            return { id: wallet.id, balance: null };
          }
        });
        const balanceResults = await Promise.all(balancePromises);
        balanceResults.forEach(({ id, balance }) => {
          balancesMap[id] = balance;
        });
      }
      setTodayBalances(balancesMap);

      const transactionRes = await getTransactions();
      setTransactions(transactionRes.data || []);
    } catch (err) {
      console.error("Error loading wallet data:", err);
      setWallets([]);
      setTransactions([]);
      toast.error("Failed to load wallet data.");
    } finally {
      setLoading(false);
    }
  };

  const fetchStaffData = async () => {
    try {
      setStaffLoading(true);
      setStaffError(null);
      const staffData = await getStaff(currentStaff.role === "superadmin" ? null : adminCentreId);
      console.log("Raw Staff:", staffData);
      const mappedStaff = staffData.map(staff => ({
        ...staff,
        photoUrl: staff.photo || null,
        centre_name: staff.centre_name || "Unknown",
        department: staff.department || "N/A",
        status: staff.status || "Active",
      }));
      setStaffMembers(mappedStaff || []);
    } catch (err) {
      console.error("Error loading staff data:", err);
      setStaffError("Failed to load staff data.");
      setStaffMembers([]);
      toast.error("Failed to load staff data.");
    } finally {
      setStaffLoading(false);
    }
  };

  const handleAddStaff = async () => {
    try {
      const staffData = await getStaff(currentStaff.role === "superadmin" ? null : adminCentreId);
      console.log("Refreshed Staff:", staffData);
      const mappedStaff = staffData.map(staff => ({
        ...staff,
        photoUrl: staff.photo || null,
        centre_name: staff.centre_name || "Unknown",
        department: staff.department || "N/A",
        status: staff.status || "Active",
      }));
      setStaffMembers(mappedStaff || []);
      toast.success("Staff added successfully");
    } catch (err) {
      console.error("Error refreshing staff:", err);
      toast.error(err.response?.data?.error || "Failed to refresh staff list.");
    }
    setShowAddForm(false);
  };

  const filteredStaff = staffMembers.filter((staff) => {
    const matchesSearch =
      staff.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      staff.email?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      staff.phone?.includes(searchQuery) ||
      staff.username?.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesDepartment = selectedDepartment === "All" || staff.department === selectedDepartment;
    const matchesStatus = selectedStatus === "All" || staff.status === selectedStatus;
    return matchesSearch && matchesDepartment && matchesStatus;
  });

  useEffect(() => {
    if (editingId) {
      const walletToEdit = wallets.find(w => w.id === editingId);
      if (walletToEdit) {
        setEditForm({
          name: walletToEdit.name,
          balance: walletToEdit.balance.toString(),
          type: walletToEdit.is_shared ? "shared" : "personal",
          isOnline: walletToEdit.status === 'online',
          staffId: walletToEdit.assigned_staff_id || "",
          walletType: walletToEdit.wallet_type
        });
        if (expandedId !== editingId) {
          setExpandedId(editingId);
        }
      }
    }
  }, [editingId, wallets, expandedId]);

  const formatAmount = (amount) => {
    const num = typeof amount === 'string' ? parseFloat(amount) : (typeof amount === 'number' ? amount : 0);
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0, minimumFractionDigits: 0 }).format(num);
  };

  const handleRefresh = () => {
    setLoading(true);
    setStaffLoading(true);
    fetchWalletData();
    fetchStaffData();
    toast.success("Data refreshed successfully!");
  };

  const toggleDetails = (id) => {
    setExpandedId(expandedId === id ? null : id);
    if (editingId === id) {
      setEditingId(null);
    }
  };

  const handleAddWallet = async () => {
    if (!newWallet.name || !newWallet.balance) {
      toast.error("Wallet name and balance are required.");
      return;
    }
    try {
      const payload = {
        name: newWallet.name,
        balance: Number(newWallet.balance),
        is_shared: newWallet.type === "shared",
        assigned_staff_id: newWallet.type === "personal" ? newWallet.staffId : null,
        wallet_type: newWallet.walletType,
        status: newWallet.isOnline ? "online" : "offline",
        centre_id: adminCentreId
      };
      await createWallet(payload);
      fetchWalletData();
      setNewWallet({ name: "", balance: "", type: "personal", isOnline: true, staffId: "", walletType: "bank" });
      setIsAdding(false);
      toast.success("Wallet added successfully!");
    } catch (err) {
      console.error("Error creating wallet:", err);
      toast.error("Failed to create wallet.");
    }
  };

  const handleEditWallet = async () => {
    if (!editForm.name || !editForm.balance) {
      toast.error("Wallet name and balance are required.");
      return;
    }
    try {
      const payload = {
        name: editForm.name,
        balance: Number(editForm.balance),
        is_shared: editForm.type === "shared",
        assigned_staff_id: editForm.type === "personal" ? editForm.staffId : null,
        wallet_type: editForm.walletType,
        status: editForm.isOnline ? "online" : "offline"
      };
      await updateWallet(editingId, payload);
      fetchWalletData();
      setEditingId(null);
      toast.success("Wallet updated successfully!");
    } catch (err) {
      console.error("Error updating wallet:", err);
      toast.error("Failed to update wallet.");
    }
  };

  const handleRecharge = async (walletId) => {
    if (!rechargeAmount || Number(rechargeAmount) <= 0) {
      toast.error("Please enter a valid recharge amount.");
      return;
    }
    try {
      const amount = Number(rechargeAmount);
      const payload = {
        wallet_id: walletId,
        amount,
        description: rechargeDescription || "Wallet Recharge",
        category: "Recharge",
        staff_id: currentStaff.id
      };
      await rechargeWallet(payload);
      await fetchWalletData();
      setRechargingId(null);
      setRechargeAmount("");
      setRechargeDescription("");
      toast.success(`Successfully recharged ${formatAmount(amount)} to wallet.`);
    } catch (err) {
      console.error("Recharge failed:", err);
      toast.error("Recharge failed. Please try again.");
    }
  };

  const handleTransfer = async () => {
    if (!transferFromWalletId || !transferToWalletId || !transferAmount || Number(transferAmount) <= 0) {
      toast.error("Please select source and destination wallets and enter a valid amount.");
      return;
    }
    if (transferFromWalletId === transferToWalletId) {
      toast.error("Source and destination wallets cannot be the same.");
      return;
    }
    if (!currentStaff.id) {
      toast.error("Staff ID is missing. Redirecting to login page...");
      navigate('/login');
      return;
    }
    try {
      const amount = Number(transferAmount);
      const payload = {
        from_wallet_id: Number(transferFromWalletId),
        to_wallet_id: Number(transferToWalletId),
        amount,
        description: transferDescription || `Transfer from wallet ${transferFromWalletId} to wallet ${transferToWalletId}`,
        category: "Transfer",
        staff_id: currentStaff.id
      };
      await transferWallet(payload);
      await fetchWalletData();
      setTransferringId(null);
      setTransferFromWalletId("");
      setTransferToWalletId("");
      setTransferAmount("");
      setTransferDescription("");
      toast.success(`Successfully transferred ${formatAmount(amount)}.`);
    } catch (err) {
      console.error("Transfer failed:", err);
      toast.error(err.response?.data?.error || "Transfer failed. Please try again.");
    }
  };

  const getStaffMember = (id) => {
    if (!id && currentStaff) return currentStaff;
    const staff = staffMembers.find(s => s.id === Number(id));
    return staff ? {
      id: staff.id,
      name: staff.name,
      role: staff.role,
      photoUrl: staff.photoUrl || null,
      avatarColor: staff.photoUrl ? "" : "bg-slate-700"
    } : {
      name: "Unassigned",
      role: "",
      photoUrl: null,
      avatarColor: "bg-slate-600"
    };
  };

  const getWalletName = (id) => {
    const wallet = wallets.find(w => w.id === id);
    return wallet ? wallet.name : "Unknown Wallet";
  };

  const getWalletIcon = (typeId) => {
    const type = walletTypes.find(t => t.id === typeId);
    return type ? type.icon : WalletIcon;
  };

  const getTransactionStaff = (transaction) => {
    if (transaction.staff_id) {
      return {
        name: transaction.staff_name || `Staff ID ${transaction.staff_id}`,
        role: transaction.staff_role || "Unknown Role",
        photoUrl: transaction.staff_photo || null,
        avatarColor: "bg-slate-700"
      };
    } else {
      return {
        name: "System",
        role: "Auto-generated",
        photoUrl: null,
        avatarColor: "bg-slate-600"
      };
    }
  };

  const totalBalance = wallets.reduce((sum, wallet) => sum + (Number(wallet?.balance) || 0), 0);
  const personalCount = wallets.filter(w => w && !w.is_shared).length;
  const sharedCount = wallets.filter(w => w && w.is_shared).length;

  // Filter transactions for today only
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(today.getDate() + 1);

  const filteredTransactions = useMemo(() => {
    const walletIdsInCentre = wallets.map(w => w.id);
    return transactions.filter(t => 
      walletIdsInCentre.includes(t.wallet_id) &&
      new Date(t.created_at) >= today &&
      new Date(t.created_at) < tomorrow &&
      (
        t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        t.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        getTransactionStaff(t).name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    );
  }, [transactions, wallets, searchQuery]);

  const indexOfLastTransaction = currentPage * transactionsPerPage;
  const indexOfFirstTransaction = indexOfLastTransaction - transactionsPerPage;
  const currentTransactions = filteredTransactions.slice(indexOfFirstTransaction, indexOfLastTransaction);
  const totalPages = Math.ceil(filteredTransactions.length / transactionsPerPage);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50 p-4 sm:p-6">
      <ToastContainer />
      
      {/* Recharge Modal */}
      <AnimatePresence>
        {rechargingId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setRechargingId(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 sticky top-0 z-10">
                <h2 className="text-xl font-bold text-white">Recharge Wallet</h2>
              </div>
              <div className="p-6">
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Amount *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                      <input
                        type="number"
                        value={rechargeAmount}
                        onChange={(e) => setRechargeAmount(e.target.value)}
                        className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="Enter amount"
                        min="1"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label>
                    <input
                      type="text"
                      value={rechargeDescription}
                      onChange={(e) => setRechargeDescription(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="e.g. Cash deposit"
                    />
                  </div>
                </div>
                <div className="mt-8 flex justify-end gap-3 border-t border-gray-200 pt-5">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setRechargingId(null)}
                    className="px-5 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleRecharge(rechargingId)}
                    className="px-5 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium"
                    disabled={!rechargeAmount || Number(rechargeAmount) <= 0}
                  >
                    Confirm Recharge
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Transfer Modal */}
      <AnimatePresence>
        {transferringId && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50"
            onClick={() => setTransferringId(null)}
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 sticky top-0 z-10">
                <h2 className="text-xl font-bold text-white">Transfer Funds</h2>
              </div>
              <div className="p-6">
                <div className="space-y-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">From Wallet *</label>
                    <select
                      value={transferFromWalletId}
                      onChange={(e) => setTransferFromWalletId(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      disabled={loading}
                    >
                      <option value="">Select Source Wallet</option>
                      {wallets.map(wallet => (
                        <option key={wallet.id} value={wallet.id}>
                          {wallet.name} ({formatAmount(wallet.balance)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">To Wallet *</label>
                    <select
                      value={transferToWalletId}
                      onChange={(e) => setTransferToWalletId(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      disabled={loading}
                    >
                      <option value="">Select Destination Wallet</option>
                      {wallets.map(wallet => (
                        <option key={wallet.id} value={wallet.id}>
                          {wallet.name} ({formatAmount(wallet.balance)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Amount *</label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                      <input
                        type="number"
                        value={transferAmount}
                        onChange={(e) => setTransferAmount(e.target.value)}
                        className="w-full pl-8 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="Enter amount"
                        min="1"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">Description (Optional)</label>
                    <input
                      type="text"
                      value={transferDescription}
                      onChange={(e) => setTransferDescription(e.target.value)}
                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                      placeholder="e.g. Transfer to savings"
                    />
                  </div>
                </div>
                <div className="mt-8 flex justify-end gap-3 border-t border-gray-200 pt-5">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setTransferringId(null)}
                    className="px-5 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleTransfer}
                    className="px-5 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium"
                    disabled={!transferFromWalletId || !transferToWalletId || !transferAmount || Number(transferAmount) <= 0}
                  >
                    Confirm Transfer
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 pb-4 border-b border-gray-100">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Wallet Management</h1>
            <p className="text-gray-600 mt-1">Managing wallets for your center</p>
          </div>
          <div className="flex flex-wrap gap-3 mt-4 md:mt-0">
            <div className="px-3 py-1.5 bg-indigo-100 text-indigo-800 rounded-full text-sm font-medium flex items-center">
              <FiMapPin className="mr-1" />
              Center ID: {adminCentreId || "N/A"}
            </div>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              onClick={handleRefresh}
              className="flex items-center px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-all shadow-md hover:shadow-lg"
              disabled={loading || staffLoading}
            >
              <FiRefreshCw className={`mr-2 ${loading || staffLoading ? "animate-spin" : ""}`} />
              {loading || staffLoading ? "Refreshing..." : "Refresh"}
            </motion.button>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsAdding(!isAdding)}
              className="flex items-center px-4 py-2.5 bg-[#1e3a5f] text-white rounded-xl hover:bg-[#172a45] transition-all shadow-md hover:shadow-lg"
            >
              <FiPlus className="mr-2" />
              {isAdding ? "Cancel" : "Add New Wallet"}
            </motion.button>
          </div>
        </div>

        {/* Error Message */}
        {(staffError || filteredTransactions.length === 0) && !loading && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700"
          >
            {staffError || "No transactions for today."}
          </motion.div>
        )}

        {/* Loading State */}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white p-8 rounded-2xl shadow-lg text-center border border-gray-100"
          >
            <div className="mx-auto w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
              <svg className="animate-spin h-12 w-12 text-indigo-500" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
            </div>
            <p className="text-gray-600">Loading wallets...</p>
          </motion.div>
        )}

        {/* Stats Cards */}
        {!loading && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5 mb-8">
            {[
              { label: "Total Balance", value: formatAmount(totalBalance), icon: "💰", bgColor: "from-indigo-100 to-indigo-50", borderColor: "border-indigo-200" },
              { label: "Personal Wallets", value: personalCount, icon: "👤", bgColor: "from-emerald-100 to-emerald-50", borderColor: "border-emerald-200" },
              { label: "Shared Wallets", value: sharedCount, icon: "👥", bgColor: "from-amber-100 to-amber-50", borderColor: "border-amber-200" }
            ].map((stat, index) => (
              <motion.div 
                key={index} 
                className={`rounded-2xl shadow-lg p-5 border ${stat.borderColor} bg-gradient-to-br ${stat.bgColor} transition-all`}
                whileHover={{ y: -5, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)" }}
              >
                <div className="flex items-center">
                  <span className="text-3xl mr-3">{stat.icon}</span>
                  <div>
                    <p className="text-sm text-gray-600">{stat.label}</p>
                    <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        )}

        {/* Search */}
        {!loading && (
          <div className="bg-white p-5 rounded-2xl shadow-lg border border-gray-100 mb-8">
            <div className="flex items-center">
              <div className="relative w-full">
                <FiSearch className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search wallets or transactions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                />
              </div>
              <button 
                onClick={() => setSearchQuery("")}
                className="ml-3 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
              >
                Clear
              </button>
            </div>
            <div className="mt-3 text-sm text-indigo-600">
              <span className="font-medium">Search Tip:</span> Try searching for wallet names or transaction descriptions
            </div>
          </div>
        )}

        {/* Add Wallet Form */}
        {isAdding && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            className="bg-white p-5 rounded-2xl shadow-lg border border-gray-100 mb-8"
          >
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-gray-800">Add New Wallet</h2>
              <motion.button 
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setIsAdding(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FiX className="h-5 w-5" />
              </motion.button>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Wallet Name *</label>
                  <input
                    type="text"
                    value={newWallet.name}
                    onChange={(e) => setNewWallet({...newWallet, name: e.target.value})}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="e.g. HDFC Bank"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Initial Balance (₹) *</label>
                  <input
                    type="number"
                    value={newWallet.balance}
                    onChange={(e) => setNewWallet({...newWallet, balance: e.target.value})}
                    className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                    placeholder="₹ Amount"
                    min="0"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Wallet Type *</label>
                  <div className="grid grid-cols-3 gap-2">
                    {walletTypes.map(type => (
                      <motion.button
                        key={type.id}
                        type="button"
                        onClick={() => setNewWallet({...newWallet, walletType: type.id})}
                        className={`flex flex-col items-center justify-center p-2 rounded-lg border text-xs ${
                          newWallet.walletType === type.id 
                            ? "border-indigo-500 bg-indigo-50" 
                            : "border-gray-200 hover:bg-gray-50"
                        } transition-all`}
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        title={type.name}
                      >
                        <type.icon className={`h-4 w-4 ${type.color.split(' ')[1]} mb-1`} />
                        <span className="truncate w-full">{type.name}</span>
                      </motion.button>
                    ))}
                  </div>
                </div>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Wallet Status *</label>
                  <div className="flex gap-3">
                    <label className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        checked={newWallet.isOnline}
                        onChange={() => setNewWallet({...newWallet, isOnline: true})}
                        className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                      />
                      <div className="flex items-center text-sm">
                        <WalletIcon className="h-3.5 w-3.5 text-green-600 mr-1" />
                        <span>Online</span>
                      </div>
                    </label>
                    <label className="flex items-center gap-1.5">
                      <input
                        type="radio"
                        checked={!newWallet.isOnline}
                        onChange={() => setNewWallet({...newWallet, isOnline: false})}
                        className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                      />
                      <div className="flex items-center text-sm">
                        <WalletIcon className="h-3.5 w-3.5 text-gray-600 mr-1" />
                        <span>Offline</span>
                      </div>
                    </label>
                  </div>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Ownership Type *</label>
                  <div className="flex gap-3">
                    <label className="flex items-center text-sm">
                      <input
                        type="radio"
                        checked={newWallet.type === "personal"}
                        onChange={() => setNewWallet({...newWallet, type: "personal"})}
                        className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                      />
                      <span className="ml-1.5">Personal</span>
                    </label>
                    <label className="flex items-center text-sm">
                      <input
                        type="radio"
                        checked={newWallet.type === "shared"}
                        onChange={() => setNewWallet({...newWallet, type: "shared"})}
                        className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                      />
                      <span className="ml-1.5">Shared</span>
                    </label>
                  </div>
                </div>
                {newWallet.type === "personal" && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Assign to Staff</label>
                    <select
                      value={newWallet.staffId}
                      onChange={(e) => setNewWallet({...newWallet, staffId: e.target.value})}
                      className="w-full px-3 py-2.5 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                      disabled={staffLoading}
                    >
                      <option value="">Select Staff Member</option>
                      {staffMembers.map(staff => (
                        <option key={staff.id} value={staff.id}>
                          {staff.name} ({staff.role})
                        </option>
                      ))}
                    </select>
                  </div>
                )}
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleAddWallet}
                  className="w-full px-4 py-2.5 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium text-sm mt-2"
                  disabled={staffLoading}
                >
                  Add Wallet
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}

        {/* Wallets Grid */}
        {!loading && wallets.filter(w => w && w.wallet_type).length > 0 && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-10">
            {wallets
              .filter(wallet => wallet && wallet.wallet_type)
              .map((wallet) => {
                const WalletIcon = getWalletIcon(wallet.wallet_type);
                const type = walletTypes.find(t => t.id === wallet.wallet_type);
                const staff = getStaffMember(wallet.assigned_staff_id);
                const todayBalanceData = todayBalances[wallet.id];
                
                return (
                  <motion.div
                    key={wallet.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100"
                    whileHover={{ y: -5, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)" }}
                  >
                    <div className="p-6">
                      <div className="flex justify-between items-start">
                        <div>
                          <div className="flex items-center">
                            <div className={`bg-indigo-100 p-2 rounded-lg mr-3`}>
                              <WalletIcon />
                            </div>
                            <div>
                              <h2 className="text-lg font-bold text-gray-900">{wallet.name}</h2>
                              <span
                                className={`mt-1 px-2.5 py-1 rounded-full text-xs font-medium ${
                                  wallet.status === "online" ? "bg-emerald-100 text-emerald-800" : "bg-gray-100 text-gray-800"
                                }`}
                              >
                                {wallet.status.charAt(0).toUpperCase() + wallet.status.slice(1)}
                              </span>
                            </div>
                          </div>
                          <p className="text-gray-600 text-sm mt-3">
                            {wallet.lastTransaction || "No activity yet"}
                          </p>
                        </div>
                      </div>
                      <div className="mt-5 grid grid-cols-2 gap-3">
                        <div className="border border-gray-100 bg-gray-50 rounded-xl p-4">
                          <div className="flex items-center">
                            <FeeIcon />
                            <div className="ml-2">
                              <p className="text-xs text-gray-600">Opening Balance</p>
                              <p className="font-bold text-gray-900 text-lg">
                                {todayBalanceData?.opening_balance != null ? formatAmount(todayBalanceData.opening_balance) : "N/A"}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="border border-gray-100 bg-gray-50 rounded-xl p-4">
                          <div className="flex items-center">
                            <FeeIcon />
                            <div className="ml-2">
                              <p className="text-xs text-gray-600">Closing Balance</p>
                              <p className="font-bold text-gray-900 text-lg">
                                {todayBalanceData?.closing_balance != null ? formatAmount(todayBalanceData.closing_balance) : "N/A"}
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="border border-gray-100 bg-gray-50 rounded-xl p-4">
                          <div className="flex items-center">
                            <FeeIcon />
                            <div className="ml-2">
                              <p className="text-xs text-gray-600">Current Balance</p>
                              <p className="font-bold text-gray-900 text-lg">{formatAmount(wallet.balance)}</p>
                            </div>
                          </div>
                        </div>
                        <div className="border border-gray-100 bg-gray-50 rounded-xl p-4">
                          <div className="flex items-center">
                            <FeeIcon />
                            <div className="ml-2">
                              <p className="text-xs text-gray-600">Type</p>
                              <p className="font-bold text-gray-900 text-lg">{type?.name || "Wallet"}</p>
                            </div>
                          </div>
                        </div>
                      </div>
                      {!wallet.is_shared && wallet.assigned_staff_id && (
                        <div className="mt-4 border border-gray-100 bg-gray-50 rounded-xl p-4">
                          <div className="flex items-center">
                            <UserIcon />
                            <div className="ml-2">
                              <p className="text-xs text-gray-600">Assigned Staff</p>
                              <p className="font-bold text-gray-900">{staff.name}</p>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                    <div className="border-t border-gray-100 p-5 bg-gray-50">
                      <div className="flex flex-col sm:flex-row justify-between items-stretch gap-3">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => toggleDetails(wallet.id)}
                          className="text-gray-700 hover:text-indigo-600 text-sm font-medium flex items-center justify-center px-3 py-2 bg-white rounded-lg border border-gray-200 w-full sm:w-auto"
                        >
                          {expandedId === wallet.id ? "Hide Details" : "View Details"}
                          <ChevronIcon open={expandedId === wallet.id} />
                        </motion.button>

                        {/* Responsive action buttons */}
                        <div className="grid grid-cols-3 gap-2 sm:flex sm:gap-2">
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setEditingId(wallet.id)}
                            className="text-gray-600 hover:text-gray-900 text-sm font-medium flex flex-col sm:flex-row items-center justify-center p-2 sm:px-3 sm:py-2 bg-white rounded-lg border border-gray-200"
                            title="Edit"
                          >
                            <FiEdit className="h-4 w-4" />
                            <span className="text-xs mt-1 sm:hidden">Edit</span>
                            <span className="hidden sm:inline ml-1">Edit</span>
                          </motion.button>
                          
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              setTransferringId(wallet.id);
                              setTransferFromWalletId(wallet.id.toString());
                            }}
                            className="text-gray-600 hover:text-gray-900 text-sm font-medium flex flex-col sm:flex-row items-center justify-center p-2 sm:px-3 sm:py-2 bg-white rounded-lg border border-gray-200"
                            title="Transfer"
                          >
                            <FiArrowUp className="h-4 w-4" />
                            <span className="text-xs mt-1 sm:hidden">Transfer</span>
                            <span className="hidden sm:inline ml-1">Transfer</span>
                          </motion.button>
                          
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setRechargingId(wallet.id)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium flex flex-col sm:flex-row items-center justify-center p-2 sm:px-3 sm:py-2 bg-blue-50 rounded-lg"
                            title="Recharge"
                          >
                            <FiArrowDown className="h-4 w-4" />
                            <span className="text-xs mt-1 sm:hidden">Recharge</span>
                            <span className="hidden sm:inline ml-1">Recharge</span>
                          </motion.button>
                        </div>
                      </div>
                      
                      <AnimatePresence>
                        {expandedId === wallet.id && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: "auto", opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="mt-5"
                          >
                            {editingId === wallet.id ? (
                              <div>
                                <h4 className="font-medium text-gray-900 mb-4 text-lg">Edit Wallet</h4>
                                <div className="space-y-5">
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Wallet Name *</label>
                                    <input
                                      type="text"
                                      value={editForm.name}
                                      onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                      placeholder="e.g. HDFC Bank"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Balance (₹) *</label>
                                    <input
                                      type="number"
                                      value={editForm.balance}
                                      onChange={(e) => setEditForm({...editForm, balance: e.target.value})}
                                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                      placeholder="₹ Amount"
                                      min="0"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Wallet Type *</label>
                                    <div className="grid grid-cols-2 gap-2">
                                      {walletTypes.map(type => (
                                        <motion.button
                                          key={type.id}
                                          type="button"
                                          onClick={() => setEditForm({...editForm, walletType: type.id})}
                                          className={`flex flex-col items-center justify-center p-3 rounded-lg border ${
                                            editForm.walletType === type.id 
                                              ? "border-indigo-500 bg-indigo-50" 
                                              : "border-gray-200 hover:bg-gray-50"
                                          } transition-all`}
                                          whileHover={{ scale: 1.02 }}
                                          whileTap={{ scale: 0.98 }}
                                        >
                                          <type.icon className={`h-5 w-5 ${type.color.split(' ')[1]}`} />
                                          <span className="text-xs mt-1">{type.name}</span>
                                        </motion.button>
                                      ))}
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Wallet Status *</label>
                                    <div className="flex space-x-4">
                                      <label className="flex items-center gap-2">
                                        <input
                                          type="radio"
                                          checked={editForm.isOnline}
                                          onChange={() => setEditForm({...editForm, isOnline: true})}
                                          className="rounded text-indigo-600 focus:ring-indigo-500 h-5 w-5"
                                        />
                                        <div className="flex items-center">
                                          <WalletIcon className="h-4 w-4 text-green-600 mr-1" />
                                          <span>Online</span>
                                        </div>
                                      </label>
                                      <label className="flex items-center gap-2">
                                        <input
                                          type="radio"
                                          checked={!editForm.isOnline}
                                          onChange={() => setEditForm({...editForm, isOnline: false})}
                                          className="rounded text-indigo-600 focus:ring-indigo-500 h-5 w-5"
                                        />
                                        <div className="flex items-center">
                                          <WalletIcon className="h-4 w-4 text-gray-600 mr-1" />
                                          <span>Offline</span>
                                        </div>
                                      </label>
                                    </div>
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Wallet Type *</label>
                                    <div className="flex space-x-4">
                                      <label className="flex items-center">
                                        <input
                                          type="radio"
                                          checked={editForm.type === "personal"}
                                          onChange={() => setEditForm({...editForm, type: "personal"})}
                                          className="rounded text-indigo-600 focus:ring-indigo-500 h-5 w-5"
                                        />
                                        <span className="ml-2">Personal</span>
                                      </label>
                                      <label className="flex items-center">
                                        <input
                                          type="radio"
                                          checked={editForm.type === "shared"}
                                          onChange={() => setEditForm({...editForm, type: "shared"})}
                                          className="rounded text-indigo-600 focus:ring-indigo-500 h-5 w-5"
                                        />
                                        <span className="ml-2">Shared</span>
                                      </label>
                                    </div>
                                  </div>
                                  {editForm.type === "personal" && (
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-2">Assign to Staff</label>
                                      <select
                                        value={editForm.staffId}
                                        onChange={(e) => setEditForm({...editForm, staffId: e.target.value})}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        disabled={staffLoading}
                                      >
                                        <option value="">Select Staff Member</option>
                                        {staffMembers.map(staff => (
                                          <option key={staff.id} value={staff.id}>
                                            {staff.name} ({staff.role})
                                          </option>
                                        ))}
                                      </select>
                                    </div>
                                  )}
                                </div>
                                <div className="mt-8 flex justify-end gap-3 border-t border-gray-200 pt-5">
                                  <motion.button
                                    whileHover={{ scale: 1.03 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setEditingId(null)}
                                    className="px-5 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                                  >
                                    Cancel
                                  </motion.button>
                                  <motion.button
                                    whileHover={{ scale: 1.03 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleEditWallet}
                                    className="px-5 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium"
                                    disabled={staffLoading}
                                  >
                                    Save Changes
                                  </motion.button>
                                </div>
                              </div>
                            ) : (
                              <div>
                                <div className="mb-6">
                                  <h4 className="font-medium text-gray-900 mb-3 flex items-center">
                                    <WalletIcon className="mr-2" />
                                    Wallet Details
                                  </h4>
                                  <ul className="space-y-2">
                                    <li className="flex items-start bg-gray-50 rounded-xl p-3 border border-gray-100">
                                      <span className="text-indigo-500 mr-2">•</span>
                                      <span className="text-gray-700">Type: {type?.name || "Wallet"}</span>
                                    </li>
                                    <li className="flex items-start bg-gray-50 rounded-xl p-3 border border-gray-100">
                                      <span className="text-indigo-500 mr-2">•</span>
                                      <span className="text-gray-700">Status: {wallet.status.charAt(0).toUpperCase() + wallet.status.slice(1)}</span>
                                    </li>
                                    {!wallet.is_shared && wallet.assigned_staff_id && (
                                      <li className="flex items-start bg-gray-50 rounded-xl p-3 border border-gray-100">
                                        <span className="text-indigo-500 mr-2">•</span>
                                        <span className="text-gray-700">Assigned Staff: {staff.name} ({staff.role})</span>
                                      </li>
                                    )}
                                    <li className="flex items-start bg-gray-50 rounded-xl p-3 border border-gray-100">
                                      <span className="text-indigo-500 mr-2">•</span>
                                      <span className="text-gray-700">Wallet ID: #{wallet.id.toString().padStart(4, '0')}</span>
                                    </li>
                                  </ul>
                                </div>
                                <div className="flex justify-end gap-2">
                                  <Link to={`/dashboard/admin/wallets/${wallet.id}`}>
                                    <motion.button
                                      whileHover={{ scale: 1.02 }}
                                      whileTap={{ scale: 0.98 }}
                                      className="text-gray-600 hover:text-gray-900 text-sm font-medium flex items-center px-3 py-2 bg-white rounded-lg border border-gray-200"
                                    >
                                      <WalletIcon className="h-4 w-4 mr-1" />
                                      Activity
                                    </motion.button>
                                  </Link>
                                </div>
                              </div>
                            )}
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </motion.div>
                );
              })}
          </div>
        )}

        {/* Transactions Section */}
        {!loading && (
          <div className="mb-10">
            <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
              <h2 className="text-2xl font-bold text-gray-800">Today's Transactions</h2>
              <div className="flex gap-4">
                <div className="relative w-full md:w-80">
                  <FiSearch className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search today's transactions..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  />
                </div>
                <Link to="/dashboard/admin/transactions">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium"
                  >
                    View Full Transaction Report
                  </motion.button>
                </Link>
              </div>
            </div>
            <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Date</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Description</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Wallet</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Staff</th>
                      <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">Category</th>
                      <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-200">
                    {currentTransactions.length > 0 ? (
                      currentTransactions.map((transaction) => {
                        const staff = getTransactionStaff(transaction);
                        return (
                          <tr key={transaction.id} className="hover:bg-gray-50 transition-colors">
                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                              <div className="flex items-center">
                                <div className={`mr-3 h-2.5 w-2.5 rounded-full ${
                                  transaction.type === 'credit' ? 'bg-green-500' : 'bg-red-500'
                                }`}></div>
                                {transaction.created_at 
                                  ? new Date(transaction.created_at).toLocaleTimeString('en-IN', {
                                      hour: '2-digit',
                                      minute: '2-digit'
                                    })
                                  : "N/A"}
                              </div>
                            </td>
                            <td className="px-6 py-4">
                              <div className="text-sm font-medium text-gray-900">{transaction.description || "No description"}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="text-sm text-gray-600">{getWalletName(transaction.wallet_id)}</div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <div className="flex items-center">
                                {staff.name === "System" ? (
                                  <div className="w-8 h-8 rounded-full flex items-center justify-center bg-gray-200 mr-3">
                                    <WalletIcon className="h-4 w-4 text-gray-500" />
                                  </div>
                                ) : staff.photoUrl ? (
                                  <img 
                                    src={staff.photoUrl} 
                                    alt={staff.name} 
                                    className="w-8 h-8 rounded-full object-cover mr-3"
                                  />
                                ) : (
                                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white ${staff.avatarColor} mr-3`}>
                                    {staff.name.charAt(0)}
                                  </div>
                                )}
                                <div>
                                  <div className="text-sm font-medium text-gray-900">{staff.name}</div>
                                  <div className="text-xs text-gray-500">{staff.role}</div>
                                </div>
                              </div>
                            </td>
                            <td className="px-6 py-4 whitespace-nowrap">
                              <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-800">
                                {transaction.category || "General"}
                              </span>
                            </td>
                            <td className={`px-6 py-4 whitespace-nowrap text-right text-sm font-semibold ${
                              transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'
                            }`}>
                              <div className="flex justify-end items-center">
                                {transaction.type === 'credit' ? (
                                  <FiArrowDown className="h-4 w-4 text-green-500 mr-1" />
                                ) : (
                                  <FiArrowUp className="h-4 w-4 text-red-500 mr-1" />
                                )}
                                {formatAmount(transaction.amount)}
                              </div>
                            </td>
                          </tr>
                        );
                      })
                    ) : (
                      <tr>
                        <td colSpan="6" className="px-6 py-16 text-center">
                          <div className="flex flex-col items-center justify-center">
                            <FiSearch className="h-12 w-12 text-gray-400 mb-4" />
                            <h3 className="text-lg font-medium text-gray-700">No transactions today</h3>
                            <p className="text-gray-500 mt-2">
                              {searchQuery ? 'Try different search terms' : 'No transactions recorded for today.'}
                            </p>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              {filteredTransactions.length > 0 && (
                <div className="bg-gray-50 px-6 py-4 flex items-center justify-between border-t border-gray-200">
                  <div className="flex-1 flex justify-between sm:hidden">
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setCurrentPage(currentPage > 1 ? currentPage - 1 : 1)}
                      disabled={currentPage === 1}
                      className="relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Previous
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setCurrentPage(currentPage < totalPages ? currentPage + 1 : totalPages)}
                      disabled={currentPage === totalPages}
                      className="ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md text-gray-700 bg-white hover:bg-gray-50"
                    >
                      Next
                    </motion.button>
                  </div>
                  <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                    <div>
                      <p className="text-sm text-gray-700">
                        Showing <span className="font-medium">{indexOfFirstTransaction + 1}</span> to{' '}
                        <span className="font-medium">
                          {Math.min(indexOfLastTransaction, filteredTransactions.length)}
                        </span>{' '}
                        of <span className="font-medium">{filteredTransactions.length}</span> transactions
                      </p>
                    </div>
                    <div>
                      <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setCurrentPage(currentPage > 1 ? currentPage - 1 : 1)}
                          disabled={currentPage === 1}
                          className={`relative inline-flex items-center px-3 py-2 rounded-l-md text-sm font-medium ${
                            currentPage === 1 
                              ? 'text-gray-300 cursor-default bg-gray-50' 
                              : 'text-gray-500 hover:bg-gray-50 bg-white'
                          }`}
                        >
                          <FiArrowDown className="h-4 w-4 mr-1" />
                          Previous
                        </motion.button>
                        <div className="hidden md:flex bg-white">
                          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
                            <motion.button
                              key={page}
                              onClick={() => setCurrentPage(page)}
                              className={`relative inline-flex items-center px-4 py-2 text-sm font-medium ${
                                currentPage === page
                                  ? 'z-10 text-indigo-600 bg-indigo-50'
                                  : 'text-gray-500 hover:bg-gray-50'
                              }`}
                            >
                              {page}
                            </motion.button>
                          ))}
                        </div>
                        <motion.button
                          whileHover={{ scale: 1.03 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => setCurrentPage(currentPage < totalPages ? currentPage + 1 : totalPages)}
                          disabled={currentPage === totalPages}
                          className={`relative inline-flex items-center px-3 py-2 rounded-r-md text-sm font-medium ${
                            currentPage === totalPages 
                              ? 'text-gray-300 cursor-default bg-gray-50' 
                              : 'text-gray-500 hover:bg-gray-50 bg-white'
                          }`}
                        >
                          Next
                          <FiArrowUp className="h-4 w-4 ml-1" />
                        </motion.button>
                      </nav>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Staff Management Section */}
        {!loading && (
          <div className="mb-10">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">Staff Members</h2>
            {staffLoading ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white p-8 rounded-2xl shadow-lg text-center border border-gray-100"
              >
                <div className="mx-auto w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                  <FiRefreshCw className="h-12 w-12 text-indigo-500 animate-spin" />
                </div>
                <p className="text-gray-600">Loading staff...</p>
              </motion.div>
            ) : staffError ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white p-8 rounded-2xl shadow-lg text-center border border-gray-100"
              >
                <div className="mx-auto w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                  <UserIcon className="h-12 w-12 text-indigo-500" />
                </div>
                <h3 className="text-lg font-semibold mb-2">Error loading staff members</h3>
                <p className="text-gray-500 mb-4">{staffError}</p>
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={fetchStaffData}
                  className="px-5 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium"
                >
                  <FiRefreshCw className="mr-2 h-4 w-4" /> Retry
                </motion.button>
              </motion.div>
            ) : staffMembers.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white p-8 rounded-2xl shadow-lg text-center border border-gray-100"
              >
                <div className="mx-auto w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                  <UserIcon className="h-12 w-12 text-indigo-500" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No staff members found</h3>
                <p className="text-gray-500 mb-4">Add staff members to manage wallets</p>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {staffMembers.map(staff => (
                  <motion.div
                    key={staff.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="bg-white rounded-2xl shadow-lg border border-gray-100"
                    whileHover={{ y: -5, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)" }}
                  >
                    <div className="p-5 flex items-center">
                      {staff.photoUrl ? (
                        <img 
                          src={staff.photoUrl} 
                          alt={staff.name} 
                          className="w-12 h-12 rounded-full object-cover mr-4"
                        />
                      ) : (
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white ${staff.avatarColor} mr-4`}>
                          {staff.name.charAt(0)}
                        </div>
                      )}
                      <div className="flex-1">
                        <h3 className="font-bold text-gray-800">{staff.name}</h3>
                        <p className="text-sm text-gray-500">{staff.role}</p>
                      </div>
                      <div className="flex gap-2">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="text-gray-600 hover:text-gray-900 text-sm font-medium flex items-center px-3 py-2 bg-white rounded-lg border border-gray-200"
                        >
                          <UserIcon className="h-4 w-4 mr-1" />
                          Profile
                        </motion.button>
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          className="text-gray-600 hover:text-gray-900 text-sm font-medium flex items-center px-3 py-2 bg-white rounded-lg border border-gray-200"
                        >
                          <WalletIcon className="h-4 w-4 mr-1" />
                          Activity
                        </motion.button>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Empty state for wallets */}
        {!loading && wallets.filter(w => w && w.wallet_type).length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white p-8 rounded-2xl shadow-lg text-center border border-gray-100"
          >
            <div className="mx-auto w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
              <WalletIcon className="h-12 w-12 text-indigo-500" />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-2">No wallets found</h3>
            <p className="text-gray-600 mb-6 max-w-md mx-auto">
              Get started by adding your first wallet.
            </p>
            <motion.button
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setIsAdding(true)}
              className="px-5 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors shadow-md font-medium"
            >
              <FiPlus className="mr-2 h-4 w-4" /> Add New Wallet
            </motion.button>
          </motion.div>
        )}
      </div>
    </div>
  );
};

export default WalletManagement;
