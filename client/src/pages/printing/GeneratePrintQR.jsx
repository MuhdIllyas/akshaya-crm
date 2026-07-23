import React, { useRef } from 'react';
import { QRCodeCanvas } from 'qrcode.react';
import { FiDownload, FiPrinter } from 'react-icons/fi';

const GeneratePrintQR = () => {
    // Dynamically grab the current centre ID
    const centreId = localStorage.getItem("centre_id") || 1;
    
    // Construct the exact URL the customer needs to visit
    const printPortalUrl = `${window.location.origin}/print?centre_id=${centreId}`;
    
    const qrRef = useRef(null);

    // Download just the raw QR code image
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

    // Generate and open a beautifully styled A4 Poster for printing
    const printPoster = () => {
        const canvas = qrRef.current.querySelector('canvas');
        const dataUrl = canvas.toDataURL("image/png");
        
        // This HTML uses native CSS strictly designed for A4 paper printing
        const posterHTML = `
            <!DOCTYPE html>
            <html>
            <head>
                <title>Self Service Print Poster</title>
                <style>
                    @page { size: A4 portrait; margin: 0; }
                    body { 
                        font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; 
                        margin: 0; 
                        padding: 0; 
                        display: flex; 
                        justify-content: center; 
                        align-items: center; 
                        height: 100vh; 
                        background: #f8fafc;
                        -webkit-print-color-adjust: exact;
                        print-color-adjust: exact;
                    }
                    .poster-container { 
                        background: white;
                        border: 12px solid #1e40af; /* Navy border matches CRM */
                        border-radius: 40px; 
                        width: 85%; 
                        height: 88%; 
                        display: flex; 
                        flex-direction: column; 
                        align-items: center; 
                        padding: 50px 40px;
                        box-sizing: border-box;
                        box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                    }
                    .header { text-align: center; margin-bottom: 40px; }
                    h1 { 
                        font-size: 56px; 
                        color: #1e40af; 
                        margin: 0 0 10px 0; 
                        text-transform: uppercase; 
                        letter-spacing: 2px;
                        line-height: 1.1;
                    }
                    h2 { 
                        font-size: 28px; 
                        color: #475569; 
                        margin: 0; 
                        font-weight: 500; 
                    }
                    .qr-wrapper {
                        background: white;
                        padding: 30px;
                        border-radius: 24px;
                        border: 4px dashed #94a3b8;
                        margin-bottom: 50px;
                    }
                    img { width: 350px; height: 350px; display: block; }
                    .instructions {
                        display: flex;
                        justify-content: center;
                        gap: 30px;
                        width: 100%;
                        margin-bottom: auto;
                    }
                    .step {
                        background: #f1f5f9;
                        padding: 20px;
                        border-radius: 16px;
                        flex: 1;
                        text-align: center;
                        border: 2px solid #e2e8f0;
                    }
                    .step-num {
                        background: #1e40af;
                        color: white;
                        width: 40px;
                        height: 40px;
                        border-radius: 50%;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        font-size: 24px;
                        font-weight: bold;
                        margin: 0 auto 10px auto;
                    }
                    .step-text { font-size: 20px; color: #334155; font-weight: 600; }
                    .footer {
                        margin-top: 30px;
                        font-size: 18px;
                        color: #64748b;
                        font-weight: bold;
                        text-transform: uppercase;
                        letter-spacing: 1px;
                    }
                </style>
            </head>
            <body>
                <div class="poster-container">
                    <div class="header">
                        <h1>Self-Service<br/>Printing</h1>
                        <h2>Skip the line. Print directly from your phone.</h2>
                    </div>
                    
                    <div class="qr-wrapper">
                        <img src="${dataUrl}" alt="Scan to Print" />
                    </div>

                    <div class="instructions">
                        <div class="step">
                            <div class="step-num">1</div>
                            <div class="step-text">Scan Code</div>
                        </div>
                        <div class="step">
                            <div class="step-num">2</div>
                            <div class="step-text">Upload PDF</div>
                        </div>
                        <div class="step">
                            <div class="step-num">3</div>
                            <div class="step-text">Collect Print</div>
                        </div>
                    </div>

                    <div class="footer">
                        Akshaya Sahayi • Centre ${centreId}
                    </div>
                </div>
                <script>
                    // Automatically trigger the print dialog when the window opens
                    window.onload = function() { 
                        setTimeout(() => {
                            window.print();
                        }, 500); 
                    }
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
                <p className="text-gray-500 text-sm">
                    Print this QR code as a shop poster. Customers scan it to bypass the queue.
                </p>
            </div>

            {/* The QR Code Element (Hidden from UI design, used for canvas extraction) */}
            <div 
                ref={qrRef} 
                className="p-4 bg-white border border-gray-200 rounded-2xl mb-6 shadow-inner"
            >
                <QRCodeCanvas 
                    value={printPortalUrl} 
                    size={220} 
                    level={"H"} // High error correction so it scans even if the poster gets scratched
                    includeMargin={true}
                />
            </div>

            <p className="text-xs text-blue-600 font-mono bg-blue-50 px-3 py-2 rounded-lg mb-8 truncate max-w-full border border-blue-100">
                {printPortalUrl}
            </p>

            <div className="flex gap-4 w-full">
                <button 
                    onClick={downloadQR}
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 bg-white border-2 border-gray-200 hover:border-gray-300 hover:bg-gray-50 text-gray-700 font-semibold rounded-xl transition-all"
                >
                    <FiDownload className="text-lg" /> QR Only
                </button>
                <button 
                    onClick={printPoster}
                    className="flex-1 flex items-center justify-center gap-2 py-3.5 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl shadow-md hover:shadow-lg transition-all"
                >
                    <FiPrinter className="text-lg" /> Print Poster
                </button>
            </div>
        </div>
    );
};

export default GeneratePrintQR;