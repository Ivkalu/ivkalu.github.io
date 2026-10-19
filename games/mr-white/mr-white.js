// Mr. White on one phone. The game is kept in localStorage, so a locked
// screen or a reload does not end it (the secret word is hidden again).
(() => {
  const STORAGE_KEY = 'ivkalu-mr-white-v1';
  const app = document.getElementById('app');
  const ROLE_NAMES = { civil: 'Civil', undercover: 'Undercover', white: 'Mr. White' };

  let state = { players: [], whites: 1, undercovers: 0, game: null };
  try {
    state = { ...state, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') };
  } catch {
    // start fresh
  }
  // Never show a secret word right after opening the page
  if (state.game) state.game.shown = false;

  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      // the game still works without storage
    }
  }

  const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // Lowercase, no diacritics, single spaces: "Šećer " matches "secer"
  const normalize = (s) => s.toLowerCase().replace(/đ/g, 'd').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/\s+/g, ' ').trim();
  const shuffle = (list) => {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  function render() {
    save();
    const game = state.game;
    if (!game) return renderSetup();
    ({ reveal: renderReveal, play: renderPlay, guess: renderGuess, over: renderOver })[game.phase]();
  }

  // ---------- setup ----------

  function setupProblem() {
    const n = state.players.length;
    if (n < 3) return 'Trebaju barem 3 igrača.';
    const impostors = state.whites + state.undercovers;
    if (impostors < 1) return 'Treba barem jedan Mr. White ili Undercover.';
    if (n - impostors < 2) return 'Previše uljeza: trebaju barem 2 civila.';
    return null;
  }

  function renderSetup() {
    const problem = setupProblem();
    app.innerHTML = `
      <div class="card">
        <h2>Igrači (${state.players.length})</h2>
        <div class="players">${state.players.map((p, i) => `
          <div class="player"><span>${escapeHtml(p)}</span>
            <button class="btn" data-up="${i}" aria-label="Pomakni gore" ${i === 0 ? 'disabled' : ''}>↑</button>
            <button class="btn danger" data-remove="${i}" aria-label="Makni">✕</button>
          </div>`).join('') || '<p class="muted">Dodaj igrače redom kako sjedite.</p>'}
        </div>
        <form class="row" id="addForm" style="margin-top:10px">
          <input id="nameInput" placeholder="Ime igrača" autocomplete="off" maxlength="24">
          <button class="btn primary" type="submit" style="flex:0 0 auto">Dodaj</button>
        </form>
      </div>
      <div class="card">
        <h2>Uloge</h2>
        <div class="stepper"><span>Mr. White</span>
          <button class="btn" data-step="whites" data-delta="-1">−</button><strong>${state.whites}</strong>
          <button class="btn" data-step="whites" data-delta="1">+</button></div>
        <div class="stepper" style="margin-top:8px"><span>Undercover <span class="muted small">(slična riječ)</span></span>
          <button class="btn" data-step="undercovers" data-delta="-1">−</button><strong>${state.undercovers}</strong>
          <button class="btn" data-step="undercovers" data-delta="1">+</button></div>
        <p class="muted small" style="margin-bottom:0">Civila: ${Math.max(0, state.players.length - state.whites - state.undercovers)}</p>
      </div>
      ${problem ? `<p class="muted hint">${problem}</p>` : ''}
      <div class="bottombar"><div><button class="btn primary big" id="start" style="flex:1" ${problem ? 'disabled' : ''}>Počni igru</button></div></div>`;

    app.querySelector('#addForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = app.querySelector('#nameInput');
      const name = input.value.trim();
      if (name && !state.players.some((p) => normalize(p) === normalize(name))) state.players.push(name);
      render();
      app.querySelector('#nameInput').focus();
    });
    app.querySelectorAll('[data-remove]').forEach((b) => b.addEventListener('click', () => {
      state.players.splice(Number(b.dataset.remove), 1);
      render();
    }));
    app.querySelectorAll('[data-up]').forEach((b) => b.addEventListener('click', () => {
      const i = Number(b.dataset.up);
      [state.players[i - 1], state.players[i]] = [state.players[i], state.players[i - 1]];
      render();
    }));
    app.querySelectorAll('[data-step]').forEach((b) => b.addEventListener('click', () => {
      const key = b.dataset.step;
      state[key] = Math.max(0, state[key] + Number(b.dataset.delta));
      render();
    }));
    app.querySelector('#start').addEventListener('click', startGame);
  }

  function startGame() {
    if (setupProblem()) return;
    const recent = state.recentPairs || [];
    const fresh = WORD_PAIRS.filter((_, i) => !recent.includes(i));
    const pick = (fresh.length ? fresh : WORD_PAIRS)[Math.floor(Math.random() * (fresh.length || WORD_PAIRS.length))];
    const pairIndex = WORD_PAIRS.indexOf(pick);
    state.recentPairs = [...recent, pairIndex].slice(-30);
    // Randomly swap which word is the civilians' one
    const [word, undercoverWord] = Math.random() < 0.5 ? pick : [pick[1], pick[0]];

    const roles = shuffle([
      ...Array(state.whites).fill('white'),
      ...Array(state.undercovers).fill('undercover'),
      ...Array(state.players.length - state.whites - state.undercovers).fill('civil'),
    ]);
    const players = state.players.map((name, i) => ({ name, role: roles[i], alive: true }));
    // Mr. White never starts: he would have nothing to go on
    const starters = players.map((p, i) => i).filter((i) => players[i].role !== 'white');
    state.game = {
      word,
      undercoverWord,
      players,
      phase: 'reveal',
      revealIndex: 0,
      shown: false,
      starter: starters[Math.floor(Math.random() * starters.length)],
      round: 1,
      log: [],
    };
    render();
  }

  // ---------- reveal (pass the phone) ----------

  function renderReveal() {
    const game = state.game;
    const player = game.players[game.revealIndex];
    const secret = player.role === 'white'
      ? '<div class="secret white">Ti si Mr. White<small>Nemaš riječ. Slušaj druge i blefiraj.</small></div>'
      : `<div class="secret">${escapeHtml(player.role === 'undercover' ? game.undercoverWord : game.word)}<small>Tvoja tajna riječ</small></div>`;
    app.innerHTML = `
      <div class="card reveal">
        <p class="muted">Igrač ${game.revealIndex + 1} od ${game.players.length}. Daj mobitel igraču:</p>
        <div class="who">${escapeHtml(player.name)}</div>
        ${game.shown ? secret : '<p class="muted">Pazi da nitko drugi ne gleda.</p>'}
        <button class="btn primary big block" id="toggle">${game.shown ? 'Sakrij i daj dalje' : 'Prikaži moju ulogu'}</button>
      </div>
      <p class="hint"><button class="btn" id="abort">Prekini igru</button></p>`;
    app.querySelector('#toggle').addEventListener('click', () => {
      if (!game.shown) {
        game.shown = true;
      } else {
        game.shown = false;
        game.revealIndex++;
        if (game.revealIndex >= game.players.length) game.phase = 'play';
      }
      render();
    });
    app.querySelector('#abort').addEventListener('click', abortGame);
  }

  function abortGame() {
    if (!confirm('Prekinuti igru?')) return;
    state.game = null;
    render();
  }

  // ---------- play: describe, discuss, vote ----------

  function counts() {
    const alive = state.game.players.filter((p) => p.alive);
    return {
      civil: alive.filter((p) => p.role === 'civil').length,
      impostors: alive.filter((p) => p.role !== 'civil').length,
    };
  }

  function checkWinner() {
    const c = counts();
    if (c.impostors === 0) return finish('civil', 'Civili su izbacili sve uljeze!');
    if (c.civil <= 1) return finish('impostors', 'Ostao je samo jedan civil. Uljezi pobjeđuju!');
    return false;
  }

  function finish(winner, message) {
    state.game.phase = 'over';
    state.game.winner = winner;
    state.game.message = message;
    return true;
  }

  function nextStarter() {
    const game = state.game;
    for (let step = 1; step <= game.players.length; step++) {
      const i = (game.starter + step) % game.players.length;
      if (game.players[i].alive && game.players[i].role !== 'white') return i;
    }
    return game.players.findIndex((p) => p.alive);
  }

  function renderPlay() {
    const game = state.game;
    const starter = game.players[game.starter];
    app.innerHTML = `
      <div class="banner"><span>Krug ${game.round}. Počinje</span><strong>${escapeHtml(starter.name)}</strong>
        <span class="small">pa redom u krug. Svatko kaže jednu riječ.</span></div>
      <div class="card">
        <h2>Glasanje: koga izbacujete?</h2>
        <div class="alive">${game.players.map((p, i) => `
          <div class="player ${p.alive ? '' : 'out'}">
            <span>${escapeHtml(p.name)}</span>
            ${p.alive ? `<button class="btn danger" data-out="${i}">Izbaci</button>` : `<span class="role-tag ${p.role}">${ROLE_NAMES[p.role]}</span>`}
          </div>`).join('')}
        </div>
      </div>
      ${game.log.length ? `<div class="card"><h2>Do sad</h2>${game.log.map((l) => `<p class="small" style="margin:4px 0">${escapeHtml(l)}</p>`).join('')}</div>` : ''}
      <p class="hint"><button class="btn" id="abort">Prekini igru</button></p>`;
    app.querySelectorAll('[data-out]').forEach((b) => b.addEventListener('click', () => eliminate(Number(b.dataset.out))));
    app.querySelector('#abort').addEventListener('click', abortGame);
  }

  function eliminate(i) {
    const game = state.game;
    const player = game.players[i];
    if (!confirm(`Izbaciti igrača ${player.name}?`)) return;
    player.alive = false;
    game.log.push(`Krug ${game.round}: izbačen ${player.name} (${ROLE_NAMES[player.role]})`);
    if (player.role === 'white') {
      game.phase = 'guess';
      game.guesser = i;
    } else {
      alert(`${player.name}: ${ROLE_NAMES[player.role]}.`);
      if (!checkWinner()) nextRound();
    }
    render();
  }

  function nextRound() {
    const game = state.game;
    game.round++;
    game.starter = nextStarter(); // the next living player who is not Mr. White
  }

  // ---------- Mr. White guesses ----------

  function renderGuess() {
    const game = state.game;
    const player = game.players[game.guesser];
    app.innerHTML = `
      <div class="card reveal">
        <div class="secret white">${escapeHtml(player.name)} je Mr. White!</div>
        <p>Ima jedan pokušaj: koja je riječ civila?</p>
        <form id="guessForm"><input id="guessInput" placeholder="Pogodi riječ" autocomplete="off">
          <p><button class="btn primary big block" type="submit">Provjeri</button></p></form>
      </div>`;
    app.querySelector('#guessForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const guess = app.querySelector('#guessInput').value;
      if (!guess.trim()) return;
      if (normalize(guess) === normalize(game.word)) {
        finish('white', `${player.name} pogađa „${game.word}” i to je točno. Mr. White pobjeđuje!`);
      } else {
        game.log.push(`${player.name} (Mr. White) pogađa „${guess.trim()}”: netočno.`);
        game.phase = 'play';
        if (!checkWinner()) nextRound();
      }
      render();
    });
    app.querySelector('#guessInput').focus();
  }

  // ---------- game over ----------

  function renderOver() {
    const game = state.game;
    app.innerHTML = `
      <div class="banner"><strong>${escapeHtml(game.message)}</strong></div>
      <div class="card">
        <h2>Riječi</h2>
        <p style="margin:0">Civili: <strong>${escapeHtml(game.word)}</strong>${game.players.some((p) => p.role === 'undercover') ? ` · Undercover: <strong>${escapeHtml(game.undercoverWord)}</strong>` : ''}</p>
      </div>
      <div class="card">
        <h2>Uloge</h2>
        <div class="alive">${game.players.map((p) => `
          <div class="player ${p.alive ? '' : 'out'}"><span>${escapeHtml(p.name)}</span>
            <span class="role-tag ${p.role}">${ROLE_NAMES[p.role]}</span></div>`).join('')}
        </div>
      </div>
      <div class="bottombar"><div>
        <button class="btn" id="setup">Igrači</button>
        <button class="btn primary big" id="again" style="flex:1">Nova runda</button>
      </div></div>`;
    app.querySelector('#again').addEventListener('click', startGame);
    app.querySelector('#setup').addEventListener('click', () => {
      state.game = null;
      render();
    });
  }

  // ---------- rules ----------

  const rules = document.getElementById('rulesSheet');
  document.getElementById('rulesButton').addEventListener('click', () => { rules.hidden = false; });
  document.getElementById('closeRules').addEventListener('click', () => { rules.hidden = true; });
  rules.addEventListener('click', (e) => { if (e.target === rules) rules.hidden = true; });

  render();
})();
