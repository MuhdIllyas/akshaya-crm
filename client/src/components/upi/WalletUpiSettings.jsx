import React, { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { FiCreditCard, FiSave } from "react-icons/fi";

/* UPI payment check settings for the centre's wallets: where the companion
   phone reads each wallet's payments from. Only these settings, so a
   supervisor can keep the payment check working without setting up,
   renaming or deleting wallets (that stays with the admin). */

// Same list as the wallet form (WalletManagement.jsx) and the server (utils/upiCredit.js)
const UPI_SOURCES = [
  ["sms", "Bank SMS"],
  ["gpay", "GPay app"],
  ["paytm", "Paytm app"],
  ["phonepe", "PhonePe app"],
  ["sbi", "SBI app"],
];

const api = axios.create({ baseURL: import.meta.env.VITE_API_URL });
api.interceptors.request.use((config) => {
  config.headers.Authorization = `Bearer ${localStorage.getItem("token")}`;
  return config;
});

const toDraft = (w) => ({
  sources: Array.isArray(w.upi_match_sources) ? w.upi_match_sources : [],
  last4: w.upi_account_last4 || "",
});

const WalletUpiSettings = () => {
  const [wallets, setWallets] = useState([]);
  const [drafts, setDrafts] = useState({});
  const [loading, setLoading] = useState(true);
  const [savingId, setSavingId] = useState(null);

  useEffect(() => {
    api
      .get("/api/wallet/my-centre-wallets")
      .then(({ data }) => {
        const list = (Array.isArray(data) ? data : []).filter((w) => w.status !== "inactive");
        setWallets(list);
        setDrafts(Object.fromEntries(list.map((w) => [w.id, toDraft(w)])));
      })
      .catch(() => toast.error("Failed to load wallets"))
      .finally(() => setLoading(false));
  }, []);

  const setDraft = (id, patch) => setDrafts((d) => ({ ...d, [id]: { ...d[id], ...patch } }));

  const isChanged = (w) => {
    const d = drafts[w.id];
    const saved = toDraft(w);
    return d && (d.sources.join(",") !== saved.sources.join(",") || (d.sources.includes("sms") && d.last4 !== saved.last4));
  };

  const save = async (w) => {
    const d = drafts[w.id];
    const last4 = d.sources.includes("sms") ? d.last4 : "";
    if (last4 && !/^\d{4}$/.test(last4)) {
      toast.error("Account number: enter the last 4 digits");
      return;
    }
    setSavingId(w.id);
    try {
      const { data } = await api.put(`/api/wallet/${w.id}/upi-settings`, {
        upi_match_sources: d.sources,
        upi_account_last4: last4 || null,
      });
      setWallets((list) => list.map((x) => (x.id === w.id ? { ...x, ...data } : x)));
      setDraft(w.id, toDraft(data));
      toast.success(`Payment check saved for ${w.name}`);
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save");
    } finally {
      setSavingId(null);
    }
  };

  return (
    <div className="max-w-3xl">
      <h2 className="text-2xl font-bold text-slate-900 mb-2">Payment check</h2>
      <p className="text-sm text-slate-600 mb-6">
        Choose where the centre&apos;s companion phone reads each wallet&apos;s UPI payments from. You can pick more
        than one. To add, rename or remove a wallet, ask the admin.
      </p>

      {loading ? (
        <p className="text-sm text-slate-500">Loading wallets…</p>
      ) : wallets.length === 0 ? (
        <p className="text-sm text-slate-500">This centre has no wallets yet.</p>
      ) : (
        <ul className="space-y-3">
          {wallets.map((w) => {
            const d = drafts[w.id] || toDraft(w);
            return (
              <li key={w.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-center gap-2 mb-3">
                  <FiCreditCard className="text-slate-500" aria-hidden="true" />
                  <span className="font-semibold text-slate-900">{w.name}</span>
                  <span className="text-xs text-slate-500 capitalize">{w.wallet_type}</span>
                </div>
                <div className="flex flex-wrap gap-2" role="group" aria-label={`Payment sources for ${w.name}`}>
                  {UPI_SOURCES.map(([id, label]) => {
                    const on = d.sources.includes(id);
                    return (
                      <button
                        key={id}
                        type="button"
                        aria-pressed={on}
                        onClick={() =>
                          setDraft(w.id, { sources: on ? d.sources.filter((v) => v !== id) : [...d.sources, id] })
                        }
                        className={`px-3 py-1.5 min-h-[36px] rounded-full border text-xs font-medium transition-colors ${
                          on
                            ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                            : "border-slate-200 text-slate-600 hover:bg-slate-50"
                        }`}
                      >
                        {on ? "✓ " : ""}
                        {label}
                      </button>
                    );
                  })}
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {d.sources.includes("sms") && (
                    <input
                      value={d.last4}
                      onChange={(e) => setDraft(w.id, { last4: e.target.value.replace(/\D/g, "").slice(0, 4) })}
                      className="w-full sm:w-[220px] rounded-xl border border-slate-200 px-3 py-2 text-sm"
                      inputMode="numeric"
                      placeholder="Account last 4 digits"
                      aria-label={`Account last 4 digits for ${w.name}`}
                    />
                  )}
                  <button
                    type="button"
                    onClick={() => save(w)}
                    disabled={!isChanged(w) || savingId === w.id}
                    className="ml-auto inline-flex items-center gap-2 rounded-xl bg-navy-700 px-4 py-2 min-h-[40px] text-sm font-medium text-white disabled:opacity-40"
                  >
                    <FiSave aria-hidden="true" />
                    {savingId === w.id ? "Saving…" : "Save"}
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
};

export default WalletUpiSettings;
