import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Replace with your actual VPS API URL
const API_BASE_URL = import.meta.env.VITE_API_URL;
 if (!API_BASE_URL) {
    throw new Error("VITE_API_URL is not defined");
}

const centreId = localStorage.getItem("centre_id") || 1;

export default function SelfServicePrint() {
    const [file, setFile] = useState(null);
    const [copies, setCopies] = useState(1);
    const [color, setColor] = useState(false);
    const [paperSize, setPaperSize] = useState('A4'); 
    const [duplex, setDuplex] = useState(false); 
    const [pageRange, setPageRange] = useState(''); 

    // UI State
    const [loading, setLoading] = useState(false);
    const [confirming, setConfirming] = useState(false);
    const [error, setError] = useState('');
    
    // Job State
    const [jobDetails, setJobDetails] = useState(null);

    const handleFileChange = (e) => {
        const selectedFile = e.target.files[0];
        if (selectedFile && selectedFile.type !== 'application/pdf') {
            setError('Please upload a PDF file only.');
            setFile(null);
            return;
        }
        setError('');
        setFile(selectedFile);
    };

    // STEP 1: Upload and Calculate (Creates DRAFT)
    const handleCalculate = async (e) => {
        e.preventDefault();
        if (!file) return setError('Please select a file first.');

        setLoading(true);
        setError('');

        const formData = new FormData();
        formData.append('document', file);
        formData.append('centre_id', centreId);
        formData.append('copies', copies);
        formData.append('color', color);
        formData.append('paper_size', paperSize); 
        formData.append('duplex', duplex);       
        formData.append('page_range', pageRange || 'ALL'); 

        try {
            const response = await axios.post(`${API_BASE_URL}/api/printing/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            // This will set the job status to 'DRAFT'
            setJobDetails(response.data);
        } catch (err) {
            setError(err.response?.data?.error || 'Calculation failed. Please try again.');
        } finally {
            setLoading(false);
        }
    };

    // STEP 2: Confirm and send to queue (Updates to WAITING)
    const handleConfirmPrint = async () => {
        setConfirming(true);
        try {
            const response = await axios.post(`${API_BASE_URL}/api/printing/confirm`, {
                jobId: jobDetails.jobId
            });
            setJobDetails(prev => ({ ...prev, status: response.data.status }));
        } catch (err) {
            setError('Failed to confirm print job.');
        } finally {
            setConfirming(false);
        }
    };

    // Cancel Job (Allows user to go back and change settings)
    const handleCancel = () => {
        setJobDetails(null);
        setError('');
    };

    // POLLING: Only poll if the status is actually WAITING in the queue
    useEffect(() => {
        let interval;
        if (jobDetails && jobDetails.jobId && jobDetails.status === 'WAITING') {
            interval = setInterval(async () => {
                try {
                    const res = await axios.get(`${API_BASE_URL}/api/printing/status/${jobDetails.jobId}`);
                    setJobDetails(prev => ({ ...prev, status: res.data.status }));
                    if (res.data.status === 'COMPLETED') clearInterval(interval);
                } catch (err) {
                    console.error("Status check failed", err);
                }
            }, 3000);
        }
        return () => clearInterval(interval);
    }, [jobDetails]);

    /* =========================================
       VIEW: SUMMARY & STATUS (DRAFT, WAITING, COMPLETED)
    ========================================= */
    if (jobDetails) {
        return (
            <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center justify-center">
                <div className="max-w-md w-full bg-white rounded-xl shadow-md p-8 text-center border border-gray-100">
                    
                    {/* Dynamic Header based on status */}
                    <h2 className="text-2xl font-bold text-gray-800 mb-2">
                        {jobDetails.status === 'DRAFT' ? 'Confirm Details' : 'Print Job Status'}
                    </h2>
                    
                    {jobDetails.status === 'DRAFT' && (
                        <p className="text-sm text-gray-500 mb-6">Please review the final price before printing.</p>
                    )}

                    <div className="space-y-4 mb-8 text-left bg-gray-50 p-5 rounded-xl border border-gray-100">
                        <div className="flex justify-between border-b border-gray-200 pb-3">
                            <span className="text-gray-600 font-medium">Pages Billed:</span>
                            <span className="font-bold text-gray-800">
                                {jobDetails.pages} {jobDetails.pageRange && jobDetails.pageRange !== 'ALL' ? <span className="text-xs text-gray-500 font-normal ml-1">(Range: {jobDetails.pageRange})</span> : ''}
                            </span>
                        </div>
                        <div className="flex justify-between border-b border-gray-200 pb-3">
                            <span className="text-gray-600 font-medium">Options:</span>
                            <span className="font-semibold text-gray-800 text-sm">
                                {paperSize} | {color ? 'Color' : 'B&W'} | {duplex ? 'Double-Sided' : 'Single'}
                            </span>
                        </div>
                        <div className="flex justify-between pt-1">
                            <span className="text-gray-600 font-medium text-lg">Total Cost:</span>
                            <span className="font-bold text-blue-700 text-2xl">₹{jobDetails.totalPrice}</span>
                        </div>
                    </div>

                    {/* STATUS: DRAFT (Waiting for user confirmation) */}
                    {jobDetails.status === 'DRAFT' && (
                        <div className="space-y-3">
                            {error && <p className="text-red-500 text-sm mb-3">{error}</p>}
                            <button 
                                onClick={handleConfirmPrint} 
                                disabled={confirming}
                                className="w-full bg-green-600 text-white font-bold py-3.5 rounded-xl shadow-md hover:bg-green-700 transition disabled:opacity-50"
                            >
                                {confirming ? 'Sending to Printer...' : 'Confirm & Print Now'}
                            </button>
                            <button 
                                onClick={handleCancel} 
                                disabled={confirming}
                                className="w-full bg-white text-gray-600 border border-gray-300 font-semibold py-3 rounded-xl hover:bg-gray-50 transition disabled:opacity-50"
                            >
                                Cancel & Change Settings
                            </button>
                        </div>
                    )}

                    {/* STATUS: WAITING (In the physical print queue) */}
                    {jobDetails.status === 'WAITING' && (
                        <div className="p-5 rounded-xl mb-6 flex flex-col items-center justify-center space-y-3 bg-blue-50 border border-blue-100 text-blue-800">
                            <div className="animate-spin h-8 w-8 border-4 border-blue-800 border-t-transparent rounded-full mb-2"></div>
                            <span className="font-bold text-lg">Sending to Printer...</span>
                            <span className="text-sm">Please pay at the counter while it prints.</span>
                        </div>
                    )}

                    {/* STATUS: COMPLETED */}
                    {jobDetails.status === 'COMPLETED' && (
                        <>
                            <div className="p-5 rounded-xl mb-8 flex flex-col items-center justify-center space-y-2 bg-green-50 border border-green-200 text-green-800">
                                <div className="h-12 w-12 bg-green-500 rounded-full flex items-center justify-center text-white text-2xl mb-2 shadow-inner">
                                    ✓
                                </div>
                                <span className="font-bold text-xl">Printing Completed!</span>
                                <span className="text-sm">Your document is ready for collection.</span>
                            </div>
                            <button onClick={() => window.location.reload()} className="w-full bg-blue-600 text-white font-semibold py-3.5 rounded-xl shadow hover:bg-blue-700 transition">
                                Print Another Document
                            </button>
                        </>
                    )}
                </div>
            </div>
        );
    }

    /* =========================================
       VIEW: UPLOAD FORM
    ========================================= */
    return (
        <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center justify-center">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-lg border border-gray-100 p-8">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-blue-50 text-blue-600 rounded-2xl mx-auto flex items-center justify-center mb-4">
                        <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"></path></svg>
                    </div>
                    <h1 className="text-2xl font-bold text-gray-900">Akshaya Sahayi</h1>
                    <p className="text-gray-500 mt-1">Self-Service Printing</p>
                </div>

                <form onSubmit={handleCalculate} className="space-y-6">
                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">Select PDF Document</label>
                        <input type="file" accept=".pdf" onChange={handleFileChange} className="w-full text-sm text-gray-600 file:mr-4 file:py-2.5 file:px-4 file:rounded-xl file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 border border-gray-200 rounded-xl p-2 transition-all bg-gray-50" />
                        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Copies</label>
                            <input type="number" min="1" value={copies} onChange={(e) => setCopies(e.target.value)} className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm" />
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Color Output</label>
                            <select value={color} onChange={(e) => setColor(e.target.value === 'true')} className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm">
                                <option value="false">Black & White</option>
                                <option value="true">Color</option>
                            </select>
                        </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Paper Size</label>
                            <select value={paperSize} onChange={(e) => setPaperSize(e.target.value)} className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm">
                                <option value="A4">A4</option>
                                <option value="A3">A3</option>
                            </select>
                        </div>
                        <div>
                            <label className="block text-sm font-semibold text-gray-700 mb-2">Sides</label>
                            <select value={duplex} onChange={(e) => setDuplex(e.target.value === 'true')} className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm">
                                <option value="false">Single-Sided</option>
                                <option value="true">Double-Sided</option>
                            </select>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-semibold text-gray-700 mb-2">
                            Pages to Print <span className="text-gray-400 font-normal">(Optional)</span>
                        </label>
                        <input 
                            type="text" 
                            placeholder="e.g., 1-3, 5, 8 (Leave blank for ALL)" 
                            value={pageRange} 
                            onChange={(e) => setPageRange(e.target.value)} 
                            className="w-full border border-gray-300 rounded-xl p-3 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 bg-white shadow-sm" 
                        />
                    </div>

                    <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 py-4 px-4 rounded-xl shadow-md text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50 transition-all">
                        {loading ? (
                            <><div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div> Calculating...</>
                        ) : 'Calculate Price'}
                    </button>
                </form>
            </div>
        </div>
    );
}