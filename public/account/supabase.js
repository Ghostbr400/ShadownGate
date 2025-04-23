// Configuração do Supabase
const supabaseUrl = 'https://nwoswxbtlquiekyangbs.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53b3N3eGJ0bHF1aWVreWFuZ2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ3ODEwMjcsImV4cCI6MjA2MDM1NzAyN30.KarBv9AopQpldzGPamlj3zu9eScKltKKHH2JJblpoCE';
const supabase = supabase.createClient(supabaseUrl, supabaseKey);

// Função para verificar autenticação e redirecionar se não estiver autenticado
async function checkAuthAndRedirect(redirectUrl = 'login.html') {
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error || !session) {
        window.location.href = redirectUrl;
        return null;
    }
    return session;
}

// Função para logout
async function logout() {
    const { error } = await supabase.auth.signOut();
    if (!error) {
        window.location.href = 'login.html';
    } else {
        console.error('Logout error:', error);
    }
}

// Função para mostrar mensagens
function showMessage(type, message, duration = 5000) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `fixed top-4 right-4 z-50 px-4 py-3 rounded-md shadow-lg flex items-center ${
        type === 'success' ? 'bg-green-600' : 'bg-red-600'
    } text-white`;
    messageDiv.innerHTML = `
        <i class="bi ${type === 'success' ? 'bi-check-circle' : 'bi-exclamation-triangle'} mr-3"></i>
        <span class="flex-1">${message}</span>
        <button onclick="this.parentElement.remove()" class="ml-4 text-lg">
            <i class="bi bi-x"></i>
        </button>
    `;
    document.body.appendChild(messageDiv);
    setTimeout(() => {
        if (messageDiv.parentNode) {
            messageDiv.remove();
        }
    }, duration);
}

export { supabase, checkAuthAndRedirect, logout, showMessage };
