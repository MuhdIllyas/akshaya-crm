// Settings → Posters: A4 posters a centre admin prints and puts up at the centre.
//   - Online booking poster (only when the superadmin allows it)
//   - Self-service printing poster
import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { toast } from 'react-toastify';
import { QRCodeCanvas } from 'qrcode.react';
import { FiDownload, FiPrinter, FiGlobe } from 'react-icons/fi';
import { buildPosterHTML } from './printPoster';
import { buildBookingPosterHTML } from './bookingPoster';

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
   BOOKING POSTER (the centre's online-booking QR)
   Shown only when the superadmin allows it.
================================ */
const GenerateBookingPoster = ({ poster }) => {
    const qrRef = useRef(null);
    const [qrDataUrl, setQrDataUrl] = useState('');
    const centre = poster.centre;
    const bookingUrl = `${window.location.origin}/portal/${poster.org_slug}/c/${centre.id}`;
    const fileSafeName = centre.name.replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '');

    useEffect(() => {
        const canvas = qrRef.current?.querySelector('canvas');
        if (canvas) setQrDataUrl(canvas.toDataURL('image/png'));
    }, [bookingUrl]);

    const html = (autoPrint) => buildBookingPosterHTML({ qrDataUrl, centreName: centre.name, autoPrint });

    const printPoster = () => {
        const w = window.open('', '_blank');
        if (!w) {
            toast.error('Allow pop-ups for this site to print the poster', { position: 'top-right', autoClose: 5000, theme: 'light' });
            return;
        }
        w.document.open();
        w.document.write(html(true));
        w.document.close();
    };

    const downloadQR = () => {
        const link = document.createElement('a');
        link.href = qrDataUrl;
        link.download = `Booking-QR-${fileSafeName}.png`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    };

    const SCALE = 0.42; // A4 = 794 x 1123 px

    return (
        <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-6 items-start">
            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-4 mx-auto">
                <div className="overflow-hidden rounded-lg border border-slate-200 bg-slate-100" style={{ width: 794 * SCALE, height: 1123 * SCALE }}>
                    {qrDataUrl ? (
                        <iframe
                            title="Booking poster preview"
                            srcDoc={html(false)}
                            style={{ width: 794, height: 1123, border: 0, transform: `scale(${SCALE})`, transformOrigin: 'top left', pointerEvents: 'none' }}
                        />
                    ) : (
                        <div className="h-full flex items-center justify-center text-sm text-slate-500">Preparing preview…</div>
                    )}
                </div>
                <p className="text-xs text-slate-500 text-center mt-3">A4 poster preview</p>
            </div>

            <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-5 sm:p-8">
                <h2 className="text-2xl font-bold text-slate-900 mb-2">Online Booking Poster</h2>
                <p className="text-slate-500 text-sm mb-6">
                    Print this A4 poster for <b className="text-slate-700">{centre.name}</b> and put it up at your centre. Customers scan the code
                    to register and book services with your centre, in English and Malayalam.
                </p>

                <div className="flex flex-wrap items-center gap-4 mb-6">
                    <div ref={qrRef} className="p-2 bg-white border border-slate-200 rounded-xl shrink-0">
                        <QRCodeCanvas value={bookingUrl} size={600} level={"H"} includeMargin={true} fgColor="#0f2742" style={{ width: 120, height: 120 }} />
                    </div>
                    <p className="min-w-[12rem] flex-1 text-xs text-navy-700 font-mono bg-slate-100 px-3 py-2 rounded-lg break-all border border-slate-200">
                        {bookingUrl}
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
                    Tip: in the print window choose <b>A4</b>, margins <b>None</b>,
                    and tick <b>Background graphics</b>. To save a PDF, pick "Save as PDF" as the printer.
                </p>
            </div>
        </div>
    );
};

/* ================================
   POSTERS PAGE
================================ */
const PostersSettings = () => {
    const centreId = localStorage.getItem('centre_id') || 1;
    const [bookingPoster, setBookingPoster] = useState(null); // null = not allowed / loading
    const [loaded, setLoaded] = useState(false);
    const [tab, setTab] = useState('booking');

    useEffect(() => {
        axios.get(`${import.meta.env.VITE_API_URL}/api/org-settings/booking-poster`, {
            headers: { Authorization: `Bearer ${localStorage.getItem('token')}` }
        })
            .then(res => setBookingPoster(res.data?.enabled && res.data?.centre ? res.data : null))
            .catch(() => setBookingPoster(null))
            .finally(() => setLoaded(true));
    }, []);

    const tabs = [
        ...(bookingPoster ? [{ id: 'booking', label: 'Online booking', icon: FiGlobe }] : []),
        { id: 'printing', label: 'Self-service printing', icon: FiPrinter },
    ];
    const current = tabs.some(t => t.id === tab) ? tab : tabs[0].id;

    return (
        <div className="w-full">
            <div className="max-w-7xl mx-auto">
                <div className="flex flex-col 2xl:flex-row 2xl:items-center justify-between gap-4 mb-6 sm:mb-8">
                    <div>
                        <h1 className="text-2xl md:text-3xl font-bold text-slate-900">Posters</h1>
                        <p className="text-slate-600 mt-1 text-sm sm:text-base">A4 posters with your centre's QR codes, to print and put up at the centre</p>
                    </div>
                    {loaded && tabs.length > 1 && (
                        <div className="flex max-w-full flex-wrap bg-white rounded-xl p-1 border border-slate-200 self-start">
                            {tabs.map(t => (
                                <button
                                    key={t.id}
                                    onClick={() => setTab(t.id)}
                                    className={`px-3 py-2 min-h-[40px] rounded-lg flex items-center gap-2 transition-all ${
                                        current === t.id ? 'bg-navy-700 text-white shadow-sm' : 'text-slate-500 hover:text-slate-700 hover:bg-slate-50'
                                    }`}
                                >
                                    <t.icon className="text-lg" />
                                    <span className="text-sm font-medium">{t.label}</span>
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                {!loaded ? (
                    <div className="min-h-[30vh] flex items-center justify-center text-slate-500">Loading posters…</div>
                ) : current === 'booking' && bookingPoster ? (
                    <GenerateBookingPoster poster={bookingPoster} />
                ) : (
                    <GeneratePrintQR centreId={centreId} />
                )}
            </div>
        </div>
    );
};

export default PostersSettings;
