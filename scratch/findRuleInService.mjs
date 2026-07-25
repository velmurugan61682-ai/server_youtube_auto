import fs from 'fs';

const filePath = 'services/commentProcessingService.mjs';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

lines.forEach((line, index) => {
  if (line.includes('CommentAutomationRule') || line.includes('AutomationRule') || line.includes('automatedDmContent')) {
    console.log(`Line ${index + 1}: ${line.trim()}`);
  }
});
