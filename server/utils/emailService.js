import { Resend } from 'resend';

// Initialize Resend with your API Key
const resend = new Resend(process.env.RESEND_API_KEY);

export const sendReportEmail = async (recipients, subject, textBody, attachments) => {
  try {
    // 1. Properly destructure the response to catch Resend API errors
    const { data, error } = await resend.emails.send({
      from: 'Akshaya Sahayi Reports <admin@akshayasahayi.com>', 
      // 2. Put your own email in the 'to' field, and hide the recipients in 'bcc'
      to: ['admin@akshayasahayi.com'], 
      bcc: recipients, 
      subject: subject,
      text: textBody,
      attachments: attachments 
    });

    // 3. Catch validation/delivery errors returned by Resend
    if (error) {
      console.error(`[Email Service] ❌ Resend API Error:`, error.message);
      return false;
    }

    console.log(`[Email Service] 📧 Automated Report sent via Resend:`, data?.id);
    return true;

  } catch (error) {
    // 4. Catch actual server/network crashes
    console.error(`[Email Service] ❌ Network/Server Error:`, error.message);
    return false;
  }
};