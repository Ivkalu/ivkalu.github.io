// Shared expenses: who paid what, and the fewest transfers that make everyone
// spend the same. Amounts are kept in cents. Saved in localStorage.
(() => {
  const STORAGE_KEY = 'ivkalu-troskovi-v1';
  const $ = (id) => document.getElementById(id);

  let state = { people: [], expenses: [], nextId: 1 };
  try {
    state = { ...state, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
  } catch {
    // start fresh
  }
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // works without storage, just isn't remembered
    }
  }

  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const money = (cents) => {
    const sign = cents < 0 ? '−' : '';
    const abs = Math.abs(cents);
    const euros = Math.floor(abs / 100).toString().replace(/\B(?=(\d{3})+(?!\d))/g, '.');
    return `${sign}${euros},${String(abs % 100).padStart(2, '0')} €`;
  };
  const parseMoney = (text) => {
    const clean = String(text).replace(/\s|€/g, '').replace(/\.(?=\d{3}(\D|$))/g, '').replace(',', '.');
    if (!/^\d+(\.\d{0,2})?$/.test(clean)) return NaN;
    return Math.round(parseFloat(clean) * 100);
  };
  const nameOf = (id) => (state.people.find((p) => p.id === id) || { name: '?' }).name;

  // Each person's part of an expense. Leftover cents go to the first people in the list.
  function shares(expense) {
    const ids = state.people.map((p) => p.id).filter((id) => expense.for.includes(id));
    const base = Math.floor(expense.amount / ids.length);
    let extra = expense.amount - base * ids.length;
    const result = {};
    for (const id of ids) {
      result[id] = base + (extra > 0 ? 1 : 0);
      if (extra > 0) extra--;
    }
    return result;
  }

  function balances() {
    const rows = Object.fromEntries(state.people.map((p) => [p.id, { paid: 0, spent: 0 }]));
    for (const e of state.expenses) {
      if (rows[e.payer]) rows[e.payer].paid += e.amount;
      for (const [id, part] of Object.entries(shares(e))) rows[id].spent += part;
    }
    return rows;
  }

  // ---------- form ----------

  let editingId = null;
  let forWhom = null; // ids selected for the expense being entered; null = everyone

  function selectedFor() {
    return forWhom === null ? state.people.map((p) => p.id) : forWhom;
  }

  function renderForm() {
    const payer = $('payer');
    const current = payer.value;
    payer.innerHTML = state.people.map((p) => `<option value="${p.id}">${escapeHtml(p.name)}</option>`).join('');
    if (state.people.some((p) => String(p.id) === current)) payer.value = current;
    const chosen = selectedFor();
    $('forWhom').innerHTML = state.people
      .map((p) => `<button type="button" class="chip ${chosen.includes(p.id) ? 'on' : ''}" data-id="${p.id}">${escapeHtml(p.name)}</button>`)
      .join('');
    $('expenseCard').hidden = state.people.length < 2;
    $('expenseTitle').textContent = editingId ? 'Uredi trošak' : 'Novi trošak';
    $('saveExpense').textContent = editingId ? 'Spremi' : 'Dodaj trošak';
    $('cancelEdit').hidden = !editingId;
  }

  function resetForm() {
    editingId = null;
    forWhom = null;
    $('amount').value = '';
    $('desc').value = '';
    $('expenseError').textContent = '';
    renderForm();
  }

  // ---------- rendering ----------

  function render() {
    save();
    $('people').innerHTML = state.people.length
      ? state.people.map((p) => `<button type="button" class="chip" data-remove="${p.id}" aria-label="Makni ${escapeHtml(p.name)}">${escapeHtml(p.name)} ✕</button>`).join('')
      : '<p class="muted small" style="margin:0 0 6px">Dodaj barem dvije osobe.</p>';
    renderForm();

    const rows = balances();
    const total = state.expenses.reduce((a, e) => a + e.amount, 0);
    $('totalSpent').textContent = total ? `· ukupno ${money(total)}` : '';
    $('balances').innerHTML = state.people.map((p) => {
      const r = rows[p.id];
      const diff = r.paid - r.spent;
      return `<tr><td>${escapeHtml(p.name)}</td><td>${money(r.paid)}</td><td>${money(r.spent)}</td>
        <td class="${diff > 0 ? 'plus' : diff < 0 ? 'minus' : ''}">${diff > 0 ? '+' : ''}${money(diff)}</td></tr>`;
    }).join('');

    const byName = {};
    for (const p of state.people) byName[p.id] = rows[p.id].paid - rows[p.id].spent;
    const transfers = settle(byName);
    $('transfers').innerHTML = transfers.length
      ? transfers.map((t) => `<div class="transfer"><span>${escapeHtml(nameOf(Number(t.from)))}</span><span class="arrow">→</span>
          <span>${escapeHtml(nameOf(Number(t.to)))}</span><span class="amount">${money(t.amount)}</span></div>`).join('')
      : `<p class="muted" style="margin:0">${state.expenses.length ? 'Svi su kvit. 🎉' : 'Još nema troškova.'}</p>`;
    $('copyButton').hidden = transfers.length === 0;
    $('resultCard').hidden = state.people.length < 2;
    lastTransfers = transfers;

    $('expenses').innerHTML = state.expenses.length
      ? [...state.expenses].reverse().map((e) => {
          const everyone = e.for.length === state.people.length;
          return `<div class="expense" data-edit="${e.id}">
            <div class="what"><strong>${escapeHtml(e.desc || 'Trošak')}</strong>
              <span class="muted small">${escapeHtml(nameOf(e.payer))} platio/la · ${everyone ? 'svi' : e.for.map(nameOf).map(escapeHtml).join(', ')}</span></div>
            <span class="amount">${money(e.amount)}</span>
            <button type="button" class="btn danger" data-delete="${e.id}" aria-label="Obriši">✕</button></div>`;
        }).join('')
      : '<p class="muted small" style="margin:0">Ništa još.</p>';
  }
  let lastTransfers = [];

  // ---------- events ----------

  $('personForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const name = $('personName').value.trim();
    if (!name) return;
    if (state.people.some((p) => p.name.toLowerCase() === name.toLowerCase())) {
      alert('To ime već postoji.');
      return;
    }
    const id = state.nextId++;
    state.people.push({ id, name });
    if (forWhom !== null) forWhom.push(id);
    $('personName').value = '';
    render();
    $('personName').focus();
  });

  $('people').addEventListener('click', (e) => {
    const b = e.target.closest('[data-remove]');
    if (!b) return;
    const id = Number(b.dataset.remove);
    if (state.expenses.some((x) => x.payer === id || x.for.includes(id))) {
      alert(`${nameOf(id)} ima troškove na popisu. Prvo obriši ili promijeni te troškove.`);
      return;
    }
    state.people = state.people.filter((p) => p.id !== id);
    if (forWhom !== null) forWhom = forWhom.filter((x) => x !== id);
    render();
  });

  $('forWhom').addEventListener('click', (e) => {
    const b = e.target.closest('[data-id]');
    if (!b) return;
    const id = Number(b.dataset.id);
    const chosen = selectedFor();
    forWhom = chosen.includes(id) ? chosen.filter((x) => x !== id) : [...chosen, id];
    renderForm();
  });
  $('allFor').addEventListener('click', () => {
    forWhom = null;
    renderForm();
  });

  $('expenseForm').addEventListener('submit', (e) => {
    e.preventDefault();
    const amount = parseMoney($('amount').value);
    const error = $('expenseError');
    if (!(amount > 0)) return void (error.textContent = 'Upiši iznos, npr. 23,50.');
    const chosen = selectedFor();
    if (!chosen.length) return void (error.textContent = 'Odaberi barem jednu osobu na koju se dijeli.');
    const expense = { payer: Number($('payer').value), amount, desc: $('desc').value.trim(), for: [...chosen] };
    if (editingId) {
      Object.assign(state.expenses.find((x) => x.id === editingId), expense);
    } else {
      state.expenses.push({ id: state.nextId++, ...expense });
    }
    resetForm();
    render();
  });
  $('cancelEdit').addEventListener('click', resetForm);

  $('expenses').addEventListener('click', (e) => {
    const del = e.target.closest('[data-delete]');
    if (del) {
      const id = Number(del.dataset.delete);
      const x = state.expenses.find((ex) => ex.id === id);
      if (confirm(`Obrisati „${x.desc || 'Trošak'}” (${money(x.amount)})?`)) {
        state.expenses = state.expenses.filter((ex) => ex.id !== id);
        if (editingId === id) resetForm();
        render();
      }
      return;
    }
    const row = e.target.closest('[data-edit]');
    if (!row) return;
    const x = state.expenses.find((ex) => ex.id === Number(row.dataset.edit));
    editingId = x.id;
    forWhom = [...x.for];
    $('payer').value = x.payer;
    $('amount').value = (x.amount / 100).toFixed(2).replace('.', ',');
    $('desc').value = x.desc;
    renderForm();
    $('payer').value = String(x.payer);
    $('expenseCard').scrollIntoView({ behavior: 'smooth', block: 'start' });
  });

  $('copyButton').addEventListener('click', async () => {
    const total = state.expenses.reduce((a, e) => a + e.amount, 0);
    const text = [`Troškovi, ukupno ${money(total)}:`, ...lastTransfers.map((t) => `${nameOf(Number(t.from))} → ${nameOf(Number(t.to))}: ${money(t.amount)}`)].join('\n');
    try {
      await navigator.clipboard.writeText(text);
      $('copyButton').textContent = 'Kopirano ✓';
      setTimeout(() => { $('copyButton').textContent = 'Kopiraj za poruku'; }, 1500);
    } catch {
      prompt('Kopiraj ovaj tekst:', text);
    }
  });

  $('resetButton').addEventListener('click', () => {
    if (!state.expenses.length && !state.people.length) return;
    const keepPeople = confirm('Obrisati sve troškove?\n\nOK = obriši troškove (ekipa ostaje)\nOdustani = ne briši ništa');
    if (!keepPeople) return;
    state.expenses = [];
    resetForm();
    render();
  });

  render();
})();
