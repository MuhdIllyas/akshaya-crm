import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  FiUser, FiPhone, FiCreditCard, FiDollarSign, FiCheck, FiX, FiCheckCircle, 
  FiChevronDown, FiPlus, FiTrash2, FiCalendar, FiClock, FiEye, FiLink, 
  FiFileText, FiEdit3, FiRotateCcw, FiAlertCircle, FiClock as FiHistory,
  FiTrendingDown, FiMessageCircle, FiCornerDownLeft, FiPaperclip,
  FiLock, FiMapPin, FiAtSign, FiGlobe, FiBell, FiList, FiUserCheck
} from 'react-icons/fi';
import { toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { MentionsInput, Mention } from 'react-mentions';
import { getCategories, getWallets, getServiceEntries, createServiceEntry, getTokenById, updateServiceEntry, getStaff } from '/src/services/serviceService';
import { createNote } from '/src/services/noteService';
import api from '@/services/serviceService';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import NotesPanel from '/src/components/notes/NotesPanel';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import axios from 'axios';

const createEmptyService = () => ({
  id: crypto.randomUUID(), category: '', subcategory: '', serviceCharge: '', 
  departmentCharge: '', totalCharge: '', serviceWalletId: null, requiresWallet: false, 
  hasExpiry: false, expiryDate: '', initialNote: '', initialNoteMentions: [], 
  initialNoteVisibility: 'centre', createTask: false, taskTitle: '', taskAssignee: '', taskDueDate: null,
  showNoteArea: false, // <-- Added this to collapse the UI by default
});

// 🔥 SAFETY LAYER: Get only latest non-reversal transactions per correction group
const getLatestTransactions = (transactions) => {
  if (!Array.isArray(transactions)) return [];
  
  const map = new Map();
  
  transactions.forEach((tx, index) => {
    // Skip reversal transactions entirely
    if (tx.is_reversal) return;
    
    // Safely grab the ID (checking transaction_id, then id, then falling back to index)
    const txId = tx.transaction_id || tx.id || `fallback-${index}`;
    const groupId = tx.correction_group_id || `direct-${txId}`;
    
    const existing = map.get(groupId);
    
    if (!existing || new Date(tx.created_at) > new Date(existing.created_at)) {
      map.set(groupId, tx);
    }
  });
  
  return Array.from(map.values());
};

const getBase64ImageFromUrl = (imageUrl) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    // This allows fetching from your backend without CORS blocking the canvas
    img.crossOrigin = 'Anonymous'; 
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const dataURL = canvas.toDataURL('image/png');
      resolve(dataURL);
    };
    img.onerror = error => reject(error);
    img.src = imageUrl;
  });
};

