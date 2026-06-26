import axios from 'axios';
import pool from '../../db.js'; // Adjust path if your db.js is located elsewhere

/**
 * Central router for all automated CRM messages.
 * * @param {string} eventKey - The CRM trigger (e.g., 'service_tracking', 'pending_payment')
 * @param {number} centreId - The ID of the centre triggering the message
 * @param {string} customerPhone - The recipient's WhatsApp number
 * @param {Array} templateParams - Array of variables to inject into the template (e.g., [CustomerName, Status, Notes])
 */
export const triggerNotification = async ({ eventKey, centreId, customerPhone, templateParams = [] }) => {
  try {
    // 1. Find which Communication Account this centre uses
    const accountQuery = await pool.query(`
      SELECT ca.* FROM communication_accounts ca
      JOIN centres c ON c.communication_account_id = ca.id
      WHERE c.id = $1 AND ca.is_active = true
    `, [centreId]);

    // FALLBACK SAFETY NET (Ensures your live system doesn't break while transitioning)
    if (accountQuery.rows.length === 0) {
      console.warn(`[Notification Engine] No mapped account for Centre ${centreId}. Skipping or falling back to Legacy ENV.`);
      return { success: false, reason: 'no_account_mapped' };
    }

    const account = accountQuery.rows[0];

    // 2. Find the exact Meta Template Name approved for this specific account and event
    const templateQuery = await pool.query(`
      SELECT provider_template_name, language_code 
      FROM communication_template_mappings 
      WHERE communication_account_id = $1 AND event_key = $2
    `, [account.id, eventKey]);

    if (templateQuery.rows.length === 0) {
      console.error(`[Notification Engine] ❌ Missing template mapping for event '${eventKey}' on Account ID ${account.id}`);
      return { success: false, reason: 'template_unmapped' };
    }

    const template = templateQuery.rows[0];

    // 3. Format the phone number (Libromi requires country code)
    const formattedPhone = customerPhone.startsWith('+91') 
      ? customerPhone 
      : `+91${customerPhone.replace(/^\+91/, '')}`;

    // 4. Construct the Libromi / Meta API Payload
    const payload = {
      to: formattedPhone,
      type: 'template',
      template: {
        name: template.provider_template_name,
        language: {
          code: template.language_code || 'en'
        },
        components: [
          {
            type: "body",
            parameters: templateParams.map(param => ({
              type: "text",
              text: String(param || "") // Ensure all params are strings to prevent Libromi crashes
            }))
          }
        ]
      }
    };

    // 5. Dispatch the API Request to Libromi
    const response = await axios.post(
      `${account.base_url}/messages`,
      payload,
      {
        headers: {
          'Authorization': `Bearer ${account.access_token}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(`[Notification Engine] ✅ Successfully sent '${eventKey}' to ${formattedPhone} via Account: ${account.name}`);
    return { success: true, data: response.data };

  } catch (err) {
    console.error(`[Notification Engine] ❌ Failed to send '${eventKey}' to ${customerPhone}:`, err.response?.data || err.message);
    return { success: false, error: err.message };
  }
};