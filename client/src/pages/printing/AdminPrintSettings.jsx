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
    FiDownload,
    FiMonitor
} from 'react-icons/fi';
import PrintStations, { PrinterNamePicker } from './PrintStations';
import { buildPosterHTML } from './printPoster';

/* ================================
   QR POSTER COMPONENT
================================ */
const GeneratePrintQR = ({ centreId }) => {
    const printPortalUrl = `${window.location.origin}/print?centre_id=${centreId}`;
    const qrRef = useRef(null);
    const [centreName, setCentreName] = useState('');
    const [qrDataUrl, setQrDataUrl] = useState('');

    // Real centre name for the poster (public endpoint, no login needed)
    useEffect(() => {
        axios.get(`${import.meta.env.VITE_API_URL}/api/printing/public/centre/${centreId}`)
            .then(res => setCentreName(res.data?.centre?.name || ''))
            .catch(() => setCentreName(''));
    }, [centreId]);

    // Grab the QR image once the canvas has drawn
    useEffect(() => {
        const canvas = qrRef.current?.querySelector('canvas');
        if (canvas) setQrDataUrl(canvas.toDataURL('image/png'));
    }, [printPortalUrl]);

    const displayName = centreName || `Centre ${centreId}`;
    const fileSafeName = displayName.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');

    const downloadQR = () => {
        const link = document.createElement('a');
        link.href = qrDataUrl;
        link.download = `Print-QR-${fileSafeName}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const printPoster = () => {
        const w = window.open('', '_blank');
        if (!w) {
            toast.error('Please allow pop-ups for this site to print the poster', { position: 'top-right', autoClose: 5000, theme: 'light' });
            return;
        }
        w.document.open();
        w.document.write(buildPosterHTML({ qrDataUrl, centreName: displayName, autoPrint: true }));
        w.document.close();
    };

    const previewHtml = qrDataUrl ? buildPosterHTML({ qrDataUrl, centreName: displayName }) : '';
    const SCALE = 0.42; // A4 = 794 x 1123 px

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6 items-start">
            {/* Live preview */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mx-auto">
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100" style={{ width: 794 * SCALE, height: 1123 * SCALE }}>
                    {previewHtml ? (
                        <iframe
                            title="Poster preview"
                            srcDoc={previewHtml}
                            style={{ width: 794, height: 1123, border: 0, transform: `scale(${SCALE})`, transformOrigin: 'top left', pointerEvents: 'none' }}
                        />
                    ) : (
                        <div className="h-full flex items-center justify-center text-sm text-slate-500">Preparing preview…</div>
                    )}
                </div>
                <p className="text-xs text-slate-500 text-center mt-3">A4 poster preview</p>
            </div>

            {/* Actions */}
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Self-Service Poster</h2>
                <p className="text-slate-500 text-sm mb-6">
                    Print this A4 poster for <b className="text-slate-700">{displayName}</b>. It shows customers how to print from their phone, in English and Malayalam.
                </p>

                <div className="flex items-center gap-4 mb-6">
                    <div ref={qrRef} className="p-2 bg-white border border-slate-200 rounded-xl shrink-0">
                        <QRCodeCanvas value={printPortalUrl} size={600} level={"H"} includeMargin={true} style={{ width: 120, height: 120 }} />
                    </div>
                    <p className="text-xs text-navy-700 font-mono bg-slate-100 px-3 py-2 rounded-lg break-all border border-slate-200">
                        {printPortalUrl}
                    </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
                    <button onClick={downloadQR} disabled={!qrDataUrl} className="flex-1 flex items-center justify-center gap-2 py-3 px-4 min-h-[44px] bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-xl transition-all disabled:opacity-50">
                        <FiDownload className="text-lg" /> QR Only
                    </button>
                    <button onClick={printPoster} disabled={!qrDataUrl} className="flex-1 flex items-center justify-center gap-2 py-3 px-4 min-h-[44px] bg-navy-700 hover:bg-navy-800 text-white font-semibold rounded-xl shadow-sm transition-all disabled:opacity-50">
                        <FiPrinter className="text-lg" /> Print Poster
                    </button>
                </div>
                <p className="text-xs text-slate-500 mt-4">
                    Tip: in the print window choose <b>A4</b>, margins <b>None</b>, and tick <b>Background graphics</b>. To save a PDF, pick "Save as PDF" as the printer.
                </p>
            </div>
        </div>
    );
};


/* ================================
   MAIN SETTINGS COMPONENT
================================ */
const AdminPrintSettings = () => {
    const [activeTab, setActiveTab] = useState('pricing'); // 'pricing', 'routing', 'stations' or 'qr'
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
            <span className={`${isActive ? 'bg-emerald-50 text-emerald-700 border-emerald-200' : 'bg-rose-50 text-rose-700 border-rose-200'} text-xs font-medium px-3 py-1.5 rounded-full flex items-center w-fit border`}>
                <span className={`w-2 h-2 ${isActive ? 'bg-emerald-500' : 'bg-rose-500'} rounded-full mr-2`}></span>
                {status || 'OFFLINE'}
            </span>
        );
    };

    if (loading) {
        return (
            <div className="min-h-[40vh] flex items-center justify-center">
                <div className="flex flex-col items-center">
                    <svg className="animate-spin h-8 w-8 text-navy-700 mb-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <span className="text-slate-600 font-medium">Loading settings...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="w-full scrollbar-hide">
            <div className="max-w-7xl mx-auto">
                
                {/* Header Section */}
                <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 mb-6 sm:mb-8">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Print Settings</h1>
                        <p className="text-slate-600 mt-1 text-sm sm:text-base">Manage printing prices, hardware, and routing rules</p>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-3 shrink-0">
                        {/* Tab Switcher */}
                        <div className="flex bg-white rounded-xl p-1 border border-slate-200">
                            <button
                                onClick={() => setActiveTab('pricing')}
                                className={`px-3 py-2 min-h-[40px] rounded-lg flex items-center gap-2 transition-all ${
                                    activeTab === 'pricing' ? "bg-navy-700 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                                }`}
                            >
                                <FiDollarSign className="text-lg" />
                                <span className="text-sm font-medium hidden sm:inline">Pricing Matrix</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('routing')}
                                className={`px-3 py-2 min-h-[40px] rounded-lg flex items-center gap-2 transition-all ${
                                    activeTab === 'routing' ? "bg-navy-700 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                                }`}
                            >
                                <FiPrinter className="text-lg" />
                                <span className="text-sm font-medium hidden sm:inline">Hardware</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('stations')}
                                className={`px-3 py-2 min-h-[40px] rounded-lg flex items-center gap-2 transition-all ${
                                    activeTab === 'stations' ? "bg-navy-700 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                                }`}
                            >
                                <FiMonitor className="text-lg" />
                                <span className="text-sm font-medium hidden sm:inline">Print Stations</span>
                            </button>
                            <button
                                onClick={() => setActiveTab('qr')}
                                className={`px-3 py-2 min-h-[40px] rounded-lg flex items-center gap-2 transition-all ${
                                    activeTab === 'qr' ? "bg-navy-700 text-white shadow-sm" : "text-slate-500 hover:text-slate-700 hover:bg-slate-50"
                                }`}
                            >
                                <FiSmartphone className="text-lg" />
                                <span className="text-sm font-medium hidden sm:inline">QR Poster</span>
                            </button>
                        </div>

                        {/* Conditional Action Button based on Tab */}
                        {activeTab === 'pricing' && (
                            <button onClick={savePrices} className="flex items-center gap-2 px-4 sm:px-6 py-2.5 min-h-[44px] rounded-xl font-semibold text-white bg-navy-700 hover:bg-navy-800 shadow-sm transition-all group">
                                <FiSave className="text-lg group-hover:scale-110 transition-transform" />
                                <span className="hidden sm:inline">Save Matrix</span>
                            </button>
                        )}
                        {activeTab === 'routing' && (
                            <button onClick={openAddModal} className="flex items-center gap-2 px-4 sm:px-6 py-2.5 min-h-[44px] rounded-xl font-semibold text-white bg-navy-700 hover:bg-navy-800 shadow-sm transition-all group">
                                <FiPlus className="text-lg group-hover:scale-110 transition-transform" />
                                <span className="hidden sm:inline">Add Printer</span>
                            </button>
                        )}
                        {/* No header button for QR tab as actions are on the component itself */}
                    </div>
                </div>

                {/* TAB: PRICING */}
                {activeTab === 'pricing' && (
                    <div className="bg-white rounded-2xl shadow-sm border border-slate-200 overflow-hidden mb-8">
                        <div className="p-4 sm:p-6 border-b border-slate-200">
                            <h3 className="text-lg font-semibold text-slate-800">Customer Facing Prices (₹)</h3>
                            <p className="text-sm text-slate-500 mt-1">Adjust the costs per page for different paper sizes and color options.</p>
                        </div>
                        <div className="md:hidden divide-y divide-slate-100">
                            {prices.map((p, idx) => (
                                <div key={idx} className="p-4">
                                    <div className="flex items-center justify-between gap-2 mb-3">
                                        <div className="flex items-center">
                                            <FiFileText className="text-slate-400 mr-2 text-lg" />
                                            <span className="font-semibold text-slate-800">{p.paper_size}</span>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${p.color ? 'bg-slate-100 text-navy-700 border-slate-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                            {p.color ? 'Color' : 'Black & White'}
                                        </span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        <label className="block">
                                            <span className="block text-xs font-medium text-slate-500 mb-1">Single sided (per pg)</span>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <span className="text-slate-500">₹</span>
                                                </div>
                                                <input
                                                    type="number"
                                                    inputMode="decimal"
                                                    className="w-full pl-8 pr-3 py-2.5 min-h-[44px] text-base border border-slate-300 rounded-xl focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 transition-all bg-white font-medium text-slate-800"
                                                    value={p.price_per_page}
                                                    onChange={(e) => handlePriceChange(idx, 'price_per_page', e.target.value)}
                                                />
                                            </div>
                                        </label>
                                        <label className="block">
                                            <span className="block text-xs font-medium text-slate-500 mb-1">Double sided (per sheet)</span>
                                            <div className="relative">
                                                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                    <span className="text-slate-500">₹</span>
                                                </div>
                                                <input
                                                    type="number"
                                                    inputMode="decimal"
                                                    className="w-full pl-8 pr-3 py-2.5 min-h-[44px] text-base border border-slate-300 rounded-xl focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 transition-all bg-white font-medium text-slate-800"
                                                    value={p.duplex_price}
                                                    onChange={(e) => handlePriceChange(idx, 'duplex_price', e.target.value)}
                                                />
                                            </div>
                                        </label>
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div className="hidden md:block overflow-x-auto scrollbar-hide">
                            <table className="w-full text-left border-collapse">
                                <thead>
                                    <tr className="bg-slate-50 border-b border-slate-200">
                                        <th className="p-4 font-semibold text-slate-600 text-sm tracking-wider uppercase">Paper Size</th>
                                        <th className="p-4 font-semibold text-slate-600 text-sm tracking-wider uppercase">Style</th>
                                        <th className="p-4 font-semibold text-slate-600 text-sm tracking-wider uppercase">Single Sided (per pg)</th>
                                        <th className="p-4 font-semibold text-slate-600 text-sm tracking-wider uppercase">Double Sided (per sheet)</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-slate-100">
                                    {prices.map((p, idx) => (
                                        <tr key={idx} className="hover:bg-slate-50/50 transition-colors">
                                            <td className="p-4">
                                                <div className="flex items-center">
                                                    <FiFileText className="text-slate-400 mr-3 text-lg" />
                                                    <span className="font-semibold text-slate-800">{p.paper_size}</span>
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${p.color ? 'bg-slate-100 text-navy-700 border-slate-200' : 'bg-slate-100 text-slate-700 border-slate-200'}`}>
                                                    {p.color ? 'Color' : 'Black & White'}
                                                </span>
                                            </td>
                                            <td className="p-4">
                                                <div className="relative w-32">
                                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                        <span className="text-slate-500">₹</span>
                                                    </div>
                                                    <input 
                                                        type="number" 
                                                        className="w-full pl-8 pr-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 transition-all bg-white font-medium text-slate-800"
                                                        value={p.price_per_page} 
                                                        onChange={(e) => handlePriceChange(idx, 'price_per_page', e.target.value)}
                                                    />
                                                </div>
                                            </td>
                                            <td className="p-4">
                                                <div className="relative w-32">
                                                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                                                        <span className="text-slate-500">₹</span>
                                                    </div>
                                                    <input 
                                                        type="number" 
                                                        className="w-full pl-8 pr-4 py-2 border border-slate-300 rounded-xl focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 transition-all bg-white font-medium text-slate-800"
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
                                <div key={printer.id} className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-6 transition-all hover:shadow-md group relative">
                                    <div className="absolute top-4 right-4 flex space-x-2 opacity-100 md:opacity-0 md:group-hover:opacity-100 focus-within:opacity-100 transition-opacity">
                                        <button onClick={() => openEditModal(printer)} className="p-2.5 min-h-[40px] min-w-[40px] flex items-center justify-center bg-slate-100 text-navy-700 hover:bg-slate-200 rounded-lg transition" title="Edit Printer"><FiEdit2 /></button>
                                        <button onClick={() => handleDeletePrinter(printer.id)} className="p-2.5 min-h-[40px] min-w-[40px] flex items-center justify-center bg-slate-100 text-rose-600 hover:bg-rose-100 rounded-lg transition" title="Delete Printer"><FiTrash2 /></button>
                                    </div>
                                    <div className="flex justify-between items-start mb-4">
                                        <div className="w-12 h-12 bg-slate-100 text-navy-700 rounded-xl flex items-center justify-center text-2xl border border-slate-200"><FiPrinter /></div>
                                    </div>
                                    <div className="flex flex-wrap justify-between items-center gap-2 mb-1">
                                        <h3 className="font-bold text-slate-900 text-xl truncate pr-2 min-w-0">{printer.name}</h3>
                                        {getStatusBadge(printer.status)}
                                    </div>
                                    <p className="text-sm text-slate-500 font-mono mb-4 truncate" title={printer.driver_name}>Driver: {printer.driver_name}</p>
                                    <div className="space-y-3 pt-4 border-t border-slate-100">
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-slate-600 flex items-center gap-2"><FiSettings className="text-slate-400" /> Paper Sizes</span>
                                            <span className="font-semibold text-slate-800">{printer.paper_sizes}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-slate-600 flex items-center gap-2"><FiSettings className="text-slate-400" /> Color Output</span>
                                            <span className={`font-semibold ${printer.supports_color ? "text-navy-700" : "text-slate-500"}`}>{printer.supports_color ? "Supported" : "B&W Only"}</span>
                                        </div>
                                        <div className="flex items-center justify-between text-sm">
                                            <span className="text-slate-600 flex items-center gap-2"><FiSettings className="text-slate-400" /> Duplexing</span>
                                            <span className={`font-semibold ${printer.supports_duplex ? "text-navy-700" : "text-slate-500"}`}>{printer.supports_duplex ? "Supported" : "Manual"}</span>
                                        </div>
                                    </div>
                                </div>
                            ))
                        ) : (
                            <div className="col-span-full bg-white rounded-2xl shadow-sm border border-slate-200 p-12 text-center">
                                <div className="flex flex-col items-center">
                                    <div className="bg-slate-100 border-2 border-dashed border-slate-300 rounded-2xl w-20 h-20 flex items-center justify-center mb-6"><FiPrinter className="text-slate-400 text-3xl" /></div>
                                    <h3 className="text-xl font-semibold text-slate-900 mb-2">No Printers Connected</h3>
                                    <p className="text-slate-600 mb-6">Pair the shop PC in the 'Print Stations' tab first, then click 'Add Printer' and pick it from the list.</p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* TAB: PRINT STATIONS (PCs running the print agent) */}
                {activeTab === 'stations' && (
                    <PrintStations centreId={centreId} />
                )}

                {/* TAB: QR POSTER */}
                {activeTab === 'qr' && (
                    <GeneratePrintQR centreId={centreId} />
                )}

                {/* Add/Edit Printer Modal */}
                {isModalOpen && (
                    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fadeIn scrollbar-hide">
                        <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl border border-slate-200 max-h-[90dvh] overflow-y-auto">
                            <div className="p-4 sm:p-6 border-b border-slate-100 flex justify-between items-center sticky top-0 bg-white z-10">
                                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 flex items-center gap-2">
                                    <FiPrinter className="text-navy-700" /> {editingId ? 'Edit Printer' : 'Add New Printer'}
                                </h2>
                                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-500 text-2xl p-2 min-h-[44px] min-w-[44px] flex items-center justify-center hover:bg-slate-100 rounded-xl transition-all">
                                    <FiXCircle />
                                </button>
                            </div>
                            
                            <form onSubmit={handlePrinterSubmit} className="p-4 sm:p-6 space-y-5">
                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Display Name</label>
                                    <input type="text" required placeholder="e.g., Main Counter B&W" className="w-full px-4 py-3 text-base sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 transition-all bg-white" value={printerForm.name} onChange={(e) => setPrinterForm({...printerForm, name: e.target.value})} />
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Windows Printer</label>
                                    <PrinterNamePicker
                                        centreId={centreId}
                                        value={printerForm.driver_name}
                                        onChange={(v) => setPrinterForm({...printerForm, driver_name: v})}
                                        className="w-full px-4 py-3 text-base sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 transition-all bg-white font-mono text-sm"
                                    />
                                    <p className="text-xs text-slate-500 mt-1">Printers reported by this centre's paired PCs. Not listed? Pair the PC in 'Print Stations'.</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-semibold text-slate-700 mb-2">Supported Paper Sizes</label>
                                    <input type="text" required placeholder="e.g., A4, A3" className="w-full px-4 py-3 text-base sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 transition-all bg-white" value={printerForm.paper_sizes} onChange={(e) => setPrinterForm({...printerForm, paper_sizes: e.target.value})} />
                                </div>

                                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 pt-2">
                                    <label className="flex items-center space-x-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition">
                                        <input type="checkbox" className="w-5 h-5 text-navy-700 rounded focus:ring-navy-500/30" checked={printerForm.supports_color} onChange={(e) => setPrinterForm({...printerForm, supports_color: e.target.checked})} />
                                        <span className="font-medium text-slate-700">Supports Color</span>
                                    </label>
                                    <label className="flex items-center space-x-3 p-3 border border-slate-200 rounded-xl cursor-pointer hover:bg-slate-50 transition">
                                        <input type="checkbox" className="w-5 h-5 text-navy-700 rounded focus:ring-navy-500/30" checked={printerForm.supports_duplex} onChange={(e) => setPrinterForm({...printerForm, supports_duplex: e.target.checked})} />
                                        <span className="font-medium text-slate-700">Supports Duplex</span>
                                    </label>
                                </div>

                                {editingId && (
                                    <div>
                                        <label className="block text-sm font-semibold text-slate-700 mb-2">Status</label>
                                        <select className="w-full px-4 py-3 text-base sm:text-sm border border-slate-300 rounded-xl focus:ring-2 focus:ring-navy-500/30 focus:border-navy-500 transition-all bg-white" value={printerForm.status} onChange={(e) => setPrinterForm({...printerForm, status: e.target.value})}>
                                            <option value="ACTIVE">ACTIVE</option>
                                            <option value="OFFLINE">OFFLINE</option>
                                        </select>
                                    </div>
                                )}

                                <div className="pt-4 flex flex-col-reverse sm:flex-row sm:justify-end gap-3">
                                    <button type="button" onClick={() => setIsModalOpen(false)} className="px-6 py-3 min-h-[44px] border border-slate-300 text-slate-700 font-medium rounded-xl hover:bg-slate-50 transition">Cancel</button>
                                    <button type="submit" disabled={isSubmitting} className="px-6 py-3 min-h-[44px] bg-navy-700 text-white font-medium rounded-xl hover:bg-navy-800 transition disabled:opacity-50 flex items-center justify-center gap-2">
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