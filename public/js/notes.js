// A01/A05: gestión de notas con createElement y textContent; nunca muestra contenido en la lista
document.addEventListener('DOMContentLoaded', async () => {
  const alertBox = document.getElementById('alert');
  const userNameEl = document.getElementById('user-name');
  const userRoleEl = document.getElementById('user-role');
  const adminLink = document.getElementById('admin-link');
  const logoutBtn = document.getElementById('logout-btn');
  const notesCountEl = document.getElementById('notes-count');
  const notesList = document.getElementById('notes-list');
  const createForm = document.getElementById('create-note-form');
  const newTitleInput = document.getElementById('new-title');
  const newContentInput = document.getElementById('new-content');
  const titleCounter = document.getElementById('title-counter');
  const contentCounter = document.getElementById('content-counter');
  const detailCard = document.getElementById('note-detail-card');
  const editForm = document.getElementById('edit-note-form');
  const deleteBtn = document.getElementById('delete-note-btn');

  let selectedNoteId = null;

  function updateCounters() {
    titleCounter.textContent = `${newTitleInput.value.length} / 120`;
    contentCounter.textContent = `${newContentInput.value.length} / 5000`;
  }

  newTitleInput.addEventListener('input', updateCounters);
  newContentInput.addEventListener('input', updateCounters);
  updateCounters();

  async function loadUser() {
    const res = await api('GET', '/api/auth/me');
    if (!res.ok || !res.data) {
      return;
    }
    userNameEl.textContent = res.data.name;
    userRoleEl.textContent = res.data.role;
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
    notesCountEl.textContent = String(notes.length);

    if (notes.length === 0) {
      const empty = document.createElement('p');
      empty.className = 'hint';
      empty.textContent = 'No tienes notas guardadas.';
      notesList.appendChild(empty);
      return;
    }

    for (const note of notes) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'note-card-btn';

      const titleDiv = document.createElement('div');
      titleDiv.className = 'note-card-title';
      titleDiv.textContent = note.title;

      const metaDiv = document.createElement('div');
      metaDiv.className = 'note-card-meta';

      const dateSpan = document.createElement('span');
      dateSpan.textContent = new Date(note.updated_at).toLocaleString();

      const chip = document.createElement('span');
      chip.className = 'chip chip-blue';
      chip.textContent = 'Cifrada';

      metaDiv.appendChild(dateSpan);
      metaDiv.appendChild(chip);

      btn.appendChild(titleDiv);
      btn.appendChild(metaDiv);
      btn.addEventListener('click', () => openNote(note.id));

      notesList.appendChild(btn);
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

    const title = newTitleInput.value;
    const content = newContentInput.value;

    const res = await api('POST', '/api/notes', { title, content });
    if (!res.ok) {
      const details = Array.isArray(res.data?.details) ? res.data.details.join(' ') : '';
      showAlert(alertBox, details || res.data?.error || 'No se pudo crear la nota', 'error');
      return;
    }

    createForm.reset();
    updateCounters();
    showAlert(alertBox, 'Nota cifrada y guardada correctamente', 'success');
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
