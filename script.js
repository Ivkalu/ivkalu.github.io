document.addEventListener('DOMContentLoaded', () => {
  const circle = document.querySelector('.circle');
  const wave = document.querySelector('.wave');
  const audioPlayer = document.getElementById('audioPlayer');

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
    const source = audioContext.createMediaElementSource(audioPlayer);

    source.connect(analyser);
    analyser.connect(audioContext.destination);

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

      // Calculate average volume
      const avg = dataArray.reduce((sum, value) => sum + value, 0) / bufferLength;

      // Scale the circle based on volume (range: 1 to 1.3)
      const scale = 1 + avg / 512;
      // circle.style.transform = `scale(${scale})`;
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
