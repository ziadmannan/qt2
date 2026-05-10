let surahs = [];
let userData = JSON.parse(localStorage.getItem('hifzData')) || [];
let _needsSave = false;
userData.forEach(u => { if (u.pinned === undefined) { u.pinned = false; _needsSave = true; } });
if (_needsSave) localStorage.setItem('hifzData', JSON.stringify(userData));
let cycleStartDate = localStorage.getItem('cycleStartDate') || new Date().toISOString();
let cycleLength = parseInt(localStorage.getItem('cycleLength')) || 7;
let cycleTrackingEnabled = localStorage.getItem('cycleTrackingEnabled') === 'true';
let showRevised = localStorage.getItem('showRevisedSetting') === null ? true : JSON.parse(localStorage.getItem('showRevisedSetting'));
let streakData = JSON.parse(localStorage.getItem('streakData')) || { count: 0, lastDate: null };
let toastTimeout;

let carouselInterval;
let currentSlide = 0;
const slidesData = [
    '"Add Surahs" to your revision tracker and start revising.',
    "Swipe left on a surah when you've revised it. Swipe right to undo the revision. Or you can click the tick icon.",
    'To hide surahs that you\'ve revised, press the "Show/Hide Surahs".',
    'When you\'ve revised all your surahs, you can "Restart Revision" and start again!'
];

function loadIcons(container = document) {
    container.querySelectorAll('.icon-load').forEach(el => {
        const src = el.getAttribute('data-src');
        if (!src) return;
        fetch(src).then(r => r.text()).then(data => {
            el.innerHTML = data;
            const s = el.querySelector('svg');
            if (s) { s.setAttribute('width', '100%'); s.setAttribute('height', '100%'); s.setAttribute('fill', 'currentColor'); }
        });
    });
}

async function loadSurahData() {
    const response = await fetch('surahs.json');
    surahs = await response.json();
    calculateStreak();
    renderMainScreen();
    renderFullList();
}

function fireConfetti() {
    const colors = ['#2e7d32', '#4caf50', '#81c784', '#ff9800', '#ffffff'];
    for (let i = 0; i < 50; i++) {
        const c = document.createElement('div');
        c.className = 'confetti';
        c.style.left = Math.random() * 100 + 'vw';
        c.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
        c.style.width = c.style.height = Math.random() * 8 + 4 + 'px';
        c.style.animation = `fall ${Math.random() * 3 + 2}s linear forwards`;
        document.body.appendChild(c);
        setTimeout(() => c.remove(), 5000);
    }
}

