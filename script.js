// ──────────────────────────────────────
// TAB NAVIGATION
// ──────────────────────────────────────
function switchTab(id) {
    document.querySelectorAll('.tab-pane').forEach(p => p.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById(id).classList.add('active');
    document.querySelector(`[data-tab="${id}"]`).classList.add('active');
    window.scrollTo({ top: 0, behavior: 'smooth' });
}
document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => switchTab(btn.dataset.tab));
});

// ──────────────────────────────────────
// AUTO-FILL MAP
// source id → list of target ids
// ──────────────────────────────────────
const syncMap = {
    // Naam kind
    naam_kind: ['f2_naam_kind', 'med_naam', 'opv_naam', 'fac_naam_kind', 'beeld_naam_kind'],
    // Geboortedatum
    geboortedatum: ['f2_geboortedatum', 'opv_geboortedatum'],
    // Geboorteplaats
    geboorteplaats: ['f2_geboorteplaats'],
    // Vorige school
    vorige_school: ['f2_vorige_school'],
    // Naam ouder
    naam_ouder: ['f2_naam_ouder', 'med_ouder_naam', 'fac_naam_ouder', 'beeld_naam_ouder'],
    // Klas
    klas: ['med_klas', 'opv_klas', 'fac_klas'],
    // Adres
    adres: ['opv_adres'],
    // Huisdokter
    huisdokter: ['opv_huisarts'],
    // Email
    email_ouders: ['fac_email'],
    // Telefoon vader + moeder → opvang tel (combined)
    tel_vader: [],
    tel_moeder: [],
    // Aanmeldingsdatum sync with ingang_datum for instapdatum hint
    ingang_datum: ['instapdatum'],
};

function flashField(el) {
    el.classList.add('autofilled');
    setTimeout(() => el.classList.remove('autofilled'), 2000);
}

function syncField(sourceId, value) {
    const targets = syncMap[sourceId] || [];
    targets.forEach(tid => {
        const el = document.getElementById(tid);
        if (el && el.value !== value) {
            el.value = value;
            flashField(el);
        }
    });
}

// Combined phone sync
function syncPhones() {
    const vader = document.getElementById('tel_vader').value.trim();
    const moeder = document.getElementById('tel_moeder').value.trim();
    const combined = [vader, moeder].filter(Boolean).join(' / ');
    const el = document.getElementById('opv_tel');
    if (el && el.value !== combined) {
        el.value = combined;
        flashField(el);
    }
}

// Attach listeners to all source fields
Object.keys(syncMap).forEach(sid => {
    const el = document.getElementById(sid);
    if (!el) return;
    el.addEventListener('input', () => {
        syncField(sid, el.value);
        if (sid === 'tel_vader' || sid === 'tel_moeder') syncPhones();
    });
});

// ──────────────────────────────────────
// PROGRESS BAR
// ──────────────────────────────────────
const requiredIds = [
    'naam_kind','geboortedatum','naam_ouder',
    'adres','klas','email_ouders',
    'naam_vader','naam_moeder','tel_vader','tel_moeder',
    'huisdokter','rijksregister_kind'
];

function updateProgress() {
    const filled = requiredIds.filter(id => {
        const el = document.getElementById(id);
        return el && el.value.trim() !== '';
    }).length;
    const pct = Math.round((filled / requiredIds.length) * 100);
    document.getElementById('progress-bar').style.width = pct + '%';
    document.getElementById('progress-pct').textContent = pct + '%';
}
document.getElementById('main-form').addEventListener('input', updateProgress);

// ──────────────────────────────────────
// SET CURRENT YEAR IN HEADER
// ──────────────────────────────────────
const y = new Date().getFullYear();
document.getElementById('hdr-jaar').textContent = 'Schooljaar ' + y + '–' + (y+1);
document.getElementById('schooljaar').placeholder = y + '-' + (y+1);

// ──────────────────────────────────────
// SIGNATURE PAD  (robust rewrite)
// ──────────────────────────────────────
const sigStates = {}; // canvasId → { drawing, lastX, lastY, isEmpty, snapshot }

const allSigIds = [
    'sig_tab1', 'sig_tab2',
    'sig_tab3_ouder', 'sig_tab3_arts',
    'sig_tab5_fac', 'sig_tab5_beeld'
];

// Ensure state object exists
function ensureState(id) {
    if (!sigStates[id]) sigStates[id] = { drawing:false, lastX:0, lastY:0, isEmpty:true, snapshot:null };
    return sigStates[id];
}

// Apply consistent ctx style — called before every draw operation
function applyCtxStyle(ctx) {
    ctx.strokeStyle = '#1a2e22';
    ctx.lineWidth   = 2.2;
    ctx.lineCap     = 'round';
    ctx.lineJoin    = 'round';
}

