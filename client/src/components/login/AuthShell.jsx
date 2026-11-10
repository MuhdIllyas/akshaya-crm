import { useState, useEffect, useRef } from "react";
import BackwatersScene from "./BackwatersScene";

// Shared layout for the login and customer registration pages: brand and form on the
// left, the backwaters scene with a glass brand card on the right (tablets and up).

const OTP_LENGTH = 6;

// Six boxes that behave like one input: type to move forward, backspace to go back, paste fills all.
export const OtpInput = ({ onChange, disabled }) => {
  const refs = useRef([]);
  // Kept in a ref so fast typing (or the phone autofilling the code) never reads a stale value.
  const digitsRef = useRef(Array(OTP_LENGTH).fill(""));
  const [, rerender] = useState(0);
  const digits = digitsRef.current;

  const commit = (next) => {
    digitsRef.current = next;
    rerender((n) => n + 1);
    onChange(next.join(""));
  };

  // The boxes appear after the code is sent, so move the cursor straight into the first one.
  useEffect(() => {
    refs.current[0]?.focus();
  }, []);

  const setAt = (index, digit) => {
    const next = digitsRef.current.slice();
    next[index] = digit;
    commit(next);
  };

  return (
    <div className="flex gap-2" onPaste={(e) => {
      const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, OTP_LENGTH);
      if (!pasted) return;
      e.preventDefault();
      commit(Array.from({ length: OTP_LENGTH }, (_, i) => pasted[i] || ""));
      refs.current[Math.min(pasted.length, OTP_LENGTH - 1)]?.focus();
    }}>
      {digits.map((digit, i) => (
        <input
          key={i}
          ref={(el) => (refs.current[i] = el)}
          type="text"
          inputMode="numeric"
          autoComplete={i === 0 ? "one-time-code" : "off"}
          maxLength={OTP_LENGTH}
          value={digit}
          disabled={disabled}
          aria-label={`OTP digit ${i + 1}`}
          onChange={(e) => {
            // Strip the digit already in the box so we only see what was just typed.
            const typed = e.target.value.replace(digit, "").replace(/\D/g, "") || e.target.value.replace(/\D/g, "").slice(-1);
            if (typed.length > 1) {
              // Autofill or a fast insert put several digits in one box: spread them out.
              const next = digitsRef.current.slice();
              typed.split("").slice(0, OTP_LENGTH - i).forEach((d, k) => { next[i + k] = d; });
              commit(next);
              refs.current[Math.min(i + typed.length, OTP_LENGTH - 1)]?.focus();
              return;
            }
            setAt(i, typed);
            if (typed && i < OTP_LENGTH - 1) refs.current[i + 1]?.focus();
          }}
          onKeyDown={(e) => {
            if (e.key === "Backspace" && !digitsRef.current[i] && i > 0) refs.current[i - 1]?.focus();
          }}
          className="login-field h-12 w-11 rounded-xl text-center text-lg font-semibold text-slate-900 disabled:opacity-60"
        />
      ))}
    </div>
  );
};

// Filled field with the label inside the box and an icon on the right.
// `as` can be "input" (default), "textarea" or "select" (pass <option>s as children).
export const Field = ({ id, label, icon: Icon, trailing, as: Tag = "input", children, ...inputProps }) => {
  const tall = Tag === "textarea";
  return (
    <div className={`login-field relative flex rounded-xl px-4 ${tall ? "min-h-[5.5rem] items-start pt-6 pb-2" : "h-14 items-center"}`}>
      <label htmlFor={id} className="absolute left-4 top-2 text-[11px] font-medium text-slate-500">
        {label}
      </label>
      <Tag
        id={id}
        className={`w-full bg-transparent text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-60 ${
          tall ? "resize-none pt-1" : "pt-4"
        } ${Tag === "select" ? "-ml-1 cursor-pointer" : ""}`}
        {...inputProps}
      >
        {children}
      </Tag>
      {trailing || (Icon && <Icon className={`h-4 w-4 shrink-0 text-slate-400 ${tall ? "mt-1" : ""}`} aria-hidden="true" />)}
    </div>
  );
};

// Primary and secondary pill buttons used in the form's button row.
export const pillSecondary =
  "h-12 flex-1 rounded-full bg-slate-100 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-60";
export const pillPrimary =
  "h-12 flex-1 rounded-full bg-teal-600 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(13,148,136,0.55)] transition-all hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60";

export const Spinner = () => (
  <svg className="mr-2 h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
  </svg>
);

