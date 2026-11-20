/* الوحدات: المشاريع، الوحدات، العملاء والعقود، المقاولين والمهندسين، الموردين، المخزن، الخزنة + التنبيهات + بيانات تجريبية */
(function (w) {
  'use strict';
  const O = w.Omran;
  const { S, H, FS } = O;
  const { fmt, sum, today, addDays, addMonths, fdate, norm, uid } = H;
  const V = () => O.V; // العروض تُحمَّل بعد هذا الملف

  /* ---------- قوائم ثابتة ---------- */
  const ROLES = ['مقاول رئيسي', 'مقاول باطن', 'مهندس موقع', 'مهندس إنشائي', 'مهندس معماري', 'مهندس كهرباء / ميكانيكا', 'مساح', 'حداد', 'مسلّح', 'نجار مسلح', 'نجار', 'بنّا', 'محّار', 'مبلّط وسيراميك', 'سباك', 'كهربائي', 'نقّاش', 'عزل', 'جبس بورد', 'ألوميتال', 'سائق ومعدات', 'عامل يومية', 'أخرى'];
  const MATCATS = ['حديد', 'أسمنت', 'رمل وزلط', 'طوب', 'خرسانة جاهزة', 'سيراميك وبلاط', 'أدوات صحية وسباكة', 'كهرباء', 'دهانات', 'أخشاب', 'ألوميتال وزجاج', 'عزل', 'أخرى'];
  const UNITS = ['طن', 'كجم', 'م³', 'م²', 'متر', 'عدد', 'شكارة', 'كيس', 'لتر', 'لفة', 'طقم'];
  const IN_CATS = ['قسط عميل', 'حجز / مقدم', 'تمويل / رأس مال', 'إيراد آخر'];
  const OUT_CATS = ['مواد وخامات', 'مقاولين ومهندسين', 'عمالة يومية', 'نقل وشحن', 'تراخيص وحكومية', 'معدات', 'كهرباء ومياه', 'مصاريف إدارية', 'أخرى'];
  const FREQ = [{ v: 1, l: 'شهري' }, { v: 2, l: 'كل شهرين' }, { v: 3, l: 'ربع سنوي' }, { v: 6, l: 'نصف سنوي' }, { v: 12, l: 'سنوي' }];
  const COMMON_ITEMS = ['حديد 10 مم', 'حديد 12 مم', 'حديد 16 مم', 'أسمنت', 'رمل', 'زلط', 'طوب أحمر', 'سن', 'بلاط', 'ماسورة PVC'];

  const TONE = {
    'مباعة': 'green', 'مكتمل': 'green', 'مدفوع': 'green', 'منتظم': 'blue', 'متاحة': 'blue', 'تنفيذ': 'blue', 'ساري': 'blue', 'قادم': 'gray',
    'محجوزة': 'orange', 'تشطيب': 'orange', 'جزئي': 'orange', 'قسط قريب': 'orange', 'قريب': 'orange', 'منخفض': 'red', 'متأخر': 'red', 'متوقف': 'red',
    'تخطيط': 'gray', 'ملغي': 'gray', 'مؤجرة': 'blue'
  };

  /* ---------- مساعدات الربط ---------- */
  const unitLabel = (p, withProject) => {
    const n = ((p.kind || '') + ' ' + (p.code || '')).trim();
    const pr = withProject && p.project ? (S.get('projects', p.project) || {}).name : '';
    return n + (pr ? ' - ' + pr : '');
  };
  const REF = { projects: (p) => p.name, properties: (p) => unitLabel(p, true), contractors: (p) => p.name, suppliers: (p) => p.name };
  const refName = (c, id) => { const o = id && S.get(c, id); return o ? (REF[c] ? REF[c](o) : o.name) : ''; };
  const refOpts = (c) => () => S.all(c).map((o) => ({ v: o.id, l: REF[c] ? REF[c](o) : o.name }));
  const alertDays = () => +S.meta().alertDays || 7;

  /* ---------- الخزنة ---------- */
  const T = () => S.all('treasury');
  const inOf = (f) => sum(T().filter((x) => x.type === 'in' && f(x)), (x) => x.amount);
  const outOf = (f) => sum(T().filter((x) => x.type === 'out' && f(x)), (x) => x.amount);
  const balance = () => inOf(() => true) - outOf(() => true);
  const memberPaid = (id) => outOf((x) => x.member === id);
  const supplierPaid = (id) => outOf((x) => x.supplier === id);
  const supplierBought = (id) => sum(S.all('stockmoves').filter((x) => x.type === 'in' && x.supplier === id), (x) => (+x.qty || 0) * (+x.price || 0));
  const projectCost = (id) => outOf((x) => x.project === id);
  const projectIncome = (id) => inOf((x) => x.project === id);

  /* ---------- المخزن ---------- */
  function stockMap() {
    const m = {};
    const row = (name, unit) => m[norm(name)] || (m[norm(name)] = { name, unit, qty: 0, inQty: 0, inVal: 0, min: 0 });
    S.all('stockmoves').forEach((x) => {
      const r = row(x.item, x.unit);
      if (x.unit) r.unit = x.unit;
      if (x.type === 'in') { r.qty += +x.qty || 0; r.inQty += +x.qty || 0; r.inVal += (+x.qty || 0) * (+x.price || 0); } else r.qty -= +x.qty || 0;
    });
    S.all('stockitems').forEach((i) => { row(i.name, i.unit).min = +i.min || 0; });
    Object.values(m).forEach((r) => { r.avg = r.inQty ? r.inVal / r.inQty : 0; r.value = Math.max(0, r.qty) * r.avg; });
    return m;
  }

  /* ---------- العقود والأقساط ---------- */
  const instRem = (i) => Math.max(0, (+i.amount || 0) - (+i.paid || 0));
  const byDue = (a, b) => String(a.due || '9999').localeCompare(String(b.due || '9999'));
  // تفقيط المبلغ بالعربي (للإيصالات)
  const AR1 = ['', 'واحد', 'اثنان', 'ثلاثة', 'أربعة', 'خمسة', 'ستة', 'سبعة', 'ثمانية', 'تسعة', 'عشرة', 'أحد عشر', 'اثنا عشر', 'ثلاثة عشر', 'أربعة عشر', 'خمسة عشر', 'ستة عشر', 'سبعة عشر', 'ثمانية عشر', 'تسعة عشر'];
  const AR10 = ['', '', 'عشرون', 'ثلاثون', 'أربعون', 'خمسون', 'ستون', 'سبعون', 'ثمانون', 'تسعون'];
  const AR100 = ['', 'مائة', 'مائتان', 'ثلاثمائة', 'أربعمائة', 'خمسمائة', 'ستمائة', 'سبعمائة', 'ثمانمائة', 'تسعمائة'];
  const below1000 = (n) => { const h = Math.floor(n / 100), r = n % 100, a = []; if (h) a.push(AR100[h]); if (r) { if (r < 20) a.push(AR1[r]); else { const u = r % 10, t = Math.floor(r / 10); a.push(u ? AR1[u] + ' و' + AR10[t] : AR10[t]); } } return a.join(' و'); };
  function tafqeet(num) {
    let n = Math.floor(Math.abs(+num) || 0), rest = n;
    if (!n) return 'صفر';
    const out = [];
    [[1e9, 'مليار', 'ملياران', 'مليارات'], [1e6, 'مليون', 'مليونان', 'ملايين'], [1e3, 'ألف', 'ألفان', 'آلاف']].forEach(([v, s1, s2, sp]) => {
      const q = Math.floor(rest / v); rest %= v;
      if (!q) return;
      out.push(q === 1 ? s1 : q === 2 ? s2 : q <= 10 ? below1000(q) + ' ' + sp : below1000(q) + ' ' + s1);
    });
    if (rest) out.push(below1000(rest));
    return out.join(' و');
  }
  // كل قسط ليه دفعات (pays): كل دفعة بتاريخها ومبلغها وملاحظتها. المحصل = مجموع الدفعات.
  const nextRc = () => { const n = (+S.meta().rc || 0) + 1; S.setMeta({ rc: n }); return n; };
  const normInst = (i) => {
    if (!Array.isArray(i.pays)) i.pays = (+i.paid > 0) ? [{ id: uid(), date: i.paidDate || today(), amount: +i.paid, note: '' }] : [];
    i.pays.forEach((p) => { p.amount = +p.amount || 0; if (!p.id) p.id = uid(); if (!p.no) p.no = nextRc(); });
    i.paid = sum(i.pays, (p) => p.amount);
    i.paidDate = i.pays.length ? i.pays.map((p) => p.date || '').sort().pop() : '';
    return i;
  };
  const addPay = (i, p) => { normInst(i); i.pays.push({ id: uid(), date: p.date || today(), amount: +p.amount || 0, note: p.note || '' }); normInst(i); };
  const ctPaid = (c) => sum(c.insts || [], (i) => i.paid);
  const ctRem = (c) => sum(c.insts || [], instRem);
  const unpaid = (c) => (c.insts || []).filter((i) => instRem(i) > 0.5).sort(byDue);
  const nextInst = (c) => unpaid(c)[0];
  const instState = (i) => {
    if (instRem(i) <= 0.5) return 'مدفوع';
    if (i.due && i.due < today()) return 'متأخر';
    if (i.due && i.due <= addDays(alertDays())) return 'قريب';
    return (+i.paid || 0) > 0 ? 'جزئي' : 'قادم';
  };
  function ctState(c) {
    if (c.status === 'ملغي') return 'ملغي';
    const n = nextInst(c);
    if (!n) return 'مكتمل';
    if (n.due && n.due < today()) return 'متأخر';
    if (n.due && n.due <= addDays(alertDays())) return 'قسط قريب';
    return 'منتظم';
  }
  const overdueCount = () => S.all('contracts').filter((c) => ctState(c) === 'متأخر').length;

  // توليد جدول الأقساط: المقدم + n قسط بتكرار معين. الصفوف المدفوعة بتتحفظ كما هي.
  function genInsts(o) {
    const kept = o.kept || [], keptSum = sum(kept, (i) => i.amount), rows = [];
    let rest = (+o.total || 0) - keptSum;
    if ((+o.down || 0) > 0 && !kept.some((i) => i.label === 'المقدم')) {
      rows.push({ id: uid(), label: 'المقدم', due: o.downDate || today(), amount: +o.down, paid: 0, paidDate: '' });
      rest -= +o.down;
    }
    const n = Math.max(0, Math.floor(+o.n || 0));
    if (n > 0 && rest > 0 && o.first) {
      const base = Math.floor(rest / n), off = kept.filter((i) => /^قسط/.test(i.label)).length;
      let acc = 0;
      for (let k = 0; k < n; k++) {
        const amt = k === n - 1 ? Math.round((rest - acc) * 100) / 100 : base;
        acc += amt;
        rows.push({ id: uid(), label: 'قسط ' + (off + k + 1), due: addMonths(o.first, k * (+o.months || 1)), amount: amt, paid: 0, paidDate: '' });
      }
    }
    return kept.concat(rows).sort(byDue);
  }

  // كل قسط اتحصّل منه بيتسجل لوحده كوارد في الخزنة (بدون ما تكتبه مرتين)
  function syncTreasury(c) {
    const rest = T().filter((x) => !(x.auto && x.contract === c.id));
    const u = S.get('properties', c.unit), un = u ? unitLabel(u) : '';
    (c.insts || []).forEach((i) => {
      normInst(i);
      i.pays.forEach((p) => {
        if (p.amount > 0) rest.push({ id: uid(), created: Date.now(), date: p.date || today(), type: 'in', amount: p.amount, cat: i.label === 'المقدم' ? 'حجز / مقدم' : 'قسط عميل', project: c.project || '', party: c.name, note: i.label + (un ? ' - ' + un : '') + (p.note ? ' - ' + p.note : ''), contract: c.id, inst: i.id, pay: p.id, auto: true, demo: !!c.demo });
      });
    });
    S.setAll('treasury', rest);
  }
  function saveContract(c, prev) {
    c.project = (S.get('properties', c.unit) || {}).project || '';
    (c.insts || []).forEach(normInst);
    const o = S.put('contracts', Object.assign({}, prev || {}, c));
    if (prev && prev.unit && prev.unit !== o.unit) {
      const pu = S.get('properties', prev.unit);
      if (pu && pu.status === 'مباعة') { pu.status = 'متاحة'; S.put('properties', pu); }
    }
    const u = S.get('properties', o.unit);
    if (u) { u.status = o.status === 'ملغي' ? 'متاحة' : 'مباعة'; S.put('properties', u); }
    syncTreasury(o);
    return o;
  }
  function deleteContract(c) {
    S.setAll('treasury', T().filter((x) => !(x.auto && x.contract === c.id)));
    S.del('contracts', c.id);
    const u = S.get('properties', c.unit);
    if (u && u.status === 'مباعة') { u.status = 'متاحة'; S.put('properties', u); }
  }
  const contractOfUnit = (id) => S.all('contracts').find((c) => c.unit === id && c.status !== 'ملغي');

  /* ---------- تعريف الوحدات (قوائم) ---------- */
  const M = {};

  M.projects = {
    title: 'المشاريع', single: 'مشروع', icon: 'projects',
    fields: [
      { k: 'name', l: 'اسم المشروع', req: 1, w: 'full' },
      { k: 'type', l: 'نوع المشروع', t: 'select', opts: ['عمارة سكنية', 'فيلا', 'مجمع سكني', 'مبنى تجاري', 'مبنى إداري', 'مخزن / مصنع', 'أرض', 'ترميم وتشطيب'] },
      { k: 'status', l: 'الحالة', t: 'select', opts: ['تخطيط', 'تنفيذ', 'تشطيب', 'تسليم', 'متوقف'], def: 'تنفيذ' },
      { k: 'location', l: 'الموقع' }, { k: 'client', l: 'المالك / الجهة' },
      { k: 'start', l: 'تاريخ البدء', t: 'date' }, { k: 'end', l: 'تاريخ التسليم المتوقع', t: 'date' },
      { k: 'budget', l: 'الميزانية', t: 'number' }, { k: 'progress', l: 'نسبة الإنجاز %', t: 'number' },
      { k: 'note', l: 'ملاحظات', t: 'textarea', w: 'full' }
    ],
    filters: [{ k: 'status', l: 'كل الحالات', opts: ['تخطيط', 'تنفيذ', 'تشطيب', 'تسليم', 'متوقف'] }],
    row: (p) => {
      const c = projectCost(p.id), u = S.all('properties').filter((x) => x.project === p.id);
      return { t: p.name, m: [p.type, p.location, u.length && u.length + ' وحدة', p.end && 'التسليم ' + fdate(p.end)], b: [p.status], p: +p.progress || 0, a: [{ l: 'الميزانية', v: p.budget }, { l: 'المصروف', v: c, tone: p.budget && c > p.budget ? 'red' : '' }] };
    },
    summary: (l) => [{ l: 'عدد المشاريع', s: l.length }, { l: 'إجمالي الميزانيات', v: sum(l, (x) => x.budget) }, { l: 'إجمالي المصروف', v: sum(l, (x) => projectCost(x.id)) }]
  };

  M.properties = {
    title: 'الوحدات والعقارات', single: 'وحدة', icon: 'properties',
    fields: [
      { k: 'code', l: 'رقم / كود الوحدة', req: 1 },
      { k: 'kind', l: 'النوع', t: 'select', opts: ['شقة', 'دور كامل', 'فيلا', 'محل', 'مكتب', 'مخزن', 'أرض'], def: 'شقة' },
      { k: 'project', l: 'المشروع', t: 'select', opts: refOpts('projects') },
      { k: 'status', l: 'الحالة', t: 'select', opts: ['متاحة', 'محجوزة', 'مباعة'], def: 'متاحة' },
      { k: 'floor', l: 'الدور' }, { k: 'area', l: 'المساحة (م²)', t: 'number' },
      { k: 'cost', l: 'التكلفة علينا', t: 'number' }, { k: 'price', l: 'سعر البيع', t: 'number' },
      { k: 'note', l: 'ملاحظات', t: 'textarea', w: 'full' }
    ],
    filters: [{ k: 'status', l: 'كل الحالات', opts: ['متاحة', 'محجوزة', 'مباعة'] }, { k: 'project', l: 'كل المشاريع', ref: 'projects' }],
    row: (p) => {
      const c = contractOfUnit(p.id);
      return { t: unitLabel(p), m: [refName('projects', p.project), p.area && fmt(p.area) + ' م²', p.floor && 'الدور ' + p.floor, c && 'المشتري: ' + c.name], b: [p.status], a: [{ l: 'السعر', v: p.price }, c ? { l: 'المتبقي على العميل', v: ctRem(c), tone: 'orange' } : null] };
    },
    summary: (l) => [
      { l: 'عدد الوحدات', s: l.length }, { l: 'متاحة للبيع', s: l.filter((x) => x.status === 'متاحة').length },
      { l: 'قيمة المتاح', v: sum(l.filter((x) => x.status === 'متاحة'), (x) => x.price) },
      { l: 'ربح المباع المتوقع', v: sum(l.filter((x) => x.status === 'مباعة'), (x) => (+x.price || 0) - (+x.cost || 0)) }
    ],
    actions: (p) => (contractOfUnit(p.id) ? [] : [{ l: 'تسجيل بيع لعميل', q: 1, fn: () => O.go('#/contract/new/' + p.id) }])
  };

  M.contractors = {
    title: 'المقاولين والمهندسين', single: 'مقاول / مهندس', icon: 'team', files: true,
    fields: [
      { k: 'name', l: 'الاسم', req: 1 }, { k: 'trade', l: 'التخصص', t: 'select', opts: ROLES, req: 1 },
      { k: 'phone', l: 'التليفون', t: 'tel' }, { k: 'project', l: 'المشروع الحالي', t: 'select', opts: refOpts('projects') },
      { k: 'terms', l: 'نظام الحساب (يومية 600، بالمتر 95...)' }, { k: 'contractValue', l: 'قيمة الاتفاق الإجمالية (اختياري)', t: 'number' },
      { k: 'note', l: 'ملاحظات', t: 'textarea', w: 'full' }
    ],
    filters: [{ k: 'trade', l: 'كل التخصصات', opts: ROLES }, { k: 'project', l: 'كل المشاريع', ref: 'projects' }],
    row: (c) => {
      const paid = memberPaid(c.id), cv = +c.contractValue || 0;
      return { t: c.name, m: [c.trade, refName('projects', c.project), c.terms, c.phone, c.files && c.files.length && 'العقد مرفوع'], b: [], a: cv ? [{ l: 'الاتفاق', v: cv }, { l: 'المدفوع', v: paid, tone: 'green' }, { l: 'المتبقي', v: Math.max(0, cv - paid), tone: cv - paid > 0 ? 'orange' : '' }] : [{ l: 'المدفوع', v: paid, tone: 'green' }] };
    },
    summary: (l) => [{ l: 'العدد', s: l.length }, { l: 'إجمالي الاتفاقات', v: sum(l, (x) => x.contractValue) }, { l: 'إجمالي المدفوع', v: sum(l, (x) => memberPaid(x.id)) }],
    actions: () => [{ l: 'دفعة', q: 1, fn: (it, rf) => V().treasuryForm({ type: 'out', cat: 'مقاولين ومهندسين', member: it.id, project: it.project || '', party: it.name }, rf) }],
    sortFn: (a, b) => String(a.trade || '').localeCompare(String(b.trade || ''), 'ar')
  };

  M.suppliers = {
    title: 'الموردين', single: 'مورد', icon: 'suppliers',
    fields: [
      { k: 'name', l: 'اسم المورد / الشركة', req: 1, w: 'full' },
      { k: 'category', l: 'نوع المواد', t: 'select', opts: MATCATS }, { k: 'phone', l: 'التليفون', t: 'tel' },
      { k: 'address', l: 'العنوان' }, { k: 'terms', l: 'شروط الدفع (آجل / نقدي / مدة)' },
      { k: 'note', l: 'ملاحظات وأسعار متفق عليها', t: 'textarea', w: 'full' }
    ],
    filters: [{ k: 'category', l: 'كل الأنواع', opts: MATCATS }],
    row: (s) => {
      const b = supplierBought(s.id), p = supplierPaid(s.id);
      return { t: s.name, m: [s.category, s.phone, s.address, s.terms], b: [], a: [{ l: 'مشتريات', v: b }, { l: 'المدفوع', v: p, tone: 'green' }, { l: 'المستحق له', v: Math.max(0, b - p), tone: b - p > 0 ? 'orange' : '' }] };
    },
    summary: (l) => [{ l: 'عدد الموردين', s: l.length }, { l: 'إجمالي المستحق للموردين', v: sum(l, (s) => Math.max(0, supplierBought(s.id) - supplierPaid(s.id))), tone: 'orange' }],
    actions: () => [{ l: 'دفعة', q: 1, fn: (it, rf) => V().treasuryForm({ type: 'out', cat: 'مواد وخامات', supplier: it.id, party: it.name }, rf) }]
  };

  /* ---------- الخزنة (وارد / صادر) ---------- */
  M.treasury = {
    title: 'الخزنة', single: 'حركة', icon: 'treasury', back: '#/',
    addButtons: [{ l: 'وارد +', preset: { type: 'in' }, cls: 'primary' }, { l: 'صادر −', preset: { type: 'out' } }],
    formTitle: (v, old) => (old ? 'تعديل ' : '') + (v.type === 'in' ? 'وارد' : 'صادر'),
    fields: (v) => [
      { k: 'date', l: 'التاريخ', t: 'date', req: 1, def: () => today() },
      { k: 'amount', l: 'المبلغ', t: 'number', req: 1 },
      { k: 'cat', l: 'البند', t: 'select', opts: v.type === 'in' ? IN_CATS : OUT_CATS, req: 1 },
      { k: 'project', l: 'المشروع', t: 'select', opts: refOpts('projects') }
    ].concat(v.type === 'out' ? [
      { k: 'member', l: 'دفعة لمقاول / مهندس / صنايعي', t: 'select', opts: refOpts('contractors') },
      { k: 'supplier', l: 'دفعة لمورد', t: 'select', opts: refOpts('suppliers') }
    ] : []).concat([{ k: 'party', l: v.type === 'in' ? 'من مين' : 'لمين / البيان', w: 'full' }, { k: 'note', l: 'ملاحظات', t: 'textarea', w: 'full' }]),
    beforeSave: (o) => {
      if (o.type === 'out') {
        if (o.member) { const m = S.get('contractors', o.member); if (m) { if (!o.party) o.party = m.name; if (!o.project) o.project = m.project || ''; } }
        if (o.supplier && !o.party) o.party = refName('suppliers', o.supplier);
      }
      return o;
    },
    filters: [{ k: 'type', l: 'وارد وصادر', opts: [{ v: 'in', l: 'وارد' }, { v: 'out', l: 'صادر' }] }, { k: 'cat', l: 'كل البنود', opts: IN_CATS.concat(OUT_CATS) }, { k: 'project', l: 'كل المشاريع', ref: 'projects' }],
    row: (t) => ({
      t: t.cat, m: [t.party, refName('projects', t.project), fdate(t.date), t.auto && 'تلقائي من عقد عميل', t.note], b: [], dot: t.type === 'in' ? 'green' : 'orange',
      a: [{ l: t.type === 'in' ? 'وارد' : 'صادر', v: t.amount, tone: t.type === 'in' ? 'green' : 'orange', always: 1 }]
    }),
    summary: (l) => {
      const mo = today().slice(0, 7), mi = sum(l.filter((x) => x.type === 'in' && String(x.date).slice(0, 7) === mo), (x) => x.amount), mo2 = sum(l.filter((x) => x.type === 'out' && String(x.date).slice(0, 7) === mo), (x) => x.amount);
      return [{ l: 'رصيد الخزنة', v: balance(), tone: balance() >= 0 ? 'green' : 'red' }, { l: 'وارد هذا الشهر', v: mi }, { l: 'صادر هذا الشهر', v: mo2 }];
    },
    sortFn: (a, b) => String(b.date).localeCompare(String(a.date)) || (b.created || 0) - (a.created || 0)
  };

  /* ---------- حركة المخزن (وارد / صادر خامات) ---------- */
  M.stockmoves = {
    title: 'سجل حركة المخزن', single: 'حركة', icon: 'stock', back: '#/stock',
    addButtons: [{ l: 'وارد +', preset: { type: 'in' }, cls: 'primary' }, { l: 'صادر −', preset: { type: 'out' } }],
    formTitle: (v, old) => (old ? 'تعديل ' : '') + (v.type === 'in' ? 'وارد خامات' : 'صادر خامات'),
    fields: (v) => [
      { k: 'date', l: 'التاريخ', t: 'date', req: 1, def: () => today() },
      { k: 'item', l: 'الصنف', req: 1, list: () => [...new Set(Object.values(stockMap()).map((x) => x.name).concat(COMMON_ITEMS))] },
      { k: 'qty', l: 'الكمية', t: 'number', req: 1 }, { k: 'unit', l: 'الوحدة', t: 'select', opts: UNITS, req: 1 }
    ].concat(v.type === 'in' ? [{ k: 'price', l: 'سعر الوحدة', t: 'number' }, { k: 'supplier', l: 'المورد', t: 'select', opts: refOpts('suppliers') }] : [{ k: 'project', l: 'صُرف لمشروع', t: 'select', opts: refOpts('projects') }]).concat([{ k: 'note', l: 'ملاحظات', t: 'textarea', w: 'full' }]),
    validate: (o, old) => {
      if (o.type !== 'out') return '';
      const cur = stockMap()[norm(o.item)] || { qty: 0 };
      const bal = cur.qty + (old && old.type === 'out' && norm(old.item) === norm(o.item) ? +old.qty : 0);
      return o.qty > bal + 1e-9 ? 'الكمية أكبر من الرصيد المتاح (' + fmt(bal) + ')' : '';
    },
    filters: [{ k: 'type', l: 'وارد وصادر', opts: [{ v: 'in', l: 'وارد' }, { v: 'out', l: 'صادر' }] }, { k: 'project', l: 'كل المشاريع', ref: 'projects' }],
    row: (x) => ({
      t: x.item, m: [x.type === 'in' ? refName('suppliers', x.supplier) : refName('projects', x.project) && 'إلى ' + refName('projects', x.project), fdate(x.date), x.note], b: [], dot: x.type === 'in' ? 'green' : 'orange',
      a: [{ l: x.type === 'in' ? 'وارد' : 'صادر', s: fmt(x.qty) + ' ' + (x.unit || ''), tone: x.type === 'in' ? 'green' : 'orange' }, x.type === 'in' && +x.price ? { l: 'القيمة', v: x.qty * x.price } : null]
    }),
    summary: (l) => [{ l: 'عدد الحركات', s: l.length }, { l: 'وارد اليوم', s: l.filter((x) => x.type === 'in' && x.date === today()).length }, { l: 'صادر اليوم', s: l.filter((x) => x.type === 'out' && x.date === today()).length }],
    sortFn: (a, b) => String(b.date).localeCompare(String(a.date)) || (b.created || 0) - (a.created || 0)
  };

  /* ---------- العملاء والعقود ---------- */
  const STATES = ['متأخر', 'قسط قريب', 'منتظم', 'مكتمل', 'ملغي'];
  M.contracts = {
    title: 'العملاء والعقود', single: 'عميل', icon: 'contracts', editor: true, editorRoute: '#/contract/', back: '#/',
    addButtons: [{ l: 'عميل جديد', cls: 'primary' }],
    fields: [],
    filters: [{ get: (c) => ctState(c), l: 'كل الحالات', opts: STATES }],
    row: (c) => {
      const st = ctState(c), n = nextInst(c), u = S.get('properties', c.unit);
      return {
        t: c.name, m: [u && unitLabel(u, true), c.phone, n && 'القسط القادم: ' + fdate(n.due) + ' - ' + fmt(instRem(n)), c.files && c.files.length && 'العقد مرفوع'], b: [st],
        dot: st === 'متأخر' ? 'red' : st === 'قسط قريب' ? 'orange' : st === 'مكتمل' ? 'green' : st === 'ملغي' ? 'gray' : 'blue',
        a: [{ l: 'إجمالي العقد', v: c.total, always: 1 }, { l: 'المحصل', v: ctPaid(c), tone: 'green' }, { l: 'المتبقي', v: ctRem(c), tone: ctRem(c) > 0 ? 'orange' : '' }]
      };
    },
    summary: (l) => {
      const act = l.filter((c) => c.status !== 'ملغي'), t = today();
      const od = sum(act, (c) => sum(unpaid(c).filter((i) => i.due && i.due < t), instRem)), soon = sum(act, (c) => sum(unpaid(c).filter((i) => i.due >= t && i.due <= addDays(30)), instRem));
      return [{ l: 'عدد العملاء', s: act.length }, { l: 'متبقي على العملاء', v: sum(act, ctRem) }, { l: 'أقساط متأخرة', v: od, tone: od ? 'red' : '' }, { l: 'مستحق خلال 30 يوم', v: soon, tone: 'orange' }];
    },
    actions: (c) => (nextInst(c) && c.status !== 'ملغي' ? [{ l: 'تحصيل القسط', q: 1, fn: (it, rf) => V().collectNext(it, rf) }] : []),
    sortFn: (a, b) => { const r = { 'متأخر': 0, 'قسط قريب': 1, 'منتظم': 2, 'مكتمل': 3, 'ملغي': 4 }; const d = r[ctState(a)] - r[ctState(b)]; if (d) return d; const na = nextInst(a), nb = nextInst(b); return String((na || {}).due || '9').localeCompare(String((nb || {}).due || '9')); }
  };

  /* ---------- التنبيهات التلقائية ---------- */
  function alerts() {
    const out = [], t = today(), cur = S.meta().currency, ad = alertDays();
    const push = (tone, text, to) => out.push({ tone, text, to });
    S.all('contracts').filter((c) => c.status !== 'ملغي').forEach((c) => {
      const u = unpaid(c), over = u.filter((i) => i.due && i.due < t), to = '#/d/contracts/' + c.id;
      if (over.length) push('red', `قسط متأخر على ${c.name}: ${fmt(sum(over, instRem))} ${cur}${over.length > 1 ? ' (' + over.length + ' أقساط)' : ''} - استحق ${fdate(over[0].due)}`, to);
      const nx = u.find((i) => i.due && i.due >= t);
      if (nx && nx.due <= addDays(ad)) {
        const d = H.daysBetween(t, nx.due);
        push('orange', `قسط ${c.name} بمبلغ ${fmt(instRem(nx))} ${cur} ${d === 0 ? 'يستحق النهارده' : d === 1 ? 'يستحق بكرة' : 'يستحق بعد ' + d + ' أيام (' + fdate(nx.due) + ')'}`, to);
      }
    });
    Object.values(stockMap()).forEach((r) => { if (r.min > 0 && r.qty <= r.min) push('orange', `رصيد «${r.name}» منخفض: ${fmt(r.qty)} ${r.unit || ''}`, '#/stock'); });
    S.all('suppliers').forEach((s) => { const d = supplierBought(s.id) - supplierPaid(s.id); if (d > 0.5) push('blue', `مستحق للمورد ${s.name} مبلغ ${fmt(d)} ${cur}`, '#/m/suppliers'); });
    S.all('projects').forEach((p) => { if (p.end && p.end < t && !['تسليم', 'متوقف'].includes(p.status)) push('red', `مشروع «${p.name}» تجاوز موعد التسليم (${fdate(p.end)})`, '#/m/projects'); });
    const rank = { red: 0, orange: 1, blue: 2 };
    return out.map((a, i) => ({ ...a, i })).sort((a, b) => rank[a.tone] - rank[b.tone] || a.i - b.i);
  }

  /* ---------- بيانات تجريبية ---------- */
  function miniPdf(lines) {
    const e = (s) => s.replace(/[()\\]/g, '\\$&');
    const content = 'BT /F1 16 Tf 60 780 Td 22 TL\n' + lines.map((l) => `(${e(l)}) Tj T*`).join('\n') + '\nET';
    const objs = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>', '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>', `<< /Length ${content.length} >>\nstream\n${content}\nendstream`, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
    let pdf = '%PDF-1.4\n';
    const off = [];
    objs.forEach((o, i) => { off.push(pdf.length); pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; });
    const x = pdf.length;
    pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` + off.map((o) => String(o).padStart(10, '0') + ' 00000 n \n').join('') + `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${x}\n%%EOF`;
    return new Blob([pdf], { type: 'application/pdf' });
  }

  function loadDemo() {
    const d = (n) => addDays(n), P = (c, o) => S.put(c, Object.assign({ demo: true }, o));
    const pr1 = P('projects', { name: 'عمارة التجمع الخامس - 8 أدوار', type: 'عمارة سكنية', location: 'التجمع الخامس', client: 'م. هشام', status: 'تنفيذ', start: d(-150), end: d(200), budget: 12500000, progress: 55 }).id;
    const pr2 = P('projects', { name: 'فيلا الشيخ زايد', type: 'فيلا', location: 'الشيخ زايد', client: 'أ. منى', status: 'تشطيب', start: d(-300), end: d(-5), budget: 6800000, progress: 85 }).id;
    const pr3 = P('projects', { name: 'محلات تجارية - مدينة نصر', type: 'مبنى تجاري', location: 'مدينة نصر', status: 'تخطيط', start: d(20), end: d(330), budget: 3200000, progress: 5 }).id;
    const u1 = P('properties', { code: '101', kind: 'شقة', project: pr1, status: 'متاحة', floor: 'الأول', area: 140, cost: 3100000, price: 4200000 }).id;
    const u2 = P('properties', { code: '102', kind: 'شقة', project: pr1, status: 'متاحة', floor: 'الأول', area: 125, cost: 2800000, price: 3800000 }).id;
    P('properties', { code: '201', kind: 'شقة', project: pr1, status: 'متاحة', floor: 'الثاني', area: 150, cost: 3300000, price: 4600000 });
    const u4 = P('properties', { code: '301', kind: 'شقة', project: pr1, status: 'متاحة', floor: 'الثالث', area: 110, cost: 2300000, price: 3100000 }).id;
    P('properties', { code: '1', kind: 'محل', project: pr3, status: 'متاحة', area: 45, cost: 1500000, price: 2300000 });
    P('properties', { code: 'A', kind: 'فيلا', project: pr2, status: 'متاحة', area: 420, cost: 5900000, price: 8900000 });

    const s1 = P('suppliers', { name: 'شركة النور لحديد التسليح', category: 'حديد', phone: '01001110022', address: 'العاشر من رمضان', terms: 'آجل 30 يوم' }).id;
    const s2 = P('suppliers', { name: 'الأمل لمواد البناء', category: 'رمل وزلط', phone: '01223334455', address: 'القاهرة الجديدة', terms: 'نقدي' }).id;
    P('suppliers', { name: 'الريان للسيراميك والأدوات الصحية', category: 'سيراميك وبلاط', phone: '01155556677', address: 'مدينة نصر', terms: 'دفعات' });
    const m1 = P('contractors', { name: 'م. طارق عبد الله', trade: 'مقاول رئيسي', phone: '01005556677', project: pr1, terms: 'مقطوعية', contractValue: 2400000 }).id;
    P('contractors', { name: 'م. سامي فؤاد', trade: 'مهندس موقع', phone: '01066778899', project: pr1, terms: 'شهري 15,000' });
    const m3 = P('contractors', { name: 'الأسطى محمود', trade: 'حداد', phone: '01012345678', project: pr1, terms: 'بالطن 12,000' }).id;
    P('contractors', { name: 'الأسطى سيد', trade: 'نجار مسلح', phone: '01098765432', project: pr1, terms: 'يومية 600' });
    const m5 = P('contractors', { name: 'الأسطى رضا', trade: 'محّار', project: pr2, terms: 'بالمتر 95', contractValue: 180000 }).id;
    P('contractors', { name: 'الأسطى خالد', trade: 'كهربائي', project: pr2, terms: 'مقطوعية', contractValue: 95000 });

    const mv = (type, date, item, unit, qty, extra) => P('stockmoves', Object.assign({ type, date, item, unit, qty }, extra));
    mv('in', d(-40), 'حديد 16 مم', 'طن', 8, { price: 38000, supplier: s1 }); mv('out', d(-12), 'حديد 16 مم', 'طن', 5, { project: pr1 });
    mv('in', d(-30), 'أسمنت', 'شكارة', 300, { price: 190, supplier: s2 }); mv('out', d(-8), 'أسمنت', 'شكارة', 180, { project: pr1 });
    mv('in', d(-25), 'رمل', 'م³', 60, { price: 220, supplier: s2 }); mv('out', d(-6), 'رمل', 'م³', 42, { project: pr1 });
    mv('in', d(-25), 'زلط', 'م³', 40, { price: 380, supplier: s2 }); mv('out', d(-6), 'زلط', 'م³', 36, { project: pr1 });
    [['حديد 16 مم', 'طن', 5], ['رمل', 'م³', 10], ['زلط', 'م³', 8]].forEach(([n, u, m]) => P('stockitems', { name: n, unit: u, min: m }));

    const tr = (type, date, cat, amount, extra) => P('treasury', Object.assign({ type, date, cat, amount }, extra));
    tr('in', d(-200), 'تمويل / رأس مال', 5000000, { party: 'رأس مال الشركة' });
    tr('out', d(-40), 'مواد وخامات', 304000, { supplier: s1, party: 'شركة النور لحديد التسليح', project: pr1 });
    tr('out', d(-30), 'مواد وخامات', 57000, { supplier: s2, party: 'الأمل لمواد البناء', project: pr1 });
    tr('out', d(-90), 'مقاولين ومهندسين', 600000, { member: m1, party: 'م. طارق عبد الله', project: pr1, note: 'دفعة أولى' });
    tr('out', d(-30), 'مقاولين ومهندسين', 500000, { member: m1, party: 'م. طارق عبد الله', project: pr1, note: 'مستخلص 2' });
    tr('out', d(-14), 'مقاولين ومهندسين', 20000, { member: m3, party: 'الأسطى محمود', project: pr1 });
    tr('out', d(-7), 'مقاولين ومهندسين', 60000, { member: m5, party: 'الأسطى رضا', project: pr2 });
    tr('out', d(-4), 'تراخيص وحكومية', 12000, { party: 'رسوم ترخيص', project: pr1 });
    tr('out', d(-1), 'نقل وشحن', 4200, { party: 'نقل رمل', project: pr1 });
    tr('out', d(0), 'عمالة يومية', 6300, { party: 'يوميات العمال', project: pr1 });

    const mk = (o, down, n, first, paidBefore, files) => {
      const insts = genInsts({ total: o.total, down, downDate: o.date, n, months: 1, first });
      insts.forEach((i, k) => { if (i.due <= paidBefore) { i.pays = [{ id: uid(), date: i.due, amount: i.amount, note: k % 3 === 0 ? 'تحويل بنكي' : 'استلام نقدي' }]; } });
      return saveContract(Object.assign({ demo: true, status: 'ساري', files: files || [], insts }, o), null);
    };
    mk({ name: 'أحمد سمير', nid: '28501011234567', phone: '01001234567', phone2: '01112345678', address: 'مدينة نصر - القاهرة', job: 'مهندس', unit: u1, date: d(-200), total: 4200000 }, 1000000, 14, d(-170), d(-25));
    const pdfId = uid();
    FS.put(pdfId, miniPdf(['CONTRACT - DEMO', 'Buyer: Noha Alaa', 'Unit 102 - Total 3,800,000 EGP', 'Down payment 300,000 - 12 monthly installments']), 'عقد-نهى-علاء.pdf', 'application/pdf').catch(() => {});
    mk({ name: 'نهى علاء', nid: '29002021234568', phone: '01112223344', address: 'الشيخ زايد - الجيزة', job: 'طبيبة', unit: u2, date: d(-60), total: 3800000 }, 300000, 12, d(3), d(-59), [{ id: pdfId, name: 'عقد-نهى-علاء.pdf', size: 900, type: 'application/pdf' }]);
    mk({ name: 'م. كريم عادل', nid: '27811011234569', phone: '01055667788', address: 'المعادي - القاهرة', job: 'مقاول', unit: u4, date: d(-300), total: 3100000 }, 600000, 5, d(-250), d(0));
  }

  Object.assign(O, { M, TONE, ROLES, UNITS, MATCATS, IN_CATS, OUT_CATS, FREQ, unitLabel, refName, refOpts, balance, memberPaid, supplierPaid, supplierBought, projectCost, projectIncome, stockMap, instRem, instState, tafqeet, normInst, addPay, byDue, ctPaid, ctRem, unpaid, nextInst, ctState, overdueCount, genInsts, saveContract, deleteContract, contractOfUnit, alerts, loadDemo, alertDays });
})(window);
