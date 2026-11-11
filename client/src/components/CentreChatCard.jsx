// Customer portal: chat with a centre on WhatsApp. Only centres with a
// connected WhatsApp number are shown; the customer's own centre (from its
// link/QR or their last booking) comes first. The customer sends the first
// message, which also lets the centre reply freely for 24 hours.

import { FaWhatsapp } from "react-icons/fa";
import { getPreferredCentreId, usePortalCentres, whatsappChatLink } from "@/tenancy/centres";

export default function CentreChatCard() {
  const { centres, loading } = usePortalCentres();
  const preferred = getPreferredCentreId();
  const customerName = localStorage.getItem("customer_name") || "";

  const withWhatsapp = centres
    .filter((c) => c.whatsapp_number)
    .sort((a, b) => (String(b.id) === preferred) - (String(a.id) === preferred));

  if (loading || withWhatsapp.length === 0) return null;

  return (
    <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h3 className="font-semibold text-slate-900">Chat with a centre</h3>
      <p className="mt-0.5 text-sm text-slate-500">Ask questions or send documents on WhatsApp.</p>
      <ul className="mt-3 divide-y divide-slate-100">
        {withWhatsapp.map((c) => (
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
            <a
              href={whatsappChatLink(c.whatsapp_number, `Hi ${c.name}, this is ${customerName}.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex h-10 shrink-0 items-center gap-2 rounded-xl bg-emerald-600 px-4 text-sm font-medium text-white transition-colors hover:bg-emerald-700"
            >
              <FaWhatsapp className="h-4 w-4" aria-hidden="true" />
              Chat
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
