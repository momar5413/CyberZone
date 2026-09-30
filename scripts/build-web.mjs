// يجهّز نسخة الواجهة داخل dist/ ليغلّفها تطبيق أندرويد (Capacitor) أو سطح المكتب (Tauri).
// الاستخدام: node scripts/build-web.mjs [android|desktop]
import { cpSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const target = process.argv[2] || 'desktop';
const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const dist = join(root, 'dist');

rmSync(dist, { recursive: true, force: true });
mkdirSync(dist, { recursive: true });
cpSync(join(root, 'assets'), join(dist, 'assets'), { recursive: true });

// ملفات الموقع القابل للتثبيت (عامل الخدمة والـ manifest) لا تلزم داخل التطبيق الأصلي
let html = readFileSync(join(root, 'index.html'), 'utf8');
html = html.replace(/<!-- pwa:start -->[\s\S]*?<!-- pwa:end -->\s*/g, '');

if (target === 'android') {
  const core = join(root, 'node_modules/@capacitor/core/dist/capacitor.js');
  if (!existsSync(core)) throw new Error('Run npm install first: @capacitor/core is missing');
  cpSync(core, join(dist, 'assets/js/capacitor.js'));
  html = html.replace('<script src="assets/js/billing.js"></script>',
    '<script src="assets/js/capacitor.js"></script>\n<script src="assets/js/billing.js"></script>');
}

writeFileSync(join(dist, 'index.html'), html);
console.log(`dist/ ready for ${target}`);
