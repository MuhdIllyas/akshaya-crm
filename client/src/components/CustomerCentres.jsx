// Staff customer profile → the centres this customer belongs to.
// When each centre has its own customer portal, these are the centres the
// customer can use (and whose staff can see them). The superadmin can add or
// remove centres here, e.g. to move a customer to another centre.

import { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { FiMapPin } from "react-icons/fi";

const API_URL = import.meta.env.VITE_API_URL;
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });

export default function CustomerCentres({ customerId }) {
  const [info, setInfo] = useState(null); // { portal_mode, centres, can_edit }
  const [allCentres, setAllCentres] = useState([]);
  const [editing, setEditing] = useState(false);
  const [picked, setPicked] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!customerId) return;
    axios
      .get(`${API_URL}/api/customer/${customerId}/centres`, auth())
      .then(({ data }) => setInfo(data))
      .catch(() => setInfo({ portal_mode: "shared", centres: [], can_edit: false }));
  }, [customerId]);

  const startEdit = async () => {
    try {
      if (!allCentres.length) {
        const { data } = await axios.get(`${API_URL}/api/centres`, auth());
        setAllCentres(Array.isArray(data) ? data : []);
      }
      setPicked(info.centres.map((c) => c.id));
      setEditing(true);
    } catch {
      toast.error("Couldn't load centres");
    }
  };

  const save = async () => {
    setSaving(true);
    try {
      const { data } = await axios.put(`${API_URL}/api/customer/${customerId}/centres`, { centre_ids: picked }, auth());
      setInfo((prev) => ({ ...prev, centres: data.centres }));
      setEditing(false);
      toast.success("Centres updated");
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  if (!info) return null;
  const perCentre = info.portal_mode === "per_centre";

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-slate-900">Centres</h3>
        {info.can_edit && !editing && (
          <button type="button" onClick={startEdit} className="text-sm font-medium text-navy-700 hover:underline">
            Change
          </button>
        )}
      </div>
      <p className="text-xs text-slate-500">
        {perCentre
          ? "Each centre has its own portal: the customer uses only these centres, and only their staff see this customer."
          : "Centres this customer has booked with or joined. (Used when each centre has its own portal.)"}
      </p>

      {!editing ? (
        info.centres.length ? (
          <div className="flex flex-wrap gap-2">
            {info.centres.map((c) => (
              <span key={c.id} className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-sm text-slate-700">
                <FiMapPin className="h-3.5 w-3.5 text-slate-400" aria-hidden="true" /> {c.name}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">Not linked to a centre yet.</p>
        )
      ) : (
        <div className="space-y-3 rounded-xl border border-slate-200 p-3">
          {allCentres.map((c) => (
            <label key={c.id} className="flex items-center gap-2 text-sm text-slate-700">
              <input
                type="checkbox"
                className="h-4 w-4 accent-navy-700"
                checked={picked.includes(c.id)}
                onChange={(e) => setPicked((p) => (e.target.checked ? [...p, c.id] : p.filter((id) => id !== c.id)))}
              />
              {c.name}
            </label>
          ))}
          <div className="flex gap-2 pt-1">
            <button type="button" onClick={save} disabled={saving} className="h-9 rounded-lg bg-navy-700 px-3 text-sm font-medium text-white hover:bg-navy-800 disabled:opacity-60">
              {saving ? "Saving…" : "Save"}
            </button>
            <button type="button" onClick={() => setEditing(false)} disabled={saving} className="h-9 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
