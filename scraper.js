const axios = require('axios');
const cheerio = require('cheerio');
const NodeCache = require('node-cache');

const cache = new NodeCache({ stdTTL: 1800 }); // 30 min cache

const BASE_URL = 'https://cima4u1.c4u.cam';
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'ar,en-US;q=0.9,en;q=0.8',
  'Referer': 'https://c4u.top/',
};

async function fetchPage(url) {
  const cached = cache.get(url);
  if (cached) return cached;
  try {
    const res = await axios.get(url, { headers: HEADERS, timeout: 15000 });
    cache.set(url, res.data);
    return res.data;
  } catch (e) {
    console.error(`[Scraper] Error fetching ${url}: ${e.message}`);
    return null;
  }
}

function parseMovieMeta($, el) {
  const $el = $(el);
  const link = $el.find('a').first().attr('href') || '';
  const title = $el.find('.BlockTitle, h3, .Title, .block-title, .entry-title, h2').first().text().trim()
    || $el.find('a').first().attr('title') || '';
  const poster = $el.find('img').first().attr('data-src')
    || $el.find('img').first().attr('src') || '';
  const year = $el.find('.Year, .year, .singleRating, time').first().text().trim().match(/\d{4}/)?.[0] || '';
  const rating = $el.find('.imdbRating, .rating, .Rate span').first().text().trim() || '';
  const type = link.includes('/series/') || link.includes('/مسلسل') || link.includes('/tvshows/') ? 'series' : 'movie';

  if (!link || !title) return null;

  const id = 'cima4u_' + Buffer.from(link).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 40);

  return {
    id,
    type,
    name: title,
    poster: poster.startsWith('http') ? poster : (poster ? BASE_URL + poster : ''),
    year: year ? parseInt(year) : undefined,
    imdbRating: rating || undefined,
    description: title,
    _url: link,
  };
}

async function getCatalog(catalogId, skip = 0) {
  const page = Math.floor(skip / 20) + 1;
  let url;

  switch (catalogId) {
    case 'cima4u_movies_latest':
      url = `${BASE_URL}/category/movies/page/${page}/`;
      break;
    case 'cima4u_movies_arabic':
      url = `${BASE_URL}/category/arabic-movies/page/${page}/`;
      break;
    case 'cima4u_movies_foreign':
      url = `${BASE_URL}/category/foreign-movies/page/${page}/`;
      break;
    case 'cima4u_series_latest':
      url = `${BASE_URL}/category/series/page/${page}/`;
      break;
    case 'cima4u_series_arabic':
      url = `${BASE_URL}/category/arabic-series/page/${page}/`;
      break;
    default:
      url = `${BASE_URL}/page/${page}/`;
  }

  const html = await fetchPage(url);
  if (!html) return [];

  const $ = cheerio.load(html);
  const items = [];

  // Try multiple possible selectors for the movie grid
  const selectors = [
    '.Block--Item',
    '.MovieBlock',
    '.post-item',
    'article',
    '.movie-item',
    '.BlockItem',
    '.TvSeries',
    '.grid-item',
    '.col-xl-2',
    '.item',
  ];

  let found = false;
  for (const sel of selectors) {
    const els = $(sel);
    if (els.length > 2) {
      els.each((_, el) => {
        const meta = parseMovieMeta($, el);
        if (meta) items.push(meta);
      });
      found = true;
      break;
    }
  }

  if (!found) {
    // Fallback: grab all article links
    $('a[href]').each((_, el) => {
      const href = $(el).attr('href') || '';
      if (!href.includes(BASE_URL)) return;
      const img = $(el).find('img').first();
      const title = $(el).attr('title') || img.attr('alt') || '';
      const poster = img.attr('data-src') || img.attr('src') || '';
      if (!title || !poster) return;
      const id = 'cima4u_' + Buffer.from(href).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 40);
      items.push({
        id,
        type: href.includes('series') ? 'series' : 'movie',
        name: title,
        poster,
        _url: href,
      });
    });
  }

  return items;
}

async function search(query) {
  const url = `${BASE_URL}/?s=${encodeURIComponent(query)}`;
  const html = await fetchPage(url);
  if (!html) return [];
  const $ = cheerio.load(html);
  const items = [];

  const selectors = ['.Block--Item', '.MovieBlock', 'article', '.movie-item', '.post-item'];
  for (const sel of selectors) {
    const els = $(sel);
    if (els.length > 0) {
      els.each((_, el) => {
        const meta = parseMovieMeta($, el);
        if (meta) items.push(meta);
      });
      break;
    }
  }
  return items;
}

