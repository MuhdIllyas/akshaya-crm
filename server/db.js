import pg from "pg";
import dotenv from "dotenv";

dotenv.config();

const { Pool } = pg;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Only force SSL if NODE_ENV is strictly set to "production"
  ssl: process.env.NODE_ENV === "production" 
    ? { rejectUnauthorized: false } 
    : false,
});

pool.connect()
  .then(() => console.log("✅ db.js Connected to PostgreSQL"))
  .catch((err) => console.error("❌ db.js PostgreSQL connection error", err));

export default pool;