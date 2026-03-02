(() => {
  const API_BASE = 'https://your-domain.com/api/admin/invoices';
  const EXPORT_URL = 'https://your-domain.com/api/admin/invoices/export';
  const LOGIN_URL = '/admin/login';

  const state = {
    page: 1,
    pageSize: 20,
    search: '',
    hasNextPage: false
  };

  const els = {
    rows: document.getElementById('invoiceRows'),
    error: document.getElementById('errorMessage'),
    pageIndicator: document.getElementById('pageIndicator'),
    prevButton: document.getElementById('prevButton'),
    nextButton: document.getElementById('nextButton'),
    searchInput: document.getElementById('searchInput'),
    searchButton: document.getElementById('searchButton'),
    exportButton: document.getElementById('exportButton')
  };

  function setLoading() {
    els.rows.innerHTML = '<tr><td colspan="6" class="status-row">Loading invoices...</td></tr>';
  }

  function setError(message) {
    els.error.textContent = message || '';
  }

  function updatePagination() {
    els.pageIndicator.textContent = `Page ${state.page}`;
    els.prevButton.disabled = state.page <= 1;
    els.nextButton.disabled = !state.hasNextPage;
  }

  function normalizeRows(payload) {
    if (Array.isArray(payload)) return payload;
    if (Array.isArray(payload?.items)) return payload.items;
    if (Array.isArray(payload?.data)) return payload.data;
    if (Array.isArray(payload?.results)) return payload.results;
    return [];
  }

  function inferHasNextPage(payload, rowsLength) {
    if (typeof payload?.has_next === 'boolean') return payload.has_next;
    if (typeof payload?.hasNext === 'boolean') return payload.hasNext;
    if (typeof payload?.next_page === 'number') return payload.next_page > state.page;
    if (typeof payload?.total_pages === 'number') return state.page < payload.total_pages;
    if (typeof payload?.total === 'number') return state.page * state.pageSize < payload.total;
    return rowsLength === state.pageSize;
  }

  function renderRows(rows) {
    if (!rows.length) {
      els.rows.innerHTML = '<tr><td colspan="6" class="status-row">No invoices found.</td></tr>';
      return;
    }

    els.rows.innerHTML = rows
      .map((row) => {
        const createdAt = row.created_at ?? '';
        const employeeName = row.employee_name ?? '';
        const employeeEmail = row.employee_email ?? '';
        const invoiceNo = row.invoice_no ?? '';
        const savedFilename = row.saved_filename ?? '';
        const clientIp = row.client_ip ?? '';

        return `
          <tr>
            <td>${escapeHtml(String(createdAt))}</td>
            <td>${escapeHtml(String(employeeName))}</td>
            <td>${escapeHtml(String(employeeEmail))}</td>
            <td>${escapeHtml(String(invoiceNo))}</td>
            <td>${escapeHtml(String(savedFilename))}</td>
            <td>${escapeHtml(String(clientIp))}</td>
          </tr>
        `;
      })
      .join('');
  }

  function escapeHtml(input) {
    return input
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#39;');
  }

  async function fetchInvoices() {
    setError('');
    setLoading();

    const params = new URLSearchParams({
      page: String(state.page),
      page_size: String(state.pageSize),
      search: state.search
    });

    const res = await fetch(`${API_BASE}?${params.toString()}`, {
      method: 'GET',
      credentials: 'include'
    });

    if (res.status === 401) {
      window.location.href = LOGIN_URL;
      return;
    }

    if (!res.ok) {
      throw new Error(`Failed to load invoices (HTTP ${res.status})`);
    }

    const payload = await res.json();
    const rows = normalizeRows(payload);

    renderRows(rows);
    state.hasNextPage = inferHasNextPage(payload, rows.length);
    updatePagination();
  }

  async function loadPage() {
    try {
      await fetchInvoices();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to load invoices.');
      els.rows.innerHTML = '<tr><td colspan="6" class="status-row">Could not load invoices.</td></tr>';
      state.hasNextPage = false;
      updatePagination();
    }
  }

  function bindEvents() {
    els.searchButton.addEventListener('click', () => {
      state.page = 1;
      state.search = els.searchInput.value.trim();
      loadPage();
    });

    els.searchInput.addEventListener('keydown', (event) => {
      if (event.key !== 'Enter') return;
      event.preventDefault();
      state.page = 1;
      state.search = els.searchInput.value.trim();
      loadPage();
    });

    els.prevButton.addEventListener('click', () => {
      if (state.page <= 1) return;
      state.page -= 1;
      loadPage();
    });

    els.nextButton.addEventListener('click', () => {
      if (!state.hasNextPage) return;
      state.page += 1;
      loadPage();
    });

    els.exportButton.addEventListener('click', () => {
      window.open(EXPORT_URL, '_blank', 'noopener,noreferrer');
    });
  }

  bindEvents();
  loadPage();
})();
