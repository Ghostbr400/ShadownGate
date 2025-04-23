document.addEventListener('DOMContentLoaded', async function() {
  // Verifica se já está autenticado
  const { data: { session } } = await supabase.auth.getSession();
  if (session) {
    window.location.href = '../main/home.html';
  }

  // Icon configuration
  const icons = {
    logo: 'bi-gate',
    form: {
      email: 'bi-envelope',
      password: 'bi-shield-lock',
      togglePassword: {
        show: 'bi-eye',
        hide: 'bi-eye-slash'
      },
      submit: 'bi-box-arrow-in-right'
    },
    social: {
      google: 'bi-google',
      github: 'bi-github',
      facebook: 'bi-facebook'
    },
    footer: {
      back: 'bi-arrow-left',
      security: 'bi-shield-check'
    }
  };

  // Initialize particles.js if the element exists
  if (document.getElementById('particles-js')) {
    particlesJS('particles-js', {
      "particles": {
        "number": {
          "value": 60,
          "density": {
            "enable": true,
            "value_area": 800
          }
        },
        "color": {
          "value": "#3b82f6"
        },
        "shape": {
          "type": "circle",
          "stroke": {
            "width": 0,
            "color": "#000000"
          }
        },
        "opacity": {
          "value": 0.3,
          "random": true,
          "anim": {
            "enable": false,
            "speed": 1,
            "opacity_min": 0.1,
            "sync": false
          }
        },
        "size": {
          "value": 3,
          "random": true,
          "anim": {
            "enable": false,
            "speed": 40,
            "size_min": 0.1,
            "sync": false
          }
        },
        "line_linked": {
          "enable": true,
          "distance": 150,
          "color": "#3b82f6",
          "opacity": 0.2,
          "width": 1
        },
        "move": {
          "enable": true,
          "speed": 2,
          "direction": "none",
          "random": false,
          "straight": false,
          "out_mode": "out",
          "bounce": false,
          "attract": {
            "enable": false,
            "rotateX": 600,
            "rotateY": 1200
          }
        }
      },
      "interactivity": {
        "detect_on": "canvas",
        "events": {
          "onhover": {
            "enable": true,
            "mode": "grab"
          },
          "onclick": {
            "enable": true,
            "mode": "push"
          },
          "resize": true
        },
        "modes": {
          "grab": {
            "distance": 140,
            "line_linked": {
              "opacity": 1
            }
          },
          "push": {
            "particles_nb": 4
          }
        }
      },
      "retina_detect": true
    });
  }

  // Password visibility toggle
  const togglePasswordIcon = document.getElementById('toggle-password-icon');
  const passwordInput = document.getElementById('password');
  
  if (togglePasswordIcon && passwordInput) {
    togglePasswordIcon.addEventListener('click', function() {
      if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        togglePasswordIcon.classList.remove(icons.form.togglePassword.show);
        togglePasswordIcon.classList.add(icons.form.togglePassword.hide);
      } else {
        passwordInput.type = 'password';
        togglePasswordIcon.classList.remove(icons.form.togglePassword.hide);
        togglePasswordIcon.classList.add(icons.form.togglePassword.show);
      }
    });
  }

  // Alert function
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

  // Form submission
  const form = document.getElementById('loginForm');
  if (form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();

      const email = document.getElementById('email')?.value;
      const password = document.getElementById('password')?.value;
      const rememberMe = document.getElementById('remember-me')?.checked;

      if (!email || !password) {
        showAlert('Email and password are required', 'warning');
        return;
      }

      try {
        // Initialize Supabase
        const supabaseUrl = 'https://nwoswxbtlquiekyangbs.supabase.co';
        const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53b3N3eGJ0bHF1aWVreWFuZ2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ3ODEwMjcsImV4cCI6MjA2MDM1NzAyN30.KarBv9AopQpldzGPamlj3zu9eScKltKKHH2JJblpoCE';
        const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
        window.supabase = supabase;

        // Set session duration based on "Remember me"
        if (rememberMe) {
          // 30 days expiration for "Remember me"
          await supabase.auth.setSession({
            expires_in: 60 * 60 * 24 * 30 // 30 days in seconds
          });
        }

        const { data, error } = await supabase.auth.signInWithPassword({
          email,
          password
        });

        if (error) {
          showAlert('Login failed: ' + error.message, 'danger');
          return;
        }

        // Show success message and redirect
        showAlert('Login successful! Redirecting...', 'success');
        
        // Store user data in localStorage if needed
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Redirect to dashboard or home page after 2 seconds
        setTimeout(() => {
          window.location.href = '../main/home.html';
        }, 2000);

      } catch (err) {
        showAlert('Unexpected error: ' + err.message, 'danger');
        console.error(err);
      }
    });
  }

  // Forgot password link
  const forgotPasswordLink = document.querySelector('a[href="#"]');
  if (forgotPasswordLink) {
    forgotPasswordLink.addEventListener('click', async function(e) {
      e.preventDefault();
      const email = prompt('Please enter your email address to reset your password:');
      
      if (email) {
        try {
          const supabaseUrl = 'https://nwoswxbtlquiekyangbs.supabase.co';
          const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53b3N3eGJ0bHF1aWVreWFuZ2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ3ODEwMjcsImV4cCI6MjA2MDM1NzAyN30.KarBv9AopQpldzGPamlj3zu9eScKltKKHH2JJblpoCE';
          const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
          
          const { error } = await supabase.auth.resetPasswordForEmail(email, {
            redirectTo: window.location.origin + '/reset-password.html'
          });

          if (error) {
            showAlert('Error sending reset email: ' + error.message, 'danger');
          } else {
            showAlert('Password reset email sent! Please check your inbox.', 'success');
          }
        } catch (err) {
          showAlert('Error: ' + err.message, 'danger');
        }
      }
    });
  }
});
