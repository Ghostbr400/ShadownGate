import express from 'express';
import { createClient } from '@supabase/supabase-js';
import fetch from 'node-fetch';

const app = express();
const PORT = process.env.PORT || 3000;

// Configuração do Supabase
const supabase = createClient(
  process.env.SUPABASE_URL || 'https://nwoswxbtlquiekyangbs.supabase.co',
  process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53b3N3eGJ0bHF1aWVreWFuZ2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ3ODEwMjcsImV4cCI6MjA2MDM1NzAyN30.KarBv9AopQpldzGPamlj3zu9eScKltKKHH2JJblpoCE'
);

// Configuração Xtream
const XTREAM_CONFIG = {
  host: process.env.XTREAM_HOST || 'sigcine1.space',
  port: process.env.XTREAM_PORT || 80,
  username: process.env.XTREAM_USER || '474912714',
  password: process.env.XTREAM_PASS || '355591139'
};

// Sistema de Cache
const cache = {
  movies: null,
  series: null,
  projects: new Map(),
  lastUpdated: null
};

// Carrega dados iniciais
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
    cache.lastUpdated = new Date();
  } catch (err) {
    console.error('Erro ao carregar cache:', err);
  }
}

// Atualiza cache a cada 5 minutos
setInterval(loadCache, 5 * 60 * 1000);

// Middlewares
app.use(express.json());

// Verifica se é premium
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

// Rotas da API

// Lista de filmes
app.get('/api/:id/filmes', async (req, res) => {
  try {
    const projectId = req.params.id;
    const premium = await isPremium(projectId);

    if (premium && cache.movies) {
      return res.json({
        status: 'success',
        data: cache.movies,
        cached: true,
        lastUpdated: cache.lastUpdated
      });
    }

    const response = await fetch(`http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_vod_streams`);
    res.json({
      status: 'success',
      data: await response.json()
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Busca de filmes
app.get('/api/:id/filmes/q', async (req, res) => {
  try {
    const query = req.query.q;
    if (!query) return res.status(400).json({ error: 'Parâmetro "q" é obrigatório' });

    if (!isNaN(query)) {
      const tmdbResponse = await fetch(`https://api.themoviedb.org/3/movie/${query}?api_key=c0d0e0e40bae98909390cde31c402a9b&language=pt-BR`);
      if (!tmdbResponse.ok) return res.status(404).json({ error: 'Filme não encontrado' });
      return res.json({ data: await tmdbResponse.json() });
    }

    const tmdbSearchResponse = await fetch(`https://api.themoviedb.org/3/search/movie?api_key=c0d0e0e40bae98909390cde31c402a9b&language=pt-BR&query=${encodeURIComponent(query)}`);
    res.json({ data: await tmdbSearchResponse.json() });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Lista de séries
app.get('/api/:id/series', async (req, res) => {
  try {
    const projectId = req.params.id;
    const premium = await isPremium(projectId);

    if (premium && cache.series) {
      return res.json({
        status: 'success',
        data: cache.series,
        cached: true,
        lastUpdated: cache.lastUpdated
      });
    }

    const response = await fetch(`http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_series`);
    res.json({
      status: 'success',
      data: await response.json()
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Temporadas de série
app.get('/api/:id/series/:seriesId/seasons', async (req, res) => {
  try {
    const { seriesId } = req.params;
    const response = await fetch(`http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_series_info&series_id=${seriesId}`);
    const data = await response.json();
    
    const seasons = data.episodes ? Object.keys(data.episodes).map(seasonNumber => ({
      season: seasonNumber,
      episodesCount: data.episodes[seasonNumber].length
    })) : [];

    res.json({ status: 'success', data: seasons });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Episódios de temporada
app.get('/api/:id/series/:seriesId/season/:seasonNumber', async (req, res) => {
  try {
    const { seriesId, seasonNumber } = req.params;
    const response = await fetch(`http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_series_info&series_id=${seriesId}`);
    const data = await response.json();
    
    const episodes = (data.episodes && data.episodes[seasonNumber]) ? 
      data.episodes[seasonNumber].map(ep => ({
        id: ep.id,
        title: ep.title,
        episode_num: ep.episode_num
      })) : [];

    res.json({ status: 'success', data: episodes });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Stream direto (redirecionamento)
app.get('/api/:id/stream-direct/:streamId', async (req, res) => {
  try {
    const { streamId } = req.params;
    const streamUrl = `http://${XTREAM_CONFIG.host}:${XTREAM_CONFIG.port}/movie/${XTREAM_CONFIG.username}/${XTREAM_CONFIG.password}/${streamId}.mp4`;
    res.redirect(streamUrl);
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Rota de saúde
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    cache: {
      lastUpdated: cache.lastUpdated,
      movieCount: cache.movies?.length || 0,
      seriesCount: cache.series?.length || 0
    }
  });
});

// Inicialização
loadCache().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor API rodando na porta ${PORT}`);
  });
});
