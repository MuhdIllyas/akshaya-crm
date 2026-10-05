import { Resend } from 'resend';

// Initialize Resend with your API Key
const resend = new Resend(process.env.RESEND_API_KEY);

export const sendReportEmail = async (recipients, subject, textBody, attachments, htmlBody) => {
  try {
    // 1. Properly destructure the response to catch Resend API errors
    const { data, error } = await resend.emails.send({
      from: 'Akshaya Sahayi Reports <admin@akshayasahayi.com>',
      to: ['admin@akshayasahayi.com'],
      bcc: recipients,
      subject,
      text: textBody,
      ...(htmlBody ? { html: htmlBody } : {}),
      attachments
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

export const sendContactEnquiryEmail = async (formData) => {
  const { name, centreName, phone, email, centres, interest, message } = formData;

  try {
    const { data, error } = await resend.emails.send({
      from: 'Akshaya Sahayi Web <admin@akshayasahayi.com>', // Must be your verified domain
      to: ['muhdillyasks@gmail.com'], // Send to your team's support/admin inbox
      reply_to: email || undefined, // Allows you to hit "Reply" directly to the user
      subject: `New Enquiry: ${interest || 'General Question'} from ${name}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-w: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 10px;">
          <h2 style="color: #0f172a;">New Contact Form Submission</h2>
          <p style="color: #475569;">You have received a new enquiry from the Akshaya Sahayi website.</p>
          
          <table style="width: 100%; border-collapse: collapse; margin-top: 20px;">
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold; width: 35%;">Name</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${name}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Phone</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${phone}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Email</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${email || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Centre Name</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${centreName || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Number of Centres</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${centres || 'N/A'}</td>
            </tr>
            <tr>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0; font-weight: bold;">Interested In</td>
              <td style="padding: 10px; border-bottom: 1px solid #e2e8f0;">${interest || 'N/A'}</td>
            </tr>
          </table>

          <div style="margin-top: 20px; background-color: #f8fafc; padding: 15px; border-radius: 8px;">
            <h3 style="margin-top: 0; color: #0f172a; font-size: 16px;">Message:</h3>
            <p style="color: #334155; white-space: pre-wrap;">${message}</p>
          </div>
        </div>
      `,
    });

    if (error) {
      console.error(`[Email Service] ❌ Resend API Error (Contact Form):`, error.message);
      return false;
    }

    console.log(`[Email Service] 📧 Contact Enquiry sent via Resend:`, data?.id);
    return true;

  } catch (error) {
    console.error(`[Email Service] ❌ Network/Server Error (Contact Form):`, error.message);
    return false;
  }
};