require('dotenv').config();
const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const port = process.env.PORT || 3000;

// Supabase Configuration
const supabaseUrl = process.env.SUPABASE_URL || 'https://nwoswxbtlquiekyangbs.supabase.co';
const supabaseKey = process.env.SUPABASE_KEY || 'your-supabase-key';
const supabase = createClient(supabaseUrl, supabaseKey);

// Xtream API Configuration
const XTREAM_CONFIG = {
  host: process.env.XTREAM_HOST || 'sigcine1.space',
  port: process.env.XTREAM_PORT || 80,
  username: process.env.XTREAM_USERNAME || '474912714',
  password: process.env.XTREAM_PASSWORD || '355591139'
};

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// CORS Configuration
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization, x-api-key');
  next();
});

// Request Tracker
const requestTracker = {
  requests: new Map(),
  track(projectId, endpoint) {
    const now = Date.now();
    const key = `${projectId}_${endpoint}`;
    if (!this.requests.has(key)) this.requests.set(key, []);
    this.requests.get(key).push(now);
    
    // Cleanup old requests (older than 1 hour)
    this.requests.set(key, this.requests.get(key).filter(timestamp => now - timestamp < 3600000));
  },
  getCount(projectId, endpoint) {
    const key = `${projectId}_${endpoint}`;
    return this.requests.has(key) ? this.requests.get(key).length : 0;
  }
};

// Utility Functions
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
      daily_requests: { ...currentData.daily_requests },
      last_endpoint: endpointType
    };

    updateData.daily_requests[today] = (updateData.daily_requests[today] || 0) + 1;

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
    genres: movie.genres ? movie.genres.map(g => g.name) : [],
    runtime: movie.runtime,
    adult: movie.adult,
    tmdb_url: `https://www.themoviedb.org/movie/${movie.id}`
  };
}

// Middleware
async function verifyProject(req, res, next) {
  const projectId = req.params.id;
  try {
    const { data: project, error } = await supabase
      .from('user_projects')
      .select('*')
      .eq('project_id', projectId)
      .single();

    if (error || !project) {
      return res.status(404).json({ 
        status: 'error', 
        error: 'Project not found',
        code: 'PROJECT_NOT_FOUND'
      });
    }

    req.project = project;
    next();
  } catch (err) {
    console.error('Project verification error:', err);
    res.status(500).json({ 
      status: 'error', 
      error: 'Internal server error',
      code: 'INTERNAL_ERROR'
    });
  }
}

// ======================
// PAGE ROUTES
// ======================

// Main Pages
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/home', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'main', 'home.html'));
});

app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'main', 'dashboard.html'));
});

// Auth Pages
app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'account', 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'account', 'register.html'));
});

// Player
app.get('/player', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'player.html'));
});

// ======================
// API ROUTES
// ======================

// Movie Routes
app.get('/api/:id/filmes', verifyProject, async (req, res) => {
  try {
    const projectId = req.params.id;
    await incrementRequestCount(projectId, 'filmes');
    requestTracker.track(projectId, 'filmes');

    const apiUrl = `http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_vod_streams`;
    const apiResponse = await fetch(apiUrl);
    
    if (!apiResponse.ok) {
      throw new Error(`XTream API responded with status ${apiResponse.status}`);
    }

    const filmesData = await apiResponse.json();
    const filmesComLinks = filmesData.map(filme => ({
      ...filme,
      player: `${req.protocol}://${req.get('host')}/player?projectId=${projectId}&streamId=${filme.stream_id}`,
      stream_icon: `${req.protocol}://${req.get('host')}/api/${projectId}/icon/${filme.stream_id}`
    }));

    res.json({
      status: 'success',
      projectId,
      timestamp: new Date().toISOString(),
      requestCount: requestTracker.getCount(projectId, 'filmes'),
      data: filmesComLinks
    });
  } catch (err) {
    console.error('Filmes endpoint error:', err);
    res.status(500).json({ 
      status: 'error', 
      error: 'Failed to fetch movies data',
      details: err.message,
      code: 'MOVIES_FETCH_ERROR'
    });
  }
});

