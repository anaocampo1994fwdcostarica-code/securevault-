// A02/A05/A08: lógica externa sin inline scripts; iconos SVG con createElementNS y datos con textContent
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  const alertBox = document.getElementById('alert');
  const passwordInput = document.getElementById('password');
  const toggleBtn = document.getElementById('toggle-password');
  const controlsList = document.getElementById('controls-list');

  const controls = [
    {
      title: 'Argon2id',
      desc: 'Hash de contraseñas resistente a ataques de fuerza bruta.',
      paths: ['M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z']
    },
    {
      title: 'AES-256-GCM',
      desc: 'Cifrado autenticado en servidor para notas y teléfono.',
      paths: ['M3 11h18v11H3z', 'M7 11V7a5 5 0 0 1 10 0v4']
    },
    {
      title: 'Sesión HttpOnly + SameSite',
      desc: 'Cookies inaccesibles desde JavaScript y protegidas contra CSRF.',
      paths: ['M12 2a10 10 0 1 0 10 10', 'M12 6v6l4 2']
    },
    {
      title: 'Bloqueo tras 5 intentos',
      desc: 'Bloqueo temporal automático y rate limiting por IP.',
      paths: ['M12 9v4', 'M12 17h.01', 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z']
    }
  ];

  for (const item of controls) {
    const li = document.createElement('li');
    li.className = 'control-item';
    li.appendChild(createSvgIcon(item.paths, 'control-icon'));

    const textWrap = document.createElement('div');
    const strong = document.createElement('strong');
    strong.textContent = item.title;
    const span = document.createElement('span');
    span.textContent = item.desc;

    textWrap.appendChild(strong);
    textWrap.appendChild(span);
    li.appendChild(textWrap);
    controlsList.appendChild(li);
  }

  function renderEyeIcon(visible) {
    toggleBtn.replaceChildren();
    const paths = visible
      ? ['M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94', 'M1 1l22 22']
      : ['M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z', 'M12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6z'];
    toggleBtn.appendChild(createSvgIcon(paths, 'control-icon'));
  }

  renderEyeIcon(false);

  toggleBtn.addEventListener('click', () => {
    const isPassword = passwordInput.type === 'password';
    passwordInput.type = isPassword ? 'text' : 'password';
    renderEyeIcon(isPassword);
  });

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAlert(alertBox);

    const email = document.getElementById('email').value;
    const password = passwordInput.value;

    const res = await api('POST', '/api/auth/login', { email, password });
    if (!res.ok) {
      showAlert(alertBox, res.data?.error || 'Error al iniciar sesión', 'error');
      return;
    }

    window.location.assign('/notes.html');
  });
});