const ServiceEntry = () => {
  const { tokenId, customerServiceId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  
  // ========== STATE FOR TRANSACTION CORRECTION (UNIFIED) ==========
  const [correctionModal, setCorrectionModal] = useState({
    isOpen: false,
    transaction: null,
    loading: false,
    newAmount: '',
    newWalletId: '',
    reason: '',
    transactionType: ''
  });
  
  const [historyModal, setHistoryModal] = useState({
    isOpen: false,
    transactionId: null,
    history: [],
    loading: false,
    transactionType: ''
  });

  const [confirmDialog, setConfirmDialog] = useState({
    isOpen: false,
    title: '',
    message: '',
    onConfirm: null
  });
  
  const [correctionStatus, setCorrectionStatus] = useState({});
  
  const [formData, setFormData] = useState({
    tokenId: tokenId || '',
    customerName: '',
    phone: '',
    status: 'pending',
    payments: [],
    services: [createEmptyService()]
  });

  const [wallets, setWallets] = useState({ offline: [], online: [] });
  const [categories, setCategories] = useState([]);
  const [filteredSubcategories, setFilteredSubcategories] = useState([]);
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);
  const [selectedCategoryDocuments, setSelectedCategoryDocuments] = useState([]);
  const [selectedSubcategoryDocuments, setSelectedSubcategoryDocuments] = useState([]);
  const [selectedWebsite, setSelectedWebsite] = useState(null);
  const [totalCharge, setTotalCharge] = useState(0);
  const [grandTotal, setGrandTotal] = useState(0);
  const [paidAmount, setPaidAmount] = useState(0);
  const [pendingAmount, setPendingAmount] = useState(0);
  const [balanceAmount, setBalanceAmount] = useState(0);
  const [daysRemaining, setDaysRemaining] = useState(null);
  const [serviceEntries, setServiceEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [editingEntryId, setEditingEntryId] = useState(null);
  const isEditMode = Boolean(editingEntryId);
  const [staffList, setStaffList] = useState([]);

  const [centreDetails, setCentreDetails] = useState({
    name: 'Akshaya e Centre',
    address: '',
    district: '',
    state: '',
    pincode: '',
    phone: '',
    logo: '/logo-light.png'
  });

  // --- MENTIONS LOGIC FOR INITIAL NOTE ---
  useEffect(() => {
    const loadStaffForMentions = async () => {
      try {
        const centreId = localStorage.getItem('centre_id');
        if (!centreId) return;
        const response = await getStaff(centreId);
        
        const formattedStaff = response.data.map(staff => ({
          id: staff.id,
          display: staff.name
        }));
        setStaffList(formattedStaff);
      } catch (error) {
        console.error('Failed to load staff for mentions', error);
      }
    };
    loadStaffForMentions();
  }, []);

  const fetchStaffSuggestions = (query, callback) => {
    if (query.length === 0) return callback(staffList);
    const filtered = staffList.filter(s => 
      s.display.toLowerCase().includes(query.toLowerCase())
    );
    callback(filtered);
  };

  const handleInitialNoteMentionChange = (event, newValue, newPlainTextValue, mentionsArray) => {
    const mentionedIds = mentionsArray.map(m => parseInt(m.id));
    setFormData(prev => ({
      ...prev,
      initialNote: newValue,
      initialNoteMentions: mentionedIds
    }));
  };
  // ----------------------------------------
  
  // ========== INVOICE GENERATOR STATE ==========
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceData, setInvoiceData] = useState({
    customerName: '',
    phone: '',
    items: [{ description: '', amount: '' }],
    notes: '',
  });

  // ========== DELETE MODAL STATE ==========
  const [deleteDialog, setDeleteDialog] = useState({
    isOpen: false,
    entryId: null,
    loading: false,
  });
  
  const userRole = localStorage.getItem('role') || 'staff';
  const userId = localStorage.getItem('id');

  const handleEditEntry = (entry) => {
    setEditingEntryId(entry.id);

    setFormData({
      tokenId: entry.tokenId || '',
      customerName: entry.customerName || '',
      phone: entry.phone || '',
      status: entry.status || 'pending',
      payments: entry.payments || [],
      services: [{
        id: crypto.randomUUID(),
        category: entry.category ? String(entry.category) : '',
        subcategory: entry.subcategory ? String(entry.subcategory) : '',
        serviceCharge: String(entry.serviceCharge ?? ''),
        departmentCharge: String(entry.departmentCharge ?? ''),
        totalCharge: String(entry.totalCharge ?? ''),
        serviceWalletId: entry.serviceWalletId ? parseInt(entry.serviceWalletId) : null,
        requiresWallet: entry.requiresWallet || false,
        hasExpiry: Boolean(entry.expiryDate),
        expiryDate: entry.expiryDate || '',
        initialNote: '', initialNoteMentions: [], initialNoteVisibility: 'private',
        createTask: false, taskTitle: '', taskAssignee: '', taskDueDate: null,
        showNoteArea: false,
      }]
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const paymentStatusOptions = [
    { id: 'received', name: 'Received', color: 'bg-emerald-100 text-emerald-800' },
    { id: 'pending', name: 'Pending', color: 'bg-amber-100 text-amber-800' },
  ];

  const getServiceStatusDisplay = (status) => {
    switch(status) {
      case 'completed': return { name: 'Completed', color: 'bg-emerald-100 text-emerald-800' };
      case 'pending': return { name: 'Pending', color: 'bg-amber-100 text-amber-800' };
      case 'processed': return { name: 'Processed', color: 'bg-blue-100 text-blue-800' };
      case 'cancelled': return { name: 'Cancelled', color: 'bg-rose-100 text-rose-800' };
      default: return { 
        name: status ? status.charAt(0).toUpperCase() + status.slice(1).replace('_', ' ') : 'Unknown', 
        color: 'bg-gray-100 text-gray-800' 
      };
    }
  };

  const isToday = (dateStr) => {
    if (!dateStr) return false;
    const d = new Date(dateStr);
    const t = new Date();
    d.setHours(0,0,0,0);
    t.setHours(0,0,0,0);
    return d.getTime() === t.getTime();
  };

  // ========== UNIFIED TRANSACTION CORRECTION FUNCTIONS ==========
  
  const checkCorrectionStatus = async (transactionId) => {
    try {
      const response = await api.get(`/transactions/${transactionId}/correction-status`);
      setCorrectionStatus(prev => ({
        ...prev,
        [transactionId]: response.data
      }));
      return response.data;
    } catch (err) {
      console.error('Error checking correction status:', err);
      return null;
    }
  };

  // 🔥 FIXED: Use transaction_id (wallet_transactions.id) for correction
  const openCorrectionModal = async (transaction, entry, type) => {
    // Determine the correct ID: use transaction_id if available, else fallback to id
    const correctionId = transaction.transaction_id || transaction.id;
    
    console.log("🔍 Opening correction modal for:", {
      providedId: transaction.id,
      transactionId: transaction.transaction_id,
      correctionId,
      type: type,
      amount: transaction.amount,
      is_reversal: transaction.is_reversal,
      wallet_id: transaction.wallet || transaction.wallet_id,
      correction_group_id: transaction.correction_group_id
    });
    
    // 🔥 SAFETY: Block if transaction is a reversal
    if (transaction.is_reversal) {
      toast.error('Cannot correct a reversal transaction');
      return;
    }
    
    const status = await checkCorrectionStatus(correctionId);
    
    if (!status) {
      toast.error('Unable to check correction status');
      return;
    }
    
    if (!status.can_correct) {
      toast.error(`Correction limit reached (max ${status.max_corrections_staff} corrections). Please contact admin.`);
      return;
    }
    
    setCorrectionModal({
      isOpen: true,
      transaction: {
        ...transaction,
        id: correctionId, // CRUCIAL: Override with wallet_transactions.id
        serviceEntryId: entry.id,
        originalAmount: transaction.amount,
        wallet_id: transaction.wallet || transaction.wallet_id,
        correction_group_id: transaction.correction_group_id
      },
      loading: false,
      newAmount: transaction.amount,
      newWalletId: transaction.wallet || transaction.wallet_id,
      reason: '',
      transactionType: type
    });
  };

  // 🔥 FIXED: Only send changed fields, with safety verification
  const submitCorrection = async () => {
    const { transaction, newAmount, newWalletId, reason, transactionType } = correctionModal;
    
    // 🔥 CRITICAL DEBUG: Log what we're about to correct
    console.log("🚀 Submitting correction for:", {
      id: transaction.id, // Now wallet_transactions.id
      type: transactionType,
      originalAmount: transaction.originalAmount,
      newAmount: newAmount,
      is_reversal: transaction.is_reversal,
      correction_group_id: transaction.correction_group_id,
      wallet_id: transaction.wallet_id
    });
    
    // Validate amount
    const parsedAmount = parseFloat(newAmount);
    if (isNaN(parsedAmount) || parsedAmount < 0) {
      toast.error('Please enter a valid amount (can be 0 to cancel the charge)');
      return;
    }
    
    // Validate wallet
    const parsedWalletId = parseInt(newWalletId);
    if (!parsedWalletId || isNaN(parsedWalletId)) {
      toast.error('Please select a wallet');
      return;
    }
    
    if (!reason || reason.trim().length < 5) {
      toast.error('Please provide a reason (at least 5 characters)');
      return;
    }

    // Build payload (only changed fields)
    const payload = {
      reason: reason.trim()
    };
    
    // Only include amount if it changed (with small tolerance for floating point)
    const originalAmount = parseFloat(transaction.originalAmount);
    if (Math.abs(parsedAmount - originalAmount) > 0.001) {
      payload.new_amount = parsedAmount;
    }
    
    // Only include wallet if it changed
    const originalWalletId = transaction.wallet_id || transaction.wallet;
    if (parsedWalletId !== parseInt(originalWalletId)) {
      payload.new_wallet_id = parsedWalletId;
    }
    
    // 🔥 SAFETY: Send correction_group_id for backend verification
    if (transaction.correction_group_id) {
      payload.correction_group_id = transaction.correction_group_id;
    }

    // Prepare the actual API call
    const executeCorrectionApi = async () => {
      setCorrectionModal(prev => ({ ...prev, loading: true }));
      try {
        console.log('📤 Correction API Payload:', payload);
        console.log('📤 Correcting Transaction ID:', transaction.id);
        
        await api.put(`/transactions/${transaction.id}/correct`, payload);
        
        toast.success(`${getTransactionTypeLabel(transactionType)} corrected successfully!`);
        
        const entriesRes = await getServiceEntries(true);
        setServiceEntries(entriesRes.data);
        
        setCorrectionStatus(prev => {
          const updated = { ...prev };
          delete updated[transaction.id];
          return updated;
        });
        
        setCorrectionModal({ 
          isOpen: false, 
          transaction: null, 
          loading: false, 
          newAmount: '', 
          newWalletId: '', 
          reason: '',
          transactionType: '' 
        });
      } catch (err) {
        console.error('❌ Correction error:', err);
        console.error('❌ Error response:', err.response?.data);
        console.error('❌ Transaction ID used:', transaction.id);
        toast.error(err.response?.data?.error || 'Failed to correct transaction');
      } finally {
        setCorrectionModal(prev => ({ ...prev, loading: false }));
      }
    };

    // 🛑 Personal wallet check with modal
    const allWallets = [...wallets.offline, ...wallets.online];
    const targetWallet = allWallets.find(w => w.id === parsedWalletId);
    
    if (targetWallet && targetWallet.is_shared === false && targetWallet.assigned_staff_id !== null) {
      setConfirmDialog({
        isOpen: true,
        title: 'Correction Verification',
        message: `You are processing this correction using a personal wallet (${targetWallet.name}). Do you want to proceed?`,
        onConfirm: () => {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          executeCorrectionApi();
        }
      });
      return;
    }

    // No personal wallet involved – execute immediately
    executeCorrectionApi();
  };

  const viewTransactionHistory = async (transactionId, type) => {
    console.log("📜 Fetching transaction history for ID:", transactionId);
    
    setHistoryModal({ 
      isOpen: true, 
      transactionId, 
      history: [], 
      loading: true,
      transactionType: type 
    });
    
    try {
      const response = await api.get(`/transactions/${transactionId}/history`);
      console.log('Transaction history response:', response.data);
      
      let historyData = [];
      if (Array.isArray(response.data)) {
        historyData = response.data;
      } else if (response.data && typeof response.data === 'object') {
        historyData = [response.data];
      }
      
      setHistoryModal(prev => ({
        ...prev,
        history: historyData,
        loading: false
      }));
    } catch (err) {
      console.error('Error fetching transaction history:', err);
      toast.error('Failed to load transaction history');
      setHistoryModal(prev => ({ ...prev, history: [], loading: false }));
    }
  };

  // 🔥 Check if transaction can be corrected
  const canCorrectTransaction = (transaction, entry, type) => {
    // 🔥 SAFETY: Never allow correcting reversal transactions
    if (transaction.is_reversal) return false;
    
    // Staff can only correct today's entries
    if (userRole === 'staff') {
      return isToday(entry.created_at);
    }
    
    return userRole === 'admin' || userRole === 'superadmin';
  };

  const getTransactionTypeLabel = (type) => {
    switch (type) {
      case 'payment': return 'Payment';
      case 'department_charge': return 'Department Charge';
      case 'service_charge': return 'Service Charge';
      default: return 'Transaction';
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'N/A';
    try {
      const date = new Date(dateStr);
      if (isNaN(date.getTime())) return 'Invalid Date';
      return date.toLocaleString('en-IN', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      });
    } catch {
      return 'Invalid Date';
    }
  };

  const formatAmount = (amount) => {
    const num = parseFloat(amount);
    return isNaN(num) ? '0.00' : num.toFixed(2);
  };

  // ========== HANDLE DELETION ==========
  const handleDeleteEntry = async () => {
    const entryId = deleteDialog.entryId;
    if (!entryId) return;

    setDeleteDialog(prev => ({ ...prev, loading: true }));
    try {
      const response = await api.delete(`/entry/${entryId}/force`);
      toast.success(response.data.message || 'Service entry deleted successfully');

      // Remove the deleted entry from the UI without refreshing
      setServiceEntries(prev => prev.filter(entry => entry.id !== entryId));
      
      setDeleteDialog({ isOpen: false, entryId: null, loading: false });
    } catch (err) {
      console.error('Delete error:', err);
      // This will show the error message we wrote in the backend (e.g., if money is collected)
      toast.error(err.response?.data?.error || 'Failed to delete service entry', {
        autoClose: 7000
      });
      setDeleteDialog(prev => ({ ...prev, loading: false }));
    }
  };

  // ========== INVOICE GENERATOR FUNCTIONS ==========
  const openInvoiceModal = () => {
    // Build default items from the dynamic Services Cart
    const items = [];

    (formData.services || []).forEach((svc) => {
      if (!svc.category) return; // Skip empty rows

      const catName = getCategoryName(svc.category);
      const subName = getSubcategoryName(svc.category, svc.subcategory);
      const name = subName !== 'N/A' ? `${catName} - ${subName}` : catName;

      if (parseFloat(svc.serviceCharge) > 0) {
        items.push({ description: `${name} (Service)`, amount: String(svc.serviceCharge) });
      }
      if (parseFloat(svc.departmentCharge) > 0) {
        items.push({ description: `${name} (Dept)`, amount: String(svc.departmentCharge) });
      }
    });

    // Fallback if the cart is somehow totally empty
    if (items.length === 0) {
      items.push({ description: 'Service Charge', amount: '0' });
    }

    setInvoiceData({
      customerName: formData.customerName,
      phone: formData.phone,
      items,
      notes: '',
    });
    setInvoiceModalOpen(true);
  };

  // Note the 'async' keyword here
  const generateInvoicePDF = async () => {
    const doc = new jsPDF();
    const navy = '#0F172A';        
    const white = '#FFFFFF';

    // ---- HEADER BAND ----
    doc.setFillColor(navy);
    doc.rect(0, 0, 210, 35, 'F');   

    // ---- DYNAMIC LOGO HANDLING ----
    try {
      if (centreDetails.logo) {
        // 1. Build the full URL (e.g., http://localhost:5000/uploads/123-logo.png)
        const fullLogoUrl = centreDetails.logo.startsWith('http') 
          ? centreDetails.logo 
          : `${import.meta.env.VITE_API_URL}${centreDetails.logo}`;
        
        // 2. Wait for the image to convert to Base64
        const base64Img = await getBase64ImageFromUrl(fullLogoUrl);
        
        // 3. Add the Base64 image to the PDF
        doc.addImage(base64Img, 'PNG', 10, 5, 22, 22);
      }
    } catch (e) {
      console.warn("Could not load invoice logo:", e);
      // Fallback: If no logo exists or it fails to load, print the text on the left
      doc.setTextColor(white);
      doc.setFontSize(16);
      doc.text(centreDetails.name || 'Akshaya e Centre', 14, 20);
    }

    // ---- DYNAMIC CENTRE DETAILS ON THE RIGHT ----
    doc.setTextColor(white);
    
    doc.setFontSize(14);
    doc.text(centreDetails.name || 'Akshaya e Centre', 120, 16);
    
    doc.setFontSize(8);
    
    const addrParts = [centreDetails.address, centreDetails.district].filter(Boolean);
    if (addrParts.length > 0) {
      doc.text(addrParts.join(', '), 120, 22);
    }
    
    const stateParts = [centreDetails.state, centreDetails.pincode ? `Pin - ${centreDetails.pincode}` : null].filter(Boolean);
    if (stateParts.length > 0) {
      doc.text(stateParts.join(', '), 120, 26);
    }
    
    if (centreDetails.phone) {
      doc.text(`Phone: ${centreDetails.phone}`, 120, 30);
    }

    // ---- INVOICE TITLE & CUSTOMER INFO ----
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('INVOICE', 14, 50);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.text(`Date: ${new Date().toLocaleDateString('en-IN')}`, 14, 58);
    doc.text(`Customer: ${invoiceData.customerName}`, 14, 64);
    doc.text(`Phone: ${invoiceData.phone}`, 14, 70);

    // ---------- SERVICE & STAFF ----------
    const serviceNamesList = (formData.services || [])
      .filter(svc => svc.category)
      .map(svc => {
        const catName = getCategoryName(svc.category);
        const subName = getSubcategoryName(svc.category, svc.subcategory);
        return subName !== 'N/A' ? `${catName} (${subName})` : catName;
      });

    const serviceName = serviceNamesList.length > 0 
      ? serviceNamesList.join(', ') 
      : 'General Service';

    const staffName = localStorage.getItem('name') || 'Staff';
    const displayServiceName = serviceName.length > 60 ? serviceName.substring(0, 57) + '...' : serviceName;

    doc.setFontSize(10);
    doc.text(`Service: ${displayServiceName}`, 14, 78);
    doc.text(`Served by: ${staffName}`, 14, 84);

    // ---- ITEMS TABLE ----
    const tableBody = invoiceData.items.map((item, idx) => [
      idx + 1,
      item.description,
      `Rs. ${parseFloat(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
    ]);
    const total = invoiceData.items.reduce((sum, it) => sum + parseFloat(it.amount || 0), 0);

    autoTable(doc, {
      startY: 92,  
      head: [['#', 'Description', 'Amount (Rs.)']],
      body: tableBody,
      foot: [['', 'Total', `Rs. ${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`]],
      theme: 'plain',
      styles: { font: 'helvetica', fontSize: 10, cellPadding: 4 },
      headStyles: { fillColor: navy, textColor: white, fontStyle: 'bold' },
      footStyles: { fillColor: '#f1f5f9', textColor: navy, fontStyle: 'bold' },
      columnStyles: { 0: { cellWidth: 10 }, 1: { cellWidth: 'auto' }, 2: { halign: 'right' } },
    });

    // ---- NOTES & FOOTER ----
    let finalY = doc.lastAutoTable.finalY + 10;

    if (invoiceData.notes) {
      doc.setFontSize(9);
      doc.setTextColor(80, 80, 80);
      doc.text('Notes:', 14, finalY);
      doc.text(invoiceData.notes, 14, finalY + 5);
      finalY += 15;
    }

    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(`Thank you for your visit — ${centreDetails.name}`, 14, finalY + 4);

    doc.save(`invoice_${Date.now()}.pdf`);
    setInvoiceModalOpen(false);
  };

  // ========== useEffect HOOKS ==========
  
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const staffId = localStorage.getItem('id')?.trim();
        const centreId = localStorage.getItem('centre_id')?.trim();
        console.log('ServiceEntry.jsx: Logged-in staffId:', staffId, 'centreId:', centreId);
        if (!staffId || isNaN(parseInt(staffId)) || !centreId) {
          setError('Staff ID or Centre ID missing or invalid in localStorage. Please log in again.');
          toast.error('Staff ID or Centre ID missing or invalid. Please log in again.');
          return;
        }

        let categoriesData = [];
        try {
          const categoriesRes = await getCategories();
          console.log('ServiceEntry.jsx: Categories response:', JSON.stringify(categoriesRes.data, null, 2));
          categoriesData = categoriesRes.data || [];
          setCategories(categoriesData);
        } catch (err) {
          console.error('ServiceEntry.jsx: Failed to fetch categories:', err.response?.data || err.message);
          toast.error(`Failed to fetch categories: ${err.response?.data?.error || err.message}`);
        }

        try {
          const walletsRes = await getWallets();
          console.log('ServiceEntry.jsx: Wallets response:', JSON.stringify(walletsRes.data, null, 2));
          const offlineWallets = walletsRes.data.filter(w => w.wallet_type === 'cash' && w.centre_id === parseInt(centreId));
          const onlineWallets = walletsRes.data.filter(w => ['digital', 'bank', 'card'].includes(w.wallet_type) && w.status === 'online' && w.centre_id === parseInt(centreId));
          setWallets({ offline: offlineWallets, online: onlineWallets });
          if (offlineWallets.length === 0) toast.warn('No offline wallets available for your centre.');
          if (onlineWallets.length === 0) toast.warn('No online wallets available for your centre.');
        } catch (err) {
          console.error('ServiceEntry.jsx: Failed to fetch wallets:', err.response?.data || err.message);
          toast.error(`Failed to fetch wallets: ${err.response?.data?.error || err.message}`);
        }

        try {
          const entriesRes = await getServiceEntries(true);
          console.log('ServiceEntry.jsx: Today\'s service entries response:', JSON.stringify(entriesRes.data, null, 2));
          setServiceEntries(entriesRes.data);
        } catch (err) {
          console.error('ServiceEntry.jsx: Failed to fetch today\'s service entries:', err.response?.data || err.message);
          toast.error(`Failed to fetch today\'s service entries: ${err.response?.data?.error || err.message}`);
        }

        try {
          // Fetch dynamic centre details for invoices
          const centreId = localStorage.getItem('centre_id');
          if (centreId) {
            // FIX: Use standard axios to hit the correct /api/centres endpoint directly
            const centreRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/centres/${centreId}`, {
              headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
            });
            
            if (centreRes.data) {
              setCentreDetails({
                name: centreRes.data.name || 'Akshaya e Centre',
                address: centreRes.data.address || '',
                district: centreRes.data.district || '',
                state: centreRes.data.state || '',
                pincode: centreRes.data.pincode || '',
                phone: centreRes.data.phone || '',
                logo: centreRes.data.logo || ''
              });
            }
          }
        } catch (err) {
          console.warn('Failed to fetch centre details for invoice:', err.response?.data || err.message);
        }

        if (tokenId) {
          try {
            const tokenRes = await getTokenById(tokenId);
            const tokenData = tokenRes.data;
            console.log('ServiceEntry.jsx: Token data response:', JSON.stringify(tokenData, null, 2));
            if (!tokenData || (String(tokenData.staff_id) !== String(staffId) && tokenData.staff_id)) {
              setError('Token not found or not assigned to this staff');
              toast.error('Token not found or not assigned to this staff');
              return;
            }

            const category = tokenData.category_id ? categoriesData.find(cat => cat.id === parseInt(tokenData.category_id)) : null;
            const subcategory = category && tokenData.subcategory_id ? category.subcategories?.find(sub => sub.id === parseInt(tokenData.subcategory_id)) : null;
            const serviceCharge = parseFloat(subcategory?.service_charges || tokenData.service_charges || 0);
            const departmentCharge = parseFloat(subcategory?.department_charges || tokenData.department_charges || 0);
            const totalCharge = serviceCharge + departmentCharge;

            const newFormData = {
              tokenId,
              customerName: tokenData.customer_name || '',
              phone: tokenData.phone || '',
              status: tokenData.status === 'done' ? 'completed' : tokenData.status || 'pending',
              payments: tokenData.payments?.length > 0 ? tokenData.payments.map(p => ({
                wallet: String(p.wallet || ''),
                method: p.method || 'cash',
                amount: String(p.amount || ''),
                status: p.status || 'pending',
              })) : [],
              // 🔥 PROPERLY INITIALIZING THE CART ARRAY
              services: [{
                id: crypto.randomUUID(),
                category: tokenData.category_id ? String(tokenData.category_id) : '',
                subcategory: tokenData.subcategory_id ? String(tokenData.subcategory_id) : '',
                serviceCharge: String(serviceCharge),
                departmentCharge: String(departmentCharge),
                totalCharge: String(totalCharge),
                serviceWalletId: tokenData.service_wallet_id ? parseInt(tokenData.service_wallet_id) : category?.wallet_id ? parseInt(category.wallet_id) : null,
                requiresWallet: category?.requires_wallet || subcategory?.requires_wallet || tokenData.requires_wallet || false,
                hasExpiry: category?.has_expiry || tokenData.has_expiry || false,
                expiryDate: tokenData.expiry_date || '',
                initialNote: '', 
                initialNoteMentions: [], 
                initialNoteVisibility: 'centre', 
                createTask: false, 
                taskTitle: '', 
                taskAssignee: '', 
                taskDueDate: null,
                showNoteArea: false
              }]
            };

            setFormData(newFormData);

            console.log('ServiceEntry.jsx: Set formData from token:', JSON.stringify(newFormData, null, 2));

            if (!tokenData.customer_name) toast.warn('Token is missing customer name. Please enter manually.');
            if (!tokenData.category_id) toast.warn('Token is missing category. Please select manually.');
            if (!tokenData.subcategory_id) toast.warn('Token is missing subcategory. Please select manually.');
            if (!category) toast.warn('Category not found in categories data. Please ensure categories are loaded.');
            if (category && !subcategory) toast.warn('Subcategory not found for the selected category. Please select manually.');
            if ((category?.requires_wallet || subcategory?.requires_wallet || tokenData.requires_wallet) && !tokenData.service_wallet_id && !category?.wallet_id) {
              toast.warn('Selected service requires a wallet but none is assigned. Please contact admin.');
            }
            if (serviceCharge === 0 || departmentCharge === 0) {
              toast.warn('Service or department charges are not defined. Please enter manually or contact admin.');
            }
          } catch (err) {
            console.error('ServiceEntry.jsx: Error fetching token data:', err.response?.data || err.message);
            setError('Failed to load token data.');
            toast.error(`Failed to load token data: ${err.response?.data?.error || err.message}`);
          }
        }

        if (customerServiceId) {
          try {
            const bookingRes = await api.get(`/customer-services/${customerServiceId}`);
            const booking = bookingRes.data;

            const category = categoriesData.find(cat => cat.id === parseInt(booking.service_id));
            const subcategory = category?.subcategories?.find(
              sub => sub.id === parseInt(booking.subcategory_id)
            );

            const serviceCharge = parseFloat(subcategory?.service_charges || 0);
            const departmentCharge = parseFloat(subcategory?.department_charges || 0);
            const totalCharge = serviceCharge + departmentCharge;

            setFormData(prev => ({
              ...prev,
              tokenId: null,
              customerName: booking.customer_name || '',
              phone: booking.phone || '',
              // 🔥 PROPERLY INITIALIZING THE CART ARRAY
              services: [{
                id: crypto.randomUUID(),
                category: booking.service_id ? String(booking.service_id) : '',
                subcategory: booking.subcategory_id ? String(booking.subcategory_id) : '',
                serviceCharge: String(serviceCharge),
                departmentCharge: String(departmentCharge),
                totalCharge: String(totalCharge),
                serviceWalletId: category?.wallet_id ? parseInt(category.wallet_id) : null,
                requiresWallet: category?.requires_wallet || subcategory?.requires_wallet || false,
                hasExpiry: category?.has_expiry || false,
                expiryDate: '',
                initialNote: '', 
                initialNoteMentions: [], 
                initialNoteVisibility: 'centre', 
                createTask: false, 
                taskTitle: '', 
                taskAssignee: '', 
                taskDueDate: null,
                showNoteArea: false
              }]
            }));

          } catch (err) {
            toast.error("Failed to load online booking details");
          }
        }          
      } catch (err) {
        console.error('ServiceEntry.jsx: Error fetching data:', err);
        setError(`Failed to load data: ${err.message}`);
        toast.error(`Failed to load data: ${err.message}`);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [tokenId, customerServiceId]);

  useEffect(() => {
    const newGrandTotal = formData.services.reduce((sum, svc) => {
      return sum + (parseFloat(svc.totalCharge) || 0);
    }, 0);
    setGrandTotal(newGrandTotal);

    const received = formData.payments.filter(p => p.status === 'received').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);
    const pending = formData.payments.filter(p => p.status === 'pending').reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

    setPaidAmount(received);
    setPendingAmount(pending);
    setBalanceAmount(newGrandTotal - received);

    if (!isEditMode) {
      if (received >= newGrandTotal && newGrandTotal > 0) {
        setFormData(prev => ({ ...prev, status: 'completed' }));
      } else {
        setFormData(prev => ({ ...prev, status: 'pending' }));
      }
    }
  }, [formData.services, formData.payments, isEditMode]);

  const calculateDaysRemaining = (dateString) => {
    if (!dateString) {
      setDaysRemaining(null);
      return;
    }
    const expiryDate = new Date(dateString);
    const today = new Date();
    const timeDiff = expiryDate - today;
    const days = Math.ceil(timeDiff / (1000 * 60 * 60 * 24));
    setDaysRemaining(days);
  };

  // 🔥 CATCH ADMIN EDIT FROM SERVICE LOGS (FIXED: removed undefined reverseStatusMap)
  useEffect(() => {
    if (location.state && location.state.adminEditEntry && categories.length > 0) {
      const adminEntry = location.state.adminEditEntry;
      
      console.log("Catching Admin Edit Entry:", adminEntry);

      // Map the ServiceLogs data format to match what ServiceEntry expects
      const mappedEntry = {
        // Critical: ServiceLogs uses serviceEntryId, but ServiceEntry expects id
        id: adminEntry.serviceEntryId || adminEntry.id, 
        tokenId: adminEntry.tokenId || '',
        customerName: adminEntry.customerName || '',
        phone: adminEntry.customerPhone || adminEntry.phone || '',
        category: adminEntry.categoryId || adminEntry.category || '',
        subcategory: adminEntry.subcategoryId || adminEntry.subcategory || '',
        serviceCharge: adminEntry.serviceCharge || 0,
        departmentCharge: adminEntry.departmentCharge || 0,
        totalCharge: adminEntry.totalCharge || 0,
        // Normalize the status string – fallback to 'pending' if unrecognised
        status: adminEntry.status?.toLowerCase() === 'completed' ? 'completed' : 
                adminEntry.status?.toLowerCase() === 'pending' ? 'pending' : 'pending',
        expiryDate: adminEntry.expiryDate && adminEntry.expiryDate !== 'Not set' 
                    ? adminEntry.expiryDate.split('T')[0] : '',
        payments: adminEntry.payments || [],
        serviceWalletId: adminEntry.serviceWalletId || null,
        requiresWallet: adminEntry.requiresWallet || false,
      };

      // Slight delay to ensure wallets and categories have finished rendering
      setTimeout(() => {
        handleEditEntry(mappedEntry);
        toast.info("Admin Override Mode Activated", { icon: "🔓" });
      }, 500);
      
      // Clear the router state so it doesn't get stuck in a loop if the page refreshes
      window.history.replaceState({}, document.title);
    }
  }, [location.state, categories.length]);

  const handleTopLevelChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const addServiceToCart = () => setFormData(prev => ({ ...prev, services: [...prev.services, createEmptyService()] }));

  const removeServiceFromCart = (indexToRemove) => {
    if (formData.services.length <= 1) return;
    setFormData(prev => ({ ...prev, services: prev.services.filter((_, idx) => idx !== indexToRemove) }));
  };

  const handleCartChange = (index, field, value) => {
    setFormData(prev => {
      const updated = [...prev.services];
      const svc = { ...updated[index], [field]: value };

      if (field === 'category') {
        const cat = categories.find(c => c.id === parseInt(value));
        if (cat) {
          svc.serviceWalletId = cat.wallet_id ? parseInt(cat.wallet_id) : svc.serviceWalletId;
          svc.requiresWallet = cat.requires_wallet || false;
          svc.hasExpiry = cat.has_expiry || false;
          if (cat.has_expiry && !svc.expiryDate) {
            const exp = new Date(); exp.setDate(exp.getDate() + 90);
            svc.expiryDate = exp.toISOString().split('T')[0];
          } else if (!cat.has_expiry) svc.expiryDate = '';
          
          if (cat.subcategories && cat.subcategories.length > 0) {
            const firstSub = cat.subcategories[0];
            svc.subcategory = String(firstSub.id);
            svc.serviceCharge = String(parseFloat(firstSub.service_charges) || 0);
            svc.departmentCharge = String(parseFloat(firstSub.department_charges) || 0);
            svc.requiresWallet = firstSub.requires_wallet || svc.requiresWallet;
          } else {
            svc.subcategory = ''; svc.serviceCharge = '0'; svc.departmentCharge = '0';
          }
        }
      }

      if (field === 'subcategory') {
        const cat = categories.find(c => c.id === parseInt(svc.category));
        if (cat && cat.subcategories) {
          const sub = cat.subcategories.find(s => s.id === parseInt(value));
          if (sub) {
            svc.serviceCharge = String(parseFloat(sub.service_charges) || 0);
            svc.departmentCharge = String(parseFloat(sub.department_charges) || 0);
            svc.requiresWallet = sub.requires_wallet || cat.requires_wallet;
          }
        }
      }

      if (['serviceCharge', 'departmentCharge', 'category', 'subcategory'].includes(field)) {
        svc.totalCharge = String((parseFloat(svc.serviceCharge) || 0) + (parseFloat(svc.departmentCharge) || 0));
      }

      updated[index] = svc;
      return { ...prev, services: updated };
    });
  };

  const handleNoteMentionChangeCart = (index, event, newValue, newPlainTextValue, mentionsArray) => {
    const mentionedIds = mentionsArray.map(m => parseInt(m.id));
    setFormData(prev => {
      const updated = [...prev.services];
      updated[index] = { ...updated[index], initialNote: newValue, initialNoteMentions: mentionedIds };
      return { ...prev, services: updated };
    });
  };

  const updatePaymentState = (index, field, value) => {
    const updatedPayments = [...formData.payments];
    updatedPayments[index] = { ...updatedPayments[index], [field]: value };

    if (field === 'method') {
      const availableWallets = value === 'cash' ? wallets.offline : wallets.online;
      updatedPayments[index].wallet = availableWallets.length > 0 ? String(availableWallets[0].id) : '';
      if (availableWallets.length === 0) {
        toast.warn(`No ${value === 'cash' ? 'cash' : 'digital'} wallets available for your centre.`);
      }
    }

    if (field === 'amount') {
      const entered = parseFloat(value) || 0;
      const otherReceived = formData.payments
        .filter((_, i) => i !== index && _.status === 'received')
        .reduce((sum, p) => sum + (parseFloat(p.amount) || 0), 0);

      const maxAllowed = grandTotal - otherReceived; // 🔥 Changed to grandTotal

      if (entered > maxAllowed) {
        toast.error(`Amount exceeds remaining balance (₹${maxAllowed})`);
        return;
      }
    }

    setFormData(prev => ({ ...prev, payments: updatedPayments }));
  };

  const handlePaymentChange = (index, field, value) => {
    if (field === 'wallet' && value) {
      const allWallets = [...wallets.offline, ...wallets.online];
      const selectedWallet = allWallets.find(w => w.id === parseInt(value));
      if (selectedWallet && selectedWallet.is_shared === false && selectedWallet.assigned_staff_id !== null) {
        setConfirmDialog({
          isOpen: true,
          title: 'Personal Wallet Selected',
          message: `You are selecting a personal wallet (${selectedWallet.name}). Do you want to proceed?`,
          onConfirm: () => {
            setConfirmDialog(prev => ({ ...prev, isOpen: false }));
            updatePaymentState(index, field, value);
          }
        });
        return;
      }
    }
    updatePaymentState(index, field, value);
  };

  const addPayment = () => {
    const remaining = Math.max(0, balanceAmount);
    if (remaining === 0) return toast.warn('Total amount already covered.');

    const defaultMethod = wallets.offline.length > 0 ? 'cash' : 'wallet';
    const defaultWallet = wallets.offline.length > 0 ? String(wallets.offline[0].id) : wallets.online.length > 0 ? String(wallets.online[0].id) : '';
    if (!defaultWallet) return toast.error('No wallets available for your centre.');

    setFormData(prev => ({
      ...prev,
      payments: [...prev.payments, { method: defaultMethod, wallet: defaultWallet, amount: String(remaining), status: 'received' }],
    }));
  };

  const removePayment = (index) => {
    setFormData(prev => {
      const updated = [...prev.payments];
      updated.splice(index, 1);
      return { ...prev, payments: updated };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const errors = [];

    if (!formData.customerName.trim()) errors.push('Customer name is required');
    if (!formData.phone.trim()) errors.push('Phone number is required');

    formData.services.forEach((svc, i) => {
      const prefix = formData.services.length > 1 ? `Service ${i+1}: ` : '';
      if (!svc.category) errors.push(`${prefix}Category is required`);
      if (!svc.subcategory) errors.push(`${prefix}Subcategory is required`);
      if (svc.serviceCharge === '' || parseFloat(svc.serviceCharge) < 0) errors.push(`${prefix}Valid service charge required`);
      if (svc.departmentCharge === '' || parseFloat(svc.departmentCharge) < 0) errors.push(`${prefix}Valid department charge required`);
      if (svc.requiresWallet && (!svc.serviceWalletId || isNaN(parseInt(svc.serviceWalletId)))) errors.push(`${prefix}Requires a wallet assignment`);
      if (svc.hasExpiry && (!svc.expiryDate || isNaN(Date.parse(svc.expiryDate)))) errors.push(`${prefix}Expiry date required`);
      if (svc.createTask && (!svc.taskTitle || !svc.taskAssignee)) errors.push(`${prefix}Task Title & Assignee required`);
    });

    if (formData.payments.length === 0) errors.push('At least one payment is required');
    if (balanceAmount > 0 && formData.status === 'completed') errors.push(`Balance amount of ₹${balanceAmount} remains. Add payments or keep status as pending.`);
    if (paidAmount > grandTotal) errors.push('Collected amount exceeds total charge');

    const staffId = localStorage.getItem('id')?.trim();
    if (!staffId) errors.push('Staff ID missing. Please log in again.');

    if (errors.length > 0) {
      errors.forEach(err => toast.error(err, { autoClose: 5000 }));
      return;
    }

    const payload = {
      tokenId: formData.tokenId || null,
      customerServiceId: customerServiceId || null,
      customerName: formData.customerName.trim(),
      phone: formData.phone.trim(),
      status: formData.status,
      staffId: parseInt(staffId),
      services: formData.services.map(svc => ({
        categoryId: parseInt(svc.category),
        subcategoryId: parseInt(svc.subcategory),
        serviceCharge: parseFloat(svc.serviceCharge),
        departmentCharge: parseFloat(svc.departmentCharge),
        totalCharge: parseFloat(svc.totalCharge),
        serviceWalletId: svc.serviceWalletId ? parseInt(svc.serviceWalletId) : null,
        hasExpiry: svc.hasExpiry,
        expiryDate: svc.hasExpiry ? svc.expiryDate : null,
        initialNote: svc.initialNote,
        initialNoteMentions: svc.initialNoteMentions,
        initialNoteVisibility: svc.initialNoteVisibility,
        createTask: svc.createTask,
        taskTitle: svc.taskTitle,
        taskAssignee: svc.taskAssignee ? parseInt(svc.taskAssignee) : null,
        taskDueDate: svc.taskDueDate ? new Date(svc.taskDueDate).toISOString().split('T')[0] : null,
      })),
      payments: formData.payments.map(p => ({
        wallet: parseInt(p.wallet),
        method: p.method,
        amount: parseFloat(p.amount),
        status: p.status,
      }))
    };

    const executeFinalSubmit = async () => {
      try {
        if (editingEntryId) {
          // Single Edit Mode Logic
          const editPayload = {
             ...payload,
             categoryId: payload.services[0].categoryId,
             subcategoryId: payload.services[0].subcategoryId,
             serviceCharge: payload.services[0].serviceCharge,
             departmentCharge: payload.services[0].departmentCharge,
             totalCharge: payload.services[0].totalCharge,
             serviceWalletId: payload.services[0].serviceWalletId,
             hasExpiry: payload.services[0].hasExpiry,
             expiryDate: payload.services[0].expiryDate,
          };
          delete editPayload.payments;
          delete editPayload.services;

          await updateServiceEntry(editingEntryId, editPayload);
          toast.success('Service entry updated successfully!');
        } else {
          // 🔥 SEND CART TO BULK ROUTE
          const response = await api.post('/entry/bulk', payload);
          const createdServices = response.data.createdServices || [];

          // 🔥 LOOP THROUGH THE RESPONSE TO CREATE NOTES & TASKS
          for (const svc of createdServices) {
            if (svc.initialNote && svc.initialNote.trim() !== '') {
              try {
                // 1. Save Note
                const noteRes = await createNote({
                  title: 'Initial Note',
                  content: svc.initialNote.trim(),
                  visibility: svc.initialNoteVisibility,
                  related_service_entry_id: svc.serviceEntryId,
                  mentions: svc.initialNoteMentions 
                });
                
                const savedNoteId = noteRes?.data?.id || noteRes?.id;

                // 2. Save Task
                if (svc.createTask && svc.taskTitle && svc.taskAssignee && savedNoteId) {
                  const taskBaseUrl = (api.defaults.baseURL || '').replace('servicemanagement', 'tasks');
                  
                  await api.post('/add', {
                    title: svc.taskTitle.trim(),
                    description: svc.initialNote.trim(),
                    assigned_to: parseInt(svc.taskAssignee),
                    due_date: svc.taskDueDate ? new Date(svc.taskDueDate).toISOString().split('T')[0] : null,
                    priority: 'medium',
                    related_service_entry_id: svc.serviceEntryId,
                    note_id: savedNoteId
                  }, { baseURL: taskBaseUrl });
                }
              } catch (noteErr) {
                console.error(`❌ Failed to save note/task for Entry ${svc.serviceEntryId}:`, noteErr);
                toast.warn(`Service created, but failed to attach note/task.`);
              }
            }
          }
          
          toast.success('Services successfully created and paid!');
        }
        
        // --- 1. Fetch updated entries so the table shows the new submission immediately ---
        try {
          const entriesRes = await getServiceEntries(true);
          setServiceEntries(entriesRes.data || []);
        } catch (fetchErr) {
          console.error("Failed to refresh table", fetchErr);
        }

        // --- 2. Clear the form instead of navigating away ---
        setFormData({
          tokenId: '',
          customerName: '',
          phone: '',
          status: 'pending',
          payments: [],
          services: [{
            id: crypto.randomUUID(), category: '', subcategory: '', serviceCharge: '', 
            departmentCharge: '', totalCharge: '', serviceWalletId: null, requiresWallet: false, 
            hasExpiry: false, expiryDate: '', initialNote: '', initialNoteMentions: [], 
            initialNoteVisibility: 'centre', createTask: false, taskTitle: '', taskAssignee: '', taskDueDate: null, showNoteArea: false
          }]
        });
        setEditingEntryId(null);
        
      } catch (err) {
        toast.error(err.response?.data?.error || 'Failed to submit service entries');
      }
    };

    const allWallets = [...wallets.offline, ...wallets.online];
    const personalWalletUsed = [...formData.payments.map(p => parseInt(p.wallet)), ...formData.services.map(s => parseInt(s.serviceWalletId))]
      .filter(id => !isNaN(id))
      .some(id => {
        const w = allWallets.find(wallet => wallet.id === id);
        return w && w.is_shared === false && w.assigned_staff_id !== null;
      });

    if (personalWalletUsed) {
      setConfirmDialog({
        isOpen: true,
        title: 'Personal Wallet Verification',
        message: 'A personal wallet is currently selected. Are you sure you want to proceed?',
        onConfirm: () => {
          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
          executeFinalSubmit();
        }
      });
      return;
    }

    executeFinalSubmit();
  };

  const getCategoryName = (categoryId) => {
    const category = categories.find(c => c.id === parseInt(categoryId));
    return category ? category.name : 'N/A';
  };

  const getSubcategoryName = (categoryId, subcategoryId) => {
    const category = categories.find(c => c.id === parseInt(categoryId));
    if (category && category.subcategories) {
      const subcategory = category.subcategories.find(s => s.id === parseInt(subcategoryId));
      return subcategory ? subcategory.name : 'N/A';
    }
    return 'N/A';
  };

  const formatPayments = (payments = [], totalCharge = 0) => {
    const walletSummary = {};

    payments.forEach(p => {
      const walletId = String(p.wallet);

      if (!walletSummary[walletId]) {
        walletSummary[walletId] = {
          received: 0,
          pending: 0,
          method: p.method,
        };
      }

      if (p.status === 'received') {
        walletSummary[walletId].received += Number(p.amount) || 0;
      }

      if (p.status === 'pending') {
        walletSummary[walletId].pending += Number(p.amount) || 0;
      }
    });

    const output = [];

    Object.entries(walletSummary).forEach(([walletId, data]) => {
      let walletName = 'Counter';

      const wallet =
        data.method === 'cash'
          ? wallets.offline.find(w => w.id === parseInt(walletId))
          : wallets.online.find(w => w.id === parseInt(walletId));

      if (wallet) {
        walletName = wallet.name;
      }

      if (data.received > 0) {
        output.push(`${walletName}: ₹${data.received} (received)`);
      }

      if (data.pending > 0) {
        output.push(`${walletName}: ₹${data.pending} (pending)`);
      }
    });

    return output.join(', ');
  };

  const getWalletName = (walletId) => {
    const wallet = [...wallets.offline, ...wallets.online].find(w => w.id === parseInt(walletId));
    return wallet ? wallet.name : 'Unknown Wallet';
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto p-6 flex justify-center items-center h-[80vh]">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600 font-medium">Loading service data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-6xl mx-auto p-6 text-center">
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-6 max-w-md mx-auto">
          <div className="text-rose-600 text-4xl mb-3">⚠️</div>
          <h3 className="text-lg font-medium text-rose-800 mb-2">Data Loading Error</h3>
          <p className="text-gray-600">{error}</p>
          <button 
            onClick={() => window.location.reload()}
            className="mt-4 px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors"
          >
            Try Again
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 lg:p-8">
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="bg-white rounded-xl shadow-md border border-gray-100 p-6 mb-8"
      >
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">
              {tokenId ? 'Token-Based Service Entry' : 'New Service Entry'}
            </h1>
            <p className="text-gray-600 mt-1">
              {tokenId ? `Processing token #${tokenId}` : 'Create a new service entry'}
            </p>
          </div>
          
          {tokenId && (
            <div className="bg-indigo-50 px-4 py-2 rounded-lg border border-indigo-100">
              <div className="flex items-center gap-2">
                <span className="text-indigo-800 font-medium">Token ID</span>
                <span className="bg-indigo-100 text-indigo-800 font-bold px-2.5 py-0.5 rounded-md">
                  #{tokenId}
                </span>
              </div>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {tokenId && (
            <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
              <div className="flex items-start">
                <div className="bg-blue-100 p-2 rounded-md mt-0.5 mr-3">
                  <FiCheck className="h-5 w-5 text-blue-600" />
                </div>
                <p className="text-blue-800">
                  Working from token <span className="font-semibold">#{tokenId}</span> - Customer information has been pre-filled
                </p>
              </div>
            </div>
          )}

          {/* MAIN 2-COLUMN GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            
            {/* ======================================================== */}
            {/* LEFT COLUMN: CUSTOMER INFO & CART                        */}
            {/* ======================================================== */}
            <div className="space-y-6">
              
              {/* 1. Customer Information */}
              <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                <div className="flex items-center gap-2 mb-5">
                  <div className="bg-indigo-100 p-2 rounded-lg">
                    <FiUser className="h-5 w-5 text-indigo-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800">Customer Information</h3>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Customer Name <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiUser className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="text"
                        name="customerName"
                        value={formData.customerName}
                        onChange={handleTopLevelChange}
                        required
                        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="Full name"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Phone Number <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiPhone className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="tel"
                        name="phone"
                        value={formData.phone}
                        onChange={handleTopLevelChange}
                        required
                        pattern="\+?[1-9]\d{1,14}"
                        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="+91 XXXXXXXXXX"
                      />
                    </div>
                  </div>
                </div>
              </div>
                  
              {/* 2. DYNAMIC SERVICES ARRAY (THE CART) */}
              <div className="space-y-4">
                <div className="flex items-center gap-2 mb-2">
                  <div className="bg-indigo-100 p-2 rounded-lg"><FiCreditCard className="h-5 w-5 text-indigo-600" /></div>
                  <h3 className="text-lg font-semibold text-gray-800">Service Cart</h3>
                </div>
                
                <AnimatePresence>
                  {(formData.services || []).map((svc, index) => {
                    const subcategories = categories.find(c => c.id === parseInt(svc.category))?.subcategories || [];
                    const categoryDocs = categories.find(c => c.id === parseInt(svc.category))?.required_documents?.filter(doc => !doc.sub_category_id) || [];
                    const subcategoryDocs = categories.find(c => c.id === parseInt(svc.category))?.subcategories?.find(s => s.id === parseInt(svc.subcategory))?.required_documents || [];
                    const website = categories.find(c => c.id === parseInt(svc.category))?.website || null;

                    return (
                      <motion.div key={svc.id} initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95 }} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden relative">
                        
                        {/* Compact Header */}
                        <div className="bg-gray-50 border-b border-gray-200 px-4 py-3 flex justify-between items-center">
                          <div className="flex items-center gap-3">
                            <span className="bg-indigo-600 text-white h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shadow-sm">{index + 1}</span>
                            <h4 className="font-semibold text-gray-800 text-sm">
                              {svc.category ? getCategoryName(svc.category) : 'Configure New Service'}
                            </h4>
                          </div>
                          {!isEditMode && formData.services.length > 1 && (
                            <button type="button" onClick={() => removeServiceFromCart(index)} className="text-gray-400 hover:text-rose-500 hover:bg-rose-50 p-1.5 rounded transition">
                              <FiTrash2 className="h-4 w-4" />
                            </button>
                          )}
                        </div>

                        {/* Body Content */}
                        <div className="p-4 space-y-4">
                          {/* Row 1: Selectors */}
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Category *</label>
                              <div className="relative">
                                <select value={svc.category} onChange={(e) => handleCartChange(index, 'category', e.target.value)} required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white appearance-none">
                                  <option value="">Select Category</option>
                                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2"><FiChevronDown className="text-gray-400"/></div>
                              </div>
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Subcategory *</label>
                              <div className="relative">
                                <select value={svc.subcategory} onChange={(e) => handleCartChange(index, 'subcategory', e.target.value)} required disabled={!svc.category} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm bg-white appearance-none disabled:bg-gray-50">
                                  <option value="">Select Subcategory</option>
                                  {subcategories.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                                </select>
                                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2"><FiChevronDown className="text-gray-400"/></div>
                              </div>
                            </div>
                          </div>

                          {/* Row 2: Financials (Strictly 3 Columns) */}
                          <div className="grid grid-cols-3 gap-3">
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Service (₹)</label>
                              <input type="number" value={svc.serviceCharge} onChange={(e) => handleCartChange(index, 'serviceCharge', e.target.value)} min="0" step="0.01" required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Dept (₹)</label>
                              <input type="number" value={svc.departmentCharge} onChange={(e) => handleCartChange(index, 'departmentCharge', e.target.value)} min="0" step="0.01" required className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm" />
                            </div>
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Total (₹)</label>
                              <input type="text" value={svc.totalCharge} readOnly className="w-full px-3 py-2 bg-indigo-50 border border-indigo-100 font-bold text-indigo-700 rounded-lg text-sm" />
                            </div>
                          </div>

                          {/* Row 2.5: Expiry Date */}
                          {svc.hasExpiry && (
                            <div>
                              <label className="block text-xs font-medium text-gray-700 mb-1">Service Expiry Date *</label>
                              <div className="relative">
                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                  <FiCalendar className="h-4 w-4 text-gray-400" />
                                </div>
                                <input 
                                  type="date" 
                                  value={svc.expiryDate} 
                                  onChange={(e) => handleCartChange(index, 'expiryDate', e.target.value)} 
                                  required 
                                  className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-indigo-500 focus:border-indigo-500" 
                                />
                              </div>
                              {svc.expiryDate && (
                                <p className={`text-xs mt-1.5 font-medium ${
                                  Math.ceil((new Date(svc.expiryDate) - new Date()) / (1000 * 60 * 60 * 24)) < 30 ? 'text-amber-600' : 'text-emerald-600'
                                }`}>
                                  <FiClock className="inline mr-1" />
                                  {Math.ceil((new Date(svc.expiryDate) - new Date()) / (1000 * 60 * 60 * 24))} days remaining
                                </p>
                              )}
                            </div>
                          )}

                          {/* Row 3: Docs & Web */}
                          {(website || categoryDocs.length > 0 || subcategoryDocs.length > 0) && (
                            <div className="bg-blue-50/50 p-3 rounded-lg border border-blue-100 flex flex-wrap gap-x-6 gap-y-2 text-xs">
                              {website && (
                                <div className="flex items-center gap-1.5">
                                  <FiLink className="text-blue-500 shrink-0" />
                                  <a href={website} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{website}</a>
                                </div>
                              )}
                              {(categoryDocs.length > 0 || subcategoryDocs.length > 0) && (
                                <div className="flex items-start gap-1.5">
                                  <FiFileText className="text-indigo-500 shrink-0 mt-0.5" />
                                  <div className="flex flex-wrap gap-2">
                                    <span className="font-semibold text-gray-700 mr-1">Docs:</span>
                                    {[...categoryDocs, ...subcategoryDocs].map((d, i) => (
                                      <span key={i} className="inline-flex items-center gap-1 text-gray-600 bg-white px-2 py-0.5 rounded border border-gray-200">
                                        <FiCheckCircle className="text-emerald-500 w-3 h-3" /> {d.document_name}
                                      </span>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Row 4: Collapsible Notes & Tasks */}
                          {!isEditMode && (
                            <div className="pt-2 border-t border-gray-100">
                              {!svc.showNoteArea ? (
                                <button type="button" onClick={() => handleCartChange(index, 'showNoteArea', true)} className="text-sm font-medium text-indigo-600 hover:text-indigo-800 flex items-center gap-1.5 transition">
                                  <FiMessageCircle className="h-4 w-4" /> Add Note or Task for this Service
                                </button>
                              ) : (
                                <div className="bg-gray-50 rounded-xl p-4 border border-gray-200 shadow-inner">
                                  <div className="flex justify-between items-center mb-3">
                                    <label className="text-sm font-semibold text-gray-800 flex items-center gap-1.5">
                                      <FiMessageCircle className="text-indigo-500 h-4 w-4"/> Note & Task Assignment
                                    </label>
                                    <button type="button" onClick={() => { handleCartChange(index, 'showNoteArea', false); handleCartChange(index, 'initialNote', ''); handleCartChange(index, 'createTask', false); }} className="text-xs text-gray-500 hover:text-rose-500 flex items-center gap-1">
                                      <FiX className="h-3 w-3" /> Cancel
                                    </button>
                                  </div>

                                  <MentionsInput
                                    value={svc.initialNote}
                                    onChange={(e, nv, nt, ma) => handleNoteMentionChangeCart(index, e, nv, nt, ma)}
                                    className="mentions-input text-sm"
                                    placeholder="Write a note... Type @ to assign staff members"
                                    style={{
                                      control: { backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: '0.5rem', minHeight: '60px', overflow: 'hidden' },
                                      highlighter: { padding: '0.65rem', boxSizing: 'border-box', margin: 0, lineHeight: 1.5 },
                                      input: { padding: '0.65rem', border: 'none', outline: 'none', boxSizing: 'border-box', height: '100%', margin: 0, lineHeight: 1.5 },
                                      suggestions: { list: { backgroundColor: 'white', border: '1px solid #e2e8f0', zIndex: 100, borderRadius: '0.5rem' }, item: { padding: '5px 10px', borderBottom: '1px solid #f1f5f9' } }
                                    }}
                                  >
                                    <Mention trigger="@" data={fetchStaffSuggestions} markup="@[__display__](__id__)" displayTransform={(id, d) => `@${d}`} renderSuggestion={(suggestion, search, highlightedDisplay) => (<div className="flex items-center gap-2"><FiUser className="text-indigo-500 h-3 w-3"/>{highlightedDisplay}</div>)} />
                                  </MentionsInput>

                                  <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
                                    <select value={svc.initialNoteVisibility} onChange={(e) => handleCartChange(index, 'initialNoteVisibility', e.target.value)} className="text-xs bg-white border border-gray-300 rounded px-2 py-1.5 text-gray-700 shadow-sm">
                                      <option value="centre">🏢 Centre View</option>
                                      <option value="private">🔒 Private</option>
                                      <option value="mentioned_only">👥 Mentions Only</option>
                                    </select>
                                    <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-indigo-700 bg-white border border-indigo-200 px-3 py-1.5 rounded shadow-sm hover:bg-indigo-50 transition">
                                      <input type="checkbox" checked={svc.createTask} onChange={(e) => handleCartChange(index, 'createTask', e.target.checked)} className="rounded text-indigo-600" />
                                      Convert to Task
                                    </label>
                                  </div>

                                  {/* Task Expansion */}
                                  {svc.createTask && (
                                    <div className="mt-3 bg-white p-3 rounded-lg border border-indigo-100 shadow-sm space-y-3">
                                      <input type="text" value={svc.taskTitle} onChange={(e) => handleCartChange(index, 'taskTitle', e.target.value)} placeholder="Task Title *" required className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md focus:ring-indigo-500" />
                                      <div className="grid grid-cols-2 gap-2">
                                        <select value={svc.taskAssignee} onChange={(e) => handleCartChange(index, 'taskAssignee', e.target.value)} required className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md bg-white">
                                          <option value="">Assign To *</option>
                                          {staffList.map(s => <option key={s.id} value={s.id}>{s.display}</option>)}
                                        </select>
                                        <DatePicker selected={svc.taskDueDate} onChange={(date) => handleCartChange(index, 'taskDueDate', date)} placeholderText="Due Date" className="w-full px-3 py-2 text-sm border border-gray-300 rounded-md" minDate={new Date()} dateFormat="dd/MM/yyyy" />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}
                </AnimatePresence>

                {/* ADD ANOTHER SERVICE BUTTON */}
                {!isEditMode && (
                  <button type="button" onClick={addServiceToCart} className="w-full py-3 border-2 border-dashed border-indigo-200 rounded-xl text-indigo-600 font-semibold hover:bg-indigo-50 hover:border-indigo-300 transition flex items-center justify-center gap-2 shadow-sm">
                    <FiPlus className="h-5 w-5" /> Add Another Service for this Customer
                  </button>
                )}
              </div>
            </div> {/* <-- END OF LEFT COLUMN */}

            {/* ======================================================== */}
            {/* RIGHT COLUMN: PAYMENT DETAILS                            */}
            {/* ======================================================== */}
            <div>
              <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 h-full flex flex-col">
                <div className="flex justify-between items-center mb-5">
                  <div className="flex items-center gap-2">
                    <div className="bg-indigo-100 p-2 rounded-lg">
                      <FiDollarSign className="h-5 w-5 text-indigo-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800">Payment Details</h3>
                  </div>
                  <button
                    type="button"
                    onClick={addPayment}
                    disabled={isEditMode}
                    className={`flex items-center gap-1 px-3 py-2 rounded-lg text-sm transition-colors
                      ${isEditMode
                        ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                        : 'bg-indigo-600 text-white hover:bg-indigo-700'}
                    `}
                  >
                    <FiPlus className="h-4 w-4" />
                    Add Payment
                  </button>
                </div>
                
                <div>
                  {isEditMode && (
                    <div className="mb-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg p-3">
                      ⚠️ Payments are locked during edit to protect accounting records.
                    </div>
                  )}
                </div>
                
                <div className="flex-grow space-y-4">
                  {formData.payments.length === 0 ? (
                    <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-xl p-8 text-center h-full flex flex-col justify-center">
                      <FiCreditCard className="mx-auto h-12 w-12 text-gray-400 mb-3" />
                      <p className="text-gray-600 font-medium">No payments added</p>
                      <p className="text-gray-500 text-sm mt-1">Add your first payment method</p>
                    </div>
                  ) : (
                    (formData.payments || []).map((payment, index) => (
                      <div key={index} className="bg-white p-4 rounded-xl border border-gray-200 relative">
                        <div className="absolute top-3 right-3">
                          <button
                            type="button"
                            onClick={() => removePayment(index)}
                            disabled={isEditMode}
                            className={`transition-colors
                              ${isEditMode
                                ? 'text-gray-300 cursor-not-allowed'
                                : 'text-gray-400 hover:text-rose-500'}
                            `}
                          >
                            <FiTrash2 className="h-5 w-5" />
                          </button>
                        </div>
                        
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Payment Method <span className="text-rose-500">*</span>
                            </label>
                            <select
                              value={payment.method}
                              disabled={isEditMode}
                              onChange={(e) => handlePaymentChange(index, 'method', e.target.value)}
                              className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                            >
                              <option value="cash">Cash</option>
                              <option value="wallet">Digital Wallet</option>
                            </select>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Wallet <span className="text-rose-500">*</span>
                            </label>
                            <select
                              value={payment.wallet}
                              disabled={isEditMode}
                              onChange={(e) => handlePaymentChange(index, 'wallet', e.target.value)}
                              className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                            >
                              <option value="">Select wallet</option>
                              {(payment.method === 'cash' ? wallets.offline : wallets.online).map(wallet => (
                                <option key={wallet.id} value={String(wallet.id)}>
                                  {wallet.name} (₹{wallet.balance})
                                </option>
                              ))}
                            </select>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Amount (₹) <span className="text-rose-500">*</span>
                            </label>
                            <div className="relative">
                              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                <FiDollarSign className="h-4 w-4 text-gray-400" />
                              </div>
                              <input
                                type="number"
                                value={payment.amount}
                                disabled={isEditMode}
                                onChange={(e) => handlePaymentChange(index, 'amount', e.target.value)}
                                required
                                min="0"
                                step="0.01"
                                className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                                placeholder="0.00"
                              />
                            </div>
                          </div>
                          
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">
                              Status <span className="text-rose-500">*</span>
                            </label>
                            <select
                              value={payment.status}
                              disabled={isEditMode}
                              onChange={(e) => handlePaymentChange(index, 'status', e.target.value)}
                              className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                            >
                              {paymentStatusOptions.map(option => (
                                <option key={option.id} value={option.id}>
                                  {option.name}
                                </option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
                
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-6 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
                  <div className="space-y-1"><p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Grand Total</p><p className="text-2xl font-black text-gray-900">₹{grandTotal.toFixed(2)}</p></div>
                  <div className="space-y-1"><p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Paid Amount</p><p className="text-2xl font-black text-emerald-600">₹{paidAmount.toFixed(2)}</p></div>
                  <div className="space-y-1"><p className="text-xs text-gray-500 uppercase tracking-wider font-semibold">Pending</p><p className="text-2xl font-black text-amber-500">₹{pendingAmount.toFixed(2)}</p></div>
                  <div className="bg-rose-50 -m-4 p-4 rounded-r-xl border-l border-rose-100 flex flex-col justify-center"><p className="text-xs text-rose-600 uppercase tracking-wider font-semibold">Balance Due</p><p className="text-2xl font-black text-rose-600">₹{balanceAmount.toFixed(2)}</p></div>
                </div>
              </div>
            </div> {/* <-- END OF RIGHT COLUMN */}
            
          </div> {/* <-- END OF MAIN 2-COLUMN GRID */}

          {/* ACTION BUTTONS */}
          <div className="flex justify-end mt-2 gap-4">
            <button
              type="button"
              onClick={() => {
                setFormData({
                  tokenId: '',
                  customerName: '',
                  phone: '',
                  status: 'pending',
                  payments: [],
                  services: [{
                    id: crypto.randomUUID(), category: '', subcategory: '', serviceCharge: '', 
                    departmentCharge: '', totalCharge: '', serviceWalletId: null, requiresWallet: false, 
                    hasExpiry: false, expiryDate: '', initialNote: '', initialNoteMentions: [], 
                    initialNoteVisibility: 'centre', createTask: false, taskTitle: '', taskAssignee: '', taskDueDate: null, showNoteArea: false
                  }]
                });
                setEditingEntryId(null);
              }}
              className="px-6 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors flex items-center gap-2"
            >
              <FiX className="h-5 w-5" />
              Cancel
            </button>
            <button
              type="button"
              onClick={openInvoiceModal}
              className="px-4 py-3 bg-teal-600 text-white rounded-lg hover:bg-teal-700 flex items-center gap-2 shadow-md"
            >
              <FiFileText className="h-5 w-5" />
              Preview Invoice
            </button>
            <button
              type="submit"
              className="px-6 py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-2 shadow-md hover:shadow-lg"
            >
              <FiCheckCircle className="h-5 w-5" />
              {editingEntryId ? 'Update Service Entry' : 'Submit Service Entry'}
            </button>
          </div>
        </form>
      </motion.div>

      {/* ========== UPGRADED NOTES SECTION (EDIT MODE ONLY) ========== */}
      {isEditMode && editingEntryId && (
        <div className="mb-8 transition-all duration-300">
          <div className="bg-gradient-to-r from-indigo-50 to-white rounded-xl p-5 border border-indigo-100 shadow-sm">
            <div className="flex items-center gap-2 mb-4">
              <div className="bg-indigo-100 p-2 rounded-lg">
                <FiMessageCircle className="h-5 w-5 text-indigo-600" />
              </div>
              <h3 className="text-lg font-semibold text-gray-800">Service Notes & Comments</h3>
              <span className="ml-auto text-xs text-gray-400 bg-white px-2 py-1 rounded-full shadow-sm">
                Real-time updates
              </span>
            </div>
            <NotesPanel
              contextType="service_entry"
              contextId={editingEntryId}
              embedded={true}
              showHeader={false}
            />
          </div>
        </div>
      )}

      {/* ========== TODAY'S SERVICE ENTRIES TABLE ========== */}
      <div className="bg-white rounded-xl shadow-md border border-gray-100 p-6">
        <div className="flex justify-between items-center mb-5">
          <h3 className="text-lg font-semibold text-gray-900">Today's Service Entries</h3>
          <div className="flex items-center gap-4">
            <div className="text-sm text-gray-500">{serviceEntries.length} records</div>
            <Link
              to="/dashboard/staff/all-entries"
              className="text-indigo-600 hover:text-indigo-800 text-sm font-medium flex items-center gap-2"
            >
              <FiLink className="h-4 w-4" />
              View All Entries
            </Link>
          </div>
        </div>
        
        {serviceEntries.length === 0 ? (
          <div className="bg-gray-50 border-2 border-dashed border-gray-200 rounded-xl p-8 text-center">
            <FiEye className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <p className="text-gray-600 font-medium">No service entries found for today</p>
            <p className="text-gray-500 text-sm mt-1">Today's submitted service entries will appear here</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Token ID</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Service</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Transactions</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Actions</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {serviceEntries.map(entry => {
                  const deptTx = entry.departmentChargeTransaction;
                  const serviceTx = entry.serviceChargeTransaction;
                  
                  // 🔥 SAFETY: Filter payments to only show latest non-reversal versions
                  const safePayments = getLatestTransactions(entry.payments || []);
                  
                  return (
                    <tr key={entry.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {entry.tokenId ? `#${entry.tokenId}` : 'N/A'}
                       </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        <div className="font-medium flex items-center gap-2">
                          <span className="truncate max-w-[150px] sm:max-w-xs">{entry.customerName}</span>
                          
                          {/* UPGRADED NOTES BADGE with better tooltip */}
                          {entry.notes_count > 0 && (
                            <span 
                              className="inline-flex items-center gap-1 bg-indigo-50 text-indigo-600 text-[10px] font-bold px-2 py-0.5 rounded-full border border-indigo-100 flex-shrink-0 cursor-help transition-all hover:bg-indigo-100"
                              title={`${entry.notes_count} note(s) attached. Click details to view.`}
                            >
                              <FiMessageCircle className="h-3 w-3" />
                              {entry.notes_count}
                            </span>
                          )}
                        </div>
                        <div className="text-gray-500">{entry.phone}</div>
                       </td>
                      <td className="px-6 py-4 text-sm">
                        <div className="font-semibold text-gray-900">{getCategoryName(entry.category)}</div>
                        <div className="text-gray-500 mb-1.5">{getSubcategoryName(entry.category, entry.subcategory)}</div>
                        {entry.expiryDate && entry.expiryDate !== 'N/A' && (
                          <div className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded bg-blue-50 text-blue-700 text-xs font-medium border border-blue-100">
                            <FiCalendar className="h-3 w-3" /> 
                            Exp: {new Date(entry.expiryDate).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        ₹{entry.totalCharge.toFixed(2)}
                       </td>
                      <td className="px-6 py-4 text-sm text-gray-500 max-w-xs">
                        <div className="space-y-2">
                          {/* Department Charge Row */}
                          {deptTx && deptTx.id && !deptTx.is_reversal && (
                            <div className="flex items-center justify-between gap-2 pb-1 border-b border-gray-100">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-rose-600">
                                  <FiTrendingDown className="inline h-3 w-3 mr-1" />
                                  Dept: ₹{Number(deptTx.amount).toFixed(2)}
                                </span>
                                {correctionStatus[deptTx.id]?.corrections_used > 0 && (
                                  <span className="px-1.5 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 flex items-center gap-0.5">
                                    <FiRotateCcw className="h-3 w-3" />
                                    Edited
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => viewTransactionHistory(deptTx.id, 'department_charge')}
                                  className="text-gray-400 hover:text-indigo-600 p-0.5 rounded"
                                  title="View correction history"
                                >
                                  <FiHistory className="h-3.5 w-3.5" />
                                </button>
                                {canCorrectTransaction(deptTx, entry, 'department_charge') && (
                                  <button
                                    onClick={() => openCorrectionModal(deptTx, entry, 'department_charge')}
                                    className="text-amber-500 hover:text-amber-700 p-0.5 rounded"
                                    title="Correct department charge"
                                    disabled={deptTx.is_reversal}
                                  >
                                    <FiEdit3 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          )}

                          {/* Service Charge Row */}
                          {serviceTx && serviceTx.id && !serviceTx.is_reversal && (
                            <div className="flex items-center justify-between gap-2 pb-1 border-b border-gray-100">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-rose-600">
                                  <FiTrendingDown className="inline h-3 w-3 mr-1" />
                                  Service: ₹{Number(serviceTx.amount).toFixed(2)}
                                </span>
                                {correctionStatus[serviceTx.id]?.corrections_used > 0 && (
                                  <span className="px-1.5 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 flex items-center gap-0.5">
                                    <FiRotateCcw className="h-3 w-3" />
                                    Edited
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1">
                                <button
                                  onClick={() => viewTransactionHistory(serviceTx.id, 'service_charge')}
                                  className="text-gray-400 hover:text-indigo-600 p-0.5 rounded"
                                  title="View correction history"
                                >
                                  <FiHistory className="h-3.5 w-3.5" />
                                </button>
                                {canCorrectTransaction(serviceTx, entry, 'service_charge') && (
                                  <button
                                    onClick={() => openCorrectionModal(serviceTx, entry, 'service_charge')}
                                    className="text-amber-500 hover:text-amber-700 p-0.5 rounded"
                                    title="Correct service charge"
                                    disabled={serviceTx.is_reversal}
                                  >
                                    <FiEdit3 className="h-3.5 w-3.5" />
                                  </button>
                                )}
                              </div>
                            </div>
                          )}

                          {/* 🔥 SAFETY: Use filtered payments (latest non-reversal only) */}
                          {safePayments.map((payment, idx) => {
                            const status = correctionStatus[payment.transaction_id || payment.id];
                            const hasBeenCorrected = status?.corrections_used > 0;
                            const correctionId = payment.transaction_id || payment.id;
                            return (
                              <div key={idx} className="flex items-center justify-between gap-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span>
                                    {getWalletName(payment.wallet)}: ₹{Number(payment.amount).toFixed(2)} ({payment.status})
                                  </span>
                                  {hasBeenCorrected && (
                                    <span className="px-1.5 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700 flex items-center gap-0.5">
                                      <FiRotateCcw className="h-3 w-3" />
                                      Edited
                                    </span>
                                  )}
                                </div>
                                <div className="flex items-center gap-1">
                                  <button
                                    onClick={() => viewTransactionHistory(correctionId, 'payment')}
                                    className="text-gray-400 hover:text-indigo-600 p-0.5 rounded"
                                    title="View correction history"
                                  >
                                    <FiHistory className="h-3.5 w-3.5" />
                                  </button>
                                  {/* 🔥 CRITICAL FIX: Using wallet_transactions.id */}
                                  {canCorrectTransaction(payment, entry, 'payment') && payment.status === 'received' && (
                                    <button
                                      onClick={() => {
                                        console.log("🔍 Correcting Payment - TX ID:", correctionId, 
                                          "| Amount:", payment.amount, 
                                          "| Wallet:", payment.wallet,
                                          "| is_reversal:", payment.is_reversal);
                                        openCorrectionModal(payment, entry, 'payment');
                                      }}
                                      className="text-amber-500 hover:text-amber-700 p-0.5 rounded"
                                      title="Correct this payment"
                                      disabled={payment.is_reversal}
                                    >
                                      <FiEdit3 className="h-3.5 w-3.5" />
                                    </button>
                                  )}
                                </div>
                              </div>
                            );
                          })}
                        </div>
                       </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${getServiceStatusDisplay(entry.status).color}`}>
                          {getServiceStatusDisplay(entry.status).name}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium flex gap-2">
                        <button
                          onClick={() => setSelectedEntry(entry)}
                          className="text-indigo-600 hover:text-indigo-900 p-1.5 rounded-lg hover:bg-indigo-50"
                          title="View details"
                        >
                          <FiEye className="h-5 w-5" />
                        </button>
                        {/* 🔥 FIXED: Admin can always edit, staff can only edit if it hasn't been edited yet */}
                        {isToday(entry.created_at) && (!entry.is_edited || userRole === 'admin' || userRole === 'superadmin') && (
                          <button
                            onClick={() => handleEditEntry(entry)}
                            className={`p-1.5 rounded-lg ${entry.is_edited ? 'text-amber-600 hover:bg-amber-50' : 'text-emerald-600 hover:bg-emerald-50'}`}
                            title={entry.is_edited ? "Admin Override Edit" : "Edit this entry (once only)"}
                          >
                            ✏️
                          </button>
                        )}
                        {isToday(entry.created_at) && entry.is_edited && userRole === 'staff' && (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-200 text-gray-700">
                            Edited
                          </span>
                        )}
                        {/* 🔥 NEW DELETE BUTTON FOR ADMINS ONLY */}
                        {(userRole === 'admin' || userRole === 'superadmin') && (
                          <button
                            onClick={() => setDeleteDialog({ isOpen: true, entryId: entry.id, loading: false })}
                            className="text-rose-600 hover:text-rose-900 p-1.5 rounded-lg hover:bg-rose-50"
                            title="Delete this entry completely"
                          >
                            <FiTrash2 className="h-5 w-5" />
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ========== CUSTOM CONFIRMATION MODAL (BLURRED BACKGROUND) ========== */}
      {confirmDialog.isOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[60]">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl transform transition-all">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-amber-100 p-2 rounded-full">
                <FiAlertCircle className="h-6 w-6 text-amber-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">{confirmDialog.title}</h3>
            </div>
            <p className="text-gray-600 text-sm mb-6">{confirmDialog.message}</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDialog({ isOpen: false, title: '', message: '', onConfirm: null })}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={confirmDialog.onConfirm}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors font-medium text-sm shadow-sm"
              >
                Proceed
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== UPGRADED ENTRY DETAILS MODAL with better notes section ========== */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-40">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4 sticky top-0 bg-white pb-2 border-b">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FiFileText className="h-5 w-5 text-indigo-600" />
                Service Entry Details
              </h2>
              <button onClick={() => setSelectedEntry(null)} className="text-gray-500 hover:text-gray-700 p-1 rounded-full hover:bg-gray-100">
                <FiX className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-3 text-sm">
                <p><strong>Token ID:</strong> {selectedEntry.tokenId ? `#${selectedEntry.tokenId}` : 'N/A'}</p>
                <p><strong>Customer Name:</strong> {selectedEntry.customerName}</p>
                <p><strong>Phone:</strong> {selectedEntry.phone}</p>
                <p><strong>Service:</strong> {getCategoryName(selectedEntry.category)}</p>
                <p><strong>Subcategory:</strong> {getSubcategoryName(selectedEntry.category, selectedEntry.subcategory)}</p>
                <p><strong>Service Charge:</strong> ₹{selectedEntry.serviceCharge.toFixed(2)}</p>
                <p><strong>Department Charge:</strong> ₹{selectedEntry.departmentCharge.toFixed(2)}</p>
                <p><strong>Total Charge:</strong> ₹{selectedEntry.totalCharge.toFixed(2)}</p>
                <p><strong>Status:</strong> 
                  <span className={`ml-2 px-2 py-0.5 text-xs rounded-full ${getServiceStatusDisplay(selectedEntry.status).color}`}>
                    {getServiceStatusDisplay(selectedEntry.status).name}
                  </span>
                </p>
                <p><strong>Expiry Date:</strong> {selectedEntry.expiryDate || 'N/A'}</p>
              </div>
              <div>
                <strong className="block mb-2">Payments:</strong>
                <ul className="list-disc pl-5 space-y-1 text-sm">
                  {getLatestTransactions(selectedEntry.payments || []).map((p, i) => (
                    <li key={i}>{formatPayments([p])}</li>
                  ))}
                </ul>
              </div>
            </div>
            {/* UPGRADED NOTES PANEL WITH BETTER VISIBILITY */}
            <div className="mt-6 border-t border-gray-200 pt-5">
              <div className="flex items-center gap-2 mb-3">
                <FiMessageCircle className="h-4 w-4 text-indigo-500" />
                <h4 className="font-semibold text-gray-800">Notes & Comments</h4>
                {selectedEntry.notes_count > 0 && (
                  <span className="text-xs bg-indigo-100 text-indigo-700 px-2 py-0.5 rounded-full">
                    {selectedEntry.notes_count} note(s)
                  </span>
                )}
              </div>
              <NotesPanel 
                contextType="service_entry" 
                contextId={selectedEntry.id} 
                embedded={true} 
                showHeader={false}
              />
            </div>
          </div>
        </div>
      )}

      {/* ========== UNIFIED TRANSACTION CORRECTION MODAL (BLURRED BACKGROUND) ========== */}
      {correctionModal.isOpen && correctionModal.transaction && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-md w-full mx-4">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FiRotateCcw className="h-5 w-5 text-amber-600" />
                Correct {getTransactionTypeLabel(correctionModal.transactionType)}
              </h2>
              <button 
                onClick={() => setCorrectionModal({ isOpen: false, transaction: null, loading: false, newAmount: '', newWalletId: '', reason: '', transactionType: '' })}
                className="text-gray-500 hover:text-gray-700"
              >
                <FiX className="h-6 w-6" />
              </button>
            </div>
            
            <div className="space-y-4">
              <div className="bg-amber-50 p-4 rounded-lg border border-amber-200">
                <p className="text-sm text-amber-800 font-medium mb-2">
                  Original {getTransactionTypeLabel(correctionModal.transactionType)}
                </p>
                <p className="text-gray-700">
                  <strong>Amount:</strong> ₹{formatAmount(correctionModal.transaction.amount)}
                </p>
                <p className="text-gray-700">
                  <strong>Wallet:</strong> {getWalletName(correctionModal.transaction.wallet_id || correctionModal.transaction.wallet)}
                </p>
                <p className="text-gray-700 text-xs mt-1">
                  <strong>Type:</strong> {correctionModal.transactionType === 'payment' ? 'Credit (Money In)' : 'Debit (Money Out)'}
                </p>
              </div>
              
              {userRole === 'staff' && correctionStatus[correctionModal.transaction.id] && (
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
                  <p className="text-sm text-blue-800">
                    <FiAlertCircle className="inline mr-1" />
                    Corrections used: {correctionStatus[correctionModal.transaction.id].corrections_used} of 2
                  </p>
                </div>
              )}
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Amount (₹) <span className="text-rose-500">*</span>
                </label>
                <input
                  type="number"
                  value={correctionModal.newAmount}
                  onChange={(e) => setCorrectionModal(prev => ({ ...prev, newAmount: e.target.value }))}
                  min="0.01"
                  step="0.01"
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Enter new amount"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  New Wallet <span className="text-rose-500">*</span>
                </label>
                <select
                  value={correctionModal.newWalletId}
                  onChange={(e) => {
                  const value = e.target.value;
                  if (value) {
                    const allWallets = [...wallets.offline, ...wallets.online];
                    const selectedWallet = allWallets.find(w => w.id === parseInt(value));
                    
                    if (selectedWallet && selectedWallet.is_shared === false && selectedWallet.assigned_staff_id !== null) {
                      setConfirmDialog({
                        isOpen: true,
                        title: 'Personal Wallet Selected',
                        message: `You are selecting a personal wallet (${selectedWallet.name}). Do you want to use it for this correction?`,
                        onConfirm: () => {
                          setConfirmDialog(prev => ({ ...prev, isOpen: false }));
                          setCorrectionModal(prev => ({ ...prev, newWalletId: value }));
                        }
                      });
                      return;
                    }
                  }
                  setCorrectionModal(prev => ({ ...prev, newWalletId: value }));
                }}
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                >
                  <option value="">Select wallet</option>
                  <optgroup label="Cash Wallets">
                    {wallets.offline.map(w => (
                      <option key={w.id} value={String(w.id)}>
                        {w.name} (₹{w.balance})
                      </option>
                    ))}
                  </optgroup>
                  <optgroup label="Digital Wallets">
                    {wallets.online.map(w => (
                      <option key={w.id} value={String(w.id)}>
                        {w.name} (₹{w.balance})
                      </option>
                    ))}
                  </optgroup>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Correction Reason <span className="text-rose-500">*</span>
                </label>
                <textarea
                  value={correctionModal.reason}
                  onChange={(e) => setCorrectionModal(prev => ({ ...prev, reason: e.target.value }))}
                  rows={3}
                  className="w-full px-4 py-2.5 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Explain why this transaction needs correction..."
                />
                <p className="text-xs text-gray-500 mt-1">Minimum 5 characters</p>
              </div>
              
              <div className="bg-gray-50 p-3 rounded-lg border border-gray-200">
                <p className="text-xs text-gray-600">
                  <FiAlertCircle className="inline mr-1 text-amber-600" />
                  <strong>Note:</strong> This will reverse the original transaction and create a new corrected one. 
                  All changes are logged for audit purposes.
                </p>
              </div>
            </div>
            
            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setCorrectionModal({ isOpen: false, transaction: null, loading: false, newAmount: '', newWalletId: '', reason: '', transactionType: '' })}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={submitCorrection}
                disabled={correctionModal.loading}
                className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-2 disabled:opacity-50"
              >
                {correctionModal.loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Processing...
                  </>
                ) : (
                  <>
                    <FiCheck className="h-4 w-4" />
                    Confirm Correction
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== UNIFIED TRANSACTION HISTORY MODAL (BLURRED BACKGROUND) ========== */}
      {historyModal.isOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold flex items-center gap-2">
                <FiHistory className="h-5 w-5 text-indigo-600" />
                {getTransactionTypeLabel(historyModal.transactionType)} Correction History
              </h2>
              <button 
                onClick={() => setHistoryModal({ isOpen: false, transactionId: null, history: [], loading: false, transactionType: '' })}
                className="text-gray-500 hover:text-gray-700"
              >
                <FiX className="h-6 w-6" />
              </button>
            </div>
            
            {historyModal.loading ? (
              <div className="flex justify-center py-8">
                <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
              </div>
            ) : !Array.isArray(historyModal.history) || historyModal.history.length === 0 ? (
              <p className="text-gray-500 text-center py-8">No correction history found</p>
            ) : (
              <div className="space-y-4">
                <div className="text-xs text-gray-500 mb-2 flex items-center gap-2">
                  <span>Showing all versions (oldest first)</span>
                  <span className="flex-1 h-px bg-gray-200"></span>
                </div>
                
                {[...historyModal.history]
                  .sort((a, b) => new Date(a.created_at) - new Date(b.created_at))
                  .map((entry, idx, arr) => {
                    const nonReversal = arr.filter(t => !t.is_reversal);
                    const oldest = nonReversal[0];
                    let type = "correction";
                    if (entry.id === oldest?.id) type = "original";
                    else if (entry.is_reversal) type = "reversal";
                
                    const getEntryStyles = (type) => {
                      switch (type) {
                        case 'original':
                          return { bg: 'bg-blue-50', border: 'border-blue-200', badge: 'bg-blue-200 text-blue-700', icon: '💳', label: 'Original' };
                        case 'reversal':
                          return { bg: 'bg-rose-50', border: 'border-rose-200', badge: 'bg-rose-200 text-rose-700', icon: '↩️', label: 'Reversal' };
                        default:
                          return { bg: 'bg-emerald-50', border: 'border-emerald-200', badge: 'bg-emerald-200 text-emerald-700', icon: '✅', label: 'Correction' };
                      }
                    };
                
                    const styles = getEntryStyles(type);
                    const latestNonReversal = [...nonReversal].pop();
                    const isLatest = entry.id === latestNonReversal?.id;
                
                    return (
                      <div key={idx} className="relative">
                        {idx < arr.length - 1 && (
                          <div className="absolute left-5 top-12 bottom-0 w-0.5 bg-gray-300 -mb-4"></div>
                        )}
                
                        <div className={`p-4 rounded-lg border ${styles.bg} ${styles.border} relative ml-2`}>
                          <div className={`absolute -left-[13px] top-5 w-3 h-3 rounded-full ${
                            type === 'original' ? 'bg-blue-500' :
                            type === 'reversal' ? 'bg-rose-500' : 'bg-emerald-500'
                          } border-2 border-white`}></div>
                
                          <div className="flex justify-between items-start mb-2">
                            <div className="flex items-center gap-2">
                              <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${styles.badge}`}>
                                {styles.icon} {styles.label}
                              </span>
                              {isLatest && type !== 'original' && (
                                <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                                  Current
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-gray-500">{formatDate(entry.created_at)}</span>
                          </div>
                
                          <div className="ml-1 space-y-1.5">
                            <p className="text-sm font-medium">
                              Amount: <span className="font-semibold">₹{formatAmount(entry.amount)}</span>
                              <span className="text-gray-500 mx-2">→</span>
                              <span className="font-medium">{entry.wallet_name || 'Unknown Wallet'}</span>
                            </p>
                            <p className="text-xs text-gray-500">
                              Type: <span className={entry.type === 'credit' ? 'text-emerald-600' : 'text-rose-600'}>
                                {entry.type === 'credit' ? 'Credit (Money In)' : 'Debit (Money Out)'}
                              </span>
                            </p>
                            {entry.description && entry.description.includes('Reason:') && (
                              <p className="text-sm text-gray-600 bg-white/50 p-2 rounded">
                                <strong>Reason:</strong> {entry.description.split('Reason:')[1]?.split('(Was:')[0]?.trim()}
                              </p>
                            )}
                            {entry.staff_name && (
                              <p className="text-xs text-gray-500 flex items-center gap-1">
                                <FiUser className="h-3 w-3" />
                                Corrected by: {entry.staff_name}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
            
            <div className="flex justify-end mt-6 pt-3 border-t border-gray-200">
              <button
                onClick={() => setHistoryModal({ isOpen: false, transactionId: null, history: [], loading: false, transactionType: '' })}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== INVOICE GENERATOR MODAL (BLURRED BACKGROUND) ========== */}
      {invoiceModalOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-50">
          <div className="bg-white rounded-xl p-6 w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Edit Invoice</h2>
              <button
                onClick={() => setInvoiceModalOpen(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                <FiX className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Customer details */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Customer Name
                  </label>
                  <input
                    type="text"
                    value={invoiceData.customerName}
                    onChange={(e) =>
                      setInvoiceData({ ...invoiceData, customerName: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Phone
                  </label>
                  <input
                    type="text"
                    value={invoiceData.phone}
                    onChange={(e) =>
                      setInvoiceData({ ...invoiceData, phone: e.target.value })
                    }
                    className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  />
                </div>
              </div>

              {/* Editable line items */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Invoice Items
                </label>
                {invoiceData.items.map((item, idx) => (
                  <div key={idx} className="flex gap-2 mb-3 items-center">
                    <input
                      type="text"
                      placeholder="Description"
                      value={item.description}
                      onChange={(e) => {
                        const newItems = [...invoiceData.items];
                        newItems[idx].description = e.target.value;
                        setInvoiceData({ ...invoiceData, items: newItems });
                      }}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-md"
                    />
                    <input
                      type="number"
                      placeholder="Amount"
                      value={item.amount}
                      onChange={(e) => {
                        const newItems = [...invoiceData.items];
                        newItems[idx].amount = e.target.value;
                        setInvoiceData({ ...invoiceData, items: newItems });
                      }}
                      className="w-28 px-3 py-2 border border-gray-300 rounded-md"
                    />
                    {invoiceData.items.length > 1 && (
                      <button
                        type="button"
                        onClick={() => {
                          const newItems = invoiceData.items.filter((_, i) => i !== idx);
                          setInvoiceData({ ...invoiceData, items: newItems });
                        }}
                        className="text-rose-500 hover:text-rose-700"
                      >
                        <FiTrash2 className="h-5 w-5" />
                      </button>
                    )}
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    setInvoiceData({
                      ...invoiceData,
                      items: [...invoiceData.items, { description: '', amount: '' }],
                    })
                  }
                  className="text-sm text-indigo-600 hover:text-indigo-800 flex items-center gap-1"
                >
                  <FiPlus className="h-4 w-4" /> Add Item
                </button>
              </div>

              {/* Total displayed */}
              <div className="bg-gray-50 p-3 rounded-lg flex justify-between">
                <span className="font-medium">Total</span>
                <span className="font-bold text-indigo-700">
                  ₹
                  {invoiceData.items
                    .reduce((sum, it) => sum + parseFloat(it.amount || 0), 0)
                    .toFixed(2)}
                </span>
              </div>

              {/* Notes */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Notes (optional)
                </label>
                <textarea
                  value={invoiceData.notes}
                  onChange={(e) =>
                    setInvoiceData({ ...invoiceData, notes: e.target.value })
                  }
                  rows={2}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md"
                  placeholder="Any additional remarks…"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setInvoiceModalOpen(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md"
              >
                Cancel
              </button>
              <button
                onClick={generateInvoicePDF}
                className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700 flex items-center gap-2"
              >
                <FiFileText className="h-4 w-4" />
                Download Invoice PDF
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ========== DELETE CONFIRMATION MODAL (BLURRED BACKGROUND) ========== */}
      {deleteDialog.isOpen && (
        <div className="fixed inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-[70]">
          <div className="bg-white rounded-xl p-6 max-w-sm w-full mx-4 shadow-2xl transform transition-all">
            <div className="flex items-center gap-3 mb-4">
              <div className="bg-rose-100 p-2 rounded-full">
                <FiAlertCircle className="h-6 w-6 text-rose-600" />
              </div>
              <h3 className="text-lg font-bold text-gray-900">Delete Service Entry?</h3>
            </div>
            <p className="text-gray-600 text-sm mb-6">
              Are you sure you want to permanently delete this service entry?
              <br/><br/>
              <strong>Note:</strong> You cannot delete an entry if payments have already been collected. You must reverse the payments first.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteDialog({ isOpen: false, entryId: null, loading: false })}
                disabled={deleteDialog.loading}
                className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors font-medium text-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteEntry}
                disabled={deleteDialog.loading}
                className="px-4 py-2 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors font-medium text-sm shadow-sm flex items-center gap-2 disabled:opacity-50"
              >
                {deleteDialog.loading ? (
                  <>
                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                    Deleting...
                  </>
                ) : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ServiceEntry;
