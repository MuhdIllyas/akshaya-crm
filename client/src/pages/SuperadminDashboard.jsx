import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { toast } from "react-toastify";
import {
  FiMapPin, FiUsers, FiUserCheck, FiCheckSquare, FiDollarSign,
  FiTrendingUp, FiBriefcase, FiCreditCard, FiStar, FiActivity,
  FiClock, FiCheckCircle, FiAlertCircle, FiFileText, FiAward,
  FiAlertTriangle, FiBell, FiMap, FiZap, FiCpu
} from "react-icons/fi";

const SuperadminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [revenueView, setRevenueView] = useState("revenue"); // revenue | profit | expenses

  // Fallback Mock data generator
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
        { id: 1, type: "critical", message: "Centre Tirur has not closed accounting for 2 days." },
        { id: 2, type: "warning", message: "VK Padi wallet mismatch detected (₹2,450 variance)." },
        { id: 3, type: "warning", message: "45 high-priority applications awaiting approval." },
        { id: 4, type: "critical", message: "Network connection lost at Malappuram branch." },
        { id: 5, type: "info", message: "Monthly automated backups completed successfully." },
        { id: 6, type: "warning", message: "WhatsApp API disconnected. Re-authentication required." },
      ],
      activities: [
        { id: 1, action: "Admin created new centre 'Kondotty'", time: "2 mins ago" },
        { id: 2, action: "Staff 'Jane Smith' joined Pukayur", time: "15 mins ago" },
        { id: 3, action: "Digital Wallet limit updated", time: "1 hour ago" },
        { id: 4, action: "Expense batch #842 approved", time: "2 hours ago" },
        { id: 5, action: "Team 'Delta' created by Superadmin", time: "3 hours ago" },
        { id: 6, action: "New 5-star review received at VK Padi", time: "5 hours ago" },
        { id: 7, action: "Customer complaint #102 resolved", time: "yesterday" },
      ],
      healthScores: {
        "Pukayur": { score: 94, status: "Excellent" },
        "Kolathoor": { score: 78, status: "Attention" },
        "VK Padi": { score: 85, status: "Good" },
        "Tirur": { score: 52, status: "Critical" },
        "Malappuram": { score: 88, status: "Good" },
      },
    };
  };

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        // Attempt to fetch real data from APIs using standard fetch
        const token = localStorage.getItem("token");
        const headers = { Authorization: `Bearer ${token}` };

        // For this environment, we'll intentionally throw an error to use our beautiful mock data
        // In your real codebase, this would be: 
        // const res = await fetch(`${import.meta.env.VITE_API_URL}/api/dashboard/superadmin`, { headers });
        // const data = await res.json();
        
        throw new Error("Simulating API fetch failure to load mock data");
        
      } catch (err) {
        console.log("Using rich mock data for Superadmin Dashboard.");
        setTimeout(() => {
            setDashboardData(generateMockData());
            setLoading(false);
        }, 800); // Small artificial delay to show the nice loading state
      }
    };
    fetchData();
  }, []);

  // Helper to get health color and icon
  const getHealthStatus = (health) => {
    const map = {
      excellent: { color: "text-emerald-500", bg: "bg-emerald-100", label: "Excellent" },
      good: { color: "text-emerald-500", bg: "bg-emerald-100", label: "Good" },
      attention: { color: "text-amber-500", bg: "bg-amber-100", label: "Attention" },
      critical: { color: "text-rose-500", bg: "bg-rose-100", label: "Critical" },
    };
    return map[health] || map.good;
  };

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount);
  };

  // Simple pure-CSS bar chart for revenue trend
  const RevenueChart = () => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    const data = {
      revenue: [280000, 310000, 340000, 360000, 380000, 420000, 450000, 480000, 520000, 560000, 600000, 640000],
      profit: [70000, 80000, 90000, 95000, 100000, 110000, 115000, 120000, 130000, 140000, 150000, 160000],
      expenses: [210000, 230000, 250000, 265000, 280000, 310000, 335000, 360000, 390000, 420000, 450000, 480000],
    };
    const selected = data[revenueView] || data.revenue;
    const max = Math.max(...selected);
    const colorClass = revenueView === "profit" ? "bg-emerald-500" : revenueView === "expenses" ? "bg-rose-500" : "bg-indigo-500";

    return (
      <div className="w-full h-64 flex items-end justify-between space-x-1 sm:space-x-2 mt-6">
        {selected.map((value, idx) => (
          <div key={idx} className="flex-1 flex flex-col items-center group relative">
            {/* Tooltip on Hover */}
            <div className="opacity-0 group-hover:opacity-100 absolute -top-8 bg-gray-900 text-white text-[10px] py-1 px-2 rounded pointer-events-none transition-opacity whitespace-nowrap z-10">
                {formatCurrency(value)}
            </div>
            {/* Bar */}
            <motion.div
              initial={{ height: 0 }}
              animate={{ height: `${(value / max) * 100}%` }}
              transition={{ duration: 0.8, delay: idx * 0.05 }}
              className={`w-full rounded-t-sm hover:brightness-110 cursor-pointer ${colorClass}`}
              style={{ minHeight: '4px' }}
            />
            <span className="text-[10px] sm:text-xs text-gray-500 mt-2 font-medium">{months[idx]}</span>
          </div>
        ))}
      </div>
    );
  };

  // Map placeholder - Clean SVG of Kerala with animated markers
  const MapView = () => {
    return (
      <div className="relative bg-indigo-50/50 rounded-xl h-72 flex items-center justify-center overflow-hidden border border-indigo-100">
        <svg viewBox="0 0 200 200" className="w-full h-full opacity-60">
          {/* Abstract State outline */}
          <path d="M70,30 L110,20 L140,50 L160,110 L120,180 L80,190 L50,150 L60,80 Z" fill="#e0e7ff" stroke="#a5b4fc" strokeWidth="2" strokeLinejoin="round" />
          
          {/* Markers for centres */}
          {dashboardData.centres.map((centre, i) => {
            const health = getHealthStatus(centre.health);
            const isGreen = health.color.includes("emerald");
            const isYellow = health.color.includes("amber");
            const markerColor = isGreen ? "#10b981" : isYellow ? "#f59e0b" : "#ef4444";
            
            // Distributed positions based on ID
            const x = [85, 100, 115, 130, 95][i % 5];
            const y = [50, 80, 110, 140, 160][i % 5];
            
            return (
              <g key={centre.id} className="cursor-pointer group">
                <circle cx={x} cy={y} r="8" fill={markerColor} opacity="0.2" className="animate-ping" style={{ animationDuration: '2s' }} />
                <circle cx={x} cy={y} r="3" fill={markerColor} stroke="white" strokeWidth="1.5" />
                <text x={x + 8} y={y + 3} fontSize="5" fontWeight="bold" fill="#3730a3" className="opacity-0 group-hover:opacity-100 transition-opacity">
                    {centre.name}
                </text>
              </g>
            );
          })}
        </svg>
        <div className="absolute bottom-3 left-3 bg-white/90 backdrop-blur px-2 py-1 rounded text-[10px] font-bold text-indigo-900 border border-indigo-100 shadow-sm">
            Live Centre Map
        </div>
      </div>
    );
  };

  if (loading || !dashboardData) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 flex flex-col items-center justify-center min-h-[500px]">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
        <span className="text-gray-600 font-medium tracking-wide animate-pulse">Aggregating Global Network Data...</span>
      </div>
    );
  }

  // Destructure Data
  const {
    centres, staff, customers, services, revenue, wallets,
    activities, notifications, healthScores, topCentres,
    worstCentres, topStaff, topTeams,
  } = dashboardData;

  // Compute Stats
  const totalCentres = centres.length;
  const totalStaff = staff.length;
  const admins = staff.filter(s => s.role === "admin").length;
  const staffCount = staff.filter(s => s.role === "staff" || s.role === "supervisor").length;

  return (
    <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.4 }} className="space-y-6">
      
      {/* ─── HEADER ─── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 tracking-tight">Global Command Center</h1>
            <p className="text-sm text-gray-500 mt-1">Superadmin overview across all branches and personnel.</p>
          </div>
          <div className="flex items-center space-x-3 bg-indigo-50 border border-indigo-100 px-4 py-2 rounded-lg text-indigo-700 font-medium text-sm shadow-sm">
             <FiClock className="h-4 w-4" />
             <span>Last synced: {new Date().toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}</span>
          </div>
      </div>

      {/* ─── SECTION 1: GLOBAL KPI CARDS ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm col-span-2 md:col-span-1 hover:shadow-md transition-shadow">
          <div className="flex items-center space-x-2 text-indigo-600 mb-2">
              <FiMapPin className="h-4 w-4" />
              <div className="text-xs font-bold uppercase tracking-wider">Centres</div>
          </div>
          <div className="text-2xl font-black text-gray-900">{totalCentres}</div>
          <div className="text-[10px] text-emerald-600 font-medium mt-1">+2 this month</div>
        </div>
        
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm col-span-2 md:col-span-1 hover:shadow-md transition-shadow">
          <div className="flex items-center space-x-2 text-blue-600 mb-2">
              <FiUsers className="h-4 w-4" />
              <div className="text-xs font-bold uppercase tracking-wider">Staff</div>
          </div>
          <div className="text-2xl font-black text-gray-900">{totalStaff}</div>
          <div className="text-[10px] text-gray-500 font-medium mt-1">{admins} Admins, {staffCount} Staff</div>
        </div>
        
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm col-span-2 md:col-span-2 hover:shadow-md transition-shadow">
          <div className="flex items-center space-x-2 text-emerald-600 mb-2">
              <FiUserCheck className="h-4 w-4" />
              <div className="text-xs font-bold uppercase tracking-wider">Total Customers</div>
          </div>
          <div className="text-2xl font-black text-gray-900">{dashboardData.customers.toLocaleString()}</div>
          <div className="text-[10px] text-emerald-600 font-medium mt-1">+824 active this week</div>
        </div>
        
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm col-span-2 md:col-span-2 hover:shadow-md transition-shadow">
          <div className="flex items-center space-x-2 text-amber-600 mb-2">
              <FiCheckSquare className="h-4 w-4" />
              <div className="text-xs font-bold uppercase tracking-wider">Services Today</div>
          </div>
          <div className="text-2xl font-black text-gray-900">{dashboardData.servicesCompletedToday.toLocaleString()}</div>
          <div className="text-[10px] text-gray-500 font-medium mt-1">Across all global centres</div>
        </div>

        <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 shadow-sm col-span-2 md:col-span-2 hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4">
              <FiTrendingUp className="h-24 w-24 text-white" />
          </div>
          <div className="flex items-center space-x-2 text-indigo-300 mb-2 relative z-10">
              <FiDollarSign className="h-4 w-4" />
              <div className="text-xs font-bold uppercase tracking-wider">Today's Revenue</div>
          </div>
          <div className="text-2xl font-black text-white relative z-10">{formatCurrency(dashboardData.revenueToday)}</div>
          <div className="text-[10px] text-emerald-400 font-medium mt-1 relative z-10">Target: 85% achieved</div>
        </div>
      </div>

      {/* ─── METRICS ROW 2 ─── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-xs text-gray-500 font-semibold mb-1 flex items-center"><FiActivity className="mr-1.5"/> Monthly Revenue</div>
          <div className="text-xl font-bold text-gray-900">{formatCurrency(dashboardData.monthlyRevenue)}</div>
          <div className="text-xs text-emerald-600 mt-1 font-medium flex items-center"><FiTrendingUp className="mr-1"/> 18% vs last month</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-xs text-gray-500 font-semibold mb-1 flex items-center"><FiBriefcase className="mr-1.5"/> Net Profit</div>
          <div className="text-xl font-bold text-gray-900">{formatCurrency(dashboardData.netProfit)}</div>
          <div className="text-xs text-emerald-600 mt-1 font-medium flex items-center"><FiTrendingUp className="mr-1"/> 12% margin</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-rose-500">
          <div className="text-xs text-gray-500 font-semibold mb-1 flex items-center"><FiClock className="mr-1.5"/> Pending Payments</div>
          <div className="text-xl font-bold text-rose-600">{formatCurrency(dashboardData.pendingPayments)}</div>
          <div className="text-xs text-rose-500 mt-1 font-medium">{dashboardData.pendingCustomers} Customers owing</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-amber-500">
          <div className="text-xs text-gray-500 font-semibold mb-1 flex items-center"><FiStar className="mr-1.5"/> Average Rating</div>
          <div className="text-xl font-bold text-amber-600">{dashboardData.averageRating} <span className="text-sm text-gray-400">/ 5.0</span></div>
          <div className="text-xs text-gray-500 mt-1 font-medium">{dashboardData.totalReviews.toLocaleString()} Total Reviews</div>
        </div>
      </div>

      {/* ─── SECTION 2: REVENUE ANALYTICS + CENTRE PERFORMANCE ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Chart */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-6">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-3 sm:mb-0 flex items-center">
                <FiBarChart2 className="mr-2 text-indigo-600 h-5 w-5" /> Financial Growth Matrix
            </h2>
            <div className="flex bg-gray-100 rounded-lg p-1">
              {['revenue', 'profit', 'expenses'].map(view => (
                <button
                    key={view}
                    onClick={() => setRevenueView(view)}
                    className={`px-4 py-1.5 text-xs font-bold rounded-md capitalize transition-all ${
                        revenueView === view ? "bg-white text-gray-900 shadow-sm border border-gray-200" : "text-gray-500 hover:text-gray-700"
                    }`}
                >
                    {view}
                </button>
              ))}
            </div>
          </div>
          <RevenueChart />
        </div>

        {/* Top Centres Table */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center">
              <FiAward className="mr-2 text-amber-500 h-5 w-5" /> Top Regional Branches
          </h2>
          <div className="overflow-hidden rounded-lg border border-gray-100">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Rank</th>
                  <th className="px-4 py-2.5 text-left text-[10px] font-bold text-gray-500 uppercase tracking-wider">Centre</th>
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider">Rev (Lakhs)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {centres.sort((a,b) => b.revenue - a.revenue).slice(0, 5).map((centre, idx) => (
                  <tr key={centre.id} className="hover:bg-indigo-50/50 transition-colors">
                    <td className="px-4 py-2.5 whitespace-nowrap font-medium text-gray-500">
                      {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx+1}.`}
                    </td>
                    <td className="px-4 py-2.5 font-bold text-gray-900">{centre.name}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-emerald-600">₹{(centre.revenue / 100000).toFixed(1)}L</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ─── SECTION 3: MAP & NOTIFICATIONS ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Map */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center">
              <FiMap className="mr-2 text-indigo-600 h-5 w-5" /> Network Geography
          </h2>
          <MapView />
        </div>

        {/* Notifications */}
        <div className="lg:col-span-2 bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col">
          <div className="flex justify-between items-center mb-4">
              <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider flex items-center">
                  <FiBell className="mr-2 text-rose-500 h-5 w-5" /> System Alerts
              </h2>
              <span className="bg-rose-100 text-rose-700 text-xs font-bold px-2 py-0.5 rounded-full">{notifications.length} Unresolved</span>
          </div>
          <div className="space-y-3 flex-1 overflow-y-auto max-h-72 pr-2">
            {notifications.map((notif) => (
              <div key={notif.id} className={`p-3 rounded-lg flex items-start border-l-4 ${
                  notif.type === "critical" ? "bg-rose-50 border-rose-500" : 
                  notif.type === "warning" ? "bg-amber-50 border-amber-400" : 
                  "bg-blue-50 border-blue-400"
              }`}>
                <div className="mt-0.5 mr-3 flex-shrink-0">
                    {notif.type === "critical" ? <FiAlertCircle className="h-4 w-4 text-rose-600" /> : 
                     notif.type === "warning" ? <FiAlertTriangle className="h-4 w-4 text-amber-600" /> : 
                     <FiBell className="h-4 w-4 text-blue-600" />}
                </div>
                <div>
                    <p className={`text-sm font-bold ${
                        notif.type === "critical" ? "text-rose-900" : 
                        notif.type === "warning" ? "text-amber-900" : 
                        "text-blue-900"
                    }`}>{notif.message}</p>
                    <p className="text-[10px] text-gray-500 mt-1 uppercase tracking-wide">Requires Superadmin Intervention</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ─── SECTION 4: FINANCIAL HEALTH & WALLETS ─── */}
      <div className="bg-gray-900 p-6 rounded-2xl shadow-xl border border-gray-800">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-5 flex items-center">
            <FiCreditCard className="mr-2 text-emerald-400 h-5 w-5" /> Consolidated Liquidity & Wallets
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
            <div className="text-xs text-gray-400 font-semibold mb-1 uppercase tracking-wider">Physical Cash</div>
            <div className="text-2xl font-black text-white">{formatCurrency(dashboardData.wallet.cash)}</div>
          </div>
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
            <div className="text-xs text-gray-400 font-semibold mb-1 uppercase tracking-wider">Bank Transfer</div>
            <div className="text-2xl font-black text-white">{formatCurrency(dashboardData.wallet.bank)}</div>
          </div>
          <div className="bg-gray-800 p-4 rounded-xl border border-gray-700">
            <div className="text-xs text-gray-400 font-semibold mb-1 uppercase tracking-wider">Digital (UPI)</div>
            <div className="text-2xl font-black text-white">{formatCurrency(dashboardData.wallet.digital)}</div>
          </div>
          <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-4 rounded-xl border border-indigo-500 shadow-inner">
            <div className="text-xs text-indigo-200 font-semibold mb-1 uppercase tracking-wider">Total Aggregated</div>
            <div className="text-2xl font-black text-white">{formatCurrency(dashboardData.wallet.total)}</div>
          </div>
        </div>
      </div>

      {/* ─── SECTION 5: LIVE OPERATIONS & ACTIVITY ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          
        {/* Live Ops Grid */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center">
                <FiZap className="mr-2 text-indigo-600 h-5 w-5" /> Live Workflow Status
            </h2>
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 flex flex-col items-center justify-center text-center">
                <div className="text-3xl font-black text-rose-600">{dashboardData.pendingServices}</div>
                <div className="text-xs text-rose-800 font-bold uppercase tracking-wider mt-1">Pending</div>
                </div>
                <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex flex-col items-center justify-center text-center">
                <div className="text-3xl font-black text-emerald-600">{dashboardData.completedToday}</div>
                <div className="text-xs text-emerald-800 font-bold uppercase tracking-wider mt-1">Done Today</div>
                </div>
                <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex flex-col items-center justify-center text-center">
                <div className="text-3xl font-black text-amber-600">{dashboardData.delayedServices}</div>
                <div className="text-xs text-amber-800 font-bold uppercase tracking-wider mt-1">SLA Breached</div>
                </div>
                <div className="bg-blue-50 p-4 rounded-xl border border-blue-100 flex flex-col items-center justify-center text-center">
                <div className="text-3xl font-black text-blue-600">{dashboardData.applicationsInProgress}</div>
                <div className="text-xs text-blue-800 font-bold uppercase tracking-wider mt-1">In Progress</div>
                </div>
            </div>
        </div>

        {/* Global Audit Log */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200 flex flex-col">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center">
                <FiActivity className="mr-2 text-indigo-600 h-5 w-5" /> Global Audit Trail
            </h2>
            <div className="space-y-0 flex-1 overflow-y-auto pr-2 relative">
                {/* Timeline vertical line */}
                <div className="absolute left-[11px] top-2 bottom-2 w-0.5 bg-gray-100"></div>
                
                {activities.map((activity, idx) => (
                <div key={activity.id} className="relative pl-8 py-3 group">
                    <div className="absolute left-0 top-[18px] w-6 h-6 bg-white border-2 border-indigo-200 rounded-full flex items-center justify-center z-10 group-hover:border-indigo-500 transition-colors">
                        <div className="w-2 h-2 bg-indigo-500 rounded-full"></div>
                    </div>
                    <p className="text-sm font-semibold text-gray-800">{activity.action}</p>
                    <p className="text-xs text-gray-500 font-mono mt-0.5">{activity.time}</p>
                </div>
                ))}
            </div>
        </div>

      </div>

      {/* ─── SECTION 6: AI INSIGHTS & ACTIONS ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* AI Insights */}
        <div className="lg:col-span-3 bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 p-5 rounded-xl border border-indigo-100 shadow-sm relative overflow-hidden">
            <div className="absolute -right-4 -top-4 opacity-5">
                <FiCpu className="w-48 h-48" />
            </div>
            <h2 className="text-sm font-bold text-indigo-900 uppercase tracking-wider mb-3 flex items-center relative z-10">
                <FiCpu className="mr-2 text-indigo-600 h-5 w-5" /> Automated AI Insights
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 relative z-10">
                <ul className="space-y-2 text-sm text-gray-700 font-medium">
                    <li className="flex items-start"><span className="text-emerald-500 mr-2">↑</span> Overall Network Revenue increased 18% MoM.</li>
                    <li className="flex items-start"><span className="text-rose-500 mr-2">↓</span> Kolathoor operating profit dropped by 11% this week.</li>
                    <li className="flex items-start"><span className="text-indigo-500 mr-2">★</span> VK Padi maintains highest customer satisfaction (4.9/5).</li>
                </ul>
                <ul className="space-y-2 text-sm text-gray-700 font-medium">
                    <li className="flex items-start"><span className="text-emerald-500 mr-2">✓</span> Pukayur recovered ₹72,000 in pending payments.</li>
                    <li className="flex items-start"><span className="text-amber-500 mr-2">⚠</span> Staff attendance dropped significantly in 3 centres.</li>
                    <li className="flex items-start"><span className="text-rose-500 mr-2">!</span> 2 active centres missed the mandatory daily closing window.</li>
                </ul>
            </div>
        </div>

        {/* Quick Actions Panel */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center">
                <FiZap className="mr-2 text-amber-500 h-5 w-5" /> Actions
            </h2>
            <div className="flex flex-col space-y-2">
                <button className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-bold shadow-sm">
                    Generate Network Report
                </button>
                <button className="w-full py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-bold">
                    Broadcast Message
                </button>
                <button className="w-full py-2 bg-white border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition text-sm font-bold">
                    Add New Branch
                </button>
            </div>
        </div>

      </div>
    </motion.div>
  );
};

export default SuperadminDashboard;