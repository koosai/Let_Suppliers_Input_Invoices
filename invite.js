(function () {
  const form = document.getElementById('invite-form');
  const emailInput = document.getElementById('customer-email');
  const langSelect = document.getElementById('lang');
  const sendButton = document.getElementById('send-button');
  const statusArea = document.getElementById('status-area');

  if (!form || !emailInput || !langSelect || !sendButton || !statusArea) {
    return;
  }

  if (window.AdminCommon?.initAdminLayout) {
    window.AdminCommon.initAdminLayout({
      activeNav: 'invite',
      title: 'Send Invite',
    });
  }

  if (window.AdminCommon?.bindLogout) {
    window.AdminCommon.bindLogout();
  }

  const setStatus = (message, isError = false) => {
    statusArea.textContent = message;
    statusArea.style.color = isError ? '#b00020' : '';
  };

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    if (!form.reportValidity()) {
      return;
    }

    sendButton.disabled = true;
    setStatus('Sending invite...');

    try {
      const response = await fetch('/api/admin/send-invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify({
          customer_email: emailInput.value.trim(),
          lang: langSelect.value,
        }),
      });

      if (response.status === 401) {
        window.location.assign('/admin/login');
        return;
      }

      let payload = null;
      try {
        payload = await response.json();
      } catch (_error) {
        payload = null;
      }

      if (!response.ok) {
        const message = payload?.error || payload?.message || 'Failed to send invite.';
        setStatus(message, true);
        return;
      }

      setStatus(payload?.message || 'Invite sent successfully.');
      form.reset();
      langSelect.value = 'EN';
    } catch (_error) {
      setStatus('Network error while sending invite.', true);
    } finally {
      sendButton.disabled = false;
    }
  });
})();
