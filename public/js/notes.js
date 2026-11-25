// A01/A05: gestión de notas usando únicamente createElement y textContent (anti-XSS)
document.addEventListener('DOMContentLoaded', async () => {
  const alertBox = document.getElementById('alert');
  const userNameEl = document.getElementById('user-name');
  const adminLink = document.getElementById('admin-link');
  const logoutBtn = document.getElementById('logout-btn');
  const notesList = document.getElementById('notes-list');
  const createForm = document.getElementById('create-note-form');
  const detailCard = document.getElementById('note-detail-card');
  const editForm = document.getElementById('edit-note-form');
  const deleteBtn = document.getElementById('delete-note-btn');

  let selectedNoteId = null;

  async function loadUser() {
    const res = await api('GET', '/api/auth/me');
    if (!res.ok || !res.data) {
      return;
    }
    userNameEl.textContent = res.data.name;
    if (res.data.role === 'admin') {
      adminLink.classList.remove('hidden');
    }
  }

  async function loadNotes() {
    const res = await api('GET', '/api/notes');
    if (!res.ok) {
      showAlert(alertBox, res.data?.error || 'Error al cargar las notas', 'error');
      return;
    }

    notesList.replaceChildren();
    const notes = Array.isArray(res.data) ? res.data : [];

    if (notes.length === 0) {
      const emptyItem = document.createElement('li');
      emptyItem.className = 'hint';
      emptyItem.textContent = 'No tienes notas guardadas.';
      notesList.appendChild(emptyItem);
      return;
    }

    for (const note of notes) {
      const li = document.createElement('li');
      li.className = 'note-item';

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'note-item-btn';
      btn.textContent = note.title;
      btn.addEventListener('click', () => openNote(note.id));

      li.appendChild(btn);
      notesList.appendChild(li);
    }
  }

  async function openNote(noteId) {
    clearAlert(alertBox);
    const res = await api('GET', `/api/notes/${encodeURIComponent(noteId)}`);
    if (!res.ok || !res.data) {
      showAlert(alertBox, res.data?.error || 'No se pudo cargar la nota', 'error');
      return;
    }

    selectedNoteId = res.data.id;
    document.getElementById('edit-title').value = res.data.title;
    document.getElementById('edit-content').value = res.data.content;
    detailCard.classList.remove('hidden');
  }

  createForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAlert(alertBox);

    const title = document.getElementById('new-title').value;
    const content = document.getElementById('new-content').value;

    const res = await api('POST', '/api/notes', { title, content });
    if (!res.ok) {
      const details = Array.isArray(res.data?.details) ? res.data.details.join(' ') : '';
      showAlert(alertBox, details || res.data?.error || 'No se pudo crear la nota', 'error');
      return;
    }

    createForm.reset();
    showAlert(alertBox, 'Nota creada correctamente', 'success');
    await loadNotes();
  });

  editForm.addEventListener('submit', async (event) => {
    event.preventDefault();
    if (!selectedNoteId) return;
    clearAlert(alertBox);

    const title = document.getElementById('edit-title').value;
    const content = document.getElementById('edit-content').value;

    const res = await api('PUT', `/api/notes/${encodeURIComponent(selectedNoteId)}`, {
      title,
      content
    });

    if (!res.ok) {
      const details = Array.isArray(res.data?.details) ? res.data.details.join(' ') : '';
      showAlert(alertBox, details || res.data?.error || 'No se pudo actualizar la nota', 'error');
      return;
    }

    showAlert(alertBox, 'Nota actualizada correctamente', 'success');
    await loadNotes();
  });

  deleteBtn.addEventListener('click', async () => {
    if (!selectedNoteId) return;
    if (!window.confirm('¿Seguro que deseas eliminar esta nota?')) {
      return;
    }
    clearAlert(alertBox);

    const res = await api('DELETE', `/api/notes/${encodeURIComponent(selectedNoteId)}`);
    if (!res.ok) {
      showAlert(alertBox, res.data?.error || 'No se pudo eliminar la nota', 'error');
      return;
    }

    selectedNoteId = null;
    editForm.reset();
    detailCard.classList.add('hidden');
    showAlert(alertBox, 'Nota eliminada', 'success');
    await loadNotes();
  });

  logoutBtn.addEventListener('click', async () => {
    await api('POST', '/api/auth/logout');
    window.location.assign('/index.html');
  });

  await loadUser();
  await loadNotes();
});
