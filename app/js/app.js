/* نقطة البداية */
(function (w) {
  'use strict';
  const O = w.Omran;
  w.addEventListener('hashchange', O.route);
  w.addEventListener('storage', (e) => { if (e.key === O.KEY) O.route(); });
  O.License.init().then(() => {
    O.route();
    O.FS.gc(); // تنظيف ملفات العقود اللي مش مربوطة بأي سجل
  });
})(window);
