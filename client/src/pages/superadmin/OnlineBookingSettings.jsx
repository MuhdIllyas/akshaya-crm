// Superadmin → Settings → Online Bookings
//  - Customer portal: one portal for all centres, or each centre its own portal
//  - Booking mode for the whole organization (shared with confirmation / strict)
//  - Each centre's own portal link and QR code: bookings made through it are
//    automatically for that centre
//  - Which centres have WhatsApp connected (one number per centre)

import { useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { QRCodeCanvas } from "qrcode.react";
import { FiCheck, FiCopy, FiDownload } from "react-icons/fi";

const API_URL = import.meta.env.VITE_API_URL;
const auth = () => ({ headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } });

const MODES = [
  {
    value: "shared",
    title: "Shared with confirmation",
    text: "Every centre sees every booking, labelled with the centre it was booked for. Staff of another centre must confirm before taking it, and the booked centre's admin is notified.",
  },
  {
    value: "strict",
    title: "Strict",
    text: "Only the booked centre sees and takes its bookings. Bookings for “Any centre” still go to every centre.",
  },
];

const PORTALS = [
  {
    value: "shared",
    title: "One portal for all centres",
    text: "Customers see every centre and choose one (or any) for each booking. They can chat with any centre.",
  },
  {
    value: "per_centre",
    title: "Each centre has its own portal",
    text: "Customers join a centre through its link or QR code and see only that centre: its bookings, messages and profile. Staff see only their centre's customers. A customer can belong to more than one centre and switch between them.",
  },
];

function CentreQr({ centre, link }) {
  const wrap = useRef(null);
  const [copied, setCopied] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(link);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(`Couldn't copy. Link: ${link}`);
    }
  };

  const download = () => {
    const canvas = wrap.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `${centre.name.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-booking-qr.png`;
    a.click();
  };

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:flex-row sm:items-center">
      <div ref={wrap} className="shrink-0 self-center rounded-xl border border-slate-100 bg-white p-2">
        <QRCodeCanvas value={link} size={112} marginSize={1} />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <p className="font-semibold text-slate-900">{centre.name}</p>
          {centre.whatsapp ? (
            <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-medium text-emerald-700">WhatsApp connected</span>
          ) : (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-xs font-medium text-slate-600">WhatsApp off</span>
          )}
        </div>
        <code className="mt-1 block truncate text-sm text-slate-600">{link}</code>
        <div className="mt-3 flex flex-wrap gap-2">
          <button onClick={copy} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
            {copied ? <FiCheck className="text-emerald-600" /> : <FiCopy />} Copy link
          </button>
          <button onClick={download} className="inline-flex h-9 items-center gap-2 rounded-lg border border-slate-300 px-3 text-sm font-medium text-slate-700 hover:bg-slate-50">
            <FiDownload /> Download QR
          </button>
        </div>
      </div>
    </div>
  );
}

