document.addEventListener('DOMContentLoaded', async function() {
    const supabaseUrl = 'https://nwoswxbtlquiekyangbs.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53b3N3eGJ0bHF1aWVreWFuZ2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ3ODEwMjcsImV4cCI6MjA2MDM1NzAyN30.KarBv9AopQpldzGPamlj3zu9eScKltKKHH2JJblpoCE';
    
    let supabase;
    let currentProject;

    // Função para mostrar alertas
    function showAlert(message, type = 'info') {
        const alert = document.createElement('div');
        alert.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg text-white font-semibold z-50 ${
            type === 'danger' ? 'bg-red-600' : 'bg-blue-600'
        }`;
        alert.textContent = message;
        document.body.appendChild(alert);
        setTimeout(() => alert.remove(), 3000);
    }

    // Carregar projeto do Supabase
    async function loadProject() {
        const projectId = new URLSearchParams(window.location.search).get('project');
        if (!projectId) throw new Error('Projeto não especificado');

        const { data: { user }, error: userError } = await supabase.auth.getUser();
        if (userError) throw userError;

        const { data, error } = await supabase
            .from('user_projects')
            .select('*')
            .eq('project_id', projectId)
            .eq('user_id', user.id)
            .single();

        if (error) throw error;
        return data;
    }

    // Inicializar gráfico com pontos
    async function initChart() {
        if (!currentProject || !document.getElementById('usageChart')) return;
        
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
        
        // Processar dados para o gráfico
        const labels = dates.map(date => 
            date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        );
        
        const values = dates.map(date => {
            const dateStr = date.toISOString().split('T')[0];
            return currentProject.daily_requests?.[dateStr] || 0;
        });

        // Destruir gráfico anterior se existir
        if (window.currentChart) {
            window.currentChart.destroy();
        }

        // Criar novo gráfico com pontos visíveis
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
                    fill: true,
                    pointBackgroundColor: 'rgba(58, 107, 255, 1)',
                    pointRadius: 5,
                    pointHoverRadius: 7,
                    pointBorderWidth: 2
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { 
                    legend: { display: false },
                    tooltip: {
                        displayColors: false,
                        callbacks: {
                            label: function(context) {
                                return `${context.parsed.y} requests`;
                            }
                        }
                    }
                },
                scales: {
                    x: { 
                        grid: { display: false },
                        ticks: {
                            maxRotation: 0,
                            autoSkip: true,
                            maxTicksLimit: 10
                        }
                    },
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 50,
                            callback: function(value) {
                                return value % 100 === 0 ? value : '';
                            }
                        },
                        grid: {
                            color: 'rgba(255, 255, 255, 0.1)'
                        }
                    }
                }
            }
        });
    }

    // Atualizar UI conforme screenshot
    function updateUI() {
        if (!currentProject) return;
        
        // Endpoint API
        const endpointElement = document.getElementById('apiEndpoint');
        if (endpointElement) {
            endpointElement.textContent = `https://shadowngate-1.onrender.com/api/${currentProject.project_id}`;
            endpointElement.parentElement.querySelector('p').textContent = 'Access this URL for JSON response';
        }
        
        // Link da planilha
        const spreadsheetElement = document.getElementById('spreadsheetUrl');
        if (spreadsheetElement && currentProject.url) {
            spreadsheetElement.textContent = currentProject.url;
            spreadsheetElement.href = currentProject.url;
        }
        
        // Nível e progresso
        document.getElementById('gateLevel').textContent = currentProject.level || 1;
    }

    // Configurar eventos
    function setupEventListeners() {
        // Botão de voltar
        const backButton = document.getElementById('backButton');
        if (backButton) {
            backButton.addEventListener('click', () => {
                window.location.href = 'home.html';
            });
        }
        
        // Botão de copiar endpoint
        const copyButton = document.querySelector('.copy-button');
        if (copyButton) {
            copyButton.addEventListener('click', () => {
                const text = document.getElementById('apiEndpoint')?.textContent;
                if (text) {
                    navigator.clipboard.writeText(text.trim());
                    const icon = copyButton.innerHTML;
                    copyButton.innerHTML = '<i class="bi bi-check2"></i>';
                    setTimeout(() => {
                        copyButton.innerHTML = icon;
                    }, 2000);
                }
            });
        }
    }

    // Inicialização
    async function initialize() {
        try {
            supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
            currentProject = await loadProject();
            
            updateUI();
            await initChart();
            setupEventListeners();

        } catch (error) {
            showAlert(error.message, 'danger');
            console.error(error);
            setTimeout(() => window.location.href = 'home.html', 2000);
        }
    }

    initialize();
});
