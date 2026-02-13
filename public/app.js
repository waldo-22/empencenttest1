// Frontend with server fallback: if API is unreachable, use localStorage so
// the site works as a standalone static HTML page.

const STORAGE_KEY = 'ee_bookings_v1';
let storageMode = 'server'; // 'server' or 'local'

function escapeHtml(s){ if(!s) return ''; return s.replace(/[&<>\"]/g, c=>({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;' }[c] || c)); }

function readLocal(){
  try{
    const raw = localStorage.getItem(STORAGE_KEY); if(!raw) return [];
    return JSON.parse(raw);
  }catch(e){ return []; }
}

function writeLocal(arr){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(arr));
}

async function fetchBookings(){
  if(storageMode === 'local') return readLocal();
  try{
    const controller = new AbortController();
    const timeout = setTimeout(()=>controller.abort(), 3500);
    const res = await fetch('/api/bookings', { signal: controller.signal });
    clearTimeout(timeout);
    if(!res.ok) throw new Error('server error');
    return await res.json();
  }catch(err){
    storageMode = 'local'; updateModeBadge();
    return readLocal();
  }
}

function renderBookings(bookings){
  const el = document.getElementById('bookingsList');
  if(!bookings || bookings.length===0){ el.innerHTML = '<p class="muted">No bookings yet.</p>'; return }
  el.innerHTML = '';
  for(const b of bookings){
    const item = document.createElement('div');
    item.className = 'booking-item';
    const left = document.createElement('div');
    left.innerHTML = `<strong>${escapeHtml(b.name)}</strong> — ${escapeHtml(b.service)}<div class="muted">${b.date} @ ${b.time} • ${b.duration} min</div>`;
    const right = document.createElement('div');
    const del = document.createElement('button');
    del.textContent = 'Cancel';
    del.style.background = 'transparent';
    del.style.color = '#e6eef8';
    del.onclick = async ()=>{
      if(!confirm('Cancel this booking?')) return;
      if(storageMode === 'server'){
        await fetch('/api/bookings/'+b.id, { method: 'DELETE' });
      }else{
        const arr = readLocal().filter(x=>x._localId !== b._localId);
        writeLocal(arr);
      }
      load();
    };
    right.appendChild(del);
    item.appendChild(left);
    item.appendChild(right);
    el.appendChild(item);
  }
}

function updateModeBadge(){
  const el = document.getElementById('modeBadge');
  if(!el) return;
  if(storageMode === 'local'){
    el.textContent = 'Running in standalone mode (localStorage). Bookings saved only in your browser.';
  }else{
    el.textContent = '';
  }
}

async function load(){ const bookings = await fetchBookings(); renderBookings(bookings); }

document.getElementById('bookingForm').addEventListener('submit', async (e)=>{
  e.preventDefault();
  const name = document.getElementById('name').value.trim();
  const service = document.getElementById('service').value;
  const date = document.getElementById('date').value;
  const time = document.getElementById('time').value;
  const duration = Number(document.getElementById('duration').value) || 60;
  const notes = document.getElementById('notes').value;
  const msg = document.getElementById('formMsg');
  msg.textContent = '';
  if(!name || !service || !date || !time){ msg.textContent = 'Please fill required fields'; return }
  try{
    if(storageMode === 'server'){
      const res = await fetch('/api/bookings', {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ name, service, date, time, duration, notes })
      });
      if(res.status===409){ const data = await res.json(); msg.textContent = data.error; return }
      if(!res.ok){ const data = await res.json(); msg.textContent = data.error || 'Error'; return }
      msg.textContent = 'Booking created!';
      e.target.reset();
      load();
    }else{
      // Local mode: store booking with a generated local id
      const arr = readLocal();
      const localId = Date.now() + Math.floor(Math.random()*1000);
      arr.push({ _localId: localId, name, service, date, time, duration, notes });
      writeLocal(arr);
      msg.textContent = 'Booking saved locally!';
      e.target.reset();
      load();
    }
  }catch(err){
    // If server attempt fails, switch to local mode and retry locally
    storageMode = 'local'; updateModeBadge();
    const arr = readLocal();
    const localId = Date.now() + Math.floor(Math.random()*1000);
    arr.push({ _localId: localId, name, service, date, time, duration, notes });
    writeLocal(arr);
    msg.textContent = 'Offline — booking saved locally';
    e.target.reset();
    load();
  }
});

// Initialize: test server availability then load
(async function init(){
  try{
    const controller = new AbortController();
    const timeout = setTimeout(()=>controller.abort(), 2500);
    const res = await fetch('/api/bookings', { method: 'HEAD', signal: controller.signal });
    clearTimeout(timeout);
    if(!res.ok) throw new Error('no api');
    storageMode = 'server';
  }catch(e){ storageMode = 'local'; }
  updateModeBadge();
  load();
})();

