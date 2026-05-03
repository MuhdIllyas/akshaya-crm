import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion';
import { 
  FiUser, FiPhone, FiCreditCard, FiDollarSign, FiCheck, FiX, FiCheckCircle, 
  FiChevronDown, FiPlus, FiTrash2, FiCalendar, FiClock, FiEye, FiLink, 
  FiFileText, FiEdit3, FiRotateCcw, FiAlertCircle, FiClock as FiHistory,
  FiTrendingDown
} from 'react-icons/fi';
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';
import { getCategories, getWallets, getServiceEntries, createServiceEntry, getTokenById, updateServiceEntry } from '/src/services/serviceService';
import api from '@/services/serviceService';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';

// 🔥 SAFETY LAYER: Get only latest non-reversal transactions per correction group
const getLatestTransactions = (transactions) => {
  if (!Array.isArray(transactions)) return [];
  
  const map = new Map();
  
  transactions.forEach(tx => {
    // Skip reversal transactions entirely
    if (tx.is_reversal) return;
    
    const groupId = tx.correction_group_id || `direct-${tx.id}`;
    const existing = map.get(groupId);
    
    if (!existing || new Date(tx.created_at) > new Date(existing.created_at)) {
      map.set(groupId, tx);
    }
  });
  
  return Array.from(map.values());
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
  
  const [correctionStatus, setCorrectionStatus] = useState({});
  
  const [formData, setFormData] = useState({
    tokenId: tokenId || '',
    customerName: '',
    phone: '',
    category: '',
    subcategory: '',
    serviceCharge: '',
    departmentCharge: '',
    totalCharge: '',
    status: 'pending',
    expiryDate: '',
    payments: [],
    serviceWalletId: null,
    requiresWallet: false,
    hasExpiry: false,
  });

  const [wallets, setWallets] = useState({ offline: [], online: [] });
  const [categories, setCategories] = useState([]);
  const [filteredSubcategories, setFilteredSubcategories] = useState([]);
  const [selectedSubcategory, setSelectedSubcategory] = useState(null);
  const [selectedCategoryDocuments, setSelectedCategoryDocuments] = useState([]);
  const [selectedSubcategoryDocuments, setSelectedSubcategoryDocuments] = useState([]);
  const [selectedWebsite, setSelectedWebsite] = useState(null);
  const [totalCharge, setTotalCharge] = useState(0);
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
  
  // ========== INVOICE GENERATOR STATE ==========
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceData, setInvoiceData] = useState({
    customerName: '',
    phone: '',
    items: [{ description: '', amount: '' }],
    notes: '',
  });
  
  const userRole = localStorage.getItem('role') || 'staff';
  const userId = localStorage.getItem('id');

  const handleEditEntry = (entry) => {
    setEditingEntryId(entry.id);

    setFormData({
      tokenId: entry.tokenId || '',
      customerName: entry.customerName || '',
      phone: entry.phone || '',
      category: entry.category ? String(entry.category) : '',
      subcategory: entry.subcategory ? String(entry.subcategory) : '',
      serviceCharge: String(entry.serviceCharge ?? ''),
      departmentCharge: String(entry.departmentCharge ?? ''),
      totalCharge: String(entry.totalCharge ?? ''),
      status: entry.status || 'pending',
      expiryDate: entry.expiryDate || '',
      payments: entry.payments || [],
      serviceWalletId: entry.serviceWalletId ? String(entry.serviceWalletId) : null,
      requiresWallet: entry.requiresWallet || false,
      hasExpiry: Boolean(entry.expiryDate),
    });

    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const paymentStatusOptions = [
    { id: 'received', name: 'Received', color: 'bg-emerald-100 text-emerald-800' },
    { id: 'pending', name: 'Pending', color: 'bg-amber-100 text-amber-800' },
  ];

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
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error('Please enter a valid amount');
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
    
    setCorrectionModal(prev => ({ ...prev, loading: true }));
    
    try {
      // 🔥 FIX: Only send changed fields
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
      
      console.log('📤 Correction API Payload:', payload);
      console.log('📤 Correcting Transaction ID:', transaction.id);
      
      // 🔥 API call uses wallet_transactions.id
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

  // ========== INVOICE GENERATOR FUNCTIONS ==========
  const openInvoiceModal = () => {
    // Build default items from current formData
    const items = [
      { description: 'Service Charge', amount: formData.serviceCharge || '0' },
      {
        description: 'Department Charge',
        amount: formData.departmentCharge || '0',
      },
    ];

    setInvoiceData({
      customerName: formData.customerName,
      phone: formData.phone,
      items,
      notes: '',
    });
    setInvoiceModalOpen(true);
  };

const generateInvoicePDF = () => {
  const doc = new jsPDF();

  // Brand colours
  const navy = '#0F172A';        // dark sidebar navy
  const white = '#FFFFFF';
  const accent = '#3B82F6';      // bright blue for accents (optional)

  // ---- HEADER BAND ----
  doc.setFillColor(navy);
  doc.rect(0, 0, 210, 35, 'F');   // full width top bar

  // Try to add logo, if available
  try {
    // logo-dark should be a PNG in /public (e.g., logo-dark.png)
    doc.addImage('/logo-light.png', 'PNG', 10, 5, 22, 22);
  } catch (e) {
    // fallback: centre name as text
    doc.setTextColor(white);
    doc.setFontSize(16);
    doc.text('Akshaya e Centre', 14, 18);
  }

  // Centre name / address on the right
  doc.setTextColor(white);
  doc.setFontSize(14);
  doc.text('Akshaya e Centre Pukayur', 120, 16);
  doc.setFontSize(8);
  doc.text('Olakara PO, Malappuram , Kerala ', 120, 24);
  doc.text('Pin - 676306 | +91 8078924261', 120, 24);

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

  // ---- ITEMS TABLE ----
  const tableBody = invoiceData.items.map((item, idx) => [
    idx + 1,
    item.description,
    `Rs. ${parseFloat(item.amount || 0).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
  ]);
  const total = invoiceData.items.reduce((sum, it) => sum + parseFloat(it.amount || 0), 0);

  autoTable(doc, {
    startY: 78,
    head: [['#', 'Description', 'Amount (Rs.)']],
    body: tableBody,
    foot: [['', 'Total', `Rs. ${total.toLocaleString('en-IN', { minimumFractionDigits: 2 })}`]],
    theme: 'plain',
    styles: {
      font: 'helvetica',
      fontSize: 10,
      cellPadding: 4,
    },
    headStyles: {
      fillColor: navy,
      textColor: white,
      fontStyle: 'bold',
    },
    footStyles: {
      fillColor: '#f1f5f9',
      textColor: navy,
      fontStyle: 'bold',
    },
    columnStyles: {
      0: { cellWidth: 10 },
      1: { cellWidth: 'auto' },
      2: { halign: 'right' },
    },
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

  // Thank you line (never white-on-white – always visible)
  doc.setFontSize(8);
  doc.setTextColor(100, 100, 100);
  doc.text('Thank you for your visit — Akshaya e Centre Pukayur', 14, finalY + 4);

  // Save
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
              category: tokenData.category_id ? String(tokenData.category_id) : '',
              subcategory: tokenData.subcategory_id ? String(tokenData.subcategory_id) : '',
              serviceCharge: String(serviceCharge),
              departmentCharge: String(departmentCharge),
              totalCharge: String(totalCharge),
              status: tokenData.status === 'done' ? 'completed' : tokenData.status || 'pending',
              expiryDate: tokenData.expiry_date || '',
              payments: tokenData.payments?.length > 0 ? tokenData.payments.map(p => ({
                wallet: String(p.wallet || ''),
                method: p.method || 'cash',
                amount: String(p.amount || ''),
                status: p.status || 'pending',
              })) : [],
              serviceWalletId: tokenData.service_wallet_id ? parseInt(tokenData.service_wallet_id) : category?.wallet_id ? parseInt(category.wallet_id) : null,
              requiresWallet: category?.requires_wallet || subcategory?.requires_wallet || tokenData.requires_wallet || false,
              hasExpiry: category?.has_expiry || tokenData.has_expiry || false,
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
              category: booking.service_id ? String(booking.service_id) : '',
              subcategory: booking.subcategory_id ? String(booking.subcategory_id) : '',
              serviceCharge: String(serviceCharge),
              departmentCharge: String(departmentCharge),
              totalCharge: String(totalCharge),
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
    if (formData.category && categories.length > 0) {
      const category = categories.find(cat => cat.id === parseInt(formData.category));
      if (category) {
        setFilteredSubcategories(category.subcategories || []);
        const serviceWalletId = category.wallet_id ? parseInt(category.wallet_id) : formData.serviceWalletId;
        const requiresWallet = category.requires_wallet || (category.subcategories && category.subcategories.some(sub => sub.requires_wallet)) || formData.requiresWallet;
        const hasExpiry = category.has_expiry || formData.hasExpiry;
        const categoryDocs = (category.required_documents || []).filter(doc => doc.service_id === parseInt(formData.category) && !doc.sub_category_id);
        setFormData(prev => ({
          ...prev,
          serviceWalletId,
          requiresWallet,
          hasExpiry,
          expiryDate: hasExpiry && !prev.expiryDate ? new Date(new Date().setDate(new Date().getDate() + 90)).toISOString().split('T')[0] : prev.expiryDate,
        }));
        setSelectedCategoryDocuments(categoryDocs);
        setSelectedWebsite(category.website || null);
        console.log('ServiceEntry.jsx: Set formData for category:', {
          category: category.name,
          serviceWalletId,
          requiresWallet,
          hasExpiry,
          subcategories: category.subcategories ? category.subcategories.map(sub => sub.name) : [],
          required_documents: categoryDocs,
          website: category.website,
        });
        if (!formData.subcategory && category.subcategories && category.subcategories.length > 0 && !formData.subcategory) {
          const firstSub = category.subcategories[0];
          const serviceCharge = parseFloat(firstSub.service_charges) || parseFloat(formData.serviceCharge) || 0;
          const departmentCharge = parseFloat(firstSub.department_charges) || parseFloat(formData.departmentCharge) || 0;
          const totalCharge = serviceCharge + departmentCharge;
          const subDocs = (firstSub.required_documents || []).filter(doc => doc.sub_category_id === firstSub.id);
          setFormData(prev => ({
            ...prev,
            subcategory: String(firstSub.id),
            serviceCharge: String(serviceCharge),
            departmentCharge: String(departmentCharge),
            totalCharge: String(totalCharge),
            requiresWallet: firstSub.requires_wallet || prev.requiresWallet,
          }));
          setSelectedSubcategory(firstSub);
          setSelectedSubcategoryDocuments(subDocs);
          console.log('ServiceEntry.jsx: Set formData for first subcategory:', {
            subcategory: firstSub.name,
            serviceCharge,
            departmentCharge,
            totalCharge,
            requiresWallet: firstSub.requires_wallet,
            required_documents: subDocs,
          });
        }
      } else {
        setFormData(prev => ({
          ...prev,
          subcategory: prev.subcategory || '',
          serviceCharge: prev.serviceCharge || '',
          departmentCharge: prev.departmentCharge || '',
          totalCharge: prev.totalCharge || '',
          serviceWalletId: prev.serviceWalletId || null,
          requiresWallet: prev.requiresWallet || false,
          hasExpiry: prev.hasExpiry || false,
          expiryDate: prev.expiryDate || '',
        }));
        setFilteredSubcategories([]);
        setSelectedSubcategory(null);
        setSelectedCategoryDocuments([]);
        setSelectedSubcategoryDocuments([]);
        setSelectedWebsite(null);
        console.log('ServiceEntry.jsx: Category not found, preserving existing formData');
        toast.warn('Selected category not found in categories data. Please select manually.');
      }
    } else {
      setFilteredSubcategories([]);
      setFormData(prev => ({
        ...prev,
        subcategory: prev.subcategory || '',
        serviceCharge: prev.serviceCharge || '',
        departmentCharge: prev.departmentCharge || '',
        totalCharge: prev.totalCharge || '',
        serviceWalletId: prev.serviceWalletId || null,
        requiresWallet: prev.requiresWallet || false,
        hasExpiry: prev.hasExpiry || false,
        expiryDate: prev.expiryDate || '',
      }));
      setSelectedSubcategory(null);
      setSelectedCategoryDocuments([]);
      setSelectedSubcategoryDocuments([]);
      setSelectedWebsite(null);
      console.log('ServiceEntry.jsx: No category selected, preserving existing formData');
    }
  }, [formData.category, categories]);

  useEffect(() => {
    if (formData.subcategory && filteredSubcategories.length > 0) {
      const subcategory = filteredSubcategories.find(sub => sub.id === parseInt(formData.subcategory));
      if (subcategory) {
        const subDocs = (subcategory.required_documents || []).filter(doc => doc.sub_category_id === parseInt(formData.subcategory));
        const serviceCharge = parseFloat(subcategory.service_charges) || parseFloat(formData.serviceCharge) || 0;
        const departmentCharge = parseFloat(subcategory.department_charges) || parseFloat(formData.departmentCharge) || 0;
        const totalCharge = serviceCharge + departmentCharge;
        setFormData(prev => ({
          ...prev,
          serviceCharge: String(serviceCharge),
          departmentCharge: String(departmentCharge),
          totalCharge: String(totalCharge),
          requiresWallet: subcategory.requires_wallet || prev.requiresWallet,
        }));
        setSelectedSubcategory(subcategory);
        setSelectedSubcategoryDocuments(subDocs);
        console.log('ServiceEntry.jsx: Set selectedSubcategory:', {
          subcategory: subcategory.name,
          serviceCharge,
          departmentCharge,
          requiresWallet: subcategory.requires_wallet,
          required_documents: subDocs,
        });
      } else {
        setFormData(prev => ({
          ...prev,
          serviceCharge: prev.serviceCharge || '',
          departmentCharge: prev.departmentCharge || '',
          totalCharge: prev.totalCharge || '',
          requiresWallet: prev.requiresWallet || false,
        }));
        setSelectedSubcategory(null);
        setSelectedSubcategoryDocuments([]);
        console.log('ServiceEntry.jsx: Subcategory not found, preserving existing charges');
        toast.warn('Selected subcategory not found. Please select manually.');
      }
    } else {
      setSelectedSubcategory(null);
      setSelectedSubcategoryDocuments([]);
    }
  }, [formData.subcategory, filteredSubcategories]);

  useEffect(() => {
    const service = parseFloat(formData.serviceCharge) || 0;
    const dept = parseFloat(formData.departmentCharge) || 0;
    const total = service + dept;
    setTotalCharge(total);
    setFormData(prev => ({
      ...prev,
      totalCharge: String(total),
    }));

    const received = formData.payments
      .filter(p => p.status === 'received')
      .reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0);

    const pending = formData.payments
      .filter(p => p.status === 'pending')
      .reduce((sum, payment) => sum + (parseFloat(payment.amount) || 0), 0);

    setPaidAmount(received);
    setPendingAmount(pending);
    setBalanceAmount(total - received);

    if (received >= total && total > 0) {
      setFormData(prev => ({ ...prev, status: 'completed' }));
    } else {
      setFormData(prev => ({ ...prev, status: 'pending' }));
    }
    console.log('ServiceEntry.jsx: Updated totals:', {
      totalCharge: total,
      paidAmount: received,
      pendingAmount: pending,
      balanceAmount: total - received,
      status: received >= total && total > 0 ? 'completed' : 'pending',
    });
  }, [formData.serviceCharge, formData.departmentCharge, formData.payments]);

  useEffect(() => {
    if (formData.hasExpiry && formData.category && !formData.expiryDate) {
      const today = new Date();
      const expiry = new Date();
      expiry.setDate(today.getDate() + 90);
      const formattedDate = expiry.toISOString().split('T')[0];
      setFormData(prev => ({ ...prev, expiryDate: formattedDate }));
      calculateDaysRemaining(formattedDate);
    } else if (!formData.hasExpiry) {
      setFormData(prev => ({ ...prev, expiryDate: '' }));
      setDaysRemaining(null);
    }
  }, [formData.category, formData.hasExpiry]);

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

  const handleChange = (e) => {
    const { name, value } = e.target;
    console.log(`ServiceEntry.jsx: Handle change: ${name} = ${value}`);
    setFormData(prev => ({ ...prev, [name]: value }));

    if (name === 'subcategory' && filteredSubcategories.length > 0) {
      const category = categories.find(cat => cat.id === parseInt(formData.category));
      if (category) {
        const subcategory = filteredSubcategories.find(sub => sub.id === parseInt(value));
        if (subcategory) {
          const serviceCharge = parseFloat(subcategory.service_charges) || parseFloat(formData.serviceCharge) || 0;
          const departmentCharge = parseFloat(subcategory.department_charges) || parseFloat(formData.departmentCharge) || 0;
          const totalCharge = serviceCharge + departmentCharge;
          const serviceWalletId = category.wallet_id ? parseInt(category.wallet_id) : null;
          const subDocs = (subcategory.required_documents || []).filter(doc => doc.sub_category_id === parseInt(value));
          setFormData(prev => ({
            ...prev,
            serviceCharge: String(serviceCharge),
            departmentCharge: String(departmentCharge),
            totalCharge: String(totalCharge),
            serviceWalletId,
            requiresWallet: subcategory.requires_wallet || false,
            hasExpiry: category.has_expiry || false,
            payments: prev.payments.length === 0 ? [{
              method: wallets.offline.length > 0 ? 'cash' : 'wallet',
              wallet: wallets.offline.length > 0 ? String(wallets.offline[0].id) : wallets.online.length > 0 ? String(wallets.online[0].id) : '',
              amount: String(totalCharge),
              status: 'received',
            }] : prev.payments,
          }));
          setSelectedSubcategory(subcategory);
          setSelectedSubcategoryDocuments(subDocs);
          console.log('ServiceEntry.jsx: Set formData in handleChange for subcategory:', {
            subcategory: subcategory.name,
            serviceCharge,
            departmentCharge,
            totalCharge,
            serviceWalletId,
            requiresWallet: subcategory.requires_wallet,
            hasExpiry: category.has_expiry,
            required_documents: subDocs,
          });
          if (subcategory.requires_wallet && !serviceWalletId) {
            toast.warn('Selected service requires a wallet but none is assigned. Please contact admin.');
          }
          if (isNaN(serviceCharge) || isNaN(departmentCharge)) {
            toast.warn('Service or department charges are not defined for this subcategory. Please contact admin.');
          }
        } else {
          setFormData(prev => ({
            ...prev,
            serviceCharge: prev.serviceCharge || '',
            departmentCharge: prev.departmentCharge || '',
            totalCharge: prev.totalCharge || '',
            serviceWalletId: category.wallet_id ? parseInt(category.wallet_id) : null,
            requiresWallet: false,
            hasExpiry: category.has_expiry || false,
          }));
          setSelectedSubcategory(null);
          setSelectedSubcategoryDocuments([]);
          console.log('ServiceEntry.jsx: Subcategory not found, resetting charges');
        }
      }
    }

    if (name === 'serviceCharge' || name === 'departmentCharge') {
      const service = parseFloat(name === 'serviceCharge' ? value : formData.serviceCharge) || 0;
      const dept = parseFloat(name === 'departmentCharge' ? value : formData.departmentCharge) || 0;
      const total = service + dept;
      setFormData(prev => ({
        ...prev,
        [name]: value,
        totalCharge: String(total),
      }));
      console.log('ServiceEntry.jsx: Updated charges:', { serviceCharge: service, departmentCharge: dept, totalCharge: total });
    }

    if (name === 'expiryDate') {
      calculateDaysRemaining(value);
    }
  };

  const handlePaymentChange = (index, field, value) => {
    console.log(`ServiceEntry.jsx: Handle payment change: index=${index}, field=${field}, value=${value}`);
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

      const maxAllowed = totalCharge - otherReceived;

      if (entered > maxAllowed) {
        toast.error(`Amount exceeds remaining balance (₹${maxAllowed})`);
        return;
      }
    }

    setFormData(prev => ({ ...prev, payments: updatedPayments }));
  };

  const addPayment = () => {
    const remaining = Math.max(0, balanceAmount);

    if (remaining === 0) {
      toast.warn('Total amount already covered.');
      return;
    }

    const defaultMethod = wallets.offline.length > 0 ? 'cash' : 'wallet';
    const defaultWallet =
      wallets.offline.length > 0
        ? String(wallets.offline[0].id)
        : wallets.online.length > 0
        ? String(wallets.online[0].id)
        : '';

    if (!defaultWallet) {
      toast.error('No wallets available for your centre.');
      return;
    }

    setFormData(prev => ({
      ...prev,
      payments: [
        ...prev.payments,
        {
          method: defaultMethod,
          wallet: defaultWallet,
          amount: String(remaining),
          status: 'received',
        },
      ],
    }));
  };

  const removePayment = (index) => {
    console.log(`ServiceEntry.jsx: Removing payment at index: ${index}`);
    const updatedPayments = [...formData.payments];
    updatedPayments.splice(index, 1);
    setFormData(prev => ({ ...prev, payments: updatedPayments }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    console.log('ServiceEntry.jsx: Form data before validation:', JSON.stringify(formData, null, 2));

    const errors = [];

    if (!formData.customerName.trim()) errors.push('Customer name is required');
    if (!formData.phone.trim()) errors.push('Phone number is required');
    if (!formData.category || isNaN(parseInt(formData.category))) errors.push('Service category is required and must be a valid ID');
    if (!formData.subcategory || isNaN(parseInt(formData.subcategory))) errors.push('Service subcategory is required and must be a valid ID');

    if (formData.serviceCharge === '' || isNaN(parseFloat(formData.serviceCharge)) || parseFloat(formData.serviceCharge) < 0) {
      errors.push('Valid service charge is required and must be non-negative');
    }
    if (formData.departmentCharge === '' || isNaN(parseFloat(formData.departmentCharge)) || parseFloat(formData.departmentCharge) < 0) {
      errors.push('Valid department charge is required and must be non-negative');
    }
    if (formData.totalCharge === '' || isNaN(parseFloat(formData.totalCharge)) || parseFloat(formData.totalCharge) < 0) {
      errors.push('Valid total charge is required and must be non-negative');
    }

    if (formData.hasExpiry && (!formData.expiryDate || isNaN(Date.parse(formData.expiryDate)))) {
      errors.push('Service expiry date is required and must be a valid date for services with expiry');
    }
    if (!formData.hasExpiry && formData.expiryDate) {
      errors.push('Expiry date should not be provided for services without expiry');
    }

    if (formData.payments.length === 0) errors.push('At least one payment is required');

    if (balanceAmount > 0 && formData.status === 'completed') {
      errors.push(`Balance amount of ₹${balanceAmount} remains. Add payments or keep status as pending.`);
    }

    const staffId = localStorage.getItem('id')?.trim();
    if (!staffId || isNaN(parseInt(staffId))) {
      errors.push('Staff ID missing or invalid. Please log in again.');
    }

    if (formData.requiresWallet && (!formData.serviceWalletId || isNaN(parseInt(formData.serviceWalletId)))) {
      errors.push('Service requires a wallet but no valid wallet is assigned.');
    }

    formData.payments.forEach((p, index) => {
      if (!p.wallet || isNaN(parseInt(p.wallet))) errors.push(`Payment ${index + 1}: Valid wallet ID is required`);
      if (!p.method || !['cash', 'wallet'].includes(p.method)) errors.push(`Payment ${index + 1}: Invalid payment method`);
      if (!p.amount || isNaN(parseFloat(p.amount)) || parseFloat(p.amount) <= 0) {
        errors.push(`Payment ${index + 1}: Amount must be greater than 0`);
      }
      if (!p.status || !['received', 'pending', 'not_received'].includes(p.status)) {
        errors.push(`Payment ${index + 1}: Invalid status`);
      }
    });

    if (errors.length > 0) {
      errors.forEach(err =>
        toast.error(err, { position: 'top-right', autoClose: 5000 })
      );
      return;
    }
    if (paidAmount > totalCharge) {
      toast.error('Collected amount exceeds total charge');
      return;
    }

    const submissionData = {
      tokenId: formData.tokenId || null,
      customerName: formData.customerName.trim(),
      phone: formData.phone.trim(),
      categoryId: parseInt(formData.category),
      subcategoryId: parseInt(formData.subcategory),
      serviceCharge: parseFloat(formData.serviceCharge),
      departmentCharge: parseFloat(formData.departmentCharge),
      totalCharge: parseFloat(formData.totalCharge),
      status: formData.status,
      expiryDate: formData.hasExpiry ? formData.expiryDate : null,
      serviceWalletId: formData.serviceWalletId ? parseInt(formData.serviceWalletId) : null,
      staffId: parseInt(staffId),
    };

    if (!editingEntryId) {
      submissionData.payments = formData.payments.map(p => ({
        wallet: parseInt(p.wallet),
        method: p.method,
        amount: parseFloat(p.amount),
        status: p.status,
      }));
    }

    console.log(
      `ServiceEntry.jsx: ${editingEntryId ? 'Updating' : 'Creating'} service entry`,
      JSON.stringify(submissionData, null, 2)
    );

    try {
      if (editingEntryId) {
        await updateServiceEntry(editingEntryId, submissionData);
        toast.success('Service entry updated successfully!', { autoClose: 3500 });
      } else {
        await createServiceEntry({
          ...submissionData,
          customerServiceId
        });
        toast.success('Service entry created successfully!', { autoClose: 3500 });
      }
      setTimeout(() => {
        navigate('/dashboard/staff');
      }, 3500);

      setEditingEntryId(null);
      setFormData({
        tokenId: '',
        customerName: '',
        phone: '',
        category: '',
        subcategory: '',
        serviceCharge: '',
        departmentCharge: '',
        totalCharge: '',
        status: 'pending',
        expiryDate: '',
        payments: [],
        serviceWalletId: null,
        requiresWallet: false,
        hasExpiry: false,
      });

      setFilteredSubcategories([]);
      setSelectedSubcategory(null);
      setSelectedCategoryDocuments([]);
      setSelectedSubcategoryDocuments([]);
      setSelectedWebsite(null);
      setTotalCharge(0);
      setPaidAmount(0);
      setPendingAmount(0);
      setBalanceAmount(0);
      setDaysRemaining(null);
    } catch (err) {
      console.error('ServiceEntry.jsx: Submission error:', err.response?.data || err.message);

      if (err.response?.data?.details) {
        err.response.data.details.forEach(d =>
          toast.error(d, { position: 'top-right', autoClose: 5000 })
        );
      } else {
        toast.error(err.response?.data?.error || 'Failed to submit service entry', {
          position: 'top-right',
          autoClose: 5000,
        });
      }
    }
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
    <div className="max-w-6xl mx-auto p-4 sm:p-6">
      <ToastContainer 
        position="top-right"
        autoClose={3000}
        hideProgressBar={false}
        newestOnTop
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
      />
      
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

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Customer & Service Section */}
            <div className="space-y-6">
              <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                <div className="flex items-center gap-2 mb-5">
                  <div className="bg-indigo-100 p-2 rounded-lg">
                    <FiUser className="h-5 w-5 text-indigo-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800">Customer Information</h3>
                </div>
                
                <div className="space-y-4">
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
                        onChange={handleChange}
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
                        onChange={handleChange}
                        required
                        pattern="\+?[1-9]\d{1,14}"
                        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
                        placeholder="+91 XXXXXXXXXX"
                      />
                    </div>
                  </div>
                </div>
              </div>

              <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                <div className="flex items-center gap-2 mb-5">
                  <div className="bg-indigo-100 p-2 rounded-lg">
                    <FiCreditCard className="h-5 w-5 text-indigo-600" />
                  </div>
                  <h3 className="text-lg font-semibold text-gray-800">Service Details</h3>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Service Category <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        name="category"
                        value={formData.category}
                        onChange={handleChange}
                        required
                        className="w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none"
                      >
                        <option value="">Select category</option>
                        {categories.map(category => (
                          <option key={category.id} value={String(category.id)}>
                            {category.name}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                        <FiChevronDown className="h-5 w-5" />
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Service Subcategory <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <select
                        name="subcategory"
                        value={formData.subcategory}
                        onChange={handleChange}
                        required
                        disabled={!formData.category}
                        className={`w-full px-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 appearance-none ${!formData.category ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        <option value="">Select subcategory</option>
                        {filteredSubcategories.map(subcategory => (
                          <option key={subcategory.id} value={String(subcategory.id)}>
                            {subcategory.name}
                          </option>
                        ))}
                      </select>
                      <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                        <FiChevronDown className="h-5 w-5" />
                      </div>
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Service Charge (₹) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiDollarSign className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="number"
                        name="serviceCharge"
                        value={formData.serviceCharge}
                        onChange={handleChange}
                        required
                        min="0"
                        step="0.01"
                        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Department Charge (₹) <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiDollarSign className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="number"
                        name="departmentCharge"
                        value={formData.departmentCharge}
                        onChange={handleChange}
                        required
                        min="0"
                        step="0.01"
                        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        placeholder="0.00"
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Total Charge (₹)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiDollarSign className="h-5 w-5 text-gray-400" />
                      </div>
                      <input
                        type="number"
                        value={formData.totalCharge}
                        readOnly
                        className="w-full pl-10 pr-4 py-3 bg-gray-50 border border-gray-300 rounded-lg"
                      />
                    </div>
                  </div>
                  
                  {formData.hasExpiry && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-2">
                        Service Expiry Date <span className="text-rose-500">*</span>
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FiCalendar className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="date"
                          name="expiryDate"
                          value={formData.expiryDate}
                          onChange={handleChange}
                          required
                          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      {daysRemaining !== null && (
                        <p className={`text-sm mt-2 font-medium ${daysRemaining < 30 ? 'text-amber-600' : 'text-emerald-600'}`}>
                          <FiClock className="inline mr-1" />
                          {daysRemaining} days remaining
                        </p>
                      )}
                    </div>
                  )}
                </div>
              </div>

              {formData.category && (
                <div className="bg-gray-50 p-5 rounded-xl border border-gray-200">
                  <div className="flex items-center gap-2 mb-5">
                    <div className="bg-indigo-100 p-2 rounded-lg">
                      <FiFileText className="h-5 w-5 text-indigo-600" />
                    </div>
                    <h3 className="text-lg font-semibold text-gray-800">Service Information</h3>
                  </div>
                  
                  <div className="space-y-6">
                    {selectedWebsite ? (
                      <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
                        <div className="flex items-center gap-2 mb-2">
                          <FiLink className="h-5 w-5 text-blue-600" />
                          <h4 className="text-sm font-medium text-gray-900">Service Website</h4>
                        </div>
                        <a 
                          href={selectedWebsite} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="text-blue-600 hover:text-blue-800 underline break-all"
                        >
                          {selectedWebsite}
                        </a>
                      </div>
                    ) : (
                      <div className="bg-gray-100 p-4 rounded-lg">
                        <p className="text-sm text-gray-600">No website available for this service. Please contact admin to update service details.</p>
                      </div>
                    )}
                    
                    <div>
                      <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                        <FiFileText className="h-4 w-4 text-indigo-600" />
                        Required Documents for Service
                      </h4>
                      {selectedCategoryDocuments.length > 0 ? (
                        <ul className="space-y-2">
                          {selectedCategoryDocuments.map((doc, index) => (
                            <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                              <FiCheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                              <span>{doc.document_name}</span>
                            </li>
                          ))}
                        </ul>
                      ) : (
                        <p className="text-sm text-gray-600">No documents required for this service. Please contact admin to update document requirements.</p>
                      )}
                    </div>
                    
                    {formData.subcategory && (
                      <div>
                        <h4 className="text-sm font-medium text-gray-900 mb-3 flex items-center gap-2">
                          <FiFileText className="h-4 w-4 text-indigo-600" />
                          Required Documents for Subcategory
                        </h4>
                        {selectedSubcategoryDocuments.length > 0 ? (
                          <ul className="space-y-2">
                            {selectedSubcategoryDocuments.map((doc, index) => (
                              <li key={index} className="flex items-start gap-2 text-sm text-gray-700">
                                <FiCheckCircle className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                                <span>{doc.document_name}</span>
                              </li>
                            ))}
                          </ul>
                        ) : (
                          <p className="text-sm text-gray-600">No documents required for this subcategory. Please contact admin to update document requirements.</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

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
                    formData.payments.map((payment, index) => (
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
                
                <div className="mt-6 bg-gray-50 rounded-lg p-4 border border-gray-200">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-sm text-gray-600">Total Charge</p>
                      <p className="text-lg font-semibold text-gray-900">₹{totalCharge.toFixed(2)}</p>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-sm text-gray-600">Paid Amount</p>
                      <p className="text-lg font-semibold text-emerald-600">₹{paidAmount.toFixed(2)}</p>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-sm text-gray-600">Pending Amount</p>
                      <p className="text-lg font-semibold text-amber-600">₹{pendingAmount.toFixed(2)}</p>
                    </div>
                    
                    <div className="space-y-1">
                      <p className="text-sm text-gray-600">Balance Amount</p>
                      <p className="text-lg font-semibold text-rose-600">₹{balanceAmount.toFixed(2)}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end mt-2 gap-4">
            <button
              type="button"
              onClick={() => navigate('/dashboard/staff')}
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
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Expiry</th>
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
                        <div className="font-medium">{entry.customerName}</div>
                        <div className="text-gray-500">{entry.phone}</div>
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900">
                        <div className="font-medium">{getCategoryName(entry.category)}</div>
                        <div className="text-gray-500">{getSubcategoryName(entry.category, entry.subcategory)}</div>
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
                        <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${
                          paymentStatusOptions.find(opt => opt.id === entry.status)?.color || 'bg-gray-100 text-gray-800'
                        }`}>
                          {paymentStatusOptions.find(opt => opt.id === entry.status)?.name || entry.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{entry.expiryDate || 'N/A'}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium flex gap-2">
                        <button
                          onClick={() => setSelectedEntry(entry)}
                          className="text-indigo-600 hover:text-indigo-900 p-1.5 rounded-lg hover:bg-indigo-50"
                          title="View details"
                        >
                          <FiEye className="h-5 w-5" />
                        </button>
                        {isToday(entry.created_at) && !entry.is_edited && (
                          <button
                            onClick={() => handleEditEntry(entry)}
                            className="text-emerald-600 hover:text-emerald-800 p-1.5 rounded-lg hover:bg-emerald-50"
                            title="Edit this entry (once only)"
                          >
                            ✏️
                          </button>
                        )}
                        {isToday(entry.created_at) && entry.is_edited && (
                          <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-200 text-gray-700">
                            Edited
                          </span>
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

      {/* ========== ENTRY DETAILS MODAL ========== */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-40">
          <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-xl font-bold">Service Entry Details</h2>
              <button onClick={() => setSelectedEntry(null)} className="text-gray-500 hover:text-gray-700">
                <FiX className="h-6 w-6" />
              </button>
            </div>
            <div className="space-y-4">
              <p><strong>Token ID:</strong> {selectedEntry.tokenId ? `#${selectedEntry.tokenId}` : 'N/A'}</p>
              <p><strong>Customer Name:</strong> {selectedEntry.customerName}</p>
              <p><strong>Phone:</strong> {selectedEntry.phone}</p>
              <p><strong>Service:</strong> {getCategoryName(selectedEntry.category)}</p>
              <p><strong>Subcategory:</strong> {getSubcategoryName(selectedEntry.category, selectedEntry.subcategory)}</p>
              <p><strong>Service Charge:</strong> ₹{selectedEntry.serviceCharge.toFixed(2)}</p>
              <p><strong>Department Charge:</strong> ₹{selectedEntry.departmentCharge.toFixed(2)}</p>
              <p><strong>Total Charge:</strong> ₹{selectedEntry.totalCharge.toFixed(2)}</p>
              <p><strong>Status:</strong> {selectedEntry.status}</p>
              <p><strong>Expiry Date:</strong> {selectedEntry.expiryDate || 'N/A'}</p>
              <div>
                <strong>Payments:</strong>
                <ul className="list-disc pl-5">
                  {getLatestTransactions(selectedEntry.payments || []).map((p, i) => (
                    <li key={i}>{formatPayments([p])}</li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ========== UNIFIED TRANSACTION CORRECTION MODAL ========== */}
      {correctionModal.isOpen && correctionModal.transaction && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
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
                  onChange={(e) => setCorrectionModal(prev => ({ ...prev, newWalletId: e.target.value }))}
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

      {/* ========== UNIFIED TRANSACTION HISTORY MODAL ========== */}
      {historyModal.isOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
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
                  .sort((a, b) => new Date(a.created_at) - new Date(b.created_at)) // ✅ FIX ORDER
                  .map((entry, idx, arr) => {
                
                    // 🔥 FIX LABELING LOGIC (IGNORE backend entry_type)
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
                
                    // ✅ FIX CURRENT BADGE (latest non-reversal)
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
                
                            <span className="text-xs text-gray-500">
                              {formatDate(entry.created_at)}
                            </span>
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

      {/* ========== INVOICE GENERATOR MODAL ========== */}
      {invoiceModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
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
    </div>
  );
};

export default ServiceEntry;