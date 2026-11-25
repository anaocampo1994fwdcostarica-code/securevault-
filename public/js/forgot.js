// A02/A05: lógica externa sin scripts inline; muestra mensaje genérico con textContent
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('forgot-form');
  const alertBox = document.getElementById('alert');

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAlert(alertBox);

    const email = document.getElementById('email').value;
    const res = await api('POST', '/api/auth/forgot-password', { email });

    if (!res.ok) {
      showAlert(alertBox, res.data?.error || 'No se pudo procesar la solicitud', 'error');
      return;
    }

    showAlert(alertBox, res.data?.message || 'Si el correo existe, recibirás instrucciones', 'success');
    form.reset();
  });
});
