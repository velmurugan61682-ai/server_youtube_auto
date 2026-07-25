import fs from 'fs';
import path from 'path';

const logPath = 'C:/Users/Administrator/.gemini/antigravity-ide/brain/3d00ccab-4b4c-4e09-8b28-2ee72567a935/.system_generated/tasks/task-140.log';

if (fs.existsSync(logPath)) {
  const content = fs.readFileSync(logPath, 'utf8');
  const lines = content.split('\n');
  
  let processedCount = 0;
  let restoredCount = 0;
  let otherPipelineCount = 0;
  
  lines.forEach(line => {
    if (line.includes('already processed in DB. Skipping.')) {
      processedCount++;
    }
    if (line.includes('Restoring missing/unprocessed comment')) {
      restoredCount++;
    }
    if (line.includes('[Pipeline]') && !line.includes('already processed') && !line.includes('Restoring')) {
      otherPipelineCount++;
      if (otherPipelineCount <= 10) {
        console.log(`Other Pipeline Log: ${line}`);
      }
    }
  });
  
  console.log(`\nProcessed (Skipped) Count: ${processedCount}`);
  console.log(`Restored Count: ${restoredCount}`);
} else {
  console.log('Log file not found');
}