// Size canvas buffer to its CSS display size, restore snapshot
function sizeCanvas(canvas) {
    const id    = canvas.id;
    const state = ensureState(id);
    const rect  = canvas.getBoundingClientRect();
    if (rect.width === 0) return; // not visible yet
    const dpr = window.devicePixelRatio || 1;
    // Save drawing before resize
    if (!state.isEmpty) state.snapshot = canvas.toDataURL();
    canvas.width  = Math.round(rect.width  * dpr);
    canvas.height = Math.round(rect.height * dpr);
    const ctx = canvas.getContext('2d');
    ctx.scale(dpr, dpr);
    applyCtxStyle(ctx);
    // Restore snapshot
    if (state.snapshot && !state.isEmpty) {
        const img = new Image();
        img.onload = () => {
            applyCtxStyle(canvas.getContext('2d'));
            canvas.getContext('2d').drawImage(img, 0, 0, rect.width, rect.height);
        };
        img.src = state.snapshot;
    }
}

function getPos(canvas, e) {
    const rect = canvas.getBoundingClientRect();
    const src  = e.touches ? e.touches[0] : e;
    return { x: src.clientX - rect.left, y: src.clientY - rect.top };
}

function markSigned(id) {
    const canvas = document.getElementById(id);
    const state  = sigStates[id];
    if (!state || !state.isEmpty) return;
    state.isEmpty = false;
    canvas.classList.remove('empty');
    canvas.classList.add('signed');
    const ph = document.getElementById(id + '_ph');
    if (ph) ph.style.display = 'none';
    const badge = document.getElementById(id + '_badge');
    if (badge) badge.classList.add('visible');
}

function initSig(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;

    // Always resize — fixes blank-canvas-after-tab-switch
    sizeCanvas(canvas);

    // Only attach listeners once (flag on the element)
    if (canvas._sigListened) return;
    canvas._sigListened = true;

    const state = ensureState(canvasId);

    canvas.addEventListener('mousedown', e => {
        e.preventDefault();
        state.drawing = true;
        const p = getPos(canvas, e);
        state.lastX = p.x; state.lastY = p.y;
        // Start a new path segment so single clicks also draw a dot
        const ctx = canvas.getContext('2d');
        applyCtxStyle(ctx);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1, 0, Math.PI * 2);
        ctx.fill();
        markSigned(canvasId);
    });

    canvas.addEventListener('mousemove', e => {
        if (!state.drawing) return;
        e.preventDefault();
        const p   = getPos(canvas, e);
        const ctx = canvas.getContext('2d');
        applyCtxStyle(ctx);
        ctx.beginPath();
        ctx.moveTo(state.lastX, state.lastY);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        state.lastX = p.x; state.lastY = p.y;
        markSigned(canvasId);
    });

    canvas.addEventListener('mouseup',    () => { state.drawing = false; });
    canvas.addEventListener('mouseleave', () => { state.drawing = false; });

    canvas.addEventListener('touchstart', e => {
        e.preventDefault();
        state.drawing = true;
        const p = getPos(canvas, e);
        state.lastX = p.x; state.lastY = p.y;
        const ctx = canvas.getContext('2d');
        applyCtxStyle(ctx);
        ctx.beginPath();
        ctx.arc(p.x, p.y, 1, 0, Math.PI * 2);
        ctx.fill();
        markSigned(canvasId);
    }, { passive: false });

    canvas.addEventListener('touchmove', e => {
        if (!state.drawing) return;
        e.preventDefault();
        const p   = getPos(canvas, e);
        const ctx = canvas.getContext('2d');
        applyCtxStyle(ctx);
        ctx.beginPath();
        ctx.moveTo(state.lastX, state.lastY);
        ctx.lineTo(p.x, p.y);
        ctx.stroke();
        state.lastX = p.x; state.lastY = p.y;
        markSigned(canvasId);
    }, { passive: false });

    canvas.addEventListener('touchend', () => { state.drawing = false; });
}

function clearSig(canvasId) {
    const canvas = document.getElementById(canvasId);
    if (!canvas) return;
    const state = ensureState(canvasId);
    state.isEmpty  = true;
    state.snapshot = null;
    const dpr  = window.devicePixelRatio || 1;
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    canvas.classList.remove('signed');
    canvas.classList.add('empty');
    const ph = document.getElementById(canvasId + '_ph');
    if (ph) ph.style.display = '';
    const badge = document.getElementById(canvasId + '_badge');
    if (badge) badge.classList.remove('visible');
}

// Init on page load (tab1 is visible)
window.addEventListener('load', () => allSigIds.forEach(initSig));

// Re-size/init on every tab switch (canvas must be visible for correct sizing)
const _origSwitchTab = switchTab;
window.switchTab = function(id) {
    _origSwitchTab(id);
    // rAF ensures the tab is painted before we measure
    requestAnimationFrame(() => requestAnimationFrame(() => allSigIds.forEach(initSig)));
};

// Also re-size on window resize
window.addEventListener('resize', () => {
    allSigIds.forEach(id => {
        const canvas = document.getElementById(id);
        if (canvas && canvas.offsetParent !== null) sizeCanvas(canvas);
    });
});

document.getElementById('main-form').addEventListener('submit', e => {
    e.preventDefault();
    const toast = document.getElementById('toast');
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 4000);
});