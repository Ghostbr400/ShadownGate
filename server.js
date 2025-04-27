const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const port = process.env.PORT || 3000;

// Configurações otimizadas
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

// Cache em memória ultra-rápido
const premiumCache = {
  data: {
    movies: null,
    series: null,
    lastFetch: null
  },
  projects: new Map(),
  
  // Pré-carrega dados para todos os projetos premium
  async initialize() {
    try {
      console.time('[Premium] Cache initialization');
      
      // Carrega todos os projetos premium de uma vez
      const { data: projects } = await supabase
        .from('user_projects')
        .select('project_id, is_premium')
        .eq('is_premium', true);
      
      projects.forEach(p => this.projects.set(p.project_id, p));
      
      // Carrega dados do Xtream uma única vez
      const [moviesRes, seriesRes] = await Promise.all([
        fetch(`http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_vod_streams`),
        fetch(`http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_series`)
      ]);
      
      this.data.movies = await moviesRes.json();
      this.data.series = await seriesRes.json();
      this.data.lastFetch = Date.now();
      
      console.timeEnd('[Premium] Cache initialization');
      console.log(`[Premium] Cache loaded with ${this.data.movies.length} movies and ${this.data.series.length} series`);
    } catch (err) {
      console.error('[Premium] Initialization error:', err);
    }
  },
  
  // Atualização periódica
  async refresh() {
    try {
      console.time('[Premium] Cache refresh');
      const [moviesRes, seriesRes] = await Promise.all([
        fetch(`http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_vod_streams`),
        fetch(`http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_series`)
      ]);
      
      this.data.movies = await moviesRes.json();
      this.data.series = await seriesRes.json();
      this.data.lastFetch = Date.now();
      
      console.timeEnd('[Premium] Cache refresh');
    } catch (err) {
      console.error('[Premium] Refresh error:', err);
    }
  }
};

// Middlewares otimizados
app.use(express.json({ limit: '10kb' }));
app.use(express.static(path.join(__dirname, 'public'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1h' : '0'
}));

// Verificação premium ultra-rápida
async function verifyPremium(projectId) {
  // Verifica no cache primeiro (95% dos casos)
  if (premiumCache.projects.has(projectId)) {
    return { isPremium: true, cached: true };
  }
  
  // Verificação rápida no Supabase (5% dos casos)
  const { data: project } = await supabase
    .from('user_projects')
    .select('is_premium')
    .eq('project_id', projectId)
    .single();
  
  return { isPremium: project?.is_premium || false, cached: false };
}

// Rotas premium otimizadas

/**
 * @api {get} /api/:id/filmes Listar filmes (Premium Optimized)
 * @apiName GetFilmesPremium
 * @apiGroup Premium
 */
app.get('/api/:id/filmes', async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const { isPremium, cached } = await verifyPremium(projectId);
    
    // Resposta ultra-rápida para premium
    if (isPremium && premiumCache.data.movies) {
      const filmes = premiumCache.data.movies.map(f => ({
        ...f,
        player: `${req.protocol}://${req.get('host')}/player.html?projectId=${projectId}&streamId=${f.stream_id}`,
        stream_icon: `${req.protocol}://${req.get('host')}/api/${projectId}/icon/${f.stream_id}`
      }));
      
      return res.json({
        status: 'success',
        data: filmes,
        cached: true,
        premium: true,
        performance: `${Date.now() - req.startTime}ms`
      });
    }
    
    // Fallback para não-premium
    const response = await fetch(`http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_vod_streams`);
    const data = await response.json();
    
    res.json({
      status: 'success',
      data: data.map(f => ({
        ...f,
        player: `${req.protocol}://${req.get('host')}/player.html?projectId=${projectId}&streamId=${f.stream_id}`,
        stream_icon: `${req.protocol}://${req.get('host')}/api/${projectId}/icon/${f.stream_id}`
      })),
      premium: false,
      performance: `${Date.now() - req.startTime}ms`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * @api {get} /api/:id/series Listar séries (Premium Optimized)
 * @apiName GetSeriesPremium
 * @apiGroup Premium
 */
app.get('/api/:id/series', async (req, res) => {
  try {
    const { id: projectId } = req.params;
    const { isPremium, cached } = await verifyPremium(projectId);
    
    if (isPremium && premiumCache.data.series) {
      const series = premiumCache.data.series.map(s => ({
        ...s,
        player: `${req.protocol}://${req.get('host')}/player.html?projectId=${projectId}&seriesId=${s.series_id}`,
        cover: `${req.protocol}://${req.get('host')}/api/${projectId}/icon/${s.series_id}`
      }));
      
      return res.json({
        status: 'success',
        data: series,
        cached: true,
        premium: true,
        performance: `${Date.now() - req.startTime}ms`
      });
    }
    
    const response = await fetch(`http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_series`);
    const data = await response.json();
    
    res.json({
      status: 'success',
      data: data.map(s => ({
        ...s,
        player: `${req.protocol}://${req.get('host')}/player.html?projectId=${projectId}&seriesId=${s.series_id}`,
        cover: `${req.protocol}://${req.get('host')}/api/${projectId}/icon/${s.series_id}`
      })),
      premium: false,
      performance: `${Date.now() - req.startTime}ms`
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Middleware de timing
app.use((req, res, next) => {
  req.startTime = Date.now();
  next();
});

// Inicialização do servidor
async function startServer() {
  await premiumCache.initialize();
  
  app.listen(port, () => {
    console.log(`Server running on port ${port}`);
    
    // Atualização periódica do cache
    setInterval(() => premiumCache.refresh(), 30 * 60 * 1000); // 30 minutos
  });
}

startServer().catch(err => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
