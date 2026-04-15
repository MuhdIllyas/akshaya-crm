import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const Login = () => {
  const [user, setUser] = useState({ username: "", password: "" });
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [isCustomerLogin, setIsCustomerLogin] = useState(false); // New state
  const [customerPhone, setCustomerPhone] = useState(""); // For customer login
  const [customerOtp, setCustomerOtp] = useState(""); // For customer OTP
  const [otpSent, setOtpSent] = useState(false); // OTP status
  const [otpTimer, setOtpTimer] = useState(0); // OTP timer
  const navigate = useNavigate();
  const location = useLocation();

  // ✅ Handle session expired toast from ProtectedRoute redirect
  useEffect(() => {
    if (location.state?.reason === "session_expired") {
      toast.error("Session expired, please log in again", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: "light",
        toastId: "session-expired",
      });
      // Clear the state so it doesn't show again on refresh
      window.history.replaceState({}, document.title);
    } else if (location.state?.reason === "customer_session_expired") {
      toast.error("Customer session expired, please log in again", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: "light",
        toastId: "customer-session-expired",
      });
      // Clear the state so it doesn't show again on refresh
      window.history.replaceState({}, document.title);
    }
  }, [location.state]);

  // Load remembered username
  useEffect(() => {
    const savedUsername = localStorage.getItem("remembered_username");
    const savedRememberMe = localStorage.getItem("remember_me") === "true";
    if (savedUsername && savedRememberMe) {
      setUser((prev) => ({ ...prev, username: savedUsername }));
      setRememberMe(true);
      toast.info("Username auto-filled from saved credentials", {
        position: "top-right",
        autoClose: 3000,
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: "light",
        toastId: "load-username",
      });
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
        localStorage.setItem("centre_id", res.data.centre_id || "");

        if (rememberMe) {
          localStorage.setItem("remembered_username", user.username);
          localStorage.setItem("remembered_password", user.password);
          localStorage.setItem("remember_me", "true");
          toast.success("Credentials saved for next login", {
            position: "top-right",
            autoClose: 3000,
            hideProgressBar: false,
            closeOnClick: true,
            pauseOnHover: true,
            draggable: true,
            theme: "light",
            toastId: "save-credentials",
          });
        } else {
          localStorage.removeItem("remembered_username");
          localStorage.removeItem("remember_me");
        }

        toast.success(`Welcome ${res.data.role} ${res.data.username}`, {
          position: "top-right",
          autoClose: 3000,
          hideProgressBar: false,
          closeOnClick: true,
          pauseOnHover: true,
          draggable: true,
          theme: "light",
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
        hideProgressBar: false,
        closeOnClick: true,
        pauseOnHover: true,
        draggable: true,
        theme: "light",
        toastId: "login-error",
      });
      console.error("Login error:", err.response?.data || err.message);
    } finally {
      setLoading(false);
    }
  };

  // Customer OTP functions
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
        setOtpTimer(60); // 60 seconds
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
        // Store customer token and info
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={true}  // ✅ FIXED: Prevents old toasts from showing after navigation
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      <div className="w-full max-w-5xl flex flex-col md:flex-row bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
        <div className="w-full md:w-2/5 bg-gradient-to-b from-navy-900 to-navy-800 p-8 md:p-10 flex flex-col justify-between relative">
          {/* Background pattern remains same */}
          <div className="absolute inset-0 opacity-10">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d="M0,0 L100,0 L100,100 Z" fill="#fff" />
              <circle cx="20" cy="80" r="15" fill="#fff" />
              <circle cx="80" cy="20" r="10" fill="#fff" />
            </svg>
          </div>
          
          <div className="z-10">
            <div className="flex flex-col items-center mb-12">
              <div className="bg-white p-4 rounded-2xl shadow-lg mb-6">
                <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-navy-800" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="text-center">
                <h1 className="text-3xl font-bold text-navy-600 mb-2">Akshaya Centre</h1>
                <p className="text-navy-600 mb-2">Digital Empowerment Initiative</p>
              </div>
            </div>
            
            <div className="mt-16 bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
              <h2 className="text-xl font-bold text-navy-600 mb-2">
                {isCustomerLogin ? "Customer Portal" : "Empowering Digital Kerala"}
              </h2>
              <p className="text-navy-600 mb-2">
                {isCustomerLogin 
                  ? "Access your account with WhatsApp OTP or register for new services"
                  : "Akshaya Centres are Kerala's digital access points providing e-governance and citizen services across the state."}
              </p>
            </div>
          </div>
          
          <div className="z-10 mt-8">
            <p className="text-navy-800 mb-2 text-sm text-center">© 2025 Muhammed Illyas. All rights reserved.</p>
            <p className="text-navy-800 mb-2 text-sm text-center mt-1">Akshaya e Centre Pukayur</p>
          </div>
        </div>

        <div className="w-full md:w-3/5 p-8 md:p-10">
          <div className="max-w-md mx-auto">
            {/* Toggle Switch for Login Type */}
            <div className="flex mb-6 border-b border-gray-200">
              <button
                className={`flex-1 py-3 text-center font-medium ${!isCustomerLogin ? 'text-navy-700 border-b-2 border-navy-700' : 'text-gray-500'}`}
                onClick={() => setIsCustomerLogin(false)}
              >
                Admin/Staff Login
              </button>
              <button
                className={`flex-1 py-3 text-center font-medium ${isCustomerLogin ? 'text-navy-700 border-b-2 border-navy-700' : 'text-gray-500'}`}
                onClick={() => setIsCustomerLogin(true)}
              >
                Public Login
              </button>
            </div>

            <h2 className="text-3xl font-bold text-gray-800 mb-2">
              {isCustomerLogin ? "Customer Login" : "Sign In"}
            </h2>
            <p className="text-gray-600 mb-8">
              {isCustomerLogin 
                ? "Enter your phone number to receive OTP on WhatsApp"
                : "Enter your credentials to access your account"}
            </p>

            <div className="space-y-5">
              {isCustomerLogin ? (
                // Customer Login Form (OTP based)
                <>
                  <div>
                    <label htmlFor="customerPhone" className="block text-gray-700 text-sm font-medium mb-2">
                      Phone Number (WhatsApp)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                        </svg>
                      </div>
                      <input
                        type="tel"
                        id="customerPhone"
                        placeholder="Enter your WhatsApp number"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent text-gray-700 placeholder-gray-400"
                        disabled={loading || otpSent}
                      />
                    </div>
                  </div>

                  {otpSent && (
                    <div>
                      <label htmlFor="customerOtp" className="block text-gray-700 text-sm font-medium mb-2">
                        Enter OTP
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <input
                          type="text"
                          id="customerOtp"
                          placeholder="Enter 6-digit OTP"
                          value={customerOtp}
                          onChange={(e) => setCustomerOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent text-gray-700 placeholder-gray-400"
                          disabled={loading}
                        />
                      </div>
                      {otpTimer > 0 && (
                        <p className="text-sm text-gray-500 mt-1">
                          OTP expires in {otpTimer} seconds
                        </p>
                      )}
                    </div>
                  )}

                  <div className="flex justify-between items-center">
                    <button
                      onClick={otpSent ? sendCustomerOTP : undefined}
                      disabled={otpTimer > 0}
                      className="text-sm text-navy-600 hover:text-navy-800 transition-colors disabled:opacity-50"
                    >
                      {otpTimer > 0 ? `Resend OTP (${otpTimer}s)` : 'Resend OTP'}
                    </button>
                  </div>
                </>
              ) : (
                // Admin/Staff Login Form (Original)
                <>
                  <div>
                    <label htmlFor="username" className="block text-gray-700 text-sm font-medium mb-2">
                      Username
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        id="username"
                        placeholder="Enter your username"
                        value={user.username}
                        onChange={(e) => setUser({ ...user, username: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent text-gray-700 placeholder-gray-400"
                        disabled={loading}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="password" className="block text-gray-700 text-sm font-medium mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        id="password"
                        placeholder="Enter your password"
                        value={user.password}
                        onChange={(e) => setUser({ ...user, password: e.target.value })}
                        className="w-full pl-10 pr-12 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent text-gray-700 placeholder-gray-400"
                        disabled={loading}
                      />
                      <button 
                        onClick={togglePasswordVisibility}
                        className="absolute inset-y-0 right-0 pr-3 flex items-center"
                        disabled={loading}
                      >
                        {showPassword ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center">
                    <label className="flex items-center text-sm text-gray-700">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="form-checkbox rounded bg-gray-200 border-gray-300 text-navy-600 focus:ring-navy-500"
                        disabled={loading}
                      />
                      <span className="ml-2">Remember me</span>
                    </label>
                    <a href="#" className="text-sm text-navy-600 hover:text-navy-800 transition-colors">Forgot password?</a>
                  </div>
                </>
              )}
              
              <button
                onClick={handleLogin}
                className="w-full bg-navy-700 hover:bg-navy-800 text-white font-medium py-3 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 disabled:opacity-50"
                disabled={
                  loading || 
                  (isCustomerLogin 
                    ? (!otpSent ? !customerPhone : !customerOtp)
                    : (!user.username.trim() || !user.password.trim())
                  )
                }
              >
                {loading ? (
                  <span className="flex items-center justify-center">
                    <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
              
              {/* Customer Registration Link */}
              {isCustomerLogin && (
                <div className="text-center mt-4">
                  <p className="text-gray-600 text-sm">
                    New User?{" "}
                    <Link 
                      to="/customer/register" 
                      className="text-navy-600 hover:text-navy-800 font-medium"
                    >
                      Register here
                    </Link>
                  </p>
                </div>
              )}
              
              <div className="text-center mt-4">
                <p className="text-gray-600 text-sm">
                  Need help? <a href="#" className="text-navy-600 hover:text-navy-800 font-medium">Contact Support</a>
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
      
      <style>{`
        .bg-navy-900 { background-color: #0a192f; }
        .bg-navy-800 { background-color: #172a45; }
        .bg-navy-700 { background-color: #1e3a5f; }
        .bg-navy-600 { background-color: #2c5282; }
        .text-navy-600 { color: #2c5282; }
        .text-navy-800 { color: #172a45; }
        .focus\\:ring-navy-500:focus { --tw-ring-color: #1e3a5f; }
        .border-navy-500 { border-color: #1e3a5f; }
        .Toastify__toast--success {
          background-color: #2c5282 !important;
          color: #ffffff !important;
          border-radius: 0.75rem !important;
        }
        .Toastify__toast--error {
          background-color: #fef2f2 !important;
          color: #dc2626 !important;
          border: 1px solid #f87171 !important;
          border-radius: 0.75rem !important;
        }
        .Toastify__toast--info {
          background-color: #e0f2fe !important;
          color: #075985 !important;
          border: 1px solid #38bdf8 !important;
          border-radius: 0.75rem !important;
        }
      `}</style>
    </div>
  );
};

export default Login;
