// --- Utility ---
function setActionButtonsEnabled(container, enabled) {
    container.querySelectorAll('.btn').forEach(btn => {
        btn.disabled = !enabled;
    });
}

function updateWordCount(transcriptEl, countEl) {
    const text = transcriptEl.innerText.trim();
    if (!text || transcriptEl.querySelector('.placeholder')) {
        countEl.textContent = '';
        return;
    }
    const words = text.split(/\s+/).filter(Boolean).length;
    countEl.textContent = `${words} word${words !== 1 ? 's' : ''}`;
}

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
    const lang = document.getElementById('lang-live').value;
    const langParam = lang ? `?lang=${lang}` : '';
    websocket = new WebSocket(`${wsProtocol}//${window.location.host}/ws/transcribe${langParam}`);

    websocket.onopen = () => {
        isRecording = true;
        btnStart.style.display = 'none';
        btnStop.style.display = 'inline-block';
        liveTranscript.innerHTML = '';
        liveTranscript.classList.remove('has-content');
        setActionButtonsEnabled(liveActions, false);
        liveSummary.style.display = 'none';
        document.getElementById('live-word-count').textContent = '';
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
            liveTranscript.classList.add('has-content');
            setActionButtonsEnabled(liveActions, true);
            updateWordCount(liveTranscript, document.getElementById('live-word-count'));
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
    btnStart.style.display = 'inline-block';
    btnStop.style.display = 'none';
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
        setActionButtonsEnabled(liveActions, true);
    }
}

// --- Upload MP4 ---
const fileInput = document.getElementById('file-input');
const btnUpload = document.getElementById('btn-upload');
const btnCancelUpload = document.getElementById('btn-cancel-upload');
const uploadStatus = document.getElementById('upload-status');
const uploadTranscript = document.getElementById('upload-transcript');
const btnSummarizeUpload = document.getElementById('btn-summarize-upload');
const btnCopilotUpload = document.getElementById('btn-copilot-upload');
const uploadActions = document.getElementById('upload-actions');
const uploadSummary = document.getElementById('upload-summary');
const uploadProgressContainer = document.getElementById('upload-progress-container');
const uploadProgressBar = document.getElementById('upload-progress-bar');
const uploadProgressText = document.getElementById('upload-progress-text');
const uploadTimer = document.getElementById('upload-timer');

let currentJobId = null;
let uploadTimerInterval = null;
let uploadStartTime = null;

// Initialize action buttons as disabled until there's content
setActionButtonsEnabled(liveActions, false);
setActionButtonsEnabled(uploadActions, false);

// --- Drag and Drop ---
const dropZone = document.getElementById('drop-zone');
const dropZoneFilename = document.getElementById('drop-zone-filename');

dropZone.addEventListener('click', () => fileInput.click());

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    const file = e.dataTransfer.files[0];
    if (file) {
        const dt = new DataTransfer();
        dt.items.add(file);
        fileInput.files = dt.files;
        fileInput.dispatchEvent(new Event('change'));
    }
});

fileInput.addEventListener('change', () => {
    const hasFile = fileInput.files.length > 0;
    btnUpload.disabled = !hasFile;
    if (hasFile) {
        dropZoneFilename.textContent = fileInput.files[0].name;
    } else {
        dropZoneFilename.textContent = '';
    }
});

btnCancelUpload.addEventListener('click', async () => {
    if (currentJobId) {
        try {
            await fetch(`/api/transcribe/cancel/${currentJobId}`, { method: 'POST' });
        } catch {}
    }
});