// IntersectionObserver: add .is-visible to .reveal elements when they enter viewport
(function(){
  const els = [];
  const obs = new IntersectionObserver((entries)=>{
    for(const en of entries){
      if(en.isIntersecting) en.target.classList.add('is-visible');
    }
  }, { threshold: 0.15 });
  document.querySelectorAll('.reveal').forEach(el=>{ obs.observe(el); els.push(el); });
  // animate booking items on load
  const list = document.getElementById('bookingsList');
  const mo = new MutationObserver(()=>{ document.querySelectorAll('.booking-item').forEach((it,i)=>{ it.classList.add('enter'); setTimeout(()=>it.classList.add('is-visible'), 40+i*40) }) });
  mo.observe(list, { childList: true, subtree: false });
})();

/* Audio visualizer and simple player (file load + demo oscillator) */
(function(){
  const canvas = document.getElementById('waveform');
  if(!canvas) return;
  const ctx = canvas.getContext('2d');
  let audioCtx = null, source = null, analyser = null, gainNode = null, dataArr = null, bufferLen = 0, osc=null;
  let audioEl = null;
  const fileInput = document.getElementById('fileInput');
  const playDemo = document.getElementById('playDemo');
  const togglePlay = document.getElementById('togglePlay');
  const restartMain = document.getElementById('restartAudio');
  const downloadBtn = document.getElementById('downloadAudio');
  const vol = document.getElementById('vol');
  const msg = document.getElementById('audioMsg');
  let playing = false;
  let currentFileURL = null;

  function ensureCtx(){
    if(audioCtx) return;
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    analyser = audioCtx.createAnalyser(); analyser.fftSize = 2048;
    bufferLen = analyser.fftSize; dataArr = new Uint8Array(bufferLen);
    gainNode = audioCtx.createGain(); gainNode.gain.value = Number(vol.value || 0.8);
    analyser.connect(gainNode); gainNode.connect(audioCtx.destination);
  }

  function connectSource(s){
    if(source) try{ source.disconnect() }catch(e){}
    source = s;
    source.connect(analyser);
  }

  fileInput.addEventListener('change', async (e)=>{
    const f = e.target.files && e.target.files[0];
    if(!f) return;
    // create object URL for download and playback
    try{ if(currentFileURL){ URL.revokeObjectURL(currentFileURL); currentFileURL = null } }catch(_){}
    currentFileURL = URL.createObjectURL(f);
    try{ downloadBtn.href = currentFileURL; downloadBtn.download = f.name; downloadBtn.style.display = ''; downloadBtn.setAttribute('aria-hidden','false'); }catch(err){ console.warn('download setup failed',err); }

    ensureCtx();
    if(osc){ osc.stop(); osc=null }

    // stop & clear any previous audio element
    try{ if(audioEl){ audioEl.pause(); audioEl.src = ''; audioEl = null; } }catch(_){}

    // create new audio element and MediaElementSource so we can pause/resume
    audioEl = new Audio(currentFileURL);
    audioEl.crossOrigin = 'anonymous';
    audioEl.loop = false;
    try{
      const mediaNode = audioCtx.createMediaElementSource(audioEl);
      connectSource(mediaNode);
    }catch(err){ console.warn('media source creation failed', err); }

    // attempt to play immediately; if blocked still loaded
    try{ await audioEl.play(); playing = true; togglePlay.textContent = 'Pause'; msg.textContent = 'Playing: ' + f.name; }
    catch(err){ console.warn('autoplay prevented', err); msg.textContent = 'Loaded: ' + f.name; }

    audioEl.addEventListener('ended', ()=>{ playing=false; togglePlay.textContent='Play'; });
  });

  playDemo.addEventListener('click', ()=>{
    ensureCtx();
    if(osc){ osc.stop(); osc=null; playDemo.textContent='Play Demo Tone'; return }
    osc = audioCtx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 220; // A3
    const oscGain = audioCtx.createGain(); oscGain.gain.value = 0.12;
    osc.connect(analyser); // analyser already connected to gain->dest
    osc.start(); playDemo.textContent='Stop Demo Tone'; msg.textContent='Demo tone playing';
    // when demo plays, hide download link (no file)
    if(currentFileURL){ try{ URL.revokeObjectURL(currentFileURL); }catch(_){} currentFileURL=null }
    downloadBtn.style.display = 'none'; downloadBtn.setAttribute('aria-hidden','true');
    // stop any audio element playback
    try{ if(audioEl){ audioEl.pause(); audioEl.currentTime = 0; audioEl.src = ''; audioEl = null; } }catch(_){}
  });

  togglePlay.addEventListener('click', ()=>{
    if(!audioCtx) { msg.textContent='Load a file or start demo first.'; return }
    if(audioCtx.state === 'suspended') audioCtx.resume();
    // If using oscillator, we toggle stop/start
    if(osc){ osc.stop(); osc=null; togglePlay.textContent='Play'; msg.textContent='Demo stopped'; return }
    // If an audio element exists, toggle play/pause
    if(audioEl){
      if(audioEl.paused){ audioEl.play().then(()=>{ togglePlay.textContent='Pause'; msg.textContent='Playing'; }).catch(()=>{ msg.textContent='Play blocked'; });
      }else{ audioEl.pause(); togglePlay.textContent='Play'; msg.textContent='Paused'; }
      return;
    }
    // otherwise show message
    msg.textContent='If a file is playing, use its controls; file playback auto-starts when loaded.';
  });

  vol.addEventListener('input', (e)=>{ if(gainNode) gainNode.gain.value = Number(e.target.value) });

  // Restart main audio or demo tone
  if(restartMain){
    restartMain.addEventListener('click', async ()=>{
      if(!audioCtx) ensureCtx();
      // Restart demo tone: stop existing oscillator then create + start a fresh one
      if(osc){
        try{ osc.stop(); }catch(_){ }
        osc = audioCtx.createOscillator(); osc.type = 'sine'; osc.frequency.value = 220;
        osc.connect(analyser);
        osc.start();
        playDemo.textContent = 'Stop Demo Tone'; msg.textContent = 'Demo tone playing';
        // hide download (no file)
        if(currentFileURL){ try{ URL.revokeObjectURL(currentFileURL); }catch(_){} currentFileURL=null }
        downloadBtn.style.display = 'none'; downloadBtn.setAttribute('aria-hidden','true');
        try{ if(audioEl){ audioEl.pause(); audioEl.currentTime = 0; audioEl.src = ''; audioEl = null; } }catch(_){ }
        return;
      }
      // Restart loaded file
      if(audioEl){
        try{ audioEl.currentTime = 0; await audioEl.play(); playing = true; togglePlay.textContent = 'Pause'; msg.textContent = 'Playing'; }
        catch(err){ msg.textContent = 'Play blocked'; }
        return;
      }
      msg.textContent = 'Load a file or start demo first.';
    });
  }

  // Drawing loop
  function draw(){
    requestAnimationFrame(draw);
    if(!analyser) {
      // idle animated waveform
      const w = canvas.width, h = canvas.height; ctx.clearRect(0,0,w,h);
      const t = performance.now()/800;
      ctx.lineWidth = 2; const grad = ctx.createLinearGradient(0,0,w,0); grad.addColorStop(0,'#a85df8'); grad.addColorStop(1,'#24e3ff'); ctx.strokeStyle = grad; ctx.beginPath();
      for(let x=0;x<w;x++){ const y = h/2 + Math.sin(x/20 + t) * (h/6) * Math.sin(t*1.3); if(x===0) ctx.moveTo(x,y); else ctx.lineTo(x,y); }
      ctx.stroke(); return;
    }
    analyser.getByteTimeDomainData(dataArr);
    const w = canvas.width, h = canvas.height; ctx.clearRect(0,0,w,h);
    // gradient stroke
    const grad = ctx.createLinearGradient(0,0,w,0); grad.addColorStop(0,'#a85df8'); grad.addColorStop(0.5,'#ff57b9'); grad.addColorStop(1,'#24e3ff');
    ctx.lineWidth = 2; ctx.strokeStyle = grad; ctx.beginPath();
    for(let i=0;i<bufferLen;i++){
      const v = dataArr[i]/128.0; const y = v * h/2; const x = (i/bufferLen)*w;
      if(i===0) ctx.moveTo(x,y); else ctx.lineTo(x,y);
    }
    ctx.stroke();
  }
  draw();
  // clean up objectURL on unload
  window.addEventListener('beforeunload', ()=>{ if(currentFileURL) try{ URL.revokeObjectURL(currentFileURL) }catch(_){} });
})();

