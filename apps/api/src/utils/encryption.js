const crypto = require('crypto');

// Must be 32 bytes for AES-256-GCM. 
// Fallback for dev ONLY if strictly necessary.
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || 'default_32_byte_dev_secret_key_1';
const ALGORITHM = 'aes-256-gcm';

/**
 * Encrypts a string using AES-256-GCM.
 * @param {string} text - The cleartext to encrypt.
 * @returns {string} - The IV, Auth Tag, and Ciphertext delimited by colons.
 */
function encrypt(text) {
    if (!text) return null;

    // Ensure key is 32 bytes
    const key = Buffer.from(ENCRYPTION_KEY).slice(0, 32);

    // GCM needs an Initialization Vector
    const iv = crypto.randomBytes(16);

    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);

    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag().toString('hex');

    // Return iv:authTag:encrypted payload
    return `${iv.toString('hex')}:${authTag}:${encrypted}`;
}

/**
 * Decrypts a previously encrypted string.
 * @param {string} encryptedText - The encrypted string format: IV:AuthTag:Ciphertext
 * @returns {string} - The decrypted cleartext
 */
function decrypt(encryptedText) {
    if (!encryptedText) return null;

    try {
        const textParts = encryptedText.split(':');

        // We expect exactly 3 parts: IV, AuthTag, and Payload
        if (textParts.length !== 3) {
            console.error("[Encryption Utility] Invalid encrypted format");
            return null;
        }

        const iv = Buffer.from(textParts[0], 'hex');
        const authTag = Buffer.from(textParts[1], 'hex');
        const encrypted = textParts[2];

        const key = Buffer.from(ENCRYPTION_KEY).slice(0, 32);
        const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);

        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (error) {
        console.error("[Encryption Utility] Decryption failed:", error.message);
        return null;
    }
}

module.exports = {
    encrypt,
    decrypt
};
