import { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import AddStaffForm from "./AddStaffForm";
import EditStaffForm from "/src/components/EditStaffForm";
import { FiPlus, FiEdit, FiTrash2, FiUserPlus, FiFilter, FiRefreshCw, FiSearch, FiEye, FiUser, FiX, FiGrid, FiList, FiClock, FiMail, FiPhone, FiDollarSign, FiCalendar } from "react-icons/fi";

const SuperadminStaffManagement = () => {
  const [staffList, setStaffList] = useState([]);
  const [centres, setCentres] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedStaff, setSelectedStaff] = useState(null);
  const [loading, setLoading] = useState(false);
  const [filters, setFilters] = useState({ role: "", centre_id: "", status: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [filterExpanded, setFilterExpanded] = useState(false);
  const [showStaffDetails, setShowStaffDetails] = useState(null);
  const [viewMode, setViewMode] = useState("card");
  const [error, setError] = useState(null);

  // Helper function to format time from "HH:MM:SS" to "HH:MM"
  const formatTime = (timeString) => {
    if (!timeString) return "N/A";
    return timeString.split(':').slice(0, 2).join(':');
  };

  // Helper function to format time range
  const formatTimeRange = (startTime, endTime) => {
    if (!startTime || !endTime) return "Not set";
    return `${formatTime(startTime)} - ${formatTime(endTime)}`;
  };

  const fetchData = async () => {
    setLoading(true);
    try {
      const centresResponse = await axios.get("http://localhost:5000/api/centres", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      setCentres(centresResponse.data);

      const staffResponse = await axios.get("http://localhost:5000/api/staff/all", {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        params: filters,
      });
      
      const staffWithActivity = staffResponse.data.map(staff => ({
        ...staff,
        recentActivity: staff.recent_activity || [],
      }));
      setStaffList(staffWithActivity);
    } catch (err) {
      console.error("Error fetching data:", err);
      const errorMessage = err.response?.data?.error || "Failed to load data";
      setError(errorMessage);
      toast.error(errorMessage, {
        position: "top-right",
        autoClose: 5000,
        theme: "light",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, [filters]);

  const handleDelete = async (id) => {
    if (!window.confirm("Are you sure you want to delete this staff member?")) return;
    try {
      await axios.delete(`http://localhost:5000/api/staff/${id}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });
      toast.success("Staff deleted successfully", {
        position: "top-right",
        autoClose: 3000,
        theme: "light",
      });
      setStaffList(staffList.filter((staff) => staff.id !== id));
    } catch (err) {
      console.error("Error deleting staff:", err);
      toast.error(err.response?.data?.error || "Failed to delete staff", {
        position: "top-right",
        autoClose: 5000,
        theme: "light",
      });
    }
  };

  const handleFilterChange = (e) => {
    const { name, value } = e.target;
    setFilters({ ...filters, [name]: value });
  };

  const filteredStaff = staffList.filter((staff) =>
    [staff.name, staff.username, staff.email].some((field) =>
      field?.toLowerCase().includes(searchTerm.toLowerCase())
    )
  );

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

  const getCentreName = (centreId) => {
    const centre = centres.find((c) => c.id === Number(centreId));
    return centre ? centre.name : "Unassigned";
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

  // Loading skeleton for table
  const TableSkeleton = () => (
    Array.from({ length: 5 }).map((_, index) => (
      <tr key={index} className="animate-pulse">
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex items-center">
            <div className="w-10 h-10 bg-gray-200 rounded-full mr-3"></div>
            <div className="h-4 bg-gray-200 rounded w-24"></div>
          </div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="h-4 bg-gray-200 rounded w-20"></div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="h-6 bg-gray-200 rounded w-16"></div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="h-4 bg-gray-200 rounded w-24"></div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="h-4 bg-gray-200 rounded w-32"></div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="h-6 bg-gray-200 rounded w-16"></div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="h-4 bg-gray-200 rounded w-12"></div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="h-4 bg-gray-200 rounded w-12"></div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="h-4 bg-gray-200 rounded w-16"></div>
        </td>
        <td className="px-6 py-4 whitespace-nowrap">
          <div className="flex gap-2 justify-end">
            <div className="w-8 h-8 bg-gray-200 rounded-lg"></div>
            <div className="w-8 h-8 bg-gray-200 rounded-lg"></div>
            <div className="w-8 h-8 bg-gray-200 rounded-lg"></div>
          </div>
        </td>
      </tr>
    ))
  );

  return (
    <div className="min-h-screen bg-gray-50 p-4 md:p-8 scrollbar-hide">
      <div className="max-w-7xl mx-auto">
        {/* Header Section */}
        <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
          <div className="mb-6 md:mb-0">
            <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
              Staff Management
            </h1>
            <p className="text-gray-600 mt-2 text-lg">Manage all staff members and their permissions</p>
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
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-3 px-6 py-3.5 rounded-xl font-semibold text-white bg-navy-700 hover:bg-navy-800 shadow-md hover:shadow-lg transition-all duration-300 group"
              disabled={loading}
            >
              <FiUserPlus className="text-xl group-hover:scale-110 transition-transform" />
              <span className="hidden sm:inline">Add New Staff</span>
            </button>
          </div>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-2xl flex items-center">
            <div className="w-2 h-12 bg-red-500 rounded-l-xl mr-4"></div>
            <div>
              <p className="text-red-800 font-medium">Error loading data</p>
              <p className="text-red-600 text-sm">{error}</p>
            </div>
          </div>
        )}

        {/* Search and Filter Bar */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 mb-8">
          <div className="flex flex-col md:flex-row gap-4">
            <div className="relative flex-1">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <FiSearch className="text-gray-400 text-lg" />
              </div>
              <input
                type="text"
                placeholder="Search by name, username, or email..."
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
                setFilters({ role: "", centre_id: "", status: "" });
                setSearchTerm("");
              }}
              className="flex items-center gap-3 px-5 py-3.5 bg-white border border-gray-300 hover:border-gray-400 text-gray-700 rounded-xl transition-all hover:shadow-md"
              disabled={loading}
            >
              <FiRefreshCw className={`text-lg ${loading ? 'animate-spin' : ''}`} />
              <span className="font-medium">Reset</span>
            </button>
          </div>
          
          {filterExpanded && (
            <div className="mt-6 pt-6 border-t border-gray-200 grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Role</label>
                <select
                  name="role"
                  value={filters.role}
                  onChange={handleFilterChange}
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                  disabled={loading}
                >
                  <option value="">All Roles</option>
                  <option value="superadmin">Superadmin</option>
                  <option value="admin">Admin</option>
                  <option value="staff">Staff</option>
                  <option value="supervisor">Supervisor</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Centre</label>
                <select
                  name="centre_id"
                  value={filters.centre_id}
                  onChange={handleFilterChange}
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                  disabled={loading}
                >
                  <option value="">All Centres</option>
                  {centres.map((centre) => (
                    <option key={centre.id} value={centre.id}>
                      {centre.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-3">Status</label>
                <select
                  name="status"
                  value={filters.status}
                  onChange={handleFilterChange}
                  className="w-full px-4 py-3.5 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                  disabled={loading}
                >
                  <option value="">All Statuses</option>
                  <option value="Active">Active</option>
                  <option value="On Leave">On Leave</option>
                  <option value="Terminated">Terminated</option>
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
                  {staffList.filter(s => s.status === 'Active').length}
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
                  {staffList.filter(s => s.status === 'On Leave').length}
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
                <p className="text-gray-500 text-sm font-medium">Centres</p>
                <p className="text-2xl font-bold text-gray-800 mt-1">{centres.length}</p>
              </div>
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center">
                <FiGrid className="text-purple-600 text-xl" />
              </div>
            </div>
          </div>
        </div>

        {/* Card View */}
        <div className={`${viewMode === "card" ? "block" : "hidden"}`}>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {loading ? (
              Array.from({ length: 8 }).map((_, index) => <CardSkeleton key={index} />)
            ) : filteredStaff.length === 0 ? (
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
                      setFilters({ role: "", centre_id: "", status: "" });
                    }}
                    className="px-6 py-3 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-all"
                  >
                    Reset filters
                  </button>
                </div>
              </div>
            ) : (
              filteredStaff.map((staff) => (
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
                            alt={`${staff.name}'s profile`}
                            className="w-16 h-16 rounded-2xl object-cover border-2 border-white shadow-md"
                            onError={(e) => {
                              e.target.src = "";
                              e.target.nextSibling.classList.remove("hidden");
                            }}
                          />
                        ) : null}
                        <div
                          className={`bg-blue-100 border-2 border-white rounded-2xl w-16 h-16 flex items-center justify-center shadow-md ${
                            staff.photo ? "hidden" : ""
                          }`}
                        >
                          <FiUser className="text-blue-600 text-xl" />
                        </div>
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
                            <button
                              onClick={() => setShowStaffDetails(staff)}
                              className="text-gray-400 hover:text-blue-600 p-1.5 rounded-lg hover:bg-blue-50 transition-all"
                              title="View details"
                            >
                              <FiEye className="text-lg" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedStaff(staff);
                                setShowEditModal(true);
                              }}
                              className="text-gray-400 hover:text-indigo-600 p-1.5 rounded-lg hover:bg-indigo-50 transition-all"
                              title="Edit staff"
                            >
                              <FiEdit className="text-lg" />
                            </button>
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
                        <span className="truncate">{staff.username}</span>
                      </div>
                      <div className="flex items-center text-sm text-gray-600">
                        <FiGrid className="text-gray-400 mr-3 text-lg" />
                        <span className="truncate">{getCentreName(staff.centreId)}</span>
                      </div>
                      {staff.role !== "superadmin" && (
                        <div className="flex items-center text-sm text-gray-600">
                          <FiClock className="text-gray-400 mr-3 text-lg" />
                          <span className="truncate">
                            {formatTimeRange(staff.start_time, staff.end_time)}
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                      <button
                        onClick={() => handleDelete(staff.id)}
                        className="flex items-center gap-2 text-sm text-red-500 hover:text-red-700 font-medium px-3 py-2 rounded-lg hover:bg-red-50 transition-all"
                      >
                        <FiTrash2 />
                        <span>Remove</span>
                      </button>
                      <button
                        onClick={() => setShowStaffDetails(staff)}
                        className="text-sm text-blue-600 hover:text-blue-800 font-medium px-3 py-2 rounded-lg hover:bg-blue-50 transition-all"
                      >
                        View Details
                      </button>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Table View */}
        <div className={`${viewMode === "table" ? "block" : "hidden"} scrollbar-hide`}>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden">
            <div className="px-6 py-5 border-b border-gray-200 bg-gray-50">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-800">Staff List</h2>
                <div className="text-sm text-gray-500">
                  Showing <span className="font-semibold text-gray-800">{filteredStaff.length}</span> of{" "}
                  <span className="font-semibold text-gray-800">{staffList.length}</span> staff members
                </div>
              </div>
            </div>
            <div className="overflow-x-auto scrollbar-hide">
              <table className="min-w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Staff Member</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Role</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Centre</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Schedule</th>
                    <th className="px-6 py-4 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Effective From</th>
                    <th className="px-6 py-4 text-right text-xs font-semibold text-gray-500 uppercase tracking-wider">Actions</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {loading ? (
                    <TableSkeleton />
                  ) : filteredStaff.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-6 py-12 text-center">
                        <div className="flex flex-col items-center">
                          <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-2xl w-16 h-16 flex items-center justify-center mb-4">
                            <FiSearch className="text-gray-400 text-2xl" />
                          </div>
                          <h3 className="text-lg font-semibold text-gray-900 mb-2">No staff members found</h3>
                          <p className="text-gray-600 mb-4">Try adjusting your search or filter criteria</p>
                          <button
                            onClick={() => {
                              setSearchTerm("");
                              setFilters({ role: "", centre_id: "", status: "" });
                            }}
                            className="px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition-all"
                          >
                            Reset filters
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    filteredStaff.map((staff) => (
                      <tr key={staff.id} className="hover:bg-gray-50 transition-colors group">
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div className="flex-shrink-0 relative">
                              {staff.photo ? (
                                <img
                                  src={staff.photo}
                                  alt={`${staff.name}'s profile`}
                                  className="w-10 h-10 rounded-xl object-cover border-2 border-white shadow-sm"
                                  onError={(e) => {
                                    e.target.src = "";
                                    e.target.nextSibling.classList.remove("hidden");
                                  }}
                                />
                              ) : null}
                              <div
                                className={`bg-blue-100 border-2 border-white rounded-xl w-10 h-10 flex items-center justify-center shadow-sm ${
                                  staff.photo ? "hidden" : ""
                                }`}
                              >
                                <FiUser className="text-blue-600" />
                              </div>
                            </div>
                            <div className="ml-4">
                              <div className="text-sm font-semibold text-gray-900">{staff.name}</div>
                              <div className="text-sm text-gray-500">{staff.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getRoleBadge(staff.role)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {getCentreName(staff.centreId)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          {getStatusBadge(staff.status)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {formatTimeRange(staff.start_time, staff.end_time)}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                          {staff.effective_from ? 
                            new Date(staff.effective_from).toLocaleDateString() : "N/A"}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right">
                          <div className="flex justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <button
                              onClick={() => setShowStaffDetails(staff)}
                              className="text-gray-400 hover:text-blue-600 p-2 rounded-lg hover:bg-blue-50 transition-all"
                              title="View details"
                            >
                              <FiEye className="text-lg" />
                            </button>
                            <button
                              onClick={() => {
                                setSelectedStaff(staff);
                                setShowEditModal(true);
                              }}
                              className="text-gray-400 hover:text-indigo-600 p-2 rounded-lg hover:bg-indigo-50 transition-all"
                              title="Edit staff"
                            >
                              <FiEdit className="text-lg" />
                            </button>
                            <button
                              onClick={() => handleDelete(staff.id)}
                              className="text-gray-400 hover:text-red-600 p-2 rounded-lg hover:bg-red-50 transition-all"
                              title="Delete staff"
                            >
                              <FiTrash2 className="text-lg" />
                            </button>
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

        {/* Add Staff Modal */}
        {showAddModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn scrollbar-hide">
            <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 scrollbar-hide">
              <div className="p-6">
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
          </div>
        )}

        {/* Edit Staff Modal */}
        {showEditModal && selectedStaff && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn scrollbar-hide">
            <div className="bg-white rounded-3xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 scrollbar-hide">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">
                    Edit Staff Member
                  </h2>
                  <button
                    onClick={() => {
                      setShowEditModal(false);
                      setSelectedStaff(null);
                    }}
                    className="text-gray-400 hover:text-gray-500 text-2xl p-2 hover:bg-gray-100 rounded-xl transition-all"
                  >
                    <FiX />
                  </button>
                </div>
                <EditStaffForm
                  staff={selectedStaff}
                  centres={centres}
                  onUpdate={() => {
                    setShowEditModal(false);
                    setSelectedStaff(null);
                    fetchData();
                  }}
                  onClose={() => {
                    setShowEditModal(false);
                    setSelectedStaff(null);
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Staff Detail Modal */}
        {showStaffDetails && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn scrollbar-hide">
            <div className="bg-white rounded-3xl w-full max-w-4xl max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-200 scrollbar-hide">
              <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                  <h2 className="text-2xl font-bold text-gray-900">
                    Staff Details
                  </h2>
                  <button
                    onClick={() => setShowStaffDetails(null)}
                    className="text-gray-400 hover:text-gray-500 text-2xl p-2 hover:bg-gray-100 rounded-xl transition-all"
                  >
                    <FiX />
                  </button>
                </div>
                <div className="flex flex-col md:flex-row gap-8 mb-8">
                  <div className="flex-shrink-0">
                    {showStaffDetails.photo ? (
                      <img
                        src={showStaffDetails.photo}
                        alt={`${showStaffDetails.name}'s profile`}
                        className="w-32 h-32 rounded-2xl object-cover border-4 border-white shadow-lg"
                        onError={(e) => {
                          e.target.src = "";
                          e.target.nextSibling.classList.remove("hidden");
                        }}
                      />
                    ) : null}
                    <div
                      className={`bg-blue-100 border-4 border-white rounded-2xl w-32 h-32 flex items-center justify-center shadow-lg ${
                        showStaffDetails.photo ? "hidden" : ""
                      }`}
                    >
                      <FiUser className="text-blue-600 text-4xl" />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex flex-col md:flex-row md:items-start justify-between mb-6">
                      <div>
                        <h3 className="text-2xl font-bold text-gray-900 mb-2">{showStaffDetails.name}</h3>
                        <div className="flex items-center gap-3 mb-4">
                          {getRoleBadge(showStaffDetails.role)}
                          {getStatusBadge(showStaffDetails.status)}
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setSelectedStaff(showStaffDetails);
                          setShowEditModal(true);
                          setShowStaffDetails(null);
                        }}
                        className="flex items-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-600 rounded-xl font-medium hover:bg-blue-100 transition-all"
                      >
                        <FiEdit className="text-lg" />
                        <span>Edit Profile</span>
                      </button>
                    </div>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                          <FiMail className="text-gray-400 text-lg" />
                          <div>
                            <p className="text-sm font-medium text-gray-600">Email</p>
                            <p className="text-gray-900">{showStaffDetails.email}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                          <FiUser className="text-gray-400 text-lg" />
                          <div>
                            <p className="text-sm font-medium text-gray-600">Username</p>
                            <p className="text-gray-900">{showStaffDetails.username}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                          <FiGrid className="text-gray-400 text-lg" />
                          <div>
                            <p className="text-sm font-medium text-gray-600">Centre</p>
                            <p className="text-gray-900">{getCentreName(showStaffDetails.centreId)}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                          <FiCalendar className="text-gray-400 text-lg" />
                          <div>
                            <p className="text-sm font-medium text-gray-600">Join Date</p>
                            <p className="text-gray-900">
                              {showStaffDetails.joinDate
                                ? new Date(showStaffDetails.joinDate).toLocaleDateString()
                                : "N/A"}
                            </p>
                          </div>
                        </div>
                      </div>
                      
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                          <FiPhone className="text-gray-400 text-lg" />
                          <div>
                            <p className="text-sm font-medium text-gray-600">Phone</p>
                            <p className="text-gray-900">{showStaffDetails.phone || "N/A"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                          <FiDollarSign className="text-gray-400 text-lg" />
                          <div>
                            <p className="text-sm font-medium text-gray-600">Salary</p>
                            <p className="text-gray-900">₹{showStaffDetails.salary || "N/A"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                          <div className="w-5 h-5 flex items-center justify-center">
                            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-600">Department</p>
                            <p className="text-gray-900">{showStaffDetails.department || "N/A"}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                          <div className="w-5 h-5 flex items-center justify-center">
                            <div className="w-2 h-2 bg-gray-400 rounded-full"></div>
                          </div>
                          <div>
                            <p className="text-sm font-medium text-gray-600">Employee ID</p>
                            <p className="text-gray-900">{showStaffDetails.employeeId || "N/A"}</p>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Schedule Information */}
                    <div className="mt-6 pt-6 border-t border-gray-200">
                      <h3 className="text-lg font-semibold text-gray-800 mb-4">Current Schedule</h3>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                          <p className="text-sm font-medium text-blue-600">Start Time</p>
                          <p className="text-gray-900 font-semibold">{formatTime(showStaffDetails.start_time) || "Not set"}</p>
                        </div>
                        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                          <p className="text-sm font-medium text-blue-600">End Time</p>
                          <p className="text-gray-900 font-semibold">{formatTime(showStaffDetails.end_time) || "Not set"}</p>
                        </div>
                        <div className="p-4 bg-blue-50 rounded-xl border border-blue-100">
                          <p className="text-sm font-medium text-blue-600">Effective From</p>
                          <p className="text-gray-900 font-semibold">
                            {showStaffDetails.effective_from ? 
                              new Date(showStaffDetails.effective_from).toLocaleDateString() : "Not set"}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-gray-200 pt-6">
                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Permissions</h3>
                  <div className="flex flex-wrap gap-3 mb-8">
                    {(showStaffDetails.permissions || "")
                      .split(",")
                      .filter(Boolean)
                      .map((perm, idx) => (
                        <span
                          key={idx}
                          className="bg-blue-50 text-blue-700 text-sm font-medium px-4 py-2 rounded-xl border border-blue-200"
                        >
                          {perm.trim()}
                        </span>
                      ))}
                    {!showStaffDetails.permissions && (
                      <span className="text-gray-500 text-sm">No specific permissions set</span>
                    )}
                  </div>

                  <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Activities</h3>
                  {showStaffDetails.recentActivity?.length > 0 ? (
                    <div className="space-y-3">
                      {showStaffDetails.recentActivity.slice(0, 5).map((activity, idx) => (
                        <div key={idx} className="flex items-center gap-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                          <div className="w-3 h-3 bg-blue-500 rounded-full flex-shrink-0"></div>
                          <div className="flex-1">
                            <p className="font-medium text-gray-900">{activity.action}</p>
                            <p className="text-sm text-gray-600">{activity.details || "No additional details"}</p>
                          </div>
                          <div className="text-sm text-gray-500 flex-shrink-0">
                            {new Date(activity.timestamp).toLocaleString()}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="text-center py-8 bg-gray-50 rounded-xl border border-gray-200">
                      <FiClock className="text-gray-400 text-3xl mx-auto mb-3" />
                      <p className="text-gray-600">No recent activities found</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
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

export default SuperadminStaffManagement;