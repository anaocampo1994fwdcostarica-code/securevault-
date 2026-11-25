// A02/A05: lógica externa sin scripts inline; mensajes renderizados con textContent (XSS)
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('login-form');
  const alertBox = document.getElementById('alert');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAlert(alertBox);

    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const res = await api('POST', '/api/auth/login', { email, password });
    if (!res.ok) {
      showAlert(alertBox, res.data?.error || 'Error al iniciar sesión', 'error');
      return;
    }

    window.location.assign('/notes.html');
  });
});
