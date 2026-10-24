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
      <div className="flex h-screen items-center justify-center bg-gradient-to-br from-gray-50 to-indigo-50">
        <FiLoader className="h-8 w-8 animate-spin text-navy-700" />
      </div>
    );
  }

  if (centres.length === 0) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50 p-4 sm:p-6">
        <div className="w-full rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
          No centres found.
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50 p-4 sm:p-6">
      <div className="w-full">
        {/* Header with centre switcher */}
        <div className="mb-6 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-center gap-3">
            <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-navy-700 text-white">
              <FiBarChart2 className="h-6 w-6" />
            </span>
            <div>
              <h1 className="text-2xl font-bold text-slate-900 md:text-3xl">SuperAdmin Reports</h1>
              <p className="mt-0.5 text-sm text-slate-500">Financial reports for each centre</p>
            </div>
          </div>

          <div className="relative">
            <FiMapPin className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <select
              value={selectedCentreId ?? ""}
              onChange={handleCentreChange}
              className="w-full min-w-[240px] cursor-pointer appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-10 pr-10 text-sm font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-navy-500/40 md:w-auto"
              aria-label="Select centre"
            >
              {centres.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}{c.location ? ` — ${c.location}` : ""}
                </option>
              ))}
            </select>
            <FiChevronDown className="pointer-events-none absolute right-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          </div>
        </div>

        {/* Section tabs */}
        <div className="mb-6 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1.5" role="tablist" aria-label="Report sections">
          <div className="flex gap-1">
            {SECTIONS.map((id) => (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={activeSection === id}
                onClick={() => setActiveSection(id)}
                className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-medium capitalize transition ${
                  activeSection === id ? "bg-navy-700 text-white" : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {id}
              </button>
            ))}
          </div>
        </div>

        {/* Content. key={centre id} remounts each section on switch, so internal
            state (page number, search, filters, etc.) never leaks between centres. */}
        <div>
          {selectedCentre && (
            <>
              {activeSection === "overview" &&
                (dataLoading || !data ? (
                  <div className="flex justify-center py-12">
                    <FiLoader className="h-8 w-8 animate-spin text-navy-700" />
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
    </div>
  );
};

export default SuperAdminReports;