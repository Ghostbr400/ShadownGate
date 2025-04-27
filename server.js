const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const { promisify } = require('util');
const { gzip } = require('zlib');
const fetch = require('node-fetch');

const gzipAsync = promisify(gzip);
const app = express();
const PORT = process.env.PORT || 3000;

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://nwoswxbtlquiekyangbs.supabase.co',
  process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53b3N3eGJ0bHF1aWVreWFuZ2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ3ODEwMjcsImV4cCI6MjA2MDM1NzAyN30.KarBv9AopQpldzGPamlj3zu9eScKltKKHH2JJblpoCE',
  { persistSession: false }
);

const XTREAM_CONFIG = {
  host: process.env.XTREAM_HOST || 'sigcine1.space',
  port: process.env.XTREAM_PORT || 80,
  username: process.env.XTREAM_USER || '474912714',
  password: process.env.XTREAM_PASS || '355591139'
};

const cache = {
  movies: null,
  series: null,
  lastUpdated: null,
  projects: new Map(),
  stats: { hits: 0, misses: 0 }
};

async function loadCache() {
  try {
    console.time('[CACHE] Loading');
    const { data: projects } = await supabase
      .from('user_projects')
      .select('project_id, is_premium')
      .eq('is_premium', true);

    projects.forEach(p => cache.projects.set(p.project_id, true));

    const [moviesRes, seriesRes] = await Promise.all([
      fetch(`http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_vod_streams`),
      fetch(`http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_series`)
    ]);

    cache.movies = await moviesRes.json();
    cache.series = await seriesRes.json();
    cache.lastUpdated = new Date();
    console.timeEnd('[CACHE] Loading');
  } catch (err) {
    console.error('Cache load error:', err);
  }
}

setInterval(loadCache, 5 * 60 * 1000);

app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: '1h',
  immutable: true
}));

async function isPremium(projectId) {
  if (cache.projects.has(projectId)) {
    cache.stats.hits++;
    return true;
  }

  cache.stats.misses++;
  const { data: project } = await supabase
    .from('user_projects')
    .select('is_premium')
    .eq('project_id', projectId)
    .single();

  if (project?.is_premium) {
    cache.projects.set(projectId, true);
    return true;
  }

  return false;
}

app.get('/api/:id/filmes', async (req, res) => {
  try {
    const projectId = req.params.id;
    const premium = await isPremium(projectId);

    if (premium && cache.movies) {
      const data = cache.movies.map(movie => ({
        ...movie,
        player: `${req.protocol}://${req.get('host')}/player.html?projectId=${projectId}&streamId=${movie.stream_id}`
      }));

      const compressed = await gzipAsync(JSON.stringify({ status: 'success', data }));
      
      return res
        .set({
          'Content-Encoding': 'gzip',
          'Content-Type': 'application/json',
          'X-Cache': 'HIT'
        })
        .send(compressed);
    }

    const response = await fetch(`http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_vod_streams`);
    const data = await response.json();

    res.json({ status: 'success', data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/:id/series', async (req, res) => {
  try {
    const projectId = req.params.id;
    const premium = await isPremium(projectId);

    if (premium && cache.series) {
      const data = cache.series.map(serie => ({
        ...serie,
        player: `${req.protocol}://${req.get('host')}/player.html?projectId=${projectId}&seriesId=${serie.series_id}`
      }));

      return res.json({ status: 'success', data, cached: true });
    }

    const response = await fetch(`http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_series`);
    const data = await response.json();

    res.json({ status: 'success', data });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/player.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'player.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

loadCache().then(() => {
  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
});
