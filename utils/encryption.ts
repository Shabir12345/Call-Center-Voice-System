/**
 * Encryption utilities for securing sensitive data
 * Uses Web Crypto API for browser-based encryption
 */

/**
 * Encrypt data using AES-GCM
 * @param data - Data to encrypt (string)
 * @param key - Encryption key (will be derived if not provided)
 * @returns Encrypted data as base64 string with IV prepended
 */
export async function encryptData(data: string, key?: CryptoKey): Promise<string> {
  try {
    // Generate or use provided key
    const cryptoKey = key || await generateKey();
    
    // Generate random IV (12 bytes for GCM)
    const iv = crypto.getRandomValues(new Uint8Array(12));
    
    // Encrypt data
    const encodedData = new TextEncoder().encode(data);
    const encrypted = await crypto.subtle.encrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      cryptoKey,
      encodedData
    );
    
    // Combine IV and encrypted data
    const combined = new Uint8Array(iv.length + encrypted.byteLength);
    combined.set(iv);
    combined.set(new Uint8Array(encrypted), iv.length);
    
    // Convert to base64 for storage
    return btoa(String.fromCharCode(...combined));
  } catch (error) {
    console.error('Encryption error:', error);
    throw new Error('Failed to encrypt data');
  }
}

/**
 * Decrypt data using AES-GCM
 * @param encryptedData - Encrypted data as base64 string
 * @param key - Decryption key (must match encryption key)
 * @returns Decrypted data as string
 */
export async function decryptData(encryptedData: string, key?: CryptoKey): Promise<string> {
  try {
    // Generate or use provided key
    const cryptoKey = key || await generateKey();
    
    // Decode from base64
    const combined = Uint8Array.from(atob(encryptedData), c => c.charCodeAt(0));
    
    // Extract IV (first 12 bytes) and encrypted data
    const iv = combined.slice(0, 12);
    const encrypted = combined.slice(12);
    
    // Decrypt data
    const decrypted = await crypto.subtle.decrypt(
      {
        name: 'AES-GCM',
        iv: iv
      },
      cryptoKey,
      encrypted
    );
    
    // Convert to string
    return new TextDecoder().decode(decrypted);
  } catch (error) {
    console.error('Decryption error:', error);
    throw new Error('Failed to decrypt data - data may be corrupted or key mismatch');
  }
}

/**
 * Generate or retrieve encryption key
 * Uses a deterministic key derivation from a stored seed
 * In production, this should use a more secure key management system
 */
let cachedKey: CryptoKey | null = null;

async function generateKey(): Promise<CryptoKey> {
  if (cachedKey) {
    return cachedKey;
  }
  
  try {
    // Get or create key seed from localStorage
    let keySeed = localStorage.getItem('_encryption_seed');
    
    if (!keySeed) {
      // Generate new seed (32 random bytes as hex)
      const seedArray = crypto.getRandomValues(new Uint8Array(32));
      keySeed = Array.from(seedArray, byte => byte.toString(16).padStart(2, '0')).join('');
      localStorage.setItem('_encryption_seed', keySeed);
    }
    
    // Derive key from seed using PBKDF2
    const seedBuffer = Uint8Array.from(keySeed.match(/.{1,2}/g)!.map(byte => parseInt(byte, 16)));
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      seedBuffer,
      'PBKDF2',
      false,
      ['deriveBits', 'deriveKey']
    );
    
    // Derive AES-GCM key
    const key = await crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: new Uint8Array(16), // In production, use a random salt stored separately
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      {
        name: 'AES-GCM',
        length: 256
      },
      false,
      ['encrypt', 'decrypt']
    );
    
    cachedKey = key;
    return key;
  } catch (error) {
    console.error('Key generation error:', error);
    throw new Error('Failed to generate encryption key');
  }
}

/**
 * Clear cached encryption key (for security/logout)
 */
export function clearEncryptionKey(): void {
  cachedKey = null;
}

/**
 * Check if encryption is supported in this environment
 */
export function isEncryptionSupported(): boolean {
  return typeof crypto !== 'undefined' && 
         typeof crypto.subtle !== 'undefined' &&
         typeof TextEncoder !== 'undefined' &&
         typeof TextDecoder !== 'undefined';
}