/* Background video upload/clear handling */
(function(){
  const bgInput = document.getElementById('bgVideoInput');
  const bgEl = document.getElementById('bgVideo');
  const clearBtn = document.getElementById('clearBgVideo');
  if(!bgInput || !bgEl) return;
  let currentBgURL = null;

  function setBodyHasBg(has){ document.body.classList.toggle('has-bg', !!has); }

  bgInput.addEventListener('change', (e)=>{
    const f = e.target.files && e.target.files[0];
    if(!f) return;
    try{ if(currentBgURL){ URL.revokeObjectURL(currentBgURL); currentBgURL=null } }catch(_){ }
    currentBgURL = URL.createObjectURL(f);
    bgEl.src = currentBgURL;
    bgEl.load();
    // muted ensures autoplay policies allow playback
    bgEl.muted = true; bgEl.loop = true; bgEl.playsInline = true;
    bgEl.play().catch(()=>{});
    setBodyHasBg(true);
  });

  if(clearBtn){ clearBtn.addEventListener('click', ()=>{
    try{ if(currentBgURL){ URL.revokeObjectURL(currentBgURL); currentBgURL=null } }catch(_){ }
    bgEl.pause(); bgEl.removeAttribute('src'); bgEl.load();
    setBodyHasBg(false);
    bgInput.value = '';
  }); }
  // Try to automatically use a packaged background video if present.
  // Check several common filename variants and use the first that exists.
  (async function tryDefaultBg(){
    const candidates = [
      '/EEE Logo (Motion).mp4',
      '/EEE Logo (motion).mp4',
      '/EEE logo (Motion).mp4',
      '/EEE logo (motion).mp4',
      '/EEE logo(motion).mp4',
      '/EEE Logo(motion).mp4',
      '/EEE Logo - motion.mp4',
      '/EEE logo-motion.mp4',
      '/EEE logo.mp4',
      '/EEE Logo.mp4'
    ];
    for(const candidate of candidates){
      const url = encodeURI(candidate);
      try{
        const res = await fetch(url, { method: 'HEAD' });
        if(res && res.ok){
          currentBgURL = url;
          bgEl.src = currentBgURL;
          bgEl.muted = true; bgEl.loop = true; bgEl.playsInline = true;
          bgEl.load();
          bgEl.play().catch(()=>{});
          setBodyHasBg(true);
          break;
        }
      }catch(_){ /* ignore */ }
    }
  })();
})();

  /* Multi-track player: add/remove and per-track play/pause */
  (function(){
    const multiInput = document.getElementById('multiFileInput');
    const tracksContainer = document.getElementById('tracksContainer');
    if(!multiInput || !tracksContainer) return;
    const tracks = new Map();

    function pauseAllExcept(exceptId){
      for(const [k,t] of tracks){
        if(k === exceptId) continue;
        try{ t.audio.pause(); if(t.el){ const pb = t.el.querySelector('.track-controls button'); if(pb) pb.textContent = 'Play'; } }catch(_){ }
      }
    }

    function createTrackEntry(file){
      const id = Date.now().toString(36) + Math.random().toString(36).slice(2,6);
      const url = URL.createObjectURL(file);
      const audio = new Audio(url);
      audio.crossOrigin = 'anonymous';
      audio.preload = 'metadata';

      const item = document.createElement('div');
      item.className = 'track-item';
      const meta = document.createElement('div'); meta.className = 'track-meta';
      meta.innerHTML = `<strong>${escapeHtml(file.name)}</strong><div class="muted">${Math.round(file.size/1024)} KB</div>`;
      const controls = document.createElement('div'); controls.className = 'track-controls';
      const playBtn = document.createElement('button'); playBtn.type='button'; playBtn.textContent = 'Play';
      const restartBtn = document.createElement('button'); restartBtn.type='button'; restartBtn.textContent = 'Restart';
      const remBtn = document.createElement('button'); remBtn.type='button'; remBtn.textContent = 'Remove';
      const vol = document.createElement('input'); vol.type='range'; vol.min=0; vol.max=1; vol.step=0.01; vol.value=0.9;
      controls.appendChild(playBtn); controls.appendChild(restartBtn); controls.appendChild(remBtn); controls.appendChild(vol);
      item.appendChild(meta); item.appendChild(controls);
      tracksContainer.appendChild(item);

      tracks.set(id, { audio, url, el: item, playBtn });

      playBtn.addEventListener('click', async ()=>{
        if(audio.paused){
          // pause other tracks first
          pauseAllExcept(id);
          try{ await audio.play(); playBtn.textContent = 'Pause'; }
          catch(e){ console.warn('play blocked', e); }
        }else{ audio.pause(); playBtn.textContent = 'Play'; }
      });

      audio.addEventListener('play', ()=>{ pauseAllExcept(id); playBtn.textContent = 'Pause' });
      audio.addEventListener('pause', ()=>{ playBtn.textContent = 'Play' });
      audio.addEventListener('ended', ()=>{ playBtn.textContent = 'Play'; audio.currentTime = 0 });

      vol.addEventListener('input', ()=>{ audio.volume = Number(vol.value) });

      remBtn.addEventListener('click', ()=>{
        audio.pause();
        try{ URL.revokeObjectURL(url); }catch(_){ }
        tracks.delete(id);
        item.remove();
      });

      restartBtn.addEventListener('click', async ()=>{
        // restart from 0 and play (single-play enforced)
        pauseAllExcept(id);
        try{ audio.currentTime = 0; await audio.play(); playBtn.textContent = 'Pause'; }
        catch(e){ console.warn('restart/play blocked', e); }
      });
    }

    multiInput.addEventListener('change', (e)=>{
      const files = Array.from(e.target.files || []);
      for(const f of files) createTrackEntry(f);
      multiInput.value = '';
    });
  })();
