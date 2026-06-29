import { triggerNotification } from './communication/notificationEngine.js';

const sendTokenUpdateWhatsApp = async ({
  customerName,
  phone,
  tokenNumber,
  status,
  assignedStaff,
  centreId 
}) => {
  try {
    // Validate phone
    if (!phone) {
      console.warn('sendTokenUpdateWhatsApp: Missing phone number');
      return { success: false, error: 'Missing phone number' };
    }

    if (!centreId) {
      console.warn('sendTokenUpdateWhatsApp: Missing centreId');
      return { success: false, error: 'Missing centreId' };
    }

    // Format phone number
    const formattedPhone = phone.startsWith('+91')
      ? phone
      : `+91${phone.replace(/^\+91/, '')}`;

    // Ensure these parameters match what Meta expects for this template
    const templateParams = [
      customerName || 'Customer',
      tokenNumber || 'N/A',
      status || 'Pending',
      assignedStaff || 'Waiting for Assignment'
    ];

    // 🔥 DISPATCH VIA CENTRAL ENGINE
    const response = await triggerNotification({
      eventKey: 'token_generated', 
      centreId: centreId,
      customerPhone: formattedPhone,
      templateParams: templateParams
    });

    if (!response.success) {
      throw new Error(response.error || response.reason);
    }

    console.log(`Token WhatsApp sent successfully to ${formattedPhone}`);

    return {
      success: true,
      data: response.data
    };
  } catch (err) {
    console.error('sendTokenUpdateWhatsApp error:', err.message);

    return {
      success: false,
      error: err.message
    };
  }
};

export default sendTokenUpdateWhatsApp;