import { useEffect } from "react";
import { toast } from "react-toastify";
import { socket } from "@/services/socket";
import { playOtpChime } from "@/utils/otpAlert";

// "₹100 received – SBI" when the companion phone catches a UPI payment for one
// of the centre's wallets (bank credit SMS or GPay / Paytm notification).
// The server only sends payments that landed on a wallet with "UPI payment
// check" switched on, so each payment shows once.

const SOURCE_LABEL = { sms: "bank SMS", gpay: "GPay", paytm: "Paytm", phonepe: "PhonePe", sbi: "SBI app" };

const rupees = (n) =>
  `₹${Number(n || 0).toLocaleString("en-IN", { maximumFractionDigits: 2 })}`;

export default function useUpiCreditAlerts({ enabled = true } = {}) {
  useEffect(() => {
    if (!enabled) return undefined;

    const onCredit = (c) => {
      if (!c || !c.amount) return;
      playOtpChime();
      const from = c.payer ? ` from ${c.payer}` : "";
      const ref = c.utr ? ` · Ref ${c.utr}` : "";
      toast.success(
        `${rupees(c.amount)} received in ${c.wallet_name || "wallet"}${from}` +
          ` (${SOURCE_LABEL[c.source] || c.source}${ref})`,
        { toastId: `upi-${c.id}`, autoClose: 10000 }
      );
    };

    socket.on("centre_upi_credit", onCredit);
    return () => socket.off("centre_upi_credit", onCredit);
  }, [enabled]);
}
