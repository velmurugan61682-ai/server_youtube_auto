import axios from 'axios';
import logger from '../utils/logger.mjs';

/**
 * Sends a WhatsApp alert notification when a toxic/abusive comment is detected.
 * Uses the Meta WhatsApp Cloud API.
 * 
 * @param {object} commentDetails 
 * @param {string} commentDetails.videoId
 * @param {string} commentDetails.videoTitle
 * @param {string} commentDetails.commenterName
 * @param {string} commentDetails.commentText
 * @param {string} commentDetails.actionTaken
 * @returns {Promise<boolean>}
 */
export const sendWhatsAppAlert = async (commentDetails) => {
  const apiToken = (process.env.WHATSAPP_API_TOKEN || '').trim().replace(/^["']|["']$/g, '');
  const phoneNumberId = (process.env.WHATSAPP_PHONE_NUMBER_ID || '').trim().replace(/^["']|["']$/g, '');
  const myNumber = (process.env.MY_WHATSAPP_NUMBER || '').trim().replace(/^["']|["']$/g, '');

  if (!apiToken || !phoneNumberId || !myNumber) {
    logger.warn('[WhatsApp Service] Missing configuration variables (WHATSAPP_API_TOKEN, WHATSAPP_PHONE_NUMBER_ID, or MY_WHATSAPP_NUMBER). WhatsApp alert skipped.');
    return false;
  }

  const messageText = `🚨 *Toxic Comment Alert* 🚨\n\n` +
    `*Video Title:* ${commentDetails.videoTitle || 'N/A'}\n` +
    `*Video ID:* ${commentDetails.videoId}\n` +
    `*Commenter:* ${commentDetails.commenterName}\n` +
    `*Comment:* "${commentDetails.commentText}"\n` +
    `*Action Taken:* ${commentDetails.actionTaken}`;

  try {
    logger.info(`[WhatsApp Service] Attempting to send WhatsApp alert to ${myNumber}...`);
    
    const response = await axios.post(
      `https://graph.facebook.com/v20.0/${phoneNumberId}/messages`,
      {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: myNumber,
        type: 'text',
        text: {
          body: messageText
        }
      },
      {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiToken}`
        },
        timeout: 15000 // 15-second timeout
      }
    );

    if (response.data && response.data.messages && response.data.messages.length > 0) {
      logger.info(`[WhatsApp Service] WhatsApp alert sent successfully. Message ID: ${response.data.messages[0].id}`);
      return true;
    }

    logger.warn(`[WhatsApp Service] API succeeded but returned no message ID: ${JSON.stringify(response.data)}`);
    return false;
  } catch (error) {
    const errorData = error.response?.data?.error;
    const errorMessage = errorData ? `${errorData.message} (Code: ${errorData.code}, Type: ${errorData.type})` : error.message;
    logger.error(`[WhatsApp Service] Failed to send WhatsApp alert: ${errorMessage}`);
    
    // We throw the error so that the cron job's retry system or error catcher knows it failed
    throw new Error(`WhatsApp API Error: ${errorMessage}`);
  }
};
