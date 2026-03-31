import { useState, useRef } from "react";
import { FiX, FiUser, FiPlus } from "react-icons/fi";
import { toast } from "react-toastify";

const AddStaffForm = ({ onAdd, onClose }) => {
  const [formData, setFormData] = useState({
    username: "",
    name: "",
    role: "staff", // Default to a valid role
    department: "",
    email: "",
    phone: "",
    status: "Active",
    joinDate: new Date().toISOString().split('T')[0],
    photo: null,
    employeeId: "",
    employmentType: "Full-time",
    reportsTo: "",
    salary: "",
    dateOfBirth: "",
    gender: "Male",
    emergencyContact: "",
    emergencyRelationship: "",
    start_time: "09:00",
    end_time: "17:00",
    effective_from: new Date().toISOString().split('T')[0],
    password: "", // Add password to initial state
  });
  
  const [photoPreview, setPhotoPreview] = useState(null);
  const fileInputRef = useRef(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhotoPreview(reader.result);
        setFormData(prev => ({ ...prev, photo: reader.result }));
      };
      reader.readAsDataURL(file);
    }
  };

  const triggerFileInput = () => {
    fileInputRef.current.click();
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    // Client-side validation
    const requiredFields = ['username', 'name', 'role', 'email', 'password'];
    const missingFields = requiredFields.filter(field => !formData[field] || formData[field].trim() === "");
    if (missingFields.length > 0) {
      toast.error(`Please fill in: ${missingFields.join(", ")}`, {
        position: "top-right",
        autoClose: 5000,
        theme: "light",
      });
      return;
    }

    if (formData.role !== "superadmin") {
      const scheduleFields = ['start_time', 'end_time', 'effective_from'];
      const missingScheduleFields = scheduleFields.filter(field => !formData[field] || formData[field].trim() === "");
      if (missingScheduleFields.length > 0) {
        toast.error(`Please fill in: ${missingScheduleFields.join(", ")}`, {
          position: "top-right",
          autoClose: 5000,
          theme: "light",
        });
        return;
      }
    }

    // Ensure centre_id is included for non-superadmin roles
    const centreId = localStorage.getItem("centre_id");
    if (formData.role !== "superadmin" && !formData.centre_id && centreId) {
      setFormData(prev => ({ ...prev, centre_id: centreId }));
    }

    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/staff/add`, {
        method: 'POST',
        headers: { 
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${localStorage.getItem("token")}`,
        },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success(`Staff added! Temporary password: ${data.password}`, {
          position: "top-right",
          autoClose: 3000,
          theme: "light",
        });
        onAdd();
        onClose();
      } else {
        throw new Error(data.error || "Failed to add staff");
      }
    } catch (err) {
      console.error("Error adding staff:", err);
      toast.error(`Failed to add staff: ${err.message}`, {
        position: "top-right",
        autoClose: 5000,
        theme: "light",
      });
    }
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6 pb-2 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-800">Add New Staff Member</h2>
        <button 
          onClick={onClose} 
          className="text-gray-500 hover:text-gray-700"
          aria-label="Close form"
        >
          <FiX size={24} />
        </button>
      </div>
      
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Profile Photo Upload */}
        <div className="flex flex-col items-center mb-4">
          <div className="relative">
            {photoPreview ? (
              <img 
                src={photoPreview} 
                alt="Profile preview" 
                className="w-24 h-24 rounded-full object-cover border-2 border-gray-300"
              />
            ) : (
              <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-full w-24 h-24 flex items-center justify-center">
                <FiUser className="text-gray-400 text-3xl" />
              </div>
            )}
            <button
              type="button"
              onClick={triggerFileInput}
              className="absolute bottom-0 right-0 bg-navy-700 text-white rounded-full p-2 hover:bg-navy-800 transition-colors shadow-md"
            >
              <FiPlus className="text-white" />
            </button>
          </div>
          <input
            type="file"
            ref={fileInputRef}
            onChange={handlePhotoChange}
            accept="image/*"
            className="hidden"
          />
          <p className="mt-2 text-sm text-gray-500">Click the + to upload a photo</p>
        </div>
        
        {/* Employee ID and Username Fields */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="employeeId" className="block text-sm font-medium text-gray-700 mb-1">
              Employee ID
            </label>
            <input
              type="text"
              id="employeeId"
              name="employeeId"
              value={formData.employeeId}
              onChange={handleChange}
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
              placeholder="EMP-001"
            />
          </div>
          
          <div>
            <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-1">
              Username
            </label>
            <input
              type="text"
              id="username"
              name="username"
              value={formData.username}
              onChange={handleChange}
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
              placeholder="johndoe123"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="name" className="block text-sm font-medium text-gray-700 mb-1">
              Full Name
            </label>
            <input
              type="text"
              id="name"
              name="name"
              value={formData.name}
              onChange={handleChange}
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
              placeholder="John Doe"
            />
          </div>
          
          <div>
            <label htmlFor="role" className="block text-sm font-medium text-gray-700 mb-1">
              Role
            </label>
            <select
              id="role"
              name="role"
              value={formData.role}
              onChange={handleChange}
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
            >
              <option value="staff">Staff</option>
              <option value="supervisor">Supervisor</option>
              <option value="admin">Admin</option>
              {localStorage.getItem("role") === "superadmin" && <option value="superadmin">Superadmin</option>}
            </select>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="employmentType" className="block text-sm font-medium text-gray-700 mb-1">
              Employment Type
            </label>
            <select
              id="employmentType"
              name="employmentType"
              value={formData.employmentType}
              onChange={handleChange}
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
            >
              <option value="Full-time">Full-time</option>
              <option value="Part-time">Part-time</option>
              <option value="Contract">Contract</option>
              <option value="Freelance">Freelance</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="reportsTo" className="block text-sm font-medium text-gray-700 mb-1">
              Reports To
            </label>
            <input
              type="text"
              id="reportsTo"
              name="reportsTo"
              value={formData.reportsTo}
              onChange={handleChange}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
              placeholder="Manager's Name"
              disabled
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="department" className="block text-sm font-medium text-gray-700 mb-1">
              Department
            </label>
            <select
              id="department"
              name="department"
              value={formData.department}
              onChange={handleChange}
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
            >
              <option value="">Select Department</option>
              <option value="Accounts">Accounts</option>
              <option value="Reception">Reception</option>
              <option value="Front Office">Front Office</option>
              <option value="Aadhaar">Aadhaar</option>
              <option value="Staff Executive">Staff Executive</option>
              <option value="Customer Relations">Customer Relations</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
              Status
            </label>
            <select
              id="status"
              name="status"
              value={formData.status}
              onChange={handleChange}
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
            >
              <option value="Active">Active</option>
              <option value="On Leave">On Leave</option>
              <option value="Terminated">Terminated</option>
            </select>
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="salary" className="block text-sm font-medium text-gray-700 mb-1">
              Salary (₹)
            </label>
            <input
              type="number"
              id="salary"
              name="salary"
              value={formData.salary}
              onChange={handleChange}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
              placeholder="Monthly salary"
            />
          </div>
          
          <div>
            <label htmlFor="dateOfBirth" className="block text-sm font-medium text-gray-700 mb-1">
              Date of Birth
            </label>
            <input
              type="date"
              id="dateOfBirth"
              name="dateOfBirth"
              value={formData.dateOfBirth}
              onChange={handleChange}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="gender" className="block text-sm font-medium text-gray-700 mb-1">
              Gender
            </label>
            <select
              id="gender"
              name="gender"
              value={formData.gender}
              onChange={handleChange}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
            >
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </div>
          
          <div>
            <label htmlFor="emergencyContact" className="block text-sm font-medium text-gray-700 mb-1">
              Emergency Contact
            </label>
            <input
              type="tel"
              id="emergencyContact"
              name="emergencyContact"
              value={formData.emergencyContact}
              onChange={handleChange}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
              placeholder="Emergency phone number"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="emergencyRelationship" className="block text-sm font-medium text-gray-700 mb-1">
              Emergency Relationship
            </label>
            <input
              type="text"
              id="emergencyRelationship"
              name="emergencyRelationship"
              value={formData.emergencyRelationship}
              onChange={handleChange}
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
              placeholder="Relationship (e.g., Father, Spouse)"
            />
          </div>
          
          <div>
            <label htmlFor="joinDate" className="block text-sm font-medium text-gray-700 mb-1">
              Join Date
            </label>
            <input
              type="date"
              id="joinDate"
              name="joinDate"
              value={formData.joinDate}
              onChange={handleChange}
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
            />
          </div>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
              Email Address
            </label>
            <input
              type="email"
              id="email"
              name="email"
              value={formData.email}
              onChange={handleChange}
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
              placeholder="john.doe@company.com"
            />
          </div>
          
          <div>
            <label htmlFor="phone" className="block text-sm font-medium text-gray-700 mb-1">
              Phone Number
            </label>
            <input
              type="tel"
              id="phone"
              name="phone"
              value={formData.phone}
              onChange={handleChange}
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
              placeholder="+91 98765 43210"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
              Password
            </label>
            <input
              type="password"
              id="password"
              name="password"
              value={formData.password}
              onChange={handleChange}
              required
              className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
              placeholder="Enter password"
            />
          </div>
          {localStorage.getItem("role") === "superadmin" && (
            <div>
              <label htmlFor="centre_id" className="block text-sm font-medium text-gray-700 mb-1">
                Centre ID
              </label>
              <input
                type="text"
                id="centre_id"
                name="centre_id"
                value={formData.centre_id}
                onChange={handleChange}
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
                placeholder="Centre ID"
              />
            </div>
          )}
        </div>

        {/* Schedule Fields */}
        {formData.role !== "superadmin" && (
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label htmlFor="start_time" className="block text-sm font-medium text-gray-700 mb-1">
                Start Time
              </label>
              <input
                type="time"
                id="start_time"
                name="start_time"
                value={formData.start_time}
                onChange={handleChange}
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="end_time" className="block text-sm font-medium text-gray-700 mb-1">
                End Time
              </label>
              <input
                type="time"
                id="end_time"
                name="end_time"
                value={formData.end_time}
                onChange={handleChange}
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
              />
            </div>
            <div>
              <label htmlFor="effective_from" className="block text-sm font-medium text-gray-700 mb-1">
                Effective From
              </label>
              <input
                type="date"
                id="effective_from"
                name="effective_from"
                value={formData.effective_from}
                onChange={handleChange}
                required
                className="w-full px-3 py-2.5 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent"
              />
            </div>
          </div>
        )}
        
        <div className="pt-4 flex justify-end space-x-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2.5 bg-navy-700 text-white rounded-lg hover:bg-navy-800 transition-colors"
          >
            Add Staff Member
          </button>
        </div>
      </form>
    </div>
  );
};

export default AddStaffForm;
