import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// Use SERVICE_ROLE_KEY or specific app secret. 
// For specific security, we should really use a fixed 32-byte secret.
// As a fallback for this environment, we'll derive/pad the service role key or use a hardcoded fallback if missing (NOT RECOMMENDED for pure prod, but functional for MVP setup).
// Ideally: process.env.APP_SECRET needs to be set.
const SECRET_KEY = process.env.APP_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY || 'default-fallback-secret-32-chars!!';

// Ensure key is 32 bytes
const getKey = () => {
    let key = SECRET_KEY;
    if (key.length < 32) {
        key = key.padEnd(32, '0');
    }
    return Buffer.from(key.slice(0, 32));
};

const ALGORITHM = 'aes-256-cbc';

export const encryptToken = (text: string): string => {
    const iv = randomBytes(16);
    const cipher = createCipheriv(ALGORITHM, getKey(), iv);
    let encrypted = cipher.update(text);
    encrypted = Buffer.concat([encrypted, cipher.final()]);
    return iv.toString('hex') + ':' + encrypted.toString('hex');
};

export const decryptToken = (text: string): string => {
    const textParts = text.split(':');
    const iv = Buffer.from(textParts.shift()!, 'hex');
    const encryptedText = Buffer.from(textParts.join(':'), 'hex');
    const decipher = createDecipheriv(ALGORITHM, getKey(), iv);
    let decrypted = decipher.update(encryptedText);
    decrypted = Buffer.concat([decrypted, decipher.final()]);
    return decrypted.toString();
};
