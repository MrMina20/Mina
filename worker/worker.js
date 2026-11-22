/* بوابة عمران (Cloudflare Worker).
   البرنامج نفسه (مجلد app/) مش متاح لأي حد غير اللي معاه جلسة صالحة:
   - عميل: دخل بكود تجربة صالح (بيتفعّل مرة واحدة، على جهاز واحد، والعدّاد بيبدأ لحظة أول دخول).
   - مطور: دخل بكلمة السر من صفحة /dev (محفوظة كـ Secret في Cloudflare، مش في أي ملف).
   الأكواد واللينكات بتتولّد بس من لوحة المطور، وكل التحقق هنا على السيرفر.
   الإعدادات (في wrangler.toml ولوحة Cloudflare):
     ASSETS  = مجلد app/ (Static Assets مع run_worker_first)
     TRIALS  = KV namespace
     Secret DEV_PASSWORD = كلمة سر المطور
     Secret TOKEN_SECRET = نص عشوائي طويل لتوقيع الجلسات */
const enc = new TextEncoder();
const now = () => Math.floor(Date.now() / 1000);
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ACT_WINDOW = 30 * 86400;   // مهلة تفعيل الكود اللي ما اتستخدمش
const RECHECK = 60;              // كل كام ثانية نراجع الكود من KV
const DEV_TTL = 12 * 3600, DEV_TTL_KEEP = 30 * 86400;
const MAX_SECONDS = 10 * 365 * 86400;