app.get('/api/:id/filmes/q', verifyProject, async (req, res) => {
  try {
    const projectId = req.params.id;
    const query = req.query.q;

    if (!query) {
      return res.status(400).json({ 
        status: 'error',
        error: 'Search query parameter "q" is required',
        code: 'MISSING_QUERY_PARAM'
      });
    }

    await incrementRequestCount(projectId, 'filmes_search');

    if (!isNaN(query)) {
      const tmdbResponse = await fetch(
        `https://api.themoviedb.org/3/movie/${query}?api_key=${process.env.TMDB_API_KEY}&language=pt-BR`
      );

      if (!tmdbResponse.ok) {
        return res.status(404).json({ 
          status: 'error',
          error: 'Movie not found on TMDB',
          code: 'TMDB_MOVIE_NOT_FOUND'
        });
      }

      const filme = await tmdbResponse.json();
      return res.json({
        status: 'success',
        projectId,
        searchType: 'id',
        data: {
          ...formatMovieData(filme),
          player: `${req.protocol}://${req.get('host')}/player?projectId=${projectId}&tmdbId=${filme.id}`
        }
      });
    }

    const tmdbSearchResponse = await fetch(
      `https://api.themoviedb.org/3/search/movie?api_key=${process.env.TMDB_API_KEY}&language=pt-BR&query=${encodeURIComponent(query)}`
    );

    if (!tmdbSearchResponse.ok) {
      throw new Error(`TMDB API responded with status ${tmdbSearchResponse.status}`);
    }

    const searchData = await tmdbSearchResponse.json();
    const resultadosFiltrados = searchData.results
      .filter(movie => 
        movie.title.toLowerCase().includes(query.toLowerCase()) ||
        (movie.original_title && movie.original_title.toLowerCase().includes(query.toLowerCase()))
      )
      .map(movie => ({
        ...formatMovieData(movie),
        player: `${req.protocol}://${req.get('host')}/player?projectId=${projectId}&tmdbId=${movie.id}`
      }));

    res.json({
      status: 'success',
      projectId,
      searchType: 'name',
      query,
      resultsCount: resultadosFiltrados.length,
      data: resultadosFiltrados
    });

  } catch (err) {
    console.error('Filmes search error:', err);
    res.status(500).json({ 
      status: 'error',
      error: 'Movie search failed',
      details: err.message,
      code: 'MOVIE_SEARCH_ERROR'
    });
  }
});

// Stream Routes
app.get('/api/:id/stream/:streamId', verifyProject, async (req, res) => {
  try {
    const { streamId, id: projectId } = req.params;
    res.redirect(`/player?projectId=${projectId}&streamId=${streamId}`);
  } catch (err) {
    console.error('Stream redirect error:', err);
    res.status(500).json({ 
      status: 'error', 
      error: 'Stream redirect failed',
      code: 'STREAM_REDIRECT_ERROR'
    });
  }
});

app.get('/api/:id/stream-direct/:streamId', verifyProject, async (req, res) => {
  try {
    const streamId = req.params.streamId;
    const realStreamUrl = `http://${XTREAM_CONFIG.host}:${XTREAM_CONFIG.port}/movie/${XTREAM_CONFIG.username}/${XTREAM_CONFIG.password}/${streamId}.mp4`;
    
    const streamResponse = await fetch(realStreamUrl);
    if (!streamResponse.ok) {
      return res.status(404).json({ 
        status: 'error', 
        error: 'Stream not found',
        code: 'STREAM_NOT_FOUND'
      });
    }

    res.set({ 
      'Content-Type': 'video/mp4', 
      'Cache-Control': 'no-store',
      'Accept-Ranges': 'bytes'
    });

    streamResponse.body.pipe(res);
  } catch (err) {
    console.error('Direct stream error:', err);
    res.status(500).json({ 
      status: 'error', 
      error: 'Stream processing failed',
      code: 'STREAM_PROCESSING_ERROR'
    });
  }
});

// Additional API Routes
app.get('/api/:id/get-movie-title/:streamId', verifyProject, async (req, res) => {
  try {
    const streamId = req.params.streamId;
    const apiUrl = `http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_vod_info&vod_id=${streamId}`;
    
    const apiResponse = await fetch(apiUrl);
    if (!apiResponse.ok) {
      return res.status(404).json({ 
        status: 'error', 
        error: 'Movie info not found',
        code: 'MOVIE_INFO_NOT_FOUND'
      });
    }

    const movieInfo = await apiResponse.json();
    res.json({
      status: 'success',
      title: movieInfo.name || movieInfo.title || 'Filme',
      streamId
    });
  } catch (err) {
    console.error('Movie title fetch error:', err);
    res.status(500).json({ 
      status: 'error', 
      error: 'Failed to fetch movie title',
      details: err.message,
      code: 'MOVIE_TITLE_FETCH_ERROR'
    });
  }
});

app.get('/api/:id/icon/:streamId', verifyProject, async (req, res) => {
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
    console.error('Icon generation error:', err);
    res.status(500).send('Icon generation failed');
  }
});

// ======================
// ERROR HANDLERS
// ======================

// 404 Not Found
app.use((req, res) => {
  res.status(404).sendFile(path.join(__dirname, 'public', '404.html'));
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Server error:', err.stack);
  res.status(500).sendFile(path.join(__dirname, 'public', '500.html'));
});

// ======================
// SERVER INITIALIZATION
// ======================

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
});
