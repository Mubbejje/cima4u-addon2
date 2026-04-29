const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const scraper = require('./scraper');

const app = express();
const PORT = process.env.PORT || 7860;
const manifest = require('./manifest.json');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// ─── Helper ────────────────────────────────────────────────────────────────

function respond(res, data) {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Cache-Control', 'max-age=900, stale-while-revalidate=3600');
  res.json(data);
}

// ─── Manifest ──────────────────────────────────────────────────────────────

app.get('/manifest.json', (req, res) => {
  res.json(manifest);
});

// Stremio deep-link install page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// ─── Catalog ───────────────────────────────────────────────────────────────

app.get('/catalog/:type/:id.json', handleCatalog);
app.get('/catalog/:type/:id/skip=:skip.json', handleCatalog);
app.get('/catalog/:type/:id/search=:search.json', handleSearch);

async function handleCatalog(req, res) {
  const { type, id } = req.params;
  const skip = parseInt(req.params.skip || 0);

  try {
    const items = await scraper.getCatalog(id, skip);
    const metas = items
      .filter(item => item && item.name)
      .map(item => {
        // Store URL mapping
        scraper.storeUrl(item.id, item._url);
        return {
          id: item.id,
          type: item.type || type,
          name: item.name,
          poster: item.poster || '',
          year: item.year,
          description: item.description,
          imdbRating: item.imdbRating,
        };
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
    const metas = items
      .filter(item => item && item.name)
      .map(item => {
        scraper.storeUrl(item.id, item._url);
        return {
          id: item.id,
          type: item.type || type,
          name: item.name,
          poster: item.poster || '',
          year: item.year,
        };
      });
    respond(res, { metas });
  } catch (e) {
    console.error('[Search]', e.message);
    respond(res, { metas: [] });
  }
}

// ─── Meta ──────────────────────────────────────────────────────────────────

app.get('/meta/:type/:id.json', async (req, res) => {
  const { type, id } = req.params;
  const url = scraper.getUrl(id);

  if (!url) {
    return respond(res, { meta: { id, type, name: 'غير متوفر' } });
  }

  try {
    const meta = await scraper.getMetaFromUrl(url, type);
    if (meta) {
      scraper.storeUrl(meta.id, url);
      respond(res, { meta });
    } else {
      respond(res, { meta: { id, type, name: 'غير متوفر' } });
    }
  } catch (e) {
    console.error('[Meta]', e.message);
    respond(res, { meta: { id, type } });
  }
});

// ─── Streams ───────────────────────────────────────────────────────────────

app.get('/stream/:type/:id.json', async (req, res) => {
  const { type, id } = req.params;
  const url = scraper.getUrl(id);

  if (!url) {
    return respond(res, {
      streams: [{
        name: '🔗 Cima4u',
        title: 'فتح الموقع',
        externalUrl: 'https://c4u.top',
        behaviorHints: { notWebReady: true },
      }]
    });
  }

  try {
    const streams = await scraper.getStreams(url);
    respond(res, { streams });
  } catch (e) {
    console.error('[Stream]', e.message);
    respond(res, { streams: [] });
  }
});

// ─── Start ─────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`\n🎬 Cima4u Addon running on port ${PORT}`);
  console.log(`📦 Manifest: http://localhost:${PORT}/manifest.json`);
  console.log(`🔗 Install in Stremio: stremio://localhost:${PORT}/manifest.json\n`);
});
