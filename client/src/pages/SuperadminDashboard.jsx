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

  // Mock data generators
  const generateMockData = () => {
    return {
      centres: [
        { id: 1, name: "Pukayur", admin_id: 2, created_by: 1, revenue: 820000, profit: 210000, services: 1450, rating: 4.9, health: "excellent", location: { lat: 10.5, lng: 76.2 } },
        { id: 2, name: "Kolathoor", admin_id: 3, created_by: 1, revenue: 780000, profit: 180000, services: 1311, rating: 4.8, health: "good", location: { lat: 10.6, lng: 76.3 } },
        { id: 3, name: "VK Padi", admin_id: 4, created_by: 1, revenue: 640000, profit: 150000, services: 1110, rating: 4.7, health: "attention", location: { lat: 10.7, lng: 76.4 } },
        { id: 4, name: "Tirur", admin_id: 5, created_by: 1, revenue: 500000, profit: 90000, services: 890, rating: 4.5, health: "critical", location: { lat: 10.8, lng: 76.5 } },
        { id: 5, name: "Malappuram", admin_id: 6, created_by: 1, revenue: 720000, profit: 190000, services: 1020, rating: 4.6, health: "good", location: { lat: 10.9, lng: 76.6 } },
      ],
      staff: [
        { id: 1, name: "John Doe", role: "admin", centre_id: 1 },
        { id: 2, name: "Jane Smith", role: "staff", centre_id: 1 },
        { id: 3, name: "Bob Johnson", role: "staff", centre_id: 2 },
        { id: 4, name: "Alice Brown", role: "supervisor", centre_id: 3 },
        { id: 5, name: "Charlie Davis", role: "staff", centre_id: 4 },
        { id: 6, name: "Eva Wilson", role: "admin", centre_id: 5 },
        { id: 7, name: "Frank Miller", role: "staff", centre_id: 5 },
        { id: 8, name: "Grace Lee", role: "staff", centre_id: 2 },
      ],
      customers: 58214,
      servicesCompletedToday: 1584,
      revenueToday: 124850,
      monthlyRevenue: 3684200,
      netProfit: 941500,
      pendingPayments: 212000,
      pendingCustomers: 341,
      averageRating: 4.8,
      totalReviews: 13240,
      pendingServices: 1230,
      completedToday: 541,
      delayedServices: 67,
      applicationsInProgress: 210,
      wallet: {
        cash: 520000,
        bank: 1840000,
        digital: 290000,
        total: 2650000,
      },
      topCentres: {
        revenue: { name: "Pukayur", value: 820000 },
        profit: { name: "Kolathoor", value: 180000 },
        rating: { name: "VK Padi", value: 4.7 },
        collection: { name: "Malappuram", value: 95 }, // percentage
      },
      worstCentres: {
        revenue: { name: "Tirur", value: 500000 },
        pending: { name: "Kolathoor", value: 45000 },
        delayed: { name: "Pukayur", value: 12 },
        complaints: { name: "Tirur", value: 8 },
      },
      topStaff: [
        { name: "Jane Smith", revenue: 320000, applications: 45, rating: 4.9 },
        { name: "Bob Johnson", revenue: 280000, applications: 38, rating: 4.8 },
        { name: "Grace Lee", revenue: 250000, applications: 35, rating: 4.7 },
      ],
      topTeams: [
        { name: "Team Alpha", revenue: 520000, profit: 120000, expenses: 400000 },
        { name: "Team Beta", revenue: 480000, profit: 100000, expenses: 380000 },
        { name: "Team Gamma", revenue: 410000, profit: 85000, expenses: 325000 },
      ],
      notifications: [
        { id: 1, type: "critical", message: "Centre X has not closed accounting." },
        { id: 2, type: "warning", message: "Centre Y wallet mismatch." },
        { id: 3, type: "warning", message: "Pending approvals." },
        { id: 4, type: "critical", message: "Attendance missing." },
        { id: 5, type: "info", message: "Communication account expired." },
        { id: 6, type: "warning", message: "WhatsApp disconnected." },
      ],
      activities: [
        { id: 1, action: "Admin created new centre", time: "2 mins ago" },
        { id: 2, action: "Staff joined", time: "15 mins ago" },
        { id: 3, action: "Wallet created", time: "1 hour ago" },
        { id: 4, action: "Expense approved", time: "2 hours ago" },
        { id: 5, action: "Team created", time: "3 hours ago" },
        { id: 6, action: "New review", time: "5 hours ago" },
        { id: 7, action: "Customer complaint", time: "yesterday" },
      ],
      healthScores: {
        Pukayur: { score: 94, status: "Excellent" },
        Kolathoor: { score: 78, status: "Attention" },
        "VK Padi": { score: 85, status: "Good" },
        Tirur: { score: 52, status: "Critical" },
        Malappuram: { score: 88, status: "Good" },
      },
    };
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch real data from APIs
        const centresRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/centres`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        const staffRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/staff/all`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        // Additional endpoints (assume they exist)
        const customersRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/customers/count`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        const servicesRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/services/today`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        const revenueRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/revenue/aggregate`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        const walletRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/wallets/total`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        const activitiesRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/activities/recent`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        const notificationsRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/notifications`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        const healthRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/centres/health`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        const topCentresRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/centres/top`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        const worstCentresRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/centres/worst`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        const topStaffRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/staff/top`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        const topTeamsRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/teams/top`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });

        // Combine all data
        setDashboardData({
          centres: centresRes.data,
          staff: staffRes.data,
          customers: customersRes.data.count,
          services: servicesRes.data,
          revenue: revenueRes.data,
          wallets: walletRes.data,
          activities: activitiesRes.data,
          notifications: notificationsRes.data,
          healthScores: healthRes.data,
          topCentres: topCentresRes.data,
          worstCentres: worstCentresRes.data,
          topStaff: topStaffRes.data,
          topTeams: topTeamsRes.data,
        });
      } catch (err) {
        console.error("Error fetching dashboard data:", err);
        toast.error("Failed to load dashboard data. Using mock data.", {
          position: "top-right",
          autoClose: 5000,
          theme: "light",
        });
        // Fallback to mock data
        setDashboardData(generateMockData());
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

  // Simple bar chart for revenue trend (placeholder)
  const RevenueChart = () => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    // Mock data - would come from API
    const data = {
      revenue: [280000, 310000, 340000, 360000, 380000, 420000, 450000, 480000, 520000, 560000, 600000, 640000],
      profit: [70000, 80000, 90000, 95000, 100000, 110000, 115000, 120000, 130000, 140000, 150000, 160000],
      expenses: [210000, 230000, 250000, 265000, 280000, 310000, 335000, 360000, 390000, 420000, 450000, 480000],
    };
    const selected = data[revenueView] || data.revenue;
    const max = Math.max(...selected);

    return (
      <div className="w-full h-64 flex items-end space-x-2">
        {selected.map((value, idx) => (
          <div key={idx} className="flex-1 flex flex-col items-center">
            <div
              className="w-full bg-blue-500 rounded-t"
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
  const totalCentres = centres.length;
  const totalStaff = staff.length;
  const admins = staff.filter(s => s.role === "admin").length;
  const staffCount = staff.filter(s => s.role === "staff" || s.role === "supervisor").length;
  const totalCustomers = customers;
  const servicesToday = services?.completedToday || 1584;
  const revenueToday = revenue?.today || 124850;
  const monthlyRevenue = revenue?.monthly || 3684200;
  const netProfit = revenue?.profit || 941500;
  const pendingPayments = revenue?.pending || 212000;
  const pendingCustomers = revenue?.pendingCustomers || 341;
  const avgRating = revenue?.avgRating || 4.8;
  const totalReviews = revenue?.totalReviews || 13240;
  const pendingServices = services?.pending || 1230;
  const completedToday = services?.completed || 541;
  const delayedServices = services?.delayed || 67;
  const applicationsInProgress = services?.inProgress || 210;
  const walletCash = wallets?.cash || 520000;
  const walletBank = wallets?.bank || 1840000;
  const walletDigital = wallets?.digital || 290000;
  const walletTotal = wallets?.total || 2650000;

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