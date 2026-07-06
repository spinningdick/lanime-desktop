// 生成 iOS App Icon 所有尺寸
const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const ICONSET_DIR = path.join(__dirname, 'ios/App/App/Assets.xcassets/AppIcon.appiconset');
const SOURCE = path.join(__dirname, 'public/cat-icon.png');

// iOS App Icon 需要的所有尺寸 (points x scale = pixels)
const icons = [
  { size: 20, scales: [2, 3], idiom: 'iphone' },
  { size: 29, scales: [2, 3], idiom: 'iphone' },
  { size: 40, scales: [2, 3], idiom: 'iphone' },
  { size: 60, scales: [2, 3], idiom: 'iphone' },
  { size: 20, scales: [1, 2], idiom: 'ipad' },
  { size: 29, scales: [1, 2], idiom: 'ipad' },
  { size: 40, scales: [1, 2], idiom: 'ipad' },
  { size: 76, scales: [1, 2], idiom: 'ipad' },
  { size: 83.5, scales: [2], idiom: 'ipad' },
  { size: 1024, scales: [1], idiom: 'ios-marketing' },
];

async function generateIcons() {
  // 先创建一个 1024x1024 的底图，把 cat-icon 居中放进去
  const bg = sharp({
    create: {
      width: 1024,
      height: 1024,
      channels: 4,
      background: { r: 20, g: 20, b: 30, alpha: 1 }
    }
  });

  // 把猫放到 820x820，占图标面积的 80%
  const overlay = await sharp(SOURCE)
    .resize(820, 820, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .toBuffer();

  const masterIcon = await bg
    .composite([{ input: overlay, gravity: 'center' }])
    .png()
    .toBuffer();

  // 生成所有尺寸
  const images = [];
  for (const icon of icons) {
    for (const scale of icon.scales) {
      const px = Math.round(icon.size * scale);
      const filename = `${icon.size}x${icon.size}@${scale}x.png`;
      // 对于 83.5 点的情况 (iPad Pro)
      const baseName = icon.size === 83.5 ? '83.5x83.5' : `${icon.size}x${icon.size}`;
      const outName = `${baseName}@${scale}x.png`;

      await sharp(masterIcon)
        .resize(px, px)
        .png()
        .toFile(path.join(ICONSET_DIR, outName));

      images.push({
        size: `${icon.size}x${icon.size}`,
        scale: `${scale}x`,
        idiom: icon.idiom,
        filename: outName,
      });
      console.log(`  ✓ ${outName} (${px}x${px})`);
    }
  }

  // 更新 Contents.json
  const contents = {
    images: images.map(img => ({
      size: img.size,
      idiom: img.idiom,
      filename: img.filename,
      scale: img.scale,
    })),
    info: {
      author: 'xcode',
      version: 1,
    },
  };

  fs.writeFileSync(
    path.join(ICONSET_DIR, 'Contents.json'),
    JSON.stringify(contents, null, 2)
  );
  console.log('\n✓ Contents.json 已更新');
  console.log(`✓ 共生成 ${images.length} 个图标文件`);
}

generateIcons().catch(err => {
  console.error('生成失败:', err);
  process.exit(1);
});
