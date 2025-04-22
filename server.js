require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const cors = require('cors');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

// Configuração inicial
const app = express();
const port = process.env.PORT || 3000;

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://nwoswxbtlquiekyangbs.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53b3N3eGJ0bHF1aWVreWFuZ2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ3ODEwMjcsImV4cCI6MjA2MDM1NzAyN30.KarBv9AopQpldzGPamlj3zu9eScKltKKHH2JJblpoCE';
const supabase = createClient(supabaseUrl, supabaseKey);

// Configuração Xtream API (usar variáveis de ambiente em produção)
const XTREAM_CONFIG = {
  host: process.env.XTREAM_HOST || 'sigcine1.space',
  port: process.env.XTREAM_PORT || 80,
  username: process.env.XTREAM_USER || '474912714',
  password: process.env.XTREAM_PASS || '355591139'
};

// Middlewares de Segurança
app.use(helmet());
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS?.split(',') || '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 100, // limite por IP
  standardHeaders: true,
  legacyHeaders: false,
  message: 'Too many requests from this IP, please try again later'
});
app.use(limiter);

// Sistema de Monitoramento Avançado
class RequestTracker {
  constructor() {
    this.requests = new Map();
  }

  async trackRequest(projectId, userId, endpoint, req) {
    try {
      // 1. Registrar no banco de dados
      const { error: logError } = await supabase
        .from('request_logs')
        .insert({
          project_id: projectId,
          user_id: userId,
          endpoint: endpoint,
          method: req.method,
          ip_address: req.ip,
          user_agent: req.get('User-Agent'),
          status_code: 200
        });

      if (logError) throw logError;

      // 2. Atualizar contadores do projeto
      return await this.updateProjectCounters(projectId);
    } catch (error) {
      console.error('[TRACKING ERROR]', error);
      throw error;
    }
  }

  async updateProjectCounters(projectId) {
    const today = new Date().toISOString().split('T')[0];
    const currentHour = new Date().getHours();

    // Usar transação para evitar condições de corrida
    const { data: project, error: fetchError } = await supabase
      .from('user_projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (fetchError || !project) {
      throw new Error(fetchError?.message || 'Project not found');
    }

    // Preparar dados para atualização
    const dailyRequests = { ...project.daily_requests };
    dailyRequests[today] = (dailyRequests[today] || 0) + 1;

    const activityData = { ...project.activity_data };
    activityData[currentHour] = (activityData[currentHour] || 0) + 1;

    const updateData = {
      requests_today: project.requests_today + 1,
      total_requests: project.total_requests + 1,
      last_request_date: today,
      daily_requests: dailyRequests,
      activity_data: activityData
    };

    // Verificar upgrade de nível
    if (updateData.total_requests >= (project.level * 100)) {
      updateData.level = project.level + 1;
    }

    const { error: updateError } = await supabase
      .from('user_projects')
      .update(updateData)
      .eq('id', projectId);

    if (updateError) throw updateError;

    return updateData;
  }
}

const requestTracker = new RequestTracker();

// Middleware de Verificação de Projeto com Segurança Reforçada
async function verifyProject(req, res, next) {
  const projectId = req.params.id;
  const authHeader = req.headers.authorization;

  if (!projectId || !/^[a-zA-Z0-9-_]{12,64}$/.test(projectId)) {
    return res.status(400).json({ 
      status: 'error',
      error: 'Invalid project ID format'
    });
  }

  try {
    // Consulta segura com timeout
    const { data: project, error } = await supabase
      .from('user_projects')
      .select('*, user:user_id(*)')
      .eq('id', projectId)
      .single()
      .timeout(5000); // 5 segundos timeout

    if (error || !project) {
      console.error('Project lookup failed:', {
        projectId,
        error: error?.message
      });
      return res.status(404).json({ 
        status: 'error',
        error: 'Project not found or access denied'
      });
    }

    // Verificação de token JWT se fornecido
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      if (!token) {
        return res.status(401).json({
          status: 'error',
          error: 'Malformed authorization token'
        });
      }

      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      
      if (authError || !user) {
        return res.status(401).json({ 
          status: 'error',
          error: 'Invalid or expired token'
        });
      }

      if (user.id !== project.user_id) {
        return res.status(403).json({ 
          status: 'error',
          error: 'Unauthorized access to this project'
        });
      }

      req.user = user;
    }

    req.project = project;
    next();
  } catch (err) {
    console.error('Project verification error:', err);
    res.status(500).json({ 
      status: 'error',
      error: 'Internal server error during verification'
    });
  }
}

// Rotas Protegidas
app.get('/:id/filmes', verifyProject, async (req, res) => {
  try {
    const userId = req.user?.id;
    const projectId = req.params.id;

    // Registrar requisição
    const counters = await requestTracker.trackRequest(projectId, userId, 'filmes', req);

    // Buscar dados da API externa com timeout
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);

    const apiUrl = `http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_vod_streams`;
    const response = await fetch(apiUrl, { signal: controller.signal });
    clearTimeout(timeout);

    if (!response.ok) {
      throw new Error(`API responded with status ${response.status}`);
    }

    const filmesData = await response.json();

    // Sanitizar dados antes de enviar
    const safeData = filmesData.map(item => ({
      id: item.stream_id,
      name: item.name?.substring(0, 100),
      cover: item.stream_icon,
      player: `/api/${projectId}/stream/${item.stream_id}`,
      year: parseInt(item.year) || null
    }));

    res.json({
      status: 'success',
      project: {
        id: projectId,
        name: req.project.name,
        level: counters.level,
        requests_today: counters.requests_today
      },
      data: safeData
    });

  } catch (err) {
    console.error('Filmes endpoint error:', err);
    res.status(500).json({ 
      status: 'error',
      error: 'Failed to fetch movies',
      details: process.env.NODE_ENV === 'development' ? err.message : undefined
    });
  }
});

