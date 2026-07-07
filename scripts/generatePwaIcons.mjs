import sharp from 'sharp';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const svgPath = path.resolve(__dirname, '../../client/public/favicon.svg');
const dest192 = path.resolve(__dirname, '../../client/public/icon-192.png');
const dest512 = path.resolve(__dirname, '../../client/public/icon-512.png');

async function generate() {
  try {
    console.log('Generating PWA icons using sharp...');
    console.log('Source SVG:', svgPath);
    
    await sharp(svgPath)
      .resize(192, 192)
      .png()
      .toFile(dest192);
      
    await sharp(svgPath)
      .resize(512, 512)
      .png()
      .toFile(dest512);
      
    console.log('✅ PWA icons generated successfully:');
    console.log('  - 192x192 icon saved to:', dest192);
    console.log('  - 512x512 icon saved to:', dest512);
  } catch (error) {
    console.error('❌ Failed to generate PWA icons:', error.message);
    process.exit(1);
  }
}

generate();
