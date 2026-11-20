/* أكواد التجربة: توقيع HMAC-SHA256 بيتحقق منه المتصفح نفسه من غير سيرفر */
(function (w) {
  'use strict';
  const O = w.Omran, { S, H, toast, modal } = O;
  const CFG = w.OMRAN_CONFIG || { gate: false, secret: '', devHash: '' };
  const enc = new TextEncoder(), dec = new TextDecoder();
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
  const devHash = (pass) => hex(sha256(enc.encode(pass + '|' + CFG.secret)));
  const uname = (s) => H.norm(String(s || '')).replace(/\s+/g, ' ').trim();

  /* ---- الوقت: ما بيرجعش لورا حتى لو الجهاز اتلعب في ساعته ---- */
  const nowSec = () => { const real = Math.floor(Date.now() / 1000), last = +LS.get('omran_ls') || 0, t = Math.max(real, last); if (t > last) LS.set('omran_ls', String(t)); return t; };

  const UNITS = { h: ['ساعة', 3600], d: ['يوم', 86400], m: ['شهر', 2592000], y: ['سنة', 31536000] };
  function make(user, n, unit) {
    const e = nowSec() + Math.round(n * UNITS[unit][1]);
    const p = b64(enc.encode(JSON.stringify({ u: user.trim(), e })));
    return { code: 'OM1.' + p + '.' + sign(p), exp: e };
  }
  function parse(code) {
    const m = String(code || '').trim().match(/^OM1\.([\w-]+)\.([\w-]+)$/);
    if (!m || sign(m[1]) !== m[2]) return null;
    try { const d = JSON.parse(dec.decode(unb64(m[1]))); return d && d.u && d.e ? d : null; } catch (e) { return null; }
  }
  const left = (e) => {
    const s = e - nowSec();
    if (s >= 172800) return Math.floor(s / 86400) + ' يوم';
    if (s >= 3600) return Math.floor(s / 3600) + ' ساعة';
    return Math.max(1, Math.ceil(s / 60)) + ' دقيقة';
  };
  const when = (e) => new Date(e * 1000).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });

  function status() {
    if (!CFG.gate || LS.get('omran_dev') === '1') return { ok: true, dev: LS.get('omran_dev') === '1' };
    let lic = null; try { lic = JSON.parse(LS.get('omran_lic') || 'null'); } catch (e) { /* لا شيء */ }
    if (!lic) return { ok: false, reason: 'none' };
    const d = parse(lic.code);
    if (!d || uname(d.u) !== uname(lic.u)) return { ok: false, reason: 'none' };
    if (d.e <= nowSec()) return { ok: false, reason: 'expired', user: d.u, exp: d.e };
    return { ok: true, user: d.u, exp: d.e };
  }
  function activate(user, code) {
    const d = parse(code);
    if (!d) return 'الكود غير صحيح. اتأكد إنك نسخته كامل.';
    if (uname(d.u) !== uname(user)) return 'اسم المستخدم مش مطابق للكود.';
    if (d.e <= nowSec()) return 'الكود ده انتهت مدته. اطلب كود جديد.';
    LS.set('omran_lic', JSON.stringify({ u: user.trim(), code: code.trim() }));
    return '';
  }

  /* ---- شاشة القفل ---- */
  function gate(st) {
    const app = document.getElementById('app'), expired = st && st.reason === 'expired';
    app.innerHTML = `<div class="gate"><form class="gcard panel" id="gf" autocomplete="off">
      <div class="gbrand">${O.BRAND}<div><strong>${H.esc(S.meta().company || 'عمران')}</strong><small>إدارة العقارات والمقاولات</small></div></div>
      <h2>${expired ? 'انتهت فترة التجربة' : 'نسخة تجريبية'}</h2>
      <p class="mut">${expired ? 'انتهت التجربة بتاريخ ' + when(st.exp) + '. اطلب كود جديد وكمّل من حيث وقفت، بياناتك محفوظة.' : 'اكتب اسم المستخدم وكود التجربة اللي وصلك.'}</p>
      <label class="fld"><span>اسم المستخدم</span><input id="gu" value="${H.esc((st && st.user) || '')}" autocomplete="off"></label>
      <label class="fld"><span>كود التجربة</span><input id="gc" dir="ltr" placeholder="OM1...." autocomplete="off"></label>
      <p class="gerr" id="ge" role="alert"></p>
      <button class="btn primary" type="submit">دخول</button>
      <button class="lnkb gdev" type="button" id="gd">دخول المطور</button></form></div>`;
    document.getElementById('gf').onsubmit = (ev) => {
      ev.preventDefault();
      const err = activate(document.getElementById('gu').value, document.getElementById('gc').value);
      if (err) { document.getElementById('ge').textContent = err; return; }
      toast('أهلاً بيك، التجربة اشتغلت'); O.route();
    };
    document.getElementById('gd').onclick = async () => { if (await devLogin()) { toast('تم الدخول كمطور'); O.route(); } };
  }
  async function devLogin() {
    const pass = await O.ask('دخول المطور', 'كلمة سر المطور', '', null, 'text');
    if (pass == null) return false;
    if (devHash(pass.trim()) === CFG.devHash) { LS.set('omran_dev', '1'); return true; }
    toast('كلمة السر غلط', 'warn'); return false;
  }

  /* ---- لوحة المطور في الإعدادات ---- */
  const trials = () => { try { return JSON.parse(LS.get('omran_trials') || '[]'); } catch (e) { return []; } };
  const saveTrials = (a) => LS.set('omran_trials', JSON.stringify(a));
  const copy = async (t) => { try { await navigator.clipboard.writeText(t); toast('تم النسخ'); } catch (e) { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('تم النسخ'); } catch (er) { toast('انسخه يدوي', 'warn'); } ta.remove(); } };
  const msg = (t) => `جرّب برنامج عمران لإدارة العقارات والمقاولات\nالرابط: ${location.href.split('#')[0]}\nاسم المستخدم: ${t.u}\nكود التجربة: ${t.code}\nالتجربة شغالة حتى ${when(t.e)} (${left(t.e)}).`;

  function mountDev(host) {
    const draw = (last) => {
      if (LS.get('omran_dev') !== '1') {
        host.innerHTML = `<h3>نسخة المطور</h3><p class="mut">لتجهيز اسم مستخدم وكود تجربة لعميل بمدة محددة. محتاجة كلمة سر المطور.</p><button class="btn" id="dvo">فتح نسخة المطور</button>`;
        host.querySelector('#dvo').onclick = async () => { if (await devLogin()) draw(); };
        return;
      }
      const list = trials().sort((a, b) => b.created - a.created);
      host.innerHTML = `<h3>نسخة المطور: كود تجربة جديد</h3>
        <div class="fgrid cols3"><label class="fld"><span>اسم المستخدم (للعميل)</span><input id="dvu" placeholder="مثلاً: شركة النور"></label>
        <label class="fld"><span>المدة</span><div class="dur"><input id="dvn" inputmode="decimal" value="3"><select id="dvt"><option value="h">ساعة</option><option value="d" selected>يوم</option><option value="m">شهر</option><option value="y">سنة</option></select></div></label>
        <div class="fld"><span>&nbsp;</span><button class="btn primary" id="dvm">إنشاء الكود</button></div></div>
        ${last ? `<div class="dvout"><b>${H.esc(last.u)}</b><small>تنتهي ${when(last.e)} (متبقي ${left(last.e)})</small><textarea readonly dir="ltr" rows="3" id="dvc">${last.code}</textarea><div class="row-actions"><button class="btn" data-cp="${last.code}">نسخ الكود</button><button class="btn" id="dvmsg">نسخ رسالة جاهزة للعميل</button></div></div>` : ''}
        ${list.length ? `<h3 class="dvh">الأكواد اللي اتعملت (${list.length})</h3><div class="tblw"><table class="tbl"><thead><tr><th>المستخدم</th><th>تنتهي</th><th>الحالة</th><th></th></tr></thead><tbody>${list.map((t, i) => `<tr><td>${H.esc(t.u)}</td><td>${when(t.e)}</td><td>${t.e > nowSec() ? `<span class="g">شغال (${left(t.e)})</span>` : '<span class="mut">منتهي</span>'}</td><td class="ra"><button class="lnk" data-cpm="${i}">نسخ الرسالة</button><button class="lnk del" data-rm="${t.created}">حذف من القائمة</button></td></tr>`).join('')}</tbody></table></div>` : ''}
        <p class="mut dvnote">الكود بيشتغل في متصفح العميل من غير إنترنت ولا سيرفر، وما فيش طريقة تلغيه قبل ميعاده. ولأن البرنامج كله بيشتغل في المتصفح فالقفل ده للتجربة والتنظيم مش حماية قوية. لإلغاء كل الأكواد القديمة غيّر <code>secret</code> في config.js.</p>
        <div class="row-actions"><button class="btn" id="dvp">تغيير كلمة سر المطور</button><button class="btn" id="dvx">خروج من وضع المطور</button></div>`;
      host.onclick = async (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        if (b.id === 'dvm') {
          const u = host.querySelector('#dvu').value.trim(), n = H.toNum(host.querySelector('#dvn').value), un = host.querySelector('#dvt').value;
          if (!u) { toast('اكتب اسم المستخدم', 'warn'); return; }
          if (!(n > 0)) { toast('اكتب مدة صحيحة', 'warn'); return; }
          const r = make(u, n, un), t = { u, e: r.exp, code: r.code, created: Date.now() };
          saveTrials(trials().concat(t)); draw(t);
        }
        if (b.dataset.cp) copy(b.dataset.cp);
        if (b.id === 'dvmsg') copy(msg(last));
        if (b.dataset.cpm != null) copy(msg(list[+b.dataset.cpm]));
        if (b.dataset.rm) { saveTrials(trials().filter((t) => String(t.created) !== b.dataset.rm)); draw(last); }
        if (b.id === 'dvx') { LS.del('omran_dev'); toast('تم الخروج من وضع المطور'); O.route(); }
        if (b.id === 'dvp') {
          const p = await O.ask('كلمة سر جديدة', 'كلمة السر الجديدة', '', 'هيطلعلك سطر تنسخه في ملف js/config.js مكان devHash.', 'text');
          if (p && p.trim().length >= 6) { const line = "devHash: '" + devHash(p.trim()) + "'"; const bd = document.createElement('div'); bd.innerHTML = `<p>الصق السطر ده في <b>js/config.js</b> مكان سطر devHash، وارفع الملف:</p><textarea readonly dir="ltr" rows="3" class="dvta">${line}</textarea>`; modal({ title: 'كلمة سر المطور', body: bd, actions: [{ l: 'نسخ السطر', cls: 'primary', fn: () => copy(line) }, { l: 'إغلاق', fn: (c) => c() }] }); } else if (p != null) toast('اكتب 6 حروف على الأقل', 'warn');
        }
      };
    };
    draw();
  }

  const chip = () => { const st = status(); return st.ok && st.exp ? ` · <span class="trial">فترة التجربة: متبقي ${left(st.exp)}</span>` : ''; };
  setInterval(() => { if (CFG.gate && !status().ok && !document.querySelector('.gate')) O.route(); }, 20000);
  O.License = { status, gate, mountDev, chip, _t: { sha256, hmac, hex, make, parse, devHash, activate } };
})(window);
