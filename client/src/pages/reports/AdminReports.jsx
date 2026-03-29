import React, { useState, useEffect, useMemo } from 'react';
import { 
  FiDollarSign, FiBarChart2, FiEye, FiDownload, 
  FiLoader, FiArrowLeft, FiX, FiSearch, FiFileText
} from 'react-icons/fi';
import { motion, AnimatePresence } from 'framer-motion';
import OverviewSection from '../reports/components/OverviewSection';
import WalletsSection from '../reports/components/WalletsSection';
import StaffPerformanceSection from '../reports/components/StaffPerformanceSection';
import AccountingSection from '../reports/components/AccountingSection';
import TransactionsSection from '../reports/components/TransactionsSection';
import PendingPaymentsSection from '../reports/components/PendingPaymentsSection';

// Error Boundary Component
class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error caught by boundary:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen bg-gray-50 flex items-center justify-center p-6">
          <div className="bg-white rounded-xl border border-gray-200 p-8 max-w-md text-center">
            <div className="w-16 h-16 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <FiFileText className="h-8 w-8 text-rose-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
            <p className="text-gray-600 mb-4">
              There was an error loading the financial reports. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
            >
              Refresh Page
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

// Main AdminReports Component
const AdminReports = () => {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedTransaction, setSelectedTransaction] = useState(null);
  const [dateFilter, setDateFilter] = useState(() => {
    const today = new Date().toISOString().split('T')[0];
    return { fromDate: today, toDate: today };
  });
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  const [activeSection, setActiveSection] = useState('overview');
  const [showCharts, setShowCharts] = useState(true);
  const [timePeriod, setTimePeriod] = useState('monthly');
  const [staff, setStaff] = useState([]);
  const [wallets, setWallets] = useState([]);
  const [transactionsData, setTransactionsData] = useState({
    transactions: [],
    page: 1,
    limit: 50
  });

 const [accountingData, setAccountingData] = useState({
      dailySummary: {},
      income: [],
      ledger: { rows: [] },
      expenses: [],
      wallets: [],
     nightlyAccounting: {},
     walletReconciliations: []
   });

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/staff/all`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    })
      .then(res => res.json())
      .then(data => setStaff(data))
      .catch(err => console.error('Failed to load staff', err));
  }, []);

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL}/api/wallet/my-centre-wallets`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    })
      .then(res => res.json())
      .then(data => setWallets(data))
      .catch(err => console.error('Failed to load wallets', err));
  }, []);

  useEffect(() => {
    if (activeSection !== 'transactions') return;

    const params = new URLSearchParams({
      search: searchTerm || "",
      sort_by: sortBy,
      sort_order: sortOrder
    });

    if (dateFilter.fromDate) params.append("from", dateFilter.fromDate);
    if (dateFilter.toDate) params.append("to", dateFilter.toDate);

    fetch(`${import.meta.env.VITE_API_URL}/api/transaction/transactions?${params.toString()}`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem("token")}`
      }
    })
      .then(res => res.json())
      .then(data => setTransactionsData(data))
      .catch(err => console.error("Failed to load transactions", err));
      
  }, [activeSection, searchTerm, sortBy, sortOrder, dateFilter]); 

  // Statistics calculation
  const stats = useMemo(() => {
    if (!data) return {};

    const currentMonth = new Date().getMonth();
    const lastMonth = currentMonth > 0 ? currentMonth - 1 : 11;
    
    const currentMonthRevenue = data.revenue[currentMonth] || 0;
    const lastMonthRevenue = data.revenue[lastMonth] || 0;
    const revenueChange = lastMonthRevenue > 0 
      ? ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue * 100).toFixed(1)
      : 0;

    const currentMonthExpenses = data.expenses[currentMonth] || 0;
    const lastMonthExpenses = data.expenses[lastMonth] || 0;
    const expenseChange = lastMonthExpenses > 0 
      ? ((currentMonthExpenses - lastMonthExpenses) / lastMonthExpenses * 100).toFixed(1)
      : 0;

    const currentMonthProfit = data.profit[currentMonth] || 0;
    const lastMonthProfit = data.profit[lastMonth] || 0;
    const profitChange = lastMonthProfit > 0 
      ? ((currentMonthProfit - lastMonthProfit) / lastMonthProfit * 100).toFixed(1)
      : 0;

    const totalRevenue = data.revenue.slice(0, currentMonth + 1).reduce((a, b) => a + b, 0);
    const totalExpenses = data.expenses.slice(0, currentMonth + 1).reduce((a, b) => a + b, 0);
    const totalProfit = totalRevenue - totalExpenses;

    const totalTransactions = data.transactions.length;
    const pendingTransactions = data.transactions.filter(t => t.status === 'Pending').length;
    const completedTransactions = data.transactions.filter(t => t.status === 'Completed').length;

    const averageTransaction = totalTransactions > 0 
      ? Math.round(data.transactions.reduce((a, b) => a + b.amount, 0) / totalTransactions)
      : 0;

    // Wallet totals
    const totalWalletBalance = data.wallets.reduce((sum, wallet) => sum + wallet.currentBalance, 0);
    const totalCashInHand = data.wallets.find(w => w.name === 'Cash in Hand')?.currentBalance || 0;
    const totalBankBalance = data.wallets.filter(w => w.type.includes('Bank')).reduce((sum, w) => sum + w.currentBalance, 0);
    const totalDigitalBalance = data.wallets.filter(w => w.type.includes('Digital') || w.type.includes('Wallet')).reduce((sum, w) => sum + w.currentBalance, 0);

    // Daily cash flow
    const totalCashInToday = data.wallets.reduce((sum, wallet) => sum + wallet.todayIn, 0);
    const totalCashOutToday = data.wallets.reduce((sum, wallet) => sum + wallet.todayOut, 0);
    const netCashFlowToday = totalCashInToday - totalCashOutToday;

    // Accounting stats
    const todayExpenses = accountingData?.expenses.filter(e => e.status === 'approved').reduce((sum, e) => sum + e.amount, 0) || 0;

    return {
      totalRevenue: `₹${totalRevenue.toLocaleString()}`,
      totalExpenses: `₹${totalExpenses.toLocaleString()}`,
      totalProfit: `₹${totalProfit.toLocaleString()}`,
      totalTransactions: totalTransactions.toLocaleString(),
      pendingTransactions: pendingTransactions.toLocaleString(),
      completedTransactions: completedTransactions.toLocaleString(),
      averageTransaction: `₹${averageTransaction.toLocaleString()}`,
      totalWalletBalance: `₹${totalWalletBalance.toLocaleString()}`,
      totalCashInHand: `₹${totalCashInHand.toLocaleString()}`,
      totalBankBalance: `₹${totalBankBalance.toLocaleString()}`,
      totalDigitalBalance: `₹${totalDigitalBalance.toLocaleString()}`,
      totalCashInToday: `₹${totalCashInToday.toLocaleString()}`,
      totalCashOutToday: `₹${totalCashOutToday.toLocaleString()}`,
      netCashFlowToday: `₹${netCashFlowToday.toLocaleString()}`,
      todayExpenses: `₹${todayExpenses.toLocaleString()}`,
      revenueChange: parseFloat(revenueChange),
      expenseChange: parseFloat(expenseChange),
      profitChange: parseFloat(profitChange),
      currentMonthRevenue: `₹${currentMonthRevenue.toLocaleString()}`,
      currentMonthProfit: `₹${currentMonthProfit.toLocaleString()}`
    };
  }, [data, accountingData]);

  // Get unique values for filters
  const paymentMethods = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.transactions.map(t => t.paymentMethod))];
  }, [data]);

  const serviceTypes = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.transactions.map(t => t.serviceType))];
  }, [data]);

  const statuses = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.transactions.map(t => t.status))];
  }, [data]);

  const walletsList = useMemo(() => {
    if (!data) return [];
    return [...new Set(data.transactions.map(t => t.wallet))];
  }, [data]);

  // Reset filters function
  const resetFilters = () => {
    setSearchTerm('');
    setStatusFilter('all');
    setPaymentMethodFilter('all');
    setServiceTypeFilter('all');
    setWalletFilter('all');
    setDateRange('all');
    setAmountRange('all');
    alert('Filters reset');
  };

  // Handle accounting data updates
  const handleUpdateAccounting = (type, updatedData) => {
    setAccountingData(prev => ({
      ...prev,
      [type]: updatedData
    }));
  };

useEffect(() => {
    setLoading(false);
  }, []);

  if (loading) {
  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center">
      <FiLoader className="animate-spin h-6 w-6 text-indigo-600" />
    </div>
  );
}

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gray-50">
        {/* Header */}
        <div className="bg-white border-b border-gray-200 sticky top-0 z-30 shadow-sm">
          <div className="px-6 py-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-teal-600 rounded-xl flex items-center justify-center shadow-lg">
                  <FiDollarSign className="text-white h-6 w-6" />
                </div>
                <div>
                  <h1 className="font-bold text-gray-900 text-2xl">Financial Reports</h1>
                  <p className="text-gray-600 flex items-center">
                    <FiBarChart2 className="h-3 w-3 mr-1" />
                    Monitor revenue, expenses, wallets, and staff performance
                  </p>
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => setShowCharts(!showCharts)}
                  className={`flex items-center space-x-2 px-4 py-2 ${
                    showCharts ? 'bg-indigo-100 text-indigo-700' : 'bg-gray-100 text-gray-700'
                  } rounded-lg hover:opacity-90 transition-colors`}
                >
                  {showCharts ? <FiEye className="h-4 w-4" /> : <FiBarChart2 className="h-4 w-4" />}
                  <span>{showCharts ? 'Hide Charts' : 'Show Charts'}</span>
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="flex items-center space-x-2 px-4 py-2 bg-gradient-to-r from-emerald-600 to-teal-600 text-white rounded-lg hover:from-emerald-700 hover:to-teal-700 transition-all shadow-md"
                  onClick={() => alert('Financial report export started')}
                >
                  <FiDownload className="h-4 w-4" />
                  <span>Export</span>
                </motion.button>
              </div>
            </div>
          </div>

          {/* Desktop Navigation */}
          <div className="border-t border-gray-200">
            <div className="px-6">
              <nav className="flex space-x-1 overflow-x-auto pb-1">
                {[
                  { id: 'overview', label: 'Overview', icon: FiBarChart2 },
                  { id: 'wallets', label: 'Wallets', icon: FiFileText },
                  { id: 'staff', label: 'Staff Performance', icon: FiFileText },
                  { id: 'accounting', label: 'Accounting', icon: FiFileText },
                  { id: 'transactions', label: 'Transactions', icon: FiFileText },
                  { id: 'pendingPayments', label: 'Pending Payments', icon: FiFileText },
                ].map((tab) => {
                  const Icon = tab.icon;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveSection(tab.id)}
                      className={`py-3 px-5 border-b-2 font-medium text-sm flex items-center space-x-2 transition-colors whitespace-nowrap rounded-t-lg ${
                        activeSection === tab.id
                          ? 'border-indigo-500 text-indigo-600 bg-white shadow-sm'
                          : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300 hover:bg-gray-50'
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                      <span>{tab.label}</span>
                    </button>
                  );
                })}
              </nav>
            </div>
          </div>
        </div>

        {/* Main Content */}
        <div className="px-6 py-6">
          {/* Overview Section */}
            {activeSection === 'overview' && (
              data ? (
                <OverviewSection
                  data={data}
                  stats={stats}
                  showCharts={showCharts}
                  timePeriod={timePeriod}
                  setTimePeriod={setTimePeriod}
                  setActiveSection={setActiveSection}
                />
              ) : (
                <div className="bg-white rounded-xl border p-6 text-gray-600">
                  Overview will be available once analytics API is connected.
                </div>
              )
            )}

          {/* Wallets Section */}
          {activeSection === 'wallets' && (
            <WalletsSection
              data={data}
              stats={stats}
              showCharts={showCharts}
              selectedWallet={selectedWallet}
              setSelectedWallet={setSelectedWallet}
              setActiveSection={setActiveSection}
            />
          )}

          {/* Staff Performance Section */}
          {activeSection === 'staff' && (
            <StaffPerformanceSection
              data={data}
              showCharts={showCharts}
              timePeriod={timePeriod}
              setTimePeriod={setTimePeriod}
              selectedStaff={selectedStaff}
              setSelectedStaff={setSelectedStaff}
              setActiveSection={setActiveSection}
            />
          )}

          {/* Accounting Section */}
          {activeSection === 'accounting' && accountingData && (
            <AccountingSection
              accountingData={accountingData}
              onUpdateAccounting={handleUpdateAccounting}
              wallets={wallets}
              staff={staff}
            />
          )}

          {/* Pending Payments Section */}
          {activeSection === 'pendingPayments' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between mb-4">
                <div>
                  <h2 className="text-lg font-bold text-gray-900 flex items-center">
                    <FiFileText className="h-5 w-5 mr-2 text-amber-600" />
                    Pending Payments Management
                  </h2>
                  <p className="text-gray-600 text-sm">Track and collect outstanding payments from customers</p>
                </div>
              </div>
              <PendingPaymentsSection />
            </div>
          )}

          {/* Transactions Section */}
          {activeSection === 'transactions' && (
            <TransactionsSection
              data={transactionsData}
              setSelectedTransaction={setSelectedTransaction}
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              sortBy={sortBy}
              setSortBy={setSortBy}
              sortOrder={sortOrder}
              setSortOrder={setSortOrder}
              viewMode={viewMode}
              setViewMode={setViewMode}
              resetFilters={resetFilters}
              dateFilter={dateFilter}
              setDateFilter={setDateFilter}
            />
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default AdminReports;
