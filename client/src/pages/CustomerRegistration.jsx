// src/pages/CustomerRegistration.jsx
import { useState, useEffect } from "react";
import axios from "axios";
import { getPreferredCentreId, saveCustomerSession } from "@/tenancy/centres";
import { useNavigate, Link } from "react-router-dom";
import { toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  FiUser, FiMail, FiShield, FiCheckCircle, FiCheck, FiHome, FiHash, FiArrowRight
} from "react-icons/fi";
import { FaWhatsapp } from "react-icons/fa";
import AuthShell, { Field, OtpInput, Spinner, pillPrimary, pillSecondary } from "../components/login/AuthShell";

// Benefits that rotate in the brand card, like the services list on the login page
const benefits = [
  { title: "Fast-track services", text: "Skip the data-entry queue at the centre." },
  { title: "WhatsApp Integration", text: "Get live status updates directly to your phone." },
  { title: "Digital Document Vault", text: "Access your finished certificates anytime." },
];

const steps = [
  { number: 1, label: "Verification" },
  { number: 2, label: "Secure OTP" },
  { number: 3, label: "Profile Details" },
];

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
  // Bumped on every code sent, so the OTP boxes start empty for a new code.
  const [otpRound, setOtpRound] = useState(0);
  const [otpTimer, setOtpTimer] = useState(0);
  const [verificationStep, setVerificationStep] = useState(1); // 1: Aadhaar, 2: OTP, 3: Details
  const [aadhaarVerified, setAadhaarVerified] = useState(false);
  // Proof from the server that the phone and ID were verified; /register needs it.
  const [registrationToken, setRegistrationToken] = useState("");
  const [benefitIndex, setBenefitIndex] = useState(0);

  const [availableDistricts] = useState([
    "Thiruvananthapuram", "Kollam", "Pathanamthitta", "Alappuzha",
    "Kottayam", "Idukki", "Ernakulam", "Thrissur",
    "Palakkad", "Malappuram", "Kozhikode", "Wayanad",
    "Kannur", "Kasaragod"
  ]);

  const navigate = useNavigate();

  // Rotate the benefits in the brand card every 3 seconds
  useEffect(() => {
    const interval = setInterval(() => setBenefitIndex((i) => (i + 1) % benefits.length), 3000);
    return () => clearInterval(interval);
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
        setOtpRound((n) => n + 1);
        setOtp(""); // the OTP boxes start empty each time a code is sent
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
        phone: formData.primary_phone,
        otp: otp
      });

      if (response.data.success) {
        setRegistrationToken(response.data.registration_token || "");
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
        aadhaar: formData.aadhaar.replace(/\s/g, ''),
        registration_token: registrationToken,
        centre_id: getPreferredCentreId() || undefined // the centre link/QR they came through
      });

      if (response.data.success) {
        toast.success(response.data.existing
          ? "You are already registered. Signing you in..."
          : "Registration successful! Redirecting to dashboard...");
        localStorage.setItem("temp_customer_phone", formData.primary_phone);
        // Registering signs the customer in (the phone was just verified).
        let next = "/customer/dashboard";
        if (response.data.token) next = saveCustomerSession(response.data, formData.name);

        setTimeout(() => {
          navigate(next);
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

  const stepOneReady = validateAadhaar(formData.aadhaar) && formData.primary_phone.length === 10;

  const titles = {
    1: ["Identity Verification", "Enter your details to initiate registration."],
    2: ["Secure Verification", "Please verify your WhatsApp number."],
    3: ["Personal Details", "Complete your profile to finish setup."],
  };

  const brandCard = (
    <>
      <h2 className="text-lg font-bold text-white">
        Create your <span className="text-teal-300">Digital Profile</span>
      </h2>
      <p className="mt-1.5 text-sm leading-relaxed text-white/80">
        Register once to track applications, download certificates, and book services online seamlessly.
      </p>

      {/* Rotating benefits */}
      <div className="mt-4 flex min-h-[3.75rem] items-center overflow-hidden border-t border-white/15 pt-3">
        <div key={benefitIndex} className="animate-fade-slide flex items-start gap-2">
          <FiCheck className="mt-0.5 h-4 w-4 shrink-0 text-teal-300" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold leading-snug text-white">{benefits[benefitIndex].title}</p>
            <p className="text-xs text-white/70">{benefits[benefitIndex].text}</p>
          </div>
        </div>
      </div>
    </>
  );

  const submitStep = (e) => {
    e.preventDefault();
    if (loading) return;
    if (verificationStep === 1 && stepOneReady) sendAadhaarOTP();
    else if (verificationStep === 2 && otp.length === 6) verifyAadhaarOTP();
    else if (verificationStep === 3) handleSubmit();
  };

  return (
    <AuthShell brandCard={brandCard}>
      <form className="my-auto w-full max-w-sm py-8 md:mx-auto xl:max-w-md" onSubmit={submitStep}>
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Customer Registration</p>
        <h1 className="mt-2 text-3xl font-bold text-slate-900 sm:text-4xl">
          {titles[verificationStep][0]}
          <span className="text-teal-500">.</span>
        </h1>
        <p className="mt-2 text-sm text-slate-500">{titles[verificationStep][1]}</p>

        {/* Step indicator */}
        <ol className="mt-6 flex items-center gap-2" aria-label="Registration progress">
          {steps.map((step, index) => {
            const isActive = step.number === verificationStep;
            const isPassed = step.number < verificationStep;
            return (
              <li key={step.number} className="flex flex-1 items-center gap-2" aria-current={isActive ? "step" : undefined}>
                <span
                  className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                    isActive
                      ? "bg-teal-600 text-white shadow-[0_0_0_4px_rgba(20,184,166,0.18)]"
                      : isPassed
                        ? "bg-teal-50 text-teal-700"
                        : "bg-slate-100 text-slate-400"
                  }`}
                >
                  {isPassed ? <FiCheck aria-hidden="true" /> : step.number}
                </span>
                <span className={`hidden text-xs font-semibold sm:inline ${isActive ? "text-slate-900" : "text-slate-400"}`}>
                  {step.label}
                </span>
                {index < steps.length - 1 && (
                  <span className={`h-0.5 flex-1 rounded-full ${isPassed ? "bg-teal-500" : "bg-slate-200"}`} />
                )}
              </li>
            );
          })}
        </ol>

        {/* Step 1: ID & Phone */}
        {verificationStep === 1 && (
          <div key="step1" className="animate-otp-in mt-7 space-y-3">
            <Field
              id="aadhaar"
              name="aadhaar"
              label="Government ID (Aadhaar) *"
              icon={FiHash}
              type="text"
              inputMode="numeric"
              placeholder="XXXX XXXX XXXX"
              value={formData.aadhaar}
              onChange={handleChange}
              maxLength={14}
              disabled={loading}
            />
            <p className="flex items-center gap-1 px-1 text-xs text-slate-500">
              <FiShield className="text-teal-600" aria-hidden="true" /> Securely verified via official portals.
            </p>
            <Field
              id="primary_phone"
              name="primary_phone"
              label="WhatsApp Mobile Number *"
              icon={FaWhatsapp}
              type="tel"
              inputMode="numeric"
              autoComplete="tel"
              placeholder="10-digit mobile number"
              value={formData.primary_phone}
              onChange={handleChange}
              maxLength={10}
              disabled={loading}
            />

            <div className="flex gap-3 pt-4">
              <Link to="/login" className={`${pillSecondary} flex items-center justify-center`}>
                Back to Login
              </Link>
              <button type="submit" disabled={loading || !stepOneReady} className={`${pillPrimary} flex items-center justify-center`}>
                {loading ? <><Spinner />Requesting OTP...</> : <>Send OTP <FiArrowRight className="ml-2" aria-hidden="true" /></>}
              </button>
            </div>
          </div>
        )}

        {/* Step 2: OTP Verification */}
        {verificationStep === 2 && (
          <div key="step2" className="animate-otp-in mt-7 space-y-4">
            <div className="flex items-start gap-3 rounded-xl border border-teal-100 bg-teal-50 p-4">
              <FiCheckCircle className="mt-0.5 shrink-0 text-xl text-teal-600" aria-hidden="true" />
              <div>
                <p className="text-sm font-bold text-teal-900">OTP Sent via WhatsApp/SMS</p>
                <p className="text-xs leading-relaxed text-teal-700">
                  We sent a 6-digit code to the number linked with ID ending in{" "}
                  <span className="font-bold">{formData.aadhaar.slice(-4)}</span>
                </p>
              </div>
            </div>

            <div>
              <p className="mb-2 text-xs font-medium text-slate-500">Enter 6-digit Security Code</p>
              <OtpInput key={otpRound} onChange={setOtp} disabled={loading} />
              <div className="mt-3 flex items-center justify-between px-1">
                <p className="text-xs font-medium text-slate-500">
                  {otpTimer > 0 ? <>Code expires in <span className="text-teal-600">{Math.floor(otpTimer / 60)}:{String(otpTimer % 60).padStart(2, '0')}</span></> : "Didn't get the code?"}
                </p>
                <button
                  type="button"
                  onClick={resendOTP}
                  disabled={otpTimer > 0 || loading}
                  className="text-xs font-semibold text-teal-600 transition-colors hover:text-teal-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  Resend Code
                </button>
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setVerificationStep(1)} disabled={loading} className={pillSecondary}>
                Change Details
              </button>
              <button type="submit" disabled={loading || otp.length !== 6} className={`${pillPrimary} flex items-center justify-center`}>
                {loading ? <><Spinner />Verifying...</> : "Verify & Continue"}
              </button>
            </div>
          </div>
        )}

        {/* Step 3: Personal Details */}
        {verificationStep === 3 && (
          <div key="step3" className="animate-otp-in mt-7 space-y-3">
            <div className="flex items-center justify-between rounded-xl border border-emerald-100 bg-emerald-50 p-3">
              <div className="flex items-center gap-3">
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-500 text-white"><FiCheck aria-hidden="true" /></span>
                <div>
                  <p className="text-xs font-bold text-emerald-900">ID Verified Successfully</p>
                  <p className="text-[11px] text-emerald-700">Ending with {formData.aadhaar.slice(-4)}</p>
                </div>
              </div>
              <button type="button" onClick={() => setVerificationStep(1)} className="text-xs font-semibold text-slate-500 underline hover:text-slate-900">
                Change
              </button>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Field id="name" name="name" label="Full Name *" icon={FiUser} type="text" autoComplete="name" placeholder="Legal name" value={formData.name} onChange={handleChange} disabled={loading} />
              <Field id="email" name="email" label="Email Address" icon={FiMail} type="email" autoComplete="email" placeholder="Optional" value={formData.email} onChange={handleChange} disabled={loading} />
            </div>

            <Field as="textarea" id="address" name="address" label="Complete Address *" icon={FiHome} rows={2} autoComplete="street-address" placeholder="House name, Street, Landmark..." value={formData.address} onChange={handleChange} disabled={loading} />

            <div className="grid grid-cols-2 gap-3">
              <Field as="select" id="district" name="district" label="District *" value={formData.district} onChange={handleChange} disabled={loading}>
                <option value="">Select</option>
                {availableDistricts.map(d => <option key={d} value={d}>{d}</option>)}
              </Field>
              <Field id="pincode" name="pincode" label="Pincode *" type="text" inputMode="numeric" autoComplete="postal-code" placeholder="6-digit" value={formData.pincode} onChange={handleChange} maxLength={6} disabled={loading} />
            </div>

            <label htmlFor="consent" className="flex items-start gap-3 rounded-xl bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-500">
              <input type="checkbox" id="consent" defaultChecked className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer rounded accent-teal-600" />
              I consent to the verification of my ID as per applicable regulations. I agree to receive service updates, documents, and OTPs via WhatsApp and SMS from Akshaya Sahayi.
            </label>

            <div className="flex gap-3 pt-2">
              <button type="button" onClick={() => setVerificationStep(1)} disabled={loading} className={pillSecondary}>
                Back
              </button>
              <button type="submit" disabled={loading} className={`${pillPrimary} flex items-center justify-center`}>
                {loading ? <><Spinner />Creating Profile...</> : "Complete Registration"}
              </button>
            </div>
          </div>
        )}

        <p className="mt-6 text-sm font-medium text-slate-600">
          Already registered?{" "}
          <Link to="/login" className="ml-1 font-bold text-teal-600 transition-colors hover:text-teal-700">
            Sign in here
          </Link>
        </p>
      </form>
    </AuthShell>
  );
};

export default CustomerRegistration;
