import React, { useState, useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import DatePicker from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { toast } from 'react-toastify';
import { 
  FiFilter, 
  FiSearch, 
  FiDownload, 
  FiEye, 
  FiRefreshCw,
  FiCalendar,
  FiX,
  FiPlus,
  FiChevronDown,
  FiChevronUp,
  FiDollarSign,
  FiUser,
  FiPhone,
  FiCreditCard,
  FiCheckCircle,
  FiClock,
  FiSun,
  FiMoon,
  FiFileText,
  FiBarChart2,
  FiPieChart,
  FiGrid,
  FiList
} from 'react-icons/fi';
import { getServiceEntries, getCategories, getTokens, updateServiceEntry } from '/src/services/serviceService';

const AllEntries = () => {
  const [entries, setEntries] = useState([]);
  const [filteredEntries, setFilteredEntries] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [filters, setFilters] = useState({
    tokenType: 'all',
    startDate: new Date(),
    endDate: new Date(),   
    categoryId: '',
    subcategoryId: '',
    searchQuery: '',
    status: 'all'
  });
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    customerName: '',
    phone: '',
    expiryDate: ''
  });
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);      // first load finished
  const entriesRequestRef = useRef(0);               // ignores out-of-order responses
  const tokensLoadedRef = useRef(false);
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  // Categories: once on mount
  useEffect(() => {
    const fetchCategories = async () => {
      try {
        const categoriesResponse = await getCategories();
        setCategories(categoriesResponse.data);
      } catch (error) {
        console.error('Error fetching categories:', error);
      }
    };
    fetchCategories();
  }, []);

  // Tokens are only needed to tell Normal / Campaign tokens apart. The entries API now sends
  // `tokenType` itself, so tokens are fetched only for older responses that don't include it.
  const loadTokens = async () => {
    try {
      const centreId = user.role === 'superadmin' ? 'all' : user.centre_id;
      const tokensResponse = await getTokens(centreId, 'all');
      setTokens(tokensResponse.data);
      tokensLoadedRef.current = true;
    } catch (error) {
      console.error('Error fetching tokens:', error);
    }
  };

  // Entries for the selected dates (also used by Refresh)
  const loadEntries = async () => {
    const requestId = ++entriesRequestRef.current;
    try {
      setLoading(true);
      // Format dates as YYYY-MM-DD for the backend, using the picked calendar day.
      // (The date picker gives local midnight; toISOString() turned that into the previous day in India.)
      const formattedStart = filters.startDate ? filters.startDate.toLocaleDateString('en-CA') : null;
      const formattedEnd = filters.endDate ? filters.endDate.toLocaleDateString('en-CA') : null;

      // Pass false for 'today' since we are sending explicit dates now
      const entriesResponse = await getServiceEntries(false, null, null, formattedStart, formattedEnd);
      if (requestId !== entriesRequestRef.current) return; // a newer request superseded this one
      setEntries(entriesResponse.data);
    } catch (error) {
      if (requestId !== entriesRequestRef.current) return;
      console.error('Error fetching entries:', error);
      toast.error('Failed to load entries');
    } finally {
      if (requestId === entriesRequestRef.current) {
        setLoading(false);
        setLoaded(true);
      }
    }
  };

  // Fetch entries whenever the date filters change (this also covers the first load)
  useEffect(() => {
    loadEntries();
  }, [filters.startDate, filters.endDate]);

  // Only look tokens up when some entry has a token but no tokenType from the server
  useEffect(() => {
    if (!tokensLoadedRef.current && entries.some(e => e.tokenId && !e.tokenType)) {
      loadTokens();
    }
  }, [entries]);

  // Keep this exactly as it is - it handles the non-date frontend filters
  useEffect(() => {
    applyFilters();
  }, [filters, entries, tokens]);

  // Refresh: reload the entries for the CURRENT filters (it used to jump back to today's entries)
  const handleRefresh = () => {
    loadEntries();
    if (tokensLoadedRef.current) loadTokens();
  };

  const getEntryTokenType = (entry) => {
    if (!entry.tokenId) return null;
    if (entry.tokenType) return entry.tokenType;
    const token = tokens.find(t => t.tokenId === entry.tokenId);
    return token ? token.type : null;
  };

  const applyFilters = () => {
    let filtered = [...entries];

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(entry => 
        (entry.customerName || '').toLowerCase().includes(query) ||
        (entry.phone || '').includes(query) ||
        (entry.tokenId && entry.tokenId.toString().includes(query))
      );
    }

    if (filters.tokenType !== 'all') {
      filtered = filtered.filter(entry => {
        if (filters.tokenType === 'direct') {
          return !entry.tokenId;
        } else {
          return getEntryTokenType(entry) === filters.tokenType;
        }
      });
    }

    if (filters.status !== 'all') {
      filtered = filtered.filter(entry => entry.status === filters.status);
    }

    if (filters.categoryId) {
      filtered = filtered.filter(entry => entry.category === parseInt(filters.categoryId));
    }

    if (filters.subcategoryId) {
      filtered = filtered.filter(entry => entry.subcategory === parseInt(filters.subcategoryId));
    }

    setFilteredEntries(filtered);
  };

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({
      ...prev,
      [key]: value,
      ...(key === 'categoryId' ? { subcategoryId: '' } : {}),
    }));
  };

  const resetFilters = () => {
    setFilters({
      tokenType: 'all',
      startDate: new Date(), 
      endDate: new Date(),
      categoryId: '',
      subcategoryId: '',
      searchQuery: '',
      status: 'all'
    });
  };

  const selectedCategory = categories.find(cat => cat.id === parseInt(filters.categoryId));
  const subcategories = selectedCategory ? selectedCategory.subcategories : [];

  const getStatusBadge = (status) => {
    const statusClasses = {
      pending: 'bg-amber-100 text-amber-800',
      completed: 'bg-emerald-100 text-emerald-800',
      cancelled: 'bg-rose-100 text-rose-800'
    };
    
    return (
      <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusClasses[status] || 'bg-slate-200 text-slate-700'}`}>
        {(status || 'unknown').charAt(0).toUpperCase() + (status || 'unknown').slice(1)}
      </span>
    );
  };

  const getTokenTypeBadge = (entry) => {
    if (!entry.tokenId) {
      return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-slate-100 text-navy-700">Direct</span>;
    }
    
    if (getEntryTokenType(entry) === 'campaign') {
      return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-navy-500/10 text-navy-700">Campaign</span>;
    }
    
    return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-emerald-100 text-emerald-800">Normal</span>;
  };

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 2
    }).format(amount);
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    });
  };

  const getCategoryName = (categoryId) => {
    const category = categories.find(cat => cat.id === categoryId);
    return category ? category.name : 'N/A';
  };

  const getInitials = (name) => {
    if (!name) return 'C';
    return name.split(' ').map(n => n[0]).join('').substring(0, 2).toUpperCase();
  };

  const getSubcategoryName = (categoryId, subcategoryId) => {
    const category = categories.find(cat => cat.id === categoryId);
    if (category && category.subcategories) {
      const subcategory = category.subcategories.find(sub => sub.id === subcategoryId);
      return subcategory ? subcategory.name : 'N/A';
    }
    return 'N/A';
  };

  const handleEditToggle = () => {
    if (!isEditing) {
      // Populate form when entering edit mode
      setEditForm({
        customerName: selectedEntry.customerName || '',
        phone: selectedEntry.phone || '',
        // Ensure date is formatted properly for an input[type="date"]
        expiryDate: selectedEntry.expiryDate ? new Date(selectedEntry.expiryDate).toISOString().split('T')[0] : ''
      });
    }
    setIsEditing(!isEditing);
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const submitEdit = async () => {
    try {
      setSaving(true);
      
      // Call the API with ONLY the allowed fields.
      const payload = {
        customerName: editForm.customerName,
        phone: editForm.phone,
        // Only send the expiry date if the service requires it; otherwise force null
        expiryDate: requiresExpiry ? (editForm.expiryDate || null) : null,
        // Send the existing category/subcategory so the backend validation passes
        categoryId: selectedEntry.category,
        subcategoryId: selectedEntry.subcategory,
      };

      const response = await updateServiceEntry(selectedEntry.id, payload);
      
      // Update local state to reflect changes instantly without refreshing the whole page
      const updatedEntry = response.entry;
      setEntries(prev => prev.map(e => e.id === selectedEntry.id ? { ...e, ...updatedEntry } : e));
      setSelectedEntry(prev => ({ ...prev, ...updatedEntry }));
      
      toast.success('Entry updated successfully');
      setIsEditing(false);
    } catch (error) {
      console.error('Error updating entry:', error);
      toast.error(error.response?.data?.error || 'Failed to update entry');
    } finally {
      setSaving(false);
    }
  };

  // Determine if the currently selected modal item requires an expiry date
  const modalCategory = selectedEntry ? categories.find(cat => cat.id === selectedEntry.category) : null;
  const requiresExpiry = modalCategory ? modalCategory.has_expiry : false;

  // Money totals: cancelled entries are not income
  const countedEntries = entries.filter(e => e.status !== 'cancelled');
  const totalServiceCharges = countedEntries.reduce((sum, e) => sum + (e.serviceCharge || 0), 0);
  const totalBilled = countedEntries.reduce((sum, e) => sum + (e.totalCharge || 0), 0);

  // --- Export the entries currently shown as a CSV (opens in Excel) ---
  const exportCsv = () => {
    if (!filteredEntries.length) {
      toast.info('No entries to export');
      return;
    }
    const cell = (v) => {
      let t = v === null || v === undefined ? '' : String(v);
      if (/^[=@]|^[+-](?!\d)/.test(t)) t = `'${t}`; // stop spreadsheet formulas
      return `"${t.replace(/"/g, '""')}"`;
    };
    const header = ['Date', 'Customer', 'Phone', 'Token', 'Type', 'Category', 'Subcategory', 'Status', 'Service Charge', 'Department Charge', 'Total', 'Pending'];
    const rows = filteredEntries.map(entry => [
      entry.created_at ? new Date(entry.created_at).toLocaleString('en-CA', { timeZone: 'Asia/Kolkata', hour12: false }).replace(', ', ' ') : '',
      entry.customerName,
      entry.phone,
      entry.tokenId || '',
      !entry.tokenId ? 'Direct' : (getEntryTokenType(entry) === 'campaign' ? 'Campaign' : 'Normal'),
      getCategoryName(entry.category),
      getSubcategoryName(entry.category, entry.subcategory),
      entry.status,
      entry.serviceCharge ?? 0,
      entry.departmentCharge ?? 0,
      entry.totalCharge ?? 0,
      entry.pendingAmount ?? 0
    ]);
    const csv = '\uFEFF' + [header, ...rows].map(r => r.map(cell).join(',')).join('\r\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const link = document.createElement('a');
    const from = filters.startDate ? filters.startDate.toLocaleDateString('en-CA') : 'all';
    const to = filters.endDate ? filters.endDate.toLocaleDateString('en-CA') : 'all';
    link.href = url;
    link.download = `service-entries_${from}_to_${to}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // --- Calculate Analytics for Visuals ---
  const statusCounts = filteredEntries.reduce((acc, entry) => {
    acc[entry.status] = (acc[entry.status] || 0) + 1;
    return acc;
  }, { completed: 0, pending: 0, cancelled: 0 });

  const categoryCounts = filteredEntries.reduce((acc, entry) => {
    const catName = getCategoryName(entry.category);
    acc[catName] = (acc[catName] || 0) + 1;
    return acc;
  }, {});

  const topCategories = Object.entries(categoryCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4); // Get top 4 services
  // ---------------------------------------

  if (loading && !loaded) {
    return (
      <div className="max-w-7xl mx-auto p-6 flex justify-center items-center h-96">
        <div className="text-center">
          <div className="w-16 h-16 border-[3px] border-navy-700 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-slate-600 font-medium">Loading service entries...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <div className="max-w-7xl mx-auto p-3 sm:p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 sm:mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Service Entries Dashboard</h1>
            <p className="text-slate-600 mt-1">
              Manage and analyze all service entries in one place
            </p>
          </div>
          
          <div className="flex items-center gap-3 w-full md:w-auto">
            <button
              onClick={handleRefresh}
              className="flex flex-1 md:flex-none items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] bg-white text-slate-700 rounded-xl border border-slate-300 hover:bg-slate-50 transition-colors"
            >
              <FiRefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <Link
              to="/dashboard/staff/service_entry"
              className="flex flex-1 md:flex-none items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] bg-navy-700 text-white rounded-xl shadow-sm hover:bg-navy-800 transition-colors"
            >
              <FiPlus className="h-4 w-4" />
              New Entry
            </Link>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-5 mb-6 sm:mb-8">
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-600">Total Entries</p>
                <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 break-words">{entries.length}</p>
                <p className="text-xs text-slate-500 mt-1">In selected dates</p>
              </div>
              <div className="bg-slate-100 p-2.5 rounded-xl shrink-0">
                <FiFileText className="h-5 w-5 text-navy-700" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-600">Completed</p>
                <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 break-words">
                  {entries.filter(e => e.status === 'completed').length}
                </p>
                <p className="text-xs text-emerald-600 mt-1">
                  {entries.length > 0 ? Math.round((entries.filter(e => e.status === 'completed').length / entries.length) * 100) : 0}% completed
                </p>
              </div>
              <div className="bg-emerald-50 p-2.5 rounded-xl shrink-0">
                <FiCheckCircle className="h-5 w-5 text-emerald-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-600">Pending</p>
                <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 break-words">
                  {entries.filter(e => e.status === 'pending').length}
                </p>
                <p className="text-xs text-amber-600 mt-1">Needs attention</p>
              </div>
              <div className="bg-amber-50 p-2.5 rounded-xl shrink-0">
                <FiClock className="h-5 w-5 text-amber-600" />
              </div>
            </div>
          </div>
          
          <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-slate-600">Service Charges</p>
                <p className="text-xl sm:text-2xl font-bold text-slate-900 mt-1 break-words">
                  {formatCurrency(totalServiceCharges)}
                </p>
                <p className="text-xs text-slate-500 mt-1">Billed {formatCurrency(totalBilled)}</p>
              </div>
              <div className="bg-slate-100 p-2.5 rounded-xl shrink-0">
                <FiDollarSign className="h-5 w-5 text-navy-700" />
              </div>
            </div>
          </div>
        </div>

        {/* NEW: Analytics Visuals */}
        {filteredEntries.length > 0 && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 sm:gap-5 mb-6 sm:mb-8">
            
            {/* Chart 1: Top Services Progress Bars */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <FiPieChart className="text-navy-700" /> Top Services
              </h3>
              <div className="space-y-4">
                {topCategories.map(([name, count], index) => {
                  const percentage = Math.round((count / filteredEntries.length) * 100);
                  const colors = ['bg-navy-700', 'bg-navy-500', 'bg-emerald-500', 'bg-amber-500'];
                  return (
                    <div key={name}>
                      <div className="flex justify-between text-xs mb-1">
                        <span className="font-medium text-slate-700 truncate pr-2">{name}</span>
                        <span className="text-slate-500">{percentage}% ({count})</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-2">
                        <div className={`${colors[index % colors.length]} h-2 rounded-full`} style={{ width: `${percentage}%` }}></div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Chart 2: Status Breakdown */}
            <div className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200">
              <h3 className="text-sm font-semibold text-slate-900 mb-4 flex items-center gap-2">
                <FiBarChart2 className="text-navy-700" /> Pipeline Status
              </h3>
              <div className="flex h-4 rounded-full overflow-hidden mb-4">
                <div style={{ width: `${(statusCounts.completed / filteredEntries.length) * 100}%` }} className="bg-emerald-500 transition-all"></div>
                <div style={{ width: `${(statusCounts.pending / filteredEntries.length) * 100}%` }} className="bg-amber-400 transition-all"></div>
                <div style={{ width: `${(statusCounts.cancelled / filteredEntries.length) * 100}%` }} className="bg-rose-500 transition-all"></div>
              </div>
              <div className="grid grid-cols-3 gap-2 text-center pt-2">
                <div className="bg-emerald-50 p-2 rounded-lg">
                  <p className="text-xs text-emerald-600 font-medium mb-1">Completed</p>
                  <p className="text-lg font-bold text-slate-900">{statusCounts.completed}</p>
                </div>
                <div className="bg-amber-50 p-2 rounded-lg">
                  <p className="text-xs text-amber-600 font-medium mb-1">Pending</p>
                  <p className="text-lg font-bold text-slate-900">{statusCounts.pending}</p>
                </div>
                <div className="bg-rose-50 p-2 rounded-lg">
                  <p className="text-xs text-rose-600 font-medium mb-1">Cancelled</p>
                  <p className="text-lg font-bold text-slate-900">{statusCounts.cancelled}</p>
                </div>
              </div>
            </div>

          </div>
        )}

        {/* Search and Filter Section */}
        <div className="bg-white rounded-2xl p-4 sm:p-5 mb-6 shadow-sm border border-slate-200">
          <div className="flex flex-col md:flex-row gap-3 md:gap-4 mb-4">
            <div className="relative flex-grow">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FiSearch className="h-5 w-5 text-slate-400" />
              </div>
              <input
                type="text"
                value={filters.searchQuery}
                onChange={e => handleFilterChange('searchQuery', e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 text-base sm:text-sm"
                placeholder="Search by customer name, phone, or token ID..."
              />
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex flex-1 md:flex-none items-center justify-center gap-2 px-4 py-2.5 min-h-[44px] bg-slate-50 border border-slate-200 rounded-xl hover:bg-slate-100 transition-colors text-slate-700"
              >
                <FiFilter className="h-4 w-4" />
                Filters
                {showFilters ? <FiChevronUp className="h-4 w-4" /> : <FiChevronDown className="h-4 w-4" />}
              </button>
              
              <div className="flex bg-slate-100 rounded-xl p-1">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2.5 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg ${viewMode === 'list' ? 'bg-white shadow-sm text-navy-700' : 'text-slate-600 hover:text-slate-900'}`}
                  aria-label="List view"
                >
                  <FiList className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2.5 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-lg ${viewMode === 'grid' ? 'bg-white shadow-sm text-navy-700' : 'text-slate-600 hover:text-slate-900'}`}
                  aria-label="Grid view"
                >
                  <FiGrid className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-slate-200">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Entry Type</label>
                <select
                  value={filters.tokenType}
                  onChange={e => handleFilterChange('tokenType', e.target.value)}
                  className="w-full px-3 py-2 min-h-[42px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 text-base sm:text-sm"
                >
                  <option value="all">All Types</option>
                  <option value="normal">Normal Tokens</option>
                  <option value="campaign">Campaign Tokens</option>
                  <option value="direct">Direct Entries</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Status</label>
                <select
                  value={filters.status}
                  onChange={e => handleFilterChange('status', e.target.value)}
                  className="w-full px-3 py-2 min-h-[42px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 text-base sm:text-sm"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Category</label>
                <select
                  value={filters.categoryId}
                  onChange={e => handleFilterChange('categoryId', e.target.value)}
                  className="w-full px-3 py-2 min-h-[42px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 text-base sm:text-sm"
                >
                  <option value="">All Categories</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Subcategory</label>
                <select
                  value={filters.subcategoryId}
                  onChange={e => handleFilterChange('subcategoryId', e.target.value)}
                  disabled={!filters.categoryId}
                  className={`w-full px-3 py-2 min-h-[42px] bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 text-base sm:text-sm ${!filters.categoryId ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <option value="">All Subcategories</option>
                  {subcategories.map(sub => (
                    <option key={sub.id} value={sub.id}>
                      {sub.name}
                    </option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">Start Date</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiCalendar className="h-4 w-4 text-slate-400" />
                  </div>
                  <DatePicker
                    selected={filters.startDate}
                    onChange={date => handleFilterChange('startDate', date)}
                    selectsStart
                    startDate={filters.startDate}
                    endDate={filters.endDate}
                    maxDate={new Date()}
                    className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 text-base sm:text-sm"
                    placeholderText="Select start date"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">End Date</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiCalendar className="h-4 w-4 text-slate-400" />
                  </div>
                  <DatePicker
                    selected={filters.endDate}
                    onChange={date => handleFilterChange('endDate', date)}
                    selectsEnd
                    startDate={filters.startDate}
                    endDate={filters.endDate}
                    minDate={filters.startDate}
                    maxDate={new Date()}
                    className="w-full pl-10 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 text-base sm:text-sm"
                    placeholderText="Select end date"
                  />
                </div>
              </div>
              
              <div className="flex items-end gap-2 sm:col-span-2 lg:col-span-1">
                <button
                  onClick={resetFilters}
                  className="flex-1 px-4 py-2 min-h-[42px] bg-slate-100 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors"
                >
                  Reset
                </button>
                <button onClick={exportCsv} disabled={filteredEntries.length === 0} className="flex flex-1 items-center justify-center gap-2 px-4 py-2 min-h-[42px] bg-navy-700 text-white rounded-xl hover:bg-navy-800 transition-colors disabled:opacity-50">
                  <FiDownload className="h-4 w-4" />
                  Export
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Results Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
          <p className="text-sm text-slate-600">
            Showing <span className="font-medium">{filteredEntries.length}</span> of <span className="font-medium">{entries.length}</span> entries
            {loading && <span className="ml-2 text-navy-700">· Updating…</span>}
          </p>
          <div className="flex items-center gap-2 text-sm text-slate-600">
            <span>View:</span>
            <span className="font-medium capitalize">{viewMode}</span>
          </div>
        </div>

        {/* Entries Display */}
        {filteredEntries.length === 0 ? (
          <div className="bg-white rounded-2xl p-8 text-center shadow-sm border border-slate-200">
            <FiSearch className="mx-auto h-12 w-12 text-slate-400 mb-3" />
            <p className="font-medium text-slate-900">No entries match your filters</p>
            <p className="text-slate-600 text-sm mt-1">Try adjusting your filters or search term</p>
            <button
              onClick={resetFilters}
              className="mt-4 px-4 py-2.5 min-h-[44px] bg-navy-700 text-white rounded-xl hover:bg-navy-800 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          // Grid View
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-5">
            {filteredEntries.map(entry => (
              <div key={entry.id} className="bg-white rounded-2xl p-4 sm:p-5 shadow-sm border border-slate-200 hover:shadow-md transition-all">
                <div className="flex justify-between items-start gap-3 mb-4">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-slate-900 break-words">{entry.customerName}</h3>
                    <p className="text-sm text-slate-500 mt-1 flex items-center gap-1">
                      <FiPhone className="h-3 w-3" /> {entry.phone}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {getTokenTypeBadge(entry)}
                    {getStatusBadge(entry.status)}
                  </div>
                </div>
                
                <div className="mb-4">
                  <p className="text-xs text-slate-500 uppercase tracking-wide">Service</p>
                  <p className="font-medium text-slate-900 mt-1">{getCategoryName(entry.category)}</p>
                  <p className="text-sm text-slate-500">{getSubcategoryName(entry.category, entry.subcategory)}</p>
                </div>
                
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Amount</p>
                    <p className="font-bold text-lg text-slate-900">{formatCurrency(entry.totalCharge)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-slate-500 uppercase tracking-wide">Created</p>
                    <p className="text-sm text-slate-500">{formatDate(entry.created_at)}</p>
                  </div>
                </div>
                
                <div className="flex justify-between items-center pt-3 border-t border-slate-100">
                  <span className="text-xs text-slate-500">
                    ID: #{entry.id}{entry.tokenId && ` (Token: ${entry.tokenId})`}
                  </span>
                  <button 
                    onClick={() => setSelectedEntry(entry)}
                    className="text-navy-700 hover:text-navy-800 transition-colors flex items-center gap-1 text-sm font-medium px-3 py-2 min-h-[40px] rounded-lg hover:bg-slate-100"
                  >
                    <FiEye className="h-4 w-4" />
                    Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (

          // Upgraded List View
          <>
          {/* Phone: one card per entry */}
          <div className="md:hidden space-y-3">
            {filteredEntries.map(entry => (
              <div key={entry.id} className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center min-w-0">
                    <div className="h-10 w-10 rounded-full bg-navy-700 flex items-center justify-center text-white font-bold text-sm shrink-0">
                      {getInitials(entry.customerName)}
                    </div>
                    <div className="ml-3 min-w-0">
                      <p className="font-semibold text-slate-900 break-words leading-tight">{entry.customerName}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1 mt-1">
                        <FiPhone className="h-3 w-3 shrink-0" /> {entry.phone}
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0">{getStatusBadge(entry.status)}</div>
                </div>
                <div className="mt-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900">{getCategoryName(entry.category)}</p>
                    <p className="text-xs text-slate-500 mt-0.5">{getSubcategoryName(entry.category, entry.subcategory)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-semibold text-slate-900">{formatCurrency(entry.totalCharge)}</p>
                    {entry.pendingAmount > 0 && (
                      <p className="text-xs text-rose-600 font-medium mt-0.5">Pending: {formatCurrency(entry.pendingAmount)}</p>
                    )}
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 text-xs text-slate-500 flex-wrap">
                    {getTokenTypeBadge(entry)}
                    <span>{formatDate(entry.created_at)}</span>
                  </div>
                  <button
                    onClick={() => setSelectedEntry(entry)}
                    className="flex items-center gap-1 px-3 py-2 min-h-[40px] text-sm font-medium text-navy-700 rounded-lg hover:bg-slate-100 shrink-0"
                  >
                    <FiEye className="h-4 w-4" /> Details
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Tablet / desktop: table */}
          <div className="hidden md:block bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-slate-50/50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Service Details</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-slate-100">
                  {filteredEntries.map(entry => (
                    <tr key={entry.id} className="hover:bg-slate-50/80 transition-colors group">
                      <td className="px-4 py-4">
                        <div className="flex items-center">
                          <div className="flex-shrink-0 h-9 w-9">
                            <div className="h-9 w-9 rounded-full bg-navy-700 flex items-center justify-center text-white font-bold text-sm">
                              {getInitials(entry.customerName)}
                            </div>
                          </div>
                          <div className="ml-3 min-w-0">
                            {/* Changed to allow multi-line wrapping */}
                            <div className="font-semibold text-slate-900 whitespace-normal break-words leading-tight">
                              {entry.customerName}
                            </div>
                            <div className="text-xs text-slate-500 flex items-center gap-1 mt-1 whitespace-nowrap">
                              <FiPhone className="h-3 w-3 flex-shrink-0" /> {entry.phone}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-slate-900">{getCategoryName(entry.category)}</div>
                        <div className="text-xs text-slate-500 mt-0.5">{getSubcategoryName(entry.category, entry.subcategory)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getTokenTypeBadge(entry)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right">
                        <div className="font-semibold text-slate-900">
                          {formatCurrency(entry.totalCharge)}
                        </div>
                        {entry.pendingAmount > 0 && (
                          <div className="text-xs text-rose-500 mt-0.5 font-medium">
                            Pending: {formatCurrency(entry.pendingAmount)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(entry.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-slate-600">
                        {formatDate(entry.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                        <button 
                          onClick={() => setSelectedEntry(entry)}
                          className="text-navy-700 hover:text-navy-800 transition-colors p-2.5 rounded-lg hover:bg-slate-100 [@media(hover:hover)]:opacity-0 [@media(hover:hover)]:group-hover:opacity-100 focus:opacity-100"
                          aria-label="View details"
                        >
                          <FiEye className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
          </>
        )}

        {/* Entry Detail Modal */}
        {selectedEntry && (
          <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-3 sm:p-4 transition-all duration-300">
            <div className="bg-white rounded-2xl p-4 sm:p-6 max-w-4xl w-full max-h-[90dvh] overflow-y-auto scroll-smooth [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-slate-200 gap-3">
                <div className="flex flex-wrap items-center gap-2 sm:gap-4">
                  <h2 className="text-lg sm:text-xl font-bold text-slate-900">Service Entry Details</h2>
                  {!isEditing && (
                    <button 
                      onClick={handleEditToggle}
                      className="px-3 py-2 min-h-[40px] text-sm bg-slate-100 text-navy-700 rounded-lg hover:bg-slate-200 transition-colors border border-slate-200 font-medium"
                    >
                      Edit Info
                    </button>
                  )}
                </div>
                <button 
                  onClick={() => { setSelectedEntry(null); setIsEditing(false); }}
                  className="text-slate-500 hover:text-slate-700 p-2 min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-slate-100 transition-colors shrink-0" aria-label="Close"
                >
                  <FiX className="h-6 w-6" />
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-5">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <FiUser className="h-5 w-5 text-navy-700" />
                    Customer Information
                  </h3>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    {isEditing ? (
                      <div className="space-y-3">
                        <div>
                          <label className="block text-sm text-slate-600 mb-1">Customer Name</label>
                          <input 
                            type="text" 
                            name="customerName"
                            value={editForm.customerName} 
                            onChange={handleEditChange}
                            className="w-full px-3 py-2 min-h-[42px] border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 outline-none text-base sm:text-sm"
                          />
                        </div>
                        <div>
                          <label className="block text-sm text-slate-600 mb-1">Phone Number</label>
                          <input 
                            type="text" 
                            name="phone"
                            value={editForm.phone} 
                            onChange={handleEditChange}
                            className="w-full px-3 py-2 min-h-[42px] border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 outline-none text-base sm:text-sm"
                          />
                        </div>
                        {requiresExpiry && (
                          <div>
                            <label className="block text-sm text-slate-600 mb-1">Expiry Date</label>
                            <input 
                              type="date" 
                              name="expiryDate"
                              value={editForm.expiryDate} 
                              onChange={handleEditChange}
                              className="w-full px-3 py-2 min-h-[42px] border border-slate-300 rounded-xl bg-white focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 outline-none text-base sm:text-sm"
                            />
                          </div>
                        )}
                        <div className="flex gap-2 pt-3 mt-2 border-t border-slate-200">
                          <button 
                            onClick={submitEdit} 
                            disabled={saving} 
                            className="px-4 py-2 min-h-[42px] bg-navy-700 text-white rounded-xl hover:bg-navy-800 text-sm font-medium transition-colors disabled:opacity-50"
                          >
                            {saving ? 'Saving...' : 'Save Changes'}
                          </button>
                          <button 
                            onClick={handleEditToggle} 
                            disabled={saving} 
                            className="px-4 py-2 min-h-[42px] bg-slate-100 border border-slate-200 text-slate-800 rounded-xl hover:bg-slate-200 text-sm font-medium transition-colors disabled:opacity-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <div className="mb-3">
                          <p className="text-sm text-slate-600">Customer Name</p>
                          <p className="font-medium text-slate-900">{selectedEntry.customerName}</p>
                        </div>
                        <div className="mb-3">
                          <p className="text-sm text-slate-600">Phone Number</p>
                          <p className="font-medium text-slate-900">{selectedEntry.phone}</p>
                        </div>
                        <div>
                          <p className="text-sm text-slate-600">Entry Type</p>
                          <div className="mt-1">{getTokenTypeBadge(selectedEntry)}</div>
                        </div>
                      </>
                    )}
                  </div>
                </div>
                
                <div className="space-y-5">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <FiBarChart2 className="h-5 w-5 text-navy-700" />
                    Service Information
                  </h3>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="mb-3">
                      <p className="text-sm text-slate-600">Category</p>
                      <p className="font-medium text-slate-900">{getCategoryName(selectedEntry.category)}</p>
                    </div>
                    <div className="mb-3">
                      <p className="text-sm text-slate-600">Subcategory</p>
                      <p className="font-medium text-slate-900">{getSubcategoryName(selectedEntry.category, selectedEntry.subcategory)}</p>
                    </div>
                    <div className="mb-3">
                      <p className="text-sm text-slate-600">Status</p>
                      <div className="mt-1">{getStatusBadge(selectedEntry.status)}</div>
                    </div>
                    <div>
                      <p className="text-sm text-slate-600">Created On</p>
                      <p className="font-medium text-slate-900">{formatDate(selectedEntry.created_at)}</p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-5">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <FiDollarSign className="h-5 w-5 text-navy-700" />
                    Payment Details
                  </h3>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    <div className="mb-3">
                      <p className="text-sm text-slate-600">Service Charge</p>
                      <p className="font-medium text-slate-900">{formatCurrency(selectedEntry.serviceCharge)}</p>
                    </div>
                    <div className="mb-3">
                      <p className="text-sm text-slate-600">Department Charge</p>
                      <p className="font-medium text-slate-900">{formatCurrency(selectedEntry.departmentCharge)}</p>
                    </div>
                    <div className="pt-3 border-t border-slate-200">
                      <p className="text-sm text-slate-600">Total Amount</p>
                      <p className="font-bold text-lg text-slate-900">{formatCurrency(selectedEntry.totalCharge)}</p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-5">
                  <h3 className="text-lg font-semibold text-slate-900 flex items-center gap-2">
                    <FiPieChart className="h-5 w-5 text-navy-700" />
                    Additional Information
                  </h3>
                  <div className="bg-slate-50 p-4 rounded-xl border border-slate-100">
                    {selectedEntry.expiryDate && (
                      <div className="mb-3">
                        <p className="text-sm text-slate-600">Expiry Date</p>
                        <p className="font-medium text-slate-900">{formatDate(selectedEntry.expiryDate)}</p>
                      </div>
                    )}
                    {selectedEntry.serviceWalletId && (
                      <div className="mb-3">
                        <p className="text-sm text-slate-600">Service Wallet</p>
                        <p className="font-medium text-slate-900">
                          {selectedEntry.serviceWalletName 
                            ? `${selectedEntry.serviceWalletName} (#${selectedEntry.serviceWalletId})` 
                            : `Wallet #${selectedEntry.serviceWalletId}`}
                        </p>
                      </div>
                    )}
                    {selectedEntry.notes && (
                      <div>
                        <p className="text-sm text-slate-600">Notes</p>
                        <p className="font-medium text-slate-900">{selectedEntry.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {selectedEntry.payments && selectedEntry.payments.length > 0 && (
                <div className="mt-6 pt-6 border-t border-slate-200">
                  <h3 className="text-lg font-semibold mb-4 text-slate-900">Payment Methods</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedEntry.payments.map((payment, index) => (
                      <div key={index} className="bg-slate-50 p-4 rounded-xl border border-slate-200">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium capitalize text-slate-900">{payment.method}</p>
                            <p className="text-sm text-slate-600">Wallet: {payment.walletName}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-lg text-slate-900">{formatCurrency(payment.amount)}</p>
                            <span className={`px-2 py-0.5 text-xs rounded-full ${
                              payment.status === 'received' ? 'bg-emerald-100 text-emerald-800' :
                              payment.status === 'pending' ? 'bg-amber-100 text-amber-800' :
                              'bg-rose-100 text-rose-800'
                            }`}>
                              {payment.status}
                            </span>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              
              <div className="mt-6 pt-6 border-t border-slate-200 flex justify-end">
                <button 
                  onClick={() => { setSelectedEntry(null); setIsEditing(false); }}
                  className="px-5 py-2.5 min-h-[44px] bg-slate-100 border border-slate-200 text-slate-700 rounded-xl hover:bg-slate-200 transition-colors w-full sm:w-auto"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AllEntries;