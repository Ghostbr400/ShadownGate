import express from 'express';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

// Configuração do __dirname para ES Modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://nwoswxbtlquiekyangbs.supabase.co',
  process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53b3N3eGJ0bHF1aWVreWFuZ2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ3ODEwMjcsImV4cCI6MjA2MDM1NzAyN30.KarBv9AopQpldzGPamlj3zu9eScKltKKHH2JJblpoCE'
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
  projects: new Map()
};

async function loadCache() {
  try {
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
  } catch (err) {
    console.error('Erro ao carregar cache:', err);
  }
}

setInterval(loadCache, 5 * 60 * 1000);

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function isPremium(projectId) {
  if (cache.projects.has(projectId)) return true;
  
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
      return res.json({
        data: cache.movies.map(m => ({
          ...m,
          player: `${req.protocol}://${req.get('host')}/player.html?projectId=${projectId}&streamId=${m.stream_id}`
        })),
        cached: true
      });
    }

    const response = await fetch(`http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_vod_streams`);
    res.json({ data: await response.json() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/:id/filmes/q', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Parâmetro "q" obrigatório' });

    if (!isNaN(query)) {
      const tmdbResponse = await fetch(`https://api.themoviedb.org/3/movie/${query}?api_key=c0d0e0e40bae98909390cde31c402a9b&language=pt-BR`);
      if (!tmdbResponse.ok) return res.status(404).json({ error: 'Filme não encontrado' });
      const filme = await tmdbResponse.json();
      return res.json({ data: filme });
    }

    const tmdbSearchResponse = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=c0d0e0e40bae98909390cde31c402a9b&language=pt-BR&query=${encodeURIComponent(query)}`);
    res.json({ data: await tmdbSearchResponse.json() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/:id/series', async (req, res) => {
  try {
    const projectId = req.params.id;
    const premium = await isPremium(projectId);

    if (premium && cache.series) {
      return res.json({
        data: cache.series.map(s => ({
          ...s,
          player: `${req.protocol}://${req.get('host')}/player.html?projectId=${projectId}&seriesId=${s.series_id}`
        })),
        cached: true
      });
    }

    const response = await fetch(`http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_series`);
    res.json({ data: await response.json() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/:id/series/:seriesId/seasons', async (req, res) => {
  try {
    const { seriesId } = req.params;
    const response = await fetch(`http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_series_info&series_id=${seriesId}`);
    const data = await response.json();
    res.json({ data: Object.keys(data.episodes || {}).map(season => ({ season })) });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/:id/series/:seriesId/season/:seasonNumber', async (req, res) => {
  try {
    const { seriesId, seasonNumber } = req.params;
    const response = await fetch(`http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_series_info&series_id=${seriesId}`);
    const data = await response.json();
    res.json({ data: (data.episodes && data.episodes[seasonNumber]) || [] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/:id/stream-direct/:streamId', async (req, res) => {
  try {
    const { streamId } = req.params;
    res.redirect(`http://${XTREAM_CONFIG.host}:${XTREAM_CONFIG.port}/movie/${XTREAM_CONFIG.username}/${XTREAM_CONFIG.password}/${streamId}.mp4`);
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
    console.log(`Servidor rodando na porta ${PORT}`);
  });
});
