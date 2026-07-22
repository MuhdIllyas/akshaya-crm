import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { 
    FiSettings, 
    FiPrinter, 
    FiDollarSign, 
    FiSave, 
    FiCheckCircle, 
    FiXCircle, 
    FiPlus,
    FiFileText
} from 'react-icons/fi';

const AdminPrintSettings = () => {
    const [activeTab, setActiveTab] = useState('pricing');
    const [loading, setLoading] = useState(true);
    const [printers, setPrinters] = useState([]);
    const [prices, setPrices] = useState([]);

    const [showAddPrinter, setShowAddPrinter] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [newPrinter, setNewPrinter] = useState({
        name: '',
        driver_name: '',
        paper_sizes: 'A4',
        supports_color: false,
        supports_duplex: false
    });
    
    const centreId = localStorage.getItem("centre_id") ; 

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        setLoading(true);
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/printing/settings/${centreId}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
            });
            setPrinters(res.data.printers);
            // If empty, provide default structure
            setPrices(res.data.prices.length ? res.data.prices : [
                { paper_size: 'A4', color: false, price_per_page: 3, duplex_price: 5 },
                { paper_size: 'A4', color: true, price_per_page: 10, duplex_price: 18 },
                { paper_size: 'A3', color: false, price_per_page: 8, duplex_price: 15 },
                { paper_size: 'A3', color: true, price_per_page: 20, duplex_price: 35 },
            ]);
        } catch (error) {
            toast.error("Failed to load print settings", { position: "top-right", autoClose: 5000, theme: "light" });
        } finally {
            setLoading(false);
        }
    };

    const handleAddPrinterSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        
        try {
            const payload = { ...newPrinter, centre_id: centreId };
            
            const res = await axios.post(
                `${import.meta.env.VITE_API_URL}/api/printing/settings/printers`, 
                payload,
                { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
            );
            
            // Add the newly created printer directly to the UI state
            setPrinters([...printers, res.data]);
            
            toast.success("Printer added successfully!", { position: "top-right", autoClose: 3000, theme: "light" });
            
            // Reset form and close modal
            setNewPrinter({ name: '', driver_name: '', paper_sizes: 'A4', supports_color: false, supports_duplex: false });
            setShowAddPrinter(false);
        } catch (error) {
            toast.error("Failed to add printer", { position: "top-right", autoClose: 5000, theme: "light" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handlePriceChange = (index, field, value) => {
        const updatedPrices = [...prices];
        updatedPrices[index][field] = parseFloat(value) || 0;
        setPrices(updatedPrices);
    };

    const savePrices = async () => {
        try {
            await axios.put(`${import.meta.env.VITE_API_URL}/api/printing/settings/prices/${centreId}`, 
                { prices },
                { headers: { Authorization: `Bearer ${localStorage.getItem("token")}` } }
            );
            toast.success("Pricing updated successfully!", { position: "top-right", autoClose: 3000, theme: "light" });
        } catch (error) {
            toast.error("Failed to save pricing", { position: "top-right", autoClose: 5000, theme: "light" });
        }
    };

    // UI Helper for Status Badges (Matches StaffManagement style)
    const getStatusBadge = (status) => {
        const isActive = status === 'ACTIVE';
        return (
            <span className={`${isActive ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-700'} text-xs font-medium px-3 py-1.5 rounded-full flex items-center w-fit border`}>
                <span className={`w-2 h-2 ${isActive ? 'bg-emerald-500' : 'bg-red-500'} rounded-full mr-2`}></span>
                {status || 'OFFLINE'}
            </span>
        );
    };

    // Loading Skeleton (Matches your design)
    if (loading) {
        return (
            <div className="min-h-screen bg-gray-50 p-4 md:p-8 flex items-center justify-center">
                <div className="flex flex-col items-center">
                    <svg className="animate-spin h-8 w-8 text-blue-600 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-gray-600 font-medium">Loading settings...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-50 p-4 md:p-8 scrollbar-hide">
            <div className="max-w-7xl mx-auto">
                
                {/* Header Section */}
                <div className="flex flex-col md:flex-row md:items-center justify-between mb-8">
                    <div className="mb-6 md:mb-0">
                        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">
                            Print Settings
                        </h1>
                        <p className="text-gray-600 mt-2 text-lg">Manage printing prices, hardware, and routing rules</p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        {/* Tab Switcher (Matches your ViewMode toggle) */}
                        <div className="flex bg-white rounded-xl p-1 border border-gray-200">
                            <button
                                onClick={() => setActiveTab('pricing')}
                                className={`p-2 rounded-lg flex items-center gap-2 transition-all ${
                                    activeTab === 'pricing' 
                                        ? "bg-blue-50 text-blue-600 border border-blue-200" 
                                        : "text-gray-500 hover:text-gray-700"
                                }`}
                            >
                                <FiDollarSign className="text-lg" />
                                <span className="text-sm font-medium hidden sm:inline">Pricing Matrix</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('routing')}
                                className={`p-2 rounded-lg flex items-center gap-2 transition-all ${
                                    activeTab === 'routing' 
                                        ? "bg-blue-50 text-blue-600 border border-blue-200" 
                                        : "text-gray-500 hover:text-gray-700"
                                }`}
                            >
                                <FiPrinter className="text-lg" />
                                <span className="text-sm font-medium hidden sm:inline">Hardware</span>
                            </button>
                        </div>

                        {/* Conditional Action Button */}
                        {activeTab === 'pricing' ? (
                            <button
                                onClick={savePrices}
                                className="flex items-center gap-3 px-6 py-3.5 rounded-xl font-semibold text-white bg-navy-700 hover:bg-navy-800 shadow-md hover:shadow-lg transition-all duration-300 group"
                            >
                                <FiSave className="text-xl group-hover:scale-110 transition-transform" />
                                <span className="hidden sm:inline">Save Matrix</span>
                            </button>
                        ) : (
                            <button
                                onClick={() => setShowAddPrinter(true)} // <-- Update this line
                                className="flex items-center gap-3 px-6 py-3.5 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg transition-all duration-300 group"
                            >
                                <FiPlus className="text-xl group-hover:scale-110 transition-transform" />
                                <span className="hidden sm:inline">Add Printer</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* TAB: PRICING */}
                {activeTab === 'pricing' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-gray-200 overflow-hidden mb-8">
                        <div className="p-6 border-b border-gray-200">
                            <h3 className="text-lg font-semibold text-gray-800">Customer Facing Prices (₹)</h3>
                            <p className="text-sm text-gray-500 mt-1">Adjust the costs per page for different paper sizes and color options.</p>
                        </div>
                        <div className="overflow-x-auto scrollbar-hide">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-gray-50 border-b border-gray-200">
                                        <th className="p-4 font-semibold text-gray-600 text-sm tracking-wider uppercase">Paper Size</th>
                                        <th className="p-4 font-semibold text-gray-600 text-sm tracking-wider uppercase">Style</th>
                                        <th className="p-4 font-semibold text-gray-600 text-sm tracking-wider uppercase">Single Sided (per pg)</th>
                                        <th className="p-4 font-semibold text-gray-600 text-sm tracking-wider uppercase">Double Sided (per sheet)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {prices.map((p, idx) => (
                                        <tr key={idx} className="hover:bg-gray-50/50 transition-colors">
                                            <td className="p-4">
                                                <div className="flex items-center">
                                                    <FiFileText className="text-gray-400 mr-3 text-lg" />
                                                    <span className="font-semibold text-gray-800">{p.paper_size}</span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${p.color ? 'bg-purple-50 text-purple-700 border-purple-200' : 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                                                    {p.color ? 'Color' : 'Black & White'}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <div className="relative w-32">
                                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                        <span className="text-gray-500">₹</span>
                                                    </div>
                                                    <input 
                                                        type="number" 
                                                        className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white font-medium text-gray-800"
                                                        value={p.price_per_page} 
                                                        onChange={(e) => handlePriceChange(idx, 'price_per_page', e.target.value)}
                                                    />
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="relative w-32">
                                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                        <span className="text-gray-500">₹</span>
                                                    </div>
                                                    <input 
                                                        type="number" 
                                                        className="w-full pl-8 pr-4 py-2 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white font-medium text-gray-800"
                                                        value={p.duplex_price} 
                                                        onChange={(e) => handlePriceChange(idx, 'duplex_price', e.target.value)}
                                                    />
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                )}

                {/* TAB: ROUTING & HARDWARE */}
                {activeTab === 'routing' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {printers.length > 0 ? (
                            printers.map(printer => (
                                <div key={printer.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 transition-all hover:shadow-lg group">
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-2xl border border-blue-100">
                                            <FiPrinter />
                                        </div>
                                        {getStatusBadge(printer.status)}
                                    </div>
                                    
                                    <h3 className="font-bold text-gray-900 text-xl truncate mb-1">{printer.name}</h3>
                                    <p className="text-sm text-gray-500 font-mono mb-4 truncate" title={printer.driver_name}>
                                        Driver: {printer.driver_name}
                                    </p>
                                    
                                    <div className="space-y-3 pt-4 border-t border-gray-100">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-gray-600 flex items-center gap-2">
                                                <FiSettings className="text-gray-400" /> Paper Sizes
                                            </span>
                                            <span className="font-semibold text-gray-800">{printer.paper_sizes}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-gray-600 flex items-center gap-2">
                                                <FiSettings className="text-gray-400" /> Color Output
                                            </span>
                                            <span className={`font-semibold ${printer.supports_color ? "text-purple-600" : "text-gray-500"}`}>
                                                {printer.supports_color ? "Supported" : "B&W Only"}
                                            </span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-gray-600 flex items-center gap-2">
                                                <FiSettings className="text-gray-400" /> Duplexing
                                            </span>
                                            <span className={`font-semibold ${printer.supports_duplex ? "text-blue-600" : "text-gray-500"}`}>
                                                {printer.supports_duplex ? "Supported" : "Manual"}
                                            </span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-full bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
                                <div className="flex flex-col items-center">
                                    <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-2xl w-20 h-20 flex items-center justify-center mb-6">
                                        <FiPrinter className="text-gray-400 text-3xl" />
                                    </div>
                                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No Printers Connected</h3>
                                    <p className="text-gray-600 mb-6">Install the Windows Spooler worker script on your physical PC to register printers.</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}
                {/* Add Printer Modal */}
                {showAddPrinter && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn scrollbar-hide">
                        <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-gray-200 overflow-hidden">
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                    <FiPrinter className="text-blue-600" /> Add New Printer
                                </h2>
                                <button
                                    onClick={() => setShowAddPrinter(false)}
                                    className="text-gray-400 hover:text-gray-500 text-2xl p-2 hover:bg-gray-100 rounded-xl transition-all"
                                >
                                    <FiXCircle />
                                </button>
                            </div>
                            
                            <form onSubmit={handleAddPrinterSubmit} className="p-6 space-y-5">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Display Name</label>
                                    <input 
                                        type="text" 
                                        required
                                        placeholder="e.g., Main Counter B&W"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                                        value={newPrinter.name}
                                        onChange={(e) => setNewPrinter({...newPrinter, name: e.target.value})}
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Windows Spooler Driver Name</label>
                                    <input 
                                        type="text" 
                                        required
                                        placeholder="e.g., Canon iR2270/2870 PCL5e"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white font-mono text-sm"
                                        value={newPrinter.driver_name}
                                        onChange={(e) => setNewPrinter({...newPrinter, driver_name: e.target.value})}
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Must exactly match the name shown in the local PC's "Printers & scanners" settings.</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Supported Paper Sizes</label>
                                    <input 
                                        type="text" 
                                        required
                                        placeholder="e.g., A4, A3"
                                        className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white"
                                        value={newPrinter.paper_sizes}
                                        onChange={(e) => setNewPrinter({...newPrinter, paper_sizes: e.target.value})}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <label className="flex items-center space-x-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition">
                                        <input 
                                            type="checkbox" 
                                            className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                                            checked={newPrinter.supports_color}
                                            onChange={(e) => setNewPrinter({...newPrinter, supports_color: e.target.checked})}
                                        />
                                        <span className="font-medium text-gray-700">Supports Color</span>
                                    </label>

                                    <label className="flex items-center space-x-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition">
                                        <input 
                                            type="checkbox" 
                                            className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500"
                                            checked={newPrinter.supports_duplex}
                                            onChange={(e) => setNewPrinter({...newPrinter, supports_duplex: e.target.checked})}
                                        />
                                        <span className="font-medium text-gray-700">Supports Duplex</span>
                                    </label>
                                </div>

                                <div className="pt-4 flex justify-end gap-3">
                                    <button 
                                        type="button"
                                        onClick={() => setShowAddPrinter(false)}
                                        className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition"
                                    >
                                        Cancel
                                    </button>
                                    <button 
                                        type="submit"
                                        disabled={isSubmitting}
                                        className="px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2"
                                    >
                                        {isSubmitting ? (
                                            <><span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span> Saving...</>
                                        ) : 'Save Printer'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
            
            <style jsx>{`
                .scrollbar-hide {
                    -ms-overflow-style: none;
                    scrollbar-width: none;
                }
                .scrollbar-hide::-webkit-scrollbar {
                    display: none;
                }
            `}</style>
        </div>
    );
};

export default AdminPrintSettings;