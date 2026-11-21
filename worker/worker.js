/* سيرفر أكواد التجربة (Cloudflare Worker + KV): بيتحقق من الكود ويبدأ العدّاد أول استخدام
   ويربط الكود بجهاز واحد وتقدر تلغيه في أي وقت. باسورد المطور محفوظ هنا كـ Secret ومش في الكود.
   المتغيرات المطلوبة (من لوحة Cloudflare):
     KV namespace باسم TRIALS (Binding name: TRIALS)
     Secret: DEV_PASSWORD  كلمة سر المطور
     Secret: TOKEN_SECRET  أي نص عشوائي طويل
     اختياري: ALLOW_ORIGIN مثلاً https://mrmina20.github.io  */
const enc = new TextEncoder();
const now = () => Math.floor(Date.now() / 1000);
const ALPHA = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const ACT_WINDOW = 30 * 86400;      // مهلة تفعيل الكود غير المستخدم
const TOKEN_TTL = 12 * 3600;        // صلاحية دخول المطور
const b64u = (u8) => btoa(String.fromCharCode(...u8)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const unb64u = (s) => atob(s.replace(/-/g, '+').replace(/_/g, '/'));
const newCode = () => { const b = crypto.getRandomValues(new Uint8Array(12)); let s = ''; for (const x of b) s += ALPHA[x % ALPHA.length]; return s.match(/.{4}/g).join('-'); };
const normCode = (c) => { const s = String(c || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); return (s.match(/.{1,4}/g) || []).join('-'); };
const normUser = (u) => String(u || '').normalize('NFKC').toLowerCase().replace(/[ً-ٰٟ]/g, '').replace(/[أإآ]/g, 'ا').replace(/ى/g, 'ي').replace(/ة/g, 'ه').replace(/\s+/g, ' ').trim();

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
async function makeToken(env) { const e = now() + TOKEN_TTL, p = b64u(enc.encode(JSON.stringify({ e }))); return { token: p + '.' + b64u(await hmac(env.TOKEN_SECRET, p)), exp: e }; }
async function okToken(env, t) {
  const [p, s] = String(t || '').split('.');
  if (!p || !s || b64u(await hmac(env.TOKEN_SECRET, p)) !== s) return false;
  try { return JSON.parse(unb64u(p)).e > now(); } catch (e) { return false; }
}
const view = (r) => { let s = r.status; if ((s === 'active' && r.exp <= now()) || (s === 'new' && r.x <= now())) s = 'expired'; return { code: r.code, u: r.u, d: r.d, x: r.x, created: r.created, status: s, start: r.start || 0, exp: r.exp || 0, bound: !!r.dev }; };

export default {
  async fetch(req, env) {
    const cors = { 'access-control-allow-origin': env.ALLOW_ORIGIN || '*', 'access-control-allow-methods': 'POST, OPTIONS', 'access-control-allow-headers': 'content-type', 'access-control-max-age': '86400' };
    const out = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store', ...cors } });
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST') return out({ ok: false, error: 'POST فقط' }, 405);
    let b = {}; try { b = await req.json(); } catch (e) { /* فاضي */ }
    const path = new URL(req.url).pathname.replace(/\/+$/, '');
    const kv = env.TRIALS, t = now();
    const getRec = async (code) => { const v = await kv.get('c:' + normCode(code)); return v ? JSON.parse(v) : null; };
    const putRec = (r) => kv.put('c:' + r.code, JSON.stringify(r), { expirationTtl: Math.max(86400, r.d + ACT_WINDOW + 90 * 86400) });

    /* ---- دخول المطور ---- */
    if (path === '/dev/login') {
      const ip = req.headers.get('CF-Connecting-IP') || 'x', rk = 'rl:' + ip;
      const f = JSON.parse((await kv.get(rk)) || '{"n":0,"until":0}');
      if (f.until > t) return out({ ok: false, error: 'استنى ' + (f.until - t) + ' ثانية وجرّب تاني.' }, 429);
      if (env.DEV_PASSWORD && await same(b.password || '', env.DEV_PASSWORD)) { await kv.delete(rk); return out({ ok: true, ...(await makeToken(env)), now: t }); }
      f.n++; f.until = f.n >= 3 ? t + Math.min(900, 30 * 2 ** (f.n - 3)) : 0;
      await kv.put(rk, JSON.stringify(f), { expirationTtl: 3600 });
      return out({ ok: false, error: 'كلمة السر غلط.' }, 401);
    }
    /* ---- أوامر المطور (محتاجة توكن) ---- */
    if (path.startsWith('/dev/')) {
      if (!(await okToken(env, b.token))) return out({ ok: false, error: 'سجّل دخول المطور تاني.', auth: true }, 401);
      if (path === '/dev/issue') {
        const user = String(b.user || '').trim(), d = Math.round(+b.seconds);
        if (!user || !(d >= 30)) return out({ ok: false, error: 'اسم المستخدم أو المدة غير صحيحة.' }, 400);
        const r = { code: newCode(), u: user, d, created: t, x: t + ACT_WINDOW, status: 'new' };
        await putRec(r); return out({ ok: true, ...view(r) });
      }
      if (path === '/dev/list') {
        const ks = await kv.list({ prefix: 'c:', limit: 1000 });
        const items = (await Promise.all(ks.keys.map((k) => kv.get(k.name)))).filter(Boolean).map((v) => view(JSON.parse(v))).sort((a, c) => c.created - a.created);
        return out({ ok: true, items, now: t });
      }
      const r = await getRec(b.code);
      if (!r) return out({ ok: false, error: 'الكود مش موجود.' }, 404);
      if (path === '/dev/revoke') { r.status = 'revoked'; await putRec(r); return out({ ok: true }); }
      if (path === '/dev/reset') { delete r.dev; await putRec(r); return out({ ok: true }); }
      if (path === '/dev/delete') { await kv.delete('c:' + r.code); return out({ ok: true }); }
      return out({ ok: false, error: 'أمر غير معروف' }, 404);
    }
    /* ---- العميل: تفعيل وفحص ---- */
    if (path === '/activate' || path === '/check') {
      const r = await getRec(b.code), device = String(b.device || '');
      if (!r || normUser(r.u) !== normUser(b.user) || !device) return out({ ok: false, error: 'الكود أو اسم المستخدم غير صحيح.' }, 403);
      if (r.status === 'revoked') return out({ ok: false, error: 'الكود ده اتلغى. كلّم المطور.' }, 403);
      if (r.status === 'new') {
        if (path === '/check') return out({ ok: false, error: 'الكود لسه ما اتفعّلش.' }, 403);
        if (r.x <= t) return out({ ok: false, error: 'انتهت مهلة تفعيل الكود. اطلب كود جديد.' }, 410);
        r.status = 'active'; r.start = t; r.exp = t + r.d; r.dev = device; await putRec(r);   // العدّاد بيبدأ هنا
      }
      if (r.dev && r.dev !== device) return out({ ok: false, error: 'الكود ده مستخدم على جهاز تاني.' }, 409);
      if (!r.dev) { r.dev = device; await putRec(r); }
      if (r.exp <= t) return out({ ok: false, error: 'انتهت مدة الكود. اطلب كود جديد.', expired: true }, 410);
      return out({ ok: true, exp: r.exp, now: t, code: r.code, user: r.u });
    }
    return out({ ok: false, error: 'مش موجود' }, 404);
  }
};
