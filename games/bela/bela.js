// Bela score counter. Everything is kept in localStorage, so the score
// survives a locked screen, a reload or a phone restart.
(() => {
  const STORAGE_KEY = 'ivkalu-bela-v1';
  const HAND_POINTS = 162;   // card points (152) + last trick (10)
  const STIGLJA_BONUS = 90;  // all tricks
  const ZVANJA = [
    { value: 20, label: '20' },
    { value: 50, label: '50' },
    { value: 100, label: '100' },
    { value: 150, label: '150' },
    { value: 200, label: '200' },
    { value: 20, label: 'Bela 20' },
  ];

  const $ = (id) => document.getElementById(id);
  const teams = ['mi', 'vi'];
  const other = (team) => (team === 'mi' ? 'vi' : 'mi');
  const sum = (list) => list.reduce((a, b) => a + b, 0);

  // ---------- state ----------

  const defaults = () => ({ target: 1001, hands: [], matches: [], draft: null, wakeLock: false });
  let state = defaults();
  try {
    state = { ...state, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
  } catch {
    // Broken or unavailable storage: start fresh
  }
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // Private mode or full storage: the game still works, it just won't be remembered
    }
  }

  // ---------- scoring ----------

  const toNumber = (v) => {
    const n = parseInt(v, 10);
    return Number.isFinite(n) ? n : 0;
  };

  // Points one hand gives each team, after štiglja, zvanja and a failed call ("pad")
  function score(hand) {
    const cards = { mi: toNumber(hand.mi), vi: toNumber(hand.vi) };
    if (hand.stiglja) {
      cards[hand.stiglja] = HAND_POINTS + STIGLJA_BONUS;
      cards[other(hand.stiglja)] = 0;
    }
    const totals = {};
    for (const team of teams) totals[team] = cards[team] + sum(hand.zvanja[team]);
    // The team that called trump has to get more than the other team, otherwise it falls
    const autoPad = Boolean(hand.caller) && totals[hand.caller] <= totals[other(hand.caller)];
    const pad = hand.pad === null || hand.pad === undefined ? autoPad : hand.pad;
    if (pad && hand.caller) {
      return { mi: hand.caller === 'mi' ? 0 : totals.mi + totals.vi, vi: hand.caller === 'vi' ? 0 : totals.mi + totals.vi, pad, autoPad, totals };
    }
    return { mi: totals.mi, vi: totals.vi, pad: false, autoPad, totals };
  }

  function totals() {
    const result = { mi: 0, vi: 0 };
    for (const hand of state.hands) {
      const s = score(hand);
      result.mi += s.mi;
      result.vi += s.vi;
    }
    return result;
  }

  function winner(t) {
    if (Math.max(t.mi, t.vi) < state.target) return null;
    if (t.mi === t.vi) return 'tie';
    return t.mi > t.vi ? 'mi' : 'vi';
  }

  // ---------- main screen ----------

  function render() {
    const t = totals();
    $('totalMi').textContent = t.mi;
    $('totalVi').textContent = t.vi;
    $('leftMi').textContent = t.mi < state.target ? `još ${state.target - t.mi}` : '';
    $('leftVi').textContent = t.vi < state.target ? `još ${state.target - t.vi}` : '';

    const wins = { mi: 0, vi: 0 };
    for (const m of state.matches) if (wins[m.winner] !== undefined) wins[m.winner]++;
    $('matches').textContent = `Igra se do ${state.target} · Partije MI ${wins.mi} : ${wins.vi} VI`;

    const won = winner(t);
    const banner = $('winBanner');
    banner.hidden = !won;
    if (won) {
      banner.innerHTML = `<strong>${won === 'tie' ? 'Neriješeno!' : `${won.toUpperCase()} pobjeđuju!`}</strong>
        <span>${t.mi} : ${t.vi}</span><p><button class="btn primary" id="bannerNew" type="button">Nova partija</button></p>`;
      $('bannerNew').addEventListener('click', newMatch);
    }
    $('addButton').disabled = Boolean(won);
    $('undoButton').disabled = state.hands.length === 0;

    const body = $('hands');
    body.innerHTML = '';
    state.hands.forEach((hand, i) => {
      const s = score(hand);
      const tr = document.createElement('tr');
      const cell = (team) => {
        const marks = [];
        if (hand.caller === team) marks.push('zvao');
        if (sum(hand.zvanja[team])) marks.push(`zv. ${sum(hand.zvanja[team])}`);
        if (hand.stiglja === team) marks.push('štiglja');
        if (s.pad && hand.caller === team) marks.push('<span class="pad">pao</span>');
        return `<td>${s[team]}${marks.length ? `<span class="mark">${marks.join(' · ')}</span>` : ''}</td>`;
      };
      tr.innerHTML = `<td>${i + 1}</td>${cell('mi')}${cell('vi')}`;
      tr.addEventListener('click', () => openHand(i));
      body.appendChild(tr);
    });
    $('emptyHands').hidden = state.hands.length > 0;
    if (state.hands.length) $('emptyHands').hidden = true;
  }

  // ---------- entering a hand ----------

  let draft = null; // { index, caller, mi, vi, stiglja, zvanja: { mi: [], vi: [] }, pad }

  function openHand(index = null) {
    const hand = index === null ? null : state.hands[index];
    draft = hand
      ? { index, ...JSON.parse(JSON.stringify(hand)) }
      : { index: null, caller: '', mi: '', vi: '', stiglja: '', zvanja: { mi: [], vi: [] }, pad: null };
    showSheet();
  }

  function showSheet() {
    $('handTitle').textContent = draft.index === null ? `Ruka ${state.hands.length + 1}` : `Ruka ${draft.index + 1}`;
    $('deleteHand').hidden = draft.index === null;
    $('ptsMi').value = draft.mi;
    $('ptsVi').value = draft.vi;
    $('handSheet').hidden = false;
    renderDraft();
  }

  function closeSheet() {
    draft = null;
    state.draft = null;
    save();
    $('handSheet').hidden = true;
  }

  function setSeg(seg, value) {
    for (const b of seg.querySelectorAll('button')) b.classList.toggle('on', b.dataset.value === value);
  }

  function renderDraft() {
    setSeg($('callerSeg'), draft.caller);
    setSeg($('stigljaSeg'), draft.stiglja);
    const cardsDisabled = Boolean(draft.stiglja);
    $('ptsMi').disabled = cardsDisabled;
    $('ptsVi').disabled = cardsDisabled;

    for (const box of document.querySelectorAll('.zvanja')) {
      const team = box.dataset.team;
      box.innerHTML = '';
      draft.zvanja[team].forEach((value, i) => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip added';
        b.textContent = `${value} ✕`;
        b.setAttribute('aria-label', `Makni zvanje ${value}`);
        b.addEventListener('click', () => {
          draft.zvanja[team].splice(i, 1);
          draft.pad = null;
          renderDraft();
        });
        box.appendChild(b);
      });
      for (const z of ZVANJA) {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'chip';
        b.textContent = `+${z.label}`;
        b.addEventListener('click', () => {
          draft.zvanja[team].push(z.value);
          draft.pad = null;
          renderDraft();
        });
        box.appendChild(b);
      }
      $(team === 'mi' ? 'zvanjaMiSum' : 'zvanjaViSum').textContent = sum(draft.zvanja[team]) ? `= ${sum(draft.zvanja[team])}` : '';
    }

    const result = $('handResult');
    const problem = draftProblem();
    if (problem) {
      result.innerHTML = `<span class="muted">${problem}</span>`;
    } else {
      const s = score(draft);
      result.innerHTML = `<div class="big">MI ${s.mi} : ${s.vi} VI</div>
        <label class="toggle" style="justify-content:center;margin-top:8px">
          <input type="checkbox" id="padBox" ${s.pad ? 'checked' : ''}> ${draft.caller.toUpperCase()} (zvač) ${s.pad ? '<span class="warn">je pao</span>' : 'je prošao'}
        </label>
        <span class="muted small">MI ${s.totals.mi} · VI ${s.totals.vi} prije pada${s.autoPad !== s.pad ? ' · ručno promijenjeno' : ''}</span>`;
      $('padBox').addEventListener('change', (e) => {
        draft.pad = e.target.checked === score({ ...draft, pad: null }).autoPad ? null : e.target.checked;
        renderDraft();
      });
    }
    $('saveHand').disabled = Boolean(problem);
    state.draft = draft;
    save();
  }

  function draftProblem() {
    if (!draft.caller) return 'Odaberi tko je zvao adut.';
    if (draft.stiglja) return null;
    if (draft.mi === '' && draft.vi === '') return 'Upiši bodove.';
    const mi = toNumber(draft.mi);
    const vi = toNumber(draft.vi);
    if (mi < 0 || vi < 0 || mi + vi !== HAND_POINTS) return `Bodovi moraju biti ukupno ${HAND_POINTS} (sad ${mi + vi}).`;
    return null;
  }

  // Typing one team's points fills in the other: together they are always 162
  function onPoints(team) {
    const input = $(team === 'mi' ? 'ptsMi' : 'ptsVi');
    const otherInput = $(team === 'mi' ? 'ptsVi' : 'ptsMi');
    draft[team] = input.value;
    const n = parseInt(input.value, 10);
    if (Number.isFinite(n) && n >= 0 && n <= HAND_POINTS) {
      draft[other(team)] = String(HAND_POINTS - n);
      otherInput.value = draft[other(team)];
    } else if (input.value === '') {
      draft[other(team)] = '';
      otherInput.value = '';
    }
    draft.pad = null;
    renderDraft();
  }

  function saveHand() {
    if (draftProblem()) return;
    const { index, ...hand } = draft;
    if (hand.stiglja) {
      hand.mi = '';
      hand.vi = '';
    }
    if (index === null) state.hands.push(hand);
    else state.hands[index] = hand;
    closeSheet();
    render();
  }

  function deleteHand() {
    if (draft.index === null || !confirm(`Obrisati ruku ${draft.index + 1}?`)) return;
    state.hands.splice(draft.index, 1);
    closeSheet();
    render();
  }

  // ---------- matches ----------

  function newMatch() {
    const t = totals();
    const won = winner(t);
    if (!won && state.hands.length && !confirm('Partija još nije gotova. Svejedno krenuti novu?')) return;
    if (won && won !== 'tie') state.matches.push({ mi: t.mi, vi: t.vi, winner: won });
    state.hands = [];
    save();
    closeMenu();
    render();
  }

  function resetAll() {
    if (!confirm('Obrisati sve ruke i sve partije?')) return;
    const keep = { target: state.target, wakeLock: state.wakeLock };
    state = { ...defaults(), ...keep };
    save();
    closeMenu();
    render();
  }

  // ---------- settings ----------

  function openMenu() {
    setSeg($('targetSeg'), String(state.target));
    $('wakeLock').checked = state.wakeLock;
    $('menuSheet').hidden = false;
  }
  function closeMenu() {
    $('menuSheet').hidden = true;
  }

  let wakeLock = null;
  async function applyWakeLock() {
    const note = $('wakeLockNote');
    if (!('wakeLock' in navigator)) {
      note.textContent = 'Ovaj preglednik to ne podržava. Rezultat se svejedno sprema.';
      return;
    }
    try {
      if (state.wakeLock && !wakeLock && document.visibilityState === 'visible') {
        wakeLock = await navigator.wakeLock.request('screen');
        wakeLock.addEventListener('release', () => { wakeLock = null; });
      } else if (!state.wakeLock && wakeLock) {
        await wakeLock.release();
        wakeLock = null;
      }
      note.textContent = '';
    } catch {
      note.textContent = 'Preglednik nije dopustio da ekran ostane upaljen.';
    }
  }
  document.addEventListener('visibilitychange', applyWakeLock);

  // ---------- events ----------

  $('addButton').addEventListener('click', () => openHand());
  $('undoButton').addEventListener('click', () => {
    if (state.hands.length && confirm(`Obrisati zadnju ruku (${state.hands.length})?`)) {
      state.hands.pop();
      save();
      render();
    }
  });
  $('callerSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    draft.caller = b.dataset.value;
    draft.pad = null;
    renderDraft();
  });
  $('stigljaSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    draft.stiglja = b.dataset.value;
    draft.pad = null;
    renderDraft();
  });
  $('ptsMi').addEventListener('input', () => onPoints('mi'));
  $('ptsVi').addEventListener('input', () => onPoints('vi'));
  $('saveHand').addEventListener('click', saveHand);
  $('cancelHand').addEventListener('click', closeSheet);
  $('deleteHand').addEventListener('click', deleteHand);
  $('menuButton').addEventListener('click', openMenu);
  $('closeMenu').addEventListener('click', closeMenu);
  $('targetSeg').addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    state.target = Number(b.dataset.value);
    setSeg($('targetSeg'), b.dataset.value);
    save();
    render();
  });
  $('wakeLock').addEventListener('change', (e) => {
    state.wakeLock = e.target.checked;
    save();
    applyWakeLock();
  });
  $('newMatch').addEventListener('click', newMatch);
  $('resetAll').addEventListener('click', resetAll);
  for (const sheet of [$('handSheet'), $('menuSheet')]) {
    sheet.addEventListener('click', (e) => {
      if (e.target === sheet) sheet === $('handSheet') ? closeSheet() : closeMenu();
    });
  }

  render();
  applyWakeLock();
  // A hand that was being entered when the screen went off comes back
  if (state.draft) {
    draft = state.draft;
    showSheet();
  }
})();
