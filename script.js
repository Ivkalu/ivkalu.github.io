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
