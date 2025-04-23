const express = require('express');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');
const fetch = (...args) => import('node-fetch').then(({default: fetch}) => fetch(...args));
const fs = require('fs');

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

// Constants
const REQUEST_LIMIT_PER_DAY = 1000;
const LEVEL_UP_THRESHOLD = 100; // Requests needed to level up

// Ensure default icon exists
const defaultIconPath = path.join(__dirname, 'public', 'default-icon.jpg');
if (!fs.existsSync(defaultIconPath)) {
  fs.writeFileSync(defaultIconPath, fs.readFileSync(path.join(__dirname, 'public', 'default-icon-sample.jpg')));
}

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Project Verification Middleware
async function verifyProject(req, res, next) {
    const projectId = req.params.id;
    
    try {
        // Check if project exists and is active
        const { data: project, error } = await supabase
            .from('user_projects')
            .select('*')
            .eq('id', projectId)
            .eq('status', 'active')
            .single();

        if (error || !project) {
            return res.status(404).json({ 
                status: 'error',
                error: 'Project not found or inactive'
            });
        }

        // Check daily request limit
        if (project.requests_today >= REQUEST_LIMIT_PER_DAY) {
            return res.status(429).json({
                status: 'error',
                error: 'Daily request limit reached'
            });
        }

        req.project = project;
        next();
    } catch (err) {
        console.error('Project verification error:', err);
        res.status(500).json({ 
            status: 'error',
            error: 'Internal server error'
        });
    }
}

// Generate activity data
function generateActivityData() {
    return {
        '7d': Array.from({length: 7}, () => Math.floor(Math.random() * 50) + 10),
        '30d': Array.from({length: 30}, () => Math.floor(Math.random() * 100) + 20),
        '90d': Array.from({length: 90}, () => Math.floor(Math.random() * 150) + 30)
    };
}

// Increment request count and handle level ups
async function incrementRequestCount(projectId, endpointType) {
    try {
        const today = new Date().toISOString().split('T')[0];
        
        // Get current project data
        const { data: project } = await supabase
            .from('user_projects')
            .select('*')
            .eq('id', projectId)
            .single();

        if (!project) return;

        const updateData = {
            requests_today: (project.requests_today || 0) + 1,
            total_requests: (project.total_requests || 0) + 1,
            last_request_date: today,
            daily_requests: {
                ...(project.daily_requests || {}),
                [today]: ((project.daily_requests || {})[today] || 0) + 1
            },
            updated_at: new Date().toISOString()
        };

        // Check for level up
        if (updateData.total_requests >= (project.level || 1) * LEVEL_UP_THRESHOLD) {
            updateData.level = (project.level || 1) + 1;
            updateData.activity_data = generateActivityData();
        }

        await supabase
            .from('user_projects')
            .update(updateData)
            .eq('id', projectId);

    } catch (error) {
        console.error('Request count error:', error);
    }
}

// Movies Endpoint
app.get('/:id/filmes', verifyProject, async (req, res) => {
    try {
        const projectId = req.params.id;
        await incrementRequestCount(projectId, 'filmes');

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
            data: filmesComLinks
        });

    } catch (err) {
        console.error('Movies endpoint error:', err);
        res.status(500).json({ 
            status: 'error',
            error: 'Internal server error'
        });
    }
});

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
        console.error('Stream error:', err);
        res.status(500).json({ 
            status: 'error',
            error: 'Stream error'
        });
    }
});

// Icon Endpoint (Robust Version)
app.get('/:id/icon/:streamId', verifyProject, async (req, res) => {
    try {
        const streamId = req.params.streamId;
        const iconExtensions = ['.jpg', '.png', ''];
        const basePaths = [
            `http://${XTREAM_CONFIG.host}:${XTREAM_CONFIG.port}/movie/${XTREAM_CONFIG.username}/${XTREAM_CONFIG.password}`,
            `http://${XTREAM_CONFIG.host}:${XTREAM_CONFIG.port}/images/${XTREAM_CONFIG.username}/${XTREAM_CONFIG.password}`
        ];

        let iconFound = false;
        
        // Try multiple URL combinations
        for (const basePath of basePaths) {
            for (const ext of iconExtensions) {
                const iconUrl = `${basePath}/${streamId}${ext}`;
                try {
                    const iconResponse = await fetch(iconUrl);
                    if (iconResponse.ok) {
                        res.set({
                            'Content-Type': iconResponse.headers.get('content-type') || 'image/jpeg',
                            'Cache-Control': 'public, max-age=86400'
                        });
                        iconResponse.body.pipe(res);
                        iconFound = true;
                        return;
                    }
                } catch (e) {
                    console.log(`Tried ${iconUrl} - not found`);
                }
            }
        }

        // If no icon found, return default
        res.sendFile(defaultIconPath);

    } catch (err) {
        console.error('Icon handling error:', err);
        res.sendFile(defaultIconPath);
    }
});

// Anime Endpoint
app.get('/:id/animes', verifyProject, async (req, res) => {
    try {
        const projectId = req.params.id;
        await incrementRequestCount(projectId, 'animes');
        
        res.json({
            status: 'success',
            projectId,
            timestamp: new Date().toISOString(),
            data: generateAnimeData(projectId)
        });
    } catch (err) {
        console.error('Anime endpoint error:', err);
        res.status(500).json({ 
            status: 'error',
            error: 'Internal server error'
        });
    }
});

// Helper function to generate anime data
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

// Frontend Route
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start Server
app.listen(port, () => {
    console.log(`Server running on port ${port}`);
});
