import React from "react";
import { FiBell } from "react-icons/fi";
import { useAlertSettings, saveAlertSettings } from "@/utils/alertSettings";

// My Profile → Alerts: what pops up on this person's screen.
const ROWS = [
  ["otpPopup", "OTP pop-up", "Show the latest OTP for 8 seconds. A new OTP replaces the old one."],
  ["upiNeedsLink", "UPI payment needs linking", "Pop-up when a UPI payment still has no entry after 2 minutes."],
  ["sound", "Sound", "Soft chime for new OTPs and UPI payments that need an entry."],
  ["everyUpi", "Every UPI payment", "Old behaviour: a pop-up for each payment, even ones that link on their own."],
];

export default function AlertSettingsCard() {
  const s = useAlertSettings();
  return (
    <div className="mt-6 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-md">
      <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-gray-800">
          <FiBell /> Alerts
        </h2>
        <span className="text-xs text-gray-500">Saved for you on this computer</span>
      </div>
      <div className="divide-y divide-gray-100 px-6">
        {ROWS.map(([key, title, text]) => (
          <label key={key} className="flex cursor-pointer items-center gap-4 py-4">
            <span className="flex-1">
              <span className="block text-sm font-semibold text-gray-800">{title}</span>
              <span className="block text-xs text-gray-500">{text}</span>
            </span>
            <input
              type="checkbox"
              checked={!!s[key]}
              onChange={(e) => saveAlertSettings({ [key]: e.target.checked })}
              className="h-5 w-5 accent-[#1E3A5F]"
            />
          </label>
        ))}
      </div>
      <p className="border-t border-gray-100 bg-gray-50 px-6 py-3 text-xs text-gray-500">
        The OTP strip and the UPI chip in the top bar always show everything, whatever you switch off here.
      </p>
    </div>
  );
}
