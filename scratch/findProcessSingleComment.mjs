import fs from 'fs';

const filePath = 'services/commentProcessingService.mjs';
const content = fs.readFileSync(filePath, 'utf8');
const lines = content.split('\n');

let startIndex = -1;
let endIndex = -1;

lines.forEach((line, index) => {
  if (line.includes('export const processSingleComment =')) {
    startIndex = index;
  }
  if (startIndex !== -1 && index > startIndex && line.startsWith('};')) {
    if (endIndex === -1) {
      endIndex = index;
    }
  }
});

console.log(`processSingleComment starts at line: ${startIndex + 1}`);
// Let's print out lines around the start
for (let i = startIndex; i < startIndex + 50; i++) {
  console.log(`${i+1}: ${lines[i]}`);
}