function renderMainScreen() {
    if (carouselInterval) clearInterval(carouselInterval);
    const total = userData.length;
    const revisedCount = userData.filter(u => u.revised).length;
    const totalPages = userData.reduce((s, u) => s + (surahs.find(s2 => s2.id === u.id)?.pages || 0), 0);
    const revisedPages = userData.filter(u => u.revised).reduce((s, u) => s + (surahs.find(s2 => s2.id === u.id)?.pages || 0), 0);
    document.getElementById('progress-text').innerText = `${revisedCount}/${total} · ${totalPages > 0 ? Math.round((revisedPages/totalPages)*100) : 0}%`;
    document.getElementById('progress-bar').style.width = `${totalPages > 0 ? (revisedPages/totalPages)*100 : 0}%`;
    const navEye = document.getElementById('nav-eye');
    showRevised ? navEye.classList.add('active') : navEye.classList.remove('active');
    const container = document.getElementById('main-list');
    container.innerHTML = '';
    const list = surahs.filter(s => {
        const r = userData.find(u => u.id === s.id);
        return r && (r.pinned || showRevised || !r.revised);
    }).sort((a, b) => {
        const aPin = userData.find(u => u.id === a.id).pinned ? 0 : 1;
        const bPin = userData.find(u => u.id === b.id).pinned ? 0 : 1;
        return aPin - bPin || a.id - b.id;
    });

    if (list.length === 0) {
        const emptyDiv = document.createElement('div');
        emptyDiv.className = 'empty-state';
        if (userData.length === 0) {
            emptyDiv.innerHTML = `
                <h2>Start Revising</h2>
                <div class="carousel-container" id="carousel-container">
                    <div class="carousel-track" id="carousel-track">
                        ${slidesData.map(text => `<div class="carousel-slide">${text}</div>`).join('')}
                    </div>
                    <div class="carousel-dots" id="carousel-dots">
                        ${slidesData.map((_, i) => `<div class="dot ${i === 0 ? 'active' : ''}" onclick="setSlide(${i})"></div>`).join('')}
                    </div>
                </div>`;
            container.appendChild(emptyDiv);
            initCarouselSwipe();
            startCarousel();
        } else if (!showRevised && revisedCount === total) {
            emptyDiv.innerHTML = `<h2>Well Done!</h2><p>Alhamdulillah you've completed revising all your surahs. Start revising again by restarting your revision cycle</p>`;
            container.appendChild(emptyDiv);
        } else {
            emptyDiv.innerHTML = `<p>No surahs found in this view.</p>`;
            container.appendChild(emptyDiv);
        }
        return;
    }

    list.forEach((s, i) => {
        const r = userData.find(u => u.id === s.id);
        const prevR = i > 0 ? userData.find(u => u.id === list[i - 1].id) : null;
        if (i > 0 && !r.pinned && prevR.pinned) {
            const sep = document.createElement('div');
            sep.className = 'pin-separator';
            container.appendChild(sep);
        }
        const wrapper = document.createElement('div');
        const isPinnedRevised = r.revised && r.pinned;
        wrapper.className = `surah-wrapper ${r.revised && !isPinnedRevised ? 'is-revised' : ''}`;
        const swipeBg = isPinnedRevised
            ? '<div class="swipe-bg bg-left" style="background:var(--undo)">UNDO ↺</div><div class="swipe-bg bg-right" style="background:var(--primary)">TODAY ✓</div>'
            : `<div class="swipe-bg ${r.revised ? 'bg-left' : 'bg-right'}">${r.revised ? 'UNDO ↺' : 'DONE ✓'}</div>`;
        wrapper.innerHTML = `
            ${swipeBg}
            <div class="surah-card ${r.revised ? 'revised-style' : ''}" data-surah-id="${s.id}">
                <div class="status-tick ${r.revised ? 'active' : ''} icon-load" data-src="tick.svg"></div>
                <span class="surah-num">${s.id}</span>
                <div class="surah-info">
                    <span class="surah-name">${s.name}</span>
                    <span class="last-revised">${r.lastDate ? 'Last: ' + r.lastDate + ' (' + daysSince(r.lastDate) + ')' : 'New'}</span>
                </div>
            </div>`;
        const card = wrapper.querySelector('.surah-card');
        card.addEventListener('click', e => {
            if (e.target.closest('.status-tick')) { toggleStatus(s.id); return; }
            window.open(`https://quran.com/${s.id}`, '_blank');
        });
        setupSwipe(card, s.id, r.revised, s.name);
        container.appendChild(wrapper);
    });
    loadIcons(container);
}

function initCarouselSwipe() {
    const container = document.getElementById('carousel-container');
    const track = document.getElementById('carousel-track');
    if (!container || !track) return;
    let startX = 0, currentX = 0, isSwiping = false;
    container.addEventListener('touchstart', e => {
        startX = e.touches[0].clientX;
        track.style.transition = 'none';
        clearInterval(carouselInterval);
        isSwiping = true;
    }, {passive: true});
    container.addEventListener('touchmove', e => {
        if (!isSwiping) return;
        currentX = e.touches[0].clientX;
        const diff = currentX - startX;
        const offset = -(currentSlide * 100);
        const movePercent = diff / container.offsetWidth * 100;
        track.style.transform = `translateX(${offset + movePercent}%)`;
    }, {passive: true});
    container.addEventListener('touchend', e => {
        if (!isSwiping) return;
        isSwiping = false;
        track.style.transition = 'transform 0.5s ease-in-out';
        const diff = currentX - startX;
        const threshold = container.offsetWidth * 0.2;
        if (diff < -threshold && currentSlide < slidesData.length - 1) currentSlide++;
        else if (diff > threshold && currentSlide > 0) currentSlide--;
        updateCarousel();
        startCarousel();
    });
}

function startCarousel() {
    if (carouselInterval) clearInterval(carouselInterval);
    carouselInterval = setInterval(() => {
        currentSlide = (currentSlide + 1) % slidesData.length;
        updateCarousel();
    }, 4000);
}

function setSlide(index) {
    clearInterval(carouselInterval);
    currentSlide = index;
    updateCarousel();
    startCarousel();
}

