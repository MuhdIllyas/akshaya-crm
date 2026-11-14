// The customers page lives under each role's own dashboard path:
//   /dashboard/admin/customers, /dashboard/superadmin/customers,
//   /dashboard/staff/customers (staff and supervisors; also kept for old links).
const ROLE_BASE = {
  admin: "/dashboard/admin/customers",
  superadmin: "/dashboard/superadmin/customers",
};

/** The customers page (or one customer) for the signed-in staff member's role. */
export function customersPath(customerId = null, role = null) {
  let r = role;
  if (!r) {
    try {
      r = localStorage.getItem("role");
    } catch {
      r = null;
    }
  }
  const base = ROLE_BASE[r] || "/dashboard/staff/customers";
  return customerId ? `${base}/${customerId}` : base;
}