const AuthShell = ({ brandCard, children }) => (
  <div className="login-page flex min-h-screen min-h-dvh items-center justify-center bg-slate-100 dark:bg-slate-50 p-3 sm:p-6 md:p-0">
    <div className="relative w-full overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl md:min-h-screen md:min-h-dvh md:rounded-none md:border-0 md:shadow-none">

      {/* Backwaters panel (tablets and up) */}
      <div className="pointer-events-none absolute inset-y-0 right-0 hidden w-[58%] md:block">
        <BackwatersScene className="h-full w-full" />
      </div>

      <div className="relative z-10 flex flex-col px-6 py-6 sm:px-10 md:min-h-screen md:min-h-dvh md:w-[50%] md:py-10 lg:px-16 xl:px-24">

        {/* Brand */}
        <div className="flex items-center gap-3">
          <div className="rounded-xl border border-slate-200 bg-white p-1.5 shadow-sm">
            <img src="/logo-light.png" alt="Akshaya Sahayi logo" className="h-9 w-9 object-contain" />
          </div>
          <div>
            <p className="text-lg font-bold leading-tight text-slate-900">
              Akshaya <span className="text-teal-600">Sahayi</span>
            </p>
            <p className="text-xs text-slate-500">Your Trusted Digital Service Companion</p>
          </div>
        </div>

        {children}

        {/* Brand card for phones, where the backwaters panel is hidden */}
        <div className="rounded-2xl bg-gradient-to-b from-navy-900 to-navy-800 p-5 md:hidden">{brandCard}</div>
        <p className="mt-4 text-center text-xs text-slate-400 md:hidden">
          © {new Date().getFullYear()} Muhammed Illyas. All rights reserved.
        </p>
      </div>

      {/* Glass card and footer over the backwaters panel */}
      <div className="absolute bottom-8 right-8 z-10 hidden w-[min(360px,36%)] md:block">
        <div className="rounded-2xl border border-white/20 bg-[rgba(15,30,51,0.55)] p-5 shadow-lg backdrop-blur-md">
          {brandCard}
        </div>
        <p className="mt-3 text-right text-xs text-white/80 drop-shadow">
          © {new Date().getFullYear()} Muhammed Illyas. All rights reserved. · Made with <span className="text-teal-300">❤️</span>
        </p>
      </div>
    </div>

    <style>{`
      /* Rotating text in the brand card */
      @keyframes fadeSlide {
        0% { opacity: 0; transform: translateY(10px); }
        15% { opacity: 1; transform: translateY(0); }
        85% { opacity: 1; transform: translateY(0); }
        100% { opacity: 0; transform: translateY(-10px); }
      }
      .animate-fade-slide {
        animation: fadeSlide 3s ease-in-out forwards;
      }
      @keyframes otpIn {
        from { opacity: 0; transform: translateY(-6px); }
        to { opacity: 1; transform: none; }
      }
      .animate-otp-in { animation: otpIn 0.25s ease-out; }
      @media (prefers-reduced-motion: reduce) {
        .animate-fade-slide, .animate-otp-in { animation: none; }
      }

      .login-page .login-field {
        background: #f1f5f9;
        border: 1.5px solid transparent;
        transition: border-color 0.15s, box-shadow 0.15s;
      }
      .login-page .login-field:focus-within,
      .login-page input.login-field:focus {
        outline: none;
        border-color: #14b8a6;
        box-shadow: 0 0 0 4px rgba(20, 184, 166, 0.15);
      }
      .login-page .login-field:focus-within label { color: #0d9488; }
      /* Keep the browser's autofill tint from painting a blue box inside the fields */
      .login-page .login-field input:-webkit-autofill,
      .login-page .login-field input:-webkit-autofill:hover,
      .login-page .login-field input:-webkit-autofill:focus {
        -webkit-text-fill-color: #0f172a;
        -webkit-box-shadow: 0 0 0 1000px #f1f5f9 inset;
        caret-color: #0f172a;
        transition: background-color 9999s ease-out;
      }

      .login-page {
        --scene-sky-top: #9fd8cf;
        --scene-sky-bottom: #eaf7f4;
        --scene-sun: #fde68a;
        --scene-hill-far: #7fb3a3;
        --scene-hill-near: #3f7d69;
        --scene-water-top: #3f9a8d;
        --scene-water-bottom: #1f5f57;
        --scene-palm: #163d33;
        --scene-ripple: rgba(255, 255, 255, 0.5);
        --scene-dash: #cbd5e1;
      }
      @media screen {
        .dark .login-page .login-field { background: #2e3a4a; }
        .dark .login-page .login-field:focus-within label { color: #5eead4; }
        .dark .login-page .login-field input:-webkit-autofill,
        .dark .login-page .login-field input:-webkit-autofill:hover,
        .dark .login-page .login-field input:-webkit-autofill:focus {
          -webkit-text-fill-color: #e6ebf2;
          -webkit-box-shadow: 0 0 0 1000px #2e3a4a inset;
          caret-color: #e6ebf2;
        }
        .dark .login-page {
          --scene-sky-top: #16283c;
          --scene-sky-bottom: #284656;
          --scene-sun: #e2e8f0;
          --scene-hill-far: #24423f;
          --scene-hill-near: #1a3532;
          --scene-water-top: #1c434a;
          --scene-water-bottom: #0f2930;
          --scene-palm: #08140f;
          --scene-ripple: rgba(255, 255, 255, 0.15);
          --scene-dash: #4a5869;
        }
      }
    `}</style>
  </div>
);

export default AuthShell;
