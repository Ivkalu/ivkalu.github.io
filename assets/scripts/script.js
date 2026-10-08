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

  // Flat list of all songs from assets/songs.json: { title, path, button }
  let playlist = [];
  let currentIndex = -1;

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

  function loadSong(index) {
    currentIndex = index;
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
    playlist.forEach((song, i) => song.button.classList.toggle('active', i === index));
  }

  function playSong(index) {
    if (!playlist.length) return;
    loadSong((index + playlist.length) % playlist.length);
    play();
  }

  // ---------- Shuffle & repeat ----------

  let shuffle = false;
  let repeatMode = 'off'; // 'off' -> 'all' -> 'one'
  const playedHistory = [];

  shuffleButton.addEventListener('click', () => {
    shuffle = !shuffle;
    shuffleButton.classList.toggle('active', shuffle);
    shuffleButton.setAttribute('aria-pressed', shuffle);
  });

  repeatButton.addEventListener('click', () => {
    repeatMode = { off: 'all', all: 'one', one: 'off' }[repeatMode];
    repeatButton.classList.toggle('active', repeatMode !== 'off');
    repeatButton.classList.toggle('repeat-one-mode', repeatMode === 'one');
    repeatButton.setAttribute('aria-label', 'Repeat: ' + repeatMode);
  });

  // Index of the song after the current one, or -1 when the playlist is over
  function nextIndex() {
    if (shuffle && playlist.length > 1) {
      let index;
      do {
        index = Math.floor(Math.random() * playlist.length);
      } while (index === currentIndex);
      return index;
    }
    const index = currentIndex + 1;
    if (index < playlist.length) return index;
    return repeatMode === 'all' ? 0 : -1;
  }

  function playNext() {
    const index = nextIndex();
    if (index === -1) {
      // Pressing next on the last song still wraps around, like Spotify
      playSong(0);
      return;
    }
    if (currentIndex !== -1) playedHistory.push(currentIndex);
    playSong(index);
  }

  function playPrevious() {
    // Restart the song first, go to the previous one on a second click
    if (audioPlayer.currentTime > 3 || currentIndex === -1) {
      audioPlayer.currentTime = 0;
    } else if (playedHistory.length) {
      playSong(playedHistory.pop());
    } else {
      playSong(currentIndex - 1);
    }
  }

  playButton.addEventListener('click', togglePlay);
  nextButton.addEventListener('click', playNext);
  prevButton.addEventListener('click', playPrevious);

  // Automatically continue with the next song
  audioPlayer.addEventListener('ended', () => {
    if (repeatMode === 'one') {
      audioPlayer.currentTime = 0;
      audioPlayer.play();
      return;
    }
    const index = nextIndex();
    if (index === -1) return; // end of the playlist with repeat off
    playedHistory.push(currentIndex);
    playSong(index);
  });

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
      nexttrack: playNext,
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
    if (event.key === 'Escape') setSidebarOpen(false);
  });

  fetch('assets/songs.json', { cache: 'no-cache' })
    .then(response => response.json())
    .then(categories => {
      for (const category of categories) {
        const heading = document.createElement('h3');
        heading.textContent = category.name;
        songList.appendChild(heading);

        for (const song of category.songs) {
          const index = playlist.length;
          const button = document.createElement('button');
          button.textContent = song.title;
          button.addEventListener('click', () => {
            playSong(index);
            setSidebarOpen(false);
          });
          songList.appendChild(button);
          playlist.push({ ...song, button });
        }
      }

      const initialIndex = playlist.findIndex(song => song.path === initialSong);
      if (initialIndex !== -1) {
        // The song is already loaded from the URL, only highlight it
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

  analyser.fftSize = 1024; // much better low-frequency resolution
  const bufferLength = analyser.frequencyBinCount; // 512
  const dataArray = new Uint8Array(bufferLength);

  const numBars = 32;
  wave.innerHTML = '';

  for (let i = 0; i < numBars; i++) {
    const bar = document.createElement('div');
    bar.classList.add('bar');
    wave.appendChild(bar);
  }

  const sampleRate = audioContext.sampleRate;
  const nyquist = sampleRate / 2;

  function freqToMel(freq) {
    return 2595 * Math.log10(1 + freq / 700);
  }

  function melToFreq(mel) {
    return 700 * (10 ** (mel / 2595) - 1);
  }

  // Compute mel band edges as FFT bin indices
  const melLow = freqToMel(20); // avoid 0Hz
  const melHigh = freqToMel(nyquist);
  const melBandEdges = [];

  for (let i = 0; i <= numBars; i++) {
    const mel = melLow + (i / numBars) * (melHigh - melLow);
    const freq = melToFreq(mel);
    let bin = Math.floor((freq / nyquist) * bufferLength);
    bin = Math.max(0, Math.min(bufferLength - 1, bin));
    melBandEdges.push(bin);
  }

  // Ensure strictly increasing edges
  for (let i = 1; i < melBandEdges.length; i++) {
    if (melBandEdges[i] <= melBandEdges[i - 1]) {
      melBandEdges[i] = melBandEdges[i - 1] + 1;
    }
  }

  function animate() {
    analyser.getByteFrequencyData(dataArray);
    const bars = document.querySelectorAll('.bar');

    for (let i = 0; i < numBars; i++) {
      const start = melBandEdges[i];
      const end = melBandEdges[i + 1];
      let sum = 0;

      for (let j = start; j < end && j < dataArray.length; j++) {
        sum += dataArray[j];
      }

      const count = end - start || 1;
      const avg = sum / count;
      const height = (avg / 255) * 50;
      bars[i].style.height = `${height}vh`;
    }

    // Circle pulse
    const avgEnergy = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
    const scale = 1 + avgEnergy / 512;
    const hoverScale = isHovered ? 1.15 : 1;
    circle.style.transform = `scale(${scale * hoverScale})`;

    requestAnimationFrame(animate);
  }

  animate();
}




  circle.addEventListener('click', togglePlay);
});