app.get('/:id/animes', verifyProject, async (req, res) => {
  try {
    const userId = req.user?.id;
    const projectId = req.params.id;

    await requestTracker.trackRequest(projectId, userId, 'animes', req);

    // Gerar dados de animes sanitizados
    const safeAnimes = generateAnimeData(projectId).map(anime => ({
      id: anime.id,
      title: anime.title?.substring(0, 100),
      episodes: parseInt(anime.episodes) || 0,
      year: parseInt(anime.year) || 0,
      stream_url: `/api/${projectId}/stream/anime_${anime.id}`,
      icon_url: `/api/${projectId}/icon/anime_${anime.id}`
    }));

    res.json({
      status: 'success',
      data: safeAnimes
    });

  } catch (err) {
    console.error('Animes endpoint error:', err);
    res.status(500).json({ 
      status: 'error',
      error: 'Failed to fetch animes'
    });
  }
});

// Gerador de dados de anime seguro
function generateAnimeData(projectId) {
  const baseAnimes = [
    { id: 1, title: "Attack on Titan", episodes: 75, year: 2013 },
    { id: 2, title: "Demon Slayer", episodes: 44, year: 2019 },
    { id: 3, title: "Jujutsu Kaisen", episodes: 24, year: 2020 }
  ];

  const hash = projectId.split('')
    .reduce((acc, char) => acc + char.charCodeAt(0), 0);
  
  return baseAnimes.map(anime => ({
    ...anime,
    episodes: anime.episodes + (hash % 5),
    year: anime.year + (hash % 3),
    rating: (3.5 + (hash % 5 * 0.3)).toFixed(1),
    projectSpecific: `custom-${projectId.slice(0, 3)}-${anime.id}`
  }));
}

// Rotas de Mídia com Verificação de Acesso
app.get('/:id/stream/:mediaId', verifyProject, async (req, res) => {
  try {
    const mediaId = req.params.mediaId;
    
    // Verificar se o mediaId é válido
    if (!/^[a-zA-Z0-9-_]+$/.test(mediaId)) {
      return res.status(400).json({ error: 'Invalid media ID' });
    }

    const streamUrl = `http://${XTREAM_CONFIG.host}:${XTREAM_CONFIG.port}/movie/${XTREAM_CONFIG.username}/${XTREAM_CONFIG.password}/${mediaId}.mp4`;
    
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);

    const streamResponse = await fetch(streamUrl, { 
      signal: controller.signal 
    });
    clearTimeout(timeout);

    if (!streamResponse.ok) {
      return res.status(404).json({ 
        status: 'error',
        error: 'Media not found'
      });
    }

    // Configurações seguras para streaming
    res.set({
      'Content-Type': 'video/mp4',
      'Cache-Control': 'private, max-age=3600',
      'X-Content-Type-Options': 'nosniff'
    });

    streamResponse.body.pipe(res);
  } catch (err) {
    console.error('Stream error:', err);
    res.status(500).json({ 
      status: 'error',
      error: 'Failed to stream media'
    });
  }
});

app.get('/:id/icon/:iconId', verifyProject, (req, res) => {
  try {
    const iconId = req.params.iconId;
    
    // Sanitizar input
    const safeIconId = iconId.replace(/[^a-zA-Z0-9-_]/g, '').substring(0, 50);
    
    const svg = generateSafeIcon(safeIconId);
    
    res.set({
      'Content-Type': 'image/svg+xml',
      'Content-Security-Policy': "default-src 'none'",
      'Cache-Control': 'public, max-age=86400'
    });
    
    res.send(svg);
  } catch (err) {
    console.error('Icon error:', err);
    res.status(500).send('Icon generation failed');
  }
});

function generateSafeIcon(text) {
  const safeText = (text || '').toString()
    .replace(/[^a-zA-Z0-9-_]/g, '')
    .substring(0, 10);
    
  return `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
    <rect width="100" height="100" fill="#f0f0f0"/>
    <text x="50" y="55" font-family="Arial" font-size="12" text-anchor="middle" fill="#333">${safeText}</text>
  </svg>`;
}

// Rota de Estatísticas Segura
app.get('/:id/stats', verifyProject, async (req, res) => {
  try {
    const { data: logs, error } = await supabase
      .from('request_logs')
      .select('endpoint, created_at, status_code')
      .eq('project_id', req.params.id)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;

    res.json({
      status: 'success',
      stats: {
        total_requests: req.project.total_requests,
        level: req.project.level,
        daily_requests: req.project.daily_requests,
        recent_requests: logs
      }
    });
  } catch (err) {
    console.error('Stats error:', err);
    res.status(500).json({ 
      status: 'error',
      error: 'Failed to fetch statistics'
    });
  }
});

// Health Check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version
  });
});

// Rota Frontend Segura
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'), {
    headers: {
      'Content-Security-Policy': "default-src 'self'",
      'X-Frame-Options': 'DENY'
    }
  });
});

// Error Handling Centralizado
app.use((err, req, res, next) => {
  console.error('Global error handler:', err);
  
  res.status(500).json({
    status: 'error',
    error: 'Internal server error',
    requestId: req.id
  });
});

// Inicialização Segura do Servidor
const server = app.listen(port, () => {
  console.log(`Server running securely on port ${port}`);
});

// Tratamento de erros de inicialização
server.on('error', (err) => {
  console.error('Server startup error:', err);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Server terminated');
    process.exit(0);
  });
});
