const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const NodeCache = require('node-cache'); // Adicione este pacote

const app = express();
const port = process.env.PORT || 3000;

// Configuração do cache em memória (extremamente rápido)
const memoryCache = new NodeCache({
  stdTTL: 3600, // Tempo de vida padrão de 1 hora
  checkperiod: 600 // Verifica a cada 10 minutos
});

// Configurações existentes...
const supabaseUrl = 'https://nwoswxbtlquiekyangbs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53b3N3eGJ0bHF1aWVreWFuZ2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ3ODEwMjcsImV4cCI6MjA2MDM1NzAyN30.KarBv9AopQpldzGPamlj3zu9eScKltKKHH2JJblpoCE';
const supabase = createClient(supabaseUrl, supabaseKey);

const XTREAM_CONFIG = {
  host: 'sigcine1.space',
  port: 80,
  username: '474912714',
  password: '355591139'
};

// Middleware para verificar projeto premium
async function verifyProject(req, res, next) {
  const projectId = req.params.id;
  try {
    // Verifica se já está em cache
    const cacheKey = `project_${projectId}`;
    const cachedProject = memoryCache.get(cacheKey);
    
    if (cachedProject) {
      req.project = cachedProject;
      req.isPremium = cachedProject.is_premium || false;
      return next();
    }

    const { data: project, error } = await supabase
      .from('user_projects')
      .select('*')
      .eq('project_id', projectId)
      .single();

    if (error || !project) {
      return res.status(404).json({ status: 'error', error: 'Project not found' });
    }

    req.project = project;
    req.isPremium = project.is_premium || false;
    
    // Armazena no cache
    memoryCache.set(cacheKey, project);
    next();
  } catch (err) {
    res.status(500).json({ status: 'error', error: 'Internal server error' });
  }
}

// PRÉ-CARREGAMENTO PARA PROJETOS PREMIUM (executa ao iniciar o servidor)
async function preloadPremiumData() {
  try {
    console.log('Iniciando pré-carregamento para projetos premium...');
    
    // Busca todos os projetos premium
    const { data: premiumProjects, error } = await supabase
      .from('user_projects')
      .select('project_id')
      .eq('is_premium', true);

    if (error || !premiumProjects.length) {
      return console.log('Nenhum projeto premium encontrado para pré-carregar');
    }

    // Pré-carrega filmes e séries para cada projeto premium
    for (const project of premiumProjects) {
      const projectId = project.project_id;
      
      // Filmes
      const moviesUrl = `http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_vod_streams`;
      const moviesResponse = await fetch(moviesUrl);
      if (moviesResponse.ok) {
        const filmesData = await moviesResponse.json();
        memoryCache.set(`movies_${projectId}`, filmesData);
      }
      
      // Séries
      const seriesUrl = `http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_series`;
      const seriesResponse = await fetch(seriesUrl);
      if (seriesResponse.ok) {
        const seriesData = await seriesResponse.json();
        memoryCache.set(`series_${projectId}`, seriesData);
      }
      
      console.log(`Dados pré-carregados para projeto premium: ${projectId}`);
    }
    
    console.log('Pré-carregamento concluído!');
  } catch (err) {
    console.error('Erro no pré-carregamento:', err);
  }
}

// Rota de filmes ULTRA RÁPIDA para premium
app.get('/api/:id/filmes', verifyProject, async (req, res) => {
  try {
    const projectId = req.params.id;
    await incrementRequestCount(projectId, 'filmes');
    requestTracker.track(projectId, 'filmes');
    
    // CACHE RELÂMPAGO PARA PREMIUM
    if (req.isPremium) {
      const cachedMovies = memoryCache.get(`movies_${projectId}`);
      if (cachedMovies) {
        const filmesComLinks = cachedMovies.map(filme => ({
          ...filme,
          player: `${req.protocol}://${req.get('host')}/player.html?projectId=${projectId}&streamId=${filme.stream_id}`,
          stream_icon: `${req.protocol}://${req.get('host')}/api/${projectId}/icon/${filme.stream_id}`
        }));
        
        return res.json({
          status: 'success',
          projectId,
          timestamp: new Date().toISOString(),
          requestCount: requestTracker.getCount(projectId, 'filmes'),
          data: filmesComLinks,
          fromMemoryCache: true,
          performance: 'ultra-fast'
        });
      }
    }

    // Processamento normal para não-premium
    const apiUrl = `http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_vod_streams`;
    const apiResponse = await fetch(apiUrl);
    if (!apiResponse.ok) throw new Error('Failed to fetch movies data');
    
    const filmesData = await apiResponse.json();
    const filmesComLinks = filmesData.map(filme => ({
      ...filme,
      player: `${req.protocol}://${req.get('host')}/player.html?projectId=${projectId}&streamId=${filme.stream_id}`,
      stream_icon: `${req.protocol}://${req.get('host')}/api/${projectId}/icon/${filme.stream_id}`
    }));

    res.json({
      status: 'success',
      projectId,
      timestamp: new Date().toISOString(),
      requestCount: requestTracker.getCount(projectId, 'filmes'),
      data: filmesComLinks,
      performance: 'normal'
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: 'Internal server error', details: err.message });
  }
});

// Rota de séries ULTRA RÁPIDA para premium
app.get('/api/:id/series', verifyProject, async (req, res) => {
  try {
    const projectId = req.params.id;
    await incrementRequestCount(projectId, 'series');
    requestTracker.track(projectId, 'series');

    // CACHE RELÂMPAGO PARA PREMIUM
    if (req.isPremium) {
      const cachedSeries = memoryCache.get(`series_${projectId}`);
      if (cachedSeries) {
        const seriesComLinks = cachedSeries.map(serie => ({
          ...serie,
          player: `${req.protocol}://${req.get('host')}/player.html?projectId=${projectId}&seriesId=${serie.series_id}`,
          cover: `${req.protocol}://${req.get('host')}/api/${projectId}/icon/${serie.series_id}`
        }));
        
        return res.json({
          status: 'success',
          projectId,
          timestamp: new Date().toISOString(),
          requestCount: requestTracker.getCount(projectId, 'series'),
          data: seriesComLinks,
          fromMemoryCache: true,
          performance: 'ultra-fast'
        });
      }
    }

    // Processamento normal para não-premium
    const apiUrl = `http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_series`;
    const apiResponse = await fetch(apiUrl);
    if (!apiResponse.ok) throw new Error('Failed to fetch series data');

    const seriesData = await apiResponse.json();
    const seriesComLinks = seriesData.map(serie => ({
      ...serie,
      player: `${req.protocol}://${req.get('host')}/player.html?projectId=${projectId}&seriesId=${serie.series_id}`,
      cover: `${req.protocol}://${req.get('host')}/api/${projectId}/icon/${serie.series_id}`
    }));

    res.json({
      status: 'success',
      projectId,
      timestamp: new Date().toISOString(),
      requestCount: requestTracker.getCount(projectId, 'series'),
      data: seriesComLinks,
      performance: 'normal'
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: 'Internal server error', details: err.message });
  }
});

// Inicia o servidor e o pré-carregamento
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  preloadPremiumData(); // Inicia o pré-carregamento
  
  // Atualiza os dados a cada 30 minutos para premium
  setInterval(preloadPremiumData, 1800000);
});
