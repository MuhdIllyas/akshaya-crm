import React, { useState, useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { FiCheckCircle, FiClock, FiFileText, FiAlertCircle } from 'react-icons/fi';
import { FaWhatsapp } from 'react-icons/fa';
import axios from 'axios';

const PublicTrackingPage = () => {
  const { appNumber } = useParams();
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchStatus = async () => {
      if (!appNumber) {
        setError('No application number provided in the link.');
        setLoading(false);
        return;
      }

      try {
        const response = await axios.get(`/api/servicetracking/public/status/${encodeURIComponent(appNumber.trim())}`);
        setData(response.data);
      } catch (err) {
        console.error('Tracking fetch error:', err);
        setError(err.response?.data?.error || 'We could not find an application with this number. Please check your link.');
      } finally {
        setLoading(false);
      }
    };

    fetchStatus();
  }, [appNumber]);

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-indigo-200 border-t-indigo-600 rounded-full animate-spin mb-4"></div>
        <p className="text-slate-500 font-medium animate-pulse">Locating your application...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="bg-white p-8 rounded-2xl shadow-sm border border-slate-100 max-w-md w-full text-center">
          <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiAlertCircle className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">Application Not Found</h2>
          <p className="text-slate-500 mb-6 text-sm">{error}</p>
        </div>
      </div>
    );
  }

  const formatWhatsAppLink = () => {
    const phone = data.centrePhone ? data.centrePhone.replace(/\D/g, '') : '';
    const message = encodeURIComponent(`Hi ${data.centreName}, I have a query regarding my application ${data.applicationNumber}.`);
    return phone ? `https://wa.me/${phone}?text=${message}` : '#';
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return 'Pending';
    return new Date(dateStr).toLocaleDateString('en-IN', {
      day: 'numeric', month: 'short', year: 'numeric'
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-indigo-50/50 py-12 px-4 sm:px-6 lg:px-8 font-sans">
      <div className="max-w-xl mx-auto space-y-6">
        
        {/* Header / Branding */}
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-indigo-950 tracking-tight">{data.centreName || 'Akshaya Sahayi'}</h1>
          <p className="text-slate-500 text-sm">Live Application Tracker</p>
        </div>

        {/* Main Status Card */}
        <div className="bg-white rounded-3xl shadow-xl shadow-indigo-100/40 border border-slate-100 overflow-hidden relative">
          <div className="h-2 w-full bg-slate-100">
            <div 
              className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-1000 ease-out"
              style={{ width: `${data.progress || 0}%` }}
            />
          </div>

          <div className="p-6 sm:p-8">
            <div className="flex justify-between items-start mb-6">
              <div>
                <p className="text-xs font-semibold text-slate-400 uppercase tracking-wider mb-1">Application Number</p>
                <p className="text-base font-bold text-slate-800 font-mono bg-slate-50 inline-block px-3 py-1 rounded-lg border border-slate-100">
                  {data.applicationNumber}
                </p>
              </div>
              <div className="text-right">
                <span className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide
                  ${data.status === 'completed' ? 'bg-emerald-100 text-emerald-700' : 
                    data.status === 'rejected' ? 'bg-rose-100 text-rose-700' : 
                    'bg-amber-100 text-amber-700'}`}>
                  {data.status === 'in_progress' ? 'In Progress' : data.status}
                </span>
              </div>
            </div>

            <div className="mb-8">
              <h2 className="text-xl font-bold text-slate-900 mb-1">{data.serviceName}</h2>
              <p className="text-slate-500 text-sm">Applicant: <span className="text-slate-700 font-medium">{data.customerName}</span></p>
            </div>

            {/* Stepper Timeline */}
            <div className="relative pl-6 border-l-2 border-slate-100 space-y-6 mb-8 mt-4">
              {data.steps?.map((step, index) => (
                <div key={index} className="relative">
                  <div className={`absolute -left-[31px] mt-0.5 w-5 h-5 rounded-full flex items-center justify-center border-2 bg-white
                    ${step.completed 
                      ? 'border-emerald-500 text-emerald-500' 
                      : data.currentStep === step.name 
                        ? 'border-indigo-500 text-indigo-500 bg-indigo-50' 
                        : 'border-slate-200 text-slate-300'}`}>
                    {step.completed ? <FiCheckCircle className="w-4 h-4 bg-white rounded-full" /> : <div className="w-1.5 h-1.5 rounded-full bg-current" />}
                  </div>
                  <div>
                    <p className={`text-sm font-semibold ${step.completed || data.currentStep === step.name ? 'text-slate-800' : 'text-slate-400'}`}>
                      {step.name}
                    </p>
                    {step.completed && step.date && (
                      <p className="text-xs text-slate-400 mt-0.5 flex items-center">
                        <FiClock className="w-3 h-3 mr-1" /> {formatDate(step.date)}
                      </p>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Target Delivery Date */}
            <div className="bg-slate-50 rounded-2xl p-4 flex items-center justify-between border border-slate-100">
              <div className="flex items-center text-slate-600">
                <FiFileText className="w-5 h-5 mr-3 text-indigo-500" />
                <span className="text-sm font-medium">Estimated Completion</span>
              </div>
              <span className="font-bold text-slate-800 text-sm">
                {data.estimatedDelivery ? formatDate(data.estimatedDelivery) : 'Pending Confirmation'}
              </span>
            </div>
          </div>
        </div>

        {/* WhatsApp Contact Action */}
        {data.centrePhone && (
          <a 
            href={formatWhatsAppLink()} 
            target="_blank" 
            rel="noopener noreferrer"
            className="w-full bg-[#25D366] hover:bg-[#20bd5a] text-white p-4 rounded-2xl font-bold flex items-center justify-center space-x-2 transition-all shadow-md shadow-green-200"
          >
            <FaWhatsapp className="w-5 h-5" />
            <span>Have a question? Chat with us</span>
          </a>
        )}

      </div>
    </div>
  );
};

export default PublicTrackingPage;