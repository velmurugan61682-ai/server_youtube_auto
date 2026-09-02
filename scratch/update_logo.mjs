import sharp from 'sharp';
import fs from 'fs';
import path from 'path';

const srcImage = 'C:/Users/Administrator/.gemini/antigravity-ide/brain/1872bcbb-3eca-44b8-8192-4eff55a79b9a/.user_uploaded/media_1788263269792.png';
const publicDir = 'C:/Users/Administrator/Youtube/client_youtube_auto/public';
const distDir = 'C:/Users/Administrator/Youtube/client_youtube_auto/dist';

async function run() {
  console.log('Reading source image metadata...');
  const meta = await sharp(srcImage).metadata();
  console.log('Source image info:', meta);

  // Let's create the output files:
  // 1. logo.png (full resolution or 512x512)
  // 2. brand-logo.png
  // 3. logo_icon.png
  // 4. icon-512.png (512x512)
  // 5. icon-192.png (192x192)
  // 6. favicon.png (64x64 or 32x32)

  const targets = [
    { dir: publicDir },
    { dir: distDir }
  ];

  for (const t of targets) {
    if (!fs.existsSync(t.dir)) continue;

    // logo.png
    await sharp(srcImage)
      .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(t.dir, 'logo.png'));

    // brand-logo.png
    await sharp(srcImage)
      .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(t.dir, 'brand-logo.png'));

    // logo_icon.png
    await sharp(srcImage)
      .resize(256, 256, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(t.dir, 'logo_icon.png'));

    // icon-512.png
    await sharp(srcImage)
      .resize(512, 512, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(t.dir, 'icon-512.png'));

    // icon-192.png
    await sharp(srcImage)
      .resize(192, 192, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(t.dir, 'icon-192.png'));

    // favicon.png
    await sharp(srcImage)
      .resize(64, 64, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png()
      .toFile(path.join(t.dir, 'favicon.png'));
      
    console.log('Successfully updated logos in:', t.dir);
  }
}

run().catch(console.error);
