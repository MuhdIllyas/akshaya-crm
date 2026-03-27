import { useState, useEffect, useMemo } from "react";
import axios from "axios";
import { motion, AnimatePresence } from "framer-motion";
import {
  FiPlus, FiRefreshCw, FiChevronDown, FiChevronUp, FiSearch,
  FiX, FiEdit, FiTrash, FiArrowDown, FiArrowUp, FiLock, FiFileText,
  FiChevronRight, FiCheckSquare, FiMapPin
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
  deleteWallet,
  getAuditLogs, getWalletTodayBalance
} from "@/services/walletService";
import { Link } from "react-router-dom";

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

const WalletManagementSuperAdmin = () => {
  const storedId = localStorage.getItem("id");
  const storedUser = localStorage.getItem("username");
  const storedRole = localStorage.getItem("role");
  const storedPhoto = localStorage.getItem("photoUrl");
  const currentStaff = {
    id: storedId ? Number(storedId) : null,
    username: storedUser || "Unknown",
    role: storedRole || "",
  };

  // Role-based access check
  const isSuperAdmin = currentStaff.role.toLowerCase() === "superadmin";

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
  const [auditLogs, setAuditLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [staffLoading, setStaffLoading] = useState(false);
  const [staffError, setStaffError] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [isAdding, setIsAdding] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchQuery, setSearchQuery] = useState("");
  const [auditSearchQuery, setAuditSearchQuery] = useState("");
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    balance: "",
    type: "personal",
    isOnline: true,
    staffId: "",
    walletType: "bank",
    permissions: []
  });
  const [newWallet, setNewWallet] = useState({
    name: "",
    balance: "",
    type: "personal",
    isOnline: true,
    staffId: "",
    walletType: "bank",
    permissions: [],
    centreId: "",
  });
  const [rechargingId, setRechargingId] = useState(null);
  const [rechargeAmount, setRechargeAmount] = useState("");
  const [rechargeDescription, setRechargeDescription] = useState("");
  const [transferringId, setTransferringId] = useState(null);
  const [transferFromWalletId, setTransferFromWalletId] = useState("");
  const [transferToWalletId, setTransferToWalletId] = useState("");
  const [transferAmount, setTransferAmount] = useState("");
  const [transferDescription, setTransferDescription] = useState("");
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  const [selectedWallets, setSelectedWallets] = useState([]);
  const [actionLoading, setActionLoading] = useState(false);
  const transactionsPerPage = 5;
  const [centres, setCentres] = useState([]);
  const [selectedCentre, setSelectedCentre] = useState('');
  const [auditCurrentPage, setAuditCurrentPage] = useState(1);
  const auditItemsPerPage = 5;
  const [auditLoading, setAuditLoading] = useState(false);

  // Get wallet name by ID
  const getWalletName = (id) => {
    const wallet = wallets.find(w => w.id === id);
    if (!wallet) return "Unknown Wallet";
    return wallet.centre_name ? `${wallet.centre_name} - ${wallet.name}` : wallet.name;
  };

  // Reset pagination when centre changes
  useEffect(() => {
    setCurrentPage(1);
    setAuditCurrentPage(1);
  }, [selectedCentre]);

  // Wallet Filteration for whole page
  const filteredWallets = selectedCentre
    ? wallets.filter((wallet) => wallet.centre_id === Number(selectedCentre))
    : wallets;

  useEffect(() => {
    if (!isSuperAdmin) {
      toast.error("Access denied. Superadmin privileges required.");
      window.location.href = '/dashboard';
      return;
    }
    fetchWalletData();
    fetchStaffData();
    fetchAuditLogs();
    fetchCentres();
  }, [isSuperAdmin]);

  // Fetch centres for superadmins
  const fetchCentres = async () => {
    try {
      const response = await axios.get(`${import.meta.env.VITE_API_URL}/api/centres`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      setCentres(response.data);
    } catch (err) {
      console.error('Error fetching centres:', err);
      toast.error('Failed to load centres.');
    }
  };

  const fetchWalletData = async (retryCount = 0) => {
    try {
      setLoading(true);
      const walletRes = await getWallets();
      const transactionRes = await getTransactions();
      setWallets(walletRes.data || []);
      setTransactions(transactionRes.data || []);

      // Fetch today's balances for all wallets (NEW)
        const balancesMap = {};

        for (const wallet of walletRes.data || []) {
          try {
            const balance = await getWalletTodayBalance(wallet.id);
            balancesMap[wallet.id] = balance;
          } catch (e) {
            balancesMap[wallet.id] = null;
          }
        }

        setTodayBalances(balancesMap);

    } catch (err) {
      console.error("Error loading wallet data:", err);
      if (retryCount < 2) {
        setTimeout(() => fetchWalletData(retryCount + 1), 1000);
        toast.warn("Retrying to load wallet data...");
      } else {
        setWallets([]);
        setTransactions([]);
        toast.error("Failed to load wallet data after retries.");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchStaffData = async (retryCount = 0) => {
    try {
      setStaffLoading(true);
      setStaffError(null);
      const staffData = await getStaff();
      const mappedStaff = staffData.map(staff => ({
        ...staff,
        photoUrl: staff.photo
      }));
      setStaffMembers(mappedStaff || []);
    } catch (err) {
      console.error("Error loading staff data:", err);
      if (retryCount < 2) {
        setTimeout(() => fetchStaffData(retryCount + 1), 1000);
        toast.warn("Retrying to load staff data...");
      } else {
        setStaffError(err.message);
        setStaffMembers([]);
        toast.error("Failed to load staff data after retries.");
      }
    } finally {
      setStaffLoading(false);
    }
  };

  const fetchAuditLogs = async (retryCount = 0) => {
    try {
      setAuditLoading(true);
      const auditRes = await getAuditLogs();
      let logs = [];
      if (Array.isArray(auditRes.data)) {
        logs = auditRes.data;
      } else if (auditRes.data?.data && Array.isArray(auditRes.data.data)) {
        logs = auditRes.data.data;
      } else if (auditRes.data?.logs && Array.isArray(auditRes.data.logs)) {
        logs = auditRes.data.logs;
      } else {
        console.warn('Unexpected audit logs response structure:', auditRes.data);
        logs = [];
      }
      setAuditLogs(logs);
    } catch (err) {
      console.error('Error loading audit logs:', {
        message: err.message,
        status: err.response?.status,
        data: err.response?.data,
      });
      if (err.response?.status === 404) {
        toast.error('Audit logs endpoint not found. Please check backend configuration.');
      } else if (retryCount < 2) {
        setTimeout(() => fetchAuditLogs(retryCount + 1), 1000);
        toast.warn('Retrying to load audit logs...');
      } else {
        setAuditLogs([]);
        toast.error('Failed to load audit logs after retries.');
      }
    } finally {
      setAuditLoading(false);
    }
  };

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
          walletType: walletToEdit.wallet_type,
          permissions: walletToEdit.permissions || []
        });
        if (expandedId !== editingId) {
          setExpandedId(editingId);
        }
      }
    }
  }, [editingId, wallets, expandedId]);

  const formatAmount = (amount) => {
    const num = typeof amount === 'string' ? 
      parseFloat(amount) : 
      (typeof amount === 'number' ? amount : 0);
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
      minimumFractionDigits: 0,
    }).format(num);
  };

  const handleRefresh = () => {
    setLoading(true);
    setStaffLoading(true);
    fetchWalletData();
    fetchStaffData();
    fetchAuditLogs();
    toast.success("Data refreshed successfully!");
  };

  const toggleDetails = (id) => {
    setExpandedId(expandedId === id ? null : id);
    if (editingId === id) {
      setEditingId(null);
    }
  };

  const handleAddWallet = async () => {
    if (!newWallet.name || !newWallet.balance || (isSuperAdmin && !newWallet.centreId)) {
      toast.error("Wallet name, balance, and centre (for superadmins) are required.");
      return;
    }

    try {
      setActionLoading(true);
      const payload = {
        name: newWallet.name,
        balance: Number(newWallet.balance),
        is_shared: newWallet.type === "shared",
        assigned_staff_id: newWallet.type === "personal" ? newWallet.staffId : null,
        wallet_type: newWallet.walletType,
        status: newWallet.isOnline ? "online" : "offline",
        permissions: newWallet.permissions,
        centre_id: newWallet.centreId,
      };

      await createWallet(payload);
      fetchWalletData();
      setNewWallet({
        name: "",
        balance: "",
        type: "personal",
        isOnline: true,
        staffId: "",
        walletType: "bank",
        permissions: [],
        centreId: "",
      });
      setIsAdding(false);
      toast.success("Wallet added successfully!");
    } catch (err) {
      console.error("Error creating wallet:", err);
      toast.error("Failed to create wallet: " + (err.message || "Unknown error"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleEditWallet = async () => {
    if (!editForm.name || !editForm.balance) {
      toast.error("Wallet name and balance are required.");
      return;
    }

    try {
      setActionLoading(true);
      const payload = {
        name: editForm.name,
        balance: Number(editForm.balance),
        is_shared: editForm.type === "shared",
        assigned_staff_id: editForm.type === "personal" ? editForm.staffId : null,
        wallet_type: editForm.walletType,
        status: editForm.isOnline ? "online" : "offline",
        permissions: editForm.permissions
      };

      await updateWallet(editingId, payload);
      fetchWalletData();
      setEditingId(null);
      toast.success("Wallet updated successfully!");
    } catch (err) {
      console.error("Error updating wallet:", err);
      toast.error("Failed to update wallet: " + (err.message || "Unknown error"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleDeleteWallet = async (walletId) => {
    if (!isSuperAdmin) {
      toast.error("Only superadmins can delete wallets.");
      return;
    }
    if (!window.confirm("Are you sure you want to delete this wallet? This action cannot be undone.")) {
      return;
    }

    try {
      setActionLoading(true);
      await deleteWallet(walletId);
      fetchWalletData();
      setSelectedWallets(selectedWallets.filter(id => id !== walletId));
      toast.success("Wallet deleted successfully!");
    } catch (err) {
      console.error("Error deleting wallet:", err);
      toast.error("Failed to delete wallet: " + (err.message || "Unknown error"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (!isSuperAdmin) {
      toast.error("Only superadmins can perform bulk deletion.");
      return;
    }
    if (selectedWallets.length === 0) {
      toast.error("No wallets selected for deletion.");
      return;
    }
    if (!window.confirm(`Are you sure you want to delete ${selectedWallets.length} wallet(s)? This action cannot be undone.`)) {
      return;
    }

    try {
      setActionLoading(true);
      for (const walletId of selectedWallets) {
        await deleteWallet(walletId);
      }
      fetchWalletData();
      setSelectedWallets([]);
      toast.success(`${selectedWallets.length} wallet(s) deleted successfully!`);
    } catch (err) {
      console.error("Error during bulk deletion:", err);
      toast.error("Failed to delete some wallets: " + (err.message || "Unknown error"));
    } finally {
      setActionLoading(false);
    }
  };

  const handleRecharge = async (walletId) => {
    if (!rechargeAmount || Number(rechargeAmount) <= 0) {
      toast.error("Please enter a valid recharge amount.");
      return;
    }
    
    try {
      setActionLoading(true);
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
      toast.error("Recharge failed: " + (err.message || "Unknown error"));
    } finally {
      setActionLoading(false);
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
    window.location.href = '/login';
    return;
  }

  try {
    setActionLoading(true);
    const amount = Number(transferAmount);
    const fromWallet = wallets.find(w => w.id === Number(transferFromWalletId));
    const toWallet = wallets.find(w => w.id === Number(transferToWalletId));
    const description = transferDescription || `Transferred ${amount} from ${fromWallet?.name || 'Unknown Wallet'} (${fromWallet?.centre_name || 'Unknown Centre'}) to ${toWallet?.name || 'Unknown Wallet'} (${toWallet?.centre_name || 'Unknown Centre'})`;
    const payload = {
      from_wallet_id: Number(transferFromWalletId),
      to_wallet_id: Number(transferToWalletId),
      amount,
      description,
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
    toast.error(err.response?.data?.error || "Transfer failed: " + (err.message || "Unknown error"));
  } finally {
    setActionLoading(false);
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

  const totalBalance = useMemo(() => 
    filteredWallets.reduce((sum, wallet) => sum + (Number(wallet?.balance) || 0), 0),
    [filteredWallets]
  );
  const personalCount = useMemo(() => 
    filteredWallets.filter(w => w && !w.is_shared).length,
    [filteredWallets]
  );
  const sharedCount = useMemo(() => 
    filteredWallets.filter(w => w && w.is_shared).length,
    [filteredWallets]
  );

  // Filter transactions by selected centre and search query and today's date
  const filteredTransactions = useMemo(() => {
  const today = new Date().toISOString().split('T')[0];
  return transactions.filter(t => {
    const wallet = wallets.find(w => w.id === t.wallet_id);
    const matchesCentre = selectedCentre ? wallet && wallet.centre_id === Number(selectedCentre) : true;
    const matchesSearch =
      t.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      t.category?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      getTransactionStaff(t).name.toLowerCase().includes(searchQuery.toLowerCase());
    const isToday = t.created_at.startsWith(today);
    return matchesCentre && matchesSearch && isToday;
  });
}, [transactions, wallets, selectedCentre, searchQuery]);

  // Filter audit logs by selected centre and search query and today's date
  const filteredAuditLogs = useMemo(() => {
  const today = new Date().toISOString().split('T')[0];
  return auditLogs.filter(log => {
    const matchesCentre = selectedCentre ? log.centre_id === Number(selectedCentre) : true;
    const matchesSearch =
      log.action?.toLowerCase().includes(auditSearchQuery.toLowerCase()) ||
      log.performed_by?.toLowerCase().includes(auditSearchQuery.toLowerCase()) ||
      log.details?.toLowerCase().includes(auditSearchQuery.toLowerCase()) ||
      (log.centre_name && log.centre_name.toLowerCase().includes(auditSearchQuery.toLowerCase()));
    const isToday = log.created_at.startsWith(today);
    return matchesCentre && matchesSearch && isToday;
  });
}, [auditLogs, selectedCentre, auditSearchQuery]);

  // Filter staff by selected centre
  const filteredStaff = staffMembers.filter(staff => 
    selectedCentre ? staff.centreId === Number(selectedCentre) : true
  );

  const indexOfLastTransaction = currentPage * transactionsPerPage;
  const indexOfFirstTransaction = indexOfLastTransaction - transactionsPerPage;
  const currentTransactions = filteredTransactions.slice(indexOfFirstTransaction, indexOfLastTransaction);
  const totalPages = Math.ceil(filteredTransactions.length / transactionsPerPage);

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50 p-4 sm:p-6">
      <ToastContainer />
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 pb-4 border-b border-gray-100">
          <div className="mb-4 md:mb-0">
            <h1 className="text-2xl font-bold text-gray-800">Superadmin Wallet Management</h1>
            <p className="text-gray-600 mt-1">
              Advanced control and oversight of all financial accounts and transactions
            </p>
          </div>
          
          {/* Button Group */}
          <div className="w-full md:w-auto">
            <div className="flex flex-col sm:flex-row flex-wrap gap-3">
              {/* Centre Selection */}
              <motion.div 
                className="relative w-full sm:w-auto min-w-[180px]"
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
              >
                <div className="flex items-center gap-2 bg-white text-gray-700 border border-gray-300 rounded-xl shadow-md hover:shadow-lg transition-all pl-4 pr-10 py-2.5 cursor-pointer">
                  <FiMapPin className="text-indigo-600 flex-shrink-0" />
                  <span className="text-sm font-medium truncate max-w-[160px]">
                    {selectedCentre 
                      ? centres.find(c => c.id === Number(selectedCentre))?.name || "Selected Centre"
                      : "All Centres"}
                  </span>
                </div>
                <select
                  value={selectedCentre}
                  onChange={(e) => setSelectedCentre(e.target.value)}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  aria-label="Filter wallets by centre"
                >
                  <option value="">All Centres</option>
                  {centres.map((centre) => (
                    <option key={centre.id} value={centre.id}>
                      {centre.name}
                    </option>
                  ))}
                </select>
                <FiChevronDown className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-500 pointer-events-none" />
              </motion.div>

              {/* Refresh Button */}
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleRefresh}
                className="w-full sm:w-auto flex items-center justify-center px-4 py-2.5 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50 transition-all shadow-md hover:shadow-lg text-sm font-medium"
                disabled={loading || staffLoading || actionLoading}
                aria-label="Refresh data"
              >
                <FiRefreshCw className={`mr-2 ${loading || staffLoading ? "animate-spin" : ""}`} />
                {loading || staffLoading ? "Refreshing..." : "Refresh"}
              </motion.button>

              {/* Add New Wallet Button */}
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setIsAdding(!isAdding)}
                className="w-full sm:w-auto flex items-center justify-center px-4 py-2.5 bg-[#1e3a5f] text-white rounded-xl hover:bg-[#172a45] transition-all shadow-md hover:shadow-lg text-sm font-medium"
                disabled={actionLoading}
                aria-label={isAdding ? "Cancel adding wallet" : "Add new wallet"}
              >
                <FiPlus className="mr-2" />
                {isAdding ? "Cancel" : "Add Wallet"}
              </motion.button>

              {/* View Audit Logs Button */}
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowAuditLogs(!showAuditLogs)}
                className="w-full sm:w-auto flex items-center justify-center px-4 py-2.5 bg-purple-600 text-white rounded-xl hover:bg-purple-700 transition-all shadow-md hover:shadow-lg text-sm font-medium"
                disabled={actionLoading || !isSuperAdmin}
                aria-label={showAuditLogs ? "Hide audit logs" : "View audit logs"}
              >
                <FiFileText className="mr-2" />
                {showAuditLogs ? "Hide Logs" : "Audit Logs"}
              </motion.button>

              {/* Bulk Delete Button */}
              {selectedWallets.length > 0 && (
                <motion.button
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleBulkDelete}
                  className="w-full sm:w-auto flex items-center justify-center px-4 py-2.5 bg-red-600 text-white rounded-xl hover:bg-red-700 transition-all shadow-md hover:shadow-lg text-sm font-medium"
                  disabled={actionLoading || !isSuperAdmin}
                  aria-label="Delete selected wallets"
                >
                  <FiTrash className="mr-2" />
                  Delete {selectedWallets.length} Wallet(s)
                </motion.button>
              )}
            </div>
          </div>
        </div>

        {/* Error Message */}
        {(staffError || filteredTransactions.length === 0) && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700"
            role="alert"
          >
            {staffError || "No transactions match your search."}
          </motion.div>
        )}

        {/* Loading State */}
        {loading && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="bg-white p-8 rounded-2xl shadow-lg text-center border border-gray-100"
            role="status"
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
              { 
                label: "Personal Wallets", 
                value: personalCount,
                icon: "👤",
                bgColor: "from-emerald-100 to-emerald-50",
                borderColor: "border-emerald-200"
              },
              { 
                label: "Shared Wallets", 
                value: sharedCount,
                icon: "👥",
                bgColor: "from-amber-100 to-amber-50",
                borderColor: "border-amber-200"
              }
            ].map((stat, index) => (
              <motion.div 
                key={index} 
                className={`rounded-2xl shadow-lg p-5 border ${stat.borderColor} bg-gradient-to-br ${stat.bgColor} transition-all`}
                whileHover={{ y: -5, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)" }}
                role="region"
                aria-label={stat.label}
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
                <FiSearch className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" aria-hidden="true" />
                <input
                  type="text"
                  placeholder="Search wallets, transactions, or audit logs..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  aria-label="Search wallets and transactions"
                />
              </div>
              <button 
                onClick={() => setSearchQuery("")}
                className="ml-3 px-4 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                aria-label="Clear search"
              >
                Clear
              </button>
            </div>
            <div className="mt-3 text-sm text-indigo-600">
              <span className="font-medium">Search Tip:</span> Try searching for wallet names, transaction descriptions, or staff names
            </div>
          </div>
        )}

        {/* Add Wallet Form */}
        <AnimatePresence>
          {isAdding && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50"
              onClick={() => setIsAdding(false)}
              role="dialog"
              aria-modal="true"
              aria-label="Add new wallet modal"
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-5 sticky top-0 z-10">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-bold text-white">Add New Wallet</h2>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setIsAdding(false)}
                      className="text-white hover:text-gray-200"
                      aria-label="Close add wallet modal"
                    >
                      <FiX className="h-5 w-5" />
                    </motion.button>
                  </div>
                </div>
                <div className="p-5">
                  <div className="space-y-4">
                    {isSuperAdmin && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="centre-select">
                          Centre *
                        </label>
                        <select
                          id="centre-select"
                          value={newWallet.centreId}
                          onChange={(e) => setNewWallet({ ...newWallet, centreId: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                          required
                          aria-required="true"
                          aria-label="Select centre"
                        >
                          <option value="">Select Centre</option>
                          {centres.map((centre) => (
                            <option key={centre.id} value={centre.id}>
                              {centre.name}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="wallet-name">
                        Wallet Name *
                      </label>
                      <input
                        id="wallet-name"
                        type="text"
                        value={newWallet.name}
                        onChange={(e) => setNewWallet({ ...newWallet, name: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                        placeholder="e.g. HDFC Bank"
                        required
                        aria-required="true"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="initial-balance">
                        Initial Balance (₹) *
                      </label>
                      <input
                        id="initial-balance"
                        type="number"
                        value={newWallet.balance}
                        onChange={(e) => setNewWallet({ ...newWallet, balance: e.target.value })}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                        placeholder="₹ Amount"
                        min="0"
                        required
                        aria-required="true"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Wallet Type *</label>
                      <div className="grid grid-cols-3 gap-2">
                        {walletTypes.map((type) => (
                          <motion.button
                            key={type.id}
                            type="button"
                            onClick={() => setNewWallet({ ...newWallet, walletType: type.id })}
                            className={`flex flex-col items-center justify-center p-2 rounded-lg border ${
                              newWallet.walletType === type.id
                                ? "border-indigo-500 bg-indigo-50"
                                : "border-gray-200 hover:bg-gray-50"
                            } transition-all text-xs`}
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            aria-label={`Select ${type.name} wallet type`}
                          >
                            <type.icon className={`h-4 w-4 ${type.color.split(" ")[1]}`} />
                            <span className="mt-1">{type.name}</span>
                          </motion.button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Wallet Status *</label>
                      <div className="flex space-x-4">
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name="wallet-status"
                            checked={newWallet.isOnline}
                            onChange={() => setNewWallet({ ...newWallet, isOnline: true })}
                            className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                            aria-label="Online wallet status"
                          />
                          <div className="flex items-center">
                            <WalletIcon className="h-4 w-4 text-green-600 mr-1" />
                            Online
                          </div>
                        </label>
                        <label className="flex items-center gap-2 text-sm">
                          <input
                            type="radio"
                            name="wallet-status"
                            checked={!newWallet.isOnline}
                            onChange={() => setNewWallet({ ...newWallet, isOnline: false })}
                            className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                            aria-label="Offline wallet status"
                          />
                          <div className="flex items-center">
                            <WalletIcon className="h-4 w-4 text-gray-600 mr-1" />
                            Offline
                          </div>
                        </label>
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Wallet Type *</label>
                      <div className="flex space-x-4">
                        <label className="flex items-center text-sm">
                          <input
                            type="radio"
                            name="wallet-type"
                            checked={newWallet.type === "personal"}
                            onChange={() => setNewWallet({ ...newWallet, type: "personal" })}
                            className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                            aria-label="Personal wallet type"
                          />
                          <span className="ml-2">Personal</span>
                        </label>
                        <label className="flex items-center text-sm">
                          <input
                            type="radio"
                            name="wallet-type"
                            checked={newWallet.type === "shared"}
                            onChange={() => setNewWallet({ ...newWallet, type: "shared" })}
                            className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                            aria-label="Shared wallet type"
                          />
                          <span className="ml-2">Shared</span>
                        </label>
                      </div>
                    </div>
                    {newWallet.type === "personal" && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="staff-select">
                          Assign to Staff
                        </label>
                        <select
                          id="staff-select"
                          value={newWallet.staffId}
                          onChange={(e) => setNewWallet({ ...newWallet, staffId: e.target.value })}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                          disabled={staffLoading}
                          aria-label="Select staff member"
                        >
                          <option value="">Select Staff Member</option>
                          {staffMembers.map((staff) => (
                            <option key={staff.id} value={staff.id}>
                              {staff.name} ({staff.role})
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Permissions</label>
                      <div className="grid grid-cols-2 gap-2">
                        {["view", "edit", "transfer", "recharge"].map((perm) => (
                          <label key={perm} className="flex items-center gap-2 text-sm">
                            <input
                              type="checkbox"
                              checked={newWallet.permissions.includes(perm)}
                              onChange={(e) => {
                                const updatedPermissions = e.target.checked
                                  ? [...newWallet.permissions, perm]
                                  : newWallet.permissions.filter((p) => p !== perm);
                                setNewWallet({ ...newWallet, permissions: updatedPermissions });
                              }}
                              className="rounded text-indigo-600 focus:ring-indigo-500 h-4 w-4"
                              aria-label={`Toggle ${perm} permission`}
                            />
                            <span className="capitalize">{perm}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end gap-3 border-t border-gray-200 pt-4">
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setIsAdding(false)}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm"
                      aria-label="Cancel"
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={handleAddWallet}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium flex items-center text-sm"
                      disabled={staffLoading || actionLoading}
                      aria-label="Add wallet"
                    >
                      {actionLoading ? <FiRefreshCw className="animate-spin mr-2 h-4 w-4" /> : null}
                      {actionLoading ? "Adding..." : "Add Wallet"}
                    </motion.button>
                  </div>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
        
        {/* Audit Logs Section */}
        {showAuditLogs && isSuperAdmin && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="bg-white p-6 rounded-2xl shadow-lg border border-gray-100 mb-8"
            role="region"
            aria-label="Audit logs"
          >
            <div className="flex justify-between items-center mb-5">
              <div className="flex items-center gap-3">
                <h2 className="text-xl font-bold text-gray-800">Today's Audit Logs</h2>
                <Link
                  to="/dashboard/superadmin/reports#audit-logs"
                  className="text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center"
                >
                  View All Audit Logs <FiChevronRight className="ml-1" />
                </Link>
              </div>
              <motion.button
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowAuditLogs(false)}
                className="text-gray-500 hover:text-gray-700"
                aria-label="Close audit logs"
              >
                <FiX className="h-5 w-5" />
              </motion.button>
            </div>
            <div className="mb-5">
              <div className="relative w-full">
                <FiSearch className="absolute left-4 top-3.5 h-5 w-5 text-gray-400" aria-hidden="true" />
                <input
                  type="text"
                  placeholder="Search today's audit logs..."
                  value={auditSearchQuery}
                  onChange={(e) => setAuditSearchQuery(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                  aria-label="Search today's audit logs"
                />
              </div>
              <button
                onClick={() => setAuditSearchQuery('')}
                className="mt-3 px-4 py-2 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                aria-label="Clear audit log search"
              >
                Clear
              </button>
            </div>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider" scope="col">Time</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider" scope="col">Action</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider" scope="col">Performed By</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider" scope="col">Centre</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider" scope="col">Details</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {auditLoading ? (
                    <tr>
                      <td colSpan="5" className="px-6 py-16 text-center">
                        <FiRefreshCw className="h-12 w-12 text-indigo-500 animate-spin mx-auto" />
                        <p className="text-gray-600 mt-4">Loading audit logs...</p>
                      </td>
                    </tr>
                  ) : filteredAuditLogs.length > 0 ? (
                    filteredAuditLogs
                      .slice((auditCurrentPage - 1) * auditItemsPerPage, auditCurrentPage * auditItemsPerPage)
                      .map((log) => (
                        <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {new Date(log.created_at).toLocaleTimeString('en-IN', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })}
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{log.action}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{log.performed_by}</td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                            {log.centre_name || 'System'}
                          </td>
                          <td className="px-6 py-4 text-sm text-gray-600">{log.details}</td>
                        </tr>
                      ))
                  ) : (
                    <tr>
                      <td colSpan="5" className="px-6 py-16 text-center">
                        <div className="flex flex-col items-center justify-center">
                          <FiFileText className="h-12 w-12 text-gray-400 mb-4" />
                          <h3 className="text-lg font-medium text-gray-700">No audit logs for today</h3>
                          <p className="text-gray-500 mt-2">
                            {auditSearchQuery ? 'No audit logs match your search for today' : 'No audit logs recorded for today'}
                          </p>
                          <Link
                            to="/dashboard/superadmin/reports#audit-logs"
                            className="mt-4 text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center"
                          >
                            View All Audit Logs <FiChevronRight className="ml-1" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {filteredAuditLogs.length > auditItemsPerPage && (
              <div className="flex justify-between items-center px-6 py-4 bg-gray-50 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  Showing {(auditCurrentPage - 1) * auditItemsPerPage + 1} to{' '}
                  {Math.min(auditCurrentPage * auditItemsPerPage, filteredAuditLogs.length)} of{' '}
                  {filteredAuditLogs.length} audit logs for today
                </div>
                <div className="flex gap-2">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setAuditCurrentPage((prev) => Math.max(prev - 1, 1))}
                    disabled={auditCurrentPage === 1}
                    className={`px-4 py-2 rounded-xl text-sm font-medium ${
                      auditCurrentPage === 1
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                    }`}
                    aria-label="Previous audit log page"
                  >
                    Previous
                  </motion.button>
                  {Array.from({ length: Math.ceil(filteredAuditLogs.length / auditItemsPerPage) }, (_, i) => i + 1)
                    .filter((page) => Math.abs(page - auditCurrentPage) <= 2 || page === 1 || page === Math.ceil(filteredAuditLogs.length / auditItemsPerPage))
                    .map((page) => (
                      <motion.button
                        key={page}
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => setAuditCurrentPage(page)}
                        className={`px-4 py-2 rounded-xl text-sm font-medium ${
                          auditCurrentPage === page
                            ? 'bg-indigo-600 text-white'
                            : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                        }`}
                        aria-label={`Go to audit log page ${page}`}
                      >
                        {page}
                      </motion.button>
                    ))}
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setAuditCurrentPage((prev) => Math.min(prev + 1, Math.ceil(filteredAuditLogs.length / auditItemsPerPage)))}
                    disabled={auditCurrentPage === Math.ceil(filteredAuditLogs.length / auditItemsPerPage)}
                    className={`px-4 py-2 rounded-xl text-sm font-medium ${
                      auditCurrentPage === Math.ceil(filteredAuditLogs.length / auditItemsPerPage)
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                    }`}
                    aria-label="Next audit log page"
                  >
                    Next
                  </motion.button>
                </div>
              </div>
            )}
          </motion.div>
        )}
        
        {/* Wallets Grid - Responsive */}
        {!loading && wallets.filter(w => w && w.wallet_type).length > 0 && (
          <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-3">
            {filteredWallets
              .filter(wallet => wallet && wallet.wallet_type)
              .map((wallet) => {
                const WalletIcon = getWalletIcon(wallet.wallet_type);
                const type = walletTypes.find(t => t.id === wallet.wallet_type);
                const staff = getStaffMember(wallet.assigned_staff_id);
                
                return (
                  <motion.div
                    key={wallet.id}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.3 }}
                    className="bg-white rounded-2xl shadow-lg overflow-hidden border border-gray-100"
                    whileHover={{ y: -5, boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1)" }}
                    role="region"
                    aria-label={`Wallet ${wallet.name}`}
                  >
                    <div className="p-6">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center">
                          {isSuperAdmin && (
                            <input
                              type="checkbox"
                              checked={selectedWallets.includes(wallet.id)}
                              onChange={(e) => {
                                setSelectedWallets(e.target.checked
                                  ? [...selectedWallets, wallet.id]
                                  : selectedWallets.filter(id => id !== wallet.id));
                              }}
                              className="mr-3 rounded text-indigo-600 focus:ring-indigo-500 h-5 w-5"
                              aria-label={`Select wallet ${wallet.name} for bulk actions`}
                            />
                          )}
                          <div>
                            <div className="flex items-center min-w-0 flex-1">
                              <div className={`bg-indigo-100 p-2 rounded-lg mr-3`}>
                                <WalletIcon />
                              </div>
                              <div className="min-w-0">
                                <h2 className="text-lg font-bold text-gray-900 truncate"
                                title={wallet.centre_name ? `${wallet.centre_name} - ${wallet.name}` : wallet.name}
                                >
                                  {wallet.centre_name ? `${wallet.centre_name} - ${wallet.name}` : wallet.name}
                                </h2>
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
                      </div>
                      <div className="mt-5 grid grid-cols-2 gap-3">
                        <div className="border border-gray-100 bg-gray-50 rounded-xl p-4">
                          <div className="flex items-center">
                            <FeeIcon />
                            <div className="ml-2">
                              <p className="text-xs text-gray-600">Balance</p>
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
                        <div className="border border-gray-100 bg-gray-50 rounded-xl p-4">
                          <div className="flex items-center">
                            <FeeIcon />
                            <div className="ml-2">
                              <p className="text-xs text-gray-600">Opening Balance</p>
                              <p className="font-bold text-gray-900 text-lg">
                                {todayBalances[wallet.id]?.opening_balance != null
                                  ? formatAmount(todayBalances[wallet.id].opening_balance)
                                  : "N/A"}
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
                                {todayBalances[wallet.id]?.closing_balance != null
                                  ? formatAmount(todayBalances[wallet.id].closing_balance)
                                  : "N/A"}
                              </p>
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
                      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
                        <motion.button
                          whileHover={{ scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={() => toggleDetails(wallet.id)}
                          className="text-gray-700 hover:text-indigo-600 text-sm font-medium flex items-center px-3 py-2 bg-white rounded-lg border border-gray-200"
                          aria-label={expandedId === wallet.id ? `Hide details for ${wallet.name}` : `View details for ${wallet.name}`}
                        >
                          {expandedId === wallet.id ? "Hide Details" : "View Details"}
                          <ChevronIcon open={expandedId === wallet.id} />
                        </motion.button>
                        <div className="flex flex-wrap gap-2">
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setEditingId(wallet.id)}
                            className="text-gray-600 hover:text-gray-900 text-sm font-medium flex items-center px-3 py-2 bg-white rounded-lg border border-gray-200"
                            disabled={actionLoading}
                            aria-label={`Edit ${wallet.name}`}
                          >
                            <FiEdit className="h-4 w-4 mr-1" />
                            <span className="hidden sm:inline">Edit</span>
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => {
                              setTransferringId(wallet.id);
                              setTransferFromWalletId(wallet.id.toString());
                            }}
                            className="text-gray-600 hover:text-gray-900 text-sm font-medium flex items-center px-3 py-2 bg-white rounded-lg border border-gray-200"
                            disabled={actionLoading}
                            aria-label={`Transfer from ${wallet.name}`}
                          >
                            <FiArrowUp className="h-4 w-4 mr-1" />
                            <span className="hidden sm:inline">Transfer</span>
                          </motion.button>
                          <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={() => setRechargingId(wallet.id)}
                            className="text-blue-600 hover:text-blue-800 text-sm font-medium flex items-center px-3 py-2 bg-blue-50 rounded-lg"
                            disabled={actionLoading}
                            aria-label={`Recharge ${wallet.name}`}
                          >
                            <FiArrowDown className="h-4 w-4 mr-1" />
                            <span className="hidden sm:inline">Recharge</span>
                          </motion.button>
                          {isSuperAdmin && (
                            <motion.button
                              whileHover={{ scale: 1.02 }}
                              whileTap={{ scale: 0.98 }}
                              onClick={() => handleDeleteWallet(wallet.id)}
                              className="text-red-600 hover:text-red-800 text-sm font-medium flex items-center px-3 py-2 bg-red-50 rounded-lg"
                              disabled={actionLoading}
                              aria-label={`Delete ${wallet.name}`}
                            >
                              {actionLoading && selectedWallets.includes(wallet.id) ? (
                                <FiRefreshCw className="h-4 w-4 mr-1 animate-spin" />
                              ) : (
                                <FiTrash className="h-4 w-4 mr-1" />
                              )}
                              <span className="hidden sm:inline">Delete</span>
                            </motion.button>
                          )}
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
                                    <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="edit-wallet-name">Wallet Name *</label>
                                    <input
                                      id="edit-wallet-name"
                                      type="text"
                                      value={editForm.name}
                                      onChange={(e) => setEditForm({...editForm, name: e.target.value})}
                                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                      placeholder="e.g. HDFC Bank"
                                      required
                                      aria-required="true"
                                    />
                                  </div>
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="edit-balance">Balance (₹) *</label>
                                    <input
                                      id="edit-balance"
                                      type="number"
                                      value={editForm.balance}
                                      onChange={(e) => setEditForm({...editForm, balance: e.target.value})}
                                      className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                      placeholder="₹ Amount"
                                      min="0"
                                      required
                                      aria-required="true"
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
                                          aria-label={`Select ${type.name} wallet type`}
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
                                          name="edit-wallet-status"
                                          checked={editForm.isOnline}
                                          onChange={() => setEditForm({...editForm, isOnline: true})}
                                          className="rounded text-indigo-600 focus:ring-indigo-500 h-5 w-5"
                                          aria-label="Online wallet status"
                                        />
                                        <div className="flex items-center">
                                          <WalletIcon className="h-4 w-4 text-green-600 mr-1" />
                                          <span>Online</span>
                                        </div>
                                      </label>
                                      <label className="flex items-center gap-2">
                                        <input
                                          type="radio"
                                          name="edit-wallet-status"
                                          checked={!editForm.isOnline}
                                          onChange={() => setEditForm({...editForm, isOnline: false})}
                                          className="rounded text-indigo-600 focus:ring-indigo-500 h-5 w-5"
                                          aria-label="Offline wallet status"
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
                                          name="edit-wallet-type"
                                          checked={editForm.type === "personal"}
                                          onChange={() => setEditForm({...editForm, type: "personal"})}
                                          className="rounded text-indigo-600 focus:ring-indigo-500 h-5 w-5"
                                          aria-label="Personal wallet type"
                                        />
                                        <span className="ml-2">Personal</span>
                                      </label>
                                      <label className="flex items-center">
                                        <input
                                          type="radio"
                                          name="edit-wallet-type"
                                          checked={editForm.type === "shared"}
                                          onChange={() => setEditForm({...editForm, type: "shared"})}
                                          className="rounded text-indigo-600 focus:ring-indigo-500 h-5 w-5"
                                          aria-label="Shared wallet type"
                                        />
                                        <span className="ml-2">Shared</span>
                                      </label>
                                    </div>
                                  </div>
                                  {editForm.type === "personal" && (
                                    <div>
                                      <label className="block text-sm font-medium text-gray-700 mb-2" htmlFor="edit-staff-select">Assign to Staff</label>
                                      <select
                                        id="edit-staff-select"
                                        value={editForm.staffId}
                                        onChange={(e) => setEditForm({...editForm, staffId: e.target.value})}
                                        className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                                        disabled={staffLoading}
                                        aria-label="Select staff member"
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
                                  <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-2">Permissions</label>
                                    <div className="flex flex-wrap gap-2">
                                      {['view', 'edit', 'transfer', 'recharge'].map(perm => (
                                        <label key={perm} className="flex items-center gap-2">
                                          <input
                                            type="checkbox"
                                            checked={editForm.permissions.includes(perm)}
                                            onChange={(e) => {
                                              const updatedPermissions = e.target.checked
                                                ? [...editForm.permissions, perm]
                                                : editForm.permissions.filter(p => p !== perm);
                                              setEditForm({...editForm, permissions: updatedPermissions});
                                            }}
                                            className="rounded text-indigo-600 focus:ring-indigo-500 h-5 w-5"
                                            aria-label={`Toggle ${perm} permission`}
                                          />
                                          <span className="capitalize">{perm}</span>
                                        </label>
                                      ))}
                                    </div>
                                  </div>
                                </div>
                                <div className="mt-8 flex justify-end gap-3 border-t border-gray-200 pt-5">
                                  <motion.button
                                    whileHover={{ scale: 1.03 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={() => setEditingId(null)}
                                    className="px-5 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 transition-colors font-medium"
                                    aria-label="Cancel editing"
                                  >
                                    Cancel
                                  </motion.button>
                                  <motion.button
                                    whileHover={{ scale: 1.03 }}
                                    whileTap={{ scale: 0.98 }}
                                    onClick={handleEditWallet}
                                    className="px-5 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 transition-colors font-medium flex items-center"
                                    disabled={staffLoading || actionLoading}
                                    aria-label="Save wallet changes"
                                  >
                                    {actionLoading ? (
                                      <FiRefreshCw className="animate-spin mr-2 h-5 w-5" />
                                    ) : null}
                                    {actionLoading ? "Saving..." : "Save Changes"}
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
                                    <li className="flex items-start bg-gray-50 rounded-xl p-3 border border-gray-100">
                                      <span className="text-indigo-500 mr-2">•</span>
                                      <span className="text-gray-700">Permissions: {wallet.permissions?.join(', ') || "None"}</span>
                                    </li>
                                  </ul>
                                </div>
                                <div className="flex justify-end gap-2">
                                  <Link to={`/dashboard/admin/wallets/${wallet.id}`}>
                                    <motion.button
                                      whileHover={{ scale: 1.02 }}
                                      whileTap={{ scale: 0.98 }}
                                      className="text-gray-600 hover:text-gray-900 text-sm font-medium flex items-center px-3 py-2 bg-white rounded-lg border border-gray-200"
                                      aria-label={`View activity for ${wallet.name}`}
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
        <div className="mb-12">
          <div className="flex flex-col md:flex-row md:justify-between md:items-center mb-6 gap-4">
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-800">Today's Transactions</h2>
              <Link
                to="/dashboard/superadmin/reports#transactions"
                className="text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center"
              >
                View All Transactions <FiChevronRight className="ml-1" />
              </Link>
            </div>
            <div className="relative w-full md:w-80">
              <FiSearch className="absolute left-3 top-3.5 h-5 w-5 text-gray-400" aria-hidden="true" />
              <input
                type="text"
                placeholder="Search today's transactions..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                aria-label="Search today's transactions"
              />
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider" scope="col">Time</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider" scope="col">Description</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider" scope="col">Wallet</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider" scope="col">Staff</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider" scope="col">Category</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider" scope="col">Amount</th>
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
                                    minute: '2-digit',
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
                                  alt={`${staff.name}'s avatar`}
                                  className="w-8 h-8 rounded-full mr-3"
                                />
                              ) : (
                                <div className={`w-8 h-8 rounded-full flex items-center justify-center ${staff.avatarColor} text-white mr-3`}>
                                  {staff.name.charAt(0).toUpperCase()}
                                </div>
                              )}
                              <div>
                                <div className="text-sm font-medium text-gray-900">{staff.name}</div>
                                <div className="text-xs text-gray-500">{staff.role}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                                transaction.category === 'Recharge'
                                  ? 'bg-green-100 text-green-800'
                                  : transaction.category === 'Transfer'
                                  ? 'bg-blue-100 text-blue-800'
                                  : 'bg-gray-100 text-gray-800'
                              }`}
                            >
                              {transaction.category || "N/A"}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-right">
                            <div
                              className={`text-sm font-medium ${
                                transaction.type === 'credit' ? 'text-green-600' : 'text-red-600'
                              }`}
                            >
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
                          <WalletIcon className="h-12 w-12 text-gray-400 mb-4" />
                          <h3 className="text-lg font-medium text-gray-700">No transactions today</h3>
                          <p className="text-gray-500 mt-2">
                            {searchQuery ? "No transactions match your search for today" : "No transactions recorded for today"}
                          </p>
                          <Link
                            to="/dashboard/superadmin/reports#transactions"
                            className="mt-4 text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center"
                          >
                            View All Transactions <FiChevronRight className="ml-1" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
            {/* Pagination */}
            {totalPages > 1 && (
              <div className="flex justify-between items-center px-6 py-4 bg-gray-50 border-t border-gray-200">
                <div className="text-sm text-gray-600">
                  Showing {indexOfFirstTransaction + 1} to{' '}
                  {Math.min(indexOfLastTransaction, filteredTransactions.length)} of{' '}
                  {filteredTransactions.length} transactions for today
                </div>
                <div className="flex gap-2">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                    disabled={currentPage === 1}
                    className={`px-4 py-2 rounded-xl text-sm font-medium ${
                      currentPage === 1
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                    }`}
                    aria-label="Previous page"
                  >
                    Previous
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                    disabled={currentPage === totalPages}
                    className={`px-4 py-2 rounded-xl text-sm font-medium ${
                      currentPage === totalPages
                        ? 'bg-gray-100 text-gray-400 cursor-not-allowed'
                        : 'bg-white text-gray-700 hover:bg-gray-50 border border-gray-200'
                    }`}
                    aria-label="Next page"
                  >
                    Next
                  </motion.button>
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
            ) : filteredStaff.length === 0 ? (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="bg-white p-8 rounded-2xl shadow-lg text-center border border-gray-100"
              >
                <div className="mx-auto w-24 h-24 bg-indigo-50 rounded-full flex items-center justify-center mb-4">
                  <UserIcon className="h-12 w-12 text-indigo-500" />
                </div>
                <h3 className="text-lg font-semibold mb-2">No staff members found</h3>
                <p className="text-gray-500 mb-4">
                  {selectedCentre ? "No staff members in the selected centre" : "Add staff members to manage wallets"}
                </p>
              </motion.div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredStaff.map(staff => (
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
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center text-white bg-slate-700 mr-4`}>
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
        
        {/* Recharge Modal */}
        <AnimatePresence>
          {rechargingId && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center p-4 z-50"
              onClick={() => setRechargingId(null)}
              role="dialog"
              aria-modal="true"
              aria-label="Recharge wallet modal"
            >
              <motion.div
                initial={{ scale: 0.95, y: 20 }}
                animate={{ scale: 1, y: 0 }}
                exit={{ scale: 0.95, y: 20 }}
                className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-5 sticky top-0 z-10">
                  <div className="flex justify-between items-center">
                    <h2 className="text-lg font-bold text-white">Recharge Wallet</h2>
                    <motion.button
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => setRechargingId(null)}
                      className="text-white hover:text-gray-200"
                      aria-label="Close recharge modal"
                    >
                      <FiX className="h-5 w-5" />
                    </motion.button>
                  </div>
                </div>
                <div className="p-5">
                  <div className="space-y-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="recharge-amount">
                        Amount *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                        <input
                          id="recharge-amount"
                          type="number"
                          value={rechargeAmount}
                          onChange={(e) => setRechargeAmount(e.target.value)}
                          className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                          placeholder="Enter amount"
                          min="1"
                          required
                          aria-required="true"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="recharge-description">
                        Description (Optional)
                      </label>
                      <input
                        id="recharge-description"
                        type="text"
                        value={rechargeDescription}
                        onChange={(e) => setRechargeDescription(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                        placeholder="e.g. Cash deposit"
                      />
                    </div>
                  </div>
                  <div className="mt-6 flex justify-end gap-3 border-t border-gray-200 pt-4">
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => setRechargingId(null)}
                      className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm"
                      aria-label="Cancel recharge"
                    >
                      Cancel
                    </motion.button>
                    <motion.button
                      whileHover={{ scale: 1.03 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => handleRecharge(rechargingId)}
                      className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium flex items-center text-sm"
                      disabled={!rechargeAmount || Number(rechargeAmount) <= 0 || actionLoading}
                      aria-label="Confirm recharge"
                    >
                      {actionLoading ? <FiRefreshCw className="animate-spin mr-2 h-4 w-4" /> : null}
                      {actionLoading ? "Recharging..." : "Confirm Recharge"}
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
            role="dialog"
            aria-modal="true"
            aria-label="Transfer funds modal"
          >
            <motion.div
              initial={{ scale: 0.95, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 20 }}
              className="bg-white rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200"
              onClick={(e) => e.stopPropagation()}
            >
              <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-5 sticky top-0 z-10">
                <div className="flex justify-between items-center">
                  <h2 className="text-lg font-bold text-white">Transfer Funds</h2>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setTransferringId(null)}
                    className="text-white hover:text-gray-200"
                    aria-label="Close transfer modal"
                  >
                    <FiX className="h-5 w-5" />
                  </motion.button>
                </div>
              </div>
              <div className="p-5">
                <div className="space-y-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="transfer-from">
                      From Wallet *
                    </label>
                    <select
                      id="transfer-from"
                      value={transferFromWalletId}
                      onChange={(e) => setTransferFromWalletId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                      disabled={loading || actionLoading}
                      aria-label="Select source wallet"
                    >
                      <option value="">Select Source Wallet</option>
                      {wallets.map((wallet) => (
                        <option key={wallet.id} value={wallet.id}>
                          {getWalletName(wallet.id)} ({formatAmount(wallet.balance)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="transfer-to">
                      To Wallet *
                    </label>
                    <select
                      id="transfer-to"
                      value={transferToWalletId}
                      onChange={(e) => setTransferToWalletId(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                      disabled={loading || actionLoading}
                      aria-label="Select destination wallet"
                    >
                      <option value="">Select Destination Wallet</option>
                      {wallets.map((wallet) => (
                        <option key={wallet.id} value={wallet.id}>
                          {getWalletName(wallet.id)} ({formatAmount(wallet.balance)})
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="transfer-amount">
                      Amount *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-500">₹</span>
                      <input
                        id="transfer-amount"
                        type="number"
                        value={transferAmount}
                        onChange={(e) => setTransferAmount(e.target.value)}
                        className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                        placeholder="Enter amount"
                        min="1"
                        required
                        aria-required="true"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="transfer-description">
                      Description (Optional)
                    </label>
                    <input
                      id="transfer-description"
                      type="text"
                      value={transferDescription}
                      onChange={(e) => setTransferDescription(e.target.value)}
                      className="w-full px-3 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent text-sm"
                      placeholder="e.g. Transfer to savings"
                    />
                  </div>
                </div>
                <div className="mt-6 flex justify-end gap-3 border-t border-gray-200 pt-4">
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setTransferringId(null)}
                    className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm"
                    aria-label="Cancel transfer"
                  >
                    Cancel
                  </motion.button>
                  <motion.button
                    whileHover={{ scale: 1.03 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={handleTransfer}
                    className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors font-medium flex items-center text-sm"
                    disabled={!transferFromWalletId || !transferToWalletId || !transferAmount || Number(transferAmount) <= 0 || actionLoading}
                    aria-label="Confirm transfer"
                  >
                    {actionLoading ? <FiRefreshCw className="animate-spin mr-2 h-4 w-4" /> : null}
                    {actionLoading ? "Transferring..." : "Confirm Transfer"}
                  </motion.button>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
};

export default WalletManagementSuperAdmin;
