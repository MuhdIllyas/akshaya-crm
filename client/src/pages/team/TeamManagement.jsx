// TeamManagement.jsx
import React, { useState, useEffect, useMemo, Fragment } from "react";
import {
  FiUsers, FiGlobe, FiHome, FiBarChart2, FiSearch, FiPlus, FiX,
  FiUser, FiUserPlus, FiCheck, FiEdit, FiTrash2, FiStar, FiChevronDown, FiChevronUp, FiLoader,
  FiTrendingUp, FiPieChart, FiCalendar, FiTarget, FiDollarSign, FiBriefcase
} from "react-icons/fi";
import {
  Chart as ChartJS, CategoryScale, LinearScale, BarElement,
  LineElement, PointElement, Title, Tooltip, Legend, Filler, ArcElement
} from "chart.js";
import { Line, Doughnut } from "react-chartjs-2";
import { toast } from "react-toastify";

ChartJS.register(
  CategoryScale, LinearScale, BarElement, LineElement, PointElement,
  Title, Tooltip, Legend, Filler, ArcElement
);

// ----------------------------------------------------------------------
// JWT helper – exactly as in CalendarPage.jsx
// ----------------------------------------------------------------------
function getTokenClaims() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  try {
    const payload = token.split(".")[1];
    const decoded = JSON.parse(atob(payload));
    return {
      id: decoded.id,
      role: decoded.role,
      centreId: decoded.centre_id,
      name: decoded.name,
    };
  } catch {
    return null;
  }
}

const API_BASE = import.meta.env.VITE_API_URL || "";

/* ---------- SUB-COMPONENTS ---------- */
const StatCard = ({ title, value, icon: Icon, color, subtitle }) => (
  <div className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm">
    <div className="flex items-center justify-between">
      <div>
        <p className="font-medium text-gray-500 mb-1 text-xs uppercase tracking-wider">{title}</p>
        <p className="font-bold text-gray-900 mb-1 text-2xl">{value}</p>
        {subtitle && <p className="text-gray-400 text-xs font-medium">{subtitle}</p>}
      </div>
      <div className={`rounded-xl ${color} p-3`}><Icon className="text-white h-6 w-6" /></div>
    </div>
  </div>
);

const inr = (val) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val || 0);

const TargetProgressBar = ({ label, current, target }) => {
  const safeTarget = target || 1;
  const raw = (current / safeTarget) * 100;
  const percentage = Math.min(raw, 100).toFixed(0);

  return (
    <div className="mb-4">
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-gray-600 font-semibold">{inr(current)} / {inr(target)} ({raw.toFixed(0)}%)</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2.5">
        <div className={`h-2.5 rounded-full ${raw >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${percentage}%` }}></div>
      </div>
    </div>
  );
};

// Compact "₹a / ₹t  42%" bar used in the team table and the roster
const MiniTargetBar = ({ achieved, target, onPace }) => {
  if (!target) return <span className="text-xs text-gray-400">No target set</span>;
  const raw = (achieved / target) * 100;
  const color = raw >= 100 ? "bg-emerald-500" : onPace ? "bg-indigo-500" : "bg-amber-500";
  return (
    <div className="min-w-[140px]">
      <div className="flex justify-between gap-2 text-xs">
        <span className="text-gray-600 tabular-nums">{inr(achieved)} / {inr(target)}</span>
        <span className="font-semibold text-gray-800 tabular-nums">{raw.toFixed(0)}%</span>
      </div>
      <div className="mt-1 h-1.5 w-full rounded-full bg-gray-100">
        <div className={`h-1.5 rounded-full ${color}`} style={{ width: `${Math.min(raw, 100)}%` }} />
      </div>
    </div>
  );
};

// ---- Period filter (same options and IST day boundaries as the dashboards) ----
const PERIOD_OPTIONS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "3months", label: "Last 3 Months" },
  { value: "6months", label: "Last 6 Months" },
  { value: "year", label: "This Year" },
];

const getDatesFromPeriod = (period) => {
  const today = new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  const [y, m, d] = today.split("-").map(Number);
  let start;
  switch (period) {
    case "today": start = new Date(Date.UTC(y, m - 1, d)); break;
    case "week": {
      const dow = new Date(Date.UTC(y, m - 1, d)).getUTCDay();
      start = new Date(Date.UTC(y, m - 1, d - (dow === 0 ? 6 : dow - 1)));
      break;
    }
    case "3months": start = new Date(Date.UTC(y, m - 3, 1)); break;
    case "6months": start = new Date(Date.UTC(y, m - 6, 1)); break;
    case "year": start = new Date(Date.UTC(y, 0, 1)); break;
    case "month":
    default: start = new Date(Date.UTC(y, m - 1, 1));
  }
  return { from: start.toISOString().split("T")[0], to: today };
};

