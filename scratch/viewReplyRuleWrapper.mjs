import fs from 'fs';

const filePath = 'services/commentProcessingService.mjs';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

for (let i = 855; i < 895; i++) {
  console.log(`${i + 1}: ${lines[i]}`);
}