function updateCarousel() {
    const track = document.getElementById('carousel-track');
    const dots = document.getElementById('carousel-dots');
    if (!track || !dots) return;
    track.style.transition = 'transform 0.5s ease-in-out';
    track.style.transform = `translateX(-${currentSlide * 100}%)`;
    Array.from(dots.children).forEach((dot, i) => dot.classList.toggle('active', i === currentSlide));
}

function toggleStatus(id) {
    const s = surahs.find(x => x.id === id);
    const r = userData.find(u => u.id === id);
    if (!r || !s) return;
    updateStatus(id, !r.revised, s.name, true);
}

function setupSwipe(el, id, isAlreadyRevised, surahName) {
    const r = userData.find(u => u.id === id);
    const isPinned = r ? r.pinned : false;
    const isPinnedRevised = isAlreadyRevised && isPinned;
    let startX = 0, currentX = 0, isSwiping = false;
    let bgUndo, bgToday, bg;
    if (isPinnedRevised) {
        bgUndo = el.parentElement.querySelector('.bg-left');
        bgToday = el.parentElement.querySelector('.bg-right');
    } else {
        bg = el.previousElementSibling;
    }
    el.addEventListener('touchstart', e => { startX = e.touches[0].clientX; el.style.transition = 'none'; isSwiping = false; }, {passive: true});
    el.addEventListener('touchmove', e => {
        currentX = e.touches[0].clientX;
        let diff = currentX - startX;
        if (diff !== 0 && ((!isAlreadyRevised && diff < 0) || (isAlreadyRevised && !isPinned && diff > 0) || (isPinnedRevised))) {
            isSwiping = true; el.style.transform = `translateX(${diff}px)`;
            if (isPinnedRevised) { bgUndo.style.opacity = diff > 0 ? "1" : "0"; bgToday.style.opacity = diff < 0 ? "1" : "0"; }
            else { bg.style.opacity = "1"; }
        }
    }, {passive: true});
    el.addEventListener('touchend', () => {
        el.style.transition = 'transform 0.2s ease-out';
        let diff = currentX - startX;
        if (isSwiping && Math.abs(diff) > 100) {
            if (isPinnedRevised && diff < 0) {
                r.lastDate = new Date().toLocaleDateString('en-GB'); updateStreak(); saveData(); renderMainScreen();
            } else {
                el.classList.add(diff < 0 ? 'anim-left' : 'anim-right');
                updateStatus(id, diff < 0, surahName);
            }
        } else {
            el.style.transform = `translateX(0px)`;
            if (isPinnedRevised) { bgUndo.style.opacity = "0"; bgToday.style.opacity = "0"; }
            else { bg.style.opacity = "0"; }
        }
        isSwiping = false;
    });
}

function updateStatus(id, status, surahName, skipAnim = false) {
    const r = userData.find(u => u.id === id);
    if (!r) return;
    const prevLastDate = r.lastDate;
    const applyUpdate = () => {
        r.revised = status;
        if (status) {
            r.lastDate = new Date().toLocaleDateString('en-GB');
            updateStreak();
            showToast(surahName, id, prevLastDate);
            if (userData.every(u => u.revised)) fireConfetti();
        } else {
            r.lastDate = prevLastDate;
        }
        saveData(); renderMainScreen();
    };
    skipAnim ? applyUpdate() : setTimeout(applyUpdate, 300);
}

function toggleShowRevised() { showRevised = !showRevised; localStorage.setItem('showRevisedSetting', JSON.stringify(showRevised)); renderMainScreen(); }
function togglePin(id) { const r = userData.find(u => u.id === id); if (r) { r.pinned = !r.pinned; saveData(); renderMainScreen(); renderFullList(); } }
function toggleSelectionScreen() {
    const s = document.getElementById('selection-screen');
    s.style.display = (s.style.display !== 'flex') ? 'flex' : 'none';
    if (s.style.display === 'none') renderMainScreen();
}

