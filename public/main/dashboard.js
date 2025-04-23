document.addEventListener('DOMContentLoaded', async function() {
    const REQUEST_LIMIT_PER_DAY = 1000;
    const supabaseUrl = 'https://nwoswxbtlquiekyangbs.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53b3N3eGJ0bHF1aWVreWFuZ2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ3ODEwMjcsImV4cCI6MjA2MDM1NzAyN30.KarBv9AopQpldzGPamlj3zu9eScKltKKHH2JJblpoCE';
    
    let supabase;
    let currentTimeframe = 'month';

    // Função para mostrar alertas
    function showAlert(message, type) {
        const alert = document.createElement('div');
        alert.className = `fixed top-4 right-4 p-4 rounded-lg shadow-lg text-white font-semibold tracking-wider z-50 ${
            type === 'success' ? 'bg-green-600' : 
            type === 'danger' ? 'bg-red-600' :
            type === 'warning' ? 'bg-yellow-600' :
            'bg-blue-600'
        }`;
        alert.textContent = message;
        document.body.appendChild(alert);
        
        setTimeout(() => {
            alert.classList.add('opacity-0', 'transition-opacity', 'duration-500');
            setTimeout(() => alert.remove(), 500);
        }, 3000);
    }

    // Função para obter o usuário logado
    async function getCurrentUser() {
        const { data: { user }, error } = await supabase.auth.getUser();
        if (error) {
            showAlert('Erro ao verificar usuário', 'danger');
            console.error(error);
            return null;
        }
        return user;
    }

    // Obter ID do projeto da URL
    function getProjectIdFromUrl() {
        const params = new URLSearchParams(window.location.search);
        return params.get('project');
    }

    // Carregar projeto específico do usuário
    async function loadProject(projectId) {
        const user = await getCurrentUser();
        if (!user || !projectId) return null;

        const { data, error } = await supabase
            .from('user_projects')
            .select('*')
            .eq('project_id', projectId)
            .eq('user_id', user.id)
            .single();

        if (error) {
            console.error('Erro ao carregar projeto:', error);
            return null;
        }

        return data;
    }

    // Atualizar projeto no Supabase
    async function updateProject(project) {
        const user = await getCurrentUser();
        if (!user) return false;

        const { error } = await supabase
            .from('user_projects')
            .update(project)
            .eq('project_id', project.id)
            .eq('user_id', user.id);

        if (error) {
            console.error('Erro ao atualizar projeto:', error);
            return false;
        }

        return true;
    }

    // Obter número de dias no mês atual
    function getDaysInCurrentMonth() {
        const date = new Date();
        return new Date(date.getFullYear(), date.getMonth() + 1, 0).getDate();
    }

    // Gerar datas do mês atual (do dia 1 até o último dia)
    function generateMonthDates() {
        const daysInMonth = getDaysInCurrentMonth();
        const dates = [];
        const today = new Date();
        const currentMonth = today.getMonth();
        const currentYear = today.getFullYear();

        for (let day = 1; day <= daysInMonth; day++) {
            dates.push(new Date(currentYear, currentMonth, day));
        }
        return dates;
    }

    // Gerar datas dos últimos 7 dias (incluindo hoje)
    function generateLast7Days() {
        const dates = [];
        const today = new Date();
        for (let i = 6; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            dates.push(date);
        }
        return dates;
    }

    // Gerar datas dos últimos 30 dias (incluindo hoje)
    function generateLast30Days() {
        const dates = [];
        const today = new Date();
        for (let i = 29; i >= 0; i--) {
            const date = new Date(today);
            date.setDate(date.getDate() - i);
            dates.push(date);
        }
        return dates;
    }

    // Formatar data no estilo "Apr 1"
    function formatShortDate(date) {
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }

    // Processar dados de atividade para o gráfico
    function processActivityData(dailyRequests, timeframe) {
        let dates;
        if (timeframe === 'week') {
            dates = generateLast7Days();
        } else if (timeframe === 'month') {
            dates = generateMonthDates();
        } else { // 30 days
            dates = generateLast30Days();
        }
        
        const labels = [];
        const values = [];
        
        dates.forEach(date => {
            const dateStr = date.toISOString().split('T')[0];
            labels.push(formatShortDate(date));
            values.push(dailyRequests[dateStr] || 0);
        });
        
        return {
            labels,
            values
        };
    }

    // Inicializar/Atualizar gráfico de uso
    function updateChart(timeframe = 'month') {
        currentTimeframe = timeframe;
        const projectId = getProjectIdFromUrl();
        
        // Simulação de dados - na implementação real, você buscaria do Supabase
        const dailyRequests = {
            '2025-04-01': 50,
            '2025-04-05': 120,
            '2025-04-10': 200,
            '2025-04-15': 180,
            '2025-04-20': 250,
            '2025-04-23': 412,
        };
        
        const activityData = processActivityData(dailyRequests, timeframe);
        
        if (window.currentChart) {
            window.currentChart.data.labels = activityData.labels;
            window.currentChart.data.datasets[0].data = activityData.values;
            window.currentChart.options = getChartOptions(timeframe);
            window.currentChart.update();
        } else {
            const ctx = document.getElementById('usageChart').getContext('2d');
            window.currentChart = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: activityData.labels,
                    datasets: [{
                        label: 'Requests',
                        data: activityData.values,
                        backgroundColor: 'rgba(58, 107, 255, 0.2)',
                        borderColor: 'rgba(58, 107, 255, 1)',
                        borderWidth: 2,
                        tension: 0.4,
                        fill: true,
                        pointBackgroundColor: 'rgba(58, 107, 255, 1)',
                        pointRadius: 4,
                        pointHoverRadius: 6
                    }]
                },
                options: getChartOptions(timeframe)
            });
        }
    }

    // Configurar opções do gráfico baseado no timeframe
    function getChartOptions(timeframe) {
        const isMonthView = timeframe === 'month';
        
        return {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1E293B',
                    titleColor: '#E2E8F0',
                    bodyColor: '#CBD5E1',
                    borderColor: '#334155',
                    borderWidth: 1,
                    padding: 12,
                    usePointStyle: true
                }
            },
            scales: {
                x: {
                    grid: { 
                        color: 'rgba(255, 255, 255, 0.1)',
                        drawBorder: false
                    },
                    ticks: { 
                        color: '#94a3b8',
                        font: { size: 12 },
                        callback: function(val, index) {
                            if (!isMonthView) return this.getLabelForValue(val);
                            const date = new Date(this.getLabelForValue(val));
                            const day = date.getDate();
                            const lastDay = getDaysInCurrentMonth();
                            return [1, 5, 10, 15, 20, 25, lastDay].includes(day) ? day : '';
                        }
                    }
                },
                y: {
                    beginAtZero: true,
                    grid: { 
                        color: 'rgba(255, 255, 255, 0.1)',
                        drawBorder: false
                    },
                    ticks: { 
                        color: '#94a3b8',
                        font: { size: 12 },
                        stepSize: 50
                    },
                    max: 450
                }
            },
            layout: {
                padding: {
                    top: 20,
                    right: 20,
                    bottom: 20,
                    left: 20
                }
            }
        };
    }

    // Atualizar a interface com os dados do projeto
    function updateProjectUI(project) {
        // Informações básicas
        document.querySelectorAll('#snippetProjectId, #snippetProjectId2').forEach(el => {
            el.textContent = project.project_id || 'N/A';
        });

        document.getElementById('gateName').textContent = project.name || 'Sem nome';
        document.getElementById('gateId').textContent = project.project_id || 'N/A';
        document.getElementById('gateCreated').textContent = project.created_at ? formatDate(project.created_at) : 'Data desconhecida';
        document.getElementById('apiEndpoint').textContent = `${window.location.origin}/api/${project.project_id || 'N/A'}`;
        document.getElementById('spreadsheetUrl').textContent = project.url || 'Sem URL';
        document.getElementById('dailyRequests').textContent = project.requests_today || 412;
        document.getElementById('gateLevel').textContent = project.level || 5;

        // Configurações editáveis
        document.getElementById('editGateName').value = project.name || '';
        document.getElementById('editGateStatus').value = project.status || 'active';
        document.getElementById('cacheSize').textContent = project.cache_size ? `${project.cache_size} KB` : '0 KB';
        document.getElementById('cacheStrategy').value = project.cache_strategy || 'moderate';

        // Barra de progresso
        updateLevelProgress(project);
        
        // Status
        updateGateStatus(project);
        
        // Endpoint /animes
        updateAnimeEndpoint(project);
        
        // Estatísticas
        updateRequestStats(project);
    }

    function updateAnimeEndpoint(project) {
        const container = document.querySelector('.grid.grid-cols-1.md\\:grid-cols-2.gap-4.mb-6');
        let endpointCard = document.getElementById('animeEndpointCard');
        
        if (!endpointCard) {
            endpointCard = document.createElement('div');
            endpointCard.project_id = 'animeEndpointCard';
            endpointCard.className = 'gate-card p-4';
            container.appendChild(endpointCard);
        }
        
        endpointCard.innerHTML = `
            <h3 class="text-sm font-medium text-gray-300 mb-2 tracking-wider flex items-center">
                <i class="bi bi-code-slash text-blue-400 mr-2"></i> ANIME API ENDPOINT
            </h3>
            <div class="flex items-center justify-between bg-gray-800 p-3 rounded border border-gray-700">
                <span id="animeEndpoint" class="text-xs text-white truncate font-mono">${window.location.origin}/${project.project_id}/animes</span>
                <button class="copy-button p-1 text-gray-400 hover:text-blue-400 transition">
                    <i class="bi bi-clipboard"></i>
                </button>
            </div>
            <p class="text-xs text-gray-500 mt-2">Access this URL for anime data in JSON format</p>
        `;
    }

    function updateRequestStats(project) {
        const requestsToday = project.requests_today || 412;
        const totalRequests = project.total_requests || 412;
        const dailyPercentage = Math.min(100, (requestsToday / REQUEST_LIMIT_PER_DAY) * 100);
        
        let statsCard = document.querySelector('.request-stats-card');
        if (!statsCard) {
            statsCard = document.createElement('div');
            statsCard.className = 'gate-card p-4 request-stats-card';
            document.querySelector('.grid.grid-cols-1.md\\:grid-cols-3.gap-4.mb-6').appendChild(statsCard);
        }
        
        statsCard.innerHTML = `
            <h3 class="text-xs font-medium text-gray-400 mb-1 tracking-wider">REQUEST STATISTICS</h3>
            <div class="mt-2 space-y-2">
                <div class="flex justify-between items-center">
                    <span class="text-xs text-gray-400">Today:</span>
                    <span class="text-xs font-medium ${requestsToday >= REQUEST_LIMIT_PER_DAY ? 'text-red-400' : 'text-green-400'}">
                        ${requestsToday}/${REQUEST_LIMIT_PER_DAY}
                    </span>
                </div>
                <div class="h-1 bg-gray-700 rounded-full">
                    <div class="h-1 ${requestsToday >= REQUEST_LIMIT_PER_DAY ? 'bg-red-500' : 'bg-green-500'} rounded-full" 
                         style="width: ${dailyPercentage}%"></div>
                </div>
                <div class="flex justify-between items-center mt-1">
                    <span class="text-xs text-gray-400">Total:</span>
                    <span class="text-xs font-medium text-blue-400">${totalRequests}</span>
                </div>
            </div>
        `;
    }

    function updateLevelProgress(project) {
        const currentLevel = project.level || 5;
        const requestsToNextLevel = 88;
        
        document.getElementById('gateLevel').textContent = currentLevel;
        document.getElementById('requestsToNextLevel').textContent = requestsToNextLevel;
        document.getElementById('levelProgressBar').style.width = '12%';
    }

    function updateGateStatus(project) {
        const statusElement = document.getElementById('gateStatus');
        const status = project.status || 'active';
        
        if (status === 'active') {
            statusElement.innerHTML = '<i class="bi bi-check-circle-fill mr-2"></i> ACTIVE';
            statusElement.className = 'text-xl font-bold text-green-400 flex items-center';
        } else {
            statusElement.innerHTML = '<i class="bi bi-exclamation-circle-fill mr-2"></i> INACTIVE';
            statusElement.className = 'text-xl font-bold text-yellow-400 flex items-center';
        }
    }

    function formatDate(dateString) {
        try {
            const options = { year: 'numeric', month: 'short', day: 'numeric' };
            return new Date(dateString).toLocaleDateString('en-US', options);
        } catch (e) {
            console.error('Erro ao formatar data:', e);
            return 'Data inválida';
        }
    }

    // Configurar abas
    function setupTabs() {
        const tabLinks = document.querySelectorAll('.tab-link');
        
        tabLinks.forEach(link => {
            link.addEventListener('click', function(e) {
                e.preventDefault();
                
                tabLinks.forEach(tab => {
                    tab.classList.remove('border-blue-400', 'text-blue-400');
                    tab.classList.add('border-transparent', 'text-gray-400');
                });
                
                this.classList.add('border-blue-400', 'text-blue-400');
                this.classList.remove('border-transparent', 'text-gray-400');
                
                const tabId = this.getAttribute('data-tab');
                document.querySelectorAll('.tab-content').forEach(content => {
                    content.classList.remove('active');
                });
                document.getElementById(tabId).classList.add('active');
            });
        });
    }

    function setupCopyButtons() {
        document.querySelectorAll('.copy-button, .copy-snippet').forEach(button => {
            button.addEventListener('click', function() {
                const text = this.previousElementSibling?.textContent || 
                             this.parentElement.querySelector('span, pre')?.textContent;
                
                if (text) {
                    navigator.clipboard.writeText(text.trim()).then(() => {
                        const icon = this.innerHTML;
                        this.innerHTML = '<i class="bi bi-check2 text-green-400"></i>';
                        setTimeout(() => {
                            this.innerHTML = icon;
                        }, 2000);
                    });
                }
            });
        });
    }

    function setupTimeframeButtons() {
        document.querySelectorAll('.timeframe-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                document.querySelectorAll('.timeframe-btn').forEach(b => {
                    b.classList.remove('bg-blue-500', 'text-white');
                    b.classList.add('bg-gray-700', 'text-gray-300');
                });
                
                this.classList.add('bg-blue-500', 'text-white');
                this.classList.remove('bg-gray-700', 'text-gray-300');
                
                const timeframe = this.getAttribute('data-timeframe');
                updateChart(timeframe);
            });
        });
    }

    function setupEventListeners() {
        // Botão de voltar
        document.getElementById('backButton').addEventListener('click', () => {
            window.location.href = 'home.html';
        });

        // Botão de logout no footer
        document.querySelector('footer button:nth-child(3)').addEventListener('click', async () => {
            const { error } = await supabase.auth.signOut();
            if (!error) {
                window.location.href = 'login.html';
            } else {
                showAlert('Erro ao fazer logout', 'danger');
            }
        });

        // Botão de salvar configurações
        document.getElementById('saveSettings')?.addEventListener('click', async () => {
            const projectId = getProjectIdFromUrl();
            const project = await loadProject(projectId);
            
            if (project) {
                project.name = document.getElementById('editGateName').value;
                project.status = document.getElementById('editGateStatus').value;
                
                const success = await updateProject(project);
                if (success) {
                    showAlert('Configurações salvas com sucesso', 'success');
                    updateProjectUI(project);
                }
            }
        });

        // Botão de limpar cache
        document.getElementById('clearCache')?.addEventListener('click', async () => {
            const projectId = getProjectIdFromUrl();
            const project = await loadProject(projectId);
            
            if (project) {
                project.cache_size = 0;
                const success = await updateProject(project);
                if (success) {
                    showAlert('Cache limpo com sucesso', 'success');
                    document.getElementById('cacheSize').textContent = '0 KB';
                }
            }
        });
    }

    // Inicialização da página
    async function initialize() {
        try {
            // Inicializar Supabase
            supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
            window.supabase = supabase;
            
            const projectId = getProjectIdFromUrl();
            if (!projectId) {
                showAlert('Projeto não especificado', 'danger');
                setTimeout(() => window.location.href = 'home.html', 2000);
                return;
            }

            const project = await loadProject(projectId);
            if (!project) {
                showAlert('Projeto não encontrado', 'danger');
                setTimeout(() => window.location.href = 'home.html', 2000);
                return;
            }

            // Configurar elementos da UI
            setupTabs();
            setupCopyButtons();
            setupTimeframeButtons();
            setupEventListeners();
            
            // Inicializar gráfico com o mês atual por padrão
            updateChart('month');
            
            // Atualizar UI com os dados do projeto
            updateProjectUI(project);

        } catch (error) {
            showAlert('Erro ao inicializar aplicação: ' + error.message, 'danger');
            console.error(error);
        }
    }

    // Iniciar a aplicação
    initialize();
});
