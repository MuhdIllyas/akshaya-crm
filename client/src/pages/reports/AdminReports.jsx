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
  const [transactionPage, setTransactionPage] = useState(1);
  const [selectedWallet, setSelectedWallet] = useState(null);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [viewMode, setViewMode] = useState('grid');
  const [sortBy, setSortBy] = useState('date');
  const [sortOrder, setSortOrder] = useState('desc');
  // Read the 'tab' from the URL, default to 'overview' if none exists
  const [activeSection, setActiveSection] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    return params.get('tab') || 'overview';
  });

  // Update the URL quietly when a user clicks different tabs manually
  useEffect(() => {
    const url = new URL(window.location);
    url.searchParams.set('tab', activeSection);
    window.history.pushState({}, '', url);
  }, [activeSection]);

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
     sort_order: sortOrder,
        page: transactionPage, 
        limit: 50              
    });

    if (dateFilter.fromDate) params.append("from", dateFilter.fromDate);
    if (dateFilter.toDate) params.append("to", dateFilter.toDate);

    fetch(`${import.meta.env.VITE_API_URL}/api/transaction/transactions/?${params.toString()}`, {
     headers: {
      Authorization: `Bearer ${localStorage.getItem("token")}`
     }
    })
     .then(res => res.json())
     .then(data => setTransactionsData(data))
     .catch(err => console.error("Failed to load transactions", err));
     
      // 👈 ADDED transactionPage to the dependency array below so it refetches on click
   }, [activeSection, searchTerm, sortBy, sortOrder, dateFilter, transactionPage]);

  // Statistics calculation (Mapped directly to V3 Analytics Engine)
  const stats = useMemo(() => {
    if (!data || !data.stats) return {};

    const todayExpenses = accountingData?.expenses?.filter(e => e.status === 'approved').reduce((sum, e) => sum + e.amount, 0) || 0;

    return {
      // YTD / Core Metrics
      totalRevenue: `₹${(data.stats.todayRevenueCollected || 0).toLocaleString()}`, // Update to YTD later if needed
      totalExpenses: `₹${(data.stats.todayOperatingExpenses || 0).toLocaleString()}`, // Update to YTD later if needed
      totalProfit: `₹${(data.stats.todayNetProfit || 0).toLocaleString()}`,
      
      // Activity Stats
      totalTransactions: (data.lists?.recentTransactions?.length || 0).toLocaleString(),
      pendingTransactions: (data.stats.pendingPayments || 0).toLocaleString(),
      completedTransactions: (data.stats.servicesCompleted || 0).toLocaleString(),
      averageTransaction: `₹${(data.stats.averageOrderValue || 0).toLocaleString()}`,
      
      // Wallet Stats
      totalWalletBalance: `₹${(data.stats.totalWalletBalance || 0).toLocaleString()}`,
      totalCashInHand: `₹${(data.stats.cashInHand || 0).toLocaleString()}`,
      totalBankBalance: `₹${(data.stats.bankBalance || 0).toLocaleString()}`,
      totalDigitalBalance: `₹${(data.stats.digitalBalance || 0).toLocaleString()}`,
      
      // Today's Flow
      totalCashInToday: `₹${(data.stats.todayRevenueCollected || 0).toLocaleString()}`,
      totalCashOutToday: `₹${(data.stats.todayOperatingExpenses || 0).toLocaleString()}`,
      netCashFlowToday: `₹${(data.stats.todayNetProfit || 0).toLocaleString()}`,
      
      // Breakdown Stats
      todayExpenses: `₹${(data.stats.todayOperatingExpenses || 0).toLocaleString()}`, // Trust backend over local accountingData
      todayProfit: `₹${(data.stats.todayNetProfit || 0).toLocaleString()}`,
      todayServiceCharge: `₹${(data.stats.todayGrossProfit || 0).toLocaleString()}`,
      
      // Trends & Tracking
      revenueChange: 0,
      expenseChange: 0,
      profitChange: 0,
      currentMonthRevenue: `₹${(data.charts?.financialTrend?.revenueCollected?.[new Date().getMonth()] || 0).toLocaleString()}`,
      currentMonthProfit: `₹${(data.charts?.financialTrend?.netProfit?.[new Date().getMonth()] || 0).toLocaleString()}`
    };
  }, [data, accountingData]);

  // Reset filters function
  const resetFilters = () => {
    setSearchTerm('');
    setSortBy('date');
    setSortOrder('desc');
    setTransactionPage(1);
    
    // Reset date to today
    const today = new Date().toISOString().split('T')[0];
    setDateFilter({ fromDate: today, toDate: today });
  };

  // Handle accounting data updates
  const handleUpdateAccounting = (type, updatedData) => {
    setAccountingData(prev => ({
      ...prev,
      [type]: updatedData
    }));
  };

  useEffect(() => {
    setLoading(true);
    
    fetch(`${import.meta.env.VITE_API_URL}/api/analytics/admin/my-centre`, {
      headers: {
        Authorization: `Bearer ${localStorage.getItem('token')}`
      }
    })
      .then(res => {
        if (!res.ok) throw new Error("Failed to fetch analytics");
        return res.json();
      })
      .then(result => {
        setData(result); // This populates the data state!
        setLoading(false);
      })
      .catch(err => {
        console.error('Failed to load analytics', err);
        setLoading(false);
      });
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
                data={data} // <-- Changed from overviewData to data
                stats={stats}
                showCharts={showCharts}
                timePeriod={timePeriod}
                setTimePeriod={setTimePeriod}
                setActiveSection={setActiveSection}
              />
            ) : (
              <div className="bg-white rounded-xl border p-6 text-gray-600">
                Overview data is loading...
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

              currentPage={transactionsData?.page || 1}
              totalPages={transactionsData?.totalPages || 1}
              onPageChange={(newPage) => setTransactionPage(newPage)}
            />
          )}
        </div>
      </div>
    </ErrorBoundary>
  );
};

export default AdminReports;
