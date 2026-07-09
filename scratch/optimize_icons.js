import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const publicDir = 'd:/tech vaseegrah_youtube_comment/client/public';
const backupDir = 'd:/tech vaseegrah_youtube_comment/client/public_backup';

// Create backup first
if (!fs.existsSync(backupDir)) {
  fs.mkdirSync(backupDir);
  console.log('Created backup directory');
}

const files = [
  'apple-touch-icon.png',
  'favicon.ico',
  'icon-192.png',
  'icon-512.png',
  'logo.png'
];

files.forEach(file => {
  const filePath = path.join(publicDir, file);
  const backupPath = path.join(backupDir, file);
  if (fs.existsSync(filePath) && !fs.existsSync(backupPath)) {
    fs.copyFileSync(filePath, backupPath);
    console.log(`Backed up ${file}`);
  }
});

async function optimize() {
  const source = path.join(backupDir, 'logo.png'); // Use the backup logo as the source for all resizing
  
  if (!fs.existsSync(source)) {
    console.error('Source backup logo.png does not exist!');
    return;
  }

  console.log('Resizing and optimizing icons...');

  // 1. icon-192.png (192x192)
  await sharp(source)
    .resize(192, 192)
    .png({ quality: 80, compressionLevel: 9 })
    .toFile(path.join(publicDir, 'icon-192.png'));
  console.log('✓ Optimized icon-192.png');

  // 2. icon-512.png (512x512)
  await sharp(source)
    .resize(512, 512)
    .png({ quality: 80, compressionLevel: 9 })
    .toFile(path.join(publicDir, 'icon-512.png'));
  console.log('✓ Optimized icon-512.png');

  // 3. apple-touch-icon.png (180x180)
  await sharp(source)
    .resize(180, 180)
    .png({ quality: 80, compressionLevel: 9 })
    .toFile(path.join(publicDir, 'apple-touch-icon.png'));
  console.log('✓ Optimized apple-touch-icon.png');

  // 4. logo.png (512x512)
  await sharp(source)
    .resize(512, 512)
    .png({ quality: 80, compressionLevel: 9 })
    .toFile(path.join(publicDir, 'logo.png'));
  console.log('✓ Optimized logo.png');

  // 5. favicon.ico (32x32 png, works as favicon in modern browsers)
  await sharp(source)
    .resize(32, 32)
    .png({ quality: 80, compressionLevel: 9 })
    .toFile(path.join(publicDir, 'favicon.ico'));
  console.log('✓ Optimized favicon.ico');

  // Compare sizes
  files.forEach(file => {
    const oldSize = fs.statSync(path.join(backupDir, file)).size;
    const newSize = fs.statSync(path.join(publicDir, file)).size;
    console.log(`${file}: ${Math.round(oldSize / 1024)} KB -> ${Math.round(newSize / 1024)} KB (${Math.round((oldSize - newSize) / oldSize * 100)}% saved)`);
  });
}

optimize().catch(console.error);
