import React from 'react';
import { 
  FiTrendingUp, FiDollarSign, FiSmartphone, FiHome, 
  FiActivity, FiUserCheck, FiBarChart2, FiCalendar,
  FiPieChart, FiUserCheck as FiUserCheckIcon
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
    labels: data.months,
    datasets: [
      {
        label: 'Revenue',
        data: data.revenue,
        borderColor: 'rgb(16, 185, 129)',
        backgroundColor: 'rgba(16, 185, 129, 0.1)',
        tension: 0.4,
        fill: true,
      },
      {
        label: 'Expenses',
        data: data.expenses,
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
      legend: {
        position: 'top',
        labels: {
          boxWidth: 8,
          font: { size: 12 }
        }
      },
      title: {
        display: true,
        text: 'Revenue vs Expenses',
        font: { size: 14 }
      },
    },
    scales: {
      y: {
        beginAtZero: true,
        ticks: { font: { size: 12 } }
      },
      x: {
        ticks: { font: { size: 12 } }
      }
    },
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
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

// WalletBalanceChart Component
const WalletBalanceChart = ({ wallets }) => {
  const chartData = {
    labels: wallets.map(w => w.name),
    datasets: [
      {
        data: wallets.map(w => w.currentBalance),
        backgroundColor: [
          'rgba(34, 197, 94, 0.8)',
          'rgba(59, 130, 246, 0.8)',
          'rgba(245, 158, 11, 0.8)',
          'rgba(139, 92, 246, 0.8)',
          'rgba(14, 165, 233, 0.8)',
        ],
        borderColor: [
          'rgb(34, 197, 94)',
          'rgb(59, 130, 246)',
          'rgb(245, 158, 11)',
          'rgb(139, 92, 246)',
          'rgb(14, 165, 233)',
        ],
        borderWidth: 1,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'right',
        labels: {
          boxWidth: 8,
          padding: 10,
          font: { size: 12 }
        }
      },
      title: {
        display: true,
        text: 'Wallet Balance Distribution',
        font: { size: 14 }
      },
    },
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
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
  const chartData = {
    labels: staffData.map(s => s.name),
    datasets: [
      {
        label: 'Revenue Collected',
        data: staffData.map(s => s.revenueCollected),
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
      legend: {
        position: 'top',
        labels: { boxWidth: 8, font: { size: 12 } }
      },
      title: {
        display: true,
        text: 'Staff Performance',
        font: { size: 14 }
      },
    },
    scales: {
      x: {
        beginAtZero: true,
        ticks: { font: { size: 12 } }
      },
      y: {
        ticks: { font: { size: 12 } }
      }
    },
  };

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-6">
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
  return (
    <>
      {/* Stats Overview */}
      <div className="grid gap-3 mb-6 grid-cols-6">
        <StatCard
          title="Total Revenue"
          value={stats.totalRevenue}
          subtitle="YTD"
          change={stats.revenueChange}
          icon={FiTrendingUp}
          color="bg-gradient-to-br from-emerald-500 to-teal-600"
          onClick={() => setActiveSection('transactions')}
        />
        <StatCard
          title="Net Profit"
          value={stats.totalProfit}
          subtitle="YTD"
          change={stats.profitChange}
          icon={FiDollarSign}
          color="bg-gradient-to-br from-green-500 to-emerald-600"
          onClick={() => setActiveSection('transactions')}
        />
        <StatCard
          title="Wallet Balance"
          value={stats.totalWalletBalance}
          subtitle="Total"
          icon={FiSmartphone}
          color="bg-gradient-to-br from-indigo-500 to-purple-600"
          onClick={() => setActiveSection('wallets')}
        />
        <StatCard
          title="Cash in Hand"
          value={stats.totalCashInHand}
          subtitle="Physical"
          icon={FiHome}
          color="bg-gradient-to-br from-amber-500 to-orange-600"
          onClick={() => setActiveSection('wallets')}
        />
        <StatCard
          title="Today's Flow"
          value={stats.netCashFlowToday}
          subtitle={`In: ${stats.totalCashInToday}`}
          icon={FiActivity}
          color="bg-gradient-to-br from-purple-500 to-pink-600"
          onClick={() => setActiveSection('accounting')}
        />
        <StatCard
          title="Today's Profit"
          value={stats.todayProfit}
          subtitle={`Charge: ${stats.todayServiceCharge}`}
          icon={FiUserCheck}
          color="bg-gradient-to-br from-blue-500 to-cyan-600"
          onClick={() => setActiveSection('accounting')}
        />
      </div>

      {/* Charts Section */}
      {showCharts && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-6"
        >
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
          
          <div className="grid grid-cols-2 gap-4">
            <RevenueTrendChart data={data} />
            <WalletBalanceChart wallets={data.wallets} />
            <StaffPerformanceChart staffData={data.staffPerformance} />
          </div>
        </motion.div>
      )}
    </>
  );
};

export default OverviewSection;