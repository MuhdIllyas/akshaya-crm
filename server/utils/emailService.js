import { Resend } from 'resend';

// Initialize Resend with your API Key (get this from resend.com)
const resend = new Resend(process.env.RESEND_API_KEY);

export const sendReportEmail = async (recipients, subject, textBody, attachments) => {
  try {
    const data = await resend.emails.send({
      // This must be a domain you have verified in your Resend dashboard
      from: 'Akshaya Sahayi Reports <admin@akshayasahayi.com>', 
      to: recipients, // Resend accepts an array of emails directly!
      subject: subject,
      text: textBody,
      attachments: attachments // Our { filename, content: buffer } format works perfectly here
    });

    console.log(`[Email Service] 📧 Automated Report sent via Resend:`, data.id);
    return true;
  } catch (error) {
    console.error(`[Email Service] ❌ Failed to send email via Resend:`, error);
    return false;
  }
};