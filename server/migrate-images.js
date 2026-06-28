import pkg from 'pg';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

dotenv.config();
const { Pool } = pkg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || process.env.PG_URI,
  ssl: process.env.NODE_ENV === "production" ? { rejectUnauthorized: false } : false,
});

// Ensure the upload directory exists
const uploadDir = path.join(process.cwd(), 'uploads', 'staff');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

async function migrateImages() {
  console.log("🚀 Starting Base64 to File migration...");
  const client = await pool.connect();

  try {
    // Find all staff who have a base64 image (starts with 'data:image')
    const result = await client.query(`
      SELECT id, name, photo 
      FROM staff 
      WHERE photo LIKE 'data:image%'
    `);

    const staffWithBase64 = result.rows;
    console.log(`Found ${staffWithBase64.length} users with Base64 images. Processing...`);

    for (const staff of staffWithBase64) {
      try {
        const base64String = staff.photo;

        // Extract the image extension (e.g., png, jpeg) and the raw data
        const matches = base64String.match(/^data:image\/([A-Za-z-+\/]+);base64,(.+)$/);
        
        if (!matches || matches.length !== 3) {
          console.log(`⚠️ Skipping Staff ID ${staff.id} (${staff.name}) - Invalid base64 format.`);
          continue;
        }

        let extension = matches[1];
        // Handle edge cases like 'jpeg' vs 'jpg'
        if (extension === 'jpeg') extension = 'jpg';
        
        const rawBase64Data = matches[2];
        const buffer = Buffer.from(rawBase64Data, 'base64');

        // Create a unique filename
        const filename = `staff-migrated-${staff.id}-${Date.now()}.${extension}`;
        const filepath = path.join(uploadDir, filename);
        const dbUrl = `/uploads/staff/${filename}`;

        // 1. Save the file to disk
        fs.writeFileSync(filepath, buffer);
        console.log(`✅ Saved file for ${staff.name} to ${dbUrl}`);

        // 2. Update the database with the new URL
        await client.query(`UPDATE staff SET photo = $1 WHERE id = $2`, [dbUrl, staff.id]);

      } catch (err) {
        console.error(`❌ Failed to process Staff ID ${staff.id}:`, err.message);
      }
    }

    console.log("🎉 Migration complete!");

  } catch (error) {
    console.error("Migration failed:", error);
  } finally {
    client.release();
    pool.end();
  }
}

// Run the migration
migrateImages();