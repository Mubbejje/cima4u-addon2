# 🎬 سيما فور يو — Cima4u Stremio & Nuvio Addon

إضافة عربية لمشاهدة الأفلام والمسلسلات من موقع سيما فور يو على Stremio وNuvio.

## ✨ المميزات
- 🎭 أفلام عربية وأجنبية مترجمة
- 📺 مسلسلات عربية وعالمية
- 🔍 بحث بالعربي أو الإنجليزي
- ⚡ مشاهدة مباشرة بدون تسجيل
- 📱 يشتغل على كل الأجهزة

## 🚀 تشغيل محلي

```bash
npm install
npm start
# يشتغل على http://localhost:7860
```

## 🌐 نشر مجاني على Render.com

1. ارفع الكود على GitHub
2. اذهب إلى [render.com](https://render.com)
3. New → Web Service → اختر المستودع
4. يشتغل تلقائياً!

## 📦 التثبيت في Stremio/Nuvio

افتح صفحة الويب بعد التشغيل واضغط زر التثبيت، أو الصق رابط الـ manifest يدوياً:

```
http://YOUR-SERVER/manifest.json
```

## 📁 هيكل المشروع

```
cima4u-addon/
├── src/
│   ├── index.js       # السيرفر الرئيسي
│   ├── scraper.js     # جلب البيانات من الموقع
│   └── manifest.json  # معلومات الإضافة
├── public/
│   └── index.html     # صفحة التثبيت
├── Dockerfile
├── render.yaml
└── package.json
```
