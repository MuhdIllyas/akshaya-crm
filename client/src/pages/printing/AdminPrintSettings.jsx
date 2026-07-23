import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { QRCodeCanvas } from 'qrcode.react';
import { 
    FiSettings, 
    FiPrinter, 
    FiDollarSign, 
    FiSave, 
    FiCheckCircle, 
    FiXCircle, 
    FiPlus,
    FiFileText,
    FiEdit2,
    FiTrash2,
    FiSmartphone,
    FiDownload
} from 'react-icons/fi';

/* ================================
   QR POSTER COMPONENT
================================ */
const GeneratePrintQR = ({ centreId }) => {
    // Construct the exact URL the customer needs to visit
    const printPortalUrl = `${window.location.origin}/print?centre_id=${centreId}`;
    const qrRef = useRef(null);

    const downloadQR = () => {
        const canvas = qrRef.current.querySelector('canvas');
        const pngUrl = canvas.toDataURL("image/png").replace("image/png", "image/octet-stream");
        const downloadLink = document.createElement("a");
        downloadLink.href = pngUrl;
        downloadLink.download = `Akshaya-Print-QR-Centre-${centreId}.png`;
        document.body.appendChild(downloadLink);
        downloadLink.click();
        document.body.removeChild(downloadLink);
    };

    const printPoster = () => {
        const canvas = qrRef.current.querySelector('canvas');
        const dataUrl = canvas.toDataURL("image/png");
        
        const posterHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Self Service Print Poster</title>
                <style>
                    @page { size: A4 portrait; margin: 0; }
                    body { 
                        font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
                        margin: 0; padding: 0; display: flex; justify-content: center; 
                        align-items: center; height: 100vh; background: #f8fafc;
                        -webkit-print-color-adjust: exact; print-color-adjust: exact;
                    }
                    .poster-container { 
                        background: white; border: 12px solid #1e40af; border-radius: 40px; 
                        width: 85%; height: 88%; display: flex; flex-direction: column; 
                        align-items: center; padding: 50px 40px; box-sizing: border-box;
                        box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                    }
                    .header { text-align: center; margin-bottom: 40px; }
                    h1 { font-size: 56px; color: #1e40af; margin: 0 0 10px 0; text-transform: uppercase; letter-spacing: 2px; line-height: 1.1; }
                    h2 { font-size: 28px; color: #475569; margin: 0; font-weight: 500; }
                    .qr-wrapper { background: white; padding: 30px; border-radius: 24px; border: 4px dashed #94a3b8; margin-bottom: 50px; }
                    img { width: 350px; height: 350px; display: block; }
                    .instructions { display: flex; justify-content: center; gap: 30px; width: 100%; margin-bottom: auto; }
                    .step { background: #f1f5f9; padding: 20px; border-radius: 16px; flex: 1; text-align: center; border: 2px solid #e2e8f0; }
                    .step-num { background: #1e40af; color: white; width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 24px; font-weight: bold; margin: 0 auto 10px auto; }
                    .step-text { font-size: 20px; color: #334155; font-weight: 600; }
                    .footer { margin-top: 30px; font-size: 18px; color: #64748b; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; }
                </style>
            </head>
            <body>
                <div class="poster-container">
                    <div class="header">
                        <h1>Self-Service<br/>Printing</h1>
                        <h2>Skip the line. Print directly from your phone.</h2>
                    </div>
                    <div class="qr-wrapper"><img src="${dataUrl}" alt="Scan to Print" /></div>
                    <div class="instructions">
                        <div class="step"><div class="step-num">1</div><div class="step-text">Scan Code</div></div>
                        <div class="step"><div class="step-num">2</div><div class="step-text">Upload PDF</div></div>
                        <div class="step"><div class="step-num">3</div><div class="step-text">Collect Print</div></div>
                    </div>
                    <div class="footer">Akshaya Sahayi • Centre ${centreId}</div>
                </div>
                <script>
                    window.onload = function() { setTimeout(() => { window.print(); }, 500); }
                </script>
            </body>
            </html>
        `;

        const printWindow = window.open('', '_blank');
        printWindow.document.open();
        printWindow.document.write(posterHTML);
        printWindow.document.close();
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8 flex flex-col items-center max-w-md mx-auto mt-8 transition-all hover:shadow-md">
            <div className="text-center mb-6">
                <h2 className="text-2xl font-bold text-gray-900 mb-2">Self-Service Poster</h2>
                <p className="text-gray-500 text-sm">Print this QR code as an A4 shop poster. Customers scan it to bypass the queue.</p>
            </div>

            <div ref={qrRef} className="p-4 bg-white border border-gray-200 rounded-2xl mb-6 shadow-inner">
                <QRCodeCanvas value={printPortalUrl} size={220} level={"H"} includeMargin={true} />
            </div>

            <p className="text-xs text-blue-600 font-mono bg-blue-50 px-3 py-2 rounded-lg mb-8 truncate max-w-full border border-blue-100">
                {printPortalUrl}
            </p>

            <div className="flex gap-4 w-full">
                <button onClick={downloadQR} className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 bg-white border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl transition-all">
                    <FiDownload className="text-lg" /> QR Only
                </button>
                <button onClick={printPoster} className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all">
                    <FiPrinter className="text-lg" /> Print Poster
                </button>
            </div>
        </div>
    );
};


/* ================================
   MAIN SETTINGS COMPONENT
================================ */
const AdminPrintSettings = () => {
    const [activeTab, setActiveTab] = useState('pricing'); // 'pricing', 'routing', or 'qr'
    const [loading, setLoading] = useState(true);
    const [printers, setPrinters] = useState([]);
    const [prices, setPrices] = useState([]);

    // Modal & Form State
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [editingId, setEditingId] = useState(null); 
    const [printerForm, setPrinterForm] = useState({
        name: '',
        driver_name: '',
        paper_sizes: 'A4',
        supports_color: false,
        supports_duplex: false,
        status: 'ACTIVE'
    });
    
    const centreId = localStorage.getItem("centre_id") || 1; 

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

    /* PRICING LOGIC */
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

    /* PRINTER CRUD LOGIC */
    const openAddModal = () => {
        setEditingId(null);
        setPrinterForm({ name: '', driver_name: '', paper_sizes: 'A4', supports_color: false, supports_duplex: false, status: 'ACTIVE' });
        setIsModalOpen(true);
    };

    const openEditModal = (printer) => {
        setEditingId(printer.id);
        setPrinterForm(printer); 
        setIsModalOpen(true);
    };

    const handlePrinterSubmit = async (e) => {
        e.preventDefault();
        setIsSubmitting(true);
        
        try {
            const payload = { ...printerForm, centre_id: centreId };
            const headers = { Authorization: `Bearer ${localStorage.getItem("token")}` };
            
            if (editingId) {
                const res = await axios.put(
                    `${import.meta.env.VITE_API_URL}/api/printing/settings/printers/${editingId}`, 
                    payload, { headers }
                );
                setPrinters(printers.map(p => p.id === editingId ? res.data : p));
                toast.success("Printer updated successfully!", { position: "top-right", autoClose: 3000, theme: "light" });
            } else {
                const res = await axios.post(
                    `${import.meta.env.VITE_API_URL}/api/printing/settings/printers`, 
                    payload, { headers }
                );
                setPrinters([...printers, res.data]);
                toast.success("Printer added successfully!", { position: "top-right", autoClose: 3000, theme: "light" });
            }
            setIsModalOpen(false);
        } catch (error) {
            toast.error(editingId ? "Failed to update printer" : "Failed to add printer", { position: "top-right", autoClose: 5000, theme: "light" });
        } finally {
            setIsSubmitting(false);
        }
    };

    const handleDeletePrinter = async (id) => {
        if (!window.confirm("Are you sure you want to remove this printer?")) return;
        try {
            const res = await axios.delete(`${import.meta.env.VITE_API_URL}/api/printing/settings/printers/${id}`, {
                headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }
            });
            
            if (res.data.hardDeleted) {
                setPrinters(printers.filter(p => p.id !== id));
                toast.success("Printer deleted.", { position: "top-right", autoClose: 3000, theme: "light" });
            } else {
                setPrinters(printers.map(p => p.id === id ? { ...p, status: 'OFFLINE' } : p));
                toast.info("Printer has history. Marked as OFFLINE instead of deleting.", { position: "top-right", autoClose: 5000, theme: "light" });
            }
        } catch (error) {
            toast.error("Failed to delete printer", { position: "top-right", autoClose: 5000, theme: "light" });
        }
    };

    const getStatusBadge = (status) => {
        const isActive = status === 'ACTIVE';
        return (
            <span className={`${isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-red-50 text-red-700 border-red-200'} text-xs font-medium px-3 py-1.5 rounded-full flex items-center w-fit border`}>
                <span className={`w-2 h-2 ${isActive ? 'bg-emerald-500' : 'bg-red-500'} rounded-full mr-2`}></span>
                {status || 'OFFLINE'}
            </span>
        );
    };

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
                        <h1 className="text-3xl md:text-4xl font-bold text-gray-900">Print Settings</h1>
                        <p className="text-gray-600 mt-2 text-lg">Manage printing prices, hardware, and routing rules</p>
                    </div>
                    
                    <div className="flex items-center gap-3">
                        {/* Tab Switcher */}
                        <div className="flex bg-white rounded-xl p-1 border border-gray-200">
                            <button
                                onClick={() => setActiveTab('pricing')}
                                className={`p-2 rounded-lg flex items-center gap-2 transition-all ${
                                    activeTab === 'pricing' ? "bg-blue-50 text-blue-600 border border-blue-200" : "text-gray-500 hover:text-gray-700"
                                }`}
                            >
                                <FiDollarSign className="text-lg" />
                                <span className="text-sm font-medium hidden sm:inline">Pricing Matrix</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('routing')}
                                className={`p-2 rounded-lg flex items-center gap-2 transition-all ${
                                    activeTab === 'routing' ? "bg-blue-50 text-blue-600 border border-blue-200" : "text-gray-500 hover:text-gray-700"
                                }`}
                            >
                                <FiPrinter className="text-lg" />
                                <span className="text-sm font-medium hidden sm:inline">Hardware</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('qr')}
                                className={`p-2 rounded-lg flex items-center gap-2 transition-all ${
                                    activeTab === 'qr' ? "bg-blue-50 text-blue-600 border border-blue-200" : "text-gray-500 hover:text-gray-700"
                                }`}
                            >
                                <FiSmartphone className="text-lg" />
                                <span className="text-sm font-medium hidden sm:inline">QR Poster</span>
                            </button>
                        </div>

                        {/* Conditional Action Button based on Tab */}
                        {activeTab === 'pricing' && (
                            <button onClick={savePrices} className="flex items-center gap-3 px-6 py-3.5 rounded-xl font-semibold text-white bg-navy-700 hover:bg-navy-800 shadow-md hover:shadow-lg transition-all duration-300 group">
                                <FiSave className="text-xl group-hover:scale-110 transition-transform" />
                                <span className="hidden sm:inline">Save Matrix</span>
                            </button>
                        )}
                        {activeTab === 'routing' && (
                            <button onClick={openAddModal} className="flex items-center gap-3 px-6 py-3.5 rounded-xl font-semibold text-white bg-blue-600 hover:bg-blue-700 shadow-md hover:shadow-lg transition-all duration-300 group">
                                <FiPlus className="text-xl group-hover:scale-110 transition-transform" />
                                <span className="hidden sm:inline">Add Printer</span>
                            </button>
                        )}
                        {/* No header button for QR tab as actions are on the component itself */}
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
                                <div key={printer.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 transition-all hover:shadow-lg group relative">
                                    <div className="absolute top-4 right-4 flex space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button onClick={() => openEditModal(printer)} className="p-2 bg-gray-100 text-blue-600 hover:bg-blue-100 rounded-lg transition" title="Edit Printer"><FiEdit2 /></button>
                                        <button onClick={() => handleDeletePrinter(printer.id)} className="p-2 bg-gray-100 text-red-600 hover:bg-red-100 rounded-lg transition" title="Delete Printer"><FiTrash2 /></button>
                                    </div>
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-xl flex items-center justify-center text-2xl border border-blue-100"><FiPrinter /></div>
                                    </div>
                                    <div className="flex justify-between items-center mb-1">
                                        <h3 className="font-bold text-gray-900 text-xl truncate pr-2">{printer.name}</h3>
                                        {getStatusBadge(printer.status)}
                                    </div>
                                    <p className="text-sm text-gray-500 font-mono mb-4 truncate" title={printer.driver_name}>Driver: {printer.driver_name}</p>
                                    <div className="space-y-3 pt-4 border-t border-gray-100">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-gray-600 flex items-center gap-2"><FiSettings className="text-gray-400" /> Paper Sizes</span>
                                            <span className="font-semibold text-gray-800">{printer.paper_sizes}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-gray-600 flex items-center gap-2"><FiSettings className="text-gray-400" /> Color Output</span>
                                            <span className={`font-semibold ${printer.supports_color ? "text-purple-600" : "text-gray-500"}`}>{printer.supports_color ? "Supported" : "B&W Only"}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-gray-600 flex items-center gap-2"><FiSettings className="text-gray-400" /> Duplexing</span>
                                            <span className={`font-semibold ${printer.supports_duplex ? "text-blue-600" : "text-gray-500"}`}>{printer.supports_duplex ? "Supported" : "Manual"}</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-full bg-white rounded-2xl shadow-sm border border-gray-200 p-12 text-center">
                                <div className="flex flex-col items-center">
                                    <div className="bg-gray-100 border-2 border-dashed border-gray-300 rounded-2xl w-20 h-20 flex items-center justify-center mb-6"><FiPrinter className="text-gray-400 text-3xl" /></div>
                                    <h3 className="text-xl font-semibold text-gray-900 mb-2">No Printers Connected</h3>
                                    <p className="text-gray-600 mb-6">Click 'Add Printer' to register hardware connected to your local Windows Print Spooler.</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* TAB: QR POSTER */}
                {activeTab === 'qr' && (
                    <GeneratePrintQR centreId={centreId} />
                )}

                {/* Add/Edit Printer Modal */}
                {isModalOpen && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn scrollbar-hide">
                        <div className="bg-white rounded-3xl w-full max-w-lg shadow-2xl border border-gray-200 overflow-hidden">
                            <div className="p-6 border-b border-gray-100 flex justify-between items-center">
                                <h2 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
                                    <FiPrinter className="text-blue-600" /> {editingId ? 'Edit Printer' : 'Add New Printer'}
                                </h2>
                                <button onClick={() => setIsModalOpen(false)} className="text-gray-400 hover:text-gray-500 text-2xl p-2 hover:bg-gray-100 rounded-xl transition-all">
                                    <FiXCircle />
                                </button>
                            </div>
                            
                            <form onSubmit={handlePrinterSubmit} className="p-6 space-y-5">
                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Display Name</label>
                                    <input type="text" required placeholder="e.g., Main Counter B&W" className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white" value={printerForm.name} onChange={(e) => setPrinterForm({...printerForm, name: e.target.value})} />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Windows Spooler Driver Name</label>
                                    <input type="text" required placeholder="e.g., Canon iR2270/2870 PCL5e" className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white font-mono text-sm" value={printerForm.driver_name} onChange={(e) => setPrinterForm({...printerForm, driver_name: e.target.value})} />
                                    <p className="text-xs text-gray-500 mt-1">Must exactly match the name shown in the local PC's "Printers & scanners" settings.</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-gray-700 mb-2">Supported Paper Sizes</label>
                                    <input type="text" required placeholder="e.g., A4, A3" className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white" value={printerForm.paper_sizes} onChange={(e) => setPrinterForm({...printerForm, paper_sizes: e.target.value})} />
                                </div>

                                <div className="grid grid-cols-2 gap-4 pt-2">
                                    <label className="flex items-center space-x-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition">
                                        <input type="checkbox" className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" checked={printerForm.supports_color} onChange={(e) => setPrinterForm({...printerForm, supports_color: e.target.checked})} />
                                        <span className="font-medium text-gray-700">Supports Color</span>
                                    </label>
                                    <label className="flex items-center space-x-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition">
                                        <input type="checkbox" className="w-5 h-5 text-blue-600 rounded focus:ring-blue-500" checked={printerForm.supports_duplex} onChange={(e) => setPrinterForm({...printerForm, supports_duplex: e.target.checked})} />
                                        <span className="font-medium text-gray-700">Supports Duplex</span>
                                    </label>
                                </div>

                                {editingId && (
                                    <div>
                                        <label className="block text-sm font-semibold text-gray-700 mb-2">Status</label>
                                        <select className="w-full px-4 py-3 border border-gray-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all bg-white" value={printerForm.status} onChange={(e) => setPrinterForm({...printerForm, status: e.target.value})}>
                                            <option value="ACTIVE">ACTIVE</option>
                                            <option value="OFFLINE">OFFLINE</option>
                                        </select>
                                    </div>
                                )}

                                <div className="pt-4 flex justify-end gap-3">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 border border-gray-300 text-gray-700 font-medium rounded-xl hover:bg-gray-50 transition">Cancel</button>
                                    <button type="submit" disabled={isSubmitting} className="px-6 py-3 bg-blue-600 text-white font-medium rounded-xl hover:bg-blue-700 transition disabled:opacity-50 flex items-center gap-2">
                                        {isSubmitting ? <><span className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></span> Saving...</> : 'Save Printer'}
                                    </button>
                                </div>
                            </form>
                        </div>
                    </div>
                )}
            </div>
            
            <style jsx>{`
                .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
                .scrollbar-hide::-webkit-scrollbar { display: none; }
            `}</style>
        </div>
    );
};

export default AdminPrintSettings;