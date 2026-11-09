import { useState, useEffect, useRef } from "react";
import axios from "axios";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { FiUser, FiLock, FiEye, FiEyeOff, FiPhone, FiCheck } from "react-icons/fi";
import BackwatersScene from "../components/login/BackwatersScene";

// Array of services for the animation
const servicesList = [
  "What We Offer",
  "Government & e-Governance Services",
  "Customer Service Management",
  "Online Application Tracking",
  "Digital Document Handling",
  "Financial & Wallet Management",
  "Staff & Centre Operations",
  "WhatsApp Notifications & Updates",
  "Citizen-Friendly Digital Support"
];

const OTP_LENGTH = 6;

// Six boxes that behave like one input: type to move forward, backspace to go back, paste fills all.
const OtpInput = ({ onChange, disabled }) => {
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

  // The boxes appear after "Send OTP", so move the cursor straight into the first one.
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

// Filled field with the label inside the box and an icon on the right, as in the design reference.
const Field = ({ id, label, icon: Icon, trailing, ...inputProps }) => (
  <div className="login-field relative flex h-14 items-center rounded-xl px-4">
    <label htmlFor={id} className="absolute left-4 top-2 text-[11px] font-medium text-slate-500">
      {label}
    </label>
    <input
      id={id}
      className="w-full bg-transparent pt-4 text-sm font-medium text-slate-900 placeholder:text-slate-400 focus:outline-none disabled:opacity-60"
      {...inputProps}
    />
    {trailing || (Icon && <Icon className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />)}
  </div>
);

const Login = () => {
  const [user, setUser] = useState({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isCustomerLogin, setIsCustomerLogin] = useState(false);
  const [customerPhone, setCustomerPhone] = useState("");
  const [customerOtp, setCustomerOtp] = useState("");
  const [otpSent, setOtpSent] = useState(false);
  const [otpTimer, setOtpTimer] = useState(0);

  // State for the animated text index
  const [serviceIndex, setServiceIndex] = useState(0);

  const navigate = useNavigate();
  const location = useLocation();

  // Handle the text animation cycle (changes every 3 seconds)
  useEffect(() => {
    const interval = setInterval(() => {
      setServiceIndex((prevIndex) => (prevIndex + 1) % servicesList.length);
    }, 3000);
    return () => clearInterval(interval);
  }, []);

  // Handle session expired toast from ProtectedRoute redirect
  useEffect(() => {
    if (location.state?.reason === "session_expired") {
      toast.error("Session expired, please log in again", {
        position: "top-right",
        autoClose: 3000,
        toastId: "session-expired",
      });
      window.history.replaceState({}, document.title);
    } else if (location.state?.reason === "customer_session_expired") {
      toast.error("Customer session expired, please log in again", {
        position: "top-right",
        autoClose: 3000,
        toastId: "customer-session-expired",
      });
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Load remembered username (with delay to avoid mount collision)
  useEffect(() => {
    // Older versions also stored the password in plain text; remove it.
    localStorage.removeItem("remembered_password");

    const savedUsername = localStorage.getItem("remembered_username");
    const savedRememberMe = localStorage.getItem("remember_me") === "true";

    if (savedUsername && savedRememberMe) {
      setUser((prev) => ({ ...prev, username: savedUsername }));
      setRememberMe(true);

      setTimeout(() => {
        toast.info("Username auto-filled from saved credentials", {
          position: "top-right",
          autoClose: 3000,
          toastId: "load-username",
        });
      }, 300);
    }
  }, []);

  // OTP timer effect
  useEffect(() => {
    let interval;
    if (otpTimer > 0) {
      interval = setInterval(() => {
        setOtpTimer((prev) => prev - 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [otpTimer]);

  const handleAdminLogin = async () => {
    setLoading(true);
    try {
      const res = await axios.post(`${import.meta.env.VITE_API_URL}/api/auth/login`, {
        username: user.username,
        password: user.password,
      });

      if (res.data.token) {
        localStorage.setItem("token", res.data.token);
        localStorage.setItem("id", res.data.id);
        localStorage.setItem("role", res.data.role);
        localStorage.setItem("username", res.data.username);
        localStorage.setItem("name", res.data.name);
        localStorage.setItem("centre_id", res.data.centre_id || "");
        // Shown under the admin's name in the sidebar (needs centre_name in the login response)
        localStorage.setItem("centre_name", res.data.centre_name || "");

        // Save the profile photo if it exists, otherwise clear any old ones
        if (res.data.photo) {
          localStorage.setItem("photo", res.data.photo);
        } else {
          localStorage.removeItem("photo");
        }

        // Only the username is remembered; never store the password in the browser.
        if (rememberMe) {
          localStorage.setItem("remembered_username", user.username);
          localStorage.setItem("remember_me", "true");
          toast.success("Username saved for next login", {
            position: "top-right",
            autoClose: 3000,
            toastId: "save-credentials",
          });
        } else {
          localStorage.removeItem("remembered_username");
          localStorage.removeItem("remember_me");
        }

        toast.success(`Welcome ${res.data.role} ${res.data.username}`, {
          position: "top-right",
          autoClose: 3000,
          toastId: "login-success",
        });

        navigate(`/dashboard/${res.data.role}`);
      } else {
        throw new Error("No token received");
      }
    } catch (err) {
      const errorMessage = err.response?.data?.error || "Login failed. Please try again.";
      toast.error(errorMessage, {
        position: "top-right",
        autoClose: 5000,
        toastId: "login-error",
      });
      console.error("Login error:", err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  const sendCustomerOTP = async () => {
    if (!customerPhone || customerPhone.length < 10) {
      toast.error("Please enter a valid phone number");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/customer/send-otp`, {
        phone: customerPhone
      });

      if (response.data.success) {
        setOtpSent(true);
        setOtpTimer(60);
        toast.success("OTP sent to your WhatsApp");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  };

  const verifyCustomerOTP = async () => {
    if (!customerOtp || customerOtp.length !== 6) {
      toast.error("Please enter 6-digit OTP");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/customer/verify-otp`, {
        phone: customerPhone,
        otp: customerOtp
      });

      if (response.data.success) {
        localStorage.setItem("role", "customer");
        localStorage.setItem("customer_token", response.data.token);
        localStorage.setItem("customer_id", response.data.customerId);
        localStorage.setItem("customer_name", response.data.name);

        toast.success(`Welcome ${response.data.name}`, {
          position: "top-right",
          autoClose: 3000,
        });

        navigate("/customer/dashboard");
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  const togglePasswordVisibility = () => {
    setShowPassword(!showPassword);
  };

  const handleLogin = () => {
    if (isCustomerLogin) {
      if (!otpSent) {
        sendCustomerOTP();
      } else {
        verifyCustomerOTP();
      }
    } else {
      handleAdminLogin();
    }
  };

  const submitDisabled =
    loading ||
    (isCustomerLogin
      ? (!otpSent ? !customerPhone : !customerOtp)
      : (!user.username.trim() || !user.password.trim()));

  const brandCard = (
    <>
      <h2 className="text-lg font-bold text-white">
        {isCustomerLogin ? "Customer Portal" : "Empowering Digital Kerala"}
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-white/80">
        {isCustomerLogin
          ? "Access your account seamlessly with WhatsApp OTP or register to access new e-governance services."
          : "Empowering citizens through smart, reliable, and people-friendly digital services across Kerala."}
      </p>

      {/* Animated Services List */}
      {!isCustomerLogin && (
        <div className="mt-4 flex min-h-[3.25rem] items-center overflow-hidden border-t border-white/15 pt-3">
          <p key={serviceIndex} className="animate-fade-slide flex items-center gap-2 text-sm font-semibold leading-snug text-white">
            <FiCheck className="h-4 w-4 shrink-0 text-teal-300" aria-hidden="true" />
            {servicesList[serviceIndex]}
          </p>
        </div>
      )}
    </>
  );

  return (
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

          {/* Form */}
          <form
            className="my-auto w-full max-w-sm py-8 md:mx-auto xl:max-w-md"
            onSubmit={(e) => {
              e.preventDefault();
              if (!submitDisabled) handleLogin();
            }}
          >
            <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              {isCustomerLogin ? "Public Login" : "Admin / Staff Login"}
            </p>
            <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
              {isCustomerLogin ? "Customer Login" : "Sign In"}
              <span className="text-teal-500">.</span>
            </h1>
            <p className="mt-2 text-sm text-slate-500">
              {isCustomerLogin
                ? "Enter your phone number to receive a secure OTP via WhatsApp."
                : "Enter your credentials to securely access your dashboard."}
            </p>

            <div className="mt-7 space-y-3">
              {isCustomerLogin ? (
                <>
                  <Field
                    id="customerPhone"
                    label="Phone Number (WhatsApp)"
                    icon={FiPhone}
                    type="tel"
                    inputMode="numeric"
                    autoComplete="tel"
                    placeholder="Enter your WhatsApp number"
                    value={customerPhone}
                    onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, "").slice(0, 10))}
                    disabled={loading || otpSent}
                  />

                  {otpSent && (
                    <div className="animate-otp-in">
                      <p className="mb-2 mt-1 text-xs font-medium text-slate-500">Enter OTP</p>
                      <OtpInput onChange={setCustomerOtp} disabled={loading} />
                      {otpTimer > 0 && (
                        <p className="mt-2 text-xs font-medium text-slate-500">
                          OTP expires in <span className="text-teal-600">{otpTimer} seconds</span>
                        </p>
                      )}
                    </div>
                  )}

                  {otpSent && (
                    <button
                      type="button"
                      onClick={sendCustomerOTP}
                      disabled={otpTimer > 0 || loading}
                      className="text-sm font-semibold text-teal-600 transition-colors hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {otpTimer > 0 ? `Resend OTP (${otpTimer}s)` : "Resend OTP"}
                    </button>
                  )}
                </>
              ) : (
                <>
                  <Field
                    id="username"
                    label="Username"
                    icon={FiUser}
                    type="text"
                    autoComplete="username"
                    placeholder="Enter your username"
                    value={user.username}
                    onChange={(e) => setUser({ ...user, username: e.target.value })}
                    disabled={loading}
                  />
                  <Field
                    id="password"
                    label="Password"
                    type={showPassword ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Enter your password"
                    value={user.password}
                    onChange={(e) => setUser({ ...user, password: e.target.value })}
                    disabled={loading}
                    trailing={
                      <button
                        type="button"
                        onClick={togglePasswordVisibility}
                        disabled={loading}
                        aria-label={showPassword ? "Hide password" : "Show password"}
                        className="shrink-0 text-slate-400 transition-colors hover:text-teal-600"
                      >
                        {showPassword ? <FiEyeOff className="h-4 w-4" /> : <FiEye className="h-4 w-4" />}
                      </button>
                    }
                  />

                  <div className="flex items-center justify-between pt-1">
                    <label className="flex cursor-pointer items-center text-sm text-slate-600">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="h-4 w-4 cursor-pointer rounded border-slate-300 accent-teal-600"
                        disabled={loading}
                      />
                      <span className="ml-2 select-none font-medium">Remember me</span>
                    </label>
                    <a href="#" className="text-sm font-semibold text-teal-600 transition-colors hover:text-teal-700">
                      Forgot password?
                    </a>
                  </div>
                </>
              )}
            </div>

            <div className="mt-7 flex gap-3">
              <button
                type="button"
                onClick={() => setIsCustomerLogin(!isCustomerLogin)}
                disabled={loading}
                className="h-12 flex-1 rounded-full bg-slate-100 text-sm font-semibold text-slate-600 transition-colors hover:bg-slate-200 disabled:opacity-60"
              >
                {isCustomerLogin ? "Staff Login" : "Public Login"}
              </button>
              <button
                type="submit"
                disabled={submitDisabled}
                className="h-12 flex-1 rounded-full bg-teal-600 text-sm font-semibold text-white shadow-[0_8px_20px_-6px_rgba(13,148,136,0.55)] transition-all hover:bg-teal-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="mr-2 h-5 w-5 animate-spin text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    {isCustomerLogin ? (otpSent ? "Verifying..." : "Sending OTP...") : "Signing In..."}
                  </span>
                ) : (
                  isCustomerLogin
                    ? (otpSent ? "Verify OTP" : "Send OTP")
                    : "Sign In"
                )}
              </button>
            </div>

            {isCustomerLogin && (
              <p className="mt-6 text-sm font-medium text-slate-600">
                New User?{" "}
                <Link to="/customer/register" className="ml-1 font-bold text-teal-600 transition-colors hover:text-teal-700">
                  Register here
                </Link>
              </p>
            )}

            <p className="mt-4 text-sm text-slate-500">
              Need help?{" "}
              <Link to="/contact" className="ml-1 font-semibold text-teal-600 transition-colors hover:text-teal-700">
                Contact Support
              </Link>
            </p>
          </form>

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
        /* Minimal Keyframes for Services Text Animation */
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
            --scene-dash: #4a5869;
          }
        }
      `}</style>
    </div>
  );
};

export default Login;
