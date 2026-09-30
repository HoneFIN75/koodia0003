// Kirjautumisnäkymä väliaikaiselle jaetun salasanan suojaukselle.
// Näkymä on erillään varsinaisesta sovelluksesta (ui.js), jotta se voidaan korvata myöhemmin.

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function renderLoginView(root, { errorMessage = '', infoMessage = '', pending = false } = {}) {
  const hasError = Boolean(errorMessage);

  root.innerHTML = `
    <main id="main-content" class="login-page" tabindex="-1">
      <section class="login-card" aria-labelledby="login-title">
        <div class="login-brand">
          <div class="brand-mark" aria-hidden="true">SFL</div>
          <h1 id="login-title">SFL Porkkana</h1>
        </div>
        ${infoMessage ? `<p class="message warning" role="status">${escapeHtml(infoMessage)}</p>` : ''}
        <form id="login-form" class="login-form" novalidate>
          <div class="form-field">
            <label for="login-password">Salainen runo</label>
            <input
              id="login-password"
              name="password"
              type="password"
              autocomplete="current-password"
              required
              ${hasError ? 'aria-invalid="true" aria-describedby="login-error"' : ''}
              ${pending ? 'disabled' : ''}
            />
          </div>
          ${hasError
            ? `<p id="login-error" class="login-error" role="alert"><span aria-hidden="true">⚠</span> ${escapeHtml(errorMessage)}</p>`
            : ''}
          <button type="submit" class="button login-submit" ${pending ? 'disabled aria-busy="true"' : ''}>
            ${pending ? 'Kirjaudutaan…' : 'Kirjaudu'}
          </button>
        </form>
      </section>
    </main>
  `;
}

export function bindLoginView(root, { onSubmit }) {
  const form = root.querySelector('#login-form');
  form?.addEventListener('submit', (event) => {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    onSubmit(String(formData.get('password') || ''));
  });

  root.querySelector('#login-password')?.focus?.();
}
