import express from 'express';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

// Configuração do diretório
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

// Configurações do Supabase
const supabase = createClient(
  'https://nwoswxbtlquiekyangbs.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53b3N3eGJ0bHF1aWVreWFuZ2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ3ODEwMjcsImV4cCI6MjA2MDM1NzAyN30.KarBv9AopQpldzGPamlj3zu9eScKltKKHH2JJblpoCE'
);

// Configurações Xtream
const XTREAM_CONFIG = {
  host: 'sigcine1.space',
  port: 80,
  username: '898333270',
  password: '473536847'
};

// Sistema de Cache
const cache = {
  movies: null,
  series: null,
  liveTv: null,
  movieCategories: null,
  seriesCategories: null,
  liveCategories: null,
  lastUpdated: null
};

// Atualiza todos os caches
async function updateAllCache() {
  try {
    console.log('Atualizando cache...');
    const [
      moviesRes, 
      seriesRes, 
      liveRes, 
      movieCatRes, 
      seriesCatRes, 
      liveCatRes
    ] = await Promise.all([
      fetch(`http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_vod_streams`),
      fetch(`http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_series`),
      fetch(`http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_live_streams`),
      fetch(`http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_vod_categories`),
      fetch(`http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_series_categories`),
      fetch(`http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_live_categories`)
    ]);

    cache.movies = await moviesRes.json();
    cache.series = await seriesRes.json();
    cache.liveTv = await liveRes.json();
    cache.movieCategories = await movieCatRes.json();
    cache.seriesCategories = await seriesCatRes.json();
    cache.liveCategories = await liveCatRes.json();
    cache.lastUpdated = new Date();
    console.log('Cache atualizado com sucesso!');
  } catch (err) {
    console.error('Erro ao atualizar cache:', err);
  }
}

// Middlewares
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Rotas da API

// 1. Rotas de Filmes
app.get('/api/movies', async (req, res) => {
  try {
    if (!cache.movies) await updateAllCache();
    res.json({
      status: 'success',
      data: cache.movies,
      lastUpdated: cache.lastUpdated
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

app.get('/api/movies/categories', async (req, res) => {
  try {
    if (!cache.movieCategories) await updateAllCache();
    res.json({
      status: 'success',
      data: cache.movieCategories,
      lastUpdated: cache.lastUpdated
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

app.get('/api/movies/category/:id', async (req, res) => {
  try {
    if (!cache.movies) await updateAllCache();
    const movies = cache.movies.filter(m => m.category_id == req.params.id);
    res.json({ status: 'success', data: movies });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// 2. Rotas de Séries
app.get('/api/series', async (req, res) => {
  try {
    if (!cache.series) await updateAllCache();
    res.json({
      status: 'success',
      data: cache.series,
      lastUpdated: cache.lastUpdated
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

app.get('/api/series/categories', async (req, res) => {
  try {
    if (!cache.seriesCategories) await updateAllCache();
    res.json({
      status: 'success',
      data: cache.seriesCategories,
      lastUpdated: cache.lastUpdated
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// 3. Rotas de TV Ao Vivo
app.get('/api/live', async (req, res) => {
  try {
    if (!cache.liveTv) await updateAllCache();
    res.json({
      status: 'success',
      data: cache.liveTv,
      lastUpdated: cache.lastUpdated
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

app.get('/api/live/categories', async (req, res) => {
  try {
    if (!cache.liveCategories) await updateAllCache();
    res.json({
      status: 'success',
      data: cache.liveCategories,
      lastUpdated: cache.lastUpdated
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

app.get('/api/live/category/:id', async (req, res) => {
  try {
    if (!cache.liveTv) await updateAllCache();
    const channels = cache.liveTv.filter(c => c.category_id == req.params.id);
    res.json({ status: 'success', data: channels });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// 4. Rotas de Stream
app.get('/api/stream/movie/:id', (req, res) => {
  const streamUrl = `http://${XTREAM_CONFIG.host}:${XTREAM_CONFIG.port}/movie/${XTREAM_CONFIG.username}/${XTREAM_CONFIG.password}/${req.params.id}.mp4`;
  res.redirect(streamUrl);
});

app.get('/api/stream/live/:id.m3u8', (req, res) => {
  const streamUrl = `http://${XTREAM_CONFIG.host}:${XTREAM_CONFIG.port}/${XTREAM_CONFIG.username}/${XTREAM_CONFIG.password}/${req.params.id}/index.m3u8`;
  res.redirect(streamUrl);
});

app.get('/api/stream/series/:id', (req, res) => {
  const streamUrl = `http://${XTREAM_CONFIG.host}:${XTREAM_CONFIG.port}/series/${XTREAM_CONFIG.username}/${XTREAM_CONFIG.password}/${req.params.id}.mp4`;
  res.redirect(streamUrl);
});

// 5. Rotas de Informação
app.get('/api/info', async (req, res) => {
  try {
    const response = await fetch(`http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_user_info`);
    res.json({ status: 'success', data: await response.json() });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// 6. Rotas do Player
app.get('/player', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'player.html'));
});

// 7. Rota principal
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Atualiza cache a cada 5 minutos
setInterval(updateAllCache, 5 * 60 * 1000);

// Inicialização
updateAllCache().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor rodando na porta ${PORT}`);
    console.log(`Acesse: http://localhost:${PORT}`);
  });
});
