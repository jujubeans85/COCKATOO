(() => {
  'use strict';

  const DATA = window.TOUR_DATA;
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => Array.from(root.querySelectorAll(sel));

  const state = {
    currentId: localStorage.getItem('wareamah.currentId') || DATA.stops[0].id,
    lowEnergy: localStorage.getItem('wareamah.lowEnergy') === '1',
    autoAdvance: localStorage.getItem('wareamah.autoAdvance') === '1',
    installed: localStorage.getItem('wareamah.installed') === '1',
    visited: new Set(JSON.parse(localStorage.getItem('wareamah.visited') || '[]')),
    activeMap: localStorage.getItem('wareamah.activeMap') || 'dockyard',
    voiceName: localStorage.getItem('wareamah.voiceName') || '',
    rate: Number(localStorage.getItem('wareamah.rate') || '1'),
    queue: [],
    speakingStopId: null,
    isSpeaking: false,
    speechToken: 0,
    deferredInstallPrompt: null,
    pwaRegistration: null,
    refreshingForUpdate: false
  };

  const params = new URLSearchParams(window.location.search);
  if (params.get('mode') === 'low-energy') state.lowEnergy = true;

  const els = {
    appTitle: $('#appTitle'),
    appSubtitle: $('#appSubtitle'),
    totalStops: $('#totalStops'),
    visitedCount: $('#visitedCount'),
    timeEstimate: $('#timeEstimate'),
    lowEnergyToggle: $('#lowEnergyToggle'),
    autoAdvanceToggle: $('#autoAdvanceToggle'),
    stopList: $('#stopList'),
    stopDetail: $('#stopDetail'),
    mapWrap: $('#mapWrap'),
    routeMap: $('#routeMap'),
    mapMarkers: $('#mapMarkers'),
    currentStopTitle: $('#currentStopTitle'),
    currentStopSummary: $('#currentStopSummary'),
    playCurrentBtn: $('#playCurrentBtn'),
    pauseBtn: $('#pauseBtn'),
    resumeBtn: $('#resumeBtn'),
    stopBtn: $('#stopBtn'),
    prevStopBtn: $('#prevStopBtn'),
    nextStopBtn: $('#nextStopBtn'),
    markVisitedBtn: $('#markVisitedBtn'),
    resetBtn: $('#resetBtn'),
    installBtn: $('#installBtn'),
    updateBtn: $('#updateBtn'),
    offlineStatus: $('#offlineStatus'),
    offlineSaveBtn: $('#offlineSaveBtn'),
    sourcesBtn: $('#sourcesBtn'),
    sourcesDialog: $('#sourcesDialog'),
    closeSourcesBtn: $('#closeSourcesBtn'),
    installDialog: $('#installDialog'),
    closeInstallBtn: $('#closeInstallBtn'),
    sourcesList: $('#sourcesList'),
    voiceSelect: $('#voiceSelect'),
    rateSlider: $('#rateSlider'),
    rateValue: $('#rateValue'),
    speechStatus: $('#speechStatus')
  };

  function visibleStops() {
    return DATA.stops.filter(stop => !state.lowEnergy || stop.lowEnergy);
  }

  function getStop(id = state.currentId) {
    return DATA.stops.find(stop => stop.id === id) || DATA.stops[0];
  }

  function stopIndex(id = state.currentId) {
    return visibleStops().findIndex(stop => stop.id === id);
  }

  function persist() {
    localStorage.setItem('wareamah.currentId', state.currentId);
    localStorage.setItem('wareamah.lowEnergy', state.lowEnergy ? '1' : '0');
    localStorage.setItem('wareamah.autoAdvance', state.autoAdvance ? '1' : '0');
    localStorage.setItem('wareamah.installed', state.installed ? '1' : '0');
    localStorage.setItem('wareamah.visited', JSON.stringify([...state.visited]));
    localStorage.setItem('wareamah.activeMap', state.activeMap);
    localStorage.setItem('wareamah.voiceName', state.voiceName || '');
    localStorage.setItem('wareamah.rate', String(state.rate));
  }

  function escapeHTML(text) {
    return String(text ?? '').replace(/[&<>'"]/g, char => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[char]));
  }

  function minutesTotal(stops) {
    return stops.reduce((sum, stop) => sum + Number(stop.duration || 0), 0);
  }

  function timeLabel(mins) {
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h ? `${h}h ${String(m).padStart(2, '0')}m` : `${m}m`;
  }

  function setCurrent(id, opts = {}) {
    if (!visibleStops().some(s => s.id === id)) {
      const first = visibleStops()[0];
      id = first ? first.id : DATA.stops[0].id;
    }
    state.currentId = id;
    persist();
    renderAll();
    if (opts.scroll !== false) {
      $('#stopDetail')?.scrollIntoView({ behavior: opts.instant ? 'auto' : 'smooth', block: 'start' });
    }
  }

  function nextStop() {
    const stops = visibleStops();
    const idx = stopIndex();
    if (idx >= 0 && idx < stops.length - 1) setCurrent(stops[idx + 1].id);
  }

  function prevStop() {
    const stops = visibleStops();
    const idx = stopIndex();
    if (idx > 0) setCurrent(stops[idx - 1].id);
  }

  function markVisited(id = state.currentId) {
    state.visited.add(id);
    persist();
    renderAll();
  }

  function renderHeader() {
    els.appTitle.textContent = DATA.title;
    els.appSubtitle.textContent = `${DATA.subtitle}. Built as a static PWA prototype. Core route: ${DATA.estimatedTime}.`;
    const stops = visibleStops();
    els.totalStops.textContent = stops.length;
    els.visitedCount.textContent = stops.filter(s => state.visited.has(s.id)).length;
    els.timeEstimate.textContent = timeLabel(minutesTotal(stops));
    els.lowEnergyToggle.checked = state.lowEnergy;
    els.autoAdvanceToggle.checked = state.autoAdvance;
    els.rateSlider.value = String(state.rate);
    els.rateValue.textContent = `${state.rate.toFixed(2)}×`;
    renderPWAStatus();
  }

  function renderStopList() {
    const stops = visibleStops();
    els.stopList.innerHTML = stops.map(stop => {
      const current = stop.id === state.currentId;
      const optional = !stop.lowEnergy;
      const visited = state.visited.has(stop.id);
      return `<li>
        <button class="stop-pill ${current ? 'current' : ''} ${optional ? 'optional' : ''}" data-stop-id="${escapeHTML(stop.id)}" aria-current="${current ? 'step' : 'false'}">
          <span class="stop-num">${stop.number}</span>
          <span><span class="stop-name">${escapeHTML(stop.shortTitle)}</span><span class="stop-meta">${escapeHTML(stop.duration)} min · ${escapeHTML(stop.theme)}</span></span>
          <span class="stop-check" aria-label="${visited ? 'Visited' : 'Not visited'}">${visited ? '✓' : optional ? '◇' : '○'}</span>
        </button>
      </li>`;
    }).join('');
    $$('.stop-pill', els.stopList).forEach(btn => {
      btn.addEventListener('click', () => setCurrent(btn.dataset.stopId));
    });
  }

  function renderMap() {
    const mapSrc = state.activeMap === 'convict' ? 'assets/convict-plateau-map.jpeg' : 'assets/dockyard-map.jpeg';
    els.routeMap.src = mapSrc;
    els.routeMap.alt = state.activeMap === 'convict' ? 'Convict plateau map with tour markers' : 'Dockyard and ferry arrival map with tour markers';
    $$('.map-tab').forEach(tab => tab.classList.toggle('active', tab.dataset.map === state.activeMap));

    const stops = visibleStops();
    els.mapMarkers.innerHTML = DATA.stops.map(stop => {
      const visible = stops.some(s => s.id === stop.id) && stop.map === state.activeMap;
      const classes = [
        'marker',
        stop.lowEnergy ? '' : 'optional',
        state.visited.has(stop.id) ? 'visited' : '',
        state.currentId === stop.id ? 'current' : '',
        visible ? '' : 'hidden'
      ].filter(Boolean).join(' ');
      return `<button class="${classes}" style="left:${stop.marker.x}%;top:${stop.marker.y}%" data-stop-id="${escapeHTML(stop.id)}" title="Stop ${stop.number}: ${escapeHTML(stop.shortTitle)}">
        ${stop.number}<span>${escapeHTML(stop.shortTitle)}</span>
      </button>`;
    }).join('');
    $$('.marker', els.mapMarkers).forEach(marker => marker.addEventListener('click', () => setCurrent(marker.dataset.stopId)));
  }

  function renderNowPlaying() {
    const stop = getStop();
    els.currentStopTitle.textContent = `Stop ${stop.number} — ${stop.title}`;
    els.currentStopSummary.textContent = stop.summary;
    const idx = stopIndex();
    els.prevStopBtn.disabled = idx <= 0;
    els.nextStopBtn.disabled = idx < 0 || idx >= visibleStops().length - 1;
    els.markVisitedBtn.textContent = state.visited.has(stop.id) ? 'Visited ✓' : 'Mark visited';
  }

  function sourceById(id) {
    return DATA.sources.find(s => s.id === id);
  }

  function mediaHTML(media) {
    const link = media.source && media.source !== 'local' ? `<p><a href="${escapeHTML(media.source)}" target="_blank" rel="noreferrer">Open source</a></p>` : '';
    return `<figure class="media-card">
      <img src="${escapeHTML(media.src)}" alt="${escapeHTML(media.caption)}" loading="lazy" decoding="async" referrerpolicy="no-referrer" onerror="this.onerror=null;this.src='assets/offline-media.svg';this.classList.add('offline-image');" />
      <figcaption><strong>${escapeHTML(media.caption)}</strong><br>${escapeHTML(media.credit || '')}${link}</figcaption>
    </figure>`;
  }

  function sourceChips(ids) {
    return `<div class="sources-mini">${(ids || []).map(id => {
      const src = sourceById(id);
      if (!src) return '';
      return `<a class="source-chip" href="${escapeHTML(src.url)}" target="_blank" rel="noreferrer">${escapeHTML(src.publisher)}</a>`;
    }).join('')}</div>`;
  }

  function renderStopDetail() {
    const stop = getStop();
    const optional = !stop.lowEnergy;
    const narrationText = stop.narration.join('\n\n');
    const facts = stop.factCards || [];
    els.stopDetail.innerHTML = `
      <article class="stop-card panel" id="detail-${escapeHTML(stop.id)}">
        <div class="stop-hero">
          <div>
            <p class="eyebrow">Stop ${stop.number} · ${escapeHTML(stop.duration)} min · ${escapeHTML(stop.era)}</p>
            <div class="stop-title-line">
              <h2>${escapeHTML(stop.title)}</h2>
              ${optional ? '<span class="badge optional">optional detour</span>' : '<span class="badge">core route</span>'}
            </div>
            <p class="muted">${escapeHTML(stop.summary)}</p>
          </div>
          <div class="stop-controls">
            <button class="primary" id="detailPlayBtn">▶ Play this stop</button>
            <button id="detailVisitedBtn">${state.visited.has(stop.id) ? 'Visited ✓' : 'Mark visited'}</button>
          </div>
        </div>

        <div class="content-grid">
          <section class="block narration">
            <h3>Voice script</h3>
            ${stop.narration.map(p => `<p>${escapeHTML(p)}</p>`).join('')}
          </section>
          <aside class="block callout">
            <h3>Directions</h3>
            <p>${escapeHTML(stop.directions)}</p>
            <h3>Look for</h3>
            <ul>${stop.lookFor.map(item => `<li>${escapeHTML(item)}</li>`).join('')}</ul>
          </aside>
        </div>

        <div class="content-grid">
          <section class="block funfact">
            <h3>Dani & Juice mission</h3>
            <p>${escapeHTML(stop.mission)}</p>
            <h3>Secret / fun fact</h3>
            <p>${escapeHTML(stop.secret)}</p>
          </section>
          <section class="block">
            <h3>Fact cards</h3>
            <ul>${facts.map(f => `<li>${escapeHTML(f)}</li>`).join('')}</ul>
          </section>
        </div>
      </article>

      <article class="stop-card panel">
        <div class="section-head compact">
          <div>
            <p class="eyebrow">Photos · diagrams · plans</p>
            <h2>Media matched to this stop</h2>
          </div>
        </div>
        <div class="media-grid">${stop.media.map(mediaHTML).join('')}</div>
      </article>

      <article class="stop-card panel">
        <div class="section-head compact">
          <div>
            <p class="eyebrow">Visual explainers</p>
            <h2>Quick diagrams</h2>
          </div>
        </div>
        <div class="diagram-grid">${(stop.diagrams || []).map(renderDiagram).join('')}</div>
      </article>

      <article class="stop-card panel">
        <div class="section-head compact">
          <div>
            <p class="eyebrow">Fallback</p>
            <h2>Read aloud / copy script</h2>
          </div>
          <button id="copyScriptBtn">Copy stop script</button>
        </div>
        <div class="block copy-box">${escapeHTML(narrationText)}</div>
        <div class="block">
          <h3>Sources for this stop</h3>
          ${sourceChips(stop.sourceIds)}
        </div>
      </article>
    `;

    $('#detailPlayBtn')?.addEventListener('click', () => speakStop(stop.id));
    $('#detailVisitedBtn')?.addEventListener('click', () => markVisited(stop.id));
    $('#copyScriptBtn')?.addEventListener('click', async () => {
      try {
        await navigator.clipboard.writeText(narrationText);
        $('#copyScriptBtn').textContent = 'Copied ✓';
        setTimeout(() => $('#copyScriptBtn').textContent = 'Copy stop script', 1200);
      } catch {
        alert('Copy failed. Select the text manually — annoying, but survivable.');
      }
    });
  }

  function renderSources() {
    els.sourcesList.innerHTML = DATA.sources.map(src => `
      <article class="source-card">
        <h3><a href="${escapeHTML(src.url)}" target="_blank" rel="noreferrer">${escapeHTML(src.title)}</a></h3>
        <p><strong>${escapeHTML(src.publisher)}</strong></p>
        <p>${escapeHTML(src.note)}</p>
      </article>
    `).join('');
  }

  function renderAll() {
    renderHeader();
    renderStopList();
    renderMap();
    renderNowPlaying();
    renderStopDetail();
    renderSources();
  }

  function chunksForSpeech(text) {
    const cleaned = text.replace(/\s+/g, ' ').trim();
    const sentences = cleaned.match(/[^.!?]+[.!?]+|[^.!?]+$/g) || [cleaned];
    const chunks = [];
    let current = '';
    for (const sentence of sentences) {
      if ((current + ' ' + sentence).trim().length > 220 && current) {
        chunks.push(current.trim());
        current = sentence;
      } else {
        current += ' ' + sentence;
      }
    }
    if (current.trim()) chunks.push(current.trim());
    return chunks;
  }

  function selectedVoice() {
    const voices = speechSynthesis.getVoices();
    return voices.find(v => v.name === state.voiceName) ||
      voices.find(v => /en-AU/i.test(v.lang)) ||
      voices.find(v => /en-GB|en-US/i.test(v.lang)) || voices[0];
  }

  function setSpeechStatus(text) {
    els.speechStatus.textContent = text;
  }

  function speakText(text, onDone) {
    if (!('speechSynthesis' in window)) {
      alert('This browser does not support speech synthesis. Use the read-aloud script as fallback.');
      return;
    }
    speechSynthesis.cancel();
    const token = ++state.speechToken;
    const chunks = chunksForSpeech(text);
    let i = 0;
    const voice = selectedVoice();
    state.isSpeaking = true;
    setSpeechStatus('Speaking');

    function speakNext() {
      if (token !== state.speechToken) return;
      if (i >= chunks.length) {
        state.isSpeaking = false;
        setSpeechStatus('Idle');
        onDone?.();
        return;
      }
      const utter = new SpeechSynthesisUtterance(chunks[i]);
      utter.rate = state.rate;
      utter.pitch = 1;
      utter.volume = 1;
      if (voice) utter.voice = voice;
      utter.onend = () => { if (token !== state.speechToken) return; i += 1; speakNext(); };
      utter.onerror = () => { if (token !== state.speechToken) return; i += 1; speakNext(); };
      speechSynthesis.speak(utter);
    }
    speakNext();
  }

  function speakStop(id = state.currentId) {
    const stop = getStop(id);
    if (!stop) return;
    if (id !== state.currentId) setCurrent(id, { scroll: false });
    state.speakingStopId = id;
    const intro = `Stop ${stop.number}. ${stop.title}. Directions: ${stop.directions}.`;
    const text = [intro, ...stop.narration, `Mission. ${stop.mission}`, `Secret fact. ${stop.secret}`].join(' ');
    speakText(text, () => {
      markVisited(stop.id);
      if (state.autoAdvance) {
        const stops = visibleStops();
        const idx = stops.findIndex(s => s.id === stop.id);
        const next = stops[idx + 1];
        if (next) {
          setCurrent(next.id, { scroll: false });
          setTimeout(() => speakStop(next.id), 650);
        }
      }
    });
  }

  function pauseSpeech() {
    if ('speechSynthesis' in window && speechSynthesis.speaking) {
      speechSynthesis.pause();
      setSpeechStatus('Paused');
    }
  }
  function resumeSpeech() {
    if ('speechSynthesis' in window) {
      speechSynthesis.resume();
      setSpeechStatus('Speaking');
    }
  }
  function stopSpeech() {
    state.speechToken += 1;
    if ('speechSynthesis' in window) speechSynthesis.cancel();
    state.isSpeaking = false;
    setSpeechStatus('Idle');
  }

  function populateVoices() {
    if (!('speechSynthesis' in window)) {
      els.voiceSelect.innerHTML = '<option>Speech not supported</option>';
      els.voiceSelect.disabled = true;
      return;
    }
    const voices = speechSynthesis.getVoices();
    const sorted = voices.sort((a, b) => (a.lang + a.name).localeCompare(b.lang + b.name));
    els.voiceSelect.innerHTML = sorted.map(v => `<option value="${escapeHTML(v.name)}">${escapeHTML(v.name)} — ${escapeHTML(v.lang)}</option>`).join('');
    const best = selectedVoice();
    if (best) {
      els.voiceSelect.value = state.voiceName || best.name;
      state.voiceName = els.voiceSelect.value;
    }
  }

  function renderDiagram(type) {
    const titleMap = {
      layers: 'Layer cake of the island', timeline: 'Timeline', verticalSplit: 'Vertical split', surveillance: 'Surveillance sightlines', crowding: 'Barracks crowding', silo: 'Bottle-shaped silo', lofting: 'Lofting / design workflow', transition: 'Punishment → infrastructure', dryDock: 'How a dry dock works', thenNow: 'Then/now comparison prompt', power: 'Powerhouse system', warStats: 'War-work scale', workforce: 'Trades + unions', routeLoop: 'Tunnel return loop', debrief: 'Debrief compass'
    };
    const noteMap = {
      layers: 'A simplified model: Country under every later layer; prison and dockyard visibly stacked.',
      timeline: 'Key dates for quick orientation. Use the full source deck for deeper digging.',
      verticalSplit: 'Upper plateau = control; lower apron = industrial work. Oversimplified, but useful.',
      surveillance: 'Authority buildings used height and sightlines as part of the control system.',
      crowding: 'Not a measured floor plan — a visual reminder of overcrowding described in sources.',
      silo: 'Simplified cross-section based on bottle-shaped sandstone grain silos.',
      lofting: 'Ship design turns drawings into full-scale templates and buildable parts.',
      transition: 'The dockyard is not separate from convict labour; it grows from it.',
      dryDock: 'Float in, seal, pump out, prop, repair, refloat. Big hole, serious consequences.',
      thenNow: 'Line up the historic Fitzroy Dock photo with the surviving dock shape.',
      power: 'Power, steam, pumps and electricity made the dockyard work.',
      warStats: 'WW1 and WW2 turned Cockatoo into national defence infrastructure.',
      workforce: 'A dockyard is a network of trades, not just buildings and ships.',
      routeLoop: 'Tunnels and roads move people through the island’s sandstone body.',
      debrief: 'Use this to turn the walk into memory instead of just steps.'
    };
    if (type === 'timeline') return timelineHTML();
    return `<section class="diagram-card"><h3>${escapeHTML(titleMap[type] || type)}</h3>${diagramSVG(type)}<p class="diagram-note">${escapeHTML(noteMap[type] || '')}</p></section>`;
  }

  function timelineHTML() {
    return `<section class="diagram-card"><h3>Timeline</h3><div class="timeline-list">${DATA.timeline.map(t => `
      <div class="timeline-item"><div class="timeline-date">${escapeHTML(t.date)}</div><div><div class="timeline-label">${escapeHTML(t.label)}</div><div class="muted tiny">${escapeHTML(t.text)}</div></div></div>
    `).join('')}</div><p class="diagram-note">The tour follows this order emotionally, not perfectly chronologically.</p></section>`;
  }

  function diagramSVG(type) {
    const common = 'viewBox="0 0 420 230" role="img" aria-hidden="true"';
    const colors = {
      dark:'#263238', red:'#b13e2d', purple:'#7b2f76', gold:'#d9a441', green:'#637a47', pale:'#f7efe2', line:'#d1bfa4', blue:'#9fb8c3'
    };
    switch (type) {
      case 'layers':
        return `<svg ${common}><rect width="420" height="230" fill="#fffaf1"/><g transform="translate(45 35)"><path d="M40 130 L175 20 L300 130 Z" fill="${colors.blue}" opacity=".42"/><rect x="20" y="130" width="320" height="24" rx="10" fill="${colors.green}"/><rect x="40" y="104" width="280" height="24" rx="10" fill="${colors.red}"/><rect x="62" y="78" width="236" height="24" rx="10" fill="${colors.gold}"/><rect x="85" y="52" width="190" height="24" rx="10" fill="${colors.dark}"/><text x="180" y="148" text-anchor="middle" font-size="12" fill="#fff">Country / harbour</text><text x="180" y="122" text-anchor="middle" font-size="12" fill="#fff">Convict punishment</text><text x="180" y="96" text-anchor="middle" font-size="12" fill="#332">Dockyard / industry</text><text x="180" y="70" text-anchor="middle" font-size="12" fill="#fff">Public heritage</text></g></svg>`;
      case 'verticalSplit':
        return `<svg ${common}><rect width="420" height="230" fill="#fffaf1"/><path d="M40 148 C120 80 270 60 380 118 L380 175 L40 175Z" fill="${colors.line}"/><path d="M70 92 L250 92 L315 135 L45 135 Z" fill="${colors.gold}" opacity=".7"/><rect x="62" y="70" width="52" height="28" fill="${colors.red}"/><rect x="128" y="68" width="46" height="32" fill="${colors.dark}"/><rect x="215" y="145" width="126" height="20" fill="${colors.dark}"/><rect x="60" y="165" width="290" height="25" fill="${colors.blue}"/><text x="118" y="58" font-size="13" font-weight="700">upper: control</text><text x="228" y="210" font-size="13" font-weight="700">lower: docks + labour</text><path d="M205 100 C205 125 215 139 242 151" stroke="${colors.red}" stroke-width="5" fill="none" stroke-dasharray="8 6"/></svg>`;
      case 'surveillance':
        return `<svg ${common}><rect width="420" height="230" fill="#fffaf1"/><rect x="58" y="74" width="80" height="60" rx="5" fill="${colors.gold}"/><path d="M60 74 L98 38 L136 74" fill="${colors.red}"/><rect x="240" y="130" width="112" height="48" rx="5" fill="${colors.dark}"/><circle cx="98" cy="68" r="7" fill="#fff"/><path d="M105 70 L246 138 M105 70 L286 150 M105 70 L344 165" stroke="${colors.purple}" stroke-width="2" stroke-dasharray="6 5"/><text x="62" y="154" font-size="13" font-weight="800">house / authority</text><text x="246" y="196" font-size="13" font-weight="800">barracks / yard</text></svg>`;
      case 'crowding':
        return `<svg ${common}><rect width="420" height="230" fill="#fffaf1"/><rect x="48" y="45" width="324" height="138" rx="8" fill="none" stroke="${colors.dark}" stroke-width="3"/><g fill="${colors.red}" opacity=".82">${Array.from({length:48}, (_,i)=>`<circle cx="${70+(i%12)*24}" cy="${68+Math.floor(i/12)*28}" r="7"/>`).join('')}</g><text x="210" y="208" text-anchor="middle" font-size="13" font-weight="800">visual reminder: overcrowding, not a measured plan</text></svg>`;
      case 'silo':
        return `<svg ${common}><rect width="420" height="230" fill="#fffaf1"/><rect x="0" y="0" width="420" height="74" fill="${colors.green}" opacity=".35"/><path d="M178 70 C160 100 148 132 158 166 C168 200 250 200 262 166 C274 132 260 100 242 70 Z" fill="${colors.gold}" opacity=".65" stroke="${colors.dark}" stroke-width="3"/><rect x="185" y="50" width="50" height="22" rx="10" fill="${colors.dark}"/><path d="M170 70 H250" stroke="${colors.dark}" stroke-width="4"/><text x="210" y="34" text-anchor="middle" font-size="13" font-weight="800">ground level</text><text x="210" y="140" text-anchor="middle" font-size="14" font-weight="900">grain</text><text x="210" y="214" text-anchor="middle" font-size="12">bottle-shaped sandstone chamber</text></svg>`;
      case 'lofting':
        return `<svg ${common}><rect width="420" height="230" fill="#fffaf1"/><g transform="translate(38 54)"><rect x="0" y="0" width="82" height="58" rx="10" fill="${colors.gold}"/><rect x="130" y="0" width="82" height="58" rx="10" fill="${colors.blue}"/><rect x="260" y="0" width="82" height="58" rx="10" fill="${colors.green}"/><path d="M84 29 H128 M214 29 H258" stroke="${colors.dark}" stroke-width="4" marker-end="url(#arrow)"/><text x="41" y="34" text-anchor="middle" font-size="12" font-weight="900">drawing</text><text x="171" y="26" text-anchor="middle" font-size="12" font-weight="900">full-size</text><text x="171" y="42" text-anchor="middle" font-size="12" font-weight="900">template</text><text x="301" y="34" text-anchor="middle" font-size="12" font-weight="900">ship part</text></g><defs><marker id="arrow" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill="${colors.dark}"/></marker></defs><path d="M80 155 C150 110 245 110 335 155" stroke="${colors.red}" stroke-width="4" fill="none"/><path d="M80 171 C150 126 245 126 335 171" stroke="${colors.purple}" stroke-width="3" fill="none" stroke-dasharray="8 6"/></svg>`;
      case 'transition':
        return `<svg ${common}><rect width="420" height="230" fill="#fffaf1"/><rect x="50" y="55" width="100" height="86" rx="8" fill="${colors.red}"/><rect x="268" y="95" width="104" height="50" rx="8" fill="${colors.dark}"/><path d="M150 100 C190 100 210 120 260 120" stroke="${colors.gold}" stroke-width="8" fill="none"/><text x="100" y="160" text-anchor="middle" font-size="13" font-weight="900">prison</text><text x="320" y="166" text-anchor="middle" font-size="13" font-weight="900">dockyard</text><text x="210" y="88" text-anchor="middle" font-size="12">labour system</text></svg>`;
      case 'dryDock':
        return `<svg ${common}><rect width="420" height="230" fill="#fffaf1"/><rect x="30" y="125" width="360" height="55" fill="${colors.blue}" opacity=".55"/><path d="M70 70 L120 180 L300 180 L350 70" fill="#ead8bd" stroke="${colors.dark}" stroke-width="3"/><rect x="140" y="98" width="140" height="38" rx="20" fill="${colors.dark}"/><path d="M120 136 H300" stroke="#fff" stroke-width="3"/><path d="M86 75 H333" stroke="${colors.red}" stroke-width="5" stroke-dasharray="9 7"/><text x="210" y="41" text-anchor="middle" font-size="13" font-weight="900">float in → close gate → pump out → prop hull</text><path d="M160 140 v38 M260 140 v38" stroke="${colors.gold}" stroke-width="5"/></svg>`;
      case 'thenNow':
        return `<svg ${common}><rect width="420" height="230" fill="#fffaf1"/><rect x="42" y="54" width="146" height="110" rx="12" fill="${colors.line}"/><rect x="232" y="54" width="146" height="110" rx="12" fill="${colors.blue}" opacity=".55"/><path d="M65 134 C100 95 135 95 166 134" stroke="${colors.dark}" stroke-width="4" fill="none"/><path d="M255 134 C290 95 325 95 356 134" stroke="${colors.dark}" stroke-width="4" fill="none"/><path d="M188 110 H232" stroke="${colors.red}" stroke-width="4" marker-end="url(#arr2)"/><text x="115" y="185" text-anchor="middle" font-size="13" font-weight="900">c1875 photo</text><text x="305" y="185" text-anchor="middle" font-size="13" font-weight="900">today’s dock</text><defs><marker id="arr2" markerWidth="8" markerHeight="8" refX="7" refY="4" orient="auto"><path d="M0 0 L8 4 L0 8Z" fill="${colors.red}"/></marker></defs></svg>`;
      case 'power':
        return `<svg ${common}><rect width="420" height="230" fill="#fffaf1"/><rect x="52" y="112" width="98" height="62" rx="8" fill="${colors.red}"/><rect x="166" y="92" width="86" height="82" rx="8" fill="${colors.gold}"/><rect x="270" y="120" width="94" height="54" rx="8" fill="${colors.dark}"/><path d="M100 112 C95 78 105 54 100 30" stroke="${colors.dark}" stroke-width="12"/><path d="M150 142 H166 M252 132 H270" stroke="${colors.dark}" stroke-width="5"/><path d="M205 92 C200 68 213 48 208 26" stroke="${colors.purple}" stroke-width="5" fill="none"/><text x="101" y="199" text-anchor="middle" font-size="12" font-weight="900">steam / boilers</text><text x="209" y="199" text-anchor="middle" font-size="12" font-weight="900">generator</text><text x="318" y="199" text-anchor="middle" font-size="12" font-weight="900">pumps + dock</text></svg>`;
      case 'warStats':
        return `<svg ${common}><rect width="420" height="230" fill="#fffaf1"/><rect x="65" y="70" width="80" height="108" rx="8" fill="${colors.red}"/><rect x="170" y="38" width="80" height="140" rx="8" fill="${colors.dark}"/><rect x="275" y="101" width="80" height="77" rx="8" fill="${colors.gold}"/><text x="105" y="62" text-anchor="middle" font-size="13" font-weight="900">WW1</text><text x="210" y="30" text-anchor="middle" font-size="13" font-weight="900">workers</text><text x="315" y="93" text-anchor="middle" font-size="13" font-weight="900">WW2</text><text x="105" y="134" text-anchor="middle" fill="#fff" font-size="18" font-weight="900">~2k</text><text x="105" y="154" text-anchor="middle" fill="#fff" font-size="11">dockings</text><text x="210" y="118" text-anchor="middle" fill="#fff" font-size="18" font-weight="900">4,085</text><text x="210" y="138" text-anchor="middle" fill="#fff" font-size="11">by 1919</text><text x="315" y="146" text-anchor="middle" fill="#332" font-size="18" font-weight="900">250</text><text x="315" y="166" text-anchor="middle" fill="#332" font-size="11">repairs</text></svg>`;
      case 'workforce':
        return `<svg ${common}><rect width="420" height="230" fill="#fffaf1"/><circle cx="210" cy="115" r="40" fill="${colors.dark}"/><text x="210" y="111" text-anchor="middle" font-size="12" fill="#fff" font-weight="900">dockyard</text><text x="210" y="127" text-anchor="middle" font-size="12" fill="#fff" font-weight="900">work</text>${[['welders',90,60,colors.red],['shipwrights',320,62,colors.gold],['electricians',80,165,colors.purple],['ironworkers',320,166,colors.green],['drawers',210,32,colors.blue]].map(([label,x,y,c])=>`<circle cx="${x}" cy="${y}" r="30" fill="${c}" opacity=".85"/><path d="M${x} ${y} L210 115" stroke="${colors.dark}" stroke-width="2" opacity=".45"/><text x="${x}" y="${y+4}" text-anchor="middle" font-size="10" font-weight="900" fill="${c===colors.gold||c===colors.blue?'#263238':'#fff'}">${label}</text>`).join('')}</svg>`;
      case 'routeLoop':
        return `<svg ${common}><rect width="420" height="230" fill="#fffaf1"/><path d="M70 165 C105 60 310 55 350 160" fill="none" stroke="${colors.dark}" stroke-width="14" stroke-linecap="round"/><path d="M84 164 C120 84 296 82 336 158" fill="none" stroke="#fffaf1" stroke-width="7" stroke-linecap="round" stroke-dasharray="10 10"/><circle cx="72" cy="165" r="16" fill="${colors.red}"/><circle cx="348" cy="160" r="16" fill="${colors.green}"/><text x="210" y="202" text-anchor="middle" font-size="13" font-weight="900">cut through rock, emerge in another era</text></svg>`;
      case 'debrief':
        return `<svg ${common}><rect width="420" height="230" fill="#fffaf1"/><circle cx="210" cy="115" r="78" fill="none" stroke="${colors.dark}" stroke-width="3"/><path d="M210 37 L226 115 L210 193 L194 115 Z" fill="${colors.red}" opacity=".78"/><path d="M132 115 L210 99 L288 115 L210 131 Z" fill="${colors.gold}" opacity=".78"/><text x="210" y="24" text-anchor="middle" font-size="12" font-weight="900">What hit hardest?</text><text x="210" y="218" text-anchor="middle" font-size="12" font-weight="900">What will you remember?</text><text x="48" y="119" font-size="12" font-weight="900">hidden detail</text><text x="304" y="119" font-size="12" font-weight="900">grim fact</text></svg>`;
      default:
        return `<svg ${common}><rect width="420" height="230" fill="#fffaf1"/><text x="210" y="115" text-anchor="middle" font-size="16">Diagram</text></svg>`;
    }
  }


  function isStandalone() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function renderPWAStatus(message, kind = '') {
    if (!els.offlineStatus) return;
    const installed = isStandalone() || state.installed;
    const swSupported = 'serviceWorker' in navigator;
    const online = navigator.onLine;
    let text = message;
    let statusClass = kind;

    if (!text) {
      if (!swSupported) {
        text = online ? 'Online · no service worker' : 'Offline · browser limited';
        statusClass = online ? 'online' : 'offline';
      } else if (state.pwaRegistration?.active || navigator.serviceWorker?.controller) {
        text = online ? 'Online · PWA ready' : 'Offline · PWA ready';
        statusClass = online ? 'online' : 'offline';
      } else {
        text = online ? 'Online · installing cache' : 'Offline · loading cache';
        statusClass = online ? 'ready' : 'offline';
      }
    }

    els.offlineStatus.textContent = text;
    els.offlineStatus.className = `connection-pill ${statusClass || (online ? 'online' : 'offline')}`;

    if (els.installBtn) {
      els.installBtn.hidden = installed;
      els.installBtn.textContent = state.deferredInstallPrompt ? 'Install app' : 'Install help';
    }
  }

  function mediaUrlsForOffline() {
    const media = DATA.stops.flatMap(stop => (stop.media || []).map(item => item.src));
    return [
      'assets/dockyard-map.jpeg',
      'assets/convict-plateau-map.jpeg',
      'assets/offline-media.svg',
      ...media
    ].filter(Boolean);
  }

  function sendServiceWorkerMessage(message) {
    return new Promise((resolve, reject) => {
      const worker = navigator.serviceWorker?.controller || state.pwaRegistration?.active;
      if (!worker) {
        reject(new Error('Service worker is not active yet.'));
        return;
      }
      const channel = new MessageChannel();
      const timer = setTimeout(() => reject(new Error('Service worker did not respond.')), 45000);
      channel.port1.onmessage = event => {
        clearTimeout(timer);
        resolve(event.data || {});
      };
      worker.postMessage(message, [channel.port2]);
    });
  }

  async function saveOffline() {
    if (!('serviceWorker' in navigator)) {
      renderPWAStatus('Offline save unavailable', 'offline');
      showInstallHelp();
      return;
    }
    const originalText = els.offlineSaveBtn.textContent;
    els.offlineSaveBtn.disabled = true;
    els.offlineSaveBtn.textContent = 'Saving…';
    renderPWAStatus('Saving offline…', 'ready');

    try {
      state.pwaRegistration = await navigator.serviceWorker.ready;
      const result = await sendServiceWorkerMessage({ type: 'CACHE_URLS', urls: mediaUrlsForOffline() });
      const failed = Number(result.failed || 0);
      const saved = Number(result.saved || 0);
      const total = Number(result.total || 0);
      if (failed) {
        renderPWAStatus(`Saved ${saved}/${total} media`, 'ready');
        els.offlineSaveBtn.textContent = 'Retry media cache';
      } else {
        renderPWAStatus('Saved offline ✓', 'ready');
        els.offlineSaveBtn.textContent = 'Saved ✓';
      }
    } catch (error) {
      renderPWAStatus('App shell cached; retry media', 'ready');
      els.offlineSaveBtn.textContent = originalText;
    } finally {
      els.offlineSaveBtn.disabled = false;
    }
  }

  function showInstallHelp() {
    if (els.installDialog?.showModal) els.installDialog.showModal();
  }

  function showUpdateReady(registration) {
    state.pwaRegistration = registration;
    if (els.updateBtn) els.updateBtn.hidden = false;
  }

  function bindEvents() {
    els.lowEnergyToggle.addEventListener('change', () => {
      state.lowEnergy = els.lowEnergyToggle.checked;
      if (state.lowEnergy && !getStop().lowEnergy) state.currentId = visibleStops()[0].id;
      persist();
      renderAll();
    });
    els.autoAdvanceToggle.addEventListener('change', () => {
      state.autoAdvance = els.autoAdvanceToggle.checked;
      persist();
      renderHeader();
    });
    $$('.map-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        state.activeMap = tab.dataset.map;
        persist();
        renderMap();
      });
    });
    els.playCurrentBtn.addEventListener('click', () => speakStop());
    els.pauseBtn.addEventListener('click', pauseSpeech);
    els.resumeBtn.addEventListener('click', resumeSpeech);
    els.stopBtn.addEventListener('click', stopSpeech);
    els.nextStopBtn.addEventListener('click', nextStop);
    els.prevStopBtn.addEventListener('click', prevStop);
    els.markVisitedBtn.addEventListener('click', () => markVisited());
    els.resetBtn.addEventListener('click', () => {
      if (!confirm('Reset visited stops and current position?')) return;
      state.visited.clear();
      state.currentId = DATA.stops[0].id;
      stopSpeech();
      persist();
      renderAll();
    });
    els.sourcesBtn.addEventListener('click', () => els.sourcesDialog.showModal());
    els.closeSourcesBtn.addEventListener('click', () => els.sourcesDialog.close());
    els.closeInstallBtn.addEventListener('click', () => els.installDialog.close());
    els.offlineSaveBtn.addEventListener('click', saveOffline);
    els.updateBtn.addEventListener('click', () => {
      const waiting = state.pwaRegistration?.waiting;
      if (waiting) waiting.postMessage({ type: 'SKIP_WAITING' });
      else window.location.reload();
    });
    els.voiceSelect.addEventListener('change', () => {
      state.voiceName = els.voiceSelect.value;
      persist();
    });
    els.rateSlider.addEventListener('input', () => {
      state.rate = Number(els.rateSlider.value);
      els.rateValue.textContent = `${state.rate.toFixed(2)}×`;
      persist();
    });

    window.addEventListener('online', () => renderPWAStatus());
    window.addEventListener('offline', () => renderPWAStatus());
    window.addEventListener('appinstalled', () => {
      state.deferredInstallPrompt = null;
      state.installed = true;
      persist();
      renderPWAStatus('Installed ✓', 'ready');
    });
    window.addEventListener('beforeinstallprompt', (event) => {
      event.preventDefault();
      state.deferredInstallPrompt = event;
      renderPWAStatus();
    });
    els.installBtn.addEventListener('click', async () => {
      const prompt = state.deferredInstallPrompt;
      if (!prompt) {
        showInstallHelp();
        return;
      }
      prompt.prompt();
      await prompt.userChoice;
      state.deferredInstallPrompt = null;
      renderPWAStatus();
    });
  }

  async function initPWA() {
    renderPWAStatus();
    if (!('serviceWorker' in navigator)) return;

    try {
      const registration = await navigator.serviceWorker.register('./sw.js');
      state.pwaRegistration = registration;
      renderPWAStatus();

      if (registration.waiting) showUpdateReady(registration);

      registration.addEventListener('updatefound', () => {
        const worker = registration.installing;
        if (!worker) return;
        worker.addEventListener('statechange', () => {
          if (worker.state === 'installed' && navigator.serviceWorker.controller) {
            showUpdateReady(registration);
          }
        });
      });

      navigator.serviceWorker.addEventListener('controllerchange', () => {
        if (state.refreshingForUpdate) return;
        state.refreshingForUpdate = true;
        window.location.reload();
      });

      await navigator.serviceWorker.ready;
      renderPWAStatus('Offline shell ready ✓', 'ready');
    } catch (error) {
      renderPWAStatus('PWA cache unavailable', 'offline');
    }
  }

  function init() {
    renderAll();
    bindEvents();
    populateVoices();
    if ('speechSynthesis' in window) {
      speechSynthesis.onvoiceschanged = populateVoices;
    }
    initPWA();
  }

  init();
})();
