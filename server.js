const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const port = process.env.PORT || 3000;

// Configuração do Supabase
const supabaseUrl = 'https://nwoswxbtlquiekyangbs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53b3N3eGJ0bHF1aWVreWFuZ2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ3ODEwMjcsImV4cCI6MjA2MDM1NzAyN30.KarBv9AopQpldzGPamlj3zu9eScKltKKHH2JJblpoCE';
const supabase = createClient(supabaseUrl, supabaseKey);

// Configuração Xtream API
const XTREAM_CONFIG = {
  host: 'sigcine1.space',
  port: 80,
  username: '474912714',
  password: '355591139'
};

// Middlewares
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware CORS para Sketchware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Sistema de Monitoramento de Requisições
const requestTracker = {
  requests: new Map(),
  
  track: function(projectId, endpoint) {
    const now = Date.now();
    const key = `${projectId}_${endpoint}`;
    
    if (!this.requests.has(key)) {
      this.requests.set(key, []);
    }
    
    this.requests.get(key).push(now);
    console.log(`[TRACK] ${key} - ${now}`);
  },
  
  getCount: function(projectId, endpoint) {
    const key = `${projectId}_${endpoint}`;
    return this.requests.has(key) ? this.requests.get(key).length : 0;
  }
};

// Middleware de Verificação de Projeto
async function verifyProject(req, res, next) {
  const projectId = req.params.id;
  
  try {
    console.log(`[VERIFY] Verifying project: ${projectId}`);
    
    const { data: project, error } = await supabase
      .from('project_tokens')
      .select('*')
      .eq('project_id', projectId)
      .single();

    if (error || !project) {
      console.error('[VERIFY ERROR] Project not found:', projectId);
      return res.status(404).json({ 
        status: 'error',
        error: 'Project not found'
      });
    }

    req.project = project;
    next();
  } catch (err) {
    console.error('[VERIFY ERROR]', err);
    res.status(500).json({ 
      status: 'error',
      error: 'Internal server error'
    });
  }
}

// Função para Incrementar Contagem
async function incrementRequestCount(projectId, endpointType) {
  try {
    const today = new Date().toISOString().split('T')[0];
    console.log(`[INCREMENT] Starting for ${projectId}`);

    // 1. Busca ou cria registro
    const { data: currentData, error: fetchError } = await supabase
      .from('project_requests')
      .select('*')
      .eq('project_id', projectId)
      .single();

    // Registro não existe - cria novo
    if (fetchError || !currentData) {
      console.log('[INCREMENT] Creating new record');
      const { error: createError } = await supabase
        .from('project_requests')
        .insert({
          project_id: projectId,
          requests_today: 1,
          total_requests: 1,
          last_request_date: today,
          daily_requests: { [today]: 1 },
          level: 1,
          last_endpoint: endpointType
        });
      
      if (createError) throw createError;
      return { status: 'created' };
    }

    // 2. Atualiza contadores
    const updateData = {
      requests_today: currentData.requests_today + 1,
      total_requests: currentData.total_requests + 1,
      last_request_date: today,
      daily_requests: { ...currentData.daily_requests },
      updated_at: new Date().toISOString(),
      last_endpoint: endpointType
    };

    // Atualiza contador diário
    updateData.daily_requests[today] = (updateData.daily_requests[today] || 0) + 1;

    // 3. Atualiza nível
    if (updateData.total_requests >= (currentData.level * 100)) {
      updateData.level = currentData.level + 1;
    }

    // 4. Executa update
    const { error: updateError } = await supabase
      .from('project_requests')
      .update(updateData)
      .eq('project_id', projectId);

    if (updateError) throw updateError;
    
    console.log(`[INCREMENT] Success for ${projectId}`);
    return { status: 'updated' };
    
  } catch (error) {
    console.error('[INCREMENT ERROR]', error);
    throw error;
  }
}

