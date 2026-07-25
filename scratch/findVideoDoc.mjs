import fs from 'fs';

const filePath = 'services/commentProcessingService.mjs';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('Video.findOne') || (line.includes('video') && line.includes('title'))) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