const b64u = (u8) => { let s = ''; for (const x of u8) s += String.fromCharCode(x); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
const unb64u = (s) => { const t = atob(String(s).replace(/-/g, '+').replace(/_/g, '/')); const u = new Uint8Array(t.length); for (let i = 0; i < t.length; i++) u[i] = t.charCodeAt(i); return u; };
const rnd = (n) => b64u(crypto.getRandomValues(new Uint8Array(n)));
const newCode = () => {
  let s = '';
  while (s.length < 12) { const b = crypto.getRandomValues(new Uint8Array(24)); for (const x of b) if (x < 248 && s.length < 12) s += ALPHA[x % 31]; }
  return s.match(/.{4}/g).join('-');
};
const normCode = (c) => { const s = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); return (s.match(/.{1,4}/g) || []).join('-'); };
const normUser = (u) => String(u || '').normalize('NFKC').toLowerCase().replace(/[ً-ٰٟ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim();

async function hmac(secret, msg) {
  const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', k, enc.encode(msg)));
}
async function same(a, b) {
  const [x, y] = await Promise.all([crypto.subtle.digest('SHA-256', enc.encode(String(a))), crypto.subtle.digest('SHA-256', enc.encode(String(b)))]);
  const A = new Uint8Array(x), B = new Uint8Array(y); let d = 0;
  for (let i = 0; i < 32; i++) d |= A[i] ^ B[i];
  return d === 0;
}
async function seal(env, obj) { const p = b64u(enc.encode(JSON.stringify(obj))); return p + '.' + b64u(await hmac(env.TOKEN_SECRET, p)); }
async function unseal(env, t) {
  const m = String(t || '').match(/^([\w-]+)\.([\w-]+)$/);
  if (!m) return null;
  if (!(await same(b64u(await hmac(env.TOKEN_SECRET, m[1])), m[2]))) return null;
  try { return JSON.parse(new TextDecoder().decode(unb64u(m[1]))); } catch (e) { return null; }
}

/* ---- كوكيز ---- */
const cookies = (req) => { const o = {}; for (const p of (req.headers.get('cookie') || '').split(/;\s*/)) { const i = p.indexOf('='); if (i > 0) o[p.slice(0, i)] = p.slice(i + 1); } return o; };
const setCk = (req, name, val, maxAge) => `${name}=${val}; Path=/; HttpOnly; SameSite=Strict${new URL(req.url).protocol === 'https:' ? '; Secure' : ''}; Max-Age=${maxAge}`;

const HDR = { 'cache-control': 'private, no-store', 'x-content-type-options': 'nosniff', 'referrer-policy': 'no-referrer', 'x-frame-options': 'DENY', 'x-robots-tag': 'noindex, nofollow' };
const json = (o, status = 200, ck = []) => { const h = new Headers(Object.assign({ 'content-type': 'application/json; charset=utf-8' }, HDR)); for (const c of ck) h.append('set-cookie', c); return new Response(JSON.stringify(o), { status, headers: h }); };
const html = (body, status = 200) => new Response(body, { status, headers: Object.assign({ 'content-type': 'text/html; charset=utf-8' }, HDR) });

/* ---- تحديد المحاولات الغلط ---- */
async function lockLeft(env, key) { const r = await env.TRIALS.get('rl:' + key, 'json'); return r && r.until > now() ? r.until - now() : 0; }
async function fail(env, key, free, base) {
  const r = (await env.TRIALS.get('rl:' + key, 'json')) || { n: 0, until: 0 };
  r.n += 1; r.until = r.n >= free ? now() + Math.min(900, base * Math.pow(2, r.n - free)) : 0;
  await env.TRIALS.put('rl:' + key, JSON.stringify(r), { expirationTtl: 3600 });
}
const okRl = (env, key) => env.TRIALS.delete('rl:' + key);
const ipOf = (req) => req.headers.get('cf-connecting-ip') || 'local';

/* ---- الجلسات ---- */
async function devSession(env, req) { const t = cookies(req).dsid; const s = t && await unseal(env, t); return s && s.r === 'dev' && s.e > now() ? s : null; }

/* جلسة العميل: بتتراجع من KV كل دقيقة. لو الكود اتلغى أو انتهى أو اتنقل لجهاز تاني بتتقفل. */
async function clientSession(env, req) {
  const ck = cookies(req); if (!ck.sid) return { ok: false };
  const s = await unseal(env, ck.sid);
  if (!s || !s.k || !ck.did || s.d !== ck.did) return { ok: false };
  if (s.e <= now()) return { ok: false, why: 'expired' };
  if (s.v > now()) return { ok: true, s, fresh: false };
  const rec = await env.TRIALS.get('c:' + s.k, 'json');
  const why = !rec ? 'gone' : rec.status === 'revoked' ? 'revoked' : rec.dev !== ck.did ? 'device' : !rec.exp || rec.exp <= now() ? 'expired' : '';
  if (why) return { ok: false, why };
  const n = { k: s.k, u: rec.u, e: rec.exp, d: ck.did, v: Math.min(rec.exp, now() + RECHECK) };
  return { ok: true, s: n, fresh: true, cookie: setCk(req, 'sid', await seal(env, n), Math.max(1, rec.exp - now())) };
}
const WHY = { expired: 'انتهت مدة التجربة.', revoked: 'الكود ده اتلغى.', device: 'الكود ده شغال على جهاز تاني.', gone: 'الكود غير صالح.' };

const sameOrigin = (req) => { const o = req.headers.get('origin'); return !o || o === new URL(req.url).origin; };
const readJson = async (req) => { try { return await req.json(); } catch (e) { return {}; } };

/* ---- الصفحات (بتتعرض من غير ما أي ملف من البرنامج يتبعت) ---- */
const CSS = `*{box-sizing:border-box}body{margin:0;min-height:100vh;display:grid;place-items:center;background:#0b0f1a;color:#e8edf7;font:16px/1.7 "IBM Plex Sans Arabic",system-ui,Tahoma,sans-serif;padding:16px}
form{width:100%;max-width:400px;background:#161d2d;border:1px solid #25304a;border-radius:20px;padding:26px 24px;display:grid;gap:14px}
.b{display:flex;gap:12px;align-items:center}.b i{width:46px;height:46px;border-radius:14px;background:#4f83f1;display:grid;place-items:center}.b b{display:block;font-size:19px}.b small{color:#8b97b0}
h2{margin:0;font-size:20px}p{margin:0;color:#8b97b0}label{display:grid;gap:6px;font-size:14px;color:#8b97b0}
input[type=text],input[type=password]{width:100%;background:#0b0f1a;color:#e8edf7;border:1px solid #25304a;border-radius:12px;padding:12px 14px;font:inherit;min-height:46px}
input:focus{outline:2px solid #4f83f1;border-color:transparent}.c{display:flex;gap:8px;align-items:center;font-size:14px;color:#8b97b0}
button{background:#4f83f1;color:#fff;border:0;border-radius:12px;min-height:48px;font:inherit;font-weight:600;cursor:pointer}button:disabled{opacity:.6}
.e{min-height:22px;color:#ff8d8d;font-size:14px}`;
const LOGO = '<i><svg width="26" height="26" viewBox="0 0 48 48"><rect x="14" y="20" width="20" height="18" rx="2" fill="#fff"/><path d="M11 17h26" stroke="#fff" stroke-width="3" stroke-linecap="round"/></svg></i>';
const shell = (title, inner, js) => `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="robots" content="noindex,nofollow"><title>${title}</title><link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;600&display=swap" rel="stylesheet"><style>${CSS}</style></head><body>${inner}<script>${js}</script></body></html>`;
const POST = `async function post(u,b){try{const r=await fetch(u,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(b),credentials:'same-origin'});return Object.assign({ok:false},await r.json().catch(()=>({})))}catch(e){return{ok:false,error:'مفيش اتصال بالإنترنت. جرّب تاني.'}}}`;
function clientPage(u) {
  return shell('عمران - دخول', `<form id="f" autocomplete="off"><div class="b">${LOGO}<div><b>عمران</b><small>إدارة العقارات والمقاولات</small></div></div>
<h2>نسخة تجريبية</h2><p>ادخل اسم المستخدم وكود التجربة اللي وصلك.</p>
<label>اسم المستخدم<input type="text" id="u" autocomplete="off"></label>
<label>كود التجربة<input type="text" id="c" dir="ltr" placeholder="XXXX-XXXX-XXXX" autocomplete="off" autocapitalize="characters"></label>
<div class="e" id="e" role="alert"></div><button type="submit">دخول</button></form>`,
    `${POST}const u=document.getElementById('u'),c=document.getElementById('c'),e=document.getElementById('e');u.value=${JSON.stringify(u || '').replace(/</g, '\\u003c')};(u.value?c:u).focus();
document.getElementById('f').onsubmit=async(ev)=>{ev.preventDefault();const b=ev.target.querySelector('button');b.disabled=true;e.textContent='';const r=await post('/api/login',{user:u.value,code:c.value});b.disabled=false;if(r.ok){location.replace('/')}else e.textContent=r.error||'حصلت مشكلة. جرّب تاني.'};`);
}
function devLoginPage() {
  return shell('دخول المطور', `<form id="f" autocomplete="off"><div class="b">${LOGO}<div><b>دخول المطور</b><small>للمطور فقط</small></div></div>
<p>من فضلك ادخل كلمة سر المطور.</p><label>كلمة السر<input type="password" id="p" autocomplete="current-password"></label>
<label class="c"><input type="checkbox" id="r"><span>حفظ الدخول على هذا الجهاز (30 يوم)</span></label>
<div class="e" id="e" role="alert"></div><button type="submit">دخول</button></form>`,
    `${POST}const p=document.getElementById('p'),e=document.getElementById('e');p.focus();
document.getElementById('f').onsubmit=async(ev)=>{ev.preventDefault();const b=ev.target.querySelector('button');b.disabled=true;e.textContent='';const r=await post('/api/dev/login',{password:p.value,remember:document.getElementById('r').checked});b.disabled=false;if(r.ok){location.replace('/#/dev')}else e.textContent=r.error||'حصلت مشكلة.'};`);
}

/* ---- الـ API ---- */
async function api(req, env, path) {
  if (req.method !== 'POST' && !(req.method === 'GET' && path === '/api/me')) return json({ ok: false, error: 'method' }, 405);
  if (req.method === 'POST' && !sameOrigin(req)) return json({ ok: false, error: 'origin' }, 403);

  if (path === '/api/me') {
    const d = await devSession(env, req);
    if (d) return json({ ok: true, dev: true, now: now() });
    const c = await clientSession(env, req);
    if (!c.ok) return json({ ok: false, why: c.why || '' }, 401);
    return json({ ok: true, dev: false, user: c.s.u, exp: c.s.e, now: now() }, 200, c.cookie ? [c.cookie] : []);
  }
  if (path === '/api/check') {
    if (await devSession(env, req)) return json({ ok: true, dev: true, now: now() });
    const c = await clientSession(env, req);
    if (!c.ok) return json({ ok: false, error: WHY[c.why] || 'انتهت الجلسة.' }, 401, [setCk(req, 'sid', '', 0)]);
    return json({ ok: true, exp: c.s.e, now: now() }, 200, c.cookie ? [c.cookie] : []);
  }
  if (path === '/api/logout') return json({ ok: true }, 200, [setCk(req, 'sid', '', 0), setCk(req, 'dsid', '', 0)]);

  if (path === '/api/login') {
    const b = await readJson(req), ip = ipOf(req), rl = 'c:' + ip;
    const wait = await lockLeft(env, rl);
    if (wait) return json({ ok: false, error: `محاولات كتير غلط. استنى ${wait} ثانية.` }, 429);
    const code = normCode(b.code), bad = async (m) => { await fail(env, rl, 6, 30); return json({ ok: false, error: m }, 401); };
    const rec = code.length === 14 ? await env.TRIALS.get('c:' + code, 'json') : null;
    if (!rec || normUser(rec.u) !== normUser(b.user)) return bad(rec ? 'اسم المستخدم مش مطابق للكود.' : 'الكود غير صحيح. اتأكد إنك نسخته كامل.');
    if (rec.status === 'revoked') return bad(WHY.revoked);
    let did = cookies(req).did, ck = [];
    if (!did || !/^[\w-]{10,40}$/.test(did)) { did = rnd(16); ck.push(setCk(req, 'did', did, 365 * 86400)); }
    if (!rec.start) {
      if (rec.x <= now()) return bad('الكود ده انتهت مهلة تفعيله. اطلب كود جديد.');
      rec.start = now(); rec.exp = rec.start + rec.d; rec.dev = did;           // العدّ بيبدأ هنا
      await env.TRIALS.put('c:' + code, JSON.stringify(rec));
    } else if (rec.dev !== did) return bad(WHY.device + ' اطلب فك الكود من المطور لو غيّرت الجهاز.');
    if (rec.exp <= now()) return bad(WHY.expired + ' اطلب كود جديد.');
    await okRl(env, rl);
    const s = { k: code, u: rec.u, e: rec.exp, d: did, v: Math.min(rec.exp, now() + RECHECK) };
    ck.push(setCk(req, 'sid', await seal(env, s), Math.max(1, rec.exp - now())));
    return json({ ok: true }, 200, ck);
  }

  if (path === '/api/dev/login') {
    const b = await readJson(req), ip = ipOf(req), rl = 'd:' + ip, wait = await lockLeft(env, rl);
    if (wait) return json({ ok: false, error: `استنى ${wait} ثانية وجرّب تاني.` }, 429);
    if (!env.DEV_PASSWORD || !(await same(String(b.password || ''), env.DEV_PASSWORD))) { await fail(env, rl, 3, 30); return json({ ok: false, error: 'كلمة السر غلط.' }, 401); }
    await okRl(env, rl);
    const ttl = b.remember ? DEV_TTL_KEEP : DEV_TTL;
    return json({ ok: true }, 200, [setCk(req, 'dsid', await seal(env, { r: 'dev', e: now() + ttl, j: rnd(6) }), ttl)]);
  }

  if (path.startsWith('/api/dev/')) {
    if (!(await devSession(env, req))) return json({ ok: false, error: 'مطلوب دخول المطور.', auth: true }, 401);
    const b = await readJson(req), op = path.slice(9);
    if (op === 'issue') {
      const u = String(b.user || '').trim().slice(0, 60), sec = Math.round(+b.seconds);
      if (!u) return json({ ok: false, error: 'اكتب اسم المستخدم.' }, 400);
      if (!(sec >= 60 && sec <= MAX_SECONDS)) return json({ ok: false, error: 'المدة لازم تبقى من دقيقة لحد 10 سنين.' }, 400);
      let code = newCode();
      while (await env.TRIALS.get('c:' + code)) code = newCode();
      const rec = { u, d: sec, x: now() + ACT_WINDOW, created: now(), start: 0, exp: 0, dev: '', status: 'new' };
      await env.TRIALS.put('c:' + code, JSON.stringify(rec));
      return json({ ok: true, code, user: u, d: sec, x: rec.x });
    }
    if (op === 'list') {
      const keys = (await env.TRIALS.list({ prefix: 'c:', limit: 1000 })).keys, items = [];
      await Promise.all(keys.map(async (k) => { const r = await env.TRIALS.get(k.name, 'json'); if (r) items.push({ code: k.name.slice(2), u: r.u, d: r.d, x: r.x, created: r.created, start: r.start, exp: r.exp, bound: !!r.dev, status: r.status === 'revoked' ? 'revoked' : !r.start ? (r.x <= now() ? 'expired' : 'new') : r.exp <= now() ? 'expired' : 'active' }); }));
      items.sort((a, c) => c.created - a.created);
      return json({ ok: true, items, now: now() });
    }
    const code = normCode(b.code), rec = await env.TRIALS.get('c:' + code, 'json');
    if (!rec) return json({ ok: false, error: 'الكود مش موجود.' }, 404);
    if (op === 'revoke') { rec.status = 'revoked'; await env.TRIALS.put('c:' + code, JSON.stringify(rec)); return json({ ok: true }); }
    if (op === 'reset') { rec.dev = ''; await env.TRIALS.put('c:' + code, JSON.stringify(rec)); return json({ ok: true }); }
    if (op === 'delete') { await env.TRIALS.delete('c:' + code); return json({ ok: true }); }
    return json({ ok: false, error: 'op' }, 404);
  }
  return json({ ok: false, error: 'not found' }, 404);
}

export default {
  async fetch(req, env) {
    try {
      const url = new URL(req.url), path = url.pathname.replace(/\/{2,}/g, '/');
      if (!env.TOKEN_SECRET || String(env.TOKEN_SECRET).length < 16) return html(shell('إعداد ناقص', '<form><h2>الإعداد ناقص</h2><p>لازم تضيف TOKEN_SECRET و DEV_PASSWORD في Cloudflare.</p></form>', ''), 503);
      if (path.startsWith('/api/')) return api(req, env, path);

      if (path === '/dev' || path === '/dev/') {
        if (path === '/dev/') return Response.redirect(url.origin + '/dev', 301);
        return (await devSession(env, req)) ? new Response(null, { status: 302, headers: Object.assign({ location: '/#/dev' }, HDR) }) : html(devLoginPage());
      }
      if (req.method !== 'GET' && req.method !== 'HEAD') return new Response('Method Not Allowed', { status: 405, headers: HDR });

      const dev = await devSession(env, req);
      if (path === '/js/dev.js' && !dev) return new Response('Not found', { status: 404, headers: HDR });
      let ok = !!dev, cookie = null;
      if (!ok) { const c = await clientSession(env, req); ok = c.ok; cookie = c.cookie; }
      if (!ok) {
        if (path === '/' || path === '/index.html') return html(clientPage(url.searchParams.get('u')));
        return new Response('Unauthorized', { status: 401, headers: HDR });
      }
      const res = await env.ASSETS.fetch(req);
      const h = new Headers(res.headers); for (const k in HDR) h.set(k, HDR[k]);
      if (cookie) h.append('set-cookie', cookie);
      return new Response(res.body, { status: res.status, headers: h });
    } catch (e) {
      return json({ ok: false, error: 'خطأ في السيرفر.' }, 500);
    }
  }
};
