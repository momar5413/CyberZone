/*
 * CyberZone — التكامل مع غلاف التطبيق الأصلي
 * أندرويد عبر Capacitor، وسطح المكتب (ويندوز/ماك/لينكس) عبر Tauri.
 * في المتصفح العادي لا يفعل هذا الملف شيئاً ويبقى السلوك كما هو.
 */
'use strict';

const Native = (function () {
  const cap = window.Capacitor;
  const capacitor = !!(cap && typeof cap.isNativePlatform === 'function' && cap.isNativePlatform());
  const tauri = !!(window.__TAURI__ || window.__TAURI_INTERNALS__);
  let fsPlugin = null;
  let sharePlugin = null;
  if (capacitor && typeof cap.registerPlugin === 'function') {
    try {
      fsPlugin = cap.registerPlugin('Filesystem');
      sharePlugin = cap.registerPlugin('Share');
    } catch (e) { /* الإضافات غير متوفرة */ }
  }

  /*
   * حفظ ملف نصي (CSV أو نسخة احتياطية):
   * - سطح المكتب: نافذة «حفظ باسم» ثم كتابة الملف.
   * - أندرويد: كتابة الملف مؤقتاً ثم فتح قائمة المشاركة (حفظ في الملفات، Drive، واتساب…).
   * يعيد null إن لم تتوفر طريقة أصلية، فيُستخدم بديل النسخ.
   */
  async function saveFile(filename, content) {
    const T = window.__TAURI__;
    if (tauri && T && T.dialog && T.fs) {
      const path = await T.dialog.save({ defaultPath: filename, title: 'حفظ ' + filename });
      if (!path) return { cancelled: true };
      await T.fs.writeTextFile(path, content);
      return { path: path };
    }
    if (capacitor && fsPlugin && sharePlugin) {
      const res = await fsPlugin.writeFile({ path: filename, data: content, directory: 'CACHE', encoding: 'utf8' });
      await sharePlugin.share({ title: filename, files: [res.uri], dialogTitle: 'حفظ أو مشاركة ' + filename });
      return { shared: true };
    }
    return null;
  }

  // لون أيقونات شريط الحالة في أندرويد حسب سمة التطبيق
  function setBarsStyle(dark) {
    if (!capacitor) return;
    try {
      const bars = window.capacitorExports && window.capacitorExports.SystemBars;
      if (bars) bars.setStyle({ style: dark ? 'DARK' : 'LIGHT' }).catch(function () {});
    } catch (e) { /* غير مدعوم */ }
  }

  if (tauri) {
    document.documentElement.classList.add('is-desktop-app');
    // قائمة المتصفح (تحديث، فحص…) لا معنى لها داخل برنامج سطح المكتب، إلا في حقول الكتابة
    document.addEventListener('contextmenu', function (e) {
      const t = e.target;
      if (!(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA'))) e.preventDefault();
    });
  }
  if (capacitor) document.documentElement.classList.add('is-mobile-app');

  return {
    capacitor: capacitor,
    tauri: tauri,
    any: capacitor || tauri,
    canPrint: !capacitor,
    saveFile: saveFile,
    setBarsStyle: setBarsStyle
  };
})();
