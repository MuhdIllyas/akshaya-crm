import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { motion } from "framer-motion";
import {
  FiMapPin, FiUsers, FiUserCheck, FiCheckSquare, FiDollarSign,
  FiTrendingUp, FiBriefcase, FiCreditCard, FiStar, FiActivity,
  FiClock, FiCheckCircle, FiAlertCircle, FiFileText, FiAward,
  FiAlertTriangle, FiBell, FiMap, FiZap, FiCpu, FiBarChart2
} from "react-icons/fi";

const SuperadminDashboard = () => {
  const [loading, setLoading] = useState(true);
  const [dashboardData, setDashboardData] = useState(null);
  const [revenueView, setRevenueView] = useState("revenue"); // revenue | profit | expenses

  useEffect(() => {
    const fetchGlobalData = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem("token");
        const headers = { 
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}` 
        };

        // 1. Fetch Global Live Metrics (For Top KPI Row)
        const quickResPromise = axios.get(`${import.meta.env.VITE_API_URL}/api/reports/quick-metrics?centre_id=all`, { headers });
        
        // 2. Fetch Deep Analytics via V3 Engine (Using Global Report IDs)
        const engineResPromise = axios.post(`${import.meta.env.VITE_API_URL}/api/reports/generate`, {
            period: "monthly", // Default overview to this month
            centreId: "all", 
            format: "preview",
            // We request: Financials(1), Wallets(5), Staff Perf(10), Pending(17), Completed(18), Team Perf(27), Centre Compare(29), Rev/Centre(30), Profit/Centre(31), Att/Centre(32)
            reportIds: [1, 5, 10, 17, 18, 27, 29, 30, 31, 32] 
        }, { headers });

        // 3. Fetch Centre Locations for the Map
        const centresResPromise = axios.get(`${import.meta.env.VITE_API_URL}/api/centres`, { headers });

        // Run all three orchestrator fetches in parallel for maximum speed
        const [quickRes, engineRes, centresRes] = await Promise.all([quickResPromise, engineResPromise, centresResPromise]);

        const qData = quickRes.data;
        const eData = engineRes.data.data; // Unpack the orchestrated payload

        // Map the real DB data into the dashboard state
        setDashboardData({
            rawCentres: centresRes.data || [],
            quickStats: qData,
            financials: eData.financials || {},
            wallets: eData.walletSummary || [],
            topCentresList: eData.centreComparison || [],
            revenueByCentre: eData.revenueByCentre?.summary || [],
            profitByCentre: eData.profitByCentre?.summary || [],
            attendanceByCentre: eData.attendanceByCentre || [],
            topStaff: eData.performanceReport || [],
            topTeams: eData.teamPerformance || [],
            pendingServices: eData.pendingServices || [],
            completedServices: eData.completedServicesReport || []
        });

      } catch (err) {
        console.error("Error fetching Global Superadmin data:", err);
        toast.error("Failed to connect to the Analytics Engine. Please check your connection.");
      } finally {
        setLoading(false);
      }
    };
    fetchGlobalData();
  }, []);

  // Format currency
  const formatCurrency = (amount) => {
    return new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(amount || 0);
  };

  // Simple pure-CSS bar chart for revenue trend
  const RevenueChart = ({ monthlyTrend }) => {
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    
    // Safely extract from the V3 Financials payload
    const data = {
      revenue: monthlyTrend?.revenueCollected || new Array(12).fill(0),
      profit: monthlyTrend?.grossProfit || new Array(12).fill(0),
      expenses: monthlyTrend?.operatingExpenses || new Array(12).fill(0),
    };
    
    const selected = data[revenueView] || data.revenue;
    const max = Math.max(...selected, 1); // Prevent division by zero
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

  // Map Component
  const MapView = ({ centresList }) => {
    return (
      <div className="relative bg-indigo-50/50 rounded-xl h-72 flex items-center justify-center overflow-hidden border border-indigo-100">
        <svg viewBox="0 0 200 200" className="w-full h-full opacity-60">
          <path d="M70,30 L110,20 L140,50 L160,110 L120,180 L80,190 L50,150 L60,80 Z" fill="#e0e7ff" stroke="#a5b4fc" strokeWidth="2" strokeLinejoin="round" />
          
          {/* Dynamically plot markers for Real Database Centres */}
          {centresList.map((centre, i) => {
            const markerColor = "#10b981"; // Emerald Green for active
            // Distribute positions based on pseudo-random math against their ID so they don't overlap
            const x = 40 + (centre.id * 37) % 120;
            const y = 40 + (centre.id * 23) % 120;
            
            return (
              <g key={centre.id} className="cursor-pointer group">
                <circle cx={x} cy={y} r="8" fill={markerColor} opacity="0.2" className="animate-ping" style={{ animationDuration: '2s' }} />
                <circle cx={x} cy={y} r="3" fill={markerColor} stroke="white" strokeWidth="1.5" />
                <text x={x + 8} y={y + 3} fontSize="6" fontWeight="bold" fill="#3730a3" className="opacity-0 group-hover:opacity-100 transition-opacity">
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

  // --- DYNAMIC DATA EXTRACTION ---
  const { rawCentres, quickStats, financials, wallets, revenueByCentre, profitByCentre, attendanceByCentre, topStaff, topTeams, pendingServices } = dashboardData;

  const totalCentres = rawCentres.length;
  const totalStaff = quickStats.attendanceTotal || 0;
  const staffPresent = quickStats.attendancePresent || 0;
  const servicesToday = quickStats.servicesCount || 0;
  
  // Financial Math
  const monthlyRevenue = revenueByCentre.reduce((acc, c) => acc + c.total_revenue, 0);
  const netProfitMonthly = profitByCentre.reduce((acc, c) => acc + c.net_profit, 0);
  const pendingPayments = quickStats.pendingAmount || 0;
  const totalWalletsBal = wallets.reduce((acc, w) => acc + w.closing_balance, 0);

  // Operations Math
  const pendingCount = pendingServices.length;
  const delayedCount = pendingServices.filter(s => s.days_pending > 5).length; // Flag as delayed if pending > 5 days

  // Best/Worst Leaderboards
  const bestRevCentre = revenueByCentre.length > 0 ? revenueByCentre[0] : null;
  const worstRevCentre = revenueByCentre.length > 0 ? revenueByCentre[revenueByCentre.length - 1] : null;
  const bestProfitCentre = profitByCentre.length > 0 ? profitByCentre[0] : null;
  const worstProfitCentre = profitByCentre.length > 0 ? profitByCentre[profitByCentre.length - 1] : null;
  const bestAttendance = attendanceByCentre.length > 0 ? attendanceByCentre[0] : null;

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
          <div className="text-[10px] text-emerald-600 font-medium mt-1">Active Network</div>
        </div>
        
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm col-span-2 md:col-span-1 hover:shadow-md transition-shadow">
          <div className="flex items-center space-x-2 text-blue-600 mb-2">
              <FiUsers className="h-4 w-4" />
              <div className="text-xs font-bold uppercase tracking-wider">Staff</div>
          </div>
          <div className="text-2xl font-black text-gray-900">{totalStaff}</div>
          <div className="text-[10px] text-gray-500 font-medium mt-1">{staffPresent} Present Today</div>
        </div>
        
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm col-span-2 md:col-span-2 hover:shadow-md transition-shadow">
          <div className="flex items-center space-x-2 text-emerald-600 mb-2">
              <FiTrendingUp className="h-4 w-4" />
              <div className="text-xs font-bold uppercase tracking-wider">Monthly Profit</div>
          </div>
          <div className="text-2xl font-black text-gray-900">{formatCurrency(netProfitMonthly)}</div>
          <div className="text-[10px] text-emerald-600 font-medium mt-1">Across all global centres</div>
        </div>
        
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm col-span-2 md:col-span-2 hover:shadow-md transition-shadow">
          <div className="flex items-center space-x-2 text-amber-600 mb-2">
              <FiCheckSquare className="h-4 w-4" />
              <div className="text-xs font-bold uppercase tracking-wider">Services Today</div>
          </div>
          <div className="text-2xl font-black text-gray-900">{servicesToday}</div>
          <div className="text-[10px] text-gray-500 font-medium mt-1">Initiated in the last 24H</div>
        </div>

        <div className="bg-gray-900 p-4 rounded-xl border border-gray-800 shadow-sm col-span-2 md:col-span-2 hover:shadow-md transition-shadow relative overflow-hidden">
          <div className="absolute right-0 bottom-0 opacity-10 transform translate-x-4 translate-y-4">
              <FiDollarSign className="h-24 w-24 text-white" />
          </div>
          <div className="flex items-center space-x-2 text-indigo-300 mb-2 relative z-10">
              <FiActivity className="h-4 w-4" />
              <div className="text-xs font-bold uppercase tracking-wider">Today's Revenue</div>
          </div>
          <div className="text-2xl font-black text-white relative z-10">{formatCurrency(quickStats.collection)}</div>
          <div className="text-[10px] text-emerald-400 font-medium mt-1 relative z-10">Live Collection Status</div>
        </div>
      </div>

      {/* ─── METRICS ROW 2 ─── */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow">
          <div className="text-xs text-gray-500 font-semibold mb-1 flex items-center"><FiActivity className="mr-1.5"/> Monthly Total Revenue</div>
          <div className="text-xl font-bold text-gray-900">{formatCurrency(monthlyRevenue)}</div>
          <div className="text-xs text-emerald-600 mt-1 font-medium flex items-center"><FiTrendingUp className="mr-1"/> Consolidated Overview</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-rose-500">
          <div className="text-xs text-gray-500 font-semibold mb-1 flex items-center"><FiClock className="mr-1.5"/> Pending Payments</div>
          <div className="text-xl font-bold text-rose-600">{formatCurrency(pendingPayments)}</div>
          <div className="text-xs text-rose-500 mt-1 font-medium">Action Required</div>
        </div>
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-shadow border-l-4 border-l-indigo-500">
          <div className="text-xs text-gray-500 font-semibold mb-1 flex items-center"><FiCreditCard className="mr-1.5"/> Total Liquidity</div>
          <div className="text-xl font-bold text-indigo-600">{formatCurrency(totalWalletsBal)}</div>
          <div className="text-xs text-indigo-500 mt-1 font-medium">Across all network wallets</div>
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
          {/* Inject Dynamic Math from Engine */}
          <RevenueChart monthlyTrend={financials?.monthlyTrend} />
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
                  <th className="px-4 py-2.5 text-right text-[10px] font-bold text-gray-500 uppercase tracking-wider">Net Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50 bg-white">
                {profitByCentre.slice(0, 5).map((centre, idx) => (
                  <tr key={idx} className="hover:bg-indigo-50/50 transition-colors">
                    <td className="px-4 py-2.5 whitespace-nowrap font-medium text-gray-500">
                      {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : `${idx+1}.`}
                    </td>
                    <td className="px-4 py-2.5 font-bold text-gray-900">{centre.centre_name}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-emerald-600">{formatCurrency(centre.net_profit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ─── SECTION 3: MAP & WALLETS ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Map */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
          <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center">
              <FiMap className="mr-2 text-indigo-600 h-5 w-5" /> Network Geography
          </h2>
          <MapView centresList={rawCentres} />
        </div>

        {/* Global Wallet Breakdown */}
        <div className="lg:col-span-2 bg-gray-900 p-6 rounded-2xl shadow-xl border border-gray-800">
            <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-5 flex items-center">
                <FiCreditCard className="mr-2 text-emerald-400 h-5 w-5" /> Consolidated Network Wallets
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                {wallets.slice(0,5).map(w => (
                    <div key={w.wallet_name} className="bg-gray-800 p-4 rounded-xl border border-gray-700">
                        <div className="text-xs text-gray-400 font-semibold mb-1 uppercase tracking-wider truncate">{w.wallet_name}</div>
                        <div className="text-xl md:text-2xl font-black text-white">{formatCurrency(w.closing_balance)}</div>
                    </div>
                ))}
                <div className="bg-gradient-to-br from-indigo-600 to-purple-700 p-4 rounded-xl border border-indigo-500 shadow-inner">
                    <div className="text-xs text-indigo-200 font-semibold mb-1 uppercase tracking-wider">Total Aggregated</div>
                    <div className="text-xl md:text-2xl font-black text-white">{formatCurrency(totalWalletsBal)}</div>
                </div>
            </div>
        </div>
      </div>

      {/* ─── SECTION 4: BEST & WORST PERFORMING CENTRES ─── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded-xl shadow-md border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">🏆 Best Performing Centres</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-green-50 p-3 rounded-lg border border-green-100">
              <div className="text-xs text-green-700 font-bold uppercase">Highest Revenue</div>
              <div className="font-bold text-gray-900 mt-1">{bestRevCentre?.centre_name || "N/A"}</div>
              <div className="text-sm text-green-700 font-medium mt-0.5">{bestRevCentre ? formatCurrency(bestRevCentre.total_revenue) : ""}</div>
            </div>
            <div className="bg-blue-50 p-3 rounded-lg border border-blue-100">
              <div className="text-xs text-blue-700 font-bold uppercase">Highest Profit</div>
              <div className="font-bold text-gray-900 mt-1">{bestProfitCentre?.centre_name || "N/A"}</div>
              <div className="text-sm text-blue-700 font-medium mt-0.5">{bestProfitCentre ? formatCurrency(bestProfitCentre.net_profit) : ""}</div>
            </div>
            <div className="bg-emerald-50 p-3 rounded-lg border border-emerald-100">
              <div className="text-xs text-emerald-700 font-bold uppercase">Highest Attendance</div>
              <div className="font-bold text-gray-900 mt-1">{bestAttendance?.centre_name || "N/A"}</div>
              <div className="text-sm text-emerald-700 font-medium mt-0.5">{bestAttendance ? `${bestAttendance.present_days} Days Logged` : ""}</div>
            </div>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-md border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-700 mb-4">⚠️ Needs Attention</h2>
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-rose-50 p-3 rounded-lg border border-rose-100">
              <div className="text-xs text-rose-700 font-bold uppercase">Lowest Revenue</div>
              <div className="font-bold text-gray-900 mt-1">{worstRevCentre?.centre_name || "N/A"}</div>
              <div className="text-sm text-rose-700 font-medium mt-0.5">{worstRevCentre ? formatCurrency(worstRevCentre.total_revenue) : ""}</div>
            </div>
            <div className="bg-rose-50 p-3 rounded-lg border border-rose-100">
              <div className="text-xs text-rose-700 font-bold uppercase">Lowest Profit</div>
              <div className="font-bold text-gray-900 mt-1">{worstProfitCentre?.centre_name || "N/A"}</div>
              <div className="text-sm text-rose-700 font-medium mt-0.5">{worstProfitCentre ? formatCurrency(worstProfitCentre.net_profit) : ""}</div>
            </div>
            <div className="bg-amber-50 p-3 rounded-lg border border-amber-100">
              <div className="text-xs text-amber-700 font-bold uppercase">Delayed Queue</div>
              <div className="font-bold text-gray-900 mt-1">Global Pipeline</div>
              <div className="text-sm text-amber-700 font-medium mt-0.5">{delayedCount} Services &gt; 5 Days Old</div>
            </div>
          </div>
        </div>
      </div>

      {/* ─── SECTION 5: LIVE OPERATIONS ─── */}
      <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
        <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center">
            <FiZap className="mr-2 text-indigo-600 h-5 w-5" /> Live Workflow Status
        </h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-indigo-50 p-4 rounded-xl border border-indigo-100 flex flex-col items-center justify-center text-center">
              <div className="text-3xl font-black text-indigo-600">{pendingCount}</div>
              <div className="text-xs text-indigo-800 font-bold uppercase tracking-wider mt-1">Total Pending</div>
            </div>
            <div className="bg-emerald-50 p-4 rounded-xl border border-emerald-100 flex flex-col items-center justify-center text-center">
              <div className="text-3xl font-black text-emerald-600">{servicesToday}</div>
              <div className="text-xs text-emerald-800 font-bold uppercase tracking-wider mt-1">Logged Today</div>
            </div>
            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex flex-col items-center justify-center text-center">
              <div className="text-3xl font-black text-amber-600">{delayedCount}</div>
              <div className="text-xs text-amber-800 font-bold uppercase tracking-wider mt-1">Delayed SLA</div>
            </div>
            <div className="bg-rose-50 p-4 rounded-xl border border-rose-100 flex flex-col items-center justify-center text-center">
              <div className="text-3xl font-black text-rose-600">{formatCurrency(pendingPayments)}</div>
              <div className="text-xs text-rose-800 font-bold uppercase tracking-wider mt-1">Cash to Collect</div>
            </div>
        </div>
      </div>

      {/* ─── SECTION 6: STAFF & TEAMS ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded-xl shadow-md border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center"><FiUserCheck className="mr-2 text-indigo-600"/> Top Staff Worldwide</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Name</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Role</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Services</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Profit Generated</th>
                </tr>
              </thead>
              <tbody>
                {topStaff.slice(0, 6).map((staff, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-bold text-gray-900">{staff.staff_name}</td>
                    <td className="px-3 py-2 text-gray-500 capitalize">{staff.role}</td>
                    <td className="px-3 py-2 text-right font-medium">{staff.total_services}</td>
                    <td className="px-3 py-2 text-right text-emerald-600 font-bold">{formatCurrency(staff.gross_profit || 0)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="bg-white p-4 rounded-xl shadow-md border border-gray-200">
          <h2 className="text-lg font-semibold text-gray-700 mb-4 flex items-center"><FiUsers className="mr-2 text-amber-500"/> Top Teams Worldwide</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">Team</th>
                  <th className="px-3 py-2 text-center text-xs font-medium text-gray-500">Members</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Services</th>
                  <th className="px-3 py-2 text-right text-xs font-medium text-gray-500">Avg TAT (Hrs)</th>
                </tr>
              </thead>
              <tbody>
                {topTeams.slice(0, 6).map((team, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-3 py-2 font-bold text-gray-900">{team.team_name}</td>
                    <td className="px-3 py-2 text-center">
                        <span className="bg-indigo-100 text-indigo-800 px-2 py-0.5 rounded text-[10px] font-bold">
                            {team.active_members}
                        </span>
                    </td>
                    <td className="px-3 py-2 text-right font-medium">{team.total_services}</td>
                    <td className="px-3 py-2 text-right text-gray-600">{team.avg_tat_hours} Hrs</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ─── SECTION 7: AI INSIGHTS & ACTIONS ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        
        {/* Dynamic AI Insights */}
        <div className="lg:col-span-3 bg-gradient-to-r from-indigo-50 via-purple-50 to-pink-50 p-5 rounded-xl border border-indigo-100 shadow-sm relative overflow-hidden">
            <div className="absolute -right-4 -top-4 opacity-5">
                <FiCpu className="w-48 h-48" />
            </div>
            <h2 className="text-sm font-bold text-indigo-900 uppercase tracking-wider mb-3 flex items-center relative z-10">
                <FiCpu className="mr-2 text-indigo-600 h-5 w-5" /> Live Data Insights
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-2 relative z-10">
                <ul className="space-y-2 text-sm text-gray-700 font-medium">
                    {bestRevCentre && <li className="flex items-start"><span className="text-emerald-500 font-bold mr-2">↑</span> {bestRevCentre.centre_name} leads network revenue with {formatCurrency(bestRevCentre.total_revenue)}.</li>}
                    {worstProfitCentre && worstProfitCentre.net_profit < 0 && <li className="flex items-start"><span className="text-rose-500 font-bold mr-2">↓</span> {worstProfitCentre.centre_name} is operating at a loss of {formatCurrency(Math.abs(worstProfitCentre.net_profit))}.</li>}
                    {topStaff.length > 0 && <li className="flex items-start"><span className="text-indigo-500 font-bold mr-2">★</span> {topStaff[0].staff_name} is the top performing staff member network-wide.</li>}
                </ul>
                <ul className="space-y-2 text-sm text-gray-700 font-medium">
                    {pendingPayments > 0 && <li className="flex items-start"><span className="text-amber-500 font-bold mr-2">⚠</span> {formatCurrency(pendingPayments)} remains uncollected across the network.</li>}
                    <li className="flex items-start"><span className="text-emerald-500 font-bold mr-2">✓</span> {servicesToday} services logged and tracked successfully today.</li>
                    {delayedCount > 0 && <li className="flex items-start"><span className="text-rose-500 font-bold mr-2">!</span> {delayedCount} service applications have breached the 5-day SLA deadline.</li>}
                </ul>
            </div>
        </div>

        {/* Quick Actions Panel */}
        <div className="bg-white p-5 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-sm font-bold text-gray-900 uppercase tracking-wider mb-4 flex items-center">
                <FiZap className="mr-2 text-amber-500 h-5 w-5" /> Quick Links
            </h2>
            <div className="flex flex-col space-y-2">
                <button className="w-full py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition text-sm font-bold shadow-sm">
                    View Network Ledger
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