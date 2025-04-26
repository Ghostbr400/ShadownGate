const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const port = process.env.PORT || 3000;

// Configuração do Xtream
const XTREAM_CONFIG = {
  host: 'sigcine1.space',
  port: 80,
  username: '474912714',
  password: '355591139'
};

// Configuração da API AniList
const ANILIST_API = 'https://graphql.anilist.co';

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Middleware CORS
app.use((req, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  next();
});

// Cache em memória
const memoryCache = {
  animeChecks: new Map(),
  requestCounts: new Map(),
  lastRequest: new Map(),

  getAnimeCheck: function(title) {
    return this.animeChecks.get(title);
  },

  setAnimeCheck: function(title, isAnime) {
    this.animeChecks.set(title, isAnime);
  },

  incrementRequest: function(projectId, endpoint) {
    const key = `${projectId}_${endpoint}`;
    const count = this.requestCounts.get(key) || 0;
    this.requestCounts.set(key, count + 1);
    this.lastRequest.set(key, new Date());
  },

  getRequestCount: function(projectId, endpoint) {
    const key = `${projectId}_${endpoint}`;
    return this.requestCounts.get(key) || 0;
  }
};

// Funções auxiliares para verificar animes
async function searchAnime(title) {
  const query = `
    query ($search: String) {
      Page {
        media(search: $search, type: ANIME) {
          id
          title {
            romaji
            english
            native
          }
          synonyms
        }
      }
    }
  `;

  const variables = {
    search: title
  };

  const response = await fetch(ANILIST_API, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    },
    body: JSON.stringify({
      query,
      variables
    })
  });

  const data = await response.json();
  return data.data.Page.media;
}

function similarity(s1, s2) {
  if (!s1 || !s2) return 0;
  const longer = s1.length > s2.length ? s1 : s2;
  const shorter = s1.length <= s2.length ? s1 : s2;
  const longerLength = longer.length;
  if (longerLength === 0) return 1.0;
  
  return (longerLength - editDistance(longer, shorter)) / parseFloat(longerLength);
}

function editDistance(s1, s2) {
  s1 = s1.toLowerCase();
  s2 = s2.toLowerCase();
  
  const costs = [];
  for (let i = 0; i <= s1.length; i++) {
    let lastValue = i;
    for (let j = 0; j <= s2.length; j++) {
      if (i === 0)
        costs[j] = j;
      else {
        if (j > 0) {
          let newValue = costs[j - 1];
          if (s1.charAt(i - 1) !== s2.charAt(j - 1))
            newValue = Math.min(Math.min(newValue, lastValue), costs[j]) + 1;
          costs[j - 1] = lastValue;
          lastValue = newValue;
        }
      }
    }
    if (i > 0) costs[s2.length] = lastValue;
  }
  return costs[s2.length];
}

async function isAnimeSeries(seriesName) {
  // Verifica primeiro no cache
  const cached = memoryCache.getAnimeCheck(seriesName);
  if (cached !== undefined) return cached;

  try {
    const results = await searchAnime(seriesName);
    
    if (results && results.length > 0) {
      for (const anime of results) {
        const titles = [
          anime.title.romaji,
          anime.title.english,
          anime.title.native,
          ...(anime.synonyms || [])
        ].filter(Boolean);
        
        if (titles.some(t => t.toLowerCase() === seriesName.toLowerCase())) {
          memoryCache.setAnimeCheck(seriesName, true);
          return true;
        }
      }
      
      const similarEnough = results.some(anime => {
        const animeTitle = anime.title.romaji || anime.title.english;
        return similarity(seriesName, animeTitle) > 0.7;
      });
      
      memoryCache.setAnimeCheck(seriesName, similarEnough);
      return similarEnough;
    }
    
    memoryCache.setAnimeCheck(seriesName, false);
    return false;
  } catch (error) {
    console.error('Error checking anime:', error);
    memoryCache.setAnimeCheck(seriesName, false);
    return false;
  }
}

// Middleware de verificação de projeto (simplificado sem Supabase)
async function verifyProject(req, res, next) {
  const projectId = req.params.id;
  // Em uma versão real, você validaria o projectId aqui
  req.project = { project_id: projectId };
  next();
}

// Rotas para filmes
app.get('/api/:id/filmes', verifyProject, async (req, res) => {
  try {
    const projectId = req.params.id;
    memoryCache.incrementRequest(projectId, 'filmes');
    
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
      requestCount: memoryCache.getRequestCount(projectId, 'filmes'),
      data: filmesComLinks
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: 'Internal server error', details: err.message });
  }
});

// Rotas para séries normais
app.get('/api/:id/series', verifyProject, async (req, res) => {
  try {
    const projectId = req.params.id;
    memoryCache.incrementRequest(projectId, 'series');

    const apiUrl = `http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_series`;
    const apiResponse = await fetch(apiUrl);
    if (!apiResponse.ok) throw new Error('Failed to fetch series data');

    const allSeries = await apiResponse.json();
    
    // Filtrar séries que não são animes
    const seriesCheckPromises = allSeries.map(async serie => {
      const isAnime = await isAnimeSeries(serie.name);
      return { ...serie, isAnime };
    });
    
    const seriesWithChecks = await Promise.all(seriesCheckPromises);
    const normalSeries = seriesWithChecks.filter(serie => !serie.isAnime);

    const seriesComLinks = normalSeries.map(serie => ({
      ...serie,
      type: 'series',
      player: `${req.protocol}://${req.get('host')}/player.html?projectId=${projectId}&seriesId=${serie.series_id}`,
      cover: `${req.protocol}://${req.get('host')}/api/${projectId}/icon/${serie.series_id}`
    }));

    res.json({
      status: 'success',
      projectId,
      timestamp: new Date().toISOString(),
      requestCount: memoryCache.getRequestCount(projectId, 'series'),
      data: seriesComLinks
    });
  } catch (err) {
    res.status(500).json({ status: 'error', error: 'Internal server error', details: err.message });
  }
});

