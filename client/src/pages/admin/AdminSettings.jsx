import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { QRCodeCanvas } from 'qrcode.react';
import { FiSmartphone, FiPrinter, FiShield, FiRefreshCw } from 'react-icons/fi';
import AdminPrintSettings from '../printing/AdminPrintSettings';

const AdminSettings = () => {
    const [activeTab, setActiveTab] = useState('companion'); // 'companion', 'print', 'security'

    return (
        <div className="min-h-screen bg-gray-50 flex flex-col md:flex-row">
            
            {/* Sidebar Navigation */}
            <div className="w-full md:w-64 bg-white border-r border-gray-200 p-6 flex-shrink-0">
                <h1 className="text-2xl font-bold text-gray-900 mb-8">Settings</h1>
                
                <nav className="space-y-2">
                    <button 
                        onClick={() => setActiveTab('companion')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'companion' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <FiSmartphone className="text-lg" />
                        Companion App
                    </button>
                    <button 
                        onClick={() => setActiveTab('print')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'print' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <FiPrinter className="text-lg" />
                        Print Routing
                    </button>
                    <button 
                        onClick={() => setActiveTab('security')}
                        className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl font-medium transition-all ${activeTab === 'security' ? 'bg-blue-50 text-blue-700' : 'text-gray-600 hover:bg-gray-50'}`}
                    >
                        <FiShield className="text-lg" />
                        Security (Soon)
                    </button>
                </nav>
            </div>

            {/* Main Content Area */}
            <div className="flex-1 p-6 md:p-8 overflow-y-auto">
                {activeTab === 'companion' && <CompanionSetupTab />}
                {activeTab === 'print' && <AdminPrintSettings />}
                {activeTab === 'security' && (
                    <div className="text-gray-500 text-center py-20">Security settings coming soon...</div>
                )}
            </div>
        </div>
    );
};

// -- Sub-Component for Companion App Setup --
const CompanionSetupTab = () => {
    const [pairingToken, setPairingToken] = useState(null);
    const [loading, setLoading] = useState(true);

    const fetchPairingToken = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/companion/generate-pairing-token`, {
                headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
            });
            setPairingToken(res.data.pairingToken);
        } catch (error) {
            console.error("Failed to fetch pairing token", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchPairingToken();
    }, []);

    // Create the exact JSON payload the Android phone is expecting
    const qrPayload = JSON.stringify({ pairingToken });

    return (
        <div className="max-w-2xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Connect Companion Device</h2>
            <p className="text-gray-600 mb-8">Scan this QR code with the Akshaya Companion Android App to link the physical phone to this centre's CRM.</p>

            <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 flex flex-col items-center text-center">
                
                {loading ? (
                    <div className="h-64 flex flex-col items-center justify-center">
                        <FiRefreshCw className="animate-spin text-3xl text-blue-600 mb-4" />
                        <p className="text-gray-500">Generating secure pairing token...</p>
                    </div>
                ) : (
                    <>
                        <div className="p-4 bg-white border-4 border-blue-50 rounded-2xl mb-6 inline-block">
                            <QRCodeCanvas value={qrPayload} size={250} level={"H"} />
                        </div>
                        
                        <h3 className="font-semibold text-gray-900 text-lg mb-2">Pairing Code Ready</h3>
                        <p className="text-sm text-gray-500 max-w-sm mb-6">
                            This secure token is tied directly to your Centre ID. It will expire in 15 minutes.
                        </p>

                        <button 
                            onClick={fetchPairingToken}
                            className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium transition-colors"
                        >
                            <FiRefreshCw /> Generate New Token
                        </button>
                    </>
                )}
            </div>
        </div>
    );
};

export default AdminSettings;