import React, { useState, useEffect, useMemo } from 'react';
import {
  FiDollarSign, FiBarChart2, FiEye, FiDownload, FiLoader, FiFileText,
  FiCreditCard, FiUsers, FiBook, FiList, FiClock,
} from 'react-icons/fi';
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
        <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-indigo-50 p-6">
          <div className="max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-rose-50">
              <FiFileText className="h-7 w-7 text-rose-600" />
            </div>
            <h2 className="mb-2 text-xl font-bold text-slate-900">Something went wrong</h2>
            <p className="mb-5 text-sm text-slate-600">
              There was an error loading the financial reports. Please try refreshing the page.
            </p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-xl bg-navy-700 px-5 py-2.5 text-sm font-medium text-white hover:bg-navy-800"
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

const TABS = [
  { id: 'overview', label: 'Overview', icon: FiBarChart2 },
  { id: 'wallets', label: 'Wallets', icon: FiCreditCard },
  { id: 'staff', label: 'Staff Performance', icon: FiUsers },
  { id: 'accounting', label: 'Accounting', icon: FiBook },
  { id: 'transactions', label: 'Transactions', icon: FiList },
  { id: 'pendingPayments', label: 'Pending Payments', icon: FiClock },
];

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
      <div className="flex min-h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-indigo-50">
        <FiLoader className="h-6 w-6 animate-spin text-navy-700" />
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50 p-4 sm:p-6">
        <div className="w-full">
          {/* Header */}
          <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-navy-700 text-white">
                <FiDollarSign className="h-6 w-6" />
              </span>
              <div>
                <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">Financial Reports</h1>
                <p className="mt-0.5 flex items-center text-sm text-slate-500">
                  <FiBarChart2 className="mr-1.5 h-3.5 w-3.5" />
                  Monitor revenue, expenses, wallets, and staff performance
                </p>
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => setShowCharts(!showCharts)}
                aria-pressed={showCharts}
                className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-medium text-navy-700 hover:bg-slate-50"
              >
                {showCharts ? <FiEye className="h-4 w-4" /> : <FiBarChart2 className="h-4 w-4" />}
                <span>{showCharts ? 'Hide Charts' : 'Show Charts'}</span>
              </button>
              <button
                type="button"
                className="inline-flex items-center justify-center gap-2 rounded-xl bg-navy-700 px-4 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-navy-800"
                onClick={() => alert('Financial report export started')}
              >
                <FiDownload className="h-4 w-4" />
                <span>Export</span>
              </button>
            </div>
          </div>

          {/* Navigation */}
          <div className="mb-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5" role="tablist" aria-label="Report sections">
            <div className="flex gap-1">
              {TABS.map((tab) => {
                const Icon = tab.icon;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    role="tab"
                    aria-selected={activeSection === tab.id}
                    onClick={() => setActiveSection(tab.id)}
                    className={`inline-flex shrink-0 items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition ${
                      activeSection === tab.id ? 'bg-navy-700 text-white' : 'text-slate-600 hover:bg-slate-100'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Main Content */}
          <div>
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
                <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
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
                <div>
                  <h2 className="flex items-center text-lg font-bold text-slate-900">
                    <FiFileText className="mr-2 h-5 w-5 text-amber-600" />
                    Pending Payments Management
                  </h2>
                  <p className="text-sm text-slate-500">Track and collect outstanding payments from customers</p>
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
      </div>
    </ErrorBoundary>
  );
};

export default AdminReports;