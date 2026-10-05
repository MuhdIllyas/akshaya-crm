// src/pages/CustomerRegistration.jsx
import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { motion, AnimatePresence } from "framer-motion";
import { 
  FiUser, FiMail, FiPhone, FiMapPin, FiLock, FiShield,
  FiCheck, FiAlertCircle, FiHome, FiHash, FiArrowRight, FiArrowLeft
} from "react-icons/fi";
import { FaWhatsapp } from "react-icons/fa";

const CustomerRegistration = () => {
  const [formData, setFormData] = useState({
    aadhaar: "",
    primary_phone: "",
    email: "",
    name: "",
    address: "",
    pincode: "",
    district: "",
    state: "Kerala"
  });

  const [loading, setLoading] = useState(false);
  const [otpSent, setOtpSent] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpTimer, setOtpTimer] = useState(0);
  const [verificationStep, setVerificationStep] = useState(1); // 1: Aadhaar, 2: OTP, 3: Details
  const [aadhaarVerified, setAadhaarVerified] = useState(false);
  
  const [availableDistricts] = useState([
    "Thiruvananthapuram", "Kollam", "Pathanamthitta", "Alappuzha", 
    "Kottayam", "Idukki", "Ernakulam", "Thrissur", 
    "Palakkad", "Malappuram", "Kozhikode", "Wayanad", 
    "Kannur", "Kasaragod"
  ]);
  
  const navigate = useNavigate();

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

  // Format Aadhaar number with spaces
  const formatAadhaar = (value) => {
    const cleaned = value.replace(/\D/g, '');
    if (cleaned.length <= 4) return cleaned;
    if (cleaned.length <= 8) return `${cleaned.slice(0, 4)} ${cleaned.slice(4)}`;
    return `${cleaned.slice(0, 4)} ${cleaned.slice(4, 8)} ${cleaned.slice(8, 12)}`;
  };

  // Validate Aadhaar (basic 12-digit check)
  const validateAadhaar = (aadhaar) => {
    const cleaned = aadhaar.replace(/\s/g, '');
    return cleaned.length === 12 && /^\d+$/.test(cleaned);
  };

  // Send OTP for Aadhaar verification
  const sendAadhaarOTP = async () => {
    if (!validateAadhaar(formData.aadhaar)) {
      toast.error("Please enter a valid 12-digit ID number");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/customer/send-aadhaar-otp`, {
        aadhaar: formData.aadhaar.replace(/\s/g, ''),
        phone: formData.primary_phone
      });

      if (response.data.success) {
        setOtpSent(true);
        setOtpTimer(120); // 2 minutes
        setVerificationStep(2);
        toast.success("OTP sent to your registered mobile number");
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || "Failed to send OTP";
      if (errorMsg.includes("not found")) {
        toast.warning("ID not found in database. Proceeding with manual registration...");
        setVerificationStep(3); // Skip to details entry
        setAadhaarVerified(true);
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  // Verify Aadhaar OTP
  const verifyAadhaarOTP = async () => {
    if (!otp || otp.length !== 6) {
      toast.error("Please enter 6-digit OTP");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/customer/verify-aadhaar-otp`, {
        aadhaar: formData.aadhaar.replace(/\s/g, ''),
        otp: otp
      });

      if (response.data.success) {
        setAadhaarVerified(true);
        setVerificationStep(3);
        toast.success("Verification successful!");
        
        // Pre-fill data if available from database
        if (response.data.customerData) {
          setFormData(prev => ({
            ...prev,
            name: response.data.customerData.name || prev.name,
            address: response.data.customerData.address || prev.address,
            district: response.data.customerData.district || prev.district,
            pincode: response.data.customerData.pincode || prev.pincode
          }));
        }
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Invalid OTP");
    } finally {
      setLoading(false);
    }
  };

  // Handle form submission
  const handleSubmit = async () => {
    // Validate all fields
    if (!formData.name.trim()) {
      toast.error("Please enter your full name"); return;
    }
    if (!formData.primary_phone || formData.primary_phone.length !== 10) {
      toast.error("Please enter a valid 10-digit phone number"); return;
    }
    if (!formData.address.trim()) {
      toast.error("Please enter your address"); return;
    }
    if (!formData.pincode || formData.pincode.length !== 6) {
      toast.error("Please enter a valid 6-digit pincode"); return;
    }
    if (!formData.district) {
      toast.error("Please select your district"); return;
    }

    setLoading(true);
    try {
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/customer/register`, {
        ...formData,
        aadhaar: formData.aadhaar.replace(/\s/g, '')
      });

      if (response.data.success) {
        toast.success("Registration successful! Redirecting to dashboard...");
        localStorage.setItem("temp_customer_phone", formData.primary_phone);
        
        setTimeout(() => {
          navigate("/customer/dashboard");
        }, 2000);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || "Registration failed";
      if (errorMsg.includes("already exists")) {
        toast.info("Customer already registered. Redirecting to login...");
        setTimeout(() => navigate("/login"), 2000);
      } else {
        toast.error(errorMsg);
      }
    } finally {
      setLoading(false);
    }
  };

  // Resend OTP
  const resendOTP = async () => {
    if (otpTimer > 0) return;
    await sendAadhaarOTP();
  };

  // Handle input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    
    if (name === "aadhaar") {
      setFormData(prev => ({ ...prev, [name]: formatAadhaar(value) }));
    } else if (name === "primary_phone" || name === "pincode") {
      const numbers = value.replace(/\D/g, '');
      if (name === "primary_phone" && numbers.length <= 10) {
        setFormData(prev => ({ ...prev, [name]: numbers }));
      } else if (name === "pincode" && numbers.length <= 6) {
        setFormData(prev => ({ ...prev, [name]: numbers }));
      }
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  // Progress steps
  const steps = [
    { number: 1, label: "Verification" },
    { number: 2, label: "Secure OTP" },
    { number: 3, label: "Profile Details" }
  ];

  // Animation variants
  const slideVariants = {
    initial: { opacity: 0, x: 20 },
    animate: { opacity: 1, x: 0, transition: { duration: 0.4 } },
    exit: { opacity: 0, x: -20, transition: { duration: 0.3 } }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans selection:bg-teal-500 selection:text-white relative overflow-hidden">
      
      {/* Background Decorators matching Login/Home */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-teal-500/10 blur-[100px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-5xl z-10 py-6">
        
        {/* Navigation / Header */}
        <div className="mb-6 flex items-center justify-between">
          <Link to="/" className="flex items-center group">
            <div className="bg-white p-1.5 rounded-xl shadow-sm border border-gray-100 group-hover:shadow-md transition-all duration-300">
              <img src="/logo-light.png" alt="Akshaya Sahayi" className="h-8 w-8 object-contain" />
            </div>
            <div className="ml-3 hidden sm:block">
              <h1 className="text-xl font-bold text-navy-900 leading-tight">
                Akshaya <span className="text-teal-600">Sahayi</span>
              </h1>
            </div>
          </Link>

          <Link to="/login" className="flex items-center text-sm font-bold text-gray-600 hover:text-teal-600 transition-colors bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-200">
            <FiArrowLeft className="mr-2" /> Back to Login
          </Link>
        </div>

        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-200 flex flex-col md:flex-row">
          
          {/* LEFT SIDE - Branding Panel */}
          <div className="md:w-2/5 bg-gradient-to-b from-navy-900 to-navy-800 p-8 md:p-12 flex flex-col justify-between relative overflow-hidden text-white">
            {/* Pattern Overlay */}
            <div className="absolute inset-0 opacity-10 pointer-events-none">
              <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path d="M0,0 L100,0 L100,100 Z" fill="#fff" />
                <circle cx="20" cy="80" r="15" fill="#fff" />
                <circle cx="80" cy="20" r="10" fill="#fff" />
              </svg>
            </div>

            <div className="z-10">
              <div className="inline-flex items-center px-3 py-1 bg-white/10 border border-white/20 rounded-full mb-6 text-xs font-bold tracking-wider text-teal-300">
                CITIZEN PORTAL
              </div>
              <h1 className="text-3xl md:text-4xl font-extrabold mb-4 leading-tight">
                Create your <br/><span className="text-teal-400">Digital Profile</span>
              </h1>
              <p className="text-navy-200 text-sm leading-relaxed mb-8">
                Register once to track applications, download certificates, and book services online seamlessly.
              </p>
              
              <div className="space-y-4">
                <div className="flex items-start">
                  <div className="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center mr-4 border border-teal-500/30 shrink-0">
                    <FiCheck className="text-teal-400" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">Fast-track services</h4>
                    <p className="text-xs text-navy-300 mt-0.5">Skip the data-entry queue at the centre.</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center mr-4 border border-teal-500/30 shrink-0">
                    <FiCheck className="text-teal-400" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">WhatsApp Integration</h4>
                    <p className="text-xs text-navy-300 mt-0.5">Get live status updates directly to your phone.</p>
                  </div>
                </div>
                <div className="flex items-start">
                  <div className="w-8 h-8 rounded-full bg-teal-500/20 flex items-center justify-center mr-4 border border-teal-500/30 shrink-0">
                    <FiCheck className="text-teal-400" />
                  </div>
                  <div>
                    <h4 className="font-bold text-sm">Digital Document Vault</h4>
                    <p className="text-xs text-navy-300 mt-0.5">Access your finished certificates anytime.</p>
                  </div>
                </div>
              </div>
            </div>
            
            <div className="z-10 mt-10 pt-6 border-t border-white/10">
              <p className="text-navy-300 text-sm">
                Already registered?{" "}
                <Link to="/login" className="text-white hover:text-teal-300 font-bold transition-colors">
                  Sign in here
                </Link>
              </p>
            </div>
          </div>

          {/* RIGHT SIDE - Interactive Form */}
          <div className="md:w-3/5 p-8 md:p-12 bg-white flex flex-col justify-center">
            <div className="max-w-md w-full mx-auto">
              
              {/* Dynamic Header */}
              <div className="mb-8">
                <h2 className="text-2xl font-bold text-navy-900 mb-2">
                  {verificationStep === 1 && "Identity Verification"}
                  {verificationStep === 2 && "Secure Verification"}
                  {verificationStep === 3 && "Personal Details"}
                </h2>
                <p className="text-gray-500 text-sm">
                  {verificationStep === 1 && "Enter your details to initiate registration."}
                  {verificationStep === 2 && "Please verify your WhatsApp number."}
                  {verificationStep === 3 && "Complete your profile to finish setup."}
                </p>
              </div>

              {/* Progress Steps Indicator */}
              <div className="flex justify-between mb-10 relative">
                <div className="absolute top-1/2 left-0 right-0 h-0.5 bg-gray-100 -translate-y-1/2 z-0"></div>
                
                {/* Active Line Fill */}
                <div 
                  className="absolute top-1/2 left-0 h-0.5 bg-teal-500 -translate-y-1/2 z-0 transition-all duration-500"
                  style={{ width: `${((verificationStep - 1) / 2) * 100}%` }}
                ></div>

                {steps.map((step, index) => {
                  const isActive = step.number === verificationStep;
                  const isPassed = step.number < verificationStep;
                  
                  return (
                    <div key={step.number} className="flex flex-col items-center z-10 bg-white px-2">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold transition-all duration-300 ${
                        isActive 
                          ? 'bg-teal-500 text-white shadow-[0_0_15px_rgba(20,184,166,0.4)] scale-110' 
                          : isPassed 
                            ? 'bg-navy-900 text-white' 
                            : 'bg-gray-100 text-gray-400 border border-gray-200'
                      }`}>
                        {isPassed ? <FiCheck /> : step.number}
                      </div>
                      <span className={`text-[10px] uppercase tracking-wider font-bold mt-2 hidden sm:block ${
                        isActive ? 'text-teal-600' : isPassed ? 'text-navy-900' : 'text-gray-400'
                      }`}>
                        {step.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Form Areas with Animation */}
              <AnimatePresence mode="wait">
                
                {/* Step 1: ID & Phone */}
                {verificationStep === 1 && (
                  <motion.div key="step1" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="space-y-5">
                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">Government ID (Aadhaar) *</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <FiHash className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="text"
                          name="aadhaar"
                          placeholder="XXXX XXXX XXXX"
                          value={formData.aadhaar}
                          onChange={handleChange}
                          maxLength={14}
                          className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-gray-900 font-medium"
                        />
                      </div>
                      <p className="text-xs text-gray-500 mt-2 ml-1 flex items-center">
                        <FiShield className="mr-1 inline text-teal-600" /> Securely verified via official portals.
                      </p>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2">WhatsApp Mobile Number *</label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                          <FaWhatsapp className="h-5 w-5 text-gray-400" />
                        </div>
                        <input
                          type="tel"
                          name="primary_phone"
                          placeholder="10-digit mobile number"
                          value={formData.primary_phone}
                          onChange={handleChange}
                          maxLength={10}
                          className="w-full pl-11 pr-4 py-3.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent transition-all text-gray-900 font-medium"
                        />
                      </div>
                    </div>

                    <button
                      onClick={sendAadhaarOTP}
                      disabled={loading || !validateAadhaar(formData.aadhaar) || formData.primary_phone.length !== 10}
                      className="w-full mt-4 bg-navy-900 hover:bg-navy-800 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none disabled:cursor-not-allowed flex justify-center items-center"
                    >
                      {loading ? (
                        <span className="flex items-center">
                          <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          Requesting OTP...
                        </span>
                      ) : (
                        <>Send Verification OTP <FiArrowRight className="ml-2" /></>
                      )}
                    </button>
                  </motion.div>
                )}

                {/* Step 2: OTP Verification */}
                {verificationStep === 2 && (
                  <motion.div key="step2" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="space-y-6">
                    <div className="bg-teal-50 border border-teal-100 rounded-xl p-4 flex items-start">
                      <FiCheckCircle className="text-teal-500 text-xl mr-3 mt-0.5 shrink-0" />
                      <div>
                        <h4 className="font-bold text-teal-900 text-sm mb-1">OTP Sent via WhatsApp/SMS</h4>
                        <p className="text-teal-700 text-xs leading-relaxed">
                          We sent a 6-digit code to the number linked with ID ending in <span className="font-bold">{formData.aadhaar.slice(-4)}</span>
                        </p>
                      </div>
                    </div>

                    <div>
                      <label className="block text-sm font-bold text-gray-700 mb-2 text-center">Enter 6-digit Security Code</label>
                      <input
                        type="text"
                        placeholder="• • • • • •"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="w-full px-4 py-4 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-teal-500 text-gray-900 text-center text-3xl tracking-[1em] font-black placeholder-gray-300 transition-all"
                      />
                      
                      <div className="flex justify-between items-center mt-3 px-1">
                        <button onClick={() => setVerificationStep(1)} className="text-xs font-bold text-gray-500 hover:text-navy-900 transition-colors">
                          ← Change Details
                        </button>
                        <button onClick={resendOTP} disabled={otpTimer > 0} className={`text-xs font-bold transition-colors ${otpTimer > 0 ? 'text-gray-400' : 'text-teal-600 hover:text-teal-800'}`}>
                          {otpTimer > 0 ? `Resend Code in ${Math.floor(otpTimer / 60)}:${String(otpTimer % 60).padStart(2, '0')}` : 'Resend Code'}
                        </button>
                      </div>
                    </div>

                    <button
                      onClick={verifyAadhaarOTP}
                      disabled={loading || otp.length !== 6}
                      className="w-full bg-navy-900 hover:bg-navy-800 text-white font-bold py-3.5 rounded-xl shadow-lg transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none flex justify-center items-center mt-4"
                    >
                      {loading ? (
                        <span className="flex items-center">
                          <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                          Verifying...
                        </span>
                      ) : (
                        "Verify & Continue"
                      )}
                    </button>
                  </motion.div>
                )}

                {/* Step 3: Personal Details */}
                {verificationStep === 3 && (
                  <motion.div key="step3" variants={slideVariants} initial="initial" animate="animate" exit="exit" className="space-y-5">
                    
                    <div className="bg-green-50 border border-green-100 rounded-xl p-3 flex items-center justify-between mb-2">
                      <div className="flex items-center">
                        <div className="w-8 h-8 bg-green-500 text-white rounded-full flex items-center justify-center mr-3"><FiCheck /></div>
                        <div>
                          <p className="text-xs font-bold text-green-900">ID Verified Successfully</p>
                          <p className="text-[10px] text-green-700">Ending with {formData.aadhaar.slice(-4)}</p>
                        </div>
                      </div>
                      <button onClick={() => setVerificationStep(1)} className="text-xs font-bold text-gray-500 hover:text-navy-900 underline">Change</button>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5">Full Name *</label>
                        <div className="relative">
                          <FiUser className="absolute top-3 left-3 text-gray-400" />
                          <input type="text" name="name" placeholder="Legal Name" value={formData.name} onChange={handleChange} className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none text-sm font-medium" />
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5">Email Address</label>
                        <div className="relative">
                          <FiMail className="absolute top-3 left-3 text-gray-400" />
                          <input type="email" name="email" placeholder="Optional" value={formData.email} onChange={handleChange} className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none text-sm font-medium" />
                        </div>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-bold text-gray-700 mb-1.5">Complete Address *</label>
                      <div className="relative">
                        <FiHome className="absolute top-3 left-3 text-gray-400" />
                        <textarea name="address" placeholder="House name, Street, Landmark..." value={formData.address} onChange={handleChange} rows="2" className="w-full pl-9 pr-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none text-sm font-medium resize-none" />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5">District *</label>
                        <select name="district" value={formData.district} onChange={handleChange} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none text-sm font-medium text-gray-700">
                          <option value="">Select</option>
                          {availableDistricts.map(d => <option key={d} value={d}>{d}</option>)}
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-bold text-gray-700 mb-1.5">Pincode *</label>
                        <input type="text" name="pincode" placeholder="6-digit" value={formData.pincode} onChange={handleChange} maxLength={6} className="w-full px-3 py-2.5 bg-gray-50 border border-gray-200 rounded-lg focus:ring-2 focus:ring-teal-500 focus:outline-none text-sm font-medium" />
                      </div>
                    </div>

                    <div className="pt-4 border-t border-gray-100 mt-2">
                      <div className="flex items-start mb-5 bg-gray-50 p-3 rounded-lg border border-gray-100">
                        <input type="checkbox" id="consent" defaultChecked className="mt-0.5 mr-3 rounded text-teal-500 focus:ring-teal-500" />
                        <label htmlFor="consent" className="text-[10px] text-gray-500 leading-relaxed">
                          I consent to the verification of my ID as per applicable regulations. I agree to receive service updates, documents, and OTPs via WhatsApp and SMS from Akshaya Sahayi.
                        </label>
                      </div>

                      <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="w-full bg-teal-500 hover:bg-teal-600 text-white font-bold py-3.5 rounded-xl shadow-[0_4px_14px_0_rgba(20,184,166,0.39)] transition-all transform hover:-translate-y-0.5 disabled:opacity-50 disabled:transform-none flex justify-center items-center"
                      >
                        {loading ? (
                          <span className="flex items-center">
                            <svg className="animate-spin h-5 w-5 mr-3" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                            Creating Profile...
                          </span>
                        ) : (
                          "Complete Registration"
                        )}
                      </button>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CustomerRegistration;