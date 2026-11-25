// A01/A05/A09: consola de administración con métricas reales, createElement y textContent (anti-XSS)
document.addEventListener('DOMContentLoaded', async () => {
  const alertBox = document.getElementById('alert');
  const userNameEl = document.getElementById('user-name');
  const userRoleEl = document.getElementById('user-role');
  const adminContent = document.getElementById('admin-content');
  const usersTbody = document.getElementById('users-tbody');
  const auditTbody = document.getElementById('audit-tbody');
  const logoutBtn = document.getElementById('logout-btn');

  const metricUsers = document.getElementById('metric-users');
  const metricLocked = document.getElementById('metric-locked');
  const metricFailed = document.getElementById('metric-failed');
  const metricDenied = document.getElementById('metric-denied');

  const filterAllBtn = document.getElementById('filter-all');
  const filterAuthBtn = document.getElementById('filter-auth');
  const filterDeniedBtn = document.getElementById('filter-denied');

  const GREEN_EVENTS = new Set(['login_success', 'user_registered']);
  const RED_EVENTS = new Set([
    'login_failed',
    'access_denied',
    'account_locked',
    'login_rate_limited',
    'decrypt_failed'
  ]);
  const AUTH_EVENTS = new Set([
    'login_success',
    'login_failed',
    'user_registered',
    'logout',
    'account_locked',
    'login_rate_limited',
    'login_blocked_locked',
    'password_reset_requested',
    'password_reset_completed'
  ]);

  let allAuditLogs = [];
  let currentFilter = 'all';

  function createCell(text, extraClass) {
    const td = document.createElement('td');
    td.textContent = text;
    if (extraClass) {
      td.className = extraClass;
    }
    return td;
  }

  function createChip(text, colorClass) {
    const span = document.createElement('span');
    span.className = `chip ${colorClass}`;
    span.textContent = text;
    return span;
  }

  function getEventChipClass(eventName) {
    if (GREEN_EVENTS.has(eventName)) return 'chip-green';
    if (RED_EVENTS.has(eventName)) return 'chip-red';
    return 'chip-blue';
  }

  async function loadCurrentUser() {
    const res = await api('GET', '/api/auth/me');
    if (res.ok && res.data) {
      userNameEl.textContent = res.data.name;
      userRoleEl.textContent = res.data.role;
    }
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
    const now = new Date();
    let lockedCount = 0;

    for (const user of users) {
      const isLocked = Boolean(user.locked_until && new Date(user.locked_until) > now);
      if (isLocked) {
        lockedCount += 1;
      }

      const tr = document.createElement('tr');

      const userTd = document.createElement('td');
      const userCell = document.createElement('div');
      userCell.className = 'user-cell';

      const avatar = document.createElement('span');
      avatar.className = 'avatar avatar-sm';
      avatar.textContent = getInitial(user.name);

      const nameSpan = document.createElement('span');
      nameSpan.textContent = user.name;

      userCell.appendChild(avatar);
      userCell.appendChild(nameSpan);
      userTd.appendChild(userCell);
      tr.appendChild(userTd);

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
      tr.appendChild(createCell(String(user.failed_attempts ?? 0), 'mono'));

      const statusTd = document.createElement('td');
      statusTd.appendChild(
        createChip(isLocked ? 'Bloqueado' : 'Activo', isLocked ? 'chip-red' : 'chip-green')
      );
      tr.appendChild(statusTd);

      usersTbody.appendChild(tr);
    }

    metricUsers.textContent = String(users.length);
    metricLocked.textContent = String(lockedCount);
    return true;
  }

  function renderAuditTable() {
    auditTbody.replaceChildren();

    const filtered = allAuditLogs.filter((entry) => {
      if (currentFilter === 'auth') return AUTH_EVENTS.has(entry.event);
      if (currentFilter === 'denied') return entry.event === 'access_denied';
      return true;
    });

    for (const entry of filtered) {
      const tr = document.createElement('tr');

      const eventTd = document.createElement('td');
      eventTd.appendChild(createChip(entry.event, getEventChipClass(entry.event)));
      tr.appendChild(eventTd);

      tr.appendChild(createCell(entry.user_id || '-', 'mono'));
      tr.appendChild(createCell(entry.ip || '-', 'mono'));
      tr.appendChild(createCell(new Date(entry.created_at).toLocaleString()));
      auditTbody.appendChild(tr);
    }
  }

  async function loadAudit() {
    const res = await api('GET', '/api/admin/audit?limit=200');
    if (res.status === 403) {
      adminContent.classList.add('hidden');
      showAlert(alertBox, 'Acceso denegado', 'error');
      return;
    }
    if (!res.ok) {
      showAlert(alertBox, res.data?.error || 'Error al cargar la bitácora', 'error');
      return;
    }

    allAuditLogs = Array.isArray(res.data) ? res.data : [];

    let failedCount = 0;
    let deniedCount = 0;
    for (const entry of allAuditLogs) {
      if (entry.event === 'login_failed') failedCount += 1;
      if (entry.event === 'access_denied') deniedCount += 1;
    }

    metricFailed.textContent = String(failedCount);
    metricDenied.textContent = String(deniedCount);
    renderAuditTable();
  }

  function setActiveFilter(filterName, activeBtn) {
    currentFilter = filterName;
    for (const btn of [filterAllBtn, filterAuthBtn, filterDeniedBtn]) {
      btn.classList.remove('active');
    }
    activeBtn.classList.add('active');
    renderAuditTable();
  }

  filterAllBtn.addEventListener('click', () => setActiveFilter('all', filterAllBtn));
  filterAuthBtn.addEventListener('click', () => setActiveFilter('auth', filterAuthBtn));
  filterDeniedBtn.addEventListener('click', () => setActiveFilter('denied', filterDeniedBtn));

  logoutBtn.addEventListener('click', async () => {
    await api('POST', '/api/auth/logout');
    window.location.assign('/index.html');
  });

  await loadCurrentUser();
  const allowed = await loadUsers();
  if (allowed) {
    await loadAudit();
  }
});
