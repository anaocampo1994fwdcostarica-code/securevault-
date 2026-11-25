// A05/A07: cliente HTTP centralizado con cookies same-origin y renderizado seguro sin innerHTML
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
 * Si el servidor responde 401 en una página protegida, redirige a /index.html.
 */
async function api(method, url, body) {
  const options = {
    method,
    credentials: 'same-origin', // A07: envía la cookie HttpOnly únicamente al mismo origen
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

  // A01/A07: si la sesión expiró o no existe, redirigir al inicio de sesión
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
 * Muestra un mensaje usando textContent (A05: previene XSS).
 */
function showAlert(container, message, type) {
  container.textContent = message;
  container.className = `alert ${type === 'success' ? 'alert-success' : 'alert-error'}`;
}

/**
 * Limpia y oculta la alerta.
 */
function clearAlert(container) {
  container.textContent = '';
  container.className = 'alert hidden';
}

/**
 * Obtiene la inicial de un nombre para avatares sin foto (A08).
 */
function getInitial(name) {
  const clean = typeof name === 'string' ? name.trim() : '';
  return clean ? clean.charAt(0).toUpperCase() : '?';
}

/**
 * Crea un icono SVG con createElementNS (A05/A08: sin innerHTML ni recursos externos).
 */
function createSvgIcon(pathData, className) {
  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('fill', 'none');
  svg.setAttribute('stroke', 'currentColor');
  svg.setAttribute('stroke-width', '2');
  svg.setAttribute('stroke-linecap', 'round');
  svg.setAttribute('stroke-linejoin', 'round');
  if (className) {
    svg.setAttribute('class', className);
  }

  for (const d of pathData) {
    const path = document.createElementNS(svgNS, 'path');
    path.setAttribute('d', d);
    svg.appendChild(path);
  }
  return svg;
}
