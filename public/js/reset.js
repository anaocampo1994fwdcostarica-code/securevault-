// A02/A05/A09: extrae el token de la URL y lo limpia del historial con history.replaceState
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('reset-form');
  const alertBox = document.getElementById('alert');

  const params = new URLSearchParams(window.location.search);
  const resetToken = params.get('token') || '';

  // A09: eliminar el token de la barra de direcciones e historial del navegador
  if (window.location.search) {
    history.replaceState(null, '', window.location.pathname);
  }

  if (!resetToken) {
    showAlert(alertBox, 'Token inválido o ausente', 'error');
  }

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAlert(alertBox);

    if (!resetToken) {
      showAlert(alertBox, 'Token inválido o ausente', 'error');
      return;
    }

    const password = document.getElementById('password').value;
    const res = await api('POST', '/api/auth/reset-password', {
      token: resetToken,
      password
    });

    if (!res.ok) {
      const details = Array.isArray(res.data?.details) ? res.data.details.join(' ') : '';
      showAlert(alertBox, details || res.data?.error || 'No se pudo actualizar la contraseña', 'error');
      return;
    }

    showAlert(alertBox, res.data?.message || 'Contraseña actualizada', 'success');
    form.reset();
  });
});
