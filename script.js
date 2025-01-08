const circle = document.querySelector('.circle');
const audioPlayer = document.getElementById('audioPlayer');

let hasStarted = false;
let isPlaying = false;

const start = () => {
  const audioContext = new (window.AudioContext || window.webkitAudioContext)();
  const analyser = audioContext.createAnalyser();
  const source = audioContext.createMediaElementSource(audioPlayer);

  source.connect(analyser);
  analyser.connect(audioContext.destination);

  analyser.fftSize = 256;
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  function animate() {
    analyser.getByteFrequencyData(dataArray);

    const bassRangeStart = Math.floor(20 / (audioContext.sampleRate / analyser.fftSize));;
    const bassRangeEnd = Math.floor(220 / (audioContext.sampleRate / analyser.fftSize));

    let bassSum = 0;
    for (let i = bassRangeStart; i < bassRangeEnd; i++) {
      bassSum += dataArray[i];
    }
    const averageBassLoudness = bassSum / (bassRangeEnd - bassRangeStart);

    const scale = Math.max(1, averageBassLoudness / 100);
    circle.style.transform = `scale(${scale})`;

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
    circle.style.transform = 'scale(1)';
  } else {
    audioPlayer.play();
  }
  isPlaying = !isPlaying;
});