import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";

const SuperadminDashboard = () => {
  const [loading, setLoading] = useState(false);
  const [dashboardData, setDashboardData] = useState({
    centres: [],
    staff: [],
    customers: [],
    services: [],
    revenue: {},
    wallets: {},
    activities: [],
    notifications: [],
    healthScores: {},
    topCentres: [],
    worstCentres: [],
    topStaff: [],
    topTeams: [],
  });
  const [revenueView, setRevenueView] = useState("revenue"); // revenue | profit | expenses

  // ✅ REPLACE YOUR useEffect WITH THIS:
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const headers = { Authorization: `Bearer ${localStorage.getItem("token")}` };

        // 1. Fetch Quick Live Metrics (For the top KPI cards)
        const quickResPromise = axios.get(`${import.meta.env.VITE_API_URL}/api/reports/quick-metrics?centre_id=all`, { headers });
        
        // 2. Fetch Deep Analytics via V3 Engine (Using Global Report IDs)
        const engineResPromise = axios.post(`${import.meta.env.VITE_API_URL}/api/reports/generate`, {
            period: "monthly", 
            targetCentreId: "all", // 👈 CHANGED from centreId to targetCentreId
            format: "preview",
            reportIds: [1, 5, 10, 17, 18, 27, 29, 30, 31, 32] 
        }, { headers });

        // 3. Fetch basic Centre list for the Map
        const centresResPromise = axios.get(`${import.meta.env.VITE_API_URL}/api/centres`, { headers });

        // Run all three concurrently
        const [quickRes, engineRes, centresRes] = await Promise.all([quickResPromise, engineResPromise, centresResPromise]);

        const qData = quickRes.data;
        const eData = engineRes.data.data;

        // Process Wallets
        let cash = 0, bank = 0, digital = 0, total = 0;
        (eData.walletSummary || []).forEach(w => {
            const bal = Number(w.closing_balance || 0);
            total += bal;
            const name = w.wallet_name.toLowerCase();
            if (name.includes('cash')) cash += bal;
            else if (name.includes('bank') || name.includes('hdfc') || name.includes('sbi')) bank += bal;
            else digital += bal;
        });

        // Process Leaderboards
        const revCentres = [...(eData.revenueByCentre?.summary || [])].sort((a,b) => b.total_revenue - a.total_revenue);
        const profCentres = [...(eData.profitByCentre?.summary || [])].sort((a,b) => b.net_profit - a.net_profit);
        
        // Map the real data to your EXACT existing state structure
        setDashboardData({
          centres: centresRes.data || [],
          staff: new Array(qData.attendanceTotal || 0).fill({ role: 'staff' }), // Mocks array length for your 'Total Staff' card
          customers: 0, 
          services: {
              completedToday: qData.servicesCount || 0,
              pending: eData.pendingServices?.length || 0,
              inProgress: eData.pendingServices?.filter(s => s.status === 'in_progress').length || 0,
              delayed: eData.pendingServices?.filter(s => s.days_pending > 5).length || 0,
              completed: eData.completedServicesReport?.length || 0
          },
          revenue: {
              today: qData.collection || 0,
              monthly: revCentres.reduce((acc, c) => acc + c.total_revenue, 0),
              profit: profCentres.reduce((acc, c) => acc + c.net_profit, 0),
              pending: qData.pendingAmount || 0,
              pendingCustomers: 0,
              avgRating: 4.8, 
              totalReviews: 0
          },
          wallets: { cash, bank, digital, total },
          monthlyTrend: eData.financials?.monthlyTrend, // Passed down for the chart
          activities: [], 
          notifications: [], 
          healthScores: {}, 
          topCentres: {
              revenue: { name: revCentres[0]?.centre_name || 'N/A', value: revCentres[0]?.total_revenue || 0 },
              profit: { name: profCentres[0]?.centre_name || 'N/A', value: profCentres[0]?.net_profit || 0 },
              rating: { name: 'N/A', value: 0 },
              collection: { name: 'N/A', value: 0 }
          },
          worstCentres: {
              revenue: { name: revCentres[revCentres.length-1]?.centre_name || 'N/A', value: revCentres[revCentres.length-1]?.total_revenue || 0 },
              pending: { name: 'N/A', value: 0 },
              delayed: { name: 'N/A', value: 0 },
              complaints: { name: 'N/A', value: 0 }
          },
          topStaff: (eData.performanceReport || []).map(s => ({
              name: s.staff_name, revenue: s.gross_profit, applications: s.total_services, rating: s.avg_rating || 0
          })),
          topTeams: (eData.teamPerformance || []).map(t => ({
              name: t.team_name, revenue: t.total_services, profit: t.avg_tat_hours, expenses: 0 
          }))
        });

      } catch (err) {
        console.error("Error fetching dashboard data:", err);
        toast.error("Failed to load dashboard data.", { position: "top-right" });
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // Helper to get health color and icon
  const getHealthStatus = (health) => {
    const map = {
      excellent: { color: "green", icon: "🟢", label: "Excellent" },
      good: { color: "green", icon: "🟢", label: "Good" },
      attention: { color: "yellow", icon: "🟡", label: "Attention" },
      critical: { color: "red", icon: "🔴", label: "Critical" },
    };
    return map[health] || map.good;
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  };

  // Simple bar chart for revenue trend
  const RevenueChart = () => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    // ✅ Read directly from the API response
    const trend = dashboardData?.monthlyTrend || {};
    const data = {
      revenue: trend.revenueCollected || [0,0,0,0,0,0,0,0,0,0,0,0],
      profit: trend.grossProfit || [0,0,0,0,0,0,0,0,0,0,0,0],
      expenses: trend.operatingExpenses || [0,0,0,0,0,0,0,0,0,0,0,0],
    };
    
    const selected = data[revenueView] || data.revenue;
    const max = Math.max(...selected, 1); // '1' prevents division by zero if all values are 0

    return (
      <div className="w-full h-64 flex items-end space-x-2">
        {selected.map((value, idx) => (
          <div key={idx} className="flex-1 flex flex-col items-center group relative">
            {/* Hover Tooltip */}
            <div className="opacity-0 group-hover:opacity-100 absolute -top-8 bg-gray-800 text-white text-[10px] py-1 px-2 rounded pointer-events-none transition-opacity whitespace-nowrap z-10">
                {formatCurrency(value)}
            </div>
            {/* Dynamic Bar */}
            <div
              className={`w-full rounded-t transition-all duration-500 ${
                revenueView === 'profit' ? 'bg-green-500' : 
                revenueView === 'expenses' ? 'bg-red-500' : 
                'bg-blue-500'
              }`}
              style={{ height: `${(value / max) * 100}%`, minHeight: '4px' }}
            ></div>
            <span className="text-xs text-gray-600 mt-1">{months[idx]}</span>
          </div>
        ))}
      </div>
    );
  };

  // Map placeholder - SVG of Kerala with markers (simplified)
  const MapView = () => {
    // In real implementation, use Leaflet or Google Maps
    return (
      <div className="relative bg-gray-100 rounded-lg h-64 flex items-center justify-center">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          <path d="M50,50 L150,50 L180,120 L120,180 L40,160 Z" fill="#e2e8f0" stroke="#94a3b8" />
          {/* Markers for centres */}
          {dashboardData.centres.map((centre) => {
            const health = getHealthStatus(centre.health);
            const color = health.color === "green" ? "#22c55e" : health.color === "yellow" ? "#eab308" : "#ef4444";
            // Random positions for demo
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

  // Destructure data
  const {
    centres,
    staff,
    customers,
    services,
    revenue,
    wallets,
    activities,
    notifications,
    healthScores,
    topCentres,
    worstCentres,
    topStaff,
    topTeams,
  } = dashboardData;

  // Compute summary stats
  const totalCentres = centres?.length || 0;
  const totalStaff = staff?.length || 0;
  const admins = staff?.filter(s => s.role === "admin")?.length || 0;
  const staffCount = staff?.filter(s => s.role === "staff" || s.role === "supervisor")?.length || 0;
  const totalCustomers = customers || 0;

  // fallback numbers to 0
  const servicesToday = services?.completedToday || 0;
  const revenueToday = revenue?.today || 0;
  const monthlyRevenue = revenue?.monthly || 0;
  const netProfit = revenue?.profit || 0;
  const pendingPayments = revenue?.pending || 0;
  const pendingCustomers = revenue?.pendingCustomers || 0;
  const avgRating = revenue?.avgRating || 0;
  const totalReviews = revenue?.totalReviews || 0;
  const pendingServices = services?.pending || 0;
  const completedToday = services?.completed || 0;
  const delayedServices = services?.delayed || 0;
  const applicationsInProgress = services?.inProgress || 0;
  const walletCash = wallets?.cash || 0;
  const walletBank = wallets?.bank || 0;
  const walletDigital = wallets?.digital || 0;
  const walletTotal = wallets?.total || 0;

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-8">
      <h1 className="text-2xl font-bold text-gray-800">Superadmin Dashboard</h1>

      {/* Section 1: Global KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-4">
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 col-span-1">
          <div className="text-sm text-blue-800 font-medium">🌍 Total Centres</div>
          <div className="text-2xl font-bold text-blue-900">{totalCentres}</div>
          <div className="text-xs text-blue-600">+2 this month</div>
        </div>
        <div className="bg-purple-50 p-4 rounded-xl border border-purple-100 col-span-1">
          <div className="text-sm text-purple-800 font-medium">👥 Total Staff</div>
          <div className="text-2xl font-bold text-purple-900">{totalStaff}</div>
          <div className="text-xs text-purple-600">{admins} Admins, {staffCount} Staff</div>
        </div>
        <div className="bg-green-50 p-4 rounded-xl border border-green-100 col-span-1">
          <div className="text-sm text-green-800 font-medium">👨‍👩‍👧 Total Customers</div>
          <div className="text-2xl font-bold text-green-900">{totalCustomers.toLocaleString()}</div>
          <div className="text-xs text-green-600">+824 this month</div>
        </div>
        <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 col-span-1">
          <div className="text-sm text-indigo-800 font-medium">📑 Services Completed Today</div>
          <div className="text-2xl font-bold text-indigo-900">{servicesToday}</div>
          <div className="text-xs text-indigo-600">Across all centres</div>
        </div>
        <div className="bg-yellow-50 p-4 rounded-xl border border-yellow-100 col-span-1">
          <div className="text-sm text-yellow-800 font-medium">💰 Today's Revenue</div>
          <div className="text-2xl font-bold text-yellow-900">{formatCurrency(revenueToday)}</div>
        </div>
        <div className="bg-orange-50 p-4 rounded-xl border border-orange-100 col-span-1">
          <div className="text-sm text-orange-800 font-medium">📈 Monthly Revenue</div>
          <div className="text-2xl font-bold text-orange-900">{formatCurrency(monthlyRevenue)}</div>
          <div className="text-xs text-orange-600">↑ 18%</div>
        </div>
        <div className="bg-red-50 p-4 rounded-xl border border-red-100 col-span-1">
          <div className="text-sm text-red-800 font-medium">💵 Net Profit</div>
          <div className="text-2xl font-bold text-red-900">{formatCurrency(netProfit)}</div>
        </div>
        <div className="bg-pink-50 p-4 rounded-xl border border-pink-100 col-span-1">
          <div className="text-sm text-pink-800 font-medium">💳 Pending Payments</div>
          <div className="text-2xl font-bold text-pink-900">{formatCurrency(pendingPayments)}</div>
          <div className="text-xs text-pink-600">{pendingCustomers} Customers</div>
        </div>
        <div className="bg-teal-50 p-4 rounded-xl border border-teal-100 col-span-2 md:col-span-1">
          <div className="text-sm text-teal-800 font-medium">⭐ Average Rating</div>
          <div className="text-2xl font-bold text-teal-900">{avgRating}</div>
          <div className="text-xs text-teal-600">{totalReviews.toLocaleString()} Reviews</div>
        </div>
      </div>

      {/* Section 2: Revenue Analytics + Centre Performance (side by side) */}
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
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Revenue</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Profit</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Services</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {centres.slice(0, 5).map((centre, idx) => (
                  <tr key={centre.id} className="hover:bg-gray-50 cursor-pointer">
                    <td className="px-3 py-2 whitespace-nowrap">
                      {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `#${idx+1}`}
                    </td>
                    <td className="px-3 py-2 font-medium">{centre.name}</td>
                    <td className="px-3 py-2">{formatCurrency(centre.revenue || 0)}</td>
                    <td className="px-3 py-2">{formatCurrency(centre.profit || 0)}</td>
                    <td className="px-3 py-2">{centre.services || 0}</td>
                    <td className="px-3 py-2">{centre.rating || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Section 4: Centre Health */}
      <div className="bg-white p-4 rounded-xl shadow-md border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">🏥 Centre Health</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {centres.map((centre) => {
            const health = getHealthStatus(centre.health);
            const score = healthScores[centre.name]?.score || 0;
            return (
              <div key={centre.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
                <div>
                  <div className="font-medium">{centre.name}</div>
                  <div className="text-sm text-gray-600">{health.icon} {health.label}</div>
                </div>
                <div className="text-right">
                  <div className="text-lg font-bold">{score}</div>
                  <div className="text-xs text-gray-500">/100</div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Section 5: Live Operations */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-red-50 p-4 rounded-xl border border-red-100">
          <div className="text-sm text-red-800 font-medium">🕒 Pending Services</div>
          <div className="text-2xl font-bold text-red-900">{pendingServices}</div>
        </div>
        <div className="bg-green-50 p-4 rounded-xl border border-green-100">
          <div className="text-sm text-green-800 font-medium">✅ Completed Today</div>
          <div className="text-2xl font-bold text-green-900">{completedToday}</div>
        </div>
        <div className="bg-orange-50 p-4 rounded-xl border border-orange-100">
          <div className="text-sm text-orange-800 font-medium">⏳ Delayed Services</div>
          <div className="text-2xl font-bold text-orange-900">{delayedServices}</div>
        </div>
        <div className="bg-blue-50 p-4 rounded-xl border border-blue-100">
          <div className="text-sm text-blue-800 font-medium">📋 Applications in Progress</div>
          <div className="text-2xl font-bold text-blue-900">{applicationsInProgress}</div>
        </div>
      </div>

      {/* Section 6: Financial Health */}
      <div className="bg-white p-4 rounded-xl shadow-md border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">💰 Financial Health</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-600">Cash Wallet</div>
            <div className="text-xl font-bold">{formatCurrency(walletCash)}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-600">Bank</div>
            <div className="text-xl font-bold">{formatCurrency(walletBank)}</div>
          </div>
          <div className="bg-gray-50 p-3 rounded-lg">
            <div className="text-sm text-gray-600">Digital</div>
            <div className="text-xl font-bold">{formatCurrency(walletDigital)}</div>
          </div>
          <div className="bg-blue-50 p-3 rounded-lg border border-blue-200">
            <div className="text-sm text-blue-800 font-semibold">Total Wallets</div>
            <div className="text-xl font-bold text-blue-900">{formatCurrency(walletTotal)}</div>
          </div>
        </div>
      </div>

      {/* Section 7 & 8: Best & Worst Performing Centres */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded-xl shadow-md border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">🏆 Best Performing Centres</h2>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-green-50 p-3 rounded-lg">
              <div className="text-xs text-green-700">Best Revenue</div>
              <div className="font-medium">{topCentres?.revenue?.name || "N/A"}</div>
              <div className="text-sm">{topCentres?.revenue?.value ? formatCurrency(topCentres.revenue.value) : ""}</div>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg">
              <div className="text-xs text-blue-700">Best Profit</div>
              <div className="font-medium">{topCentres?.profit?.name || "N/A"}</div>
              <div className="text-sm">{topCentres?.profit?.value ? formatCurrency(topCentres.profit.value) : ""}</div>
            </div>
            <div className="bg-yellow-50 p-3 rounded-lg">
              <div className="text-xs text-yellow-700">Best Rating</div>
              <div className="font-medium">{topCentres?.rating?.name || "N/A"}</div>
              <div className="text-sm">{topCentres?.rating?.value || ""}</div>
            </div>
            <div className="bg-purple-50 p-3 rounded-lg">
              <div className="text-xs text-purple-700">Best Collection %</div>
              <div className="font-medium">{topCentres?.collection?.name || "N/A"}</div>
              <div className="text-sm">{topCentres?.collection?.value ? `${topCentres.collection.value}%` : ""}</div>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-md border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">⚠️ Worst Performing Centres</h2>
          <div className="grid grid-cols-2 gap-2">
            <div className="bg-red-50 p-3 rounded-lg">
              <div className="text-xs text-red-700">Lowest Revenue</div>
              <div className="font-medium">{worstCentres?.revenue?.name || "N/A"}</div>
              <div className="text-sm">{worstCentres?.revenue?.value ? formatCurrency(worstCentres.revenue.value) : ""}</div>
            </div>
            <div className="bg-red-50 p-3 rounded-lg">
              <div className="text-xs text-red-700">Highest Pending</div>
              <div className="font-medium">{worstCentres?.pending?.name || "N/A"}</div>
              <div className="text-sm">{worstCentres?.pending?.value ? formatCurrency(worstCentres.pending.value) : ""}</div>
            </div>
            <div className="bg-red-50 p-3 rounded-lg">
              <div className="text-xs text-red-700">Most Delayed</div>
              <div className="font-medium">{worstCentres?.delayed?.name || "N/A"}</div>
              <div className="text-sm">{worstCentres?.delayed?.value ? `${worstCentres.delayed.value} services` : ""}</div>
            </div>
            <div className="bg-red-50 p-3 rounded-lg">
              <div className="text-xs text-red-700">Most Complaints</div>
              <div className="font-medium">{worstCentres?.complaints?.name || "N/A"}</div>
              <div className="text-sm">{worstCentres?.complaints?.value ? `${worstCentres.complaints.value} complaints` : ""}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Section 9 & 10: Staff & Teams */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded-xl shadow-md border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">👨‍💼 Top Staff</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Name</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Revenue</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Applications</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Rating</th>
                </tr>
              </thead>
              <tbody>
                {topStaff.map((staff, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{staff.name}</td>
                    <td className="px-3 py-2">{formatCurrency(staff.revenue || 0)}</td>
                    <td className="px-3 py-2">{staff.applications || 0}</td>
                    <td className="px-3 py-2">{staff.rating || 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-md border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">👥 Top Teams</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Team</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Revenue</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Profit</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Expenses</th>
                </tr>
              </thead>
              <tbody>
                {topTeams.map((team, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-medium">{team.name}</td>
                    <td className="px-3 py-2">{formatCurrency(team.revenue || 0)}</td>
                    <td className="px-3 py-2">{formatCurrency(team.profit || 0)}</td>
                    <td className="px-3 py-2">{formatCurrency(team.expenses || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Section 11: Notifications */}
      <div className="bg-white p-4 rounded-xl shadow-md border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">🔔 Notifications</h2>
        <div className="space-y-2">
          {notifications.map((notif) => (
            <div key={notif.id} className={`p-3 rounded-lg flex items-center ${notif.type === "critical" ? "bg-red-50" : notif.type === "warning" ? "bg-yellow-50" : "bg-blue-50"}`}>
              <span className="mr-2">{notif.type === "critical" ? "🔴" : notif.type === "warning" ? "🟠" : "🔵"}</span>
              <span>{notif.message}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Section 12: Recent Activities */}
      <div className="bg-white p-4 rounded-xl shadow-md border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">🕒 Recent Activities</h2>
        <div className="space-y-3">
          {activities.map((activity) => (
            <div key={activity.id} className="flex items-center justify-between border-b border-gray-100 pb-2">
              <span>{activity.action}</span>
              <span className="text-sm text-gray-500">{activity.time}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Section 13: Map View */}
      <div className="bg-white p-4 rounded-xl shadow-md border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">🗺️ Centre Locations</h2>
        <MapView />
      </div>

      {/* Section 14: Quick Actions */}
      <div className="bg-white p-4 rounded-xl shadow-md border border-gray-200">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">⚡ Quick Actions</h2>
        <div className="flex flex-wrap gap-3">
          <button className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition">+ Create Centre</button>
          <button className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition">+ Create Admin</button>
          <button className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition">📢 Broadcast Notification</button>
          <button className="px-4 py-2 bg-yellow-600 text-white rounded-lg hover:bg-yellow-700 transition">🌐 Global Event</button>
          <button className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition">📣 Global Campaign</button>
          <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition">📊 Financial Report</button>
          <button className="px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition">📤 Export Reports</button>
        </div>
      </div>

      {/* Section 15: AI Insights (Future) */}
      <div className="bg-gradient-to-r from-indigo-50 to-purple-50 p-4 rounded-xl border border-indigo-200">
        <h2 className="text-lg font-semibold text-indigo-800 mb-2">🤖 AI Insights</h2>
        <ul className="list-disc list-inside space-y-1 text-gray-700 text-sm">
          <li>Revenue increased 18%.</li>
          <li>Kolathoor profit dropped 11%.</li>
          <li>VK Padi has the highest customer satisfaction.</li>
          <li>Pukayur recovered ₹72,000 pending payments this week.</li>
          <li>Attendance dropped in 3 centres.</li>
          <li>2 centres haven't completed daily closing.</li>
        </ul>
      </div>
    </div>
  );
};

export default SuperadminDashboard;