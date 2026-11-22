/* لوحة المطور: السيرفر بيبعت الملف ده بس لو معاك جلسة مطور. توليد الأكواد واللينكات من هنا فقط. */
(function (w) {
  'use strict';
  const O = w.Omran, { H, toast } = O;
  const UNITS = { n: ['دقيقة', 60], h: ['ساعة', 3600], d: ['يوم', 86400], m: ['شهر', 2592000], y: ['سنة', 31536000] };
  const durTxt = (d) => { for (const [n, k] of [['سنة', 31536000], ['شهر', 2592000], ['يوم', 86400], ['ساعة', 3600], ['دقيقة', 60]]) if (d >= k && d % k === 0) return d / k + ' ' + n; return Math.round(d / 60) + ' دقيقة'; };
  const when = (e) => new Date(e * 1000).toLocaleString('ar-EG', { dateStyle: 'medium', timeStyle: 'short' });
  const left = (e, now) => { const s = e - now; if (s >= 172800) return Math.ceil(s / 86400) + ' يوم'; if (s >= 3600) return Math.ceil(s / 3600) + ' ساعة'; return Math.max(1, Math.ceil(s / 60)) + ' دقيقة'; };
  const copy = async (t) => { try { await navigator.clipboard.writeText(t); toast('تم النسخ'); } catch (e) { const ta = document.createElement('textarea'); ta.value = t; document.body.appendChild(ta); ta.select(); try { document.execCommand('copy'); toast('تم النسخ'); } catch (e2) { /* لا شيء */ } ta.remove(); } };
  const link = (u) => location.origin + '/?u=' + encodeURIComponent(u);
  const msg = (t) => `جرّب برنامج عمران لإدارة العقارات والمقاولات\nالرابط: ${link(t.u)}\nاسم المستخدم: ${t.u}\nكود التجربة: ${t.code}\nمدة التجربة ${durTxt(t.d)}، وبتبدأ لحظة ما تدخل الكود لأول مرة. الكود بيشتغل على جهاز واحد.`;
  async function api(p, b) {
    try { const r = await fetch('/api/dev/' + p, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(b || {}), credentials: 'same-origin' }); return Object.assign({ ok: false }, await r.json().catch(() => ({}))); }
    catch (e) { return { ok: false, offline: true, error: 'مفيش اتصال بالسيرفر.' }; }
  }
  function mount(host) {
    let last = null, items = [], now = Math.floor(Date.now() / 1000);
    const st = (t) => t.status === 'active' ? `<span class="g">شغال، بدأ ${when(t.start)} (متبقي ${left(t.exp, now)})</span>` : t.status === 'new' ? '<span>لسه ما اتستخدمش</span>' : t.status === 'revoked' ? '<span class="r">ملغي</span>' : '<span class="mut">منتهي</span>';
    const draw = async (fresh) => {
      if (fresh !== false) {
        host.innerHTML = '<p class="mut">جاري التحميل...</p>';
        const r = await api('list');
        if (r.auth) { location.href = '/dev'; return; }
        if (!r.ok) { host.innerHTML = `<p class="mut">${H.esc(r.error || 'حصلت مشكلة')}</p><button class="btn" id="dvr">إعادة المحاولة</button>`; host.onclick = (e) => { if (e.target.id === 'dvr') draw(); }; return; }
        items = r.items; now = r.now;
      }
      host.innerHTML = `<h3>كود تجربة جديد</h3>
        <div class="fgrid cols3"><label class="fld"><span>اسم المستخدم (للعميل)</span><input id="dvu" placeholder="مثلاً: شركة النور"></label>
        <label class="fld"><span>المدة</span><div class="dur"><input id="dvn" inputmode="decimal" value="3"><select id="dvt"><option value="n">دقيقة</option><option value="h">ساعة</option><option value="d">يوم</option><option value="m">شهر</option><option value="y">سنة</option></select></div></label>
        <div class="fld"><span>&nbsp;</span><button class="btn primary" id="dvm">إنشاء الكود واللينك</button></div></div>
        ${last ? `<div class="dvout"><b>${H.esc(last.user)}</b><small>المدة ${durTxt(last.d)}، وبتبدأ لحظة ما العميل يدخل الكود لأول مرة. الكود بيشتغل على جهاز واحد بس.</small><textarea readonly dir="ltr" rows="1">${last.code}</textarea><div class="dvlink"><small>اللينك للعميل (اسمه مكتوب فيه جاهز)</small><input readonly dir="ltr" value="${link(last.user)}"></div><div class="row-actions"><button class="btn primary" data-cpl="${link(last.user)}">نسخ اللينك</button><button class="btn" data-cp="${last.code}">نسخ الكود</button><button class="btn" id="dvmsg">نسخ رسالة كاملة</button></div></div>` : ''}
        ${items.length ? `<h3 class="dvh">الأكواد (${items.length})</h3><div class="tblw"><table class="tbl"><thead><tr><th>المستخدم</th><th>المدة</th><th>الحالة</th><th></th></tr></thead><tbody>${items.map((t, i) => `<tr><td>${H.esc(t.u)}<br><small class="mut" dir="ltr">${t.code}</small></td><td>${durTxt(t.d)}</td><td>${st(t)}</td><td class="ra"><button class="lnk" data-cpl="${link(t.u)}">اللينك</button><button class="lnk" data-cp="${t.code}">الكود</button><button class="lnk" data-cpm="${i}">الرسالة</button>${t.status === 'active' || t.status === 'new' ? `<button class="lnk del" data-rv="${t.code}">إلغاء</button>` : ''}${t.bound && t.status === 'active' ? `<button class="lnk" data-rs="${t.code}">فك الجهاز</button>` : ''}<button class="lnk del" data-dl="${t.code}">حذف</button></td></tr>`).join('')}</tbody></table></div>` : ''}
        <p class="mut dvnote">كل الأكواد بتتراجع من السيرفر: بتشتغل على جهاز واحد، والعدّاد بيبدأ لما العميل يدخل، وتقدر تلغيها في أي وقت وهتقفل عنده في خلال دقيقة تقريباً. «فك الجهاز» لو العميل غيّر جهازه أو مسح بيانات المتصفح.</p>
        <div class="row-actions"><button class="btn" id="dvr">تحديث</button><a class="btn" href="#/">فتح البرنامج</a><button class="btn" id="dvx">خروج من وضع المطور</button></div>`;
      host.onclick = async (e) => {
        const b = e.target.closest('button'); if (!b) return;
        if (b.id === 'dvm') {
          const u = host.querySelector('#dvu').value.trim(), n = H.toNum(host.querySelector('#dvn').value), un = host.querySelector('#dvt').value;
          if (!u) { toast('اكتب اسم المستخدم', 'warn'); return; }
          if (!(n > 0)) { toast('اكتب مدة صحيحة', 'warn'); return; }
          b.disabled = true;
          const r = await api('issue', { user: u, seconds: Math.round(n * UNITS[un][1]) });
          if (!r.ok) { b.disabled = false; toast(r.error || 'حصلت مشكلة في السيرفر', 'warn'); return; }
          last = r; draw();
        }
        if (b.dataset.cp) copy(b.dataset.cp);
        if (b.dataset.cpl) copy(b.dataset.cpl);
        if (b.id === 'dvmsg') copy(msg({ u: last.user, code: last.code, d: last.d }));
        if (b.dataset.cpm != null) copy(msg(items[+b.dataset.cpm]));
        if (b.id === 'dvr') draw();
        if (b.dataset.rv && await O.confirmBox('إلغاء الكود ده؟ العميل هيتقفل عليه فوراً تقريباً.', 'إلغاء الكود')) { await api('revoke', { code: b.dataset.rv }); toast('تم إلغاء الكود'); draw(); }
        if (b.dataset.rs) { await api('reset', { code: b.dataset.rs }); toast('تم فك الكود من الجهاز'); draw(); }
        if (b.dataset.dl && await O.confirmBox('حذف الكود نهائياً؟', 'حذف')) { await api('delete', { code: b.dataset.dl }); draw(); }
        if (b.id === 'dvx') O.License.exit(true);
      };
    };
    draw();
  }
  O.DevPanel = { mount };
})(window);
