import React, { useState, useEffect } from 'react';
import axios from 'axios';

// Replace with your actual VPS API URL
const API_BASE_URL = 'https://api.akshayasahayi.com/api/printing';
// You can extract this from the URL (e.g., /print?centre=1) or hardcode it per QR code
const CENTRE_ID = 1; 

export default function SelfServicePrint() {
    const [file, setFile] = useState(null);
    const [copies, setCopies] = useState(1);
    const [color, setColor] = useState(false);
    
    // UI State
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    
    // Job State
    const [jobDetails, setJobDetails] = useState(null);

    // Handle File Selection
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

    // Handle Form Submission
    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!file) return setError('Please select a file first.');

        setLoading(true);
        setError('');

        const formData = new FormData();
        formData.append('document', file);
        formData.append('centre_id', CENTRE_ID);
        formData.append('copies', copies);
        formData.append('color', color);
        // Optional: Add a field for customer name/phone if you want to track it

        try {
            const response = await axios.post(`${API_BASE_URL}/upload`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            
            setJobDetails(response.data);
        } catch (err) {
            setError('Upload failed. Please try again.');
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    // Poll for status updates once a job is created
    useEffect(() => {
        let interval;
        
        if (jobDetails && jobDetails.jobId && jobDetails.status !== 'COMPLETED') {
            interval = setInterval(async () => {
                try {
                    const res = await axios.get(`${API_BASE_URL}/status/${jobDetails.jobId}`);
                    
                    setJobDetails(prev => ({
                        ...prev,
                        status: res.data.status
                    }));

                    if (res.data.status === 'COMPLETED') {
                        clearInterval(interval);
                    }
                } catch (err) {
                    console.error("Status check failed", err);
                }
            }, 3000); // Check every 3 seconds
        }

        return () => clearInterval(interval);
    }, [jobDetails]);

    // --- VIEW 1: Status Screen (After Upload) ---
    if (jobDetails) {
        return (
            <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center justify-center">
                <div className="max-w-md w-full bg-white rounded-xl shadow-md p-8 text-center">
                    <h2 className="text-2xl font-bold text-gray-800 mb-6">Print Job Status</h2>
                    
                    <div className="space-y-4 mb-8">
                        <div className="flex justify-between border-b pb-2">
                            <span className="text-gray-600">Pages Detected:</span>
                            <span className="font-semibold text-gray-800">{jobDetails.pages}</span>
                        </div>
                        <div className="flex justify-between border-b pb-2">
                            <span className="text-gray-600">Total Price:</span>
                            <span className="font-semibold text-green-600 text-xl">₹{jobDetails.totalPrice}</span>
                        </div>
                    </div>

                    <div className="p-4 rounded-lg mb-6 flex items-center justify-center space-x-3
                        ${jobDetails.status === 'COMPLETED' ? 'bg-green-100 text-green-800' : 'bg-blue-50 text-blue-800'}">
                        
                        {jobDetails.status === 'WAITING' && (
                            <>
                                <div className="animate-spin h-5 w-5 border-2 border-blue-800 border-t-transparent rounded-full"></div>
                                <span className="font-medium">Waiting to Print... (Pay at Counter)</span>
                            </>
                        )}
                        
                        {jobDetails.status === 'COMPLETED' && (
                            <span className="font-medium text-lg">✅ Printing Completed!</span>
                        )}
                    </div>

                    {jobDetails.status === 'COMPLETED' && (
                        <button 
                            onClick={() => window.location.reload()}
                            className="w-full bg-indigo-600 text-white font-semibold py-3 rounded-lg shadow hover:bg-indigo-700 transition"
                        >
                            Print Another Document
                        </button>
                    )}
                </div>
            </div>
        );
    }

    // --- VIEW 2: Upload Screen (Initial State) ---
    return (
        <div className="min-h-screen bg-gray-50 p-6 flex flex-col items-center justify-center">
            <div className="max-w-md w-full bg-white rounded-xl shadow-md p-8">
                <div className="text-center mb-8">
                    <h1 className="text-2xl font-bold text-gray-800">Akshaya Sahayi</h1>
                    <p className="text-gray-500 mt-1">Self-Service Printing</p>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* File Upload */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">Select PDF Document</label>
                        <input 
                            type="file" 
                            accept=".pdf"
                            onChange={handleFileChange}
                            className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-md file:border-0 file:text-sm file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 border border-gray-300 rounded-md p-2"
                        />
                        {error && <p className="text-red-500 text-sm mt-2">{error}</p>}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        {/* Copies */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Copies</label>
                            <input 
                                type="number" 
                                min="1" 
                                value={copies} 
                                onChange={(e) => setCopies(e.target.value)}
                                className="w-full border border-gray-300 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500"
                            />
                        </div>

                        {/* Color Selection */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Type</label>
                            <select 
                                value={color} 
                                onChange={(e) => setColor(e.target.value === 'true')}
                                className="w-full border border-gray-300 rounded-md p-2 focus:ring-indigo-500 focus:border-indigo-500"
                            >
                                <option value="false">Black & White</option>
                                <option value="true">Color (₹10/pg)</option>
                            </select>
                        </div>
                    </div>

                    <button 
                        type="submit" 
                        disabled={loading}
                        className="w-full flex justify-center py-3 px-4 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500 disabled:opacity-50"
                    >
                        {loading ? 'Uploading & Calculating...' : 'Upload & Get Price'}
                    </button>
                </form>
            </div>
        </div>
    );
}