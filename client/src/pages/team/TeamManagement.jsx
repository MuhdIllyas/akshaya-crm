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

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [centreFilter, setCentreFilter] = useState("all");

  // Centres list (only for superadmin)
  const [centres, setCentres] = useState([]);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showManageMembersModal, setShowManageMembersModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);

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

  // Add member dropdown state (for manage modal)
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
      const members = data.reduce((sum, t) => sum + Number(t.member_count), 0);
      setTotalStats({ total, global, centre, members });
    } catch (error) {
      console.error("Fetch teams failed:", error);
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // Fetch centres (superadmin only)
  // ------------------------------------------------------------------
  const fetchCentres = async () => {
    if (!isSuperAdmin) return;
    try {
      const response = await fetch(`${API_BASE}/api/wallet/centres`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const data = await response.json();
      setCentres(Array.isArray(data) ? data : data.centres || []);
    } catch (error) {
      console.error("Fetch centres failed:", error);
    }
  };

  // ------------------------------------------------------------------
  // Fetch staff (same pattern as CalendarPage)
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

  useEffect(() => {
    fetchTeams();
    fetchCentres();
    // Fetch staff once on mount; can be refreshed before opening modals
    fetchStaff();
  }, []);

  // ------------------------------------------------------------------
  // Filtered teams
  // ------------------------------------------------------------------
  const filteredTeams = useMemo(() => {
    return teams.filter((team) => {
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
  }, [teams, searchTerm, typeFilter, centreFilter]);

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
  // Create team modal handlers
  // ------------------------------------------------------------------
  const openCreateModal = () => {
    setTeamForm({
      name: "",
      description: "",
      is_global: false,
      centre_id: user.role === "admin" ? user.centreId : null,
      members: [],
    });
    fetchStaff(); // refresh staff
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
    } catch (error) {
      alert(error.message || "Error creating team");
    } finally {
      setSubmitting(false);
    }
  };

  // Add a member from the dropdown in create modal
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
  // Manage members modal handlers
  // ------------------------------------------------------------------
  const openManageMembers = async (team) => {
    setSelectedTeam(team);
    fetchStaff(); // ensure latest staff
    try {
      const response = await fetch(`${API_BASE}/api/teams/${team.id}/members`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const membersData = await response.json();
      setSelectedTeam((prev) => ({ ...prev, membersList: membersData }));
      setAddMemberValue(""); // reset dropdown
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

      // refresh members
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
      setAddMemberValue(""); // reset dropdown
      fetchTeams();
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
    } catch (error) {
      alert(error.message || "Error deleting team");
    } finally {
      setSubmitting(false);
    }
  };

  // ------------------------------------------------------------------
  // Render
  // ------------------------------------------------------------------
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-indigo-50 p-4 sm:p-6">
      {/* Outer container omitted for brevity, same as before */}
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

        {/* Stats cards and filters unchanged */}
        {/* ... (same as previous version) ... */}
        {/* Keep the same stats cards and filter section here */}

        {/* Teams Table unchanged except profit chip */}
        {/* ... (same as before) ... */}
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
              {/* Name, Description, Global toggle, Centre (if superadmin) unchanged */}
              {/* ... */}

              {/* Member selector – now a dropdown */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Initial Members
                </label>
                {/* Show selected members as tags */}
                <div className="flex flex-wrap gap-2 mb-3">
                  {teamForm.members.map((staffId) => {
                    const staff = availableStaff.find((s) => s.id === staffId);
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
                {/* Dropdown to add members */}
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
              {/* Add member section – now a dropdown */}
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
                  onClick={() => handleAddMemberToTeam(Number(addMemberValue))}
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
    </div>
  );
};

export default TeamManagement;