// Wraps the plain /login and /customer/register pages so the address bar
// always says which business you're signing in to:
//
//  - Opened directly (typed, bookmarked, a fresh page load): plain /login means
//    YOUR own organization. If this browser remembered another business, it's
//    forgotten, together with that business's old login.
//  - Reached from inside the app (logout, session expired, a link on the
//    login page) while another business is remembered: go to that business's
//    own address, /portal/<slug>/login, instead.

import { Navigate, useLocation } from "react-router-dom";
import { clearOrgSession, getOrgSlug, setOrgSlug } from "./org";

export default function DefaultOrgRoute({ path, children }) {
  const location = useLocation();
  const slug = getOrgSlug();

  if (slug) {
    // React Router gives the first location of a page load the key "default".
    const openedDirectly = location.key === "default";
    if (!openedDirectly) {
      return <Navigate to={`/portal/${slug}/${path}${location.search}`} replace state={location.state} />;
    }
    clearOrgSession();
    setOrgSlug("");
  }
  return children;
}