// ----------------------------------------------------------------------
// TeamManagement Component
// ----------------------------------------------------------------------
const TeamManagement = () => {
  // ---- Auth from JWT ----
  const claims = getTokenClaims();
  const user = claims || { id: null, role: "staff", centreId: null, name: "" };
  const isAdmin = ["admin", "superadmin"].includes(user.role);
  const isSuperAdmin = user.role === "superadmin";

  // ---- State ----
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [totalStats, setTotalStats] = useState({
    total: 0,
    global: 0,
    centre: 0,
    members: 0,
  });

  // Service-charge data from the analytics endpoint
  const [financialData, setFinancialData] = useState({ teams: [], totals: {} });

  // Filters
  const [period, setPeriod] = useState("month");
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all"); 
  const [centreFilter, setCentreFilter] = useState("all");

  // Centres list (superadmin) + admin's own centre name
  const [centres, setCentres] = useState([]);
  const [adminCentreName, setAdminCentreName] = useState("");

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showManageMembersModal, setShowManageMembersModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);

  // Analytics modal state
  const [showAnalyticsModal, setShowAnalyticsModal] = useState(false);
  const [analyticsTeam, setAnalyticsTeam] = useState(null);
  const [analyticsTab, setAnalyticsTab] = useState("overview"); 
  const [contributionData, setContributionData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [serviceMix, setServiceMix] = useState([]);
  const [teamTargets, setTeamTargets] = useState(null); // sum of members' targets, this month
  const [trendYear, setTrendYear] = useState(new Date().getFullYear());
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // --- EXPANDABLE ROW STATE (Replaces the Manage Members Modal) ---
  const [expandedTeamId, setExpandedTeamId] = useState(null);
  const [teamMembersMap, setTeamMembersMap] = useState({});
  const [teamTargetsMap, setTeamTargetsMap] = useState({});
  const [membersLoading, setMembersLoading] = useState(false);

  const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

  // Roster + this month's targets for one team (members and targets are fetched together)
  const loadTeamExtras = async (teamId) => {
    const [membersRes, targetsRes] = await Promise.all([
      fetch(`${API_BASE}/api/teams/${teamId}/members`, { headers: authHeaders() }),
      fetch(`${API_BASE}/api/teams/${teamId}/targets`, { headers: authHeaders() }).catch(() => ({ ok: false })),
    ]);
    const membersData = await membersRes.json();
    setTeamMembersMap((prev) => ({ ...prev, [teamId]: Array.isArray(membersData) ? membersData : [] }));
    if (targetsRes.ok) {
      const targetsData = await targetsRes.json();
      setTeamTargetsMap((prev) => ({ ...prev, [teamId]: targetsData }));
    }
  };

  const toggleTeamExpand = async (team) => {
    if (expandedTeamId === team.id) {
      setExpandedTeamId(null);
      return;
    }
    setExpandedTeamId(team.id);
    setMembersLoading(true);
    try {
      await loadTeamExtras(team.id);
    } catch (error) {
      console.error("Fetch members failed:", error);
    } finally {
      setMembersLoading(false);
    }
  };

  const handleInlineAddMember = async (teamId) => {
    const staffId = Number(addMemberValue);
    if (!teamId || !staffId) return;
    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/api/teams/${teamId}/members`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...authHeaders() },
        body: JSON.stringify({ staff_id: staffId, is_primary: false }),
      });
      if (!response.ok) throw new Error("Failed to add member");

      await loadTeamExtras(teamId); // refresh just this row, targets included
      setAddMemberValue("");
      fetchTeams(); fetchFinancials();
    } catch (error) { toast.error(error.message); } finally { setSubmitting(false); }
  };

  const handleInlineRemoveMember = async (teamId, staffId) => {
    if (!window.confirm("Remove this member?")) return;
    setSubmitting(true);
    try {
      await fetch(`${API_BASE}/api/teams/${teamId}/members/${staffId}`, {
        method: "DELETE",
        headers: authHeaders(),
      });
      await loadTeamExtras(teamId);
      fetchTeams(); fetchFinancials();
    } catch (error) { console.error(error); } finally { setSubmitting(false); }
  };

  const handleInlineSetPrimary = async (teamId, memberId) => {
    setSubmitting(true);
    try {
      await fetch(`${API_BASE}/api/teams/member/${memberId}/primary`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const updatedRes = await fetch(`${API_BASE}/api/teams/${teamId}/members`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }});
      const updatedMembers = await updatedRes.json();
      setTeamMembersMap(prev => ({ ...prev, [teamId]: updatedMembers }));
    } catch (error) { console.error(error); } finally { setSubmitting(false); }
  };

  // Targets switch (the amount itself is the sum of members' individual targets)
  const [targetsEnabled, setTargetsEnabled] = useState(false);
  const [savingSettings, setSavingSettings] = useState(false);

  const handleSaveSettings = async () => {
    if (!analyticsTeam) return;
    setSavingSettings(true);
    try {
      const response = await fetch(`${API_BASE}/api/teams/${analyticsTeam.id}/settings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`
        },
        body: JSON.stringify({ targets_enabled: targetsEnabled }),
      });
      if (!response.ok) throw new Error("Failed to save settings");
      toast.success("Team settings saved successfully!");
    } catch (error) {
      toast.error(error.message);
    } finally {
      setSavingSettings(false);
    }
  };

  // Form for create / edit team
  const [teamForm, setTeamForm] = useState({
    name: "",
    description: "",
    is_global: false,
    centre_id: null,
    members: [],
  });

  // Available staff for member selection
  const [availableStaff, setAvailableStaff] = useState([]);
  const [addMemberValue, setAddMemberValue] = useState("");

  // ------------------------------------------------------------------
  // Fetch teams
  // ------------------------------------------------------------------
  const fetchTeams = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/teams`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const data = await response.json();
      setTeams(data);

      const total = data.length;
      const global = data.filter((t) => t.is_global).length;
      const centre = total - global;
      const members = data.reduce(
        (sum, t) => sum + Number(t.member_count),
        0
      );
      setTotalStats({ total, global, centre, members });
    } catch (error) {
      console.error("Fetch teams failed:", error);
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // Fetch financial summary (Now with Date Filters!)
  // ------------------------------------------------------------------
  const fetchFinancials = async () => {
    try {
      const { from, to } = getDatesFromPeriod(period);
      const response = await fetch(`${API_BASE}/api/teams/analytics/summary?from=${from}&to=${to}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (response.ok) {
        const data = await response.json();
        setFinancialData(data);
      }
    } catch (error) {
      console.error("Fetch financials failed:", error);
    }
  };

  // ------------------------------------------------------------------
  // Fetch centres (superadmin = all, admin = own)
  // ------------------------------------------------------------------
  const fetchCentres = async () => {
    if (isSuperAdmin) {
      try {
        const response = await fetch(`${API_BASE}/api/wallet/centres`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        const data = await response.json();
        setCentres(Array.isArray(data) ? data : data.centres || []);
      } catch (error) {
        console.error("Fetch centres failed:", error);
      }
    } else if (isAdmin) {
      try {
        const response = await fetch(`${API_BASE}/api/centres/${user.centreId}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        });
        if (response.ok) {
          const centre = await response.json();
          setAdminCentreName(centre.name || "");
        }
      } catch (error) {
        console.error("Fetch admin centre failed:", error);
      }
    }
  };

  // Helper to get centre name by ID
  const getCentreName = (centreId) => {
    if (isSuperAdmin) {
      const centre = centres.find((c) => c.id === centreId);
      return centre?.name || `Centre #${centreId}`;
    }
    if (isAdmin) {
      return adminCentreName || `Centre #${centreId}`;
    }
    return `Centre #${centreId}`;
  };

  // ------------------------------------------------------------------
  // Fetch staff (same logic as CalendarPage)
  // ------------------------------------------------------------------
  const fetchStaff = async () => {
    try {
      let url = `${API_BASE}/api/servicemanagement/staff`;
      if (!isSuperAdmin) {
        url += `?centre_id=${user.centreId}`;
      }
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!response.ok) throw new Error("Failed to fetch staff");
      const data = await response.json();
      const staffList = Array.isArray(data) ? data : data.staff || [];
      setAvailableStaff(staffList);
    } catch (error) {
      console.error("Fetch staff failed:", error);
      setAvailableStaff([]);
    }
  };

  // Initial load (Static data)
  useEffect(() => {
    fetchTeams();
    fetchCentres();
    fetchStaff();
  }, []);

  // Dynamic load (Fires when period changes)
  useEffect(() => {
    fetchFinancials();
  }, [period]);

  // ------------------------------------------------------------------
  // Merge team list with financials
  // ------------------------------------------------------------------
  const mergedTeams = useMemo(() => {
    return teams.map((team) => {
      const fin = (financialData.teams || []).find((t) => t.id === team.id);
      return {
        ...team,
        service_charges: fin ? fin.service_charges : 0,
        services_completed: fin ? fin.services_completed : 0,
        revenue_billed: fin ? fin.revenue_billed : 0,
        expense: fin ? fin.expense : 0,
        net_profit: fin ? fin.net_profit : 0,
        targets: fin ? fin.targets : null,
      };
    });
  }, [teams, financialData]);

  // ------------------------------------------------------------------
  // Filtered teams
  // ------------------------------------------------------------------
  const filteredTeams = useMemo(() => {
    return mergedTeams.filter((team) => {
      const matchesSearch = team.name
        .toLowerCase()
        .includes(searchTerm.toLowerCase());
      const matchesType =
        typeFilter === "all" ||
        (typeFilter === "centre" && !team.is_global) ||
        (typeFilter === "global" && team.is_global);
      const matchesCentre =
        centreFilter === "all" || String(team.centre_id) === centreFilter;
      return matchesSearch && matchesType && matchesCentre;
    });
  }, [mergedTeams, searchTerm, typeFilter, centreFilter]);

  // ------------------------------------------------------------------
  // Currency formatter
  // ------------------------------------------------------------------
  const formatCurrency = (value) => inr(value);

  // ------------------------------------------------------------------
  // Create team modal helpers
  // ------------------------------------------------------------------
  const openCreateModal = () => {
    setTeamForm({
      name: "",
      description: "",
      is_global: false,
      centre_id: user.role === "admin" ? user.centreId : null,
      members: [],
    });
    fetchStaff();
    setShowCreateModal(true);
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!teamForm.name.trim()) return alert("Team name is required");
    if (submitting) return;

    setSubmitting(true);
    try {
      const payload = {
        name: teamForm.name.trim(),
        description: teamForm.description,
        is_global: teamForm.is_global,
        centre_id: teamForm.centre_id,
        members: teamForm.members.map((staffId) => ({
          staff_id: staffId,
          is_primary: false,
        })),
      };

      const response = await fetch(`${API_BASE}/api/teams`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to create team");

      setShowCreateModal(false);
      fetchTeams();
      fetchFinancials();
    } catch (error) {
      alert(error.message || "Error creating team");
    } finally {
      setSubmitting(false);
    }
  };

  const addMemberToForm = (staffId) => {
    if (!staffId) return;
    setTeamForm((prev) => ({
      ...prev,
      members: prev.members.includes(staffId)
        ? prev.members
        : [...prev.members, staffId],
    }));
  };

  const removeMemberFromForm = (staffId) => {
    setTeamForm((prev) => ({
      ...prev,
      members: prev.members.filter((id) => id !== staffId),
    }));
  };

  // ------------------------------------------------------------------
  // Manage members modal helpers
  // ------------------------------------------------------------------
  const openManageMembers = async (team) => {
    setSelectedTeam(team);
    fetchStaff();
    try {
      const response = await fetch(`${API_BASE}/api/teams/${team.id}/members`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const membersData = await response.json();
      setSelectedTeam((prev) => ({ ...prev, membersList: membersData }));
      setAddMemberValue("");
      setShowManageMembersModal(true);
    } catch (error) {
      console.error("Fetch members failed:", error);
    }
  };

  const handleSetPrimary = async (memberId) => {
    try {
      await fetch(`${API_BASE}/api/teams/member/${memberId}/primary`, {
        method: "PUT",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (selectedTeam) openManageMembers(selectedTeam);
    } catch (error) {
      console.error("Set primary failed:", error);
    }
  };

  const handleRemoveMember = async (teamId, staffId) => {
    if (!window.confirm("Remove this member?")) return;
    try {
      await fetch(`${API_BASE}/api/teams/${teamId}/members/${staffId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (selectedTeam) openManageMembers(selectedTeam);
      fetchTeams();
      fetchFinancials();
    } catch (error) {
      console.error("Remove member failed:", error);
    }
  };

  const handleAddMemberToTeam = async (staffId) => {
    if (!selectedTeam || !staffId) return;
    setSubmitting(true);
    try {
      const response = await fetch(
        `${API_BASE}/api/teams/${selectedTeam.id}/members`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
          body: JSON.stringify({ staff_id: staffId, is_primary: false }),
        }
      );
      if (!response.ok) throw new Error("Failed to add member");

      const updatedRes = await fetch(
        `${API_BASE}/api/teams/${selectedTeam.id}/members`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem("token")}`,
          },
        }
      );
      const updatedMembers = await updatedRes.json();
      setSelectedTeam((prev) => ({ ...prev, membersList: updatedMembers }));
      setAddMemberValue("");
      fetchTeams();
      fetchFinancials();
    } catch (error) {
      alert(error.message || "Error adding member");
    } finally {
      setSubmitting(false);
    }
  };

  // ------------------------------------------------------------------
  // Delete team
  // ------------------------------------------------------------------
  const handleDeleteTeam = async (teamId) => {
    if (!window.confirm("Delete this team? This action cannot be undone."))
      return;
    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/api/teams/${teamId}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (!response.ok) throw new Error("Failed to delete team");
      fetchTeams();
      fetchFinancials();
    } catch (error) {
      alert(error.message || "Error deleting team");
    } finally {
      setSubmitting(false);
    }
  };

  // ------------------------------------------------------------------
  // Analytics modal helpers
  // ------------------------------------------------------------------
  const fetchAnalyticsData = async (teamId) => {
    setAnalyticsLoading(true);
    try {
      const headers = { Authorization: `Bearer ${localStorage.getItem("token")}` };
      const { from, to } = getDatesFromPeriod(period);
      const range = `from=${from}&to=${to}`;

      // Fetch everything at the same time
      const [contribRes, trendRes, mixRes, settingsRes, targetsRes] = await Promise.all([
        fetch(`${API_BASE}/api/teams/${teamId}/contribution?${range}`, { headers }),
        fetch(`${API_BASE}/api/teams/${teamId}/trend?year=${trendYear}`, { headers }),
        fetch(`${API_BASE}/api/teams/${teamId}/service-mix?${range}`, { headers }).catch(() => ({ ok: false })),
        fetch(`${API_BASE}/api/teams/${teamId}/settings`, { headers }).catch(() => ({ ok: false })),
        fetch(`${API_BASE}/api/teams/${teamId}/targets`, { headers }).catch(() => ({ ok: false })),
      ]);

      setContributionData(contribRes.ok ? await contribRes.json() : []);
      setTrendData(trendRes.ok ? await trendRes.json() : []);
      setServiceMix(mixRes.ok ? await mixRes.json() : []);
      setTeamTargets(targetsRes.ok ? await targetsRes.json() : null);

      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setTargetsEnabled(!!settingsData.targets_enabled);
      } else {
        setTargetsEnabled(false);
      }

    } catch (err) {
      console.error(err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const openAnalyticsModal = (team) => {
    setAnalyticsTeam(team);
    setAnalyticsTab("overview");
    setShowAnalyticsModal(true);
    fetchAnalyticsData(team.id);
  };

  // Analytics calculations for the team dashboard
  const activeTeamStats = useMemo(() => mergedTeams.find(t => t.id === analyticsTeam?.id), [analyticsTeam, mergedTeams]);
  const netMargin = activeTeamStats && activeTeamStats.service_charges > 0
    ? ((activeTeamStats.net_profit / activeTeamStats.service_charges) * 100).toFixed(1)
    : 0;
  const periodLabel = PERIOD_OPTIONS.find((o) => o.value === period)?.label || "";

  const trendChartData = useMemo(() => {
    if (!trendData.length) return null;
    // no point plotting months that have not happened yet
    const lastMonth = trendYear === new Date().getFullYear() ? new Date().getMonth() + 1 : 12;
    const shown = trendData.filter((t) => t.month <= lastMonth);
    return {
      labels: shown.map(t => ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][t.month - 1]),
      datasets: [{ label: 'Service charges (₹)', data: shown.map(t => t.service_charges), borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true }]
    };
  }, [trendData, trendYear]);

  const doughnutData = {
    labels: serviceMix.map(s => s.service_type),
    datasets: [{ data: serviceMix.map(s => s.total), backgroundColor: ["#3B82F6", "#10B981", "#EF4444", "#F59E0B", "#8B5CF6", "#0891B2", "#94A3B8"], borderWidth: 0 }]
  };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50 p-4 sm:p-6">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-800">
              Teams Management
            </h1>
            <p className="text-gray-600 mt-1">
              Service charges and monthly targets for centre and global teams
            </p>
          </div>
          <div className="flex flex-wrap gap-3 mt-4 md:mt-0">
            <div className="relative">
              <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search teams..."
                className="pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            {isAdmin && (
              <button
                onClick={openCreateModal}
                disabled={submitting}
                className="bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-medium px-4 py-2.5 rounded-xl flex items-center transition-all shadow-md hover:shadow-lg"
              >
                <FiPlus className="mr-2" /> Create Team
              </button>
            )}
          </div>
        </div>

        {/* Top Stats Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5 mb-8">
          <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600">Total Teams</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {totalStats.total}
                </p>
              </div>
              <div className="bg-indigo-100 p-3 rounded-xl">
                <FiUsers className="text-indigo-600 text-xl" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600">Global Teams</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {totalStats.global}
                </p>
              </div>
              <div className="bg-purple-100 p-3 rounded-xl">
                <FiGlobe className="text-purple-600 text-xl" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600">Centre Teams</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {totalStats.centre}
                </p>
              </div>
              <div className="bg-blue-100 p-3 rounded-xl">
                <FiHome className="text-blue-600 text-xl" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm p-5 border border-gray-100">
            <div className="flex justify-between items-center">
              <div>
                <p className="text-sm text-gray-600">Total Members</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">
                  {totalStats.members}
                </p>
              </div>
              <div className="bg-green-100 p-3 rounded-xl">
                <FiBarChart2 className="text-green-600 text-xl" />
              </div>
            </div>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap items-center gap-4 mb-6 bg-white p-4 rounded-2xl shadow-sm border border-gray-100">
          
          {/* PERIOD FILTER (service charges, expenses). Targets are always this month. */}
          <div className="flex items-center gap-2 bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-sm">
            <FiCalendar className="text-gray-500" />
            <select 
              value={period} 
              onChange={(e) => setPeriod(e.target.value)} 
              className="bg-transparent focus:outline-none text-gray-700 font-semibold cursor-pointer"
            >
              {PERIOD_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* Existing Filters */}
          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">All Types</option>
            <option value="centre">Centre Teams</option>
            <option value="global">Global Teams</option>
          </select>
          
          {isSuperAdmin && (
            <select
              value={centreFilter}
              onChange={(e) => setCentreFilter(e.target.value)}
              className="border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="all">All Centres</option>
              {centres.map((centre) => (
                <option key={centre.id} value={centre.id}>
                  {centre.name}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Teams Table */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="py-4 px-5 text-left text-sm font-semibold text-gray-600">
                    Team
                  </th>
                  <th className="py-4 px-5 text-center text-sm font-semibold text-gray-600">
                    Type
                  </th>
                  <th className="py-4 px-5 text-center text-sm font-semibold text-gray-600">
                    Members
                  </th>
                  <th className="py-4 px-5 text-right text-sm font-semibold text-gray-600">
                    Service Charges
                  </th>
                  <th className="py-4 px-5 text-right text-sm font-semibold text-gray-600">
                    Expense
                  </th>
                  <th className="py-4 px-5 text-right text-sm font-semibold text-gray-600">
                    Net Profit
                  </th>
                  <th className="py-4 px-5 text-left text-sm font-semibold text-gray-600">
                    Monthly Target
                  </th>
                  <th className="py-4 px-5 text-center text-sm font-semibold text-gray-600">
                    Actions
                  </th>
                </tr>
              </thead>
              <tbody>
                {filteredTeams.map((team) => (
                  <Fragment key={team.id}>
                    
                    {/* --- MAIN ROW --- */}
                    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-5">
                        <div className="flex items-center">
                          {/* The Arrow */}
                          <button onClick={() => toggleTeamExpand(team)} className="mr-3 p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition">
                             {expandedTeamId === team.id ? <FiChevronUp size={20}/> : <FiChevronDown size={20}/>}
                          </button>
                          
                          <div className={`p-2 rounded-lg mr-3 ${team.is_global ? "bg-purple-100 text-purple-800" : "bg-indigo-100 text-indigo-800"}`}>
                            {team.is_global ? <FiGlobe /> : <FiHome />}
                          </div>
                          <div>
                            <p className="font-bold text-gray-800 cursor-pointer hover:text-indigo-600 transition" onClick={() => toggleTeamExpand(team)}>
                              {team.name}
                            </p>
                            <p className="text-xs text-gray-500">{team.centre_id ? getCentreName(team.centre_id) : "Cross-Centre"}</p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-5 text-center"><span className="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">{team.is_global ? "Global" : "Centre"}</span></td>
                      <td className="py-4 px-5 text-center font-bold text-gray-700">{team.member_count}</td>
                      <td className="py-4 px-5 text-right text-emerald-600 font-medium">{formatCurrency(team.service_charges)}</td>
                      <td className="py-4 px-5 text-right text-red-500 font-medium">{formatCurrency(team.expense)}</td>

                      <td className={`py-4 px-5 text-right font-bold ${team.net_profit < 0 ? "text-rose-600" : "text-indigo-600"}`}>{formatCurrency(team.net_profit)}</td>
                      <td className="py-4 px-5">
                        <MiniTargetBar
                          achieved={team.targets?.achieved || 0}
                          target={team.targets?.target || 0}
                          onPace={team.targets?.onPace}
                        />
                      </td>
                      <td className="py-4 px-5 text-center">
                        <div className="flex justify-center gap-2">
                          <button onClick={() => openAnalyticsModal(team)} className="text-teal-600 hover:text-teal-800 p-1.5 rounded-lg hover:bg-teal-50" title="View Dashboard">
                            <FiBarChart2 size={18} />
                          </button>
                          {isAdmin && (
                            <button onClick={() => handleDeleteTeam(team.id)} disabled={submitting} className="text-red-600 hover:text-red-800 p-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50" title="Delete">
                              <FiTrash2 size={18} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* --- EXPANDED ROW (STAFF DETAILS) --- */}
                    {expandedTeamId === team.id && (
                      <tr className="bg-slate-50 border-b-2 border-indigo-100 shadow-inner">
                         <td colSpan="8" className="p-0">
                           <div className="px-14 py-6">
                             {membersLoading ? (
                                <div className="text-gray-500 text-sm py-4 flex items-center"><FiLoader className="animate-spin mr-2"/> Loading members...</div>
                             ) : (
                                <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-sm">
                                  
                                  {/* Expanded Header & Add Member */}
                                  <div className="flex justify-between items-center mb-5 border-b border-gray-100 pb-4">
                                    <h4 className="font-bold text-gray-800 flex items-center gap-2">
                                       <FiUsers className="text-indigo-600"/> Team Roster
                                    </h4>
                                    <div className="flex gap-2">
                                       <select 
                                         className="border border-gray-200 rounded-lg px-3 py-1.5 text-sm focus:ring-indigo-500 bg-gray-50 outline-none"
                                         value={addMemberValue} onChange={(e) => setAddMemberValue(e.target.value)}
                                       >
                                          <option value="">+ Add Staff to {team.name}</option>
                                          {availableStaff.filter(s => !teamMembersMap[team.id]?.some(m => m.staff_id === s.id)).map(staff => (
                                             <option key={staff.id} value={staff.id}>{staff.name} ({staff.role})</option>
                                          ))}
                                       </select>
                                       <button onClick={() => handleInlineAddMember(team.id)} disabled={!addMemberValue || submitting} className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-1.5 rounded-lg text-sm disabled:opacity-50 font-medium shadow-sm transition">Add</button>
                                    </div>
                                  </div>
                                  
                                  {/* Team target = sum of members' targets */}
                                  {teamTargetsMap[team.id] && (
                                    <div className="mb-5 rounded-xl border border-indigo-100 bg-indigo-50/40 p-4">
                                      {teamTargetsMap[team.id].target > 0 ? (
                                        <>
                                          <TargetProgressBar
                                            label={`Team target this month (${teamTargetsMap[team.id].membersWithTarget} of ${teamTargetsMap[team.id].memberCount} members have one)`}
                                            current={teamTargetsMap[team.id].achieved}
                                            target={teamTargetsMap[team.id].target}
                                          />
                                          <p className="text-xs text-gray-500">
                                            Today {inr(teamTargetsMap[team.id].today)} of {inr(teamTargetsMap[team.id].dailyTarget)} daily target
                                            {" · "}{teamTargetsMap[team.id].metToday} of {teamTargetsMap[team.id].membersWithTarget} met today
                                          </p>
                                        </>
                                      ) : (
                                        <p className="text-sm text-gray-600">No member of this team has a target for this month, so the team has no target yet.</p>
                                      )}
                                    </div>
                                  )}

                                  {/* Staff Grid */}
                                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                     {teamMembersMap[team.id]?.map(member => (
                                       <div key={member.id} className="flex items-center justify-between p-3 border border-gray-100 rounded-xl hover:border-indigo-200 hover:bg-indigo-50/50 transition">
                                          <div className="flex items-center gap-3">
                                             <div className="w-9 h-9 rounded-full bg-gradient-to-br from-indigo-100 to-purple-100 text-indigo-700 flex items-center justify-center font-bold text-sm shadow-sm">
                                               {member.name.charAt(0)}
                                             </div>
                                             <div>
                                                <p className="text-sm font-bold text-gray-800">{member.name} {member.is_primary && <FiStar className="inline text-amber-500 ml-1 mb-0.5"/>}</p>
                                                <p className="text-[10px] font-semibold text-gray-500 uppercase tracking-wider mt-0.5">{member.role} • {member.centre_name}</p>
                                                {(() => {
                                                  const t = teamTargetsMap[team.id]?.members?.find((x) => x.staff_id === member.staff_id);
                                                  return t ? (
                                                    <div className="mt-2"><MiniTargetBar achieved={t.achieved} target={t.target} onPace={t.on_pace} /></div>
                                                  ) : null;
                                                })()}
                                             </div>
                                          </div>
                                          <div className="flex gap-1">
                                            {isAdmin && !member.is_primary && (
                                               <button onClick={() => handleInlineSetPrimary(team.id, member.id)} className="text-amber-500 hover:bg-amber-50 p-1.5 rounded-lg transition" title="Make Primary"><FiStar size={16}/></button>
                                            )}
                                            {isAdmin && (
                                               <button onClick={() => handleInlineRemoveMember(team.id, member.staff_id)} className="text-red-500 hover:bg-red-50 p-1.5 rounded-lg transition" title="Remove"><FiTrash2 size={16}/></button>
                                            )}
                                          </div>
                                       </div>
                                     ))}
                                     {teamMembersMap[team.id]?.length === 0 && <p className="text-sm text-gray-500 col-span-3 py-4 text-center italic">No members assigned to this team yet.</p>}
                                  </div>
                                  
                                </div>
                             )}
                           </div>
                         </td>
                      </tr>
                    )}

                  </Fragment>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* ---- CREATE TEAM MODAL ---- */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 sticky top-0 rounded-t-2xl">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">
                  Create New Team
                </h2>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-white hover:text-gray-200"
                >
                  <FiX size={20} />
                </button>
              </div>
            </div>
            <form onSubmit={handleCreateTeam} className="p-6 space-y-5">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Team Name *
                </label>
                <input
                  type="text"
                  value={teamForm.name}
                  onChange={(e) =>
                    setTeamForm({ ...teamForm, name: e.target.value })
                  }
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  required
                  disabled={submitting}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Description
                </label>
                <textarea
                  value={teamForm.description}
                  onChange={(e) =>
                    setTeamForm({
                      ...teamForm,
                      description: e.target.value,
                    })
                  }
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  rows={2}
                  disabled={submitting}
                />
              </div>

              {isSuperAdmin && (
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    id="is_global"
                    checked={teamForm.is_global}
                    onChange={(e) => {
                      setTeamForm({
                        ...teamForm,
                        is_global: e.target.checked,
                        centre_id: e.target.checked
                          ? null
                          : teamForm.centre_id,
                      });
                    }}
                    className="w-4 h-4 text-indigo-600 rounded focus:ring-indigo-500"
                    disabled={submitting}
                  />
                  <label
                    htmlFor="is_global"
                    className="text-sm font-medium text-gray-700"
                  >
                    Global (Cross-Centre) Team
                  </label>
                </div>
              )}

              {!teamForm.is_global && isSuperAdmin && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Centre
                  </label>
                  <select
                    value={teamForm.centre_id || ""}
                    onChange={(e) =>
                      setTeamForm({
                        ...teamForm,
                        centre_id: e.target.value
                          ? Number(e.target.value)
                          : null,
                      })
                    }
                    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    disabled={submitting}
                  >
                    <option value="">Select centre</option>
                    {centres.map((centre) => (
                      <option key={centre.id} value={centre.id}>
                        {centre.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* Member selector – dropdown style */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Initial Members
                </label>
                <div className="flex flex-wrap gap-2 mb-3">
                  {teamForm.members.map((staffId) => {
                    const staff = availableStaff.find(
                      (s) => s.id === staffId
                    );
                    return (
                      <span
                        key={staffId}
                        className="inline-flex items-center bg-indigo-100 text-indigo-800 px-3 py-1 rounded-full text-sm"
                      >
                        {staff?.name || `ID ${staffId}`}
                        <button
                          type="button"
                          onClick={() => removeMemberFromForm(staffId)}
                          className="ml-2 text-indigo-600 hover:text-indigo-800"
                          disabled={submitting}
                        >
                          <FiX size={14} />
                        </button>
                      </span>
                    );
                  })}
                </div>
                <select
                  className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value=""
                  onChange={(e) => {
                    const staffId = Number(e.target.value);
                    if (staffId) addMemberToForm(staffId);
                  }}
                  disabled={submitting}
                >
                  <option value="">-- Add a staff --</option>
                  {availableStaff
                    .filter((s) => !teamForm.members.includes(s.id))
                    .map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.name} {staff.role ? `(${staff.role})` : ""}
                      </option>
                    ))}
                </select>
              </div>

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-200">
                <button
                  type="button"
                  onClick={() => setShowCreateModal(false)}
                  className="px-5 py-3 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 disabled:opacity-50"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-3 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-60 flex items-center"
                >
                  {submitting ? (
                    <svg
                      className="animate-spin h-4 w-4 mr-2"
                      viewBox="0 0 24 24"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                        fill="none"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                  ) : null}
                  Create Team
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---- ENTERPRISE ANALYTICS MODAL ---- */}
      {showAnalyticsModal && analyticsTeam && activeTeamStats && (
        <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-md flex items-center justify-center p-4 z-50 transition-all duration-300">
          <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[95vh] overflow-y-auto shadow-2xl border border-gray-200 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
            
            {/* Modal Header */}
            <div className="bg-white border-b border-gray-200 p-6 sticky top-0 z-10 flex justify-between items-center">
              <div>
                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                  <FiBarChart2 className="text-indigo-600" /> {analyticsTeam.name} Dashboard
                </h2>
                <p className="text-gray-500 text-sm mt-1">Service charges · {periodLabel}{analyticsTeam.is_global ? " · Global team" : ""}</p>
              </div>
              <button onClick={() => setShowAnalyticsModal(false)} className="bg-gray-100 p-2 rounded-full text-gray-500 hover:bg-gray-200 transition">
                <FiX size={24} />
              </button>
            </div>

            {/* Modal Tabs */}
            <div className="flex border-b border-gray-200 px-6 bg-gray-50">
              <button onClick={() => setAnalyticsTab("overview")} className={`px-6 py-4 text-sm font-semibold transition ${analyticsTab === "overview" ? "text-indigo-600 border-b-2 border-indigo-600 bg-white" : "text-gray-500 hover:text-gray-700"}`}>
                Live Overview
              </button>
              <button onClick={() => setAnalyticsTab("leaderboard")} className={`px-6 py-4 text-sm font-semibold transition ${analyticsTab === "leaderboard" ? "text-indigo-600 border-b-2 border-indigo-600 bg-white" : "text-gray-500 hover:text-gray-700"}`}>
                Staff Leaderboard
              </button>
              <button onClick={() => setAnalyticsTab("settings")} className={`px-6 py-4 text-sm font-semibold transition ${analyticsTab === "settings" ? "text-indigo-600 border-b-2 border-indigo-600 bg-white" : "text-gray-500 hover:text-gray-700"}`}>
                Targets
              </button>
            </div>

            <div className="p-6 bg-gray-50 min-h-[500px]">
              {analyticsLoading ? (
                <div className="flex justify-center py-20"><div className="animate-spin h-10 w-10 border-4 border-indigo-600 border-t-transparent rounded-full"></div></div>
              ) : (
                <>
                  {/* TAB 1: OVERVIEW */}
                  {analyticsTab === "overview" && (
                    <div className="space-y-6">
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard
                          title="Service Charges"
                          value={formatCurrency(activeTeamStats.service_charges)}
                          subtitle={`${activeTeamStats.services_completed} completed ${activeTeamStats.services_completed === 1 ? "service" : "services"}`}
                          icon={FiDollarSign}
                          color="bg-emerald-600"
                        />
                        <StatCard title="Expenses" value={formatCurrency(activeTeamStats.expense)} subtitle="Approved expenses" icon={FiBriefcase} color="bg-rose-500" />
                        <StatCard
                          title="Net Profit"
                          value={formatCurrency(activeTeamStats.net_profit)}
                          subtitle="Service charges less expenses"
                          icon={FiTrendingUp}
                          color="bg-blue-600"
                        />
                        <StatCard
                          title="Net Margin"
                          value={`${netMargin}%`}
                          subtitle="Of service charges"
                          icon={FiPieChart}
                          color="bg-amber-500"
                        />
                      </div>

                      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        <div className="lg:col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                          <h3 className="font-bold text-gray-900 mb-6 flex items-center">
                            <FiTarget className="mr-2 text-indigo-600" /> Monthly Target
                          </h3>

                          {targetsEnabled ? (
                            teamTargets && teamTargets.target > 0 ? (
                              <div className="space-y-2">
                                <TargetProgressBar
                                  label={`Service charges target (${teamTargets.membersWithTarget} ${teamTargets.membersWithTarget === 1 ? "member" : "members"})`}
                                  current={teamTargets.achieved}
                                  target={teamTargets.target}
                                />
                                <div className="grid grid-cols-3 gap-3 text-sm">
                                  <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-[10px] text-gray-500 uppercase font-semibold">Today</p>
                                    <p className="font-bold text-gray-900">{formatCurrency(teamTargets.today)}</p>
                                    <p className="text-xs text-gray-500">of {formatCurrency(teamTargets.dailyTarget)} daily</p>
                                  </div>
                                  <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-[10px] text-gray-500 uppercase font-semibold">Met today's target</p>
                                    <p className="font-bold text-gray-900">{teamTargets.metToday} of {teamTargets.membersWithTarget}</p>
                                    <p className="text-xs text-gray-500">members</p>
                                  </div>
                                  <div className="bg-gray-50 p-3 rounded-lg">
                                    <p className="text-[10px] text-gray-500 uppercase font-semibold">Pace</p>
                                    <p className={`font-bold ${teamTargets.onPace ? "text-emerald-600" : "text-amber-600"}`}>{teamTargets.onPace ? "On pace" : "Behind pace"}</p>
                                    <p className="text-xs text-gray-500">Day {teamTargets.dayOfMonth} of {teamTargets.daysInMonth}</p>
                                  </div>
                                </div>
                              </div>
                            ) : (
                              <div className="bg-amber-50 border border-amber-100 p-5 rounded-xl text-sm text-amber-800">
                                Targets are on for this team, but none of its members has a target for this month. Set them on the staff profiles and the team target adds up automatically.
                              </div>
                            )
                          ) : (
                            <div className="bg-indigo-50 border border-indigo-100 p-6 rounded-xl text-center">
                              <div className="inline-block p-4 bg-indigo-100 rounded-full mb-4">
                                <FiTrendingUp className="text-3xl text-indigo-600" />
                              </div>
                              <h4 className="text-lg font-bold text-indigo-900">Growth Mindset Active</h4>
                              <p className="text-indigo-700 mt-2 max-w-md mx-auto text-sm">
                                Strict targets are disabled for this team. This dashboard encourages natural MoM momentum and quality service over quotas.
                              </p>
                              <div className="mt-6 flex justify-center gap-6">
                                <div>
                                  <p className="text-xs text-indigo-500 uppercase tracking-wider font-bold">Service charges · {periodLabel}</p>
                                  <p className="text-xl font-bold text-indigo-700 mt-1">{formatCurrency(activeTeamStats.service_charges)}</p>
                                </div>
                              </div>
                            </div>
                          )}

                          <h3 className="font-bold text-gray-900 mt-8 mb-3 flex items-center text-sm">
                            <FiTrendingUp className="mr-2 text-indigo-600" /> Service charges by month, {trendYear}
                          </h3>
                          <div className="h-[200px]">
                            {trendChartData && <Line data={trendChartData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} />}
                          </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col">
                          <h3 className="font-bold text-gray-900 mb-1 flex items-center">
                            <FiPieChart className="mr-2 text-blue-600" /> Service Charges by Service
                          </h3>
                          <p className="text-xs text-gray-500 mb-4">{periodLabel}</p>
                          <div className="flex-1 relative min-h-[220px]">
                            {serviceMix.length > 0 ? (
                              <Doughnut
                                data={doughnutData}
                                options={{
                                  maintainAspectRatio: false,
                                  cutout: '70%',
                                  plugins: {
                                    legend: { position: 'bottom', labels: { boxWidth: 10 } },
                                    tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${inr(ctx.parsed)}` } },
                                  },
                                }}
                              />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">No completed services in this period</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: LEADERBOARD */}
                  {analyticsTab === "leaderboard" && (
                    <>
                      <p className="text-xs text-gray-500 mb-3">Ranked by service charges · {periodLabel}. Target bars show this month.</p>
                      {contributionData.length === 0 ? (
                        <p className="py-10 text-center text-sm text-gray-500">This team has no members yet.</p>
                      ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {contributionData.map((member, idx) => (
                            <div key={member.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
                              {idx === 0 && member.service_charges > 0 && <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-3 py-1 rounded-bl-lg">MVP</div>}
                              <div className="flex items-center gap-3 mb-4">
                                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold">
                                  {member.name.charAt(0)}
                                </div>
                                <div>
                                  <h4 className="font-bold text-gray-900">{member.name}</h4>
                                  <p className="text-xs text-gray-500">{member.role}{member.centre_name ? ` · ${member.centre_name}` : ""}</p>
                                </div>
                              </div>
                              <div className="grid grid-cols-2 gap-3 text-sm">
                                <div className="bg-gray-50 p-2 rounded">
                                  <p className="text-[10px] text-gray-500 uppercase font-semibold">Service charges</p>
                                  <p className="font-bold text-emerald-600">{formatCurrency(member.service_charges)}</p>
                                </div>
                                <div className="bg-gray-50 p-2 rounded">
                                  <p className="text-[10px] text-gray-500 uppercase font-semibold">Services done</p>
                                  <p className="font-bold text-indigo-600">{member.services_completed}</p>
                                </div>
                              </div>
                              <div className="mt-4">
                                <p className="text-[10px] text-gray-500 uppercase font-semibold mb-1">This month's target</p>
                                <MiniTargetBar achieved={member.month_achieved} target={member.target} onPace={member.on_pace} />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  {/* TAB 3: TARGETS */}
                  {analyticsTab === "settings" && (
                    <div className="max-w-3xl mx-auto space-y-6">
                      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Team Targets</h3>
                        <p className="text-sm text-gray-500 mb-6">
                          The team's monthly target is the sum of its members' individual targets. Change a target on the staff profile and the team figure updates by itself.
                        </p>

                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 mb-6">
                          <div>
                            <p className="font-bold text-gray-900">Measure this team against targets</p>
                            <p className="text-sm text-gray-500 mt-1">If off, the team sees a "Growth Mindset" dashboard instead.</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={targetsEnabled} onChange={(e) => setTargetsEnabled(e.target.checked)} />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                          </label>
                        </div>

                        <div className="rounded-xl border border-gray-200 overflow-hidden">
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                              <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                                <tr>
                                  <th className="py-3 px-4 text-left font-semibold">Member</th>
                                  <th className="py-3 px-4 text-right font-semibold">Monthly target</th>
                                  <th className="py-3 px-4 text-right font-semibold">Achieved</th>
                                  <th className="py-3 px-4 text-right font-semibold">Daily target</th>
                                </tr>
                              </thead>
                              <tbody>
                                {(teamTargets?.members || []).map((m) => (
                                  <tr key={m.staff_id} className="border-t border-gray-100">
                                    <td className="py-3 px-4">
                                      <p className="font-medium text-gray-900">{m.name}</p>
                                      <p className="text-xs text-gray-500">{m.centre_name || m.role}</p>
                                    </td>
                                    {m.has_target ? (
                                      <>
                                        <td className="py-3 px-4 text-right tabular-nums">{formatCurrency(m.target)}</td>
                                        <td className="py-3 px-4 text-right tabular-nums">{formatCurrency(m.achieved)} <span className="text-xs text-gray-400">({m.progress.toFixed(0)}%)</span></td>
                                        <td className="py-3 px-4 text-right tabular-nums">{formatCurrency(m.daily_target)}</td>
                                      </>
                                    ) : (
                                      <td colSpan="3" className="py-3 px-4 text-right text-xs text-gray-400">No target set for this month</td>
                                    )}
                                  </tr>
                                ))}
                                {teamTargets && teamTargets.members.length > 0 && (
                                  <tr className="border-t-2 border-gray-200 bg-indigo-50/50 font-bold text-gray-900">
                                    <td className="py-3 px-4">Team total</td>
                                    <td className="py-3 px-4 text-right tabular-nums">{formatCurrency(teamTargets.target)}</td>
                                    <td className="py-3 px-4 text-right tabular-nums">{formatCurrency(teamTargets.achieved)} <span className="text-xs font-medium text-gray-500">({teamTargets.progress.toFixed(0)}%)</span></td>
                                    <td className="py-3 px-4 text-right tabular-nums">{formatCurrency(teamTargets.dailyTarget)}</td>
                                  </tr>
                                )}
                                {(!teamTargets || teamTargets.members.length === 0) && (
                                  <tr><td colSpan="4" className="py-6 text-center text-sm text-gray-500">This team has no members yet.</td></tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        </div>
                        <p className="mt-3 text-xs text-gray-500">
                          Achieved = each member's completed service charges this month, the same figure they see on their own dashboard. Members without a target are left out of the totals.
                        </p>

                        {isAdmin && (
                          <button
                            onClick={handleSaveSettings}
                            disabled={savingSettings}
                            className="mt-6 bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition w-full disabled:opacity-50 flex justify-center items-center"
                          >
                            {savingSettings ? <FiLoader className="animate-spin mr-2" /> : null}
                            {savingSettings ? "Saving Settings..." : "Save Settings"}
                          </button>
                        )}
                      </div>
                    </div>
                  )}

                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TeamManagement;