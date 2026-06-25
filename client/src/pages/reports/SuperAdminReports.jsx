import React, { useEffect, useState, useMemo } from "react";
import { FiBarChart2, FiMapPin, FiArrowLeft, FiFileText, FiDollarSign, FiUsers, FiCreditCard, FiClock, FiLoader } from "react-icons/fi";
import OverviewSection from "./components/OverviewSection";
import SuperAdminWalletsSection from "./components/SuperAdminWalletsSection";
import SuperAdminStaffSection from "./components/SuperAdminStaffSection";
import SuperAdminAccountingSection from "./components/SuperAdminAccountingSection";
import SuperAdminTransactionsSection from "./components/SuperAdminTransactionsSection"; 
import SuperAdminPendingPayments from "./components/SuperAdminPendingPayments";

const SuperAdminReports = () => {
  const [centres, setCentres] = useState([]);
  const [selectedCentre, setSelectedCentre] = useState(null);
  const [activeSection, setActiveSection] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [timePeriod, setTimePeriod] = useState('monthly');

  useEffect(() => {
    const fetchCentres = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/wallet/centres`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });
        const result = await res.json();
        setCentres(result);
        setLoading(false);
      } catch (err) {
        setLoading(false);
      }
    };
    fetchCentres();
  }, []);

  useEffect(() => {
    if (selectedCentre) {
      setDataLoading(true);
      fetch(`${import.meta.env.VITE_API_URL}/api/analytics/superadmin/centre/${selectedCentre.id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
      })
        .then(res => res.json())
        .then(result => {
          setData(result);
          setDataLoading(false);
        })
        .catch(() => setDataLoading(false));
    }
  }, [selectedCentre]);

  const stats = useMemo(() => {
    // Safely return defaults if data isn't ready
    if (!data) {
      return { 
        totalRevenue: "₹0", totalProfit: "₹0", totalWalletBalance: "₹0", 
        revenueChange: 0, averageTransaction: "₹0", totalCashInHand: "₹0" 
      };
    }

    const currentMonth = new Date().getMonth();
    const lastMonth = currentMonth > 0 ? currentMonth - 1 : 11;
    
    // Array Fallbacks to prevent crashes
    const revenue = data.revenue || [];
    const expenses = data.expenses || [];
    const profit = data.profit || [];
    const transactions = data.transactions || [];
    const wallets = data.wallets || [];

    const currentMonthRevenue = revenue[currentMonth] || 0;
    const lastMonthRevenue = revenue[lastMonth] || 0;
    const revenueChange = lastMonthRevenue > 0 
      ? ((currentMonthRevenue - lastMonthRevenue) / lastMonthRevenue * 100).toFixed(1)
      : 0;

    const currentMonthProfit = profit[currentMonth] || 0;
    const lastMonthProfit = profit[lastMonth] || 0;
    const profitChange = lastMonthProfit > 0 
      ? ((currentMonthProfit - lastMonthProfit) / lastMonthProfit * 100).toFixed(1)
      : 0;

    const totalRevenue = revenue.slice(0, currentMonth + 1).reduce((a, b) => a + b, 0);
    const totalExpenses = expenses.slice(0, currentMonth + 1).reduce((a, b) => a + b, 0);
    const totalProfit = totalRevenue - totalExpenses;

    // Transaction stats
    const totalTransactions = transactions.length;
    const averageTransaction = totalTransactions > 0 
      ? Math.round(transactions.reduce((a, b) => a + Number(b.amount || 0), 0) / totalTransactions)
      : 0;

    // Wallet stats
    const totalWalletBalance = wallets.reduce((sum, w) => sum + Number(w.currentBalance || 0), 0);
    const totalCashInHand = Number(wallets.find(w => w.name === 'Cash in Hand')?.currentBalance || 0);
    const totalCashInToday = wallets.reduce((sum, w) => sum + Number(w.todayIn || 0), 0);
    const totalCashOutToday = wallets.reduce((sum, w) => sum + Number(w.todayOut || 0), 0);
    const netCashFlowToday = totalCashInToday - totalCashOutToday;

    return {
      totalRevenue: `₹${totalRevenue.toLocaleString()}`,
      totalProfit: `₹${totalProfit.toLocaleString()}`,
      totalWalletBalance: `₹${totalWalletBalance.toLocaleString()}`,
      netCashFlowToday: `₹${netCashFlowToday.toLocaleString()}`,
      revenueChange: parseFloat(revenueChange),
      profitChange: parseFloat(profitChange),
      todayProfit: `₹${netCashFlowToday.toLocaleString()}`,
      totalCashInToday: `₹${totalCashInToday.toLocaleString()}`,
      averageTransaction: `₹${averageTransaction.toLocaleString()}`,
      totalCashInHand: `₹${totalCashInHand.toLocaleString()}`,
      todayServiceCharge: `₹0`
    };
  }, [data]);

  if (loading) return <div className="flex h-screen items-center justify-center"><FiLoader className="animate-spin h-8 w-8 text-indigo-600" /></div>;

  if (!selectedCentre) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-5xl mx-auto">
          <h1 className="text-2xl font-bold mb-6 flex items-center"><FiBarChart2 className="mr-3 text-indigo-600" /> SuperAdmin Reports</h1>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {centres.map(c => (
              <button key={c.id} onClick={() => setSelectedCentre(c)} className="bg-white p-6 rounded-xl border hover:shadow-md text-left">
                <h3 className="font-bold text-lg">{c.name}</h3>
                <p className="text-sm text-gray-500">{c.location || 'No Location'}</p>
                <div className="mt-4 text-indigo-600 text-sm font-medium">View Detailed Data →</div>
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-6 py-4 sticky top-0 z-10 flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button onClick={() => setSelectedCentre(null)} className="text-indigo-600 flex items-center"><FiArrowLeft className="mr-1" /> Back</button>
          <h1 className="text-xl font-bold">{selectedCentre.name} Analytics</h1>
        </div>
      </div>

      <div className="border-b bg-white">
        <nav className="flex space-x-8 px-6 overflow-x-auto">
          {['overview', 'wallets', 'staff', 'accounting', 'transactions', 'pending'].map(id => (
            <button 
              key={id} 
              onClick={() => setActiveSection(id)}
              className={`py-4 border-b-2 text-sm font-medium capitalize ${activeSection === id ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500'}`}
            >
              {id}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-6">
        {dataLoading ? (
          <div className="flex justify-center py-12"><FiLoader className="animate-spin h-8 w-8 text-indigo-600" /></div>
        ) : (
          <>
            {activeSection === "overview" && data && <OverviewSection data={data} stats={stats} showCharts={true} readOnly />}
            {activeSection === "wallets" && <SuperAdminWalletsSection centreId={selectedCentre.id} />}
            {activeSection === "staff" && <SuperAdminStaffSection centreId={selectedCentre.id} />}
            {activeSection === "accounting" && <SuperAdminAccountingSection centreId={selectedCentre.id} readOnly />}
            {activeSection === "transactions" && <SuperAdminTransactionsSection centreId={selectedCentre.id} readOnly />}
            {activeSection === "pending" && <SuperAdminPendingPayments centreId={selectedCentre.id} readOnly />}
          </>
        )}
      </div>
    </div>
  );
};

export default SuperAdminReports;
