/* العروض: الرئيسية + القوائم + النماذج + العقود والأقساط + المخزن + التقارير + الحاسبة + الإعدادات */
(function (w) {
  'use strict';
  const O = w.Omran;
  const { S, H, M, ICON, TILE, TONE, FS, toast, beep, modal, confirmBox, ask } = O;
  const { esc, fmt, sum, today, addDays, addMonths, fdate, toNum, norm } = H;
  const $ = (s, r) => (r || document).querySelector(s);
  const root = () => document.getElementById('app');
  let tick = null;
  const go = (h) => { location.hash = h; };

  const top = (title, o) => {
    o = o || {};
    return `<header class="topbar noprint"><a class="back ${(o.back || '#/') === '#/' ? 'hide-lg' : ''}" href="${o.back || '#/'}" aria-label="رجوع">${ICON.back}</a><h1>${esc(title)}</h1><div class="tacts">${o.actions || ''}</div></header>`;
  };
  const badge = (t) => (t ? `<span class="badge ${TONE[t] || 'gray'}">${esc(t)}</span>` : '');
  const showA = (a) => a && (a.s != null || (a.v != null && a.v !== '' && (+a.v !== 0 || a.always)));
  const cur = () => S.meta().currency;
  function chips(list) {
    return `<div class="chips">${list.map((c) => `<div class="chip ${c.tone || ''}"><small>${esc(c.l)}</small><b>${c.s != null ? esc(c.s) : `<span class="cn" data-count="${+c.v || 0}">${fmt(c.v)}</span>`}${c.s == null ? ` <i>${esc(cur())}</i>` : ''}</b></div>`).join('')}</div>`;
  }
  const optList = (opts) => (typeof opts === 'function' ? opts() : opts).map((o) => (typeof o === 'string' ? { v: o, l: o } : o));
  const getFields = (m, vals) => (typeof m.fields === 'function' ? m.fields(vals) : m.fields);

  /* ================= النماذج ================= */
  function buildForm(fields, vals) {
    const node = document.createElement('div');
    node.className = 'fgrid';
    fields.forEach((f) => {
      const v = vals[f.k] != null ? vals[f.k] : '';
      let inner;
      if (f.t === 'select') {
        inner = `<select name="${f.k}"><option value="">— اختر —</option>${optList(f.opts).map((o) => `<option value="${esc(o.v)}" ${String(v) === String(o.v) ? 'selected' : ''}>${esc(o.l)}</option>`).join('')}</select>`;
      } else if (f.t === 'textarea') {
        inner = `<textarea name="${f.k}" rows="3">${esc(v)}</textarea>`;
      } else {
        const type = f.t === 'date' ? 'date' : f.t === 'tel' ? 'tel' : 'text';
        inner = `<input name="${f.k}" type="${type}" ${f.t === 'number' ? 'inputmode="decimal"' : ''} value="${esc(v)}" ${f.list ? `list="dl_${f.k}"` : ''} autocomplete="off">${f.list ? `<datalist id="dl_${f.k}">${f.list().map((x) => `<option value="${esc(x)}">`).join('')}</datalist>` : ''}`;
      }
      node.insertAdjacentHTML('beforeend', `<label class="fld ${f.w === 'full' ? 'full' : ''}"><span>${esc(f.l)}${f.req ? ' <em>*</em>' : ''}</span>${inner}</label>`);
    });
    return {
      node,
      get() {
        const out = {}, miss = [];
        fields.forEach((f) => {
          let v = node.querySelector(`[name="${f.k}"]`).value;
          v = f.t === 'number' ? (v.trim() === '' ? '' : toNum(v)) : v.trim();
          if (f.req && v === '') miss.push(f.l);
          out[f.k] = v;
        });
        return { vals: out, miss };
      }
    };
  }

  /* ---------- ملفات العقود (PDF / صور) ---------- */
  async function viewFile(f) {
    let rec = null;
    try { rec = await FS.get(f.id); } catch (e) { /* غير متاح */ }
    if (!rec) { toast('الملف مش موجود على الجهاز ده', 'warn'); return; }
    const url = URL.createObjectURL(rec.blob), img = (rec.type || '').startsWith('image/');
    const body = document.createElement('div');
    body.className = 'viewer';
    body.innerHTML = img ? `<img src="${url}" alt="${esc(f.name)}">` : `<iframe src="${url}" title="${esc(f.name)}"></iframe><p class="mut">لو الملف مش ظاهر، استخدم «فتح في تبويب جديد».</p>`;
    modal({
      title: f.name, body, wide: true,
      actions: [{ l: 'فتح في تبويب جديد', fn: () => w.open(url, '_blank') }, { l: 'تحميل', fn: () => { const a = document.createElement('a'); a.href = url; a.download = f.name; document.body.appendChild(a); a.click(); a.remove(); } }, { l: 'إغلاق', cls: 'primary', fn: (c) => c() }],
      onClose: () => setTimeout(() => URL.revokeObjectURL(url), 60000)
    });
  }
  function filesEditor(host, arr, onChange) {
    const draw = () => {
      host.innerHTML = `<div class="files">${arr.length ? arr.map((f, i) => `<div class="file"><span class="fi">${ICON.file}</span><span class="fn">${esc(f.name)}</span><small class="mut">${H.fsize(f.size || 0)}</small><button type="button" class="lnk" data-open="${i}">فتح</button><button type="button" class="ic" data-rm="${i}" aria-label="حذف الملف">${ICON.trash}</button></div>`).join('') : '<p class="mut">لسه مفيش ملفات. ارفع العقد الورقي (PDF أو صورة) عشان ترجعله وقت ما تحتاج.</p>'}</div><label class="btn upl">${ICON.plus}<span>رفع ملف (PDF أو صورة)</span><input type="file" accept="application/pdf,image/*" multiple hidden></label>`;
      host.querySelectorAll('[data-open]').forEach((b) => { b.onclick = () => viewFile(arr[+b.dataset.open]); });
      host.querySelectorAll('[data-rm]').forEach((b) => { b.onclick = async () => { if (await confirmBox('إزالة الملف ده من السجل؟', 'إزالة')) { arr.splice(+b.dataset.rm, 1); draw(); if (onChange) onChange(); } }; });
      host.querySelector('input[type=file]').onchange = async (e) => {
        for (const f of e.target.files) {
          if (f.size > 25 * 1048576) { toast('الملف ' + f.name + ' أكبر من 25 ميجا', 'warn'); continue; }
          const id = H.uid();
          try { await FS.put(id, f, f.name, f.type); } catch (err) { toast('تعذر حفظ الملف في المتصفح', 'warn'); continue; }
          arr.push({ id, name: f.name, size: f.size, type: f.type });
        }
        draw(); if (onChange) onChange();
      };
    };
    draw();
  }

  /* ---------- نموذج الإضافة / التعديل العام ---------- */
  function openForm(key, id, refresh, preset) {
    const m = M[key], old = id ? S.get(key, id) : null;
    const vals = old ? Object.assign({}, old) : Object.assign({}, preset || {});
    const fields = getFields(m, vals);
    if (!old) fields.forEach((f) => { if (vals[f.k] === undefined && f.def !== undefined) vals[f.k] = typeof f.def === 'function' ? f.def() : f.def; });
    const hidden = {};
    Object.keys(preset || {}).forEach((k) => { if (!fields.some((f) => f.k === k)) hidden[k] = preset[k]; });
    const body = document.createElement('div');
    const form = buildForm(fields, vals);
    body.appendChild(form.node);
    const files = old && old.files ? JSON.parse(JSON.stringify(old.files)) : [];
    if (m.files) {
      const h = document.createElement('div');
      h.className = 'psec';
      h.innerHTML = '<h3>ملفات الاتفاق / العقد</h3><div></div>';
      body.appendChild(h);
      filesEditor(h.lastElementChild, files);
    }
    modal({
      title: m.formTitle ? m.formTitle(vals, old) : (old ? 'تعديل ' : 'إضافة ') + m.single, body, wide: true, sticky: true,
      actions: [{ l: 'إلغاء', fn: (c) => c() }, {
        l: 'حفظ', cls: 'primary', fn: (c) => {
          const r = form.get();
          if (r.miss.length) { toast('أكمل الحقول: ' + r.miss.join('، '), 'warn'); return; }
          let o = Object.assign({}, old || {}, hidden, r.vals);
          if (m.files) o.files = files;
          if (m.beforeSave) o = m.beforeSave(o, old);
          if (m.validate) { const err = m.validate(o, old); if (err) { toast(err, 'warn'); return; } }
          S.put(key, o); c(); beep(); toast('تم الحفظ'); if (refresh) refresh();
        }
      }]
    });
  }

  /* ================= دوال تستدعيها الوحدات ================= */
  const V = {
    viewFile,
    treasuryForm: (preset, refresh) => openForm('treasury', null, refresh || route, preset),
    stockForm: (type, preset) => openForm('stockmoves', null, route, Object.assign({ type }, preset || {})),
    collectModal(inst, cb) {
      const body = document.createElement('div');
      body.innerHTML = `<p class="cm">${esc(inst.label || 'قسط')} - المستحق ${fmt(O.instRem(inst))} ${esc(cur())}</p><div class="fgrid"><label class="fld"><span>تاريخ التحصيل</span><input type="date" name="d" value="${today()}"></label><label class="fld"><span>المبلغ المحصّل</span><input name="a" inputmode="decimal" value="${O.instRem(inst)}"></label><label class="fld full"><span>ملاحظات (نقدي، تحويل، رقم إيصال...)</span><input name="n" autocomplete="off"></label></div><p class="mut">هيتسجل لوحده كوارد في الخزنة، وتقدر تحصّل على دفعات جزئية.</p>`;
      modal({
        title: 'تحصيل قسط', body, sticky: true,
        actions: [{ l: 'إلغاء', fn: (c) => c() }, { l: 'تأكيد التحصيل', cls: 'primary', fn: (c) => { const a = toNum($('[name=a]', body).value); if (!a) { toast('اكتب المبلغ', 'warn'); return; } cb({ amount: a, date: $('[name=d]', body).value || today(), note: $('[name=n]', body).value.trim() }); c(); } }]
      });
    },
    collectNext(ct, refresh) {
      const n = O.nextInst(ct);
      if (!n) return;
      V.collectModal(n, (p) => {
        const c = JSON.parse(JSON.stringify(S.get('contracts', ct.id))), i = c.insts.find((x) => x.id === n.id);
        O.addPay(i, p);
        O.saveContract(c, null); beep(); toast('تم التحصيل وتسجيله في الخزنة'); if (refresh) refresh();
      });
    },
    remind(ct) {
      const n = O.nextInst(ct);
      if (!n) return;
      const link = H.waLink(ct.phone, `السلام عليكم أ/ ${ct.name}\nتذكير بقسط (${n.label}) بمبلغ ${fmt(O.instRem(n))} ${cur()} المستحق بتاريخ ${fdate(n.due)}.\nشكراً لحضرتك.`);
      if (!link) { toast('ضيف رقم تليفون العميل الأول', 'warn'); return; }
      w.open(link, '_blank');
    }
  };
  O.V = V;

  /* ================= صفحة القائمة العامة ================= */
  function listPage(key) {
    const m = M[key], st = { q: '', f: {} };
    const adds = m.addButtons || [{ l: 'إضافة ' + m.single, cls: 'primary', plus: 1 }];
    root().innerHTML = `${top(m.title, { back: m.back, actions: adds.map((b, i) => `<button class="btn ${b.cls || ''}" data-addi="${i}">${b.plus ? ICON.plus : ''}<span>${esc(b.l)}</span></button>`).join('') })}
      <main class="wrap inner"><div id="sum"></div>
      <div class="tools"><label class="search">${ICON.search}<input type="search" placeholder="بحث في ${esc(m.title)}" aria-label="بحث" id="q"></label>${(m.filters || []).map((f, i) => `<select data-f="${i}" aria-label="${esc(f.l)}"><option value="">${esc(f.l)}</option>${optList(f.ref ? O.refOpts(f.ref) : f.opts).map((o) => `<option value="${esc(o.v)}">${esc(o.l)}</option>`).join('')}</select>`).join('')}</div>
      <div id="list" class="list"></div></main>`;

    const rowHTML = (it) => {
      const r = m.row(it);
      const acts = (m.actions ? m.actions(it) : []).map((a, i) => (a.q ? `<button class="lnk" data-a="${i}">${esc(a.l)}</button>` : '')).join('');
      const wa = it.phone ? H.waLink(it.phone) : '';
      const dot = r.dot || (r.b && r.b[0] ? TONE[r.b[0]] || 'gray' : 'gray');
      return `<article class="item" data-id="${it.id}" tabindex="0" role="link"><span class="dot ${dot}"></span><div class="ibody"><h3>${esc(r.t)}</h3><div class="meta">${(r.m || []).filter(Boolean).map((x) => `<span>${esc(x)}</span>`).join('')}</div>${r.p != null ? `<div class="bar" role="progressbar" aria-valuenow="${r.p}" aria-valuemin="0" aria-valuemax="100"><i style="width:${Math.min(100, r.p)}%"></i><em>${fmt(r.p)}%</em></div>` : ''}<div class="acts">${acts}${it.phone ? `<a class="lnk" href="tel:${esc(it.phone)}">اتصال</a>${wa ? `<a class="lnk" href="${wa}" target="_blank" rel="noopener">واتساب</a>` : ''}` : ''}</div></div><div class="iamts">${(r.b || []).map(badge).join('')}${(r.a || []).filter(showA).map((a) => `<div class="amt ${a.tone || ''}"><small>${esc(a.l)}</small><b>${a.s != null ? esc(a.s) : `<span class="cn" data-count="${+a.v || 0}">${fmt(a.v)}</span>`}${a.s == null ? ` <i>${esc(cur())}</i>` : ''}</b></div>`).join('')}</div></article>`;
    };
    const refresh = () => {
      let items = S.all(key).slice();
      items.sort(m.sortFn || ((a, b) => (b.created || 0) - (a.created || 0)));
      $('#sum').innerHTML = items.length && m.summary ? chips(m.summary(items)) : '';
      (m.filters || []).forEach((f, i) => { const v = st.f[i]; if (v) items = items.filter((it) => String(f.get ? f.get(it) : it[f.k]) === v); });
      if (st.q) { const q = st.q.toLowerCase(); items = items.filter((it) => (JSON.stringify(it) + JSON.stringify(m.row(it))).toLowerCase().includes(q)); }
      $('#list').innerHTML = items.length ? items.map(rowHTML).join('') : `<div class="empty">${O.badgeIcon(m.icon)}<p>${S.all(key).length ? 'مفيش نتائج مطابقة للبحث أو الفلتر.' : 'لسه مفيش بيانات في ' + esc(m.title) + '. ابدأ بإضافة أول سجل.'}</p>${S.all(key).length ? '' : `<button class="btn primary" data-addi="0">${esc(adds[0].l)}</button>`}</div>`;
    };
    root().onclick = async (e) => {
      const t = e.target.closest('button,a,.item');
      if (!t) return;
      if (t.dataset.addi != null) { m.editor ? go(m.editorRoute + 'new') : openForm(key, null, refresh, adds[+t.dataset.addi].preset); return; }
      const card = e.target.closest('.item');
      if (!card || t.tagName === 'A') return;
      const it = S.get(key, card.dataset.id);
      if (!it) return;
      if (t.dataset.a != null) { m.actions(it)[+t.dataset.a].fn(it, refresh); return; }
      go('#/d/' + key + '/' + it.id);
    };
    root().onkeydown = (e) => { if (e.key === 'Enter' && e.target.classList && e.target.classList.contains('item')) go('#/d/' + key + '/' + e.target.dataset.id); };
    $('#q').oninput = (e) => { st.q = e.target.value.trim(); refresh(); };
    root().querySelectorAll('select[data-f]').forEach((s) => { s.onchange = () => { st.f[s.dataset.f] = s.value; refresh(); }; });
    refresh();
  }

  /* ================= العميل والعقد ================= */
  function contractPage(id, unitPre) {
    const isNew = id === 'new';
    let saved = isNew ? null : S.get('contracts', id);
    if (!isNew && !saved) { go('#/m/contracts'); return; }
    const st = saved ? JSON.parse(JSON.stringify(saved)) : { name: '', nid: '', phone: '', phone2: '', address: '', job: '', unit: unitPre || '', date: today(), total: '', status: 'ساري', insts: [], files: [], note: '' };
    let totalTouched = !!saved;
    if (isNew && st.unit) { const u = S.get('properties', st.unit); if (u && u.price) st.total = +u.price; }
    const unitOpts = S.all('properties').filter((p) => { const c = O.contractOfUnit(p.id); return !c || c.id === st.id; });
    root().innerHTML = `${top(isNew ? 'عميل جديد' : st.name || 'العقد', { back: '#/m/contracts' })}
    <main class="wrap inner"><div id="ctsum"></div>
      <section class="panel pad"><h3>بيانات العميل</h3><div class="fgrid cols3">
        <label class="fld"><span>الاسم <em>*</em></span><input id="c_name" autocomplete="off"></label>
        <label class="fld"><span>التليفون</span><input id="c_phone" type="tel"></label>
        <label class="fld"><span>تليفون آخر</span><input id="c_phone2" type="tel"></label>
        <label class="fld"><span>الرقم القومي</span><input id="c_nid" inputmode="numeric"></label>
        <label class="fld"><span>الوظيفة</span><input id="c_job"></label>
        <label class="fld"><span>العنوان</span><input id="c_address"></label></div></section>
      <section class="panel pad"><h3>بيانات العقد</h3><div class="fgrid cols3">
        <label class="fld span2"><span>الوحدة المباعة</span><select id="c_unit"><option value="">— بدون وحدة —</option>${unitOpts.map((p) => `<option value="${p.id}">${esc(O.unitLabel(p, true))}${p.price ? ' — ' + fmt(p.price) : ''}</option>`).join('')}</select></label>
        <label class="fld"><span>تاريخ العقد</span><input type="date" id="c_date"></label>
        <label class="fld"><span>سعر البيع الإجمالي</span><input id="c_total" inputmode="decimal"></label>
        <label class="fld"><span>حالة العقد</span><select id="c_status"><option>ساري</option><option>ملغي</option></select></label></div></section>
      <section class="panel pad"><h3>جدول الأقساط</h3>
        <div class="gen"><label class="fld"><span>المقدم</span><input id="g_down" inputmode="decimal"></label><label class="fld"><span>مدة التقسيط</span><div class="dur"><input id="g_n" inputmode="decimal" aria-label="المدة"><select id="g_unit" aria-label="الوحدة"><option value="y">سنة</option><option value="m">شهر</option></select></div></label><label class="fld"><span>دفع القسط كل</span><select id="g_months">${O.FREQ.map((f) => `<option value="${f.v}">${f.l}</option>`).join('')}</select></label><label class="fld"><span>تاريخ أول قسط</span><input type="date" id="g_first"></label><button type="button" class="btn primary" id="gen">إنشاء الجدول</button></div>
        <p class="mut hint">اكتب مدة التقسيط بالسنين أو الشهور وكل كام شهر بتدفع، وعدد الأقساط بيتحسب لوحده (مثلاً 5 سنين وشهري = 60 قسط). الباقي بعد المقدم بيتقسّم بالتساوي، وتقدر تعدّل أي قسط بعد كده أو تضيف دفعة مختلفة (زي دفعة استلام). الأقساط اللي اتحصّلت بتفضل زي ما هي.</p>
        <div class="tblw"><table class="tbl insts"><thead><tr><th>البند</th><th>الاستحقاق</th><th>المبلغ</th><th>المحصل</th><th>الحالة</th><th></th></tr></thead><tbody id="ib"></tbody></table></div>
        <div id="isum" class="sumline"></div><button class="btn" id="addi" type="button">${ICON.plus}<span>إضافة قسط / دفعة</span></button></section>
      <section class="panel pad"><h3>العقد الورقي (PDF)</h3><div id="files"></div></section>
      <section class="panel pad"><label class="fld"><span>ملاحظات</span><textarea id="c_note" rows="2"></textarea></label></section>
      <div class="savebar noprint">${saved ? '<button class="btn danger" id="del" type="button">حذف العميل</button>' : ''}<span class="sp"></span><button class="btn" id="cancel" type="button">رجوع</button><button class="btn primary" id="save" type="button">حفظ</button></div></main>`;
    const R = root(), MAP = { c_name: 'name', c_phone: 'phone', c_phone2: 'phone2', c_nid: 'nid', c_job: 'job', c_address: 'address', c_unit: 'unit', c_date: 'date', c_status: 'status', c_note: 'note' };
    Object.keys(MAP).forEach((k) => { $('#' + k).value = st[MAP[k]] == null ? '' : st[MAP[k]]; });
    $('#c_total').value = st.total || '';
    $('#g_first').value = addMonths(today(), 1);

    const stateOf = (i) => O.instState(i);
    const instRow = (i, k) => `<tr data-i="${k}"><td><input data-f="label" value="${esc(i.label)}" aria-label="البند"></td><td><input type="date" data-f="due" value="${esc(i.due)}" aria-label="الاستحقاق"></td><td><input data-f="amount" inputmode="decimal" value="${esc(i.amount)}" aria-label="المبلغ"></td><td class="num">${fmt(i.paid)}</td><td>${badge(stateOf(i))}</td><td class="ra">${O.instRem(i) > 0.5 ? '<button type="button" class="lnk" data-col>تحصيل</button>' : ''}${+i.paid > 0 ? '<button type="button" class="lnk" data-undo>إلغاء التحصيل</button>' : ''}<button type="button" class="ic" data-rm aria-label="حذف">${ICON.trash}</button></td></tr>`;
    const sums = () => {
      const sch = sum(st.insts, (i) => i.amount), paid = sum(st.insts, (i) => i.paid), tot = toNum(st.total), diff = tot - sch, n = O.nextInst(st);
      $('#isum').innerHTML = `<span>مجموع الجدول: <b>${fmt(sch)}</b></span><span>المحصل: <b class="g">${fmt(paid)}</b></span><span>المتبقي: <b class="o">${fmt(sch - paid)}</b></span>${st.insts.length && Math.abs(diff) > 0.5 ? `<span class="warnt">فرق عن سعر البيع: ${fmt(diff)}</span>` : ''}`;
      $('#ctsum').innerHTML = chips([{ l: 'سعر البيع', v: tot }, { l: 'المحصل', v: paid, tone: 'green' }, { l: 'المتبقي', v: sch - paid, tone: sch - paid > 0 ? 'orange' : '' }, n ? { l: 'القسط القادم', s: fdate(n.due) + ' - ' + fmt(O.instRem(n)), tone: n.due < today() ? 'red' : '' } : { l: 'القسط القادم', s: st.insts.length ? 'مفيش (مكتمل)' : 'لسه ما اتحددش' }]);
    };
    const draw = () => { $('#ib').innerHTML = st.insts.length ? st.insts.map(instRow).join('') : '<tr><td colspan="6" class="mut">لسه مفيش أقساط. حدد المقدم ومدة التقسيط واضغط «إنشاء الجدول»، أو ضيف قسط يدوي.</td></tr>'; sums(); };

    function persist() {
      if (!String(st.name).trim()) { toast('اكتب اسم العميل', 'warn'); return false; }
      st.total = toNum(st.total);
      st.insts.forEach((i) => { i.amount = toNum(i.amount); O.normInst(i); });
      st.insts = st.insts.filter((i) => i.amount > 0 || i.paid > 0).sort(O.byDue);
      if (st.insts.some((i) => !i.due)) { toast('حدد تاريخ استحقاق لكل قسط', 'warn'); return false; }
      const other = st.unit && st.status !== 'ملغي' && S.all('contracts').find((c) => c.id !== st.id && c.unit === st.unit && c.status !== 'ملغي');
      if (other) { toast('الوحدة دي مسجلة بالفعل للعميل ' + other.name, 'warn'); return false; }
      saved = O.saveContract(st, saved);
      st.id = saved.id;
      return true;
    }
    R.oninput = (e) => {
      const t = e.target;
      if (MAP[t.id] && t.id !== 'c_unit' && t.id !== 'c_status') st[MAP[t.id]] = t.value;
      else if (t.id === 'c_total') { st.total = toNum(t.value); totalTouched = true; sums(); }
      else if (t.closest('#ib')) { const i = st.insts[+t.closest('tr').dataset.i], f = t.dataset.f; i[f] = f === 'amount' ? toNum(t.value) : t.value; sums(); }
    };
    R.onchange = (e) => {
      const t = e.target;
      if (t.id === 'c_status') st.status = t.value;
      if (t.id === 'c_unit') { st.unit = t.value; const u = S.get('properties', t.value); if (u && u.price && (!totalTouched || !toNum(st.total))) { st.total = +u.price; $('#c_total').value = u.price; sums(); } }
      if (t.closest('#ib') && t.dataset.f === 'due') draw();
    };
    R.onclick = async (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      const tr = b.closest('tr'), k = tr ? +tr.dataset.i : -1, i = st.insts[k];
      if (b.id === 'gen') {
        const total = toNum(st.total), dur = toNum($('#g_n').value), freq = +$('#g_months').value || 1, durM = Math.round($('#g_unit').value === 'y' ? dur * 12 : dur), n = durM > 0 ? Math.max(1, Math.round(durM / freq)) : 0, first = $('#g_first').value, down = toNum($('#g_down').value);
        if (!total) { toast('اكتب سعر البيع الأول', 'warn'); return; }
        if (n > 0 && !first) { toast('اختار تاريخ أول قسط', 'warn'); return; }
        if (!n && !down) { toast('اكتب المقدم أو مدة التقسيط', 'warn'); return; }
        const kept = st.insts.filter((x) => (+x.paid || 0) > 0);
        if (st.insts.length > kept.length && !(await confirmBox('الأقساط غير المحصلة هتتستبدل بجدول جديد. تكمل؟', 'استبدال'))) return;
        st.insts = O.genInsts({ total, down, downDate: st.date, n, months: +$('#g_months').value, first, kept });
        draw();
      } else if (b.id === 'addi') { st.insts.push({ id: H.uid(), label: 'قسط', due: '', amount: '', paid: 0, paidDate: '' }); draw(); const ins = R.querySelectorAll('#ib tr:last-child input'); if (ins[1]) ins[1].focus(); }
      else if (b.hasAttribute('data-col')) { V.collectModal(i, (p) => { O.addPay(i, p); if (persist()) { toast('تم التحصيل وتسجيله في الخزنة'); beep(); } draw(); }); }
      else if (b.hasAttribute('data-undo')) { if (await confirmBox('إلغاء كل تحصيلات هذا القسط؟ هتتشال من الخزنة كمان. (لحذف دفعة واحدة افتح صفحة العميل)', 'إلغاء التحصيل')) { i.pays = []; i.paid = 0; i.paidDate = ''; if (saved) persist(); draw(); } }
      else if (b.hasAttribute('data-rm')) { if (!(+i.paid > 0) || await confirmBox('القسط ده فيه مبلغ محصّل. حذفه هيشيل الحركة من الخزنة. تكمل؟', 'حذف')) { st.insts.splice(k, 1); draw(); } }
      else if (b.id === 'cancel') go('#/m/contracts');
      else if (b.id === 'save') { if (persist()) { beep(); toast('تم حفظ العميل والجدول'); go('#/m/contracts'); } }
      else if (b.id === 'del') { if (await confirmBox('حذف العميل والعقد وكل الأقساط؟ هتتحذف كمان حركات التحصيل التلقائية من الخزنة.', 'حذف')) { O.deleteContract(saved); toast('تم الحذف'); go('#/m/contracts'); } }
    };
    filesEditor($('#files'), st.files);
    draw();
  }

  /* ================= صفحة التفاصيل (كشف حساب كامل لأي كارت) ================= */
  const info = (a) => `<div class="info">${a.filter((x) => x && x[1] !== '' && x[1] != null && x[1] !== false).map(([l, v]) => `<div><small>${esc(l)}</small><b>${esc(v)}</b></div>`).join('')}</div>`;
  const money = (v, c) => ({ h: v ? fmt(v) : '', c: 'num ' + (c || '') });
  const tbl = (heads, rows, empty) => (rows.length ? `<div class="tblw"><table class="tbl"><thead><tr>${heads.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => (c && typeof c === 'object' ? `<td class="${c.c || ''}">${c.h}</td>` : `<td>${esc(c == null ? '' : c)}</td>`)).join('')}</tr>`).join('')}</tbody></table></div>` : `<p class="mut">${empty}</p>`);
  const byDate = (a, b) => String(a.date || '').localeCompare(String(b.date || '')) || (a.created || 0) - (b.created || 0);
  const lk = (href, t) => (t ? `<a class="lk" href="${href}">${esc(t)}</a>` : '');
  const filesSec = (f) => (f && f.length ? { h: 'الملفات المرفوعة', html: `<div class="files">${f.map((x, i) => `<div class="file"><span class="fi">${ICON.file}</span><span class="fn">${esc(x.name)}</span><button type="button" class="lnk" data-openf="${i}">فتح</button></div>`).join('')}</div>` } : null);
  const noteSec = (n) => (n ? { h: 'ملاحظات', html: `<p class="pre">${esc(n)}</p>` } : null);
  const T = (f) => S.all('treasury').filter(f).sort(byDate);
  // كشف حركات الخزنة: التاريخ | البيان | ملاحظات | وارد | صادر | الرصيد
  function trTable(list, empty) {
    let bal = 0;
    const rows = list.map((x) => { bal += x.type === 'in' ? x.amount : -x.amount; return [fdate(x.date), (x.cat || '') + (x.party ? ' - ' + x.party : ''), x.note || '', money(x.type === 'in' ? x.amount : 0, 'g'), money(x.type === 'out' ? x.amount : 0, 'o'), { h: fmt(bal), c: 'num' }, { h: `<a class="lk" href="#/d/treasury/${x.id}">فتح</a>`, c: 'ra' }]; });
    return tbl(['التاريخ', 'البيان', 'ملاحظات', 'وارد', 'صادر', 'الصافي', ''], rows, empty);
  }
  const editAct = (key, it) => ({ l: 'تعديل', fn: () => (M[key].editor ? go(M[key].editorRoute + it.id) : openForm(key, it.id, route)) });
  const delAct = (key, it, msg) => ({ l: 'حذف', cls: 'danger', fn: async () => { if (await confirmBox(msg || 'حذف هذا السجل نهائياً؟ لا يمكن التراجع.', 'حذف')) { key === 'contracts' ? O.deleteContract(it) : S.del(key, it.id); beep(330); toast('تم الحذف'); go('#/m/' + key); } } });
  const D = {};

  D.contracts = (c) => {
    if ((c.insts || []).some((i) => !Array.isArray(i.pays) || i.pays.some((p) => !p.no))) { c.insts.forEach(O.normInst); S.put('contracts', c); }
    const pays = [];
    (c.insts || []).forEach((i) => i.pays.forEach((p) => pays.push({ i, p })));
    pays.sort((a, b) => String(a.p.date).localeCompare(String(b.p.date)));
    const n = O.nextInst(c), u = S.get('properties', c.unit), paid = O.ctPaid(c), rem = O.ctRem(c);
    let run = 0;
    return {
      title: c.name, back: '#/m/contracts', badge: O.ctState(c),
      chips: [{ l: 'سعر البيع', v: c.total }, { l: 'المحصل', v: paid, tone: 'green' }, { l: 'المتبقي', v: rem, tone: rem > 0 ? 'orange' : '' }, n ? { l: 'القسط القادم', s: fdate(n.due) + ' - ' + fmt(O.instRem(n)), tone: n.due < today() ? 'red' : '' } : { l: 'القسط القادم', s: 'مفيش (مكتمل)' }],
      secs: [
        { h: 'بيانات العميل والعقد', html: info([['الوحدة', u ? O.unitLabel(u, true) : ''], ['التليفون', c.phone], ['تليفون آخر', c.phone2], ['الرقم القومي', c.nid], ['الوظيفة', c.job], ['العنوان', c.address], ['تاريخ العقد', c.date && fdate(c.date)], ['حالة العقد', c.status]]) },
        { h: `كل التحصيلات (${pays.length})`, html: tbl(['التاريخ', 'البند', 'المبلغ', 'إجمالي المحصل', 'ملاحظات', ''], pays.map(({ i, p }) => { run += p.amount; return [fdate(p.date), i.label, money(p.amount, 'g'), { h: fmt(run), c: 'num' }, p.note || '', { h: `<button type="button" class="lnk del" data-delpay="${i.id}|${p.id}">حذف</button>`, c: 'ra' }]; }), 'لسه ما اتحصّلش أي مبلغ. اضغط «تحصيل قسط» لتسجيل أول دفعة.') },
        { h: 'إيصالات الاستلام النقدية', html: tbl(['رقم الإيصال', 'التاريخ', 'عن', 'المبلغ', ''], pays.slice().reverse().map(({ i, p }) => [{ h: '#' + p.no, c: 'num' }, fdate(p.date), i.label === 'المقدم' ? 'المقدم' : i.label, money(p.amount, 'g'), { h: `<a class="lk" href="#/receipt/${c.id}/${p.id}">فتح وطباعة</a>`, c: 'ra' }]), 'الإيصالات بتتعمل تلقائي مع كل تحصيل.') },
        { h: 'جدول الأقساط', html: tbl(['البند', 'الاستحقاق', 'المبلغ', 'المحصل', 'المتبقي', 'الحالة'], (c.insts || []).map((i) => [i.label, fdate(i.due), money(i.amount), money(i.paid, 'g'), money(O.instRem(i), 'o'), { h: badge(O.instState(i)) }]), 'لسه مفيش جدول أقساط.') },
        filesSec(c.files), noteSec(c.note)
      ],
      acts: [].concat(n && c.status !== 'ملغي' ? [{ l: 'تحصيل قسط', cls: 'primary', fn: () => V.collectNext(S.get('contracts', c.id), route) }] : [], n && c.phone ? [{ l: 'تذكير واتساب', fn: () => V.remind(c) }] : [], [editAct('contracts', c), delAct('contracts', c, 'حذف العميل والعقد وكل الأقساط؟ هتتحذف كمان حركات التحصيل التلقائية من الخزنة.')]),
      files: c.files,
      click: async (b) => {
        if (!b.dataset.delpay) return;
        const [iid, pid] = b.dataset.delpay.split('|');
        if (!(await confirmBox('حذف هذه الدفعة؟ هتتشال من الخزنة كمان.', 'حذف'))) return;
        const x = JSON.parse(JSON.stringify(S.get('contracts', c.id))), i = x.insts.find((q) => q.id === iid);
        i.pays = i.pays.filter((q) => q.id !== pid);
        O.saveContract(x, null); toast('تم حذف الدفعة'); route();
      }
    };
  };

  D.contractors = (m) => {
    const list = T((x) => x.member === m.id), paid = sum(list, (x) => x.amount), cv = +m.contractValue || 0;
    return {
      title: m.name, back: '#/m/contractors', badge: m.trade,
      chips: [].concat(cv ? [{ l: 'قيمة الاتفاق', v: cv }] : [], [{ l: 'إجمالي المدفوع', v: paid, tone: 'green' }], cv ? [{ l: 'المتبقي', v: Math.max(0, cv - paid), tone: cv > paid ? 'orange' : '' }] : [], [{ l: 'عدد الدفعات', s: list.length }]),
      secs: [
        { h: 'البيانات', html: info([['التخصص', m.trade], ['التليفون', m.phone], ['المشروع', O.refName('projects', m.project)], ['نظام الحساب', m.terms]]) },
        { h: `كل الدفعات (${list.length})`, html: trTable(list, 'لسه ما اتسجلتش دفعات. اضغط «دفعة جديدة».') },
        filesSec(m.files), noteSec(m.note)
      ],
      acts: [{ l: 'دفعة جديدة', cls: 'primary', fn: () => V.treasuryForm({ type: 'out', cat: 'مقاولين ومهندسين', member: m.id, project: m.project || '', party: m.name }, route) }, editAct('contractors', m), delAct('contractors', m)],
      files: m.files
    };
  };

  D.suppliers = (s) => {
    const buys = S.all('stockmoves').filter((x) => x.type === 'in' && x.supplier === s.id).map((x) => ({ date: x.date, created: x.created, k: 'b', amt: (+x.qty || 0) * (+x.price || 0), txt: 'توريد ' + x.item + ' (' + fmt(x.qty) + ' ' + (x.unit || '') + (x.price ? ' × ' + fmt(x.price) : '') + ')', note: x.note }));
    const pays = T((x) => x.supplier === s.id).map((x) => ({ date: x.date, created: x.created, k: 'p', amt: x.amount, txt: 'دفعة - ' + (x.cat || ''), note: x.note, id: x.id }));
    const all = buys.concat(pays).sort(byDate), b = sum(buys, (x) => x.amt), p = sum(pays, (x) => x.amt);
    let due = 0;
    return {
      title: s.name, back: '#/m/suppliers', badge: s.category,
      chips: [{ l: 'إجمالي المشتريات', v: b }, { l: 'المدفوع', v: p, tone: 'green' }, { l: 'المستحق له', v: Math.max(0, b - p), tone: b > p ? 'orange' : '' }],
      secs: [
        { h: 'البيانات', html: info([['نوع المواد', s.category], ['التليفون', s.phone], ['العنوان', s.address], ['شروط الدفع', s.terms]]) },
        { h: 'كشف الحساب (توريدات ودفعات)', html: tbl(['التاريخ', 'البيان', 'ملاحظات', 'مشتريات', 'مدفوع', 'المستحق', ''], all.map((x) => { due += x.k === 'b' ? x.amt : -x.amt; return [fdate(x.date), x.txt, x.note || '', money(x.k === 'b' ? x.amt : 0, 'o'), money(x.k === 'p' ? x.amt : 0, 'g'), { h: fmt(due), c: 'num' }, { h: x.id ? `<a class="lk" href="#/d/treasury/${x.id}">فتح</a>` : '', c: 'ra' }]; }), 'لسه مفيش توريدات ولا دفعات لهذا المورد.') },
        noteSec(s.note)
      ],
      acts: [{ l: 'دفعة جديدة', cls: 'primary', fn: () => V.treasuryForm({ type: 'out', cat: 'مواد وخامات', supplier: s.id, party: s.name }, route) }, { l: 'وارد خامات', fn: () => V.stockForm('in', { supplier: s.id }) }, editAct('suppliers', s), delAct('suppliers', s)]
    };
  };

  D.projects = (p) => {
    const list = T((x) => x.project === p.id), cost = O.projectCost(p.id), inc = O.projectIncome(p.id);
    const units = S.all('properties').filter((u) => u.project === p.id), team = S.all('contractors').filter((x) => x.project === p.id);
    const mats = S.all('stockmoves').filter((x) => x.type === 'out' && x.project === p.id).sort(byDate);
    return {
      title: p.name, back: '#/m/projects', badge: p.status,
      chips: [{ l: 'الميزانية', v: p.budget }, { l: 'المصروف', v: cost, tone: p.budget && cost > p.budget ? 'red' : 'orange' }, { l: 'المتبقي من الميزانية', v: (+p.budget || 0) - cost }, { l: 'المحصل من العملاء', v: inc, tone: 'green' }],
      secs: [
        { h: 'البيانات', html: info([['النوع', p.type], ['الموقع', p.location], ['المالك / الجهة', p.client], ['البدء', p.start && fdate(p.start)], ['التسليم المتوقع', p.end && fdate(p.end)], ['نسبة الإنجاز', p.progress != null && p.progress !== '' ? fmt(p.progress) + '%' : '']]) },
        { h: `حركة الخزنة على المشروع (${list.length})`, html: trTable(list, 'مفيش حركة خزنة على المشروع ده.') },
        { h: `خامات مصروفة من المخزن (${mats.length})`, html: tbl(['التاريخ', 'الصنف', 'الكمية', 'ملاحظات'], mats.map((x) => [fdate(x.date), x.item, { h: fmt(x.qty) + ' ' + esc(x.unit || ''), c: 'num' }, x.note || '']), 'لسه ما اتصرفش خامات للمشروع.') },
        { h: `الوحدات (${units.length})`, html: units.length ? `<div class="links">${units.map((u) => lk('#/d/properties/' + u.id, O.unitLabel(u) + ' (' + u.status + ')')).join('')}</div>` : '<p class="mut">مفيش وحدات مسجلة.</p>' },
        { h: `المقاولين والصنايعية (${team.length})`, html: team.length ? `<div class="links">${team.map((x) => lk('#/d/contractors/' + x.id, x.name + ' - ' + (x.trade || ''))).join('')}</div>` : '<p class="mut">مفيش.</p>' },
        noteSec(p.note)
      ],
      acts: [{ l: 'مصروف على المشروع', cls: 'primary', fn: () => V.treasuryForm({ type: 'out', project: p.id }, route) }, editAct('projects', p), delAct('projects', p)]
    };
  };

  D.properties = (p) => {
    const c = O.contractOfUnit(p.id);
    return {
      title: O.unitLabel(p), back: '#/m/properties', badge: p.status,
      chips: [{ l: 'سعر البيع', v: p.price }, { l: 'التكلفة علينا', v: p.cost }, { l: 'الربح المتوقع', v: (+p.price || 0) - (+p.cost || 0), tone: 'green' }].concat(c ? [{ l: 'المحصل من العميل', v: O.ctPaid(c), tone: 'green' }, { l: 'المتبقي على العميل', v: O.ctRem(c), tone: 'orange' }] : []),
      secs: [
        { h: 'بيانات الوحدة', html: info([['المشروع', O.refName('projects', p.project)], ['النوع', p.kind], ['الدور', p.floor], ['المساحة', p.area && fmt(p.area) + ' م²']]) },
        { h: 'المشتري', html: c ? `<p>${lk('#/d/contracts/' + c.id, c.name)} — ${esc(O.ctState(c))}. افتح صفحة العميل لكل التحصيلات والأقساط.</p>` : '<p class="mut">الوحدة لسه ما اتباعتش.</p>' },
        noteSec(p.note)
      ],
      acts: [].concat(c ? [{ l: 'فتح العميل', cls: 'primary', fn: () => go('#/d/contracts/' + c.id) }] : [{ l: 'تسجيل بيع لعميل', cls: 'primary', fn: () => go('#/contract/new/' + p.id) }], [editAct('properties', p), delAct('properties', p)])
    };
  };

  D.treasury = (t) => {
    const mem = t.member && S.get('contractors', t.member), sup = t.supplier && S.get('suppliers', t.supplier), ct = t.contract && S.get('contracts', t.contract);
    return {
      title: t.cat + (t.party ? ' - ' + t.party : ''), back: '#/m/treasury', badge: t.type === 'in' ? 'وارد' : 'صادر',
      chips: [{ l: t.type === 'in' ? 'وارد' : 'صادر', v: t.amount, tone: t.type === 'in' ? 'green' : 'orange' }, { l: 'التاريخ', s: fdate(t.date) }],
      secs: [
        { h: 'التفاصيل', html: info([['البند', t.cat], ['من / إلى', t.party], ['المشروع', O.refName('projects', t.project)], ['تاريخ التسجيل', t.created && fdate(new Date(t.created).toISOString().slice(0, 10))]]) + (mem ? `<p>${lk('#/d/contractors/' + mem.id, 'كشف حساب ' + mem.name)}</p>` : '') + (sup ? `<p>${lk('#/d/suppliers/' + sup.id, 'كشف حساب ' + sup.name)}</p>` : '') + (ct ? `<p>${lk('#/d/contracts/' + ct.id, 'صفحة العميل ' + ct.name)}</p>` : '') },
        noteSec(t.note),
        t.auto ? { h: 'تنبيه', html: '<p class="mut">الحركة دي اتسجلت تلقائي من تحصيل قسط. لتعديلها أو حذفها افتح صفحة العميل.</p>' } : null
      ],
      acts: t.auto ? [] : [editAct('treasury', t), delAct('treasury', t)]
    };
  };

  D.stockmoves = (x) => {
    const sup = x.supplier && S.get('suppliers', x.supplier);
    return {
      title: x.item, back: '#/m/stockmoves', badge: x.type === 'in' ? 'وارد' : 'صادر',
      chips: [{ l: x.type === 'in' ? 'وارد' : 'صادر', s: fmt(x.qty) + ' ' + (x.unit || ''), tone: x.type === 'in' ? 'green' : 'orange' }].concat(+x.price ? [{ l: 'سعر الوحدة', v: x.price }, { l: 'القيمة', v: x.qty * x.price }] : []),
      secs: [
        { h: 'التفاصيل', html: info([['التاريخ', fdate(x.date)], ['المورد', sup && sup.name], ['صُرف لمشروع', O.refName('projects', x.project)]]) + `<p>${lk('#/d/stock/' + encodeURIComponent(x.item), 'كل حركات ' + x.item)}</p>` },
        noteSec(x.note)
      ],
      acts: [editAct('stockmoves', x), delAct('stockmoves', x)]
    };
  };

  D.stock = (name) => {
    const r = O.stockMap()[norm(name)];
    if (!r) return null;
    const mv = S.all('stockmoves').filter((x) => norm(x.item) === norm(name)).sort(byDate);
    let bal = 0;
    const rows = mv.map((x) => { bal += x.type === 'in' ? +x.qty : -x.qty; return [fdate(x.date), x.type === 'in' ? 'وارد' : 'صادر', { h: fmt(x.qty) + ' ' + esc(x.unit || ''), c: 'num ' + (x.type === 'in' ? 'g' : 'o') }, { h: +x.price ? fmt(x.price) : '', c: 'num' }, x.type === 'in' ? O.refName('suppliers', x.supplier) : O.refName('projects', x.project), x.note || '', { h: fmt(bal) + ' ' + esc(r.unit || ''), c: 'num' }, { h: `<a class="lk" href="#/d/stockmoves/${x.id}">فتح</a>`, c: 'ra' }]; });
    const low = r.min > 0 && r.qty <= r.min;
    return {
      title: r.name, back: '#/stock', badge: low ? 'منخفض' : '',
      chips: [{ l: 'الرصيد', s: fmt(r.qty) + ' ' + (r.unit || ''), tone: low ? 'red' : 'green' }, { l: 'إجمالي الوارد', s: fmt(r.inQty) + ' ' + (r.unit || '') }, { l: 'قيمة المخزون', v: r.value }].concat(r.min ? [{ l: 'حد التنبيه', s: fmt(r.min) }] : []),
      secs: [{ h: `كل الحركات (${mv.length})`, html: tbl(['التاريخ', 'النوع', 'الكمية', 'السعر', 'المورد / المشروع', 'ملاحظات', 'الرصيد', ''], rows, 'مفيش حركات.') }],
      acts: [{ l: 'وارد +', cls: 'primary', fn: () => V.stockForm('in', { item: r.name, unit: r.unit }) }, { l: 'صادر −', fn: () => V.stockForm('out', { item: r.name, unit: r.unit }) }]
    };
  };

  /* ================= إيصال استلام نقدية (مقدم / قسط) ================= */
  function receiptPage(cid, pid) {
    const c = S.get('contracts', cid);
    if (!c) { go('#/m/contracts'); return; }
    if ((c.insts || []).some((i) => !Array.isArray(i.pays) || i.pays.some((p) => !p.no))) { c.insts.forEach(O.normInst); S.put('contracts', c); }
    let inst = null, pay = null;
    const all = [];
    c.insts.forEach((i) => i.pays.forEach((p) => { all.push(p); if (p.id === pid) { inst = i; pay = p; } }));
    if (!pay) { go('#/d/contracts/' + cid); return; }
    const m = S.meta(), u = S.get('properties', c.unit), cc = cur();
    const total = +c.total || sum(c.insts, (i) => i.amount);
    const upto = sum(all.filter((p) => String(p.date) < String(pay.date) || (p.date === pay.date && p.no <= pay.no)), (p) => p.amount);
    const rem = Math.max(0, total - upto), down = inst.label === 'المقدم';
    const cents = Math.round((pay.amount % 1) * 100);
    const words = O.tafqeet(pay.amount) + ' ' + cc + (cents ? ' و' + O.tafqeet(cents) + ' قرش' : '') + ' فقط لا غير';
    const row = (l, v) => `<div class="rr2"><span>${esc(l)}</span><b>${v}</b></div>`;
    root().innerHTML = `${top('إيصال استلام نقدية', { back: '#/d/contracts/' + cid, actions: `<button class="btn" id="wa">إرسال واتساب</button><button class="btn primary" id="pr">طباعة</button>` })}
    <main class="wrap inner"><article class="rcpt" id="rcpt">
      <header><div><strong>${esc(m.company || 'عمران')}</strong><small>إدارة العقارات والمقاولات</small></div><div class="rno">رقم الإيصال<b>${pay.no}</b></div></header>
      <h2>إيصال استلام نقدية — ${down ? 'مقدم حجز' : 'قسط'}</h2>
      ${row('التاريخ', fdate(pay.date))}
      ${row('استلمنا من السيد / السيدة', esc(c.name))}
      <div class="amtbox"><b dir="ltr">${fmt(pay.amount)}</b><span>${esc(cc)}</span></div>
      ${row('مبلغ وقدره (كتابةً)', esc(words))}
      ${row('وذلك عن', esc(inst.label) + (u ? ' — ' + esc(O.unitLabel(u, true)) : ''))}
      ${pay.note ? row('ملاحظات', esc(pay.note)) : ''}
      <div class="rsum"><span>إجمالي العقد <b>${fmt(total)}</b></span><span>إجمالي المحصل حتى تاريخه <b>${fmt(upto)}</b></span><span>المتبقي على العميل <b>${fmt(rem)}</b></span></div>
      <footer><div><small>المستلم</small><i></i></div><div><small>العميل</small><i></i></div><div class="stamp"><small>الختم</small></div></footer>
    </article><p class="mut noprint rhint">الإيصال بيتطبع على ورقة A4 أو A5. لو اخترت «حفظ كـ PDF» من نافذة الطباعة هتقدر تبعته للعميل.</p></main>`;
    root().onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.id === 'pr') w.print();
      if (b.id === 'wa') {
        const link = H.waLink(c.phone, `إيصال استلام نقدية رقم ${pay.no}\nاستلمنا من أ/ ${c.name} مبلغ ${fmt(pay.amount)} ${cc} (${words})\nعن: ${inst.label}${u ? ' - ' + O.unitLabel(u, true) : ''}\nبتاريخ ${fdate(pay.date)}\nالمتبقي على حضرتك: ${fmt(rem)} ${cc}\n${m.company || 'عمران'}`);
        if (!link) { toast('ضيف رقم تليفون العميل الأول', 'warn'); return; }
        w.open(link, '_blank');
      }
    };
  }

  function detailPage(key, id) {
    let d = null;
    try { d = key === 'stock' ? D.stock(decodeURIComponent(id)) : (S.get(key, id) ? D[key](S.get(key, id)) : null); } catch (e) { console.error(e); }
    if (!d) { go(key === 'stock' ? '#/stock' : '#/m/' + key); return; }
    const secs = d.secs.filter(Boolean);
    root().innerHTML = `${top(d.title, { back: d.back })}<main class="wrap inner">${d.badge ? `<div class="dbadge">${badge(d.badge)}</div>` : ''}${chips(d.chips)}<div class="row-actions dacts noprint">${d.acts.map((a, i) => `<button class="btn ${a.cls || ''}" data-act="${i}">${esc(a.l)}</button>`).join('')}</div>${secs.map((s) => `<section class="panel pad"><h3>${esc(s.h)}</h3>${s.html}</section>`).join('')}</main>`;
    root().onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.act != null) d.acts[+b.dataset.act].fn();
      else if (b.dataset.openf != null) viewFile(d.files[+b.dataset.openf]);
      else if (d.click) d.click(b);
    };
  }

  /* ================= المخزن (الأرصدة) ================= */
  function stockPage() {
    const map = O.stockMap(), list = Object.values(map).sort((a, b) => a.name.localeCompare(b.name, 'ar'));
    const low = list.filter((r) => r.min > 0 && r.qty <= r.min);
    root().innerHTML = `${top('المخزن', { actions: '<a class="btn" href="#/m/stockmoves">سجل الحركة</a><button class="btn" data-sm="out">صادر −</button><button class="btn primary" data-sm="in">وارد +</button>' })}
    <main class="wrap inner">${list.length ? chips([{ l: 'عدد الأصناف', s: list.length }, { l: 'قيمة المخزون (تقريبية)', v: sum(list, (r) => r.value) }, { l: 'أصناف تحت الحد', s: low.length, tone: low.length ? 'red' : '' }]) : ''}
    <div class="list">${list.length ? list.map((r, i) => { const lw = r.min > 0 && r.qty <= r.min; return `<article class="item" data-i="${i}"><span class="dot ${lw ? 'orange' : 'green'}"></span><div class="ibody"><h3>${esc(r.name)}</h3><div class="meta">${r.avg ? `<span>متوسط السعر ${fmt(r.avg)}</span>` : ''}${r.min ? `<span>حد التنبيه ${fmt(r.min)} ${esc(r.unit || '')}</span>` : ''}</div><div class="acts"><button class="lnk" data-in>وارد</button><button class="lnk" data-out>صادر</button><button class="lnk" data-min>حد التنبيه</button></div></div><div class="iamts">${lw ? badge('منخفض') : ''}<div class="amt ${lw ? 'red' : ''}"><small>الرصيد</small><b>${fmt(r.qty)} ${esc(r.unit || '')}</b></div>${r.value ? `<div class="amt"><small>القيمة</small><b>${fmt(r.value)} <i>${esc(cur())}</i></b></div>` : ''}</div></article>`; }).join('') : `<div class="empty">${O.badgeIcon('stock')}<p>المخزن فاضي. سجّل أول وارد خامات (حديد، أسمنت، رمل...) وبعدها كل صرف بتسجله بيخصم من الرصيد لوحده.</p><button class="btn primary" data-sm="in">وارد +</button></div>`}</div></main>`;
    root().onclick = async (e) => {
      const b = e.target.closest('button');
      if (!b) { const c = e.target.closest('.item'); if (c) go('#/d/stock/' + encodeURIComponent(list[+c.dataset.i].name)); return; }
      if (b.dataset.sm) { V.stockForm(b.dataset.sm); return; }
      const r = list[+b.closest('.item').dataset.i];
      if (b.hasAttribute('data-in')) V.stockForm('in', { item: r.name, unit: r.unit });
      if (b.hasAttribute('data-out')) V.stockForm('out', { item: r.name, unit: r.unit });
      if (b.hasAttribute('data-min')) {
        const v = await ask('حد التنبيه: ' + r.name, 'نبّهني لما الرصيد يوصل لـ (' + (r.unit || 'وحدة') + ')', r.min || '', 'اكتب 0 لإلغاء التنبيه.');
        if (v == null) return;
        const it = S.all('stockitems').find((x) => norm(x.name) === norm(r.name));
        S.put('stockitems', Object.assign(it || { name: r.name, unit: r.unit }, { min: toNum(v) }));
        toast('تم الحفظ'); stockPage();
      }
    };
  }

  /* ================= الرسوم البيانية ================= */
  function barsSVG(labels, a, b) {
    const W = 560, Hh = 220, pad = 28, max = Math.max(1, ...a, ...b), bw = 22, gap = (W - pad * 2) / labels.length;
    const y = (v) => Hh - 34 - (v / max) * (Hh - 60);
    return `<svg viewBox="0 0 ${W} ${Hh}" class="chart" role="img" aria-label="الوارد والصادر خلال آخر ستة أشهر">${[0, 0.5, 1].map((k) => `<line x1="${pad}" x2="${W - pad}" y1="${y(max * k)}" y2="${y(max * k)}" stroke="var(--line)" stroke-dasharray="3 4"/><text x="${W - pad + 4}" y="${y(max * k) + 4}" fill="var(--mut)" font-size="10">${k ? fmt(Math.round(max * k / 1000)) + 'k' : '0'}</text>`).join('')}${labels.map((l, i) => { const cx = W - pad - gap * (i + 0.5); return `<rect x="${cx - bw - 2}" y="${y(a[i])}" width="${bw}" height="${Hh - 34 - y(a[i])}" rx="4" fill="var(--green)" style="--d:${i}"><title>وارد ${fmt(a[i])}</title></rect><rect x="${cx + 2}" y="${y(b[i])}" width="${bw}" height="${Hh - 34 - y(b[i])}" rx="4" fill="var(--orange)" style="--d:${i}"><title>صادر ${fmt(b[i])}</title></rect><text x="${cx}" y="${Hh - 12}" text-anchor="middle" fill="var(--mut)" font-size="11">${l}</text>`; }).join('')}</svg>`;
  }
  function hbars(items, color) {
    const max = Math.max(1, ...items.map((i) => i.v));
    return items.length ? `<div class="hb">${items.map((i) => `<div class="hr"><span class="hl">${esc(i.l)}</span><span class="ht"><i style="width:${Math.max(2, (i.v / max) * 100)}%;background:${color || 'var(--blue)'}"></i></span><b>${fmt(i.v)}</b></div>`).join('')}</div>` : '<p class="mut">لا توجد بيانات كافية بعد.</p>';
  }

  /* ================= التقارير ================= */
  function reportsPage() {
    let per = 'month';
    const range = () => {
      const t = today();
      return per === 'today' ? [t, t] : per === 'week' ? [addDays(-6), t] : per === 'month' ? [t.slice(0, 7) + '-01', t] : per === 'year' ? [t.slice(0, 4) + '-01-01', t] : ['0000-00-00', '9999-99-99'];
    };
    root().innerHTML = `${top('التقارير', { actions: `<a class="btn" href="#/calc">${ICON.calc}<span>حاسبة الاستثمار</span></a><button class="btn noprint" id="csv">${ICON.csv}<span>تصدير Excel</span></button><button class="btn noprint" onclick="window.print()">${ICON.print}<span>طباعة</span></button>` })}
    <main class="wrap inner"><div id="due"></div><div class="tabs noprint" role="tablist">${[['today', 'اليوم'], ['week', 'آخر 7 أيام'], ['month', 'هذا الشهر'], ['year', 'هذه السنة'], ['all', 'الكل']].map(([k, l]) => `<button role="tab" data-p="${k}" class="${k === per ? 'on' : ''}">${l}</button>`).join('')}</div><div id="rep"></div></main>`;

    // الأقساط (ثابتة مش مرتبطة بالفترة)
    const t = today(), rows = [];
    S.all('contracts').filter((c) => c.status !== 'ملغي').forEach((c) => O.unpaid(c).forEach((i) => rows.push({ c, i })));
    const od = rows.filter((r) => r.i.due < t), s7 = rows.filter((r) => r.i.due >= t && r.i.due <= addDays(7)), s30 = rows.filter((r) => r.i.due >= t && r.i.due <= addDays(30));
    const near = rows.filter((r) => r.i.due <= addDays(30)).sort((a, b) => a.i.due.localeCompare(b.i.due)).slice(0, 40);
    $('#due').innerHTML = `<section class="panel pad"><h3>الأقساط</h3>${chips([{ l: 'متأخر', v: sum(od, (r) => O.instRem(r.i)), tone: od.length ? 'red' : '' }, { l: 'خلال 7 أيام', v: sum(s7, (r) => O.instRem(r.i)), tone: 'orange' }, { l: 'خلال 30 يوم', v: sum(s30, (r) => O.instRem(r.i)) }, { l: 'إجمالي المتبقي عند العملاء', v: sum(rows, (r) => O.instRem(r.i)) }])}${near.length ? `<div class="tblw"><table class="tbl"><thead><tr><th>العميل</th><th>البند</th><th>الاستحقاق</th><th>المبلغ</th><th>الحالة</th></tr></thead><tbody>${near.map((r) => `<tr><td><a class="lk" href="#/d/contracts/${r.c.id}">${esc(r.c.name)}</a></td><td>${esc(r.i.label)}</td><td>${fdate(r.i.due)}</td><td class="num">${fmt(O.instRem(r.i))}</td><td>${badge(O.instState(r.i))}</td></tr>`).join('')}</tbody></table></div>` : '<p class="mut">مفيش أقساط متأخرة أو مستحقة خلال 30 يوم.</p>'}</section>`;

    let curRows = [];
    const draw = () => {
      const [a, b] = range(), all = S.all('treasury').slice().sort((x, y) => String(y.date).localeCompare(String(x.date)));
      curRows = all.filter((f) => f.date >= a && f.date <= b);
      const ins = sum(curRows.filter((f) => f.type === 'in'), (f) => f.amount), outs = sum(curRows.filter((f) => f.type === 'out'), (f) => f.amount);
      const grp = (type) => { const g = {}; curRows.filter((f) => f.type === type).forEach((f) => { g[f.cat] = (g[f.cat] || 0) + f.amount; }); return Object.entries(g).map(([l, v]) => ({ l, v })).sort((x, y) => y.v - x.v); };
      const months = [], now = new Date();
      for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push({ k: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), l: H.MONTHS[d.getMonth()] }); }
      const mi = months.map((m) => sum(all.filter((f) => f.type === 'in' && String(f.date).slice(0, 7) === m.k), (f) => f.amount)), mo = months.map((m) => sum(all.filter((f) => f.type === 'out' && String(f.date).slice(0, 7) === m.k), (f) => f.amount));
      const prj = S.all('projects');
      $('#rep').innerHTML = `${chips([{ l: 'وارد', v: ins, tone: 'green' }, { l: 'صادر', v: outs, tone: 'orange' }, { l: 'الصافي', v: ins - outs, tone: ins - outs >= 0 ? 'green' : 'red' }, { l: 'رصيد الخزنة الآن', v: O.balance() }])}
      <div class="charts"><section class="panel pad span2"><h3>الوارد والصادر خلال آخر 6 شهور</h3>${barsSVG(months.map((m) => m.l), mi, mo)}<div class="legend"><span><i style="background:var(--green)"></i>وارد</span><span><i style="background:var(--orange)"></i>صادر</span></div></section>
      <section class="panel pad"><h3>الوارد حسب البند</h3>${hbars(grp('in'), 'var(--green)')}</section><section class="panel pad"><h3>الصادر حسب البند</h3>${hbars(grp('out'), 'var(--orange)')}</section></div>
      <section class="panel pad"><h3>المشاريع</h3>${prj.length ? `<div class="tblw"><table class="tbl"><thead><tr><th>المشروع</th><th>الميزانية</th><th>المصروف</th><th>المحصل من العملاء</th><th>الصافي</th></tr></thead><tbody>${prj.map((p) => { const c = O.projectCost(p.id), r = O.projectIncome(p.id); return `<tr><td>${esc(p.name)}</td><td class="num">${fmt(p.budget)}</td><td class="num">${fmt(c)}</td><td class="num g">${fmt(r)}</td><td class="num ${r - c >= 0 ? 'g' : 'r'}">${fmt(r - c)}</td></tr>`; }).join('')}</tbody></table></div>` : '<p class="mut">لا توجد مشاريع.</p>'}</section>
      <section class="panel pad"><h3>حركة الخزنة</h3>${curRows.length ? `<div class="tblw"><table class="tbl"><thead><tr><th>التاريخ</th><th>البيان</th><th>البند</th><th>وارد</th><th>صادر</th></tr></thead><tbody>${curRows.slice(0, 300).map((f) => `<tr><td>${fdate(f.date)}</td><td>${esc(f.party || f.note || '')}</td><td>${esc(f.cat)}</td><td class="num g">${f.type === 'in' ? fmt(f.amount) : ''}</td><td class="num o">${f.type === 'out' ? fmt(f.amount) : ''}</td></tr>`).join('')}</tbody></table></div>` : '<p class="mut">لا توجد حركة في هذه الفترة.</p>'}</section>`;
    };
    root().onclick = (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.dataset.p) { per = b.dataset.p; root().querySelectorAll('[data-p]').forEach((x) => x.classList.toggle('on', x === b)); draw(); }
      if (b.id === 'csv') {
        const rws = [['التاريخ', 'البيان', 'البند', 'وارد', 'صادر']].concat(curRows.map((f) => [f.date, f.party || f.note || '', f.cat, f.type === 'in' ? f.amount : '', f.type === 'out' ? f.amount : '']));
        const csv = '﻿' + rws.map((r) => r.map((c) => '"' + String(c).replace(/"/g, '""') + '"').join(',')).join('\n');
        const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'omran-report-' + today() + '.csv'; document.body.appendChild(a); a.click(); a.remove();
      }
    };
    draw();
  }

  /* ================= حاسبة الاستثمار والكميات ================= */
  function calcPage() {
    const field = (id, l, def, hint) => `<label class="fld"><span>${l}</span><input id="${id}" inputmode="decimal" value="${def == null ? '' : def}">${hint ? `<small class="mut">${hint}</small>` : ''}</label>`;
    const tabs = [['flip', 'شراء وتطوير ثم بيع'], ['rent', 'استثمار للإيجار'], ['qty', 'كميات تقريبية']];
    root().innerHTML = `${top('حاسبة الاستثمار', { back: '#/reports' })}<main class="wrap inner"><div class="tabs" role="tablist">${tabs.map(([k, l]) => `<button role="tab" data-t="${k}">${l}</button>`).join('')}</div><div id="cb"></div></main>`;
    const forms = {
      flip: () => `<div class="calc"><section class="panel pad"><div class="fgrid">${field('buy', 'سعر شراء الأرض / العقار', '')}${field('fees', 'مصاريف الشراء والتسجيل', '')}${field('dev', 'تكلفة البناء / التطوير', '')}${field('oth', 'مصاريف أخرى (تمويل، إدارة...)', '')}${field('mon', 'مدة المشروع (شهور)', 12)}${field('sale', 'سعر البيع المتوقع', '')}${field('comm', 'عمولة البيع %', 0)}${field('area', 'المساحة القابلة للبيع (م²) - اختياري', '')}</div></section><section class="panel pad res" id="res"></section></div>`,
      rent: () => `<div class="calc"><section class="panel pad"><div class="fgrid">${field('buy', 'سعر الشراء', '')}${field('fix', 'تكلفة التجهيز والتشطيب', '')}${field('rent', 'الإيجار الشهري المتوقع', '')}${field('vac', 'شهور شاغرة في السنة', 0)}${field('exp', 'مصاريف سنوية (صيانة، ضرائب، إدارة)', '')}${field('gro', 'زيادة الإيجار السنوية % - اختياري', 0)}</div></section><section class="panel pad res" id="res"></section></div>`,
      qty: () => `<div class="calc"><section class="panel pad"><div class="fgrid">${field('area', 'إجمالي مسطحات البناء (م²)', '')}${field('cr', 'م³ خرسانة لكل م² مسطح', 0.25, 'تقدير للهيكل الخرساني')}${field('st', 'كجم حديد لكل م³ خرسانة', 100, '')}${field('ce', 'شكاير أسمنت (50 كجم) لكل م³', 7, '')}${field('sa', 'م³ رمل لكل م³ خرسانة', 0.4, '')}${field('gr', 'م³ زلط لكل م³ خرسانة', 0.8, '')}</div><p class="mut">أرقام أولية للهيكل الخرساني فقط، وبتختلف حسب التصميم والمهندس الإنشائي. عدّل النسب حسب مشروعك.</p></section><section class="panel pad res" id="res"></section></div>`
    };
    const row = (l, v, tone) => `<div class="rr ${tone || ''}"><span>${l}</span><b>${v}</b></div>`, c = cur();
    const g = (id) => toNum($('#' + id).value);
    const calc = {
      flip() {
        const cost = g('buy') + g('fees') + g('dev') + g('oth'), net = g('sale') * (1 - g('comm') / 100), profit = net - cost;
        if (!cost || !g('sale')) return '<p class="mut">اكتب التكلفة وسعر البيع لتظهر النتيجة.</p>';
        const roi = (profit / cost) * 100, mon = g('mon');
        return row('إجمالي التكلفة', fmt(cost) + ' ' + c) + row('صافي البيع بعد العمولة', fmt(net) + ' ' + c) + row('صافي الربح', fmt(profit) + ' ' + c, profit >= 0 ? 'good' : 'bad') + row('العائد على الاستثمار', fmt(roi) + '%', roi >= 0 ? 'good' : 'bad') + (mon > 0 ? row('العائد السنوي المعدّل', fmt((roi * 12) / mon) + '%') : '') + row('هامش الربح من سعر البيع', fmt((profit / g('sale')) * 100) + '%') + row('سعر التعادل', fmt(cost / (1 - g('comm') / 100)) + ' ' + c) + (g('area') > 0 ? row('تكلفة المتر', fmt(cost / g('area')) + ' ' + c) + row('سعر البيع للمتر', fmt(g('sale') / g('area')) + ' ' + c) : '');
      },
      rent() {
        const inv = g('buy') + g('fix'), gross = g('rent') * Math.max(0, 12 - g('vac')), net = gross - g('exp');
        if (!inv || !g('rent')) return '<p class="mut">اكتب سعر الشراء والإيجار الشهري لتظهر النتيجة.</p>';
        let pb = null, acc = 0, r = gross;
        for (let y = 1; y <= 50; y++) { acc += r - g('exp'); if (acc >= inv) { pb = y - (acc - inv) / (r - g('exp')); break; } r *= 1 + g('gro') / 100; }
        return row('إجمالي الاستثمار', fmt(inv) + ' ' + c) + row('دخل الإيجار السنوي', fmt(gross) + ' ' + c) + row('صافي الدخل السنوي', fmt(net) + ' ' + c, net >= 0 ? 'good' : 'bad') + row('العائد الإيجاري الإجمالي', fmt((gross / inv) * 100) + '%') + row('العائد الإيجاري الصافي', fmt((net / inv) * 100) + '%', net > 0 ? 'good' : 'bad') + row('مدة استرداد رأس المال', pb ? fmt(Math.round(pb * 10) / 10) + ' سنة' : 'أكثر من 50 سنة');
      },
      qty() {
        const cc = g('area') * g('cr');
        if (!cc) return '<p class="mut">اكتب مساحة البناء لتظهر الكميات.</p>';
        return row('الخرسانة', fmt(cc) + ' م³') + row('حديد التسليح', fmt((cc * g('st')) / 1000) + ' طن') + row('الأسمنت', fmt(cc * g('ce')) + ' شكارة (' + fmt((cc * g('ce') * 50) / 1000) + ' طن)') + row('الرمل', fmt(cc * g('sa')) + ' م³') + row('الزلط', fmt(cc * g('gr')) + ' م³');
      }
    };
    const show = (k) => {
      root().querySelectorAll('[data-t]').forEach((b) => b.classList.toggle('on', b.dataset.t === k));
      $('#cb').innerHTML = forms[k]();
      const up = () => { $('#res').innerHTML = calc[k](); };
      $('#cb').oninput = up; up();
    };
    root().onclick = (e) => { const b = e.target.closest('[data-t]'); if (b) show(b.dataset.t); };
    show('flip');
  }

  /* ================= التنبيهات ================= */
  const emptyAlerts = () => `<div class="empty small"><p>مفيش تنبيهات حالياً. أول ما تسجل عميل وتحدد له جدول أقساط، التنبيهات هتظهر هنا لوحدها قبل كل ميعاد.</p></div>`;
  function alertsPage() {
    const al = O.alerts();
    root().innerHTML = `${top('التنبيهات')}<main class="wrap inner"><section class="panel pad alerts">${al.length ? `<div class="alist">${al.map((a) => `<a class="arow" href="${a.to}"><span class="dot ${a.tone}"></span><span>${esc(a.text)}</span></a>`).join('')}</div>` : emptyAlerts()}</section></main>`;
  }

  /* ================= الإعدادات والنسخ الاحتياطي ================= */
  async function downloadBackup() {
    const txt = await S.exportFull();
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([txt], { type: 'application/json' }));
    a.download = 'omran-backup-' + today() + '.json';
    document.body.appendChild(a); a.click(); a.remove();
    S.setMeta({ lastBackup: Date.now() });
  }
  function settingsPage() {
    const m = S.meta();
    root().innerHTML = `${top('الإعدادات')}<main class="wrap inner">
      <section class="panel pad"><h3>الشركة والتنبيهات</h3><div class="fgrid cols3"><label class="fld"><span>اسم الشركة</span><input id="company" value="${esc(m.company)}"></label><label class="fld"><span>العملة</span><input id="currency" value="${esc(m.currency)}"></label><label class="fld"><span>نبّهني قبل ميعاد القسط بكام يوم</span><input id="alertDays" inputmode="numeric" value="${esc(m.alertDays || 7)}"></label></div><div class="row-actions"><button class="btn primary" id="saveS">حفظ الإعدادات</button></div></section>
      <section class="panel pad"><h3>النسخ الاحتياطي</h3><p class="mut">كل بياناتك وملفات العقود محفوظة على الجهاز ده فقط داخل المتصفح. حمّل نسخة احتياطية بشكل منتظم، وارفعها لو غيّرت الجهاز أو المتصفح.${m.lastBackup ? ' آخر نسخة: ' + new Date(m.lastBackup).toLocaleDateString('ar-EG') : ''}</p><div class="row-actions"><button class="btn primary" id="bk">${ICON.download}<span>تحميل نسخة احتياطية</span></button><label class="btn">رفع نسخة احتياطية<input type="file" id="rs" accept="application/json,.json" hidden></label></div></section>
      <section class="panel pad"><h3>بيانات تجريبية</h3><p class="mut">حمّل بيانات تجريبية لتجربة البرنامج، وتقدر تحذفها بعدين من غير ما تأثر على بياناتك الحقيقية.</p><div class="row-actions"><button class="btn" id="demo">تحميل بيانات تجريبية</button><button class="btn" id="undemo">حذف البيانات التجريبية فقط</button></div></section>
      <section class="panel pad" id="devsec"></section>
      <section class="panel pad"><h3>مسح كل البيانات</h3><p class="mut">يحذف كل السجلات وملفات العقود من هذا المتصفح نهائياً. حمّل نسخة احتياطية قبل ما تكمل.</p><div class="row-actions"><button class="btn danger" id="wipe">مسح كل البيانات</button></div></section></main>`;
    O.License.mountDev($('#devsec'));
    root().onclick = async (e) => {
      const b = e.target.closest('button');
      if (!b) return;
      if (b.id === 'saveS') { S.setMeta({ company: $('#company').value.trim(), currency: $('#currency').value.trim() || 'جنيه', alertDays: Math.max(0, Math.round(toNum($('#alertDays').value))) || 7 }); toast('تم حفظ الإعدادات'); }
      if (b.id === 'bk') { await downloadBackup(); toast('تم تحميل النسخة الاحتياطية'); settingsPage(); }
      if (b.id === 'demo') { O.loadDemo(); toast('تم تحميل البيانات التجريبية'); }
      if (b.id === 'undemo') { S.purgeDemo(); FS.gc(); toast('تم حذف البيانات التجريبية'); }
      if (b.id === 'wipe' && await confirmBox('مسح كل البيانات وملفات العقود نهائياً؟ هذا الإجراء لا يمكن التراجع عنه.', 'مسح الكل')) { S.reset(); try { await FS.clear(); } catch (err) { /* لا شيء */ } toast('تم مسح البيانات'); go('#/'); }
    };
    $('#rs').onchange = (e) => {
      const f = e.target.files[0];
      if (!f) return;
      const r = new FileReader();
      r.onload = async () => { if (await confirmBox('استبدال كل البيانات الحالية بمحتوى النسخة الاحتياطية؟', 'استبدال')) { try { await S.importFull(String(r.result)); toast('تم استرجاع النسخة'); go('#/'); route(); } catch (err) { toast('الملف غير صالح', 'warn'); } } };
      r.readAsText(f);
    };
  }

  /* ================= الإطار: القائمة الجانبية + الحركة ================= */
  const RM = () => w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const HOME_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path class="f" d="M4 11l8-6.5L20 11v9H4z"/><path d="M3 11.5L12 4l9 7.5M5.5 10v10h13v-10M10 20v-5h4v5"/></svg>';
  const NAV = [['home', 'الرئيسية', '#/'], ['contracts', 'العملاء والعقود', '#/m/contracts'], ['properties', 'الوحدات والعقارات', '#/m/properties'], ['projects', 'المشاريع', '#/m/projects'], ['treasury', 'الخزنة', '#/m/treasury'], ['stock', 'المخزن', '#/stock'], ['team', 'المقاولين والمهندسين', '#/m/contractors'], ['suppliers', 'الموردين', '#/m/suppliers'], ['reports', 'التقارير', '#/reports']];
  const KEYNAV = { contracts: 'contracts', properties: 'properties', projects: 'projects', treasury: 'treasury', stockmoves: 'stock', stock: 'stock', contractors: 'team', suppliers: 'suppliers' };
  function activeNav() {
    const p = (location.hash || '#/').replace(/^#\/?/, '').split('/');
    if (!p[0]) return 'home';
    if (p[0] === 'm' || p[0] === 'd') return KEYNAV[p[1]] || 'home';
    if (p[0] === 'contract' || p[0] === 'receipt') return 'contracts';
    if (p[0] === 'stock') return 'stock';
    if (p[0] === 'reports' || p[0] === 'calc') return 'reports';
    return p[0] === 'alerts' || p[0] === 'settings' ? p[0] : 'home';
  }
  let sbBound = false;
  function updateShell() {
    const side = document.getElementById('side'), shell = document.getElementById('shell');
    if (!side) return;
    const m = S.meta();
    if (!side.firstElementChild) {
      side.innerHTML = `<div class="sb-brand">${O.BRAND}<div><strong></strong><small>إدارة العقارات والمقاولات</small></div><button class="sb-tg" data-sb="tg" aria-label="طي القائمة">${ICON.back}</button></div>
      <nav class="sbn" aria-label="الأقسام"><span class="mark" aria-hidden="true"></span>${NAV.map(([k, l, h]) => `<a class="nv" href="${h}" data-k="${k}" title="${l}">${k === 'home' ? `<span class="ti h-blue">${HOME_SVG}</span>` : O.badgeIcon(k)}<span class="nl">${l}</span><span class="nb" data-bd="${k}" hidden></span></a>`).join('')}</nav>
      <div class="sb-foot"><a class="sbi bellr" href="#/alerts" data-k="alerts" title="التنبيهات" aria-label="التنبيهات">${ICON.bell}<i class="nb2" hidden></i></a><a class="sbi" href="#/settings" data-k="settings" title="الإعدادات" aria-label="الإعدادات">${ICON.gear}</a><button class="sbi" data-sb="theme" title="تبديل المظهر" aria-label="تبديل المظهر"></button><button class="sbi" data-sb="snd" title="الصوت" aria-label="الصوت"></button><button class="sbi" data-sb="bk" title="تحميل نسخة احتياطية" aria-label="تحميل نسخة احتياطية">${ICON.download}</button></div>`;
    }
    if (!sbBound) {
      sbBound = true;
      try { if (localStorage.getItem('omran_sb') === 'slim') shell.classList.add('slim'); } catch (e) { /* لا شيء */ }
      side.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-sb]');
        if (!b) return;
        const a = b.dataset.sb;
        if (a === 'tg') { shell.classList.toggle('slim'); try { localStorage.setItem('omran_sb', shell.classList.contains('slim') ? 'slim' : 'wide'); } catch (err) { /* لا شيء */ } setTimeout(placeMark, 380); }
        if (a === 'theme') { S.setMeta({ theme: S.meta().theme === 'light' ? 'dark' : 'light' }); applyTheme(); updateShell(); }
        if (a === 'snd') { S.setMeta({ sound: !S.meta().sound }); updateShell(); beep(); }
        if (a === 'bk') { await downloadBackup(); toast('تم تحميل النسخة الاحتياطية'); }
      });
      w.addEventListener('resize', placeMark);
    }
    side.querySelector('.sb-brand strong').textContent = m.company || 'عمران';
    const act = activeNav(), al = O.alerts().length;
    side.querySelectorAll('[data-k]').forEach((a) => { const on = a.dataset.k === act; a.classList.toggle('on', on); if (on) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    const setBd = (k, n, tone) => { const el = side.querySelector(`[data-bd="${k}"]`); if (!el) return; el.hidden = !n; el.textContent = n || ''; el.className = 'nb ' + (tone || ''); };
    setBd('contracts', O.overdueCount(), 'red');
    setBd('stock', Object.values(O.stockMap()).filter((r) => r.min > 0 && r.qty <= r.min).length, 'orange');
    const bell = side.querySelector('.bellr');
    bell.classList.toggle('has', al > 0);
    const nb2 = bell.querySelector('.nb2'); nb2.hidden = !al; nb2.textContent = al;
    side.querySelector('[data-sb="theme"]').innerHTML = m.theme === 'light' ? ICON.moon : ICON.sun;
    const sn = side.querySelector('[data-sb="snd"]'); sn.innerHTML = m.sound ? ICON.sound : ICON.mute; sn.setAttribute('aria-pressed', m.sound);
    placeMark();
  }
  function placeMark() {
    const side = document.getElementById('side'), mk = side && side.querySelector('.mark'), on = side && side.querySelector('.nv.on');
    if (!mk) return;
    if (!on) { mk.style.opacity = 0; return; }
    mk.style.opacity = 1; mk.style.height = on.offsetHeight + 'px'; mk.style.transform = `translateY(${on.offsetTop}px)`;
  }
  // الأرقام بتعدّ من صفر للقيمة
  function animateCounts(host) {
    const els = host.querySelectorAll('[data-count]');
    if (RM() || !els.length) return;
    const t0 = performance.now(), D = 900;
    els.forEach((el) => { el.textContent = fmt(0); });
    const step = (t) => {
      const k = Math.min(1, (t - t0) / D), e = 1 - Math.pow(1 - k, 3);
      els.forEach((el) => { el.textContent = fmt((+el.dataset.count || 0) * e); });
      if (k < 1) requestAnimationFrame(step); else els.forEach((el) => { el.textContent = fmt(+el.dataset.count || 0); });
    };
    requestAnimationFrame(step);
  }

  /* ================= الصفحة الرئيسية (لوحة التحكم) ================= */
  function homePage() {
    const al = O.alerts(), m = S.meta(), t = today(), mo = t.slice(0, 7);
    const days = m.lastBackup ? Math.floor((Date.now() - m.lastBackup) / 864e5) : null;
    const showBk = S.hasData() && (days == null || days >= 7);
    const act = S.all('contracts').filter((c) => c.status !== 'ملغي');
    const rows = []; act.forEach((c) => O.unpaid(c).forEach((i) => rows.push(i)));
    const od = sum(rows.filter((i) => i.due < t), O.instRem), soon = sum(rows.filter((i) => i.due >= t && i.due <= addDays(30)), O.instRem);
    const T = S.all('treasury'), inMo = sum(T.filter((x) => x.type === 'in' && String(x.date).slice(0, 7) === mo), (x) => x.amount), outMo = sum(T.filter((x) => x.type === 'out' && String(x.date).slice(0, 7) === mo), (x) => x.amount);
    const hr = new Date().getHours(), hello = hr < 5 ? 'مساء النور' : hr < 12 ? 'صباح الخير' : hr < 18 ? 'نهارك سعيد' : 'مساء الخير';
    const KP = [
      { l: 'رصيد الخزنة', v: O.balance(), ic: 'treasury', to: '#/m/treasury', sub: 'وارد الشهر ' + fmt(inMo) + ' · صادر ' + fmt(outMo), tone: O.balance() < 0 ? 'red' : '' },
      { l: 'أقساط متأخرة', v: od, ic: 'contracts', to: '#/m/contracts', sub: O.overdueCount() ? O.overdueCount() + ' عميل متأخر' : 'مفيش متأخرات', tone: od ? 'red' : '' },
      { l: 'مستحق خلال 30 يوم', v: soon, ic: 'reports', to: '#/reports', sub: 'أقساط جاية من العملاء', tone: '' },
      { l: 'متبقي عند العملاء', v: sum(rows, O.instRem), ic: 'properties', to: '#/m/contracts', sub: act.length + ' عميل نشط', tone: '' }
    ];
    const months = [], now = new Date();
    for (let i = 5; i >= 0; i--) { const d = new Date(now.getFullYear(), now.getMonth() - i, 1); months.push({ k: d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0'), l: H.MONTHS[d.getMonth()] }); }
    const mi = months.map((x) => sum(T.filter((f) => f.type === 'in' && String(f.date).slice(0, 7) === x.k), (f) => f.amount)), mx = months.map((x) => sum(T.filter((f) => f.type === 'out' && String(f.date).slice(0, 7) === x.k), (f) => f.amount));
    const prj = S.all('projects').filter((p) => ['تنفيذ', 'تشطيب'].includes(p.status)).slice(0, 4);
    root().innerHTML = `<div class="wrap home">
      <section class="hello"><div><h2>${hello}</h2><p class="mut"><span id="dt"></span> · <span id="tm" dir="ltr"></span>${O.License.chip()}</p></div>
        <div class="hq"><a class="btn primary" href="#/contract/new">${ICON.plus}<span>عميل جديد</span></a><button class="btn" data-q="in">وارد +</button><button class="btn" data-q="out">صادر −</button></div></section>
      ${showBk ? `<div class="banner" role="status"><span>${days == null ? 'لم تحفظ نسخة احتياطية من بياناتك بعد.' : 'آخر نسخة احتياطية كانت من ' + days + ' يوم.'}</span><button class="lnkb" data-h="bk">تحميل نسخة الآن</button></div>` : ''}
      <div class="kpis">${KP.map((k) => `<a class="k2 ${HUEOF[k.ic]} ${k.tone}" href="${k.to}"><span class="ti">${TILE[k.ic]}</span><div><small>${k.l}</small><b><span class="cn" data-count="${k.v}">${fmt(k.v)}</span> <i>${esc(cur())}</i></b><em>${esc(k.sub)}</em></div></a>`).join('')}</div>
      <div class="dash">
        <section class="panel pad dchart"><h3>الوارد والصادر آخر 6 شهور</h3>${barsSVG(months.map((x) => x.l), mi, mx)}<div class="legend"><span><i style="background:var(--green)"></i>وارد</span><span><i style="background:var(--orange)"></i>صادر</span></div></section>
        <section class="panel pad alerts dal" aria-labelledby="ah"><div class="ahead"><h2 id="ah">التنبيهات</h2>${al.length ? `<span class="count">${al.length}</span>` : ''}<span class="ab">${ICON.bell}</span></div>
        ${al.length ? `<div class="alist">${al.slice(0, 5).map((a) => `<a class="arow" href="${a.to}"><span class="dot ${a.tone}"></span><span>${esc(a.text)}</span></a>`).join('')}</div>${al.length > 5 ? '<a class="more" href="#/alerts">عرض كل التنبيهات (' + al.length + ')</a>' : ''}` : `<div class="empty small"><p>مفيش تنبيهات حالياً. سجّل عميل واكتب جدول أقساطه، وهتتنبه لوحدك قبل كل ميعاد.</p>${S.hasData() ? '' : '<div class="row-actions"><button class="btn" data-h="demo">تحميل بيانات تجريبية</button></div>'}</div>`}</section>
      </div>
      ${prj.length ? `<section class="panel pad"><h3>مشاريع قيد التنفيذ</h3><div class="pgrid">${prj.map((p) => `<a class="pcard" href="#/d/projects/${p.id}"><b>${esc(p.name)}</b><small class="mut">${esc(p.status)}${p.end ? ' · التسليم ' + fdate(p.end) : ''}</small><div class="bar"><i style="width:${Math.min(100, +p.progress || 0)}%"></i><em>${fmt(+p.progress || 0)}<bdi>%</bdi></em></div></a>`).join('')}</div></section>` : ''}
      <footer class="foot">الإصدار 3.0 · البيانات وملفات العقود محفوظة على جهازك</footer></div>`;
    const clock = () => {
      const d = new Date();
      $('#tm').textContent = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      $('#dt').textContent = d.toLocaleDateString('ar-EG', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
    };
    clock(); tick = setInterval(clock, 15000);
    root().onclick = async (e) => {
      const q = e.target.closest('[data-q]');
      if (q) { V.treasuryForm({ type: q.dataset.q }, route); return; }
      const b = e.target.closest('[data-h]');
      if (!b) return;
      if (b.dataset.h === 'bk') { await downloadBackup(); toast('تم تحميل النسخة الاحتياطية'); homePage(); animateCounts(root()); }
      if (b.dataset.h === 'demo') { O.loadDemo(); toast('تم تحميل البيانات التجريبية'); route(); }
    };
  }
  const HUEOF = { treasury: 'h-green', contracts: 'h-pink', reports: 'h-indigo', properties: 'h-orange' };

  function applyTheme() { document.documentElement.dataset.theme = S.meta().theme === 'light' ? 'light' : 'dark'; }

  /* ================= الموجّه ================= */
  function route() {
    clearInterval(tick);
    applyTheme();
    const lic = O.License.status();
    document.getElementById('shell').classList.toggle('locked', !lic.ok);
    if (!lic.ok) { O.License.gate(lic); return; }
    const stage = root();
    stage.classList.remove('enter'); void stage.offsetWidth; stage.classList.add('enter');
    const p = (location.hash || '#/').replace(/^#\/?/, '').split('/');
    window.scrollTo(0, 0);
    root().onclick = root().oninput = root().onchange = root().onkeydown = null;
    try {
      if (!p[0]) homePage();
      else if (p[0] === 'm' && M[p[1]]) listPage(p[1]);
      else if (p[0] === 'd' && (M[p[1]] || p[1] === 'stock')) detailPage(p[1], p.slice(2).join('/'));
      else if (p[0] === 'receipt') receiptPage(p[1], p[2]);
      else if (p[0] === 'contract') contractPage(p[1] || 'new', p[2]);
      else if (p[0] === 'stock') stockPage();
      else if (p[0] === 'reports') reportsPage();
      else if (p[0] === 'calc') calcPage();
      else if (p[0] === 'alerts') alertsPage();
      else if (p[0] === 'settings') settingsPage();
      else homePage();
    } catch (err) {
      console.error(err);
      root().innerHTML = '<div class="wrap"><div class="empty"><p>حصل خطأ غير متوقع في عرض الصفحة.</p><a class="btn primary" href="#/">العودة للرئيسية</a></div></div>';
    }
    updateShell();
    animateCounts(root());
  }
  O.route = route;
  O.go = go;
})(window);
