import React, { useState, useEffect, useRef } from 'react';
import { 
  FiUser, FiMail, FiPhone, FiCalendar, FiMapPin, 
  FiEdit2, FiSave, FiX, FiCheck, FiUpload, 
  FiFileText, FiGlobe, FiHeart, FiCamera,
  FiBriefcase, FiHome, FiCreditCard, FiShield,
  FiTrash2
} from 'react-icons/fi';
import { FaVenusMars, FaTransgender, FaMars, FaVenus } from 'react-icons/fa';
import axios from "axios";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const CustomerProfile = () => {
  const [profile, setProfile] = useState({
    name: '',
    phone: '',
    email: '',
    date_of_birth: '',
    gender: '',
    marital_status: '',
    date_of_marriage: '',
    address: '',
    state: '',
    district: '',
    pincode: '',
    occupation: '',
    emergency_contact: '',
    profile_photo: '',
    profile_photo_url: ''
  });
  
  const [isEditing, setIsEditing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [isDeletingPhoto, setIsDeletingPhoto] = useState(false);
  const [verifiedDocuments, setVerifiedDocuments] = useState([]);
  const [stats, setStats] = useState({
    total: 0,
    verified: 0,
    pending: 0
  });

  const fileInputRef = useRef(null);

  // Initialize Axios instance
  const API = axios.create({
    baseURL: import.meta.env.VITE_API_URL,
  });

  // Add auth interceptor
  API.interceptors.request.use((config) => {
    const token = localStorage.getItem("customer_token");
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  });

  // Fetch customer profile
  const fetchProfile = async () => {
    try {
      setIsLoading(true);
      const res = await API.get("/api/customer/profile");
      setProfile(res.data);
      
      // Set stats from backend
      setStats({
        total: res.data.total_documents || 0,
        verified: res.data.verified_documents || 0,
        pending: res.data.pending_documents || 0
      });
    } catch (err) {
      console.error("Failed to fetch profile", err);
      toast.error("Failed to load profile data");
    } finally {
      setIsLoading(false);
    }
  };

  // Fetch verified documents
  const fetchVerifiedDocuments = async () => {
    try {
      const res = await API.get("/api/customer/documents/verified");
      setVerifiedDocuments(res.data);
    } catch (err) {
      console.error("Failed to fetch documents", err);
    }
  };

  useEffect(() => {
    fetchProfile();
    fetchVerifiedDocuments();
  }, []);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setProfile(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSaveProfile = async () => {
    try {
      setIsSaving(true);
      
      // Validate required fields
      if (!profile.name.trim()) {
        toast.error("Name is required");
        return;
      }
      
      // Email is optional but if provided, validate format
      if (profile.email && profile.email.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(profile.email)) {
          toast.error("Please enter a valid email address");
          return;
        }
      }
      
      // Validate date of birth
      if (profile.date_of_birth) {
        const dob = new Date(profile.date_of_birth);
        const today = new Date();
        if (dob > today) {
          toast.error("Date of birth cannot be in the future");
          return;
        }
      }
      
      // Validate marriage date if married
      if (profile.marital_status === 'married' && profile.date_of_marriage) {
        const marriageDate = new Date(profile.date_of_marriage);
        const dob = profile.date_of_birth ? new Date(profile.date_of_birth) : null;
        const today = new Date();
        
        if (marriageDate > today) {
          toast.error("Marriage date cannot be in the future");
          return;
        }
        
        if (dob && marriageDate < dob) {
          toast.error("Marriage date cannot be before date of birth");
          return;
        }
      }

      // Validate pincode
      if (profile.pincode && !/^\d{6}$/.test(profile.pincode)) {
        toast.error("Pincode must be 6 digits");
        return;
      }

      await API.put("/api/customer/profile", {
        name: profile.name,
        email: profile.email || null,
        dateOfBirth: profile.date_of_birth || null,
        gender: profile.gender || null,
        maritalStatus: profile.marital_status || null,
        dateOfMarriage: profile.marital_status === 'married' ? profile.date_of_marriage || null : null,
        address: profile.address || null,
        district: profile.district || null,
        state: profile.state || null,
        pincode: profile.pincode || null,
        occupation: profile.occupation || null,
        emergencyContact: profile.emergency_contact || null
      });
      
      setIsEditing(false);
      fetchProfile(); // Refresh data
      toast.success("Profile updated successfully!");
      
      // Update localStorage if name changed
      const currentName = localStorage.getItem("customer_name");
      if (currentName !== profile.name) {
        localStorage.setItem("customer_name", profile.name);
      }
    } catch (err) {
      console.error("Update failed", err);
      const errorMessage = err.response?.data?.message || "Failed to update profile";
      toast.error(errorMessage);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle profile photo upload
  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    // Validate file type
    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (!validTypes.includes(file.type)) {
      toast.error("Only image files (JPEG, PNG, GIF, WebP) are allowed");
      return;
    }

    // Validate file size (5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error("File size must be less than 5MB");
      return;
    }

    const formData = new FormData();
    formData.append('photo', file);

    try {
      setIsUploadingPhoto(true);
      const res = await API.post("/api/customer/profile-photo", formData, {
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      // Update profile with new photo
      setProfile(prev => ({
        ...prev,
        profile_photo: res.data.profile_photo,
        profile_photo_url: res.data.profile_photo_url
      }));

      toast.success("Profile photo uploaded successfully!");
    } catch (err) {
      console.error("Upload failed", err);
      const errorMessage = err.response?.data?.message || "Failed to upload photo";
      toast.error(errorMessage);
    } finally {
      setIsUploadingPhoto(false);
      // Clear file input
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Handle profile photo deletion
  const handlePhotoDelete = async () => {
    if (!window.confirm("Are you sure you want to delete your profile photo?")) {
      return;
    }

    try {
      setIsDeletingPhoto(true);
      await API.delete("/api/customer/profile-photo");

      // Update profile to remove photo
      setProfile(prev => ({
        ...prev,
        profile_photo: '',
        profile_photo_url: ''
      }));

      toast.success("Profile photo deleted successfully!");
    } catch (err) {
      console.error("Delete failed", err);
      const errorMessage = err.response?.data?.message || "Failed to delete photo";
      toast.error(errorMessage);
    } finally {
      setIsDeletingPhoto(false);
    }
  };

  const getGenderIcon = (gender) => {
    switch(gender?.toLowerCase()) {
      case 'male': return <FaMars className="text-blue-500" />;
      case 'female': return <FaVenus className="text-pink-500" />;
      case 'other': return <FaTransgender className="text-purple-500" />;
      default: return <FaVenusMars className="text-gray-500" />;
    }
  };

  const getMaritalStatusIcon = (status) => {
    switch(status?.toLowerCase()) {
      case 'married': return <FiHeart className="text-red-500" />;
      case 'single': return <FiUser className="text-blue-500" />;
      case 'divorced': return <FiX className="text-orange-500" />;
      case 'widowed': return <FiUser className="text-gray-500" />;
      default: return <FiUser className="text-gray-500" />;
    }
  };

  const getDocumentIcon = (docName) => {
    const name = docName?.toLowerCase();
    if (name.includes('aadhaar') || name.includes('aadhar')) return <FiCreditCard className="text-blue-500" />;
    if (name.includes('pan')) return <FiCreditCard className="text-green-500" />;
    if (name.includes('voter')) return <FiCreditCard className="text-orange-500" />;
    if (name.includes('passport')) return <FiGlobe className="text-purple-500" />;
    if (name.includes('driving') || name.includes('license')) return <FiBriefcase className="text-red-500" />;
    if (name.includes('ration')) return <FiHome className="text-amber-500" />;
    return <FiFileText className="text-gray-500" />;
  };

  const formatDate = (dateString) => {
    if (!dateString) return 'Not specified';
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'long',
      year: 'numeric'
    });
  };

  const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth) return null;
    const dob = new Date(dateOfBirth);
    const today = new Date();
    let age = today.getFullYear() - dob.getFullYear();
    const monthDiff = today.getMonth() - dob.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < dob.getDate())) {
      age--;
    }
    return age;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-navy-700 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <ToastContainer position="top-right" autoClose={3000} />
      
      {/* Header */}
      <div className="mb-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-800">My Profile</h1>
            <p className="text-gray-600 mt-2">Manage your personal information and documents</p>
          </div>
          
          <div className="flex items-center space-x-3">
            {!isEditing ? (
              <button
                onClick={() => setIsEditing(true)}
                className="inline-flex items-center px-5 py-2.5 bg-navy-700 text-white rounded-xl font-medium hover:bg-navy-800 transition-colors"
              >
                <FiEdit2 className="mr-2" />
                Edit Profile
              </button>
            ) : (
              <div className="flex items-center space-x-3">
                <button
                  onClick={() => {
                    setIsEditing(false);
                    fetchProfile(); // Reload original data
                  }}
                  className="inline-flex items-center px-5 py-2.5 border border-gray-300 text-gray-700 rounded-xl font-medium hover:bg-gray-50 transition-colors"
                  disabled={isSaving}
                >
                  <FiX className="mr-2" />
                  Cancel
                </button>
                <button
                  onClick={handleSaveProfile}
                  className="inline-flex items-center px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-medium hover:bg-emerald-700 transition-colors"
                  disabled={isSaving}
                >
                  <FiSave className="mr-2" />
                  {isSaving ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Left Column - Profile Info */}
        <div className="lg:col-span-2 space-y-8">
          {/* Profile Photo Card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-navy-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">Profile Photo</h2>
                  <p className="text-blue-200 mt-1">Upload your profile picture</p>
                </div>
                <div className="bg-white/10 p-3 rounded-xl">
                  <FiCamera className="text-2xl text-white" />
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="flex flex-col items-center">
                {/* Profile Photo Display */}
                <div className="relative mb-6">
                  {profile.profile_photo_url ? (
                    <div className="relative">
                      <img 
                        src={profile.profile_photo_url} 
                        alt="Profile" 
                        className="w-40 h-40 rounded-full object-cover border-4 border-white shadow-lg"
                      />
                      {!isDeletingPhoto && (
                        <button
                          onClick={handlePhotoDelete}
                          className="absolute top-0 right-0 bg-red-500 text-white p-2 rounded-full hover:bg-red-600 transition-colors shadow-lg"
                          title="Delete photo"
                          disabled={isDeletingPhoto}
                        >
                          <FiTrash2 className="text-lg" />
                        </button>
                      )}
                    </div>
                  ) : (
                    <div className="w-40 h-40 rounded-full bg-gradient-to-br from-gray-200 to-gray-300 border-4 border-white shadow-lg flex items-center justify-center">
                      <FiUser className="text-6xl text-gray-400" />
                    </div>
                  )}
                  
                  {/* Upload Button */}
                  <label className={`absolute bottom-0 right-0 ${profile.profile_photo_url ? 'bg-navy-700' : 'bg-emerald-600'} text-white p-3 rounded-full cursor-pointer hover:opacity-90 transition-all shadow-lg ${(isUploadingPhoto || isDeletingPhoto) && 'opacity-50 cursor-not-allowed'}`}>
                    {isUploadingPhoto ? (
                      <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
                    ) : (
                      <FiCamera className="text-xl" />
                    )}
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept="image/jpeg,image/jpg,image/png,image/gif,image/webp"
                      className="hidden"
                      onChange={handlePhotoUpload}
                      disabled={isUploadingPhoto || isDeletingPhoto}
                    />
                  </label>
                </div>

                {/* Photo Instructions */}
                <div className="text-center">
                  <p className="text-sm text-gray-600 mb-2">
                    Click the camera icon to upload a new photo
                  </p>
                  <p className="text-xs text-gray-500">
                    Supported formats: JPEG, PNG, GIF, WebP (Max 5MB)
                  </p>
                  {isUploadingPhoto && (
                    <p className="text-sm text-blue-600 mt-2">Uploading photo...</p>
                  )}
                  {isDeletingPhoto && (
                    <p className="text-sm text-red-600 mt-2">Deleting photo...</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Personal Information Card */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-navy-700 to-navy-800 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">Personal Information</h2>
                  <p className="text-navy-200 mt-1">Basic details and contact information</p>
                </div>
                <div className="bg-white/10 p-3 rounded-xl">
                  <FiUser className="text-2xl text-white" />
                </div>
              </div>
            </div>
            
            <div className="p-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Name */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Full Name *
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="name"
                      value={profile.name}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-navy-500 focus:ring-2 focus:ring-navy-200"
                      required
                    />
                  ) : (
                    <div className="px-4 py-3 bg-gray-50 rounded-xl border border-gray-200">
                      <p className="font-medium text-gray-800">{profile.name || 'Not provided'}</p>
                    </div>
                  )}
                </div>

                {/* Phone (read-only from registration) */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Phone Number
                  </label>
                  <div className="px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center">
                    <FiPhone className="text-gray-500 mr-3" />
                    <p className="font-medium text-gray-800">{profile.phone || 'Not provided'}</p>
                  </div>
                </div>

                {/* Email */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Email Address
                  </label>
                  {isEditing ? (
                    <input
                      type="email"
                      name="email"
                      value={profile.email}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-navy-500 focus:ring-2 focus:ring-navy-200"
                      placeholder="Enter email (optional)"
                    />
                  ) : (
                    <div className="px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center">
                      <FiMail className="text-gray-500 mr-3" />
                      <p className="font-medium text-gray-800">{profile.email || 'Not provided'}</p>
                    </div>
                  )}
                </div>

                {/* Date of Birth */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Date of Birth
                    {profile.date_of_birth && (
                      <span className="ml-2 text-sm text-gray-500">
                        ({calculateAge(profile.date_of_birth)} years)
                      </span>
                    )}
                  </label>
                  {isEditing ? (
                    <input
                      type="date"
                      name="date_of_birth"
                      value={profile.date_of_birth}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-navy-500 focus:ring-2 focus:ring-navy-200"
                      max={new Date().toISOString().split('T')[0]}
                    />
                  ) : (
                    <div className="px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center">
                      <FiCalendar className="text-gray-500 mr-3" />
                      <p className="font-medium text-gray-800">
                        {profile.date_of_birth ? formatDate(profile.date_of_birth) : 'Not provided'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Gender */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Gender
                  </label>
                  {isEditing ? (
                    <select
                      name="gender"
                      value={profile.gender}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-navy-500 focus:ring-2 focus:ring-navy-200"
                    >
                      <option value="">Select gender</option>
                      <option value="male">Male</option>
                      <option value="female">Female</option>
                      <option value="other">Other</option>
                      <option value="prefer-not-to-say">Prefer not to say</option>
                    </select>
                  ) : (
                    <div className="px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center">
                      {getGenderIcon(profile.gender)}
                      <p className="font-medium text-gray-800 ml-3 capitalize">
                        {profile.gender || 'Not specified'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Marital Status */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Marital Status
                  </label>
                  {isEditing ? (
                    <select
                      name="marital_status"
                      value={profile.marital_status}
                      onChange={handleInputChange}
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-navy-500 focus:ring-2 focus:ring-navy-200"
                    >
                      <option value="">Select status</option>
                      <option value="single">Single</option>
                      <option value="married">Married</option>
                      <option value="divorced">Divorced</option>
                      <option value="widowed">Widowed</option>
                    </select>
                  ) : (
                    <div className="px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center">
                      {getMaritalStatusIcon(profile.marital_status)}
                      <p className="font-medium text-gray-800 ml-3 capitalize">
                        {profile.marital_status || 'Not specified'}
                      </p>
                    </div>
                  )}
                </div>

                {/* Date of Marriage (conditional) */}
                {profile.marital_status === 'married' && (
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-gray-700 mb-2">
                      Date of Marriage
                    </label>
                    {isEditing ? (
                      <input
                        type="date"
                        name="date_of_marriage"
                        value={profile.date_of_marriage}
                        onChange={handleInputChange}
                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-navy-500 focus:ring-2 focus:ring-navy-200"
                        max={new Date().toISOString().split('T')[0]}
                      />
                    ) : (
                      <div className="px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center">
                        <FiHeart className="text-red-500 mr-3" />
                        <p className="font-medium text-gray-800">
                          {profile.date_of_marriage ? formatDate(profile.date_of_marriage) : 'Not provided'}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Occupation */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Occupation
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="occupation"
                      value={profile.occupation}
                      onChange={handleInputChange}
                      placeholder="Enter your occupation/profession"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-navy-500 focus:ring-2 focus:ring-navy-200"
                    />
                  ) : (
                    <div className="px-4 py-3 bg-gray-50 rounded-xl border border-gray-200">
                      <p className="font-medium text-gray-800">{profile.occupation || 'Not specified'}</p>
                    </div>
                  )}
                </div>

                {/* Address */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Address
                  </label>
                  {isEditing ? (
                    <textarea
                      name="address"
                      value={profile.address}
                      onChange={handleInputChange}
                      rows="3"
                      placeholder="Enter your complete address"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-navy-500 focus:ring-2 focus:ring-navy-200"
                    />
                  ) : (
                    <div className="px-4 py-3 bg-gray-50 rounded-xl border border-gray-200">
                      <p className="font-medium text-gray-800">{profile.address || 'Not provided'}</p>
                    </div>
                  )}
                </div>

                {/* State, District, Pincode */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    State
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="state"
                      value={profile.state}
                      onChange={handleInputChange}
                      placeholder="Enter state"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-navy-500 focus:ring-2 focus:ring-navy-200"
                    />
                  ) : (
                    <div className="px-4 py-3 bg-gray-50 rounded-xl border border-gray-200">
                      <p className="font-medium text-gray-800">{profile.state || 'Not provided'}</p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    District
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="district"
                      value={profile.district}
                      onChange={handleInputChange}
                      placeholder="Enter district"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-navy-500 focus:ring-2 focus:ring-navy-200"
                    />
                  ) : (
                    <div className="px-4 py-3 bg-gray-50 rounded-xl border border-gray-200">
                      <p className="font-medium text-gray-800">{profile.district || 'Not provided'}</p>
                    </div>
                  )}
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Pincode
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="pincode"
                      value={profile.pincode}
                      onChange={handleInputChange}
                      placeholder="Enter pincode"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-navy-500 focus:ring-2 focus:ring-navy-200"
                      maxLength="6"
                      pattern="[0-9]{6}"
                    />
                  ) : (
                    <div className="px-4 py-3 bg-gray-50 rounded-xl border border-gray-200">
                      <p className="font-medium text-gray-800">{profile.pincode || 'Not provided'}</p>
                    </div>
                  )}
                </div>

                {/* Emergency Contact */}
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Emergency Contact
                  </label>
                  {isEditing ? (
                    <input
                      type="text"
                      name="emergency_contact"
                      value={profile.emergency_contact}
                      onChange={handleInputChange}
                      placeholder="Enter emergency contact number"
                      className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:border-navy-500 focus:ring-2 focus:ring-navy-200"
                    />
                  ) : (
                    <div className="px-4 py-3 bg-gray-50 rounded-xl border border-gray-200 flex items-center">
                      <FiPhone className="text-gray-500 mr-3" />
                      <p className="font-medium text-gray-800">{profile.emergency_contact || 'Not provided'}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Verified Documents Section */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
            <div className="bg-gradient-to-r from-emerald-600 to-emerald-700 p-6">
              <div className="flex items-center justify-between">
                <div>
                  <h2 className="text-xl font-bold text-white">Verified Documents</h2>
                  <p className="text-emerald-200 mt-1">Approved documents with document numbers</p>
                </div>
                <div className="bg-white/10 p-3 rounded-xl">
                  <FiShield className="text-2xl text-white" />
                </div>
              </div>
            </div>
            
            <div className="p-6">
              {verifiedDocuments.length > 0 ? (
                <div className="space-y-4">
                  {verifiedDocuments.map((doc) => (
                    <div 
                      key={doc.id} 
                      className="border border-emerald-200 bg-emerald-50 rounded-xl p-4 hover:bg-emerald-100 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex items-start space-x-3">
                          <div className="p-2 bg-white rounded-lg border border-emerald-200">
                            {getDocumentIcon(doc.document_name)}
                          </div>
                          <div>
                            <h3 className="font-bold text-gray-800">{doc.document_name}</h3>
                            {doc.document_number_last4 && (
                              <p className="text-sm text-gray-600 mt-1">
                                Number: <span className="font-mono font-medium">****{doc.document_number_last4}</span>
                              </p>
                            )}
                            {doc.expiry_date && (
                              <p className="text-xs text-gray-500 mt-1">
                                Expires: {formatDate(doc.expiry_date)}
                              </p>
                            )}
                            <p className="text-xs text-gray-500 mt-2">
                              Verified on {formatDate(doc.verified_at || doc.updated_at)}
                            </p>
                          </div>
                        </div>
                        <span className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-emerald-100 text-emerald-800 border border-emerald-200">
                          <FiCheck className="mr-1" /> Verified
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="bg-gray-100 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4">
                    <FiFileText className="text-2xl text-gray-400" />
                  </div>
                  <h3 className="text-lg font-medium text-gray-800 mb-2">No Verified Documents</h3>
                  <p className="text-gray-600 mb-4">
                    Your uploaded documents will appear here once they are verified by the Akshaya Centre staff.
                  </p>
                  <a 
                    href="/customer/documents" 
                    className="inline-flex items-center text-navy-700 hover:text-navy-800 font-medium"
                  >
                    Go to My Documents <FiUpload className="ml-2" />
                  </a>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Right Column - Stats and Actions */}
        <div className="space-y-8">
          {/* Profile Stats */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Profile Status</h3>
            
            <div className="space-y-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm text-gray-600">Profile Completion</span>
                  <span className="text-sm font-medium text-gray-800">{
                    calculateCompletion(profile)
                  }%</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-navy-600 h-2 rounded-full" 
                    style={{ width: `${calculateCompletion(profile)}%` }}
                  ></div>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="flex items-center justify-between p-3 bg-blue-50 rounded-lg border border-blue-100">
                  <div className="flex items-center">
                    <div className="p-2 bg-blue-100 rounded-lg mr-3">
                      <FiFileText className="text-blue-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Total Documents</p>
                      <p className="text-xl font-bold text-gray-800">{stats.total}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-emerald-50 rounded-lg border border-emerald-100">
                  <div className="flex items-center">
                    <div className="p-2 bg-emerald-100 rounded-lg mr-3">
                      <FiCheck className="text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Verified</p>
                      <p className="text-xl font-bold text-gray-800">{stats.verified}</p>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center justify-between p-3 bg-amber-50 rounded-lg border border-amber-100">
                  <div className="flex items-center">
                    <div className="p-2 bg-amber-100 rounded-lg mr-3">
                      <FiCalendar className="text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm text-gray-600">Pending Review</p>
                      <p className="text-xl font-bold text-gray-800">{stats.pending}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-sm p-6">
            <h3 className="text-lg font-bold text-gray-800 mb-4">Quick Actions</h3>
            
            <div className="space-y-3">
              <a 
                href="/customer/documents" 
                className="flex items-center p-3 border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all group"
              >
                <div className="p-2 bg-blue-100 rounded-lg mr-3 group-hover:bg-blue-200 transition-colors">
                  <FiUpload className="text-blue-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-800">Upload Documents</p>
                  <p className="text-xs text-gray-500">Add new documents for verification</p>
                </div>
              </a>
              
              <a 
                href="/customer/dashboard" 
                className="flex items-center p-3 border border-gray-200 rounded-xl hover:bg-gray-50 hover:border-gray-300 transition-all group"
              >
                <div className="p-2 bg-green-100 rounded-lg mr-3 group-hover:bg-green-200 transition-colors">
                  <FiBriefcase className="text-green-600" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-gray-800">Services Dashboard</p>
                  <p className="text-xs text-gray-500">Apply for government services</p>
                </div>
              </a>
            </div>
          </div>

          {/* Account Info */}
          <div className="bg-gradient-to-br from-navy-900 to-navy-800 rounded-2xl p-6">
            <h3 className="text-lg font-bold text-white mb-4">Account Information</h3>
            
            <div className="space-y-4">
              <div>
                <p className="text-sm text-navy-300">Customer ID</p>
                <p className="font-mono font-bold text-white mt-1">
                  {localStorage.getItem("customer_id") || 'N/A'}
                </p>
              </div>
              
              <div>
                <p className="text-sm text-navy-300">Account Created</p>
                <p className="font-medium text-white mt-1">
                  {profile.created_at ? formatDate(profile.created_at) : 'N/A'}
                </p>
              </div>
              
              <div>
                <p className="text-sm text-navy-300">Last Updated</p>
                <p className="font-medium text-white mt-1">
                  {profile.updated_at ? formatDate(profile.updated_at) : 'N/A'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

// Helper function to calculate profile completion percentage
const calculateCompletion = (profile) => {
  const requiredFields = [
    'name',
    'email',
    'phone',
    'date_of_birth',
    'gender',
    'marital_status',
    'address',
    'state',
    'district',
    'pincode'
  ];
  
  let completed = 0;
  requiredFields.forEach(field => {
    if (profile[field] && profile[field].toString().trim() !== '') {
      completed++;
    }
  });
  
  return Math.round((completed / requiredFields.length) * 100);
};

export default CustomerProfile;