btnUpload.addEventListener('click', async () => {
    const file = fileInput.files[0];
    if (!file) return;

    btnUpload.disabled = true;
    btnCancelUpload.style.display = 'inline-block';
    uploadTranscript.innerHTML = '';
    uploadTranscript.classList.remove('has-content');
    setActionButtonsEnabled(uploadActions, false);
    uploadSummary.style.display = 'none';
    document.getElementById('upload-word-count').textContent = '';
    const previewEl = document.getElementById('upload-preview');
    if (previewEl) previewEl.style.display = 'none';
    uploadStatus.textContent = `Processing "${file.name}"...`;
    uploadStatus.className = 'status processing';
    uploadProgressContainer.style.display = 'flex';
    uploadProgressBar.style.width = '0%';
    uploadProgressText.textContent = '';
    uploadTimer.textContent = '0s';
    currentJobId = null;
    uploadStartTime = Date.now();
    uploadTimerInterval = setInterval(() => {
        const elapsed = Math.floor((Date.now() - uploadStartTime) / 1000);
        if (elapsed < 60) {
            uploadTimer.textContent = `${elapsed}s`;
        } else {
            const m = Math.floor(elapsed / 60);
            const s = elapsed % 60;
            uploadTimer.textContent = `${m}m ${s}s`;
        }
    }, 1000);

    const formData = new FormData();
    formData.append('file', file);

    let cancelled = false;

    try {
        const uploadLang = document.getElementById('lang-upload').value;
        const uploadLangParam = uploadLang ? `?lang=${uploadLang}` : '';
        const response = await fetch(`/api/transcribe/stream${uploadLangParam}`, {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            throw new Error(`Server error: ${response.status}`);
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder();
        let buffer = '';
        let segmentCount = 0;
        let duration = null;

        while (true) {
            const { done, value } = await reader.read();
            if (done) break;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop();

            for (const line of lines) {
                if (line.startsWith('event: job')) {
                    // next data line has jobId
                } else if (line.startsWith('event: cancelled')) {
                    cancelled = true;
                } else if (line.startsWith('data: ')) {
                    const payload = line.slice(6);
                    try {
                        const data = JSON.parse(payload);
                        if (data.jobId) {
                            currentJobId = data.jobId;
                        } else if (data.text) {
                            segmentCount++;
                            if (!duration && data.duration) duration = data.duration;

                            const div = document.createElement('div');
                            div.className = 'segment';
                            const ts = document.createElement('span');
                            ts.className = 'timestamp';
                            ts.textContent = formatTime(data.start);
                            div.appendChild(ts);
                            div.appendChild(document.createTextNode(data.text));
                            uploadTranscript.appendChild(div);
                            uploadTranscript.scrollTop = uploadTranscript.scrollHeight;

                            // Update progress
                            if (duration && data.end) {
                                const pct = Math.min(100, Math.round((data.end / duration) * 100));
                                uploadProgressBar.style.width = `${pct}%`;
                                uploadProgressText.textContent = `${formatTime(data.end)} / ${formatTime(duration)} (${pct}%)`;
                            }
                            uploadStatus.textContent = `Processing "${file.name}"... ${segmentCount} segments`;

                            // Enable action buttons as soon as first segment arrives
                            if (segmentCount === 1) {
                                uploadTranscript.classList.add('has-content');
                                setActionButtonsEnabled(uploadActions, true);
                            }
                            updateWordCount(uploadTranscript, document.getElementById('upload-word-count'));
                        }
                    } catch {}
                }
            }
        }

        if (cancelled) {
            uploadStatus.textContent = `Cancelled — ${segmentCount} segments transcribed before stopping.`;
            uploadStatus.className = 'status recording';
            uploadProgressBar.style.width = '100%';
            uploadProgressBar.classList.add('cancelled');
        } else {
            uploadStatus.textContent = `Done — ${segmentCount} segments transcribed.`;
            uploadStatus.className = 'status done';
            uploadProgressBar.style.width = '100%';
            if (segmentCount > 0) setActionButtonsEnabled(uploadActions, true);
        }
    } catch (err) {
        uploadStatus.textContent = `Error: ${err.message}`;
        uploadStatus.className = 'status recording';
    } finally {
        btnUpload.disabled = false;
        btnCancelUpload.style.display = 'none';
        currentJobId = null;
        if (uploadTimerInterval) {
            clearInterval(uploadTimerInterval);
            uploadTimerInterval = null;
        }
        setTimeout(() => {
            uploadProgressContainer.style.display = 'none';
            uploadProgressBar.classList.remove('cancelled');
        }, 3000);
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

// --- Prompt Builder ---
function buildSummaryPrompt(transcript) {
    return `Summarize this meeting transcript. Please extract and format clearly:

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
}

// --- Copy for AI chat ---
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
    const prompt = buildSummaryPrompt(transcript);
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

// --- Preview Prompt ---
document.getElementById('btn-preview-live').addEventListener('click', () => {
    togglePreview('live', liveTranscript.innerText.trim());
});

document.getElementById('btn-preview-upload').addEventListener('click', () => {
    togglePreview('upload', uploadTranscript.innerText.trim());
});

document.getElementById('btn-preview-history').addEventListener('click', () => {
    togglePreview('history', historyTranscript.innerText.trim());
});

function togglePreview(target, transcript) {
    const preview = document.getElementById(`${target}-preview`);
    const previewText = document.getElementById(`${target}-preview-text`);
    const btn = document.getElementById(`btn-preview-${target}`);

    if (preview.style.display === 'none') {
        previewText.textContent = buildSummaryPrompt(transcript);
        preview.style.display = 'block';
        btn.textContent = 'Hide prompt';
    } else {
        preview.style.display = 'none';
        btn.textContent = 'Preview prompt';
    }
}

document.querySelectorAll('.btn-copy-preview').forEach(btn => {
    btn.addEventListener('click', () => {
        const target = btn.dataset.target;
        const text = document.getElementById(`${target}-preview-text`).textContent;
        navigator.clipboard.writeText(text).then(() => {
            const original = btn.textContent;
            btn.textContent = 'Copied!';
            setTimeout(() => { btn.textContent = original; }, 2000);
        });
    });
});

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
const btnSummarizeHistory = document.getElementById('btn-summarize-history');
const btnCopilotHistory = document.getElementById('btn-copilot-history');
const historySummary = document.getElementById('history-summary');
const historySearchInput = document.getElementById('history-search');

let allTranscripts = [];

btnBackHistory.addEventListener('click', () => {
    historyDetail.style.display = 'none';
    historyList.style.display = 'block';
    historySummary.style.display = 'none';
});

btnSummarizeHistory.addEventListener('click', () => {
    const text = historyTranscript.innerText.trim();
    summarize(text, btnSummarizeHistory, historySummary);
});

btnCopilotHistory.addEventListener('click', () => {
    const text = historyTranscript.innerText.trim();
    copyForCopilot(text, btnCopilotHistory);
});

document.getElementById('copy-history').addEventListener('click', (e) => {
    copyTranscript(historyTranscript, e.currentTarget);
});

historySearchInput.addEventListener('input', () => {
    renderHistoryList(historySearchInput.value.trim().toLowerCase());
});

async function loadHistory() {
    historyList.innerHTML = '<p class="placeholder">Loading...</p>';
    historyDetail.style.display = 'none';
    historyList.style.display = 'block';

    try {
        const resp = await fetch('/api/transcripts');
        const data = await resp.json();
        allTranscripts = data.transcripts;
        renderHistoryList(historySearchInput.value.trim().toLowerCase());
    } catch {
        historyList.innerHTML = '<p class="placeholder">Failed to load history.</p>';
    }
}

function renderHistoryList(query) {
    const filtered = query
        ? allTranscripts.filter(t => t.preview.toLowerCase().includes(query) || (t.filename && t.filename.toLowerCase().includes(query)))
        : allTranscripts;

    if (allTranscripts.length === 0) {
        historyList.innerHTML = `
            <div class="history-empty">
                <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                    <circle cx="12" cy="12" r="10"/>
                    <polyline points="12 6 12 12 16 14"/>
                </svg>
                <p>No recordings yet</p>
                <p class="history-empty-hint">Record live or upload a file to get started</p>
            </div>`;
        return;
    }

    if (filtered.length === 0) {
        historyList.innerHTML = '<p class="placeholder">No results matching your search.</p>';
        return;
    }

    historyList.innerHTML = '';
    filtered.forEach(t => {
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
