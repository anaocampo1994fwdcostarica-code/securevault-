// A02/A05: lógica externa sin inline scripts; checklist visual en cliente (el servidor valida siempre)
document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('register-form');
  const alertBox = document.getElementById('alert');
  const passwordInput = document.getElementById('password');

  const rules = [
    { el: document.getElementById('req-len'), label: 'Mínimo 12 caracteres (máximo 128)', test: (v) => v.length >= 12 && v.length <= 128 },
    { el: document.getElementById('req-upper'), label: 'Al menos una letra mayúscula', test: (v) => /[A-Z]/.test(v) },
    { el: document.getElementById('req-lower'), label: 'Al menos una letra minúscula', test: (v) => /[a-z]/.test(v) },
    { el: document.getElementById('req-num'), label: 'Al menos un número', test: (v) => /[0-9]/.test(v) },
    { el: document.getElementById('req-sym'), label: 'Al menos un símbolo', test: (v) => /[^A-Za-z0-9]/.test(v) }
  ];

  function updateChecklist() {
    const val = passwordInput.value;
    for (const rule of rules) {
      const ok = rule.test(val);
      rule.el.className = ok ? 'req-item met' : 'req-item';
      rule.el.textContent = `${ok ? '✓' : '○'} ${rule.label}`;
    }
  }

  passwordInput.addEventListener('input', updateChecklist);
  updateChecklist();

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAlert(alertBox);

    const name = document.getElementById('name').value;
    const email = document.getElementById('email').value;
    const password = passwordInput.value;

    const res = await api('POST', '/api/auth/register', { name, email, password });
    if (!res.ok) {
      const details = Array.isArray(res.data?.details) ? res.data.details.join(' ') : '';
      const msg = details || res.data?.error || 'No se pudo completar el registro';
      showAlert(alertBox, msg, 'error');
      return;
    }

    showAlert(alertBox, res.data?.message || 'Cuenta creada', 'success');
    form.reset();
    updateChecklist();
  });
});