// Rotas para animes
app.get('/api/:id/animes', verifyProject, async (req, res) => {
  try {
    const projectId = req.params.id;
    memoryCache.incrementRequest(projectId, 'animes');

    const apiUrl = `http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_series`;
    const apiResponse = await fetch(apiUrl);
    if (!apiResponse.ok) throw new Error('Failed to fetch series data');

    const allSeries = await apiResponse.json();
    
    // Filtrar apenas animes
    const animeCheckPromises = allSeries.map(async serie => {
      const isAnime = await isAnimeSeries(serie.name);
      return { ...serie, isAnime };
    });
    
    const seriesWithChecks = await Promise.all(animeCheckPromises);
    const animes = seriesWithChecks.filter(serie => serie.isAnime);

    const animesComLinks = animes.map(anime => ({
      ...anime,
      type: 'anime',
      player: `${req.protocol}://${req.get('host')}/player.html?projectId=${projectId}&seriesId=${anime.series_id}`,
      cover: `${req.protocol}://${req.get('host')}/api/${projectId}/icon/${anime.series_id}`
    }));

    res.json({
      status: 'success',
      projectId,
      timestamp: new Date().toISOString(),
      requestCount: memoryCache.getRequestCount(projectId, 'animes'),
      data: animesComLinks
    });
  } catch (err) {
    res.status(500).json({ 
      status: 'error', 
      error: 'Internal server error', 
      details: err.message 
    });
  }
});

// Rotas para temporadas e episódios (compartilhadas entre séries e animes)
app.get('/api/:id/series/:seriesId/seasons', verifyProject, async (req, res) => {
  try {
    const { id: projectId, seriesId } = req.params;
    memoryCache.incrementRequest(projectId, 'series_seasons');

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

app.get('/api/:id/series/:seriesId/season/:seasonNumber', verifyProject, async (req, res) => {
  try {
    const { id: projectId, seriesId, seasonNumber } = req.params;
    memoryCache.incrementRequest(projectId, 'series_episodes');

    const apiUrl = `http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_series_info&series_id=${seriesId}`;
    const apiResponse = await fetch(apiUrl);
    if (!apiResponse.ok) throw new Error('Failed to fetch series info');

    const seriesInfo = await apiResponse.json();
    const episodes = (seriesInfo.episodes && seriesInfo.episodes[seasonNumber]) ? seriesInfo.episodes[seasonNumber] : [];

    const episodesFormatted = episodes.map(ep => ({
      id: ep.id,
      title: ep.title,
      episode_num: ep.episode_num,
      stream_url: `${req.protocol}://${req.get('host')}/api/${projectId}/stream-direct/${ep.id}`,
      duration: ep.duration,
      info: ep.info || {},
      directUrl: `http://${XTREAM_CONFIG.host}:${XTREAM_CONFIG.port}/series/${XTREAM_CONFIG.username}/${XTREAM_CONFIG.password}/${ep.id}.mp4`
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

// Rota para stream direto
app.get('/api/:id/stream-direct/:streamId', verifyProject, async (req, res) => {
  try {
    const streamId = req.params.streamId;
    const realStreamUrl = `http://${XTREAM_CONFIG.host}:${XTREAM_CONFIG.port}/movie/${XTREAM_CONFIG.username}/${XTREAM_CONFIG.password}/${streamId}.mp4`;
    const streamResponse = await fetch(realStreamUrl);
    if (!streamResponse.ok) return res.status(404).json({ status: 'error', error: 'Stream not found' });
    res.set({ 
      'Content-Type': 'video/mp4', 
      'Cache-Control': 'no-store',
      'Accept-Ranges': 'bytes'
    });
    streamResponse.body.pipe(res);
  } catch (err) {
    res.status(500).json({ status: 'error', error: 'Stream error' });
  }
});

// Rota para ícones (placeholder)
app.get('/api/:id/icon/:streamId', verifyProject, async (req, res) => {
  try {
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

// Rota para buscar título do filme pelo streamId
app.get('/api/:id/get-movie-title/:streamId', verifyProject, async (req, res) => {
  try {
    const streamId = req.params.streamId;
    const apiUrl = `http://${XTREAM_CONFIG.host}/player_api.php?username=${XTREAM_CONFIG.username}&password=${XTREAM_CONFIG.password}&action=get_vod_info&vod_id=${streamId}`;
    const apiResponse = await fetch(apiUrl);
    
    if (!apiResponse.ok) {
      return res.json({ status: 'error', error: 'Failed to fetch movie info' });
    }
    
    const movieInfo = await apiResponse.json();
    res.json({
      status: 'success',
      title: movieInfo.name || movieInfo.title || 'Filme',
      streamId
    });
  } catch (err) {
    res.json({ status: 'error', error: err.message });
  }
});

// Rotas para o player e frontend
app.get('/player.html', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'player.html'));
});

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
