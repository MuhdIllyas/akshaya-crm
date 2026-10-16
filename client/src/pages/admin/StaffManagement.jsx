import { useState, useEffect, useMemo, useCallback } from "react";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";
import {
  FiPlus, FiSearch, FiDownload, FiGrid, FiList, FiUsers, FiUserCheck,
  FiClock, FiLayers, FiMail, FiPhone, FiCalendar, FiGift, FiEdit2, FiX,
} from "react-icons/fi";
import StaffTable, { StaffAvatar, StatusBadge, RoleBadge, formatDate } from "../../components/StaffTable";
import AddStaffForm from "../../components/AddStaffForm";

const DEPARTMENTS = ["All", "Accounts", "Reception", "Front Office", "Aadhaar", "Staff Executive", "Customer Relations"];
const STATUSES = ["All", "Active", "On Leave", "Terminated"];

const getViewMode = () => {
  try { return localStorage.getItem("staff-view-mode") || "card"; } catch { return "card"; }
};

const StaffManagement = () => {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [viewMode, setViewMode] = useState(getViewMode);

  const changeView = (mode) => {
    setViewMode(mode);
    try { localStorage.setItem("staff-view-mode", mode); } catch {}
  };

  const fetchStaff = useCallback(async () => {
    setLoading(true);
    try {
      const role = localStorage.getItem("role");
      const centreId = localStorage.getItem("centre_id");
      const url =
        role === "superadmin"
          ? `${import.meta.env.VITE_API_URL}/api/staff/all`
          : `${import.meta.env.VITE_API_URL}/api/staff/all?centre_id=${centreId}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to fetch staff");
      setStaffList(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching staff:", err);
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStaff(); }, [fetchStaff]);

  const handleStaffAdded = () => {
    setShowAddForm(false);
    fetchStaff();
  };

  const filteredStaff = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return staffList.filter((s) => {
      const matchesSearch =
        !q ||
        s.name?.toLowerCase().includes(q) ||
        s.email?.toLowerCase().includes(q) ||
        s.username?.toLowerCase().includes(q) ||
        s.employeeId?.toLowerCase().includes(q) ||
        s.phone?.includes(q);
      const matchesDept = selectedDepartment === "All" || s.department === selectedDepartment;
      const matchesStatus = selectedStatus === "All" || s.status === selectedStatus;
      return matchesSearch && matchesDept && matchesStatus;
    });
  }, [staffList, searchTerm, selectedDepartment, selectedStatus]);

  const hasFilters = searchTerm || selectedDepartment !== "All" || selectedStatus !== "All";
  const resetFilters = () => {
    setSearchTerm("");
    setSelectedDepartment("All");
    setSelectedStatus("All");
  };

  const stats = [
    { label: "Total Staff", value: staffList.length, icon: FiUsers, tone: "bg-blue-50 text-blue-600" },
    { label: "Active", value: staffList.filter((s) => s.status === "Active").length, icon: FiUserCheck, tone: "bg-emerald-50 text-emerald-600" },
    { label: "On Leave", value: staffList.filter((s) => s.status === "On Leave").length, icon: FiClock, tone: "bg-amber-50 text-amber-600" },
    { label: "Departments", value: new Set(staffList.map((s) => s.department).filter(Boolean)).size, icon: FiLayers, tone: "bg-purple-50 text-purple-600" },
  ];

  const exportCsv = () => {
    if (!filteredStaff.length) return toast.info("Nothing to export");
    const cols = [
      ["Employee ID", "employeeId"], ["Name", "name"], ["Username", "username"], ["Email", "email"],
      ["Phone", "phone"], ["Role", "role"], ["Department", "department"], ["Status", "status"],
      ["Join Date", "joinDate"], ["Date of Birth", "dateOfBirth"],
    ];
    const esc = (v) => `"${String(v ?? "").replace(/"/g, '""')}"`;
    const rows = filteredStaff.map((s) =>
      cols.map(([, k]) => {
        if (k === "dateOfBirth") return esc(String(s.dateOfBirth || s.dob || "").slice(0, 10));
        if (k === "joinDate") return esc(String(s.joinDate || "").slice(0, 10));
        return esc(s[k]);
      }).join(",")
    );
    const csv = [cols.map(([h]) => esc(h)).join(","), ...rows].join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `staff-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8">
      <div className="max-w-7xl mx-auto">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Staff Management</h1>
            <p className="text-gray-500 mt-1">Manage your team members, roles and details</p>
          </div>
          <button
            onClick={() => setShowAddForm(true)}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-xl font-semibold text-white bg-navy-700 hover:bg-navy-800 shadow-sm transition-colors"
          >
            <FiPlus size={18} /> Add Staff Member
          </button>
        </div>

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
          <div className="flex flex-col lg:flex-row gap-3">
            <div className="relative flex-1">
              <FiSearch className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400" size={17} />
              <input
                type="text"
                placeholder="Search name, username, employee ID, email or phone…"
                className="w-full pl-10 pr-9 py-2.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none text-sm"
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
              <select
                value={selectedDepartment}
                onChange={(e) => setSelectedDepartment(e.target.value)}
                className="px-3 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {DEPARTMENTS.map((d) => <option key={d} value={d}>{d === "All" ? "All departments" : d}</option>)}
              </select>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="px-3 py-2.5 border border-gray-300 rounded-xl text-sm bg-white focus:ring-2 focus:ring-blue-500 outline-none"
              >
                {STATUSES.map((s) => <option key={s} value={s}>{s === "All" ? "All statuses" : s}</option>)}
              </select>

              <div className="flex bg-gray-100 rounded-xl p-1">
                {[["card", FiGrid, "Cards"], ["table", FiList, "Table"]].map(([mode, Icon, label]) => (
                  <button
                    key={mode}
                    onClick={() => changeView(mode)}
                    className={`px-3 py-1.5 rounded-lg flex items-center gap-1.5 text-sm font-medium transition-colors ${
                      viewMode === mode ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <Icon size={15} /> <span className="hidden sm:inline">{label}</span>
                  </button>
                ))}
              </div>

              <button
                onClick={exportCsv}
                className="inline-flex items-center gap-2 px-3.5 py-2.5 border border-gray-300 rounded-xl text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
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
            <StaffTable staffList={filteredStaff} />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
            {filteredStaff.map((staff) => {
              const dob = staff.dateOfBirth || staff.dob;
              return (
                <div key={staff.id} className="bg-white rounded-2xl border border-gray-200 shadow-sm hover:shadow-md hover:border-gray-300 transition-all flex flex-col">
                  <div className="p-5 flex-1">
                    <div className="flex items-start gap-3">
                      <StaffAvatar staff={staff} size="w-14 h-14" text="text-base" />
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
                        <FiMail className="text-gray-400 shrink-0" size={14} />
                        <span className="truncate">{staff.email}</span>
                      </p>
                      <p className="flex items-center gap-2.5">
                        <FiPhone className="text-gray-400 shrink-0" size={14} />
                        {staff.phone || "—"}
                      </p>
                      {staff.department && (
                        <p className="flex items-center gap-2.5">
                          <FiLayers className="text-gray-400 shrink-0" size={14} />
                          {staff.department}
                        </p>
                      )}
                      <p className="flex items-center gap-2.5">
                        <FiCalendar className="text-gray-400 shrink-0" size={14} />
                        Joined {formatDate(staff.joinDate)}
                      </p>
                      {dob && (
                        <p className="flex items-center gap-2.5">
                          <FiGift className="text-gray-400 shrink-0" size={14} />
                          Birthday {formatDate(dob, { day: "2-digit", month: "short" })}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-2 border-t border-gray-100">
                    <Link
                      to={`/dashboard/admin/staff/edit/${staff.id}`}
                      className="flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-gray-600 hover:text-blue-700 hover:bg-gray-50 rounded-bl-2xl border-r border-gray-100"
                    >
                      <FiEdit2 size={14} /> Edit
                    </Link>
                    <Link
                      to={`/dashboard/admin/staff/${staff.id}`}
                      className="flex items-center justify-center gap-1.5 py-3 text-sm font-medium text-blue-600 hover:text-blue-800 hover:bg-gray-50 rounded-br-2xl"
                    >
                      View Profile
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Add Staff Modal */}
        {showAddForm && (
          <div
            className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50"
            onClick={() => setShowAddForm(false)}
          >
            <div
              className="bg-white rounded-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto shadow-2xl"
              onClick={(e) => e.stopPropagation()}
            >
              <AddStaffForm onAdd={handleStaffAdded} onClose={() => setShowAddForm(false)} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffManagement;