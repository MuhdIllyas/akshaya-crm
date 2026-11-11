// Shows which business's portal the visitor is on (only for businesses other
// than the main one), with a way out if they opened the wrong link.

import { useEffect, useState } from "react";
import axios from "axios";
import { FiBriefcase } from "react-icons/fi";
import { getOrgSlug, setOrgSlug } from "@/tenancy/org";

const API_URL = import.meta.env.VITE_API_URL;

export default function OrgBadge({ className = "" }) {
  const slug = getOrgSlug();
  const [name, setName] = useState("");

  useEffect(() => {
    if (!slug) return;
    axios
      .get(`${API_URL}/api/org/${encodeURIComponent(slug)}`)
      .then(({ data }) => setName(data.name || slug))
      .catch(() => setName(slug));
  }, [slug]);

  if (!slug) return null;

  const leave = () => {
    setOrgSlug("");
    window.location.reload();
  };

  return (
    <div
      className={`flex items-center gap-2 rounded-full border border-teal-200 bg-teal-50 px-3 py-1.5 text-xs text-teal-800 dark:border-teal-800 dark:bg-teal-950/40 dark:text-teal-200 ${className}`}
    >
      <FiBriefcase className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
      <span className="truncate">
        Portal: <strong className="font-semibold">{name || slug}</strong>
      </span>
      <button type="button" onClick={leave} className="ml-auto shrink-0 font-medium underline-offset-2 hover:underline">
        Not yours?
      </button>
    </div>
  );
}
