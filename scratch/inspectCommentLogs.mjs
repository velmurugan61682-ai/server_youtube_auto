import fs from 'fs';

const logPath = 'C:/Users/Administrator/.gemini/antigravity-ide/brain/3d00ccab-4b4c-4e09-8b28-2ee72567a935/.system_generated/tasks/task-563.log';

if (fs.existsSync(logPath)) {
  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n');
  
  console.log('--- RECENT COMMENT PIPELINE LOGS (LAST 100 LINES) ---');
  const relevantLines = lines.filter(l => l.includes('Pipeline') || l.includes('SmartReply') || l.includes('Reply') || l.includes('Error') || l.includes('suggestedReply'));
  relevantLines.slice(-100).forEach(l => console.log(l));
} else {
  console.log('Log file not found');
}
