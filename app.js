
(function () {
    const STORAGE_KEY = 'multi_system_finance_v1';

    const $ = (selector, ctx = document) => ctx.querySelector(selector);
    const $$ = (selector, ctx = document) => Array.from(ctx.querySelectorAll(selector));

    const DEFAULT_PARTIES = [
        {
            id: 'party-liaqat',
            name: 'Liaqat & Sons',
            role: 'supplier',
            systems: ['personalSavings', 'depalpur'],
            notes: 'Primary karyana supplier with independent receivable.',
        },
        {
            id: 'party-zubair',
            name: 'Zubair Bhai',
            role: 'supplier',
            systems: ['gameBusiness', 'personalSavings'],
            notes: 'Game business credit supplier.',
        },
        {
            id: 'party-nazim',
            name: 'Nazim Ali',
            role: 'worker',
            systems: ['depalpur'],
            notes: 'Depalpur distribution worker.',
        },
    ];

    const DEFAULT_CATEGORIES = [
        {
            id: 'cat-worker-advance',
            name: 'Worker Advance',
            flow: 'expense',
            systems: ['depalpur', 'personalSavings'],
            notes: 'Track worker advances and recoveries.',
        },
        {
            id: 'cat-credit-settlement',
            name: 'Credit Settlement',
            flow: 'expense',
            systems: ['gameBusiness'],
            notes: 'Use when clearing supplier credit balances.',
        },
    ];

    const defaultState = () => ({
        personalSavings: { openingBalance: 1_000_000, entries: [], liaqatReceivable: 0 },
        gameBusiness: { entries: [], equipment: [] },
        depalpur: { entries: [], stock: [], receivables: [], liaqatPayable: 0 },
        personalAccount: { entries: [] },
        directory: {
            parties: DEFAULT_PARTIES.map((party) => ({ ...party, systems: [...party.systems] })),
            categories: DEFAULT_CATEGORIES.map((category) => ({ ...category, systems: [...category.systems] })),
        },
    });

    const state = loadState();

    function loadState() {
        try {
            const raw = window.localStorage.getItem(STORAGE_KEY);
            if (!raw) return defaultState();
            const parsed = JSON.parse(raw);
            const parties = mergeDefaults(
                DEFAULT_PARTIES,
                (parsed.directory?.parties || []).map(normaliseParty)
            );
            const categories = mergeDefaults(
                DEFAULT_CATEGORIES,
                (parsed.directory?.categories || []).map(normaliseCategory)
            );

            return {
                personalSavings: {
                    openingBalance: parsed.personalSavings?.openingBalance ?? 1_000_000,
                    liaqatReceivable: Number(parsed.personalSavings?.liaqatReceivable || 0),
                    entries: (parsed.personalSavings?.entries || []).map(normaliseEntry),
                },
                gameBusiness: {
                    entries: (parsed.gameBusiness?.entries || []).map(normaliseEntry),
                    equipment: parsed.gameBusiness?.equipment || [],
                },
                depalpur: {
                    entries: (parsed.depalpur?.entries || []).map(normaliseEntry),
                    stock: parsed.depalpur?.stock || [],
                    receivables: (parsed.depalpur?.receivables || []).map((item) => ({
                        ...item,
                        collected: !!item.collected,
                    })),
                    liaqatPayable: Number(parsed.depalpur?.liaqatPayable || 0),
                },
                personalAccount: {
                    entries: (parsed.personalAccount?.entries || []).map(normaliseEntry),
                },
                directory: {
                    parties,
                    categories,
                },
            };
        } catch (error) {
            console.error('Failed to parse stored finance data', error);
            return defaultState();
        }
    }

    function normaliseEntry(entry) {
        return {
            id: entry.id || uuid(),
            date: entry.date || today(),
            description: entry.description || '',
            category: entry.category || 'other',
            direction: entry.direction === 'in' ? 'in' : 'out',
            amount: toAmount(entry.amount),
            notes: entry.notes || '',
            party: entry.party || entry.counterparty || '',
            createdAt: entry.createdAt || Date.now(),
            linkedId: entry.linkedId || null,
            counterpartSystem: entry.counterpartSystem || null,
            meta: entry.meta || {},
        };
    }

    function normaliseParty(party) {
        const systems = Array.isArray(party.systems) ? [...new Set(party.systems)] : [];
        return {
            id: party.id || uuid(),
            name: party.name || '',
            role: (party.role || 'other').toLowerCase(),
            systems,
            notes: party.notes || '',
            createdAt: party.createdAt || Date.now(),
        };
    }

    function normaliseCategory(category) {
        const systems = Array.isArray(category.systems) ? [...new Set(category.systems)] : [];
        return {
            id: category.id || uuid(),
            name: category.name || 'Custom Category',
            flow: category.flow === 'income' ? 'income' : 'expense',
            systems,
            notes: category.notes || '',
            createdAt: category.createdAt || Date.now(),
        };
    }

    function mergeDefaults(defaults, existing, key = 'id') {
        const result = [...existing];
        const seen = new Set(result.map((item) => (item[key] || item.name || '').toLowerCase()));
        defaults.forEach((item) => {
            const identifier = (item[key] || item.name || '').toLowerCase();
            if (!seen.has(identifier)) {
                result.push({ ...item, systems: Array.isArray(item.systems) ? [...item.systems] : [] });
                seen.add(identifier);
            }
        });
        return result;
    }

    const SYSTEM_LABELS = {
        personalSavings: 'Personal Savings',
        gameBusiness: 'Game Business',
        depalpur: 'Depalpur Distribution',
        personalAccount: 'Personal Account',
    };

    function formatSystemName(key) {
        return SYSTEM_LABELS[key] || key;
    }

    function capitalise(text) {
        if (!text) return '';
        return text.charAt(0).toUpperCase() + text.slice(1);
    }

    function formatSignedCurrency(value) {
        if (!Number.isFinite(value) || value === 0) return formatCurrency(0);
        return `${value > 0 ? '+' : '-'}${formatCurrency(Math.abs(value))}`;
    }

    function findCustomCategory(value) {
        if (!value || typeof value !== 'string' || !value.startsWith('custom:')) return null;
        const id = value.slice(7);
        return state.directory.categories.find((category) => category.id === id) || null;
    }

    function saveState() {
        window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
        renderAll();
    }

    function uuid() {
        if (window.crypto?.randomUUID) return window.crypto.randomUUID();
        return `id-${Date.now()}-${Math.floor(Math.random() * 1_000_000)}`;
    }

    function today() {
        return new Date().toISOString().slice(0, 10);
    }

    const currency = new Intl.NumberFormat('en-PK', {
        style: 'currency',
        currency: 'PKR',
        minimumFractionDigits: 2,
    });

    function formatCurrency(value) {
        return currency.format(Number.isFinite(value) ? value : 0);
    }

    function formatNumber(value) {
        return Number.isFinite(value) ? value.toFixed(2) : '0.00';
    }

    function toAmount(value) {
        const num = Number(value);
        return Number.isFinite(num) ? Math.abs(num) : 0;
    }

    function sortedEntries(list) {
        return [...list].sort((a, b) => {
            const diff = (a.date || '').localeCompare(b.date || '');
            return diff !== 0 ? diff : (a.createdAt || 0) - (b.createdAt || 0);
        });
    }

    function calculateBalance(entries, opening = 0) {
        return entries.reduce((total, entry) => {
            if (entry.meta?.cashImpact === false) return total;
            return total + (entry.direction === 'in' ? entry.amount : -entry.amount);
        }, opening);
    }

    function escapeHtml(text) {
        return (text || "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch] || ch));
    }

    function isWithinDateRange(date, from, to) {
        if (!date) return !(from || to);
        if (from && date < from) return false;
        if (to && date > to) return false;
        return true;
    }

    function downloadCsv(filename, headers, rows) {
        const toCell = (value) => `"${String(value ?? '').replace(/"/g, '""')}"`;
        const csv = [headers, ...rows].map((row) => row.map(toCell).join(',')).join('\r\n');
        const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
        const link = document.createElement('a');
        link.href = URL.createObjectURL(blob);
        link.download = filename;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(link.href);
    }

    function activateView(viewId) {
        $$('.view').forEach((view) => {
            view.classList.toggle('active', view.id === viewId);
        });
        if (viewId !== 'dashboard') {
            document.body.scrollTo({ top: 0, behavior: 'smooth' });
        }
    }

    // --- Entry helpers ---
    function createEntry(base) {
        return {
            id: base.id || uuid(),
            date: base.date || today(),
            description: base.description || '',
            category: base.category || 'other',
            direction: base.direction === 'in' ? 'in' : 'out',
            amount: toAmount(base.amount),
            notes: base.notes || '',
            party: base.party || base.counterparty || '',
            createdAt: base.createdAt || Date.now(),
            linkedId: base.linkedId || null,
            counterpartSystem: base.counterpartSystem || null,
            meta: { ...(base.meta || {}) },
        };
    }

    function linkEntries(entryA, systemA, entryB, systemB) {
        entryA.linkedId = entryB.id;
        entryA.counterpartSystem = systemB;
        entryB.linkedId = entryA.id;
        entryB.counterpartSystem = systemA;
    }

    // --- Personal Savings ---
    function addPersonalSavingsEntry(payload, opts = {}) {
        const presetDirections = {
            capitalInjection: 'in',
            refund: 'in',
            liaqatRepayment: 'in',
            transferGame: 'out',
            transferDepalpur: 'out',
            transferPersonal: 'out',
            paymentLiaqat: 'out',
            paymentSupplier: 'out',
            liaqatAdvance: 'out',
            other: payload.direction || 'out',
        };
        const categoryInfo = findCustomCategory(payload.category);
        const flowDirection = categoryInfo ? (categoryInfo.flow === 'income' ? 'in' : 'out') : presetDirections[payload.category];
        const entry = createEntry({ ...payload, direction: payload.direction || flowDirection || 'out' });
        entry.meta = { ...(entry.meta || {}) };
        if (!entry.party && ['liaqatAdvance', 'liaqatRepayment', 'paymentLiaqat'].includes(entry.category)) {
            entry.party = 'Liaqat & Sons';
        }
        state.personalSavings.entries.push(entry);

        if (!opts.skipLinked) {
            if (entry.category === 'transferGame' && entry.direction === 'out') {
                const counterpart = addGameEntry({
                    date: entry.date,
                    category: 'transferFromPersonal',
                    direction: 'in',
                    amount: entry.amount,
                    description: entry.description || 'Transfer from Personal Savings',
                    party: 'Personal Savings',
                    notes: entry.notes,
                    linkedId: entry.id,
                    counterpartSystem: 'personalSavings',
                }, { skipLinked: true, silent: true });
                linkEntries(entry, 'personalSavings', counterpart, 'gameBusiness');
            }
            if (entry.category === 'transferDepalpur' && entry.direction === 'out') {
                const counterpart = addDepalpurEntry({
                    date: entry.date,
                    category: 'transferFromPersonal',
                    direction: 'in',
                    amount: entry.amount,
                    description: entry.description || 'Transfer from Personal Savings',
                    party: 'Personal Savings',
                    notes: entry.notes,
                    linkedId: entry.id,
                    counterpartSystem: 'personalSavings',
                }, { skipLinked: true, silent: true });
                linkEntries(entry, 'personalSavings', counterpart, 'depalpur');
            }
            if (entry.category === 'transferPersonal' && entry.direction === 'out') {
                const counterpart = addPersonalAccountEntry({
                    date: entry.date,
                    category: 'drawSavings',
                    direction: 'in',
                    amount: entry.amount,
                    description: entry.description || 'Transfer from Personal Savings',
                    notes: entry.notes,
                    treatAsSalary: true,
                    linkedId: entry.id,
                    counterpartSystem: 'personalSavings',
                }, { skipLinked: true, silent: true });
                linkEntries(entry, 'personalSavings', counterpart, 'personalAccount');
            }
            if (entry.category === 'paymentSupplier' && entry.direction === 'out' && entry.meta?.supplierSystem) {
                if (entry.meta.supplierSystem === 'gameBusiness') {
                    const counterpart = addGameEntry({
                        date: entry.date,
                        category: 'supplierSettlement',
                        direction: 'out',
                        amount: entry.amount,
                        description: entry.description || 'Supplier settlement funded by Personal Savings',
                        party: entry.party,
                        notes: entry.notes,
                        meta: { settledBy: 'personalSavings', cashImpact: false },
                        linkedId: entry.id,
                        counterpartSystem: 'personalSavings',
                    }, { skipLinked: true, silent: true });
                    linkEntries(entry, 'personalSavings', counterpart, 'gameBusiness');
                }
                if (entry.meta.supplierSystem === 'depalpur') {
                    const counterpart = addDepalpurEntry({
                        date: entry.date,
                        category: 'supplierPayment',
                        direction: 'out',
                        amount: entry.amount,
                        description: entry.description || 'Supplier payment funded by Personal Savings',
                        party: entry.party,
                        notes: entry.notes,
                        meta: { settledBy: 'personalSavings', cashImpact: false },
                        linkedId: entry.id,
                        counterpartSystem: 'personalSavings',
                    }, { skipLinked: true, silent: true });
                    linkEntries(entry, 'personalSavings', counterpart, 'depalpur');
                }
            }
        }

        if (entry.category === 'paymentLiaqat' && entry.direction === 'out' && !opts.skipAdjust) {
            state.depalpur.liaqatPayable = Math.max(0, state.depalpur.liaqatPayable - entry.amount);
            entry.meta.liaqatImpact = -entry.amount;
        }

        if (!opts.skipAdjust) {
            let liaqatDelta = 0;
            if (entry.category === 'liaqatAdvance' && entry.direction === 'out') liaqatDelta = entry.amount;
            if (entry.category === 'liaqatRepayment' && entry.direction === 'in') liaqatDelta = -entry.amount;
            if (entry.category === 'paymentSupplier' && entry.direction === 'out' && entry.meta?.reduceLiaqat) liaqatDelta = -entry.amount;
            if (liaqatDelta !== 0) {
                const current = Number(state.personalSavings.liaqatReceivable || 0);
                const tentative = current + liaqatDelta;
                const applied = tentative < 0 ? -current : liaqatDelta;
                state.personalSavings.liaqatReceivable = Math.max(0, current + applied);
                entry.meta.liaqatReceivableImpact = applied;
            }
        }

        if (!opts.silent) saveState();
        return entry;
    }

    function removePersonalSavingsEntry(entry, opts = {}) {
        state.personalSavings.entries = state.personalSavings.entries.filter((item) => item.id !== entry.id);
        if (entry.meta?.liaqatImpact && !opts.skipAdjust) {
            state.depalpur.liaqatPayable += entry.amount;
        }
        if (entry.meta?.liaqatReceivableImpact && !opts.skipAdjust) {
            const current = Number(state.personalSavings.liaqatReceivable || 0);
            state.personalSavings.liaqatReceivable = Math.max(0, current - entry.meta.liaqatReceivableImpact);
        }
        if (!opts.skipLinked && entry.linkedId && entry.counterpartSystem) {
            deleteEntry(entry.counterpartSystem, entry.linkedId, { skipLinked: true, silent: true });
        }
    }

    // --- Game Business ---
    function addGameEntry(payload, opts = {}) {
        const autoFlow = {
            membership: 'expense',
            mPurchase: 'expense',
            equipment: 'expense',
            otherExpense: 'expense',
            transferToPersonalAccount: 'expense',
            transferToPersonalSavings: 'expense',
            sales: 'income',
            otherIncome: 'income',
            transferFromPersonal: 'income',
            transferFromPersonalAccount: 'income',
            supplierSettlement: 'expense',
        };
        const category = payload.category || 'otherExpense';
        const custom = findCustomCategory(category);
        const flowType = payload.flow || (custom ? custom.flow : autoFlow[category]);
        const direction = payload.direction || (flowType === 'income' ? 'in' : 'out');
        const entry = createEntry({ ...payload, category, direction });
        state.gameBusiness.entries.push(entry);

        if (category === 'equipment') {
            state.gameBusiness.equipment.push({
                id: uuid(),
                entryId: entry.id,
                date: entry.date,
                name: payload.equipmentName || payload.description || 'Equipment',
                amount: entry.amount,
                notes: entry.notes || '',
            });
        }

        if (category === 'mPurchase') {
            entry.meta.totalM = toAmount(payload.totalM);
            entry.meta.pricePerM = toAmount(payload.pricePerM);
        }

        if (!opts.skipLinked) {
            if (category === 'transferFromPersonal' && entry.direction === 'in') {
                const counterpart = addPersonalSavingsEntry({
                    date: entry.date,
                    category: 'transferGame',
                    direction: 'out',
                    amount: entry.amount,
                    description: entry.description || 'Transfer to Game Business',
                    counterparty: entry.party || 'Game Business',
                    notes: entry.notes,
                    linkedId: entry.id,
                    counterpartSystem: 'gameBusiness',
                }, { skipLinked: true, silent: true });
                linkEntries(entry, 'gameBusiness', counterpart, 'personalSavings');
            }
            if (category === 'transferFromPersonalAccount' && entry.direction === 'in') {
                const counterpart = addPersonalAccountEntry({
                    date: entry.date,
                    category: 'repayGame',
                    direction: 'out',
                    amount: entry.amount,
                    description: entry.description || 'Transfer to Game Business',
                    notes: entry.notes,
                    treatAsSalary: true,
                    linkedId: entry.id,
                    counterpartSystem: 'gameBusiness',
                }, { skipLinked: true, silent: true });
                linkEntries(entry, 'gameBusiness', counterpart, 'personalAccount');
            }
            if (category === 'transferToPersonalAccount' && entry.direction === 'out') {
                const counterpart = addPersonalAccountEntry({
                    date: entry.date,
                    category: 'drawGame',
                    direction: 'in',
                    amount: entry.amount,
                    description: entry.description || 'Personal draw from Game Business',
                    notes: entry.notes,
                    treatAsSalary: !!entry.meta.treatedAsSalary,
                    linkedId: entry.id,
                    counterpartSystem: 'gameBusiness',
                }, { skipLinked: true, silent: true });
                linkEntries(entry, 'gameBusiness', counterpart, 'personalAccount');
            }
            if (category === 'transferToPersonalSavings' && entry.direction === 'out') {
                const counterpart = addPersonalSavingsEntry({
                    date: entry.date,
                    category: 'refund',
                    direction: 'in',
                    amount: entry.amount,
                    description: entry.description || 'Transfer from Game Business',
                    counterparty: 'Game Business',
                    notes: entry.notes,
                    linkedId: entry.id,
                    counterpartSystem: 'gameBusiness',
                }, { skipLinked: true, silent: true });
                linkEntries(entry, 'gameBusiness', counterpart, 'personalSavings');
            }
        }

        if (!opts.silent) saveState();
        return entry;
    }

    function removeGameEntry(entry, opts = {}) {
        state.gameBusiness.entries = state.gameBusiness.entries.filter((item) => item.id !== entry.id);
        if (entry.category === 'equipment') {
            state.gameBusiness.equipment = state.gameBusiness.equipment.filter((eq) => eq.entryId !== entry.id);
        }
        if (!opts.skipLinked && entry.linkedId && entry.counterpartSystem) {
            deleteEntry(entry.counterpartSystem, entry.linkedId, { skipLinked: true, silent: true });
        }
    }

    // --- Depalpur ---
    function addDepalpurEntry(payload, opts = {}) {
        const autoFlow = {
            supplierPayment: 'expense',
            stockPurchase: 'expense',
            receivableCollection: 'income',
            transferToPersonalAccount: 'expense',
            transferToPersonalSavings: 'expense',
            transferFromPersonal: 'income',
            transferFromPersonalAccount: 'income',
        };
        const category = payload.category || 'other';
        const custom = findCustomCategory(category);
        const flowType = payload.flow || (custom ? custom.flow : autoFlow[category]);
        const direction = payload.direction || (flowType === 'income' ? 'in' : 'out');
        const entry = createEntry({ ...payload, category, direction });
        state.depalpur.entries.push(entry);

        if (payload.liaqatPayment && entry.direction === 'out' && !opts.skipAdjust) {
            state.depalpur.liaqatPayable = Math.max(0, state.depalpur.liaqatPayable - entry.amount);
            entry.meta.liaqatPayment = true;
        }
        if (payload.receivableId) {
            entry.meta.receivableId = payload.receivableId;
        }

        if (!opts.skipLinked) {
            if (category === 'transferFromPersonal' && entry.direction === 'in') {
                const counterpart = addPersonalSavingsEntry({
                    date: entry.date,
                    category: 'transferDepalpur',
                    direction: 'out',
                    amount: entry.amount,
                    description: entry.description || 'Transfer to Depalpur Distribution',
                    counterparty: entry.party || 'Depalpur Distribution',
                    notes: entry.notes,
                    linkedId: entry.id,
                    counterpartSystem: 'depalpur',
                }, { skipLinked: true, silent: true });
                linkEntries(entry, 'depalpur', counterpart, 'personalSavings');
            }
            if (category === 'transferFromPersonalAccount' && entry.direction === 'in') {
                const counterpart = addPersonalAccountEntry({
                    date: entry.date,
                    category: 'repayDepalpur',
                    direction: 'out',
                    amount: entry.amount,
                    description: entry.description || 'Transfer to Depalpur Distribution',
                    notes: entry.notes,
                    treatAsSalary: true,
                    linkedId: entry.id,
                    counterpartSystem: 'depalpur',
                }, { skipLinked: true, silent: true });
                linkEntries(entry, 'depalpur', counterpart, 'personalAccount');
            }
            if (category === 'transferToPersonalAccount' && entry.direction === 'out') {
                const counterpart = addPersonalAccountEntry({
                    date: entry.date,
                    category: 'drawDepalpur',
                    direction: 'in',
                    amount: entry.amount,
                    description: entry.description || 'Personal draw from Depalpur',
                    notes: entry.notes,
                    treatAsSalary: !!entry.meta.treatedAsSalary,
                    linkedId: entry.id,
                    counterpartSystem: 'depalpur',
                }, { skipLinked: true, silent: true });
                linkEntries(entry, 'depalpur', counterpart, 'personalAccount');
            }
            if (category === 'transferToPersonalSavings' && entry.direction === 'out') {
                const counterpart = addPersonalSavingsEntry({
                    date: entry.date,
                    category: 'refund',
                    direction: 'in',
                    amount: entry.amount,
                    description: entry.description || 'Transfer from Depalpur Distribution',
                    counterparty: 'Depalpur Distribution',
                    notes: entry.notes,
                    linkedId: entry.id,
                    counterpartSystem: 'depalpur',
                }, { skipLinked: true, silent: true });
                linkEntries(entry, 'depalpur', counterpart, 'personalSavings');
            }
        }

        if (!opts.silent) saveState();
        return entry;
    }

    function removeDepalpurEntry(entry, opts = {}) {
        state.depalpur.entries = state.depalpur.entries.filter((item) => item.id !== entry.id);
        if (entry.meta?.liaqatPayment && entry.direction === 'out' && !opts.skipAdjust) {
            state.depalpur.liaqatPayable += entry.amount;
        }
        if (!opts.skipLinked && entry.linkedId && entry.counterpartSystem) {
            deleteEntry(entry.counterpartSystem, entry.linkedId, { skipLinked: true, silent: true });
        }
    }

    function addStockEntry(payload) {
        state.depalpur.stock.push({
            id: uuid(),
            date: payload.date || today(),
            description: payload.description || '',
            direction: payload.direction === 'decrease' ? 'decrease' : 'increase',
            value: toAmount(payload.value),
            createdAt: Date.now(),
        });
        saveState();
    }

    function removeStockEntry(id) {
        state.depalpur.stock = state.depalpur.stock.filter((entry) => entry.id !== id);
        saveState();
    }

    function addReceivable(payload) {
        state.depalpur.receivables.push({
            id: uuid(),
            date: payload.date || today(),
            customer: payload.customer || '',
            amount: toAmount(payload.amount),
            notes: payload.notes || '',
            collected: false,
            createdAt: Date.now(),
            collectionEntryId: null,
        });
        saveState();
    }

    function removeReceivable(entry, opts = {}) {
        state.depalpur.receivables = state.depalpur.receivables.filter((item) => item.id !== entry.id);
        if (!opts.skipLinked && entry.collectionEntryId) {
            deleteEntry('depalpur', entry.collectionEntryId, { skipLinked: true, silent: true });
        }
        saveState();
    }

    function collectReceivable(id) {
        const receivable = state.depalpur.receivables.find((item) => item.id === id);
        if (!receivable || receivable.collected) return;
        receivable.collected = true;
        const cashEntry = addDepalpurEntry({
            date: today(),
            category: 'receivableCollection',
            direction: 'in',
            amount: receivable.amount,
            description: `Collection from ${receivable.customer}`,
            party: receivable.customer,
            notes: receivable.notes,
            receivableId: receivable.id,
        }, { skipLinked: true, silent: true });
        receivable.collectionEntryId = cashEntry.id;
        saveState();
    }

    // --- Personal Account ---
    function addPersonalAccountEntry(payload, opts = {}) {
        const autoDirection = {
            salary: 'in',
            drawGame: 'in',
            drawDepalpur: 'in',
            drawSavings: 'in',
            repayGame: 'out',
            repayDepalpur: 'out',
            repaySavings: 'out',
            expense: 'out',
            transferToSavings: 'out',
        };
        const category = payload.category || 'other';
        const custom = findCustomCategory(category);
        const inferred = custom ? (custom.flow === 'income' ? 'in' : 'out') : autoDirection[category];
        const direction = payload.direction || inferred || 'out';
        const entry = createEntry({ ...payload, category, direction });
        state.personalAccount.entries.push(entry);

        const treatAsSalary = !!payload.treatAsSalary;
        if (category === 'drawGame') entry.meta = { loanSystem: 'game', loanType: treatAsSalary ? 'salary' : 'borrow' };
        if (category === 'drawDepalpur') entry.meta = { loanSystem: 'depalpur', loanType: treatAsSalary ? 'salary' : 'borrow' };
        if (category === 'drawSavings') entry.meta = { loanSystem: 'savings', loanType: treatAsSalary ? 'salary' : 'borrow' };
        if (category === 'repayGame') entry.meta = { loanSystem: 'game', loanType: 'repay' };
        if (category === 'repayDepalpur') entry.meta = { loanSystem: 'depalpur', loanType: 'repay' };
        if (category === 'repaySavings') entry.meta = { loanSystem: 'savings', loanType: 'repay' };

        if (!opts.skipLinked) {
            if (category === 'drawGame' && entry.direction === 'in') {
                const counterpart = addGameEntry({
                    date: entry.date,
                    category: 'transferToPersonalAccount',
                    direction: 'out',
                    amount: entry.amount,
                    description: entry.description || 'Personal draw',
                    party: 'Owner',
                    notes: entry.notes,
                    meta: { treatedAsSalary: treatAsSalary },
                    linkedId: entry.id,
                    counterpartSystem: 'personalAccount',
                }, { skipLinked: true, silent: true });
                linkEntries(entry, 'personalAccount', counterpart, 'gameBusiness');
            }
            if (category === 'drawDepalpur' && entry.direction === 'in') {
                const counterpart = addDepalpurEntry({
                    date: entry.date,
                    category: 'transferToPersonalAccount',
                    direction: 'out',
                    amount: entry.amount,
                    description: entry.description || 'Personal draw',
                    party: 'Owner',
                    notes: entry.notes,
                    meta: { treatedAsSalary: treatAsSalary },
                    linkedId: entry.id,
                    counterpartSystem: 'personalAccount',
                }, { skipLinked: true, silent: true });
                linkEntries(entry, 'personalAccount', counterpart, 'depalpur');
            }
            if (category === 'drawSavings' && entry.direction === 'in') {
                const counterpart = addPersonalSavingsEntry({
                    date: entry.date,
                    category: 'transferPersonal',
                    direction: 'out',
                    amount: entry.amount,
                    description: entry.description || 'Personal account draw',
                    counterparty: 'Personal Account',
                    notes: entry.notes,
                    linkedId: entry.id,
                    counterpartSystem: 'personalAccount',
                }, { skipLinked: true, silent: true });
                linkEntries(entry, 'personalAccount', counterpart, 'personalSavings');
            }
            if (category === 'repayGame' && entry.direction === 'out') {
                const counterpart = addGameEntry({
                    date: entry.date,
                    category: 'transferFromPersonalAccount',
                    direction: 'in',
                    amount: entry.amount,
                    description: entry.description || 'Personal repayment',
                    party: 'Owner',
                    notes: entry.notes,
                    linkedId: entry.id,
                    counterpartSystem: 'personalAccount',
                }, { skipLinked: true, silent: true });
                linkEntries(entry, 'personalAccount', counterpart, 'gameBusiness');
            }
            if (category === 'repayDepalpur' && entry.direction === 'out') {
                const counterpart = addDepalpurEntry({
                    date: entry.date,
                    category: 'transferFromPersonalAccount',
                    direction: 'in',
                    amount: entry.amount,
                    description: entry.description || 'Personal repayment',
                    party: 'Owner',
                    notes: entry.notes,
                    linkedId: entry.id,
                    counterpartSystem: 'personalAccount',
                }, { skipLinked: true, silent: true });
                linkEntries(entry, 'personalAccount', counterpart, 'depalpur');
            }
            if (category === 'repaySavings' && entry.direction === 'out') {
                const counterpart = addPersonalSavingsEntry({
                    date: entry.date,
                    category: 'refund',
                    direction: 'in',
                    amount: entry.amount,
                    description: entry.description || 'Return to Personal Savings',
                    counterparty: 'Personal Account',
                    notes: entry.notes,
                    linkedId: entry.id,
                    counterpartSystem: 'personalAccount',
                }, { skipLinked: true, silent: true });
                linkEntries(entry, 'personalAccount', counterpart, 'personalSavings');
            }
            if (category === 'transferToSavings' && entry.direction === 'out') {
                const counterpart = addPersonalSavingsEntry({
                    date: entry.date,
                    category: 'refund',
                    direction: 'in',
                    amount: entry.amount,
                    description: entry.description || 'Transfer from Personal Account',
                    counterparty: 'Personal Account',
                    notes: entry.notes,
                    linkedId: entry.id,
                    counterpartSystem: 'personalAccount',
                }, { skipLinked: true, silent: true });
                linkEntries(entry, 'personalAccount', counterpart, 'personalSavings');
            }
        }

        if (!opts.silent) saveState();
        return entry;
    }

    function removePersonalAccountEntry(entry, opts = {}) {
        state.personalAccount.entries = state.personalAccount.entries.filter((item) => item.id !== entry.id);
        if (!opts.skipLinked && entry.linkedId && entry.counterpartSystem) {
            deleteEntry(entry.counterpartSystem, entry.linkedId, { skipLinked: true, silent: true });
        }
    }

    function deleteEntry(system, id, opts = {}) {
        let entry;
        if (system === 'personalSavings') {
            entry = state.personalSavings.entries.find((item) => item.id === id);
            if (entry) removePersonalSavingsEntry(entry, opts);
        }
        if (system === 'gameBusiness') {
            entry = state.gameBusiness.entries.find((item) => item.id === id);
            if (entry) removeGameEntry(entry, opts);
        }
        if (system === 'depalpur') {
            entry = state.depalpur.entries.find((item) => item.id === id);
            if (entry) removeDepalpurEntry(entry, opts);
        }
        if (system === 'personalAccount') {
            entry = state.personalAccount.entries.find((item) => item.id === id);
            if (entry) removePersonalAccountEntry(entry, opts);
        }
        if (!opts.silent) saveState();
    }

    // --- Rendering ---
    function renderSummary() {
        const personalBalance = calculateBalance(state.personalSavings.entries, state.personalSavings.openingBalance);
        const transfersOut = state.personalSavings.entries
            .filter((entry) => entry.direction === 'out' && ['transferGame', 'transferDepalpur', 'transferPersonal'].includes(entry.category))
            .reduce((total, entry) => total + entry.amount, 0);

        $('#summaryPersonalSavings').textContent = formatCurrency(personalBalance);
        $('#tilePersonalSavings').textContent = formatCurrency(personalBalance);
        $('#personalSavingsBalance').textContent = formatCurrency(personalBalance);
        $('#personalSavingsTransfers').textContent = formatCurrency(transfersOut);
        $('#personalSavingsLiaqat').textContent = formatCurrency(state.personalSavings.liaqatReceivable || 0);

        const gameBalance = calculateBalance(state.gameBusiness.entries);
        const membershipSpend = state.gameBusiness.entries
            .filter((entry) => entry.category === 'membership')
            .reduce((total, entry) => total + entry.amount, 0);
        const equipmentValue = state.gameBusiness.equipment.reduce((total, item) => total + (Number(item.amount) || 0), 0);

        $('#summaryGameBusiness').textContent = formatCurrency(gameBalance);
        $('#tileGameBusiness').textContent = formatCurrency(gameBalance);
        $('#gameCashBalance').textContent = formatCurrency(gameBalance);
        $('#gameEquipmentValue').textContent = formatCurrency(equipmentValue);
        $('#gameMembershipSpend').textContent = formatCurrency(membershipSpend);

        const depalpurCash = calculateBalance(state.depalpur.entries);
        const stockValue = state.depalpur.stock.reduce((total, entry) => total + (entry.direction === 'increase' ? entry.value : -entry.value), 0);
        const receivablesOutstanding = state.depalpur.receivables.filter((r) => !r.collected).reduce((total, r) => total + r.amount, 0);
        const liaqat = state.depalpur.liaqatPayable;
        const net = depalpurCash + stockValue + receivablesOutstanding;

        $('#summaryDepalpur').textContent = formatCurrency(net);
        $('#tileDepalpur').textContent = formatCurrency(net);
        $('#depalpurCashBalance').textContent = formatCurrency(depalpurCash);
        $('#depalpurStockValue').textContent = formatCurrency(stockValue);
        $('#depalpurReceivables').textContent = formatCurrency(receivablesOutstanding);
        $('#depalpurLiaqat').textContent = formatCurrency(liaqat);
        $('#depalpurNet').textContent = formatCurrency(net);

        const personalAccountBalance = calculateBalance(state.personalAccount.entries);
        $('#summaryPersonalAccount').textContent = formatCurrency(personalAccountBalance);
        $('#tilePersonalAccount').textContent = formatCurrency(personalAccountBalance);
        $('#personalAccountBalance').textContent = formatCurrency(personalAccountBalance);
        $('#owedGame').textContent = formatCurrency(computeOutstanding('game'));
        $('#owedDepalpur').textContent = formatCurrency(computeOutstanding('depalpur'));
        $('#owedSavings').textContent = formatCurrency(computeOutstanding('savings'));
    }

    function computeOutstanding(systemKey) {
        return state.personalAccount.entries.reduce((total, entry) => {
            if (entry.meta?.loanSystem !== systemKey) return total;
            if (entry.meta.loanType === 'borrow') return total + entry.amount;
            if (entry.meta.loanType === 'repay') return total - entry.amount;
            return total;
        }, 0);
    }

    function renderPersonalSavingsTable() {
        const tbody = $('#personalSavingsTable');
        tbody.innerHTML = '';
        let balance = state.personalSavings.openingBalance;
        sortedEntries(state.personalSavings.entries).forEach((entry) => {
            balance += entry.direction === 'in' ? entry.amount : -entry.amount;
            const metaNotes = [];
            if (entry.meta?.supplierSystem) metaNotes.push(`Linked: ${formatSystemName(entry.meta.supplierSystem)}`);
            if (entry.meta?.reduceLiaqat && entry.direction === 'out') metaNotes.push('Reduced Liaqat receivable');
            if (entry.meta?.liaqatReceivableImpact) metaNotes.push(`Receivable ${formatSignedCurrency(entry.meta.liaqatReceivableImpact)}`);
            const noteText = [entry.notes, metaNotes.join(' • ')].filter(Boolean).join(' — ');
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${entry.date}</td>
                <td>${escapeHtml(entry.description)}</td>
                <td>${escapeHtml(formatLabel(entry.category))}</td>
                <td>${escapeHtml(entry.party)}</td>
                <td>${entry.direction === 'in' ? formatCurrency(entry.amount) : ''}</td>
                <td>${entry.direction === 'out' ? formatCurrency(entry.amount) : ''}</td>
                <td>${formatCurrency(balance)}</td>
                <td>${escapeHtml(noteText)}</td>
                <td><button class="action-btn" data-action="delete" data-system="personalSavings" data-id="${entry.id}">Delete</button></td>
            `;
            tbody.appendChild(tr);
        });

        const breakdown = state.personalSavings.entries.reduce((acc, entry) => {
            const key = formatLabel(entry.category);
            const val = entry.direction === 'out' ? -entry.amount : entry.amount;
            acc[key] = (acc[key] || 0) + val;
            return acc;
        }, {});
        const list = $('#personalSavingsBreakdown');
        list.innerHTML = '';
        Object.entries(breakdown)
            .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
            .forEach(([label, value]) => {
                const li = document.createElement('li');
                li.innerHTML = `<span>${escapeHtml(label)}</span><span>${formatCurrency(value)}</span>`;
                list.appendChild(li);
            });

        renderSupplierOptions(
            'personalParties',
            ['Liaqat & Sons', 'Zubair Bhai'],
            state.personalSavings.entries.map((entry) => entry.party),
            'personalSavings',
            null
        );
    }

    function renderGameTables() {
        const tbody = $('#gameLedgerTable');
        tbody.innerHTML = '';
        let balance = 0;
        sortedEntries(state.gameBusiness.entries).forEach((entry) => {
            const affectsCash = entry.meta?.cashImpact !== false;
            if (affectsCash) {
                balance += entry.direction === 'in' ? entry.amount : -entry.amount;
            }
            const detailParts = [];
            if (entry.category === 'mPurchase' && (entry.meta.totalM || entry.meta.pricePerM)) {
                detailParts.push(`${entry.meta.totalM || 0} M @ ${formatCurrency(entry.meta.pricePerM || 0)}`);
            }
            if (entry.meta?.settledBy) {
                detailParts.push(`Settled via ${formatSystemName(entry.meta.settledBy)}`);
            }
            if (!affectsCash) {
                detailParts.push('No cash impact');
            }
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${entry.date}</td>
                <td>${escapeHtml(entry.description)}</td>
                <td>${escapeHtml(formatLabel(entry.category))}</td>
                <td>${escapeHtml(entry.party)}</td>
                <td>${entry.direction === 'in' ? formatCurrency(entry.amount) : ''}</td>
                <td>${entry.direction === 'out' ? formatCurrency(entry.amount) : ''}</td>
                <td>${formatCurrency(balance)}</td>
                <td>${escapeHtml([entry.notes, detailParts.join(' • ')].filter(Boolean).join(' — '))}</td>
                <td><button class="action-btn" data-action="delete" data-system="gameBusiness" data-id="${entry.id}">Delete</button></td>
            `;
            tbody.appendChild(tr);
        });

        const equipmentBody = $('#equipmentTable');
        equipmentBody.innerHTML = '';
        state.gameBusiness.equipment
            .slice()
            .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
            .forEach((item) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${item.date || ''}</td>
                    <td>${escapeHtml(item.name)}</td>
                    <td>${formatCurrency(item.amount)}</td>
                    <td>${escapeHtml(item.notes || '')}</td>
                `;
                equipmentBody.appendChild(tr);
            });

        renderSupplierOptions('gameSuppliers', ['Zubair Bhai'], state.gameBusiness.entries.map((entry) => entry.party), 'gameBusiness');
    }

    function getDepalpurFilterRange() {
        const fromInput = $('#depalpurFilterFrom');
        const toInput = $('#depalpurFilterTo');
        let from = fromInput ? fromInput.value : '';
        let to = toInput ? toInput.value : '';
        if (from && to && from > to) {
            const temp = from;
            from = to;
            to = temp;
            if (fromInput) fromInput.value = from;
            if (toInput) toInput.value = to;
        }
        return { from, to };
    }

    function computeDepalpurOpening(entries, from) {
        if (!from) return 0;
        return entries.reduce((total, entry) => {
            if (!entry.date || entry.date >= from) return total;
            if (entry.meta?.cashImpact === false) return total;
            return total + (entry.direction === 'in' ? entry.amount : -entry.amount);
        }, 0);
    }

    function getDepalpurLedgerData(range = getDepalpurFilterRange()) {
        const list = sortedEntries(state.depalpur.entries);
        const opening = computeDepalpurOpening(list, range.from);
        const entries = list.filter((entry) => isWithinDateRange(entry.date, range.from, range.to));
        return { entries, opening, ...range };
    }

    function buildDepalpurNotes(entry) {
        const noteParts = [];
        if (entry.notes) noteParts.push(entry.notes);
        const extras = [];
        if (entry.meta?.liaqatPayment) extras.push('Liaqat payable');
        if (entry.meta?.settledBy) extras.push(`Settled via ${formatSystemName(entry.meta.settledBy)}`);
        if (entry.meta?.cashImpact === false) extras.push('No cash impact');
        if (extras.length) noteParts.push(extras.join(' • '));
        return noteParts.join(' — ');
    }

    function renderDepalpurTables() {
        const tbody = $('#depalpurCashTable');
        tbody.innerHTML = '';
        const range = getDepalpurLedgerData();
        let balance = range.opening;
        const note = $('#depalpurRangeNote');
        if (note) {
            if (range.from || range.to) {
                const parts = [];
                if (range.from) parts.push(`from ${range.from}`);
                if (range.to) parts.push(`to ${range.to}`);
                const rangeText = parts.length ? parts.join(' ') : 'for selected range';
                const openingText = range.from ? ` · Opening balance before range: ${formatCurrency(range.opening)}` : '';
                note.textContent = `Showing entries ${rangeText}${openingText}`;
            } else {
                note.textContent = '';
            }
        }
        range.entries.forEach((entry) => {
            const affectsCash = entry.meta?.cashImpact !== false;
            if (affectsCash) {
                balance += entry.direction === 'in' ? entry.amount : -entry.amount;
            }
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${entry.date}</td>
                <td>${escapeHtml(entry.description)}</td>
                <td>${escapeHtml(formatLabel(entry.category))}</td>
                <td>${escapeHtml(entry.party)}</td>
                <td>${entry.direction === 'in' ? formatCurrency(entry.amount) : ''}</td>
                <td>${entry.direction === 'out' ? formatCurrency(entry.amount) : ''}</td>
                <td>${formatCurrency(balance)}</td>
                <td>${escapeHtml(buildDepalpurNotes(entry))}</td>
                <td><button class="action-btn" data-action="delete" data-system="depalpur" data-id="${entry.id}">Delete</button></td>
            `;
            tbody.appendChild(tr);
        });

        if (!tbody.children.length) {
            const tr = document.createElement('tr');
            tr.innerHTML = '<td colspan="9" class="table-empty">No cash movements recorded for this range.</td>';
            tbody.appendChild(tr);
        }

        const stockBody = $('#depalpurStockTable');
        stockBody.innerHTML = '';
        state.depalpur.stock
            .slice()
            .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
            .forEach((entry) => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${entry.date}</td>
                    <td>${escapeHtml(entry.description)}</td>
                    <td>${entry.direction === 'increase' ? 'Increase' : 'Decrease'}</td>
                    <td>${formatCurrency(entry.value)}</td>
                    <td><button class="action-btn" data-action="delete-stock" data-id="${entry.id}">Delete</button></td>
                `;
                stockBody.appendChild(tr);
            });

        const receivableBody = $('#depalpurReceivableTable');
        receivableBody.innerHTML = '';
        state.depalpur.receivables
            .slice()
            .sort((a, b) => (a.date || '').localeCompare(b.date || ''))
            .forEach((entry) => {
                const status = entry.collected ? 'Collected' : 'Outstanding';
                const badge = entry.collected ? 'good' : 'warn';
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${entry.date}</td>
                    <td>${escapeHtml(entry.customer)}</td>
                    <td>${formatCurrency(entry.amount)}</td>
                    <td><span class="status-pill ${badge}">${status}</span></td>
                    <td>${escapeHtml(entry.notes)}</td>
                    <td>
                        <div class="table-actions">
                            ${entry.collected ? '' : `<button class="action-btn" data-action="collect" data-id="${entry.id}">Mark collected</button>`}
                            <button class="action-btn" data-action="delete-receivable" data-id="${entry.id}">Delete</button>
                        </div>
                    </td>
                `;
                receivableBody.appendChild(tr);
            });

        const partyBody = $('#depalpurPartyTable');
        if (partyBody) {
            partyBody.innerHTML = '';
            const balances = computePartyBalances();
            const directoryMap = new Map(
                state.directory.parties.map((party) => [party.name.toLowerCase(), party])
            );
            const rows = Object.entries(balances)
                .map(([name, breakdown]) => ({ name, amount: breakdown.depalpur || 0 }))
                .filter(({ amount }) => Math.abs(amount) >= 0.01)
                .sort((a, b) => Math.abs(b.amount) - Math.abs(a.amount));

            if (!rows.length) {
                const tr = document.createElement('tr');
                tr.innerHTML = '<td colspan="4" class="hint">No outstanding supplier, worker, or customer balances.</td>';
                partyBody.appendChild(tr);
            } else {
                rows.forEach(({ name, amount }) => {
                    const party = directoryMap.get(name.toLowerCase());
                    const role = party ? capitalise(party.role) : '—';
                    const status = amount > 0 ? 'Owes Depalpur' : amount < 0 ? 'Depalpur owes' : 'Settled';
                    const cls = amount < 0 ? 'negative-text' : amount > 0 ? 'positive-text' : '';
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${escapeHtml(name)}</td>
                        <td>${escapeHtml(role)}</td>
                        <td class="${cls}">${formatSignedCurrency(amount)}</td>
                        <td>${status}</td>
                    `;
                    partyBody.appendChild(tr);
                });
            }
        }

        renderSupplierOptions(
            'depalpurSuppliers',
            ['Kehkashan Mehndi', 'Olympia Chemical', 'Liaqat & Sons'],
            state.depalpur.entries.map((entry) => entry.party),
            'depalpur',
            null
        );
    }

    function renderPersonalAccountTable() {
        const tbody = $('#personalAccountTable');
        tbody.innerHTML = '';
        let balance = 0;
        sortedEntries(state.personalAccount.entries).forEach((entry) => {
            balance += entry.direction === 'in' ? entry.amount : -entry.amount;
            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td>${entry.date}</td>
                <td>${escapeHtml(entry.description)}</td>
                <td>${escapeHtml(formatLabel(entry.category))}</td>
                <td>${entry.direction === 'in' ? formatCurrency(entry.amount) : ''}</td>
                <td>${entry.direction === 'out' ? formatCurrency(entry.amount) : ''}</td>
                <td>${formatCurrency(balance)}</td>
                <td>${escapeHtml(entry.notes)}</td>
                <td><button class="action-btn" data-action="delete" data-system="personalAccount" data-id="${entry.id}">Delete</button></td>
            `;
            tbody.appendChild(tr);
        });
    }

    function renderSupplierOptions(id, defaults, values, systemKey, roleFilter = ['supplier']) {
        const datalist = document.getElementById(id);
        if (!datalist) return;
        const set = new Set(defaults);
        values.filter(Boolean).forEach((value) => set.add(value));
        state.directory.parties
            .filter((party) => {
                if (!roleFilter) return true;
                return roleFilter.includes(party.role);
            })
            .filter((party) => {
                if (!systemKey) return true;
                return party.systems.length === 0 || party.systems.includes(systemKey);
            })
            .forEach((party) => set.add(party.name));

        datalist.innerHTML = '';
        Array.from(set)
            .filter(Boolean)
            .sort((a, b) => a.localeCompare(b))
            .forEach((value) => {
                const option = document.createElement('option');
                option.value = value;
                datalist.appendChild(option);
            });
    }

    function computePartyBalances() {
        const init = () => ({ personalSavings: 0, gameBusiness: 0, depalpur: 0, personalAccount: 0 });
        const balances = {};
        const adjust = (systemKey, entry) => {
            const name = (entry.party || '').trim();
            if (!name) return;
            if (systemKey === 'personalSavings' && entry.meta?.liaqatReceivableImpact) return;
            const record = (balances[name] = balances[name] || init());
            const delta = entry.direction === 'out' ? entry.amount : -entry.amount;
            record[systemKey] += delta;
        };
        state.personalSavings.entries.forEach((entry) => adjust('personalSavings', entry));
        state.gameBusiness.entries.forEach((entry) => adjust('gameBusiness', entry));
        state.depalpur.entries.forEach((entry) => adjust('depalpur', entry));
        state.personalAccount.entries.forEach((entry) => adjust('personalAccount', entry));
        if (state.personalSavings.liaqatReceivable) {
            const record = (balances['Liaqat & Sons'] = balances['Liaqat & Sons'] || init());
            record.personalSavings += state.personalSavings.liaqatReceivable;
        }
        return balances;
    }

    function applyCustomCategoryOptions() {
        const configs = [
            { system: 'personalSavings', selector: '#personalSavingsForm select[name="category"]' },
            { system: 'gameBusiness', selector: '#gameEntryForm select[name="category"]' },
            { system: 'depalpur', selector: '#depalpurCashForm select[name="category"]' },
            { system: 'personalAccount', selector: '#personalAccountForm select[name="category"]' },
        ];
        configs.forEach(({ system, selector }) => {
            const select = document.querySelector(selector);
            if (!select) return;
            select.querySelectorAll('option[data-custom-option="true"]').forEach((option) => option.remove());
            state.directory.categories
                .filter((category) => category.systems.length === 0 || category.systems.includes(system))
                .forEach((category) => {
                    const option = document.createElement('option');
                    option.value = `custom:${category.id}`;
                    option.textContent = category.name;
                    option.dataset.customOption = 'true';
                    option.dataset.flow = category.flow;
                    select.appendChild(option);
                });
            if (select.dataset.autoUpdate === 'true') {
                select.dispatchEvent(new Event('change'));
            }
        });
    }

    function renderDirectorySection() {
        const partyTable = $('#directoryPartyTable');
        const categoryTable = $('#directoryCategoryTable');
        const tile = $('#tileDirectory');
        if (tile) {
            const partyCount = state.directory.parties.length;
            const categoryCount = state.directory.categories.length;
            tile.textContent = categoryCount
                ? `${partyCount} parties · ${categoryCount} categories`
                : `${partyCount} parties`;
        }
        if (!partyTable && !categoryTable) return;

        const balances = computePartyBalances();

        if (partyTable) {
            partyTable.innerHTML = '';
            const parties = state.directory.parties.slice().sort((a, b) => a.name.localeCompare(b.name));
            if (!parties.length) {
                const emptyRow = document.createElement('tr');
                emptyRow.innerHTML = '<td colspan="6" class="hint">No parties saved yet.</td>';
                partyTable.appendChild(emptyRow);
            } else {
                parties.forEach((party) => {
                    const systemsList = party.systems.length ? party.systems : Object.keys(SYSTEM_LABELS);
                    const partyBalances = balances[party.name] || {};
                    const chips = Object.keys(SYSTEM_LABELS)
                        .map((system) => {
                            const amount = partyBalances[system] || 0;
                            if (Math.abs(amount) < 0.009) return '';
                            const cls = amount < 0 ? 'negative' : '';
                            return `<span class="balance-chip ${cls}">${formatSystemName(system)} ${formatSignedCurrency(amount)}</span>`;
                        })
                        .filter(Boolean)
                        .join('');
                    const balanceHtml = chips || '<span class="hint">No activity yet</span>';
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${escapeHtml(party.name)}</td>
                        <td>${escapeHtml(capitalise(party.role))}</td>
                        <td>${escapeHtml(systemsList.map(formatSystemName).join(', '))}</td>
                        <td>${balanceHtml}</td>
                        <td>${escapeHtml(party.notes || '')}</td>
                        <td><button class="action-btn" data-action="delete-party" data-id="${party.id}">Delete</button></td>
                    `;
                    partyTable.appendChild(tr);
                });
            }
        }

        if (categoryTable) {
            categoryTable.innerHTML = '';
            const categories = state.directory.categories.slice().sort((a, b) => a.name.localeCompare(b.name));
            if (!categories.length) {
                const emptyRow = document.createElement('tr');
                emptyRow.innerHTML = '<td colspan="5" class="hint">No custom categories yet.</td>';
                categoryTable.appendChild(emptyRow);
            } else {
                categories.forEach((category) => {
                    const systemsList = category.systems.length ? category.systems : Object.keys(SYSTEM_LABELS);
                    const tr = document.createElement('tr');
                    tr.innerHTML = `
                        <td>${escapeHtml(category.name)}</td>
                        <td>${escapeHtml(capitalise(category.flow))}</td>
                        <td>${escapeHtml(systemsList.map(formatSystemName).join(', '))}</td>
                        <td>${escapeHtml(category.notes || '')}</td>
                        <td><button class="action-btn" data-action="delete-category" data-id="${category.id}">Delete</button></td>
                    `;
                    categoryTable.appendChild(tr);
                });
            }
        }
    }

    function formatLabel(key) {
        if (typeof key === 'string' && key.startsWith('custom:')) {
            const custom = findCustomCategory(key);
            return custom ? custom.name : key;
        }
        const labels = {
            capitalInjection: 'Capital Injection',
            transferGame: 'Transfer to Game Business',
            transferDepalpur: 'Transfer to Depalpur Distribution',
            transferPersonal: 'Transfer to Personal Account',
            paymentLiaqat: 'Payment to Liaqat & Sons',
            paymentSupplier: 'Supplier Payment',
            liaqatAdvance: 'Advance to Liaqat & Sons',
            liaqatRepayment: 'Repayment from Liaqat & Sons',
            refund: 'Income / Refund',
            other: 'Other Expense',
            membership: 'Membership Cost',
            mPurchase: 'M Purchase',
            equipment: 'Computer Equipment',
            otherExpense: 'Other Expense',
            sales: 'Sales Income',
            otherIncome: 'Other Income',
            transferFromPersonal: 'Transfer from Personal Savings',
            transferFromPersonalAccount: 'Transfer from Personal Account',
            transferToPersonalAccount: 'Transfer to Personal Account',
            transferToPersonalSavings: 'Transfer to Personal Savings',
            supplierSettlement: 'Supplier Settlement',
            supplierPayment: 'Supplier Payment',
            stockPurchase: 'Stock Purchase',
            receivableCollection: 'Receivable Collection',
            drawGame: 'Draw from Game Business',
            drawDepalpur: 'Draw from Depalpur Distribution',
            drawSavings: 'Draw from Personal Savings',
            repayGame: 'Repay Game Business',
            repayDepalpur: 'Repay Depalpur Distribution',
            repaySavings: 'Repay Personal Savings',
            expense: 'Personal Expense',
            transferToSavings: 'Transfer to Personal Savings',
            salary: 'Salary / Income',
        };
        return labels[key] || key;
    }

    function renderAll() {
        applyCustomCategoryOptions();
        renderSummary();
        renderPersonalSavingsTable();
        renderGameTables();
        renderDepalpurTables();
        renderPersonalAccountTable();
        renderDirectorySection();
    }

    // --- Forms & events ---
    function bindNavigation() {
        $$('#dashboard .system-tile').forEach((button) => {
            button.addEventListener('click', () => activateView(`view-${button.dataset.target}`));
        });
        $$('.back-button').forEach((button) => {
            button.addEventListener('click', () => activateView('dashboard'));
        });
    }

    function bindPersonalSavingsForm() {
        const form = $('#personalSavingsForm');
        const categorySelect = form.querySelector('[name="category"]');
        const directionSelect = form.querySelector('[name="direction"]');
        const supplierRouting = form.querySelector('.supplier-routing');
        const reduceWrap = supplierRouting?.querySelector('.reduce-liaqat');
        categorySelect.dataset.autoUpdate = 'true';

        const presetDirections = {
            capitalInjection: 'in',
            refund: 'in',
            liaqatRepayment: 'in',
            transferGame: 'out',
            transferDepalpur: 'out',
            transferPersonal: 'out',
            paymentLiaqat: 'out',
            paymentSupplier: 'out',
            liaqatAdvance: 'out',
        };

        const updateVisibility = () => {
            const category = categorySelect.value;
            const option = categorySelect.selectedOptions[0];
            const flow = option?.dataset.flow;
            const preset = presetDirections[category];
            if (preset) {
                directionSelect.value = preset;
                directionSelect.disabled = true;
            } else if (flow) {
                directionSelect.value = flow === 'income' ? 'in' : 'out';
                directionSelect.disabled = true;
            } else {
                directionSelect.disabled = false;
            }
            if (supplierRouting) {
                const show = category === 'paymentSupplier';
                supplierRouting.classList.toggle('show', show);
                if (reduceWrap) {
                    reduceWrap.style.display = show && directionSelect.value === 'out' ? 'flex' : 'none';
                }
            }
        };

        categorySelect.addEventListener('change', updateVisibility);
        directionSelect.addEventListener('change', () => {
            if (supplierRouting && supplierRouting.classList.contains('show') && reduceWrap) {
                reduceWrap.style.display = directionSelect.value === 'out' ? 'flex' : 'none';
            }
        });
        updateVisibility();

        form.addEventListener('submit', (event) => {
            event.preventDefault();
            const data = new FormData(form);
            const amount = toAmount(data.get('amount'));
            if (!amount) {
                alert('Enter a valid amount');
                return;
            }
            const category = data.get('category');
            let counterparty = data.get('counterparty');
            if (!counterparty && ['liaqatAdvance', 'liaqatRepayment', 'paymentLiaqat'].includes(category)) {
                counterparty = 'Liaqat & Sons';
            }
            const meta = {};
            if (category === 'paymentSupplier') {
                meta.supplierSystem = data.get('supplierSystem') || null;
                meta.reduceLiaqat = data.get('reduceLiaqat') === 'on';
                if (!meta.supplierSystem) delete meta.supplierSystem;
            }
            addPersonalSavingsEntry({
                date: data.get('date') || today(),
                description: data.get('description'),
                category,
                counterparty,
                direction: data.get('direction'),
                amount,
                notes: data.get('notes'),
                meta,
            });
            form.reset();
            form.querySelector('[name="date"]').value = today();
            updateVisibility();
        });

        const quickForm = $('#liaqatReceivableForm');
        if (quickForm) {
            quickForm.addEventListener('submit', (event) => {
                event.preventDefault();
                const data = new FormData(quickForm);
                const amount = toAmount(data.get('amount'));
                if (!amount) {
                    alert('Enter a valid amount');
                    return;
                }
                const action = data.get('action');
                const category = action === 'repayment' ? 'liaqatRepayment' : 'liaqatAdvance';
                const direction = action === 'repayment' ? 'in' : 'out';
                addPersonalSavingsEntry({
                    date: data.get('date') || today(),
                    description: action === 'repayment' ? 'Liaqat & Sons repayment' : 'Advance to Liaqat & Sons',
                    category,
                    counterparty: 'Liaqat & Sons',
                    direction,
                    amount,
                    notes: data.get('notes'),
                });
                quickForm.reset();
                quickForm.querySelector('[name="date"]').value = today();
            });
        }
    }

    function bindGameForm() {
        const form = $('#gameEntryForm');
        const categorySelect = form.querySelector('[name="category"]');
        const flowSelect = form.querySelector('[name="flow"]');
        const supplierField = form.querySelector('.supplier-field');
        const mFields = form.querySelectorAll('.m-field');
        const equipmentField = form.querySelector('.equipment-field');
        const amountInput = form.querySelector('[name="amount"]');
        const totalMInput = form.querySelector('[name="totalM"]');
        const pricePerMInput = form.querySelector('[name="pricePerM"]');
        categorySelect.dataset.autoUpdate = 'true';

        const updateVisibility = () => {
            const category = categorySelect.value;
            const selected = categorySelect.selectedOptions[0];
            const customFlow = selected?.dataset.flow;
            const incomeCategories = ['sales', 'otherIncome', 'transferFromPersonal', 'transferFromPersonalAccount'];
            if (customFlow) {
                flowSelect.value = customFlow;
            } else {
                flowSelect.value = incomeCategories.includes(category) ? 'income' : 'expense';
            }
            supplierField.style.display = flowSelect.value === 'expense' ? '' : 'none';
            mFields.forEach((el) => {
                el.style.display = category === 'mPurchase' ? '' : 'none';
            });
            equipmentField.style.display = category === 'equipment' ? '' : 'none';
        };

        const updateAmountFromM = () => {
            if (categorySelect.value !== 'mPurchase') return;
            const totalM = toAmount(totalMInput.value);
            const pricePerM = toAmount(pricePerMInput.value);
            if (totalM && pricePerM) {
                amountInput.value = (totalM * pricePerM).toFixed(2);
            }
        };

        categorySelect.addEventListener('change', updateVisibility);
        totalMInput.addEventListener('input', updateAmountFromM);
        pricePerMInput.addEventListener('input', updateAmountFromM);
        updateVisibility();

        form.addEventListener('submit', (event) => {
            event.preventDefault();
            const data = new FormData(form);
            const amount = toAmount(data.get('amount'));
            if (!amount) {
                alert('Enter a valid amount');
                return;
            }
            addGameEntry({
                date: data.get('date') || today(),
                category: data.get('category'),
                flow: data.get('flow'),
                amount,
                description: data.get('description'),
                party: data.get('supplier'),
                notes: data.get('notes'),
                totalM: data.get('totalM'),
                pricePerM: data.get('pricePerM'),
                equipmentName: data.get('equipmentName'),
            });
            form.reset();
            form.querySelector('[name="date"]').value = today();
            updateVisibility();
        });
    }

    function bindDepalpurForms() {
        const cashForm = $('#depalpurCashForm');
        const categorySelect = cashForm.querySelector('[name="category"]');
        const flowSelect = cashForm.querySelector('[name="flow"]');
        const liaqatToggle = cashForm.querySelector('[name="liaqatPayment"]');
        categorySelect.dataset.autoUpdate = 'true';

        const updateFlow = () => {
            const map = {
                supplierPayment: 'expense',
                stockPurchase: 'expense',
                receivableCollection: 'income',
                transferFromPersonal: 'income',
                transferFromPersonalAccount: 'income',
                transferToPersonalAccount: 'expense',
                transferToPersonalSavings: 'expense',
            };
            const category = categorySelect.value;
            const selected = categorySelect.selectedOptions[0];
            const customFlow = selected?.dataset.flow;
            const flow = customFlow || map[category];
            if (flow) {
                flowSelect.value = flow;
                flowSelect.disabled = true;
            } else {
                flowSelect.disabled = false;
            }
            liaqatToggle.parentElement.style.display = category === 'supplierPayment' ? 'flex' : '';
        };
        categorySelect.addEventListener('change', updateFlow);
        updateFlow();

        cashForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const data = new FormData(cashForm);
            const amount = toAmount(data.get('amount'));
            if (!amount) {
                alert('Enter a valid amount');
                return;
            }
            addDepalpurEntry({
                date: data.get('date') || today(),
                category: data.get('category'),
                flow: data.get('flow'),
                amount,
                description: data.get('description'),
                party: data.get('party'),
                notes: data.get('notes'),
                liaqatPayment: data.get('liaqatPayment') === 'on',
            });
            cashForm.reset();
            cashForm.querySelector('[name="date"]').value = today();
            updateFlow();
        });

        const stockForm = $('#depalpurStockForm');
        stockForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const data = new FormData(stockForm);
            const value = toAmount(data.get('value'));
            if (!value) {
                alert('Enter a valid value');
                return;
            }
            addStockEntry({
                date: data.get('date') || today(),
                description: data.get('description'),
                direction: data.get('direction'),
                value,
            });
            stockForm.reset();
            stockForm.querySelector('[name="date"]').value = today();
        });

        const receivableForm = $('#depalpurReceivableForm');
        receivableForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const data = new FormData(receivableForm);
            const amount = toAmount(data.get('amount'));
            if (!amount) {
                alert('Enter a valid amount');
                return;
            }
            addReceivable({
                date: data.get('date') || today(),
                customer: data.get('customer'),
                amount,
                notes: data.get('notes'),
            });
            receivableForm.reset();
            receivableForm.querySelector('[name="date"]').value = today();
        });

        const liaqatForm = $('#liaqatForm');
        liaqatForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const data = new FormData(liaqatForm);
            const amount = toAmount(data.get('amount'));
            if (!amount) {
                alert('Enter a valid amount');
                return;
            }
            if (data.get('action') === 'increase') {
                state.depalpur.liaqatPayable += amount;
            } else {
                state.depalpur.liaqatPayable = Math.max(0, state.depalpur.liaqatPayable - amount);
            }
            saveState();
            liaqatForm.reset();
        });
    }

    function bindDepalpurFilters() {
        const fromInput = $('#depalpurFilterFrom');
        const toInput = $('#depalpurFilterTo');
        const clearButton = $('#depalpurFilterClear');
        const exportButton = $('#depalpurExportCsv');

        const handleChange = () => {
            if (fromInput && toInput && fromInput.value && toInput.value && fromInput.value > toInput.value) {
                const temp = fromInput.value;
                fromInput.value = toInput.value;
                toInput.value = temp;
            }
            renderDepalpurTables();
        };

        if (fromInput) fromInput.addEventListener('change', handleChange);
        if (toInput) toInput.addEventListener('change', handleChange);

        if (clearButton) {
            clearButton.addEventListener('click', () => {
                if (fromInput) fromInput.value = '';
                if (toInput) toInput.value = '';
                renderDepalpurTables();
            });
        }

        if (exportButton) {
            exportButton.addEventListener('click', () => {
                const data = getDepalpurLedgerData();
                if (!data.entries.length) {
                    alert('No entries in the selected range to export.');
                    return;
                }
                let balance = data.opening;
                const rows = data.entries.map((entry) => {
                    if (entry.meta?.cashImpact !== false) {
                        balance += entry.direction === 'in' ? entry.amount : -entry.amount;
                    }
                    return [
                        entry.date,
                        entry.description || '',
                        formatLabel(entry.category),
                        entry.party || '',
                        entry.direction === 'in' ? formatNumber(entry.amount) : '',
                        entry.direction === 'out' ? formatNumber(entry.amount) : '',
                        formatNumber(balance),
                        buildDepalpurNotes(entry),
                    ];
                });
                downloadCsv(
                    `depalpur_cash_ledger_${today()}.csv`,
                    ['Date', 'Description', 'Category', 'Party', 'Inflow', 'Outflow', 'Balance', 'Notes'],
                    rows
                );
            });
        }
    }

    function bindPersonalAccountForm() {
        const form = $('#personalAccountForm');
        const categorySelect = form.querySelector('[name="category"]');
        const directionSelect = form.querySelector('[name="direction"]');
        const salaryToggle = form.querySelector('[name="treatAsSalary"]').closest('.checkbox-field');
        categorySelect.dataset.autoUpdate = 'true';

        const updateDirection = () => {
            const defaults = {
                salary: 'in',
                drawGame: 'in',
                drawDepalpur: 'in',
                drawSavings: 'in',
                repayGame: 'out',
                repayDepalpur: 'out',
                repaySavings: 'out',
                expense: 'out',
                transferToSavings: 'out',
            };
            const category = categorySelect.value;
            const selected = categorySelect.selectedOptions[0];
            const customFlow = selected?.dataset.flow;
            let preset = defaults[category];
            if (customFlow) preset = customFlow === 'income' ? 'in' : 'out';
            directionSelect.disabled = !!preset;
            if (preset) directionSelect.value = preset;
            const showSalaryToggle = ['drawGame', 'drawDepalpur', 'drawSavings'].includes(category) && !customFlow;
            salaryToggle.style.display = showSalaryToggle ? 'flex' : 'none';
        };
        categorySelect.addEventListener('change', updateDirection);
        updateDirection();

        form.addEventListener('submit', (event) => {
            event.preventDefault();
            const data = new FormData(form);
            const amount = toAmount(data.get('amount'));
            if (!amount) {
                alert('Enter a valid amount');
                return;
            }
            addPersonalAccountEntry({
                date: data.get('date') || today(),
                category: data.get('category'),
                direction: data.get('direction'),
                amount,
                description: data.get('description'),
                notes: data.get('notes'),
                treatAsSalary: data.get('treatAsSalary') === 'on',
            });
            form.reset();
            form.querySelector('[name="date"]').value = today();
            updateDirection();
        });
    }

    function bindDirectoryForms() {
        const partyForm = $('#directoryPartyForm');
        if (partyForm) {
            partyForm.addEventListener('submit', (event) => {
                event.preventDefault();
                const data = new FormData(partyForm);
                const name = (data.get('name') || '').trim();
                if (!name) {
                    alert('Enter a party name');
                    return;
                }
                if (state.directory.parties.some((party) => party.name.toLowerCase() === name.toLowerCase())) {
                    alert('Party already exists.');
                    return;
                }
                const systems = Array.from(partyForm.querySelectorAll('input[name="systems"]:checked')).map((input) => input.value);
                state.directory.parties.push({
                    id: uuid(),
                    name,
                    role: (data.get('role') || 'other').toLowerCase(),
                    systems,
                    notes: (data.get('notes') || '').trim(),
                    createdAt: Date.now(),
                });
                saveState();
                partyForm.reset();
                partyForm.querySelector('input[name="name"]').focus();
            });
        }

        const partyTable = $('#directoryPartyTable');
        if (partyTable) {
            partyTable.addEventListener('click', (event) => {
                const button = event.target.closest('button[data-action="delete-party"]');
                if (!button) return;
                const id = button.dataset.id;
                const party = state.directory.parties.find((item) => item.id === id);
                if (!party) return;
                if (confirm(`Remove ${party.name} from the directory?`)) {
                    state.directory.parties = state.directory.parties.filter((item) => item.id !== id);
                    saveState();
                }
            });
        }

        const categoryForm = $('#directoryCategoryForm');
        if (categoryForm) {
            categoryForm.addEventListener('submit', (event) => {
                event.preventDefault();
                const data = new FormData(categoryForm);
                const name = (data.get('name') || '').trim();
                if (!name) {
                    alert('Enter a category name');
                    return;
                }
                if (state.directory.categories.some((category) => category.name.toLowerCase() === name.toLowerCase())) {
                    alert('Category already exists.');
                    return;
                }
                const systems = Array.from(categoryForm.querySelectorAll('input[name="systems"]:checked')).map((input) => input.value);
                state.directory.categories.push({
                    id: uuid(),
                    name,
                    flow: data.get('flow') === 'income' ? 'income' : 'expense',
                    systems,
                    notes: (data.get('notes') || '').trim(),
                    createdAt: Date.now(),
                });
                saveState();
                categoryForm.reset();
                categoryForm.querySelector('input[name="name"]').focus();
            });
        }

        const categoryTable = $('#directoryCategoryTable');
        if (categoryTable) {
            categoryTable.addEventListener('click', (event) => {
                const button = event.target.closest('button[data-action="delete-category"]');
                if (!button) return;
                const id = button.dataset.id;
                const category = state.directory.categories.find((item) => item.id === id);
                if (!category) return;
                const inUse = state.personalSavings.entries
                    .concat(state.gameBusiness.entries, state.depalpur.entries, state.personalAccount.entries)
                    .some((entry) => entry.category === `custom:${id}`);
                if (inUse) {
                    if (!confirm('Entries use this category. Delete anyway?')) return;
                } else if (!confirm(`Remove category ${category.name}?`)) {
                    return;
                }
                state.directory.categories = state.directory.categories.filter((item) => item.id !== id);
                saveState();
            });
        }
    }

    function bindTableActions() {
        document.body.addEventListener('click', (event) => {
            const button = event.target.closest('button.action-btn');
            if (!button) return;
            const action = button.dataset.action;
            if (action === 'delete') {
                const system = button.dataset.system;
                const id = button.dataset.id;
                if (confirm('Delete this entry?')) {
                    deleteEntry(system, id);
                }
            }
            if (action === 'delete-stock') {
                if (confirm('Delete this stock movement?')) {
                    removeStockEntry(button.dataset.id);
                }
            }
            if (action === 'collect') {
                collectReceivable(button.dataset.id);
            }
            if (action === 'delete-receivable') {
                const receivable = state.depalpur.receivables.find((item) => item.id === button.dataset.id);
                if (!receivable) return;
                if (confirm('Delete this receivable?')) {
                    removeReceivable(receivable);
                }
            }
        });
    }

    function setInitialDates() {
        $$('input[type="date"]').forEach((input) => {
            if (input.dataset.keepEmpty === 'true') return;
            if (!input.value) input.value = today();
        });
    }

    function renderOnLoad() {
        bindNavigation();
        bindPersonalSavingsForm();
        bindGameForm();
        bindDepalpurForms();
        bindDepalpurFilters();
        bindPersonalAccountForm();
        bindDirectoryForms();
        bindTableActions();
        setInitialDates();
        renderAll();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', renderOnLoad);
    } else {
        renderOnLoad();
    }
})();
