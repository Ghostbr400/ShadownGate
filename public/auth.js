document.addEventListener('DOMContentLoaded', async function() {
    const supabaseUrl = 'https://nwoswxbtlquiekyangbs.supabase.co';
    const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53b3N3eGJ0bHF1aWVreWFuZ2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ3ODEwMjcsImV4cCI6MjA2MDM1NzAyN30.KarBv9AopQpldzGPamlj3zu9eScKltKKHH2JJblpoCE';
    const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);

    const { data: { user } } = await supabase.auth.getUser();
    
    // Se não estiver logado e não estiver na página de login/registro
    if (!user && !['/account/login.html', '/account/register.html'].includes(window.location.pathname.split('/').pop())) {
        window.location.href = '/account/login.html';
    }
    
    // Se estiver logado e tentar acessar login/registro
    if (user && ['/account/login.html', '/account/register.html'].includes(window.location.pathname.split('/').pop())) {
        window.location.href = '/main/home.html';
    }
});

