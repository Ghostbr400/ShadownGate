import express from 'express';
import { createClient } from '@supabase/supabase-js';
import path from 'path';
import { fileURLToPath } from 'url';
import fetch from 'node-fetch';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;
const VERSION = '1.0.0'; // <--- versão da API
const START_TIME = Date.now(); // <--- tempo que o servidor iniciou

const supabase = createClient(
  process.env.SUPABASE_URL || 'https://nwoswxbtlquiekyangbs.supabase.co',
  process.env.SUPABASE_KEY || 'YOUR_SUPABASE_KEY'
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

    cache.projects.clear();
    projects.forEach(p => cache.projects.set(p.project_id, true));

    const [moviesRes, seriesRes] = await Promise.all([
      fetch(`http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_vod_streams`),
      fetch(`http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_series`)
    ]);

    cache.movies = await moviesRes.json();
    cache.series = await seriesRes.json();

    console.log('Cache atualizado');
  } catch (err) {
    console.error('Erro ao carregar cache:', err);
  }
}

setInterval(loadCache, 5 * 60 * 1000); // Atualiza cache a cada 5 minutos
loadCache();

app.use(express.json());

// Função para verificar premium
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

// Rotas principais
app.get('/api/:id/filmes', async (req, res) => {
  try {
    const projectId = req.params.id;
    const premium = await isPremium(projectId);

    if (premium && cache.movies) {
      return res.json({
        data: cache.movies.map(m => ({
          ...m,
          stream_url: `${req.protocol}://${req.get('host')}/stream/movie/${m.stream_id}`
        })),
        cached: true
      });
    }

    const response = await fetch(`http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_vod_streams`);
    const movies = await response.json();

    res.json({
      data: movies.map(m => ({
        ...m,
        stream_url: `${req.protocol}://${req.get('host')}/stream/movie/${m.stream_id}`
      }))
    });
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
          details_url: `${req.protocol}://${req.get('host')}/api/${projectId}/series/${s.series_id}`
        })),
        cached: true
      });
    }

    const response = await fetch(`http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_series`);
    const series = await response.json();

    res.json({
      data: series.map(s => ({
        ...s,
        details_url: `${req.protocol}://${req.get('host')}/api/${projectId}/series/${s.series_id}`
      }))
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.get('/api/:id/series/:seriesId', async (req, res) => {
  try {
    const { seriesId } = req.params;
    const response = await fetch(`http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_series_info&series_id=${seriesId}`);
    const data = await response.json();

    if (!data.episodes) return res.status(404).json({ error: 'Nenhum episódio encontrado' });

    const seasons = Object.keys(data.episodes).map(season => ({
      season,
      episodes: data.episodes[season].map(episode => ({
        ...episode,
        stream_url: `${req.protocol}://${req.get('host')}/stream/series/${seriesId}/season/${season}/episode/${episode.id}`
      }))
    }));

    res.json({ data: seasons });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rota de stream movie
app.get('/stream/movie/:streamId', (req, res) => {
  const { streamId } = req.params;
  const url = `http://${XTREAM_CONFIG.host}:${XTREAM_CONFIG.port}/movie/${XTREAM_CONFIG.username}/${XTREAM_CONFIG.password}/${streamId}.mp4`;
  res.redirect(url);
});

// Rota de stream série
app.get('/stream/series/:seriesId/season/:season/episode/:episodeId', (req, res) => {
  const { episodeId } = req.params;
  const url = `http://${XTREAM_CONFIG.host}:${XTREAM_CONFIG.port}/series/${XTREAM_CONFIG.username}/${XTREAM_CONFIG.password}/${episodeId}.mp4`;
  res.redirect(url);
});

// ROTAS NOVAS DE STATUS / CONTROLE

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: `${Math.floor((Date.now() - START_TIME) / 1000)}s`,
    cache: {
      movies_loaded: !!cache.movies,
      series_loaded: !!cache.series,
      projects_loaded: cache.projects.size
    }
  });
});

// Informações sobre API
app.get('/info', (req, res) => {
  res.json({
    name: 'Xtream API Server',
    description: 'Servidor de filmes e séries via Xtream API + Supabase',
    version: VERSION,
    started_at: new Date(START_TIME).toISOString()
  });
});

// Versão rápida
app.get('/version', (req, res) => {
  res.json({ version: VERSION });
});

// Forçar atualização do cache
app.post('/cache/refresh', (req, res) => {
  const secret = req.query.secret || '';
  
  // Proteção básica
  if (secret !== (process.env.CACHE_REFRESH_SECRET || 'admin123')) {
    return res.status(403).json({ error: 'Acesso negado' });
  }

  loadCache()
    .then(() => res.json({ message: 'Cache atualizado com sucesso' }))
    .catch(err => res.status(500).json({ error: err.message }));
});

// Rota padrão para 404
app.use((req, res) => {
  res.status(404).send('Rota não encontrada');
});

app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
