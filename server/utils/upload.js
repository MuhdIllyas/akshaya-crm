import multer from "multer";
import path from "path";
import fs from "fs";

// Ensure the directory exists, or create it
const staffUploadDir = path.join(process.cwd(), "uploads", "staff");
if (!fs.existsSync(staffUploadDir)) {
  fs.mkdirSync(staffUploadDir, { recursive: true });
}

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, staffUploadDir); 
  },
  filename: function (req, file, cb) {
    // Creates a safe, unique filename: e.g., staff-1698123456789.jpg
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'staff-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const fileFilter = (req, file, cb) => {
  if (file.mimetype.startsWith("image/")) {
    cb(null, true);
  } else {
    cb(new Error("Only image files are allowed!"), false);
  }
};

export const upload = multer({ 
  storage: storage,
  fileFilter: fileFilter,
  limits: { fileSize: 5 * 1024 * 1024 } // 5MB limit
});