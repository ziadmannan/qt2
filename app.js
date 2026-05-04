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
            <div class="surah-card ${r.revised ? 'revised-style' : ''}">
                <div class="status-tick ${r.revised ? 'active' : ''} icon-load" data-src="tick.svg" onclick="toggleStatus(${s.id}); event.stopPropagation()"></div>
                <span class="surah-num">${s.id}</span>
                <div class="surah-info">
                    <span class="surah-name">${s.name}</span>
                    <span class="last-revised">${r.lastDate ? 'Last: ' + r.lastDate + ' (' + daysSince(r.lastDate) + ')' : 'New'}</span>
                </div>
                <div class="pin-icon ${r.pinned ? 'pinned' : ''} icon-load" data-src="${r.pinned ? 'pin-fill.svg' : 'pin-outline.svg'}" onclick="togglePin(${s.id}); event.stopPropagation()"></div>
                <a href="https://quran.com/${s.id}" target="_blank" class="quran-link icon-load" data-src="book.svg" onclick="event.stopPropagation()"></a>
            </div>`;
        setupSwipe(wrapper.querySelector('.surah-card'), s.id, r.revised, s.name);
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
    if (r.pinned && r.revised) { r.lastDate = new Date().toLocaleDateString('en-GB'); updateStreak(); saveData(); renderMainScreen(); return; }
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
function togglePin(id) { const r = userData.find(u => u.id === id); if (r) { r.pinned = !r.pinned; saveData(); renderMainScreen(); } }
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
        const isSelected = userData.some(u => u.id === s.id);
        const div = document.createElement('div');
        div.className = `full-list-item ${isSelected ? 'selected' : ''}`;
        div.innerHTML = `<span><strong>${s.id}</strong> ${s.name}</span><span class="check-pill">${isSelected ? 'ADDED' : 'ADD'}</span>`;
        div.onclick = () => {
            const i = userData.findIndex(u => u.id === s.id);
            i > -1 ? userData.splice(i, 1) : userData.push({id: s.id, revised: false, lastDate: null, pinned: false});
            saveData(); renderFullList();
        };
        container.appendChild(div);
    });
}

function showToast(name, id, prevLastDate) {
    const t = document.getElementById("toast");
    document.getElementById("toast-message").innerText = `${name} Revised`;
    document.getElementById("toast-undo-btn").onclick = () => { const r = userData.find(u => u.id === id); if (r) { r.revised = false; r.lastDate = prevLastDate; saveData(); renderMainScreen(); } hideToast(); };
    t.style.visibility = "visible"; t.style.opacity = "1";
    clearTimeout(toastTimeout); toastTimeout = setTimeout(hideToast, 4000);
}
function hideToast() { const t = document.getElementById("toast"); t.style.opacity = "0"; setTimeout(() => t.style.visibility="hidden", 300); }

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

window.onload = () => { loadSurahData(); loadIcons(); };

// SERVICE WORKER REGISTRATION
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
            .then(reg => console.log('Service Worker registered!'))
            .catch(err => console.log('Service Worker failed:', err));
    });
}