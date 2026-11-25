import { Router } from 'express';
import { query } from '../db.js';
import { logEvent } from '../audit.js';
import { requireAuth } from '../middleware/auth.js';
import { encrypt, decrypt, CURRENT_KEY_VERSION } from '../security/crypto.js';
import { noteSchema, idSchema } from '../validation/notes.js';

const router = Router();

// A06: límite de negocio para prevenir abuso de almacenamiento
const MAX_NOTES_PER_USER = 100;

// A01: todas las rutas de notas requieren sesión autenticada
router.use(requireAuth);

// GET /api/notes – lista metadatos de notas del usuario autenticado (RF-04)
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await query(
      `SELECT id, title, created_at, updated_at
       FROM notes
       WHERE owner_id = $1
       ORDER BY updated_at DESC`,
      [req.session.userId]
    );
    return res.json(rows);
  } catch (err) {
    return next(err);
  }
});

// POST /api/notes – crea una nota cifrada ligada al dueño (A04, A06, RF-04)
router.post('/', async (req, res, next) => {
  try {
    const parsed = noteSchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: 'Datos de entrada inválidos',
        details: parsed.error.issues.map((issue) => issue.message)
      });
    }

    const ownerId = req.session.userId;
    const { rows: countRows } = await query(
      'SELECT COUNT(*)::int AS total FROM notes WHERE owner_id = $1',
      [ownerId]
    );

    if (countRows[0].total >= MAX_NOTES_PER_USER) {
      return res.status(409).json({ error: 'Límite de notas alcanzado' });
    }

    const { title, content } = parsed.data;
    const contentEnc = encrypt(content, ownerId);

    const { rows } = await query(
      `INSERT INTO notes (owner_id, title, content_enc, key_version)
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [ownerId, title, contentEnc, CURRENT_KEY_VERSION]
    );

    return res.status(201).json({ id: rows[0].id });
  } catch (err) {
    return next(err);
  }
});

// GET /api/notes/:id – obtiene y descifra una nota si pertenece al usuario (A01, A04)
router.get('/:id', async (req, res, next) => {
  try {
    const idParsed = idSchema.safeParse(req.params.id);
    if (!idParsed.success) {
      return res.status(404).json({ error: 'No encontrado' });
    }

    const noteId = idParsed.data;
    const ownerId = req.session.userId;

    const { rows } = await query(
      `SELECT id, title, content_enc, created_at, updated_at
       FROM notes
       WHERE id = $1 AND owner_id = $2`,
      [noteId, ownerId]
    );

    if (rows.length === 0) {
      await logEvent('access_denied', {
        userId: ownerId,
        ip: req.ip,
        metadata: { resource: 'note', noteId }
      });
      return res.status(404).json({ error: 'No encontrado' });
    }

    const note = rows[0];
    let content;
    try {
      content = decrypt(note.content_enc, ownerId);
    } catch (decryptErr) {
      // A10: fallar cerrado y registrar incidente sin exponer contenido
      await logEvent('decrypt_failed', {
        userId: ownerId,
        ip: req.ip,
        metadata: { resource: 'note', noteId }
      });
      return next(decryptErr);
    }

    return res.json({
      id: note.id,
      title: note.title,
      content,
      created_at: note.created_at,
      updated_at: note.updated_at
    });
  } catch (err) {
    return next(err);
  }
});

// PUT /api/notes/:id – actualiza y vuelve a cifrar la nota con nuevo IV (A01, A04)
router.put('/:id', async (req, res, next) => {
  try {
    const idParsed = idSchema.safeParse(req.params.id);
    if (!idParsed.success) {
      return res.status(404).json({ error: 'No encontrado' });
    }

    const bodyParsed = noteSchema.safeParse(req.body);
    if (!bodyParsed.success) {
      return res.status(400).json({
        error: 'Datos de entrada inválidos',
        details: bodyParsed.error.issues.map((issue) => issue.message)
      });
    }

    const noteId = idParsed.data;
    const ownerId = req.session.userId;
    const { title, content } = bodyParsed.data;
    const contentEnc = encrypt(content, ownerId);

    const { rows } = await query(
      `UPDATE notes
       SET title = $1,
           content_enc = $2,
           key_version = $3,
           updated_at = now()
       WHERE id = $4 AND owner_id = $5
       RETURNING id`,
      [title, contentEnc, CURRENT_KEY_VERSION, noteId, ownerId]
    );

    if (rows.length === 0) {
      await logEvent('access_denied', {
        userId: ownerId,
        ip: req.ip,
        metadata: { resource: 'note', noteId }
      });
      return res.status(404).json({ error: 'No encontrado' });
    }

    return res.json({ id: rows[0].id });
  } catch (err) {
    return next(err);
  }
});

// DELETE /api/notes/:id – elimina una nota propia (A01)
router.delete('/:id', async (req, res, next) => {
  try {
    const idParsed = idSchema.safeParse(req.params.id);
    if (!idParsed.success) {
      return res.status(404).json({ error: 'No encontrado' });
    }

    const noteId = idParsed.data;
    const ownerId = req.session.userId;

    const { rows } = await query(
      `DELETE FROM notes
       WHERE id = $1 AND owner_id = $2
       RETURNING id`,
      [noteId, ownerId]
    );

    if (rows.length === 0) {
      await logEvent('access_denied', {
        userId: ownerId,
        ip: req.ip,
        metadata: { resource: 'note', noteId }
      });
      return res.status(404).json({ error: 'No encontrado' });
    }

    return res.status(204).end();
  } catch (err) {
    return next(err);
  }
});

export default router;
