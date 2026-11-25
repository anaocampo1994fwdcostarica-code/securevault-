// A01/A05: panel administrativo construido con createElement y textContent (anti-XSS)
document.addEventListener('DOMContentLoaded', async () => {
  const alertBox = document.getElementById('alert');
  const adminContent = document.getElementById('admin-content');
  const usersTbody = document.getElementById('users-tbody');
  const auditTbody = document.getElementById('audit-tbody');
  const logoutBtn = document.getElementById('logout-btn');

  function createCell(text) {
    const td = document.createElement('td');
    td.textContent = text;
    return td;
  }

  async function loadUsers() {
    const res = await api('GET', '/api/admin/users');
    if (res.status === 403) {
      adminContent.classList.add('hidden');
      showAlert(alertBox, 'Acceso denegado', 'error');
      return false;
    }
    if (!res.ok) {
      showAlert(alertBox, res.data?.error || 'Error al cargar usuarios', 'error');
      return false;
    }

    usersTbody.replaceChildren();
    const users = Array.isArray(res.data) ? res.data : [];

    for (const user of users) {
      const tr = document.createElement('tr');
      tr.appendChild(createCell(user.name));
      tr.appendChild(createCell(user.email));

      const roleTd = document.createElement('td');
      const select = document.createElement('select');

      for (const optionRole of ['user', 'admin']) {
        const opt = document.createElement('option');
        opt.value = optionRole;
        opt.textContent = optionRole;
        if (user.role === optionRole) {
          opt.selected = true;
        }
        select.appendChild(opt);
      }

      select.addEventListener('change', async () => {
        clearAlert(alertBox);
        const updateRes = await api(
          'PATCH',
          `/api/admin/users/${encodeURIComponent(user.id)}/role`,
          { role: select.value }
        );
        if (!updateRes.ok) {
          showAlert(alertBox, updateRes.data?.error || 'No se pudo cambiar el rol', 'error');
          await loadUsers();
          return;
        }
        showAlert(alertBox, 'Rol actualizado correctamente', 'success');
      });

      roleTd.appendChild(select);
      tr.appendChild(roleTd);
      tr.appendChild(createCell(String(user.failed_attempts ?? 0)));
      tr.appendChild(createCell(user.locked_until ? new Date(user.locked_until).toLocaleString() : '-'));
      usersTbody.appendChild(tr);
    }
    return true;
  }

  async function loadAudit() {
    const res = await api('GET', '/api/admin/audit?limit=50');
    if (res.status === 403) {
      adminContent.classList.add('hidden');
      showAlert(alertBox, 'Acceso denegado', 'error');
      return;
    }
    if (!res.ok) {
      showAlert(alertBox, res.data?.error || 'Error al cargar la bitácora', 'error');
      return;
    }

    auditTbody.replaceChildren();
    const logs = Array.isArray(res.data) ? res.data : [];

    for (const entry of logs) {
      const tr = document.createElement('tr');
      tr.appendChild(createCell(String(entry.id)));
      tr.appendChild(createCell(entry.event));
      tr.appendChild(createCell(entry.user_id || '-'));
      tr.appendChild(createCell(entry.ip || '-'));
      tr.appendChild(createCell(entry.metadata ? JSON.stringify(entry.metadata) : '{}'));
      tr.appendChild(createCell(new Date(entry.created_at).toLocaleString()));
      auditTbody.appendChild(tr);
    }
  }

  logoutBtn.addEventListener('click', async () => {
    await api('POST', '/api/auth/logout');
    window.location.assign('/index.html');
  });

  const allowed = await loadUsers();
  if (allowed) {
    await loadAudit();
  }
});
