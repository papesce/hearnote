const tabs = document.querySelectorAll('.tab');
const tabContents = document.querySelectorAll('.tab-content');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(tc => tc.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(`tab-${tab.dataset.tab}`).classList.add('active');
        if (tab.dataset.tab === 'history') loadHistory();
    });
});

// --- Model Selector ---
const modelSelect = document.getElementById('model-select');

async function loadCurrentModel() {
    try {
        const resp = await fetch('/api/settings/model');
        const data = await resp.json();
        modelSelect.value = data.size;
    } catch {}
}

modelSelect.addEventListener('change', async () => {
    try {
        await fetch('/api/settings/model', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ size: modelSelect.value }),
        });
    } catch {}
});

loadCurrentModel();

// --- Live Recording ---
const audioSourceSelect = document.getElementById('audio-source');
const btnStart = document.getElementById('btn-start');
const btnStop = document.getElementById('btn-stop');
const liveStatus = document.getElementById('live-status');
const liveTranscript = document.getElementById('live-transcript');
const btnSummarizeLive = document.getElementById('btn-summarize-live');
const btnCopilotLive = document.getElementById('btn-copilot-live');
const liveActions = document.getElementById('live-actions');
const liveSummary = document.getElementById('live-summary');

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
    const CHUNK_DURATION = 4;
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
        liveActions.style.display = 'none';
        liveSummary.style.display = 'none';
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

    const text = liveTranscript.innerText.trim();
    if (text && !liveTranscript.querySelector('.placeholder')) {
        liveActions.style.display = 'flex';
    }
}

// --- Upload MP4 ---
const fileInput = document.getElementById('file-input');
const btnUpload = document.getElementById('btn-upload');
const uploadStatus = document.getElementById('upload-status');
const uploadTranscript = document.getElementById('upload-transcript');
const btnSummarizeUpload = document.getElementById('btn-summarize-upload');
const btnCopilotUpload = document.getElementById('btn-copilot-upload');
const uploadActions = document.getElementById('upload-actions');
const uploadSummary = document.getElementById('upload-summary');

fileInput.addEventListener('change', () => {
    btnUpload.disabled = !fileInput.files.length;
});

btnUpload.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) return;

    btnUpload.disabled = true;
    uploadTranscript.innerHTML = '';
    uploadActions.style.display = 'none';
    uploadSummary.style.display = 'none';
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
        uploadActions.style.display = 'flex';
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

// --- Summarize ---
btnSummarizeLive.addEventListener('click', () => {
    const text = liveTranscript.innerText.trim();
    summarize(text, btnSummarizeLive, liveSummary);
});

btnSummarizeUpload.addEventListener('click', () => {
    const text = uploadTranscript.innerText.trim();
    summarize(text, btnSummarizeUpload, uploadSummary);
});

// --- Copy for Copilot ---
btnCopilotLive.addEventListener('click', () => {
    const text = liveTranscript.innerText.trim();
    copyForCopilot(text, btnCopilotLive);
});

btnCopilotUpload.addEventListener('click', () => {
    const text = uploadTranscript.innerText.trim();
    copyForCopilot(text, btnCopilotUpload);
});

function copyForCopilot(transcript, button) {
    if (!transcript) return;

    const prompt = `Summarize this meeting transcript. Please extract and format clearly:

## Key Decisions
- List each decision made during the meeting

## Action Items
- List each action item with the owner (if mentioned) and deadline (if mentioned)

## Open Questions
- List any unresolved questions or topics needing follow-up

## Brief Summary
- 2-3 sentence overview of what was discussed

Be concise and professional.

---
TRANSCRIPT:
${transcript}`;

    navigator.clipboard.writeText(prompt).then(() => {
        const original = button.textContent;
        button.textContent = 'Copied! Paste into any AI chat';
        button.classList.add('copied');
        setTimeout(() => {
            button.textContent = original;
            button.classList.remove('copied');
        }, 3000);
    });
}

