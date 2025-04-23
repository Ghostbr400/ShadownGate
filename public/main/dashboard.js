document.addEventListener('DOMContentLoaded', async function() {
    const supabaseUrl = 'https://nwoswxbtlquiekyangbs.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53b3N3eGJ0bHF1aWVreWFuZ2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ3ODEwMjcsImV4cCI6MjA2MDM1NzAyN30.KarBv9AopQpldzGPamlj3zu9eScKltKKHH2JJblpoCE';
    
    let supabase;
    let currentProject;

    // Funções básicas
    function showAlert(message, type = 'info') {
        const alert = document.createElement('div');
        alert.className = `alert ${type}`;
        alert.textContent = message;
        document.body.appendChild(alert);
        setTimeout(() => alert.remove(), 3000);
    }

    async function getCurrentUser() {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) throw error;
        return user;
    }

    function getProjectIdFromUrl() {
        return new URLSearchParams(window.location.search).get('project');
    }

    // Carregar projeto
    async function loadProject() {
        const projectId = getProjectIdFromUrl();
        if (!projectId) throw new Error('Projeto não especificado');

        const user = await getCurrentUser();
        const { data, error } = await supabase
            .from('user_projects')
            .select('*')
            .eq('project_id', projectId)
            .eq('user_id', user.id)
            .single();

        if (error) throw error;
        return data;
    }

    // Gráfico otimizado
    async function initChart() {
        if (!currentProject) return;
        
        const ctx = document.getElementById('usageChart').getContext('2d');
        const projectDate = new Date(currentProject.created_at);
        const today = new Date();
        
        // Gerar datas desde a criação do projeto até hoje
        const dates = [];
        const current = new Date(projectDate);
        
        while (current <= today) {
            dates.push(new Date(current));
            current.setDate(current.getDate() + 1);
        }
        
        // Processar dados
        const labels = dates.map(date => 
            date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        );
        
        const values = dates.map(date => {
            const dateStr = date.toISOString().split('T')[0];
            return currentProject.daily_requests?.[dateStr] || 0;
        });

        // Se já existir um gráfico, destruir antes de criar novo
        if (window.currentChart) {
            window.currentChart.destroy();
        }

        window.currentChart = new Chart(ctx, {
            type: 'line',
            data: {
                labels,
                datasets: [{
                    label: 'Requests',
                    data: values,
                    backgroundColor: 'rgba(58, 107, 255, 0.2)',
                    borderColor: 'rgba(58, 107, 255, 1)',
                    borderWidth: 2,
                    tension: 0.4,
                    fill: true
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                scales: {
                    x: { grid: { display: false } },
                    y: { beginAtZero: true }
                }
            }
        });
    }

    // Atualizar UI
    function updateUI() {
        if (!currentProject) return;
        
        // Informações básicas
        document.getElementById('gateName').textContent = currentProject.name || 'Sem nome';
        document.getElementById('gateId').textContent = currentProject.project_id;
        document.getElementById('gateCreated').textContent = 
            new Date(currentProject.created_at).toLocaleDateString();
        
        // Nível e progresso
        document.getElementById('gateLevel').textContent = currentProject.level || 1;
        document.getElementById('requestsToNextLevel').textContent = 
            Math.max(0, 100 - (currentProject.total_requests % 100));
        
        // Endpoint
        document.getElementById('apiEndpoint').textContent = 
            `${window.location.origin}/api/${currentProject.project_id}`;
    }

    // Configurar eventos
    function setupEventListeners() {
        // Botões de timeframe
        document.querySelectorAll('.timeframe-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                // Lógica simplificada - pode ser expandida
                initChart();
            });
        });

        // Botão de voltar
        document.getElementById('backButton').addEventListener('click', () => {
            window.location.href = 'home.html';
        });
    }

    // Inicialização
    async function initialize() {
        try {
            supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
            currentProject = await loadProject();
            
            updateUI();
            initChart();
            setupEventListeners();

        } catch (error) {
            showAlert(error.message, 'danger');
            console.error(error);
            setTimeout(() => window.location.href = 'home.html', 2000);
        }
    }

    initialize();
});
