import fs from 'fs';

const filePath = 'services/commentProcessingService.mjs';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

for (let i = 1040; i < 1250; i++) {
  const line = lines[i];
  if (line.includes('reply') || line.includes('Reply') || line.includes('like') || line.includes('Like') || line.includes('Deep') || line.includes('AI') || line.includes('ai')) {
    console.log(`${i + 1}: ${line.trim()}`);
  }
}
