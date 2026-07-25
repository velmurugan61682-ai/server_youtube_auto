import fs from 'fs';

const logPath = 'C:/Users/Administrator/.gemini/antigravity-ide/brain/3d00ccab-4b4c-4e09-8b28-2ee72567a935/.system_generated/tasks/task-140.log';

if (fs.existsSync(logPath)) {
  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n');
  
  let errorLines = [];
  
  lines.forEach((line, index) => {
    const lineLower = line.toLowerCase();
    if (lineLower.includes('error') || lineLower.includes('failed') || lineLower.includes('exception') || lineLower.includes('validation')) {
      errorLines.push(`Line ${index + 1}: ${line}`);
    }
  });
  
  console.log(`Total error/failed lines found: ${errorLines.length}`);
  console.log('First 20 error lines:');
  errorLines.slice(0, 20).forEach(l => console.log(l));
} else {
  console.log('Log file not found');
}
