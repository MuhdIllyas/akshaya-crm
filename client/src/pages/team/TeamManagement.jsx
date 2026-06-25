// TeamManagement.jsx
import React, { useState, useEffect, useMemo } from "react";
import {
  FiUsers,
  FiGlobe,
  FiHome,
  FiBarChart2,
  FiSearch,
  FiPlus,
  FiX,
  FiUser,
  FiUserPlus,
  FiCheck,
  FiEdit,
  FiTrash2,
  FiStar,
  FiTrendingUp,
  FiPieChart,
  FiCalendar,
} from "react-icons/fi";

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
  const [analyticsTab, setAnalyticsTab] = useState("contribution"); // 'contribution' or 'trend'
  const [contributionData, setContributionData] = useState([]);
  const [trendData, setTrendData] = useState([]);
  const [trendYear, setTrendYear] = useState(new Date().getFullYear());
  const [analyticsLoading, setAnalyticsLoading] = useState(false);

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
  const fetchContribution = async (teamId) => {
    setAnalyticsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/teams/${teamId}/contribution`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (response.ok) {
        const data = await response.json();
        setContributionData(data);
      } else {
        console.error("Failed to load contribution");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const fetchTrend = async (teamId, year) => {
    setAnalyticsLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/teams/${teamId}/trend?year=${year}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      if (response.ok) {
        const data = await response.json();
        setTrendData(data);
      } else {
        console.error("Failed to load trend");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setAnalyticsLoading(false);
    }
  };

  const openAnalyticsModal = (team) => {
    setAnalyticsTeam(team);
    setAnalyticsTab("contribution");
    setShowAnalyticsModal(true);
    fetchContribution(team.id);
  };

  const switchAnalyticsTab = (tab) => {
    setAnalyticsTab(tab);
    if (tab === "contribution") {
      fetchContribution(analyticsTeam.id);
    } else if (tab === "trend") {
      fetchTrend(analyticsTeam.id, trendYear);
    }
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
                {loading ? (
                  <tr>
                    <td colSpan="7" className="py-10 text-center text-gray-500">
                      Loading teams...
                    </td>
                  </tr>
                ) : filteredTeams.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="py-10 text-center text-gray-500">
                      No teams found.
                    </td>
                  </tr>
                ) : (
                  filteredTeams.map((team) => (
                    <tr
                      key={team.id}
                      className="border-b border-gray-100 hover:bg-gray-50"
                    >
                      <td className="py-4 px-5">
                        <div className="flex items-center">
                          <div
                            className={`p-2 rounded-lg mr-3 ${
                              team.is_global
                                ? "bg-purple-100 text-purple-800"
                                : "bg-indigo-100 text-indigo-800"
                            }`}
                          >
                            {team.is_global ? <FiGlobe /> : <FiHome />}
                          </div>
                          <div>
                            <p className="font-medium text-gray-800">
                              {team.name}
                            </p>
                            <p className="text-xs text-gray-500">
                              {team.centre_id
                                ? getCentreName(team.centre_id)
                                : "Cross-Centre"}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-5 text-center">
                        <span
                          className={`inline-block px-2 py-1 text-xs rounded-full font-medium ${
                            team.is_global
                              ? "bg-purple-100 text-purple-800"
                              : "bg-blue-100 text-blue-800"
                          }`}
                        >
                          {team.is_global ? "Global" : "Centre"}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-center font-medium">
                        {team.member_count}
                      </td>
                      <td className="py-4 px-5 text-right text-green-700">
                        {formatCurrency(team.collected_revenue || 0)}
                      </td>
                      <td className="py-4 px-5 text-right text-red-600">
                        {formatCurrency(team.expense || 0)}
                      </td>
                      <td className="py-4 px-5 text-right">
                        <span
                          className={`font-semibold ${
                            Number(team.net_profit || 0) >= 0
                              ? "text-green-700"
                              : "text-red-700"
                          }`}
                        >
                          {formatCurrency(team.net_profit || 0)}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-center">
                        <div className="flex justify-center gap-2">
                          <button
                            onClick={() => openManageMembers(team)}
                            className="text-indigo-600 hover:text-indigo-800 p-1.5 rounded-lg hover:bg-indigo-50"
                            title="Manage Members"
                          >
                            <FiUsers size={16} />
                          </button>
                          <button
                            onClick={() => openAnalyticsModal(team)}
                            className="text-teal-600 hover:text-teal-800 p-1.5 rounded-lg hover:bg-teal-50"
                            title="View Analytics"
                          >
                            <FiTrendingUp size={16} />
                          </button>
                          {isAdmin && (
                            <>
                              <button
                                onClick={() =>
                                  alert("Edit team (to be implemented)")
                                }
                                className="text-gray-600 hover:text-gray-800 p-1.5 rounded-lg hover:bg-gray-100"
                                title="Edit"
                              >
                                <FiEdit size={16} />
                              </button>
                              <button
                                onClick={() => handleDeleteTeam(team.id)}
                                disabled={submitting}
                                className="text-red-600 hover:text-red-800 p-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50"
                                title="Delete"
                              >
                                <FiTrash2 size={16} />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
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

      {/* ---- MANAGE MEMBERS MODAL ---- */}
      {showManageMembersModal && selectedTeam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto shadow-2xl border border-gray-200">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-6 sticky top-0 rounded-t-2xl">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">
                  {selectedTeam.name} – Members
                </h2>
                <button
                  onClick={() => setShowManageMembersModal(false)}
                  className="text-white hover:text-gray-200"
                >
                  <FiX size={20} />
                </button>
              </div>
            </div>
            <div className="p-6">
              {/* Add member section – dropdown + button */}
              <div className="mb-6 flex items-center gap-3">
                <select
                  className="flex-1 px-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  value={addMemberValue}
                  onChange={(e) => setAddMemberValue(e.target.value)}
                  disabled={submitting}
                >
                  <option value="">-- Select staff to add --</option>
                  {availableStaff
                    .filter(
                      (s) =>
                        !selectedTeam.membersList?.some(
                          (m) => m.staff_id === s.id
                        )
                    )
                    .map((staff) => (
                      <option key={staff.id} value={staff.id}>
                        {staff.name} {staff.role ? `(${staff.role})` : ""}
                      </option>
                    ))}
                </select>
                <button
                  onClick={() =>
                    handleAddMemberToTeam(Number(addMemberValue))
                  }
                  disabled={!addMemberValue || submitting}
                  className="px-4 py-2.5 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 disabled:opacity-50 flex items-center gap-2"
                >
                  <FiUserPlus /> Add
                </button>
              </div>

              {/* Members list */}
              <div className="divide-y divide-gray-100">
                {selectedTeam.membersList?.map((member) => (
                  <div
                    key={member.id}
                    className="py-3 flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3">
                      <div className="bg-gray-100 p-2 rounded-lg">
                        <FiUser className="text-gray-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-800">
                          {member.name}
                          {member.is_primary && (
                            <span className="ml-2 inline-flex items-center text-xs bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full">
                              <FiStar className="mr-1" size={12} /> Primary
                            </span>
                          )}
                        </p>
                        <p className="text-sm text-gray-500">
                          {member.role} – {member.centre_name}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      {isAdmin && !member.is_primary && (
                        <button
                          onClick={() => handleSetPrimary(member.id)}
                          disabled={submitting}
                          className="text-amber-600 hover:text-amber-800 p-1.5 rounded-lg hover:bg-amber-50 disabled:opacity-50"
                          title="Set as primary team"
                        >
                          <FiStar size={16} />
                        </button>
                      )}
                      {isAdmin && (
                        <button
                          onClick={() =>
                            handleRemoveMember(
                              selectedTeam.id,
                              member.staff_id
                            )
                          }
                          disabled={submitting}
                          className="text-red-600 hover:text-red-800 p-1.5 rounded-lg hover:bg-red-50 disabled:opacity-50"
                          title="Remove"
                        >
                          <FiTrash2 size={16} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---- ANALYTICS MODAL ---- */}
      {showAnalyticsModal && analyticsTeam && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200">
            {/* Header with tabs */}
            <div className="bg-gradient-to-r from-teal-600 to-emerald-600 p-6 sticky top-0 rounded-t-2xl">
              <div className="flex justify-between items-center">
                <h2 className="text-xl font-bold text-white">
                  {analyticsTeam.name} – Analytics
                </h2>
                <button
                  onClick={() => setShowAnalyticsModal(false)}
                  className="text-white hover:text-gray-200"
                >
                  <FiX size={20} />
                </button>
              </div>
              <div className="flex gap-4 mt-4">
                <button
                  onClick={() => switchAnalyticsTab("contribution")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    analyticsTab === "contribution"
                      ? "bg-white text-teal-700 shadow"
                      : "bg-teal-500 text-white hover:bg-teal-400"
                  }`}
                >
                  <FiPieChart className="inline mr-1" /> Contribution
                </button>
                <button
                  onClick={() => switchAnalyticsTab("trend")}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                    analyticsTab === "trend"
                      ? "bg-white text-teal-700 shadow"
                      : "bg-teal-500 text-white hover:bg-teal-400"
                  }`}
                >
                  <FiCalendar className="inline mr-1" /> Monthly Trend
                </button>
              </div>
            </div>

            <div className="p-6">
              {analyticsLoading ? (
                <div className="flex items-center justify-center py-10">
                  <div className="animate-spin h-8 w-8 border-4 border-teal-600 border-t-transparent rounded-full mr-3"></div>
                  Loading...
                </div>
              ) : (
                <>
                  {analyticsTab === "contribution" && (
                    <div>
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">
                        Member Contribution
                      </h3>
                      {contributionData.length === 0 ? (
                        <p className="text-gray-500 text-center py-6">
                          No contribution data available.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-gray-200">
                                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600">
                                  Staff
                                </th>
                                <th className="py-3 px-4 text-center text-sm font-semibold text-gray-600">
                                  Role
                                </th>
                                <th className="py-3 px-4 text-center text-sm font-semibold text-gray-600">
                                  Primary
                                </th>
                                <th className="py-3 px-4 text-right text-sm font-semibold text-gray-600">
                                  Collected Revenue
                                </th>
                                <th className="py-3 px-4 text-right text-sm font-semibold text-gray-600">
                                  Expense
                                </th>
                                <th className="py-3 px-4 text-right text-sm font-semibold text-gray-600">
                                  Net Profit
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {contributionData.map((m) => (
                                <tr
                                  key={m.id}
                                  className="border-b border-gray-100"
                                >
                                  <td className="py-3 px-4 text-gray-800">
                                    {m.name}
                                  </td>
                                  <td className="py-3 px-4 text-center text-gray-600">
                                    {m.role}
                                  </td>
                                  <td className="py-3 px-4 text-center">
                                    {m.is_primary && (
                                      <FiStar className="text-amber-500 inline" />
                                    )}
                                  </td>
                                  <td className="py-3 px-4 text-right text-green-700">
                                    {formatCurrency(m.collected_revenue || 0)}
                                  </td>
                                  <td className="py-3 px-4 text-right text-red-600">
                                    {formatCurrency(m.expense)}
                                  </td>
                                  <td
                                    className="py-3 px-4 text-right font-semibold"
                                    style={{
                                      color:
                                        m.net_profit >= 0 ? "#15803d" : "#b91c1c",
                                    }}
                                  >
                                    {formatCurrency(m.net_profit || 0)}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      )}
                    </div>
                  )}

                  {analyticsTab === "trend" && (
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-semibold text-gray-800">
                          Monthly Trend
                        </h3>
                        <div className="flex items-center gap-2">
                          <label className="text-sm text-gray-600">
                            Year:
                          </label>
                          <input
                            type="number"
                            value={trendYear}
                            onChange={(e) => {
                              const y = Number(e.target.value);
                              setTrendYear(y);
                              fetchTrend(analyticsTeam.id, y);
                            }}
                            className="border border-gray-200 rounded-lg px-3 py-1.5 w-24 text-sm"
                          />
                        </div>
                      </div>
                      {trendData.length === 0 ? (
                        <p className="text-gray-500 text-center py-6">
                          No trend data for this year.
                        </p>
                      ) : (
                        <div className="overflow-x-auto">
                          <table className="w-full">
                            <thead>
                              <tr className="border-b border-gray-200">
                                <th className="py-3 px-4 text-left text-sm font-semibold text-gray-600">
                                  Month
                                </th>
                                <th className="py-3 px-4 text-right text-sm font-semibold text-gray-600">
                                  Revenue
                                </th>
                                <th className="py-3 px-4 text-right text-sm font-semibold text-gray-600">
                                  Expense
                                </th>
                                <th className="py-3 px-4 text-right text-sm font-semibold text-gray-600">
                                  Profit
                                </th>
                              </tr>
                            </thead>
                            <tbody>
                              {trendData.map((row) => {
                                const monthNames = [
                                  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
                                  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
                                ];
                                return (
                                  <tr
                                    key={row.month}
                                    className="border-b border-gray-100"
                                  >
                                    <td className="py-3 px-4 text-gray-800">
                                      {monthNames[row.month - 1]}
                                    </td>
                                    <td className="py-3 px-4 text-right text-green-700">
                                      {formatCurrency(row.collected_revenue)}
                                    </td>
                                    <td className="py-3 px-4 text-right text-red-600">
                                      {formatCurrency(row.expense)}
                                    </td>
                                    <td
                                      className="py-3 px-4 text-right font-semibold"
                                      style={{
                                        color:
                                          row.net_profit >= 0
                                            ? "#15803d"
                                            : "#b91c1c",
                                      }}
                                    >
                                      {formatCurrency(row.net_profit)}
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}
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