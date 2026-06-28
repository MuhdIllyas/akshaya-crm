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

// StatCard Component
const StatCard = ({ title, value, icon: Icon, color, change, subtitle, onClick }) => (
  <motion.div
    whileHover={{ y: -2 }}
    className="bg-white rounded-xl border border-gray-200 hover:shadow-lg transition-all duration-300 cursor-pointer p-6"
    onClick={onClick}
  >
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium text-gray-600 mb-1 text-sm">{title}</p>
        <p className="font-bold text-gray-900 mb-1 text-2xl">{value}</p>
        {change !== undefined && (
          <p className={`font-medium ${change >= 0 ? 'text-emerald-600' : 'text-rose-600'} text-sm`}>
            {change >= 0 ? `↑ ${change}%` : `↓ ${Math.abs(change)}%`}
            <span className="text-gray-500 ml-2">{subtitle}</span>
          </p>
        )}
        {change === undefined && <p className="text-gray-500 text-sm">{subtitle}</p>}
      </div>
      <div className={`rounded-xl ${color} p-3`}>
        <Icon className="text-white h-6 w-6" />
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
      legend: { position: 'top', labels: { boxWidth: 8, font: { size: 12 } } },
      title: { display: true, text: 'Revenue vs Expenses', font: { size: 14 } },
    },
    scales: {
      y: { beginAtZero: true, ticks: { font: { size: 12 } } },
      x: { ticks: { font: { size: 12 } } }
    },
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Financial Trends</h3>
        <FiTrendingUp className="text-indigo-600 h-5 w-5" />
      </div>
      <div className="h-64">
        <Line data={chartData} options={options} />
      </div>
    </div>
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
      legend: { position: 'right', labels: { boxWidth: 8, padding: 10, font: { size: 12 } } },
      title: { display: true, text: 'Wallet Balance Distribution', font: { size: 14 } },
    },
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Wallet Balances</h3>
        <FiPieChart className="text-indigo-600 h-5 w-5" />
      </div>
      <div className="h-64">
        <Doughnut data={chartData} options={options} />
      </div>
    </div>
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
        backgroundColor: 'rgba(99, 102, 241, 0.8)',
        borderColor: 'rgb(99, 102, 241)',
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    indexAxis: 'y',
    plugins: {
      legend: { position: 'top', labels: { boxWidth: 8, font: { size: 12 } } },
      title: { display: true, text: 'Staff Performance', font: { size: 14 } },
    },
    scales: {
      x: { beginAtZero: true, ticks: { font: { size: 12 } } },
      y: { ticks: { font: { size: 12 } } }
    },
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6 h-full">
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Staff Performance</h3>
        <FiUserCheckIcon className="text-indigo-600 h-5 w-5" />
      </div>
      <div className="h-64">
        <Bar data={chartData} options={options} />
      </div>
    </div>
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
      {/* 🌟 NEW: Quick Actions Row */}
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6 gap-4">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Dashboard Overview</h2>
          <p className="text-gray-500 text-sm">Here is what's happening at your centre today.</p>
        </div>
        
        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setActiveSection('accounting')}
            className="flex items-center px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg font-medium text-sm hover:bg-indigo-100 transition-colors"
          >
            <FiPlus className="mr-2 h-4 w-4" /> Add Income
          </button>
          <button 
            onClick={() => setActiveSection('accounting')}
            className="flex items-center px-4 py-2 bg-rose-50 text-rose-700 rounded-lg font-medium text-sm hover:bg-rose-100 transition-colors"
          >
            <FiMinus className="mr-2 h-4 w-4" /> Record Expense
          </button>
        </div>
      </div>

      {/* 🌟 NEW: Smart Alerts Banner */}
      {(pendingCount > 0 || cashAmount > 50000) && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6"
        >
          {/* Pending Payments Alert */}
          {pendingCount > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-start">
              <div className="bg-amber-100 p-2 rounded-lg mr-3">
                <FiAlertCircle className="h-5 w-5 text-amber-600" />
              </div>
              <div>
                <h4 className="font-bold text-amber-900 text-sm">Action Required: Pending Payments</h4>
                <p className="text-amber-700 text-xs mt-1">You have {stats.pendingTransactions} transaction(s) waiting for collection.</p>
                <button 
                  onClick={() => setActiveSection('pendingPayments')}
                  className="text-amber-700 text-xs font-bold mt-2 hover:underline"
                >
                  Review Pending Payments →
                </button>
              </div>
            </div>
          )}

          {/* High Cash Warning Alert */}
          {cashAmount > 50000 && (
            <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start">
              <div className="bg-blue-100 p-2 rounded-lg mr-3">
                <FiShield className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h4 className="font-bold text-blue-900 text-sm">Security Recommendation</h4>
                <p className="text-blue-700 text-xs mt-1">Your cash in hand is high ({stats.totalCashInHand}). Consider a bank deposit.</p>
                <button 
                  onClick={() => setActiveSection('wallets')}
                  className="text-blue-700 text-xs font-bold mt-2 hover:underline"
                >
                  Manage Wallets →
                </button>
              </div>
            </div>
          )}
        </motion.div>
      )}

      {/* Stats Overview */}
      <div className="grid gap-3 mb-6 grid-cols-2 md:grid-cols-3 xl:grid-cols-6">
        <StatCard title="Total Revenue" value={stats.totalRevenue} subtitle="YTD" change={stats.revenueChange} icon={FiTrendingUp} color="bg-gradient-to-br from-emerald-500 to-teal-600" onClick={() => setActiveSection('transactions')} />
        <StatCard title="Net Profit" value={stats.totalProfit} subtitle="YTD" change={stats.profitChange} icon={FiDollarSign} color="bg-gradient-to-br from-green-500 to-emerald-600" onClick={() => setActiveSection('transactions')} />
        <StatCard title="Wallet Balance" value={stats.totalWalletBalance} subtitle="Total" icon={FiSmartphone} color="bg-gradient-to-br from-indigo-500 to-purple-600" onClick={() => setActiveSection('wallets')} />
        <StatCard title="Cash in Hand" value={stats.totalCashInHand} subtitle="Physical" icon={FiHome} color="bg-gradient-to-br from-amber-500 to-orange-600" onClick={() => setActiveSection('wallets')} />
        <StatCard title="Today's Flow" value={stats.netCashFlowToday} subtitle={`In: ${stats.totalCashInToday}`} icon={FiActivity} color="bg-gradient-to-br from-purple-500 to-pink-600" onClick={() => setActiveSection('accounting')} />
        <StatCard title="Today's Profit" value={stats.todayProfit} subtitle={`Charge: ${stats.todayServiceCharge}`} icon={FiUserCheck} color="bg-gradient-to-br from-blue-500 to-cyan-600" onClick={() => setActiveSection('accounting')} />
      </div>

      {/* Main Content Area: Charts (Left) + Recent Activity Sidebar (Right) */}
      <div className="flex flex-col lg:flex-row gap-6">
        
        {/* LEFT COLUMN: Charts Area */}
        <div className="flex-1 min-w-0">
          {showCharts && (
            <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-gray-900 flex items-center">
                  <FiBarChart2 className="h-5 w-5 mr-2 text-indigo-600" />
                  Analytics Dashboard
                </h2>
                <div className="flex items-center space-x-2">
                  <FiCalendar className="h-4 w-4 text-gray-500" />
                  <select
                    className="border border-gray-300 rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-indigo-500 text-sm"
                    value={timePeriod}
                    onChange={(e) => setTimePeriod(e.target.value)}
                  >
                    <option value="monthly">Monthly</option>
                    <option value="quarterly">Quarterly</option>
                    <option value="yearly">Yearly</option>
                  </select>
                </div>
              </div>
              
              <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
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
        <div className="w-full lg:w-87.5 xl:w-100 shrink-0">
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="bg-white rounded-xl border border-gray-200 overflow-hidden sticky top-24"
          >
            <div className="flex items-center justify-between p-5 border-b border-gray-100 bg-gray-50/50">
              <h3 className="font-bold text-gray-900 flex items-center">
                <FiActivity className="h-5 w-5 mr-2 text-indigo-600" />
                Recent Activity
              </h3>
              <button 
                onClick={() => setActiveSection('transactions')}
                className="text-xs font-semibold text-indigo-600 hover:text-indigo-700 bg-indigo-50 px-3 py-1.5 rounded-lg transition-colors"
              >
                View All
              </button>
            </div>
            
            {/* Redesigned Compact Feed */}
            <div className="p-4 space-y-4">
              {safeTransactions.slice(0, 8).map((tx, idx) => (
                <div key={idx} className="flex items-center justify-between pb-4 border-b border-gray-50 last:border-0 last:pb-0">
                  <div className="flex items-center space-x-3">
                    <div className={`p-2.5 rounded-xl ${tx.type === 'credit' ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'}`}>
                      {tx.type === 'credit' ? <FiArrowDownLeft className="h-4 w-4" /> : <FiArrowUpRight className="h-4 w-4" />}
                    </div>
                    <div>
                      <p className="text-sm font-bold text-gray-900 truncate max-w-37.5">{tx.category}</p>
                      <p className="text-xs text-gray-500 font-medium">
                        {new Date(tx.date).toLocaleDateString()}
                        <span className={`ml-2 ${tx.status === 'Completed' ? 'text-emerald-600' : 'text-amber-500'}`}>
                          • {tx.status}
                        </span>
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className={`text-sm font-black ${tx.type === 'credit' ? 'text-emerald-600' : 'text-rose-600'}`}>
                      {tx.type === 'credit' ? '+' : '-'}₹{Number(tx.amount).toLocaleString()}
                    </p>
                  </div>
                </div>
              ))}

              {safeTransactions.length === 0 && (
                <div className="py-8 text-center">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
                    <FiActivity className="h-5 w-5 text-gray-400" />
                  </div>
                  <p className="text-sm text-gray-500 font-medium">No recent activity</p>
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
