import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';

export default function AdminPrintSettings() {
    const [activeTab, setActiveTab] = useState('pricing');
    const [loading, setLoading] = useState(true);
    const [printers, setPrinters] = useState([]);
    const [prices, setPrices] = useState([]);
    
    // Assuming admin is viewing settings for Centre 1. 
    // In your actual app, pull this from admin context or a dropdown.
    const centreId = 1; 

    useEffect(() => {
        fetchSettings();
    }, []);

    const fetchSettings = async () => {
        try {
            const res = await axios.get(`${import.meta.env.VITE_API_URL}/api/printing/settings/${centreId}`);
            setPrinters(res.data.printers);
            // If empty, provide default structure
            setPrices(res.data.prices.length ? res.data.prices : [
                { paper_size: 'A4', color: false, price_per_page: 3, duplex_price: 5 },
                { paper_size: 'A4', color: true, price_per_page: 10, duplex_price: 18 },
                { paper_size: 'A3', color: false, price_per_page: 8, duplex_price: 15 },
            ]);
        } catch (error) {
            toast.error("Failed to load print settings");
        } finally {
            setLoading(false);
        }
    };

    const handlePriceChange = (index, field, value) => {
        const updatedPrices = [...prices];
        updatedPrices[index][field] = parseFloat(value) || 0;
        setPrices(updatedPrices);
    };

    const savePrices = async () => {
        try {
            await axios.put(`${import.meta.env.VITE_API_URL}/api/printing/settings/prices/${centreId}`, { prices });
            toast.success("Pricing updated successfully!");
        } catch (error) {
            toast.error("Failed to save pricing");
        }
    };

    if (loading) return <div className="p-6">Loading settings...</div>;

    return (
        <div className="p-6 max-w-6xl mx-auto">
            <div className="flex justify-between items-center mb-6">
                <h1 className="text-2xl font-bold text-gray-800">Print Module Settings</h1>
                <div className="flex space-x-2">
                    <button 
                        onClick={() => setActiveTab('pricing')}
                        className={`px-4 py-2 rounded-md font-medium transition ${activeTab === 'pricing' ? 'bg-navy-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                    >
                        Pricing Engine
                    </button>
                    <button 
                        onClick={() => setActiveTab('routing')}
                        className={`px-4 py-2 rounded-md font-medium transition ${activeTab === 'routing' ? 'bg-navy-600 text-white' : 'bg-gray-200 text-gray-700'}`}
                    >
                        Hardware & Routing
                    </button>
                </div>
            </div>

            {/* TAB: PRICING */}
            {activeTab === 'pricing' && (
                <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
                    <h2 className="text-lg font-semibold mb-4 text-gray-800">Customer Facing Prices (₹)</h2>
                    <div className="overflow-x-auto">
                        <table className="w-full text-left border-collapse">
                            <thead>
                                <tr className="bg-gray-50 border-b">
                                    <th className="p-3 font-medium text-gray-600">Paper Size</th>
                                    <th className="p-3 font-medium text-gray-600">Type</th>
                                    <th className="p-3 font-medium text-gray-600">Single Sided (per pg)</th>
                                    <th className="p-3 font-medium text-gray-600">Double Sided (per sheet)</th>
                                </tr>
                            </thead>
                            <tbody>
                                {prices.map((p, idx) => (
                                    <tr key={idx} className="border-b hover:bg-gray-50">
                                        <td className="p-3 font-medium">{p.paper_size}</td>
                                        <td className="p-3">
                                            <span className={`px-2 py-1 rounded text-xs font-semibold ${p.color ? 'bg-purple-100 text-purple-700' : 'bg-gray-200 text-gray-700'}`}>
                                                {p.color ? 'Color' : 'Black & White'}
                                            </span>
                                        </td>
                                        <td className="p-3">
                                            <input 
                                                type="number" 
                                                className="border rounded p-1 w-24 text-center focus:ring-navy-500"
                                                value={p.price_per_page} 
                                                onChange={(e) => handlePriceChange(idx, 'price_per_page', e.target.value)}
                                            />
                                        </td>
                                        <td className="p-3">
                                            <input 
                                                type="number" 
                                                className="border rounded p-1 w-24 text-center focus:ring-navy-500"
                                                value={p.duplex_price} 
                                                onChange={(e) => handlePriceChange(idx, 'duplex_price', e.target.value)}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-6 flex justify-end">
                        <button onClick={savePrices} className="bg-green-600 hover:bg-green-700 text-white font-medium py-2 px-6 rounded shadow">
                            Save Pricing Matrix
                        </button>
                    </div>
                </div>
            )}

            {/* TAB: ROUTING & HARDWARE */}
            {activeTab === 'routing' && (
                <div className="bg-white rounded-lg shadow p-6 border border-gray-100">
                    <h2 className="text-lg font-semibold mb-4 text-gray-800">Connected Printers (Windows Spooler)</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {printers.map(printer => (
                            <div key={printer.id} className="border rounded-lg p-4 bg-gray-50 relative">
                                <div className="absolute top-4 right-4 h-3 w-3 bg-green-500 rounded-full animate-pulse"></div>
                                <h3 className="font-bold text-lg text-gray-800">{printer.name}</h3>
                                <p className="text-sm text-gray-500 font-mono mt-1">Driver: {printer.driver_name}</p>
                                
                                <div className="mt-4 space-y-2">
                                    <div className="flex justify-between text-sm border-b pb-1">
                                        <span className="text-gray-600">Supported Sizes:</span>
                                        <span className="font-semibold">{printer.paper_sizes}</span>
                                    </div>
                                    <div className="flex justify-between text-sm border-b pb-1">
                                        <span className="text-gray-600">Color Capable:</span>
                                        <span className={printer.supports_color ? "text-green-600 font-semibold" : "text-gray-400"}>
                                            {printer.supports_color ? "Yes" : "No"}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                    {/* Add Printer form would go here */}
                </div>
            )}
        </div>
    );
}