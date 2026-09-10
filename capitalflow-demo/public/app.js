// ---------- Mock data (stands in for Capitalflow's real records) ----------
const ASSIGNMENTS = [
  { id: 'a1', name: 'CAT 320 Excavator', agreement: 'CF-AG-4471', serialOnFile: 'JAZ00320PEHK12345', site: 'Naas Rd Depot', supplier: 'Naas Rd Plant Ltd', status: 'pending',
    shots: ['Front ¾ view', 'Rear', 'Serial plate (close-up)', 'Hour meter'] },
  { id: 'a2', name: 'Volvo L60H Loader', agreement: 'CF-AG-3390', serialOnFile: 'VOL60HL2209988', site: 'Cork Yard', supplier: 'Munster Plant Hire', status: 'flagged',
    flagReason: 'Serial plate photo unreadable', shots: ['Serial plate (close-up)'] },
];

// seed the dashboard with a couple of already-reviewed examples
let SUBMISSIONS = [
  { id: 'CF-2201', assetName: '2022 Mercedes Sprinter', supplier: 'Dublin Fleet Co', agreement: 'CF-AG-2210',
    serial: 'WDB9066331R123456', gps: { lat: 53.3441, lon: -6.2675 }, time: '07 Sep, 16:02', photos: [], status: 'verified', notes: '' },
  { id: 'CF-2288', assetName: '2023 Ford Transit', supplier: 'Dublin Fleet Co', agreement: 'CF-AG-2288',
    serial: 'WF0XXXTTGXKA00000', gps: { lat: 51.8985, lon: -8.4756 }, time: '05 Sep, 11:47', photos: [], status: 'submitted', notes: '' },
];

// ---------- App state ----------
let state = {
  view: 'login',
  currentAssetId: null,
  draft: null, // { serial, serialOk, gps, time, photos:[], shotIndex, condition:{}, notes }
  stream: null,
  dashDetailId: null,
};

const screenEl = document.getElementById('screen');
const dashBtn = document.getElementById('dashBtn');
dashBtn.addEventListener('click', () => { stopCamera(); state.view = 'dashList'; render(); });

function go(view, extra = {}) {
  stopCamera();
  state = { ...state, view, ...extra };
  render();
}

function stopCamera() {
  if (state.stream) {
    state.stream.getTracks().forEach(t => t.stop());
    state.stream = null;
  }
}

function refNumber() {
  return 'CF-' + Math.floor(2000 + Math.random() * 900) + '-' + Math.random().toString(36).slice(2, 4).toUpperCase();
}

// ---------- Render router ----------
function render() {
  const v = state.view;
  if (v === 'login') return renderLogin();
  if (v === 'assignments') return renderAssignments();
  if (v === 'capture') return renderCapture();
  if (v === 'review') return renderReview();
  if (v === 'summary') return renderSummary();
  if (v === 'confirmation') return renderConfirmation();
  if (v === 'dashList') return renderDashList();
  if (v === 'dashDetail') return renderDashDetail();
  if (v === 'resubmit') return renderResubmit();
}

// ---------- Screens ----------
function renderLogin() {
  screenEl.innerHTML = `
    <div style="display:flex;flex-direction:column;justify-content:center;min-height:520px;">
      <div style="text-align:center;margin-bottom:24px;">
        <h2 class="title">Supplier Portal</h2>
        <p class="sub">Log in to submit asset verification photos</p>
      </div>
      <div class="label-tag">Supplier ID or email</div>
      <input class="field" id="loginEmail" placeholder="supplier@company.ie" value="supplier@naasrdplant.ie">
      <div class="label-tag">PIN</div>
      <input class="field" id="loginPin" type="password" placeholder="••••••" value="123456">
      <button class="btn btn-primary" id="loginBtn">Log in</button>
    </div>
  `;
  document.getElementById('loginBtn').onclick = () => go('assignments');
}

function renderAssignments() {
  const rows = ASSIGNMENTS.map(a => `
    <div class="card" data-id="${a.id}" style="cursor:pointer;">
      <div class="row"><b style="font-size:12px;">${a.name}</b>${statusPill(a.status)}</div>
      <div class="muted" style="margin-top:4px;">${a.site} · Agreement ${a.agreement}</div>
      ${a.status === 'flagged' ? `<div class="muted" style="color:#b8134f;margin-top:4px;">🚩 ${a.flagReason}</div>` : ''}
    </div>
  `).join('');
  screenEl.innerHTML = `
    <h2 class="title">My assignments</h2>
    <p class="sub">Tap an asset to verify it</p>
    ${rows}
  `;
  screenEl.querySelectorAll('.card').forEach(card => {
    card.onclick = () => {
      const asset = ASSIGNMENTS.find(a => a.id === card.dataset.id);
      if (asset.status === 'flagged') {
        go('resubmit', { currentAssetId: asset.id });
      } else {
        startCaptureFlow(asset.id);
      }
    };
  });
}

