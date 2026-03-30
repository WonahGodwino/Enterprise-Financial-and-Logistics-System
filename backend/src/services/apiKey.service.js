// backend/src/services/apiKey.service.js
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

class ApiKeyService {
  constructor() {
    this.salt = process.env.API_KEY_SALT || crypto.randomBytes(32).toString('hex');
    this.prefix = process.env.API_KEY_PREFIX || 'mapsi_';
    this.encryptionKey = this.getEncryptionKey();
  }

  // Get encryption key from env or generate securely
  getEncryptionKey() {
    const envKey = process.env.API_KEY_ENCRYPTION_KEY;
    if (envKey && envKey.length === 32) {
      return Buffer.from(envKey);
    }
    // Warn in development, but don't fail
    console.warn('WARNING: Using generated encryption key. Set API_KEY_ENCRYPTION_KEY in .env for production!');
    return crypto.randomBytes(32);
  }

  // Generate a secure random API key
  generateApiKey() {
    // Generate 32 random bytes and convert to base64url
    const randomBytes = crypto.randomBytes(32);
    const base64Key = randomBytes
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=/g, '');
    
    // Add prefix and timestamp for tracking
    const timestamp = Date.now().toString(36);
    const key = `${this.prefix}${timestamp}_${base64Key}`;
    
    return key;
  }

  // Hash API key for storage (never store raw keys!)
  hashApiKey(apiKey) {
    return crypto
      .createHmac('sha256', this.salt)
      .update(apiKey)
      .digest('hex');
  }

  // Encrypt sensitive key data
  encryptKeyData(data) {
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    
    let encrypted = cipher.update(JSON.stringify(data), 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    return {
      encrypted,
      iv: iv.toString('hex'),
      authTag: authTag.toString('hex')
    };
  }

  // Decrypt key data
  decryptKeyData(encryptedData) {
    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      Buffer.from(encryptedData.iv, 'hex')
    );
    
    decipher.setAuthTag(Buffer.from(encryptedData.authTag, 'hex'));
    
    let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return JSON.parse(decrypted);
  }

  // Validate API key format
  validateApiKeyFormat(apiKey) {
    // Check prefix
    if (!apiKey.startsWith(this.prefix)) {
      return false;
    }

    // Basic format validation
    const parts = apiKey.split('_');
    if (parts.length < 3) return false;

    // Validate timestamp part
    const timestamp = parseInt(parts[1], 36);
    if (isNaN(timestamp) || timestamp > Date.now()) return false;

    // Validate key length (prefix + timestamp + 43 chars base64url)
    const keyPart = parts.slice(2).join('_');
    if (keyPart.length < 32) return false;

    return true;
  }

  // Extract metadata from API key
  extractKeyMetadata(apiKey) {
    try {
      const parts = apiKey.split('_');
      const timestamp = parseInt(parts[1], 36);
      const keyId = parts.slice(2).join('_').substring(0, 8); // First 8 chars as ID
      
      return {
        timestamp,
        keyId,
        createdAt: new Date(timestamp),
        prefix: parts[0]
      };
    } catch (error) {
      return null;
    }
  }

  // Generate a key ID for database lookup
  generateKeyId(apiKey) {
    return crypto
      .createHash('sha256')
      .update(apiKey.substring(0, 20)) // Use first 20 chars
      .digest('hex')
      .substring(0, 16);
  }

  // Rotate API key
  rotateApiKey(oldKey) {
    // Validate old key
    if (!this.validateApiKeyFormat(oldKey)) {
      throw new Error('Invalid API key format');
    }

    // Generate new key
    const newKey = this.generateApiKey();
    
    // Return both keys for transition period
    return {
      oldKey,
      newKey,
      transitionPeriod: 24 * 60 * 60 * 1000, // 24 hours
      rotatedAt: new Date().toISOString()
    };
  }

  // Check if key is expired based on timestamp in key
  isKeyExpired(apiKey, maxAgeDays = 30) {
    const metadata = this.extractKeyMetadata(apiKey);
    if (!metadata) return true;

    const age = Date.now() - metadata.timestamp;
    const maxAge = maxAgeDays * 24 * 60 * 60 * 1000;
    
    return age > maxAge;
  }
}

export default new ApiKeyService();