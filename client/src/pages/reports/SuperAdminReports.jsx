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
      if (!data || !data.stats) {
        return { 
          totalRevenue: "₹0", totalProfit: "₹0", totalWalletBalance: "₹0", 
          revenueChange: 0, profitChange: 0, averageTransaction: "₹0", totalCashInHand: "₹0",
          netCashFlowToday: "₹0", todayProfit: "₹0", totalCashInToday: "₹0", todayServiceCharge: "₹0",
          pendingTransactions: "0"
        };
      }

      // Since the V3 backend calculates everything, we just map it directly!
      // No more complex frontend math or looping through arrays.
      return {
        // YTD / Core Metrics
        totalRevenue: `₹${(data.stats.todayRevenueCollected || 0).toLocaleString()}`, // You may want to fetch YTD from backend later
        totalProfit: `₹${(data.stats.todayNetProfit || 0).toLocaleString()}`, // You may want to fetch YTD from backend later
        
        // Wallet Metrics
        totalWalletBalance: `₹${(data.stats.totalWalletBalance || 0).toLocaleString()}`,
        totalCashInHand: `₹${(data.stats.cashInHand || 0).toLocaleString()}`,
        
        // Today's Activity
        netCashFlowToday: `₹${(data.stats.todayRevenueCollected || 0).toLocaleString()}`,
        todayProfit: `₹${(data.stats.todayNetProfit || 0).toLocaleString()}`,
        totalCashInToday: `₹${(data.stats.todayRevenueCollected || 0).toLocaleString()}`,
        
        // Service Ops & Activity
        todayServiceCharge: `₹${(data.stats.todayGrossProfit || 0).toLocaleString()}`,
        averageTransaction: `₹${(data.stats.averageOrderValue || 0).toLocaleString()}`,
        pendingTransactions: (data.stats.pendingPayments || 0).toString(),
        
        // Mocking change percentages for now (you can add this to the V3 engine later)
        revenueChange: 0,
        profitChange: 0
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
            {activeSection === "overview" && data && (
              <OverviewSection 
                data={data} 
                stats={stats} 
                showCharts={true} 
                timePeriod={timePeriod}
                setTimePeriod={setTimePeriod}
                setActiveSection={setActiveSection}
                readOnly 
              />
            )}
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
