// Customer portal: chat with a centre. "Chat here" opens a chat inside the
// portal (answered by the centre's staff in Messenger); centres with a
// connected WhatsApp number also offer WhatsApp. The customer's own centre
// (from its link/QR or their last booking) comes first.

import { useNavigate } from "react-router-dom";
import { FaWhatsapp } from "react-icons/fa";
import { FiMessageSquare } from "react-icons/fi";
import { getPreferredCentreId, usePortalCentres, whatsappChatLink } from "@/tenancy/centres";

export default function CentreChatCard() {
  const navigate = useNavigate();
  const { centres, loading } = usePortalCentres();
  const preferred = getPreferredCentreId();
  const customerName = localStorage.getItem("customer_name") || "";

  const list = [...centres].sort((a, b) => (String(b.id) === preferred) - (String(a.id) === preferred));

  if (loading || list.length === 0) return null;

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h3 className="font-semibold text-slate-900">Chat with a centre</h3>
      <p className="mt-0.5 text-sm text-slate-500">Ask questions here, or on WhatsApp.</p>
      <ul className="mt-3 divide-y divide-slate-100">
        {list.map((c) => (
          <li key={c.id} className="flex items-center justify-between gap-3 py-3">
            <div className="min-w-0">
              <p className="truncate font-medium text-slate-800">
                {c.name}
                {String(c.id) === preferred && (
                  <span className="ml-2 rounded-full bg-navy-500/10 px-2 py-0.5 text-xs font-medium text-navy-700">Your centre</span>
                )}
              </p>
              {c.district && <p className="truncate text-xs text-slate-500">{c.district}</p>}
            </div>
            <div className="flex shrink-0 items-center gap-2">
              <button
                type="button"
                onClick={() => navigate(`/customer/messages?centre=${c.id}`)}
                className="inline-flex h-10 items-center gap-2 rounded-xl bg-navy-700 px-3 text-sm font-medium text-white transition-colors hover:bg-navy-800"
              >
                <FiMessageSquare className="h-4 w-4" aria-hidden="true" />
                Chat here
              </button>
              {c.whatsapp_number && (
                <a
                  href={whatsappChatLink(c.whatsapp_number, `Hi ${c.name}, this is ${customerName}.`)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex h-10 items-center gap-2 rounded-xl bg-emerald-600 px-3 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
                  aria-label={`WhatsApp ${c.name}`}
                >
                  <FaWhatsapp className="h-4 w-4" aria-hidden="true" />
                  <span className="hidden sm:inline">WhatsApp</span>
                </a>
              )}
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
