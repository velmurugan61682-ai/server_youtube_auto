import fs from 'fs';

const logPath = 'C:/Users/Administrator/.gemini/antigravity-ide/brain/3d00ccab-4b4c-4e09-8b28-2ee72567a935/.system_generated/tasks/task-563.log';

if (fs.existsSync(logPath)) {
  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n');
  
  console.log('--- LOGS FOR NEW COMMENT ID ---');
  lines.forEach((l, index) => {
    if (l.includes('Ugz3-rj7-sFti391F514AaABAg')) {
      console.log(`Line ${index + 1}: ${l}`);
    }
  });
} else {
  console.log('Log file not found');
}
