document.addEventListener('DOMContentLoaded', () => {


  const circle = document.querySelector('.circle');
  const wave = document.querySelector('.wave');
  const audioPlayer = document.getElementById('audioPlayer');

  // Get song from URL
  const urlParams = new URLSearchParams(window.location.search);
  const song = urlParams.get('song') || 'song.mp3'; // fallback to default

  // Set audio source
  const source = document.getElementById('audioSource');
  source.src = song;

  // Reload the audio element to apply new source
  audioPlayer.load();

  let hasStarted = false;

  let isHovered = false;

  circle.addEventListener('mouseenter', () => {
    isHovered = true;
  });

  circle.addEventListener('mouseleave', () => {
    isHovered = false;
  });

  function start() {
    const audioContext = new (window.AudioContext || window.webkitAudioContext)();
    const analyser = audioContext.createAnalyser();

    // Only create source node after ensuring it's not already created
    if (!audioPlayer._sourceNode) {
      const sourceNode = audioContext.createMediaElementSource(audioPlayer);
      audioPlayer._sourceNode = sourceNode; // save it to avoid duplicate creation
      sourceNode.connect(analyser);
      analyser.connect(audioContext.destination);
    }

    analyser.fftSize = 64;
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    for (let i = 0; i < bufferLength; i++) {
      const bar = document.createElement('div');
      bar.classList.add('bar');
      wave.appendChild(bar);
    }

    function animate() {
      const bars = document.querySelectorAll('.bar');
      analyser.getByteFrequencyData(dataArray);

      bars.forEach((bar, index) => {
        const height = (dataArray[index] / 255) * (1 + 3 * index / bufferLength) * 50;
        bar.style.height = `${height}vh`;
      });

      const avg = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;
      const scale = 1 + avg / 512;
      const hoverScale = isHovered ? 1.15 : 1;
      const combinedScale = scale * hoverScale;
      circle.style.transform = `scale(${combinedScale})`;

      requestAnimationFrame(animate);
    }

    animate();
  }


  circle.addEventListener('click', () => {
    if (!hasStarted) {
      hasStarted = true;
      start();
    }
    if (audioPlayer.paused || audioPlayer.ended) {
      audioPlayer.play();
    } else {
      audioPlayer.pause();
    }
  });
});
