const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const port = process.env.PORT || 3000;

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_KEY;
const supabase = createClient(supabaseUrl, supabaseKey);

const XTREAM_CONFIG = {
  host: process.env.XTREAM_HOST,
  port: process.env.XTREAM_PORT || 80,
  username: process.env.XTREAM_USERNAME,
  password: process.env.XTREAM_PASSWORD
};

const TMDB_API_KEY = process.env.TMDB_API_KEY;

if (!supabaseUrl || !supabaseKey || !XTREAM_CONFIG.host || !XTREAM_CONFIG.username || !XTREAM_CONFIG.password || !TMDB_API_KEY) {
  console.error('Erro: Variáveis de ambiente necessárias não configuradas!');
  process.exit(1);
}

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

const requestTracker = {
  requests: new Map(),
  track: function(projectId, endpoint) {
    const now = Date.now();
    const key = `${projectId}_${endpoint}`;
    if (!this.requests.has(key)) this.requests.set(key, []);
    this.requests.get(key).push(now);
  },
  getCount: function(projectId, endpoint) {
    const key = `${projectId}_${endpoint}`;
    return this.requests.has(key) ? this.requests.get(key).length : 0;
  }
};

async function verifyProject(req, res, next) {
  const projectId = req.params.id;
  try {
    const { data: project, error } = await supabase
      .from('user_projects')
      .select('*')
      .eq('project_id', projectId)
      .single();
    if (error || !project) return res.status(404).json({ status: 'error', error: 'Project not found' });
    req.project = project;
    next();
  } catch (err) {
    res.status(500).json({ status: 'error', error: 'Internal server error' });
  }
}

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
      daily_requests: { ...currentData.daily_requests }
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
    tmdb_url: `https://www.themoviedb.org/movie/${movie.id}`,
    stream_icon: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null,
    banner: movie.backdrop_path ? `https://image.tmdb.org/t/p/w1280${movie.backdrop_path}` : null,
    cover: movie.poster_path ? `https://image.tmdb.org/t/p/w500${movie.poster_path}` : null
  };
}

app.get('/:id/filmes', verifyProject, async (req, res) => {
  try {
    const projectId = req.params.id;
    await incrementRequestCount(projectId, 'filmes');
    requestTracker.track(projectId, 'filmes');
    const apiUrl = `http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_vod_streams`;
    const apiResponse = await fetch(apiUrl);
    if (!apiResponse.ok) throw new Error('Failed to fetch movies data');
    const filmesData = await apiResponse.json();
    const filmesComLinks = filmesData.map(filme => ({
      ...filme,
      stream_url: `http://${XTREAM_CONFIG.host}:${XTREAM_CONFIG.port}/movie/${XTREAM_CONFIG.username}/${XTREAM_CONFIG.password}/${filme.stream_id}.mp4`,
      stream_icon: filme.tmdb_id ? `https://image.tmdb.org/t/p/w500${filme.poster_path}` : `${req.protocol}://${req.get('host')}/${projectId}/icon/${filme.stream_id}`
    }));
    res.json({
      status: 'success',
      projectId,
      timestamp: new Date().toISOString(),
      requestCount: requestTracker.getCount(projectId, 'filmes'),
      data: filmesComLinks
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: 'Internal server error', details: err.message });
  }
});

