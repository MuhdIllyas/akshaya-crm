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

const TargetProgressBar = ({ label, current, target }) => {
  const safeTarget = target || 1;
  const percentage = Math.min((current / safeTarget) * 100, 100).toFixed(0);
  
  const formatCurrency = (val) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(val || 0);

  return (
    <div className="mb-4">
      <div className="flex justify-between text-sm mb-1">
        <span className="font-medium text-gray-700">{label}</span>
        <span className="text-gray-600 font-semibold">{formatCurrency(current)} / {formatCurrency(target)} ({percentage}%)</span>
      </div>
      <div className="w-full bg-gray-100 rounded-full h-2.5">
        <div className={`h-2.5 rounded-full ${percentage >= 100 ? 'bg-emerald-500' : 'bg-indigo-500'}`} style={{ width: `${percentage}%` }}></div>
      </div>
    </div>
  );
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

  // Financial data from analytics endpoint
  const [financialData, setFinancialData] = useState({ teams: [], totals: {} });

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all"); // all, centre, global
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
  const [trendYear, setTrendYear] = useState(new Date().getFullYear());
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

  // --- EXPANDABLE ROW STATE (Replaces the Manage Members Modal) ---
  const [expandedTeamId, setExpandedTeamId] = useState(null);
  const [teamMembersMap, setTeamMembersMap] = useState({});
  const [membersLoading, setMembersLoading] = useState(false);

  const toggleTeamExpand = async (team) => {
    if (expandedTeamId === team.id) {
      setExpandedTeamId(null);
      return;
    }
    setExpandedTeamId(team.id);
    setMembersLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/teams/${team.id}/members`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const membersData = await response.json();
      setTeamMembersMap(prev => ({ ...prev, [team.id]: membersData }));
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
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${localStorage.getItem("token")}` },
        body: JSON.stringify({ staff_id: staffId, is_primary: false }),
      });
      if (!response.ok) throw new Error("Failed to add member");

      // Refresh just this row
      const updatedRes = await fetch(`${API_BASE}/api/teams/${teamId}/members`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }});
      const updatedMembers = await updatedRes.json();
      setTeamMembersMap(prev => ({ ...prev, [teamId]: updatedMembers }));
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
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const updatedRes = await fetch(`${API_BASE}/api/teams/${teamId}/members`, { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }});
      const updatedMembers = await updatedRes.json();
      setTeamMembersMap(prev => ({ ...prev, [teamId]: updatedMembers }));
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

  // Targets Settings State
  const [targetsEnabled, setTargetsEnabled] = useState(false);
  const [monthlyTarget, setMonthlyTarget] = useState(250000);
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
        body: JSON.stringify({
          targets_enabled: targetsEnabled,
          monthly_target: monthlyTarget
        }),
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
  // Fetch financial summary
  // ------------------------------------------------------------------
  const fetchFinancials = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/teams/analytics/summary`, {
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

  // Initial load
  useEffect(() => {
    fetchTeams();
    fetchCentres();
    fetchStaff();
    fetchFinancials();
  }, []);

  // ------------------------------------------------------------------
  // Merge team list with financials
  // ------------------------------------------------------------------
  const mergedTeams = useMemo(() => {
    return teams.map((team) => {
      const fin = financialData.teams.find((t) => t.id === team.id);
      return {
        ...team,

        expected_revenue:
          fin ? fin.expected_revenue : 0,

        collected_revenue:
          fin ? fin.collected_revenue : 0,

        pending_revenue:
          fin ? fin.pending_revenue : 0,

        department_charges:
          fin ? fin.department_charges : 0,

        service_profit:
          fin ? fin.service_profit : 0,

        expense:
          fin ? fin.expense : 0,

        net_profit:
          fin ? fin.net_profit : 0,
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
  const formatCurrency = (value) => {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency: "INR",
      maximumFractionDigits: 0,
    }).format(value);
  };

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
      
      // Fetch all 4 endpoints at the same time
      const [contribRes, trendRes, mixRes, settingsRes] = await Promise.all([
        fetch(`${API_BASE}/api/teams/${teamId}/contribution`, { headers }),
        fetch(`${API_BASE}/api/teams/${teamId}/trend?year=${trendYear}`, { headers }),
        fetch(`${API_BASE}/api/teams/${teamId}/service-mix`, { headers }).catch(() => ({ ok: false })),
        fetch(`${API_BASE}/api/teams/${teamId}/settings`, { headers }).catch(() => ({ ok: false }))
      ]);

      if (contribRes.ok) setContributionData(await contribRes.json());
      if (trendRes.ok) setTrendData(await trendRes.json());
      
      // Handle Service Mix
      if (mixRes.ok) {
        setServiceMix(await mixRes.json());
      } else {
        setServiceMix([{ service_type: 'Passport', count: 45 }, { service_type: 'PAN Card', count: 30 }, { service_type: 'Certificate', count: 15 }]);
      }

      // Handle Target Settings
      if (settingsRes.ok) {
        const settingsData = await settingsRes.json();
        setTargetsEnabled(settingsData.targets_enabled || false);
        setMonthlyTarget(settingsData.monthly_target || 250000);
      } else {
        setTargetsEnabled(false);
        setMonthlyTarget(250000);
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

  // Analytics Calculations for Admin Overview
  const activeTeamStats = useMemo(() => mergedTeams.find(t => t.id === analyticsTeam?.id), [analyticsTeam, mergedTeams]);
  const actualProfit = activeTeamStats ? (activeTeamStats.collected_revenue || 0) - (activeTeamStats.department_charges || 0) - (activeTeamStats.expense || 0) : 0;
  const profitMargin = activeTeamStats && activeTeamStats.collected_revenue > 0 ? ((actualProfit / activeTeamStats.collected_revenue) * 100).toFixed(1) : 0;

  const trendChartData = useMemo(() => {
    if (!trendData.length) return null;
    return {
      labels: trendData.map(t => ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"][t.month - 1]),
      datasets: [{ label: 'Revenue (₹)', data: trendData.map(t => t.collected_revenue), borderColor: '#10B981', backgroundColor: 'rgba(16, 185, 129, 0.1)', fill: true }]
    };
  }, [trendData]);

  const doughnutData = {
    labels: serviceMix.map(s => s.service_type),
    datasets: [{ data: serviceMix.map(s => s.count), backgroundColor: ["#3B82F6", "#10B981", "#EF4444", "#F59E0B", "#8B5CF6", "#64748B"], borderWidth: 0 }]
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
              Organize finance ownership, centre vs global teams
            </p>
          </div>
          <div className="flex gap-3 mt-4 md:mt-0">
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
        <div className="flex flex-wrap gap-4 mb-6">
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
                    Collected Revenue
                  </th>
                  <th className="py-4 px-5 text-right text-sm font-semibold text-gray-600">
                    Expense
                  </th>
                  <th className="py-4 px-5 text-right text-sm font-semibold text-gray-600">
                    Net Profit
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
                      <td className="py-4 px-5 text-right text-emerald-600 font-medium">{formatCurrency(team.collected_revenue)}</td>
                      <td className="py-4 px-5 text-right text-red-500 font-medium">{formatCurrency(team.expense)}</td>
                      
                      <td className="py-4 px-5 text-right font-bold text-indigo-600">{formatCurrency(team.net_profit)}</td>
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
                         <td colSpan="6" className="p-0">
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
                <p className="text-gray-500 text-sm mt-1">Admin Performance Overview</p>
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
                Culture & Targets
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
                      <div className="grid grid-cols-4 gap-4">
                        <StatCard title="Total Expected" value={formatCurrency(activeTeamStats.expected_revenue)} icon={FiTarget} color="bg-indigo-600" />
                        <StatCard title="Collected Revenue" value={formatCurrency(activeTeamStats.collected_revenue)} icon={FiDollarSign} color="bg-emerald-600" />
                        <StatCard title="Net Generated" value={formatCurrency(actualProfit)} subtitle={`Expenses: ${formatCurrency(activeTeamStats.expense)}`} icon={FiTrendingUp} color="bg-blue-600" />
                        <StatCard title="Profit Margin" value={`${profitMargin}%`} subtitle="After dept charges & expenses" icon={FiPieChart} color="bg-amber-500" />
                      </div>

                      <div className="grid grid-cols-3 gap-6">
                        <div className="col-span-2 bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                          <h3 className="font-bold text-gray-900 mb-6 flex items-center">
                            <FiTrendingUp className="mr-2 text-indigo-600" /> Monthly Trajectory
                          </h3>
                          
                          {targetsEnabled ? (
                            <div className="space-y-6">
                              <TargetProgressBar label="Revenue Target" current={activeTeamStats.collected_revenue} target={monthlyTarget} />
                            </div>
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
                                  <p className="text-xs text-indigo-500 uppercase tracking-wider font-bold">Current Pace</p>
                                  <p className="text-xl font-bold text-indigo-700 mt-1">{formatCurrency(activeTeamStats.collected_revenue)}</p>
                                </div>
                              </div>
                            </div>
                          )}

                          <div className="mt-8 h-[200px]">
                            {trendChartData && <Line data={trendChartData} options={{ maintainAspectRatio: false, plugins: { legend: { display: false } } }} />}
                          </div>
                        </div>

                        <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm flex flex-col">
                          <h3 className="font-bold text-gray-900 mb-4 flex items-center">
                            <FiPieChart className="mr-2 text-blue-600" /> Service Mix
                          </h3>
                          <div className="flex-1 relative">
                            {serviceMix.length > 0 ? (
                              <Doughnut data={doughnutData} options={{ maintainAspectRatio: false, cutout: '75%', plugins: { legend: { position: 'bottom', labels: { boxWidth: 10 } } } }} />
                            ) : (
                              <div className="absolute inset-0 flex items-center justify-center text-gray-400 text-sm">No service data</div>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* TAB 2: LEADERBOARD */}
                  {analyticsTab === "leaderboard" && (
                    <div className="grid grid-cols-3 gap-4">
                      {contributionData.map((member, idx) => (
                        <div key={member.id} className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm relative overflow-hidden">
                          {idx === 0 && <div className="absolute top-0 right-0 bg-yellow-400 text-yellow-900 text-[10px] font-bold px-3 py-1 rounded-bl-lg">MVP</div>}
                          <div className="flex items-center gap-3 mb-4">
                            <div className="w-10 h-10 rounded-full bg-gradient-to-br from-indigo-500 to-purple-600 flex items-center justify-center text-white font-bold">
                              {member.name.charAt(0)}
                            </div>
                            <div>
                              <h4 className="font-bold text-gray-900">{member.name}</h4>
                              <p className="text-xs text-gray-500">{member.role}</p>
                            </div>
                          </div>
                          <div className="grid grid-cols-2 gap-3 text-sm">
                            <div className="bg-gray-50 p-2 rounded">
                              <p className="text-[10px] text-gray-500 uppercase font-semibold">Collected</p>
                              <p className="font-bold text-emerald-600">{formatCurrency(member.collected_revenue)}</p>
                            </div>
                            <div className="bg-gray-50 p-2 rounded">
                              <p className="text-[10px] text-gray-500 uppercase font-semibold">Profit Added</p>
                              <p className="font-bold text-indigo-600">{formatCurrency(member.net_profit)}</p>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* TAB 3: SETTINGS */}
                  {analyticsTab === "settings" && (
                    <div className="max-w-2xl mx-auto space-y-6">
                      <div className="bg-white p-6 rounded-xl border border-gray-200 shadow-sm">
                        <h3 className="text-lg font-bold text-gray-900 mb-2">Team Culture & Targets</h3>
                        <p className="text-sm text-gray-500 mb-6">Determine how this team is measured on their dashboard.</p>
                        
                        <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg border border-gray-200 mb-6">
                          <div>
                            <p className="font-bold text-gray-900">Enable Strict Targets</p>
                            <p className="text-sm text-gray-500 mt-1">If disabled, the team will see a "Growth Mindset" dashboard instead.</p>
                          </div>
                          <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" className="sr-only peer" checked={targetsEnabled} onChange={(e) => setTargetsEnabled(e.target.checked)} />
                            <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-indigo-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-indigo-600"></div>
                          </label>
                        </div>

                        {targetsEnabled && (
                          <div className="space-y-4 animate-fade-in-up mb-6">
                            <div>
                              <label className="block text-sm font-medium text-gray-700 mb-1">Monthly Revenue Target (₹)</label>
                              <input type="number" value={monthlyTarget} onChange={(e) => setMonthlyTarget(Number(e.target.value))} className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-indigo-500 outline-none" />
                            </div>
                          </div>
                        )}

                        <button 
                          onClick={handleSaveSettings} 
                          disabled={savingSettings} 
                          className="bg-indigo-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-indigo-700 transition w-full disabled:opacity-50 flex justify-center items-center"
                        >
                          {savingSettings ? <FiLoader className="animate-spin mr-2" /> : null}
                          {savingSettings ? "Saving Settings..." : "Save Settings"}
                        </button>
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