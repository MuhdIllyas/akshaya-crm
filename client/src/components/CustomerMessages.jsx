// Customer profile → Messages: this customer's WhatsApp and portal chats,
// opened in Messenger. Staff can also start a WhatsApp chat from the centre's
// number.

import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { FiSmartphone, FiGlobe, FiMessageSquare, FiExternalLink, FiLoader, FiRefreshCw } from "react-icons/fi";

const api = axios.create({ baseURL: `${import.meta.env.VITE_API_URL}/api/chat` });
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token")?.trim();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const messengerPath = () => {
  const role = localStorage.getItem("role");
  if (role === "superadmin") return "/dashboard/superadmin/messenger";
  if (role === "admin") return "/dashboard/admin/messenger";
  return "/dashboard/staff/messenger";
};

const when = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  const today = new Date();
  return d.toDateString() === today.toDateString()
    ? d.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

function describe(c) {
  if (c.channel === "whatsapp") return { icon: FiSmartphone, cls: "bg-emerald-50 text-emerald-700", title: "WhatsApp", sub: c.centre_name || c.phone_number };
  if (c.context_type === "customer_service") {
    return {
      icon: FiGlobe,
      cls: "bg-sky-50 text-sky-700",
      title: `Portal · ${c.service_name || "Application"}${c.application_number ? ` (${c.application_number})` : ""}`,
      sub: c.assigned_staff_name ? `With ${c.assigned_staff_name}` : c.centre_name,
    };
  }
  return { icon: FiGlobe, cls: "bg-sky-50 text-sky-700", title: "Portal chat", sub: c.centre_name };
}

export default function CustomerMessages({ customer }) {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [busy, setBusy] = useState(null);

  const load = () =>
    api
      .get(`/customer/${customer.id}/conversations`)
      .then(({ data }) => setItems(Array.isArray(data) ? data : []))
      .catch((err) => {
        setItems([]);
        toast.error(err.response?.data?.error || "Couldn't load messages");
      });

  useEffect(() => {
    load();
  }, [customer.id]);

  const open = async (conversationId) => {
    setBusy(conversationId);
    try {
      await api.post(`/conversation/${conversationId}/join`);
      navigate(messengerPath(), { state: { openConversationId: conversationId } });
    } catch (err) {
      toast.error(err.response?.data?.error || "Couldn't open this conversation");
      setBusy(null);
    }
  };

  const startWhatsApp = async () => {
    if (!customer.phone) {
      toast.error("This customer has no phone number");
      return;
    }
    setBusy("wa");
    try {
      const { data } = await api.post("/conversation", {
        channel: "whatsapp",
        phoneNumber: customer.phone,
        name: customer.name,
        customerId: customer.id,
      });
      navigate(messengerPath(), { state: { openConversationId: data.id } });
    } catch (err) {
      toast.error(err.response?.data?.error || "Couldn't start a WhatsApp chat");
      setBusy(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="font-semibold text-slate-900">Messages</h3>
          <p className="text-sm text-slate-500">WhatsApp and customer portal chats with {customer.name}.</p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={load}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-600 hover:bg-slate-50"
            aria-label="Refresh messages"
          >
            <FiRefreshCw className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={startWhatsApp}
            disabled={busy === "wa"}
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
          >
            <FiSmartphone className="h-4 w-4" /> Message on WhatsApp
          </button>
        </div>
      </div>

      {items === null ? (
        <div className="flex items-center gap-2 p-6 text-sm text-slate-500">
          <FiLoader className="h-4 w-4 animate-spin" /> Loading…
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-200 p-8 text-center">
          <FiMessageSquare className="mx-auto h-6 w-6 text-slate-400" />
          <p className="mt-2 text-sm text-slate-600">No conversations with this customer yet.</p>
        </div>
      ) : (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200">
          {items.map((c) => {
            const d = describe(c);
            const Icon = d.icon;
            return (
              <li key={c.id} className="flex items-center gap-3 px-4 py-3">
                <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-lg ${d.cls}`}>
                  <Icon className="h-4 w-4" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="truncate text-sm font-medium text-slate-900">{d.title}</p>
                    <span className="ml-auto shrink-0 text-xs text-slate-400">{when(c.last_message_at)}</span>
                  </div>
                  <p className="truncate text-xs text-slate-500">
                    {d.sub}
                    {c.last_message && (
                      <>
                        {" · "}
                        {c.last_sender_type === "customer" ? "" : "Staff: "}
                        {c.last_message}
                      </>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => open(c.id)}
                  disabled={busy === c.id}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-navy-700 hover:bg-slate-50 disabled:opacity-60"
                >
                  <FiExternalLink className="h-3.5 w-3.5" /> Open
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
