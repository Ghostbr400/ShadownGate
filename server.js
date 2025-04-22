const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const port = process.env.PORT || 3000;

// Supabase Configuration
const supabaseUrl = 'https://nwoswxbtlquiekyangbs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53b3N3eGJ0bHF1aWVreWFuZ2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ3ODEwMjcsImV4cCI6MjA2MDM1NzAyN30.KarBv9AopQpldzGPamlj3zu9eScKltKKHH2JJblpoCE';
const supabase = createClient(supabaseUrl, supabaseKey);

// Xtream API Configuration
const XTREAM_CONFIG = {
  host: 'sigcine1.space',
  port: 80,
  username: '474912714',
  password: '355591139'
};

// Middlewares
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// CORS Middleware
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Enhanced Request Tracker with Database Logging
const requestTracker = {
  trackRequest: async function(projectId, userId, endpoint, req) {
    try {
      const { error } = await supabase
        .from('request_logs')
        .insert({
          project_id: projectId,
          user_id: userId,
          endpoint: endpoint,
          method: req.method,
          ip_address: req.ip,
          user_agent: req.get('User-Agent')
        });
      
      if (error) throw error;
      
      return await this.updateProjectCounters(projectId);
    } catch (err) {
      console.error('[TRACKING ERROR]', err);
      throw err;
    }
  },
  
  updateProjectCounters: async function(projectId) {
    const today = new Date().toISOString().split('T')[0];
    
    const { data: project, error: fetchError } = await supabase
      .from('user_projects')
      .select('*')
      .eq('id', projectId)
      .single();

    if (fetchError) throw fetchError;
    if (!project) throw new Error('Project not found');

    const updateData = {
      requests_today: project.requests_today + 1,
      total_requests: project.total_requests + 1,
      last_request_date: today,
      daily_requests: { ...project.daily_requests },
      activity_data: { ...project.activity_data }
    };

    // Update daily requests
    updateData.daily_requests[today] = (updateData.daily_requests[today] || 0) + 1;

    // Update activity data
    const currentHour = new Date().getHours();
    updateData.activity_data[currentHour] = (updateData.activity_data[currentHour] || 0) + 1;

    // Check for level upgrade
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
};

// Project Verification Middleware
async function verifyProject(req, res, next) {
  const projectId = req.params.id;
  const authToken = req.headers.authorization?.split(' ')[1];
  
  try {
    // Verify project exists and get user info
    const { data: project, error: projectError } = await supabase
      .from('user_projects')
      .select('*, user:user_id(*)')
      .eq('id', projectId)
      .single();

    if (projectError || !project) {
      return res.status(404).json({ 
        status: 'error',
        error: 'Project not found'
      });
    }

    // If we have an auth token, verify it matches the project owner
    if (authToken) {
      const { data: { user }, error: authError } = await supabase.auth.getUser(authToken);
      
      if (authError || user.id !== project.user_id) {
        return res.status(403).json({ 
          status: 'error',
          error: 'Unauthorized access'
        });
      }
      
      req.user = user;
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

// Movies Endpoint
app.get('/:id/filmes', verifyProject, async (req, res) => {
  try {
    const projectId = req.params.id;
    const userId = req.user?.id;

    // Track request
    const counters = await requestTracker.trackRequest(
      projectId, 
      userId, 
      'filmes', 
      req
    );

    // Fetch movies data
    const apiUrl = `http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_vod_streams`;
    const apiResponse = await fetch(apiUrl);
    
    if (!apiResponse.ok) {
      throw new Error('Failed to fetch movies data');
    }

    const filmesData = await apiResponse.json();

    // Format response
    const filmesComLinks = filmesData.map(filme => ({
      ...filme,
      player: `${req.protocol}://${req.get('host')}/${projectId}/stream/${filme.stream_id}.mp4`,
      stream_icon: `${req.protocol}://${req.get('host')}/${projectId}/icon/${filme.stream_id}`
    }));

    res.json({
      status: 'success',
      project: {
        id: projectId,
        name: req.project.name,
        level: req.project.level,
        requests_today: counters.requests_today
      },
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

// Animes Endpoint
app.get('/:id/animes', verifyProject, async (req, res) => {
  try {
    const projectId = req.params.id;
    const userId = req.user?.id;

    // Track request
    const counters = await requestTracker.trackRequest(
      projectId, 
      userId, 
      'animes', 
      req
    );

    res.json({
      status: 'success',
      project: {
        id: projectId,
        name: req.project.name,
        level: req.project.level,
        requests_today: counters.requests_today
      },
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

// Anime Data Generator
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
    projectSpecific: `custom-${projectId.slice(0, 3)}-${anime.id}`,
    stream_url: `/stream/anime_${anime.id}`,
    icon_url: `/icon/anime_${anime.id}`
  }));
}

// Stream Endpoint
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

// Icon Endpoint
app.get('/:id/icon/:streamId', verifyProject, async (req, res) => {
  try {
    const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
      <rect width="100" height="100" fill="#ddd"/>
      <text x="50" y="50" font-family="Arial" font-size="20" text-anchor="middle" fill="#666">${req.params.streamId}</text>
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

// Project Statistics Endpoint
app.get('/:id/stats', verifyProject, async (req, res) => {
  try {
    const { data: logs, error } = await supabase
      .from('request_logs')
      .select('endpoint, created_at')
      .eq('project_id', req.params.id)
      .order('created_at', { ascending: false })
      .limit(100);

    if (error) throw error;

    res.json({
      status: 'success',
      project: {
        id: req.project.id,
        name: req.project.name,
        total_requests: req.project.total_requests,
        level: req.project.level
      },
      recent_activity: logs,
      daily_requests: req.project.daily_requests,
      activity_data: req.project.activity_data
    });
  } catch (err) {
    console.error('[STATS ERROR]', err);
    res.status(500).json({ 
      status: 'error',
      error: 'Failed to fetch statistics'
    });
  }
});

// Frontend Route
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error Handling Middleware
app.use((err, req, res, next) => {
  console.error('[GLOBAL ERROR]', err);
  res.status(500).json({
    status: 'error',
    error: 'Internal server error',
    details: process.env.NODE_ENV === 'development' ? err.message : undefined
  });
});

// Start Server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