function statusPill(status) {
  const map = {
    pending: ['pill-pending', 'Pending'],
    submitted: ['pill-submitted', 'Submitted'],
    verified: ['pill-verified', 'Verified'],
    flagged: ['pill-flagged', 'Needs resubmit'],
  };
  const [cls, label] = map[status] || map.pending;
  return `<span class="pill ${cls}">${label}</span>`;
}

function startCaptureFlow(assetId) {
  const asset = ASSIGNMENTS.find(a => a.id === assetId);
  state.currentAssetId = assetId;
  state.draft = {
    serial: '', serialOk: false, gps: null, gpsError: null, time: null,
    photos: [], shotIndex: 0, condition: {}, notes: '',
  };
  go('capture', { currentAssetId: assetId });
  requestGPS();
}

function requestGPS() {
  if (!navigator.geolocation) {
    state.draft.gpsError = 'Geolocation not supported on this device.';
    render();
    return;
  }
  navigator.geolocation.getCurrentPosition(
    pos => {
      state.draft.gps = { lat: pos.coords.latitude, lon: pos.coords.longitude };
      state.draft.time = new Date();
      render();
    },
    err => {
      state.draft.gpsError = 'Location permission denied — allow location access to continue.';
      render();
    },
    { enableHighAccuracy: true, timeout: 10000 }
  );
}

function renderCapture() {
  const asset = ASSIGNMENTS.find(a => a.id === state.currentAssetId);
  const d = state.draft;
  const shotLabel = asset.shots[d.shotIndex];
  const gpsText = d.gps ? `📍 ${d.gps.lat.toFixed(4)}, ${d.gps.lon.toFixed(4)}` : (d.gpsError ? '📍 unavailable' : '📍 locating…');
  const timeText = d.time ? `🕒 ${d.time.toLocaleString()}` : '🕒 —';

  screenEl.innerHTML = `
    <div class="row" style="margin-bottom:10px;">
      <span class="muted">← ${asset.name}</span>
      <span class="muted">${d.photos.length + 1} of ${asset.shots.length} photos</span>
    </div>

    ${d.gpsError ? `<div class="note-box note-error">⚠️ ${d.gpsError}</div>` : ''}

    <div class="camera-wrap" id="camWrap">
      <video id="video" autoplay playsinline muted></video>
      <div class="badge-float" style="top:8px;left:8px;">${gpsText}</div>
      <div class="badge-float" style="top:32px;left:8px;">${timeText}</div>
    </div>

    <div class="label-tag">Shot needed: ${shotLabel}</div>

    <div class="label-tag" style="margin-top:8px;">Serial / VIN number</div>
    <input class="field ${d.serial && !d.serialOk ? 'error' : ''}" id="serialInput" placeholder="Type or scan the plate" value="${d.serial}">
    ${serialNote(d, asset)}

    <button class="shutter" id="shutterBtn" ${(!d.serialOk || !d.gps) ? 'disabled' : ''}></button>
    <p class="sub" style="text-align:center;margin-top:8px;">${!d.gps ? 'Waiting for GPS…' : (!d.serialOk ? 'Enter a matching serial number to unlock the shutter' : '')}</p>
  `;

  // camera
  const video = document.getElementById('video');
  navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false })
    .then(stream => {
      state.stream = stream;
      video.srcObject = stream;
    })
    .catch(() => {
      document.getElementById('camWrap').innerHTML = `<div class="cam-msg">Camera unavailable or permission denied.<br>You can still continue with the fields above.</div>`;
    });

  const serialInput = document.getElementById('serialInput');
  serialInput.oninput = (e) => {
    d.serial = e.target.value;
    d.serialOk = d.serial.trim().toUpperCase() === asset.serialOnFile.toUpperCase();
    render();
    document.getElementById('serialInput').focus();
    document.getElementById('serialInput').setSelectionRange(d.serial.length, d.serial.length);
  };

  document.getElementById('shutterBtn').onclick = () => {
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth || 320;
    canvas.height = video.videoHeight || 240;
    const ctx = canvas.getContext('2d');
    if (video.videoWidth) ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    else { ctx.fillStyle = '#333'; ctx.fillRect(0,0,canvas.width,canvas.height); }
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    d.photos.push({ label: shotLabel, dataUrl, gps: d.gps, time: d.time });
    d.shotIndex++;
    if (d.shotIndex >= asset.shots.length) {
      go('review', { currentAssetId: state.currentAssetId });
    } else {
      render();
    }
  };
}

