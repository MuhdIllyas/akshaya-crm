// ConfirmationPage.jsx
import React from 'react';
import { FiCheckCircle, FiPrinter, FiDownload, FiHome } from 'react-icons/fi';
import { useParams, useNavigate, Link } from 'react-router-dom';

const ConfirmationPage = () => {
  const { id } = useParams();
  const navigate = useNavigate();

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-white rounded-xl border border-emerald-200 p-8 text-center shadow-sm">
        <div className="mb-6">
          <div className="bg-emerald-100 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4">
            <FiCheckCircle className="text-emerald-600 text-3xl" />
          </div>
          <h1 className="text-2xl font-bold text-gray-800 mb-2">Application Submitted Successfully!</h1>
          <p className="text-gray-600 mb-4">
            Your application #{id} has been submitted for processing.
          </p>
        </div>

        <div className="bg-gray-50 rounded-lg p-6 mb-8 text-left">
          <h3 className="font-bold text-gray-800 mb-4">What happens next?</h3>
          <ul className="space-y-3">
            <li className="flex items-start">
              <div className="bg-blue-100 p-1 rounded-full mr-3 mt-1">
                <span className="text-blue-600 text-xs font-bold">1</span>
              </div>
              <div>
                <p className="font-medium text-gray-800">Payment Verification</p>
                <p className="text-sm text-gray-600">Our staff will verify your payment within 24 hours</p>
              </div>
            </li>
            <li className="flex items-start">
              <div className="bg-blue-100 p-1 rounded-full mr-3 mt-1">
                <span className="text-blue-600 text-xs font-bold">2</span>
              </div>
              <div>
                <p className="font-medium text-gray-800">Document Review</p>
                <p className="text-sm text-gray-600">Documents will be reviewed by our team</p>
              </div>
            </li>
            <li className="flex items-start">
              <div className="bg-blue-100 p-1 rounded-full mr-3 mt-1">
                <span className="text-blue-600 text-xs font-bold">3</span>
              </div>
              <div>
                <p className="font-medium text-gray-800">Processing Begins</p>
                <p className="text-sm text-gray-600">Service processing will start after verification</p>
              </div>
            </li>
          </ul>
        </div>

        <div className="mb-8 p-4 bg-amber-50 rounded-lg border border-amber-100">
          <h4 className="font-bold text-amber-800 mb-2">Important Instructions</h4>
          <ul className="text-sm text-amber-700 text-left space-y-2">
            <li>• Keep your application number (#{id}) for reference</li>
            <li>• Check your email/WhatsApp for payment QR code if selected online payment</li>
            <li>• Visit our office within 3 days if selected cash payment</li>
            <li>• Track progress in "My Services" section</li>
          </ul>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 justify-center">
          <button
            onClick={() => navigate(`/customer/myservices/${id}`)}
            className="inline-flex items-center justify-center px-6 py-3 bg-navy-700 text-white rounded-lg font-medium hover:bg-navy-800"
          >
            <FiDownload className="mr-2" />
            View Application Details
          </button>
          
          <button
            onClick={() => navigate('/customer/myservices')}
            className="inline-flex items-center justify-center px-6 py-3 bg-white text-navy-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
          >
            <FiHome className="mr-2" />
            Back to My Services
          </button>
          
          <button
            onClick={() => window.print()}
            className="inline-flex items-center justify-center px-6 py-3 bg-white text-gray-700 border border-gray-300 rounded-lg font-medium hover:bg-gray-50"
          >
            <FiPrinter className="mr-2" />
            Print Receipt
          </button>
        </div>

        <div className="mt-8 pt-6 border-t border-gray-200">
          <p className="text-sm text-gray-500">
            Need help? Contact support at support@akshayacentre.gov.in or call 0471-1234567
          </p>
        </div>
      </div>
    </div>
  );
};

export default ConfirmationPage;