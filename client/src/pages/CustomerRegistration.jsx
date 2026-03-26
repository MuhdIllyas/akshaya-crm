import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate, Link } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { FiUser, FiMail, FiPhone, FiMapPin, FiLock, FiCheck, FiAlertCircle, FiCalendar, FiHome, FiHash } from "react-icons/fi";

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
  const [availableDistricts, setAvailableDistricts] = useState([
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
      toast.error("Please enter a valid 12-digit Aadhaar number");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post("http://localhost:5000/api/customer/send-aadhaar-otp", {
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
        toast.warning("Aadhaar not found in database. Proceeding with registration...");
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
      const response = await axios.post("http://localhost:5000/api/customer/verify-aadhaar-otp", {
        aadhaar: formData.aadhaar.replace(/\s/g, ''),
        otp: otp
      });

      if (response.data.success) {
        setAadhaarVerified(true);
        setVerificationStep(3);
        toast.success("Aadhaar verified successfully!");
        
        // Pre-fill data if available from Aadhaar database
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
      toast.error("Please enter your full name");
      return;
    }
    if (!formData.primary_phone || formData.primary_phone.length !== 10) {
      toast.error("Please enter a valid 10-digit phone number");
      return;
    }
    if (!formData.address.trim()) {
      toast.error("Please enter your address");
      return;
    }
    if (!formData.pincode || formData.pincode.length !== 6) {
      toast.error("Please enter a valid 6-digit pincode");
      return;
    }
    if (!formData.district) {
      toast.error("Please select your district");
      return;
    }

    setLoading(true);
    try {
      const response = await axios.post("http://localhost:5000/api/customer/register", {
        ...formData,
        aadhaar: formData.aadhaar.replace(/\s/g, '')
      });

      if (response.data.success) {
        toast.success("Registration successful! Redirecting to login...");
        
        // Store customer data temporarily
        localStorage.setItem("temp_customer_phone", formData.primary_phone);
        
        // Redirect to login after delay
        setTimeout(() => {
          navigate("/customer/dashboard");
        }, 2000);
      }
    } catch (error) {
      const errorMsg = error.response?.data?.message || "Registration failed";
      if (errorMsg.includes("already exists")) {
        toast.info("Customer already registered. Redirecting to login...");
        setTimeout(() => {
          navigate("/");
        }, 2000);
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
      // Allow only numbers and limit length
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
    { number: 1, label: "Aadhaar & Phone", active: verificationStep === 1 },
    { number: 2, label: "OTP Verification", active: verificationStep === 2 },
    { number: 3, label: "Personal Details", active: verificationStep === 3 }
  ];

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-gray-50 to-blue-50 p-4">
      <ToastContainer
        position="top-right"
        autoClose={5000}
        hideProgressBar={false}
        newestOnTop={false}
        closeOnClick
        rtl={false}
        pauseOnFocusLoss
        draggable
        pauseOnHover
        theme="light"
      />
      
      <div className="w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100">
        <div className="md:flex">
          {/* Left Side - Branding & Info */}
          <div className="md:w-2/5 bg-gradient-to-b from-navy-900 to-navy-800 p-8 md:p-10 flex flex-col justify-between">
            <div className="z-10">
              <div className="flex flex-col items-center mb-8">
                <div className="bg-white p-4 rounded-2xl shadow-lg mb-6">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-16 w-16 text-navy-800" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="text-center">
                  <h1 className="text-3xl font-bold text-navy-600 mb-2">Akshaya Centre</h1>
                  <p className="text-navy-600 mb-2">Customer Registration</p>
                </div>
              </div>
              
              <div className="mt-8 bg-white/10 backdrop-blur-sm rounded-2xl p-6 border border-white/20">
                <h2 className="text-xl font-bold text-navy-600 mb-3">Why Register?</h2>
                <ul className="space-y-3">
                  <li className="flex items-start text-navy-600">
                    <FiCheck className="mt-1 mr-3 text-green-400 flex-shrink-0" />
                    <span>Fast-track service access</span>
                  </li>
                  <li className="flex items-start text-navy-600">
                    <FiCheck className="mt-1 mr-3 text-green-400 flex-shrink-0" />
                    <span>Digital service history</span>
                  </li>
                  <li className="flex items-start text-navy-600">
                    <FiCheck className="mt-1 mr-3 text-green-400 flex-shrink-0" />
                    <span>WhatsApp OTP login</span>
                  </li>
                  <li className="flex items-start text-navy-600">
                    <FiCheck className="mt-1 mr-3 text-green-400 flex-shrink-0" />
                    <span>Priority support</span>
                  </li>
                </ul>
              </div>
            </div>
            
            <div className="z-10 mt-8">
              <p className="text-navy-800 mb-2 text-sm text-center">
                Already registered?{" "}
                <Link to="/" className="text-blue-300 hover:text-white font-medium">
                  Login here
                </Link>
              </p>
              <p className="text-navy-800 mb-2 text-sm text-center mt-1">Akshaya e Centre Pukayur</p>
            </div>
          </div>

          {/* Right Side - Registration Form */}
          <div className="md:w-3/5 p-8 md:p-10">
            <div className="max-w-lg mx-auto">
              <h2 className="text-3xl font-bold text-gray-800 mb-2">New Customer Registration</h2>
              <p className="text-gray-600 mb-8">Complete these 3 simple steps to register</p>

              {/* Progress Steps */}
              <div className="flex justify-between mb-10 relative">
                {steps.map((step, index) => (
                  <div key={step.number} className="flex flex-col items-center z-10">
                    <div className={`w-12 h-12 rounded-full flex items-center justify-center mb-2 border-2 ${
                      step.active 
                        ? 'bg-navy-700 border-navy-700 text-white' 
                        : 'bg-white border-gray-300 text-gray-400'
                    }`}>
                      {step.number}
                    </div>
                    <span className={`text-sm font-medium ${
                      step.active ? 'text-navy-700' : 'text-gray-500'
                    }`}>
                      {step.label}
                    </span>
                  </div>
                ))}
                <div className="absolute top-6 left-12 right-12 h-0.5 bg-gray-200 -z-10"></div>
              </div>

              {/* Step 1: Aadhaar & Phone */}
              {verificationStep === 1 && (
                <div className="space-y-6 animate-fadeIn">
                  <div>
                    <label htmlFor="aadhaar" className="block text-gray-700 text-sm font-medium mb-2">
                      Aadhaar Number
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiHash className="h-5 w-5 text-gray-500" />
                      </div>
                      <input
                        type="text"
                        id="aadhaar"
                        name="aadhaar"
                        placeholder="XXXX XXXX XXXX"
                        value={formData.aadhaar}
                        onChange={handleChange}
                        maxLength={14}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent text-gray-700"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      Enter your 12-digit Aadhaar number. We'll verify it with UIDAI.
                    </p>
                  </div>

                  <div>
                    <label htmlFor="primary_phone" className="block text-gray-700 text-sm font-medium mb-2">
                      WhatsApp Mobile Number
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiPhone className="h-5 w-5 text-gray-500" />
                      </div>
                      <input
                        type="tel"
                        id="primary_phone"
                        name="primary_phone"
                        placeholder="10-digit mobile number"
                        value={formData.primary_phone}
                        onChange={handleChange}
                        maxLength={10}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent text-gray-700"
                      />
                    </div>
                    <p className="text-xs text-gray-500 mt-2">
                      OTP will be sent to this number via WhatsApp
                    </p>
                  </div>

                  <button
                    onClick={sendAadhaarOTP}
                    disabled={loading || !validateAadhaar(formData.aadhaar) || formData.primary_phone.length !== 10}
                    className="w-full bg-navy-700 hover:bg-navy-800 text-white font-medium py-3 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Verifying...
                      </span>
                    ) : (
                      "Send OTP for Verification"
                    )}
                  </button>
                </div>
              )}

              {/* Step 2: OTP Verification */}
              {verificationStep === 2 && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="bg-blue-50 border border-blue-200 rounded-xl p-5">
                    <div className="flex items-start">
                      <FiAlertCircle className="text-blue-500 text-xl mr-3 mt-0.5 flex-shrink-0" />
                      <div>
                        <h4 className="font-medium text-blue-800 mb-1">OTP Sent Successfully</h4>
                        <p className="text-blue-700 text-sm">
                          We've sent a 6-digit OTP to the WhatsApp number linked with Aadhaar ending in{" "}
                          <span className="font-bold">{formData.aadhaar.slice(-4)}</span>
                        </p>
                      </div>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="otp" className="block text-gray-700 text-sm font-medium mb-2">
                      Enter 6-digit OTP
                    </label>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <FiLock className="h-5 w-5 text-gray-500" />
                      </div>
                      <input
                        type="text"
                        id="otp"
                        placeholder="Enter OTP"
                        value={otp}
                        onChange={(e) => setOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent text-gray-700 text-center text-xl tracking-widest"
                      />
                    </div>
                    {otpTimer > 0 && (
                      <p className="text-sm text-gray-500 mt-2">
                        OTP expires in {Math.floor(otpTimer / 60)}:{String(otpTimer % 60).padStart(2, '0')}
                      </p>
                    )}
                  </div>

                  <div className="flex justify-between">
                    <button
                      onClick={resendOTP}
                      disabled={otpTimer > 0}
                      className="text-sm text-navy-600 hover:text-navy-800 transition-colors disabled:opacity-50"
                    >
                      {otpTimer > 0 ? `Resend OTP (${otpTimer}s)` : 'Resend OTP'}
                    </button>
                    <button
                      onClick={() => setVerificationStep(1)}
                      className="text-sm text-gray-600 hover:text-gray-800"
                    >
                      Change Aadhaar
                    </button>
                  </div>

                  <button
                    onClick={verifyAadhaarOTP}
                    disabled={loading || otp.length !== 6}
                    className="w-full bg-navy-700 hover:bg-navy-800 text-white font-medium py-3 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 disabled:opacity-50"
                  >
                    {loading ? (
                      <span className="flex items-center justify-center">
                        <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                        </svg>
                        Verifying OTP...
                      </span>
                    ) : (
                      "Verify OTP & Continue"
                    )}
                  </button>
                </div>
              )}

              {/* Step 3: Personal Details */}
              {verificationStep === 3 && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="flex items-center justify-between mb-6">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center mr-3">
                        <FiCheck className="text-green-600 text-xl" />
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-800">Aadhaar Verified</h3>
                        <p className="text-sm text-gray-600">Ending with {formData.aadhaar.slice(-4)}</p>
                      </div>
                    </div>
                    <button
                      onClick={() => setVerificationStep(1)}
                      className="text-sm text-navy-600 hover:text-navy-800"
                    >
                      Change
                    </button>
                  </div>

                  <div className="grid md:grid-cols-2 gap-6">
                    <div>
                      <label htmlFor="name" className="block text-gray-700 text-sm font-medium mb-2">
                        Full Name *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FiUser className="h-5 w-5 text-gray-500" />
                        </div>
                        <input
                          type="text"
                          id="name"
                          name="name"
                          placeholder="Enter your full name"
                          value={formData.name}
                          onChange={handleChange}
                          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent text-gray-700"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="email" className="block text-gray-700 text-sm font-medium mb-2">
                        Email Address
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FiMail className="h-5 w-5 text-gray-500" />
                        </div>
                        <input
                          type="email"
                          id="email"
                          name="email"
                          placeholder="email@example.com"
                          value={formData.email}
                          onChange={handleChange}
                          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent text-gray-700"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label htmlFor="address" className="block text-gray-700 text-sm font-medium mb-2">
                      Complete Address *
                    </label>
                    <div className="relative">
                      <div className="absolute top-3 left-3 flex items-start pointer-events-none">
                        <FiHome className="h-5 w-5 text-gray-500" />
                      </div>
                      <textarea
                        id="address"
                        name="address"
                        placeholder="House name, Street, Landmark..."
                        value={formData.address}
                        onChange={handleChange}
                        rows="3"
                        className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent text-gray-700 resize-none"
                      />
                    </div>
                  </div>

                  <div className="grid md:grid-cols-3 gap-6">
                    <div>
                      <label htmlFor="district" className="block text-gray-700 text-sm font-medium mb-2">
                        District *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FiMapPin className="h-5 w-5 text-gray-500" />
                        </div>
                        <select
                          id="district"
                          name="district"
                          value={formData.district}
                          onChange={handleChange}
                          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent text-gray-700 appearance-none"
                        >
                          <option value="">Select District</option>
                          {availableDistricts.map(district => (
                            <option key={district} value={district}>{district}</option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label htmlFor="pincode" className="block text-gray-700 text-sm font-medium mb-2">
                        Pincode *
                      </label>
                      <div className="relative">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                          <FiMapPin className="h-5 w-5 text-gray-500" />
                        </div>
                        <input
                          type="text"
                          id="pincode"
                          name="pincode"
                          placeholder="6-digit pincode"
                          value={formData.pincode}
                          onChange={handleChange}
                          maxLength={6}
                          className="w-full pl-10 pr-4 py-3 bg-white border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-navy-500 focus:border-transparent text-gray-700"
                        />
                      </div>
                    </div>

                    <div>
                      <label htmlFor="state" className="block text-gray-700 text-sm font-medium mb-2">
                        State
                      </label>
                      <input
                        type="text"
                        id="state"
                        name="state"
                        value={formData.state}
                        onChange={handleChange}
                        className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl text-gray-700 cursor-not-allowed"
                        readOnly
                      />
                    </div>
                  </div>

                  <div className="pt-4 border-t border-gray-200">
                    <div className="flex items-start mb-6">
                      <input
                        type="checkbox"
                        id="consent"
                        className="mt-1 mr-3 rounded focus:ring-navy-500"
                      />
                      <label htmlFor="consent" className="text-sm text-gray-600">
                        I agree to share my Aadhaar information for verification purposes as per the Aadhaar Act, 2016.
                        I consent to receive OTP and service updates via WhatsApp.
                      </label>
                    </div>

                    <div className="flex gap-4">
                      <button
                        onClick={() => setVerificationStep(2)}
                        className="flex-1 bg-gray-100 hover:bg-gray-200 text-gray-800 font-medium py-3 rounded-xl transition-all duration-300"
                      >
                        Back
                      </button>
                      <button
                        onClick={handleSubmit}
                        disabled={loading}
                        className="flex-1 bg-navy-700 hover:bg-navy-800 text-white font-medium py-3 rounded-xl shadow-md hover:shadow-lg transition-all duration-300 disabled:opacity-50"
                      >
                        {loading ? (
                          <span className="flex items-center justify-center">
                            <svg className="animate-spin h-5 w-5 mr-2 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                            </svg>
                            Registering...
                          </span>
                        ) : (
                          "Complete Registration"
                        )}
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {/* Bottom Links */}
              <div className="mt-8 pt-6 border-t border-gray-200 text-center">
                <p className="text-gray-600 text-sm">
                  By registering, you agree to our{" "}
                  <a href="#" className="text-navy-600 hover:text-navy-800 font-medium">Terms of Service</a> and{" "}
                  <a href="#" className="text-navy-600 hover:text-navy-800 font-medium">Privacy Policy</a>
                </p>
                <p className="text-gray-600 text-sm mt-2">
                  Already have an account?{" "}
                  <Link to="/" className="text-navy-600 hover:text-navy-800 font-medium">
                    Sign in here
                  </Link>
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
        .text-navy-600 { color: #2c5282; }
        .focus\\:ring-navy-500:focus { --tw-ring-color: #1e3a5f; }
        
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        .animate-fadeIn {
          animation: fadeIn 0.3s ease-out;
        }
      `}</style>
    </div>
  );
};

export default CustomerRegistration;