function serialNote(d, asset) {
  if (!d.serial) return '';
  if (d.serialOk) {
    return `<div class="note-box note-ok">✓ Matches agreement ${asset.agreement} on file for this supplier.</div>`;
  }
  return `<div class="note-box note-error">✕ Doesn't match agreement ${asset.agreement} on file. Check the plate and re-enter — you can't continue until this matches.</div>`;
}

function renderReview() {
  const asset = ASSIGNMENTS.find(a => a.id === state.currentAssetId);
  const d = state.draft;
  const thumbs = d.photos.map(p => `<div class="thumb"><img src="${p.dataUrl}"><span class="lock">🔒</span></div>`).join('');
  const conditionItems = ['Bodywork', 'Tyres/tracks', 'Glass/mirrors'];

  screenEl.innerHTML = `
    <div class="muted" style="margin-bottom:10px;">← ${asset.name}</div>
    <div class="label-tag">Photos captured</div>
    <div class="thumb-grid">${thumbs}</div>
    <div class="label-tag">Condition check</div>
    <div class="card" id="conditionCard" style="padding:2px 12px;"></div>
    <div class="label-tag" style="margin-top:8px;">Notes (optional)</div>
    <textarea class="field" id="notesInput" placeholder="Anything worth flagging...">${d.notes}</textarea>
    <button class="btn btn-secondary" id="continueBtn">Continue</button>
  `;

  const condCard = document.getElementById('conditionCard');
  condCard.innerHTML = conditionItems.map(item => {
    const val = d.condition[item] || 'Good';
    return `
      <div class="checklist-row">
        ${item}
        <div class="radio-set" data-item="${item}">
          ${['Good','Fair','Damage'].map(opt => {
            const cls = opt === val ? (opt === 'Good' ? 'sel-good' : opt === 'Fair' ? 'sel-fair' : 'sel-bad') : '';
            return `<span class="radio-opt ${cls}" data-opt="${opt}">${opt}</span>`;
          }).join('')}
        </div>
      </div>`;
  }).join('');

  condCard.querySelectorAll('.radio-set').forEach(set => {
    set.querySelectorAll('.radio-opt').forEach(btn => {
      btn.onclick = () => {
        d.condition[set.dataset.item] = btn.dataset.opt;
        render();
      };
    });
  });

  document.getElementById('notesInput').oninput = (e) => { d.notes = e.target.value; };
  document.getElementById('continueBtn').onclick = () => go('summary', { currentAssetId: state.currentAssetId });
}

function renderSummary() {
  const asset = ASSIGNMENTS.find(a => a.id === state.currentAssetId);
  const d = state.draft;
  const conditionSummary = Object.values(d.condition).length
    ? Object.entries(d.condition).map(([k,v]) => `${k}: ${v}`).join(' · ')
    : 'Not set';

  screenEl.innerHTML = `
    <h2 class="title">Review before sending</h2>
    <div class="card">
      <b style="font-size:13px;">${asset.name}</b>
      <div class="meta-line"><span>Serial / VIN</span><b>${d.serial} ✓</b></div>
      <div class="meta-line"><span>Agreement on file</span><b>${asset.agreement}</b></div>
      <div class="meta-line"><span>Location</span><b>${d.gps ? d.gps.lat.toFixed(4)+', '+d.gps.lon.toFixed(4) : '—'}</b></div>
      <div class="meta-line"><span>Captured</span><b>${d.time ? d.time.toLocaleString() : '—'}</b></div>
      <div class="meta-line"><span>Photos</span><b>${d.photos.length} attached</b></div>
      <div class="meta-line" style="border-bottom:none;"><span>Condition</span><b>${conditionSummary}</b></div>
    </div>
    <div class="note-box note-warn">🔒 Photos are timestamped and geotagged automatically from your device and can't be edited or replaced after capture.</div>
    <button class="btn btn-primary" id="submitBtn">Submit for review</button>
  `;

  document.getElementById('submitBtn').onclick = () => {
    const id = refNumber();
    SUBMISSIONS.unshift({
      id, assetName: asset.name, supplier: asset.supplier, agreement: asset.agreement,
      serial: d.serial, gps: d.gps, time: d.time ? d.time.toLocaleString() : '—',
      photos: d.photos, status: 'submitted', notes: d.notes, condition: d.condition,
    });
    asset.status = 'submitted';
    go('confirmation', { lastRef: id });
  };
}

