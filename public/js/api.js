// A05/A07: cliente HTTP centralizado con cookies same-origin y sin almacenamiento de secretos en JS
const PUBLIC_PATHS = new Set([
  '/',
  '/index.html',
  '/register',
  '/register.html',
  '/forgot',
  '/forgot.html',
  '/reset',
  '/reset.html'
]);

/**
 * Realiza una petición fetch JSON con credenciales same-origin.
 * Si la respuesta es 401 en una página protegida, redirige a /index.html.
 * @param {string} method - Método HTTP (GET, POST, PUT, PATCH, DELETE).
 * @param {string} url - Ruta del endpoint.
 * @param {object} [body] - Cuerpo JSON opcional.
 * @returns {Promise<{ ok: boolean, status: number, data: any }>}
 */
async function api(method, url, body) {
  const options = {
    method,
    credentials: 'same-origin', // A07: envía cookie de sesión HttpOnly solo al mismo origen
    headers: {
      'Content-Type': 'application/json'
    }
  };

  if (body !== undefined) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);
  let data = null;

  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch {
      data = null;
    }
  }

  // A01/A07: redirigir al login si la sesión expiró o no está autenticado en página protegida
  if (response.status === 401 && !PUBLIC_PATHS.has(window.location.pathname)) {
    window.location.assign('/index.html');
  }

  return {
    ok: response.ok,
    status: response.status,
    data
  };
}

/**
 * Muestra un mensaje de estado de forma segura usando textContent (A05: previene XSS).
 * @param {HTMLElement} container - Elemento contenedor de la alerta.
 * @param {string} message - Texto del mensaje.
 * @param {'error'|'success'} type - Tipo de alerta.
 */
function showAlert(container, message, type) {
  container.textContent = message;
  container.className = `alert ${type === 'success' ? 'alert-success' : 'alert-error'}`;
}

/**
 * Oculta y limpia un contenedor de alerta.
 * @param {HTMLElement} container - Elemento contenedor.
 */
function clearAlert(container) {
  container.textContent = '';
  container.className = 'alert hidden';
}
