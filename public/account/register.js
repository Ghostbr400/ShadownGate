document.addEventListener('DOMContentLoaded', async function() {
  // Icon configuration
  const icons = {
    logo: 'bi-gate',
    form: {
      name: 'bi-person',
      email: 'bi-envelope',
      password: 'bi-shield-lock',
      confirm: 'bi-shield-check',
      togglePassword: {
        show: 'bi-eye',
        hide: 'bi-eye-slash'
      },
      submit: 'bi-person-plus'
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

  // Set all icons from the configuration
  document.getElementById('logo-icon')?.classList.add(icons.logo);
  document.getElementById('name-icon')?.classList.add(icons.form.name);
  document.getElementById('email-icon')?.classList.add(icons.form.email);
  document.getElementById('password-icon')?.classList.add(icons.form.password);
  document.getElementById('confirm-icon')?.classList.add(icons.form.confirm);
  document.getElementById('toggle-password-icon')?.classList.add(icons.form.togglePassword.show);
  document.getElementById('submit-icon')?.classList.add(icons.form.submit);
  document.getElementById('google-icon')?.classList.add(icons.social.google);
  document.getElementById('github-icon')?.classList.add(icons.social.github);
  document.getElementById('facebook-icon')?.classList.add(icons.social.facebook);
  document.getElementById('back-icon')?.classList.add(icons.footer.back);
  document.getElementById('security-icon')?.classList.add(icons.footer.security);

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

  // Password strength meter
  const password = document.getElementById('password');
  const confirmPassword = document.getElementById('confirmPassword');
  const strengthMeter = document.getElementById('passwordStrength');
  const passwordMatch = document.getElementById('passwordMatch');

  if (password && strengthMeter) {
    password.addEventListener('input', function() {
      const val = this.value;
      let strength = 0;

      if (val.length >= 8) strength += 1;
      if (val.match(/[A-Z]/)) strength += 1;
      if (val.match(/[a-z]/)) strength += 1;
      if (val.match(/[0-9]/)) strength += 1;
      if (val.match(/[^A-Za-z0-9]/)) strength += 1;

      strengthMeter.className = 'strength-meter-fill';
      strengthMeter.style.width = '0%';

      if (val === '') {
        strengthMeter.style.width = '0%';
      } else if (strength === 1) {
        strengthMeter.classList.add('very-weak');
        strengthMeter.style.width = '20%';
      } else if (strength === 2) {
        strengthMeter.classList.add('weak');
        strengthMeter.style.width = '40%';
      } else if (strength === 3) {
        strengthMeter.classList.add('medium');
        strengthMeter.style.width = '60%';
      } else if (strength === 4) {
        strengthMeter.classList.add('strong');
        strengthMeter.style.width = '80%';
      } else if (strength >= 5) {
        strengthMeter.classList.add('very-strong');
        strengthMeter.style.width = '100%';
      }

      if (confirmPassword && confirmPassword.value !== '') {
        checkPasswordsMatch();
      }
    });
  }

  function checkPasswordsMatch() {
    if (!passwordMatch) return;
    
    if (password.value === confirmPassword.value) {
      passwordMatch.classList.remove('text-red-500');
      passwordMatch.classList.add('text-green-500');
      passwordMatch.textContent = 'Passwords match';
      passwordMatch.classList.remove('invisible');
    } else {
      passwordMatch.classList.remove('text-green-500');
      passwordMatch.classList.add('text-red-500');
      passwordMatch.textContent = 'Passwords do not match';
      passwordMatch.classList.remove('invisible');
    }
  }

  if (confirmPassword) {
    confirmPassword.addEventListener('input', checkPasswordsMatch);
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
  const form = document.getElementById('registerForm');
  if (form) {
    form.addEventListener('submit', async function(e) {
      e.preventDefault();

      // Validation logic
      let isValid = true;
      const termsCheckbox = document.getElementById('terms');

      if (password.value.length < 8) {
        showAlert('Password must be at least 8 characters', 'warning');
        isValid = false;
      }

      if (password.value !== confirmPassword.value) {
        showAlert('Passwords do not match', 'warning');
        isValid = false;
      }

      if (termsCheckbox && !termsCheckbox.checked) {
        showAlert('You must accept the terms and conditions', 'warning');
        isValid = false;
      }

      if (!isValid) return;

      // Initialize Supabase
      const supabaseUrl = 'https://nwoswxbtlquiekyangbs.supabase.co';
      const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im53b3N3eGJ0bHF1aWVreWFuZ2JzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NDQ3ODEwMjcsImV4cCI6MjA2MDM1NzAyN30.KarBv9AopQpldzGPamlj3zu9eScKltKKHH2JJblpoCE';
      
      try {
        const supabase = window.supabase.createClient(supabaseUrl, supabaseKey);
        window.supabase = supabase;
        
        const fullName = document.getElementById('full_name')?.value;
        const email = document.getElementById('email')?.value;
        const passwordValue = document.getElementById('password')?.value;

        if (!email || !passwordValue) {
          showAlert('Email and password are required', 'danger');
          return;
        }

        const { error: signUpError } = await supabase.auth.signUp({ 
          email, 
          password: passwordValue,
          options: {
            data: {
              full_name: fullName || ''
            },
            emailRedirectTo: window.location.origin
          }
        });
        
        if (signUpError) {
          showAlert('Registration failed: ' + signUpError.message, 'danger');
          return;
        }
        
        form.innerHTML = `
        <div class="text-center py-6">
          <div class="inline-flex items-center justify-center w-16 h-16 rounded-full bg-green-800 mb-5">
            <i class="bi bi-check-lg text-3xl text-white"></i>
          </div>
          <h3 class="text-xl font-bold text-white mb-2">Registration Successful!</h3>
          <p class="text-gray-400 mb-5">Please check your email to verify your account</p>
          <a href="login.html" class="text-blue-400 hover:text-blue-300">
            Proceed to login
          </a>
        </div>
        `;
        
        showAlert('Registration successful! Please check your email.', 'success');
        
      } catch (err) {
        showAlert('Unexpected error: ' + err.message, 'danger');
        console.error(err);
      }
    });
  }
});