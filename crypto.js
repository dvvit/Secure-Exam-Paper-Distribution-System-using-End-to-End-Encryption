/**
 * crypto.js - Cryptographic operations for SecureExam
 * Uses Web Crypto API (built into modern browsers)
 * Implements AES-GCM for encryption, RSA-OAEP for key protection, SHA-256 for hashing
 */

const SecureCrypto = (() => {

  /* ---------- AES KEY GENERATION ---------- */
  async function generateAESKey() {
    return await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /* ---------- AES ENCRYPT ---------- */
  async function encryptData(data, aesKey) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const ciphertext = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      encoded
    );
    // Pack iv + ciphertext together
    const combined = new Uint8Array(iv.byteLength + ciphertext.byteLength);
    combined.set(iv, 0);
    combined.set(new Uint8Array(ciphertext), iv.byteLength);
    return bufToBase64(combined);
  }

  /* ---------- AES DECRYPT ---------- */
  async function decryptData(base64Combined, aesKey) {
    const combined = base64ToBuf(base64Combined);
    const iv = combined.slice(0, 12);
    const ciphertext = combined.slice(12);
    const decrypted = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv },
      aesKey,
      ciphertext
    );
    return new TextDecoder().decode(decrypted);
  }

  /* ---------- RSA KEY PAIR ---------- */
  async function generateRSAKeyPair() {
    return await crypto.subtle.generateKey(
      {
        name: 'RSA-OAEP',
        modulusLength: 2048,
        publicExponent: new Uint8Array([1, 0, 1]),
        hash: 'SHA-256'
      },
      true,
      ['encrypt', 'decrypt']
    );
  }

  /* ---------- WRAP AES KEY WITH RSA ---------- */
  async function wrapAESKey(aesKey, rsaPublicKey) {
    const rawKey = await crypto.subtle.exportKey('raw', aesKey);
    const wrapped = await crypto.subtle.encrypt(
      { name: 'RSA-OAEP' },
      rsaPublicKey,
      rawKey
    );
    return bufToBase64(new Uint8Array(wrapped));
  }

  /* ---------- UNWRAP AES KEY WITH RSA ---------- */
  async function unwrapAESKey(wrappedBase64, rsaPrivateKey) {
    const wrappedBuf = base64ToBuf(wrappedBase64);
    const rawKey = await crypto.subtle.decrypt(
      { name: 'RSA-OAEP' },
      rsaPrivateKey,
      wrappedBuf
    );
    return await crypto.subtle.importKey(
      'raw', rawKey,
      { name: 'AES-GCM', length: 256 },
      false,
      ['decrypt']
    );
  }

  /* ---------- SHA-256 HASH ---------- */
  async function hashData(data) {
    const encoded = typeof data === 'string' ? new TextEncoder().encode(data) : data;
    const hashBuf = await crypto.subtle.digest('SHA-256', encoded);
    return bufToHex(new Uint8Array(hashBuf));
  }

  /* ---------- VERIFY HASH ---------- */
  async function verifyHash(data, expectedHash) {
    const actual = await hashData(data);
    return actual === expectedHash;
  }

  /* ---------- EXPORT / IMPORT RSA KEYS ---------- */
  async function exportPublicKey(key) {
    const exported = await crypto.subtle.exportKey('spki', key);
    return bufToBase64(new Uint8Array(exported));
  }

  async function exportPrivateKey(key) {
    const exported = await crypto.subtle.exportKey('pkcs8', key);
    return bufToBase64(new Uint8Array(exported));
  }

  async function importPublicKey(base64) {
    const buf = base64ToBuf(base64);
    return await crypto.subtle.importKey(
      'spki', buf,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false, ['encrypt']
    );
  }

  async function importPrivateKey(base64) {
    const buf = base64ToBuf(base64);
    return await crypto.subtle.importKey(
      'pkcs8', buf,
      { name: 'RSA-OAEP', hash: 'SHA-256' },
      false, ['decrypt']
    );
  }

  /* ---------- UTIL HELPERS ---------- */
  function bufToBase64(buf) {
    let binary = '';
    buf.forEach(b => binary += String.fromCharCode(b));
    return btoa(binary);
  }

  function base64ToBuf(base64) {
    const binary = atob(base64);
    const buf = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
    return buf;
  }

  function bufToHex(buf) {
    return Array.from(buf).map(b => b.toString(16).padStart(2, '0')).join('');
  }

  /* ---------- FULL EXAM ENCRYPTION PIPELINE ---------- */
  async function encryptExamPaper(content) {
    const aesKey = await generateAESKey();
    const rsaKeyPair = await generateRSAKeyPair();

    const encryptedContent = await encryptData(content, aesKey);
    const hash = await hashData(content);
    const wrappedKey = await wrapAESKey(aesKey, rsaKeyPair.publicKey);

    const pubKeyB64 = await exportPublicKey(rsaKeyPair.publicKey);
    const privKeyB64 = await exportPrivateKey(rsaKeyPair.privateKey);

    return {
      encryptedContent,
      hash,
      wrappedAESKey: wrappedKey,
      publicKey: pubKeyB64,
      privateKey: privKeyB64,   // In real system, stored securely server-side
      encryptedAt: new Date().toISOString()
    };
  }

  /* ---------- FULL EXAM DECRYPTION PIPELINE ---------- */
  async function decryptExamPaper(encryptedPackage, privateKeyB64) {
    const rsaPrivKey = await importPrivateKey(privateKeyB64);
    const aesKey = await unwrapAESKey(encryptedPackage.wrappedAESKey, rsaPrivKey);
    const decrypted = await decryptData(encryptedPackage.encryptedContent, aesKey);

    const valid = await verifyHash(decrypted, encryptedPackage.hash);
    return { content: decrypted, integrityValid: valid };
  }

  /* ---------- PASSWORD-BASED KEY DERIVATION (for student auth) ---------- */
  async function deriveKeyFromPassword(password, salt) {
    const enc = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw', enc.encode(password), 'PBKDF2', false, ['deriveBits', 'deriveKey']
    );
    return await crypto.subtle.deriveKey(
      { name: 'PBKDF2', salt: enc.encode(salt), iterations: 100000, hash: 'SHA-256' },
      keyMaterial,
      { name: 'AES-GCM', length: 256 },
      false,
      ['encrypt', 'decrypt']
    );
  }

  return {
    generateAESKey, encryptData, decryptData,
    generateRSAKeyPair, wrapAESKey, unwrapAESKey,
    hashData, verifyHash,
    exportPublicKey, exportPrivateKey, importPublicKey, importPrivateKey,
    encryptExamPaper, decryptExamPaper,
    deriveKeyFromPassword
  };
})();

window.SecureCrypto = SecureCrypto;
