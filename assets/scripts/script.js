document.addEventListener('DOMContentLoaded', () => {


  const circle = document.querySelector('.circle');
  const wave = document.querySelector('.wave');
  const audioPlayer = document.getElementById('audioPlayer');

  const playbar = document.getElementById('playbar');
  const playButton = document.getElementById('playButton');
  const prevButton = document.getElementById('prevButton');
  const nextButton = document.getElementById('nextButton');
  const shuffleButton = document.getElementById('shuffleButton');
  const repeatButton = document.getElementById('repeatButton');
  const seekBar = document.getElementById('seekBar');
  const volumeBar = document.getElementById('volumeBar');
  const currentTimeLabel = document.getElementById('currentTime');
  const durationLabel = document.getElementById('duration');
  const songTitle = document.getElementById('songTitle');

  const sidebarToggle = document.getElementById('sidebarToggle');
  const sidebarClose = document.getElementById('sidebarClose');
  const sidebarBackdrop = document.getElementById('sidebarBackdrop');
  const songList = document.getElementById('songList');

  const queueButton = document.getElementById('queueButton');
  const queueClose = document.getElementById('queueClose');
  const queueList = document.getElementById('queueList');
  const toast = document.getElementById('toast');

  // Flat list of all songs from assets/songs.json: { title, path, row }
  let playlist = [];
  let currentIndex = -1;  // song that is loaded right now
  let contextIndex = -1;  // position in the song list; queued songs do not move it
  let currentFromQueue = false;
  let queue = [];         // playlist indices the user added with "Add to queue"

  // Get song from URL
  const urlParams = new URLSearchParams(window.location.search);
  const initialSong = urlParams.get('song');

  if (initialSong) {
    audioPlayer.src = initialSong;
    songTitle.textContent = titleFromPath(initialSong);
    updateMediaSession(songTitle.textContent);
  }

  let hasStarted = false;

  let isHovered = false;

  circle.addEventListener('mouseenter', () => {
    isHovered = true;
  });

  circle.addEventListener('mouseleave', () => {
    isHovered = false;
  });


  function titleFromPath(path) {
    const fileName = path.split('/').pop().replace(/\.[^.]+$/, '');
    return fileName.replace(/^\d+\s+/, '');
  }

  function formatTime(seconds) {
    if (!isFinite(seconds)) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const rest = Math.floor(seconds % 60);
    return `${minutes}:${String(rest).padStart(2, '0')}`;
  }

  // ---------- Playback ----------

  function play() {
    if (!hasStarted) {
      hasStarted = true;
      start();
    }
    resumeAudioContext();
    if (!audioPlayer.src && playlist.length) {
      loadSong(0);
    }
    audioPlayer.play();
  }

  function togglePlay() {
    if (audioPlayer.paused || audioPlayer.ended) {
      play();
    } else {
      audioPlayer.pause();
    }
  }

  function loadSong(index, fromQueue = false) {
    currentIndex = index;
    currentFromQueue = fromQueue;
    if (!fromQueue) contextIndex = index;
    const song = playlist[index];
    audioPlayer.src = song.path;
    songTitle.textContent = song.title;
    updateMediaSession(song.title);
    seekBar.value = 0;
    updateSliderFill(seekBar);
    currentTimeLabel.textContent = '0:00';
    durationLabel.textContent = '0:00';
    history.replaceState(null, '', '?song=' + encodeURIComponent(song.path));
    markCurrent(index);
  }

  function markCurrent(index) {
    currentIndex = index;
    playlist.forEach((song, i) => song.row.classList.toggle('active', i === index));
    setCover(playlist[index].cover);
    renderQueue();
  }

  // Folders with a cover image show it inside the circle instead of the green
  function setCover(path) {
    circle.classList.toggle('has-cover', Boolean(path));
    circle.style.backgroundImage = path ? `url("${encodeURI(path)}")` : '';
  }

  function playSong(index, fromQueue = false) {
    if (!playlist.length) return;
    loadSong((index + playlist.length) % playlist.length, fromQueue);
    play();
  }

  // Starts playing from a song in the list (sidebar click, previous button)
  function playFromList(index) {
    if (shuffle) shuffleOrder = shuffled(index);
    playSong(index);
  }

  // ---------- Shuffle & repeat ----------

  let shuffle = false;
  let shuffleOrder = []; // upcoming songs while shuffle is on
  let repeatMode = 'off'; // 'off' -> 'all' -> 'one'
  const playedHistory = []; // { index, fromQueue }

  // Every song except `skip`, in random order
  function shuffled(skip) {
    const order = playlist.map((_, i) => i).filter(i => i !== skip);
    for (let i = order.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [order[i], order[j]] = [order[j], order[i]];
    }
    return order;
  }

  shuffleButton.addEventListener('click', () => {
    shuffle = !shuffle;
    shuffleOrder = shuffle ? shuffled(contextIndex) : [];
    shuffleButton.classList.toggle('active', shuffle);
    shuffleButton.setAttribute('aria-pressed', shuffle);
    renderQueue();
  });

  repeatButton.addEventListener('click', () => {
    repeatMode = { off: 'all', all: 'one', one: 'off' }[repeatMode];
    repeatButton.classList.toggle('active', repeatMode !== 'off');
    repeatButton.classList.toggle('repeat-one-mode', repeatMode === 'one');
    repeatButton.setAttribute('aria-label', 'Repeat: ' + repeatMode);
    renderQueue();
  });

  // Songs that will play from the list after the current one (without the queue)
  function upcoming(limit) {
    if (shuffle) return shuffleOrder.slice(0, limit);
    const result = [];
    for (let step = 1; step < playlist.length && result.length < limit; step++) {
      const index = contextIndex + step;
      if (index >= playlist.length && repeatMode !== 'all') break;
      result.push(index % playlist.length);
    }
    return result;
  }

  // Next song from the list, or -1 when the list is over.
  // `wrap` starts over at the end even with repeat off (the next button does).
  function takeNextFromList(wrap) {
    if (shuffle) {
      if (!shuffleOrder.length) {
        if (repeatMode !== 'all' && !wrap) return -1;
        shuffleOrder = shuffled(contextIndex);
      }
      return shuffleOrder.length ? shuffleOrder.shift() : contextIndex;
    }
    const index = contextIndex + 1;
    if (index < playlist.length) return index;
    return repeatMode === 'all' || wrap ? 0 : -1;
  }

  // Queued songs go first, then the list continues where it was
  function playNext(wrap = true) {
    if (!playlist.length) return;
    const previous = { index: currentIndex, fromQueue: currentFromQueue };
    if (queue.length) {
      if (currentIndex !== -1) playedHistory.push(previous);
      playSong(queue.shift(), true);
      return;
    }
    const index = takeNextFromList(wrap);
    if (index === -1) return;
    if (currentIndex !== -1) playedHistory.push(previous);
    playSong(index);
  }

  function playPrevious() {
    // Restart the song first, go to the previous one on a second click
    if (audioPlayer.currentTime > 3 || currentIndex === -1) {
      audioPlayer.currentTime = 0;
    } else if (playedHistory.length) {
      const entry = playedHistory.pop();
      playSong(entry.index, entry.fromQueue);
    } else {
      playFromList((contextIndex - 1 + playlist.length) % playlist.length);
    }
  }

  playButton.addEventListener('click', togglePlay);
  nextButton.addEventListener('click', () => playNext(true));
  prevButton.addEventListener('click', playPrevious);

  // Automatically continue with the next song
  audioPlayer.addEventListener('ended', () => {
    if (repeatMode === 'one') {
      audioPlayer.currentTime = 0;
      audioPlayer.play();
      return;
    }
    playNext(false);
  });

  // ---------- Queue ----------

  const ICON_ADD = '<svg viewBox="0 0 16 16"><path d="M8 1a.75.75 0 0 1 .75.75v5.5h5.5a.75.75 0 0 1 0 1.5h-5.5v5.5a.75.75 0 0 1-1.5 0v-5.5h-5.5a.75.75 0 0 1 0-1.5h5.5v-5.5A.75.75 0 0 1 8 1z"/></svg>';
  const ICON_REMOVE = '<svg viewBox="0 0 16 16"><path d="M2.47 2.47a.75.75 0 0 1 1.06 0L8 6.94l4.47-4.47a.75.75 0 1 1 1.06 1.06L9.06 8l4.47 4.47a.75.75 0 1 1-1.06 1.06L8 9.06l-4.47 4.47a.75.75 0 0 1-1.06-1.06L6.94 8 2.47 3.53a.75.75 0 0 1 0-1.06z"/></svg>';
  const UPCOMING_LIMIT = 30;

  let toastTimer = null;
  function showToast(text) {
    toast.textContent = text;
    toast.classList.add('visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove('visible'), 1800);
  }

  function addToQueue(index) {
    queue.push(index);
    renderQueue();
    showToast('Added to queue');
  }

  // A row with the song title and an optional small icon button on the right
  function songRow(title, onPlay, action) {
    const row = document.createElement('div');
    row.className = 'song-row';
    const titleButton = document.createElement('button');
    titleButton.className = 'song-title';
    titleButton.textContent = title;
    titleButton.addEventListener('click', onPlay);
    row.appendChild(titleButton);
    if (action) {
      const button = document.createElement('button');
      button.className = 'control';
      button.innerHTML = action.icon;
      button.setAttribute('aria-label', action.label);
      button.title = action.label;
      button.addEventListener('click', event => {
        event.stopPropagation();
        action.onClick();
      });
      row.appendChild(button);
    }
    return row;
  }

  function heading(text, button) {
    const h3 = document.createElement('h3');
    h3.textContent = text;
    if (button) h3.appendChild(button);
    return h3;
  }

  function renderQueue() {
    if (!queueList) return;
    queueList.innerHTML = '';
    if (!playlist.length) return;

    if (currentIndex !== -1) {
      queueList.appendChild(heading('Now playing'));
      const row = songRow(playlist[currentIndex].title, togglePlay);
      row.classList.add('active');
      queueList.appendChild(row);
    }

    if (queue.length) {
      const clear = document.createElement('button');
      clear.textContent = 'Clear';
      clear.addEventListener('click', () => {
        queue = [];
        renderQueue();
      });
      queueList.appendChild(heading('Next in queue', clear));
      queue.forEach((index, position) => {
        queueList.appendChild(songRow(
          playlist[index].title,
          () => {
            // Jump to this song, the songs queued before it are skipped
            queue.splice(0, position + 1);
            playedHistory.push({ index: currentIndex, fromQueue: currentFromQueue });
            playSong(index, true);
          },
          {
            icon: ICON_REMOVE,
            label: 'Remove from queue',
            onClick: () => {
              queue.splice(position, 1);
              renderQueue();
            },
          },
        ));
      });
    }

    const next = upcoming(UPCOMING_LIMIT);
    queueList.appendChild(heading('Next up'));
    if (!next.length) {
      const empty = document.createElement('p');
      empty.className = 'queue-empty';
      empty.textContent = 'Nothing else to play.';
      queueList.appendChild(empty);
    }
    next.forEach((index, position) => {
      queueList.appendChild(songRow(
        playlist[index].title,
        () => {
          // Skip ahead in the list to this song
          if (shuffle) shuffleOrder.splice(0, position + 1);
          playedHistory.push({ index: currentIndex, fromQueue: currentFromQueue });
          playSong(index);
        },
        { icon: ICON_ADD, label: 'Add to queue', onClick: () => addToQueue(index) },
      ));
    });
  }

  function setQueueOpen(open) {
    document.body.classList.toggle('queue-open', open);
    queueButton.classList.toggle('active', open);
    queueButton.setAttribute('aria-pressed', open);
    if (open) renderQueue();
  }

  queueButton.addEventListener('click', () => setQueueOpen(!document.body.classList.contains('queue-open')));
  queueClose.addEventListener('click', () => setQueueOpen(false));

  audioPlayer.addEventListener('play', () => playbar.classList.add('playing'));
  audioPlayer.addEventListener('pause', () => playbar.classList.remove('playing'));

  // ---------- Background playback (screen off / lock screen) ----------

  let audioContext = null;

  function resumeAudioContext() {
    if (audioContext && audioContext.state !== 'running') {
      audioContext.resume().catch(() => {});
    }
  }

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden && !audioPlayer.paused) resumeAudioContext();
  });

  // Media Session: song title and controls on the lock screen / notification,
  // which also tells the phone that this page is playing music
  function updateMediaSession(title) {
    if (!('mediaSession' in navigator)) return;
    navigator.mediaSession.metadata = new MediaMetadata({ title, artist: 'Ivkalu' });
  }

  function updatePositionState() {
    if (!('mediaSession' in navigator) || !isFinite(audioPlayer.duration)) return;
    try {
      navigator.mediaSession.setPositionState({
        duration: audioPlayer.duration,
        position: Math.min(audioPlayer.currentTime, audioPlayer.duration),
        playbackRate: audioPlayer.playbackRate,
      });
    } catch (error) {
      // Older browsers do not support position state
    }
  }

  if ('mediaSession' in navigator) {
    const handlers = {
      play: () => play(),
      pause: () => audioPlayer.pause(),
      previoustrack: playPrevious,
      nexttrack: () => playNext(true),
      seekto: details => {
        audioPlayer.currentTime = details.seekTime;
        updatePositionState();
      },
    };
    for (const [action, handler] of Object.entries(handlers)) {
      try {
        navigator.mediaSession.setActionHandler(action, handler);
      } catch (error) {
        // Action not supported by this browser
      }
    }
  }

  audioPlayer.addEventListener('play', () => {
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'playing';
  });
  audioPlayer.addEventListener('pause', () => {
    if ('mediaSession' in navigator) navigator.mediaSession.playbackState = 'paused';
  });

  // ---------- Progress & volume ----------

  function updateSliderFill(slider) {
    const max = Number(slider.max) || 0;
    const percent = max ? (slider.value / max) * 100 : 0;
    slider.style.setProperty('--fill', percent + '%');
  }

  let isSeeking = false;

  audioPlayer.addEventListener('loadedmetadata', () => {
    seekBar.max = audioPlayer.duration;
    durationLabel.textContent = formatTime(audioPlayer.duration);
    updateSliderFill(seekBar);
    updatePositionState();
  });

  audioPlayer.addEventListener('seeked', updatePositionState);

  audioPlayer.addEventListener('timeupdate', () => {
    if (!isSeeking) {
      seekBar.value = audioPlayer.currentTime;
      currentTimeLabel.textContent = formatTime(audioPlayer.currentTime);
      updateSliderFill(seekBar);
    }
  });

  seekBar.addEventListener('input', () => {
    isSeeking = true;
    currentTimeLabel.textContent = formatTime(seekBar.value);
    updateSliderFill(seekBar);
  });

  seekBar.addEventListener('change', () => {
    audioPlayer.currentTime = seekBar.value;
    isSeeking = false;
  });

  volumeBar.addEventListener('input', () => {
    audioPlayer.volume = volumeBar.value;
    updateSliderFill(volumeBar);
  });
  updateSliderFill(volumeBar);

  // ---------- Playbar visibility ----------

  let hideTimer = null;

  function showPlaybar() {
    clearTimeout(hideTimer);
    hideTimer = null;
    playbar.classList.add('visible');
  }

  function scheduleHide(delay) {
    if (hideTimer !== null) return;
    hideTimer = setTimeout(() => {
      hideTimer = null;
      if (isSeeking) {
        scheduleHide(delay);
      } else {
        playbar.classList.remove('visible');
      }
    }, delay);
  }

  function inBottomThird(y) {
    return y >= window.innerHeight * 2 / 3;
  }

  document.addEventListener('mousemove', event => {
    if (inBottomThird(event.clientY)) {
      showPlaybar();
    } else if (playbar.classList.contains('visible')) {
      scheduleHide(1200);
    }
  });

  document.documentElement.addEventListener('mouseleave', () => scheduleHide(1200));

  // Touch screens have no hover: tapping the bottom third shows the playbar for a while
  document.addEventListener('touchstart', event => {
    if (inBottomThird(event.touches[0].clientY)) {
      showPlaybar();
      scheduleHide(4000);
    }
  }, { passive: true });

  // ---------- Sidebar ----------

  function setSidebarOpen(open) {
    document.body.classList.toggle('sidebar-open', open);
    sidebarToggle.setAttribute('aria-expanded', open);
  }

  sidebarToggle.addEventListener('click', () => setSidebarOpen(true));
  sidebarClose.addEventListener('click', () => setSidebarOpen(false));
  sidebarBackdrop.addEventListener('click', () => setSidebarOpen(false));
  document.addEventListener('keydown', event => {
    if (event.key !== 'Escape') return;
    setSidebarOpen(false);
    setQueueOpen(false);
  });

  fetch('assets/songs.json', { cache: 'no-cache' })
    .then(response => response.json())
    .then(categories => {
      for (const category of categories) {
        songList.appendChild(heading(category.name));

        for (const song of category.songs) {
          const index = playlist.length;
          const row = songRow(
            song.title,
            () => {
              playFromList(index);
              setSidebarOpen(false);
            },
            { icon: ICON_ADD, label: 'Add to queue', onClick: () => addToQueue(index) },
          );
          songList.appendChild(row);
          playlist.push({ ...song, cover: category.cover, row });
        }
      }

      const initialIndex = playlist.findIndex(song => song.path === initialSong);
      if (initialIndex !== -1) {
        // The song is already loaded from the URL, only highlight it
        contextIndex = initialIndex;
        markCurrent(initialIndex);
      } else if (!initialSong && playlist.length) {
        loadSong(0);
      }
    });


  function start() {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();

  // Mobile browsers can suspend the audio context when the screen turns off,
  // which would silence the song, so start it again right away.
  audioContext.addEventListener('statechange', () => {
    if (!audioPlayer.paused) resumeAudioContext();
  });

  const analyser = audioContext.createAnalyser();

  if (!audioPlayer._sourceNode) {
    const sourceNode = audioContext.createMediaElementSource(audioPlayer);
    audioPlayer._sourceNode = sourceNode;
    sourceNode.connect(analyser);
    analyser.connect(audioContext.destination);
  }

  // How the bars are computed, the way audio spectrum analysers do it:
  // - bands are spaced logarithmically from 30 Hz to 16 kHz (MP3s are cut off
  //   around 16 kHz, so anything above would always be empty)
  // - a big FFT gives enough resolution for the narrow bass bands
  // - music loses about 4.5 dB per octave, so that slope is added back,
  //   otherwise the bass always looks stronger than the rest
  // - each band is partly evened out against its own long-term level, so dark
  //   songs still move in the highs and bass-heavy songs don't fill everything
  // - the dB range follows the loudness of the song (slow automatic gain)
  // - bars rise fast and fall slowly
  const sampleRate = audioContext.sampleRate;
  analyser.fftSize = 8192;
  analyser.smoothingTimeConstant = 0; // smoothing is done below
  const spectrum = new Float32Array(analyser.frequencyBinCount);
  const binHz = sampleRate / analyser.fftSize;

  const numBars = 32;
  const MIN_HZ = 30;
  const MAX_HZ = Math.min(16000, sampleRate / 2);
  const TILT_DB_PER_OCTAVE = 4.5;
  const RANGE_DB = 50;          // dB shown between an empty and a full bar
  const ATTACK_SECONDS = 0.03;
  const RELEASE_SECONDS = 0.25;
  const GAIN_FALL_DB_PER_SECOND = 3;
  const EQ_STRENGTH = 0.5;      // 0 = true spectrum, 1 = every band evened out
  const EQ_SECONDS = 8;         // how long the long-term level remembers

  wave.innerHTML = '';
  const bars = [];
  for (let i = 0; i < numBars; i++) {
    const bar = document.createElement('div');
    bar.classList.add('bar');
    wave.appendChild(bar);
    bars.push(bar);
  }

  const bands = [];
  for (let i = 0; i < numBars; i++) {
    const low = MIN_HZ * (MAX_HZ / MIN_HZ) ** (i / numBars);
    const high = MIN_HZ * (MAX_HZ / MIN_HZ) ** ((i + 1) / numBars);
    const center = Math.sqrt(low * high);
    bands.push({
      center,
      firstBin: Math.ceil(low / binHz),
      lastBin: Math.min(spectrum.length - 1, Math.floor(high / binHz)),
      tilt: TILT_DB_PER_OCTAVE * Math.log2(center / 1000),
    });
  }

  // Loudness of one band in dB: mean power of its bins, or for bands narrower
  // than one bin, interpolated at the band's centre frequency
  function bandDb(band) {
    if (band.lastBin >= band.firstBin) {
      let power = 0;
      for (let j = band.firstBin; j <= band.lastBin; j++) power += 10 ** (spectrum[j] / 10);
      return 10 * Math.log10(power / (band.lastBin - band.firstBin + 1));
    }
    const position = band.center / binHz;
    const below = Math.floor(position);
    const fraction = position - below;
    return spectrum[below] * (1 - fraction) + spectrum[below + 1] * fraction;
  }

  const levels = new Float32Array(numBars);
  const longTermDb = new Float32Array(numBars).fill(NaN);
  let peakDb = -30;
  let lastTime = performance.now();

  function animate(now) {
    const dt = Math.min(0.1, Math.max(0, (now - lastTime) / 1000)) || 1 / 60;
    lastTime = now;
    analyser.getFloatFrequencyData(spectrum);
    for (let j = 0; j < spectrum.length; j++) {
      if (!(spectrum[j] > -160)) spectrum[j] = -160; // silence comes back as -Infinity
    }

    const raw = bands.map(band => bandDb(band) + band.tilt);
    const blend = 1 - Math.exp(-dt / EQ_SECONDS);
    raw.forEach((db, i) => {
      if (db < -120) return; // silence (pause, between songs) is not part of the song
      longTermDb[i] = Number.isNaN(longTermDb[i]) ? db : longTermDb[i] + (db - longTermDb[i]) * blend;
    });
    const known = Array.from(longTermDb).filter(v => !Number.isNaN(v));
    const average = known.length ? known.reduce((a, b) => a + b, 0) / known.length : 0;

    let loudest = -Infinity;
    const values = raw.map((db, i) => {
      const value = Number.isNaN(longTermDb[i]) ? db : db + (average - longTermDb[i]) * EQ_STRENGTH;
      loudest = Math.max(loudest, value);
      return value;
    });

    // Automatic gain: jump up to new peaks, slowly come back down
    peakDb = Math.max(loudest, peakDb - GAIN_FALL_DB_PER_SECOND * dt, -60);

    let bass = 0;
    for (let i = 0; i < numBars; i++) {
      const target = Math.min(1, Math.max(0, (values[i] - (peakDb - RANGE_DB)) / RANGE_DB));
      const seconds = target > levels[i] ? ATTACK_SECONDS : RELEASE_SECONDS;
      levels[i] += (target - levels[i]) * (1 - Math.exp(-dt / seconds));
      bars[i].style.height = `${levels[i] * 50}vh`;
      if (i < numBars / 4) bass += levels[i];
    }

    // Circle pulse follows the bass, like a kick drum
    const scale = 1 + (bass / (numBars / 4)) * 0.3;
    const hoverScale = isHovered ? 1.15 : 1;
    circle.style.transform = `scale(${scale * hoverScale})`;

    requestAnimationFrame(animate);
  }

  requestAnimationFrame(animate);
}




  circle.addEventListener('click', togglePlay);
});
