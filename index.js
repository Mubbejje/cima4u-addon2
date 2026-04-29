const express = require('express');
const cors = require('cors');
const path = require('path');
const scraper = require('./scraper');
const manifest = require('./manifest.json');

const app = express();
const PORT = process.env.PORT || 7860;

app.use(cors());
app.use(express.json());

function respond(res, data) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'max-age=900, stale-while-revalidate=3600');
  res.json(data);
}

app.get('/', (req, res) => {
  res.send(`<html dir="rtl"><body style="font-family:Arial;text-align:center;padding:40px;background:#111;color:#fff">
    <h1>🎬 سيما فور يو - Addon</h1>
    <p>الإضافة تعمل بنجاح ✅</p>
    <p>رابط التثبيت:</p>
    <code style="background:#333;padding:10px;border-radius:8px;display:block;margin:20px auto;max-width:500px">
      ${req.protocol}://${req.get('host')}/manifest.json
    </code>
    <a href="/manifest.json" style="color:#f5c842">عرض الـ manifest</a>
  </body></html>`);
});

app.get('/manifest.json', (req, res) => res.json(manifest));

// Catalog
app.get('/catalog/:type/:id.json', handleCatalog);
app.get('/catalog/:type/:id/skip=:skip.json', handleCatalog);
app.get('/catalog/:type/:id/search=:search.json', handleSearch);

async function handleCatalog(req, res) {
  const { type, id } = req.params;
  const skip = parseInt(req.params.skip || 0);
  try {
    const items = await scraper.getCatalog(id, skip);
    const metas = items.filter(i => i?.name).map(item => {
      scraper.storeUrl(item.id, item._url, item._wpId);
      return { id: item.id, type: item.type || type, name: item.name, poster: item.poster || '', year: item.year, description: item.description };
    });
    respond(res, { metas });
  } catch (e) {
    console.error('[Catalog]', e.message);
    respond(res, { metas: [] });
  }
}

async function handleSearch(req, res) {
  const { type } = req.params;
  const query = decodeURIComponent(req.params.search || '');
  try {
    const items = await scraper.search(query);
    const metas = items.filter(i => i?.name).map(item => {
      scraper.storeUrl(item.id, item._url, item._wpId);
      return { id: item.id, type: item.type || type, name: item.name, poster: item.poster || '', year: item.year };
    });
    respond(res, { metas });
  } catch (e) {
    respond(res, { metas: [] });
  }
}

// Meta
app.get('/meta/:type/:id.json', async (req, res) => {
  const { type, id } = req.params;
  const wpId = scraper.getWpId(id);
  if (!wpId) return respond(res, { meta: { id, type, name: 'غير متوفر' } });
  try {
    const meta = await scraper.getMetaFromWpId(wpId, type);
    if (meta) { scraper.storeUrl(meta.id, meta._url, meta._wpId); respond(res, { meta }); }
    else respond(res, { meta: { id, type } });
  } catch (e) {
    respond(res, { meta: { id, type } });
  }
});

// Stream
app.get('/stream/:type/:id.json', async (req, res) => {
  const { id } = req.params;
  const url = scraper.getUrl(id);
  const wpId = scraper.getWpId(id);
  try {
    const streams = await scraper.getStreams(url, wpId);
    respond(res, { streams });
  } catch (e) {
    respond(res, { streams: [] });
  }
});

app.listen(PORT, () => {
  console.log(`🎬 Cima4u Addon running on port ${PORT}`);
  console.log(`📦 Manifest: http://localhost:${PORT}/manifest.json`);
});
