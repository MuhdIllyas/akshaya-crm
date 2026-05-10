// TeamManagement.jsx
import React, { useState, useEffect, useMemo } from 'react';
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
} from 'react-icons/fi';

// ----------------------------------------------------------------------
// JWT helper – exactly as in your CalendarPage.jsx
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

const API_BASE = import.meta.env.VITE_API_URL || '';

// ----------------------------------------------------------------------
// TeamManagement Component
// ----------------------------------------------------------------------
const TeamManagement = () => {
  // ---- Auth from JWT ----
  const claims = getTokenClaims();
  const user = claims || { id: null, role: 'staff', centreId: null, name: '' };
  const isAdmin = ['admin', 'superadmin'].includes(user.role);
  const isSuperAdmin = user.role === 'superadmin';

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
  const [searchTerm, setSearchTerm] = useState('');
  const [typeFilter, setTypeFilter] = useState('all'); // all, centre, global
  const [centreFilter, setCentreFilter] = useState('all');

  // Centres list
  const [centres, setCentres] = useState([]);

  // Modals
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showManageMembersModal, setShowManageMembersModal] = useState(false);
  const [selectedTeam, setSelectedTeam] = useState(null);

  // Form for create / edit team
  const [teamForm, setTeamForm] = useState({
    name: '',
    description: '',
    is_global: false,
    centre_id: null,
    members: [],
  });

  // Available staff for member selection
  const [availableStaff, setAvailableStaff] = useState([]);
  const [staffSearch, setStaffSearch] = useState('');

  // Add member search in manage modal
  const [addMemberSearchOpen, setAddMemberSearchOpen] = useState(false);
  const [addMemberSearch, setAddMemberSearch] = useState('');

  // ------------------------------------------------------------------
  // Fetch teams from backend (now with financial data)
  // ------------------------------------------------------------------
  const fetchTeams = async () => {
    setLoading(true);
    try {
      const response = await fetch(`${API_BASE}/api/teams`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await response.json();
      // Backend now returns revenue, expense, profit directly
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
      console.error('Fetch teams failed:', error);
    } finally {
      setLoading(false);
    }
  };

  // ------------------------------------------------------------------
  // Fetch centres (for superadmin filter + create team dropdown)
  // ------------------------------------------------------------------
  const fetchCentres = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/centres`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const data = await response.json();
      setCentres(Array.isArray(data) ? data : data.centres || []);
    } catch (error) {
      console.error('Fetch centres failed:', error);
    }
  };

  // ------------------------------------------------------------------
  // Fetch available staff (with role‑based filtering)
  // ------------------------------------------------------------------
  const fetchAvailableStaff = async () => {
    try {
      const response = await fetch(`${API_BASE}/api/staff`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const raw = await response.json();
      const allStaff = Array.isArray(raw) ? raw : raw.staff || [];

      // Admin can only see staff from own centre
      const filteredStaff =
        user.role === 'superadmin'
          ? allStaff
          : allStaff.filter(
              (s) => Number(s.centre_id) === Number(user.centreId)
            );

      setAvailableStaff(filteredStaff);
    } catch (error) {
      console.error('Fetch staff failed:', error);
    }
  };

  useEffect(() => {
    fetchTeams();
    fetchCentres();
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
        typeFilter === 'all' ||
        (typeFilter === 'centre' && !team.is_global) ||
        (typeFilter === 'global' && team.is_global);
      const matchesCentre =
        centreFilter === 'all' || String(team.centre_id) === centreFilter;
      return matchesSearch && matchesType && matchesCentre;
    });
  }, [teams, searchTerm, typeFilter, centreFilter]);

  // ------------------------------------------------------------------
  // Currency formatter
  // ------------------------------------------------------------------
  const formatCurrency = (value) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  };

  // ------------------------------------------------------------------
  // Create team modal
  // ------------------------------------------------------------------
  const openCreateModal = () => {
    setTeamForm({
      name: '',
      description: '',
      is_global: false,
      centre_id: user.role === 'admin' ? user.centreId : null,
      members: [],
    });
    fetchAvailableStaff();
    setShowCreateModal(true);
  };

  const handleCreateTeam = async (e) => {
    e.preventDefault();
    if (!teamForm.name.trim()) return alert('Team name is required');
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
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${localStorage.getItem('token')}`,
        },
        body: JSON.stringify(payload),
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.error || 'Failed to create team');

      setShowCreateModal(false);
      fetchTeams();
    } catch (error) {
      alert(error.message || 'Error creating team');
    } finally {
      setSubmitting(false);
    }
  };

  const toggleMemberSelection = (staffId) => {
    setTeamForm((prev) => ({
      ...prev,
      members: prev.members.includes(staffId)
        ? prev.members.filter((id) => id !== staffId)
        : [...prev.members, staffId],
    }));
  };

  // ------------------------------------------------------------------
  // Manage members modal
  // ------------------------------------------------------------------
  const openManageMembers = async (team) => {
    setSelectedTeam(team);
    try {
      const response = await fetch(`${API_BASE}/api/teams/${team.id}/members`, {
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      const membersData = await response.json();
      setSelectedTeam((prev) => ({ ...prev, membersList: membersData }));
      setShowManageMembersModal(true);
    } catch (error) {
      console.error('Fetch members failed:', error);
    }
  };

  const handleSetPrimary = async (memberId) => {
    try {
      await fetch(`${API_BASE}/api/teams/member/${memberId}/primary`, {
        method: 'PUT',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (selectedTeam) openManageMembers(selectedTeam);
    } catch (error) {
      console.error('Set primary failed:', error);
    }
  };

  const handleRemoveMember = async (teamId, staffId) => {
    if (!window.confirm('Remove this member?')) return;
    try {
      await fetch(`${API_BASE}/api/teams/${teamId}/members/${staffId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (selectedTeam) openManageMembers(selectedTeam);
      fetchTeams();
    } catch (error) {
      console.error('Remove member failed:', error);
    }
  };

  const handleAddMemberToTeam = async (staffId) => {
    if (!selectedTeam) return;
    setSubmitting(true);
    try {
      const response = await fetch(
        `${API_BASE}/api/teams/${selectedTeam.id}/members`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
          body: JSON.stringify({ staff_id: staffId, is_primary: false }),
        }
      );
      if (!response.ok) throw new Error('Failed to add member');
      // refresh members
      const updatedRes = await fetch(
        `${API_BASE}/api/teams/${selectedTeam.id}/members`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('token')}`,
          },
        }
      );
      const updatedMembers = await updatedRes.json();
      setSelectedTeam((prev) => ({ ...prev, membersList: updatedMembers }));
      setAddMemberSearchOpen(false);
      setAddMemberSearch('');
      fetchTeams();
    } catch (error) {
      alert(error.message || 'Error adding member');
    } finally {
      setSubmitting(false);
    }
  };

  // ------------------------------------------------------------------
  // Delete team
  // ------------------------------------------------------------------
  const handleDeleteTeam = async (teamId) => {
    if (!window.confirm('Delete this team? This action cannot be undone.'))
      return;
    setSubmitting(true);
    try {
      const response = await fetch(`${API_BASE}/api/teams/${teamId}`, {
        method: 'DELETE',
        headers: { Authorization: `Bearer ${localStorage.getItem('token')}` },
      });
      if (!response.ok) throw new Error('Failed to delete team');
      fetchTeams();
    } catch (error) {
      alert(error.message || 'Error deleting team');
    } finally {
      setSubmitting(false);
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
                    Revenue
                  </th>
                  <th className="py-4 px-5 text-right text-sm font-semibold text-gray-600">
                    Expense
                  </th>
                  <th className="py-4 px-5 text-right text-sm font-semibold text-gray-600">
                    Profit
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
                                ? 'bg-purple-100 text-purple-800'
                                : 'bg-indigo-100 text-indigo-800'
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
                                ? `Centre #${team.centre_id}`
                                : 'Cross-Centre'}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-5 text-center">
                        <span
                          className={`inline-block px-2 py-1 text-xs rounded-full font-medium ${
                            team.is_global
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {team.is_global ? 'Global' : 'Centre'}
                        </span>
                      </td>
                      <td className="py-4 px-5 text-center font-medium">
                        {team.member_count}
                      </td>
                      <td className="py-4 px-5 text-right text-green-700">
                        {formatCurrency(team.revenue || 0)}
                      </td>
                      <td className="py-4 px-5 text-right text-red-600">
                        {formatCurrency(team.expense || 0)}
                      </td>
                      <td className="py-4 px-5 text-right">
                        <span
                          className={`font-semibold ${
                            Number(team.profit || 0) >= 0
                              ? 'text-green-700'
                              : 'text-red-700'
                          }`}
                        >
                          {formatCurrency(team.profit || 0)}
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
                          {isAdmin && (
                            <>
                              <button
                                onClick={() =>
                                  alert(
                                    'Edit team (to be implemented)'
                                  )
                                }
                                className="text-gray-600 hover:text-gray-800 p-1.5 rounded-lg hover:bg-gray-100"
                                title="Edit"
                              >
                                <FiEdit size={16} />
                              </button>
                              <button
                                onClick={() =>
                                  handleDeleteTeam(team.id)
                                }
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
                    value={teamForm.centre_id || ''}
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

              {/* Member selector */}
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
                          onClick={() =>
                            toggleMemberSelection(staffId)
                          }
                          className="ml-2 text-indigo-600 hover:text-indigo-800"
                          disabled={submitting}
                        >
                          <FiX size={14} />
                        </button>
                      </span>
                    );
                  })}
                </div>
                <div className="relative">
                  <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <input
                    type="text"
                    placeholder="Search staff to add..."
                    className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={staffSearch}
                    onChange={(e) =>
                      setStaffSearch(e.target.value)
                    }
                    disabled={submitting}
                  />
                  {staffSearch && (
                    <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                      {availableStaff
                        .filter(
                          (s) =>
                            s.name
                              .toLowerCase()
                              .includes(
                                staffSearch.toLowerCase()
                              ) &&
                            !teamForm.members.includes(s.id)
                        )
                        .map((staff) => (
                          <div
                            key={staff.id}
                            className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex justify-between items-center"
                            onClick={() => {
                              toggleMemberSelection(
                                staff.id
                              );
                              setStaffSearch('');
                            }}
                          >
                            <div>
                              <p className="font-medium">
                                {staff.name}
                              </p>
                              <p className="text-xs text-gray-500">
                                {staff.role}
                              </p>
                            </div>
                            <FiPlus className="text-indigo-600" />
                          </div>
                        ))}
                    </div>
                  )}
                </div>
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
              {/* Add member section */}
              <div className="mb-4">
                {!addMemberSearchOpen ? (
                  <button
                    onClick={() => setAddMemberSearchOpen(true)}
                    className="px-4 py-2 bg-indigo-50 text-indigo-700 rounded-lg hover:bg-indigo-100 flex items-center"
                  >
                    <FiUserPlus className="mr-2" /> Add Member
                  </button>
                ) : (
                  <div className="relative">
                    <FiSearch className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Search staff to add..."
                      className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      value={addMemberSearch}
                      onChange={(e) =>
                        setAddMemberSearch(e.target.value)
                      }
                      autoFocus
                      disabled={submitting}
                    />
                    <button
                      onClick={() => {
                        setAddMemberSearchOpen(false);
                        setAddMemberSearch('');
                      }}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                    >
                      <FiX size={16} />
                    </button>
                    {addMemberSearch && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-40 overflow-y-auto">
                        {availableStaff
                          .filter(
                            (s) =>
                              s.name
                                .toLowerCase()
                                .includes(
                                  addMemberSearch.toLowerCase()
                                ) &&
                              !selectedTeam.membersList?.some(
                                (m) => m.staff_id === s.id
                              )
                          )
                          .map((staff) => (
                            <div
                              key={staff.id}
                              className="px-4 py-2 hover:bg-gray-100 cursor-pointer flex justify-between items-center"
                              onClick={() =>
                                handleAddMemberToTeam(
                                  staff.id
                                )
                              }
                            >
                              <div>
                                <p className="font-medium">
                                  {staff.name}
                                </p>
                                <p className="text-xs text-gray-500">
                                  {staff.role}
                                </p>
                              </div>
                              <FiPlus className="text-indigo-600" />
                            </div>
                          ))}
                      </div>
                    )}
                  </div>
                )}
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
                              <FiStar
                                className="mr-1"
                                size={12}
                              />{' '}
                              Primary
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
                          onClick={() =>
                            handleSetPrimary(member.id)
                          }
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