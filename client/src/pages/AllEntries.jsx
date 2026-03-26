import React, { useState, useEffect } from 'react';
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
import { getServiceEntries, getCategories, getTokens } from '/src/services/serviceService';

const AllEntries = () => {
  const [entries, setEntries] = useState([]);
  const [filteredEntries, setFilteredEntries] = useState([]);
  const [categories, setCategories] = useState([]);
  const [tokens, setTokens] = useState([]);
  const [filters, setFilters] = useState({
    tokenType: 'all',
    startDate: null,
    endDate: null,
    categoryId: '',
    subcategoryId: '',
    searchQuery: '',
    status: 'all'
  });
  const [showFilters, setShowFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [selectedEntry, setSelectedEntry] = useState(null);
  const [viewMode, setViewMode] = useState('list');
  const user = JSON.parse(localStorage.getItem('user') || '{}');

  useEffect(() => {
    fetchData();
  }, []);

  useEffect(() => {
    applyFilters();
  }, [filters, entries, tokens]);

  const fetchData = async () => {
    try {
      setLoading(true);
      const entriesResponse = await getServiceEntries(false);
      const entriesData = entriesResponse.data;
      setEntries(entriesData);

      const categoriesResponse = await getCategories();
      setCategories(categoriesResponse.data);

      const centreId = user.role === 'superadmin' ? 'all' : user.centre_id;
      const tokensResponse = await getTokens(centreId, 'all');
      setTokens(tokensResponse.data);
    } catch (error) {
      console.error('AllEntries.jsx: Error fetching data:', error);
      toast.error('Failed to load entries or categories');
    } finally {
      setLoading(false);
    }
  };

  const applyFilters = () => {
    let filtered = [...entries];

    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase();
      filtered = filtered.filter(entry => 
        entry.customerName.toLowerCase().includes(query) ||
        entry.phone.includes(query) ||
        (entry.tokenId && entry.tokenId.toString().includes(query))
      );
    }

    if (filters.tokenType !== 'all') {
      filtered = filtered.filter(entry => {
        if (filters.tokenType === 'direct') {
          return !entry.tokenId;
        } else {
          const token = tokens.find(t => t.tokenId === entry.tokenId);
          return token && token.type === filters.tokenType;
        }
      });
    }

    if (filters.status !== 'all') {
      filtered = filtered.filter(entry => entry.status === filters.status);
    }

    if (filters.startDate || filters.endDate) {
      filtered = filtered.filter(entry => {
        const createdAt = new Date(entry.created_at);
        const start = filters.startDate ? new Date(filters.startDate).setHours(0, 0, 0, 0) : null;
        const end = filters.endDate ? new Date(filters.endDate).setHours(23, 59, 59, 999) : null;
        return (
          (!start || createdAt >= start) &&
          (!end || createdAt <= end)
        );
      });
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
      startDate: null,
      endDate: null,
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
      pending: 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400',
      completed: 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400',
      cancelled: 'bg-rose-100 text-rose-800 dark:bg-rose-900/30 dark:text-rose-400'
    };
    
    return (
      <span className={`px-2.5 py-1 text-xs font-medium rounded-full ${statusClasses[status] || 'bg-gray-200 text-gray-700 dark:bg-gray-700 dark:text-gray-300'}`}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </span>
    );
  };

  const getTokenTypeBadge = (entry) => {
    if (!entry.tokenId) {
      return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400">Direct</span>;
    }
    
    const token = tokens.find(t => t.tokenId === entry.tokenId);
    if (token && token.type === 'campaign') {
      return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-400">Campaign</span>;
    }
    
    return <span className="px-2.5 py-1 text-xs font-medium rounded-full bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400">Normal</span>;
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

  const getSubcategoryName = (categoryId, subcategoryId) => {
    const category = categories.find(cat => cat.id === categoryId);
    if (category && category.subcategories) {
      const subcategory = category.subcategories.find(sub => sub.id === subcategoryId);
      return subcategory ? subcategory.name : 'N/A';
    }
    return 'N/A';
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto p-6 flex justify-center items-center h-96">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin mx-auto"></div>
          <p className="mt-4 text-gray-600 dark:text-gray-400 font-medium">Loading service entries...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 transition-colors duration-200">
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Service Entries Dashboard</h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Manage and analyze all service entries in one place
            </p>
          </div>
          
          <div className="flex items-center gap-3">
            <button
              onClick={fetchData}
              className="flex items-center gap-2 px-4 py-2.5 bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 rounded-lg border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-gray-750 transition-colors"
            >
              <FiRefreshCw className="h-4 w-4" />
              Refresh
            </button>
            <Link
              to="/dashboard/staff/service_entry"
              className="flex items-center gap-2 px-4 py-2.5 bg-indigo-600 text-white rounded-lg shadow-sm hover:bg-indigo-700 transition-colors"
            >
              <FiPlus className="h-4 w-4" />
              New Entry
            </Link>
          </div>
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-700 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Entries</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">{entries.length}</p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">All time</p>
              </div>
              <div className="bg-indigo-100 dark:bg-indigo-900/30 p-2.5 rounded-lg">
                <FiFileText className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-700 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Completed</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {entries.filter(e => e.status === 'completed').length}
                </p>
                <p className="text-xs text-green-600 dark:text-green-400 mt-1">
                  {entries.length > 0 ? Math.round((entries.filter(e => e.status === 'completed').length / entries.length) * 100) : 0}% success rate
                </p>
              </div>
              <div className="bg-green-100 dark:bg-green-900/30 p-2.5 rounded-lg">
                <FiCheckCircle className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-700 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Pending</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {entries.filter(e => e.status === 'pending').length}
                </p>
                <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">Needs attention</p>
              </div>
              <div className="bg-amber-100 dark:bg-amber-900/30 p-2.5 rounded-lg">
                <FiClock className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
            </div>
          </div>
          
          <div className="bg-gradient-to-br from-white to-gray-50 dark:from-gray-800 dark:to-gray-700 rounded-xl p-5 shadow-sm border border-gray-100 dark:border-gray-700">
            <div className="flex justify-between items-start">
              <div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">Total Revenue</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white mt-1">
                  {formatCurrency(entries.reduce((sum, entry) => sum + (entry.totalCharge || 0), 0))}
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">Lifetime value</p>
              </div>
              <div className="bg-purple-100 dark:bg-purple-900/30 p-2.5 rounded-lg">
                <FiDollarSign className="h-5 w-5 text-purple-600 dark:text-purple-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Search and Filter Section */}
        <div className="bg-white dark:bg-gray-800 rounded-xl p-5 mb-6 shadow-sm border border-gray-200 dark:border-gray-700">
          <div className="flex flex-col md:flex-row gap-4 mb-4">
            <div className="relative flex-grow">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                <FiSearch className="h-5 w-5 text-gray-400" />
              </div>
              <input
                type="text"
                value={filters.searchQuery}
                onChange={e => handleFilterChange('searchQuery', e.target.value)}
                className="w-full pl-10 pr-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 dark:text-white"
                placeholder="Search by customer name, phone, or token ID..."
              />
            </div>
            
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 px-4 py-2.5 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors text-gray-700 dark:text-gray-300"
              >
                <FiFilter className="h-4 w-4" />
                Filters
                {showFilters ? <FiChevronUp className="h-4 w-4" /> : <FiChevronDown className="h-4 w-4" />}
              </button>
              
              <div className="flex bg-gray-100 dark:bg-gray-700 rounded-lg p-1">
                <button
                  onClick={() => setViewMode('list')}
                  className={`p-2 rounded-md ${viewMode === 'list' ? 'bg-white dark:bg-gray-600 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                  aria-label="List view"
                >
                  <FiList className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode('grid')}
                  className={`p-2 rounded-md ${viewMode === 'grid' ? 'bg-white dark:bg-gray-600 shadow-sm text-indigo-600 dark:text-indigo-400' : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white'}`}
                  aria-label="Grid view"
                >
                  <FiGrid className="h-4 w-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Advanced Filters */}
          {showFilters && (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Entry Type</label>
                <select
                  value={filters.tokenType}
                  onChange={e => handleFilterChange('tokenType', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 dark:text-white"
                >
                  <option value="all">All Types</option>
                  <option value="normal">Normal Tokens</option>
                  <option value="campaign">Campaign Tokens</option>
                  <option value="direct">Direct Entries</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Status</label>
                <select
                  value={filters.status}
                  onChange={e => handleFilterChange('status', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 dark:text-white"
                >
                  <option value="all">All Statuses</option>
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Category</label>
                <select
                  value={filters.categoryId}
                  onChange={e => handleFilterChange('categoryId', e.target.value)}
                  className="w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 dark:text-white"
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Subcategory</label>
                <select
                  value={filters.subcategoryId}
                  onChange={e => handleFilterChange('subcategoryId', e.target.value)}
                  disabled={!filters.categoryId}
                  className={`w-full px-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 dark:text-white ${!filters.categoryId ? 'opacity-50 cursor-not-allowed' : ''}`}
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
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">Start Date</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiCalendar className="h-4 w-4 text-gray-400" />
                  </div>
                  <DatePicker
                    selected={filters.startDate}
                    onChange={date => handleFilterChange('startDate', date)}
                    selectsStart
                    startDate={filters.startDate}
                    endDate={filters.endDate}
                    maxDate={new Date()}
                    className="w-full pl-10 pr-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 dark:text-white"
                    placeholderText="Select start date"
                  />
                </div>
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">End Date</label>
                <div className="relative">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                    <FiCalendar className="h-4 w-4 text-gray-400" />
                  </div>
                  <DatePicker
                    selected={filters.endDate}
                    onChange={date => handleFilterChange('endDate', date)}
                    selectsEnd
                    startDate={filters.startDate}
                    endDate={filters.endDate}
                    minDate={filters.startDate}
                    maxDate={new Date()}
                    className="w-full pl-10 pr-3 py-2 bg-gray-50 dark:bg-gray-700 border border-gray-200 dark:border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 dark:focus:ring-indigo-400 dark:text-white"
                    placeholderText="Select end date"
                  />
                </div>
              </div>
              
              <div className="flex items-end gap-2">
                <button
                  onClick={resetFilters}
                  className="flex-1 px-4 py-2 bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                >
                  Reset
                </button>
                <button className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors">
                  <FiDownload className="h-4 w-4" />
                  Export
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Results Header */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-4 gap-2">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Showing <span className="font-medium">{filteredEntries.length}</span> of <span className="font-medium">{entries.length}</span> entries
          </p>
          <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
            <span>View:</span>
            <span className="font-medium capitalize">{viewMode}</span>
          </div>
        </div>

        {/* Entries Display */}
        {filteredEntries.length === 0 ? (
          <div className="bg-white dark:bg-gray-800 rounded-xl p-8 text-center shadow-sm border border-gray-200 dark:border-gray-700">
            <FiSearch className="mx-auto h-12 w-12 text-gray-400 mb-3" />
            <p className="font-medium text-gray-900 dark:text-white">No entries match your filters</p>
            <p className="text-gray-600 dark:text-gray-400 text-sm mt-1">Try adjusting your filters or search term</p>
            <button
              onClick={resetFilters}
              className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Reset Filters
            </button>
          </div>
        ) : viewMode === 'grid' ? (
          // Grid View
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredEntries.map(entry => (
              <div key={entry.id} className="bg-white dark:bg-gray-800 rounded-xl p-5 shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md transition-all">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-semibold text-gray-900 dark:text-white">{entry.customerName}</h3>
                    <p className="text-sm text-gray-500 dark:text-gray-400 mt-1 flex items-center gap-1">
                      <FiPhone className="h-3 w-3" /> {entry.phone}
                    </p>
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    {getTokenTypeBadge(entry)}
                    {getStatusBadge(entry.status)}
                  </div>
                </div>
                
                <div className="mb-4">
                  <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Service</p>
                  <p className="font-medium text-gray-900 dark:text-white mt-1">{getCategoryName(entry.category)}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">{getSubcategoryName(entry.category, entry.subcategory)}</p>
                </div>
                
                <div className="flex justify-between items-center mb-4">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Amount</p>
                    <p className="font-bold text-lg text-gray-900 dark:text-white">{formatCurrency(entry.totalCharge)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-xs text-gray-500 dark:text-gray-400 uppercase tracking-wide">Created</p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">{formatDate(entry.created_at)}</p>
                  </div>
                </div>
                
                <div className="flex justify-between items-center pt-3 border-t border-gray-100 dark:border-gray-700">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    ID: #{entry.id}{entry.tokenId && ` (Token: ${entry.tokenId})`}
                  </span>
                  <button 
                    onClick={() => setSelectedEntry(entry)}
                    className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors flex items-center gap-1 text-sm"
                  >
                    <FiEye className="h-4 w-4" />
                    Details
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : (
          // List View
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                <thead className="bg-gray-50 dark:bg-gray-700">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Customer</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Service</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Type</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Amount</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-300 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
                  {filteredEntries.map(entry => (
                    <tr key={entry.id} className="hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors">
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium text-gray-900 dark:text-white">{entry.customerName}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400 flex items-center gap-1">
                          <FiPhone className="h-3 w-3" /> {entry.phone}
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <div className="font-medium text-gray-900 dark:text-white">{getCategoryName(entry.category)}</div>
                        <div className="text-sm text-gray-500 dark:text-gray-400">{getSubcategoryName(entry.category, entry.subcategory)}</div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getTokenTypeBadge(entry)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap font-medium text-gray-900 dark:text-white">
                        {formatCurrency(entry.totalCharge)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {getStatusBadge(entry.status)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400">
                        {formatDate(entry.created_at)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium">
                        <button 
                          onClick={() => setSelectedEntry(entry)}
                          className="text-indigo-600 dark:text-indigo-400 hover:text-indigo-800 dark:hover:text-indigo-300 transition-colors p-1.5 rounded-lg hover:bg-indigo-50 dark:hover:bg-indigo-900/30"
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
        )}

        {/* Entry Detail Modal */}
        {selectedEntry && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white dark:bg-gray-800 rounded-xl p-6 max-w-4xl w-full max-h-[90vh] overflow-y-auto">
              <div className="flex justify-between items-center mb-6 pb-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-bold text-gray-900 dark:text-white">Service Entry Details</h2>
                <button 
                  onClick={() => setSelectedEntry(null)}
                  className="text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 p-1 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <FiX className="h-6 w-6" />
                </button>
              </div>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-5">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <FiUser className="h-5 w-5 text-indigo-500" />
                    Customer Information
                  </h3>
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    <div className="mb-3">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Customer Name</p>
                      <p className="font-medium text-gray-900 dark:text-white">{selectedEntry.customerName}</p>
                    </div>
                    <div className="mb-3">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Phone Number</p>
                      <p className="font-medium text-gray-900 dark:text-white">{selectedEntry.phone}</p>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Entry Type</p>
                      <div className="mt-1">{getTokenTypeBadge(selectedEntry)}</div>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-5">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <FiBarChart2 className="h-5 w-5 text-indigo-500" />
                    Service Information
                  </h3>
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    <div className="mb-3">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Category</p>
                      <p className="font-medium text-gray-900 dark:text-white">{getCategoryName(selectedEntry.category)}</p>
                    </div>
                    <div className="mb-3">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Subcategory</p>
                      <p className="font-medium text-gray-900 dark:text-white">{getSubcategoryName(selectedEntry.category, selectedEntry.subcategory)}</p>
                    </div>
                    <div className="mb-3">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Status</p>
                      <div className="mt-1">{getStatusBadge(selectedEntry.status)}</div>
                    </div>
                    <div>
                      <p className="text-sm text-gray-600 dark:text-gray-400">Created On</p>
                      <p className="font-medium text-gray-900 dark:text-white">{formatDate(selectedEntry.created_at)}</p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-5">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <FiDollarSign className="h-5 w-5 text-indigo-500" />
                    Payment Details
                  </h3>
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    <div className="mb-3">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Service Charge</p>
                      <p className="font-medium text-gray-900 dark:text-white">{formatCurrency(selectedEntry.serviceCharge)}</p>
                    </div>
                    <div className="mb-3">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Department Charge</p>
                      <p className="font-medium text-gray-900 dark:text-white">{formatCurrency(selectedEntry.departmentCharge)}</p>
                    </div>
                    <div className="pt-3 border-t border-gray-200 dark:border-gray-600">
                      <p className="text-sm text-gray-600 dark:text-gray-400">Total Amount</p>
                      <p className="font-bold text-lg text-gray-900 dark:text-white">{formatCurrency(selectedEntry.totalCharge)}</p>
                    </div>
                  </div>
                </div>
                
                <div className="space-y-5">
                  <h3 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
                    <FiPieChart className="h-5 w-5 text-indigo-500" />
                    Additional Information
                  </h3>
                  <div className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg">
                    {selectedEntry.expiryDate && (
                      <div className="mb-3">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Expiry Date</p>
                        <p className="font-medium text-gray-900 dark:text-white">{formatDate(selectedEntry.expiryDate)}</p>
                      </div>
                    )}
                    {selectedEntry.serviceWalletId && (
                      <div className="mb-3">
                        <p className="text-sm text-gray-600 dark:text-gray-400">Service Wallet</p>
                        <p className="font-medium text-gray-900 dark:text-white">Wallet #{selectedEntry.serviceWalletId}</p>
                      </div>
                    )}
                    {selectedEntry.notes && (
                      <div>
                        <p className="text-sm text-gray-600 dark:text-gray-400">Notes</p>
                        <p className="font-medium text-gray-900 dark:text-white">{selectedEntry.notes}</p>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              
              {selectedEntry.payments && selectedEntry.payments.length > 0 && (
                <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
                  <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Payment Methods</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {selectedEntry.payments.map((payment, index) => (
                      <div key={index} className="bg-gray-50 dark:bg-gray-700 p-4 rounded-lg border border-gray-200 dark:border-gray-600">
                        <div className="flex justify-between items-start">
                          <div>
                            <p className="font-medium capitalize text-gray-900 dark:text-white">{payment.method}</p>
                            <p className="text-sm text-gray-600 dark:text-gray-400">Wallet: {payment.walletName}</p>
                          </div>
                          <div className="text-right">
                            <p className="font-medium text-lg text-gray-900 dark:text-white">{formatCurrency(payment.amount)}</p>
                            <span className={`px-2 py-0.5 text-xs rounded-full ${
                              payment.status === 'received' ? 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400' :
                              payment.status === 'pending' ? 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400' :
                              'bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400'
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
              
              <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700 flex justify-end">
                <button 
                  onClick={() => setSelectedEntry(null)}
                  className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
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