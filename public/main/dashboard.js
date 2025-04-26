document.addEventListener('DOMContentLoaded', async function() {
    const supabaseUrl = 'https://nwoswxbtlquiekyangbs.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53b3N3eGJ0bHF1aWVreWFuZ2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ3ODEwMjcsImV4cCI6MjA2MDM1NzAyN30.KarBv9AopQpldzGPamlj3zu9eScKltKKHH2JJblpoCE';
    
    let supabase;
    let currentProject;

    // Fun��ões básicas
    function showAlert(message, type = 'info') {
        const alert = document.createElement('div');
        alert.className = `fixed top-4 right-4 px-4 py-2 rounded-md text-white ${
            type === 'success' ? 'bg-green-500' : 
            type === 'danger' ? 'bg-red-500' : 'bg-blue-500'
        }`;
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

    // Configurar botões de copiar
    function setupCopyButtons() {
        document.querySelectorAll('.copy-button').forEach(button => {
            button.addEventListener('click', function() {
                const endpoint = this.closest('.gate-card').querySelector('span.font-mono').textContent;
                const fullUrl = `https://shadowngate-1.onrender.com${endpoint.replace('{projectid}', currentProject.project_id)}`;
                
                navigator.clipboard.writeText(fullUrl).then(() => {
                    showAlert('URL copiada com sucesso!', 'success');
                }).catch(err => {
                    showAlert('Falha ao copiar URL', 'danger');
                });
            });
        });
    }

    // Criar cards de endpoint
    function createEndpointCards() {
        const endpointsContainer = document.getElementById('endpointsContainer');
        
        const endpoints = [
            {
                method: 'GET',
                path: '/api/{projectid}/animes',
                description: 'Retorna uma lista com todos os animes disponíveis.',
                authRequired: false,
                params: []
            },
            {
                method: 'GET',
                path: '/api/{projectid}/filmes',
                description: 'Retorna uma lista com todos os filmes disponíveis.',
                authRequired: false,
                params: []
            },
            {
                method: 'GET',
                path: '/api/{projectid}/filmes/q?q={query}',
                description: 'Busca filmes por título ou ID do TMDB.',
                authRequired: false,
                params: [
                    { name: 'q', type: 'query', required: true, description: 'Termo de busca ou ID do TMDB' }
                ]
            },
            {
                method: 'GET',
                path: '/api/{projectid}/stream-direct/{streamId}',
                description: 'Retorna o stream direto de um filme.',
                authRequired: false,
                params: [
                    { name: 'streamId', type: 'path', required: true, description: 'ID do stream' }
                ]
            },
            {
                method: 'GET',
                path: '/api/{projectid}/tmdb-to-stream/{tmdbId}',
                description: 'Converte um ID do TMDB para um stream ID.',
                authRequired: false,
                params: [
                    { name: 'tmdbId', type: 'path', required: true, description: 'ID do filme no TMDB' }
                ]
            },
            {
                method: 'GET',
                path: '/api/{projectid}/get-movie-title/{streamId}',
                description: 'Obtém o título de um filme pelo stream ID.',
                authRequired: false,
                params: [
                    { name: 'streamId', type: 'path', required: true, description: 'ID do stream' }
                ]
            }
        ];

        endpointsContainer.innerHTML = endpoints.map(endpoint => `
            <div class="gate-card overflow-hidden">
                <div class="bg-blue-900 bg-opacity-30 px-4 sm:px-6 py-3 flex flex-col sm:flex-row sm:items-center justify-between">
                    <div class="flex items-center mb-2 sm:mb-0">
                        <span class="inline-block ${getMethodColorClass(endpoint.method)} text-white font-semibold text-xs sm:text-sm rounded px-2 py-1 mr-2">${endpoint.method}</span>
                        <span class="font-mono text-sm sm:text-base">${endpoint.path}</span>
                    </div>
                </div>
                <div class="px-4 sm:px-6 py-3">
                    <p class="text-sm mb-3">${endpoint.description}</p>
                    
                    ${endpoint.params.length > 0 ? `
                        <p class="text-xs text-gray-400 mb-1"><strong>Parâmetros:</strong></p>
                        <ul class="list-disc list-inside text-xs text-gray-400 pl-2 mb-3">
                            ${endpoint.params.map(param => `
                                <li>
                                    <span class="font-mono">${param.name}</span> (${param.type}): ${param.description}
                                    ${param.required ? '<span class="text-red-400">*</span>' : ''}
                                </li>
                            `).join('')}
                        </ul>
                    ` : ''}
                    
                    <div class="flex flex-wrap items-center justify-between gap-2">
                        <p class="text-xs text-gray-400">
                            <i class="bi bi-shield-check ${endpoint.authRequired ? 'text-red-400' : 'text-green-400'} mr-1"></i> 
                            ${endpoint.authRequired ? 'Requer autenticação' : 'Não requer autenticação'}
                        </p>
                        <button class="copy-button text-xs bg-blue-900 text-blue-300 px-3 py-1 rounded hover:bg-blue-800 transition">
                            <i class="bi bi-clipboard mr-1"></i> Copiar URL
                        </button>
                    </div>
                </div>
            </div>
        `).join('');

        setupCopyButtons();
    }

    function getMethodColorClass(method) {
        switch(method) {
            case 'GET': return 'method-get';
            case 'POST': return 'method-post';
            case 'PUT': return 'method-put';
            case 'DELETE': return 'method-delete';
            default: return 'bg-gray-500';
        }
    }

    // Atualizar UI com informações do projeto
    function updateUI() {
        if (!currentProject) return;
        
        // Nome do projeto
        const projectNameElement = document.querySelector('.project-name strong');
        if (projectNameElement) {
            projectNameElement.textContent = currentProject.name || 'Shadow Gate API';
        }
        
        // Informações do gate
        document.getElementById('gateId').textContent = `GATE ID: ${currentProject.project_id}`;
        
        // Estatísticas
        document.getElementById('totalRequests').textContent = currentProject.total_requests?.toLocaleString() || '0';
        document.getElementById('level').textContent = currentProject.level || '1';
        
        // Barra de progresso
        const progress = (currentProject.total_requests % 100) || 0;
        document.getElementById('levelBar').style.width = `${progress}%`;
        
        // Criar cards de endpoint
        createEndpointCards();
    }

    // Configurar eventos
    function setupEventListeners() {
        // Botão de voltar
        document.getElementById('backButton').addEventListener('click', () => {
            window.location.href = 'home.html';
        });

        // Menu toggle
        document.getElementById('menuToggle').addEventListener('click', function() {
            const menu = document.getElementById('menu');
            menu.style.display = menu.style.display === 'block' ? 'none' : 'block';
        });

        // Funções do menu
        window.showAbout = function() {
            alert('Sobre: Shadow Gate API\nVersão 1.0\nProjeto: ' + (currentProject?.name || 'N/A'));
        };

        window.exit = function() {
            supabase.auth.signOut().then(() => {
                window.location.href = 'login.html';
            });
        };

        // Rodapé interativo
        document.querySelector('footer div:nth-child(1)').addEventListener('click', () => {
            window.location.href = 'home.html';
        });
        document.querySelector('footer div:nth-child(2)').addEventListener('click', () => {
            window.location.href = 'dashboard.html?project=' + currentProject.project_id;
        });
        document.querySelector('footer div:nth-child(3)').addEventListener('click', exit);
    }

    // Inicialização
    async function initialize() {
        try {
            supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
            currentProject = await loadProject();
            
            updateUI();
            setupEventListeners();

        } catch (error) {
            showAlert(error.message, 'danger');
            console.error(error);
            setTimeout(() => window.location.href = 'home.html', 2000);
        }
    }

    initialize();
});
