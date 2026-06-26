import pool from '../../db.js';
import axios from 'axios';

export async function triggerNotification({ eventKey, centreId, customerPhone, templateParams }) {
  try {
    // 1. Fetch the communication account linked to this centre
    const accountQuery = await pool.query(
      `SELECT ca.* FROM communication_accounts ca
       JOIN centres c ON c.communication_account_id = ca.id
       WHERE c.id = $1 AND ca.is_active = true`,
      [centreId]
    );

    // Fallback/Mode 3: If no account is mapped or WhatsApp is disabled for this centre
    if (accountQuery.rows.length === 0) {
      console.log(`ℹ️ Notification skipped for event ${eventKey}: Centre ${centreId} has no WhatsApp active.`);
      return { success: false, reason: 'whatsapp_disabled' };
    }

    const account = accountQuery.rows[0];

    // 2. Resolve the template name for this specific communication account
    const templateQuery = await pool.query(
      `SELECT provider_template_name, language_code 
       FROM communication_template_mappings 
       WHERE communication_account_id = $1 AND event_key = $2`,
      [account.id, eventKey]
    );

    if (templateQuery.rows.length === 0) {
      console.error(`❌ Template mapping missing for event: ${eventKey} on Account: ${account.name}`);
      return { success: false, reason: 'template_unmapped' };
    }

    const { provider_template_name, language_code } = templateQuery.rows[0];
    const formattedPhone = customerPhone.startsWith('+91') ? customerPhone : `+91${customerPhone.replace(/^\+91/, '')}`;

    // 3. Dispatch to Provider (Libromi API Layer)
    const response = await axios.post(
      `${account.base_url}/${account.phone_number}/messages`, // Dynamically uses account's configuration
      {
        to: formattedPhone,
        type: 'template',
        template: {
          name: provider_template_name,
          language: { code: language_code || 'en' },
          components: [
            {
              type: 'body',
              parameters: templateParams.map(param => ({ type: 'text', text: String(param) }))
            }
          ]
        }
      },
      {
        headers: { Authorization: `Bearer ${account.access_token}` }
      }
    );

    return { success: true, messageId: response.data?.messages?.[0]?.id };
  } catch (error) {
    console.error(`❌ Notification Engine Failure [Event: ${eventKey}]:`, error.message);
    return { success: false, error: error.message };
  }
}