import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { FiUser, FiLock, FiEye, FiEyeOff, FiPhone, FiCheck } from "react-icons/fi";
import AuthShell, { Field, OtpInput, Spinner, pillPrimary, pillSecondary } from "../components/login/AuthShell";

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
    <AuthShell brandCard={brandCard}>
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
                className={pillSecondary}
              >
                {isCustomerLogin ? "Staff Login" : "Public Login"}
              </button>
              <button
                type="submit"
                disabled={submitDisabled}
                className={pillPrimary}
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <Spinner />
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
    </AuthShell>
  );
};

export default Login;
