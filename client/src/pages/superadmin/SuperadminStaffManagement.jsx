import { useState, useEffect, useMemo, useCallback } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import AddStaffForm from "./AddStaffForm";
import EditStaffForm from "/src/components/EditStaffForm";
import {
  FiEdit2, FiTrash2, FiUserPlus, FiSearch, FiEye, FiX, FiGrid, FiList, FiClock,
  FiMail, FiPhone, FiCalendar, FiGift, FiMapPin, FiUsers, FiUserCheck, FiHome,
  FiDownload, FiActivity, FiBriefcase,
} from "react-icons/fi";

const API_BASE = import.meta.env.VITE_API_URL;
const authHeader = () => ({ Authorization: `Bearer ${localStorage.getItem("token")}` });

/* ───────────── helpers ───────────── */
const getPhotoUrl = (photo) => {
  if (!photo || photo === "null" || photo === "undefined") return null;
  if (photo.startsWith("http") || photo.startsWith("data:image")) return photo;
  return `${API_BASE}${photo.startsWith("/") ? "" : "/"}${photo}`;
};

// "YYYY-MM-DD" or ISO -> "16 Oct 2026" with no timezone shift
const formatDate = (value, opts = { day: "2-digit", month: "short", year: "numeric" }) => {
  if (!value) return null;
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return null;
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", opts);
};

const formatTime = (t) => (t ? String(t).slice(0, 5) : null);
const formatTimeRange = (s, e) => (s && e ? `${formatTime(s)} – ${formatTime(e)}` : "Not set");

const initials = (name = "") =>
  name.split(" ").filter(Boolean).map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?";

const Avatar = ({ staff, size = "w-10 h-10", text = "text-sm" }) => {
  const [failed, setFailed] = useState(false);
  const url = getPhotoUrl(staff.photo);
  if (url && !failed) {
    return (
      <img
        src={url}
        alt={staff.name}
        onError={() => setFailed(true)}
        className={`${size} rounded-full object-cover border border-gray-200 bg-gray-100 shrink-0`}
      />
    );
  }
  return (
    <div className={`${size} rounded-full bg-blue-50 text-blue-700 border border-blue-100 flex items-center justify-center font-semibold ${text} shrink-0`}>
      {initials(staff.name)}
    </div>
  );
};

const StatusBadge = ({ status }) => {
  const cls = {
    Active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    "On Leave": "bg-amber-50 text-amber-700 border-amber-200",
    Terminated: "bg-red-50 text-red-700 border-red-200",
  };
  const dot = { Active: "bg-emerald-500", "On Leave": "bg-amber-500", Terminated: "bg-red-500" };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${cls[status] || cls.Active}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot[status] || dot.Active}`} />
      {status || "Active"}
    </span>
  );
};

const RoleBadge = ({ role }) => {
  const cls = {
    superadmin: "bg-purple-50 text-purple-700 border-purple-200",
    admin: "bg-blue-50 text-blue-700 border-blue-200",
    supervisor: "bg-amber-50 text-amber-700 border-amber-200",
    staff: "bg-gray-50 text-gray-700 border-gray-200",
  };
  return (
    <span className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full border capitalize ${cls[role?.toLowerCase()] || cls.staff}`}>
      {role}
    </span>
  );
};

const Detail = ({ label, value }) => (
  <div>
    <p className="text-xs text-gray-500 mb-0.5">{label}</p>
    <p className={`text-sm font-medium ${value ? "text-gray-900" : "text-gray-400"}`}>{value || "Not specified"}</p>
  </div>
);

const EMPTY_FILTERS = { role: "", centre_id: "", status: "" };

const getViewMode = () => {
  try { return localStorage.getItem("sa-staff-view-mode") || "card"; } catch { return "card"; }
};

