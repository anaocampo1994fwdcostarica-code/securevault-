// A02/A05: lógica externa sin scripts inline; errores del servidor mostrados con textContent
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('register-form');
  const alertBox = document.getElementById('alert');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAlert(alertBox);

    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = document.getElementById('password').value;

    const res = await api('POST', '/api/auth/register', { name, email, password });
    if (!res.ok) {
      const details = Array.isArray(res.data?.details) ? res.data.details.join(' ') : '';
      const msg = details || res.data?.error || 'No se pudo completar el registro';
      showAlert(alertBox, msg, 'error');
      return;
    }

    showAlert(alertBox, res.data?.message || 'Cuenta creada', 'success');
    form.reset();
  });
});
