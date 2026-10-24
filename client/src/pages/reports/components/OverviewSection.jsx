import React from 'react';
import { 
  FiTrendingUp, FiDollarSign, FiSmartphone, FiHome, 
  FiActivity, FiUserCheck, FiBarChart2, FiCalendar,
  FiPieChart, FiUserCheck as FiUserCheckIcon, FiPlus,
  FiMinus, FiAlertCircle, FiShield,
  FiArrowDownLeft, FiArrowUpRight
} from 'react-icons/fi';
import { motion } from 'framer-motion';
import { 
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
} from 'chart.js';
import { Line, Doughnut, Bar } from 'react-chartjs-2';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

// Shared chart text style (UI only)
const TICK = { font: { size: 11 }, color: '#64748b' };
const GRID = { color: 'rgba(148, 163, 184, 0.18)' };

// Card shell used by every chart (UI only)
const ChartCard = ({ title, icon: Icon, children }) => (
  <div className="h-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
    <div className="mb-4 flex items-center justify-between">
      <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-slate-100 text-navy-700">
        <Icon className="h-4 w-4" />
      </span>
    </div>
    <div className="relative h-64">{children}</div>
  </div>
);

// StatCard Component
const StatCard = ({ title, value, icon: Icon, color, change, subtitle, onClick }) => (
  <motion.div
    whileHover={{ y: -2 }}
    className="cursor-pointer rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition-shadow hover:shadow-md"
    onClick={onClick}
  >
    <div className="flex items-start justify-between gap-3">
      <div className="min-w-0">
        <p className="mb-1 text-xs font-medium text-slate-500">{title}</p>
        <p className="mb-1 truncate text-xl font-bold text-slate-900">{value}</p>
        {change !== undefined && (
          <p className={`text-xs font-medium ${change >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {change >= 0 ? `↑ ${change}%` : `↓ ${Math.abs(change)}%`}
            <span className="ml-2 text-slate-500">{subtitle}</span>
          </p>
        )}
        {change === undefined && <p className="truncate text-xs text-slate-500">{subtitle}</p>}
      </div>
      <div className={`shrink-0 rounded-xl ${color} p-2.5`}>
        <Icon className="h-5 w-5 text-white" />
      </div>
    </div>
  </motion.div>
);

// RevenueTrendChart Component
const RevenueTrendChart = ({ data }) => {
  const chartData = {
    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'],
    datasets: [
      {
        label: 'Revenue',
        data: data?.charts?.financialTrend?.revenueCollected || [],
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Expenses',
        data: data?.charts?.financialTrend?.operatingExpenses || [],
        borderColor: 'rgb(239, 68, 68)',
        backgroundColor: 'rgba(239, 68, 68, 0.1)',
        tension: 0.4,
        fill: true,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'top', align: 'end', labels: { boxWidth: 8, usePointStyle: true, font: { size: 11 }, color: '#475569' } },
      title: { display: false },
    },
    scales: {
      y: { beginAtZero: true, ticks: TICK, grid: GRID, border: { display: false } },
      x: { ticks: TICK, grid: { display: false } }
    },
  };

  return (
    <ChartCard title="Financial Trends" icon={FiTrendingUp}>
      <Line data={chartData} options={options} />
    </ChartCard>
  );
};

const WalletBalanceChart = ({ wallets }) => {
  const safeWallets = wallets || []; // Prevents the crash
  const chartData = {
    labels: safeWallets.map(w => w.wallet_type || w.name), // Adapts to V3 key
    datasets: [
      {
        data: safeWallets.map(w => Number(w.total_balance || w.currentBalance || 0)),
        backgroundColor: ['rgba(34, 197, 94, 0.8)', 'rgba(59, 130, 246, 0.8)', 'rgba(245, 158, 11, 0.8)', 'rgba(139, 92, 246, 0.8)', 'rgba(14, 165, 233, 0.8)'],
        borderColor: ['rgb(34, 197, 94)', 'rgb(59, 130, 246)', 'rgb(245, 158, 11)', 'rgb(139, 92, 246)', 'rgb(14, 165, 233)'],
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { position: 'bottom', labels: { boxWidth: 8, usePointStyle: true, padding: 12, font: { size: 11 }, color: '#475569' } },
      title: { display: false },
    },
  };

  return (
    <ChartCard title="Wallet Balances" icon={FiPieChart}>
      <Doughnut data={chartData} options={options} />
    </ChartCard>
  );
};

// StaffPerformanceChart Component
const StaffPerformanceChart = ({ staffData }) => {
  const safeStaffData = staffData || [];
  const chartData = {
    labels: safeStaffData.map(s => s.staff_name || s.name),
    datasets: [
      {
        label: 'Revenue Collected',
        data: safeStaffData.map(s => Number(s.total_revenue || s.revenue || 0)),
        backgroundColor: 'rgba(30, 58, 95, 0.85)',
        borderColor: 'rgb(30, 58, 95)',
        borderWidth: 1,
        borderRadius: 6,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: { position: 'top', align: 'end', labels: { boxWidth: 8, usePointStyle: true, font: { size: 11 }, color: '#475569' } },
      title: { display: false },
    },
    scales: {
      x: { beginAtZero: true, ticks: TICK, grid: GRID, border: { display: false } },
      y: { ticks: TICK, grid: { display: false } }
    },
  };

  return (
    <ChartCard title="Staff Performance" icon={FiUserCheckIcon}>
      <Bar data={chartData} options={options} />
    </ChartCard>
  );
};

// Main Overview Section Component
const OverviewSection = ({ 
  data, 
  stats, 
  showCharts, 
  timePeriod, 
  setTimePeriod, 
  setActiveSection 
}) => {

  const safeTransactions = data?.lists?.recentTransactions || [];
  
  // Extract numbers to trigger smart alerts
  const pendingCount = parseInt(stats.pendingTransactions?.replace(/,/g, '') || 0);
  const cashAmount = parseInt(stats.totalCashInHand?.replace(/[^0-9.-]+/g, '') || 0);

  return (
    <>
      {/* Quick Actions Row */}
      <div className="mb-5 flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div>
          <h2 className="text-xl font-bold text-slate-900">Dashboard Overview</h2>
          <p className="text-sm text-slate-500">Here is what's happening at your centre today.</p>
        </div>
        
        <div className="flex flex-wrap items-center gap-2">
          <button 
            onClick={() => setActiveSection('accounting')}
            className="flex items-center rounded-xl bg-navy-700 px-4 py-2 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-navy-800"
          >
            <FiPlus className="mr-2 h-4 w-4" /> Add Income
          </button>
          <button 
            onClick={() => setActiveSection('accounting')}
            className="flex items-center rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm font-semibold text-rose-700 transition-colors hover:bg-rose-100"
          >
            <FiMinus className="mr-2 h-4 w-4" /> Record Expense
          </button>
        </div>
      </div>

      {/* Smart Alerts Banner */}
      {(pendingCount > 0 || cashAmount > 50000) && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-5 grid grid-cols-1 gap-3 md:grid-cols-2"
        >
          {/* Pending Payments Alert */}
          {pendingCount > 0 && (
            <div className="flex items-start rounded-2xl border border-amber-200 bg-amber-50 p-4">
              <div className="mr-3 rounded-xl bg-amber-100 p-2">
                <FiAlertCircle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-amber-900">Action Required: Pending Payments</h4>
                <p className="mt-1 text-xs text-amber-700">You have {stats.pendingTransactions} transaction(s) waiting for collection.</p>
                <button 
                  onClick={() => setActiveSection('pendingPayments')}
                  className="mt-2 text-xs font-bold text-amber-800 hover:underline"
                >
                  Review Pending Payments →
                </button>
              </div>
            </div>
          )}

          {/* High Cash Warning Alert */}
          {cashAmount > 50000 && (
            <div className="flex items-start rounded-2xl border border-blue-200 bg-blue-50 p-4">
              <div className="mr-3 rounded-xl bg-blue-100 p-2">
                <FiShield className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h4 className="text-sm font-bold text-blue-900">Security Recommendation</h4>
                <p className="mt-1 text-xs text-blue-700">Your cash in hand is high ({stats.totalCashInHand}). Consider a bank deposit.</p>
                <button 
                  onClick={() => setActiveSection('wallets')}
                  className="mt-2 text-xs font-bold text-blue-800 hover:underline"
                >
                  Manage Wallets →
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Stats Overview */}
      <div className="mb-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        <StatCard title="Total Revenue" value={stats.totalRevenue} subtitle="YTD" change={stats.revenueChange} icon={FiTrendingUp} color="bg-emerald-600" onClick={() => setActiveSection('transactions')} />
        <StatCard title="Net Profit" value={stats.totalProfit} subtitle="YTD" change={stats.profitChange} icon={FiDollarSign} color="bg-green-600" onClick={() => setActiveSection('transactions')} />
        <StatCard title="Wallet Balance" value={stats.totalWalletBalance} subtitle="Total" icon={FiSmartphone} color="bg-navy-700" onClick={() => setActiveSection('wallets')} />
        <StatCard title="Cash in Hand" value={stats.totalCashInHand} subtitle="Physical" icon={FiHome} color="bg-amber-600" onClick={() => setActiveSection('wallets')} />
        <StatCard title="Today's Flow" value={stats.netCashFlowToday} subtitle={`In: ${stats.totalCashInToday}`} icon={FiActivity} color="bg-violet-600" onClick={() => setActiveSection('accounting')} />
        <StatCard title="Today's Profit" value={stats.todayProfit} subtitle={`Charge: ${stats.todayServiceCharge}`} icon={FiUserCheck} color="bg-sky-600" onClick={() => setActiveSection('accounting')} />
      </div>

      {/* Main Content Area: Charts (Left) + Recent Activity Sidebar (Right) */}
      <div className="flex flex-col gap-6 lg:flex-row">
        
        {/* LEFT COLUMN: Charts Area */}
        <div className="min-w-0 flex-1">
          {showCharts && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center text-lg font-bold text-slate-900">
                  <FiBarChart2 className="mr-2 h-5 w-5 text-navy-700" />
                  Analytics Dashboard
                </h2>
                <div className="flex items-center gap-2">
                  <FiCalendar className="h-4 w-4 text-slate-400" />
                    <select
                      className="rounded-xl border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 focus:border-navy-500 focus:outline-none focus:ring-2 focus:ring-navy-500/30"
                      value={timePeriod || 'monthly'}
                      onChange={(e) => {
                        if (typeof setTimePeriod === 'function') {
                          setTimePeriod(e.target.value);
                        } else {
                          console.warn("setTimePeriod prop is missing in OverviewSection!");
                        }
                      }}
                    >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
                <RevenueTrendChart data={data} />
                <WalletBalanceChart wallets={data?.lists?.wallets || data?.wallets || []} />
                <div className="xl:col-span-2">
                  <StaffPerformanceChart staffData={data?.lists?.topStaff || []} />
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* RIGHT COLUMN: Recent Activity Side Menu */}
        <div className="w-full shrink-0 lg:w-[350px] xl:w-[400px]">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm lg:sticky lg:top-24"
          >
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 p-4 sm:p-5">
              <h3 className="flex items-center font-bold text-slate-900">
                <FiActivity className="mr-2 h-5 w-5 text-navy-700" />
                Recent Activity
              </h3>
              <button 
                onClick={() => setActiveSection('transactions')}
                className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-navy-700 transition-colors hover:bg-slate-50"
              >
                View All
              </button>
            </div>
            
            {/* Compact Feed */}
            <div className="space-y-4 p-4">
              {safeTransactions.slice(0, 8).map((tx, idx) => (
                <div key={idx} className="flex items-center justify-between gap-3 border-b border-slate-100 pb-4 last:border-0 last:pb-0">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className={`shrink-0 rounded-xl p-2.5 ${(tx.transactionType || tx.type) === 'credit' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                      {(tx.transactionType || tx.type) === 'credit' ? <FiArrowDownLeft className="h-4 w-4" /> : <FiArrowUpRight className="h-4 w-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="max-w-[150px] truncate text-sm font-bold text-slate-900">{tx.category}</p>
                      <p className="text-xs font-medium text-slate-500">
                        {tx.created_at ? new Date(tx.created_at).toLocaleDateString() : 'Just now'}
                        <span className={`ml-2 ${tx.status === 'Completed' ? 'text-emerald-600' : 'text-amber-500'}`}>
                          • {tx.status}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className={`text-sm font-extrabold ${(tx.transactionType || tx.type) === 'credit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {(tx.transactionType || tx.type) === 'credit' ? '+' : '-'}₹{Number(tx.amount).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}

              {safeTransactions.length === 0 && (
                <div className="py-8 text-center">
                  <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-full bg-slate-100">
                    <FiActivity className="h-5 w-5 text-slate-400" />
                  </div>
                  <p className="text-sm font-medium text-slate-500">No recent activity</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      </div>
    </>
  );
};

export default OverviewSection;