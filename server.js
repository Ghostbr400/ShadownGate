const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));

const app = express();
const port = process.env.PORT || 3000;

const supabaseUrl = 'https://nwoswxbtlquiekyangbs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53b3N3eGJ0bHF1aWVreWFuZ2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ3ODEwMjcsImV4cCI6MjA2MDM1NzAyN30.KarBv9AopQpldzGPamlj3zu9eScKltKKHH2JJblpoCE';
const supabase = createClient(supabaseUrl, supabaseKey);

const XTREAM_CONFIG = {
  host: 'sigcine1.space',
  port: 80,
  username: '474912714',
  password: '355591139'
};

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

app.get('/api/:id/filmes', verifyProject, async (req, res) => {
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
      player: `${req.protocol}://${req.get('host')}/api/${projectId}/stream/${filme.stream_id}.mp4`,
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
    res.status(500).json({ status: 'error', error: 'Internal server error', details: err.message });
  }
});

app.get('/api/:id/animes', verifyProject, async (req, res) => {
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

app.get('/api/:id/stream/:streamId', verifyProject, async (req, res) => {
  try {
    const streamId = req.params.streamId;
    const realStreamUrl = `http://${XTREAM_CONFIG.host}:${XTREAM_CONFIG.port}/movie/${XTREAM_CONFIG.username}/${XTREAM_CONFIG.password}/${streamId}.mp4`;
    const streamResponse = await fetch(realStreamUrl);
    if (!streamResponse.ok) return res.status(404).json({ status: 'error', error: 'Stream not found' });
    res.set({ 'Content-Type': 'video/mp4', 'Cache-Control': 'no-store' });
    streamResponse.body.pipe(res);
  } catch (err) {
    res.status(500).json({ status: 'error', error: 'Stream error' });
  }
});

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

app.get('/api/test/:id', async (req, res) => {
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

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
