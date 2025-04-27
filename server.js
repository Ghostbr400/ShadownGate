const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const port = process.env.PORT || 3000;

// Configurações do Supabase
const supabase = createClient(
  'https://nwoswxbtlquiekyangbs.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53b3N3eGJ0bHF1aWVreWFuZ2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ3ODEwMjcsImV4cCI6MjA2MDM1NzAyN30.KarBv9AopQpldzGPamlj3zu9eScKltKKHH2JJblpoCE'
);

// Configurações do Xtream
const XTREAM_CONFIG = {
  host: 'sigcine1.space',
  port: 80,
  username: '474912714',
  password: '355591139'
};

// Cache em memória
const memoryCache = {
  movies: null,
  series: null,
  lastUpdated: null,
  projects: new Map()
};

// Middlewares
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Atualizar cache
async function updateCache() {
  try {
    console.log('Atualizando cache...');
    
    const [moviesRes, seriesRes] = await Promise.all([
      fetch(`http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_vod_streams`),
      fetch(`http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_series`)
    ]);

    memoryCache.movies = await moviesRes.json();
    memoryCache.series = await seriesRes.json();
    memoryCache.lastUpdated = new Date();
    
    console.log('Cache atualizado com sucesso!');
  } catch (err) {
    console.error('Erro ao atualizar cache:', err);
  }
}

// Verificar projeto
async function verifyProject(req, res, next) {
  const projectId = req.params.id;
  
  try {
    // Verificar cache primeiro
    if (memoryCache.projects.has(projectId)) {
      const project = memoryCache.projects.get(projectId);
      req.isPremium = project.is_premium;
      return next();
    }

    const { data: project, error } = await supabase
      .from('user_projects')
      .select('is_premium')
      .eq('project_id', projectId)
      .single();

    if (error || !project) {
      return res.status(404).json({ error: 'Projeto não encontrado' });
    }

    // Armazenar no cache
    memoryCache.projects.set(projectId, project);
    req.isPremium = project.is_premium;
    next();
  } catch (err) {
    res.status(500).json({ error: 'Erro ao verificar projeto' });
  }
}

// Rotas de filmes
app.get('/api/:id/filmes', verifyProject, async (req, res) => {
  try {
    const projectId = req.params.id;
    
    // Se for premium e tiver cache, retornar rápido
    if (req.isPremium && memoryCache.movies) {
      const filmesComLinks = memoryCache.movies.map(filme => ({
        ...filme,
        player: `${req.protocol}://${req.get('host')}/player.html?projectId=${projectId}&streamId=${filme.stream_id}`,
        stream_icon: `${req.protocol}://${req.get('host')}/api/${projectId}/icon/${filme.stream_id}`
      }));
      
      return res.json({
        status: 'success',
        data: filmesComLinks,
        cached: true,
        lastUpdated: memoryCache.lastUpdated
      });
    }

    // Se não for premium, buscar normalmente
    const response = await fetch(`http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_vod_streams`);
    const filmesData = await response.json();
    
    const filmesComLinks = filmesData.map(filme => ({
      ...filme,
      player: `${req.protocol}://${req.get('host')}/player.html?projectId=${projectId}&streamId=${filme.stream_id}`,
      stream_icon: `${req.protocol}://${req.get('host')}/api/${projectId}/icon/${filme.stream_id}`
    }));

    res.json({
      status: 'success',
      data: filmesComLinks
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rotas de séries
app.get('/api/:id/series', verifyProject, async (req, res) => {
  try {
    const projectId = req.params.id;
    
    if (req.isPremium && memoryCache.series) {
      const seriesComLinks = memoryCache.series.map(serie => ({
        ...serie,
        player: `${req.protocol}://${req.get('host')}/player.html?projectId=${projectId}&seriesId=${serie.series_id}`,
        cover: `${req.protocol}://${req.get('host')}/api/${projectId}/icon/${serie.series_id}`
      }));
      
      return res.json({
        status: 'success',
        data: seriesComLinks,
        cached: true,
        lastUpdated: memoryCache.lastUpdated
      });
    }

    const response = await fetch(`http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_series`);
    const seriesData = await response.json();
    
    const seriesComLinks = seriesData.map(serie => ({
      ...serie,
      player: `${req.protocol}://${req.get('host')}/player.html?projectId=${projectId}&seriesId=${serie.series_id}`,
      cover: `${req.protocol}://${req.get('host')}/api/${projectId}/icon/${serie.series_id}`
    }));

    res.json({
      status: 'success',
      data: seriesComLinks
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Rotas de temporadas e episódios
app.get('/api/:id/series/:seriesId/seasons', verifyProject, async (req, res) => {
  try {
    const { seriesId } = req.params;
    const response = await fetch(`http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_series_info&series_id=${seriesId}`);
    const seriesInfo = await response.json();
    
    const seasons = seriesInfo.episodes ? Object.keys(seriesInfo.episodes).map(seasonNumber => ({
      season: seasonNumber,
      episodesCount: seriesInfo.episodes[seasonNumber].length
    })) : [];

    res.json({
      status: 'success',
      data: seasons
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Stream direto
app.get('/api/:id/stream-direct/:streamId', verifyProject, async (req, res) => {
  try {
    const { streamId } = req.params;
    const realStreamUrl = `http://${XTREAM_CONFIG.host}:${XTREAM_CONFIG.port}/movie/${XTREAM_CONFIG.username}/${XTREAM_CONFIG.password}/${streamId}.mp4`;
    
    res.redirect(realStreamUrl);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Player
app.get('/player.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'player.html'));
});

// Iniciar servidor
app.listen(port, async () => {
  console.log(`Servidor rodando na porta ${port}`);
  
  // Pré-carregar dados
  await updateCache();
  
  // Atualizar cache a cada 30 minutos
  setInterval(updateCache, 1800000);
});
