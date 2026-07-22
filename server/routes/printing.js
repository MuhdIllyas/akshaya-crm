import express from 'express';
import multer from 'multer';
import fs from 'fs';
import path from 'path';

// Robust ESM/CJS Import for pdf-parse
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const rawPdfParse = require('pdf-parse');

// Safely unwrap the function regardless of how the Node environment packages it
const pdfParse = typeof rawPdfParse === 'function' 
    ? rawPdfParse 
    : (rawPdfParse.default || rawPdfParse.PDFParse);

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
        const { centre_id, customer_name, phone, copies, color, paper_size, duplex } = req.body;

        if (!file) return res.status(400).json({ error: 'No document uploaded' });

        // Convert string payloads from FormData to proper booleans
        const isColor = color === 'true';
        const isDuplex = duplex === 'true';
        const selectedPaperSize = paper_size || 'A4';
        const totalCopies = parseInt(copies) || 1;

        // A. Read the PDF to get the page count (WITH SAFETY FALLBACK)
        const dataBuffer = fs.readFileSync(file.path);
        let numPages = 1; // Default to 1 page if anything fails
        
        try {
            if (typeof pdfParse === 'function') {
                const pdfData = await pdfParse(dataBuffer);
                numPages = pdfData.numpages || 1;
            } else {
                console.warn("[Print Module] pdf-parse unwrap failed. Defaulting to 1 page.");
            }
        } catch (parseError) {
            console.error("[Print Module] Could not read PDF pages (possibly corrupted/encrypted). Defaulting to 1 page.");
        }

        // B. Dynamic Pricing Logic (Fetch from printing_prices table)
        const priceQuery = `
            SELECT price_per_page, duplex_price 
            FROM printing_prices 
            WHERE centre_id = $1 AND paper_size = $2 AND color = $3 
            LIMIT 1
        `;
        const priceResult = await req.db.query(priceQuery, [centre_id, selectedPaperSize, isColor]);
        
        if (priceResult.rows.length === 0) {
            return res.status(400).json({ error: 'Pricing not configured for this selection' });
        }

        const { price_per_page, duplex_price } = priceResult.rows[0];

        // Calculate Total Price (Duplex is charged per physical sheet of paper)
        let totalPrice = 0;
        if (isDuplex) {
            // A 5 page document double-sided uses 3 physical sheets of paper
            const sheets = Math.ceil(numPages / 2);
            totalPrice = sheets * parseFloat(duplex_price) * totalCopies;
        } else {
            totalPrice = numPages * parseFloat(price_per_page) * totalCopies;
        }

        // C. Auto-Select Printer dynamically (Fetch from printers table)
        const printerQuery = `
            SELECT id 
            FROM printers 
            WHERE centre_id = $1 
              AND supports_color = $2 
              AND paper_sizes LIKE $3 
              AND status = 'ACTIVE'
            LIMIT 1
        `;
        const printerResult = await req.db.query(printerQuery, [centre_id, isColor, `%${selectedPaperSize}%`]);

        if (printerResult.rows.length === 0) {
            return res.status(400).json({ error: 'No compatible printer available at this centre for your selection' });
        }

        const targetPrinterId = printerResult.rows[0].id;

        // D. Save the job to PostgreSQL using your existing req.db
        const insertQuery = `
            INSERT INTO print_jobs 
            (centre_id, customer_name, phone, filename, filepath, printer_id, copies, paper_size, color, duplex, pages, price, status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, 'WAITING')
            RETURNING id, status, price, pages;
        `;
        
        // Note: Using 'uploads/printjobs/filename' so it works with your static file server
        const relativePath = `uploads/printjobs/${file.filename}`;
        
        const values = [
            centre_id, 
            customer_name, 
            phone, 
            file.originalname, 
            relativePath, 
            targetPrinterId, 
            totalCopies, 
            selectedPaperSize,
            isColor,
            isDuplex,
            numPages, 
            totalPrice
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

/* ================================
   ADMIN SETTINGS ENDPOINTS
================================ */

// PUT: Update pricing matrix
router.put('/settings/prices/:centre_id', async (req, res) => {
    try {
        const { centre_id } = req.params;
        const { prices } = req.body; // Array of price objects

        // Start a transaction for safe updating
        await req.db.query('BEGIN');
        
        // 1. DELETE all existing prices for this centre to prevent duplicates
        await req.db.query('DELETE FROM printing_prices WHERE centre_id = $1', [centre_id]);
        
        // 2. INSERT the fresh pricing matrix
        for (const p of prices) {
            await req.db.query(`
                INSERT INTO printing_prices (centre_id, paper_size, color, price_per_page, duplex_price)
                VALUES ($1, $2, $3, $4, $5)
            `, [centre_id, p.paper_size, p.color, p.price_per_page, p.duplex_price]);
        }
        
        // 3. Commit the changes
        await req.db.query('COMMIT');
        res.json({ success: true });
    } catch (error) {
        await req.db.query('ROLLBACK');
        console.error("Pricing Update Error:", error);
        res.status(500).json({ error: 'Failed to update prices' });
    }
});

// POST: Add a new printer to a centre
router.post('/settings/printers', async (req, res) => {
    try {
        const { 
            centre_id, 
            name, 
            driver_name, 
            paper_sizes, 
            supports_color, 
            supports_duplex 
        } = req.body;

        const insertQuery = `
            INSERT INTO printers 
            (centre_id, name, driver_name, paper_sizes, supports_color, supports_duplex, status)
            VALUES ($1, $2, $3, $4, $5, $6, 'ACTIVE')
            RETURNING *;
        `;
        
        const values = [
            centre_id, 
            name, 
            driver_name, 
            paper_sizes, 
            supports_color, 
            supports_duplex
        ];

        const dbResult = await req.db.query(insertQuery, values);
        
        res.status(201).json(dbResult.rows[0]);
    } catch (error) {
        console.error("Add Printer Error:", error);
        res.status(500).json({ error: 'Failed to add printer' });
    }
});

// GET: Fetch current printers and pricing (catch‑all for :centre_id)
router.get('/settings/:centre_id', async (req, res) => {
    try {
        const { centre_id } = req.params;
        
        const printersResult = await req.db.query(
            `SELECT * FROM printers WHERE centre_id = $1 ORDER BY id ASC`, 
            [centre_id]
        );
        
        const pricesResult = await req.db.query(
            `SELECT * FROM printing_prices WHERE centre_id = $1`, 
            [centre_id]
        );

        res.json({
            printers: printersResult.rows,
            prices: pricesResult.rows
        });
    } catch (error) {
        console.error("Settings Fetch Error:", error);
        res.status(500).json({ error: 'Failed to load settings' });
    }
});

export default router;