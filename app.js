const talkButton = document.getElementById("talkButton");
const playButton = document.getElementById("playButton");
const downloadButton = document.getElementById("downloadButton");
const resetButton = document.getElementById("resetButton");
const statusText = document.getElementById("statusText");
const timerText = document.getElementById("timerText");
const lengthText = document.getElementById("lengthText");
const canvas = document.getElementById("visualizer");
const canvasContext = canvas.getContext("2d");

let mediaRecorder;
let audioChunks = [];
let audioUrl = null;
let audio = null;
let audioContext;
let analyser;
let animationFrame;
let isRecording = false;
let recordingStartTime = 0;
let timerInterval;

const drawIdleState = () => {
  canvasContext.clearRect(0, 0, canvas.width, canvas.height);
  canvasContext.fillStyle = "rgba(122, 165, 255, 0.15)";
  canvasContext.fillRect(0, canvas.height / 2 - 2, canvas.width, 4);
};

drawIdleState();

const formatTime = (ms) => {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes.toString().padStart(2, "0")}:${seconds
    .toString()
    .padStart(2, "0")}`;
};

const updateTimer = () => {
  if (!recordingStartTime) return;
  const elapsed = performance.now() - recordingStartTime;
  timerText.textContent = formatTime(elapsed);
};

const startTimer = () => {
  recordingStartTime = performance.now();
  timerText.textContent = "00:00";
  timerInterval = setInterval(updateTimer, 250);
};

const stopTimer = () => {
  clearInterval(timerInterval);
  timerInterval = null;
  recordingStartTime = 0;
};

const updateControls = (enabled) => {
  playButton.disabled = !enabled;
  downloadButton.disabled = !enabled;
  resetButton.disabled = !enabled;
};

const setupAnalyzer = (stream) => {
  audioContext = new (window.AudioContext || window.webkitAudioContext)();
  analyser = audioContext.createAnalyser();
  analyser.fftSize = 2048;
  const source = audioContext.createMediaStreamSource(stream);
  source.connect(analyser);
};

const drawVisualizer = () => {
  if (!analyser) return;
  const bufferLength = analyser.fftSize;
  const dataArray = new Uint8Array(bufferLength);
  analyser.getByteTimeDomainData(dataArray);

  canvasContext.fillStyle = "rgba(3, 7, 15, 0.6)";
  canvasContext.fillRect(0, 0, canvas.width, canvas.height);

  canvasContext.lineWidth = 2;
  canvasContext.strokeStyle = "#7cf0ff";
  canvasContext.beginPath();

  const sliceWidth = canvas.width / bufferLength;
  let x = 0;

  for (let i = 0; i < bufferLength; i += 1) {
    const v = dataArray[i] / 128.0;
    const y = (v * canvas.height) / 2;

    if (i === 0) {
      canvasContext.moveTo(x, y);
    } else {
      canvasContext.lineTo(x, y);
    }

    x += sliceWidth;
  }

  canvasContext.lineTo(canvas.width, canvas.height / 2);
  canvasContext.stroke();
  animationFrame = requestAnimationFrame(drawVisualizer);
};

const stopVisualizer = () => {
  if (animationFrame) {
    cancelAnimationFrame(animationFrame);
  }
  drawIdleState();
};

const setPlaybackLabel = (isPlaying) => {
  playButton.textContent = isPlaying ? "Pause" : "Play";
};

const updateLengthText = (durationSeconds) => {
  if (!Number.isFinite(durationSeconds)) return;
  lengthText.textContent = `Length ${formatTime(durationSeconds * 1000)}`;
};

const startRecording = async () => {
  if (isRecording) return;
  isRecording = true;
  talkButton.classList.add("is-recording");
  statusText.textContent = "Recording… release to stop.";
  lengthText.textContent = "Recording...";
  startTimer();

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    setupAnalyzer(stream);
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.addEventListener("dataavailable", (event) => {
      audioChunks.push(event.data);
    });

    mediaRecorder.addEventListener("stop", () => {
      const audioBlob = new Blob(audioChunks, { type: "audio/webm" });
      audioUrl = URL.createObjectURL(audioBlob);
      audio = new Audio(audioUrl);
      updateControls(true);
      setPlaybackLabel(false);
      statusText.textContent = "Recording saved. Play it back or download.";
      audio.addEventListener("loadedmetadata", () => {
        updateLengthText(audio.duration);
      });
      audio.addEventListener("ended", () => setPlaybackLabel(false));
      audio.addEventListener("pause", () => setPlaybackLabel(false));
      audio.addEventListener("play", () => setPlaybackLabel(true));
      stopVisualizer();
      stream.getTracks().forEach((track) => track.stop());
      if (audioContext) {
        audioContext.close();
      }
    });

    mediaRecorder.start();
    drawVisualizer();
  } catch (error) {
    statusText.textContent = "Microphone access denied.";
    isRecording = false;
    talkButton.classList.remove("is-recording");
    lengthText.textContent = "Mic access needed";
    stopTimer();
    stopVisualizer();
  }
};

const stopRecording = () => {
  if (!isRecording || !mediaRecorder) return;
  isRecording = false;
  talkButton.classList.remove("is-recording");
  stopTimer();
  if (mediaRecorder.state !== "inactive") {
    mediaRecorder.stop();
  }
};

const resetRecording = () => {
  if (audioUrl) {
    URL.revokeObjectURL(audioUrl);
  }
  audioUrl = null;
  audio = null;
  updateControls(false);
  setPlaybackLabel(false);
  statusText.textContent = "Ready. Press and hold to speak.";
  lengthText.textContent = "No recording yet";
  timerText.textContent = "00:00";
  drawIdleState();
};

talkButton.addEventListener("mousedown", startRecording);

talkButton.addEventListener("touchstart", (event) => {
  event.preventDefault();
  startRecording();
});

talkButton.addEventListener("mouseup", stopRecording);

talkButton.addEventListener("mouseleave", stopRecording);

talkButton.addEventListener("touchend", stopRecording);

talkButton.addEventListener("keydown", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    startRecording();
  }
});

talkButton.addEventListener("keyup", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    stopRecording();
  }
});

playButton.addEventListener("click", () => {
  if (audio) {
    if (audio.paused) {
      audio.play();
    } else {
      audio.pause();
    }
  }
});

downloadButton.addEventListener("click", () => {
  if (!audioUrl) return;
  const link = document.createElement("a");
  link.href = audioUrl;
  link.download = "sotto-recording.webm";
  document.body.appendChild(link);
  link.click();
  link.remove();
});

resetButton.addEventListener("click", resetRecording);

window.addEventListener("keydown", (event) => {
  if (event.code === "Space" && document.activeElement !== talkButton) {
    event.preventDefault();
    talkButton.focus();
    startRecording();
  }
});

window.addEventListener("keyup", (event) => {
  if (event.code === "Space") {
    event.preventDefault();
    stopRecording();
  }
});

if (!navigator.mediaDevices || !window.MediaRecorder) {
  talkButton.disabled = true;
  statusText.textContent =
    "This browser does not support in-browser recording.";
  lengthText.textContent = "Try a modern browser";
}
