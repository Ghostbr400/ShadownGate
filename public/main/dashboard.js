document.addEventListener('DOMContentLoaded', async function() {
    const REQUEST_LIMIT_PER_DAY = 1000;
    const supabaseUrl = 'https://nwoswxbtlquiekyangbs.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53b3N3eGJ0bHF1aWVreWFuZ2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ3ODEwMjcsImV4cCI6MjA2MDM1NzAyN30.KarBv9AopQpldzGPamlj3zu9eScKltKKHH2JJblpoCE';
    
    let supabase;
    let currentTimeframe = 'month'; // Padrão para mostrar o mês completo

    // Função para obter os dias do mês atual
    function getDaysInCurrentMonth() {
        const date = new Date();
        const year = date.getFullYear();
        const month = date.getMonth();
        return new Date(year, month + 1, 0).getDate();
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
            // Adicione mais dados conforme necessário
        };
        
        const activityData = processActivityData(dailyRequests, timeframe);
        
        // Se o gráfico já existe, atualize. Caso contrário, crie.
        if (window.currentChart) {
            window.currentChart.data.labels = activityData.labels;
            window.currentChart.data.datasets[0].data = activityData.values;
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
                        // No modo mês, mostra apenas alguns dias para não ficar poluído
                        callback: function(val, index) {
                            if (!isMonthView) return this.getLabelForValue(val);
                            const date = new Date(this.getLabelForValue(val));
                            // Mostra apenas dia 1, 5, 10, 15, 20, 25 e último dia
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

    // Configurar botões de período de tempo
    function setupTimeframeButtons() {
        document.querySelectorAll('.timeframe-btn').forEach(btn => {
            btn.addEventListener('click', function() {
                // Atualizar estado visual dos botões
                document.querySelectorAll('.timeframe-btn').forEach(b => {
                    b.classList.remove('bg-blue-500', 'text-white');
                    b.classList.add('bg-gray-700', 'text-gray-300');
                });
                
                this.classList.add('bg-blue-500', 'text-white');
                this.classList.remove('bg-gray-700', 'text-gray-300');
                
                // Atualizar gráfico conforme o período selecionado
                const timeframe = this.getAttribute('data-timeframe');
                updateChart(timeframe);
            });
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

    // ... (mantenha todas as outras funções do código anterior)

    // Iniciar a aplicação
    initialize();
});