// Endpoint de Filmes
app.get('/:id/filmes', verifyProject, async (req, res) => {
  try {
    const projectId = req.params.id;
    console.log(`[FILMES] Request from ${projectId}`);

    // Contabiliza requisição
    await incrementRequestCount(projectId, 'filmes');
    requestTracker.track(projectId, 'filmes');

    const apiUrl = `http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_vod_streams`;
    const apiResponse = await fetch(apiUrl);
    
    if (!apiResponse.ok) {
      throw new Error('Failed to fetch movies data');
    }

    const filmesData = await apiResponse.json();

    const filmesComLinks = filmesData.map(filme => ({
      ...filme,
      player: `${req.protocol}://${req.get('host')}/${projectId}/stream/${filme.stream_id}.mp4`,
      stream_icon: `${req.protocol}://${req.get('host')}/${projectId}/icon/${filme.stream_id}`
    }));

    res.json({
      status: 'success',
      projectId,
      timestamp: new Date().toISOString(),
      requestCount: requestTracker.getCount(projectId, 'filmes'),
      data: filmesComLinks
    });

  } catch (err) {
    console.error('[FILMES ERROR]', err);
    res.status(500).json({ 
      status: 'error',
      error: 'Internal server error',
      details: err.message
    });
  }
});

// Endpoint de Animes
app.get('/:id/animes', verifyProject, async (req, res) => {
  try {
    const projectId = req.params.id;
    console.log(`[ANIMES] Request from ${projectId}`);

    // Contabiliza requisição
    const incrementResult = await incrementRequestCount(projectId, 'animes');
    requestTracker.track(projectId, 'animes');

    // Verificação adicional
    const { data: projectData } = await supabase
      .from('project_requests')
      .select('*')
      .eq('project_id', projectId)
      .single();

    res.json({
      status: 'success',
      projectId,
      timestamp: new Date().toISOString(),
      incrementResult,
      requestCount: requestTracker.getCount(projectId, 'animes'),
      dbData: projectData,
      data: generateAnimeData(projectId)
    });

  } catch (err) {
    console.error('[ANIMES ERROR]', err);
    res.status(500).json({ 
      status: 'error',
      error: 'Internal server error',
      details: err.message
    });
  }
});

// Gerador de Dados de Animes
function generateAnimeData(projectId) {
  const baseAnimes = [
    { id: 1, title: "Attack on Titan", episodes: 75, year: 2013 },
    { id: 2, title: "Demon Slayer", episodes: 44, year: 2019 },
    { id: 3, title: "Jujutsu Kaisen", episodes: 24, year: 2020 }
  ];

  const hash = projectId.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  return baseAnimes.map(anime => ({
    ...anime,
    episodes: anime.episodes + (hash % 5),
    year: anime.year + (hash % 3),
    rating: (3.5 + (hash % 5 * 0.3)).toFixed(1),
    projectSpecific: `custom-${projectId.slice(0, 3)}-${anime.id}`
  }));
}

// Endpoint de Stream
app.get('/:id/stream/:streamId', verifyProject, async (req, res) => {
  try {
    const streamId = req.params.streamId;
    const realStreamUrl = `http://${XTREAM_CONFIG.host}:${XTREAM_CONFIG.port}/movie/${XTREAM_CONFIG.username}/${XTREAM_CONFIG.password}/${streamId}.mp4`;
    
    const streamResponse = await fetch(realStreamUrl);
    
    if (!streamResponse.ok) {
      return res.status(404).json({ 
        status: 'error',
        error: 'Stream not found'
      });
    }

    res.set({
      'Content-Type': 'video/mp4',
      'Cache-Control': 'no-store'
    });

    streamResponse.body.pipe(res);

  } catch (err) {
    console.error('[STREAM ERROR]', err);
    res.status(500).json({ 
      status: 'error',
      error: 'Stream error'
    });
  }
});

// Endpoint de Ícone
app.get('/:id/icon/:streamId', verifyProject, async (req, res) => {
  try {
    const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
      <rect width="100" height="100" fill="#ddd"/>
      <text x="50" y="50" font-family="Arial" font-size="20" text-anchor="middle" fill="#666">Icon</text>
    </svg>`;
    
    res.set({
      'Content-Type': 'image/svg+xml',
      'Cache-Control': 'public, max-age=86400'
    });
    
    res.send(svgIcon);
  } catch (err) {
    console.error('[ICON ERROR]', err);
    res.status(500).send('Icon error');
  }
});

// Rota de Teste
app.get('/test/:id', async (req, res) => {
  try {
    await incrementRequestCount(req.params.id, 'test');
    const { data } = await supabase
      .from('project_requests')
      .select('*')
      .eq('project_id', req.params.id)
      .single();
      
    res.json({
      status: 'success',
      data: data || { error: 'No data found' }
    });
  } catch (err) {
    res.status(500).json({
      status: 'error',
      error: err.message
    });
  }
});

// Rota Frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Inicia Servidor
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
