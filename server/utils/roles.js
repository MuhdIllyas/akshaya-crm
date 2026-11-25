/* Staff roles.
   A supervisor works at one centre like staff (service entries, attendance,
   salary, targets) and also keeps that centre's accounts. So wherever the
   code means "a staff member", it should accept a supervisor too. */

export const STAFF_ROLES = ["staff", "supervisor"];

export const isStaffLike = (role) => STAFF_ROLES.includes(String(role || "").toLowerCase());

// For SQL: `WHERE s.role IN ${STAFF_ROLES_SQL}`
export const STAFF_ROLES_SQL = "('staff', 'supervisor')";

// Roles that may act on other staff members' entries in their centre
// (enter a service for them, edit or correct their entries, collect their pending payments).
export const ENTRY_MANAGERS = ["admin", "superadmin", "supervisor"];

/* Do the staff limits (one financial edit, two corrections) apply to this
   change? Always for staff. For a supervisor only on their OWN entries: on
   someone else's entry they act for the centre, like the admin. */
export const staffLimitsApply = (user, entryOwnerId) => {
  const role = String(user?.role || "").toLowerCase();
  if (role === "staff") return true;
  if (role === "supervisor") return Number(entryOwnerId) === Number(user.id);
  return false;
};

// A route open to "staff" is open to supervisors too.
export const roleAllowed = (role, allowedRoles) => {
  const r = String(role || "").toLowerCase();
  return allowedRoles.includes(r) || (r === "supervisor" && allowedRoles.includes("staff"));
};
