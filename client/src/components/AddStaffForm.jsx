import { useState, useRef } from "react";
import { FiX, FiUser, FiCamera, FiEye, FiEyeOff } from "react-icons/fi";
import { toast } from "react-toastify";

const todayStr = () => new Date().toLocaleDateString("en-CA"); // local YYYY-MM-DD

const inputCls =
  "w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-400";

const Field = ({ label, required, children, hint }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {hint && <p className="text-xs text-gray-400 mt-1">{hint}</p>}
  </div>
);

const Section = ({ title, children }) => (
  <section className="pt-5 first:pt-0">
    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{title}</h3>
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">{children}</div>
  </section>
);

const AddStaffForm = ({ onAdd, onClose }) => {
  const isSuperadmin = localStorage.getItem("role") === "superadmin";

  const [formData, setFormData] = useState({
    username: "",
    name: "",
    role: "staff",
    department: "",
    email: "",
    phone: "",
    status: "Active",
    joinDate: todayStr(),
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
    effective_from: todayStr(),
    password: "",
    centre_id: "",
  });

  const [photoPreview, setPhotoPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("Photo must be less than 2MB");
      return;
    }
    setSelectedFile(file);
    const reader = new FileReader();
    reader.onloadend = () => setPhotoPreview(reader.result);
    reader.readAsDataURL(file);
  };

  const removePhoto = () => {
    setSelectedFile(null);
    setPhotoPreview(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitting) return;

    const labels = { username: "Username", name: "Full name", role: "Role", email: "Email", password: "Password",
      start_time: "Start time", end_time: "End time", effective_from: "Effective from" };
    const required = ["username", "name", "role", "email", "password"];
    if (formData.role !== "superadmin") required.push("start_time", "end_time", "effective_from");
    const missing = required.filter((f) => !String(formData[f] || "").trim());
    if (missing.length) {
      toast.error(`Please fill in: ${missing.map((m) => labels[m]).join(", ")}`);
      return;
    }

    const submitData = new FormData();
    Object.entries(formData).forEach(([key, value]) => {
      if (value !== null && value !== undefined) submitData.append(key, value);
    });

    const centreId = localStorage.getItem("centre_id");
    if (formData.role !== "superadmin" && !formData.centre_id && centreId) {
      submitData.set("centre_id", centreId);
    }
    if (selectedFile) submitData.append("photo", selectedFile);

    setSubmitting(true);
    try {
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/staff/add`, {
        method: "POST",
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }, // no Content-Type for FormData
        body: submitData,
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "Failed to add staff");

      toast.success(`${formData.name} added successfully`);
      onAdd();
    } catch (err) {
      console.error("Error adding staff:", err);
      toast.error(`Failed to add staff: ${err.message}`);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* Header */}
      <div className="sticky top-0 z-10 bg-white flex justify-between items-center px-6 py-4 border-b border-gray-200">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Add New Staff Member</h2>
          <p className="text-sm text-gray-500">Fields marked * are required</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100"
          aria-label="Close form"
        >
          <FiX size={20} />
        </button>
      </div>

      <div className="px-6 py-5 divide-y divide-gray-100 space-y-5">
        {/* Photo */}
        <div className="flex items-center gap-4">
          <div className="relative">
            {photoPreview ? (
              <img src={photoPreview} alt="Preview" className="w-20 h-20 rounded-full object-cover border border-gray-200" />
            ) : (
              <div className="w-20 h-20 rounded-full bg-gray-100 border-2 border-dashed border-gray-300 flex items-center justify-center">
                <FiUser className="text-gray-400" size={28} />
              </div>
            )}
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="absolute -bottom-1 -right-1 bg-navy-700 hover:bg-navy-800 text-white rounded-full p-2 shadow-md"
              title="Upload photo"
            >
              <FiCamera size={14} />
            </button>
            <input type="file" ref={fileInputRef} onChange={handlePhotoChange} accept="image/*" className="hidden" />
          </div>
          <div className="text-sm">
            <p className="font-medium text-gray-700">Profile photo</p>
            <p className="text-gray-500">JPG or PNG, up to 2MB</p>
            {photoPreview && (
              <button type="button" onClick={removePhoto} className="text-red-600 hover:text-red-700 font-medium mt-1">
                Remove
              </button>
            )}
          </div>
        </div>

        <Section title="Basic details">
          <Field label="Full Name" required>
            <input name="name" value={formData.name} onChange={handleChange} className={inputCls} placeholder="John Doe" />
          </Field>
          <Field label="Employee ID">
            <input name="employeeId" value={formData.employeeId} onChange={handleChange} className={inputCls} placeholder="EMP-001" />
          </Field>
          <Field label="Email" required>
            <input type="email" name="email" value={formData.email} onChange={handleChange} className={inputCls} placeholder="john@company.com" />
          </Field>
          <Field label="Phone">
            <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className={inputCls} placeholder="+91 98765 43210" />
          </Field>
          <Field label="Date of Birth" hint="Used for birthday wishes on the dashboard">
            <input type="date" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleChange} max={todayStr()} className={inputCls} />
          </Field>
          <Field label="Gender">
            <select name="gender" value={formData.gender} onChange={handleChange} className={inputCls}>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </Field>
        </Section>

        <Section title="Job details">
          <Field label="Role" required>
            <select name="role" value={formData.role} onChange={handleChange} className={inputCls}>
              <option value="staff">Staff</option>
              <option value="supervisor">Supervisor</option>
              <option value="admin">Admin</option>
              {isSuperadmin && <option value="superadmin">Superadmin</option>}
            </select>
          </Field>
          <Field label="Department">
            <select name="department" value={formData.department} onChange={handleChange} className={inputCls}>
              <option value="">Select department</option>
              <option value="Accounts">Accounts</option>
              <option value="Reception">Reception</option>
              <option value="Front Office">Front Office</option>
              <option value="Aadhaar">Aadhaar</option>
              <option value="Staff Executive">Staff Executive</option>
              <option value="Customer Relations">Customer Relations</option>
            </select>
          </Field>
          <Field label="Employment Type">
            <select name="employmentType" value={formData.employmentType} onChange={handleChange} className={inputCls}>
              <option value="Full-time">Full-time</option>
              <option value="Part-time">Part-time</option>
              <option value="Contract">Contract</option>
              <option value="Freelance">Freelance</option>
              <option value="Probation">Probation</option>
            </select>
          </Field>
          <Field label="Status">
            <select name="status" value={formData.status} onChange={handleChange} className={inputCls}>
              <option value="Active">Active</option>
              <option value="On Leave">On Leave</option>
              <option value="Terminated">Terminated</option>
            </select>
          </Field>
          <Field label="Join Date">
            <input type="date" name="joinDate" value={formData.joinDate} onChange={handleChange} className={inputCls} />
          </Field>
          <Field label="Salary (₹)">
            <input type="number" name="salary" value={formData.salary} onChange={handleChange} className={inputCls} placeholder="Monthly salary" min="0" />
          </Field>
          {isSuperadmin && (
            <Field label="Centre ID">
              <input name="centre_id" value={formData.centre_id} onChange={handleChange} className={inputCls} placeholder="Centre ID" />
            </Field>
          )}
        </Section>

        <Section title="Emergency contact">
          <Field label="Contact Number">
            <input type="tel" name="emergencyContact" value={formData.emergencyContact} onChange={handleChange} className={inputCls} placeholder="Emergency phone number" />
          </Field>
          <Field label="Relationship">
            <input name="emergencyRelationship" value={formData.emergencyRelationship} onChange={handleChange} className={inputCls} placeholder="e.g. Father, Spouse" />
          </Field>
        </Section>

        <Section title="Login">
          <Field label="Username" required>
            <input name="username" value={formData.username} onChange={handleChange} className={inputCls} placeholder="johndoe123" autoComplete="off" />
          </Field>
          <Field label="Password" required>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                className={`${inputCls} pr-10`}
                placeholder="Set a password"
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                title={showPassword ? "Hide" : "Show"}
              >
                {showPassword ? <FiEyeOff size={16} /> : <FiEye size={16} />}
              </button>
            </div>
          </Field>
        </Section>

        {formData.role !== "superadmin" && (
          <section className="pt-5">
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">Work schedule</h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <Field label="Start Time" required>
                <input type="time" name="start_time" value={formData.start_time} onChange={handleChange} className={inputCls} />
              </Field>
              <Field label="End Time" required>
                <input type="time" name="end_time" value={formData.end_time} onChange={handleChange} className={inputCls} />
              </Field>
              <Field label="Effective From" required>
                <input type="date" name="effective_from" value={formData.effective_from} onChange={handleChange} className={inputCls} />
              </Field>
            </div>
          </section>
        )}
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 bg-white px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="px-5 py-2.5 bg-navy-700 text-white rounded-lg text-sm font-semibold hover:bg-navy-800 disabled:opacity-60"
        >
          {submitting ? "Adding…" : "Add Staff Member"}
        </button>
      </div>
    </form>
  );
};

export default AddStaffForm;