document.addEventListener('DOMContentLoaded', async function() {
    const REQUEST_LIMIT_PER_DAY = 1000;
    const supabaseUrl = 'https://nwoswxbtlquiekyangbs.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53b3N3eGJ0bHF1aWVreWFuZ2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ3ODEwMjcsImV4cCI6MjA2MDM1NzAyN30.KarBv9AopQpldzGPamlj3zu9eScKltKKHH2JJblpoCE';
    let supabase;

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

    // Função para obter projetos do usuário
    async function getProjects() {
        const user = await getCurrentUser();
        if (!user) return [];
        
        const { data, error } = await supabase
            .from('user_projects')
            .select('*')
            .eq('user_id', user.id);
        
        if (error) {
            showAlert('Erro ao carregar projetos', 'danger');
            console.error(error);
            return [];
        }
        
        return data || [];
    }

    // Função para adicionar um novo projeto
    async function addProject(project) {
        const user = await getCurrentUser();
        if (!user) {
            showAlert('Usuário não autenticado', 'danger');
            return false;
        }
        
        const { error } = await supabase
            .from('user_projects')
            .insert([{
                ...project,
                user_id: user.id
            }]);
        
        if (error) {
            showAlert('Erro ao criar projeto: ' + error.message, 'danger');
            console.error(error);
            return false;
        }
        
        return true;
    }

    // Função para atualizar um projeto
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

    // Carregar projetos na interface
    async function loadProjects() {
        const container = document.getElementById('projectsContainer');
        const noProjects = document.getElementById('noProjects');
        const projects = await getProjects();
        
        container.innerHTML = '';
        noProjects.classList.toggle('hidden', projects.length > 0);

        projects.forEach(project => {
            const card = document.createElement('div');
            card.className = 'project-card bg-gray-800 rounded-lg overflow-hidden cursor-pointer';
            card.innerHTML = `
                <div class="absolute top-2 right-2 bg-solo-dark text-solo-blue border border-solo-blue px-2 py-1 rounded-full text-xs font-bold tracking-wider">
                    LV. ${project.level || 1}
                </div>
                <div class="p-4 border-b border-gray-700">
                    <div class="flex justify-between items-start">
                        <h3 class="text-lg font-semibold text-white tracking-wider">${project.name || 'Sem nome'}</h3>
                        <span class="status-badge ${(project.status || 'active') === 'active' ? 'text-green-400' : 'text-yellow-400'} text-xs font-medium px-2 py-0.5 rounded-full bg-opacity-20 ${(project.status || 'active') === 'active' ? 'bg-green-900' : 'bg-yellow-900'}">
                            ${(project.status || 'active') === 'active' ? 'ACTIVE' : 'INACTIVE'}
                        </span>
                    </div>
                    <p class="text-xs text-gray-400 mt-1 tracking-wider">CREATED ${project.created_at ? formatDate(project.created_at) : 'Data desconhecida'}</p>
                </div>
                <div class="p-4">
                    <div class="flex items-center mb-3">
                        <i class="bi bi-link text-gray-400 mr-2"></i>
                        <span class="text-xs text-gray-300 truncate">${project.url || 'Sem URL'}</span>
                    </div>
                    <div class="flex justify-between text-xs text-gray-400 tracking-wider">
                        <span>${project.requests_today || 0}/${REQUEST_LIMIT_PER_DAY} REQUESTS TODAY</span>
                        <span class="flex items-center">
                            <i class="bi bi-arrow-right text-solo-blue ml-1"></i>
                        </span>
                    </div>
                </div>
            `;
            card.addEventListener('click', () => {
                window.location.href = `dashboard.html?project=${encodeURIComponent(project.project_id)}`;
            });
            container.appendChild(card);
        });
    }

    // Configurar formulário de novo projeto
    async function setupForm() {
        document.getElementById('newProjectForm').addEventListener('submit', async function(e) {
            e.preventDefault();
            
            const projectName = document.getElementById('projectName').value.trim();
            const spreadsheetUrl = document.getElementById('spreadsheetUrl').value.trim();
            const description = document.getElementById('projectDescription').value.trim();
            
            if (!projectName || !spreadsheetUrl) {
                showAlert('Preencha todos os campos obrigatórios', 'danger');
                return;
            }

            const idProject = `gate-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
            const today = new Date().toISOString().split('T')[0];
            
            const newProject = {
                project_id: idProject,
                name: projectName,
                url: spreadsheetUrl,
                description: description,
                status: 'active',
                created_at: new Date().toISOString(),
                requests_today: 0,
                total_requests: 0,
                last_request_date: today,
                daily_requests: { [today]: 0 },
                level: 1,
                activity_data: generateActivityData()
            };
            
            try {
                const success = await addProject(newProject);
                
                if (success) {
                    showAlert('Projeto criado com sucesso! Redirecionando...', 'success');
                    
                    // Limpar formulário
                    this.reset();
                    
                    setTimeout(() => {
                        window.location.href = `dashboard.html?project=${encodeURIComponent(idProject)}`;
                    }, 1500);
                }
            } catch (error) {
                showAlert(`Erro ao criar projeto: ${error.message}`, 'danger');
                console.error(error);
            }
        });
    }

    // Gerar dados de atividade aleatórios
    function generateActivityData() {
        return {
            '7d': Array.from({length: 7}, () => Math.floor(Math.random() * 50) + 10),
            '30d': Array.from({length: 30}, () => Math.floor(Math.random() * 100) + 20),
            '90d': Array.from({length: 90}, () => Math.floor(Math.random() * 150) + 30)
        };
    }

    // Formatar data
    function formatDate(dateString) {
        try {
            const options = { year: 'numeric', month: 'short', day: 'numeric' };
            return new Date(dateString).toLocaleDateString('en-US', options);
        } catch (e) {
            console.error('Erro ao formatar data:', e);
            return 'Data inválida';
        }
    }

    // Inicialização
    async function initialize() {
        try {
            // Inicializar Supabase
            supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
            window.supabase = supabase;
            
            // Verificar autenticação
            const user = await getCurrentUser();
            if (!user) {
                window.location.href = 'login.html';
                return;
            }

            // Carregar projetos
            await loadProjects();
            
            // Configurar formulário
            setupForm();
            
        } catch (error) {
            showAlert('Erro ao inicializar aplicação: ' + error.message, 'danger');
            console.error(error);
        }
    }

    // Iniciar a aplicação
    initialize();
});
