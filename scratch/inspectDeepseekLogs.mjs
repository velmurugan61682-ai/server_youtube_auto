import fs from 'fs';

const logPath = 'C:/Users/Administrator/.gemini/antigravity-ide/brain/3d00ccab-4b4c-4e09-8b28-2ee72567a935/.system_generated/tasks/task-563.log';

if (fs.existsSync(logPath)) {
  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n');
  
  console.log('--- ALL DEEPSEEK RESPONSE LOGS ---');
  lines.forEach((l, index) => {
    if (l.includes('[DEEPSEEK] Parsed JSON Response') || l.includes('suggestedReply') || l.includes('[Pipeline] Restoring') || l.includes('Restoring missing/unprocessed comment')) {
      console.log(`Line ${index + 1}: ${l}`);
    }
  });
} else {
  console.log('Log file not found');
}
