const circle = document.querySelector('.circle');
const wave = document.querySelector('.wave');
const audioPlayer = document.getElementById('audioPlayer');

let hasStarted = false;

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
      const height = (dataArray[index]/255)*(1+2*index/bufferLength)*50;
      bar.style.height = `${height}vh`;
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
  if (audioPlayer.paused || audioPlayer.ended) {
    audioPlayer.play();
  } else {
    audioPlayer.pause();
  }
});