app.get('/:id/filmes/q', verifyProject, async (req, res) => {
  try {
    const projectId = req.params.id;
    const query = req.query.q;
    
    if (!query) {
      return res.status(400).json({ 
        status: 'error',
        error: 'Parâmetro de busca "q" é obrigatório' 
      });
    }

    await incrementRequestCount(projectId, 'filmes_search');

    if (!isNaN(query)) {
      const tmdbResponse = await fetch(
        `https://api.themoviedb.org/3/movie/${query}?api_key=${TMDB_API_KEY}&language=pt-BR`
      );
      
      if (!tmdbResponse.ok) {
        return res.status(404).json({ 
          status: 'error',
          error: 'Filme não encontrado no TMDB' 
        });
      }

      const filme = await tmdbResponse.json();
      const streamId = await findStreamIdByTmdbId(query);
      
      return res.json({
        status: 'success',
        projectId,
        searchType: 'id',
        data: {
          ...formatMovieData(filme),
          stream_url: streamId ? 
            `http://${XTREAM_CONFIG.host}:${XTREAM_CONFIG.port}/movie/${XTREAM_CONFIG.username}/${XTREAM_CONFIG.password}/${streamId}.mp4` :
            null
        }
      });
    }

    const tmdbSearchResponse = await fetch(
      `https://api.themoviedb.org/3/search/movie?api_key=${TMDB_API_KEY}&language=pt-BR&query=${encodeURIComponent(query)}`
    );

    if (!tmdbSearchResponse.ok) {
      throw new Error('Falha ao buscar filmes no TMDB');
    }

    const searchData = await tmdbSearchResponse.json();
    
    const resultadosFiltrados = await Promise.all(
      searchData.results
        .filter(movie => 
          movie.title.toLowerCase().includes(query.toLowerCase()) ||
          (movie.original_title && movie.original_title.toLowerCase().includes(query.toLowerCase()))
        .map(async movie => {
          const detailsResponse = await fetch(
            `https://api.themoviedb.org/3/movie/${movie.id}?api_key=${TMDB_API_KEY}&language=pt-BR`
          );
          const movieDetails = await detailsResponse.json();
          
          const streamId = await findStreamIdByTmdbId(movie.id);
          return {
            ...formatMovieData(movieDetails),
            stream_url: streamId ? 
              `http://${XTREAM_CONFIG.host}:${XTREAM_CONFIG.port}/movie/${XTREAM_CONFIG.username}/${XTREAM_CONFIG.password}/${streamId}.mp4` :
              null
          };
        })
    );

    res.json({
      status: 'success',
      projectId,
      searchType: 'nome',
      query,
      resultsCount: resultadosFiltrados.length,
      data: resultadosFiltrados
    });

  } catch (err) {
    res.status(500).json({ 
      status: 'error',
      error: 'Erro na busca de filmes',
      details: err.message 
    });
  }
});

app.get('/:id/series', verifyProject, async (req, res) => {
  try {
    const projectId = req.params.id;
    await incrementRequestCount(projectId, 'series');
    requestTracker.track(projectId, 'series');

    const apiUrl = `http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_series`;
    const apiResponse = await fetch(apiUrl);
    if (!apiResponse.ok) throw new Error('Failed to fetch series data');

    const seriesData = await apiResponse.json();
    const seriesComLinks = seriesData.map(serie => ({
      ...serie,
      cover: `${req.protocol}://${req.get('host')}/${projectId}/icon/${serie.series_id}`
    }));

    res.json({
      status: 'success',
      projectId,
      timestamp: new Date().toISOString(),
      requestCount: requestTracker.getCount(projectId, 'series'),
      data: seriesComLinks
    });

  } catch (err) {
    res.status(500).json({ status: 'error', error: 'Internal server error', details: err.message });
  }
});

app.get('/:id/series/:seriesId/seasons', verifyProject, async (req, res) => {
  try {
    const { id: projectId, seriesId } = req.params;
    await incrementRequestCount(projectId, 'series_seasons');
    requestTracker.track(projectId, 'series_seasons');

    const apiUrl = `http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_series_info&series_id=${seriesId}`;
    const apiResponse = await fetch(apiUrl);
    if (!apiResponse.ok) throw new Error('Failed to fetch series info');

    const seriesInfo = await apiResponse.json();
    const seasons = seriesInfo.episodes ? Object.keys(seriesInfo.episodes).map(seasonNumber => ({
      season: seasonNumber,
      episodesCount: seriesInfo.episodes[seasonNumber].length
    })) : [];

    res.json({
      status: 'success',
      projectId,
      seriesId,
      seasons
    });

  } catch (err) {
    res.status(500).json({ status: 'error', error: 'Internal server error', details: err.message });
  }
});

app.get('/:id/series/:seriesId/season/:seasonNumber', verifyProject, async (req, res) => {
  try {
    const { id: projectId, seriesId, seasonNumber } = req.params;
    await incrementRequestCount(projectId, 'series_episodes');
    requestTracker.track(projectId, 'series_episodes');

    const apiUrl = `http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_series_info&series_id=${seriesId}`;
    const apiResponse = await fetch(apiUrl);
    if (!apiResponse.ok) throw new Error('Failed to fetch series info');

    const seriesInfo = await apiResponse.json();
    const episodes = (seriesInfo.episodes && seriesInfo.episodes[seasonNumber]) ? seriesInfo.episodes[seasonNumber] : [];

    const episodesFormatted = episodes.map(ep => ({
      id: ep.id,
      title: ep.title,
      episode_num: ep.episode_num,
      stream_url: `http://${XTREAM_CONFIG.host}:${XTREAM_CONFIG.port}/series/${XTREAM_CONFIG.username}/${XTREAM_CONFIG.password}/${ep.id}.mp4`,
      duration: ep.duration,
      info: ep.info || {}
    }));

    res.json({
      status: 'success',
      projectId,
      seriesId,
      seasonNumber,
      episodes: episodesFormatted
    });

  } catch (err) {
    res.status(500).json({ status: 'error', error: 'Internal server error', details: err.message });
  }
});

app.get('/:id/stream-direct/:streamId', verifyProject, async (req, res) => {
  try {
    const streamId = req.params.streamId;
    const realStreamUrl = `http://${XTREAM_CONFIG.host}:${XTREAM_CONFIG.port}/movie/${XTREAM_CONFIG.username}/${XTREAM_CONFIG.password}/${streamId}.mp4`;
    res.redirect(realStreamUrl);
  } catch (err) {
    res.status(500).json({ status: 'error', error: 'Stream error' });
  }
});

app.get('/:id/tmdb-to-stream/:tmdbId', verifyProject, async (req, res) => {
  try {
    const tmdbId = req.params.tmdbId;
    const streamId = await findStreamIdByTmdbId(tmdbId);
    
    if (!streamId) {
      return res.status(404).json({ status: 'error', error: 'Stream not found for this TMDB ID' });
    }
    
    res.json({
      status: 'success',
      projectId: req.params.id,
      tmdbId,
      streamId,
      stream_url: `http://${XTREAM_CONFIG.host}:${XTREAM_CONFIG.port}/movie/${XTREAM_CONFIG.username}/${XTREAM_CONFIG.password}/${streamId}.mp4`
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

app.get('/:id/icon/:streamId', verifyProject, async (req, res) => {
  try {
    const streamId = req.params.streamId;
    const tmdbId = await findTmdbIdByStreamId(streamId);
    
    if (tmdbId) {
      const tmdbResponse = await fetch(
        `https://api.themoviedb.org/3/movie/${tmdbId}?api_key=${TMDB_API_KEY}`
      );
      
      if (tmdbResponse.ok) {
        const movie = await tmdbResponse.json();
        if (movie.poster_path) {
          return res.redirect(`https://image.tmdb.org/t/p/w500${movie.poster_path}`);
        }
      }
    }
    
    const svgIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="100" height="100" viewBox="0 0 100 100">
      <rect width="100" height="100" fill="#ddd"/>
      <text x="50" y="50" font-family="Arial" font-size="20" text-anchor="middle" fill="#666">Icon</text>
    </svg>`;
    res.set({ 'Content-Type': 'image/svg+xml', 'Cache-Control': 'public, max-age=86400' });
    res.send(svgIcon);
  } catch (err) {
    res.status(500).send('Icon error');
  }
});

app.get('/:id/animes', verifyProject, async (req, res) => {
  try {
    const projectId = req.params.id;
    const incrementResult = await incrementRequestCount(projectId, 'animes');
    requestTracker.track(projectId, 'animes');
    const { data: projectData } = await supabase
      .from('user_projects')
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
    res.status(500).json({ status: 'error', error: 'Internal server error', details: err.message });
  }
});

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

app.get('/test/:id', async (req, res) => {
  try {
    await incrementRequestCount(req.params.id, 'test');
    const { data } = await supabase
      .from('user_projects')
      .select('*')
      .eq('project_id', req.params.id)
      .single();
    res.json({ status: 'success', data: data || { error: 'No data found' } });
  } catch (err) {
    res.status(500).json({ status: 'error', error: err.message });
  }
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.get('/login', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'account', 'login.html'));
});

app.get('/register', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'account', 'register.html'));
});

async function findStreamIdByTmdbId(tmdbId) {
  return tmdbId;
}

async function findTmdbIdByStreamId(streamId) {
  return null;
}

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