/* ───────────── page ───────────── */
const SuperadminStaffManagement = () => {
  const [staffList, setStaffList] = useState([]);
  const [centres, setCentres] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingStaff, setEditingStaff] = useState(null);
  const [viewingStaff, setViewingStaff] = useState(null);
  const [deletingStaff, setDeletingStaff] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState(EMPTY_FILTERS);
  const [searchTerm, setSearchTerm] = useState("");
  const [viewMode, setViewMode] = useState(getViewMode);
  const [error, setError] = useState(null);

  const changeView = (mode) => {
    setViewMode(mode);
    try { localStorage.setItem("sa-staff-view-mode", mode); } catch {}
  };

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [centresRes, staffRes] = await Promise.all([
        axios.get(`${API_BASE}/api/centres`, { headers: authHeader() }),
        axios.get(`${API_BASE}/api/staff/all`, { headers: authHeader() }),
      ]);
      setCentres(Array.isArray(centresRes.data) ? centresRes.data : []);
      setStaffList(
        (staffRes.data || []).map((s) => ({ ...s, recentActivity: s.recent_activity || [] }))
      );
    } catch (err) {
      console.error("Error fetching data:", err);
      const msg = err.response?.data?.error || "Failed to load data";
      setError(msg);
      toast.error(msg);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(); }, [fetchData]);

  const centreName = useCallback(
    (id) => centres.find((c) => String(c.id) === String(id))?.name || "Unassigned",
    [centres]
  );
  const staffName = useCallback(
    (id) => staffList.find((s) => String(s.id) === String(id))?.name || null,
    [staffList]
  );

  // All filtering happens here, so no refetch when filters change
  const filteredStaff = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return staffList.filter((s) => {
      const matchesSearch =
        !q ||
        [s.name, s.username, s.email, s.employeeId, s.phone].some((f) => String(f || "").toLowerCase().includes(q));
      const matchesRole = !filters.role || s.role === filters.role;
      const matchesCentre = !filters.centre_id || String(s.centreId) === String(filters.centre_id);
      const matchesStatus = !filters.status || s.status === filters.status;
      return matchesSearch && matchesRole && matchesCentre && matchesStatus;
    });
  }, [staffList, searchTerm, filters]);

  const hasFilters = searchTerm || filters.role || filters.centre_id || filters.status;
  const resetFilters = () => {
    setFilters(EMPTY_FILTERS);
    setSearchTerm("");
  };
  const handleFilterChange = (e) => setFilters((f) => ({ ...f, [e.target.name]: e.target.value }));

  const confirmDelete = async () => {
    if (!deletingStaff) return;
    setDeleteBusy(true);
    try {
      await axios.delete(`${API_BASE}/api/staff/${deletingStaff.id}`, { headers: authHeader() });
      toast.success(`${deletingStaff.name} deleted`);
      setStaffList((list) => list.filter((s) => s.id !== deletingStaff.id));
      if (viewingStaff?.id === deletingStaff.id) setViewingStaff(null);
      setDeletingStaff(null);
    } catch (err) {
      console.error("Error deleting staff:", err);
      toast.error(err.response?.data?.error || "Failed to delete staff");
    } finally {
      setDeleteBusy(false);
    }
  };

  const exportCsv = () => {
    if (!filteredStaff.length) return toast.info("Nothing to export");
    const cols = [
      ["Employee ID", (s) => s.employeeId], ["Name", (s) => s.name], ["Username", (s) => s.username],
      ["Email", (s) => s.email], ["Phone", (s) => s.phone], ["Role", (s) => s.role],
      ["Centre", (s) => centreName(s.centreId)], ["Department", (s) => s.department], ["Status", (s) => s.status],
      ["Join Date", (s) => String(s.joinDate || "").slice(0, 10)],
      ["Date of Birth", (s) => String(s.dateOfBirth || s.dob || "").slice(0, 10)],
      ["Shift", (s) => (s.start_time ? formatTimeRange(s.start_time, s.end_time) : "")],
    ];
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const csv = [cols.map(([h]) => esc(h)).join(","), ...filteredStaff.map((s) => cols.map(([, f]) => esc(f(s))).join(","))].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `all-staff-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const stats = [
    { label: "Total Staff", value: staffList.length, icon: FiUsers, tone: "bg-blue-50 text-blue-600" },
    { label: "Active", value: staffList.filter((s) => s.status === "Active").length, icon: FiUserCheck, tone: "bg-emerald-50 text-emerald-600" },
    { label: "On Leave", value: staffList.filter((s) => s.status === "On Leave").length, icon: FiClock, tone: "bg-amber-50 text-amber-600" },
    { label: "Centres", value: centres.length, icon: FiHome, tone: "bg-purple-50 text-purple-600" },
  ];

  const selectCls = "px-3 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none";

  const ActionButtons = ({ staff }) => (
    <div className="inline-flex gap-1">
      <button onClick={() => setViewingStaff(staff)} className="p-2 rounded-lg text-gray-500 hover:text-gray-900 hover:bg-gray-100" title="View details">
        <FiEye size={15} />
      </button>
      <button onClick={() => setEditingStaff(staff)} className="p-2 rounded-lg text-gray-500 hover:text-blue-700 hover:bg-blue-50" title="Edit">
        <FiEdit2 size={15} />
      </button>
      <button onClick={() => setDeletingStaff(staff)} className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50" title="Delete">
        <FiTrash2 size={15} />
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Staff Management</h1>
            <p className="text-gray-500 mt-1">All staff across every centre</p>
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white bg-navy-700 hover:bg-navy-800 shadow-sm"
          >
            <FiUserPlus size={18} /> Add New Staff
          </button>
        </div>

        {error && (
          <div className="mb-6 px-4 py-3 bg-red-50 border border-red-200 rounded-xl flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-red-800">Couldn't load data</p>
              <p className="text-sm text-red-600">{error}</p>
            </div>
            <button onClick={fetchData} className="text-sm font-medium text-red-700 hover:text-red-900">Retry</button>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          {stats.map(({ label, value, icon: Icon, tone }) => (
            <div key={label} className="bg-white rounded-2xl p-5 border border-gray-200 shadow-sm flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 font-medium">{label}</p>
                <p className="text-2xl font-bold text-gray-900 mt-1">{loading ? "–" : value}</p>
              </div>
              <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${tone}`}>
                <Icon size={20} />
              </div>
            </div>
          ))}
        </div>

        {/* Toolbar */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-4 mb-6">
          <div className="flex flex-col xl:flex-row gap-3">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
              <input
                type="text"
                placeholder="Search name, username, employee ID, email or phone…"
                className="w-full pl-10 pr-9 py-2.5 border border-gray-300 rounded-xl text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  <FiX size={16} />
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-3">
              <select name="centre_id" value={filters.centre_id} onChange={handleFilterChange} className={selectCls}>
                <option value="">All centres</option>
                {centres.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
              <select name="role" value={filters.role} onChange={handleFilterChange} className={selectCls}>
                <option value="">All roles</option>
                <option value="superadmin">Superadmin</option>
                <option value="admin">Admin</option>
                <option value="supervisor">Supervisor</option>
                <option value="staff">Staff</option>
              </select>
              <select name="status" value={filters.status} onChange={handleFilterChange} className={selectCls}>
                <option value="">All statuses</option>
                <option value="Active">Active</option>
                <option value="On Leave">On Leave</option>
                <option value="Terminated">Terminated</option>
              </select>
              <div className="flex bg-gray-100 rounded-xl p-1">
                {[["card", FiGrid, "Cards"], ["table", FiList, "Table"]].map(([mode, Icon, label]) => (
                  <button
                    key={mode}
                    onClick={() => changeView(mode)}
                    className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-medium ${
                      viewMode === mode ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Icon size={15} /> <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>
              <button onClick={exportCsv} className="inline-flex items-center gap-2 px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50">
                <FiDownload size={15} /> Export
              </button>
            </div>
          </div>
          {hasFilters && (
            <div className="mt-3 flex items-center gap-3 text-sm text-gray-500">
              Showing {filteredStaff.length} of {staffList.length}
              <button onClick={resetFilters} className="text-blue-600 hover:text-blue-800 font-medium">Clear filters</button>
            </div>
          )}
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="bg-white rounded-2xl border border-gray-200 p-5 animate-pulse">
                <div className="flex gap-3">
                  <div className="w-14 h-14 rounded-full bg-gray-200" />
                  <div className="flex-1 space-y-2 pt-1">
                    <div className="h-4 bg-gray-200 rounded w-3/4" />
                    <div className="h-3 bg-gray-200 rounded w-1/2" />
                  </div>
                </div>
                <div className="mt-5 space-y-2">
                  <div className="h-3 bg-gray-200 rounded" />
                  <div className="h-3 bg-gray-200 rounded w-5/6" />
                </div>
              </div>
            ))}
          </div>
        ) : filteredStaff.length === 0 ? (
          <div className="bg-white rounded-2xl border border-gray-200 p-12 text-center">
            <div className="w-14 h-14 rounded-2xl bg-gray-100 flex items-center justify-center mx-auto mb-4">
              <FiSearch className="text-gray-400" size={24} />
            </div>
            <h3 className="text-lg font-semibold text-gray-900">No staff members found</h3>
            <p className="text-gray-500 mt-1 mb-5">Try adjusting your search or filters</p>
            {hasFilters && (
              <button onClick={resetFilters} className="px-5 py-2.5 bg-navy-700 text-white rounded-xl font-medium hover:bg-navy-800">
                Clear filters
              </button>
            )}
          </div>
        ) : viewMode === "table" ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    {["Staff Member", "Role", "Centre", "Status", "Shift", "Birthday"].map((h) => (
                      <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">{h}</th>
                    ))}
                    <th className="px-5 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-100">
                  {filteredStaff.map((staff) => {
                    const dob = staff.dateOfBirth || staff.dob;
                    return (
                      <tr key={staff.id} className="hover:bg-gray-50">
                        <td className="px-5 py-3.5 whitespace-nowrap">
                          <div className="flex items-center gap-3">
                            <Avatar staff={staff} />
                            <div className="min-w-0">
                              <p className="text-sm font-semibold text-gray-900 truncate">{staff.name}</p>
                              <p className="text-xs text-gray-500 truncate max-w-[220px]">{staff.email}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap"><RoleBadge role={staff.role} /></td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-600">{centreName(staff.centreId)}</td>
                        <td className="px-5 py-3.5 whitespace-nowrap"><StatusBadge status={staff.status} /></td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-600">
                          {staff.role === "superadmin" ? "—" : formatTimeRange(staff.start_time, staff.end_time)}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-sm text-gray-600">
                          {formatDate(dob, { day: "2-digit", month: "short" }) || "—"}
                        </td>
                        <td className="px-5 py-3.5 whitespace-nowrap text-right"><ActionButtons staff={staff} /></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredStaff.map((staff) => {
              const dob = staff.dateOfBirth || staff.dob;
              return (
                <div key={staff.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all flex flex-col">
                  <div className="p-5 flex-1">
                    <div className="flex items-start gap-3">
                      <Avatar staff={staff} size="w-14 h-14" text="text-base" />
                      <div className="min-w-0 flex-1">
                        <h3 className="font-semibold text-gray-900 truncate">{staff.name}</h3>
                        <p className="text-xs text-gray-500 truncate">
                          @{staff.username}
                          {staff.employeeId && <span className="text-gray-400"> · {staff.employeeId}</span>}
                        </p>
                        <div className="flex flex-wrap gap-1.5 mt-2">
                          <RoleBadge role={staff.role} />
                          <StatusBadge status={staff.status} />
                        </div>
                      </div>
                    </div>
                    <div className="mt-4 space-y-2 text-sm text-gray-600">
                      <p className="flex items-center gap-2.5 min-w-0">
                        <FiMapPin className="text-gray-400 shrink-0" size={14} />
                        <span className="truncate">{centreName(staff.centreId)}</span>
                      </p>
                      <p className="flex items-center gap-2.5 min-w-0">
                        <FiMail className="text-gray-400 shrink-0" size={14} />
                        <span className="truncate">{staff.email}</span>
                      </p>
                      {staff.role !== "superadmin" && (
                        <p className="flex items-center gap-2.5">
                          <FiClock className="text-gray-400 shrink-0" size={14} />
                          {formatTimeRange(staff.start_time, staff.end_time)}
                        </p>
                      )}
                      {dob && (
                        <p className="flex items-center gap-2.5">
                          <FiGift className="text-gray-400 shrink-0" size={14} />
                          Birthday {formatDate(dob, { day: "2-digit", month: "short" })}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center justify-between px-3 py-2 border-t border-gray-100">
                    <button
                      onClick={() => setViewingStaff(staff)}
                      className="text-sm font-medium text-blue-600 hover:text-blue-800 px-2 py-1.5 rounded-lg hover:bg-blue-50"
                    >
                      View details
                    </button>
                    <div className="inline-flex gap-1">
                      <button onClick={() => setEditingStaff(staff)} className="p-2 rounded-lg text-gray-500 hover:text-blue-700 hover:bg-blue-50" title="Edit">
                        <FiEdit2 size={15} />
                      </button>
                      <button onClick={() => setDeletingStaff(staff)} className="p-2 rounded-lg text-gray-500 hover:text-red-600 hover:bg-red-50" title="Delete">
                        <FiTrash2 size={15} />
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setShowAddModal(false)}>
            <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <AddStaffForm
                centres={centres}
                onAdd={() => {
                  setShowAddModal(false);
                  fetchData();
                }}
                onClose={() => setShowAddModal(false)}
              />
            </div>
          </div>
        )}

        {/* Edit modal (EditStaffForm has its own header and buttons) */}
        {editingStaff && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setEditingStaff(null)}>
            <div className="bg-gray-50 rounded-2xl w-full max-w-4xl max-h-[92vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
              <EditStaffForm
                staff={editingStaff}
                onUpdate={() => {
                  setEditingStaff(null);
                  fetchData();
                }}
                onClose={() => setEditingStaff(null)}
              />
            </div>
          </div>
        )}

        {/* Details modal */}
        {viewingStaff && (() => {
          const s = viewingStaff;
          const dob = s.dateOfBirth || s.dob;
          const salary = s.salary != null && s.salary !== "" ? Number(s.salary) : null;
          return (
            <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50" onClick={() => setViewingStaff(null)}>
              <div className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl" onClick={(e) => e.stopPropagation()}>
                {/* Header */}
                <div className="sticky top-0 bg-white z-10 flex items-start justify-between gap-4 px-6 py-5 border-b border-gray-200">
                  <div className="flex items-center gap-4 min-w-0">
                    <Avatar staff={s} size="w-16 h-16" text="text-lg" />
                    <div className="min-w-0">
                      <h2 className="text-xl font-bold text-gray-900 truncate">{s.name}</h2>
                      <p className="text-sm text-gray-500 truncate">@{s.username}{s.employeeId && ` · ${s.employeeId}`}</p>
                      <div className="flex flex-wrap gap-1.5 mt-2">
                        <RoleBadge role={s.role} />
                        <StatusBadge status={s.status} />
                      </div>
                    </div>
                  </div>
                  <button onClick={() => setViewingStaff(null)} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100">
                    <FiX size={20} />
                  </button>
                </div>

                <div className="px-6 py-5 space-y-6">
                  {/* Contact strip */}
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {[
                      [FiMail, "Email", s.email && <a href={`mailto:${s.email}`} className="text-blue-600 hover:underline">{s.email}</a>],
                      [FiPhone, "Phone", s.phone && <a href={`tel:${s.phone}`} className="text-blue-600 hover:underline">{s.phone}</a>],
                      [FiMapPin, "Centre", centreName(s.centreId)],
                    ].map(([Icon, label, value]) => (
                      <div key={label} className="flex items-start gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100 min-w-0">
                        <Icon className="text-gray-400 mt-0.5 shrink-0" size={16} />
                        <div className="min-w-0">
                          <p className="text-xs text-gray-500">{label}</p>
                          <div className="text-sm font-medium text-gray-900 truncate">{value || <span className="text-gray-400">Not specified</span>}</div>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div>
                    <h3 className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      <FiBriefcase size={13} /> Employment
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      <Detail label="Department" value={s.department} />
                      <Detail label="Employment Type" value={s.employmentType} />
                      <Detail label="Reports To" value={staffName(s.reportsTo)} />
                      <Detail label="Join Date" value={formatDate(s.joinDate)} />
                      <Detail label="Salary" value={salary !== null && !isNaN(salary) ? `₹${salary.toLocaleString("en-IN")} / month` : null} />
                    </div>
                  </div>

                  <div>
                    <h3 className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      <FiGift size={13} /> Personal
                    </h3>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                      <Detail label="Date of Birth" value={formatDate(dob)} />
                      <Detail label="Gender" value={s.gender} />
                      <Detail label="Emergency Contact" value={s.emergencyContact && `${s.emergencyContact}${s.emergencyRelationship ? ` (${s.emergencyRelationship})` : ""}`} />
                    </div>
                  </div>

                  {s.role !== "superadmin" && (
                    <div>
                      <h3 className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                        <FiCalendar size={13} /> Current schedule
                      </h3>
                      <div className="grid grid-cols-3 gap-3">
                        {[
                          ["Start", formatTime(s.start_time)],
                          ["End", formatTime(s.end_time)],
                          ["Effective from", formatDate(s.effective_from)],
                        ].map(([label, value]) => (
                          <div key={label} className="p-3 rounded-xl border border-gray-200">
                            <p className="text-xs text-gray-500">{label}</p>
                            <p className="text-sm font-semibold text-gray-900">{value || "Not set"}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  <div>
                    <h3 className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
                      <FiActivity size={13} /> Recent activity
                    </h3>
                    {s.recentActivity?.length > 0 ? (
                      <ul className="divide-y divide-gray-100 border border-gray-200 rounded-xl">
                        {s.recentActivity.slice(0, 5).map((a, i) => (
                          <li key={i} className="flex items-start justify-between gap-3 px-4 py-3">
                            <div className="min-w-0">
                              <p className="text-sm font-medium text-gray-900 capitalize">{String(a.action || "").replace(/_/g, " ")}</p>
                              {a.details && <p className="text-xs text-gray-500 truncate">{a.details}</p>}
                            </div>
                            <p className="text-xs text-gray-400 shrink-0">{new Date(a.timestamp).toLocaleString("en-IN")}</p>
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="text-sm text-gray-500 text-center py-6 border border-dashed border-gray-200 rounded-xl">No recent activity</p>
                    )}
                  </div>
                </div>

                {/* Footer */}
                <div className="sticky bottom-0 bg-white px-6 py-4 border-t border-gray-200 flex justify-between gap-3">
                  <button
                    onClick={() => setDeletingStaff(s)}
                    className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium text-red-600 hover:bg-red-50"
                  >
                    <FiTrash2 size={15} /> Delete
                  </button>
                  <button
                    onClick={() => {
                      setEditingStaff(s);
                      setViewingStaff(null);
                    }}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold text-white bg-navy-700 hover:bg-navy-800"
                  >
                    <FiEdit2 size={15} /> Edit Profile
                  </button>
                </div>
              </div>
            </div>
          );
        })()}

        {/* Delete confirmation */}
        {deletingStaff && (
          <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-[60]" onClick={() => !deleteBusy && setDeletingStaff(null)}>
            <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-bold text-gray-900 mb-2">Delete staff member?</h3>
              <p className="text-sm text-gray-600 mb-6">
                <span className="font-semibold text-gray-900">{deletingStaff.name}</span>'s profile will be permanently deleted. This cannot be undone.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setDeletingStaff(null)}
                  disabled={deleteBusy}
                  className="px-4 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmDelete}
                  disabled={deleteBusy}
                  className="inline-flex items-center gap-2 px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-sm font-semibold disabled:opacity-60"
                >
                  <FiTrash2 size={15} /> {deleteBusy ? "Deleting…" : "Delete permanently"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SuperadminStaffManagement;