function renderFullList() {
    const filter = document.getElementById('search-input').value.toLowerCase();
    const container = document.getElementById('full-surah-list');
    container.innerHTML = '';
    surahs.filter(s => s.name.toLowerCase().includes(filter)).forEach(s => {
        const r = userData.find(u => u.id === s.id);
        const isSelected = !!r;
        const div = document.createElement('div');
        div.className = `full-list-item ${isSelected ? 'selected' : ''}`;
        const pinHtml = isSelected ? `<div class="pin-icon ${r.pinned ? 'pinned' : ''} icon-load" data-src="${r.pinned ? 'pin-fill.svg' : 'pin-outline.svg'}" onclick="event.stopPropagation(); togglePin(${s.id})"></div>` : '';
        div.innerHTML = `<span><strong>${s.id}</strong> ${s.name}</span><div class="list-item-actions">${pinHtml}<span class="check-pill">${isSelected ? 'ADDED' : 'ADD'}</span></div>`;
        div.onclick = () => {
            const i = userData.findIndex(u => u.id === s.id);
            i > -1 ? userData.splice(i, 1) : userData.push({id: s.id, revised: false, lastDate: null, pinned: false});
            saveData(); renderFullList();
        };
        container.appendChild(div);
    });
    loadIcons(container);
}

function showToast(name, id, prevLastDate) {
    const t = document.getElementById("toast");
    document.getElementById("toast-message").innerText = `${name} Revised`;
    document.getElementById("toast-undo-btn").onclick = () => { const r = userData.find(u => u.id === id); if (r) { r.revised = false; r.lastDate = prevLastDate; saveData(); renderMainScreen(); } hideToast(); };
    t.style.visibility = "visible"; t.style.opacity = "1";
    clearTimeout(toastTimeout); toastTimeout = setTimeout(hideToast, 4000);
}
function hideToast() { const t = document.getElementById("toast"); t.style.opacity = "0"; setTimeout(() => t.style.visibility="hidden", 300); }

function openProgressModal() {
    const total = userData.length;
    const revisedCount = userData.filter(u => u.revised).length;
    const totalPages = userData.reduce((s, u) => s + (surahs.find(s2 => s2.id === u.id)?.pages || 0), 0);
    const revisedPages = userData.filter(u => u.revised).reduce((s, u) => s + (surahs.find(s2 => s2.id === u.id)?.pages || 0), 0);
    const surahsPct = total > 0 ? Math.round((revisedCount / total) * 100) : 0;
    const pagesPct = totalPages > 0 ? Math.round((revisedPages / totalPages) * 100) : 0;
    document.getElementById('progress-surahs-label').innerText = `Surahs (${total})`;
    document.getElementById('progress-surahs-pct').innerText = `${surahsPct}%`;
    document.getElementById('progress-surahs-fill').style.width = `${surahsPct}%`;
    document.getElementById('progress-surahs-revised').innerText = `Revised: ${revisedCount}`;
    document.getElementById('progress-surahs-unrevised').innerText = `Unrevised: ${total - revisedCount}`;
    document.getElementById('progress-pages-label').innerText = `Pages (${totalPages.toFixed(1)})`;
    document.getElementById('progress-pages-pct').innerText = `${pagesPct}%`;
    document.getElementById('progress-pages-fill').style.width = `${pagesPct}%`;
    document.getElementById('progress-pages-revised').innerText = `Revised: ${revisedPages.toFixed(1)}`;
    document.getElementById('progress-pages-unrevised').innerText = `Unrevised: ${(totalPages - revisedPages).toFixed(1)}`;
    document.getElementById('progress-modal').style.display = 'flex';
}
function closeProgressModal() { document.getElementById('progress-modal').style.display = 'none'; }

function calculateStreak() {
    const todayStr = new Date().toDateString();
    if (streakData.lastDate && streakData.lastDate !== todayStr) {
        const yest = new Date(); yest.setDate(yest.getDate()-1);
        if (streakData.lastDate !== yest.toDateString()) streakData.count = 0;
    }
    document.getElementById('streak-count').innerText = streakData.count + (streakData.lastDate !== todayStr ? '*' : '');
    const start = new Date(cycleStartDate); const now = new Date(); const diffDays = Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(start.getFullYear(), start.getMonth(), start.getDate())) / 86400000) + 1;
    document.getElementById('cycle-days').innerText = cycleTrackingEnabled ? `Day ${diffDays}/${cycleLength}` : `Day ${diffDays}`;
    const target = document.getElementById('progress-target');
    const markersContainer = document.getElementById('day-markers');
    markersContainer.innerHTML = '';
    if (cycleTrackingEnabled) {
        for (let d = 1; d <= cycleLength; d++) {
            const pct = (d / cycleLength) * 100;
            if (d === diffDays) continue;
            const m = document.createElement('div');
            m.className = 'day-marker';
            m.style.left = pct >= 100 ? 'calc(100% - 1px)' : `${pct}%`;
            markersContainer.appendChild(m);
        }
        if (diffDays <= cycleLength) {
            target.style.display = 'block';
            const pct = (diffDays / cycleLength) * 100;
            target.style.left = pct >= 100 ? 'calc(100% - 2px)' : `${pct}%`;
        } else {
            target.style.display = 'none';
        }
    } else {
        target.style.display = 'none';
    }
}

