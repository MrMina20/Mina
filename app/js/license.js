/* الواجهة بتاعة الترخيص: السيرفر (Worker) هو اللي بيقرر مين يدخل. هنا بس معرفة الحالة والعدّاد والخروج. */
(function (w) {
  'use strict';
  const O = w.Omran, { H } = O;
  let me = null, skew = 0, timer = 0;
  const nowSec = () => Math.floor(Date.now() / 1000) + skew;
  const left = (e) => { const s = e - nowSec(); if (s >= 172800) return Math.ceil(s / 86400) + ' يوم'; if (s >= 3600) return Math.ceil(s / 3600) + ' ساعة'; return Math.max(1, Math.ceil(s / 60)) + ' دقيقة'; };
  const reload = () => location.replace('/');
  async function init() {
    try { const r = await fetch('/api/me', { credentials: 'same-origin', cache: 'no-store' }); if (!r.ok) { reload(); return new Promise(() => {}); } me = await r.json(); }
    catch (e) { me = { ok: true, dev: false, offline: true }; }
    if (me.now) skew = me.now - Math.floor(Date.now() / 1000);
    if (me.exp) clearTimeout(timer), timer = setTimeout(reload, Math.max(1, (me.exp - nowSec()) * 1000 + 500));
  }
  setInterval(async () => {
    if (!me || me.dev || me.offline) return;
    try { const r = await fetch('/api/check', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: '{}' }); if (r.status === 401) reload(); } catch (e) { /* مفيش نت: العدّاد المحلي بيقفل في ميعاده */ }
  }, 45000);
  const status = () => ({ ok: true, dev: !!(me && me.dev), user: me && me.user, exp: me && me.exp });
  async function exit(force) {
    const dev = !!(me && me.dev);
    if (!force && !(await O.confirmBox(dev ? 'الخروج من وضع المطور؟ هتحتاج الباسورد تاني.' : 'الخروج من البرنامج؟ هتحتاج كود التجربة تاني عشان تدخل.', 'خروج'))) return;
    try { await fetch('/api/logout', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: '{}' }); } catch (e) { /* لا شيء */ }
    location.replace(dev ? '/dev' : '/');
  }
  async function devPage() {
    const app = document.getElementById('app');
    if (!me || !me.dev) { location.replace('/dev'); return; }
    app.innerHTML = '<header class="topbar noprint"><h1>لوحة المطور</h1></header><main class="wrap inner"><section class="panel pad" id="devsec"></section></main>';
    if (!O.DevPanel) await new Promise((res, rej) => { const s = document.createElement('script'); s.src = '/js/dev.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s); }).catch(() => { app.querySelector('#devsec').textContent = 'تعذّر تحميل لوحة المطور.'; });
    if (O.DevPanel) O.DevPanel.mount(app.querySelector('#devsec'));
  }
  const chip = () => me && me.exp ? ` · <span class="trial">فترة التجربة: متبقي ${left(me.exp)}</span>` : '';
  const settingsLink = (host) => { const d = !!(me && me.dev); host.hidden = !d; host.innerHTML = d ? '<h3>نسخة المطور</h3><p class="mut">توليد لينكات وأكواد تجربة للعملاء بمدة تحددها.</p><a class="btn primary" href="#/dev">فتح لوحة المطور</a>' : ''; };
  O.License = { init, status, exit, devPage, settingsLink, chip };
})(window);