async function getMeta(id) {
  // id => base64 encoded URL stored in catalog
  // We need to find the original URL from the id
  // Since we can't decode perfectly, try fetching from cache
  const cacheKey = `meta_${id}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;

  // Try to find in recent catalogs — fallback: search
  return null;
}

async function getMetaFromUrl(url, type) {
  const html = await fetchPage(url);
  if (!html) return null;
  const $ = cheerio.load(html);

  const title = $('h1.Title, h1.post-title, h1, .Title').first().text().trim()
    || $('title').text().replace(/[-|].*$/, '').trim();
  const poster = $('img.Poster, .poster img, .wp-post-image, img[itemprop="image"]').first().attr('src')
    || $('meta[property="og:image"]').attr('content') || '';
  const desc = $('p.Story, .Description p, .story, [itemprop="description"], .post-content p').first().text().trim()
    || $('meta[property="og:description"]').attr('content') || '';
  const year = $('time, .Year, .year').first().text().match(/\d{4}/)?.[0] || '';
  const genres = [];
  $('.Genre a, .genres a, [itemprop="genre"]').each((_, el) => genres.push($(el).text().trim()));
  const imdbRating = $('.imdb span, .imdbRating, .RatingValue').first().text().trim() || '';
  const cast = [];
  $('.Cast a, .cast a, [itemprop="actor"] a').each((_, el) => cast.push($(el).text().trim()));

  const id = 'cima4u_' + Buffer.from(url).toString('base64').replace(/[^a-zA-Z0-9]/g, '').substring(0, 40);
  return {
    id,
    type,
    name: title,
    poster,
    description: desc,
    year: year ? parseInt(year) : undefined,
    genres,
    imdbRating: imdbRating || undefined,
    cast,
    _url: url,
  };
}

async function getStreams(url) {
  const html = await fetchPage(url);
  if (!html) return [];
  const $ = cheerio.load(html);
  const streams = [];

  // Find video iframes or direct links
  const iframeSrc = $('iframe[src*="ok.ru"], iframe[src*="drive.google"], iframe[src*="dailymotion"], iframe[src*="youtube"], iframe[src*="streamtape"], iframe[src*="voe.sx"], iframe[src*="uqload"], iframe').first().attr('src');
  
  // Find direct mp4/m3u8 links in page source
  const directMatch = html.match(/["'](https?:\/\/[^"']+\.(?:mp4|m3u8)[^"']*)['"]/g) || [];
  
  // Extract server buttons
  const serverLinks = [];
  $('a[href], .server-item a, .download-server a, .watch-server').each((_, el) => {
    const href = $(el).attr('href') || $(el).attr('data-url') || '';
    const label = $(el).text().trim() || 'سيرفر';
    if (href && (href.includes('http') || href.startsWith('/'))) {
      serverLinks.push({ href: href.startsWith('/') ? BASE_URL + href : href, label });
    }
  });

  // Add direct streams
  for (const match of directMatch.slice(0, 3)) {
    const url = match.replace(/['"]/g, '');
    if (url.includes('.mp4')) {
      streams.push({
        name: '🎬 Cima4u',
        title: 'تشغيل مباشر MP4',
        url,
        behaviorHints: { notWebReady: false },
      });
    } else if (url.includes('.m3u8')) {
      streams.push({
        name: '📡 Cima4u HLS',
        title: 'بث مباشر HLS',
        url,
        behaviorHints: { notWebReady: false },
      });
    }
  }

  // Add iframe as external player
  if (iframeSrc) {
    streams.push({
      name: '🌐 Cima4u Player',
      title: 'مشاهدة عبر المتصفح',
      externalUrl: iframeSrc.startsWith('//') ? 'https:' + iframeSrc : iframeSrc,
      behaviorHints: { notWebReady: true },
    });
  }

  // Add the page itself as a fallback
  streams.push({
    name: '🔗 Cima4u Web',
    title: 'فتح في المتصفح',
    externalUrl: url,
    behaviorHints: { notWebReady: true },
  });

  return streams;
}

// URL store: id -> url mapping (in-memory)
const urlStore = new Map();

function storeUrl(id, url) {
  urlStore.set(id, url);
}

function getUrl(id) {
  return urlStore.get(id) || null;
}

module.exports = { getCatalog, search, getMeta, getMetaFromUrl, getStreams, storeUrl, getUrl, fetchPage };
