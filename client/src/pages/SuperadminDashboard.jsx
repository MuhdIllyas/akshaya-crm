import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { BarChart, Bar, ScatterChart, Scatter, CartesianGrid, ZAxis, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

// ==========================================
// NEW: STAFF PERFORMANCE CHART COMPONENT (FIXED SCATTER PLOT)
// ==========================================
const StaffPerformanceChart = ({ staffData }) => {
  const [metric, setMetric] = useState('revenue'); 

  if (!staffData || staffData.length === 0) {
    return <div className="text-gray-500 text-sm p-4">No staff data available</div>;
  }

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  };

  // Tooltip for the Bar Charts
  const BarTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-900 text-white p-3 rounded-lg shadow-xl text-sm border border-gray-700 z-50">
          <p className="font-bold text-base mb-1">{data.name}</p>
          <p className="text-gray-300 text-xs mb-2">{data.centre}</p>
          <p className="text-blue-400 font-semibold">Revenue: {formatCurrency(data.revenue)}</p>
          <p className="text-purple-400 font-semibold">Services: {data.servicesCompleted}</p>
        </div>
      );
    }
    return null;
  };

  // Tooltip for the Scatter Plot
  const ScatterTooltip = ({ active, payload }) => {
    if (active && payload && payload.length) {
      const data = payload[0].payload;
      return (
        <div className="bg-gray-900 text-white p-3 rounded-lg shadow-xl text-sm border border-gray-700 z-50">
          <p className="font-bold text-base mb-1">{data.name}</p>
          <p className="text-gray-300 text-xs mb-2">{data.centre}</p>
          <p className="text-purple-400 font-semibold">Services: {data.servicesCompleted}</p>
          <p className="text-blue-400 font-semibold">Revenue: {formatCurrency(data.revenue)}</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200 flex flex-col h-[450px]">
      <div className="flex justify-between items-start mb-6">
        <div>
          <h2 className="text-lg font-semibold text-gray-700">👨‍💼 Top Staff Performers</h2>
          <p className="text-xs text-gray-500">Ranked across all centres</p>
        </div>
        <div className="flex flex-col gap-2">
          <div className="flex bg-gray-100 p-1 rounded-lg border border-gray-200">
            <button
              onClick={() => setMetric('revenue')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                metric === 'revenue' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Revenue
            </button>
            <button
              onClick={() => setMetric('servicesCompleted')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                metric === 'servicesCompleted' ? 'bg-white text-purple-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Applications
            </button>
            <button
              onClick={() => setMetric('scatter')}
              className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                metric === 'scatter' ? 'bg-white text-green-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'
              }`}
            >
              Efficiency
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          {metric === 'scatter' ? (
            // FIXED: Standard JSX rendering for the Scatter Chart
            <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis 
                type="number" 
                dataKey="servicesCompleted" 
                name="Applications" 
                tick={{ fontSize: 12 }} 
                label={{ value: 'Total Applications', position: 'insideBottom', offset: -10, fontSize: 12 }}
              />
              <YAxis 
                type="number" 
                dataKey="revenue" 
                name="Revenue" 
                tickFormatter={(val) => `₹${(val/1000)}k`} 
                tick={{ fontSize: 12 }}
              />
              <ZAxis type="number" dataKey="revenue" range={[100, 500]} name="Volume" />
              <Tooltip content={<ScatterTooltip />} cursor={{ strokeDasharray: '3 3' }} />
              <Scatter name="Staff" data={staffData} fill="#10B981" opacity={0.7} />
            </ScatterChart>
          ) : (
            <BarChart data={staffData} layout="vertical" margin={{ top: 5, right: 30, left: 40, bottom: 5 }}>
              <XAxis type="number" hide />
              <YAxis 
                dataKey="name" 
                type="category" 
                axisLine={false} 
                tickLine={false}
                tick={{ fontSize: 12, fill: '#4B5563' }}
                width={120}
              />
              <Tooltip content={<BarTooltip />} cursor={{ fill: '#F3F4F6' }} />
              <Bar dataKey={metric} radius={[0, 4, 4, 0]} barSize={20} animationDuration={1000}>
                {staffData.map((entry, index) => (
                  <Cell 
                    key={`cell-${index}`} 
                    fill={metric === 'revenue' ? '#3B82F6' : '#8B5CF6'} 
                    className="hover:opacity-80 transition-opacity duration-200 cursor-pointer"
                  />
                ))}
              </Bar>
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// ==========================================
// MAIN DASHBOARD COMPONENT
// ==========================================
const SuperadminDashboard = () => {
  const [loading, setLoading] = useState(false);
  const [dashboard, setDashboard] = useState(null);
  const [revenueView, setRevenueView] = useState("revenue");

  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
  };

  useEffect(() => {
    const fetchDashboard = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        if (!token) throw new Error("No token");

        const endDate = new Date();
        const startDate = new Date();
        startDate.setFullYear(startDate.getFullYear() - 1);
        const formatDate = (d) => d.toISOString().split('T')[0];

        const response = await axios.get(
          `${import.meta.env.VITE_API_URL}/api/analytics/superadmin/dashboard`,
          {
            params: {
              modules: "stats,financials,leaderboards,health,alerts,activity,customers,staff,teams,wallets,insights",
              timeframe: "custom",
              customStartDate: formatDate(startDate),
              customEndDate: formatDate(endDate)
            },
            headers: { Authorization: `Bearer ${token}` }
          }
        );

        setDashboard(response.data);
      } catch (err) {
        console.error("Error fetching dashboard:", err);
        toast.error("Failed to load dashboard data.", { position: "top-right" });
      } finally {
        setLoading(false);
      }
    };
    fetchDashboard();
  }, []);

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex items-center justify-center min-h-[400px]">
        <svg className="animate-spin h-8 w-8 text-navy-600 mr-2" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <span className="text-gray-600">Loading Superadmin Dashboard...</span>
      </div>
    );
  }

  const { executive = {}, finance = {}, operations = {}, leaderboards = {} } = dashboard || {};

  // --- Executive ---
  const { stats = {}, health = {}, alerts = [], insights = [] } = executive;

  // --- Finance ---
  const { financials = {}, wallets = {} } = finance;
  const chartData = financials.charts || {};
  const revenueChartData = chartData[revenueView] || [];

  // --- Operations ---
  const { customers = {}, staff = {}, teams = {}, activity = {} } = operations;

  // --- Leaderboards ---
  const { centres = {} } = leaderboards;
  const centreList = centres.fullList || [];
  const best = centres.best || {};
  const worst = centres.worst || {};

  // Direct access to pre‑computed fields
  const {
    totalCentres, totalStaff, totalCustomers, customerGrowth, revenueGrowthPercent,
    newCentresThisMonth, todayRevenue, todayServices, pendingServices, delayedServices,
    inProgressServices, admins, staffCount
  } = stats;

  const { revenue: monthlyRevenue, profit: netProfit } = financials.totals || {};
  const { cash: walletCash, bank: walletBank, digital: walletDigital, total: walletTotal } = wallets.summary || {};
  const { averageRating: avgRating, totalReviews } = customers.summary || {};

  const topStaffList = staff.topPerformers || [];
  const topTeamsList = teams.topTeams || [];
  const timeline = activity.timeline || [];
  const notifications = alerts;

  const activities = timeline.map(item => ({
    id: item.id || item.referenceId || `${item.type}-${item.createdAt}`,
    action: `${item.type}: ${item.title}`,
    time: new Date(item.createdAt).toLocaleString()
  }));

  // Revenue chart component
  const RevenueChart = () => {
    if (!revenueChartData || revenueChartData.length === 0) {
      return <div className="text-gray-500 text-sm">No data available</div>;
    }
    const max = Math.max(...revenueChartData.map(d => d.value), 1);

    const formatChartLabel = (label) => {
        if (!label) return '';
        if (label.length === 7) { 
            const date = new Date(label + '-01');
            return date.toLocaleString('default', { month: 'short', year: '2-digit' });
        }
        if (label.length === 10) {
            return label.slice(5); 
        }
        return label;
    };

    return (
      <div className="w-full h-72 flex items-end gap-1 overflow-x-auto pb-2 pt-12 scrollbar-thin scrollbar-thumb-gray-300">
        {revenueChartData.map((item, idx) => (
            <div key={item.label || idx} className="flex-1 min-w-[30px] flex flex-col justify-end items-center group relative h-full cursor-pointer">
              
              <div className="opacity-0 group-hover:opacity-100 absolute -top-12 bg-gray-900 text-white text-xs py-1.5 px-3 rounded pointer-events-none transition-opacity whitespace-nowrap z-50 shadow-lg flex flex-col items-center">
                <span className="font-bold">{formatCurrency(item.value)}</span>
                <span className="text-[10px] text-gray-300">{formatChartLabel(item.label)}</span>
                <div className="absolute -bottom-1 w-2 h-2 bg-gray-900 rotate-45"></div>
              </div>
              
              <div className="w-full flex-1 flex items-end justify-center">
                <div
                  className={`w-full rounded-t transition-all duration-300 ${
                    revenueView === 'profit' ? 'bg-green-500' :
                    revenueView === 'expenses' ? 'bg-red-500 hover:bg-red-600' :
                    'bg-blue-500 hover:bg-blue-600'
                  }`}
                  style={{ height: `${(item.value / max) * 100}%`, minHeight: '4px' }}
                ></div>
              </div>

              <span className="text-[10px] text-gray-500 mt-2 whitespace-nowrap">
                {formatChartLabel(item.label)}
              </span>
            </div>
        ))}
      </div>
    );
  };

  const MapView = () => {
    return (
      <div className="relative bg-gray-100 rounded-lg h-64 flex items-center justify-center">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          <path d="M50,50 L150,50 L180,120 L120,180 L40,160 Z" fill="#e2e8f0" stroke="#94a3b8" />
          {centreList.map((centre) => {
            const status = centre.healthStatus || { color: "gray" };
            const color = status.color === "green" ? "#22c55e" : status.color === "yellow" ? "#eab308" : "#ef4444";
            const x = 40 + (centre.id * 30) % 140;
            const y = 40 + (centre.id * 20) % 120;
            return (
              <circle key={centre.id} cx={x} cy={y} r="6" fill={color} stroke="white" strokeWidth="2" />
            );
          })}
        </svg>
        <div className="absolute bottom-2 left-2 text-xs text-gray-600">Kerala Map</div>
      </div>
    );
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-8">
      <h1 className="text-2xl font-bold text-gray-800">Superadmin Dashboard</h1>

      {/* Global KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 col-span-1">
          <div className="text-sm text-blue-800 font-medium">🌍 Total Centres</div>
          <div className="text-2xl font-bold text-blue-900">{totalCentres}</div>
          <div className="text-xs text-blue-600">+{newCentresThisMonth ?? 0} this month</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 col-span-1">
          <div className="text-sm text-purple-800 font-medium">👥 Total Staff</div>
          <div className="text-2xl font-bold text-purple-900">{totalStaff}</div>
          <div className="text-xs text-purple-600">{admins ?? 0} Admins, {staffCount ?? 0} Staff</div>
        </div>
        <div className="bg-green-50 p-4 rounded-xl border border-green-100 col-span-1">
          <div className="text-sm text-green-800 font-medium">👨‍👩‍👧 Total Customers</div>
          <div className="text-2xl font-bold text-green-900">{totalCustomers?.toLocaleString()}</div>
          <div className="text-xs text-green-600">+{customerGrowth ?? 0} this month</div>
        </div>
        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 col-span-1">
          <div className="text-sm text-indigo-800 font-medium">📑 Services Completed Today</div>
          <div className="text-2xl font-bold text-indigo-900">{todayServices ?? 0}</div>
          <div className="text-xs text-indigo-600">Across all centres</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 col-span-1">
          <div className="text-sm text-yellow-800 font-medium">💰 Today's Revenue</div>
          <div className="text-2xl font-bold text-yellow-900">{formatCurrency(todayRevenue)}</div>
        </div>
        <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 col-span-1">
          <div className="text-sm text-orange-800 font-medium">📈 Monthly Revenue</div>
          <div className="text-2xl font-bold text-orange-900">{formatCurrency(monthlyRevenue)}</div>
          <div className="text-xs text-orange-600">↑{revenueGrowthPercent ?? 0}%</div>
        </div>
        <div className="bg-red-50 p-4 rounded-xl border border-red-100 col-span-1">
          <div className="text-sm text-red-800 font-medium">💵 Net Profit</div>
          <div className="text-2xl font-bold text-red-900">{formatCurrency(netProfit)}</div>
        </div>
        <div className="bg-pink-50 p-4 rounded-xl border border-pink-100 col-span-1">
          <div className="text-sm text-pink-800 font-medium">💳 Pending Payments</div>
          <div className="text-2xl font-bold text-pink-900">{formatCurrency(health?.metrics?.pendingPaymentValue)}</div>
          <div className="text-xs text-pink-600">{health?.metrics?.pendingCustomers ?? 0} Customers</div>
        </div>
      </div>

      {/* Revenue Analytics + Centre Performance */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white p-4 rounded-xl shadow-md border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-700">Revenue Analytics</h2>
            <div className="flex space-x-2">
              <button
                onClick={() => setRevenueView("revenue")}
                className={`px-3 py-1 text-sm rounded-full ${revenueView === "revenue" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"}`}
              >
                Revenue
              </button>
              <button
                onClick={() => setRevenueView("profit")}
                className={`px-3 py-1 text-sm rounded-full ${revenueView === "profit" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"}`}
              >
                Profit
              </button>
              <button
                onClick={() => setRevenueView("expenses")}
                className={`px-3 py-1 text-sm rounded-full ${revenueView === "expenses" ? "bg-blue-600 text-white" : "bg-gray-200 text-gray-700"}`}
              >
                Expenses
              </button>
            </div>
          </div>
          <RevenueChart />
        </div>

        <div className="bg-white p-4 rounded-xl shadow-md border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">Centre Performance Leaderboard</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rank</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Centre</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Profit</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {centreList.slice(0, 5).map((centre, idx) => (
                  <tr key={centre.id} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx+1}`}
                    </td>
                    <td className="px-3 py-2 font-medium">{centre.name}</td>
                    <td className="px-3 py-2">{formatCurrency(centre.profit)}</td>
                    <td className="px-3 py-2">{centre.rating || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Centre Health */}
      <div className="bg-white p-4 rounded-xl shadow-md border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">🏥 Centre Health</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {centreList.map((centre) => {
            const status = centre.healthStatus || { label: "Unknown", icon: "❓", color: "gray" };
            return (
              <div key={centre.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border border-gray-100">
                <div>
                  <div className="font-medium">{centre.name}</div>
                  <div className="text-sm mt-1">{status.icon} <span className="font-medium text-gray-700">{status.label}</span></div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold text-gray-800">{centre.rating || 0}</div>
                  <div className="text-xs text-gray-500">Rating</div>
                </div>
              </div>
            );
          })}
        </div>
        {health?.overallScore !== undefined && (
          <div className="mt-4 text-sm text-gray-600 border-t pt-3">
            Overall Network Health Score: <span className="font-bold text-lg text-gray-800 ml-2">{health.overallScore}/100</span>
          </div>
        )}
      </div>

      {/* Live Operations */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {pendingServices !== undefined && (
          <div className="bg-red-50 p-4 rounded-xl border border-red-100">
            <div className="text-sm text-red-800 font-medium">🕒 Pending Services</div>
            <div className="text-2xl font-bold text-red-900">{pendingServices}</div>
          </div>
        )}
        {todayServices !== undefined && (
          <div className="bg-green-50 p-4 rounded-xl border border-green-100">
            <div className="text-sm text-green-800 font-medium">✅ Completed Today</div>
            <div className="text-2xl font-bold text-green-900">{todayServices}</div>
          </div>
        )}
        {delayedServices !== undefined && (
          <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
            <div className="text-sm text-orange-800 font-medium">⏳ Delayed Services</div>
            <div className="text-2xl font-bold text-orange-900">{delayedServices}</div>
          </div>
        )}
        {inProgressServices !== undefined && (
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
            <div className="text-sm text-blue-800 font-medium">📋 Applications in Progress</div>
            <div className="text-2xl font-bold text-blue-900">{inProgressServices}</div>
          </div>
        )}
      </div>

      {/* Financial Health */}
      <div className="bg-white p-4 rounded-xl shadow-md border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">💰 Financial Health</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
            <div className="text-sm text-gray-600 mb-1">Cash Wallet</div>
            <div className="text-xl font-bold text-gray-800">{formatCurrency(walletCash)}</div>
          </div>
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
            <div className="text-sm text-gray-600 mb-1">Bank</div>
            <div className="text-xl font-bold text-gray-800">{formatCurrency(walletBank)}</div>
          </div>
          <div className="bg-gray-50 p-4 rounded-xl border border-gray-100">
            <div className="text-sm text-gray-600 mb-1">Digital</div>
            <div className="text-xl font-bold text-gray-800">{formatCurrency(walletDigital)}</div>
          </div>
          <div className="bg-blue-50 p-4 rounded-xl border border-blue-200">
            <div className="text-sm text-blue-800 font-semibold mb-1">Total Wallets</div>
            <div className="text-2xl font-bold text-blue-900">{formatCurrency(walletTotal)}</div>
          </div>
        </div>
      </div>

      {/* Best & Worst Centres */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded-xl shadow-md border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">🏆 Best Performing Centres</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 p-4 rounded-xl border border-green-100">
              <div className="text-xs text-green-700 font-medium mb-1">Best Revenue</div>
              <div className="font-bold text-gray-800 truncate">{best.revenue?.name || "N/A"}</div>
              <div className="text-lg text-green-700">{formatCurrency(best.revenue?.value)}</div>
            </div>
            <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
              <div className="text-xs text-blue-700 font-medium mb-1">Best Profit</div>
              <div className="font-bold text-gray-800 truncate">{best.profit?.name || "N/A"}</div>
              <div className="text-lg text-blue-700">{formatCurrency(best.profit?.value)}</div>
            </div>
            <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 col-span-2">
              <div className="text-xs text-yellow-700 font-medium mb-1">Best Rating</div>
              <div className="flex justify-between items-end">
                <div className="font-bold text-gray-800">{best.rating?.name || "N/A"}</div>
                <div className="text-lg text-yellow-700 font-bold">{best.rating?.value || 0} ⭐</div>
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-md border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">⚠️ Worst Performing Centres</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-red-50 p-4 rounded-xl border border-red-100">
              <div className="text-xs text-red-700 font-medium mb-1">Lowest Profit</div>
              <div className="font-bold text-gray-800 truncate">{worst.revenue?.name || "N/A"}</div>
              <div className="text-lg text-red-700">{formatCurrency(worst.revenue?.value)}</div>
            </div>
            <div className="bg-red-50 p-4 rounded-xl border border-red-100">
              <div className="text-xs text-red-700 font-medium mb-1">Highest Pending</div>
              <div className="font-bold text-gray-800 truncate">{worst.pending?.name || "N/A"}</div>
              <div className="text-lg text-red-700">{worst.pending?.value ? formatCurrency(worst.pending.value) : "N/A"}</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
              <div className="text-xs text-orange-700 font-medium mb-1">Most Delayed</div>
              <div className="font-bold text-gray-800 truncate">{worst.delayed?.name || "N/A"}</div>
              <div className="text-lg text-orange-700">{worst.delayed?.value ?? "N/A"}</div>
            </div>
            <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
              <div className="text-xs text-orange-700 font-medium mb-1">Most Complaints</div>
              <div className="font-bold text-gray-800 truncate">{worst.complaints?.name || "N/A"}</div>
              <div className="text-lg text-orange-700">{worst.complaints?.value ?? "N/A"}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Top Staff & Teams */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* NEW INTERACTIVE RECHARTS COMPONENT */}
        <StaffPerformanceChart staffData={topStaffList} />

        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-700 mb-6">👥 Top Teams</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Team</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Revenue</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Profit</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Expenses</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {topTeamsList.map((team, idx) => (
                  <tr key={team.id || idx} className="hover:bg-gray-50 transition-colors">
                    <td className="px-3 py-4 whitespace-nowrap font-medium text-gray-900">{team.name}</td>
                    <td className="px-3 py-4 whitespace-nowrap text-gray-600">{formatCurrency(team.revenue)}</td>
                    <td className="px-3 py-4 whitespace-nowrap text-green-600 font-medium">{formatCurrency(team.profit || 0)}</td>
                    <td className="px-3 py-4 whitespace-nowrap text-red-600">{formatCurrency(team.expenses || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Notifications */}
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
            <span className="mr-2">🔔</span> Action Required
          </h2>
          <div className="space-y-3 max-h-80 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300">
            {notifications.length > 0 ? (
              notifications.map((notif) => (
                <div key={notif.id} className={`p-4 rounded-lg flex items-start border-l-4 shadow-sm ${
                  notif.priority === "critical" ? "bg-red-50 border-red-500" : 
                  notif.priority === "warning" ? "bg-yellow-50 border-yellow-500" : "bg-blue-50 border-blue-500"
                }`}>
                  <div className="flex-1">
                    <div className="font-semibold text-gray-800 text-sm mb-1">{notif.title}</div>
                    <div className="text-gray-600 text-sm">{notif.message}</div>
                  </div>
                </div>
              ))
            ) : (
              <div className="text-gray-500 text-sm italic p-4 text-center bg-gray-50 rounded-lg">All caught up! No pending notifications.</div>
            )}
          </div>
        </div>

        {/* Recent Activities */}
        <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center">
            <span className="mr-2">🕒</span> Live Activity Feed
          </h2>
          <div className="space-y-4 max-h-80 overflow-y-auto pr-2 scrollbar-thin scrollbar-thumb-gray-300">
            {activities.length > 0 ? (
              activities.map((activity) => (
                <div key={activity.id} className="flex flex-col border-b border-gray-100 pb-3 last:border-0">
                  <span className="text-sm font-medium text-gray-800">{activity.action}</span>
                  <span className="text-xs text-gray-500 mt-1">{activity.time}</span>
                </div>
              ))
            ) : (
              <div className="text-gray-500 text-sm italic p-4 text-center bg-gray-50 rounded-lg">No recent activities found.</div>
            )}
          </div>
        </div>
      </div>

      {/* Map View */}
      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">🗺️ Centre Network Map</h2>
        <MapView />
      </div>

      {/* Quick Actions */}
      <div className="bg-white p-6 rounded-xl shadow-md border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">⚡ Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition shadow-sm">+ Create Centre</button>
          <button className="px-4 py-2 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 transition shadow-sm">+ Create Admin</button>
          <button className="px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 transition shadow-sm">📢 Broadcast</button>
          <button className="px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition shadow-sm">📊 Global Report</button>
          <button className="px-4 py-2 bg-gray-800 text-white text-sm font-medium rounded-lg hover:bg-gray-900 transition shadow-sm">📤 Export Data</button>
        </div>
      </div>

    </div>
  );
};

export default SuperadminDashboard;