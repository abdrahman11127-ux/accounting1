(function () {
  const STORAGE_KEY = 'multi_system_finance_v2';

  const $ = (selector, ctx = document) => ctx.querySelector(selector);
  const $$ = (selector, ctx = document) => Array.from(ctx.querySelectorAll(selector));

  const formatter = new Intl.NumberFormat('en-PK', {
    style: 'currency',
    currency: 'PKR',
    maximumFractionDigits: 0,
  });

  const SYSTEM_LABELS = {
    personalSavings: 'Personal Savings',
    gameBusiness: 'Game Business',
    depalpur: 'Depalpur Distribution',
    personalAccount: 'Personal Account',
  };

  const DEFAULT_PARTIES = [
    {
      id: uuid(),
      name: 'Liaqat & Sons',
      role: 'supplier',
      systems: ['personalSavings', 'depalpur'],
      notes: 'Primary counterparty between Personal Savings and Depalpur.',
    },
    {
      id: uuid(),
      name: 'Zubair Bhai',
      role: 'supplier',
      systems: ['gameBusiness', 'personalSavings'],
      notes: 'Default supplier for the game lounge.',
    },
    {
      id: uuid(),
      name: 'Kehkashan Mehndi',
      role: 'supplier',
      systems: ['depalpur'],
      notes: 'Depalpur supplier.',
    },
    {
      id: uuid(),
      name: 'Olympia Chemical',
      role: 'supplier',
      systems: ['depalpur'],
      notes: 'Chemical supplier for Depalpur.',
    },
    {
      id: uuid(),
      name: 'Nazim Ali',
      role: 'worker',
      systems: ['depalpur'],
      notes: 'Depalpur worker advance tracking.',
    },
  ];

  const DEFAULT_CATEGORIES = [
    { id: uuid(), name: 'Capital Injection', flow: 'in', systems: ['personalSavings'] },
    { id: uuid(), name: 'Transfer to Business', flow: 'out', systems: ['personalSavings'] },
    { id: uuid(), name: 'Other Personal Income', flow: 'in', systems: ['personalSavings'] },
    { id: uuid(), name: 'Personal Expense', flow: 'out', systems: ['personalSavings', 'personalAccount'] },
    { id: uuid(), name: 'Game Income', flow: 'in', systems: ['gameBusiness'] },
    { id: uuid(), name: 'Membership Cost', flow: 'out', systems: ['gameBusiness'] },
    { id: uuid(), name: 'Equipment Purchase', flow: 'out', systems: ['gameBusiness'] },
    { id: uuid(), name: 'Supplier Payment', flow: 'out', systems: ['gameBusiness', 'depalpur'] },
    { id: uuid(), name: 'Cash Recovery', flow: 'in', systems: ['depalpur'] },
    { id: uuid(), name: 'Sales Collection', flow: 'in', systems: ['depalpur'] },
    { id: uuid(), name: 'Worker Advance', flow: 'out', systems: ['depalpur', 'personalSavings'] },
    { id: uuid(), name: 'Personal Salary', flow: 'in', systems: ['personalAccount'] },
    { id: uuid(), name: 'Household Spending', flow: 'out', systems: ['personalAccount'] },
    { id: uuid(), name: 'Liaqat Settlement', flow: 'out', systems: ['personalSavings'] },
  ];

  const DEFAULT_STATE = () => ({
    personalSavings: {
      openingBalance: 1_000_000,
      entries: [],
      liaqatEntries: [],
    },
    gameBusiness: {
      entries: [],
    },
    depalpur: {
      entries: [],
      stock: [],
      receivables: [],
      liaqatPayable: 0,
    },
    personalAccount: {
      entries: [],
    },
    parties: DEFAULT_PARTIES.map((item) => ({ ...item, systems: [...item.systems] })),
    categories: DEFAULT_CATEGORIES.map((item) => ({ ...item, systems: [...item.systems] })),
  });

  const state = loadState();
  const directions = {
    personal: 'in',
    game: 'in',
    depalpur: 'in',
    personalAccount: 'in',
  };
  let activePartyLedger = '';
  const editingState = {
    personalSavings: null,
    gameBusiness: null,
    depalpur: null,
    personalAccount: null,
  };
  const formSubmitButtons = {};

  init();
  refresh();

  function init() {
    setToday('#personal-date');
    setToday('#liaqat-date');
    setToday('#game-date');
    setToday('#depalpur-date');
    setToday('#personalAccount-date');

    initNav();
    initDirectionToggles();
    initForms();
    initFilters();
    initDirectoryForms();
    initReceivableTable();
    initPartyLedgerModal();
    initLedgerActions();
    cacheFormButtons();

    $$('#workspaceNav .nav-btn').forEach((btn) => {
      btn.addEventListener('click', () => switchPanel(btn.dataset.panel));
    });

    $$('[data-export]').forEach((btn) => {
      btn.addEventListener('click', () => exportLedger(btn.dataset.export));
    });
  }

  function loadState() {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return DEFAULT_STATE();
      const parsed = JSON.parse(raw);
      const defaults = DEFAULT_STATE();

      return {
        personalSavings: {
          openingBalance: Number(parsed.personalSavings?.openingBalance ?? 1_000_000),
          liaqatEntries: (parsed.personalSavings?.liaqatEntries || []).map(normaliseEntry),
          entries: (parsed.personalSavings?.entries || []).map(normaliseEntry),
        },
        gameBusiness: {
          entries: (parsed.gameBusiness?.entries || []).map(normaliseEntry),
        },
        depalpur: {
          entries: (parsed.depalpur?.entries || []).map(normaliseEntry),
          stock: (parsed.depalpur?.stock || []).map(normaliseStock),
          receivables: (parsed.depalpur?.receivables || []).map(normaliseReceivable),
          liaqatPayable: Number(parsed.depalpur?.liaqatPayable || 0),
        },
        personalAccount: {
          entries: (parsed.personalAccount?.entries || []).map(normaliseEntry),
        },
        parties: mergeByName(defaults.parties, parsed.parties || []),
        categories: mergeByName(defaults.categories, parsed.categories || []),
      };
    } catch (error) {
      console.error('Failed to read stored data', error);
      return DEFAULT_STATE();
    }
  }

  function saveState() {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function mergeByName(defaults, stored) {
    const map = new Map();
    defaults.forEach((item) => map.set(item.name.toLowerCase(), { ...item }));
    (stored || []).forEach((item) => {
      if (!item?.name) return;
      const key = item.name.toLowerCase();
      map.set(key, {
        id: item.id || uuid(),
        name: item.name,
        role: item.role || 'other',
        systems: Array.from(new Set(item.systems || [])),
        notes: item.notes || '',
        flow: item.flow,
      });
    });
    return Array.from(map.values());
  }

  function normaliseEntry(entry) {
    return {
      id: entry.id || uuid(),
      date: entry.date || today(),
      direction: entry.direction === 'out' ? 'out' : 'in',
      amount: toAmount(entry.amount),
      description: entry.description || '',
      category: entry.category || 'Uncategorised',
      party: entry.party || '',
      notes: entry.notes || '',
      linkedSystem: entry.linkedSystem || '',
      liaqatPayment: !!entry.liaqatPayment,
      createdAt: entry.createdAt || Date.now(),
    };
  }

  function normaliseStock(item) {
    return {
      id: item.id || uuid(),
      date: item.date || today(),
      action: item.action === 'decrease' ? 'decrease' : 'increase',
      amount: toAmount(item.amount),
      createdAt: item.createdAt || Date.now(),
    };
  }

  function normaliseReceivable(item) {
    return {
      id: item.id || uuid(),
      customer: item.customer || 'Unnamed',
      amount: toAmount(item.amount),
      collected: !!item.collected,
      createdAt: item.createdAt || Date.now(),
    };
  }

  function initNav() {
    switchPanel('dashboard');
  }

  function switchPanel(panel) {
    $$('#workspaceNav .nav-btn').forEach((btn) => {
      btn.classList.toggle('active', btn.dataset.panel === panel);
    });
    $$('.panel').forEach((node) => {
      node.classList.toggle('active', node.id === `panel-${panel}`);
    });
  }

  function initDirectionToggles() {
    $$('.pill').forEach((pill) => {
      pill.addEventListener('click', () => {
        const target = pill.dataset.target;
        const dir = pill.dataset.dir;
        directions[target] = dir;
        $$('.pill[data-target="' + target + '"]').forEach((p) => {
          p.classList.toggle('active', p === pill);
        });
      });
    });
  }

  function initForms() {
    $('#personalForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const amount = toAmount($('#personal-amount').value);
      if (!amount) return alert('Enter an amount');
      const party = ($('#personal-party').value || '').trim();
      if (!party) return alert('Select a party for this entry');

      const entry = {
        date: $('#personal-date').value || today(),
        direction: directions.personal,
        amount,
        description: $('#personal-description').value.trim(),
        category: $('#personal-category').value,
        party,
        notes: $('#personal-notes').value.trim(),
        linkedSystem: $('#personal-link').value || '',
      };

      ensureParty(party, 'personalSavings', 'counterparty');
      const editingId = editingState.personalSavings;
      if (editingId) {
        const updated = updateEntry('personalSavings', editingId, entry);
        if (!updated) return alert('Entry could not be updated');
        clearEditing('personalSavings');
      } else {
        const saved = createEntry('personalSavings', entry);
        if (isLiaqat(saved.party)) {
          recordLiaqatEntry(saved);
        }
        if (saved.linkedSystem) {
          createLinkedEntry(saved.linkedSystem, saved, 'personalSavings');
        }
      }
      saveAndRefresh();
      event.target.reset();
      setToday('#personal-date');
      setDirectionDefault('personal');
    });

    $('#liaqatForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const amount = toAmount($('#liaqat-amount').value);
      if (!amount) return alert('Enter an amount');
      const direction = $('#liaqat-action').value === 'out' ? 'out' : 'in';
      const entry = {
        date: $('#liaqat-date').value || today(),
        direction,
        amount,
        description:
          direction === 'out' ? 'Cash given to Liaqat & Sons' : 'Cash received from Liaqat & Sons',
        category: 'Liaqat Settlement',
        party: 'Liaqat & Sons',
        notes: $('#liaqat-notes').value.trim(),
        linkedSystem: '',
      };
      const saved = createEntry('personalSavings', entry);
      recordLiaqatEntry(saved);
      saveAndRefresh();
      event.target.reset();
      setToday('#liaqat-date');
    });

    $('#gameForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const amount = toAmount($('#game-amount').value);
      if (!amount) return alert('Enter an amount');
      const party = $('#game-party').value;
      if (!party) return alert('Select a party or supplier');
      const entry = {
        date: $('#game-date').value || today(),
        direction: directions.game,
        amount,
        description: $('#game-description').value.trim(),
        category: $('#game-category').value,
        party,
        notes: $('#game-notes').value.trim(),
        linkedSystem: $('#game-link').value || '',
      };
      ensureParty(party, 'gameBusiness', 'supplier');
      const editingId = editingState.gameBusiness;
      if (editingId) {
        const updated = updateEntry('gameBusiness', editingId, entry);
        if (!updated) return alert('Entry could not be updated');
        clearEditing('gameBusiness');
      } else {
        const saved = createEntry('gameBusiness', entry);
        if (saved.linkedSystem) {
          createLinkedEntry(saved.linkedSystem, saved, 'gameBusiness');
        }
      }
      saveAndRefresh();
      event.target.reset();
      setToday('#game-date');
      setDirectionDefault('game');
    });

    $('#addGameSupplier').addEventListener('click', () => {
      const name = prompt('Supplier name');
      if (!name) return;
      ensureParty(name, 'gameBusiness', 'supplier');
      saveAndRefresh();
    });

    $('#depalpurForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const amount = toAmount($('#depalpur-amount').value);
      if (!amount) return alert('Enter an amount');
      const party = $('#depalpur-party').value;
      if (!party) return alert('Select a supplier or party');
      const entry = {
        date: $('#depalpur-date').value || today(),
        direction: directions.depalpur,
        amount,
        description: $('#depalpur-description').value.trim(),
        category: $('#depalpur-category').value,
        party,
        notes: $('#depalpur-notes').value.trim(),
        linkedSystem: $('#depalpur-link').value || '',
        liaqatPayment: $('#depalpur-liaqat').checked,
      };
      ensureParty(party, 'depalpur', 'supplier');
      const editingId = editingState.depalpur;
      if (editingId) {
        const updated = updateEntry('depalpur', editingId, entry);
        if (!updated) return alert('Entry could not be updated');
        clearEditing('depalpur');
      } else {
        const saved = createEntry('depalpur', entry);
        adjustDepalpurLiaqat(null, saved);
        if (saved.linkedSystem) {
          createLinkedEntry(saved.linkedSystem, saved, 'depalpur');
        }
      }
      saveAndRefresh();
      event.target.reset();
      setToday('#depalpur-date');
      setDirectionDefault('depalpur');
    });

    $('#addDepalpurParty').addEventListener('click', () => {
      const name = prompt('Party name');
      if (!name) return;
      ensureParty(name, 'depalpur', 'supplier');
      saveAndRefresh();
    });

    $('#liaqatPayableForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const amount = toAmount($('#liaqatPayable-amount').value);
      if (!amount) return alert('Enter an amount');
      const action = $('#liaqatPayable-action').value;
      if (action === 'decrease') {
        state.depalpur.liaqatPayable = round(Math.max(0, state.depalpur.liaqatPayable - amount));
      } else {
        state.depalpur.liaqatPayable = round(state.depalpur.liaqatPayable + amount);
      }
      $('#liaqatPayable-amount').value = '';
      saveAndRefresh();
    });

    $('#stockForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const amount = toAmount($('#stock-amount').value);
      if (!amount) return alert('Enter stock value');
      state.depalpur.stock.push(
        normaliseStock({
          date: today(),
          action: $('#stock-action').value,
          amount,
        })
      );
      $('#stock-amount').value = '';
      saveAndRefresh();
    });

    $('#receivableForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const customer = $('#receivable-party').value.trim();
      const amount = toAmount($('#receivable-amount').value);
      if (!customer || !amount) return alert('Enter customer and amount');
      state.depalpur.receivables.push(
        normaliseReceivable({ customer, amount, collected: false })
      );
      event.target.reset();
      saveAndRefresh();
    });

    $('#personalAccountForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const amount = toAmount($('#personalAccount-amount').value);
      if (!amount) return alert('Enter an amount');
      const party = ($('#personalAccount-party').value || '').trim();
      const entry = {
        date: $('#personalAccount-date').value || today(),
        direction: directions.personalAccount,
        amount,
        description: $('#personalAccount-description').value.trim(),
        category: $('#personalAccount-category').value,
        party,
        notes: $('#personalAccount-notes').value.trim(),
        linkedSystem: $('#personalAccount-link').value || '',
      };
      if (party) ensureParty(party, 'personalAccount', 'other');
      const editingId = editingState.personalAccount;
      if (editingId) {
        const updated = updateEntry('personalAccount', editingId, entry);
        if (!updated) return alert('Entry could not be updated');
        clearEditing('personalAccount');
      } else {
        const saved = createEntry('personalAccount', entry);
        if (saved.linkedSystem) {
          createLinkedEntry(saved.linkedSystem, saved, 'personalAccount');
        }
      }
      saveAndRefresh();
      event.target.reset();
      setToday('#personalAccount-date');
      setDirectionDefault('personalAccount');
    });
  }

  function initFilters() {
    $('#personal-filter').addEventListener('change', () => renderPersonal());
    $('#game-filter').addEventListener('change', () => renderGame());
    $('#depalpur-filter').addEventListener('change', () => renderDepalpur());
    $('#personalAccount-filter').addEventListener('change', () => renderPersonalAccount());
  }

  function initDirectoryForms() {
    $('#partyForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const name = $('#party-name').value.trim();
      if (!name) return alert('Enter party name');
      const role = $('#party-role').value;
      const systems = $$('#partyForm .checkbox-group input[type="checkbox"]')
        .filter((el) => el.checked)
        .map((el) => el.value);
      if (!systems.length) return alert('Select at least one system');
      const notes = $('#party-notes').value.trim();
      let party = state.parties.find((p) => p.name.toLowerCase() === name.toLowerCase());
      if (party) {
        party.role = role;
        party.notes = notes;
        party.systems = Array.from(new Set([...party.systems, ...systems]));
      } else {
        party = { id: uuid(), name, role, systems, notes };
        state.parties.push(party);
      }
      event.target.reset();
      saveAndRefresh();
    });

    $('#categoryForm').addEventListener('submit', (event) => {
      event.preventDefault();
      const name = $('#category-name').value.trim();
      if (!name) return alert('Enter category name');
      const flow = $('#category-flow').value;
      const systems = $$('#categoryForm .checkbox-group input[type="checkbox"]')
        .filter((el) => el.checked)
        .map((el) => el.value);
      if (!systems.length) return alert('Select systems');
      const notes = $('#category-notes').value.trim();
      let category = state.categories.find((c) => c.name.toLowerCase() === name.toLowerCase());
      if (category) {
        category.flow = flow;
        category.notes = notes;
        category.systems = Array.from(new Set([...category.systems, ...systems]));
      } else {
        category = { id: uuid(), name, flow, systems, notes };
        state.categories.push(category);
      }
      event.target.reset();
      saveAndRefresh();
    });
  }

  function initReceivableTable() {
    $('#receivable-table').addEventListener('click', (event) => {
      const button = event.target.closest('button[data-receivable]');
      if (!button) return;
      const id = button.dataset.receivable;
      const record = state.depalpur.receivables.find((item) => item.id === id);
      if (!record) return;
      record.collected = !record.collected;
      saveAndRefresh();
    });
  }

  function refresh() {
    renderSummary();
    renderPersonal();
    renderGame();
    renderDepalpur();
    renderPersonalAccount();
    renderDirectory();
  }

  function renderSummary() {
    $('#summary-personalSavings').textContent = formatMoney(
      computeBalance(state.personalSavings.entries, state.personalSavings.openingBalance)
    );
    $('#summary-gameBusiness').textContent = formatMoney(
      computeBalance(state.gameBusiness.entries)
    );
    const depalpurNet = computeBalance(state.depalpur.entries) +
      computeStockValue() +
      outstandingReceivables();
    $('#summary-depalpur').textContent = formatMoney(depalpurNet);
    $('#summary-personalAccount').textContent = formatMoney(
      computeBalance(state.personalAccount.entries)
    );
  }

  function renderPersonal() {
    fillCategorySelect('personal-category', 'personalSavings');
    fillPartyOptions();
    updatePersonalFilterOptions();
    const filter = $('#personal-filter').value;
    const rows = buildLedgerRows(
      state.personalSavings.entries,
      filter,
      state.personalSavings.openingBalance,
      'party',
      'personalSavings'
    );
    $('#personal-ledger').innerHTML = rows.length
      ? rows.map(renderLedgerRow).join('')
      : emptyRow(9);
    $('#liaqat-balance').textContent = formatMoney(computeLiaqatBalance());
  }

  function renderGame() {
    fillCategorySelect('game-category', 'gameBusiness');
    fillPartyOptions();
    updateFilterOptions('game-filter', state.gameBusiness.entries, 'supplier');
    const filter = $('#game-filter').value;
    const rows = buildLedgerRows(
      state.gameBusiness.entries,
      filter,
      0,
      'party',
      'gameBusiness'
    );
    $('#game-ledger').innerHTML = rows.length ? rows.map(renderLedgerRow).join('') : emptyRow(9);
    $('#game-balance').textContent = formatMoney(computeBalance(state.gameBusiness.entries));
    $('#game-equipment').textContent = formatMoney(sumByCategory(state.gameBusiness.entries, 'equipment'));
    $('#game-membership').textContent = formatMoney(sumByCategory(state.gameBusiness.entries, 'membership'));
  }

  function renderDepalpur() {
    fillCategorySelect('depalpur-category', 'depalpur');
    fillPartyOptions();
    updateFilterOptions('depalpur-filter', state.depalpur.entries, 'supplier');
    const filter = $('#depalpur-filter').value;
    const rows = buildLedgerRows(state.depalpur.entries, filter, 0, 'party', 'depalpur');
    $('#depalpur-ledger').innerHTML = rows.length
      ? rows.map(renderLedgerRow).join('')
      : emptyRow(9);
    $('#depalpur-balance').textContent = formatMoney(computeBalance(state.depalpur.entries));
    $('#depalpur-stock').textContent = formatMoney(computeStockValue());
    $('#depalpur-receivables').textContent = formatMoney(outstandingReceivables());
    $('#depalpur-liaqat-balance').textContent = formatMoney(state.depalpur.liaqatPayable);
    const net =
      computeBalance(state.depalpur.entries) +
      computeStockValue() +
      outstandingReceivables();
    $('#depalpur-net').textContent = formatMoney(net);
    renderStockTable();
    renderReceivables();
  }

  function renderPersonalAccount() {
    fillCategorySelect('personalAccount-category', 'personalAccount');
    fillPartyOptions();
    updateCategoryFilter();
    const filter = $('#personalAccount-filter').value;
    const rows = buildLedgerRows(
      state.personalAccount.entries,
      filter,
      0,
      filter ? 'category' : 'party',
      'personalAccount'
    );
    $('#personalAccount-ledger').innerHTML = rows.length
      ? rows.map(renderLedgerRow).join('')
      : emptyRow(9);
    const balance = computeBalance(state.personalAccount.entries);
    $('#personalAccount-balance').textContent = formatMoney(balance);
    $('#personalAccount-owed-game').textContent = formatMoney(
      computeLinkedBalance(state.personalAccount.entries, 'gameBusiness')
    );
    $('#personalAccount-owed-depalpur').textContent = formatMoney(
      computeLinkedBalance(state.personalAccount.entries, 'depalpur')
    );
    $('#personalAccount-owed-savings').textContent = formatMoney(
      computeLinkedBalance(state.personalAccount.entries, 'personalSavings')
    );
  }

  function renderDirectory() {
    $('#party-table').innerHTML = state.parties.length
      ? state.parties
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(
            (party) => `
          <tr>
            <td>${escapeHtml(party.name)}</td>
            <td>${escapeHtml(party.role)}</td>
            <td>${party.systems.map((s) => SYSTEM_LABELS[s] || s).join(', ')}</td>
            <td>${escapeHtml(party.notes || '')}</td>
            <td><button class="ghost-btn" data-party-ledger="${escapeHtml(party.name)}">View ledger</button></td>
          </tr>`
          )
          .join('')
      : emptyRow(5);

    $('#category-table').innerHTML = state.categories.length
      ? state.categories
          .slice()
          .sort((a, b) => a.name.localeCompare(b.name))
          .map(
            (category) => `
          <tr>
            <td>${escapeHtml(category.name)}</td>
            <td>${category.flow === 'in' ? 'Cash In' : 'Cash Out'}</td>
            <td>${category.systems.map((s) => SYSTEM_LABELS[s] || s).join(', ')}</td>
            <td>${escapeHtml(category.notes || '')}</td>
          </tr>`
          )
          .join('')
      : emptyRow(4);
  }

  function initPartyLedgerModal() {
    const table = $('#party-table');
    if (table) {
      table.addEventListener('click', (event) => {
        const button = event.target.closest('button[data-party-ledger]');
        if (!button) return;
        const name = button.getAttribute('data-party-ledger');
        if (name) openPartyLedger(name);
      });
    }

    const overlay = $('#partyLedgerOverlay');
    const closeBtn = $('#partyLedgerClose');
    const exportBtn = $('#partyLedgerExport');
    if (closeBtn) closeBtn.addEventListener('click', closePartyLedger);
    if (overlay) {
      overlay.addEventListener('click', (event) => {
        if (event.target === overlay) closePartyLedger();
      });
    }
    if (exportBtn) exportBtn.addEventListener('click', exportPartyLedger);
  }

  function initLedgerActions() {
    attachLedgerHandler('#personal-ledger', 'personalSavings');
    attachLedgerHandler('#game-ledger', 'gameBusiness');
    attachLedgerHandler('#depalpur-ledger', 'depalpur');
    attachLedgerHandler('#personalAccount-ledger', 'personalAccount');
  }

  function cacheFormButtons() {
    formSubmitButtons.personalSavings = $('#personalForm button[type="submit"]');
    formSubmitButtons.gameBusiness = $('#gameForm button[type="submit"]');
    formSubmitButtons.depalpur = $('#depalpurForm button[type="submit"]');
    formSubmitButtons.personalAccount =
      $('#personalAccountForm button[type="submit"]');
  }

  function openPartyLedger(partyName) {
    activePartyLedger = partyName;
    const overlay = $('#partyLedgerOverlay');
    if (!overlay) return;
    $('#partyLedgerTitle').textContent = `${partyName} Ledger`;
    const rows = buildPartyLedgerRows(partyName);
    $('#partyLedgerBody').innerHTML = rows.length
      ? rows.map(renderPartyLedgerRow).join('')
      : emptyRow(8);
    overlay.classList.add('open');
    overlay.setAttribute('aria-hidden', 'false');
  }

  function closePartyLedger() {
    const overlay = $('#partyLedgerOverlay');
    if (!overlay) return;
    overlay.classList.remove('open');
    overlay.setAttribute('aria-hidden', 'true');
    activePartyLedger = '';
  }

  function buildPartyLedgerRows(partyName) {
    const target = (partyName || '').toLowerCase();
    const combined = [];
    Object.keys(SYSTEM_LABELS).forEach((systemKey) => {
      const ledger = state[systemKey]?.entries || [];
      ledger.forEach((entry) => {
        if ((entry.party || '').toLowerCase() === target) {
          combined.push({ systemKey, entry });
        }
      });
    });
    const sorted = combined.sort((a, b) => {
      if (a.entry.date === b.entry.date) return a.entry.createdAt - b.entry.createdAt;
      return a.entry.date.localeCompare(b.entry.date);
    });
    let balance = 0;
    return sorted.map(({ systemKey, entry }) => {
      balance += entry.direction === 'in' ? entry.amount : -entry.amount;
      return { systemKey, entry, balance };
    });
  }

  function renderPartyLedgerRow({ systemKey, entry, balance }) {
    return `
      <tr>
        <td>${escapeHtml(entry.date)}</td>
        <td>${escapeHtml(SYSTEM_LABELS[systemKey] || systemKey)}</td>
        <td>${escapeHtml(entry.description || '-')}</td>
        <td>${escapeHtml(entry.category || '-')}</td>
        <td>${entry.direction === 'in' ? formatMoney(entry.amount) : ''}</td>
        <td>${entry.direction === 'out' ? formatMoney(entry.amount) : ''}</td>
        <td>${formatMoney(balance)}</td>
        <td>${escapeHtml(entry.notes || '')}</td>
      </tr>`;
  }

  async function exportPartyLedger() {
    if (!activePartyLedger) return;
    const container = $('#partyLedgerTableWrap');
    if (!container) return;
    const { jsPDF } = window.jspdf;
    const canvas = await html2canvas(container, { scale: 2, backgroundColor: '#0b1120' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const ratio = Math.min((pageWidth - 40) / canvas.width, (pageHeight - 80) / canvas.height);
    const imgWidth = canvas.width * ratio;
    const imgHeight = canvas.height * ratio;
    pdf.setFontSize(14);
    pdf.text(`${activePartyLedger} Ledger`, 20, 28);
    pdf.addImage(imgData, 'PNG', 20, 40, imgWidth, imgHeight);
    pdf.save(`${activePartyLedger.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-ledger.pdf`);
  }

  function renderStockTable() {
    $('#stock-table').innerHTML = state.depalpur.stock.length
      ? state.depalpur.stock
          .slice()
          .sort((a, b) => a.createdAt - b.createdAt)
          .map(
            (item) => `
          <tr>
            <td>${escapeHtml(item.date)}</td>
            <td>${item.action === 'decrease' ? 'Decrease' : 'Increase'}</td>
            <td>${formatMoney(item.amount)}</td>
          </tr>`
          )
          .join('')
      : emptyRow(3);
  }

  function renderReceivables() {
    $('#receivable-table').innerHTML = state.depalpur.receivables.length
      ? state.depalpur.receivables
          .slice()
          .sort((a, b) => a.createdAt - b.createdAt)
          .map(
            (item) => `
          <tr>
            <td>${escapeHtml(item.customer)}</td>
            <td>${formatMoney(item.amount)}</td>
            <td>
              ${item.collected ? 'Collected' : 'Outstanding'}
              <button class="ghost-btn" data-receivable="${item.id}">
                Mark ${item.collected ? 'outstanding' : 'collected'}
              </button>
            </td>
          </tr>`
          )
          .join('')
      : emptyRow(3);
  }

  function updatePersonalFilterOptions() {
    const parties = Array.from(
      new Set(state.personalSavings.entries.map((entry) => entry.party).filter(Boolean))
    );
    const select = $('#personal-filter');
    const prev = select.value;
    select.innerHTML = `
      <option value="">All parties</option>
      ${parties.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('')}
    `;
    select.value = prev || '';
  }

  function updateFilterOptions(selectId, entries) {
    const parties = Array.from(new Set(entries.map((entry) => entry.party).filter(Boolean)));
    const select = $(`#${selectId}`);
    const prev = select.value;
    select.innerHTML = `
      <option value="">All</option>
      ${parties.map((p) => `<option value="${escapeHtml(p)}">${escapeHtml(p)}</option>`).join('')}
    `;
    select.value = prev || '';
  }

  function updateCategoryFilter() {
    const categories = Array.from(
      new Set(state.personalAccount.entries.map((entry) => entry.category).filter(Boolean))
    );
    const select = $('#personalAccount-filter');
    const prev = select.value;
    select.innerHTML = `
      <option value="">All categories</option>
      ${categories
        .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
        .join('')}
    `;
    select.value = prev || '';
  }

  function fillPartyOptions() {
    const personalList = $('#personal-party-list');
    personalList.innerHTML = partiesFor('personalSavings')
      .map((name) => `<option value="${escapeHtml(name)}"></option>`)
      .join('');

    const personalAccountList = $('#personalAccount-party-list');
    if (personalAccountList) {
      personalAccountList.innerHTML = partiesFor('personalAccount')
        .map((name) => `<option value="${escapeHtml(name)}"></option>`)
        .join('');
    }

    fillSelect('personal-party', partiesFor('personalSavings'), 'Select party');
    fillSelect('game-party', partiesFor('gameBusiness'), 'Select supplier');
    fillSelect('depalpur-party', partiesFor('depalpur'), 'Select party');
  }

  function attachLedgerHandler(selector, systemKey) {
    const tbody = $(selector);
    if (!tbody) return;
    tbody.addEventListener('click', (event) => {
      const editBtn = event.target.closest('button[data-edit-entry]');
      if (editBtn) {
        event.preventDefault();
        handleEditAction(systemKey, editBtn.getAttribute('data-edit-entry'));
        return;
      }
      const deleteBtn = event.target.closest('button[data-delete-entry]');
      if (deleteBtn) {
        event.preventDefault();
        const id = deleteBtn.getAttribute('data-delete-entry');
        if (id && confirm('Delete this entry?')) {
          handleDeleteAction(systemKey, id);
        }
      }
    });
  }

  function handleEditAction(systemKey, entryId) {
    if (!entryId) return;
    const ledger = state[systemKey]?.entries || [];
    const entry = ledger.find((item) => item.id === entryId);
    if (!entry) return;
    startEditingEntry(systemKey, entry);
  }

  function handleDeleteAction(systemKey, entryId) {
    const removed = removeEntry(systemKey, entryId);
    if (!removed) return;
    if (editingState[systemKey] === entryId) {
      clearEditing(systemKey);
      resetFormFor(systemKey);
    }
    saveAndRefresh();
  }

  function startEditingEntry(systemKey, entry) {
    editingState[systemKey] = entry.id;
    setFormButtonMode(systemKey, 'edit');
    switch (systemKey) {
      case 'personalSavings': {
        setDirectionValue('personal', entry.direction);
        $('#personal-date').value = entry.date;
        $('#personal-amount').value = entry.amount;
        ensureSelectValue('#personal-category', entry.category);
        $('#personal-category').value = entry.category;
        ensureSelectValue('#personal-party', entry.party);
        $('#personal-party').value = entry.party;
        $('#personal-description').value = entry.description || '';
        $('#personal-notes').value = entry.notes || '';
        $('#personal-link').value = entry.linkedSystem || '';
        const form = $('#personalForm');
        if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      }
      case 'gameBusiness': {
        setDirectionValue('game', entry.direction);
        $('#game-date').value = entry.date;
        $('#game-amount').value = entry.amount;
        ensureSelectValue('#game-category', entry.category);
        $('#game-category').value = entry.category;
        ensureSelectValue('#game-party', entry.party);
        $('#game-party').value = entry.party;
        $('#game-description').value = entry.description || '';
        $('#game-notes').value = entry.notes || '';
        $('#game-link').value = entry.linkedSystem || '';
        const form = $('#gameForm');
        if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      }
      case 'depalpur': {
        setDirectionValue('depalpur', entry.direction);
        $('#depalpur-date').value = entry.date;
        $('#depalpur-amount').value = entry.amount;
        ensureSelectValue('#depalpur-category', entry.category);
        $('#depalpur-category').value = entry.category;
        ensureSelectValue('#depalpur-party', entry.party);
        $('#depalpur-party').value = entry.party;
        $('#depalpur-description').value = entry.description || '';
        $('#depalpur-notes').value = entry.notes || '';
        $('#depalpur-link').value = entry.linkedSystem || '';
        $('#depalpur-liaqat').checked = !!entry.liaqatPayment;
        const form = $('#depalpurForm');
        if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      }
      case 'personalAccount': {
        setDirectionValue('personalAccount', entry.direction);
        $('#personalAccount-date').value = entry.date;
        $('#personalAccount-amount').value = entry.amount;
        ensureSelectValue('#personalAccount-category', entry.category);
        $('#personalAccount-category').value = entry.category;
        $('#personalAccount-party').value = entry.party || '';
        $('#personalAccount-description').value = entry.description || '';
        $('#personalAccount-notes').value = entry.notes || '';
        $('#personalAccount-link').value = entry.linkedSystem || '';
        const form = $('#personalAccountForm');
        if (form) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
        break;
      }
      default:
        break;
    }
  }

  function setFormButtonMode(systemKey, mode) {
    const button = formSubmitButtons[systemKey];
    if (!button) return;
    button.textContent = mode === 'edit' ? 'Update Entry' : 'Save Entry';
  }

  function clearEditing(systemKey) {
    editingState[systemKey] = null;
    setFormButtonMode(systemKey, 'add');
  }

  function resetFormFor(systemKey) {
    if (systemKey === 'personalSavings') {
      const form = $('#personalForm');
      if (form) {
        form.reset();
        setToday('#personal-date');
        setDirectionDefault('personal');
      }
    } else if (systemKey === 'gameBusiness') {
      const form = $('#gameForm');
      if (form) {
        form.reset();
        setToday('#game-date');
        setDirectionDefault('game');
      }
    } else if (systemKey === 'depalpur') {
      const form = $('#depalpurForm');
      if (form) {
        form.reset();
        setToday('#depalpur-date');
        setDirectionDefault('depalpur');
      }
    } else if (systemKey === 'personalAccount') {
      const form = $('#personalAccountForm');
      if (form) {
        form.reset();
        setToday('#personalAccount-date');
        setDirectionDefault('personalAccount');
      }
    }
  }

  function ensureSelectValue(selector, value) {
    if (!value) return;
    const select = $(selector);
    if (!select) return;
    const exists = Array.from(select.options).some((option) => option.value === value);
    if (!exists) {
      const option = document.createElement('option');
      option.value = value;
      option.textContent = value;
      select.appendChild(option);
    }
  }

  function fillCategorySelect(selectId, systemKey) {
    const select = $(`#${selectId}`);
    const prev = select.value;
    const categories = categoriesFor(systemKey);
    select.innerHTML = categories
      .map((category) => `<option value="${escapeHtml(category.name)}">${escapeHtml(category.name)}</option>`)
      .join('');
    if (categories.length) {
      if (!prev || !categories.find((item) => item.name === prev)) {
        const preferred = categories.find((item) => item.flow === 'out');
        select.value = preferred ? preferred.name : categories[0].name;
      } else {
        select.value = prev;
      }
    }
  }

  function fillSelect(selectId, values, placeholder) {
    const select = $(`#${selectId}`);
    const prev = select.value;
    select.innerHTML = `
      ${placeholder ? `<option value="">${escapeHtml(placeholder)}</option>` : ''}
      ${values.map((v) => `<option value="${escapeHtml(v)}">${escapeHtml(v)}</option>`).join('')}
    `;
    select.value = prev || '';
  }

  function partiesFor(systemKey) {
    return state.parties
      .filter((party) => party.systems.includes(systemKey))
      .map((party) => party.name)
      .sort((a, b) => a.localeCompare(b));
  }

  function categoriesFor(systemKey) {
    return state.categories
      .filter((category) => category.systems.includes(systemKey))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  function createEntry(systemKey, entry) {
    const normalised = normaliseEntry(entry);
    state[systemKey].entries.push(normalised);
    return normalised;
  }

  function recordLiaqatEntry(entry) {
    syncLiaqatLedger(null, entry);
  }

  function createLinkedEntry(targetKey, sourceEntry, sourceKey) {
    if (!SYSTEM_LABELS[targetKey]) return;
    const entry = {
      date: sourceEntry.date,
      direction: sourceEntry.direction === 'in' ? 'out' : 'in',
      amount: sourceEntry.amount,
      description: sourceEntry.description || `Linked transfer from ${SYSTEM_LABELS[sourceKey]}`,
      category: 'Linked Transfer',
      party: SYSTEM_LABELS[sourceKey],
      notes: sourceEntry.notes ? `${sourceEntry.notes} (linked)` : 'Linked transfer',
      linkedSystem: sourceKey,
      createdAt: sourceEntry.createdAt,
      liaqatPayment: false,
    };
    createEntry(targetKey, entry);
  }

  function syncLinkedEntries(systemKey, previous, next) {
    const prevLink = previous?.linkedSystem;
    const nextLink = next?.linkedSystem;
    if (prevLink && (!nextLink || nextLink !== prevLink)) {
      removeLinkedCounterpart(systemKey, previous);
    }
    if (!nextLink) return;
    const targetLedger = state[nextLink]?.entries;
    if (!targetLedger) return;
    const matchTime = previous?.createdAt ?? next?.createdAt;
    let counterpart = targetLedger.find(
      (item) => item.linkedSystem === systemKey && item.createdAt === matchTime
    );
    if (!counterpart) {
      createLinkedEntry(nextLink, next, systemKey);
      return;
    }
    counterpart.date = next.date;
    counterpart.direction = next.direction === 'in' ? 'out' : 'in';
    counterpart.amount = next.amount;
    counterpart.description =
      next.description || `Linked transfer from ${SYSTEM_LABELS[systemKey]}`;
    counterpart.category = 'Linked Transfer';
    counterpart.party = SYSTEM_LABELS[systemKey];
    counterpart.notes = next.notes ? `${next.notes} (linked)` : 'Linked transfer';
    counterpart.linkedSystem = systemKey;
    counterpart.liaqatPayment = false;
  }

  function removeLinkedCounterpart(systemKey, entry) {
    if (!entry || !entry.linkedSystem) return;
    const targetKey = entry.linkedSystem;
    const targetLedger = state[targetKey]?.entries;
    if (!targetLedger) return;
    const index = targetLedger.findIndex(
      (item) => item.linkedSystem === systemKey && item.createdAt === entry.createdAt
    );
    if (index === -1) return;
    const [removed] = targetLedger.splice(index, 1);
    syncLiaqatLedger(removed, null);
    adjustDepalpurLiaqat(removed, null);
    if (editingState[targetKey] === removed.id) {
      clearEditing(targetKey);
      resetFormFor(targetKey);
    }
  }

  function syncLiaqatLedger(previous, next) {
    const list = state.personalSavings.liaqatEntries;
    const prevIs = previous && isLiaqat(previous.party);
    const nextIs = next && isLiaqat(next.party);
    const findIndex = (id) => list.findIndex((item) => item.id === id);
    if (prevIs) {
      const idx = findIndex(previous.id);
      if (nextIs) {
        if (idx !== -1) {
          list[idx] = { ...next };
        } else {
          list.push({ ...next });
        }
      } else if (idx !== -1) {
        list.splice(idx, 1);
      }
    } else if (nextIs) {
      const idx = findIndex(next.id);
      if (idx !== -1) {
        list[idx] = { ...next };
      } else {
        list.push({ ...next });
      }
    }
  }

  function adjustDepalpurLiaqat(previous, next) {
    const prevAmount =
      previous && previous.liaqatPayment && previous.direction === 'out'
        ? previous.amount
        : 0;
    const nextAmount =
      next && next.liaqatPayment && next.direction === 'out' ? next.amount : 0;
    state.depalpur.liaqatPayable = round(
      Math.max(0, state.depalpur.liaqatPayable + prevAmount - nextAmount)
    );
  }

  function updateEntry(systemKey, entryId, updates) {
    const ledger = state[systemKey]?.entries;
    if (!ledger) return null;
    const index = ledger.findIndex((item) => item.id === entryId);
    if (index === -1) return null;
    const previous = ledger[index];
    const merged = {
      ...previous,
      ...updates,
      id: previous.id,
      createdAt: previous.createdAt,
      liaqatPayment:
        typeof updates.liaqatPayment === 'boolean'
          ? updates.liaqatPayment
          : previous.liaqatPayment,
    };
    const normalised = normaliseEntry(merged);
    normalised.liaqatPayment = merged.liaqatPayment;
    ledger[index] = normalised;
    syncLinkedEntries(systemKey, previous, normalised);
    syncLiaqatLedger(previous, normalised);
    adjustDepalpurLiaqat(previous, normalised);
    return normalised;
  }

  function removeEntry(systemKey, entryId) {
    const ledger = state[systemKey]?.entries;
    if (!ledger) return null;
    const index = ledger.findIndex((item) => item.id === entryId);
    if (index === -1) return null;
    const [removed] = ledger.splice(index, 1);
    syncLinkedEntries(systemKey, removed, null);
    syncLiaqatLedger(removed, null);
    adjustDepalpurLiaqat(removed, null);
    return removed;
  }

  function computeBalance(entries, opening = 0) {
    return round(
      entries.reduce(
        (acc, entry) => acc + (entry.direction === 'in' ? entry.amount : -entry.amount),
        opening
      )
    );
  }

  function computeLinkedBalance(entries, systemKey) {
    return round(
      entries.reduce((total, entry) => {
        if (entry.linkedSystem !== systemKey) return total;
        return total + (entry.direction === 'in' ? entry.amount : -entry.amount);
      }, 0)
    );
  }

  function computeStockValue() {
    return round(
      state.depalpur.stock.reduce(
        (total, item) => total + (item.action === 'decrease' ? -item.amount : item.amount),
        0
      )
    );
  }

  function outstandingReceivables() {
    return round(
      state.depalpur.receivables.reduce(
        (total, item) => total + (item.collected ? 0 : item.amount),
        0
      )
    );
  }

  function sumByCategory(entries, keyword) {
    const key = keyword.toLowerCase();
    return round(
      entries.reduce((total, entry) => {
        if (entry.direction !== 'out') return total;
        if (!entry.category) return total;
        if (entry.category.toLowerCase().includes(key)) return total + entry.amount;
        return total;
      }, 0)
    );
  }

  function computeLiaqatBalance() {
    return round(
      state.personalSavings.liaqatEntries.reduce(
        (total, entry) => total + (entry.direction === 'out' ? entry.amount : -entry.amount),
        0
      )
    );
  }

  function buildLedgerRows(
    entries,
    filter,
    opening = 0,
    filterField = 'party',
    systemKey = ''
  ) {
    const sorted = entries.slice().sort((a, b) => {
      if (a.date === b.date) return a.createdAt - b.createdAt;
      return a.date.localeCompare(b.date);
    });
    let balance = opening;
    const rows = [];
    sorted.forEach((entry) => {
      const field = filterField || 'party';
      if (filter && entry[field] !== filter) return;
      balance += entry.direction === 'in' ? entry.amount : -entry.amount;
      rows.push({ entry, balance, systemKey });
    });
    return rows;
  }

  function renderLedgerRow({ entry, balance, systemKey }) {
    return `
      <tr data-entry-id="${escapeHtml(entry.id)}" data-system="${escapeHtml(systemKey || '')}">
        <td>${escapeHtml(entry.date)}</td>
        <td>${escapeHtml(entry.description || '-')}</td>
        <td>${escapeHtml(entry.category || '-')}</td>
        <td>${escapeHtml(entry.party || '')}</td>
        <td>${entry.direction === 'in' ? formatMoney(entry.amount) : ''}</td>
        <td>${entry.direction === 'out' ? formatMoney(entry.amount) : ''}</td>
        <td>${formatMoney(balance)}</td>
        <td>${escapeHtml(entry.notes || '')}</td>
        <td>
          <div class="table-actions">
            <button class="ghost-btn" data-edit-entry="${escapeHtml(entry.id)}">Edit</button>
            <button class="ghost-btn danger" data-delete-entry="${escapeHtml(entry.id)}">Delete</button>
          </div>
        </td>
      </tr>`;
  }

  function emptyRow(cols) {
    return `<tr><td colspan="${cols}" style="text-align:center;color:var(--muted);padding:18px;">No data yet</td></tr>`;
  }

  async function exportLedger(systemKey) {
    const tableMap = {
      personalSavings: '#panel-personalSavings .table-wrap',
      gameBusiness: '#panel-gameBusiness .table-wrap',
      depalpur: '#panel-depalpur .table-wrap',
      personalAccount: '#panel-personalAccount .table-wrap',
    };
    const node = document.querySelector(tableMap[systemKey]);
    if (!node) return;
    const { jsPDF } = window.jspdf;
    const canvas = await html2canvas(node, { scale: 2, backgroundColor: '#0b1120' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: 'a4' });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const ratio = Math.min((pageWidth - 40) / canvas.width, (pageHeight - 80) / canvas.height);
    const imgWidth = canvas.width * ratio;
    const imgHeight = canvas.height * ratio;
    pdf.setFontSize(14);
    pdf.text(`${SYSTEM_LABELS[systemKey]} Ledger`, 20, 28);
    pdf.addImage(imgData, 'PNG', 20, 40, imgWidth, imgHeight);
    pdf.save(`${systemKey}-ledger.pdf`);
  }

  function ensureParty(name, systemKey, role) {
    const trimmed = name.trim();
    if (!trimmed) return null;
    let party = state.parties.find((p) => p.name.toLowerCase() === trimmed.toLowerCase());
    if (party) {
      if (!party.systems.includes(systemKey)) party.systems.push(systemKey);
      if (role && party.role === 'other') party.role = role;
    } else {
      party = { id: uuid(), name: trimmed, role: role || 'other', systems: [systemKey], notes: '' };
      state.parties.push(party);
    }
    return party;
  }

  function setToday(selector) {
    const input = $(selector);
    if (input) input.value = today();
  }

  function setDirectionDefault(key) {
    setDirectionValue(key, 'in');
  }

  function setDirectionValue(key, direction) {
    directions[key] = direction === 'out' ? 'out' : 'in';
    $$('.pill[data-target="' + key + '"]').forEach((pill) => {
      pill.classList.toggle('active', pill.dataset.dir === directions[key]);
    });
  }

  function saveAndRefresh() {
    saveState();
    refresh();
  }

  function toAmount(value) {
    const num = Number(value);
    return Number.isFinite(num) && num > 0 ? Math.round(num * 100) / 100 : 0;
  }

  function formatMoney(value) {
    return formatter.format(Math.round(value));
  }

  function today() {
    return new Date().toISOString().slice(0, 10);
  }

  function uuid() {
    return typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : 'id-' + Math.random().toString(16).slice(2, 10);
  }

  function isLiaqat(party) {
    return (party || '').toLowerCase().includes('liaqat');
  }

  function escapeHtml(str) {
    return (str || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function round(num) {
    return Math.round((Number(num) || 0) * 100) / 100;
  }
})();
