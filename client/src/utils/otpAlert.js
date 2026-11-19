import { toast } from "react-toastify";

/** Copy an OTP and confirm with a small toast. */
export async function copyOtp(code) {
  if (!code) return;
  try {
    await navigator.clipboard.writeText(code);
    toast.success(`Copied ${code}`, { autoClose: 1500, toastId: `copied-${code}` });
  } catch {
    toast.error("Couldn't copy. Select the code and copy it by hand.");
  }
}

let audioCtx = null;

/** Short two-note chime, made in the browser (no sound file needed). */
export function playOtpChime() {
  try {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    audioCtx = audioCtx || new Ctx();
    if (audioCtx.state === "suspended") audioCtx.resume();
    const now = audioCtx.currentTime;
    [880, 1320].forEach((freq, i) => {
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + i * 0.16;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.18, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.22);
      osc.connect(gain).connect(audioCtx.destination);
      osc.start(start);
      osc.stop(start + 0.25);
    });
  } catch { /* sound is a nice-to-have */ }
}

export const timeAgoOtp = (value) => {
  const s = Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 1000));
  if (s < 60) return "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
};
