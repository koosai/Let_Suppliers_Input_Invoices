(function initAdminCommon() {
  const DOMAIN = 'https://your-domain.com';

  function buildAdminHeader() {
    const header = document.createElement('header');
    header.className = 'admin-header';
    header.innerHTML = `
      <div class="admin-header__inner">
        <p class="admin-brand">Admin</p>
        <nav class="admin-nav" aria-label="Admin navigation">
          <a href="/admin/invite">Send Invite</a>
          <a href="/admin/invoices">Invoices</a>
          <button type="button" id="admin-logout-button">Logout</button>
        </nav>
      </div>
    `;
    return header;
  }

  async function handleLogout() {
    try {
      await fetch(`${DOMAIN}/api/admin/logout`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        }
      });
    } finally {
      window.location.href = `${DOMAIN}/admin/login`;
    }
  }

  function mountAdminLayout() {
    const mountPoint = document.querySelector('[data-admin-layout]');
    if (!mountPoint) {
      return;
    }

    const header = buildAdminHeader();
    mountPoint.prepend(header);

    const logoutButton = document.getElementById('admin-logout-button');
    if (logoutButton) {
      logoutButton.addEventListener('click', handleLogout);
    }
  }

  function mountLoginBehavior() {
    const form = document.getElementById('admin-login-form');
    if (!form) {
      return;
    }

    const usernameInput = document.getElementById('username');
    const passwordInput = document.getElementById('password');
    const errorBox = document.getElementById('login-error');
    const loginButton = document.getElementById('login-button');

    form.addEventListener('submit', async function onSubmit(event) {
      event.preventDefault();
      errorBox.textContent = '';

      const username = usernameInput.value.trim();
      const password = passwordInput.value;

      if (!username || !password) {
        errorBox.textContent = 'Please enter both username and password.';
        return;
      }

      loginButton.disabled = true;
      loginButton.textContent = 'Signing in...';

      try {
        const response = await fetch(`${DOMAIN}/api/admin/login`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ username, password })
        });

        if (!response.ok) {
          let message = 'Login failed. Please check your credentials and try again.';
          try {
            const payload = await response.json();
            if (payload && typeof payload.message === 'string' && payload.message.trim()) {
              message = payload.message;
            }
          } catch (_error) {
            // Keep fallback message when no valid JSON body is returned.
          }
          throw new Error(message);
        }

        window.location.href = `${DOMAIN}/admin/invite`;
      } catch (error) {
        errorBox.textContent = error.message || 'Unable to sign in. Please try again.';
      } finally {
        loginButton.disabled = false;
        loginButton.textContent = 'Login';
      }
    });
  }

  mountAdminLayout();
  mountLoginBehavior();
})();
