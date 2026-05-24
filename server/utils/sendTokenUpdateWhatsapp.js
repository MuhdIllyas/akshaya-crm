import axios from 'axios';

// Libromi configuration
const LIBROMI_ACCESS_TOKEN = process.env.LIBROMI_ACCESS_TOKEN;
const LIBROMI_PHONE_NUMBER = process.env.LIBROMI_PHONE_NUMBER;
const LIBROMI_BASE_URL =
  process.env.LIBROMI_BASE_URL || 'https://wa-api.cloud/api/v1';

// WhatsApp template name
const TEMPLATE_NAME = 'akshaya_token_update';

const sendTokenUpdateWhatsApp = async ({
  customerName,
  phone,
  tokenNumber,
  status,
  assignedStaff
}) => {
  try {
    if (!LIBROMI_ACCESS_TOKEN || !LIBROMI_PHONE_NUMBER) {
      console.warn(
        'sendTokenUpdateWhatsApp: Missing Libromi credentials'
      );
      return;
    }

    if (!phone) {
      console.warn(
        'sendTokenUpdateWhatsApp: Missing phone number'
      );
      return;
    }

    // format phone
    const formattedPhone = phone.startsWith('+91')
      ? phone
      : `+91${phone.replace(/^\+91/, '')}`;

    const response = await axios.post(
      `${LIBROMI_BASE_URL}/messages`,
      {
        to: formattedPhone,
        type: 'template',
        template: {
          name: TEMPLATE_NAME,
          language: {
            code: 'en',
            policy: 'deterministic'
          },
          components: [
            {
              type: 'body',
              parameters: [
                {
                  type: 'text',
                  text: customerName || 'Customer'
                },
                {
                  type: 'text',
                  text: tokenNumber || 'N/A'
                },
                {
                  type: 'text',
                  text: status || 'Pending'
                },
                {
                  type: 'text',
                  text:
                    assignedStaff || 'Waiting for Assignment'
                }
              ]
            }
          ]
        }
      },
      {
        headers: {
          Authorization: `Bearer ${LIBROMI_ACCESS_TOKEN}`,
          'Content-Type': 'application/json'
        }
      }
    );

    console.log(
      `Token WhatsApp sent successfully to ${formattedPhone}`,
      response.data
    );

    return {
      success: true,
      data: response.data
    };
  } catch (err) {
    console.error(
      'sendTokenUpdateWhatsApp error:',
      err.response?.data || err.message
    );

    return {
      success: false,
      error: err.response?.data || err.message
    };
  }
};

export default sendTokenUpdateWhatsApp;