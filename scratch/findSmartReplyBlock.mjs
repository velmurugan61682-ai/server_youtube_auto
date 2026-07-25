import fs from 'fs';

const filePath = 'services/commentProcessingService.mjs';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

for (let i = 1040; i < 1090; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}
