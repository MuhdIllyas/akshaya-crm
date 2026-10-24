import { useState } from "react";
import { Link } from "react-router-dom";
import { FiEdit2, FiEye } from "react-icons/fi";

// ---------- helpers ----------
export const getPhotoUrl = (photo) => {
  if (!photo || photo === "null" || photo === "undefined") return null;
  if (photo.startsWith("http") || photo.startsWith("data:image")) return photo;
  return `${import.meta.env.VITE_API_URL}${photo.startsWith("/") ? "" : "/"}${photo}`;
};

// Formats "YYYY-MM-DD" (or an ISO string) without timezone shifts
export const formatDate = (value, opts = { day: "2-digit", month: "short", year: "numeric" }) => {
  if (!value) return "—";
  const [y, m, d] = String(value).slice(0, 10).split("-").map(Number);
  if (!y || !m || !d) return "—";
  return new Date(y, m - 1, d).toLocaleDateString("en-IN", opts);
};

const getInitials = (name = "") =>
  name.split(" ").filter(Boolean).map((n) => n[0]).join("").slice(0, 2).toUpperCase() || "?";

// Photo with initials fallback (also falls back if the image fails to load)
export const StaffAvatar = ({ staff, size = "w-10 h-10", text = "text-sm", rounded = "rounded-full" }) => {
  const [failed, setFailed] = useState(false);
  const url = getPhotoUrl(staff.photo);

  if (url && !failed) {
    return (
      <img
        src={url}
        alt={staff.name}
        onError={() => setFailed(true)}
        className={`${size} ${rounded} object-cover border border-slate-200 bg-slate-100 shrink-0`}
      />
    );
  }
  return (
    <div className={`${size} ${rounded} bg-slate-100 text-navy-700 border border-slate-200 flex items-center justify-center font-semibold ${text} shrink-0`}>
      {getInitials(staff.name)}
    </div>
  );
};

export const StatusBadge = ({ status }) => {
  const map = {
    Active: "bg-emerald-50 text-emerald-700 border-emerald-200",
    "On Leave": "bg-amber-50 text-amber-700 border-amber-200",
    Terminated: "bg-rose-50 text-rose-700 border-rose-200",
  };
  const dot = { Active: "bg-emerald-500", "On Leave": "bg-amber-500", Terminated: "bg-rose-500" };
  return (
    <span className={`inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${map[status] || map.Active}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${dot[status] || dot.Active}`} />
      {status || "Active"}
    </span>
  );
};

export const RoleBadge = ({ role }) => {
  const map = {
    superadmin: "bg-navy-700 text-white border-navy-700",
    admin: "bg-slate-100 text-navy-700 border-slate-200",
    supervisor: "bg-amber-50 text-amber-700 border-amber-200",
    staff: "bg-white text-slate-700 border-slate-300",
  };
  return (
    <span className={`inline-flex text-xs font-medium px-2.5 py-1 rounded-full border capitalize ${map[role?.toLowerCase()] || map.staff}`}>
      {role}
    </span>
  );
};

// ---------- table ----------
const StaffTable = ({ staffList }) => {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-slate-200">
        <thead className="bg-slate-50">
          <tr>
            {["Staff Member", "Contact", "Role", "Department", "Status", "Joined", "Birthday"].map((h) => (
              <th key={h} className="px-5 py-3 text-left text-xs font-semibold text-slate-500 uppercase tracking-wider whitespace-nowrap">
                {h}
              </th>
            ))}
            <th className="px-5 py-3 text-right text-xs font-semibold text-slate-500 uppercase tracking-wider">Actions</th>
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-slate-100">
          {staffList.length > 0 ? (
            staffList.map((staff) => (
              <tr key={staff.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-5 py-3.5 whitespace-nowrap">
                  <div className="flex items-center gap-3">
                    <StaffAvatar staff={staff} />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{staff.name}</p>
                      <p className="text-xs text-slate-500 truncate">
                        @{staff.username}
                        {staff.employeeId && <span className="text-slate-400"> · {staff.employeeId}</span>}
                      </p>
                    </div>
                  </div>
                </td>
                <td className="px-5 py-3.5 whitespace-nowrap">
                  <p className="text-sm text-slate-700 truncate max-w-[220px]">{staff.email}</p>
                  <p className="text-xs text-slate-500">{staff.phone || "—"}</p>
                </td>
                <td className="px-5 py-3.5 whitespace-nowrap"><RoleBadge role={staff.role} /></td>
                <td className="px-5 py-3.5 whitespace-nowrap text-sm text-slate-600">{staff.department || "—"}</td>
                <td className="px-5 py-3.5 whitespace-nowrap"><StatusBadge status={staff.status} /></td>
                <td className="px-5 py-3.5 whitespace-nowrap text-sm text-slate-600">{formatDate(staff.joinDate)}</td>
                <td className="px-5 py-3.5 whitespace-nowrap text-sm text-slate-600">
                  {staff.dateOfBirth || staff.dob ? formatDate(staff.dateOfBirth || staff.dob, { day: "2-digit", month: "short" }) : "—"}
                </td>
                <td className="px-5 py-3.5 whitespace-nowrap text-right">
                  <div className="inline-flex gap-1">
                    <Link
                      to={`/dashboard/admin/staff/edit/${staff.id}`}
                      className="p-2 rounded-xl text-slate-500 hover:text-navy-700 hover:bg-slate-100 transition-colors"
                      title="Edit"
                      aria-label={`Edit ${staff.name}`}
                    >
                      <FiEdit2 size={15} />
                    </Link>
                    <Link
                      to={`/dashboard/admin/staff/${staff.id}`}
                      className="p-2 rounded-xl text-slate-500 hover:text-slate-900 hover:bg-slate-100 transition-colors"
                      title="View profile"
                      aria-label={`View ${staff.name}'s profile`}
                    >
                      <FiEye size={15} />
                    </Link>
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="8" className="px-6 py-12 text-center text-sm text-slate-500">
                No staff members match your search or filters
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
};

export default StaffTable;