function updateStreak() { const today = new Date().toDateString(); if (streakData.lastDate !== today) { streakData.count++; streakData.lastDate = today; saveStreak(); } }
function saveStreak() { localStorage.setItem('streakData', JSON.stringify(streakData)); }
function saveData() { localStorage.setItem('hifzData', JSON.stringify(userData)); }
function daysSince(dateStr) { const parts = dateStr.split('/'); const d = new Date(parts[2], parts[1] - 1, parts[0]); const now = new Date(); return Math.floor((Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()) - Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())) / 86400000); }
function openResetModal() { document.getElementById('confirm-modal').style.display = 'flex'; }
function closeModal() { document.getElementById('confirm-modal').style.display = 'none'; }

function openCycleModal() {
    document.getElementById('cycle-toggle').checked = cycleTrackingEnabled;
    updateCycleModalDisplay();
    document.getElementById('cycle-modal').style.display = 'flex';
}
function closeCycleModal() { document.getElementById('cycle-modal').style.display = 'none'; }
function toggleCycleTracking() {
    cycleTrackingEnabled = document.getElementById('cycle-toggle').checked;
    localStorage.setItem('cycleTrackingEnabled', cycleTrackingEnabled);
    updateCycleModalDisplay();
    calculateStreak();
}
function updateCycleLength(delta) {
    cycleLength = Math.max(1, Math.min(30, cycleLength + delta));
    localStorage.setItem('cycleLength', cycleLength);
    updateCycleModalDisplay();
    calculateStreak();
}
function updateCycleModalDisplay() {
    const settings = document.getElementById('cycle-settings');
    settings.style.display = cycleTrackingEnabled ? 'block' : 'none';
    document.getElementById('cycle-length-display').innerText = cycleLength;
    const start = new Date(cycleStartDate);
    document.getElementById('cycle-start-date').innerText = start.toLocaleDateString('en-GB');
    const end = new Date(start); end.setDate(end.getDate() + cycleLength - 1);
    document.getElementById('cycle-end-date').innerText = end.toLocaleDateString('en-GB');
    document.getElementById('cycle-per-day').innerText = (100 / cycleLength).toFixed(1) + '%';
}
function executeRestart() { userData.forEach(u => u.revised = false); cycleStartDate = new Date().toISOString(); localStorage.setItem('cycleStartDate', cycleStartDate); saveData(); closeModal(); calculateStreak(); renderMainScreen(); }

// ==================== GOOGLE DRIVE SYNC ====================
const GOOGLE_CLIENT_ID = '116517743827-0s273f5kl337modif3mhq4f3ck6k1ic3.apps.googleusercontent.com';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.file https://www.googleapis.com/auth/drive.appdata';
const DRIVE_FILE_NAME = 'quran-tracker-data.json';
let gapiToken = null;
let isSyncing = false;
let syncDebounceTimer = null;
let pendingSync = false;
let driveFileId = localStorage.getItem('driveFileId') || null;
let lastSyncTimestamp = localStorage.getItem('lastSyncTimestamp') || null;
let isGoogleSignedIn = localStorage.getItem('isGoogleSignedIn') === 'true';
let tokenClient = null;

function getAppState() {
    return {
        timestamp: new Date().toISOString(),
        hifzData: userData,
        cycleStartDate,
        cycleLength,
        cycleTrackingEnabled,
        showRevisedSetting: showRevised,
        streakData
    };
}

