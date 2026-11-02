'use strict';

const crypto = require('node:crypto');

const magic = Buffer.from('SIGAENC1', 'ascii');
const algorithm = 'aes-256-gcm';

function dataEncryptionKey(required = false) {
  const raw = String(process.env.SIGA_DATA_ENCRYPTION_KEY || '').trim();
  if (!raw) {
    if (required) throw new Error('SIGA_DATA_ENCRYPTION_KEY es obligatoria en producción.');
    return null;
  }
  let key;
  if (/^[0-9a-f]{64}$/i.test(raw)) key = Buffer.from(raw, 'hex');
  else {
    try { key = Buffer.from(raw, 'base64url'); } catch { key = Buffer.alloc(0); }
  }
  if (key.length !== 32) throw new Error('SIGA_DATA_ENCRYPTION_KEY debe representar exactamente 32 bytes en base64url o hexadecimal.');
  return key;
}

function encryptBuffer(buffer, key = dataEncryptionKey(false)) {
  if (!key) return Buffer.from(buffer);
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(algorithm, key, iv);
  cipher.setAAD(magic);
  const encrypted = Buffer.concat([cipher.update(buffer), cipher.final()]);
  return Buffer.concat([magic, iv, cipher.getAuthTag(), encrypted]);
}

function decryptBuffer(buffer, key = dataEncryptionKey(false)) {
  const value = Buffer.from(buffer);
  if (!value.subarray(0, magic.length).equals(magic)) return value;
  if (!key) throw new Error('El archivo está cifrado y SIGA_DATA_ENCRYPTION_KEY no está configurada.');
  if (value.length < magic.length + 28) throw new Error('El contenido cifrado de SIGA está incompleto.');
  const ivStart = magic.length;
  const tagStart = ivStart + 12;
  const contentStart = tagStart + 16;
  const decipher = crypto.createDecipheriv(algorithm, key, value.subarray(ivStart, tagStart));
  decipher.setAAD(magic);
  decipher.setAuthTag(value.subarray(tagStart, contentStart));
  try { return Buffer.concat([decipher.update(value.subarray(contentStart)), decipher.final()]); }
  catch { throw new Error('No se pudo descifrar la información de SIGA. Verifique SIGA_DATA_ENCRYPTION_KEY.'); }
}

function derivedKey(key, purpose) {
  return Buffer.from(crypto.hkdfSync('sha256', key, Buffer.from('SIGA-DATA-PROTECTION-V1'), Buffer.from(purpose), 32));
}

function protectDeterministic(value, context, key = dataEncryptionKey(false)) {
  if (!key || value === null || value === undefined || value === '') return value;
  const text = String(value);
  if (text.startsWith('enc:v1:')) return text;
  const encryptionKey = derivedKey(key, 'relational-encryption');
  const ivKey = derivedKey(key, 'relational-iv');
  const aad = Buffer.from(`SIGA:${context}:v1`, 'utf8');
  const iv = crypto.createHmac('sha256', ivKey).update(aad).update(Buffer.from([0])).update(text).digest().subarray(0, 12);
  const cipher = crypto.createCipheriv(algorithm, encryptionKey, iv);
  cipher.setAAD(aad);
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  return `enc:v1:${iv.toString('base64url')}:${cipher.getAuthTag().toString('base64url')}:${encrypted.toString('base64url')}`;
}

function unprotectDeterministic(value, context, key = dataEncryptionKey(false)) {
  if (typeof value !== 'string' || !value.startsWith('enc:v1:')) return value;
  if (!key) throw new Error('El campo está cifrado y SIGA_DATA_ENCRYPTION_KEY no está configurada.');
  const [, version, ivText, tagText, encryptedText, extra] = value.split(':');
  if (version !== 'v1' || !ivText || !tagText || !encryptedText || extra) throw new Error('El campo cifrado no tiene un formato válido.');
  const decipher = crypto.createDecipheriv(algorithm, derivedKey(key, 'relational-encryption'), Buffer.from(ivText, 'base64url'));
  decipher.setAAD(Buffer.from(`SIGA:${context}:v1`, 'utf8'));
  decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
  try { return Buffer.concat([decipher.update(Buffer.from(encryptedText, 'base64url')), decipher.final()]).toString('utf8'); }
  catch { throw new Error('No se pudo descifrar el campo protegido de SIGA.'); }
}

function protectJson(value) {
  const key = dataEncryptionKey(process.env.NODE_ENV === 'production');
  if (!key) return JSON.stringify(value);
  const encrypted = encryptBuffer(Buffer.from(JSON.stringify(value), 'utf8'), key);
  return JSON.stringify({ sigaEncrypted: 1, algorithm: 'A256GCM', payload: encrypted.toString('base64url') });
}

function unprotectJson(payload) {
  const parsed = JSON.parse(String(payload));
  if (parsed?.sigaEncrypted !== 1) return parsed;
  if (parsed.algorithm !== 'A256GCM' || typeof parsed.payload !== 'string') throw new Error('El sobre cifrado de SIGA no es compatible.');
  return JSON.parse(decryptBuffer(Buffer.from(parsed.payload, 'base64url'), dataEncryptionKey(true)).toString('utf8'));
}

module.exports = { dataEncryptionKey, encryptBuffer, decryptBuffer, protectDeterministic, unprotectDeterministic, protectJson, unprotectJson };
