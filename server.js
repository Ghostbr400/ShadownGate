require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const port = process.env.PORT || 3000;

// Validate required environment variables
const requiredConfig = {
  SUPABASE_URL: process.env.SUPABASE_URL,
  SUPABASE_KEY: process.env.SUPABASE_KEY,
  XTREAM_HOST: process.env.XTREAM_HOST,
  XTREAM_USERNAME: process.env.XTREAM_USERNAME,
  XTREAM_PASSWORD: process.env.XTREAM_PASSWORD,
  TMDB_API_KEY: process.env.TMDB_API_KEY,
  JWT_SECRET: process.env.JWT_SECRET
};

// Check for missing configuration
for (const [key, value] of Object.entries(requiredConfig)) {
  if (!value) {
    console.error(`❌ Missing required configuration: ${key}`);
    process.exit(1);
  }
}

// Initialize services with validated config
const supabase = createClient(requiredConfig.SUPABASE_URL, requiredConfig.SUPABASE_KEY);

const XTREAM_CONFIG = {
  host: requiredConfig.XTREAM_HOST,
  port: parseInt(process.env.XTREAM_PORT) || 80,
  username: requiredConfig.XTREAM_USERNAME,
  password: requiredConfig.XTREAM_PASSWORD
};

// Middleware setup
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});


app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'account', 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'account', 'register.html'));
});

// Request tracking system
const requestTracker = {
  requests: new Map(),
  track(projectId, endpoint) {
    const key = `${projectId}_${endpoint}`;
    if (!this.requests.has(key)) this.requests.set(key, []);
    this.requests.get(key).push(Date.now());
  },
  getCount(projectId, endpoint) {
    const key = `${projectId}_${endpoint}`;
    return this.requests.has(key) ? this.requests.get(key).length : 0;
  }
};

// Project verification middleware
async function verifyProject(req, res, next) {
  try {
    const { data: project, error } = await supabase
      .from('user_projects')
      .select('*')
      .eq('project_id', req.params.id)
      .single();

    if (error || !project) {
      return res.status(404).json({ status: 'error', error: 'Project not found' });
    }
    req.project = project;
    next();
  } catch (err) {
    res.status(500).json({ status: 'error', error: 'Internal server error' });
  }
}

// Request counting system
async function incrementRequestCount(projectId, endpointType) {
  try {
    const today = new Date().toISOString().split('T')[0];
    const { data: currentData, error: fetchError } = await supabase
      .from('user_projects')
      .select('*')
      .eq('project_id', projectId)
      .single();

    if (fetchError || !currentData) {
      const { error: createError } = await supabase
        .from('user_projects')
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

    const updateData = {
      requests_today: currentData.requests_today + 1,
      total_requests: currentData.total_requests + 1,
      last_request_date: today,
      daily_requests: { 
        ...currentData.daily_requests, 
        [today]: (currentData.daily_requests[today] || 0) + 1 
      }
    };

    if (updateData.total_requests >= (currentData.level * 100)) {
      updateData.level = currentData.level + 1;
    }

    const { error: updateError } = await supabase
      .from('user_projects')
      .update(updateData)
      .eq('project_id', projectId);

    if (updateError) throw updateError;
    return { status: 'updated' };
  } catch (error) {
    console.error('Error incrementing request count:', error);
    throw error;
  }
}

// Movie data formatter
function formatMovieData(movie) {
  return {
    id: movie.id,
    title: movie.title,
    original_title: movie.original_title,
    overview: movie.overview,
    poster_path: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
    backdrop_path: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null,
    release_date: movie.release_date,
    vote_average: movie.vote_average,
    genres: movie.genres?.map(g => g.name) || [],
    runtime: movie.runtime,
    adult: movie.adult,
    tmdb_url: `https://www.themoviedb.org/movie/${movie.id}`,
    stream_icon: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
    banner: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null
  };
}

// Movie endpoints
app.get('/:id/filmes', verifyProject, async (req, res) => {
  try {
    const projectId = req.params.id;
    await incrementRequestCount(projectId, 'filmes');
    requestTracker.track(projectId, 'filmes');

    const apiUrl = `http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_vod_streams`;
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error('Failed to fetch movies data');

    const filmesData = await response.json();
    const filmesComLinks = filmesData.map(filme => ({
      ...filme,
      stream_url: `http://${XTREAM_CONFIG.host}:${XTREAM_CONFIG.port}/movie/${XTREAM_CONFIG.username}/${XTREAM_CONFIG.password}/${filme.stream_id}.mp4`,
      stream_icon: filme.tmdb_id 
        ? `https://image.tmdb.org/t/p/w500${filme.poster_path}` 
        : `${req.protocol}://${req.get('host')}/${projectId}/icon/${filme.stream_id}`
    }));

    res.json({
      status: 'success',
      projectId,
      timestamp: new Date().toISOString(),
      requestCount: requestTracker.getCount(projectId, 'filmes'),
      data: filmesComLinks
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Series endpoints
app.get('/:id/series', verifyProject, async (req, res) => {
  try {
    const projectId = req.params.id;
    await incrementRequestCount(projectId, 'series');
    requestTracker.track(projectId, 'series');

    const apiUrl = `http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_series`;
    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error('Failed to fetch series data');

    const seriesData = await response.json();
    const seriesComLinks = seriesData.map(serie => ({
      ...serie,
      cover: `${req.protocol}://${req.get('host')}/${projectId}/icon/${serie.series_id}`
    }));

    res.json({
      status: 'success',
      projectId,
      data: seriesComLinks
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

// Start server
app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});

      
