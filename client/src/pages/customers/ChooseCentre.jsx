// "Choose your centre" — customer portal, when the superadmin has given each
// centre its own portal. The customer works at one centre at a time: their
// bookings, chats and centre list are that centre's only. Picking a centre
// they don't belong to yet joins it (like coming through its link or QR).
// A centre link (/portal/<org>/c/<id>) opened while signed in lands here with
// ?centre=<id> and switches straight away.

import { useEffect, useMemo, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import { FiCheckCircle, FiMapPin } from "react-icons/fi";
import { fetchCustomerPortalContext, selectCustomerCentre } from "@/tenancy/centres";

const API_URL = import.meta.env.VITE_API_URL;

export default function ChooseCentre() {
  const navigate = useNavigate();
  const location = useLocation();
  const [context, setContext] = useState(null);
  const [allCentres, setAllCentres] = useState([]);
  const [busyId, setBusyId] = useState(null);

  const choose = async (centreId) => {
    setBusyId(centreId);
    try {
      const next = await selectCustomerCentre(centreId);
      navigate(next, { replace: true });
    } catch (err) {
      toast.error(err.response?.data?.message || "Couldn't open that centre. Please try again.");
      setBusyId(null);
    }
  };

  useEffect(() => {
    const fromLink = Number(new URLSearchParams(location.search).get("centre")) || null;
    Promise.all([
      fetchCustomerPortalContext(),
      // every centre, not just the customer's own (no token on purpose)
      axios.get(`${API_URL}/api/portal/centres`).then((r) => (Array.isArray(r.data) ? r.data : [])),
    ])
      .then(([ctx, centres]) => {
        if (fromLink && centres.some((c) => c.id === fromLink)) return choose(fromLink);
        // one shared portal: nothing to choose
        if (ctx.portal_mode !== "per_centre") return navigate("/customer/dashboard", { replace: true });
        setContext(ctx);
        setAllCentres(centres);
      })
      .catch(() => {
        toast.error("Couldn't load the centres. Please try again.");
        setContext({ centres: [] });
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const mine = context?.centres || [];
  const others = useMemo(() => allCentres.filter((c) => !mine.some((m) => m.id === c.id)), [allCentres, mine]);
  const currentId = context?.centre?.id;

  if (!context) {
    return <div className="flex min-h-[50vh] items-center justify-center text-sm text-slate-500">Loading centres…</div>;
  }

  const Row = ({ c, joined }) => (
    <li>
      <button
        type="button"
        onClick={() => choose(c.id)}
        disabled={busyId !== null}
        className="flex w-full items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-navy-300 hover:bg-navy-500/5 disabled:opacity-60"
      >
        <span className="min-w-0">
          <span className="block truncate font-medium text-slate-900">{c.name}</span>
          {c.district && (
            <span className="mt-0.5 flex items-center gap-1 text-xs text-slate-500">
              <FiMapPin className="h-3 w-3" aria-hidden="true" /> {c.district}
            </span>
          )}
        </span>
        <span className="shrink-0 text-sm font-medium text-navy-700">
          {busyId === c.id ? "Opening…" : c.id === currentId ? (
            <span className="inline-flex items-center gap-1 text-emerald-700"><FiCheckCircle className="h-4 w-4" /> Current</span>
          ) : joined ? "Open" : "Join"}
        </span>
      </button>
    </li>
  );

  return (
    <div className="mx-auto max-w-xl px-4 py-6">
      <h1 className="text-xl font-semibold text-slate-900">Choose your centre</h1>
      <p className="mt-1 text-sm text-slate-500">
        Each centre has its own bookings and messages. You can switch centres any time.
      </p>

      {mine.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">Your centres</h2>
          <ul className="space-y-2">{mine.map((c) => <Row key={c.id} c={c} joined />)}</ul>
        </section>
      )}

      {others.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
            {mine.length > 0 ? "Other centres" : "Centres"}
          </h2>
          <ul className="space-y-2">{others.map((c) => <Row key={c.id} c={c} joined={false} />)}</ul>
        </section>
      )}

      {mine.length === 0 && others.length === 0 && (
        <p className="mt-6 text-sm text-slate-500">No centres are available right now.</p>
      )}
    </div>
  );
}