function loadAppState(state) {
    userData = state.hifzData || [];
    localStorage.setItem('hifzData', JSON.stringify(userData));
    cycleStartDate = state.cycleStartDate || new Date().toISOString();
    localStorage.setItem('cycleStartDate', cycleStartDate);
    cycleLength = state.cycleLength || 7;
    localStorage.setItem('cycleLength', cycleLength);
    cycleTrackingEnabled = state.cycleTrackingEnabled || false;
    localStorage.setItem('cycleTrackingEnabled', cycleTrackingEnabled);
    showRevised = state.showRevisedSetting !== undefined ? state.showRevisedSetting : true;
    localStorage.setItem('showRevisedSetting', JSON.stringify(showRevised));
    streakData = state.streakData || { count: 0, lastDate: null };
    localStorage.setItem('streakData', JSON.stringify(streakData));
    calculateStreak();
    renderMainScreen();
    renderFullList();
}

function initGoogleAuth() {
    if (!GOOGLE_CLIENT_ID || GOOGLE_CLIENT_ID === 'YOUR_GOOGLE_CLIENT_ID_HERE') return;
    tokenClient = google.accounts.oauth2.initTokenClient({
        client_id: GOOGLE_CLIENT_ID,
        scope: DRIVE_SCOPE,
        callback: (tokenResponse) => {
            if (tokenResponse.error) { updateSyncStatus('Error'); return; }
            gapiToken = tokenResponse.access_token;
            isGoogleSignedIn = true;
            localStorage.setItem('isGoogleSignedIn', 'true');
            updateSyncButton();
            syncFromDrive();
        }
    });
    if (isGoogleSignedIn) {
        tokenClient.requestAccessToken({ prompt: '' });
    }
}

function handleSyncClick() {
    if (isGoogleSignedIn) { signOutGoogle(); }
    else { signInGoogle(); }
}

function signInGoogle() {
    if (!tokenClient) { updateSyncStatus('Not configured'); return; }
    tokenClient.requestAccessToken();
}

function signOutGoogle() {
    if (gapiToken) {
        google.accounts.oauth2.revoke(gapiToken);
        gapiToken = null;
    }
    isGoogleSignedIn = false;
    localStorage.removeItem('isGoogleSignedIn');
    driveFileId = null;
    localStorage.removeItem('driveFileId');
    lastSyncTimestamp = null;
    localStorage.removeItem('lastSyncTimestamp');
    updateSyncButton();
    updateSyncStatus('');
}

function updateSyncButton() {
    const btn = document.getElementById('sync-btn');
    const btnText = document.getElementById('sync-btn-text');
    if (isGoogleSignedIn) {
        btn.classList.add('synced');
        btnText.textContent = 'Unsync';
    } else {
        btn.classList.remove('synced');
        btnText.textContent = 'Sync to Google';
    }
}

function updateSyncStatus(text) {
    const el = document.getElementById('sync-status');
    if (el) el.textContent = text;
}

async function driveApiFetch(method, path, body = null) {
    const opts = { method, headers: { 'Authorization': `Bearer ${gapiToken}` } };
    if (body) { opts.headers['Content-Type'] = 'application/json'; opts.body = typeof body === 'string' ? body : JSON.stringify(body); }
    const res = await fetch(`https://www.googleapis.com/drive/v3${path}`, opts);
    if (res.status === 401) { gapiToken = null; tokenClient.requestAccessToken({ prompt: '' }); throw new Error('auth'); }
    if (!res.ok) { const errText = await res.text(); console.error('Drive API error response:', errText); throw new Error(`Drive API error: ${res.status}`); }
    return res.json();
}

