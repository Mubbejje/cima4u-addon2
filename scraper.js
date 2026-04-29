const axios = require('axios');
const NodeCache = require('node-cache');

const cache = new NodeCache({ stdTTL: 1800 });

const DOMAINS = [
  'https://c4u.top',
  'https://cima4u1.c4u.cam',
  'https://w17.c4u.cam',
];

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/html, */*',
  'Accept-Language': 'ar,en;q=0.9',
};

let workingDomain = null;

async function findWorkingDomain() {
  if (workingDomain) return workingDomain;
  for (const domain of DOMAINS) {
    try {
      const res = await axios.get(`${domain}/wp-json/wp/v2/posts?per_page=1`, {
        headers: HEADERS, timeout: 8000,
      });
      if (res.status === 200 && Array.isArray(res.data)) {
        workingDomain = domain;
        console.log(`[OK] Working domain: ${domain}`);
        return domain;
      }
    } catch (e) {
      console.log(`[FAIL] ${domain}: ${e.message}`);
    }
  }
  workingDomain = DOMAINS[0];
  return workingDomain;
}

async function fetchAPI(endpoint) {
  const cacheKey = `api_${endpoint}`;
  const cached = cache.get(cacheKey);
  if (cached) return cached;
  const domain = await findWorkingDomain();
  try {
    const res = await axios.get(`${domain}${endpoint}`, { headers: HEADERS, timeout: 12000 });
    cache.set(cacheKey, res.data);
    return res.data;
  } catch (e) {
    console.error(`[API] ${e.message}`);
    return null;
  }
}

function wpPostToMeta(post, type) {
  if (!post) return null;
  const id = 'cima4u_' + post.id;
  const title = post.title?.rendered?.replace(/<[^>]*>/g, '') || 'بدون عنوان';
  const poster = post._embedded?.['wp:featuredmedia']?.[0]?.source_url || post.jetpack_featured_media_url || '';
  const desc = post.excerpt?.rendered?.replace(/<[^>]*>/g, '') || '';
  const year = post.date ? new Date(post.date).getFullYear() : undefined;
  return { id, type, name: title, poster, description: desc, year, _url: post.link || '', _wpId: post.id };
}

async function getCatalog(catalogId, skip = 0) {
  const page = Math.floor(skip / 20) + 1;
  const type = catalogId.includes('series') ? 'series' : 'movie';
  const endpoint = `/wp-json/wp/v2/posts?per_page=20&page=${page}&_embed=1`;
  const data = await fetchAPI(endpoint);
  if (!data || !Array.isArray(data)) return [];
  return data.map(post => wpPostToMeta(post, type)).filter(Boolean);
}

async function search(query) {
  const endpoint = `/wp-json/wp/v2/posts?search=${encodeURIComponent(query)}&per_page=20&_embed=1`;
  const data = await fetchAPI(endpoint);
  if (!data || !Array.isArray(data)) return [];
  return data.map(post => wpPostToMeta(post, 'movie')).filter(Boolean);
}

async function getMetaFromWpId(wpId, type) {
  const post = await fetchAPI(`/wp-json/wp/v2/posts/${wpId}?_embed=1`);
  return post ? wpPostToMeta(post, type) : null;
}

async function getStreams(url, wpId) {
  const streams = [];
  if (wpId) {
    const post = await fetchAPI(`/wp-json/wp/v2/posts/${wpId}`);
    if (post?.content?.rendered) {
      const content = post.content.rendered;
      const mp4 = content.match(/["'](https?:\/\/[^"']+\.mp4[^"']*)['"]/g) || [];
      const m3u8 = content.match(/["'](https?:\/\/[^"']+\.m3u8[^"']*)['"]/g) || [];
      for (const m of mp4.slice(0, 2)) streams.push({ name: '🎬 Cima4u', title: 'مشاهدة مباشرة', url: m.replace(/['"]/g, '') });
      for (const m of m3u8.slice(0, 2)) streams.push({ name: '📡 HLS', title: 'بث مباشر', url: m.replace(/['"]/g, '') });
    }
  }
  if (url) streams.push({ name: '🌐 فتح في المتصفح', title: 'Cima4u', externalUrl: url, behaviorHints: { notWebReady: true } });
  return streams;
}

const urlStore = new Map();
const wpIdStore = new Map();
function storeUrl(id, url, wpId) { if (url) urlStore.set(id, url); if (wpId) wpIdStore.set(id, wpId); }
function getUrl(id) { return urlStore.get(id) || null; }
function getWpId(id) { return wpIdStore.get(id) || null; }

module.exports = { getCatalog, search, getMetaFromWpId, getStreams, storeUrl, getUrl, getWpId };