function renderConfirmation() {
  screenEl.innerHTML = `
    <div style="text-align:center;">
      <div class="success-tick">✓</div>
      <b style="font-size:15px;color:var(--navy);">Submission sent</b>
      <div class="muted" style="margin:6px 0 24px;">Reference #${state.lastRef || ''} · Awaiting review</div>
      <button class="btn btn-outline" id="backBtn">Back to assignments</button>
    </div>
  `;
  document.getElementById('backBtn').onclick = () => go('assignments');
}

function renderResubmit() {
  const asset = ASSIGNMENTS.find(a => a.id === state.currentAssetId);
  state.draft = { serial: '', serialOk: false, gps: null, gpsError: null, time: null, photos: [], shotIndex: 0, condition: {}, notes: '' };
  screenEl.innerHTML = `<div class="muted">Loading resubmission…</div>`;
  requestGPSThen(() => {
    screenEl.innerHTML = `
      <div class="muted" style="margin-bottom:8px;">← ${asset.name}</div>
      <div class="note-box note-error">🚩 Flagged: ${asset.flagReason}. Retake this photo — everything else on file stays as-is.</div>
      <div id="captureSlot"></div>
    `;
    go('capture', { currentAssetId: asset.id });
  });
}

function requestGPSThen(cb) { cb(); }

function renderDashList() {
  const filterRow = `
    <div style="display:flex;gap:6px;margin-bottom:12px;flex-wrap:wrap;">
      <span class="pill pill-submitted">All (${SUBMISSIONS.length})</span>
    </div>`;
  const rows = SUBMISSIONS.map(s => `
    <tr data-id="${s.id}">
      <td>${s.assetName}</td>
      <td>${s.supplier}</td>
      <td>${s.time}</td>
      <td>${statusPill(s.status)}</td>
    </tr>
  `).join('');
  screenEl.innerHTML = `
    <h2 class="title">Submissions queue</h2>
    <p class="sub">Internal review team</p>
    ${filterRow}
    <table>
      <tr><th>Asset</th><th>Supplier</th><th>Submitted</th><th>Status</th></tr>
      ${rows}
    </table>
    <button class="btn btn-ghost" id="backToApp" style="margin-top:16px;">← Back to supplier app</button>
  `;
  screenEl.querySelectorAll('tr[data-id]').forEach(tr => {
    tr.onclick = () => go('dashDetail', { dashDetailId: tr.dataset.id });
  });
  document.getElementById('backToApp').onclick = () => go('login');
}

function renderDashDetail() {
  const s = SUBMISSIONS.find(x => x.id === state.dashDetailId);
  const photos = (s.photos && s.photos.length)
    ? s.photos.map(p => `<div class="thumb" style="height:90px;"><img src="${p.dataUrl}"></div>`).join('')
    : `<div class="muted">No photos captured for this seeded example.</div>`;
  const gpsText = s.gps ? `${s.gps.lat.toFixed(4)}, ${s.gps.lon.toFixed(4)}` : '—';

  screenEl.innerHTML = `
    <div class="muted" style="margin-bottom:8px;">← ${s.assetName} — ${s.id}</div>
    <div class="label-tag">Photos</div>
    <div class="thumb-grid">${photos}</div>
    <div class="label-tag">Asset record</div>
    <div class="card">
      <div class="meta-line"><span>Serial / VIN</span><b>${s.serial}</b></div>
      <div class="meta-line"><span>Agreement</span><b>${s.agreement}</b></div>
      <div class="meta-line"><span>Location</span><b>${gpsText}</b></div>
      <div class="meta-line" style="border-bottom:none;"><span>Submitted</span><b>${s.time}</b></div>
    </div>
    <button class="btn btn-secondary" id="verifyBtn">Mark verified</button>
    <button class="btn btn-outline" id="flagBtn">Flag for follow-up</button>
    <div id="flagArea"></div>
    <button class="btn btn-ghost" id="backList" style="margin-top:10px;">← Back to queue</button>
  `;

  document.getElementById('verifyBtn').onclick = () => { s.status = 'verified'; go('dashDetail', { dashDetailId: s.id }); };
  document.getElementById('flagBtn').onclick = () => {
    document.getElementById('flagArea').innerHTML = `
      <textarea class="field" id="reasonInput" placeholder="Reason (e.g. serial mismatch, location doesn't match site)"></textarea>
      <button class="btn btn-primary" id="confirmFlag">Send flag to supplier</button>
    `;
    document.getElementById('confirmFlag').onclick = () => {
      s.status = 'flagged';
      s.flagReason = document.getElementById('reasonInput').value || 'Needs review';
      go('dashDetail', { dashDetailId: s.id });
    };
  };
  document.getElementById('backList').onclick = () => go('dashList');
}

render();
