import fs from 'fs';

const filePath = 'services/commentProcessingService.mjs';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

let foundKeyword = false;
for (let i = 500; i < 1250; i++) {
  const line = lines[i];
  if (line.includes('CommentAutomationRule') || line.includes('find({') || line.includes('rule') || line.includes('matches')) {
    console.log(`${i+1}: ${line.trim()}`);
  }
}
