import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { QRCodeCanvas } from 'qrcode.react';
import { FiSmartphone, FiPrinter, FiShield, FiRefreshCw, FiTrash2 } from 'react-icons/fi';
import { toast } from 'react-toastify';
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

// --- Sub-Component for Companion App Setup ---
const CompanionSetupTab = () => {
    const [pairingToken, setPairingToken] = useState(null);
    const [loading, setLoading] = useState(true);
    const [devices, setDevices] = useState([]); 

    const fetchData = async () => {
        setLoading(true);
        try {
            const tokenRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/companion/generate-pairing-token`, {
                headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
            });
            setPairingToken(tokenRes.data.pairingToken);

            const devicesRes = await axios.get(`${import.meta.env.VITE_API_URL}/api/companion/devices`, {
                headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
            });
            
            // Only show active devices in the UI
            setDevices(devicesRes.data.filter(d => d.is_active));
        } catch (error) {
            console.error("Failed to fetch companion data", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    // ---> NEW: Function to handle device removal <---
    const handleRemoveDevice = async (deviceId, deviceName) => {
        if (!window.confirm(`Are you sure you want to unpair "${deviceName}"? It will stop receiving messages.`)) {
            return;
        }

        try {
            await axios.delete(`${import.meta.env.VITE_API_URL}/api/companion/devices/${deviceId}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
            });
            
            toast.success("Device removed successfully.");
            
            // Instantly remove it from the UI without reloading the page
            setDevices(prev => prev.filter(device => device.id !== deviceId));
        } catch (error) {
            console.error(error);
            toast.error("Failed to remove device.");
        }
    };

    const qrPayload = JSON.stringify({ pairingToken });

    return (
        <div className="max-w-4xl">
            <h2 className="text-2xl font-bold text-gray-900 mb-2">Companion Devices</h2>
            <p className="text-gray-600 mb-8">Manage physical Android phones acting as hardware gateways for your centre.</p>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                {/* QR Code Section */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 flex flex-col items-center text-center">
                    {loading ? (
                        <div className="h-64 flex flex-col items-center justify-center">
                            <FiRefreshCw className="animate-spin text-3xl text-blue-600 mb-4" />
                            <p className="text-gray-500">Generating secure pairing token...</p>
                        </div>
                    ) : (
                        <>
                            <div className="p-4 bg-white border-4 border-blue-50 rounded-2xl mb-6 inline-block">
                                <QRCodeCanvas value={qrPayload} size={200} level={"H"} />
                            </div>
                            <h3 className="font-semibold text-gray-900 text-lg mb-2">Setup New Device</h3>
                            <p className="text-sm text-gray-500 max-w-sm mb-6">Scan this 15-minute token with the Companion App to link a new phone.</p>
                            <button onClick={fetchData} className="flex items-center gap-2 text-blue-600 hover:text-blue-700 font-medium transition-colors">
                                <FiRefreshCw /> Refresh Data
                            </button>
                        </>
                    )}
                </div>

                {/* Connected Devices List */}
                <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
                    <h3 className="font-semibold text-gray-900 text-lg mb-4">Active Gateways</h3>
                    {devices.length === 0 ? (
                        <div className="text-center text-gray-500 py-10 bg-gray-50 rounded-xl border border-dashed border-gray-200">
                            No active devices found.
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {devices.map(device => (
                                <div key={device.id} className="p-4 border border-gray-100 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors relative group">
                                    
                                    {/* ---> NEW: Delete Button <--- */}
                                    <button 
                                        onClick={() => handleRemoveDevice(device.id, device.device_name)}
                                        className="absolute top-4 right-4 p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors opacity-0 group-hover:opacity-100"
                                        title="Unpair Device"
                                    >
                                        <FiTrash2 className="text-lg" />
                                    </button>

                                    <div className="flex justify-between items-start mb-2 pr-10">
                                        <div className="font-semibold text-gray-900 flex items-center gap-2">
                                            <FiSmartphone className="text-blue-600" />
                                            {device.device_name}
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 text-sm text-gray-600 mt-3">
                                        <div><strong>Battery:</strong> {device.battery_level ? `${device.battery_level}%` : 'Unknown'}</div>
                                        <div><strong>Network:</strong> {device.network_status || 'Unknown'}</div>
                                        <div><strong>App Version:</strong> v{device.app_version || '1.0.0'}</div>
                                        <div className="truncate" title={new Date(device.last_seen).toLocaleString()}>
                                            <strong>Last Seen:</strong> {new Date(device.last_seen).toLocaleTimeString()}
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

export default AdminSettings;