async function driveUpload(content, fileId) {
    const data = JSON.stringify(content);
    const metadata = { name: DRIVE_FILE_NAME, mimeType: 'application/json' };
    if (!fileId) metadata.parents = ['appDataFolder'];
    const boundary = '-------314159265358979323846';
    const body = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n--${boundary}\r\nContent-Type: application/json\r\n\r\n${data}\r\n--${boundary}--`;
    const path = fileId ? `/upload/drive/v3/files/${fileId}?uploadType=multipart&fields=id,modifiedTime` : `/upload/drive/v3/files?uploadType=multipart&fields=id,modifiedTime`;
    const method = fileId ? 'PATCH' : 'POST';
    const res = await fetch(`https://www.googleapis.com${path}`, {
        method,
        headers: { 'Authorization': `Bearer ${gapiToken}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
        body
    });
    if (res.status === 401) { gapiToken = null; tokenClient.requestAccessToken({ prompt: '' }); throw new Error('auth'); }
    if (!res.ok) { const errText = await res.text(); console.error('Drive upload error response:', errText); throw new Error(`Drive upload error: ${res.status}`); }
    return res.json();
}

async function findDriveFile() {
    const res = await driveApiFetch('GET', `/files?spaces=appDataFolder&fields=files(id,modifiedTime)&q=name='${DRIVE_FILE_NAME}'`);
    return res.files.length > 0 ? res.files[0] : null;
}

async function syncToDrive() {
    if (!gapiToken || isSyncing) return;
    isSyncing = true;
    updateSyncStatus('Syncing...');
    try {
        let file;
        if (driveFileId) {
            file = await driveUpload(getAppState(), driveFileId);
        } else {
            const existing = await findDriveFile();
            if (existing) {
                driveFileId = existing.id;
                file = await driveUpload(getAppState(), driveFileId);
            } else {
                file = await driveUpload(getAppState(), null);
                driveFileId = file.id;
            }
        }
        localStorage.setItem('driveFileId', driveFileId);
        lastSyncTimestamp = file.modifiedTime || new Date().toISOString();
        localStorage.setItem('lastSyncTimestamp', lastSyncTimestamp);
        updateSyncStatus('Synced');
    } catch (e) {
        console.error('Sync to Drive failed:', e);
        if (e.message === 'auth') { isSyncing = false; return; }
        pendingSync = true;
        localStorage.setItem('pendingSync', 'true');
        updateSyncStatus('Sync failed');
    } finally {
        isSyncing = false;
    }
}

async function syncFromDrive() {
    if (!gapiToken || isSyncing) return;
    isSyncing = true;
    updateSyncStatus('Checking Drive...');
    try {
        let file;
        if (driveFileId) {
            file = await driveApiFetch('GET', `/files/${driveFileId}?fields=id,modifiedTime`);
        } else {
            const found = await findDriveFile();
            if (!found) { isSyncing = false; syncToDrive(); return; }
            driveFileId = found.id;
            localStorage.setItem('driveFileId', driveFileId);
            file = found;
        }
        if (!lastSyncTimestamp || file.modifiedTime > lastSyncTimestamp) {
            const content = await driveApiFetch('GET', `/files/${driveFileId}?alt=media`);
            if (content.timestamp) {
                localStorage.setItem('conflictRemoteData', JSON.stringify(content));
                document.getElementById('conflict-modal').style.display = 'flex';
                updateSyncStatus('Data available');
            } else {
                isSyncing = false;
                syncToDrive();
            }
        } else {
            isSyncing = false;
            syncToDrive();
        }
    } catch (e) {
        console.error('Sync from Drive failed:', e);
        if (e.message === 'auth') { isSyncing = false; return; }
        updateSyncStatus('Sync failed');
    } finally {
        isSyncing = false;
    }
}

function useRemoteData() {
    const raw = localStorage.getItem('conflictRemoteData');
    localStorage.removeItem('conflictRemoteData');
    if (raw) {
        const data = JSON.parse(raw);
        loadAppState(data);
        lastSyncTimestamp = data.timestamp;
        localStorage.setItem('lastSyncTimestamp', lastSyncTimestamp);
    }
    document.getElementById('conflict-modal').style.display = 'none';
    updateSyncStatus('Loaded from Drive');
}

function keepLocalData() {
    localStorage.removeItem('conflictRemoteData');
    document.getElementById('conflict-modal').style.display = 'none';
    syncToDrive();
}

function queueSync() {
    if (!isGoogleSignedIn || !gapiToken) return;
    if (syncDebounceTimer) clearTimeout(syncDebounceTimer);
    syncDebounceTimer = setTimeout(() => { syncToDrive(); }, 2000);
}

// Override save functions to trigger sync
const _originalSaveData = saveData;
saveData = function() { _originalSaveData(); queueSync(); };
const _originalSaveStreak = saveStreak;
saveStreak = function() { _originalSaveStreak(); queueSync(); };

// Online/offline handling
window.addEventListener('online', () => {
    if (pendingSync && isGoogleSignedIn) {
        pendingSync = false;
        localStorage.removeItem('pendingSync');
        syncToDrive();
    }
});

window.onload = () => { loadSurahData(); loadIcons(); updateSyncButton(); if (typeof google !== 'undefined') { initGoogleAuth(); } };

// SERVICE WORKER REGISTRATION
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registered!'))
            .catch(err => console.log('Service Worker failed:', err));
    });
}
