import express from 'express';
import multer from 'multer';
import pdfParse from 'pdf-parse/lib/pdf-parse.js';
import fs from 'fs';
import path from 'path';

const router = express.Router();

// 1. Ensure the printjobs directory exists inside your current uploads folder
const uploadDir = path.join(process.cwd(), 'uploads', 'printjobs');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir, { recursive: true });
}

// 2. Configure Multer to keep the original file extension
const storage = multer.diskStorage({
    destination: (req, file, cb) => cb(null, uploadDir),
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, 'printjob-' + uniqueSuffix + path.extname(file.originalname));
    }
});
const upload = multer({ storage });

/* ================================
   CUSTOMER SELF-SERVICE ENDPOINTS
================================ */

// check if the job is done
router.get('/status/:jobId', async (req, res) => {
    try {
        const { jobId } = req.params;
        const query = `SELECT status, pages, price FROM print_jobs WHERE id = $1`;
        const result = await req.db.query(query, [jobId]);
        
        if (result.rows.length > 0) {
            res.json(result.rows[0]);
        } else {
            res.status(404).json({ error: 'Job not found' });
        }
    } catch (error) {
        res.status(500).json({ error: 'Database error' });
    }
});

// POST /api/printing/upload
router.post('/upload', upload.single('document'), async (req, res) => {
    try {
        const file = req.file;
        const { centre_id, customer_name, phone, copies, color } = req.body;

        if (!file) return res.status(400).json({ error: 'No document uploaded' });

        // A. Read the PDF to get the page count
        const dataBuffer = fs.readFileSync(file.path);
        const pdfData = await pdfParse(dataBuffer);
        const numPages = pdfData.numpages;

        // B. Calculate Pricing Logic (₹10 Color, ₹3 B&W)
        const isColor = color === 'true';
        const pricePerPage = isColor ? 10 : 3;
        const totalCopies = parseInt(copies) || 1;
        const totalPrice = numPages * pricePerPage * totalCopies;

        // C. Auto-Select Printer (1 = B&W, 2 = Color)
        const targetPrinterId = isColor ? 2 : 1;

        // D. Save the job to PostgreSQL using your existing req.db
        const insertQuery = `
            INSERT INTO print_jobs 
            (centre_id, customer_name, phone, filename, filepath, printer_id, copies, color, pages, price, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 'WAITING')
            RETURNING id, status, price, pages;
        `;
        
        // Note: Using 'uploads/printjobs/filename' so it works with your static file server
        const relativePath = `uploads/printjobs/${file.filename}`;
        
        const values = [
            centre_id, customer_name, phone, file.originalname, relativePath, 
            targetPrinterId, totalCopies, isColor, numPages, totalPrice
        ];

        const dbResult = await req.db.query(insertQuery, values);
        const savedJob = dbResult.rows[0];

        res.status(200).json({
            message: 'File processed and queued',
            jobId: savedJob.id,
            pages: savedJob.pages,
            totalPrice: savedJob.price,
            status: savedJob.status
        });

    } catch (error) {
        console.error('Print Upload Error:', error);
        res.status(500).json({ error: 'Failed to process document' });
    }
});

/* ================================
   LOCAL QUEUE WORKER ENDPOINTS
================================ */

// GET /api/printing/pending?centre_id=1
router.get('/pending', async (req, res) => {
    const { centre_id } = req.query;
    try {
        // Fetch the oldest waiting job
        const query = `
            SELECT pj.*, p.driver_name 
            FROM print_jobs pj
            LEFT JOIN printers p ON pj.printer_id = p.id
            WHERE pj.centre_id = $1 AND pj.status = 'WAITING'
            ORDER BY pj.created_at ASC
            LIMIT 1;
        `;
        const result = await req.db.query(query, [centre_id]);
        
        if (result.rows.length > 0) {
            const job = result.rows[0];
            
            // Construct the exact URL your static file server uses (e.g., /uploads/...)
            const baseUrl = `${req.protocol}://${req.get('host')}`;
            job.fileUrl = `${baseUrl}/${job.filepath}`; 
            
            res.json({ job });
        } else {
            res.json({ job: null });
        }
    } catch (error) {
        console.error("Pending Queue Error:", error);
        res.status(500).json({ error: 'Database error' });
    }
});

// POST /api/printing/complete
router.post('/complete', async (req, res) => {
    const { jobId } = req.body;
    try {
        const query = `
            UPDATE print_jobs 
            SET status = 'COMPLETED', printed_at = CURRENT_TIMESTAMP 
            WHERE id = $1
        `;
        await req.db.query(query, [jobId]);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'Failed to complete job' });
    }
});

export default router;