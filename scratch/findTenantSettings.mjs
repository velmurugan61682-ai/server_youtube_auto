import fs from 'fs';

const filePath = 'services/commentProcessingService.mjs';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('tenantSettings') || line.includes('const tenantSettings =')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
