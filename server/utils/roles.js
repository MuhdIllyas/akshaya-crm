/* Staff roles.
   A supervisor works at one centre like staff (service entries, attendance,
   salary, targets) and also keeps that centre's accounts. So wherever the
   code means "a staff member", it should accept a supervisor too. */

export const STAFF_ROLES = ["staff", "supervisor"];

export const isStaffLike = (role) => STAFF_ROLES.includes(String(role || "").toLowerCase());

// For SQL: `WHERE s.role IN ${STAFF_ROLES_SQL}`
export const STAFF_ROLES_SQL = "('staff', 'supervisor')";

// A route open to "staff" is open to supervisors too.
export const roleAllowed = (role, allowedRoles) => {
  const r = String(role || "").toLowerCase();
  return allowedRoles.includes(r) || (r === "supervisor" && allowedRoles.includes("staff"));
};
