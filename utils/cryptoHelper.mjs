import crypto from 'crypto';
import logger from './logger.mjs';

const ALGORITHM = 'aes-256-cbc';

// Helper to get encryption key (must be exactly 32 bytes)
const getEncryptionKey = () => {
  const secret = process.env.ENCRYPTION_KEY || (process.env.NODE_ENV !== 'production' ? process.env.JWT_SECRET : '');
  if (!secret) {
    throw new Error('ENCRYPTION_KEY is required in production');
  }
  // Use sha256 to ensure we always have a 32-byte key.
  return crypto.createHash('sha256').update(secret).digest();
};

/**
 * Encrypts a string using AES-256-CBC
 * @param {string} text - Raw string to encrypt
 * @returns {string} Encrypted string in format ivHex:encryptedHex
 */
export const encrypt = (text) => {
  if (!text) return '';
  try {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, getEncryptionKey(), iv);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return `${iv.toString('hex')}:${encrypted}`;
  } catch (err) {
    logger.error('Encryption failed:', err);
    return text;
  }
};

/**
 * Decrypts a string using AES-256-CBC
 * @param {string} text - Encrypted string to decrypt
 * @returns {string} Decrypted raw string
 */
export const decrypt = (text) => {
  if (!text) return '';
  
  // Validate format: exactly 32-hex character IV and hex ciphertext separated by a single colon
  const hexRegex = /^[0-9a-fA-F]+$/;
  const parts = text.split(':');
  if (parts.length !== 2 || parts[0].length !== 32 || !hexRegex.test(parts[0]) || !hexRegex.test(parts[1])) {
    // If not matching the encrypted format, return the text directly (legacy/unencrypted data)
    return text;
  }
  
  try {
    const [ivHex, encryptedHex] = parts;
    const iv = Buffer.from(ivHex, 'hex');
    const decipher = crypto.createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
    let decrypted = decipher.update(encryptedHex, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (err) {
    // In case decryption fails (e.g. key changed), return the original text
    logger.error(`Decryption failed, returning raw text: ${err.message}`);
    return text;
  }
};
