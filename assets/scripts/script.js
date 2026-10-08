document.addEventListener('DOMContentLoaded', () => {


  const circle = document.querySelector('.circle');
  const wave = document.querySelector('.wave');
  const audioPlayer = document.getElementById('audioPlayer');

  const playbar = document.getElementById('playbar');
  const playButton = document.getElementById('playButton');
  const prevButton = document.getElementById('prevButton');
  const nextButton = document.getElementById('nextButton');
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
    seekBar.value = 0;
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

  playButton.addEventListener('click', togglePlay);
  nextButton.addEventListener('click', () => playSong(currentIndex + 1));
  prevButton.addEventListener('click', () => {
    // Like most players: restart the song first, go to the previous one on a second click
    if (audioPlayer.currentTime > 3 || currentIndex === -1) {
      audioPlayer.currentTime = 0;
    } else {
      playSong(currentIndex - 1);
    }
  });

  // Automatically continue with the next song
  audioPlayer.addEventListener('ended', () => playSong(currentIndex + 1));

  audioPlayer.addEventListener('play', () => playbar.classList.add('playing'));
  audioPlayer.addEventListener('pause', () => playbar.classList.remove('playing'));

  let isSeeking = false;

  audioPlayer.addEventListener('loadedmetadata', () => {
    seekBar.max = audioPlayer.duration;
    durationLabel.textContent = formatTime(audioPlayer.duration);
  });

  audioPlayer.addEventListener('timeupdate', () => {
    if (!isSeeking) {
      seekBar.value = audioPlayer.currentTime;
      currentTimeLabel.textContent = formatTime(audioPlayer.currentTime);
    }
  });

  seekBar.addEventListener('input', () => {
    isSeeking = true;
    currentTimeLabel.textContent = formatTime(seekBar.value);
  });

  seekBar.addEventListener('change', () => {
    audioPlayer.currentTime = seekBar.value;
    isSeeking = false;
  });

  volumeBar.addEventListener('input', () => {
    audioPlayer.volume = volumeBar.value;
  });

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
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
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
