/* النواة: التخزين المحلي + ملفات العقود (IndexedDB) + أدوات مساعدة + نوافذ */
(function (w) {
  'use strict';
  const O = (w.Omran = w.Omran || {});
  const ICON = O.ICON;

  /* ---------- التخزين (localStorage مع بديل في الذاكرة) ---------- */
  const KEY = 'omran_v1';
  const mem = {};
  const ls = {
    get(k) { try { return localStorage.getItem(k); } catch (e) { return mem[k] || null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch (e) { mem[k] = v; } }
  };
  const blank = () => ({ meta: { v: 2, theme: 'dark', sound: true, currency: 'جنيه', company: '', lastBackup: null, alertDays: 7 }, data: {} });
  const load = () => {
    try {
      const r = JSON.parse(ls.get(KEY) || 'null');
      if (r && r.data && r.meta) return r;
    } catch (e) { /* بيانات تالفة: نبدأ من الصفر */ }
    return blank();
  };
  let db = load();
  const save = () => ls.set(KEY, JSON.stringify(db));
  const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);

  const S = {
    meta: () => db.meta,
    setMeta(p) { Object.assign(db.meta, p); save(); },
    all: (c) => db.data[c] || (db.data[c] = []),
    get: (c, id) => S.all(c).find((x) => x.id === id),
    put(c, o) {
      const a = S.all(c);
      if (!o.id) { o.id = uid(); o.created = Date.now(); a.push(o); }
      else { const i = a.findIndex((x) => x.id === o.id); if (i < 0) a.push(o); else a[i] = o; }
      save();
      return o;
    },
    del(c, id) { db.data[c] = S.all(c).filter((x) => x.id !== id); save(); },
    setAll(c, arr) { db.data[c] = arr; save(); },
    hasData: () => Object.values(db.data).some((a) => a.length),
    hasDemo: () => Object.values(db.data).some((a) => a.some((x) => x.demo)),
    purgeDemo() { Object.keys(db.data).forEach((c) => { db.data[c] = db.data[c].filter((x) => !x.demo); }); save(); },
    reset() { const m = db.meta; db = blank(); db.meta = m; save(); },
    exportJSON: () => JSON.stringify({ app: 'omran', version: 2, exported: new Date().toISOString(), meta: db.meta, data: db.data }),
    importData(r) {
      if (!r || typeof r.data !== 'object' || !r.data) throw new Error('bad file');
      db = { meta: Object.assign(blank().meta, r.meta || {}, { v: (r.meta && r.meta.v) || 1 }), data: r.data };
      migrate(); save();
    }
  };

  /* ---------- أدوات مساعدة ---------- */
  const AR = '٠١٢٣٤٥٦٧٨٩';
  const H = {
    esc: (s) => String(s == null ? '' : s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])),
    toNum(v) {
      if (typeof v === 'number') return isFinite(v) ? v : 0;
      const s = String(v == null ? '' : v).replace(/[٠-٩]/g, (d) => AR.indexOf(d)).replace(/٫/g, '.').replace(/[٬,\s]/g, '');
      const n = parseFloat(s);
      return isFinite(n) ? n : 0;
    },
    fmt: (n) => (Math.round((+n || 0) * 100) / 100).toLocaleString('en-US'),
    money: (n) => H.fmt(n) + ' ' + S.meta().currency,
    sum: (a, f) => a.reduce((s, x) => s + (+f(x) || 0), 0),
    iso(d) { return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0'); },
    today() { return H.iso(new Date()); },
    addDays(n, from) { const d = from ? new Date(from + 'T00:00:00') : new Date(); d.setDate(d.getDate() + n); return H.iso(d); },
    addMonths(s, n) {
      const d = new Date(s + 'T00:00:00'), day = d.getDate();
      d.setDate(1); d.setMonth(d.getMonth() + n);
      d.setDate(Math.min(day, new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate()));
      return H.iso(d);
    },
    daysBetween: (a, b) => Math.round((new Date(b + 'T00:00:00') - new Date(a + 'T00:00:00')) / 864e5),
    fdate(s) { if (!s) return ''; const p = String(s).slice(0, 10).split('-'); return p.length === 3 ? p[2] + '/' + p[1] + '/' + p[0] : s; },
    norm: (s) => String(s || '').trim().replace(/\s+/g, ' ').toLowerCase(),
    uid,
    waLink(phone, text) {
      let d = String(phone || '').replace(/[٠-٩]/g, (x) => AR.indexOf(x)).replace(/\D/g, '');
      if (!d) return '';
      if (d.startsWith('00')) d = d.slice(2); else if (d.startsWith('0')) d = '20' + d.slice(1);
      return 'https://wa.me/' + d + (text ? '?text=' + encodeURIComponent(text) : '');
    },
    fsize: (b) => (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB'),
    MONTHS: ['يناير', 'فبراير', 'مارس', 'أبريل', 'مايو', 'يونيو', 'يوليو', 'أغسطس', 'سبتمبر', 'أكتوبر', 'نوفمبر', 'ديسمبر']
  };
  const { esc } = H;

  /* ---------- ترحيل بيانات النسخة الأولى إلى الشكل الجديد ---------- */
  function migrate() {
    const m = db.meta, D = db.data;
    if (m.v === 2) return;
    Object.keys(D).forEach((c) => { D[c] = (D[c] || []).filter((x) => !x.demo); });
    const tr = D.treasury || (D.treasury = []), mv = D.stockmoves || (D.stockmoves = []);
    const add = (o) => tr.push(Object.assign({ id: uid(), created: Date.now(), migrated: true }, o));
    (D.expenses || []).forEach((e) => add({ date: e.date, type: 'out', amount: +e.amount || 0, cat: e.category || 'أخرى', project: e.project || '', party: e.payee || '' }));
    (D.contractors || []).forEach((c) => (c.payments || []).forEach((p) => add({ date: p.date, type: 'out', amount: +p.amount || 0, cat: 'مقاولين ومهندسين', member: c.id, party: c.name, project: c.project || '', note: p.note || '' })));
    (D.invoices || []).forEach((i) => (i.payments || []).forEach((p) => add({ date: p.date, type: i.kind === 'sale' ? 'in' : 'out', amount: +p.amount || 0, cat: i.kind === 'sale' ? 'إيراد آخر' : 'مواد وخامات', project: i.project || '', party: i.party || '', note: 'فاتورة ' + (i.number || '') })));
    (D.inventory || []).forEach((i) => { if (+i.qty > 0) mv.push({ id: uid(), created: Date.now(), date: H.today(), type: 'in', item: i.name, unit: i.unit || '', qty: +i.qty, price: +i.unitCost || 0, note: 'رصيد افتتاحي' }); });
    m.v = 2; m.alertDays = m.alertDays || 7;
    save();
  }
  migrate();

  /* ---------- ملفات العقود (IndexedDB) ---------- */
  const FS = (() => {
    let dbp;
    const open = () => dbp || (dbp = new Promise((res, rej) => {
      try {
        const r = indexedDB.open('omran_files', 1);
        r.onupgradeneeded = () => r.result.createObjectStore('f', { keyPath: 'id' });
        r.onsuccess = () => res(r.result);
        r.onerror = () => rej(r.error);
      } catch (e) { rej(e); }
    }));
    const tx = (mode, fn) => open().then((d) => new Promise((res, rej) => {
      const t = d.transaction('f', mode), rq = fn(t.objectStore('f'));
      t.oncomplete = () => res(rq && rq.result);
      t.onerror = () => rej(t.error);
    }));
    return {
      put: (id, blob, name, type) => tx('readwrite', (s) => s.put({ id, blob, name, type, t: Date.now() })),
      get: (id) => tx('readonly', (s) => s.get(id)),
      del: (id) => tx('readwrite', (s) => s.delete(id)),
      all: () => tx('readonly', (s) => s.getAll()),
      clear: () => tx('readwrite', (s) => s.clear()),
      // حذف الملفات اللي مش مربوطة بأي سجل (بعد يوم على الأقل، وبشرط وجود بيانات)
      async gc() {
        try {
          if (!S.hasData()) return;
          const used = new Set();
          [...S.all('contracts'), ...S.all('contractors')].forEach((x) => (x.files || []).forEach((f) => used.add(f.id)));
          for (const r of await FS.all()) if (!used.has(r.id) && Date.now() - (r.t || 0) > 864e5) await FS.del(r.id);
        } catch (e) { /* اختياري */ }
      }
    };
  })();

  const toDataURL = (blob) => new Promise((res, rej) => { const r = new FileReader(); r.onload = () => res(r.result); r.onerror = () => rej(r.error); r.readAsDataURL(blob); });
  const fromDataURL = (d) => {
    const [h, b] = d.split(','), mime = (h.match(/:(.*?);/) || [])[1] || 'application/octet-stream', bin = atob(b), a = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) a[i] = bin.charCodeAt(i);
    return new Blob([a], { type: mime });
  };
  // نسخة احتياطية كاملة: البيانات + ملفات العقود
  S.exportFull = async () => {
    const out = JSON.parse(S.exportJSON()); out.files = [];
    try { for (const f of await FS.all()) out.files.push({ id: f.id, name: f.name, type: f.type, data: await toDataURL(f.blob) }); } catch (e) { /* بدون ملفات */ }
    return JSON.stringify(out);
  };
  S.importFull = async (txt) => {
    const r = JSON.parse(txt);
    S.importData(r);
    try { await FS.clear(); for (const f of r.files || []) await FS.put(f.id, fromDataURL(f.data), f.name, f.type); } catch (e) { /* بدون ملفات */ }
  };

  /* ---------- تنبيه سريع + صوت ---------- */
  function toast(msg, tone) {
    const t = document.createElement('div');
    t.className = 'toast ' + (tone || '');
    t.textContent = msg;
    t.setAttribute('role', 'status');
    document.body.appendChild(t);
    setTimeout(() => t.classList.add('out'), 2300);
    setTimeout(() => t.remove(), 2700);
  }
  let ac;
  function beep(f) {
    if (!S.meta().sound) return;
    try {
      ac = ac || new (w.AudioContext || w.webkitAudioContext)();
      const o = ac.createOscillator(), g = ac.createGain();
      o.type = 'sine'; o.frequency.value = f || 660; g.gain.value = 0.04;
      o.connect(g); g.connect(ac.destination); o.start();
      g.gain.exponentialRampToValueAtTime(0.0001, ac.currentTime + 0.16);
      o.stop(ac.currentTime + 0.17);
    } catch (e) { /* الصوت اختياري */ }
  }

  /* ---------- نافذة منبثقة ---------- */
  function modal({ title, body, actions = [], wide, sticky, onClose }) {
    const ov = document.createElement('div');
    ov.className = 'ov';
    ov.innerHTML = `<div class="md ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}"><header><h2>${esc(title)}</h2><button class="x" aria-label="إغلاق" data-x>${ICON.close}</button></header><div class="mb"></div><footer></footer></div>`;
    const mb = ov.querySelector('.mb');
    if (typeof body === 'string') mb.innerHTML = body; else mb.appendChild(body);
    const ft = ov.querySelector('footer');
    let closed = false;
    const key = (e) => { if (e.key === 'Escape') close(); };
    function close() {
      if (closed) return;
      closed = true;
      ov.remove();
      document.removeEventListener('keydown', key);
      if (onClose) onClose();
    }
    actions.forEach((a) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'btn ' + (a.cls || '');
      b.textContent = a.l;
      b.onclick = () => (a.fn ? a.fn(close) : close());
      ft.appendChild(b);
    });
    if (!actions.length) ft.remove();
    document.addEventListener('keydown', key);
    if (!sticky) ov.addEventListener('mousedown', (e) => { if (e.target === ov) close(); });
    ov.querySelector('[data-x]').onclick = close;
    document.body.appendChild(ov);
    const f = ov.querySelector('input:not([type=hidden]):not([type=file]),select,textarea');
    if (f) setTimeout(() => f.focus(), 30);
    return { close, el: ov, mb };
  }

  const confirmBox = (msg, ok) => new Promise((res) => {
    let yes = false;
    modal({
      title: 'تأكيد', body: `<p class="cm">${esc(msg)}</p>`,
      actions: [{ l: 'إلغاء', fn: (c) => c() }, { l: ok || 'تأكيد', cls: 'danger', fn: (c) => { yes = true; c(); } }],
      onClose: () => res(yes)
    });
  });

  const ask = (title, label, def, hint) => new Promise((res) => {
    let val = null;
    const body = document.createElement('div');
    body.innerHTML = `<label class="fld"><span>${esc(label)}</span><input inputmode="decimal" value="${esc(def == null ? '' : def)}"></label>${hint ? `<p class="mut">${esc(hint)}</p>` : ''}`;
    const inp = body.querySelector('input');
    const m = modal({
      title, body, sticky: true,
      actions: [{ l: 'إلغاء', fn: (c) => c() }, { l: 'تأكيد', cls: 'primary', fn: (c) => { val = inp.value; c(); } }],
      onClose: () => res(val)
    });
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') { val = inp.value; m.close(); } });
  });

  Object.assign(O, { S, H, FS, toast, beep, modal, confirmBox, ask, KEY });
})(window);
