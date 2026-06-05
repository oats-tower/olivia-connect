document.addEventListener('DOMContentLoaded', function () {

  // ── Tab switching ──
  const tabs = document.querySelectorAll('.page-tab');
  const pages = document.querySelectorAll('.tab-page');

  function switchTab(targetId) {
    tabs.forEach(t => t.classList.remove('active'));
    pages.forEach(p => p.classList.remove('active'));

    const targetTab = document.querySelector(`.page-tab[data-page="${targetId}"]`);
    const targetPage = document.getElementById(targetId);

    if (targetTab) targetTab.classList.add('active');
    if (targetPage) targetPage.classList.add('active');

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  tabs.forEach(tab => {
    tab.addEventListener('click', function () {
      switchTab(this.dataset.page);
    });
  });

  // Button inside main page that switches to dev tab
  const goToDevBtn = document.getElementById('go-to-dev-btn');
  if (goToDevBtn) {
    goToDevBtn.addEventListener('click', function () {
      switchTab('dev');
    });
  }

  // Button in dev tab that switches to main tab and scrolls to demo
  const goToDemoBtn = document.getElementById('go-to-demo-btn');
  if (goToDemoBtn) {
    goToDemoBtn.addEventListener('click', function () {
      switchTab('main');
      setTimeout(function () {
        const demo = document.getElementById('demo');
        if (demo) demo.scrollIntoView({ behavior: 'smooth' });
      }, 100);
    });
  }

  // ── Mobile menu ──
  const mobileMenuBtn = document.querySelector('.mobile-menu-btn');
  const navLinks = document.querySelector('.nav-links');
  const navButtons = document.querySelector('.nav-buttons');

  if (mobileMenuBtn) {
    mobileMenuBtn.addEventListener('click', function () {
      this.classList.toggle('active');

      if (!document.querySelector('.mobile-menu')) {
        const mobileMenu = document.createElement('div');
        mobileMenu.className = 'mobile-menu';
        mobileMenu.appendChild(navLinks.cloneNode(true));
        mobileMenu.appendChild(navButtons.cloneNode(true));
        document.querySelector('.navbar').appendChild(mobileMenu);
      }

      document.querySelector('.mobile-menu').classList.toggle('active');
    });
  }

  // ── Smooth scroll for anchor links ──
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', function (e) {
      const href = this.getAttribute('href');
      if (href === '#') return;

      const target = document.querySelector(href);
      if (target) {
        e.preventDefault();
        window.scrollTo({ top: target.offsetTop - 120, behavior: 'smooth' });

        const mobileMenu = document.querySelector('.mobile-menu');
        if (mobileMenu && mobileMenu.classList.contains('active')) {
          mobileMenuBtn.click();
        }
      }
    });
  });

  // ── Navbar scroll shadow ──
  window.addEventListener('scroll', function () {
    const navbar = document.querySelector('.navbar');
    if (window.scrollY > 10) {
      navbar.classList.add('navbar-scrolled');
    } else {
      navbar.classList.remove('navbar-scrolled');
    }
  });

  // ── Interactive Demo ──
  (function initDemo() {
    const uploadZone      = document.getElementById('uploadZone');
    const fileInput       = document.getElementById('receiptFileInput');
    const uploadBtn       = document.getElementById('uploadBtn');
    const uploadZoneInner = document.getElementById('uploadZoneInner');
    const previewWrap     = document.getElementById('receiptPreviewWrap');
    const previewImg      = document.getElementById('receiptPreviewImg');
    const changeFileBtn   = document.getElementById('changeFileBtn');
    const extractBtn      = document.getElementById('extractBtn');

    const resultsIdle     = document.getElementById('resultsIdle');
    const demoLoading     = document.getElementById('demoLoading');
    const demoError       = document.getElementById('demoError');
    const demoErrorMsg    = document.getElementById('demoErrorMsg');
    const demoRetryBtn    = document.getElementById('demoRetryBtn');
    const extractedFields = document.getElementById('extractedFields');
    const fieldsList      = document.getElementById('fieldsList');
    const demoCopyBtn     = document.getElementById('demoCopyBtn');

    if (!uploadZone) return; // demo section not present

    const FIELD_MAP = [
      { key: 'merchant',           label: 'Merchant' },
      { key: 'business_style',     label: 'Business Style' },
      { key: 'invoice_number',     label: 'Invoice / OR No.' },
      { key: 'tin',                label: 'TIN No.' },
      { key: 'total_amount_due',   label: 'Total Amount Due' },
      { key: 'vat',                label: 'VAT' },
      { key: 'vatable_sales',      label: 'VATable Sales' },
      { key: 'vat_exempt_sales',   label: 'VAT Exempt Sales' },
      { key: 'invoice_date',       label: 'Invoice Date' },
      { key: 'address',            label: 'Address' },
      { key: 'parser_quality',     label: 'Parse Quality' },
      { key: 'parser_info',        label: 'Parser Notes' },
      { key: 'reference',          label: 'Reference' },
    ];

    let currentFile = null;
    let lastResult  = null;

    function showPanel(id) {
      [resultsIdle, demoLoading, demoError, extractedFields].forEach(el => {
        el.classList.add('hidden');
      });
      document.getElementById(id).classList.remove('hidden');
    }

    function showUploadZone() {
      uploadZoneInner.classList.remove('hidden');
      previewWrap.classList.add('hidden');
    }

    function showPreview(file) {
      const url = URL.createObjectURL(file);
      previewImg.src = url;
      uploadZoneInner.classList.add('hidden');
      previewWrap.classList.remove('hidden');
    }

    function handleFile(file) {
      if (!file) return;
      // Basic type check
      const allowed = ['image/jpeg','image/png','image/gif','image/webp','application/pdf'];
      if (!allowed.includes(file.type)) {
        showPanel('demoError');
        demoErrorMsg.textContent = 'Unsupported file type. Please upload a JPG, PNG, or PDF.';
        return;
      }
      if (file.size > 10 * 1024 * 1024) {
        showPanel('demoError');
        demoErrorMsg.textContent = 'File is too large (max 10 MB).';
        return;
      }
      currentFile = file;
      showPreview(file);
      showPanel('resultsIdle');
    }

    // Click to upload
    uploadBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      fileInput.click();
    });
    uploadZone.addEventListener('click', function () {
      if (!currentFile) fileInput.click();
    });
    fileInput.addEventListener('change', function () {
      if (fileInput.files.length) handleFile(fileInput.files[0]);
      fileInput.value = '';
    });

    // Change file
    changeFileBtn.addEventListener('click', function (e) {
      e.stopPropagation();
      currentFile = null;
      lastResult = null;
      showUploadZone();
      showPanel('resultsIdle');
      fileInput.click();
    });

    // Drag and drop
    uploadZone.addEventListener('dragover', function (e) {
      e.preventDefault();
      uploadZone.classList.add('drag-over');
    });
    ['dragleave','dragend'].forEach(evt => {
      uploadZone.addEventListener(evt, function () {
        uploadZone.classList.remove('drag-over');
      });
    });
    uploadZone.addEventListener('drop', function (e) {
      e.preventDefault();
      uploadZone.classList.remove('drag-over');
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    });

    // Extract
    extractBtn.addEventListener('click', runExtraction);
    demoRetryBtn.addEventListener('click', function () {
      if (currentFile) runExtraction();
    });

    const MOCK_DATA = {
      merchant:           'JOLLIBEE FOODS CORPORATION',
      business_style:     'Fast Food Restaurant',
      invoice_number:     '0000123456',
      tin:                '000-123-456-000',
      total_amount_due:   285.00,
      vat:                30.54,
      vatable_sales:      254.46,
      vat_exempt_sales:   0.00,
      invoice_date:       'January 15, 2025',
      address:            '123 Ayala Avenue, Makati City, Metro Manila',
      parser_quality:     'good',
      parser_info:        'Sample data — no real API key configured.',
      reference:          'SAMPLE000000000000000000',
    };

    function isMockMode() {
      const cfg = window.LIPTECH_CONFIG || {};
      return !cfg.apiKey && !cfg.endpoint;
    }

    async function runExtraction() {
      if (!currentFile) return;

      const cfg      = window.LIPTECH_CONFIG || {};
      const endpoint = cfg.endpoint || '/api/liptech-extract';
      const apiKey   = cfg.apiKey   || null;

      // console.log('[LIPTech] config:', { apiKey: apiKey ? apiKey.slice(0,20) + '…' : '(empty)', endpoint: endpoint });
      // console.log('[LIPTech] mock mode:', isMockMode());

      showPanel('demoLoading');

      if (isMockMode()) {
        // Simulate network latency
        await new Promise(function (r) { setTimeout(r, 1200); });
        lastResult = MOCK_DATA;
        renderFields(MOCK_DATA, true);
        showPanel('extractedFields');
        return;
      }

      try {
        const body = new FormData();
        body.append('file', currentFile, currentFile.name);

        const headers = {};
        if (apiKey) headers['Authorization'] = 'Bearer ' + apiKey;
        headers['Accept'] = 'application/json';

        const res = await fetch(endpoint, { method: 'POST', headers, body });

        if (!res.ok) {
          const text = await res.text().catch(() => '');
          throw new Error('API returned ' + res.status + (text ? ': ' + text.slice(0, 200) : ''));
        }

        const json = await res.json();
        lastResult = json;
        renderFields(json, false);
        showPanel('extractedFields');
      } catch (err) {
        showPanel('demoError');
        demoErrorMsg.textContent = err.message || 'Something went wrong. Please try again.';
        console.error('[LIPTech demo]', err);
      }
    }

    function renderFields(data, isMock) {
      // Toggle mock badge visibility
      const badge = document.querySelector('.extraction-badge');
      if (badge) {
        if (isMock) {
          badge.textContent = 'Sample data';
          badge.style.background = '#fef3c7';
          badge.style.color = '#92400e';
        } else {
          badge.textContent = 'Extracted';
          badge.style.background = '';
          badge.style.color = '';
        }
      }
      // Flatten nested objects so we can pick top-level keys
      const flat = flattenResponse(data);
      fieldsList.innerHTML = '';
      FIELD_MAP.forEach(function (f) {
        const val = findValue(flat, f.key);
        const row = document.createElement('div');
        row.className = 'field-row';
        const lbl = document.createElement('span');
        lbl.className = 'field-label';
        lbl.textContent = f.label;
        const vl = document.createElement('span');
        vl.className = 'field-value' + (val == null ? ' empty' : '');
        vl.textContent = val != null ? String(val) : '—';
        row.appendChild(lbl);
        row.appendChild(vl);
        fieldsList.appendChild(row);
      });
    }

    // Try to find a key case-insensitively in a flat object
    function findValue(obj, key) {
      if (obj == null) return null;
      const lk = key.toLowerCase().replace(/_/g,'');
      for (const k of Object.keys(obj)) {
        if (k.toLowerCase().replace(/_/g,'') === lk) {
          const v = obj[k];
          if (v !== null && v !== undefined && v !== '') return v;
        }
      }
      return null;
    }

    // Flatten one level of nesting (e.g. { data: { merchant: ... } })
    function flattenResponse(obj) {
      if (!obj || typeof obj !== 'object') return {};
      const out = Object.assign({}, obj);
      for (const k of Object.keys(obj)) {
        if (obj[k] && typeof obj[k] === 'object' && !Array.isArray(obj[k])) {
          Object.assign(out, obj[k]);
        }
      }
      return out;
    }

    // Copy JSON
    demoCopyBtn.addEventListener('click', function () {
      if (!lastResult) return;
      navigator.clipboard.writeText(JSON.stringify(lastResult, null, 2))
        .then(function () {
          demoCopyBtn.textContent = 'Copied!';
          setTimeout(function () { demoCopyBtn.textContent = 'Copy JSON'; }, 2000);
        })
        .catch(function () {
          demoCopyBtn.textContent = 'Copy failed';
          setTimeout(function () { demoCopyBtn.textContent = 'Copy JSON'; }, 2000);
        });
    });
  })();

});