async function summarize(text, button, summaryBox) {
    if (!text) return;

    button.disabled = true;
    button.textContent = 'Summarizing...';
    summaryBox.style.display = 'block';
    summaryBox.innerHTML = '<p class="processing-text">Generating summary with local AI...</p>';

    try {
        const resp = await fetch('/api/summarize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ text }),
        });

        if (!resp.ok) {
            const err = await resp.json();
            throw new Error(err.detail || `Error ${resp.status}`);
        }

        const data = await resp.json();
        summaryBox.innerHTML = formatSummary(data.summary);
    } catch (err) {
        summaryBox.innerHTML = `<p class="error-text">${err.message}</p>`;
    } finally {
        button.disabled = false;
        button.textContent = 'Summarize with AI';
    }
}

function formatSummary(text) {
    return text
        .replace(/^## (.+)$/gm, '<h3>$1</h3>')
        .replace(/^- (.+)$/gm, '<li>$1</li>')
        .replace(/(<li>.*<\/li>)/s, '<ul>$1</ul>')
        .split('\n')
        .map(line => {
            if (line.startsWith('<h3>') || line.startsWith('<li>') || line.startsWith('<ul>') || line.startsWith('</ul>')) return line;
            if (line.trim() === '') return '';
            return `<p>${line}</p>`;
        })
        .join('\n');
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

// --- History Tab ---
const historyList = document.getElementById('history-list');
const historyDetail = document.getElementById('history-detail');
const historyMeta = document.getElementById('history-meta');
const historyTranscript = document.getElementById('history-transcript');
const btnBackHistory = document.getElementById('btn-back-history');

btnBackHistory.addEventListener('click', () => {
    historyDetail.style.display = 'none';
    historyList.style.display = 'block';
});

async function loadHistory() {
    historyList.innerHTML = '<p class="placeholder">Loading...</p>';
    historyDetail.style.display = 'none';
    historyList.style.display = 'block';

    try {
        const resp = await fetch('/api/transcripts');
        const data = await resp.json();

        if (data.transcripts.length === 0) {
            historyList.innerHTML = '<p class="placeholder">No transcripts yet. Record or upload something first.</p>';
            return;
        }

        historyList.innerHTML = '';
        data.transcripts.forEach(t => {
            const item = document.createElement('div');
            item.className = 'history-item';

            const date = new Date(t.timestamp);
            const dateStr = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
            const timeStr = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });

            item.innerHTML = `
                <div class="history-item-content">
                    <div class="history-item-header">
                        <span class="history-source ${t.source}">${t.source}</span>
                        <span class="history-date">${dateStr} ${timeStr}</span>
                        ${t.filename ? `<span class="history-filename">${t.filename}</span>` : ''}
                    </div>
                    <p class="history-preview">${t.preview}...</p>
                </div>
                <button class="btn-delete-history" data-id="${t.id}" title="Delete">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4a2 2 0 012-2h4a2 2 0 012 2v2m3 0v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6h14"/></svg>
                </button>
            `;

            item.querySelector('.history-item-content').addEventListener('click', () => viewTranscript(t.id));
            item.querySelector('.btn-delete-history').addEventListener('click', (e) => {
                e.stopPropagation();
                deleteTranscript(t.id);
            });

            historyList.appendChild(item);
        });
    } catch {
        historyList.innerHTML = '<p class="placeholder">Failed to load history.</p>';
    }
}

async function viewTranscript(id) {
    try {
        const resp = await fetch(`/api/transcripts/${id}`);
        const data = await resp.json();

        const date = new Date(data.timestamp);
        historyMeta.innerHTML = `
            <span class="history-source ${data.source}">${data.source}</span>
            <span>${date.toLocaleString()}</span>
            ${data.filename ? `<span>${data.filename}</span>` : ''}
        `;

        if (data.segments) {
            historyTranscript.innerHTML = '';
            data.segments.forEach(seg => {
                const div = document.createElement('div');
                div.className = 'segment';
                const ts = document.createElement('span');
                ts.className = 'timestamp';
                ts.textContent = formatTime(seg.start);
                div.appendChild(ts);
                div.appendChild(document.createTextNode(seg.text));
                historyTranscript.appendChild(div);
            });
        } else {
            historyTranscript.textContent = data.text;
        }

        historyList.style.display = 'none';
        historyDetail.style.display = 'block';
    } catch {
        historyList.innerHTML = '<p class="placeholder">Failed to load transcript.</p>';
    }
}

async function deleteTranscript(id) {
    try {
        await fetch(`/api/transcripts/${id}`, { method: 'DELETE' });
        loadHistory();
    } catch {}
}
