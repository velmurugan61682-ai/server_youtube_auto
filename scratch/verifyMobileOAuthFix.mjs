import mongoose from 'mongoose';
import OAuthState from '../models/OAuthState.mjs';

const buildRedirectTarget = (stateRecord, frontendUrl, pathAndQuery) => {
  if (stateRecord?.platform && stateRecord.platform !== 'web' && stateRecord.customScheme) {
    const queryPart = pathAndQuery.split('?')[1] || '';
    return `${stateRecord.customScheme}${queryPart ? '?' + queryPart : ''}`;
  }
  return `${frontendUrl}${pathAndQuery}`;
};

console.log('--- Testing buildRedirectTarget ---');

const frontendUrl = 'https://channelbot.in';

// 1. Web request (platform === 'web' or undefined)
const webRecord = { platform: 'web', customScheme: null };
const webSuccess = buildRedirectTarget(webRecord, frontendUrl, '/oauth/callback?token=jwt123&status=success');
console.log('Web Success:', webSuccess);
if (webSuccess !== 'https://channelbot.in/oauth/callback?token=jwt123&status=success') {
  console.error('FAILED Web Success assertion!');
  process.exit(1);
}

// 2. Android mobile request
const androidRecord = { platform: 'android', customScheme: 'channelbot://oauth/callback' };
const androidSuccess = buildRedirectTarget(androidRecord, frontendUrl, '/oauth/callback?token=jwt123&status=success');
console.log('Android Success:', androidSuccess);
if (androidSuccess !== 'channelbot://oauth/callback?token=jwt123&status=success') {
  console.error('FAILED Android Success assertion!');
  process.exit(1);
}

// 3. iOS mobile request
const iosRecord = { platform: 'ios', customScheme: 'channelbot://oauth/callback' };
const iosSuccess = buildRedirectTarget(iosRecord, frontendUrl, '/oauth/callback?token=jwt123&status=success');
console.log('iOS Success:', iosSuccess);
if (iosSuccess !== 'channelbot://oauth/callback?token=jwt123&status=success') {
  console.error('FAILED iOS Success assertion!');
  process.exit(1);
}

// 4. Missing state / null stateRecord
const nullSuccess = buildRedirectTarget(null, frontendUrl, '/oauth/callback?status=error&error=Missing%20state');
console.log('Null Record Error:', nullSuccess);
if (nullSuccess !== 'https://channelbot.in/oauth/callback?status=error&error=Missing%20state') {
  console.error('FAILED Null Record assertion!');
  process.exit(1);
}

// 5. Channel connect success
const channelConnectMobile = buildRedirectTarget(androidRecord, frontendUrl, '/oauth/callback?status=success&channelId=UC12345');
console.log('Channel Connect Mobile:', channelConnectMobile);
if (channelConnectMobile !== 'channelbot://oauth/callback?status=success&channelId=UC12345') {
  console.error('FAILED Channel Connect Mobile assertion!');
  process.exit(1);
}

// 6. Check Schema defaults
const schemaPaths = Object.keys(OAuthState.schema.paths);
console.log('OAuthState Schema Paths:', schemaPaths);
if (!schemaPaths.includes('platform') || !schemaPaths.includes('customScheme')) {
  console.error('FAILED OAuthState schema assertion! Missing platform or customScheme');
  process.exit(1);
}

console.log('\n✅ ALL VERIFICATION TESTS PASSED SUCCESSFULLY!');
