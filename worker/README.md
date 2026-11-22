# نشر عمران على Cloudflare (القفل على السيرفر)

البرنامج (مجلد `app/`) بيتبعت للمتصفح **بس** لو معاه جلسة صالحة. من غير دخول: صفحة الكود فقط، وأي ملف تاني 401.

## الخطوات (مرة واحدة)
1. **اقفل الريبو**: GitHub > Settings > Danger Zone > Change visibility > **Private**.
2. **اقفل GitHub Pages**: Settings > Pages > Unpublish (عشان النسخة العامة القديمة تختفي).
3. حساب Cloudflare مجاني: Workers & Pages > KV > Create namespace باسم `TRIALS`، وانسخ الـ ID وحطه في `wrangler.toml` مكان `PUT_KV_ID_HERE`.
4. Workers & Pages > Create > Import a repository > اختار `MrMina20/Mina` (Deploy command: `npx wrangler deploy`).
5. Worker > Settings > Variables and Secrets > ضيف **Secrets** (بنفسك، ما تبعتهاش لحد):
   - `DEV_PASSWORD` = كلمة سر المطور اللي تختارها (غيّرها عن اللي اتكتبت في الشات).
   - `TOKEN_SECRET` = أي نص عشوائي طويل (40 حرف+).
6. افتح `https://omran.<حسابك>.workers.dev/dev` > ادخل كلمة السر > اعمل اسم ومدة > «إنشاء الكود واللينك» > ابعت اللينك والكود للعميل.

## ملاحظات
- العدّاد بيبدأ لما العميل يدخل الكود أول مرة. الكود لجهاز واحد. الإلغاء بيقفل خلال دقيقة تقريباً.
- بيانات البرنامج بتتخزن في متصفح كل مستخدم لكل رابط. لو كنت شغال على رابط Pages القديم، نزّل نسخة احتياطية من هناك واستعيدها من الإعدادات على الرابط الجديد.
- لو غيّرت `TOKEN_SECRET` كل الجلسات بتتقفل.
