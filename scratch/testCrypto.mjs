import { encrypt, decrypt } from '../utils/cryptoHelper.mjs';

const testKey = 'sk-proj-12345abcdefghijklmnopqrstuvwxyz67890';
console.log('Original API Key:', testKey);

const encrypted = encrypt(testKey);
console.log('Encrypted Value:', encrypted);
console.log('Contains colon (validation):', encrypted.includes(':'));

const decrypted = decrypt(encrypted);
console.log('Decrypted Value:', decrypted);

if (testKey === decrypted) {
  console.log('✅ CRYPTO VERIFICATION SUCCESSFUL!');
} else {
  console.error('❌ CRYPTO VERIFICATION FAILED!');
}
