const sharp = require('sharp');
const path = require('path');
const fs = require('fs');

const SPLASH_DIR = path.join(__dirname, 'ios/App/App/Assets.xcassets/Splash.imageset');
const CAT_ICON = path.join(__dirname, 'public/cat-icon.png');

// iPhone / iPad 所有启动图尺寸
const splashes = [
  { w: 375, h: 667, scale: 2, idiom: 'iphone' },
  { w: 375, h: 812, scale: 3, idiom: 'iphone' },
  { w: 414, h: 736, scale: 3, idiom: 'iphone' },
  { w: 414, h: 896, scale: 2, idiom: 'iphone' },
  { w: 414, h: 896, scale: 3, idiom: 'iphone' },
  { w: 390, h: 844, scale: 3, idiom: 'iphone' },
  { w: 428, h: 926, scale: 3, idiom: 'iphone' },
  { w: 393, h: 852, scale: 3, idiom: 'iphone' },
  { w: 430, h: 932, scale: 3, idiom: 'iphone' },
  { w: 768, h: 1024, scale: 2, idiom: 'ipad' },
  { w: 810, h: 1080, scale: 2, idiom: 'ipad' },
  { w: 820, h: 1180, scale: 2, idiom: 'ipad' },
  { w: 834, h: 1112, scale: 2, idiom: 'ipad' },
  { w: 834, h: 1210, scale: 2, idiom: 'ipad' },
  { w: 1024, h: 1366, scale: 2, idiom: 'ipad' },
];

const BG_COLOR = { r: 12, g: 12, b: 20, alpha: 1 };

function makeTextSvg(text, fontSize, color) {
  return Buffer.from(`
    <svg width="800" height="120" xmlns="http://www.w3.org/2000/svg">
      <text x="400" y="80" text-anchor="middle"
        font-family="Inter, -apple-system, sans-serif"
        font-weight="700" font-size="${fontSize}px"
        fill="${color}" letter-spacing="6">
        ${text}
      </text>
    </svg>
  `);
}

async function generate() {
  const images = [];

  for (const s of splashes) {
    const pw = s.w * s.scale;
    const ph = s.h * s.scale;

    // 猫图标大小：按屏幕宽度的 28% 来算
    const catSize = Math.round(pw * 0.28);

    // 文字大小：按屏幕宽度的 6.5%
    const fontSize = Math.round(pw * 0.065);
    const textColor = '#ffffff';

    // 图标和文字之间的间距
    const gap = Math.round(pw * 0.04);

    // 读取并缩放猫图标
    const catBuffer = await sharp(CAT_ICON)
      .resize(catSize, catSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .toBuffer();

    // 渲染 "Lanime" 文字 SVG
    const textBuffer = await sharp(makeTextSvg('Lanime', fontSize, textColor))
      .resize({ width: Math.round(pw * 0.7) })
      .png()
      .toBuffer();

    // 计算叠加位置：猫图标在中间偏上，文字在图标下方
    const totalHeight = catSize + gap + Math.round(fontSize * 0.8);
    const catTop = Math.round((ph - totalHeight) / 2);
    const textTop = catTop + catSize + gap;

    const catLeft = Math.round((pw - catSize) / 2);
    // 文字居中（SVG 已经居中，用 tile 方式放上去）
    const textMeta = await sharp(textBuffer).metadata();
    const textLeft = Math.round((pw - textMeta.width) / 2);

    const bg = sharp({
      create: { width: pw, height: ph, channels: 4, background: BG_COLOR },
    });

    const result = await bg
      .composite([
        { input: catBuffer, top: catTop, left: catLeft },
        { input: textBuffer, top: textTop, left: textLeft },
      ])
      .png()
      .toBuffer();

    const name = `splash-${s.w}x${s.h}@${s.scale}x.png`;
    await sharp(result).toFile(path.join(SPLASH_DIR, name));
    images.push({
      idiom: s.idiom,
      scale: `${s.scale}x`,
      size: `${s.w}x${s.h}`,
      filename: name,
    });
    console.log(`  ✓ ${name} (${pw}x${ph}) cat:${catSize}px font:${fontSize}px`);
  }

  const contents = {
    images: images.map(i => ({
      idiom: i.idiom,
      scale: i.scale,
      size: i.size,
      filename: i.filename,
    })),
    info: { author: 'xcode', version: 1 },
  };

  fs.writeFileSync(path.join(SPLASH_DIR, 'Contents.json'), JSON.stringify(contents, null, 2));
  console.log(`\n✓ ${images.length} 张启动图已生成`);
}

generate().catch(e => { console.error(e); process.exit(1); });
