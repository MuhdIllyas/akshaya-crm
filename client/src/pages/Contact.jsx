// src/pages/Contact.jsx
import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Link, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { 
  FiMail, FiPhone, FiMapPin, FiArrowRight, 
  FiArrowLeft, FiInfo 
} from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import axios from 'axios';

const Contact = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    centreName: '',
    phone: '',
    email: '',
    centres: '',
    interest: '',
    message: ''
  });

  const handleChange = (e) => {
    setFormData({ ...formData, [e.target.name]: e.target.value });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Send the actual POST request to your Node.js backend
      const response = await axios.post(`${import.meta.env.VITE_API_URL}/api/contact/enquiry`, formData);
      
      if (response.data.success) {
        toast.success("Message sent successfully! We'll get back to you soon.", {
          position: "top-right",
        });
        // Clear the form
        setFormData({ name: '', centreName: '', phone: '', email: '', centres: '', interest: '', message: '' });
      }
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to send message. Please try again later.", {
        position: "top-right",
      });
      console.error("Contact Form Error:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4 font-sans selection:bg-teal-500 selection:text-white relative overflow-hidden">
      
      {/* Background Decorators */}
      <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-teal-500/10 blur-[100px] rounded-full pointer-events-none"></div>
      <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-blue-600/10 blur-[100px] rounded-full pointer-events-none"></div>

      <div className="w-full max-w-6xl z-10 py-10">
        
        {/* Navigation / Header */}
        <div className="mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
          <Link to="/" className="flex items-center group">
            <div className="bg-white p-1.5 rounded-xl shadow-sm border border-gray-100 group-hover:shadow-md transition-all duration-300">
              <img src="/logo-light.png" alt="Akshaya Sahayi" className="h-8 w-8 object-contain" />
            </div>
            <div className="ml-3">
              <h1 className="text-2xl font-bold text-navy-900 leading-tight">
                Akshaya <span className="text-teal-600">Sahayi</span>
              </h1>
            </div>
          </Link>

          <Link 
            to="/home" 
            className="flex items-center text-sm font-semibold text-gray-600 hover:text-teal-600 transition-colors bg-white px-4 py-2 rounded-xl shadow-sm border border-gray-200"
          >
            <FiArrowLeft className="mr-2" /> Back to Home
          </Link>
        </div>

        {/* Main Content Area */}
        <div className="bg-white rounded-3xl shadow-xl overflow-hidden border border-gray-200 flex flex-col lg:flex-row">
          
          {/* Left Side: Contact Information (Navy/Teal Branding) */}
          <div className="w-full lg:w-2/5 bg-gradient-to-b from-navy-900 to-navy-800 p-8 md:p-12 text-white flex flex-col relative overflow-hidden">
            {/* Pattern Overlay */}
            <div className="absolute inset-0 opacity-10 pointer-events-none">
              <svg className="w-full h-full" viewBox="0 0 100 100" preserveAspectRatio="none">
                <path d="M0,0 L100,0 L100,100 Z" fill="#fff" />
                <circle cx="20" cy="80" r="15" fill="#fff" />
                <circle cx="80" cy="20" r="10" fill="#fff" />
              </svg>
            </div>

            <div className="relative z-10 flex-1">
              <h2 className="text-3xl font-extrabold mb-2">Get in touch</h2>
              <p className="text-navy-200 mb-10 text-sm leading-relaxed">
                Having trouble logging in, or need help setting up your centre? Our support team is here to help you navigate Akshaya Sahayi.
              </p>

              <div className="space-y-8">
                <div className="flex items-start group">
                  <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center shrink-0 mr-4 group-hover:bg-teal-500/20 transition-colors border border-white/5">
                    <FiPhone className="text-teal-400 h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-navy-300 uppercase tracking-wider mb-1">Call Us</p>
                    <p className="font-medium text-lg">+91 80865 15301</p>
                    <p className="text-xs text-navy-400 mt-1">Mon-Sat, 9:00 AM to 6:00 PM</p>
                  </div>
                </div>

                <div className="flex items-start group">
                  <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center shrink-0 mr-4 group-hover:bg-green-500/20 transition-colors border border-white/5">
                    <FaWhatsapp className="text-green-400 h-6 w-6" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-navy-300 uppercase tracking-wider mb-1">WhatsApp Support</p>
                    <a href="https://wa.me/919633975301" target="_blank" rel="noreferrer" className="font-medium text-lg hover:text-green-400 transition-colors">
                      +91 96339 75301
                    </a>
                    <p className="text-xs text-navy-400 mt-1">Fastest way to reach us</p>
                  </div>
                </div>

                <div className="flex items-start group">
                  <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center shrink-0 mr-4 group-hover:bg-blue-500/20 transition-colors border border-white/5">
                    <FiMail className="text-blue-400 h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-navy-300 uppercase tracking-wider mb-1">Email</p>
                    <a href="mailto:muhdillyasks@gmail.com" className="font-medium text-base hover:text-blue-400 transition-colors break-all">
                      admin@akshayasahayi.com
                    </a>
                  </div>
                </div>

                <div className="flex items-start group">
                  <div className="w-12 h-12 bg-white/10 rounded-xl flex items-center justify-center shrink-0 mr-4 group-hover:bg-amber-500/20 transition-colors border border-white/5">
                    <FiMapPin className="text-amber-400 h-5 w-5" />
                  </div>
                  <div>
                    <p className="text-xs font-bold text-navy-300 uppercase tracking-wider mb-1">Headquarters</p>
                    <p className="font-medium text-sm leading-relaxed text-navy-100">
                      Akshaya Sahayi Solutions<br />
                      Centre Park<br />
                      Malappuram, Kerala - 673638
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Side: Form */}
          <div className="w-full lg:w-3/5 p-8 md:p-12">
            <div className="flex items-center mb-8 bg-blue-50 border border-blue-100 p-4 rounded-xl">
              <FiInfo className="text-blue-600 h-5 w-5 mr-3 shrink-0" />
              <p className="text-sm text-blue-900 font-medium">
                Please fill in your details below so our support team can assist you as quickly as possible.
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Name *</label>
                  <input type="text" required name="name" placeholder="Your full name" value={formData.name} onChange={handleChange} className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all text-gray-900" disabled={loading} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Centre Name</label>
                  <input type="text" name="centreName" placeholder="Your Akshaya Centre name" value={formData.centreName} onChange={handleChange} className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all text-gray-900" disabled={loading} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Phone Number *</label>
                  <input type="tel" required name="phone" placeholder="WhatsApp/Contact number" value={formData.phone} onChange={handleChange} className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all text-gray-900" disabled={loading} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Email Address</label>
                  <input type="email" name="email" placeholder="Your email address" value={formData.email} onChange={handleChange} className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all text-gray-900" disabled={loading} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Number of Centres</label>
                  <input type="number" min="1" name="centres" placeholder="e.g. 1" value={formData.centres} onChange={handleChange} className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all text-gray-900" disabled={loading} />
                </div>
                <div>
                  <label className="block text-sm font-bold text-gray-700 mb-2">Subject / Interested In</label>
                  <select name="interest" value={formData.interest} onChange={handleChange} className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all text-gray-700" disabled={loading}>
                    <option value="">Select a topic...</option>
                    <option value="Login Issue">Cannot log into my account</option>
                    <option value="Demo">Akshaya Sahayi Demo</option>
                    <option value="WhatsApp">WhatsApp Integration</option>
                    <option value="Customers">Customer Management</option>
                    <option value="Finance">Finance & Accounts</option>
                    <option value="Staff">Staff & Payroll</option>
                    <option value="Multi-Centre">Multi-Centre Management</option>
                    <option value="Other">Other</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-bold text-gray-700 mb-2">Message Details *</label>
                <textarea required name="message" rows="4" placeholder="Please describe your issue or question in detail..." value={formData.message} onChange={handleChange} className="w-full px-4 py-3 bg-gray-50 border border-gray-300 rounded-xl focus:ring-2 focus:ring-teal-500 focus:outline-none transition-all text-gray-900 resize-none" disabled={loading}></textarea>
              </div>

              <motion.button
                whileHover={{ scale: loading ? 1 : 1.01 }}
                whileTap={{ scale: loading ? 1 : 0.99 }}
                type="submit"
                disabled={loading}
                className="w-full sm:w-auto px-8 py-3.5 bg-teal-600 hover:bg-teal-700 text-white font-bold rounded-xl shadow-[0_4px_14px_0_rgba(20,184,166,0.39)] transition-all flex items-center justify-center disabled:opacity-70 disabled:cursor-not-allowed mt-2"
              >
                {loading ? (
                  <span className="flex items-center">
                    <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Sending Message...
                  </span>
                ) : (
                  <>Send Message <FiArrowRight className="ml-2" /></>
                )}
              </motion.button>
            </form>
          </div>
        </div>
        
        {/* Footer Note */}
        <div className="text-center mt-8 text-gray-500 text-sm">
          <p>© {new Date().getFullYear()} Akshaya Sahayi. Secure & Encrypted Communication.</p>
        </div>

      </div>
    </div>
  );
};

export default Contact;