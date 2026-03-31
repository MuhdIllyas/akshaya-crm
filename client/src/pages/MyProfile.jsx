// src/pages/MyProfile.jsx
import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { FiUser, FiMail, FiPhone, FiCalendar, FiBriefcase, FiLock, FiEdit2, FiSave, FiX, FiPlus } from "react-icons/fi";
import ChangePasswordModal from "../../components/ChangePasswordModal"; // we'll create this

const MyProfile = () => {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isEditing, setIsEditing] = useState(false);
  const [editForm, setEditForm] = useState({
    name: "",
    phone: "",
    emergencyContact: "",
    emergencyRelationship: "",
    photo: null,
  });
  const [photoPreview, setPhotoPreview] = useState(null);
  const [showPasswordModal, setShowPasswordModal] = useState(false);
  const fileInputRef = useRef(null);

  const getAuthHeaders = () => ({
    Authorization: `Bearer ${localStorage.getItem("token")}`,
    "Content-Type": "application/json",
  });

  useEffect(() => {
    fetchProfile();
  }, []);

  const fetchProfile = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/staff/me`, {
        headers: getAuthHeaders(),
      });
      setProfile(res.data);
      setEditForm({
        name: res.data.name,
        phone: res.data.phone || "",
        emergencyContact: res.data.emergencyContact || "",
        emergencyRelationship: res.data.emergencyRelationship || "",
        photo: null,
      });
      setPhotoPreview(res.data.photo || null);
    } catch (err) {
      console.error(err);
      setError(err.response?.data?.error || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  const handleEditChange = (e) => {
    const { name, value } = e.target;
    setEditForm(prev => ({ ...prev, [name]: value }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      if (file.size > 2 * 1024 * 1024) {
        toast.error("Photo size must be less than 2MB");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
        setEditForm(prev => ({ ...prev, photo: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => fileInputRef.current.click();

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    try {
      const payload = {
        name: editForm.name,
        phone: editForm.phone,
        emergencyContact: editForm.emergencyContact,
        emergencyRelationship: editForm.emergencyRelationship,
        photo: editForm.photo,
      };
      const res = await axios.put(`${import.meta.env.VITE_API_URL}/api/staff/me`, payload, {
        headers: getAuthHeaders(),
      });
      setProfile(res.data);
      setIsEditing(false);
      toast.success("Profile updated successfully");
    } catch (err) {
      toast.error(err.response?.data?.error || "Update failed");
    }
  };

  const cancelEdit = () => {
    setIsEditing(false);
    setEditForm({
      name: profile.name,
      phone: profile.phone || "",
      emergencyContact: profile.emergencyContact || "",
      emergencyRelationship: profile.emergencyRelationship || "",
      photo: null,
    });
    setPhotoPreview(profile.photo || null);
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
          <h2 className="text-2xl font-bold text-red-600 mb-2">Error</h2>
          <p className="text-gray-600">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold text-gray-800">My Profile</h1>
        <div className="flex gap-3">
          {!isEditing ? (
            <button
              onClick={() => setIsEditing(true)}
              className="flex items-center gap-2 px-4 py-2 bg-navy-700 text-white rounded-xl hover:bg-navy-800"
            >
              <FiEdit2 /> Edit Profile
            </button>
          ) : (
            <>
              <button
                onClick={cancelEdit}
                className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-xl hover:bg-gray-50"
              >
                <FiX /> Cancel
              </button>
              <button
                onClick={handleUpdateProfile}
                className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-xl hover:bg-green-700"
              >
                <FiSave /> Save Changes
              </button>
            </>
          )}
          <button
            onClick={() => setShowPasswordModal(true)}
            className="flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-xl hover:bg-gray-50"
          >
            <FiLock /> Change Password
          </button>
        </div>
      </div>

      {/* Profile Card */}
      <div className="bg-white rounded-2xl shadow-md border border-gray-200 overflow-hidden">
        {/* Photo and Basic Info */}
        <div className="p-6 bg-gradient-to-r from-blue-50 to-white border-b">
          <div className="flex flex-col md:flex-row items-center gap-6">
            <div className="relative">
              {photoPreview ? (
                <img src={photoPreview} alt="Profile" className="w-28 h-28 rounded-full object-cover border-4 border-white shadow-md" />
              ) : (
                <div className="w-28 h-28 rounded-full bg-gray-200 flex items-center justify-center">
                  <FiUser className="text-4xl text-gray-500" />
                </div>
              )}
              {isEditing && (
                <>
                  <button
                    type="button"
                    onClick={triggerFileInput}
                    className="absolute bottom-0 right-0 bg-blue-600 text-white rounded-full p-2 shadow-md"
                  >
                    <FiPlus />
                  </button>
                  <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handlePhotoChange}
                    accept="image/*"
                    className="hidden"
                  />
                </>
              )}
            </div>
            <div className="text-center md:text-left">
              {isEditing ? (
                <input
                  type="text"
                  name="name"
                  value={editForm.name}
                  onChange={handleEditChange}
                  className="text-2xl font-bold border rounded-lg px-3 py-1 w-full md:w-auto"
                />
              ) : (
                <h2 className="text-2xl font-bold text-gray-800">{profile.name}</h2>
              )}
              <p className="text-gray-600">@{profile.username}</p>
              <div className="mt-2 flex flex-wrap gap-2 justify-center md:justify-start">
                <span className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">{profile.role}</span>
                <span className={`px-3 py-1 rounded-full text-sm ${
                  profile.status === "Active" ? "bg-green-100 text-green-800" : "bg-yellow-100 text-yellow-800"
                }`}>
                  {profile.status}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Details Grid */}
        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <FiMail className="text-gray-400 mt-1" />
              <div>
                <p className="text-sm text-gray-500">Email</p>
                <p className="font-medium">{profile.email}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FiPhone className="text-gray-400 mt-1" />
              <div>
                <p className="text-sm text-gray-500">Phone</p>
                {isEditing ? (
                  <input
                    type="tel"
                    name="phone"
                    value={editForm.phone}
                    onChange={handleEditChange}
                    className="border rounded-lg px-2 py-1 w-full"
                  />
                ) : (
                  <p className="font-medium">{profile.phone || "Not provided"}</p>
                )}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <FiBriefcase className="text-gray-400 mt-1" />
              <div>
                <p className="text-sm text-gray-500">Department</p>
                <p className="font-medium">{profile.department || "Not assigned"}</p>
              </div>
            </div>
          </div>
          <div className="space-y-4">
            <div className="flex items-start gap-3">
              <FiCalendar className="text-gray-400 mt-1" />
              <div>
                <p className="text-sm text-gray-500">Join Date</p>
                <p className="font-medium">{profile.joinDate ? new Date(profile.joinDate).toLocaleDateString() : "N/A"}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 flex items-center justify-center text-gray-400">📞</div>
              <div>
                <p className="text-sm text-gray-500">Emergency Contact</p>
                {isEditing ? (
                  <input
                    type="tel"
                    name="emergencyContact"
                    value={editForm.emergencyContact}
                    onChange={handleEditChange}
                    className="border rounded-lg px-2 py-1 w-full"
                    placeholder="Emergency phone"
                  />
                ) : (
                  <p className="font-medium">{profile.emergencyContact || "Not provided"}</p>
                )}
              </div>
            </div>
            <div className="flex items-start gap-3">
              <div className="w-5 h-5 flex items-center justify-center text-gray-400">👤</div>
              <div>
                <p className="text-sm text-gray-500">Emergency Relationship</p>
                {isEditing ? (
                  <input
                    type="text"
                    name="emergencyRelationship"
                    value={editForm.emergencyRelationship}
                    onChange={handleEditChange}
                    className="border rounded-lg px-2 py-1 w-full"
                    placeholder="e.g., Spouse, Parent"
                  />
                ) : (
                  <p className="font-medium">{profile.emergencyRelationship || "Not provided"}</p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Read-only fields (cannot be edited by staff) */}
        <div className="p-6 bg-gray-50 border-t">
          <h3 className="font-semibold text-gray-700 mb-3">System Information</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-gray-500">Employee ID</p>
              <p>{profile.employeeId || "N/A"}</p>
            </div>
            <div>
              <p className="text-gray-500">Employment Type</p>
              <p>{profile.employmentType || "Full-time"}</p>
            </div>
            <div>
              <p className="text-gray-500">Reports To</p>
              <p>{profile.reportsTo || "None"}</p>
            </div>
            <div>
              <p className="text-gray-500">Centre</p>
              <p>{profile.centreId || "N/A"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Change Password Modal */}
      {showPasswordModal && (
        <ChangePasswordModal
          userId={profile.id}
          onClose={() => setShowPasswordModal(false)}
          onSuccess={() => toast.success("Password changed successfully")}
        />
      )}
    </div>
  );
};

export default MyProfile;
