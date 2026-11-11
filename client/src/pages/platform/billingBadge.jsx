// Billing state of an organization as a small coloured label.

const TONES = {
  slate: "bg-slate-50 text-slate-600 border-slate-200",
  sky: "bg-sky-50 text-sky-700 border-sky-200",
  emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
  amber: "bg-amber-50 text-amber-700 border-amber-200",
  rose: "bg-rose-50 text-rose-700 border-rose-200",
};

const days = (n) => `${n} day${Math.abs(n) === 1 ? "" : "s"}`;

function billingLabel(billing) {
  const { state, days_left: left } = billing || {};
  switch (state) {
    case "not_billed":
      return ["Your organization", "slate"];
    case "unbilled":
      return ["No billing dates", "slate"];
    case "trial":
      return [`Trial · ${days(left)} left`, left <= 3 ? "amber" : "sky"];
    case "active":
      return [`Paid · ${days(left)} left`, left <= 7 ? "amber" : "emerald"];
    case "grace":
      return [`Grace period · ${days(-left)} overdue`, "amber"];
    case "overdue":
      return [`Overdue · ${days(-left)}`, "rose"];
    default:
      return ["—", "slate"];
  }
}

export function BillingBadge({ billing }) {
  const [text, tone] = billingLabel(billing);
  return <span className={`inline-flex items-center whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${TONES[tone]}`}>{text}</span>;
}

export function StatusBadge({ status }) {
  const active = status === "active";
  return (
    <span className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-0.5 text-xs font-medium ${active ? TONES.emerald : TONES.rose}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${active ? "bg-emerald-500" : "bg-rose-500"}`} />
      {active ? "Active" : "Suspended"}
    </span>
  );
}
