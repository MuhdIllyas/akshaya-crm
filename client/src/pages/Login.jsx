import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, Link, useLocation } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

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

        // Save the profile photo if it exists, otherwise clear any old ones
        if (res.data.photo) {
          localStorage.setItem("photo", res.data.photo);
        } else {
          localStorage.removeItem("photo");
        }

        if (rememberMe) {
          localStorage.setItem("remembered_username", user.username);
          localStorage.setItem("remembered_password", user.password);
          localStorage.setItem("remember_me", "true");
          toast.success("Credentials saved for next login", {
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

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-5xl flex flex-col md:flex-row bg-white rounded-2xl shadow-xl overflow-hidden border border-gray-200">
        
        {/* Left Panel - Navy & Teal Branding */}
        <div className="w-full md:w-2/5 bg-gradient-to-b from-navy-900 to-navy-800 p-8 md:p-10 flex flex-col justify-between relative">
          <div className="absolute inset-0 opacity-10 pointer-events-none">
            <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
              <path d="M0,0 L100,0 L100,100 Z" fill="#fff" />
              <circle cx="20" cy="80" r="15" fill="#fff" />
              <circle cx="80" cy="20" r="10" fill="#fff" />
            </svg>
          </div>
          
          <div className="z-10">
            <div className="flex flex-col items-center mb-12">
              <div className="bg-white p-3 rounded-2xl shadow-[0_10px_40px_-10px_rgba(20,184,166,0.3)] mb-6 border border-teal-50 hover:shadow-[0_10px_40px_-10px_rgba(20,184,166,0.5)] transition-all duration-300">
                <img 
                  src="/logo-light.png" 
                  alt="Akshaya Sahayi Logo" 
                  className="h-20 w-20 object-contain drop-shadow-sm" 
                />
              </div>
              <div className="text-center">
                <h1 className="text-3xl font-bold text-white mb-2">
                  Akshaya <span className="text-teal-400">Sahayi</span>
                </h1>
                <p className="text-navy-100 mb-2">Your Trusted Digital Service Companion</p>
              </div>
            </div>
            
            <div className="mt-16 bg-white/5 backdrop-blur-md rounded-2xl p-6 border border-white/10 shadow-lg">
              <h2 className="text-xl font-bold text-white mb-2">
                {isCustomerLogin ? "Customer Portal" : "Empowering Digital Kerala"}
              </h2>
              <p className="text-navy-100 mb-2 text-sm leading-relaxed">
                {isCustomerLogin 
                  ? "Access your account seamlessly with WhatsApp OTP or register to access new e-governance services."
                  : "Empowering citizens through smart, reliable, and people-friendly digital services across Kerala."}
              </p>

              {/* Animated Services List */}
              {!isCustomerLogin && (
                <div className="mt-4 pt-4 border-t border-white/10 h-12 overflow-hidden flex items-center">
                  <p 
                    key={serviceIndex} 
                    className="text-white font-semibold text-sm animate-fade-slide flex items-center gap-2"
                  >
                    <svg className="w-4 h-4 text-teal-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                    {servicesList[serviceIndex]}
                  </p>
                </div>
              )}
            </div>
          </div>
          
          <div className="z-10 mt-8">
            <p className="text-navy-300 mb-2 text-xs text-center">© {new Date().getFullYear()} Muhammed Illyas. All rights reserved.</p>
            <p className="text-navy-300 mb-2 text-xs text-center mt-1 flex justify-center items-center gap-1">
              Made with <span className="text-teal-400">❤️</span>
            </p>
          </div>
        </div>

        {/* Right Panel - Login Forms */}
        <div className="w-full md:w-3/5 p-8 md:p-10">
          <div className="max-w-md mx-auto">
            
            {/* Toggle Switch */}
            <div className="flex mb-8 border-b border-gray-200">
              <button
                className={`flex-1 py-3 text-center font-semibold text-sm transition-colors ${!isCustomerLogin ? 'text-teal-700 border-b-2 border-teal-500' : 'text-gray-500 hover:text-teal-600'}`}
                onClick={() => setIsCustomerLogin(false)}
              >
                Admin/Staff Login
              </button>
              <button
                className={`flex-1 py-3 text-center font-semibold text-sm transition-colors ${isCustomerLogin ? 'text-teal-700 border-b-2 border-teal-500' : 'text-gray-500 hover:text-teal-600'}`}
                onClick={() => setIsCustomerLogin(true)}
              >
                Public Login
              </button>
            </div>

            <h2 className="text-3xl font-bold text-gray-900 mb-2">
              {isCustomerLogin ? "Customer Login" : "Sign In"}
            </h2>
            <p className="text-gray-500 mb-8 text-sm">
              {isCustomerLogin 
                ? "Enter your phone number to receive a secure OTP via WhatsApp."
                : "Enter your credentials to securely access your dashboard."}
            </p>

            <div className="space-y-5">
              {isCustomerLogin ? (
                // Customer Login Form
                <>
                  <div>
                    <label htmlFor="customerPhone" className="block text-gray-700 text-sm font-semibold mb-2">
                      Phone Number (WhatsApp)
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                        </svg>
                      </div>
                      <input
                        type="tel"
                        id="customerPhone"
                        placeholder="Enter your WhatsApp number"
                        value={customerPhone}
                        onChange={(e) => setCustomerPhone(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900 placeholder-gray-400 transition-all"
                        disabled={loading || otpSent}
                      />
                    </div>
                  </div>

                  {otpSent && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                      <label htmlFor="customerOtp" className="block text-gray-700 text-sm font-semibold mb-2 mt-2">
                        Enter OTP
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <input
                          type="text"
                          id="customerOtp"
                          placeholder="Enter 6-digit OTP"
                          value={customerOtp}
                          onChange={(e) => setCustomerOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900 placeholder-gray-400 transition-all"
                          disabled={loading}
                        />
                      </div>
                      {otpTimer > 0 && (
                        <p className="text-xs text-gray-500 mt-2 font-medium">
                          OTP expires in <span className="text-teal-600">{otpTimer} seconds</span>
                        </p>
                      )}
                    </motion.div>
                  )}

                  <div className="flex justify-between items-center pt-2">
                    <button
                      onClick={otpSent ? sendCustomerOTP : undefined}
                      disabled={otpTimer > 0}
                      className="text-sm font-semibold text-teal-600 hover:text-teal-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {otpTimer > 0 ? `Resend OTP (${otpTimer}s)` : 'Resend OTP'}
                    </button>
                  </div>
                </>
              ) : (
                // Admin/Staff Login Form
                <>
                  <div>
                    <label htmlFor="username" className="block text-gray-700 text-sm font-semibold mb-2">
                      Username
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M10 2a5 5 0 00-5 5v2a2 2 0 00-2 2v5a2 2 0 002 2h10a2 2 0 002-2v-5a2 2 0 00-2-2H7V7a3 3 0 015.905-.75 1 1 0 001.937-.5A5.002 5.002 0 0010 2z" />
                        </svg>
                      </div>
                      <input
                        type="text"
                        id="username"
                        placeholder="Enter your username"
                        value={user.username}
                        onChange={(e) => setUser({ ...user, username: e.target.value })}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900 placeholder-gray-400 transition-all"
                        disabled={loading}
                      />
                    </div>
                  </div>
                  
                  <div>
                    <label htmlFor="password" className="block text-gray-700 text-sm font-semibold mb-2">
                      Password
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                          <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
                        </svg>
                      </div>
                      <input
                        type={showPassword ? "text" : "password"}
                        id="password"
                        placeholder="Enter your password"
                        value={user.password}
                        onChange={(e) => setUser({ ...user, password: e.target.value })}
                        className="w-full pl-10 pr-12 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-teal-500 text-gray-900 placeholder-gray-400 transition-all"
                        disabled={loading}
                      />
                      <button 
                        onClick={togglePasswordVisibility}
                        className="absolute inset-y-0 right-0 pr-4 flex items-center"
                        disabled={loading}
                        type="button"
                      >
                        {showPassword ? (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 hover:text-teal-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                          </svg>
                        ) : (
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5 text-gray-400 hover:text-teal-600 transition-colors" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                          </svg>
                        )}
                      </button>
                    </div>
                  </div>
                  
                  <div className="flex justify-between items-center pt-1">
                    <label className="flex items-center text-sm text-gray-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="form-checkbox h-4 w-4 rounded border-gray-300 text-teal-600 focus:ring-teal-500 transition-all cursor-pointer"
                        disabled={loading}
                      />
                      <span className="ml-2 select-none font-medium">Remember me</span>
                    </label>
                    <a href="#" className="text-sm font-semibold text-teal-600 hover:text-teal-800 transition-colors">Forgot password?</a>
                  </div>
                </>
              )}
              
              <button
                onClick={handleLogin}
                className="w-full bg-teal-600 hover:bg-teal-700 text-white font-bold py-3.5 rounded-xl shadow-[0_4px_14px_0_rgba(20,184,166,0.39)] hover:shadow-[0_6px_20px_rgba(20,184,166,0.23)] transition-all duration-300 disabled:opacity-60 disabled:cursor-not-allowed mt-4"
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
              
              {isCustomerLogin && (
                <div className="text-center mt-6">
                  <p className="text-gray-600 text-sm font-medium">
                    New User?{" "}
                    <Link 
                      to="/customer/register" 
                      className="text-teal-600 hover:text-teal-800 font-bold ml-1 transition-colors"
                    >
                      Register here
                    </Link>
                  </p>
                </div>
              )}
              
              <div className="text-center mt-6">
                <p className="text-gray-500 text-sm">
                  Need help? <a href="#" className="text-teal-600 hover:text-teal-800 font-semibold ml-1 transition-colors">Contact Support</a>
                </p>
              </div>
            </div>
          </div>
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
      `}</style>
    </div>
  );
};

export default Login;