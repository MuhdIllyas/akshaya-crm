import { useParams, useNavigate } from "react-router-dom";
import { useState, useEffect } from "react";
import { 
  FiArrowLeft, FiEdit, FiLock, FiCalendar, 
  FiPhone, FiMail, FiMapPin, FiUser, FiBriefcase, FiTrash2 
} from "react-icons/fi";
import ChangePassword from "../../components/ChangePassword";

const StaffProfile = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [staff, setStaff] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showPasswordModal, setShowPasswordModal] = useState(false);

  useEffect(() => {
    const fetchStaff = async () => {
      try {
        setLoading(true);
        setError(null);
        
        const res = await fetch(`http://localhost:5000/api/staff/${id}`);
        
        const contentType = res.headers.get('content-type');
        if (!contentType || !contentType.includes('application/json')) {
          const text = await res.text();
          throw new Error(`Server returned unexpected format: ${text.substring(0, 100)}`);
        }

        const data = await res.json();
        
        if (res.ok) {
          setStaff(data);
        } else {
          throw new Error(data.error || `Server error: ${res.status} ${res.statusText}`);
        }
      } catch (err) {
        console.error("Error fetching staff:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    
    fetchStaff();
  }, [id]);

  // Navigation functions
  const goToStaffManagement = () => navigate("/dashboard/admin/staff");
  const goToEditStaff = () => navigate(`/dashboard/admin/staff/edit/${id}`);

  // Delete function
  const handleDelete = async () => {
    try {
      const res = await fetch(`http://localhost:5000/api/staff/${id}`, {
        method: "DELETE"
      });

      if (res.ok) {
        goToStaffManagement();
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error || "Failed to delete staff");
      }
    } catch (err) {
      console.error("Delete error:", err);
      setError(err.message);
      setShowDeleteModal(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-navy-700"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Error Loading Profile</h2>
          <p className="text-gray-600 mb-4">{error}</p>
          <button 
            onClick={goToStaffManagement}
            className="mt-4 inline-flex items-center text-navy-700 hover:text-navy-800 font-medium"
          >
            <FiArrowLeft className="mr-2" /> Back to Staff Management
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
      {/* Delete Confirmation Modal */}
      {showDeleteModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-lg font-bold text-gray-800">Confirm Deletion</h3>
              <button 
                onClick={() => setShowDeleteModal(false)}
                className="text-gray-500 hover:text-gray-700"
              >
                ✕
              </button>
            </div>
            
            <p className="text-gray-600 mb-6">
              Are you sure you want to delete <span className="font-semibold">{staff.name}'s</span> profile? 
              This action cannot be undone.
            </p>
            
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 border border-gray-300 rounded-xl text-gray-700 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-xl flex items-center"
              >
                <FiTrash2 className="mr-2" />
                Delete Permanently
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header with back button */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center mb-6 pb-4 border-b border-gray-100">
        <div className="flex items-center">
          <button 
            onClick={goToStaffManagement}
            className="mr-4 p-2 rounded-lg hover:bg-gray-100"
          >
            <FiArrowLeft className="text-gray-600" />
          </button>
          <div>
            <h1 className="text-2xl font-bold text-gray-800">Staff Profile</h1>
            <p className="text-gray-600 mt-1">
              Detailed information about {staff.name}
            </p>
          </div>
        </div>
        
        <div className="mt-4 sm:mt-0 flex space-x-3">
          <button
            onClick={goToEditStaff}
            className="flex items-center bg-navy-700 hover:bg-navy-800 text-white font-medium px-4 py-2.5 rounded-xl transition-all duration-300 shadow-md hover:shadow-lg"
          >
            <FiEdit className="mr-2" />
            Edit Profile
          </button>
          <button
            onClick={() => setShowPasswordModal(true)}
            className="flex items-center border border-gray-300 text-gray-700 hover:bg-gray-50 font-medium px-4 py-2.5 rounded-xl transition-colors"
            >
            <FiLock className="mr-2" />
              Change Password
            </button>
            {showPasswordModal && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                <ChangePassword
                username={staff.username}
                onClose={() => setShowPasswordModal(false)}
              />
            </div>
            )}

          {/* Delete Button */}
          <button
            onClick={() => setShowDeleteModal(true)}
            className="flex items-center bg-red-50 border border-red-200 text-red-700 hover:bg-red-100 font-medium px-4 py-2.5 rounded-xl transition-colors"
          >
            <FiTrash2 className="mr-2" />
            Delete
          </button>
        </div>
      </div>

      {/* Profile Content */}
      <div className="flex flex-col lg:flex-row gap-6">
        {/* Left Column - Profile Card */}
        <div className="w-full lg:w-1/3">
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
            <div className="flex flex-col items-center mb-6">
              <div className="relative mb-4">
                {staff.photo ? (
                  <img 
                    src={staff.photo} 
                    alt={staff.name} 
                    className="w-32 h-32 rounded-2xl object-cover border border-gray-200"
                  />
                ) : (
                  <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-2xl w-32 h-32 flex items-center justify-center">
                    <FiUser className="text-gray-400 text-4xl" />
                  </div>
                )}
              </div>
              
              <h2 className="text-xl font-bold text-gray-900 text-center">{staff.name}</h2>
              <p className="text-gray-600 text-center mt-1">@{staff.username}</p>
              <div className="mt-2">
                <span className={`px-2.5 py-0.5 rounded-full text-xs font-medium ${
                  staff.status === "Active" 
                    ? "bg-green-100 text-green-800" 
                    : staff.status === "On Leave" 
                      ? "bg-yellow-100 text-yellow-800" 
                      : "bg-red-100 text-red-800"
                }`}>
                  {staff.status}
                </span>
              </div>
            </div>
            
            {/* Contact Info */}
            <div className="space-y-4">
              <div className="flex items-start">
                <div className="bg-blue-100 p-2 rounded-lg mr-3">
                  <FiCalendar className="text-blue-700 text-lg" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Joined Date</p>
                  <p className="font-medium">{staff.joinDate}</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="bg-blue-100 p-2 rounded-lg mr-3">
                  <FiBriefcase className="text-blue-700 text-lg" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Role</p>
                  <p className="font-medium">{staff.role}</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="bg-blue-100 p-2 rounded-lg mr-3">
                  <FiBriefcase className="text-blue-700 text-lg" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Department</p>
                  <p className="font-medium">{staff.department}</p>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="bg-blue-100 p-2 rounded-lg mr-3">
                  <FiPhone className="text-blue-700 text-lg" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Phone</p>
                  <a href={`tel:${staff.phone}`} className="font-medium text-blue-600 hover:underline">
                    {staff.phone}
                  </a>
                </div>
              </div>
              
              <div className="flex items-start">
                <div className="bg-blue-100 p-2 rounded-lg mr-3">
                  <FiMail className="text-blue-700 text-lg" />
                </div>
                <div>
                  <p className="text-sm text-gray-500">Email</p>
                  <a href={`mailto:${staff.email}`} className="font-medium text-blue-600 hover:underline">
                    {staff.email}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
        
        {/* Right Column - Detailed Info */}
        <div className="w-full lg:w-2/3">
          <div className="bg-gray-50 border border-gray-200 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Employment Details</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <p className="text-sm text-gray-500 mb-1">Employee ID</p>
                <p className="font-medium">{staff.employeeId || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Employment Type</p>
                <p className="font-medium">{staff.employmentType || "Full-time"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Reports To</p>
                <p className="font-medium">{staff.reportsTo || "Not specified"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Salary</p>
                <p className="font-medium">{staff.salary ? `₹${staff.salary.toLocaleString()}` : "Not specified"}</p>
              </div>
            </div>
            
            <h3 className="text-lg font-semibold text-gray-800 mb-4 mt-8">Personal Information</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">Date of Birth</p>
                <p className="font-medium">{staff.dob || "Not specified"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Gender</p>
                <p className="font-medium">{staff.gender || "Not specified"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Emergency Contact</p>
                <p className="font-medium">{staff.emergencyContact || "Not specified"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Relationship</p>
                <p className="font-medium">{staff.emergencyRelationship || "Not specified"}</p>
              </div>
            </div>
          </div>
          
          <div className="mt-6 bg-gray-50 border border-gray-200 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">System Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-gray-500 mb-1">User Role</p>
                <p className="font-medium">{staff.userRole || "Staff"}</p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Last Login</p>
                <p className="font-medium">
                  {staff.lastLogin 
                    ? new Date(staff.lastLogin).toLocaleString() 
                    : "Never logged in"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Permissions</p>
                <p className="font-medium">
                  {staff.permissions 
                    ? staff.permissions.join(", ") 
                    : "Basic access"}
                </p>
              </div>
              <div>
                <p className="text-sm text-gray-500 mb-1">Account Created</p>
                <p className="font-medium">
                  {new Date(staff.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
          
          <div className="mt-6 bg-gray-50 border border-gray-200 rounded-2xl p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Recent Activity</h3>
            <div className="space-y-4">
              {staff.recentActivity && staff.recentActivity.length > 0 ? (
                staff.recentActivity.map((activity, index) => (
                  <div key={index} className="flex items-start border-b border-gray-100 pb-3 last:border-0 last:pb-0">
                    <div className="bg-blue-100 p-2 rounded-lg mr-3">
                      <FiCalendar className="text-blue-700" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium">{activity.action}</p>
                      <p className="text-sm text-gray-500">
                        {new Date(activity.timestamp).toLocaleString()}
                      </p>
                    </div>
                  </div>
                ))
              ) : (
                <p className="text-gray-500 text-center py-4">No recent activity found</p>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffProfile;