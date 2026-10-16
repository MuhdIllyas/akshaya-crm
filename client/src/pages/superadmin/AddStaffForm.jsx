import { useState, useRef, useEffect } from "react";
import { FiX, FiUser, FiCamera, FiEye, FiEyeOff } from "react-icons/fi";
import axios from "axios";
import { toast } from "react-toastify";

// Superadmin version: centre picker, all roles, reports-to dropdown, inline validation.

const todayStr = () => new Date().toLocaleDateString("en-CA"); // local YYYY-MM-DD

const emptyForm = () => ({
  username: "",
  name: "",
  role: "",
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
  centre_id: "",
  password: "",
  start_time: "09:00",
  end_time: "17:00",
  effective_from: todayStr(),
});

const baseInput =
  "w-full px-3 py-2.5 border rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50";

const Field = ({ label, required, error, hint, children }) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 mb-1">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    {children}
    {error ? <p className="mt-1 text-xs text-red-600">{error}</p> : hint ? <p className="mt-1 text-xs text-gray-400">{hint}</p> : null}
  </div>
);

const Section = ({ title, cols = "md:grid-cols-2", children }) => (
  <section className="pt-5">
    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">{title}</h3>
    <div className={`grid grid-cols-1 ${cols} gap-4`}>{children}</div>
  </section>
);

const AddStaffForm = ({ onAdd, onClose, centres = [] }) => {
  const [formData, setFormData] = useState(emptyForm);
  const [supervisors, setSupervisors] = useState([]);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);
  const [photoPreview, setPhotoPreview] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);
  const [showPassword, setShowPassword] = useState(false);
  const fileInputRef = useRef(null);

  const cls = (name) => `${baseInput} ${errors[name] ? "border-red-400" : "border-gray-300"}`;

  // Reports-to options
  useEffect(() => {
    axios
      .get(`${import.meta.env.VITE_API_URL}/api/staff/all`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
        params: { role: "admin,superadmin,supervisor" },
      })
      .then((res) => setSupervisors(Array.isArray(res.data) ? res.data : []))
      .catch((err) => {
        console.error("Error fetching supervisors:", err);
        toast.error("Failed to load supervisors", { toastId: "fetch-supervisors-error" });
      });
  }, []);

  // When a centre is picked, show that centre's managers first
  const sortedSupervisors = [...supervisors].sort((a, b) => {
    const aHere = String(a.centreId) === String(formData.centre_id) ? 0 : 1;
    const bHere = String(b.centreId) === String(formData.centre_id) ? 0 : 1;
    return aHere - bHere || (a.name || "").localeCompare(b.name || "");
  });
  const centreName = (id) => centres.find((c) => String(c.id) === String(id))?.name;

  const validateForm = () => {
    const e = {};
    if (!formData.name.trim()) e.name = "Name is required";
    if (!formData.username.trim()) e.username = "Username is required";
    if (!formData.email.trim()) e.email = "Email is required";
    else if (!/\S+@\S+\.\S+/.test(formData.email)) e.email = "Invalid email format";
    if (!formData.password.trim()) e.password = "Password is required";
    else if (formData.password.length < 6) e.password = "At least 6 characters";
    if (!formData.role) e.role = "Role is required";
    if (!formData.centre_id && formData.role !== "superadmin") e.centre_id = "Centre is required";
    if (!formData.employeeId.trim()) e.employeeId = "Employee ID is required";
    if (formData.role !== "superadmin") {
      if (!formData.start_time) e.start_time = "Required";
      if (!formData.end_time) e.end_time = "Required";
      if (!formData.effective_from) e.effective_from = "Required";
    }
    return e;
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
    setErrors((prev) => ({ ...prev, [name]: "" }));
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
    if (loading) return;
    const validationErrors = validateForm();
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors);
      toast.error("Please fix the highlighted fields");
      return;
    }

    setLoading(true);
    try {
      const submitData = new FormData();
      Object.entries(formData).forEach(([k, v]) => {
        if (v !== null && v !== undefined) submitData.append(k, v);
      });
      if (selectedFile) submitData.append("photo", selectedFile);

      const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/staff/add`, submitData, {
        headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
      });

      toast.success(`${formData.name} added successfully`, { toastId: "add-staff-success" });
      setFormData(emptyForm());
      removePhoto();
      setErrors({});
      if (onAdd) onAdd(response.data.staff);
      else onClose?.();
    } catch (err) {
      console.error("Error creating staff:", err);
      toast.error(err.response?.data?.error || "Failed to create staff", { toastId: "add-staff-error" });
    } finally {
      setLoading(false);
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
        <button type="button" onClick={onClose} className="p-2 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100" aria-label="Close form">
          <FiX size={20} />
        </button>
      </div>

      <div className="px-6 pb-6 divide-y divide-gray-100">
        {/* Photo */}
        <div className="flex items-center gap-4 py-5">
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
              disabled={loading}
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
          <Field label="Full Name" required error={errors.name}>
            <input name="name" value={formData.name} onChange={handleChange} className={cls("name")} placeholder="John Doe" disabled={loading} />
          </Field>
          <Field label="Employee ID" required error={errors.employeeId}>
            <input name="employeeId" value={formData.employeeId} onChange={handleChange} className={cls("employeeId")} placeholder="EMP-001" disabled={loading} />
          </Field>
          <Field label="Email" required error={errors.email}>
            <input type="email" name="email" value={formData.email} onChange={handleChange} className={cls("email")} placeholder="john@company.com" disabled={loading} />
          </Field>
          <Field label="Phone">
            <input type="tel" name="phone" value={formData.phone} onChange={handleChange} className={cls("phone")} placeholder="+91 98765 43210" disabled={loading} />
          </Field>
          <Field label="Date of Birth" hint="Used for birthday wishes on the dashboard">
            <input type="date" name="dateOfBirth" value={formData.dateOfBirth} onChange={handleChange} max={todayStr()} className={cls("dateOfBirth")} disabled={loading} />
          </Field>
          <Field label="Gender">
            <select name="gender" value={formData.gender} onChange={handleChange} className={cls("gender")} disabled={loading}>
              <option value="Male">Male</option>
              <option value="Female">Female</option>
              <option value="Other">Other</option>
              <option value="Prefer not to say">Prefer not to say</option>
            </select>
          </Field>
        </Section>

        <Section title="Job details">
          <Field label="Role" required error={errors.role}>
            <select name="role" value={formData.role} onChange={handleChange} className={cls("role")} disabled={loading}>
              <option value="">Select role</option>
              <option value="staff">Staff</option>
              <option value="supervisor">Supervisor</option>
              <option value="admin">Admin</option>
              <option value="superadmin">Superadmin</option>
            </select>
          </Field>
          <Field label="Centre" required={formData.role !== "superadmin"} error={errors.centre_id}>
            <select name="centre_id" value={formData.centre_id} onChange={handleChange} className={cls("centre_id")} disabled={loading}>
              <option value="">Select centre</option>
              {centres.map((c) => (
                <option key={c.id} value={c.id}>{c.name}</option>
              ))}
            </select>
          </Field>
          <Field label="Department">
            <select name="department" value={formData.department} onChange={handleChange} className={cls("department")} disabled={loading}>
              <option value="">Select department</option>
              <option value="Accounts">Accounts</option>
              <option value="Reception">Reception</option>
              <option value="Front Office">Front Office</option>
              <option value="Aadhaar">Aadhaar</option>
              <option value="Staff Executive">Staff Executive</option>
              <option value="Customer Relations">Customer Relations</option>
            </select>
          </Field>
          <Field label="Reports To">
            <select name="reportsTo" value={formData.reportsTo} onChange={handleChange} className={cls("reportsTo")} disabled={loading}>
              <option value="">No one</option>
              {sortedSupervisors.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.role}{centreName(s.centreId) ? ` · ${centreName(s.centreId)}` : ""})
                </option>
              ))}
            </select>
          </Field>
          <Field label="Employment Type">
            <select name="employmentType" value={formData.employmentType} onChange={handleChange} className={cls("employmentType")} disabled={loading}>
              <option value="Full-time">Full-time</option>
              <option value="Part-time">Part-time</option>
              <option value="Contract">Contract</option>
              <option value="Freelance">Freelance</option>
              <option value="Probation">Probation</option>
            </select>
          </Field>
          <Field label="Status">
            <select name="status" value={formData.status} onChange={handleChange} className={cls("status")} disabled={loading}>
              <option value="Active">Active</option>
              <option value="On Leave">On Leave</option>
              <option value="Terminated">Terminated</option>
            </select>
          </Field>
          <Field label="Join Date">
            <input type="date" name="joinDate" value={formData.joinDate} onChange={handleChange} className={cls("joinDate")} disabled={loading} />
          </Field>
          <Field label="Salary (₹)">
            <input type="number" name="salary" value={formData.salary} onChange={handleChange} min="0" className={cls("salary")} placeholder="Monthly salary" disabled={loading} />
          </Field>
        </Section>

        <Section title="Emergency contact">
          <Field label="Contact Number">
            <input type="tel" name="emergencyContact" value={formData.emergencyContact} onChange={handleChange} className={cls("emergencyContact")} placeholder="Emergency phone number" disabled={loading} />
          </Field>
          <Field label="Relationship">
            <input name="emergencyRelationship" value={formData.emergencyRelationship} onChange={handleChange} className={cls("emergencyRelationship")} placeholder="e.g. Father, Spouse" disabled={loading} />
          </Field>
        </Section>

        <Section title="Login">
          <Field label="Username" required error={errors.username}>
            <input name="username" value={formData.username} onChange={handleChange} className={cls("username")} placeholder="johndoe123" autoComplete="off" disabled={loading} />
          </Field>
          <Field label="Password" required error={errors.password} hint="At least 6 characters">
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                name="password"
                value={formData.password}
                onChange={handleChange}
                className={`${cls("password")} pr-10`}
                placeholder="Set a password"
                autoComplete="new-password"
                disabled={loading}
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
          <Section title="Work schedule" cols="sm:grid-cols-3">
            <Field label="Start Time" required error={errors.start_time}>
              <input type="time" name="start_time" value={formData.start_time} onChange={handleChange} className={cls("start_time")} disabled={loading} />
            </Field>
            <Field label="End Time" required error={errors.end_time}>
              <input type="time" name="end_time" value={formData.end_time} onChange={handleChange} className={cls("end_time")} disabled={loading} />
            </Field>
            <Field label="Effective From" required error={errors.effective_from}>
              <input type="date" name="effective_from" value={formData.effective_from} onChange={handleChange} className={cls("effective_from")} disabled={loading} />
            </Field>
          </Section>
        )}
      </div>

      {/* Footer */}
      <div className="sticky bottom-0 bg-white px-6 py-4 border-t border-gray-200 flex justify-end gap-3">
        <button
          type="button"
          onClick={onClose}
          disabled={loading}
          className="px-4 py-2.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={loading}
          className="px-5 py-2.5 bg-navy-700 text-white rounded-lg text-sm font-semibold hover:bg-navy-800 disabled:opacity-60"
        >
          {loading ? "Creating…" : "Add Staff Member"}
        </button>
      </div>
    </form>
  );
};

export default AddStaffForm;