export default function OnlineBookingSettings({ accounts = [] }) {
  const [mode, setMode] = useState("shared");
  const [portal, setPortal] = useState("shared");
  const [orgSlug, setOrgSlug] = useState("");
  const [centres, setCentres] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    axios
      .get(`${API_URL}/api/org-settings`, auth())
      .then(({ data }) => {
        setMode(data.saved_booking_mode || data.booking_mode || "shared");
        setPortal(data.customer_portal || "shared");
        setOrgSlug(data.org_slug || "");
      })
      .catch(() => toast.error("Couldn't load booking settings"));
    axios
      .get(`${API_URL}/api/centres`, auth())
      .then(({ data }) => setCentres(Array.isArray(data) ? data : []))
      .catch(() => toast.error("Couldn't load centres"));
  }, []);

  const saveMode = async (value) => {
    const previous = mode;
    setMode(value);
    setSaving(true);
    try {
      await axios.put(`${API_URL}/api/org-settings/booking-mode`, { booking_mode: value }, auth());
      toast.success("Booking mode saved");
    } catch (err) {
      setMode(previous);
      toast.error(err.response?.data?.error || "Failed to save");
    } finally {
      setSaving(false);
    }
  };

  const savePortal = async (value) => {
    const previous = portal;
    setPortal(value);
    setSaving(true);
    try {
      await axios.put(`${API_URL}/api/org-settings/customer-portal`, { customer_portal: value }, auth());
      toast.success(value === "per_centre" ? "Each centre now has its own customer portal" : "One customer portal for all centres");
    } catch (err) {
      setPortal(previous);
      toast.error(err.response?.data?.error || "Failed to save");
    } finally {
      setSaving(false);
    }
  };
  const perCentre = portal === "per_centre";

  const activeAccountIds = new Set(accounts.filter((a) => a.is_active).map((a) => a.id));
  const linkFor = (id) => `${window.location.origin}/portal/${orgSlug}/c/${id}`;

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <h3 className="mb-1 text-lg font-semibold text-slate-900">Customer portal</h3>
        <p className="mb-4 text-sm text-slate-500">How customers relate to your centres. You can change this any time; nothing is lost.</p>
        <div className="grid gap-3 md:grid-cols-2">
          {PORTALS.map((m) => (
            <label
              key={m.value}
              className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${portal === m.value ? "border-navy-500 bg-navy-500/5" : "border-slate-200 hover:bg-slate-50"}`}
            >
              <input
                type="radio"
                name="customer-portal"
                value={m.value}
                checked={portal === m.value}
                disabled={saving}
                onChange={() => savePortal(m.value)}
                className="mt-1 h-4 w-4 accent-navy-700"
              />
              <span>
                <span className="block font-medium text-slate-900">{m.title}</span>
                <span className="mt-0.5 block text-sm text-slate-500">{m.text}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div className={`rounded-2xl border border-slate-200 bg-white p-5 shadow-sm md:p-6 ${perCentre ? "opacity-60" : ""}`}>
        <h3 className="mb-1 text-lg font-semibold text-slate-900">Who can take a booking</h3>
        <p className="mb-4 text-sm text-slate-500">
          {perCentre
            ? "With a portal per centre, only the booked centre sees and takes its bookings (strict). This choice applies again if you switch back to one portal."
            : "Customers choose a centre when booking (or come through a centre's link or QR code)."}
        </p>
        <div className="grid gap-3 md:grid-cols-2">
          {MODES.map((m) => (
            <label
              key={m.value}
              className={`flex cursor-pointer gap-3 rounded-xl border p-4 transition-colors ${mode === m.value ? "border-navy-500 bg-navy-500/5" : "border-slate-200 hover:bg-slate-50"}`}
            >
              <input
                type="radio"
                name="booking-mode"
                value={m.value}
                checked={mode === m.value}
                disabled={saving || perCentre}
                onChange={() => saveMode(m.value)}
                className="mt-1 h-4 w-4 accent-navy-700"
              />
              <span>
                <span className="block font-medium text-slate-900">{m.title}</span>
                <span className="mt-0.5 block text-sm text-slate-500">{m.text}</span>
              </span>
            </label>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-1 text-lg font-semibold text-slate-900">Centre links and QR codes</h3>
        <p className="mb-4 text-sm text-slate-500">
          Put a centre's QR code at its counter or share its link. Bookings made through it are for that centre.
          {perCentre && " With a portal per centre, the link is also how customers join that centre."}
          Each centre needs its own WhatsApp number; set it in Centre Management.
        </p>
        {orgSlug && centres.length > 0 ? (
          <div className="grid gap-3 xl:grid-cols-2">
            {centres.map((c) => (
              <CentreQr
                key={c.id}
                centre={{ ...c, whatsapp: c.communication_account_id && activeAccountIds.has(c.communication_account_id) }}
                link={linkFor(c.id)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center text-slate-500">No centres yet.</div>
        )}
      </div>
    </div>
  );
}
