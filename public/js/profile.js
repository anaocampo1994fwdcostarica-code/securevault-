// A02/A05: muestra datos de perfil con textContent y permite actualizar el teléfono
document.addEventListener('DOMContentLoaded', async () => {
  const alertBox = document.getElementById('alert');
  const adminLink = document.getElementById('admin-link');
  const logoutBtn = document.getElementById('logout-btn');
  const nameEl = document.getElementById('profile-name');
  const emailEl = document.getElementById('profile-email');
  const roleEl = document.getElementById('profile-role');
  const phoneEl = document.getElementById('profile-phone');
  const phoneForm = document.getElementById('phone-form');

  async function loadProfile() {
    const res = await api('GET', '/api/profile');
    if (!res.ok || !res.data) {
      showAlert(alertBox, res.data?.error || 'Error al cargar el perfil', 'error');
      return;
    }

    nameEl.textContent = res.data.name;
    emailEl.textContent = res.data.email;
    roleEl.textContent = res.data.role;
    phoneEl.textContent = res.data.phone_masked || 'Sin teléfono registrado';

    if (res.data.role === 'admin') {
      adminLink.classList.remove('hidden');
    }
  }

  phoneForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAlert(alertBox);

    const phone = document.getElementById('phone').value;
    const res = await api('PUT', '/api/profile/phone', { phone });

    if (!res.ok) {
      const details = Array.isArray(res.data?.details) ? res.data.details.join(' ') : '';
      showAlert(alertBox, details || res.data?.error || 'No se pudo actualizar el teléfono', 'error');
      return;
    }

    phoneForm.reset();
    showAlert(alertBox, res.data?.message || 'Teléfono actualizado', 'success');
    await loadProfile();
  });

  logoutBtn.addEventListener('click', async () => {
    await api('POST', '/api/auth/logout');
    window.location.assign('/index.html');
  });

  await loadProfile();
});
