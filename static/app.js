const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(tc => tc.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
    });
});

// --- Live Recording ---
const audioSourceSelect = document.getElementById('audio-source');
const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const liveStatus = document.getElementById('live-status');
const liveTranscript = document.getElementById('live-transcript');

let mediaStream = null;
let audioContext = null;
let processor = null;
let websocket = null;
let isRecording = false;

async function populateAudioDevices() {
    try {
        await navigator.mediaDevices.getUserMedia({ audio: true });
        const devices = await navigator.mediaDevices.enumerateDevices();
        const audioInputs = devices.filter(d => d.kind === 'audioinput');

        audioSourceSelect.innerHTML = '';
        audioInputs.forEach(device => {
            const option = document.createElement('option');
            option.value = device.deviceId;
            option.textContent = device.label || `Microphone ${audioSourceSelect.length + 1}`;
            audioSourceSelect.appendChild(option);
        });
    } catch (err) {
        liveStatus.textContent = 'Microphone access denied. Please allow microphone access.';
        liveStatus.className = 'status recording';
    }
}

populateAudioDevices();

btnStart.addEventListener('click', startRecording);
btnStop.addEventListener('click', stopRecording);

async function startRecording() {
    const deviceId = audioSourceSelect.value;
    const constraints = {
        audio: {
            deviceId: deviceId ? { exact: deviceId } : undefined,
            sampleRate: 16000,
            channelCount: 1,
            echoCancellation: false,
            noiseSuppression: false,
            autoGainControl: false,
        }
    };

    try {
        mediaStream = await navigator.mediaDevices.getUserMedia(constraints);
    } catch (err) {
        liveStatus.textContent = `Error: ${err.message}`;
        liveStatus.className = 'status recording';
        return;
    }

    audioContext = new AudioContext({ sampleRate: 16000 });
    const source = audioContext.createMediaStreamSource(mediaStream);

    const bufferSize = 4096;
    processor = audioContext.createScriptProcessor(bufferSize, 1, 1);

    let audioBuffer = [];
    const CHUNK_DURATION = 4; // seconds
    const samplesPerChunk = 16000 * CHUNK_DURATION;

    processor.onaudioprocess = (e) => {
        if (!isRecording) return;
        const input = e.inputBuffer.getChannelData(0);
        audioBuffer.push(...input);

        if (audioBuffer.length >= samplesPerChunk) {
            const chunk = new Float32Array(audioBuffer.splice(0, samplesPerChunk));
            if (websocket && websocket.readyState === WebSocket.OPEN) {
                websocket.send(chunk.buffer);
            }
        }
    };

    source.connect(processor);
    processor.connect(audioContext.destination);

    const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    websocket = new WebSocket(`${wsProtocol}//${window.location.host}/ws/transcribe`);

    websocket.onopen = () => {
        isRecording = true;
        btnStart.disabled = true;
        btnStop.disabled = false;
        liveTranscript.innerHTML = '';
        liveStatus.innerHTML = '<span class="recording-indicator"></span>Recording...';
        liveStatus.className = 'status recording';
    };

    websocket.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.text) {
            const span = document.createElement('span');
            span.textContent = data.text + ' ';
            liveTranscript.appendChild(span);
            liveTranscript.scrollTop = liveTranscript.scrollHeight;
        }
    };

    websocket.onerror = () => {
        liveStatus.textContent = 'WebSocket error. Is the server running?';
        liveStatus.className = 'status recording';
        stopRecording();
    };

    websocket.onclose = () => {
        if (isRecording) stopRecording();
    };
}

function stopRecording() {
    isRecording = false;
    btnStart.disabled = false;
    btnStop.disabled = true;
    liveStatus.textContent = 'Stopped.';
    liveStatus.className = 'status done';

    if (processor) {
        processor.disconnect();
        processor = null;
    }
    if (audioContext) {
        audioContext.close();
        audioContext = null;
    }
    if (mediaStream) {
        mediaStream.getTracks().forEach(t => t.stop());
        mediaStream = null;
    }
    if (websocket) {
        websocket.close();
        websocket = null;
    }
}

// --- Upload MP4 ---
const fileInput = document.getElementById('file-input');
const btnUpload = document.getElementById('btn-upload');
const uploadStatus = document.getElementById('upload-status');
const uploadTranscript = document.getElementById('upload-transcript');

fileInput.addEventListener('change', () => {
    btnUpload.disabled = !fileInput.files.length;
});

btnUpload.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) return;

    btnUpload.disabled = true;
    uploadTranscript.innerHTML = '';
    uploadStatus.textContent = `Processing "${file.name}"... This may take a few minutes.`;
    uploadStatus.className = 'status processing';

    const formData = new FormData();
    formData.append('file', file);

    try {
        const response = await fetch('/api/transcribe', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const data = await response.json();
        uploadTranscript.innerHTML = '';

        data.segments.forEach(seg => {
            const div = document.createElement('div');
            div.className = 'segment';

            const ts = document.createElement('span');
            ts.className = 'timestamp';
            ts.textContent = formatTime(seg.start);

            const text = document.createTextNode(seg.text);
            div.appendChild(ts);
            div.appendChild(text);
            uploadTranscript.appendChild(div);
        });

        uploadStatus.textContent = `Done — ${data.segments.length} segments transcribed.`;
        uploadStatus.className = 'status done';
    } catch (err) {
        uploadStatus.textContent = `Error: ${err.message}`;
        uploadStatus.className = 'status recording';
    } finally {
        btnUpload.disabled = false;
    }
});

function formatTime(seconds) {
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

// --- Copy buttons ---
document.getElementById('copy-live').addEventListener('click', (e) => {
    copyTranscript(liveTranscript, e.currentTarget);
});

document.getElementById('copy-upload').addEventListener('click', (e) => {
    copyTranscript(uploadTranscript, e.currentTarget);
});

function copyTranscript(box, button) {
    const text = box.innerText.trim();
    if (!text || box.querySelector('.placeholder')) return;

    navigator.clipboard.writeText(text).then(() => {
        button.classList.add('copied');
        button.querySelector('span').textContent = 'Copied!';
        setTimeout(() => {
            button.classList.remove('copied');
            button.querySelector('span').textContent = 'Copy';
        }, 2000);
    });
}
