const circle = document.querySelector('.circle');
const wave = document.querySelector('.wave');
const audioPlayer = document.getElementById('audioPlayer');

let hasStarted = false;
let isPlaying = false;

const start = () => {
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
  const bars = document.querySelectorAll('.bar');

  function animate() {
    analyser.getByteFrequencyData(dataArray);
    
    bars.forEach((bar, index) => {
      const height = dataArray[index]; // Frequency value for this bar
      bar.style.height = `${height/5}vh`; // Scale it down for visualization
    });

    requestAnimationFrame(animate);
  }

  animate();
}

circle.addEventListener('click', () => {
  if (!hasStarted) {
    hasStarted = true;
    start()
  }
  if (isPlaying) {
    audioPlayer.pause();
  } else {
    audioPlayer.play();
  }
  isPlaying = !isPlaying;
});