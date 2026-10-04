import express from 'express';
// Import the new function from your existing email service
import { sendContactEnquiryEmail } from '../utiles/emailService.js';

const router = express.Router();

router.post('/enquiry', async (req, res) => {
  try {
    const { name, phone, message } = req.body;

    // Basic validation
    if (!name || !phone || !message) {
      return res.status(400).json({ 
        success: false, 
        message: 'Name, Phone, and Message are required fields.' 
      });
    }

    // Call your centralized email service
    const emailSent = await sendContactEnquiryEmail(req.body);

    if (emailSent) {
      return res.status(200).json({ 
        success: true, 
        message: 'Enquiry sent successfully' 
      });
    } else {
      // If the email service returned false
      return res.status(500).json({ 
        success: false, 
        message: 'Failed to send the enquiry due to an email service error.' 
      });
    }

  } catch (error) {
    console.error('Error processing contact enquiry:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Server error processing enquiry.' 
    });
  }
});

export default router;