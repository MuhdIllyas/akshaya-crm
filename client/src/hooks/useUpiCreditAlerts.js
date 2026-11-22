import { useEffect } from "react";
import { toast } from "react-toastify";
import { socket } from "@/services/socket";
import { playOtpChime } from "@/utils/otpAlert";
import { getAlertSettings } from "@/utils/alertSettings";
import { getUnclaimed, isPickerOpenFor } from "@/components/upi/upiApi";

// UPI payments caught by the companion phone. Most link themselves to an entry
// within seconds, so they don't pop up: the top-bar chip shows them ("+1 ✓").
// Only a payment that still has no entry gets attention:
//   ~6 s after it arrives  → the chip pulses (and a soft chime, unless the
//                            staff member already has that wallet's picker open)
//   2 min after it arrives → one pop-up "₹80 has no entry yet — tap to link"
//                            (a single pop-up that updates; it never stacks)
// My Profile → Alerts can switch these off, or bring back a pop-up per payment.

const SOURCE_LABEL = { sms: "bank SMS", gpay: "GPay", paytm: "Paytm", phonepe: "PhonePe", sbi: "SBI app" };
const FIRST_CHECK_MS = 6000;
const NEEDS_LINK_MS = 2 * 60 * 1000;
const TOAST_ID = "upi-needs-link";

const rupees = (n) => `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;
const openChip = () => window.dispatchEvent(new Event("upi-chip-open"));

/** Is this payment still waiting for an entry? (null when the check failed) */
const stillUnlinked = async (c) => {
  try {
    const list = await getUnclaimed(c.wallet_id, 3);
    return list.some((x) => String(x.id) === String(c.id));
  } catch {
    return null;
  }
};

export default function useUpiCreditAlerts({ enabled = true } = {}) {
  useEffect(() => {
    if (!enabled) return undefined;
    const timers = new Set();
    const pending = new Map(); // id → payment still without an entry after 2 min
    let dismissed = new Set(); // ids the staff member closed the pop-up for

    const later = (ms, fn) => {
      const t = setTimeout(() => { timers.delete(t); fn(); }, ms);
      timers.add(t);
    };

    const showNeedsLink = () => {
      const list = [...pending.values()].filter((c) => !dismissed.has(c.id));
      if (!list.length) { toast.dismiss(TOAST_ID); return; }
      const c = list[list.length - 1];
      const from = c.payer ? ` · ${c.payer}` : "";
      const more = list.length > 1 ? ` (+${list.length - 1} more)` : "";
      const text = `${rupees(c.amount)} has no entry yet${from} · ${SOURCE_LABEL[c.source] || c.source}${more} — tap to link`;
      if (toast.isActive(TOAST_ID)) {
        toast.update(TOAST_ID, { render: text });
      } else {
        toast.warning(text, {
          toastId: TOAST_ID,
          autoClose: 30000,
          onClick: openChip,
          // Closed by hand: don't bring these back; a new payment still can
          onClose: () => { dismissed = new Set([...dismissed, ...pending.keys()]); },
        });
      }
    };

    const onCredit = (c) => {
      if (!c || !c.amount || c.source === "settlement") return;
      const s = getAlertSettings();

      if (s.everyUpi) {
        if (s.sound) playOtpChime();
        const from = c.payer ? ` from ${c.payer}` : "";
        toast.success(`${rupees(c.amount)} received in ${c.wallet_name || "wallet"}${from} (${SOURCE_LABEL[c.source] || c.source})`, {
          toastId: `upi-${c.id}`,
          autoClose: 8000,
          onClick: openChip,
        });
        return;
      }

      // Give the matcher a few seconds: a payment that links itself needs nothing
      later(FIRST_CHECK_MS, async () => {
        if ((await stillUnlinked(c)) !== true) return;
        window.dispatchEvent(new Event("upi-chip-pulse"));
        if (getAlertSettings().sound && !isPickerOpenFor(c.wallet_id)) playOtpChime();
      });

      later(NEEDS_LINK_MS, async () => {
        if (!getAlertSettings().upiNeedsLink) return;
        if ((await stillUnlinked(c)) !== true) return;
        pending.set(c.id, c);
        if (getAlertSettings().sound) playOtpChime();
        showNeedsLink();
      });
    };

    // Something was linked (by the matcher or by hand): drop those from the pop-up
    const onLinksUpdated = async () => {
      if (!pending.size) return;
      const wallets = [...new Set([...pending.values()].map((c) => c.wallet_id))];
      for (const w of wallets) {
        try {
          const open = new Set((await getUnclaimed(w, 3)).map((x) => String(x.id)));
          for (const [id, c] of pending) if (c.wallet_id === w && !open.has(String(id))) pending.delete(id);
        } catch { /* keep them; the next update tries again */ }
      }
      showNeedsLink();
    };

    socket.on("centre_upi_credit", onCredit);
    socket.on("upi_links_updated", onLinksUpdated);
    socket.on("centre_upi_credit_updated", onLinksUpdated); // ignored by an admin
    return () => {
      socket.off("centre_upi_credit", onCredit);
      socket.off("upi_links_updated", onLinksUpdated);
      socket.off("centre_upi_credit_updated", onLinksUpdated);
      timers.forEach(clearTimeout);
    };
  }, [enabled]);
}
