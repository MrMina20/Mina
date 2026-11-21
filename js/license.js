/* أكواد التجربة: توقيع HMAC-SHA256 بيتحقق منه المتصفح نفسه من غير سيرفر */
(function (w) {
  'use strict';
  const O = w.Omran, { S, H, toast, modal } = O;
  const CFG = w.OMRAN_CONFIG || { gate: false, secret: '', devHash: '' };
  const enc = new TextEncoder(), dec = new TextDecoder();
  const SS = { get: (k) => { try { return sessionStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { sessionStorage.setItem(k, v); } catch (e) { /* لا شيء */ } }, del: (k) => { try { sessionStorage.removeItem(k); } catch (e) { /* لا شيء */ } } };
  const API = String((w.OMRAN_CONFIG && w.OMRAN_CONFIG.api) || '').replace(/\/+$/, ''), SRV = !!API;
  const devTok = () => SS.get('omran_dev') || LS.get('omran_dev') || '';
  const isDev = () => { const t = devTok(); if (!t) return false; if (!SRV) return t === '1'; try { return JSON.parse(dec.decode(unb64(t.split('.')[0]))).e > nowSec(); } catch (e) { return false; } };
  const LS = { get: (k) => { try { return localStorage.getItem(k); } catch (e) { return null; } }, set: (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* لا شيء */ } }, del: (k) => { try { localStorage.removeItem(k); } catch (e) { /* لا شيء */ } } };

  /* ---- SHA-256 و HMAC بدون مكتبات (يشتغل حتى من file://) ---- */
  const K = [], H0 = [];
  (function () { let n = 2, c = 0; const isP = (x) => { for (let i = 2; i * i <= x; i++) if (x % i === 0) return false; return true; }; while (c < 64) { if (isP(n)) { if (c < 8) H0[c] = (Math.pow(n, 0.5) % 1) * 4294967296 | 0; K[c] = (Math.pow(n, 1 / 3) % 1) * 4294967296 | 0; c++; } n++; } })();
  function sha256(msg) {
    const l = msg.length, tot = ((l + 9 + 63) >> 6) << 6, buf = new Uint8Array(tot);
    buf.set(msg); buf[l] = 0x80;
    const dv = new DataView(buf.buffer); dv.setUint32(tot - 8, Math.floor(l / 536870912)); dv.setUint32(tot - 4, (l << 3) >>> 0);
    let h = H0.slice(); const Wd = new Array(64);
    for (let o = 0; o < tot; o += 64) {
      for (let i = 0; i < 16; i++) Wd[i] = dv.getUint32(o + i * 4);
      for (let i = 16; i < 64; i++) { const a = Wd[i - 15], b = Wd[i - 2]; Wd[i] = (Wd[i - 16] + ((a >>> 7 | a << 25) ^ (a >>> 18 | a << 14) ^ (a >>> 3)) + Wd[i - 7] + ((b >>> 17 | b << 15) ^ (b >>> 19 | b << 13) ^ (b >>> 10))) | 0; }
      let [a, b, c, d, e, f, g, hh] = h;
      for (let i = 0; i < 64; i++) {
        const t1 = (hh + ((e >>> 6 | e << 26) ^ (e >>> 11 | e << 21) ^ (e >>> 25 | e << 7)) + ((e & f) ^ (~e & g)) + K[i] + Wd[i]) | 0;
        const t2 = (((a >>> 2 | a << 30) ^ (a >>> 13 | a << 19) ^ (a >>> 22 | a << 10)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
        hh = g; g = f; f = e; e = (d + t1) | 0; d = c; c = b; b = a; a = (t1 + t2) | 0;
      }
      h = [h[0] + a | 0, h[1] + b | 0, h[2] + c | 0, h[3] + d | 0, h[4] + e | 0, h[5] + f | 0, h[6] + g | 0, h[7] + hh | 0];
    }
    const out = new Uint8Array(32), ov = new DataView(out.buffer); h.forEach((x, i) => ov.setUint32(i * 4, x >>> 0)); return out;
  }
  function hmac(key, msg) {
    let k = key.length > 64 ? sha256(key) : key; const kp = new Uint8Array(64); kp.set(k);
    const ip = kp.map((x) => x ^ 0x36), op = kp.map((x) => x ^ 0x5c);
    const inner = new Uint8Array(64 + msg.length); inner.set(ip); inner.set(msg, 64);
    const outer = new Uint8Array(96); outer.set(op); outer.set(sha256(inner), 64); return sha256(outer);
  }
  const hex = (b) => Array.from(b).map((x) => x.toString(16).padStart(2, '0')).join('');
  const b64 = (b) => btoa(String.fromCharCode.apply(null, b)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  const unb64 = (s) => Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), (c) => c.charCodeAt(0));
  const sign = (p) => b64(hmac(enc.encode(CFG.secret), enc.encode(p)).slice(0, 12));
  const ITER = CFG.iter || 30000;
  const devHash = (pass) => { const pb = enc.encode(pass); let h = sha256(enc.encode(pass + '|' + CFG.secret)); for (let i = 0; i < ITER; i++) { const x = new Uint8Array(32 + pb.length); x.set(h); x.set(pb, 32); h = sha256(x); } return hex(h); };
  const uname = (s) => H.norm(String(s || '')).replace(/\s+/g, ' ').trim();

  /* ---- الوقت: ما بيرجعش لورا حتى لو الجهاز اتلعب في ساعته ---- */
  const nowSec = () => { const real = Math.floor(Date.now() / 1000) + (SRV ? (+LS.get('omran_skew') || 0) : 0), last = +LS.get('omran_ls') || 0, t = Math.max(real, last); if (t > last) LS.set('omran_ls', String(t)); return t; };

  const UNITS = { n: ['دقيقة', 60], h: ['ساعة', 3600], d: ['يوم', 86400], m: ['شهر', 2592000], y: ['سنة', 31536000] };
  const ACT_WINDOW = 30 * 86400; // الكود اللي ما اتستخدمش بيتلغي بعد 30 يوم من إنشائه
  function make(user, n, unit) {
    const d = Math.round(n * UNITS[unit][1]), x = nowSec() + ACT_WINDOW, i = b64(w.crypto.getRandomValues(new Uint8Array(5)));
    const p = b64(enc.encode(JSON.stringify({ u: user.trim(), d, x, i })));
    return { code: 'OM1.' + p + '.' + sign(p), d, x };
  }
  function parse(code) {
    const m = String(code || '').trim().match(/^OM1\.([\w-]+)\.([\w-]+)$/);
    if (!m || sign(m[1]) !== m[2]) return null;
    try { const d = JSON.parse(dec.decode(unb64(m[1]))); d.sig = m[2]; return d && d.u && (d.e || (d.d && d.x)) ? d : null; } catch (e) { return null; }
  }
  // المدة بتبدأ أول ما العميل يدخل الكود، وبتتسجل عشان الخروج والدخول بنفس الكود ما يبدأش من جديد
  const acts = () => { try { return JSON.parse(LS.get('omran_act') || '{}') || {}; } catch (e) { return {}; } };
  const expiry = (d) => { if (d.e) return d.e; const st = acts()[d.sig]; return st ? st + d.d : 0; };
  const durTxt = (d) => { for (const [n, k] of [['سنة', 31536000], ['شهر', 2592000], ['يوم', 86400], ['ساعة', 3600], ['دقيقة', 60]]) if (d >= k && d % k === 0) return d / k + ' ' + n; return Math.round(d / 60) + ' دقيقة'; };
  const left = (e) => {
    const s = e - nowSec();
    if (s >= 172800) return Math.ceil(s / 86400) + ' يوم';
    if (s >= 3600) return Math.ceil(s / 3600) + ' ساعة';
    return Math.max(1, Math.ceil(s / 60)) + ' دقيقة';
  };
  const when = (e) => new Date(e * 1000).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });

  /* ---- وضع السيرفر: الكود بيتفعّل ويتراقب من السيرفر (مرة واحدة، جهاز واحد، ممكن يتلغي) ---- */
  const deviceId = () => { let d = LS.get('omran_device'); if (!d) { d = b64(w.crypto.getRandomValues(new Uint8Array(12))); LS.set('omran_device', d); } return d; };
  async function call(path, body) {
    try { const r = await fetch(API + path, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) }); const j = await r.json().catch(() => ({})); return Object.assign({ http: r.status }, j); } catch (e) { return { offline: true }; }
  }
  const getLic = () => { try { return JSON.parse(LS.get('omran_lic') || 'null'); } catch (e) { return null; } };
  const sync = (r) => { if (r && r.now) { LS.set('omran_skew', String(r.now - Math.floor(Date.now() / 1000))); LS.set('omran_ls', String(r.now)); } };
  async function verify() {
    const l = getLic(); if (!l) return '';
    const r = await call('/check', { code: l.code, user: l.u, device: deviceId() });
    if (r.offline) return 'offline';
    if (r.ok) { sync(r); l.exp = r.exp; l.ok = nowSec(); LS.set('omran_lic', JSON.stringify(l)); return ''; }
    LS.set('omran_why', r.error || ''); LS.set('omran_lu', l.u); LS.del('omran_lic'); return r.error || 'rejected';
  }
  async function activateSrv(user, code) {
    const r = await call('/activate', { user: user.trim(), code: code.trim().toUpperCase(), device: deviceId() });
    if (r.offline) return 'مفيش اتصال بالإنترنت. اتأكد وجرّب تاني.';
    if (!r.ok) return r.error || 'الكود غير صحيح.';
    sync(r); LS.set('omran_lic', JSON.stringify({ u: user.trim(), code: r.code, exp: r.exp, ok: nowSec() })); LS.del('omran_why'); return '';
  }
  async function tryDevSrv(pass, remember) {
    const r = await call('/dev/login', { password: String(pass || '') });
    if (r.offline) return 'مفيش اتصال بالسيرفر.';
    if (!r.ok) return r.error || 'كلمة السر غلط.';
    sync(r); (remember ? LS : SS).set('omran_dev', r.token); return '';
  }

  function status() {
    if (SRV && CFG.gate && !isDev()) {
      const l = getLic();
      if (!l) return { ok: false, reason: 'none' };
      if (l.exp <= nowSec()) return { ok: false, reason: 'expired', user: l.u, exp: l.exp };
      if (nowSec() - (l.ok || 0) > 600) return { ok: false, reason: 'verify', user: l.u };
      return { ok: true, user: l.u, exp: l.exp };
    }
    if (!CFG.gate || isDev()) return { ok: true, dev: isDev() };
    let lic = null; try { lic = JSON.parse(LS.get('omran_lic') || 'null'); } catch (e) { /* لا شيء */ }
    if (!lic) return { ok: false, reason: 'none' };
    const d = parse(lic.code);
    if (!d || uname(d.u) !== uname(lic.u)) return { ok: false, reason: 'none' };
    const exp = expiry(d);
    if (!exp) return { ok: false, reason: 'none' };
    if (exp <= nowSec()) return { ok: false, reason: 'expired', user: d.u, exp };
    return { ok: true, user: d.u, exp };
  }
  function activate(user, code) {
    const d = parse(code);
    if (!d) return 'الكود غير صحيح. اتأكد إنك نسخته كامل.';
    if (uname(d.u) !== uname(user)) return 'اسم المستخدم مش مطابق للكود.';
    if (!d.e && !acts()[d.sig]) {
      if (d.x <= nowSec()) return 'الكود ده انتهت مهلة تفعيله. اطلب كود جديد.';
      const a2 = acts(); a2[d.sig] = nowSec(); LS.set('omran_act', JSON.stringify(a2)); // العدّ بيبدأ من هنا
    }
    if (expiry(d) <= nowSec()) return 'الكود ده انتهت مدته. اطلب كود جديد.';
    LS.set('omran_lic', JSON.stringify({ u: user.trim(), code: code.trim() }));
    return '';
  }

  /* ---- شاشة القفل ---- */
  function gate(st) {
    const app = document.getElementById('app'), expired = st && st.reason === 'expired';
    if (st && st.reason === 'verify') {
      app.innerHTML = `<div class="gate"><div class="gcard panel"><div class="gbrand">${O.BRAND}<div><strong>${H.esc(S.meta().company || 'عمران')}</strong><small>جاري التحقق من الكود...</small></div></div><p class="gerr" id="ve"></p><button class="btn" id="vr" hidden>إعادة المحاولة</button></div></div>`;
      const go = async () => { const r = await verify(); if (r === 'offline') { document.getElementById('ve').textContent = 'محتاج اتصال بالإنترنت للتحقق من الكود.'; document.getElementById('vr').hidden = false; } else O.route(); };
      document.getElementById('vr').onclick = () => { document.getElementById('vr').hidden = true; document.getElementById('ve').textContent = ''; go(); };
      go(); return;
    }
    const why = SRV ? LS.get('omran_why') : '';
    app.innerHTML = `<div class="gate"><form class="gcard panel" id="gf" autocomplete="off">
      <div class="gbrand">${O.BRAND}<div><strong>${H.esc(S.meta().company || 'عمران')}</strong><small>إدارة العقارات والمقاولات</small></div></div>
      <h2>${expired ? 'انتهت فترة التجربة' : 'نسخة تجريبية'}</h2>
      <p class="mut">${expired ? 'انتهت التجربة بتاريخ ' + when(st.exp) + '. اطلب كود جديد وكمّل من حيث وقفت، بياناتك محفوظة.' : (why ? H.esc(why) + ' ' : '') + 'من فضلك ادخل الكود. اكتب اسم المستخدم وكود التجربة اللي وصلك.'}</p>
      <label class="fld"><span>اسم المستخدم</span><input id="gu" value="${H.esc((st && st.user) || joinName() || LS.get('omran_lu') || '')}" autocomplete="off"></label>
      <label class="fld"><span>كود التجربة</span><input id="gc" dir="ltr" placeholder="${SRV ? 'XXXX-XXXX-XXXX' : 'OM1....'}" autocomplete="off"></label>
      <p class="gerr" id="ge" role="alert"></p>
      <button class="btn primary" type="submit">دخول</button></form></div>`;
    document.getElementById('gf').onsubmit = async (ev) => {
      ev.preventDefault();
      const sb = ev.target.querySelector('button[type=submit]'); sb.disabled = true;
      const u = document.getElementById('gu').value, c = document.getElementById('gc').value;
      const err = SRV ? await activateSrv(u, c) : activate(u, c);
      sb.disabled = false;
      if (err) { document.getElementById('ge').textContent = err; return; }
      toast('أهلاً بيك، التجربة اشتغلت'); location.hash = '#/'; O.route();
    };
    const gc = document.getElementById('gc'); if (gc && document.getElementById('gu').value) gc.focus();
  }
  const joinName = () => { const m = (location.hash || '').match(/^#\/join\/(.+)$/); try { return m ? decodeURIComponent(m[1]) : ''; } catch (e) { return ''; } };
  // دخول المطور: بيبطّأ المحاولات الغلط (30 ثانية بعد 3 محاولات وبيتضاعف)
  function tryDev(pass, remember) {
    let f = { n: 0, until: 0 }; try { f = JSON.parse(LS.get('omran_fail') || '') || f; } catch (e) { /* لا شيء */ }
    const t = Date.now();
    if (f.until > t) return 'استنى ' + Math.ceil((f.until - t) / 1000) + ' ثانية وجرّب تاني.';
    if (devHash(String(pass || '').trim()) === CFG.devHash) { if (remember) LS.set('omran_dev', '1'); else SS.set('omran_dev', '1'); LS.del('omran_fail'); return ''; }
    f.n = (f.n || 0) + 1; f.until = f.n >= 3 ? t + Math.min(900000, 30000 * Math.pow(2, f.n - 3)) : 0; LS.set('omran_fail', JSON.stringify(f));
    return 'كلمة السر غلط.';
  }
  // صفحة دخول المطور (#/dev) ومنها لوحة توليد الأكواد واللينكات
  function devPage() {
    const app = document.getElementById('app');
    if (isDev()) {
      app.innerHTML = `<header class="topbar noprint"><h1>لوحة المطور</h1></header><main class="wrap inner"><section class="panel pad" id="devsec"></section></main>`;
      mountDev(app.querySelector('#devsec')); return;
    }
    app.innerHTML = `<div class="gate"><form class="gcard panel" id="df" autocomplete="off">
      <div class="gbrand">${O.BRAND}<div><strong>دخول المطور</strong><small>للمطور فقط</small></div></div>
      <p class="mut">من فضلك ادخل كلمة سر المطور.</p>
      <label class="fld"><span>كلمة سر المطور</span><input id="dp" type="password" autocomplete="off"></label>
      <label class="chk"><input type="checkbox" id="dr"><span>حفظ الدخول على هذا الجهاز (من غير ما يطلب الباسورد تاني)</span></label>
      <p class="gerr" id="de" role="alert"></p><button class="btn primary" type="submit">دخول</button></form></div>`;
    document.getElementById('dp').focus();
    document.getElementById('df').onsubmit = (ev) => {
      ev.preventDefault();
      const btn = ev.target.querySelector('button'); btn.disabled = true;
      setTimeout(async () => { const pw = document.getElementById('dp').value, rm = document.getElementById('dr').checked, err = SRV ? await tryDevSrv(pw, rm) : tryDev(pw, rm); btn.disabled = false; if (err) document.getElementById('de').textContent = err; else { toast('أهلاً يا مطور'); O.route(); } }, 30);
    };
  }

  /* ---- لوحة المطور في الإعدادات ---- */
  const trials = () => { try { return JSON.parse(LS.get('omran_trials') || '[]'); } catch (e) { return []; } };
  const saveTrials = (a) => LS.set('omran_trials', JSON.stringify(a));
  const copy = async (t) => { try { await navigator.clipboard.writeText(t); toast('تم النسخ'); } catch (e) { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('تم النسخ'); } catch (er) { toast('انسخه يدوي', 'warn'); } ta.remove(); } };
  const link = (u) => location.href.split('#')[0] + '#/join/' + encodeURIComponent(u);
  const msg = (t) => `جرّب برنامج عمران لإدارة العقارات والمقاولات\nالرابط: ${link(t.u)}\nاسم المستخدم: ${t.u}\nكود التجربة: ${t.code}\nمدة التجربة ${durTxt(t.d)}، وبتبدأ لحظة ما تدخل الكود لأول مرة.`;

  async function mountDevSrv(host) {
    const tok = devTok(), api = (p, b) => call(p, Object.assign({ token: tok }, b || {}));
    const st = (t) => t.status === 'active' ? `<span class="g">شغال، بدأ ${when(t.start)} (متبقي ${left(t.exp)})</span>` : t.status === 'new' ? '<span>لسه ما اتستخدمش</span>' : t.status === 'revoked' ? '<span class="r">ملغي</span>' : '<span class="mut">منتهي</span>';
    let last = null, items = [];
    const draw = async (fresh) => {
      if (fresh !== false) {
        host.innerHTML = '<p class="mut">جاري التحميل...</p>';
        const r = await api('/dev/list');
        if (r.offline) { host.innerHTML = '<p class="mut">مفيش اتصال بالسيرفر.</p><button class="btn" id="dvrt">إعادة المحاولة</button>'; host.onclick = (e) => { if (e.target.id === 'dvrt') draw(); }; return; }
        if (!r.ok) { SS.del('omran_dev'); LS.del('omran_dev'); location.hash = '#/dev'; O.route(); return; }
        sync(r); items = r.items;
      }
      host.innerHTML = `<h3>كود تجربة جديد</h3>
        <div class="fgrid cols3"><label class="fld"><span>اسم المستخدم (للعميل)</span><input id="dvu" placeholder="مثلاً: شركة النور"></label>
        <label class="fld"><span>المدة</span><div class="dur"><input id="dvn" inputmode="decimal" value="3"><select id="dvt"><option value="n">دقيقة</option><option value="h">ساعة</option><option value="d" selected>يوم</option><option value="m">شهر</option><option value="y">سنة</option></select></div></label>
        <div class="fld"><span>&nbsp;</span><button class="btn primary" id="dvm">إنشاء الكود</button></div></div>
        ${last ? `<div class="dvout"><b>${H.esc(last.u)}</b><small>المدة ${durTxt(last.d)}، وبتبدأ لحظة ما العميل يدخل الكود لأول مرة. الكود بيشتغل على جهاز واحد بس.</small><textarea readonly dir="ltr" rows="1" id="dvc">${last.code}</textarea><div class="dvlink"><small>اللينك للعميل (اسمه مكتوب فيه جاهز)</small><input readonly dir="ltr" value="${link(last.u)}"></div><div class="row-actions"><button class="btn primary" data-cpl="${link(last.u)}">نسخ اللينك</button><button class="btn" data-cp="${last.code}">نسخ الكود</button><button class="btn" id="dvmsg">نسخ رسالة كاملة</button></div></div>` : ''}
        ${items.length ? `<h3 class="dvh">الأكواد (${items.length})</h3><div class="tblw"><table class="tbl"><thead><tr><th>المستخدم</th><th>المدة</th><th>الحالة</th><th></th></tr></thead><tbody>${items.map((t, i) => `<tr><td>${H.esc(t.u)}<br><small class="mut" dir="ltr">${t.code}</small></td><td>${durTxt(t.d)}</td><td>${st(t)}</td><td class="ra"><button class="lnk" data-cpl="${link(t.u)}">اللينك</button><button class="lnk" data-cp="${t.code}">الكود</button><button class="lnk" data-cpm="${i}">الرسالة</button>${t.status === 'active' || t.status === 'new' ? `<button class="lnk del" data-rv="${t.code}">إلغاء</button>` : ''}${t.bound && t.status === 'active' ? `<button class="lnk" data-rs="${t.code}">فك الجهاز</button>` : ''}<button class="lnk del" data-dl="${t.code}">حذف</button></td></tr>`).join('')}</tbody></table></div>` : ''}
        <p class="mut dvnote">الكود بيتفعّل من السيرفر: بيشتغل مرة واحدة على جهاز واحد، والعدّاد بيبدأ لما العميل يدخله، وتقدر تلغيه في أي وقت وهيقفل عنده في خلال دقيقة تقريباً. «فك الجهاز» لو العميل غيّر جهازه أو مسح بيانات المتصفح.</p>
        <div class="row-actions"><button class="btn" id="dvr">تحديث</button><button class="btn" id="dvx">خروج من وضع المطور</button></div>`;
      host.onclick = async (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.id === 'dvm') {
          const u = host.querySelector('#dvu').value.trim(), n = H.toNum(host.querySelector('#dvn').value), un = host.querySelector('#dvt').value;
          if (!u) { toast('اكتب اسم المستخدم', 'warn'); return; }
          if (!(n > 0)) { toast('اكتب مدة صحيحة', 'warn'); return; }
          b.disabled = true;
          const r = await api('/dev/issue', { user: u, seconds: Math.round(n * UNITS[un][1]) });
          if (!r.ok) { b.disabled = false; toast(r.error || 'حصلت مشكلة في السيرفر', 'warn'); return; }
          last = r; draw();
        }
        if (b.dataset.cp) copy(b.dataset.cp);
        if (b.dataset.cpl) copy(b.dataset.cpl);
        if (b.id === 'dvmsg') copy(msg(last));
        if (b.dataset.cpm != null) copy(msg(items[+b.dataset.cpm]));
        if (b.id === 'dvr') draw();
        if (b.dataset.rv && await O.confirmBox('إلغاء الكود ده؟ العميل هيتقفل عليه فوراً تقريباً.', 'إلغاء الكود')) { await api('/dev/revoke', { code: b.dataset.rv }); toast('تم إلغاء الكود'); draw(); }
        if (b.dataset.rs) { await api('/dev/reset', { code: b.dataset.rs }); toast('تم فك الكود من الجهاز'); draw(); }
        if (b.dataset.dl && await O.confirmBox('حذف الكود نهائياً؟', 'حذف')) { await api('/dev/delete', { code: b.dataset.dl }); draw(); }
        if (b.id === 'dvx') { LS.del('omran_dev'); SS.del('omran_dev'); toast('تم الخروج من وضع المطور'); location.hash = '#/dev'; O.route(); }
      };
    };
    draw();
  }
  function mountDev(host) {
    if (SRV) { mountDevSrv(host); return; }
    const draw = (last) => {
      if (!isDev()) { host.innerHTML = ''; return; }
      const list = trials().sort((a, b) => b.created - a.created);
      host.innerHTML = `<h3>نسخة المطور: كود تجربة جديد</h3>
        <div class="fgrid cols3"><label class="fld"><span>اسم المستخدم (للعميل)</span><input id="dvu" placeholder="مثلاً: شركة النور"></label>
        <label class="fld"><span>المدة</span><div class="dur"><input id="dvn" inputmode="decimal" value="3"><select id="dvt"><option value="n">دقيقة</option><option value="h">ساعة</option><option value="d" selected>يوم</option><option value="m">شهر</option><option value="y">سنة</option></select></div></label>
        <div class="fld"><span>&nbsp;</span><button class="btn primary" id="dvm">إنشاء الكود</button></div></div>
        ${last ? `<div class="dvout"><b>${H.esc(last.u)}</b><small>المدة ${durTxt(last.d)}، وبتبدأ لحظة ما العميل يدخل الكود (الكود صالح للتفعيل لحد ${when(last.x)})</small><textarea readonly dir="ltr" rows="3" id="dvc">${last.code}</textarea><div class="dvlink"><small>اللينك للعميل (اسمه مكتوب فيه جاهز)</small><input readonly dir="ltr" value="${link(last.u)}"></div><div class="row-actions"><button class="btn primary" data-cpl="${link(last.u)}">نسخ اللينك</button><button class="btn" data-cp="${last.code}">نسخ الكود</button><button class="btn" id="dvmsg">نسخ رسالة كاملة</button></div></div>` : ''}
        ${list.length ? `<h3 class="dvh">الأكواد اللي اتعملت (${list.length})</h3><div class="tblw"><table class="tbl"><thead><tr><th>المستخدم</th><th>المدة</th><th>الحالة</th><th></th></tr></thead><tbody>${list.map((t, i) => `<tr><td>${H.esc(t.u)}</td><td>${t.d ? durTxt(t.d) : ''}</td><td>${t.x && t.x <= nowSec() ? '<span class="mut">انتهت مهلة التفعيل</span>' : '<span class="g">بيبدأ عند دخول العميل</span>'}</td><td class="ra"><button class="lnk" data-cpl="${link(t.u)}">اللينك</button><button class="lnk" data-cp="${t.code}">الكود</button><button class="lnk" data-cpm="${i}">الرسالة</button><button class="lnk del" data-rm="${t.created}">حذف من القائمة</button></td></tr>`).join('')}</tbody></table></div>` : ''}
        <p class="mut dvnote">الكود بيشتغل في متصفح العميل من غير إنترنت ولا سيرفر، وما فيش طريقة تلغيه قبل ميعاده. ولأن البرنامج كله بيشتغل في المتصفح فالقفل ده للتجربة والتنظيم مش حماية قوية. لإلغاء كل الأكواد القديمة غيّر <code>secret</code> في config.js.</p>
        <div class="row-actions"><button class="btn" id="dvp">تغيير كلمة سر المطور</button><button class="btn" id="dvx">خروج من وضع المطور</button></div>`;
      host.onclick = async (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.id === 'dvm') {
          const u = host.querySelector('#dvu').value.trim(), n = H.toNum(host.querySelector('#dvn').value), un = host.querySelector('#dvt').value;
          if (!u) { toast('اكتب اسم المستخدم', 'warn'); return; }
          if (!(n > 0)) { toast('اكتب مدة صحيحة', 'warn'); return; }
          const r = make(u, n, un), t = { u, d: r.d, x: r.x, code: r.code, created: Date.now() };
          saveTrials(trials().concat(t)); draw(t);
        }
        if (b.dataset.cp) copy(b.dataset.cp);
        if (b.dataset.cpl) copy(b.dataset.cpl);
        if (b.id === 'dvmsg') copy(msg(last));
        if (b.dataset.cpm != null) copy(msg(list[+b.dataset.cpm]));
        if (b.dataset.rm) { saveTrials(trials().filter((t) => String(t.created) !== b.dataset.rm)); draw(last); }
        if (b.id === 'dvx') { LS.del('omran_dev'); SS.del('omran_dev'); toast('تم الخروج من وضع المطور'); location.hash = '#/dev'; O.route(); }
        if (b.id === 'dvp') {
          const p = await O.ask('كلمة سر جديدة', 'كلمة السر الجديدة', '', 'هيطلعلك سطر تنسخه في ملف js/config.js مكان devHash.', 'text');
          if (p && p.trim().length >= 6) { const line = "devHash: '" + devHash(p.trim()) + "'"; const bd = document.createElement('div'); bd.innerHTML = `<p>الصق السطر ده في <b>js/config.js</b> مكان سطر devHash، وارفع الملف:</p><textarea readonly dir="ltr" rows="3" class="dvta">${line}</textarea>`; modal({ title: 'كلمة سر المطور', body: bd, actions: [{ l: 'نسخ السطر', cls: 'primary', fn: () => copy(line) }, { l: 'إغلاق', fn: (c) => c() }] }); } else if (p != null) toast('اكتب 6 حروف على الأقل', 'warn');
        }
      };
    };
    draw();
  }

  // خروج: المطور بيرجع لشاشة دخول المطور، والعميل لشاشة الكود (اسمه بيتفضل مكتوب لكن الكود لازم يكتبه تاني)
  async function exit() {
    const dev = isDev();
    if (!(await O.confirmBox(dev ? 'الخروج من وضع المطور؟ هتحتاج الباسورد تاني.' : 'الخروج من البرنامج؟ هتحتاج كود التجربة تاني عشان تدخل. بياناتك محفوظة ومش هتتمسح.', 'خروج'))) return;
    if (dev) { LS.del('omran_dev'); SS.del('omran_dev'); location.hash = '#/dev'; }
    else { try { const l = JSON.parse(LS.get('omran_lic') || 'null'); if (l && l.u) LS.set('omran_lu', l.u); } catch (e) { /* لا شيء */ } LS.del('omran_lic'); location.hash = '#/'; }
    O.route();
  }
  const chip = () => { const st = status(); return st.ok && st.exp ? ` · <span class="trial">فترة التجربة: متبقي ${left(st.exp)}</span>` : ''; };
  setInterval(() => { if (CFG.gate && !status().ok && !document.querySelector('.gate')) O.route(); }, 20000);
  if (SRV) setInterval(async () => { if (CFG.gate && !isDev() && getLic()) { await verify(); if (!status().ok && !document.querySelector('.gate')) O.route(); } }, 45000);
  const settingsLink = (host) => { host.hidden = !isDev(); host.innerHTML = isDev() ? '<h3>نسخة المطور</h3><p class="mut">توليد لينكات وأكواد تجربة للعملاء بمدة تحددها.</p><a class="btn primary" href="#/dev">فتح لوحة المطور</a>' : ''; };
  O.License = { status, exit, gate, devPage, settingsLink, mountDev, chip, _t: { sha256, hmac, hex, make, parse, devHash, activate } };
})(window);
