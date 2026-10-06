import React, { useEffect, useState, useMemo } from "react";
import { FiBarChart2, FiLoader, FiChevronDown, FiMapPin } from "react-icons/fi";
import OverviewSection from "./components/OverviewSection";
import SuperAdminWalletsSection from "./components/SuperAdminWalletsSection";
import SuperAdminStaffSection from "./components/SuperAdminStaffSection";
import SuperAdminAccountingSection from "./components/SuperAdminAccountingSection";
import SuperAdminTransactionsSection from "./components/SuperAdminTransactionsSection";
import SuperAdminPendingPayments from "./components/SuperAdminPendingPayments";

const LAST_CENTRE_KEY = "superadmin_reports_centre";
const SECTIONS = ["overview", "wallets", "staff", "accounting", "transactions", "pending"];

const SuperAdminReports = () => {
  const [centres, setCentres] = useState([]);
  const [selectedCentreId, setSelectedCentreId] = useState(null);
  const [activeSection, setActiveSection] = useState("overview");
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState(null);
  const [dataLoading, setDataLoading] = useState(false);
  const [timePeriod, setTimePeriod] = useState("monthly");

  const selectedCentre = useMemo(
    () => centres.find((c) => String(c.id) === String(selectedCentreId)) || null,
    [centres, selectedCentreId]
  );

  // 1. Load centres and auto-select one (last used, else first)
  useEffect(() => {
    const fetchCentres = async () => {
      try {
        const res = await fetch(`${import.meta.env.VITE_API_URL}/api/wallet/centres`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        const result = await res.json();
        const list = Array.isArray(result) ? result : [];
        setCentres(list);

        if (list.length > 0) {
          const saved = localStorage.getItem(LAST_CENTRE_KEY);
          const initial = list.find((c) => String(c.id) === saved) || list[0];
          setSelectedCentreId(initial.id);
        }
      } catch (err) {
        console.error("Failed to load centres", err);
      } finally {
        setLoading(false);
      }
    };
    fetchCentres();
  }, []);

  // 2. Load overview data whenever the centre changes
  useEffect(() => {
    if (!selectedCentreId) return;

    const controller = new AbortController();
    setData(null); // clear old centre's data immediately
    setDataLoading(true);

    fetch(`${import.meta.env.VITE_API_URL}/api/analytics/superadmin/centre/${selectedCentreId}`, {
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      signal: controller.signal,
    })
      .then((res) => res.json())
      .then((result) => {
        setData(result);
        setDataLoading(false);
      })
      .catch((err) => {
        if (err.name !== "AbortError") {
          console.error("Failed to load centre analytics", err);
          setDataLoading(false);
        }
      });

    // cancel the previous request if the user switches quickly
    return () => controller.abort();
  }, [selectedCentreId]);

  const handleCentreChange = (e) => {
    const id = e.target.value;
    setSelectedCentreId(id);
    localStorage.setItem(LAST_CENTRE_KEY, id);
  };

  const stats = useMemo(() => {
    if (!data || !data.stats) {
      return {
        totalRevenue: "₹0", totalProfit: "₹0", totalWalletBalance: "₹0",
        revenueChange: 0, profitChange: 0, averageTransaction: "₹0", totalCashInHand: "₹0",
        netCashFlowToday: "₹0", todayProfit: "₹0", totalCashInToday: "₹0", todayServiceCharge: "₹0",
        pendingTransactions: "0",
      };
    }

    const fmt = (v) => `₹${(v || 0).toLocaleString()}`;
    return {
      totalRevenue: fmt(data.stats.todayRevenueCollected),
      totalProfit: fmt(data.stats.todayNetProfit),
      totalWalletBalance: fmt(data.stats.totalWalletBalance),
      totalCashInHand: fmt(data.stats.cashInHand),
      netCashFlowToday: fmt(data.stats.todayNetProfit),
      todayProfit: fmt(data.stats.todayNetProfit),
      totalCashInToday: fmt(data.stats.todayRevenueCollected),
      todayServiceCharge: fmt(data.stats.todayGrossProfit),
      averageTransaction: fmt(data.stats.averageOrderValue),
      pendingTransactions: (data.stats.pendingPayments || 0).toString(),
      revenueChange: 0,
      profitChange: 0,
    };
  }, [data]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <FiLoader className="animate-spin h-8 w-8 text-indigo-600" />
      </div>
    );
  }

  if (centres.length === 0) {
    return (
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-5xl mx-auto bg-white p-6 rounded-xl border text-gray-600">
          No centres found.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header with centre switcher */}
      <div className="bg-white border-b px-6 py-4 sticky top-0 z-10 flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-xl font-bold flex items-center">
          <FiBarChart2 className="mr-3 text-indigo-600" /> SuperAdmin Reports
        </h1>

        <div className="relative">
          <FiMapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
          <select
            value={selectedCentreId ?? ""}
            onChange={handleCentreChange}
            className="appearance-none bg-white border border-gray-300 rounded-lg pl-9 pr-10 py-2 text-sm font-medium text-gray-800 min-w-[220px] focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 cursor-pointer"
            aria-label="Select centre"
          >
            {centres.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}{c.location ? ` — ${c.location}` : ""}
              </option>
            ))}
          </select>
          <FiChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Section tabs */}
      <div className="border-b bg-white">
        <nav className="flex space-x-8 px-6 overflow-x-auto">
          {SECTIONS.map((id) => (
            <button
              key={id}
              onClick={() => setActiveSection(id)}
              className={`py-4 border-b-2 text-sm font-medium capitalize whitespace-nowrap ${
                activeSection === id
                  ? "border-indigo-600 text-indigo-600"
                  : "border-transparent text-gray-500 hover:text-gray-700"
              }`}
            >
              {id}
            </button>
          ))}
        </nav>
      </div>

      {/* Content. key={centre id} remounts each section on switch, so internal
          state (page number, search, filters, etc.) never leaks between centres. */}
      <div className="p-6">
        {selectedCentre && (
          <>
            {activeSection === "overview" &&
              (dataLoading || !data ? (
                <div className="flex justify-center py-12">
                  <FiLoader className="animate-spin h-8 w-8 text-indigo-600" />
                </div>
              ) : (
                <OverviewSection
                  key={selectedCentre.id}
                  data={data}
                  stats={stats}
                  showCharts={true}
                  timePeriod={timePeriod}
                  setTimePeriod={setTimePeriod}
                  setActiveSection={setActiveSection}
                  readOnly
                />
              ))}

            {activeSection === "wallets" && (
              <SuperAdminWalletsSection key={selectedCentre.id} centreId={selectedCentre.id} />
            )}
            {activeSection === "staff" && (
              <SuperAdminStaffSection key={selectedCentre.id} centreId={selectedCentre.id} />
            )}
            {activeSection === "accounting" && (
              <SuperAdminAccountingSection key={selectedCentre.id} centreId={selectedCentre.id} readOnly />
            )}
            {activeSection === "transactions" && (
              <SuperAdminTransactionsSection key={selectedCentre.id} centreId={selectedCentre.id} readOnly />
            )}
            {activeSection === "pending" && (
              <SuperAdminPendingPayments key={selectedCentre.id} centreId={selectedCentre.id} readOnly />
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default SuperAdminReports;