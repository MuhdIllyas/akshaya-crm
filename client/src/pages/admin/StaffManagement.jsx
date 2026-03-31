import { useState, useEffect } from "react";
import { toast } from "react-toastify";
import StaffTable from "../../components/StaffTable";
import AddStaffForm from "../../components/AddStaffForm";
import { Link } from "react-router-dom";
import { FiPlus, FiSearch, FiFilter, FiDownload, FiGrid, FiList, FiUser, FiMail, FiPhone, FiCalendar, FiClock, FiRefreshCw, FiX } from "react-icons/fi";

const StaffManagement = () => {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showAddForm, setShowAddForm] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedDepartment, setSelectedDepartment] = useState("All");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [viewMode, setViewMode] = useState("card");
  const [filterExpanded, setFilterExpanded] = useState(false);

  const departments = ["All", "Accounts", "Reception", "Front Office", "Aadhaar", "Staff Executive", "Customer Relations"];
  const statuses = ["All", "Active", "On Leave", "Terminated"];

  useEffect(() => {
    const fetchStaff = async () => {
      setLoading(true);
      try {
        const role = localStorage.getItem("role");
        const centreId = localStorage.getItem("centre_id");
        const url = role === "superadmin" ? `${import.meta.env.VITE_API_URL}/api/staff/all` : `${import.meta.env.VITE_API_URL}/api/staff/all?centre_id=${centreId}`;
        const response = await fetch(url, {
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
        });
        const data = await response.json();
        if (response.ok) {
          setStaffList(data);
        } else {
          throw new Error(data.error || "Failed to fetch staff");
        }
      } catch (err) {
        console.error("Error fetching staff:", err);
        toast.error(err.message, { position: "top-right", autoClose: 5000, theme: "light" });
      } finally {
        setLoading(false);
      }
    };
    fetchStaff();
  }, []);

  const handleAddStaff = async () => {
    try {
      const role = localStorage.getItem("role");
      const centreId = localStorage.getItem("centre_id");
      const url = role === "superadmin" ? `${import.meta.env.VITE_API_URL}/api/staff/all` : `${import.meta.env.VITE_API_URL}/api/staff/all?centre_id=${centreId}`;
      const response = await fetch(url, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
      });
      const data = await response.json();
      if (response.ok) {
        setStaffList(data);
        toast.success("Staff added successfully", { position: "top-right", autoClose: 3000, theme: "light" });
      } else {
        throw new Error(data.error || "Failed to refresh staff list");
      }
    } catch (error) {
      console.error("Failed to refresh staff list:", error);
      toast.error(error.message, { position: "top-right", autoClose: 5000, theme: "light" });
    }
    setShowAddForm(false);
  };

  const filteredStaff = staffList.filter((staff) => {
    const matchesSearch =
      staff.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      staff.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      staff.phone?.includes(searchTerm) ||
      staff.username.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesDepartment = selectedDepartment === "All" || staff.department === selectedDepartment;
    const matchesStatus = selectedStatus === "All" || staff.status === selectedStatus;
    return matchesSearch && matchesDepartment && matchesStatus;
  });

  const getStatusBadge = (status) => {
    const statusConfig = {
      "Active": { bg: "bg-emerald-50", text: "text-emerald-700", dot: "bg-emerald-500" },
      "On Leave": { bg: "bg-amber-50", text: "text-amber-700", dot: "bg-amber-500" },
      "Terminated": { bg: "bg-red-50", text: "text-red-700", dot: "bg-red-500" }
    };
    
    const config = statusConfig[status] || statusConfig["Active"];
    
    return (
      <span className={`${config.bg} ${config.text} text-xs font-medium px-3 py-1.5 rounded-full flex items-center w-fit border`}>
        <span className={`w-2 h-2 ${config.dot} rounded-full mr-2`}></span>
        {status}
      </span>
    );
  };

  const getRoleBadge = (role) => {
    const roleColors = {
      superadmin: "bg-purple-100 text-purple-700 border border-purple-200",
      admin: "bg-blue-100 text-blue-700 border border-blue-200",
      staff: "bg-gray-100 text-gray-700 border border-gray-200",
      supervisor: "bg-amber-100 text-amber-700 border border-amber-200",
    };
    return (
      <span
        className={`text-xs font-medium px-3 py-1.5 rounded-full ${roleColors[role?.toLowerCase()] || "bg-gray-100 text-gray-700"}`}
      >
        {role}
      </span>
    );
  };

  // Loading skeleton for cards
  const CardSkeleton = () => (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden animate-pulse">
      <div className="p-6">
        <div className="flex items-start gap-4">
          <div className="flex-shrink-0">
            <div className="w-16 h-16 bg-gray-200 rounded-full"></div>
          </div>
          <div className="flex-1 space-y-3">
            <div className="h-5 bg-gray-200 rounded w-3/4"></div>
            <div className="flex gap-2">
              <div className="h-6 bg-gray-200 rounded w-20"></div>
              <div className="h-6 bg-gray-200 rounded w-16"></div>
            </div>
            <div className="space-y-2">
              <div className="h-4 bg-gray-200 rounded w-full"></div>
              <div className="h-4 bg-gray-200 rounded w-5/6"></div>
              <div className="h-4 bg-gray-200 rounded w-4/6"></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );

  const StaffCardView = ({ staffList }) => {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {staffList.length > 0 ? (
          staffList.map((staff) => (
            <div
              key={staff.id}
              className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden transition-all hover:shadow-lg hover:scale-[1.02] group"
            >
              <div className="p-6">
                <div className="flex items-start gap-4 mb-4">
                  <div className="flex-shrink-0 relative">
                    {staff.photo ? (
                      <img
                        src={staff.photo}
                        alt={staff.name}
                        className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-md"
                      />
                    ) : (
                      <div className="bg-blue-100 border-2 border-white rounded-2xl w-16 h-16 flex items-center justify-center shadow-md">
                        <FiUser className="text-blue-600 text-xl" />
                      </div>
                    )}
                    <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-white border-2 border-white flex items-center justify-center">
                      {getStatusBadge(staff.status)}
                    </div>
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h3 className="font-bold text-gray-900 text-lg truncate group-hover:text-blue-600 transition-colors">
                        {staff.name}
                      </h3>
                      <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Link
                          to={`/dashboard/admin/staff/edit/${staff.id}`} 
                          className="text-gray-400 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-indigo-50 transition-all"
                          title="Edit staff"
                        >
                          <FiSearch className="text-lg" />
                        </Link>
                      </div>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 mt-2">
                      {getRoleBadge(staff.role)}
                    </div>
                  </div>
                </div>
                
                <div className="space-y-3 mb-4">
                  <div className="flex items-center text-sm text-gray-600">
                    <FiMail className="text-gray-400 mr-3 text-lg" />
                    <span className="truncate">{staff.email}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <FiUser className="text-gray-400 mr-3 text-lg" />
                    <span className="truncate">@{staff.username}</span>
                  </div>
                  <div className="flex items-center text-sm text-gray-600">
                    <FiPhone className="text-gray-400 mr-3 text-lg" />
                    <span className="truncate">{staff.phone || "N/A"}</span>
                  </div>
                  {staff.department && (
                    <div className="flex items-center text-sm text-gray-600">
                      <div className="w-5 h-5 flex items-center justify-center mr-3">
                        <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                      </div>
                      <span className="truncate">{staff.department}</span>
                    </div>
                  )}
                  {staff.joinDate && (
                    <div className="flex items-center text-sm text-gray-600">
                      <FiCalendar className="text-gray-400 mr-3 text-lg" />
                      <span className="truncate">{staff.joinDate.split("T")[0]}</span>
                    </div>
                  )}
                </div>

                <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                  <Link
                    to=to={`/dashboard/admin/staff/${staff.id}`} 
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium px-3 py-2 rounded-lg hover:bg-blue-50 transition-all"
                  >
                    Edit
                  </Link>
                  <Link
                    to=to={`/dashboard/admin/staff/${staff.id}`} 
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium px-3 py-2 rounded-lg hover:bg-blue-50 transition-all"
                  >
                    View Profile
                  </Link>
                </div>
              </div>
            </div>
          ))
        ) : (
          <div className="col-span-full bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
            <div className="flex flex-col items-center">
              <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-2xl w-20 h-20 flex items-center justify-center mb-6">
                <FiSearch className="text-gray-400 text-3xl" />
              </div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No staff members found</h3>
              <p className="text-gray-600 mb-6">Try adjusting your search or filter criteria</p>
              <button
                onClick={() => {
                  setSearchTerm("");
                  setSelectedDepartment("All");
                  setSelectedStatus("All");
                }}
                className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-all"
              >
                Reset filters
              </button>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 scrollbar-hide">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
          <div className="mb-6 md:mb-0">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
              Staff Management
            </h1>
            <p className="text-gray-600 mt-2 text-lg">Manage your team members, roles, and permissions</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex bg-white rounded-xl p-1 border border-gray-200">
              <button
                onClick={() => setViewMode("card")}
                className={`p-2 rounded-lg flex items-center gap-2 transition-all ${
                  viewMode === "card" 
                    ? "bg-blue-50 text-blue-600 border border-blue-200" 
                    : "text-gray-500 hover:text-gray-700"
                }`}
                disabled={loading}
              >
                <FiGrid className="text-lg" />
                <span className="text-sm font-medium hidden sm:inline">Cards</span>
              </button>
              <button
                onClick={() => setViewMode("table")}
                className={`p-2 rounded-lg flex items-center gap-2 transition-all ${
                  viewMode === "table" 
                    ? "bg-blue-50 text-blue-600 border border-blue-200" 
                    : "text-gray-500 hover:text-gray-700"
                }`}
                disabled={loading}
              >
                <FiList className="text-lg" />
                <span className="text-sm font-medium hidden sm:inline">Table</span>
              </button>
            </div>
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-3 px-6 py-3.5 rounded-xl font-semibold text-white bg-navy-700 hover:bg-navy-800 shadow-md hover:shadow-lg transition-all duration-300 group"
              disabled={loading}
            >
              <FiPlus className="text-xl group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline">Add Staff Member</span>
            </button>
          </div>
        </div>

        {/* Search and Filter Bar */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <FiSearch className="text-gray-400 text-lg" />
              </div>
              <input
                type="text"
                placeholder="Search by name, username, email or phone..."
                className="w-full pl-12 pr-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                disabled={loading}
              />
            </div>
            <button
              onClick={() => setFilterExpanded(!filterExpanded)}
              className="flex items-center gap-3 px-5 py-3.5 bg-white border border-gray-300 hover:border-gray-400 text-gray-700 rounded-xl transition-all hover:shadow-md"
              disabled={loading}
            >
              <FiFilter className="text-lg" />
              <span className="font-medium">Filters</span>
              {filterExpanded && <span className="w-2 h-2 bg-blue-500 rounded-full"></span>}
            </button>
            <button
              onClick={() => {
                setSearchTerm("");
                setSelectedDepartment("All");
                setSelectedStatus("All");
              }}
              className="flex items-center gap-3 px-5 py-3.5 bg-white border border-gray-300 hover:border-gray-400 text-gray-700 rounded-xl transition-all hover:shadow-md"
              disabled={loading}
            >
              <FiRefreshCw className={`text-lg ${loading ? 'animate-spin' : ''}`} />
              <span className="font-medium">Reset</span>
            </button>
          </div>
          
          {filterExpanded && (
            <div className="mt-6 pt-6 border-t border-gray-200 grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Department</label>
                <select
                  value={selectedDepartment}
                  onChange={(e) => setSelectedDepartment(e.target.value)}
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                  disabled={loading}
                >
                  {departments.map((dept) => (
                    <option key={dept} value={dept}>{dept}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Status</label>
                <select
                  value={selectedStatus}
                  onChange={(e) => setSelectedStatus(e.target.value)}
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                  disabled={loading}
                >
                  {statuses.map((status) => (
                    <option key={status} value={status}>{status}</option>
                  ))}
                </select>
              </div>
            </div>
          )}
        </div>

        {/* Stats Overview */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Total Staff</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{staffList.length}</p>
              </div>
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center">
                <FiUser className="text-blue-600 text-xl" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Active</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">
                  {staffList.filter((s) => s.status === "Active").length}
                </p>
              </div>
              <div className="w-12 h-12 bg-emerald-100 rounded-xl flex items-center justify-center">
                <div className="w-3 h-3 bg-emerald-500 rounded-full"></div>
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">On Leave</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">
                  {staffList.filter((s) => s.status === "On Leave").length}
                </p>
              </div>
              <div className="w-12 h-12 bg-amber-100 rounded-xl flex items-center justify-center">
                <FiClock className="text-amber-600 text-xl" />
              </div>
            </div>
          </div>
          <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-gray-500 text-sm font-medium">Departments</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">
                  {[...new Set(staffList.map((s) => s.department))].filter(Boolean).length}
                </p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <FiGrid className="text-purple-600 text-xl" />
              </div>
            </div>
          </div>
        </div>

        {/* Content Header */}
        <div className="mb-6 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-gray-800">Staff Members</h3>
          <button className="flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 hover:border-gray-400 text-gray-700 rounded-xl transition-all hover:shadow-md">
            <FiDownload className="text-lg" />
            <span className="font-medium">Export CSV</span>
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {Array.from({ length: 8 }).map((_, index) => <CardSkeleton key={index} />)}
          </div>
        ) : viewMode === "table" ? (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden scrollbar-hide">
            <StaffTable staffList={filteredStaff} />
          </div>
        ) : (
          <StaffCardView staffList={filteredStaff} />
        )}

        {/* Add Staff Modal */}
        {showAddForm && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn scrollbar-hide">
            <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 scrollbar-hide">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">
                    Add New Staff
                  </h2>
                  <button
                    onClick={() => setShowAddForm(false)}
                    className="text-gray-400 hover:text-gray-500 text-2xl p-2 hover:bg-gray-100 rounded-xl transition-all"
                  >
                    <FiX />
                  </button>
                </div>
                <AddStaffForm onAdd={handleAddStaff} onClose={() => setShowAddForm(false)} />
              </div>
            </div>
          </div>
        )}
      </div>

      <style jsx>{`
        .scrollbar-hide {
          -ms-overflow-style: none;
          scrollbar-width: none;
        }
        .scrollbar-hide::-webkit-scrollbar {
          display: none;
        }
      `}</style>
    </div>
  );
};

export default StaffManagement;
