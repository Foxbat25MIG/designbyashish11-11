/* NIO ET9 HMI study · shared interactions
   tap sound · selection groups · sliders · Walkman-style player · climate
   Serene / Map / Car views · drive modes with Custom per driver · blind-spot loop */
(function () {
  /* ---------- tap sound (on by default, mute switch on the page) ---------- */
  let muted = false;
  try { muted = localStorage.getItem('nio-sound') === 'off'; } catch (e) {}
  let ac = null, tapK = 1;               // tapK: Settings › Sound › Touch sounds (40 % = normal)
  function tick(kind) {
    if (muted || tapK <= 0) return;
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === 'suspended') ac.resume();
      const t = ac.currentTime, o = ac.createOscillator(), g = ac.createGain(), f = ac.createBiquadFilter();
      const base = kind === 'soft' ? 1500 : kind === 'low' ? 700 : 2100;
      o.type = 'triangle';
      o.frequency.setValueAtTime(base, t);
      o.frequency.exponentialRampToValueAtTime(base * 0.5, t + 0.04);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime((kind === 'soft' ? 0.035 : 0.09) * tapK, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.07);
      f.type = 'lowpass'; f.frequency.value = 3400;
      o.connect(f); f.connect(g); g.connect(ac.destination);
      o.start(t); o.stop(t + 0.08);
    } catch (e) {}
  }
  function paintSound() {
    document.querySelectorAll('.sound').forEach(b => {
      b.innerHTML = `<span class="ms">${muted ? 'volume_off' : 'volume_up'}</span>Tap sounds ${muted ? 'off' : 'on'}`;
      b.setAttribute('aria-pressed', String(!muted));
    });
    document.querySelectorAll('[data-tapsound]').forEach(x => x.classList.toggle('on', !muted));
  }
  document.addEventListener('click', e => {
    const b = e.target.closest('.sound'); if (!b) return;
    muted = !muted; try { localStorage.setItem('nio-sound', muted ? 'off' : 'on'); } catch (er) {}
    paintSound(); tick();
  });
  paintSound();

  const TAP = '.icb,.dk,.seg div,.segx div,.play,.btn,.qbtn,.snav div,.tog,.mode,.opt span,.chip,.chip2,.key,.cbtn,.atile,[data-tap]'; // mute icons stay silent
  // no tap sounds while the frame's volume is muted
  const frameVol = fr => { const s = fr && fr.querySelector && fr.querySelector('[data-sync="vol"]'); return s ? (parseFloat(getComputedStyle(s).getPropertyValue('--v')) || 0) : 50; };
  document.addEventListener('pointerdown', e => {
    const fr = e.target.closest('.frame');
    if (fr && e.target.closest(TAP) && frameVol(fr) > 0) tick();
  });

  /* ---------- selection groups, toggles, climate, views ---------- */
  const frameOf = el => el.closest('.frame') || document;
  document.addEventListener('click', e => {
    const t = e.target;
    const tog = t.closest('.tog'); if (tog && !tog.hasAttribute('data-seattog') && !tog.hasAttribute('data-cltog')) {
      tog.classList.toggle('on'); clTog(tog);
      if (tog.hasAttribute('data-guard')) { const on = tog.classList.contains('on'), gc = tog.closest('.av-c, .app, .frame').querySelector('.gm-card');
        if (gc) { gc.classList.toggle('on', on); gc.querySelector('.gm-st').textContent = on ? 'Guard Mode is on' : 'Guard Mode is off'; gc.querySelector('.gm-sub').textContent = on ? 'Watching with 4 cameras while the ET9 is parked and locked' : 'Turn it on to record when someone comes close'; } }
      if (tog.hasAttribute('data-tapsound')) { muted = !tog.classList.contains('on'); try { localStorage.setItem('nio-sound', muted ? 'off' : 'on'); } catch (er) {} paintSound(); }
      return;
    }
    if (clClick(t) || seatClick(t) || navClick(t) || pClick(t) || calClick(t) || sndClick(t)) return;
    const drv = t.closest('[data-drv]');
    if (drv) { const fr = frameOf(drv), n = drv.dataset.drv;
      drv.parentElement.querySelectorAll('[data-drv]').forEach(d => d.classList.toggle('on', d === drv));
      fr.querySelectorAll('.drv-n').forEach(x => x.textContent = n);
      fr.querySelectorAll('.prof').forEach(pf => { const on = pf.querySelector('.h3') && pf.querySelector('.h3').textContent === n; pf.classList.toggle('on', on); const s = pf.querySelector('.bs'); if (s) s.textContent = on ? 'Driving now' : 'Seat, mirrors, Custom mode, music'; });
      const pm = { Emma: 'Comfort', Pierre: 'Sport', Ashish: 'Eco' }[n] || 'Comfort';   // each driver's saved drive mode
      fr.querySelectorAll('[data-drv2]').forEach(r => { if (!r._dm) dmPaint(r); r._dm.m = pm; dmPaint(r); });
      { const chip = fr.querySelector('.status .chip'); if (chip) chip.lastChild.textContent = pm; }
      toast(fr, `Welcome back, ${n} · ${pm} mode, seat, mirrors and music restored`); return; }
    const mv = t.closest('[data-mv]'); if (mv) { g2048Move(mv.closest('.gamewrap'), mv.dataset.mv); return; }
    if (t.closest('[data-g2048-new]')) { g2048New(t.closest('.gamewrap')); return; }
    const mk = t.closest('[data-mk]'); if (mk) { minesTap(mk); return; }
    if (t.closest('[data-mines-new]')) { minesNew(t.closest('.gamewrap')); return; }
    const segItem = t.closest('.seg div, .segx div, .opt span');
    if (segItem) {
      [...segItem.parentElement.children].forEach(c => c.classList.toggle('on', c === segItem));
      if (segItem.parentElement.classList.contains('g-mode')) { chessNew(segItem.closest('.gamewrap')); return; }
      if (segItem.parentElement.hasAttribute('data-tabs')) {
        const i = [...segItem.parentElement.children].indexOf(segItem);
        const tp = segItem.parentElement.parentElement.querySelector('.tabpanes');
        if (tp) [...tp.children].forEach((c, k) => c.classList.toggle('on', k === i));
        return;
      }
      const views = segItem.parentElement.closest('[data-views]');
      if (views) {
        const app = frameOf(segItem).querySelector('.app');
        const v = segItem.textContent.trim().toLowerCase();
        app.classList.remove('v-serene', 'v-map', 'v-car'); app.classList.add('v-' + v);
      }
      return;
    }
    const dk = t.closest('.dk');
    if (dk && dk.classList.contains('short')) {   // seat-heat shortcut: 0 → 1 → 2 → 3 → 0
      const bars = dk.querySelectorAll('.lv b'); const lvl = ([...bars].filter(b => !b.classList.contains('off')).length + 1) % 4;
      bars.forEach((b, i) => b.classList.toggle('off', i >= lvl)); return;
    }
    if (dk && dk.hasAttribute('data-go')) { route(dk.closest('.frame'), dk.dataset.go); return; }
    if (dk && dk.hasAttribute('data-nomi')) { openNomi(dk.closest('.frame')); return; }
    if (dk && !dk.classList.contains('short') && !dk.closest('.dim')) {
      dk.parentElement.querySelectorAll('.dk').forEach(d => d.classList.toggle('on', d === dk)); return;
    }
    const sn = t.closest('.snav div');
    if (sn) {
      sn.parentElement.querySelectorAll('div').forEach(d => d.classList.toggle('on', d === sn));
      if (sn.parentElement.hasAttribute('data-pages')) {
        const name = sn.textContent.replace(sn.querySelector('.ms').textContent, '').trim();
        sn.closest('.pane').querySelectorAll('.pg').forEach(pg => pg.classList.toggle('on', pg.dataset.page === name));
      }
      return;
    }
    const fr0 = t.closest('.frame');
    const app = t.closest('[data-app]'); if (app) { openApp(fr0, app.dataset.app); return; }
    const song = t.closest('[data-song]');
    if (song) {
      const [ti, ar] = song.dataset.song.split('|');
      if (song.dataset.station) {
        setStation(fr0, ti, song.dataset.station);
        const sc = song.closest('.tp'); sc.querySelector('.radio-f').textContent = song.dataset.station; sc.querySelector('.radio-n').textContent = ti; sc.querySelector('.dial i').style.left = (((+song.dataset.station) - 87.5) / 20.5 * 100).toFixed(1) + '%';
      } else {
        const curT = fr0.querySelector('.player .h3');
        if (!song.dataset.pos && curT && curT.textContent === ti && song.classList.contains('lrow')) { const pl = fr0.querySelector('.ctx .player') || fr0.querySelector('.player'); fr0.querySelectorAll('.player').forEach(p => setPlaying(p, !pl.classList.contains('playing'))); closePicker(fr0); return; }
        setSong(fr0, songIndex(ti, ar), true);
        setTimeout(() => rowsPaint(fr0), 0);
        if (song.dataset.pos) fr0.querySelectorAll('.player').forEach(p => { p._pos = Math.round(p._dur * song.dataset.pos / 100); paintTime(p); });
      }
      closePicker(fr0);
      return;
    }
    if (t.closest('[data-prev]')) { stepSong(fr0, -1); return; }
    if (t.closest('[data-next]')) { stepSong(fr0, 1); return; }
    if (t.closest('[data-pick]')) { openPicker(fr0); return; }
    if (t.closest('.picker-x') || t.classList.contains('pickerov')) { closePicker(fr0); return; }
    const ytc = t.closest('[data-yt]'); if (ytc) { ytc.parentElement.querySelectorAll('[data-yt]').forEach(x => x.classList.toggle('on', x === ytc)); const box = ytc.closest('.yt').querySelector('.ytbox'); box.classList.add('playing'); loadYT(box, ytc.dataset.yt); return; }
    const ytp = t.closest('[data-ytplay]'); if (ytp) { const yt = ytp.closest('.yt'); const box = yt.querySelector('.ytbox'); box.classList.add('playing'); loadYT(box, yt.querySelector('[data-yt].on').dataset.yt); return; }
    const cln = t.closest('[data-clean]'); if (cln) { cleaning(fr0); return; }
    if (t.closest('[data-chess-new]')) { chessNew(t.closest('.gamewrap')); return; }
    const csq = t.closest('.chess i'); if (csq) { chessTap(csq); return; }
    const gm = t.closest('.g-mode div'); if (gm) { setTimeout(() => chessNew(gm.closest('.gamewrap')), 0); }
    const sc0 = t.closest('.sudoku i'); if (sc0) { suSelect(sc0); return; }
    const nm = t.closest('[data-num]'); if (nm) { suEnter(nm.closest('.gamewrap'), +nm.dataset.num); return; }
    if (t.closest('[data-su-new]')) { suNew(t.closest('.gamewrap')); return; }
    const tva = t.closest('.tv-a .btn'); if (tva) { tvAnswer(tva); return; }
    if (t.closest('.tv-next')) { tvNext(t.closest('.trivia')); return; }
    const call = t.closest('[data-call]');
    if (call) {
      const ov = fr0.querySelector('.callov'); let n = call.dataset.call;
      if (n === 'keypad') { n = fr0.querySelector('.kp-num').textContent.trim(); if (n.length < 6) return; }
      ov.querySelector('.call-n').textContent = n; ov.querySelector('.call-s').textContent = 'Calling…';
      const ca = ov.querySelector('.call-av'); if (ca) ca.innerHTML = avHTML(n, 120);
      ov.querySelectorAll('[data-ctog]').forEach(b => b.classList.remove('on'));
      ov.classList.add('on'); clearInterval(ov._t);
      if (!ov._held) { ov._held = [...fr0.querySelectorAll('.player.playing')]; ov._held.forEach(p => setPlaying(p, false)); }
      const start = Date.now() + 2000;
      ov._log = logCall(fr0, n); ov._t0 = start;
      ov._t = setInterval(() => { const s = Math.floor((Date.now() - start) / 1000); if (s >= 0) ov.querySelector('.call-s').textContent = fmt(s); }, 250);
      return;
    }
    const cbt = t.closest('.cbtn');
    if (cbt) { if (cbt.classList.contains('end')) { const ov = cbt.closest('.callov'); clearInterval(ov._t); ov.classList.remove('on'); (ov._held || []).forEach(p => setPlaying(p, true)); ov._held = null;
        if (ov._log) { const m = Math.max(1, Math.round((Date.now() - ov._t0) / 60000)); ov._log.querySelector('.lc-s').textContent = Date.now() < ov._t0 ? 'Outgoing · cancelled' : `Outgoing · ${m} min`; ov._log = null; } } else cbt.classList.toggle('on'); return; }
    const key = t.closest('.key'); if (key) { const d = fr0.querySelector('.kp-num'); if (d.textContent.length < 18) d.textContent += key.dataset.key; return; }
    if (t.closest('[data-kpdel]')) { const d = fr0.querySelector('.kp-num'); d.textContent = d.textContent.trimEnd().slice(0, -1); return; }
    const rd = t.closest('[data-read]'); if (rd) { say(fr0, rd.dataset.read); return; }
    if (t.closest('[data-nomi]')) { openNomi(fr0); return; }
    if (t.closest('.nomi-x') || t.classList.contains('nomiov')) { fr0.querySelector('.nomiov').classList.remove('on'); return; }
    const po = t.closest('[data-parkopen]'); if (po) { fr0.querySelector('.nomiov')?.classList.remove('on'); window.nioParkOpen(fr0, po.dataset.parkopen); return; }
    const ask = t.closest('[data-ask]'); if (ask) { nomiAsk(fr0, ask.dataset.ask, ask.textContent); return; }
    const go = t.closest('[data-go]');
    if (go) { route(go.closest('.frame'), go.dataset.go); return; }
    const sw = t.closest('.sw'); if (sw) { sw.parentElement.querySelectorAll('.sw').forEach(x => x.classList.toggle('on', x === sw)); return; }
    const mem = t.closest('.mem .btn:not(.tint)'); if (mem) { mem.parentElement.querySelectorAll('.btn:not(.tint)').forEach(x => x.classList.toggle('on', x === mem)); return; }
    const pr = t.closest('.prof'); if (pr) { pr.parentElement.querySelectorAll('.prof').forEach(x => { x.classList.toggle('on', x === pr); x.querySelector('.bs').textContent = x === pr ? 'Driving now' : 'Seat, mirrors, Custom mode, music'; }); return; }
    const fl = t.closest('[data-flip]'); if (fl) { const s = fl.querySelector('span:last-child'); const a = s.textContent; s.textContent = fl.dataset.flip; fl.dataset.flip = a; return; }
    const cb = t.closest('.clim .icb');
    if (cb) { const fr = frameOf(cb); clStep(fr, cb.closest('.clim').classList.contains('r') ? 'Passenger' : 'Driver', cb.textContent.includes('add') || cb.querySelector('path[d*="v12"]') ? 1 : -1); return; }
    const pl = t.closest('.player .play');
    if (pl) { setPlaying(pl.closest('.player'), !pl.closest('.player').classList.contains('playing')); return; }
    const vi = t.closest('.vol .ms, .dvol .ms');
    if (vi) {
      const fr = frameOf(vi); const s = fr.querySelector('[data-sync="vol"]');
      const cur = parseFloat(getComputedStyle(s).getPropertyValue('--v')) || 0;
      if (cur > 0) { fr.dataset.lastVol = cur; setVol(fr, 0); } else setVol(fr, parseFloat(fr.dataset.lastVol || 55));
    }
  });

  /* ---------- NOMI (scripted demo; actions really change the car) ---------- */
  function say(fr, text) {
    try { if (!muted && window.speechSynthesis) { const u = new SpeechSynthesisUtterance(text); u.lang = (window.nioLang && window.nioLang() !== 'en') ? ({ fr: 'fr-FR', de: 'de-DE', lb: (speechSynthesis.getVoices().some(v => /^lb/.test(v.lang)) ? 'lb-LU' : 'de-LU') })[window.nioLang()] : 'en-GB'; if (window.nioTr) text = window.nioTr(text.replace(/<[^>]+>/g, '')); speechSynthesis.cancel(); speechSynthesis.speak(u); } } catch (e) {}
    const ov = fr && fr.querySelector('.nomiov'); if (!ov) return;
  }
  function openNomi(fr) {
    const ov = fr.querySelector('.nomiov'); ov.querySelector('.nomi-log').innerHTML = ''; ov.querySelector('.nomi-state').textContent = 'Listening…'; ov.classList.add('on');
  }
  function bubble(log, cls, html) { const d = document.createElement('div'); d.className = cls; d.innerHTML = html; log.appendChild(d); return d; }
  function nomiAsk(fr, k, text) {
    const ov = fr.querySelector('.nomiov'), log = ov.querySelector('.nomi-log'), st = ov.querySelector('.nomi-state');
    if (k === 'reserve') { log.innerHTML = ''; bubble(log, 'me', 'Reserve it'); }
    else { log.innerHTML = ''; bubble(log, 'me', text); }
    st.textContent = 'Thinking…';
    setTimeout(() => {
      st.textContent = 'NOMI';
      let a = '';
      if (k === 'park') a = 'Parking Trois Glands is a 5 minute walk from Mudam and fits the ET9. Reserve a space from 13:55?<div class="acts" style="margin-top:10px"><div class="btn pri sm" data-ask="reserve">Reserve</div><div class="btn sec sm nomi-x">Not now</div></div>';
      if (k === 'reserve') a = 'Done. Level −2, bay 14, from 13:55 until 15:55. I’ve added it to your trip.<div class="acts" style="margin-top:10px"><div class="btn sec sm" data-parkopen="5">View booking</div></div>';
      if (k === 'seat') { a = 'Driver seat heat set to 2.'; const sw = fr.querySelector('.st-wrap'); if (sw) { const S = stOf(sw); S.s.Driver.heat = '2'; S.s.Driver.vent = 'Off'; stPaint(sw); } }
      if (k === 'calm') { a = 'Playing Memory Box by Peter Cat Recording Co.'; setSong(fr, songIndex('Memory Box', 'Peter Cat Recording Co.'), true); }
      if (k === 'air') { const q = document.querySelector('[data-live="aqi"]'), x = document.querySelector('[data-live="aqitext"]'); a = q && q.textContent.trim() && q.textContent !== 'AQI –' ? `Outside air is ${q.textContent}${x ? ', ' + x.textContent : ''}. Cabin filtering is on.` : 'Outside air quality is good today. Cabin filtering is on.'; }
      bubble(log, 'ai', a); say(null, a.replace(/<[^>]+>/g, ''));
    }, 700);
  }

  /* ---------- music library (shared by every player in a frame) ---------- */
  const BASE = (document.currentScript && document.currentScript.src || '').replace(/hmi\.js.*$/, '');
  const CV = k => BASE + 'img/covers/' + k + '.jpg';
  const SONGS = [   // [title, artist, seconds, cover, kind]
    ['Heroes', 'David Bowie', 367, CV('heroes')], 
    ['Dancing Queen', 'ABBA', 231, CV('arrival')], ['Mamma Mia', 'ABBA', 212, CV('abba')], 
    ['Get Lucky', 'Daft Punk', 369, CV('ram')], ['One More Time', 'Daft Punk', 320, CV('discovery')], ['Instant Crush', 'Daft Punk', 337, CV('ram')], ['Digital Love', 'Daft Punk', 298, CV('discovery')],
    ['Memory Box', 'Peter Cat Recording Co.', 312, CV('bismillah')], ['Floated By', 'Peter Cat Recording Co.', 305, CV('bismillah')], ['Soulless Friends', 'Peter Cat Recording Co.', 268, CV('bismillah')], ['People Never Change', 'Peter Cat Recording Co.', 241, CV('bismillah')],
    ['Last Nite', 'The Strokes', 193, CV('lastnite')], ['Reptilia', 'The Strokes', 221, CV('roomonfire')], 
    ['Around the World in Eighty Days', 'Jules Verne · Chapter 9', 2520, CV('book-verne'), 'book'], ['The Adventures of Sherlock Holmes', 'Arthur Conan Doyle · A Scandal in Bohemia', 3060, CV('book-doyle'), 'book'],
    ['Pride and Prejudice', 'Jane Austen · Chapter 3', 2280, CV('book-austen'), 'book'], ['The Time Machine', 'H. G. Wells · Chapter 1', 1980, CV('book-wells'), 'book'], ['Frankenstein', 'Mary Shelley · Letter 1', 1500, CV('book-shelley'), 'book'],
    ['60. Danny DeVito, Everybody', 'The Always Sunny Podcast', 4620, 'https://i.ytimg.com/vi/52c7vu7jfR8/hqdefault.jpg', 'pod'],
    ["The AI Tsunami is Here & Society Isn't Ready", 'People by WTF · Nikhil Kamath', 5640, 'https://i.ytimg.com/vi/68ylaeBbdsg/hqdefault.jpg', 'pod']];
  function songIndex(ti, ar) {
    let i = SONGS.findIndex(s => s[0] === ti);
    if (i < 0) { SONGS.push([ti, ar, 2400]); i = SONGS.length - 1; }   // audiobooks, podcasts
    return i;
  }
  function setSong(fr, i, play) {
    const [ti, ar, d, cov] = SONGS[(i + SONGS.length) % SONGS.length];
    fr._song = (i + SONGS.length) % SONGS.length;
    fr.querySelectorAll('.player').forEach(p => {
      p.classList.remove('radio');
      p.querySelectorAll('.h3').forEach(h => h.textContent = ti); p.querySelectorAll('.b2').forEach(b => b.textContent = ar);
      p._dur = d; p._pos = 0; if (play !== false) setPlaying(p, true); paintTime(p);
      setArt(p, cov ? { img: cov } : null);
      const e = p.querySelector('.p-full'); if (e) { e.animate([{ opacity: .4 }, { opacity: 1 }], { duration: 400, easing: 'ease-out' }); }
    });
    const pk = fr.querySelector('.pickerov'); if (pk) pk.querySelectorAll('[data-song]').forEach(r => r.classList.toggle('on', r.dataset.song.split('|')[0] === ti));
  }
  // cover art: song placeholder, podcast cover, or the radio station's own tile
  function setArt(p, a) {
    p.querySelectorAll('.art').forEach(el => {
      if (el._ph == null) el._ph = el.innerHTML;
      el.classList.toggle('cov', !!(a && a.img)); el.classList.toggle('radioart', !!(a && a.radio));
      el.style.backgroundImage = '';
      el.innerHTML = !a ? el._ph : a.img ? `<i class="art-bg" style="background-image:url(${a.img})"></i><i class="art-fg" style="background-image:url(${a.img})"></i>` : `<span class="ra-l">DAB+ · Luxembourg</span><span class="ra-f">${a.f}</span><span class="ra-n">${a.radio}</span>`;
    });
    p.querySelectorAll('.cart').forEach(el => {
      if (el._ph == null) el._ph = el.innerHTML;
      el.classList.toggle('cov', !!(a && a.img)); el.classList.toggle('radioart', !!(a && a.radio));
      el.style.backgroundImage = '';
      el.innerHTML = !a ? el._ph : a.img ? `<i class="art-bg" style="background-image:url(${a.img})"></i><i class="art-fg" style="background-image:url(${a.img})"></i>` : `<span class="ra-f">${a.f}</span>`;
    });
  }
  function stepSong(fr, dir) {
    const p = fr.querySelector('.player');
    if (p && p.classList.contains('radio')) { const st = [['Radio 100,7', '100.7'], ['RTL Radio Lëtzebuerg', '92.5'], ['Eldoradio', '105.0']]; fr._st = ((fr._st || 0) + dir + 3) % 3; setStation(fr, ...st[fr._st]); return; }
    if (dir < 0 && p && p._pos > 3) { p._pos = 0; paintTime(p); return; }
    // skip stays inside what you're listening to: songs step through songs, podcasts through podcasts
    const cur = SONGS[fr._song || 0] || SONGS[0], kind = cur[4] === 'pod' ? 'pod' : 'music';
    const list = SONGS.map((s, i) => i).filter(i => (SONGS[i][4] === 'pod' ? 'pod' : 'music') === kind && (kind === 'pod' || SONGS[i][2] < 1200));
    const at = Math.max(0, list.indexOf(fr._song || 0));
    setSong(fr, list[(at + dir + list.length) % list.length], true);
  }
  function setStation(fr, name, f) {
    fr.querySelectorAll('.player').forEach(p => {
      p.classList.add('radio'); setArt(p, { radio: name, f }); p.querySelectorAll('.h3').forEach(h => h.textContent = name); p.querySelectorAll('.b2').forEach(b => b.textContent = 'Live radio · ' + f);
      p.querySelectorAll('.lb-s').forEach(x => x.textContent = 'DAB+ ' + f); setPlaying(p, true);
    });
  }
  /* Now playing: what is on now, at the top, then every source (Music, Podcasts, Radio, Audiobooks), opened on the one playing */
  const STATIONS = [['Radio 100,7', '100.7'], ['RTL Radio Lëtzebuerg', '92.5'], ['Eldoradio', '105.0']];
  function nowKind(fr) { const p = fr.querySelector('.ctx .player') || fr._pl || fr.querySelector('.player'); if (p && p.classList.contains('radio')) return 'radio';
    const t = p && p.querySelector('.h3') && p.querySelector('.h3').textContent, s = SONGS.find(x => x[0] === t); return s && s[4] === 'pod' ? 'pod' : s && s[4] === 'book' ? 'book' : 'music'; }
  function pkRender(fr, ov, tab) {
    const p = fr.querySelector('.ctx .player') || fr._pl || fr.querySelector('.player'), t = p ? p.querySelector('.h3').textContent : '', sub = p ? p.querySelector('.b2').textContent : '';
    const s = SONGS.find(x => x[0] === t), playing = p && p.classList.contains('playing'), kind = nowKind(fr);
    const KN = { music: 'Music', pod: 'Podcasts', radio: 'Radio', book: 'Audiobooks' };
    const row = x => `<div class="pk-row${x[0] === t ? ' on' : ''}" data-song="${x[0]}|${x[1]}" data-tap><span class="pk-cv"${x[3] ? ` style="background-image:url(${x[3]})"` : ''}></span><span class="col" style="flex:1;min-width:0;gap:0"><span class="b2" style="color:var(--t1)">${x[0]}</span><span class="bs">${x[1]}</span></span><span class="bs num">${fmt(x[2])}</span></div>`;
    let list = '';
    if (tab === 'music') { const by = {}; SONGS.filter(x => !x[4] && x[2] < 1200).forEach(x => (by[x[1]] = by[x[1]] || []).push(x)); list = Object.entries(by).map(([a, l]) => `<div class="pk-art"><span class="lbl">${a}</span>` + l.map(row).join('') + '</div>').join(''); }
    else if (tab === 'radio') list = STATIONS.map(([n, f]) => `<div class="pk-row${n === t ? ' on' : ''}" data-pkst="${f}" data-pkn="${n}" data-tap><span class="pk-cv pk-radio"><span class="ms">radio</span></span><span class="col" style="flex:1;gap:0"><span class="b2" style="color:var(--t1)">${n}</span><span class="bs">DAB+ ${f}</span></span><span class="bs">Live</span></div>`).join('');
    else list = SONGS.filter(x => x[4] === tab).map(row).join('');
    ov.innerHTML = `<div class="picker"><div class="row" style="justify-content:space-between;align-items:center"><span class="h2">Now playing</span><div class="icb picker-x" style="background:var(--s2)"><span class="ms" style="color:var(--t1)">close</span></div></div>
      <div class="pk-now"><span class="pk-big"${s && s[3] ? ` style="background-image:url(${s[3]})"` : ''}>${kind === 'radio' ? '<span class="ms">radio</span>' : ''}</span><span class="col" style="flex:1;min-width:0;gap:2px"><span class="lbl">${KN[kind]}</span><span class="h3 pk-t">${t}</span><span class="bs pk-t">${sub}</span></span><div class="icb pk-pp" data-pkpp data-tap><span class="ms f">${playing ? 'pause' : 'play_arrow'}</span></div></div>
      <div class="segx pk-tabs">${Object.entries(KN).map(([k, n]) => `<div class="${k === tab ? 'on' : ''}" data-pktab="${k}" data-tap>${n}</div>`).join('')}</div>
      <div class="pk-list">${list}</div></div>`;
    ov.dataset.tab = tab;
  }
  function openPicker(fr) {
    let ov = fr.querySelector('.pickerov'); if (!ov) { ov = document.createElement('div'); ov.className = 'pickerov'; fr.appendChild(ov); }
    pkRender(fr, ov, nowKind(fr)); requestAnimationFrame(() => ov.classList.add('on'));
  }
  document.addEventListener('click', e => {
    const ov = e.target.closest('.pickerov'); if (!ov) return; const fr = frameOf(ov);
    const tb = e.target.closest('[data-pktab]'); if (tb) { e.stopPropagation(); pkRender(fr, ov, tb.dataset.pktab); return; }
    const st = e.target.closest('[data-pkst]'); if (st) { e.stopPropagation(); setStation(fr, st.dataset.pkn, st.dataset.pkst); setTimeout(() => pkRender(fr, ov, 'radio'), 0); return; }
    const pp = e.target.closest('[data-pkpp]'); if (pp) { e.stopPropagation(); const pl = fr.querySelector('.ctx .player') || fr._pl; const b = pl && pl.querySelector('.play'); if (b) b.dispatchEvent(new MouseEvent('click', { bubbles: true })); setTimeout(() => pkRender(fr, ov, ov.dataset.tab), 30); return; }
    if (e.target.closest('[data-song]')) setTimeout(() => pkRender(fr, ov, ov.dataset.tab), 30);
  }, true);
  function closePicker(fr) { const ov = fr && fr.querySelector('.pickerov'); if (ov) ov.classList.remove('on'); }

  /* ---------- video (YouTube channels, uploads playlist on loop) ---------- */
  function loadYT(box, list) {
    const f = box.querySelector('iframe');
    f.src = `https://www.youtube.com/embed/videoseries?list=${list}&autoplay=1&playsinline=1&rel=0&modestbranding=1&origin=${encodeURIComponent(location.origin)}`;
    const fr = box.closest('.frame'); if (fr) { fr.querySelectorAll('.player.playing').forEach(p => { p.classList.remove('playing'); p.querySelectorAll('.play .ms').forEach(i => i.textContent = 'play_arrow'); }); rowsPaint(fr); toast(fr, 'Music paused while the video plays'); }
  }
  function isParked(fr) { const g = fr.querySelector('.gear .on'); return g && g.textContent.trim() === 'P'; }

  /* ---------- screen cleaning: touch locked for 30 s ---------- */
  function cleaning(fr) {
    let ov = fr.querySelector('.cleanov');
    if (!ov) { ov = document.createElement('div'); ov.className = 'cleanov'; fr.appendChild(ov); }
    let n = 30; ov.innerHTML = `<span class="ms" style="font-size:56px;color:#fff">cleaning_services</span><span class="h2" style="color:#fff">Cleaning mode</span><span class="bs cl-n" style="color:#d8d5e3">Touch unlocks in 30 s</span>`;
    ov.classList.add('on'); clearInterval(ov._t);
    ov._t = setInterval(() => { n--; ov.querySelector('.cl-n').textContent = `Touch unlocks in ${n} s`; if (n <= 0) { clearInterval(ov._t); ov.classList.remove('on'); } }, 1000);
  }

  /* ---------- Chess (chess.js rules; play the computer or a friend) ---------- */
  const PIECE = { p: '♟', r: '♜', n: '♞', b: '♝', q: '♛', k: '♚' }, VAL = { p: 1, n: 3, b: 3, r: 5, q: 9, k: 0 };
  function chessNew(w) {
    if (!w || !w.querySelector('.chess')) return;
    if (!window.Chess) { w.querySelector('.chess-s').textContent = 'Chess engine is loading…'; return; }
    w._g = new Chess(); w._sel = null; chessDraw(w);
  }
  function chessDraw(w) {
    const g = w._g, b = w.querySelector('.chess'), files = 'abcdefgh';
    let html = '';
    const targets = w._sel ? g.moves({ square: w._sel, verbose: true }).map(m => m.to) : [];
    for (let r = 8; r >= 1; r--) for (let c = 0; c < 8; c++) {
      const sq = files[c] + r, pc = g.get(sq);
      const cls = ((r + c) % 2 ? 'lt1' : 'dk1') + (w._sel === sq ? ' sel' : '') + (targets.includes(sq) ? ' tgt' : '') + (pc ? (pc.color === 'w' ? ' pw' : ' pb') : '');
      html += `<i class="${cls}" data-sq="${sq}" data-tap>${pc ? PIECE[pc.type] : ''}</i>`;
    }
    b.innerHTML = html;
    const s = w.querySelector('.chess-s');
    s.textContent = g.in_checkmate() ? (g.turn() === 'w' ? 'Checkmate · Black wins' : 'Checkmate · White wins') : g.in_draw() ? 'Draw' : (g.turn() === 'w' ? 'White' : 'Black') + ' to move' + (g.in_check() ? ' · check' : '');
  }
  function chessTap(sqEl) {
    const w = sqEl.closest('.gamewrap'), g = w._g; if (!g || g.game_over()) return;
    const vsCpu = w.querySelector('.g-mode .on').textContent.includes('Computer');
    if (vsCpu && g.turn() === 'b') return;
    const sq = sqEl.dataset.sq, pc = g.get(sq);
    if (w._sel) {
      const mv = g.move({ from: w._sel, to: sq, promotion: 'q' });
      w._sel = null;
      if (mv) { chessDraw(w); if (vsCpu && !g.game_over()) setTimeout(() => chessCpu(w), 450); return; }
    }
    if (pc && pc.color === g.turn()) w._sel = sq;
    chessDraw(w);
  }
  function chessCpu(w) {   // one-move look-ahead: best capture, avoid hanging pieces, else random
    const g = w._g, moves = g.moves({ verbose: true }); if (!moves.length) return;
    let best = null, bs = -1e9;
    for (const m of moves) {
      let sc = (m.captured ? VAL[m.captured] * 10 : 0) + (m.flags.includes('p') ? 80 : 0) + Math.random();
      g.move(m); if (g.in_checkmate()) sc += 1000; else if (g.in_check()) sc += 2;
      const replies = g.moves({ verbose: true }); const worst = replies.reduce((x, r) => Math.max(x, r.captured ? VAL[r.captured] * 10 : 0), 0);
      g.undo(); sc -= worst * 0.9;
      if (sc > bs) { bs = sc; best = m; }
    }
    g.move(best); chessDraw(w);
  }

  /* ---------- Sudoku (numpad, conflicts, solved check) ---------- */
  const PUZ = [
    ['530070000600195000098000060800060003400803001700020006060000280000419005000080079', '534678912672195348198342567859761423426853791713924856961537284287419635345286179'],
    ['000260701680070090190004500820100040004602900050003028009300074040050036703018000', '435269781682571493197834562826195347374682915951743628519326874248957136763418259'],
    ['100489006730000040000001295007120600500703008006095700914600000020000037800512004', '152489376739256841468371295387124659591763428246895713914637582625948137873512964']];
  function suNew(w) {
    if (!w || !w.querySelector('.sudoku')) return;
    w._pi = ((w._pi ?? -1) + 1) % PUZ.length; const [p] = PUZ[w._pi];
    w.querySelector('.sudoku').innerHTML = [...p].map((ch, k) => `<i class="${ch !== '0' ? 'giv' : 'emp'}${(k % 9) === 2 || (k % 9) === 5 ? ' bx' : ''}${Math.floor(k / 9) === 2 || Math.floor(k / 9) === 5 ? ' by' : ''}" data-k="${k}" ${ch === '0' ? 'data-tap' : ''}>${ch !== '0' ? ch : ''}</i>`).join('');
    w._suSel = null; w.querySelector('.su-s').textContent = 'Pick a square, then a number.';
  }
  function suSelect(c) { const w = c.closest('.gamewrap'); if (c.classList.contains('giv')) return; w.querySelectorAll('.sudoku i').forEach(x => x.classList.toggle('sel', x === c)); w._suSel = c; }
  function suEnter(w, n) {
    const c = w._suSel; if (!c) { w.querySelector('.su-s').textContent = 'Pick an empty square first.'; return; }
    c.textContent = n ? n : '';
    const cells = [...w.querySelectorAll('.sudoku i')], v = cells.map(x => x.textContent);
    cells.forEach((x, k) => {
      const r = Math.floor(k / 9), cc = k % 9, br = r - r % 3, bc = cc - cc % 3;
      let bad = false;
      if (v[k]) for (let j = 0; j < 81; j++) { if (j === k || v[j] !== v[k]) continue; const r2 = Math.floor(j / 9), c2 = j % 9; if (r2 === r || c2 === cc || (r2 - r2 % 3 === br && c2 - c2 % 3 === bc)) { bad = true; break; } }
      x.classList.toggle('bad', bad && x.classList.contains('emp'));
    });
    const s = w.querySelector('.su-s');
    if (v.join('') === PUZ[w._pi][1]) s.textContent = 'Solved. Nicely done.';
    else s.textContent = cells.some(x => x.classList.contains('bad')) ? 'That number clashes with another.' : `${v.filter(x => !x).length} squares left`;
  }

  /* ---------- Trivia (endless, Open Trivia DB; offline fallback) ---------- */
  const TVBANK = [['Geography', 'What is the capital of Australia?', 'Canberra', ['Sydney', 'Melbourne', 'Perth']], ['Science', 'What gas do plants absorb from the air?', 'Carbon dioxide', ['Oxygen', 'Nitrogen', 'Helium']], ['History', 'In which year did the Berlin Wall fall?', '1989', ['1979', '1991', '1985']], ['Music', 'Which band recorded “Dancing Queen”?', 'ABBA', ['Queen', 'Blondie', 'Roxette']], ['Geography', 'Which river flows through the Grund in Luxembourg City?', 'Alzette', ['Moselle', 'Sûre', 'Rhine']], ['Science', 'How many planets are in our solar system?', '8', ['7', '9', '10']]];
  const dec = s => { const d = document.createElement('textarea'); d.innerHTML = s; return d.value; };
  async function tvFill(tr) {
    if (!tr._q || !tr._q.length) {
      try { const j = await fetch('https://opentdb.com/api.php?amount=10&type=multiple').then(r => r.json()); tr._q = j.results.map(q => [dec(q.category), dec(q.question), dec(q.correct_answer), q.incorrect_answers.map(dec)]); }
      catch (e) { tr._q = TVBANK.slice().sort(() => Math.random() - .5); }
      if (!tr._q.length) tr._q = TVBANK.slice().sort(() => Math.random() - .5);
    }
  }
  async function tvNext(tr) {
    if (!tr) return; await tvFill(tr);
    const [cat, q, ok, no] = tr._q.shift();
    tr.querySelector('.tv-cat').textContent = cat; tr.querySelector('.tv-q').textContent = q; tr.querySelector('.tv-r').textContent = '';
    tr.querySelector('.tv-next').style.visibility = 'hidden';
    tr.querySelector('.tv-a').innerHTML = [ok, ...no].sort(() => Math.random() - .5).map(a => `<div class="btn sec" data-ok="${a === ok ? 1 : 0}" style="justify-content:flex-start;height:56px">${a.replace(/</g, '&lt;')}</div>`).join('');
    tr._done = false;
  }
  function tvAnswer(b) {
    const tr = b.closest('.trivia'); if (tr._done) return; tr._done = true;
    const ok = b.dataset.ok === '1'; tr._score = (tr._score || 0) + (ok ? 1 : 0); tr._n = (tr._n || 0) + 1;
    b.classList.add(ok ? 'ok' : 'no'); if (!ok) tr.querySelector('.tv-a [data-ok="1"]').classList.add('ok');
    tr.querySelector('.tv-score').textContent = `Score ${tr._score} / ${tr._n}`;
    tr.querySelector('.tv-r').textContent = ok ? 'Correct.' : 'Not this time.';
    tr.querySelector('.tv-next').style.visibility = 'visible';
  }

  /* ---------- one dashboard, 15 s loop, following the real route:
     Route d'Esch (3 lanes) → red light → right onto Avenue Marie-Thérèse (2 lanes each way)
     → move to the left lane for Boulevard Joseph II, 170 m on. Speeds ramp like a real car. ---------- */
  document.querySelectorAll('[data-dash]').forEach(fr => {
    const w = fr.querySelector('.cv-world'); if (!w) return;
    w.dataset.dash = '1';
    const app = w.closest('.app'), cv = w.closest('.carview'), chipT = cv.querySelector('.cv-chip-t'), chipS = cv.querySelector('.cv-chip .bs'), tlT = cv.querySelector('.tl-t');
    const ex = +w.dataset.ex, y0 = +w.dataset.y0, R = +w.dataset.r, LC = +w.dataset.lc || 140, Y = 440, D = Y - y0, A = Math.PI / 2 * R;
    const cam = fr.querySelector('.ctx .bscam'), pl = fr.querySelector('.ctx .player'), upr = [...w.querySelectorAll('.upr')];
    // one scale for everything: 120 px/s = 45 km/h, so 1 px ≈ 0.104 m
    const T = 25, SV = +w.dataset.sv || 392, MPX = 0.104, KMH = 0.375;
    const sm = x => x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x);
    const V0 = 120, VT = 59, VE = 107;                             // 45 km/h approach, 22 km/h through the corner, 40 km/h after
    const GO = 9.6;                                                // light turns green at 9.4 s, car moves at 9.6 s
    let tArcEnd = 99;
    const vel = t => t < 4.5 ? V0 : t < 7 ? V0 * (1 - sm((t - 4.5) / 2.5)) : t < GO ? 0 : t < GO + 2.4 ? VT * sm((t - GO) / 2.4) : t < tArcEnd ? VT : VT + (VE - VT) * sm((t - tArcEnd) / 4);
    const DT = 0.005, N = Math.round(T / DT), ST = new Float64Array(N + 1);
    const build = () => { for (let k = 1; k <= N; k++) ST[k] = ST[k - 1] + vel((k - .5) * DT) * DT; };
    build();
    const SOFF = SV - ST[Math.round(7 / DT)];                      // stop exactly at SV
    // find when the corner ends, then rebuild so the car only speeds up once it is straight again
    for (let k = 0; k <= N; k++) if (SOFF + ST[k] >= D + A) { tArcEnd = k * DT; break; }
    build();
    const sAt = t => SOFF + ST[Math.min(N, Math.round(t / DT))];
    const vAt = t => vel(t);
    const U0 = 60, UL = 480;                                        // gentle lane change: starts 6 m after the corner, takes ~50 m
    const pose = s => {
      if (s < D) return [ex, Y - s, 0];
      if (s < D + A) { const f = (s - D) / R; return [ex + R - R * Math.cos(f), y0 - R * Math.sin(f), f * 180 / Math.PI]; }
      const u = s - D - A, k = (u - U0) / UL, yy = y0 - R - LC * sm(k);
      const slope = k > 0 && k < 1 ? LC * 6 * k * (1 - k) / UL : 0;
      return [ex + R + u, yy, 90 - Math.atan(slope) * 180 / Math.PI];
    };
    const $ = s => app.querySelector(`[data-nav="${s}"]`);
    const ui = { dist: $('dist'), street: $('street'), icon: $('icon'), lanes: $('lanes'), then: $('then') };
    const lanesHTML = l => l.map(x => x.endsWith('*') ? `<span class="ms go f">${x.slice(0, -1)}</span>` : `<span class="ms">${x}</span>`).join('');
    let phase = '';
    function card(ph, dist) {
      if (ui.dist) ui.dist.textContent = dist;
      if (ph === phase) return; phase = ph;
      const c = ph === 'right' ? ['turn_right', 'Avenue Marie-Thérèse', ['straight', 'straight', 'turn_right*'], 'then left onto Bd Joseph II']
                               : ['turn_left', 'Boulevard Joseph II', ['turn_left*', 'straight'], 'then keep left onto Bd de la Foire'];
      if (ui.icon) ui.icon.textContent = c[0]; if (ui.street) ui.street.textContent = c[1];
      if (ui.lanes) { ui.lanes.style.visibility = 'visible'; ui.lanes.innerHTML = lanesHTML(c[2]); } if (ui.then) ui.then.textContent = c[3];
    }
    const navOn = () => !fr.querySelector('[data-screen]') || fr.querySelector('[data-screen="nav"].on');
    let t0 = null, off = 0, bsWas = false, wasCar = false;
    app._dashRestart = (at = 0) => { t0 = null; off = at; phase = ''; };   /* at: start the loop this many seconds in */
    function setBS(on) {
      if (on === bsWas) return; bsWas = on;
      fr.classList.toggle('bs-on', on); if (pl) pl.classList.toggle('compact', on);
      if (cam) {
        const ctx = cam.parentElement, other = [...ctx.children].filter(c => c !== cam && c !== pl && c.offsetParent !== null).reduce((h, c) => h + c.offsetHeight + 16, 0);
        cam.style.height = on ? Math.max(200, ctx.clientHeight - other - 112 - 16) + 'px' : '0px';
      }
    }
    const m = px => Math.max(5, Math.round(px * MPX / 5) * 5) + ' m';
    const spd = fr.querySelector('[data-nav="speed"]') || fr.querySelector('.status .speed b'), ind = fr.querySelector('.bs-ind .ms');
    function frame(ts) {
      if (t0 === null) t0 = ts;
      const t = ((ts - t0) / 1000 + off) % T;
      const active = navOn();
      const mp = !app.classList.contains('v-car') && (app.matches('[data-navmap]') ? app : app.querySelector('[data-navmap]')), mb = mp && mp._bs;   /* Map and Serene views: the cyclist follows the car's place on the map */
      if (!app.classList.contains('v-car')) { fr.classList.toggle('bs-sig', !!(active && (mb ? mb.sig : t > 1.8 && t < 10.8))); if (ind) ind.textContent = 'turn_right'; }
      setBS(!!(active && (mb ? mb.on : t > 2.6 && t < 6.6)));
      const green = t > 9.4; cv.classList.toggle('tl-green', green); cv.classList.toggle('tl-red', !green);
      const isCar = app.classList.contains('v-car') && active; app.classList.toggle('dash-car', isCar);
      if (isCar) {
        const s = sAt(t), [x, y, h] = pose(s);
        w.setAttribute('transform', `translate(${ex} ${Y}) rotate(${-h}) translate(${-x} ${-y})`);
        upr.forEach(g => g.setAttribute('transform', `translate(${g.dataset.x} ${g.dataset.y}) rotate(${h})`));   // signs stay readable
        w.classList.toggle('fade', t > T - 0.6 || t < 0.2);
        const u = s - D - A, toLeft = 170 - Math.max(0, u) * MPX;      // Joseph II is ~170 m after the turn
        if (spd) spd.textContent = Math.round(vAt(t) * KMH);
        const lc = u > U0 - 40 && u < U0 + UL, rightInd = t > 1.8 && s < D + A;
        if (ind) { ind.textContent = lc ? 'turn_left' : 'turn_right'; }
        fr.classList.toggle('bs-sig', rightInd || lc);
        let chip, sub = 'Stay in this lane';
        if (s < SV - 1) { chip = `Lane 3 of 3 · turn right in ${m(D - s)}`; card('right', m(D - s)); }
        else if (t < GO) { chip = 'Waiting at the junction'; sub = 'Right-turn lane'; card('right', m(D - s)); }
        else if (s < D + A) { chip = 'Turning right'; sub = 'Onto Avenue Marie-Thérèse'; card('right', 'Now'); }
        else if (u < U0 + UL) { chip = 'Move to lane 1 of 2'; sub = `Left turn in ${Math.round(toLeft / 10) * 10} m`; card('left', Math.round(toLeft / 10) * 10 + ' m'); }
        else { chip = `Lane 1 of 2 · turn left in ${Math.round(toLeft / 10) * 10} m`; card('left', Math.round(toLeft / 10) * 10 + ' m'); }
        if (chipT) chipT.textContent = chip; if (chipS) chipS.textContent = sub;
        if (tlT) tlT.textContent = green ? 'Green · go' : t > 6.4 ? 'Red light · stopping' : 'Traffic light ahead · red';
      } else if (wasCar) { phase = ''; if (window.nioNavRefresh) window.nioNavRefresh(app); }
      wasCar = isCar;
      requestAnimationFrame(frame);
    }
    const rm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (!rm) requestAnimationFrame(frame); else { cv.classList.add('tl-red'); }
  });

  const PEOPLE = ['bora', 'charles', 'emma', 'mamma', 'mar', 'pierre', 'ashish'];
  function avHTML(name, s) {
    const k = String(name).toLowerCase();
    return PEOPLE.includes(k) ? `<img class="av" src="img/people/${k}.jpg" alt="${name}" style="width:${s}px;height:${s}px">`
      : `<span class="av av-i" style="width:${s}px;height:${s}px;font-size:${Math.round(s * .4)}px">${k === 'keypad' || /^\+?\d/.test(name) ? '<span class="ms" style="font-size:inherit">dialpad</span>' : String(name).slice(0, 1)}</span>`;
  }
  function logCall(fr, name) {
    const list = fr.querySelector('.recents'); if (!list) return null;
    const clock = (fr.querySelector('.status .time') || {}).textContent || '13:48';
    const row = document.createElement('div'); row.className = 'lrow'; row.dataset.call = name; row.setAttribute('data-tap', '');
    row.innerHTML = `${avHTML(name, 44)}<div class="col" style="gap:0;flex:1"><span class="b2" style="color:var(--t1)">${name}</span><span class="bs row" style="gap:4px"><span class="ms" style="font-size:16px;color:var(--t3)">call_made</span><span class="lc-s">Outgoing · calling</span></span></div><span class="bs num">Today ${clock.trim()}</span><span class="callbtn sm"><span class="ms f" style="font-size:20px;color:#fff">call</span></span>`;
    list.prepend(row); row.animate([{ background: 'var(--sel)' }, { background: 'transparent' }], { duration: 1600, easing: 'ease-out' });
    return row;
  }
  /* ---------- Settings › Sound ---------- */
  /* Equaliser: 6 bands (60 Hz – 8 kHz), ±12 dB, presets, live curve */
  const EQP = { Balanced: [0, 0, 0, 0, 0, 0], Vocal: [-2, -1, 2, 4, 3, 0], 'Bass boost': [7, 5, 1, 0, 0, 1], Concert: [3, 1, -1, 1, 3, 4],
    Jazz: [3, 2, -1, 1, 2, 3], Classical: [2, 1, 0, 0, 2, 4], Electronic: [6, 3, 0, -1, 2, 5], Podcast: [-4, -1, 3, 5, 3, -2], 'Night drive': [3, 2, 0, -1, -2, -3] };
  const eqY = v => 110 - v * 110 / 12;   // ±12 dB fills the 220-unit box, same scale as the knob tracks
  function eqPaint(card) {
    const v = card._eq || (card._eq = [0, 0, 0, 0, 0, 0]);
    card.querySelectorAll('.eqb').forEach((b, i) => { b.style.setProperty('--p', ((12 - v[i]) / 24 * 100) + '%'); b.querySelector('.eqv').textContent = (v[i] > 0 ? '+' : '') + v[i]; b.classList.toggle('up', v[i] > 0); b.classList.toggle('dn', v[i] < 0); });
    const xs = [50, 150, 250, 350, 450, 550], pts = xs.map((x, i) => [x, eqY(v[i])]);
    let d = `M0 ${pts[0][1]} L${pts[0][0]} ${pts[0][1]}`;
    for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], mx = (x0 + x1) / 2; d += ` C${mx} ${y0} ${mx} ${y1} ${x1} ${y1}`; }
    d += ` L600 ${pts[5][1]}`;
    card.querySelector('.eq-line').setAttribute('d', d); card.querySelector('.eq-fill').setAttribute('d', d + ' L600 110 L0 110 Z');
  }
  function eqPreset(d) {
    const card = d.closest('.eq-card'); card.querySelectorAll('.eq-pre div').forEach(x => x.classList.toggle('on', x === d));
    card.querySelector('.eq-name').textContent = d.textContent;
    if (EQP[d.textContent]) { card._eq = EQP[d.textContent].slice(); eqPaint(card); }
  }
  let eqDrag = null;
  document.addEventListener('pointerdown', e => { const b = e.target.closest('.eqb'); if (!b) return; eqDrag = { b, last: null }; b.classList.add('drag'); eqMove(e); e.preventDefault(); });
  document.addEventListener('pointermove', e => { if (eqDrag) eqMove(e); });
  document.addEventListener('pointerup', () => { if (eqDrag) { eqDrag.b.classList.remove('drag'); eqDrag = null; } });
  function eqMove(e) {
    const tr = eqDrag.b.querySelector('.eqt').getBoundingClientRect(), card = eqDrag.b.closest('.eq-card');
    const v = Math.round(12 - Math.max(0, Math.min(1, (e.clientY - tr.top) / tr.height)) * 24);
    card._eq = card._eq || [0, 0, 0, 0, 0, 0]; const i = +eqDrag.b.dataset.band;
    if (card._eq[i] !== v) { card._eq[i] = v; if (eqDrag.last !== null) tick('soft'); eqDrag.last = v;
      card.querySelectorAll('.eq-pre div').forEach(x => x.classList.toggle('on', x.textContent === 'Custom')); card.querySelector('.eq-name').textContent = 'Custom'; eqPaint(card); }
  }
  document.querySelectorAll('.eq-card').forEach(eqPaint);
  /* Sound field (LYRA 8.2.4.8): sweet spot, zones, group levels, stage, privacy, Atmos, noise cancellation */
  const ZONES = { 'All seats': [150, 255], Driver: [95, 196], Front: [150, 196], Rear: [150, 314], Chauffeur: [205, 314] };
  function sfState(card) { return card._sf || (card._sf = { x: 150, y: 255, zone: 'All seats', g: { sur: 0, roof: 1, head: 0, sub: 1 }, w: 60, h: 70, pos: 'All around you', priv: {} }); }
  function sfPaint(card) {
    const S = sfState(card), svg = card.querySelector('.sf-map'); if (!svg) return;
    svg.querySelector('.sf-spot').setAttribute('transform', `translate(${S.x} ${S.y})`);
    const rx = 40 + S.w * 1.1, ry = 30 + S.w * .8, ar = svg.querySelector('.sf-area');
    ar.setAttribute('cx', S.pos === 'On the dashboard' ? 150 : S.x); ar.setAttribute('cy', S.pos === 'On the dashboard' ? 150 : S.y);
    ar.setAttribute('rx', S.pos === 'On the dashboard' ? 70 + S.w : rx); ar.setAttribute('ry', S.pos === 'On the dashboard' ? 34 : ry);
    svg.querySelector('.sf-stage').style.opacity = S.pos === 'On the dashboard' ? 1 : 0;
    let rays = '';
    svg.querySelectorAll('.spk').forEach(sp => {
      const g = sp.dataset.g, m = sp.getAttribute('transform').match(/translate\(([\d.]+) ([\d.]+)\)/), x = +m[1], y = +m[2];
      let lvl = (S.g[g] + 6) / 12;                                       // 0..1 from −6..+6 dB
      if (g === 'roof') lvl *= .35 + .65 * S.h / 100;
      if (g === 'head') { const seatPriv = Object.keys(S.priv).some(k => S.priv[k]); lvl = Math.max(lvl, seatPriv ? .5 : 0); }
      const d = Math.hypot(x - S.x, y - S.y), near = Math.max(.25, 1 - d / 330);
      const o = Math.max(.12, Math.min(1, lvl * near * 1.25));
      sp.style.setProperty('--o', o.toFixed(2)); sp.style.setProperty('--r', (1 + lvl * .7).toFixed(2));
      if (g !== 'head') rays += `<line x1="${x}" y1="${y}" x2="${S.x}" y2="${S.y}" style="opacity:${(o * .35).toFixed(2)}"/>`;
    });
    svg.querySelector('.sf-rays').innerHTML = rays;
    svg.querySelectorAll('.sf-seatg').forEach(s => s.classList.toggle('priv', !!S.priv[s.dataset.seat]));
    const bal = Math.round((S.x - 150) / 11), fade = Math.round((255 - S.y) / 12);
    card.querySelector('.sf-read').textContent = `${S.zone || 'Custom spot'} · balance ${bal > 0 ? 'R' + bal : bal < 0 ? 'L' + (-bal) : 0} · fade ${fade > 0 ? 'F' + fade : fade < 0 ? 'R' + (-fade) : 0}`;
    card.querySelectorAll('[data-zone]').forEach(z => z.classList.toggle('on', z.dataset.zone === S.zone));
  }
  const sfCard = el => el.closest('.snd-sec[data-sec="sf"]') && el.closest('.snd-sec[data-sec="sf"]').querySelector('.sf-card');
  let sfDrag = null;
  document.addEventListener('pointerdown', e => { const m = e.target.closest('.sf-map'); if (!m) return; sfDrag = m; sfMove(e); });
  document.addEventListener('pointermove', e => { if (sfDrag) sfMove(e); });
  document.addEventListener('pointerup', () => { sfDrag = null; });
  function sfMove(e) {
    const r = sfDrag.getBoundingClientRect(), card = sfDrag.closest('.sf-card'), S = sfState(card);
    S.x = Math.max(50, Math.min(250, (e.clientX - r.left) / r.width * 300)); S.y = Math.max(140, Math.min(370, (e.clientY - r.top) / r.height * 440));
    S.zone = null; sfPaint(card);
  }
  function sfSlider(s) {   // speaker group / stage sliders call this while dragging
    const card = sfCard(s); if (!card) return; const S = sfState(card), pct = parseFloat(s.style.getPropertyValue('--v'));
    if (s.dataset.spk) S.g[s.dataset.spk] = Math.round(pct / 100 * 12 - 6);
    if (s.dataset.stage === 'w') S.w = pct; if (s.dataset.stage === 'h') S.h = pct;
    sfPaint(card);
  }
  function sfClick(t) {
    const z = t.closest('[data-zone]'); if (z) { const card = z.closest('.sf-card'), S = sfState(card); [S.x, S.y] = ZONES[z.dataset.zone]; S.zone = z.dataset.zone; sfPaint(card); return true; }
    const pos = t.closest('.sf-pos div'); if (pos) { pos.parentElement.querySelectorAll('div').forEach(d => d.classList.toggle('on', d === pos)); const card = sfCard(pos); sfState(card).pos = pos.textContent; sfPaint(card); return true; }
    const pv = t.closest('[data-privseat]');
    if (pv) { const card = sfCard(pv), S = sfState(card), n = pv.dataset.privseat; S.priv[n] = !S.priv[n];
      pv.querySelector('.tog').classList.toggle('on', S.priv[n]); pv.classList.toggle('on', S.priv[n]);
      pv.querySelector('.pv-s').textContent = S.priv[n] ? 'Headrest only · private' : n === 'Rear right' ? 'Rear screen · film' : n === 'Driver' ? 'Calls and NOMI' : 'Shares cabin sound';
      sfPaint(card); toast(frameOf(pv), S.priv[n] ? `${n}: sound now only in the headrest` : `${n}: back to cabin sound`); return true; }
    return false;
  }
  // Atmos badge follows what is playing; ANC meter breathes
  setInterval(() => {
    document.querySelectorAll('.frame').forEach(fr => {
      const p = fr.querySelector('.player'); if (!p) return;
      const title = (p.querySelector('.h3') || {}).textContent || '', s = SONGS.find(x => x[0] === title);
      const atmosOn = !fr.querySelector('[data-atmos]') || fr.querySelector('[data-atmos]').classList.contains('on');
      const upmix = !fr.querySelector('[data-upmix]') || fr.querySelector('[data-upmix]').classList.contains('on');
      const isMusic = s && !s[4] && !p.classList.contains('radio');
      fr.querySelectorAll('.atmos-badge').forEach(b => {
        const mode = isMusic && atmosOn ? 'atmos' : upmix ? 'dirac' : 'stereo'; b.dataset.mode = mode;
        b.querySelector('b').textContent = mode === 'atmos' ? 'Dolby Atmos' : mode === 'dirac' ? 'Dirac upmix' : 'Stereo';
        b.querySelector('.ab-s').textContent = mode === 'atmos' ? 'playing' : mode === 'dirac' ? 'from stereo' : 'two channels';
      });
      fr.querySelectorAll('.anc').forEach(a => {
        const on = fr.querySelector('[data-anc]').classList.contains('on'), base = on ? 56 : 62;
        a.querySelectorAll('.anc-bars i').forEach((b, k) => b.style.height = Math.round((on ? 18 : 34) + Math.random() * (on ? 22 : 40) * Math.exp(-k / 10)) + '%');
        a.querySelector('.anc-db').textContent = (base + Math.round(Math.random() * 2)) + ' dB';
        a.querySelector('.anc-s').textContent = on ? 'cabin · 6 dB quieter' : 'cabin · cancellation off';
      });
    });
  }, 700);
  document.querySelectorAll('.sf-card').forEach(sfPaint);
  /* status bar: Bluetooth and signal open Settings → Connections; Settings → Sound opens the one Sound page in Car */
  document.querySelectorAll('.frame').forEach(fr => {
    fr.querySelectorAll('.status .ms').forEach(e => { const t = e.textContent.trim(); if (t === 'bluetooth' || t === 'signal_cellular_alt') { e.dataset.go = 'settings:Connections'; e.setAttribute('data-tap', ''); e.style.cursor = 'pointer'; } });
    const ss = fr.querySelector('[data-screen="settings"]'); if (ss) [...ss.querySelectorAll('.snav div')].filter(d => d.textContent.trim().endsWith('Sound')).forEach(d => d.addEventListener('click', e => { e.stopPropagation(); route(fr, 'car:Sound'); }));
  });
  document.querySelectorAll('.frame').forEach(fr => { const on = fr.querySelector('.scr.on'); if (on) fr.dataset.scr = on.dataset.screen; });
  document.querySelectorAll('.player').forEach(p => { const h = p.querySelector('.h3'), i = h ? SONGS.findIndex(x => x[0] === h.textContent) : -1, s = SONGS[i]; if (i >= 0) { const fr = frameOf(p); if (fr._song == null) fr._song = i; } if (s && s[3]) setArt(p, { img: s[3] }); });
  { const music = SONGS.map((x, i) => x[4] ? -1 : i).filter(i => i >= 0);   /* a random song each time the page loads */
    setTimeout(() => document.querySelectorAll('.frame').forEach(fr => { if (fr.querySelector('.player')) setSong(fr, music[Math.floor(Math.random() * music.length)], true); })); }
  document.querySelectorAll('[data-song] .ph:not(.cov)').forEach(ph => { const s = SONGS.find(x => x[0] === ph.closest('[data-song]').dataset.song.split('|')[0]); if (s && s[3]) { ph.classList.add('cov'); ph.style.backgroundImage = `url(${s[3]})`; ph.textContent = ''; } });

  // previews: short tones at the row's own level
  function tone(seq, vol) {
    try {
      ac = ac || new (window.AudioContext || window.webkitAudioContext)(); if (ac.state === 'suspended') ac.resume();
      let t0 = ac.currentTime + 0.02;
      seq.forEach(([f, d, type]) => { const o = ac.createOscillator(), g = ac.createGain(); o.type = type || 'sine'; o.frequency.value = f;
        g.gain.setValueAtTime(0.0001, t0); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, 0.16 * vol), t0 + 0.02); g.gain.exponentialRampToValueAtTime(0.0001, t0 + d);
        o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + d + 0.02); t0 += d * 0.85; });
    } catch (e) {}
  }
  const TONES = { nav: [[880, .18], [1175, .3]], call: [[440, .25], [480, .25], [440, .25]], nomi: [[660, .12], [990, .12], [1320, .28]], ring: [[1046, .14], [1318, .14], [1568, .3]],
    chime: [[1200, .3, 'triangle']], tap: [[2100, .06, 'triangle']], lock: [[1320, .08], [990, .16]], lockClassic: [[880, .12, 'square'], [880, .12, 'square']],
    welcome: [[523, .25], [659, .25], [784, .25], [1046, .6]], welcomeB: [[784, .3], [659, .3], [880, .7]] };
  const sndBar = snd => snd.parentElement.querySelector('.snd-tabs');
  function sndTabs(snd, k) { sndBar(snd).querySelectorAll('div').forEach(d => d.classList.toggle('on', d.dataset.sndGo === k)); }
  // scrolling the page lights up the section you are in; content dissolves under the bar
  document.addEventListener('scroll', e => {
    const snd = e.target; if (!snd.classList || !snd.classList.contains('snd')) return;
    snd.parentElement.classList.toggle('scrolled', snd.scrollTop > 4);
    if (snd._jump) return;
    const top = snd.getBoundingClientRect().top + 40;
    const secs = snd.querySelectorAll('.snd-sec'); let cur = secs[0].dataset.sec; secs.forEach(s => { if (s.getBoundingClientRect().top <= top) cur = s.dataset.sec; }); if (0) snd.querySelectorAll('.snd-sec').forEach(s => { if (s.getBoundingClientRect().top <= top) cur = s.dataset.sec; });
    if (snd.scrollTop + snd.clientHeight >= snd.scrollHeight - 4) cur = secs[secs.length - 1].dataset.sec;
    sndTabs(snd, cur);
  }, true);
  function sndClick(t) {
    const go = t.closest('[data-snd-go]');
    if (go) { const snd = go.closest('.snd-wrap').querySelector('.snd'), sec = snd.querySelector(`[data-sec="${go.dataset.sndGo}"]`);
      sndTabs(snd, go.dataset.sndGo); snd._jump = true; clearTimeout(snd._jt); snd._jt = setTimeout(() => snd._jump = false, 700);
      snd.scrollTo({ top: sec.offsetTop - 14, behavior: 'smooth' }); return true; }
    const pv = t.closest('[data-snd-test]');
    if (pv) { const v = parseFloat(pv.parentElement.querySelector('.sl').style.getPropertyValue('--v')) / 100; tone(TONES[pv.dataset.sndTest], v); return true; }
    const pl = t.closest('[data-snd-play]');
    if (pl) { const card = pl.closest('.row'); const ch = card.querySelector('.segx .on').textContent;
      if (ch === 'Off') { toast(frameOf(pl), 'This sound is off'); return true; }
      tone(pl.dataset.sndPlay === 'lock' ? (ch === 'Classic' ? TONES.lockClassic : TONES.lock) : (ch === 'Breeze' ? TONES.welcomeB : TONES.welcome), 0.7); return true; }
    const eq = t.closest('.eq-pre div'); if (eq) { eqPreset(eq); return true; }
    const er = t.closest('[data-eq-reset]'); if (er) { const c = er.closest('.eq-card'); eqPreset([...c.querySelectorAll('.eq-pre div')].find(x => x.textContent === 'Balanced')); return true; }
    if (sfClick(t)) return true;
    return false;
  }
  // long-press the dock volume to open Settings › Sound
  let lpT = null, lpX = 0, lpFired = false;
  document.addEventListener('click', e => { if (lpFired) { lpFired = false; e.stopImmediatePropagation(); e.preventDefault(); } }, true);   // a long-press is not a mute tap
  // hold a bottom-bar button to open its menu: volume → Sound, Seats → Car › Seats, Climate → Car › Climate, Defrost → Climate, NOMI → Settings › NOMI
  const HOLD = { seats: ['car:Seats', 'Seat settings'], climate: ['car:Climate', 'Climate settings'], defrost: ['climate', 'Climate · defrost'], nomi: ['settings:NOMI', 'NOMI settings'] };
  document.addEventListener('pointerdown', e => { const v = e.target.closest('.dock .dvol, .dock .vol, .dock .dk.cmf'); if (!v) return; lpX = e.clientX;
    const k = v.hasAttribute('data-nomi') ? 'nomi' : v.dataset.cmf, h = HOLD[k] || ['settings:Sound', 'Sound settings'];
    lpT = setTimeout(() => { lpT = null; if (drag) { drag.s.classList.remove('drag'); drag = null; } const fr = frameOf(v);
      const q = fr.querySelector('.seatq'); if (q) q.classList.remove('on'); const nv = fr.querySelector('.nomiov'); if (nv) nv.classList.remove('on');
      route(fr, h[0]); lpFired = true; toast(fr, h[1]); setTimeout(wideUpdate, 0); }, 650); });
  document.addEventListener('pointermove', e => { if (lpT && Math.abs(e.clientX - lpX) > 8) { clearTimeout(lpT); lpT = null; } });
  document.addEventListener('pointerup', () => { if (lpT) { clearTimeout(lpT); lpT = null; } });

  function toast(fr, msg) {
    let el = fr.querySelector('.htoast'); if (!el) { el = document.createElement('div'); el.className = 'htoast'; fr.appendChild(el); }
    el.textContent = msg;
    // centre it on what you're looking at: the car in Quick controls, otherwise the open page (not the side menu)
    { const scr = fr.querySelector('.scr.on'), pg = scr && scr.querySelector('.pg.on'), t = (pg && pg.querySelector('.qc-car')) || (scr && scr.querySelector('.pages')), fb = fr.getBoundingClientRect();
      if (t && t.offsetParent && fb.width) { const k = fb.width / fr.offsetWidth, b = t.getBoundingClientRect(); el.style.left = Math.round((b.left + b.width / 2 - fb.left) / k) + 'px'; } else el.style.left = ''; }
    el.classList.add('show'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('show'), 2200);
  }
  /* ---------- Calendar: week / month / year, Emma's plans, add a random event ---------- */
  const CY = new Date().getFullYear();
  const CAT = { work: '#cddcf7', art: '#f3dde4', hike: '#d5ead8', ski: '#d5ead8', life: '#e9dcf3' };
  const EVENTS = [
    [11, 24, '10:00', 'Client walkthrough', 'Limpertsberg apartment', 'work'], [11, 26, '19:00', 'Gallery opening', 'Casino Luxembourg', 'art'],
    [11, 28, '08:30', 'Hike · Mullerthal Trail', 'Route 1, Echternach', 'hike'], [12, 2, '11:00', 'Fabric and tile samples', 'Studio', 'work'],
    [12, 11, 'All day', 'Ski weekend', 'Saas-Fee, until Sunday', 'ski'], [12, 12, 'All day', 'Ski weekend', 'Saas-Fee', 'ski'], [12, 13, 'All day', 'Ski weekend', 'Saas-Fee', 'ski'],
    [12, 17, '18:30', 'Christmas market sketch walk', "Place d'Armes", 'art']].map(e => ({ d: new Date(CY, e[0] - 1, e[1]), t: e[2], n: e[3], w: e[4], c: e[5] }));
  // today's plan (matches Home) and tomorrow's lunch with Ashish (matches his message), always relative to the real date
  const TD = new Date(); TD.setHours(0, 0, 0, 0); const dPlus = k => new Date(TD.getFullYear(), TD.getMonth(), TD.getDate() + k);
  EVENTS.push({ d: dPlus(0), t: '14:00', n: 'Mudam visit', w: 'Kirchberg', c: 'art' }, { d: dPlus(0), t: '16:00', n: 'Ville Haute walk', w: 'Old town', c: 'life' },
    { d: dPlus(0), t: '18:00', n: 'Grand Ducal Palace', w: 'Tour', c: 'art' }, { d: dPlus(1), t: '14:00', n: 'Lunch with Ashish', w: 'Aké', c: 'life' });
  const IDEAS = [['Showroom visit', 'Kitchen supplier, Bertrange', 'work'], ['Museum late', 'MNHA', 'art'], ['Hike · Schiessentümpel loop', 'Mullerthal', 'hike'], ['Coffee with Bora', 'Grund', 'life'],
    ['Design review', 'Clausen loft', 'work'], ['Life drawing class', 'Studio Bonnevoie', 'art'], ['Ski pass renewal', 'Online', 'life'], ['Moodboard session', 'Studio', 'work'], ['Hike · Müllerthal sunrise', 'Berdorf', 'hike']];
  const sameDay = (a, b) => a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
  const evOn = d => EVENTS.filter(e => sameDay(e.d, d)).sort((a, b) => a.t.localeCompare(b.t));
  const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function calInit(cw) { if (!cw) return; const t = new Date(); cw._sel = new Date(t.getFullYear(), t.getMonth(), t.getDate()); cw._view = 'Today'; calDraw(cw); }
  function calDraw(cw) {
    const sel = cw._sel, today = new Date(), body = cw.querySelector('.cal-body'), title = cw.querySelector('.cal-title');
    cw.querySelectorAll('.cal-view div').forEach(d => d.classList.toggle('on', d.textContent === cw._view));
    let h = '';
    if (cw._view === 'Today') {
      title.textContent = sameDay(sel, today) ? 'Today' : sel.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
      const ev = evOn(sel), allDay = ev.filter(e => !/^\d/.test(e.t)), H0 = 8, H1 = 22, PX = 44;
      h = `<div class="cal-dv">${allDay.map(e => `<div class="cal-ad" style="background:${CAT[e.c]}">All day · ${e.n}</div>`).join('')}<div class="cal-tl" style="height:${(H1 - H0) * PX}px">`;
      for (let hh = H0; hh <= H1; hh++) h += `<div class="cal-hr" style="top:${(hh - H0) * PX}px"><span class="num">${String(hh).padStart(2, '0')}:00</span></div>`;
      ev.filter(e => /^\d/.test(e.t)).forEach(e => { const [a, b] = e.t.split(':').map(Number), y = (a + b / 60 - H0) * PX;
        h += `<div class="cal-blk" data-evi="${EVENTS.indexOf(e)}" data-tap style="top:${y + 2}px;height:${(e.len || 1) * PX - 4}px;background:${CAT[e.c]}"><b>${e.n}</b><span>${e.t} · ${e.w}</span></div>`; });
      if (sameDay(sel, today)) { const nowH = today.getHours() + today.getMinutes() / 60; if (nowH >= H0 && nowH <= H1) h += `<div class="cal-now" style="top:${(nowH - H0) * PX}px"></div>`; }
      h += '</div></div>';
    } else if (cw._view === 'Month') {
      title.textContent = `${MON[sel.getMonth()]} ${sel.getFullYear()}`;
      const first = new Date(sel.getFullYear(), sel.getMonth(), 1), off = (first.getDay() + 6) % 7;
      h = '<div class="cal-m">' + ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(d => `<span class="cal-h">${d}</span>`).join('');
      for (let k = 0; k < 42; k++) {
        const d = new Date(sel.getFullYear(), sel.getMonth(), 1 - off + k), ev = evOn(d), out = d.getMonth() !== sel.getMonth();
        h += `<div class="cal-d${out ? ' out' : ''}${sameDay(d, today) ? ' today' : ''}${sameDay(d, sel) ? ' sel' : ''}" data-cal-day="${d.getTime()}" data-tap><b>${d.getDate()}</b>${ev.slice(0, 2).map(e => `<i style="background:${CAT[e.c]}">${e.n}</i>`).join('')}${ev.length > 2 ? `<small>+${ev.length - 2} more</small>` : ''}</div>`;
      }
      h += '</div>';
    } else if (cw._view === 'Week') {
      const mon = new Date(sel); mon.setDate(sel.getDate() - (sel.getDay() + 6) % 7);
      const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
      title.textContent = `${mon.getDate()} ${MON[mon.getMonth()].slice(0, 3)} – ${sun.getDate()} ${MON[sun.getMonth()].slice(0, 3)}`;
      h = '<div class="cal-w">' + Array.from({ length: 7 }, (_, k) => {
        const d = new Date(mon); d.setDate(mon.getDate() + k);
        return `<div class="cal-wc${sameDay(d, sel) ? ' sel' : ''}${sameDay(d, today) ? ' today' : ''}" data-cal-day="${d.getTime()}" data-tap><span class="cal-h">${['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][k]}</span><b>${d.getDate()}</b>` +
          evOn(d).map(e => `<div class="cal-ev" style="background:${CAT[e.c]}"><span class="num">${e.t}</span>${e.n}</div>`).join('') + '</div>';
      }).join('') + '</div>';
    } else {
      title.textContent = String(sel.getFullYear());
      h = '<div class="cal-y">' + MON.map((mn, m) => {
        const first = new Date(sel.getFullYear(), m, 1), off = (first.getDay() + 6) % 7, days = new Date(sel.getFullYear(), m + 1, 0).getDate();
        let g = '<i></i>'.repeat(off);
        for (let d = 1; d <= days; d++) { const dt = new Date(sel.getFullYear(), m, d); g += `<i class="${evOn(dt).length ? 'ev' : ''}${sameDay(dt, today) ? ' today' : ''}">${d}</i>`; }
        return `<div class="cal-ym" data-cal-month="${m}" data-tap><span class="b2" style="color:var(--t1)">${mn}</span><div class="cal-yg">${g}</div></div>`;
      }).join('') + '</div>';
    }
    body.innerHTML = h;
    const ev = evOn(sel);
    cw.querySelector('.cal-day').textContent = sameDay(sel, today) ? 'Today' : sel.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long' });
    cw.querySelector('.cal-list').innerHTML = ev.length ? ev.map(e => `<div class="cal-li" data-evi="${EVENTS.indexOf(e)}" data-tap><i style="background:${CAT[e.c]}"></i><div class="col" style="gap:0"><span class="b2" style="color:var(--t1)">${e.n}</span><span class="bs">${e.t} · ${e.w}</span></div></div>`).join('') : '<span class="bs">Nothing planned.</span>';
  }
  function calClick(t) {
    const cw = t.closest('.calw'); if (!cw) return false;
    if (t.closest('[data-evi]') || t.closest('.ev-sheet')) return false;
    if (t.closest('.cal-sheetov')) { ceClick(cw, t); return true; }
    const vd = t.closest('.cal-view div'); if (vd) { cw._view = vd.textContent; calDraw(cw); return true; }
    const st = t.closest('[data-cal-step]');
    if (st) { const k = +st.dataset.calStep, s = cw._sel;
      cw._sel = cw._view === 'Today' ? new Date(s.getFullYear(), s.getMonth(), s.getDate() + k) : cw._view === 'Month' ? new Date(s.getFullYear(), s.getMonth() + k, 1) : cw._view === 'Week' ? new Date(s.getFullYear(), s.getMonth(), s.getDate() + 7 * k) : new Date(s.getFullYear() + k, s.getMonth(), 1);
      calDraw(cw); return true; }
    const dd = t.closest('[data-cal-day]'); if (dd) { cw._sel = new Date(+dd.dataset.calDay); calDraw(cw); return true; }
    const mm = t.closest('[data-cal-month]'); if (mm) { cw._sel = new Date(cw._sel.getFullYear(), +mm.dataset.calMonth, 1); cw._view = 'Month'; calDraw(cw); return true; }
    if (t.closest('[data-cal-add]')) { ceOpen(cw); return true; }
    return false;
  }

  /* ---------- New event sheet ---------- */
  function ceOpen(cw) {
    const ov = cw.querySelector('.cal-sheetov'); cw._ce = { d: new Date(cw._sel), m: 10 * 60, cat: 'work' };
    ov.querySelector('.ce-title').value = ''; ov.querySelector('.ce-where').value = '';
    ov.querySelectorAll('.ce-cat .chip2').forEach(c => c.classList.toggle('on', c.dataset.ceCat === 'work'));
    cePaint(cw); ov.classList.add('on'); setTimeout(() => ov.querySelector('.ce-title').focus({ preventScroll: true }), 350);
  }
  function cePaint(cw) {
    const ov = cw.querySelector('.cal-sheetov'), e = cw._ce, today = new Date();
    ov.querySelector('.ce-date').textContent = sameDay(e.d, today) ? 'Today' : e.d.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' });
    ov.querySelector('.ce-time').textContent = `${String(Math.floor(e.m / 60)).padStart(2, '0')}:${String(e.m % 60).padStart(2, '0')}`;
    ov.querySelector('[data-ce-save]').classList.toggle('off', !ov.querySelector('.ce-title').value.trim());
  }
  function ceClick(cw, t) {
    const ov = cw.querySelector('.cal-sheetov'), e = cw._ce;
    if (t === ov || t.closest('[data-ce-cancel]')) { ov.classList.remove('on'); return; }
    const st = t.closest('[data-ce]'); if (st) { const [k, v] = st.dataset.ce.split('|'); if (k === 'd') e.d = new Date(e.d.getFullYear(), e.d.getMonth(), e.d.getDate() + +v); else e.m = Math.max(6 * 60, Math.min(22 * 60, e.m + +v)); cePaint(cw); return; }
    const sg = t.closest('[data-ce-sugg]'); if (sg) { const [n, c] = sg.dataset.ceSugg.split('|'); ov.querySelector('.ce-title').value = n; e.cat = c; ov.querySelectorAll('.ce-cat .chip2').forEach(x => x.classList.toggle('on', x.dataset.ceCat === c)); cePaint(cw); return; }
    const ct = t.closest('[data-ce-cat]'); if (ct) { e.cat = ct.dataset.ceCat; ov.querySelectorAll('.ce-cat .chip2').forEach(x => x.classList.toggle('on', x === ct)); return; }
    const sx = t.closest('.ce-len div, .ce-alert div'); if (sx) { [...sx.parentElement.children].forEach(x => x.classList.toggle('on', x === sx)); return; }
    if (t.closest('[data-cal-nomi]')) {
      const [n, w, c] = IDEAS[Math.floor(Math.random() * IDEAS.length)];
      ov.querySelector('.ce-title').value = n; ov.querySelector('.ce-where').value = w; e.cat = c; e.m = (9 + Math.floor(Math.random() * 9)) * 60 + (Math.random() < .5 ? 0 : 30);
      ov.querySelectorAll('.ce-cat .chip2').forEach(x => x.classList.toggle('on', x.dataset.ceCat === c)); cePaint(cw); toast(frameOf(cw), 'NOMI filled in a suggestion'); return;
    }
    const sv = t.closest('[data-ce-save]');
    if (sv && !sv.classList.contains('off')) {
      const len = ov.querySelector('.ce-len .on').textContent, n = ov.querySelector('.ce-title').value.trim();
      const tm = len === 'All day' ? 'All day' : ov.querySelector('.ce-time').textContent;
      EVENTS.push({ d: e.d, t: tm, n, w: ov.querySelector('.ce-where').value.trim() || 'No place', c: e.cat, len: len === '2 h' ? 2 : len === '30 min' ? .5 : 1 });
      ov.classList.remove('on'); cw._sel = e.d; calDraw(cw);
      toast(frameOf(cw), `Saved · ${n}, ${ov.querySelector('.ce-date').textContent} ${tm === 'All day' ? '(all day)' : tm}`);
    }
  }
  document.addEventListener('input', ev => { const cw = ev.target.closest && ev.target.closest('.calw'); if (cw && cw._ce) cePaint(cw); });

  /* ---------- Weather: Paris and New Delhi below Luxembourg (Open-Meteo, live) ---------- */
  function weatherCities(root) {
    root.querySelectorAll('.wcity').forEach(c => {
      fetch(`https://api.open-meteo.com/v1/forecast?latitude=${c.dataset.lat}&longitude=${c.dataset.lon}&current=temperature_2m,weather_code&daily=temperature_2m_max,temperature_2m_min&forecast_days=1&timezone=${encodeURIComponent(c.dataset.tz)}`)
        .then(r => r.json()).then(j => {
          const codes = window.nioCodes || [], m = codes.filter(x => x[0] <= j.current.weather_code).pop() || [0, 'clear', 'clear_day'];
          const lt = new Date().toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', timeZone: c.dataset.tz });
          c.querySelector('.wc-c').textContent = Math.round(j.current.temperature_2m) + ' °C';
          c.querySelector('.wc-t').textContent = `${m[1]} · ${lt} local`; const hr = +lt.slice(0, 2), night = hr < 7 || hr >= 18; c.querySelector('.wc-i').textContent = night ? m[2].replace('clear_day', 'clear_night').replace('partly_cloudy_day', 'partly_cloudy_night') : m[2];
          c.querySelector('.wc-h').textContent = `H ${Math.round(j.daily.temperature_2m_max[0])}° · L ${Math.round(j.daily.temperature_2m_min[0])}°`;
        }).catch(() => { c.querySelector('.wc-t').textContent = 'weather unavailable'; });
    });
  }

  /* ---------- Navigation: end route (with Undo) → free drive with a "Where to?" panel ---------- */
  const PLACES = [
    // [name, sub, km, min, icon, group]
    ['Home', 'Belair · Rue de Hollerich', 6.2, 14, 'home', 'fav'], ['Work', 'Studio · Clausen', 4.1, 11, 'work', 'fav'], ['Mudam', 'Museum · Kirchberg', 3.3, 9, 'museum', 'fav'],
    ['Parc Merl', 'Park · Merl', 2.8, 8, 'park', 'fav'], ['Aké', 'Lunch with Ashish · tomorrow 14:00', 3.6, 10, 'restaurant', 'fav'],
    ['Parking Trois Glands', 'Underground · Kirchberg', 3.0, 7, 'local_parking', 'recent'], ['Casino Luxembourg', 'Gallery · Ville Haute', 2.4, 7, 'palette', 'recent'],
    ["Place d'Armes", 'Square · Ville Haute', 2.1, 6, 'location_city', 'recent'], ['Kirchberg Shopping', 'Shopping · Kirchberg', 4.0, 10, 'shopping_bag', 'recent'],
    ['Charging hub · Kirchberg', '8 fast chargers · 4 free', 3.9, 10, 'ev_station', 'Charging'], ["Charging hub · Cloche d'Or", '6 fast chargers · 2 free', 5.4, 13, 'ev_station', 'Charging'], ['Fast charger · Gare', '2 chargers · 1 free', 1.6, 5, 'ev_station', 'Charging'],
    ['Power Swap · Bertrange', 'Battery swap · about 5 min', 7.8, 15, 'battery_charging_full', 'Swap'], ['Power Swap · Kirchberg', 'Battery swap · about 5 min', 4.4, 11, 'battery_charging_full', 'Swap'],
    ['Parking Trois Glands ', '86 free · fits 2.00 m', 3.0, 7, 'local_parking', 'Parking'], ['Kirchberg Shopping parking', '210 free · fits 2.10 m', 4.0, 10, 'local_parking', 'Parking'], ['Parking Coque', '41 free · fits 1.90 m', 4.6, 12, 'local_parking', 'Parking'],
    ['Café · Grund', 'Coffee · open until 18:00', 2.6, 8, 'local_cafe', 'Coffee'], ['Coffee bar · Ville Haute', 'Coffee · open until 19:00', 2.2, 7, 'local_cafe', 'Coffee'], ['Café · Kirchberg', 'Coffee · open until 20:00', 3.5, 9, 'local_cafe', 'Coffee'],
    ['Aké ', 'Restaurant · Ville Haute', 3.6, 10, 'restaurant', 'Food'], ["Brasserie · Place d'Armes", 'Restaurant · open now', 2.1, 6, 'restaurant', 'Food'], ['Bistro · Clausen', 'Restaurant · open now', 3.1, 9, 'restaurant', 'Food']];
  const CATS = [['Charging', 'ev_station'], ['Swap', 'battery_charging_full'], ['Parking', 'local_parking'], ['Coffee', 'local_cafe'], ['Food', 'restaurant']];
  const clockAdd = m => { const t = 13 * 60 + 48 + m; return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`; };
  const prow = (p, i) => `<div class="wt-row" data-wt-place="${i}" data-tap><span class="wt-ic"><span class="ms">${p[4]}</span></span><div class="col" style="gap:0;flex:1;min-width:0"><span class="b2 ell" style="color:var(--t1)">${p[0].trim()}</span><span class="bs ell">${p[1]}</span></div><div class="col" style="gap:0;align-items:flex-end"><span class="b2 num" style="color:var(--t1)">${p[3]} min</span><span class="bs num">${p[2].toFixed(1)} km</span></div></div>`;
  const KEYS = ['qwertyuiop', 'asdfghjkl', 'zxcvbnm'];
  function wtBuild(app) {
    const wt = document.createElement('div'); wt.className = 'wt';
    wt.innerHTML = `<div class="wt-card float">
      <div class="wt-bar"><span class="ms" style="color:var(--t2)">search</span><span class="wt-q">Where to?</span>
        <div class="icb wt-kb" data-wt-kb data-tap title="Keyboard"><span class="ms">keyboard</span></div><div class="icb wt-mic" data-wt-mic data-tap title="Hey NOMI"><span class="ms">mic</span></div>
        <div class="icb wt-x" data-wt-close data-tap title="Close"><span class="ms">close</span></div></div>
      <div class="wt-quick">${PLACES.filter(p => p[5] === 'fav').slice(0, 3).map(p => `<div class="chip2" data-wt-place="${PLACES.indexOf(p)}" data-tap><span class="ms" style="font-size:20px;margin-right:6px">${p[4]}</span>${p[0]}</div>`).join('')}</div>
      <div class="wt-body">
        <div class="wt-cats">${CATS.map(([c, i]) => `<div class="wt-cat" data-wt-cat="${c}" data-tap><span class="ms">${i}</span><span>${c}</span></div>`).join('')}</div>
        <div class="wt-list"></div>
        <div class="wt-prev"></div>
      </div>
      <div class="wt-keys">${KEYS.map(r => `<div class="wt-kr">${[...r].map(k => `<div class="wt-k" data-wt-key="${k}" data-tap>${k}</div>`).join('')}</div>`).join('')}
        <div class="wt-kr"><div class="wt-k wide" data-wt-key="⌫" data-tap><span class="ms">backspace</span></div><div class="wt-k space" data-wt-key=" " data-tap>space</div><div class="wt-k wide go" data-wt-kb data-tap>Done</div></div></div>
    </div>`;
    app.appendChild(wt); app._wt = { q: '', cat: null };
    wtList(app);
  }
  function wtList(app) {
    const W = app._wt, list = app.querySelector('.wt-list'), q = W.q.trim().toLowerCase();
    app.querySelector('.wt-q').textContent = W.q || 'Where to?'; app.querySelector('.wt-q').classList.toggle('typed', !!W.q);
    app.querySelectorAll('.wt-cat').forEach(c => c.classList.toggle('on', c.dataset.wtCat === W.cat));
    let h = '';
    if (q) { const r = PLACES.map((p, i) => [p, i]).filter(([p]) => (p[0] + ' ' + p[1]).toLowerCase().includes(q)); h = `<span class="lbl">Results</span>` + (r.length ? r.map(([p, i]) => prow(p, i)).join('') : '<span class="bs">No places found. Try “Mudam” or “coffee”.</span>'); }
    else if (W.cat) h = `<span class="lbl">${W.cat} nearby</span>` + PLACES.map((p, i) => [p, i]).filter(([p]) => p[5] === W.cat).map(([p, i]) => prow(p, i)).join('');
    else h = '<span class="lbl">Favourites</span>' + PLACES.map((p, i) => [p, i]).filter(([p]) => p[5] === 'fav').map(([p, i]) => prow(p, i)).join('')
      + '<span class="lbl" style="margin-top:8px">Recent</span>' + PLACES.map((p, i) => [p, i]).filter(([p]) => p[5] === 'recent').map(([p, i]) => prow(p, i)).join('');
    list.innerHTML = h;
  }
  // every change to the Where-to card glides: measure, change, animate height on the 600 ms panel curve
  function wtMorph(app, change) {
    const card = app.querySelector('.wt-card'); if (!card) { change(); return; }
    const h0 = card.getBoundingClientRect().height / (app.getBoundingClientRect().height / app.offsetHeight || 1);
    card.style.transition = 'none'; card.style.height = 'auto';
    change();
    const h1 = card.offsetHeight;
    card.style.height = h0 + 'px'; card.offsetHeight; card.style.transition = '';
    card.style.height = h1 + 'px'; card._targetH = h1;
    clearTimeout(card._mt); card._mt = setTimeout(() => { card.style.height = ''; card._targetH = null; }, 650);
    stackLeft(app);
  }
  function wtOpen(app, on) { app.classList.toggle('wt-open', on); if (!on) { app.classList.remove('wt-kbon'); app.classList.remove('wt-preview'); } }
  function wtPreview(app, i) {
    const p = PLACES[i]; app._wt.sel = i;
    app.querySelector('.wt-prev').innerHTML = `<div class="row" style="gap:14px;align-items:center"><span class="wt-ic big"><span class="ms">${p[4]}</span></span><div class="col" style="gap:0;min-width:0"><span class="h2 ell">${p[0].trim()}</span><span class="bs">${p[1]}</span></div></div>
      <div class="wt-stats"><div><b class="num">${p[3]} min</b><span class="lbl">Drive</span></div><div><b class="num">${p[2].toFixed(1)} km</b><span class="lbl">Distance</span></div><div><b class="num">${clockAdd(p[3])}</b><span class="lbl">Arrive</span></div></div>
      <span class="bs">Fastest route via Route d'Esch · light traffic${p[4] === 'local_parking' ? ' · Parking app can reserve a space' : ''}</span>
      <div class="row" style="gap:10px"><div class="btn sec" data-wt-back data-tap><span class="ms" style="font-size:22px">arrow_back</span>Back</div><div class="btn pri" style="flex:1" data-wt-go data-tap><span class="ms f" style="font-size:22px">navigation</span>Start</div></div>`;
    app.classList.add('wt-preview'); app.classList.remove('wt-kbon'); wtOpen(app, true);
  }
  function routeStart(app, i) {
    const p = PLACES[i], name = p[0].trim(), eta = clockAdd(p[3]);
    const pinT = app.querySelector('.nm-pin-t'); if (pinT) pinT.innerHTML = `${name}<small>${eta}</small>`;
    const pinD = app.querySelector('.nm-pin-dot'); if (pinD) pinD.innerHTML = `<span class="ms f" style="font-size:18px;color:#fff">${p[4]}</span>`;
    const to = app.querySelector('[data-nav="to"]'); if (to) to.textContent = 'To ' + name.replace(/^Parking /, '');
    const e = app.querySelector('[data-nav="eta"]'); if (e) e.textContent = eta;
    app.classList.remove('noroute'); wtOpen(app, false); app._wt.q = ''; app._wt.cat = null; wtList(app);
    if (app._navRestart) app._navRestart(); if (app._dashRestart) app._dashRestart();
    toast(frameOf(app), `Route to ${name} · ${p[3]} min`);
  }
  function routeEnd(app) {
    app.classList.add('noroute'); wtOpen(app, false);
    const fr = frameOf(app); let el = fr.querySelector('.utoast');
    if (!el) { el = document.createElement('div'); el.className = 'utoast'; fr.appendChild(el); }
    el.innerHTML = `<span>Route ended</span><b data-undo data-tap>Undo</b>`; el.classList.add('show'); clearTimeout(el._t);
    el._app = app; el._t = setTimeout(() => el.classList.remove('show'), 5000);
  }
  function navClick(t) {
    const app = t.closest('.app[data-navmap]');
    const undo = t.closest('[data-undo]'); if (undo) { const el = undo.closest('.utoast'); if (el._app) el._app.classList.remove('noroute'); el.classList.remove('show'); return true; }
    if (!app || !app._wt) return false;
    if (t.closest('[data-endroute]')) { wtMorph(app, () => routeEnd(app)); return true; }
    if (t.closest('[data-whereto]')) { wtMorph(app, () => wtOpen(app, !app.classList.contains('wt-open'))); return true; }
    if (!t.closest('.wt')) return false;
    const W = app._wt;
    if (t.closest('[data-wt-close]')) { wtMorph(app, () => { if (app.classList.contains('wt-preview')) app.classList.remove('wt-preview'); else { wtOpen(app, false); W.q = ''; W.cat = null; wtList(app); } }); return true; }
    if (t.closest('[data-wt-kb]')) { const on = !app.classList.contains('wt-kbon'); wtMorph(app, () => { wtOpen(app, true); app.classList.remove('wt-preview'); app.classList.toggle('wt-kbon', on); }); return true; }
    const k = t.closest('[data-wt-key]'); if (k) { wtMorph(app, () => { W.q = k.dataset.wtKey === '⌫' ? W.q.slice(0, -1) : (W.q + k.dataset.wtKey).replace(/^ /, ''); if (W.q.length === 1) W.q = W.q.toUpperCase(); W.cat = null; wtList(app); }); return true; }
    if (t.closest('[data-wt-mic]')) {
      const q = app.querySelector('.wt-q'); wtMorph(app, () => { wtOpen(app, true); app.classList.remove('wt-preview', 'wt-kbon'); W.q = ''; W.cat = null; wtList(app); }); q.textContent = 'Listening…'; app.classList.add('wt-listen');
      const word = 'Mudam'; let n = 0; setTimeout(function typeIt() { n++; W.q = word.slice(0, n); wtMorph(app, () => wtList(app)); if (n < word.length) setTimeout(typeIt, 120); else app.classList.remove('wt-listen'); }, 1100); return true; }
    const c = t.closest('[data-wt-cat]'); if (c) { wtMorph(app, () => { W.cat = W.cat === c.dataset.wtCat ? null : c.dataset.wtCat; W.q = ''; wtOpen(app, true); app.classList.remove('wt-preview'); wtList(app); }); return true; }
    const pl = t.closest('[data-wt-place]'); if (pl) { wtMorph(app, () => wtPreview(app, +pl.dataset.wtPlace)); return true; }
    if (t.closest('[data-wt-back]')) { wtMorph(app, () => app.classList.remove('wt-preview')); return true; }
    if (t.closest('[data-wt-go]')) { routeStart(app, W.sel); return true; }
    if (t.closest('.wt-bar')) { if (!app.classList.contains('wt-open')) wtMorph(app, () => wtOpen(app, true)); return true; }
    return true;
  }
  // left column: top card, view switch and car-view chips always stack with the same 16 px gap
  function stackLeft(app) {
    if (!app.offsetParent) return;
    const G = 16, noroute = app.classList.contains('noroute'), open = app.classList.contains('wt-open'), car = app.classList.contains('v-car');
    const card = app.querySelector('.wt .wt-card');
    const top = noroute || open ? card : app.querySelector('.tcard');
    const seg = app.querySelector('.seg[data-views]');
    // the open panel never covers the view switch: cap its height so Serene / Map / Car always fits below
    if (card) card.style.maxHeight = (app.offsetHeight - 20 - G - (seg ? seg.offsetHeight : 0) - 20) + 'px';
    const chips = car && !open ? [noroute ? null : app.querySelector('.carview .cv-chip'), app.querySelector('.carview .tl-chip')].filter(Boolean) : [];
    const th = top ? (top === card && card._targetH ? card._targetH : top.offsetHeight) : 0;
    let y = 20 + th + G;
    [seg, ...chips].forEach(el => { if (!el) return; const v = y + 'px'; if (el.style.top !== v) el.style.top = v; y += el.offsetHeight + G; });
    app.classList.toggle('wt-cover', open);
  }
  const stackAll = () => document.querySelectorAll('.app[data-navmap]:not([data-static])').forEach(stackLeft);
  setInterval(stackAll, 120);
  document.addEventListener('click', () => requestAnimationFrame(stackAll));   // move at once on a tap, not on the next tick
  // wire up every live navigation pane (hero + prototype), not the static gallery frames
  document.querySelectorAll('.app[data-navmap]:not([data-static])').forEach(app => {
    const icon = app.querySelector('[data-nav="icon"]'), eta = app.querySelector('[data-nav="eta"]');
    if (icon) icon.closest('.float').classList.add('tcard');
    const tb = eta && eta.closest('.float');
    if (tb) { tb.classList.add('tripbar'); const end = [...tb.querySelectorAll('div')].find(d => d.querySelector(':scope > .ms') && d.querySelector(':scope > .ms').textContent.trim() === 'close'); if (end) { end.dataset.endroute = ''; end.setAttribute('data-tap', ''); end.classList.add('endbtn'); }
      const lb = [...tb.querySelectorAll('.lbl')].find(l => /^to /i.test(l.textContent.trim())); if (lb) lb.dataset.nav = 'to'; }
    const s = app.querySelector('.mapctl .icb'); if (s) { s.dataset.whereto = ''; s.setAttribute('data-tap', ''); }
    wtBuild(app);
  });

  /* ---------- Seats: four seats, position, comfort, massage, one-touch modes ---------- */
  const SEATDEF = { ext: 0, height: 30, fore: 130, recline: 25, tilt: 0, lumbar: 40, bolster: 50, headh: 30, headt: 10, leg: 0, heat: '2', vent: 'Off', arm: false, mass: false, mint: 3, mspd: 2 };
  const SEATS0 = { Driver: { ...SEATDEF }, Passenger: { ...SEATDEF, heat: 'Off', fore: 120 }, 'Rear left': { ...SEATDEF, heat: 'Off', recline: 27, fore: 60, height: 15 }, 'Rear right': { ...SEATDEF, heat: '1', recline: 30, fore: 60, height: 15, leg: 8, ext: 20 } };
  const stOf = w => w._st || (w._st = { sel: 'Driver', s: JSON.parse(JSON.stringify(SEATS0)), mem: {} });
  const parked = w => { const fr = frameOf(w), g = fr.querySelector('.gear .on'); return !g || g.textContent.trim() === 'P'; };
  function stPaint(w) {
    try { wcPaint(frameOf(w)); w.querySelectorAll('.st-who').forEach(e => e.textContent = stOf(w).sel); } catch (e) {}
    const S = stOf(w), v = S.s[S.sel], rear = S.sel.startsWith('Rear');
    w.querySelectorAll('[data-seatpick]').forEach(g => { const n = g.dataset.seatpick, s = S.s[n]; g.classList.toggle('on', n === S.sel);
      g.querySelector('.b-heat').classList.toggle('lit', s.heat !== 'Off'); g.querySelector('.b-vent').classList.toggle('lit', s.vent !== 'Off'); g.querySelector('.b-mass').classList.toggle('lit', s.mass); });
    w.querySelectorAll('.st-name').forEach(e => e.textContent = S.sel);
    w.classList.toggle('st-isrear', rear);
    w.querySelectorAll('[data-seatk]').forEach(sl => { const k = sl.dataset.seatk, lo = +sl.dataset.min, hi = +sl.dataset.max; sl.style.setProperty('--v', ((v[k] - lo) / (hi - lo) * 100) + '%'); const o = sl.parentElement.querySelector('.val'); if (o) o.textContent = (k === 'leg' ? Math.round(v[k]) : v[k]) + (sl.dataset.unit || ''); });
    w.querySelectorAll('[data-seatopt]').forEach(o => o.querySelectorAll('span').forEach(x => x.classList.toggle('on', x.textContent === v[o.dataset.seatopt])));
    w.querySelectorAll('[data-seattog]').forEach(tg => tg.classList.toggle('on', !!v[tg.dataset.seattog]));
    // side view (adjustment view): parts follow the values, active parts and arrow nodes follow the chosen mode
    const q = s => w.querySelector(s);
    q('.ss-all').style.transform = `translate(${(v.fore - 130) * .12}px, ${-(v.height - 30) * .25}px)`;
    { const fl = q('.sv-floor'); if (fl) fl.style.transform = `translateX(${(v.fore - 130) * .12}px)`; }
    q('.ss-back').style.transform = `rotate(${-(v.recline - 16)}deg)`;   // the render's backrest leans 16°
    q('.ss-cush').style.transform = `rotate(${-v.tilt}deg)`;
    q('.ss-head').style.transform = `translate(${-(v.headh - 30) * .035 + (v.headt - 10) * .2}px, ${-(v.headh - 30) * .12}px)`;   // slides along the backrest
    // ring shows the control in focus: recline and tilt/angle as real degrees, distances as a share of their range
    { const C = [150, 110], R = 112, at = deg => { const r = (-90 - deg) * Math.PI / 180; return [C[0] + R * Math.cos(r), C[1] + R * Math.sin(r)]; };
      const md = ADJ[S.mode || 'cush'], n = md.nodes.find(x => x.k === S.last) || md.nodes[0], [lo, hi] = limOf(S.sel, n.k), val = v[n.k];
      const sweep = n.k === 'recline' ? val : n.unit.trim() === '°' ? Math.max(0, val) * 2 : (val - lo) / (hi - lo) * 90;
      const up = at(0), bk = at(sweep), set = (s, o) => { const e = q(s); Object.entries(o).forEach(([k, x]) => e.setAttribute(k, typeof x === 'number' ? x.toFixed(1) : x)); };
      set('.ann-nv', { cx: up[0], cy: up[1] }); set('.ann-nr', { cx: bk[0], cy: bk[1] });
      set('.ann-v', { x1: up[0], y1: up[1] - 4, x2: up[0], y2: up[1] - 16 });
      const lr = (-90 - sweep) * Math.PI / 180; set('.ann-r', { x1: bk[0] + 4 * Math.cos(lr), y1: bk[1] + 4 * Math.sin(lr), x2: bk[0] + 16 * Math.cos(lr), y2: bk[1] + 16 * Math.sin(lr) });
      q('.ann-arc').setAttribute('d', `M${up[0].toFixed(1)} ${up[1].toFixed(1)}A${R} ${R} 0 0 0 ${bk[0].toFixed(1)} ${bk[1].toFixed(1)}`);
      q('.ann-lb').textContent = Math.round(val) + n.unit; set('.ann-lb', { x: bk[0] - 22 * Math.cos(lr + Math.PI / 2) - 10, y: bk[1] - 22 * Math.sin(lr + Math.PI / 2) + 4 });
      // lumbar and side-bolster outlines on the backrest
      w.classList.toggle('bk-zone', (S.mode || 'cush') === 'back');
      w.querySelector('.ov-lum').classList.toggle('on', S.last === 'lumbar'); w.classList.toggle('bol-focus', (S.mode || 'cush') === 'back' && S.last === 'bolster');
      w.querySelector('.ov-lum .ov-l').style.transform = `translateX(${(v.lumbar - 50) * .08}px)`;
      const bx = (v.bolster / 100 * 6).toFixed(1); w.querySelector('.bi-l').style.transform = `translateX(${bx}px)`; w.querySelector('.bi-r').style.transform = `translateX(${-bx}px)`; }
        q('.ss-leg').style.transform = `translateX(${(v.ext || 0) * .25}px) rotate(${-(v.leg || 0)}deg)`;
    
    
    const M = ADJ[S.mode || 'cush'];
    w.querySelectorAll('[data-adjmode]').forEach(x => x.classList.toggle('on', x.dataset.adjmode === (S.mode || 'cush')));
    w.querySelectorAll('.sv-part').forEach(p => p.classList.toggle('act', M.parts.includes(p.dataset.part)));
    // controls live under the drawing as − value + steppers (built once per mode, values refreshed every paint)
    const mode = S.mode || 'cush';
    if (w._ndMode !== mode) {
      w._ndMode = mode;
      q('.st-read').innerHTML = M.nodes.map(n => `<div class="stp" data-stp="${n.k}"><span class="stp-l">${n.label}</span><div class="stp-c"><b class="stp-b" data-adj="${n.k}|-1" data-tap aria-label="Less"><svg viewBox="0 0 20 20"><path d="M5 10h10"/></svg></b><span class="stp-v num"></span><b class="stp-b" data-adj="${n.k}|1" data-tap aria-label="More"><svg viewBox="0 0 20 20"><path d="M5 10h10M10 5v10"/></svg></b></div></div>`).join('');
    }
    q('.st-read').querySelectorAll('[data-stp]').forEach(d => { const n = M.nodes.find(x => x.k === d.dataset.stp); d.querySelector('.stp-v').textContent = Math.round(v[n.k]) + n.unit; d.classList.toggle('on', S.last === n.k); });
    // the big readout shows the control you touched last (backrest angle by default)
    { const md0 = ADJ[S.mode || 'cush'], n = md0.nodes.find(x => x.k === S.last) || md0.nodes[0];
      q('.ann-t').textContent = Math.round(v[n.k]) + (n.unit.trim() === '°' ? '°' : n.unit);
      const ZN = { head: 'Headrest', back: 'Backrest', cush: 'Seat', leg: 'Thigh support' }, zk = Object.keys(ADJ).find(z => ADJ[z].nodes.includes(n));
      q('.ann-s').textContent = /^(Height|Tilt|Recline|Length|Angle)$/.test(n.label) ? ZN[zk] + ' ' + n.label.toLowerCase() : n.label; }
    // one-touch cards differ for front and rear seats
    { const front = [['drive', 'directions_car', 'Drive', 'Upright and supported'], ['relax', 'weekend', 'Relax', S.sel === 'Driver' ? 'Reclines to 36° · when parked' : 'Reclines to 36°'], ['entry', 'sensor_door', 'Easy entry', S.easy === false ? 'Off' : 'Slides back when a door opens']];
      const rearM = [['work', 'laptop_mac', 'Work', 'Upright for a laptop'], ['lounge', 'chair', 'Lounge', '32°, thigh support out'], ['sleep', 'bedtime', 'Sleep', '45°, fully extended']];
      if (S.sel === 'Rear right') rearM.push(['exec', 'airline_seat_flat', 'Executive', 'Passenger seat moves forward']);
      else rearM.push(['child', 'child_care', 'Child seat', 'Upright, heat and massage off']);
      if (S.sel === 'Driver') front.push(['rest', 'self_improvement', 'Rest stop', 'Full recline, warm, gentle massage · parked']);
      else { front[0] = ['drive', 'event_seat', 'Upright', 'Upright and supported']; front.push(['child', 'child_care', 'Child seat', 'Moves forward for a rear child seat']); }
      if (S.easy === undefined) S.easy = true;
      const list = rear ? rearM : front, key = S.sel + list.length;
      if (w._modesKey !== key) { w._modesKey = key; q('.st-modes').innerHTML = list.map(([k, i, n, s]) => `<div class="st-mode" data-seatmode="${k}" data-tap><span class="ms">${i}</span><b>${n}</b><span class="bs">${s}</span></div>`).join(''); }
      q('.st-modes').querySelectorAll('.st-mode').forEach(c => { if (c.dataset.seatmode === 'entry') { c.classList.toggle('on', !!S.easy); c.querySelector('.bs').textContent = S.easy ? 'Body lowers 50 mm, seat slides back' : 'Off'; } }); }
    // massage: programme, areas, intensity and speed all show in the live preview
    { const on = !!v.mass, prog = v.mprog || 'wave', zones = v.mzones || 'uml', mi = v.mint > 3 ? 2 : (v.mint || 2), sp = v.mspd > 3 ? 2 : (v.mspd || 2);
      const mc = q('.ms-card'); mc.classList.toggle('off', !on);
      mc.querySelectorAll('[data-mprog]').forEach(c => c.classList.toggle('on', c.dataset.mprog === prog));
      mc.querySelectorAll('[data-mint]').forEach(c => c.classList.toggle('on', +c.dataset.mint === mi));
      mc.querySelectorAll('[data-mspd]').forEach(c => c.classList.toggle('on', +c.dataset.mspd === sp));
      mc.querySelectorAll('[data-mzone]').forEach(z => z.classList.toggle('sel', zones.includes(z.dataset.mzone)));
      mc.style.setProperty('--mdur', [0, 3.2, 2, 1.1][sp] + 's'); mc.style.setProperty('--mamp', [0, .7, 1, 1.35][mi]); mc.style.setProperty('--mop', [0, .45, .7, .95][mi]);
      const an = q('.ms-anim');
      if (an.dataset.p !== prog) { an.dataset.p = prog; an.innerHTML = {
          wave: '<ellipse class="ma ma-wave" cx="60" cy="40" rx="40" ry="16"/>',
          shoulder: '<circle class="ma ma-sh1" cx="40" cy="42" r="15"/><circle class="ma ma-sh2" cx="80" cy="42" r="15"/>',
          lower: '<circle class="ma ma-lo1" cx="42" cy="178" r="15"/><circle class="ma ma-lo2" cx="78" cy="178" r="15"/>',
          stone: [[40, 36], [80, 36], [40, 80], [80, 80], [40, 124], [80, 124], [40, 168], [80, 168]].map(([x, y], i) => `<circle class="ma ma-st" style="--i:${i}" cx="${x}" cy="${y}" r="8"/>`).join(''),
          stretch: '<rect class="ma ma-str" x="20" y="14" width="80" height="16" rx="8"/>' }[prog]; }
      const nm = { wave: 'Wave', shoulder: 'Shoulders', lower: 'Lower back', stone: 'Hot stone', stretch: 'Stretch' }[prog], zn = { u: 'upper', m: 'middle', l: 'lower' };
      q('.ms-s').textContent = on ? `${nm} · ${['', 'gentle', 'medium', 'strong'][mi]} · ${[...zones].map(z => zn[z]).join(', ')}` : 'Off'; }
  }
  // four zones (industry naming): seat cushion, backrest, headrest, leg rest
  // four parts of Adi's seat: headrest, backrest, seat cushion, thigh support
  // real-world ranges. Backrest angle is measured from vertical, as Mercedes and NIO quote it:
  // front seats 19–40°, rear Executive seats 19–45° (ET9 rear backrest up to 45°, S-Class Executive 43.5°)
  const ADJ = {
    head: { parts: ['head'], nodes: [{ k: 'headh', label: 'Height', unit: ' mm', st: 5 }, { k: 'headt', label: 'Tilt', unit: ' mm', st: 2 }] },
    back: { parts: ['back'], nodes: [{ k: 'recline', label: 'Recline', unit: '°', st: 1 }, { k: 'lumbar', label: 'Lumbar support', unit: ' %', st: 10 }, { k: 'bolster', label: 'Side bolsters', unit: ' %', st: 10 }] },
    cush: { parts: ['cush'], nodes: [{ k: 'fore', label: 'Fore and aft', unit: ' mm', st: 10 }, { k: 'height', label: 'Seat height', unit: ' mm', st: 5 }, { k: 'tilt', label: 'Cushion tilt', unit: '°', st: 1 }] },
    leg: { parts: ['leg'], nodes: [{ k: 'ext', label: 'Length', unit: ' mm', st: 5 }, { k: 'leg', label: 'Angle', unit: '°', st: 1 }] } };
  const LIM = {
    front: { headh: [0, 60], headt: [0, 20], recline: [19, 40], lumbar: [0, 100], bolster: [0, 100], fore: [0, 260], height: [0, 60], tilt: [-2, 5], ext: [0, 60], leg: [0, 12] },
    rear:  { headh: [0, 60], headt: [0, 20], recline: [19, 45], lumbar: [0, 100], bolster: [0, 100], fore: [0, 120], height: [0, 30], tilt: [0, 8], ext: [0, 100], leg: [0, 40] } };
  const limOf = (seat, k) => LIM[seat.startsWith('Rear') ? 'rear' : 'front'][k];
  function stAdjust(w, k, sgn) {
    const S = stOf(w);
    const n = Object.values(ADJ).flatMap(m => m.nodes).find(x => x.k === k); if (!n) return;
    const v = S.s[S.sel], [lo, hi] = limOf(S.sel, k), d = sgn * n.st, nv = Math.max(lo, Math.min(hi, v[k] + d));
    if (nv === v[k]) return false; v[k] = nv; S.last = k; stPaint(w); tick('soft'); return true;
  }
  let adjHold = null;
  document.addEventListener('pointerdown', e => { const a = e.target.closest('[data-adj]'); if (!a) return; e.preventDefault();
    const w = a.closest('.st-wrap'), [k, s] = a.dataset.adj.split('|'); stAdjust(w, k, +s); suppressAdjClick = true;
    adjHold = setTimeout(function rep() { stAdjust(w, k, +s); adjHold = setTimeout(rep, 110); }, 420); });
  ['pointerup', 'pointercancel', 'pointerleave'].forEach(ev => document.addEventListener(ev, () => { clearTimeout(adjHold); adjHold = null; }));
  let suppressAdjClick = false;
  function stSet(w, changes, msg) { const S = stOf(w); Object.entries(changes).forEach(([n, c]) => Object.assign(S.s[n], c)); stPaint(w); if (msg) toast(frameOf(w), msg); }
  function seatClick(t) {
    const w = t.closest('.st-wrap'); if (!w) return false; const S = stOf(w);
    const pk = t.closest('[data-seatpick]'); if (pk) { S.sel = pk.dataset.seatpick; S.node = null; S.last = null; w._ndMode = null; stPaint(w); return true; }
    if (t.closest('[data-adj]')) { suppressAdjClick = false; return true; }
    const mp = t.closest('[data-mprog]'); if (mp) { S.s[S.sel].mprog = mp.dataset.mprog; if (!S.s[S.sel].mass) S.s[S.sel].mass = true; stPaint(w); return true; }
    const mi = t.closest('[data-mint]'); if (mi) { S.s[S.sel].mint = +mi.dataset.mint; stPaint(w); return true; }
    const msp = t.closest('[data-mspd]'); if (msp) { S.s[S.sel].mspd = +msp.dataset.mspd; stPaint(w); return true; }
    const mz = t.closest('[data-mzone]'); if (mz) { let z = S.s[S.sel].mzones || 'uml'; z = z.includes(mz.dataset.mzone) ? z.replace(mz.dataset.mzone, '') : z + mz.dataset.mzone; S.s[S.sel].mzones = z || mz.dataset.mzone; stPaint(w); return true; }
    const lk = t.closest('[data-seatlook]'); if (lk) { w.classList.toggle('sv-sil', lk.dataset.seatlook === 'sil'); lk.parentElement.querySelectorAll('div').forEach(x => x.classList.toggle('on', x === lk)); return true; }
    const am = t.closest('[data-adjmode]'); if (am) { S.mode = am.dataset.adjmode; S.node = null; stPaint(w); return true; }
    const nd = t.closest('[data-node]'); if (nd) { S.node = S.node === nd.dataset.node ? null : nd.dataset.node; stPaint(w); return true; }
    const o = t.closest('[data-seatopt] span'); if (o) { S.s[S.sel][o.parentElement.dataset.seatopt] = o.textContent; stPaint(w); return true; }
    const tg = t.closest('[data-seattog]'); if (tg) { const k = tg.dataset.seattog; S.s[S.sel][k] = !S.s[S.sel][k]; stPaint(w); return true; }
    const md = t.closest('[data-seatmode]');
    if (md) {
      const k = md.dataset.seatmode, n = S.sel, rear = n.startsWith('Rear'), f = frameOf(w);
      S.last = 'recline';
      if (k === 'entry') { S.easy = !S.easy; stPaint(w); toast(f, S.easy ? 'Easy entry on · seat slides back when the door opens' : 'Easy entry off'); return true; }
      if (k === 'relax' && n === 'Driver' && !parked(w)) { toast(f, 'Relax is available for the driver seat when parked'); return true; }
      const P = { drive: [{ recline: 25, tilt: 0, ext: 0, leg: 0, headh: 30, headt: 10 }, 'Drive · upright and supported'],
        relax: [{ recline: 36, tilt: 4, ext: 40, leg: 8, headt: 14 }, `Relax · ${n.toLowerCase()} reclined to 36°`],
        work: [{ recline: 19, tilt: 0, ext: 0, leg: 0, headh: 30, headt: 10 }, 'Work · upright for a laptop'],
        lounge: [{ recline: 32, tilt: 4, ext: 50, leg: 18, headt: 12 }, 'Lounge · 32°, thigh support out'],
        sleep: [{ recline: 45, tilt: 8, ext: 100, leg: 6, headt: 14, heat: '1', mass: true, mprog: 'wave', mint: 1, mspd: 1 }, 'Sleep · 45°, gentle massage, wakes you on arrival'],
        exec: [{ recline: 45, tilt: 8, ext: 100, leg: 6, headt: 14 }, 'Executive · passenger seat forward, rear right reclined to 135°'],
        rest: [{ recline: 40, tilt: 5, ext: 60, leg: 12, headt: 14, heat: '1', vent: 'Off', mass: true, mprog: 'wave', mint: 1, mspd: 1 }, 'Rest stop · reclined, warm, gentle massage'],
        child: rear ? [{ recline: 22, tilt: 0, ext: 0, leg: 0, heat: 'Off', vent: 'Off', mass: false }, 'Child seat · upright, heat and massage off']
                    : [{ fore: 230, recline: 22, heat: 'Off', vent: 'Off', mass: false }, 'Child seat · passenger seat forward, heat and massage off'] };
      const [ch, msg] = P[k]; const changes = { [n]: ch };
      if (k === 'exec') changes.Passenger = { fore: 260, recline: 19, headh: 0 };
      stSet(w, changes, msg); w._modeOn = k; stPaint(w);
      return true;
    }
    const mem = t.closest('[data-seatmem]'); if (mem) { const key = (w.querySelector('.drv-n') || {}).textContent + mem.dataset.seatmem; w.querySelectorAll('[data-seatmem]').forEach(x => x.classList.toggle('on', x === mem));
      if (S.mem[key]) { Object.assign(S.s.Driver, S.mem[key]); S.sel = 'Driver'; stPaint(w); toast(frameOf(w), `Memory ${mem.dataset.seatmem} restored`); } else toast(frameOf(w), `Memory ${mem.dataset.seatmem} is empty · tap Save to store this position`); return true; }
    if (t.closest('[data-seatsave]')) { const on = w.querySelector('[data-seatmem].on'), key = (w.querySelector('.drv-n') || {}).textContent + on.dataset.seatmem; S.mem[key] = { ...S.s.Driver }; toast(frameOf(w), `Saved to memory ${on.dataset.seatmem} for ${w.querySelector('.drv-n').textContent}`); return true; }
    return false;
  }
  function seatSlider(sl) { const w = sl.closest('.st-wrap'); if (!w) return; const S = stOf(w), lo = +sl.dataset.min, hi = +sl.dataset.max, st = +(sl.dataset.step || 1);
    S.s[S.sel][sl.dataset.seatk] = Math.round((lo + (hi - lo) * parseFloat(sl.style.getPropertyValue('--v')) / 100) / st) * st; stPaint(w); }
  document.querySelectorAll('.st-wrap').forEach(stPaint);

  /* ---------- Parking app: suggest → compare → time → confirm → booked ---------- */
  const GAR = [['Parking Trois Glands', 2.40], ['Kirchberg Shopping', 1.80], ['Parking Coque', 1.20]];
  function pPaint(pf) {
    const [name, rate] = GAR[+pf.dataset.g], at = pf.dataset.at, h = parseInt(pf.dataset.dur) + (+pf.dataset.ext || 0);
    const [hh, mm] = at.split(':').map(Number), end = `${String((hh + h) % 24).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
    const set = (k, v) => pf.querySelectorAll(`[data-pv="${k}"]`).forEach(x => x.textContent = v);
    set('name', name); set('until', end); set('span', `${at} – ${end}`); set('total', '€' + (rate * h).toFixed(2));
  }
  /* step 2 map: Mudam and the three garages on the real OpenStreetMap data (positions of Coque and Kirchberg Shopping approximate) */
  const PPIN = [[445, -420], [835, -560], [640, -545]];
  function pMap(pf) {
    const host = pf.querySelector('.pmap'), M = window.LUXMAP; if (!host || host.firstChild || !M) return; const L = M.L;
    const pin = (k, [x, y]) => { const [n, r] = GAR[k]; const rec = k === 0;
      return `<g class="ppin${rec ? ' rec' : ''}" data-pgo="3" data-pset="g|${k}" data-f="${pf.querySelectorAll('[data-f]')[k]?.dataset.f || ''}" data-tap transform="translate(${x} ${y})"><rect x="-15" y="-15" width="30" height="30" rx="9"/><text y="6" text-anchor="middle" class="pp-p">P</text><text x="22" y="-3" class="pp-n">${n.replace('Parking ', '')}</text><text x="22" y="13" class="pp-s">€${r.toFixed(2)}/h</text></g>`; };
    host.innerHTML = `<svg viewBox="330 -610 640 215" preserveAspectRatio="xMidYMid slice">
      <rect x="0" y="-1000" width="1400" height="1000" fill="var(--map-land)"/>
      <path d="${L.g}" fill="var(--map-green)"/><path d="${L.park}" fill="var(--map-park)"/><path d="${L.w}" fill="var(--map-water)"/><path d="${L.b}" fill="var(--map-bldg)"/>
      <g fill="none" stroke-linecap="round" stroke-linejoin="round" stroke="var(--map-road)"><path d="${L.r6}" stroke-width="2.2"/><path d="${L.r5}" stroke-width="2.6"/><path d="${L.r4}" stroke-width="4"/><path d="${L.r3}" stroke-width="6"/><path d="${L.r2}" stroke-width="7.6"/><path d="${L.r1}" stroke-width="9.2"/></g>
      <g class="pmud" transform="translate(436 -455)"><circle r="11"/><text x="-16" y="5" text-anchor="end">Mudam</text></g>
      ${PPIN.map((p, k) => pin(k, p)).join('')}</svg>`;
  }
  function pParkStep(pf, n) {   /* show step n, fill the stepper, keep the booking pane in step */
    if (+n === 2) pMap(pf);
    pf.dataset.cur = n; pf.querySelectorAll('.pst').forEach(s => s.classList.toggle('on', s.dataset.st === String(n)));
    pf.querySelectorAll('.pstep [data-i]').forEach(d => { d.classList.toggle('done', +d.dataset.i < +n); d.classList.toggle('on', +d.dataset.i === +n); });
    const st = pf.querySelector('.pside-st'); if (st) { st.textContent = +n >= 5 ? 'Booked · Level −2 · Bay 14' : 'Not booked yet'; st.classList.toggle('ok', +n >= 5); }
  }
  window.nioParkOpen = (fr, n) => { openApp(fr, 'Parking'); const pf = fr.querySelector('[data-screen="appview"] .pflow'); if (pf) { pPaint(pf); pParkStep(pf, n); } };
  function pClick(t) {
    const pf = t.closest('.pflow'); if (!pf) return false;
    const fl = t.closest('[data-pfil]');
    if (fl) { if (!fl.classList.contains('lock')) fl.classList.toggle('on');   /* filters: only garages that have every ticked feature */
      const need = [...pf.querySelectorAll('[data-pfil].on:not(.lock)')].map(x => x.dataset.pfil);
      pf.querySelectorAll('[data-f]').forEach(r => r.style.display = need.every(n => r.dataset.f.split(' ').includes(n)) ? '' : 'none'); return true; }   /* pins on the map hide too */
    const ps = t.closest('[data-pset]'), pg = t.closest('[data-pgo]');
    if (!ps && !pg && !t.closest('[data-pext]')) return false;
    if (ps) {
      const [k, v] = ps.dataset.pset.split('|'); pf.dataset[k] = v;
      if (ps.parentElement.classList.contains('pchips')) [...ps.parentElement.children].forEach(c => c.classList.toggle('on', c === ps));
    }
    if (t.closest('[data-pext]')) { pf.dataset.ext = (+pf.dataset.ext || 0) + 1; toast(frameOf(pf), 'Booking extended by 1 hour'); }
    if (pg) {
      if (pg.hasAttribute('data-pcancel')) { pf.dataset.ext = 0; toast(frameOf(pf), 'Booking cancelled · refunded to saved payment method'); }
      pParkStep(pf, pg.dataset.pgo);
    }
    pPaint(pf); return true;
  }

  /* ---------- 2048 ---------- */
  function g2048New(w) {
    if (!w) return; w._b = Array(16).fill(0); w._sc = 0; g2048Add(w); g2048Add(w); g2048Draw(w);
    w.querySelector('.g-s').textContent = 'Swipe on the board or use the arrows.';
    const b = w.querySelector('.b2048');
    if (!b._sw) { b._sw = 1; let sx, sy;
      b.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; });
      b.addEventListener('pointerup', e => { if (sx == null) return; const dx = e.clientX - sx, dy = e.clientY - sy; sx = null; if (Math.max(Math.abs(dx), Math.abs(dy)) < 24) return; g2048Move(w, Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up')); }); }
  }
  function g2048Add(w) { const e = w._b.map((v, i) => v ? -1 : i).filter(i => i >= 0); if (e.length) w._b[e[Math.floor(Math.random() * e.length)]] = Math.random() < .9 ? 2 : 4; }
  function g2048Draw(w, fresh) {
    const prev = w._prev || []; w.querySelector('.b2048').innerHTML = w._b.map((v, i) => `<i class="t${Math.min(v, 4096)}${v && !prev[i] ? ' pop' : v && prev[i] && v > prev[i] ? ' merge' : ''}">${v || ''}</i>`).join(''); w._prev = w._b.slice();
    w.querySelector('.g-score').textContent = 'Score ' + w._sc;
  }
  function g2048Move(w, dir) {
    if (!w._b) return;
    const idx = (r, c) => dir === 'left' ? r * 4 + c : dir === 'right' ? r * 4 + 3 - c : dir === 'up' ? c * 4 + r : (3 - c) * 4 + r;
    let moved = false;
    for (let r = 0; r < 4; r++) {
      const line = [0, 1, 2, 3].map(c => w._b[idx(r, c)]).filter(Boolean), out = [];
      for (let i = 0; i < line.length; i++) { if (line[i] === line[i + 1]) { out.push(line[i] * 2); w._sc += line[i] * 2; i++; } else out.push(line[i]); }
      while (out.length < 4) out.push(0);
      out.forEach((v, c) => { if (w._b[idx(r, c)] !== v) moved = true; w._b[idx(r, c)] = v; });
    }
    if (moved) g2048Add(w); g2048Draw(w);
    const s = w.querySelector('.g-s');
    if (w._b.includes(2048)) s.textContent = 'You made 2048. Keep going?';
    else if (!w._b.includes(0) && ![0, 1, 2, 3].some(r => [0, 1, 2].some(c => w._b[r * 4 + c] === w._b[r * 4 + c + 1] || w._b[c * 4 + r] === w._b[(c + 1) * 4 + r]))) s.textContent = 'No moves left. Start a new game.';
  }

  /* ---------- Minesweeper (9 × 9, 10 mines, first tap is always safe) ---------- */
  function minesNew(w) {
    if (!w) return; w._m = null; w._open = 0; w._over = false; w._fl = 0;
    w.querySelector('.bmines').innerHTML = Array.from({ length: 81 }, (_, k) => `<i data-mk="${k}" data-tap></i>`).join('');
    w.querySelector('.m-left').textContent = '10 mines'; w.querySelector('.m-s').textContent = 'Tap to reveal. Hold, or switch to Flag, to mark a mine.';
    const b = w.querySelector('.bmines');
    if (!b._lp) { b._lp = 1; let tm;
      b.addEventListener('pointerdown', e => { const c = e.target.closest('[data-mk]'); if (!c) return; tm = setTimeout(() => { tm = null; c._held = true; minesFlag(w, c); }, 450); });
      ['pointerup', 'pointerleave'].forEach(ev => b.addEventListener(ev, () => { if (tm) clearTimeout(tm); tm = null; })); }
  }
  const nb = k => { const r = Math.floor(k / 9), c = k % 9, o = []; for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const R = r + dr, C = c + dc; if ((dr || dc) && R >= 0 && R < 9 && C >= 0 && C < 9) o.push(R * 9 + C); } return o; };
  function minesFlag(w, c) {
    if (w._over || c.classList.contains('op')) return;
    c.classList.toggle('fl'); c.innerHTML = c.classList.contains('fl') ? '<span class="ms f">flag</span>' : '';
    w._fl += c.classList.contains('fl') ? 1 : -1; w.querySelector('.m-left').textContent = `${10 - w._fl} mines`;
  }
  function minesTap(c) {
    const w = c.closest('.gamewrap'); if (c._held) { c._held = false; return; }
    if (w._over) return;
    if (w.querySelector('.m-mode .on').textContent.includes('Flag')) { minesFlag(w, c); return; }
    if (c.classList.contains('fl')) return;
    const k = +c.dataset.mk;
    if (!w._m) { const safe = new Set([k, ...nb(k)]); w._m = new Set(); while (w._m.size < 10) { const r = Math.floor(Math.random() * 81); if (!safe.has(r)) w._m.add(r); } }
    const cells = w.querySelectorAll('.bmines i');
    if (w._m.has(k)) {
      w._over = true; w._m.forEach(m => { cells[m].classList.add('mine'); cells[m].innerHTML = '<span class="ms f">brightness_7</span>'; }); c.classList.add('boom');
      w.querySelector('.m-s').textContent = 'Mine. Start a new game to try again.'; return;
    }
    const stack = [k];
    while (stack.length) {
      const q = stack.pop(), el = cells[q]; if (el.classList.contains('op') || el.classList.contains('fl')) continue;
      const n = nb(q).filter(x => w._m.has(x)).length; el.classList.add('op', 'n' + n); el.textContent = n || ''; w._open++;
      if (!n) nb(q).forEach(x => stack.push(x));
    }
    if (w._open === 71) { w._over = true; w.querySelector('.m-s').textContent = 'Cleared. Well played.'; }
  }

  /* ---------- router (prototype): bottom bar + gear switch screens ---------- */
  const NAMES = { media: 'Media', phone: 'Phone', apps: 'Apps' };
  function route(fr, to) {
    if (!fr) return;
    let arg = null;
    if (to.includes(':')) { [to, arg] = to.split(':'); }
    let scr = fr.querySelector(`[data-screen="${to}"]`);
    if (!scr) return;
    fr.querySelectorAll('.scr').forEach(s => s.classList.toggle('on', s === scr));
    fr.dataset.scr = to;   // lets the side pane adapt (Media hides the battery card so the cover can grow)
    fr.querySelectorAll('.dock .dk[data-go]').forEach(d => d.classList.toggle('on', d.dataset.go === to));
    const nav = to === 'nav';
    fr.querySelectorAll('[data-ctx="nav"]').forEach(c => c.style.display = nav ? '' : 'none');
    fr.querySelectorAll('[data-ctx="other"]').forEach(c => c.style.display = nav ? 'none' : '');
    if (arg !== null && scr) {
      if (/^\d+$/.test(arg)) { const seg = scr.querySelector('[data-tabs]'); if (seg) seg.children[+arg].click(); }
      else { const it = [...scr.querySelectorAll('.snav div')].find(d => d.textContent.includes(arg)); if (it) it.click(); }
    }
  }
  const TABDOCK = { appview: 'apps' };
  function openApp(fr, name) {
    const scr = fr.querySelector('[data-screen="appview"]'), tpl = fr.querySelector(`template[data-appc="${name}"]`);
    scr.querySelector('.av-t').textContent = name;
    const c = scr.querySelector('.av-c'); c.innerHTML = ''; if (tpl) c.appendChild(tpl.content.cloneNode(true));
    route(fr, 'appview');
    fr.querySelectorAll('.dock .dk[data-go]').forEach(d => d.classList.toggle('on', d.dataset.go === 'apps'));
    if (window.nioLive) window.nioLive();
    const gw = c.querySelector('.gamewrap');
    if (name === 'Chess') chessNew(gw);
    if (name === 'Sudoku') suNew(gw);
    if (name === 'Trivia') tvNext(c.querySelector('.trivia'));
    if (name === '2048') g2048New(gw);
    if (name === 'Calendar') calInit(c.querySelector('.calw'));
    if (name === 'Parking') { const pf = c.querySelector('.pflow'); if (pf) { pPaint(pf); pParkStep(pf, 1); } }
    if (name === 'Weather') weatherCities(c);
    if (name === 'Minesweeper') minesNew(gw);
    if (name === 'YouTube') { const box = c.querySelector('.ytbox'); if (isParked(fr)) { box.classList.add('playing'); loadYT(box, c.querySelector('[data-yt].on').dataset.yt); } }
  }

  /* ---------- sliders (progress + volume, volume synced per frame) ---------- */
  function setVol(fr, pct) {
    fr.querySelectorAll('[data-sync="vol"]').forEach(s => { s.style.setProperty('--v', pct + '%'); const o = s.parentElement.querySelector('.val'); if (o) o.textContent = pct + ' %'; });
    fr.querySelectorAll('.vol .ms, .dvol .ms').forEach(i => i.textContent = pct === 0 ? 'volume_off' : pct < 40 ? 'volume_down' : 'volume_up');
  }
  let drag = null;
  document.addEventListener('pointerdown', e => {
    const s = e.target.closest('.sl'); if (!s) return;
    drag = { s, last: -1 }; s.classList.add('drag'); s.setPointerCapture && s.setPointerCapture(e.pointerId); move(e);
  });
  document.addEventListener('pointermove', e => { if (drag) move(e); });
  document.addEventListener('pointerup', () => { if (drag) { drag.s.classList.remove('drag'); drag = null; } });
  function move(e) {
    const r = drag.s.getBoundingClientRect();
    const pct = Math.round(Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * 100);
    const step = Math.floor(pct / 10); if (step !== drag.last) { if (drag.last !== -1 && frameVol(frameOf(drag.s)) > 0) tick('soft'); drag.last = step; }
    if (drag.s.dataset.sync === 'vol') setVol(frameOf(drag.s), pct);
    else if (drag.s.hasAttribute('data-bright')) {
      drag.s.style.setProperty('--v', pct + '%');
      brightApply(frameOf(drag.s), pct);
    }
    else if (drag.s.dataset.min !== undefined) {
      let pct2 = pct; const fl = +drag.s.dataset.floor || 0;
      if (pct2 < fl) { pct2 = fl; if (!drag.s._fl) { drag.s._fl = 1; toast(frameOf(drag.s), `Safety chimes stay at ${fl} % or louder`); setTimeout(() => drag.s && (drag.s._fl = 0), 2500); } }
      if (pct2 !== pct) { drag.s.style.setProperty('--v', pct2 + '%'); const o = drag.s.parentElement.querySelector('.val'); if (o) o.textContent = pct2 + ' %'; return; }
      if (drag.s.hasAttribute('data-touchvol')) { tapK = pct / 40; muted = pct === 0; paintSound(); }
      if (drag.s.dataset.spk || drag.s.dataset.stage) { const sl = drag.s; setTimeout(() => sfSlider(sl), 0); }
      if (drag.s.dataset.seatk) { const sl = drag.s; setTimeout(() => seatSlider(sl), 0); }
      drag.s.style.setProperty('--v', pct + '%');
      const lo = +drag.s.dataset.min, hi = +drag.s.dataset.max, st = +(drag.s.dataset.step || 1);
      const v = Math.round((lo + (hi - lo) * pct / 100) / st) * st;
      const out = drag.s.parentElement.querySelector('.val');
      if (out) out.textContent = (lo < 0 && v > 0 ? '+' : '') + v + (drag.s.dataset.unit || '');
    }
    else {
      drag.s.style.setProperty('--v', pct + '%');
      const p = drag.s.closest('.player'); if (p) { p._pos = Math.round(p._dur * pct / 100); paintTime(p); }
    }
  }

  /* ---------- player ---------- */
  const fmt = s => s >= 3600 ? `${Math.floor(s / 3600)}:${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` : `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
  function paintTime(p) {
    const c = p.querySelector('.p-cur'); if (c) c.textContent = fmt(p._pos);
    const d = p.querySelector('.p-dur'); if (d) d.textContent = fmt(p._dur);
    p.querySelectorAll('.p-prog').forEach(s => s.style.setProperty('--v', (100 * p._pos / p._dur).toFixed(2) + '%'));
    drawTape(p);
  }
  // vintage tape: two reels joined by tape over guide rollers and a head; deck spans the cover width
  const HUB = '<circle r="9" fill="#fff" stroke="#c9c4dc" stroke-width="1.2"/><circle r="3" fill="#cfcae0"/><g stroke="#9b95b5" stroke-width="2" stroke-linecap="round"><path d="M0 -4V-8"/><path d="M3.5 2L7 4"/><path d="M-3.5 2L-7 4"/></g>';
  function drawTape(p) {
    const svg = p.querySelector('svg.tape'); if (!svg) return;
    const w = Math.round(svg.parentElement.offsetWidth || 300);
    if (p._tw !== w) {
      p._tw = w; svg.setAttribute('viewBox', `0 0 ${w} 64`);
      svg.innerHTML = `<rect x="1" y="1" width="${w - 2}" height="62" rx="12" fill="#e4e1ee"/><path class="tline" fill="none" stroke="#4b3f52" stroke-width="2" stroke-linejoin="round"/><circle class="pk-l" cx="40" cy="30" fill="#4b3f52"/><circle class="pk-r" cx="${w - 40}" cy="30" fill="#4b3f52"/><g transform="translate(40 30)"><g class="reel">${HUB}</g></g><g transform="translate(${w - 40} 30)"><g class="reel">${HUB}</g></g><circle cx="84" cy="56" r="3.5" fill="#fff" stroke="#9b95b5"/><circle cx="${w - 84}" cy="56" r="3.5" fill="#fff" stroke="#9b95b5"/><rect x="${w / 2 - 10}" y="54" width="20" height="8" rx="2" fill="#9b95b5"/>`;
    }
    const f = p._pos / p._dur, rl = 22 - 10 * f, rr = 12 + 10 * f;
    svg.querySelector('.pk-l').setAttribute('r', rl.toFixed(1));
    svg.querySelector('.pk-r').setAttribute('r', rr.toFixed(1));
    svg.querySelector(".tline").setAttribute('d', `M${(40 + rl * 0.45).toFixed(1)} ${(30 + rl * 0.89).toFixed(1)}L84 59.5L${w - 84} 59.5L${(w - 40 - rr * 0.45).toFixed(1)} ${(30 + rr * 0.89).toFixed(1)}`);
  }
  function setPlaying(p, on) {
    p.classList.toggle('playing', on);
    p.querySelectorAll('.play .ms').forEach(i => i.textContent = on ? 'pause' : 'play_arrow');
    const fr = p.closest('.frame'); if (!fr) return;
    if (on) fr.querySelectorAll('.ytbox.playing').forEach(b => { b.classList.remove('playing'); b.querySelector('iframe').src = 'about:blank'; });
    setTimeout(() => rowsPaint(fr), 0);
  }
  function rowsPaint(fr) {
    const cur = fr.querySelector('.player .h3'), ti = cur && cur.textContent, on = !!fr.querySelector('.ctx .player.playing, .player.playing');
    fr.querySelectorAll('.lrow[data-song]').forEach(r => { const me = r.dataset.song.split('|')[0] === ti, ic = [...r.querySelectorAll('.ms')].pop();
      r.classList.toggle('now', me); if (ic && /play_circle|pause_circle/.test(ic.textContent)) ic.textContent = me && on ? 'pause_circle' : 'play_circle'; });
    const F = fr._fav || (fr._fav = new Set());
    fr.querySelectorAll('.player .ms').forEach(h => { if (/^favorite$/.test(h.textContent.trim())) { h.classList.add('favb'); h.dataset.tap = ''; } });
    fr.querySelectorAll('.favb').forEach(h => h.classList.toggle('f', F.has(ti)));
  }
  const players = [...document.querySelectorAll('.player')];
  players.forEach(p => { p._dur = 367; p._pos = 148; paintTime(p); });
  window.addEventListener('load', () => players.forEach(p => { p._tw = 0; paintTime(p); }));
  setInterval(() => players.forEach(p => {
    if (!p.classList.contains('playing') || (drag && p.contains(drag.s))) return;
    p._pos = (p._pos + 1) % p._dur; paintTime(p);
  }), 1000);
  const reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;


  /* ---------- drive modes (values change per mode; Custom is editable and saved per driver) ---------- */
  const MODES = {
    Comfort: { Steering: 'Light', Suspension: 'Soft', Power: 'Smooth', Regeneration: 'Standard', Traction: 'Normal', d: 'Quiet and balanced. The default for city driving.' },
    Sport:   { Steering: 'Firm', Suspension: 'Firm', Power: 'Sharp', Regeneration: 'High', Traction: 'Sport', d: 'Quicker response and a tighter body. More energy use.' },
    Eco:     { Steering: 'Light', Suspension: 'Standard', Power: 'Gentle', Regeneration: 'High', Traction: 'Normal', d: 'Gentle power and strong regeneration for the most range.' },
    Snow:    { Steering: 'Light', Suspension: 'Soft', Power: 'Gentle', Regeneration: 'Low', Traction: 'Snow', d: 'Soft power delivery and low regeneration for grip on snow and ice.' },
  };
  const OPTS = { Steering: ['Light', 'Standard', 'Firm'], Suspension: ['Soft', 'Standard', 'Firm'], Power: ['Gentle', 'Smooth', 'Sharp'], Regeneration: ['Low', 'Standard', 'High'], Traction: ['Normal', 'Sport', 'Snow'] };
  const custom = { Emma: { Steering: 'Standard', Suspension: 'Soft', Power: 'Smooth', Regeneration: 'High', Traction: 'Normal' } };
  document.querySelectorAll('[data-modes]').forEach(root => {
    const driver = root.dataset.driver || 'Emma';
    const kv = root.querySelector('.kv'), cu = root.querySelector('.custom'), title = root.querySelector('.m-title'), desc = root.querySelector('.m-desc'), save = root.querySelector('.m-save'), toast = root.querySelector('.toast');
    const chip = root.querySelector('.status .chip') || (root.closest('.frame') || document).querySelector('.status .chip');
    function show(m) {
      root.querySelectorAll('.mode').forEach(x => x.classList.toggle('on', x.dataset.m === m));
      if (chip) chip.lastChild.textContent = m;
      title.textContent = m + (m === 'Custom' ? ' · ' + driver : ' changes');
      const isC = m === 'Custom';
      kv.style.display = isC ? 'none' : ''; cu.style.display = isC ? '' : 'none'; save.style.display = isC ? '' : 'none';
      if (isC) {
        const c = custom[driver];
        cu.innerHTML = Object.keys(OPTS).map(k => `<div><span>${k}</span><span class="opt" data-k="${k}">${OPTS[k].map(o => `<span class="${c[k] === o ? 'on' : ''}">${o}</span>`).join('')}</span></div>`).join('');
        desc.textContent = 'Your own mix, saved to ' + driver + '’s profile.';
      } else {
        const v = MODES[m];
        kv.querySelectorAll('b').forEach(b => {
          const nv = v[b.dataset.k];
          if (b.textContent !== nv) { b.textContent = nv; b.classList.remove('flash'); void b.offsetWidth; b.classList.add('flash'); setTimeout(() => b.classList.remove('flash'), 700); }
        });
        desc.textContent = v.d;
      }
    }
    root.addEventListener('click', e => {
      const m = e.target.closest('.mode'); if (m) { show(m.dataset.m); return; }
      if (e.target.closest('.m-save')) {
        cu.querySelectorAll('.opt').forEach(o => { custom[driver][o.dataset.k] = o.querySelector('.on').textContent; });
        toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 1800);
      }
    });
    show('Comfort');
  });

  /* ---------- blind-spot loop: indicator → cyclist → camera opens → 4 s → camera closes, music returns ---------- */
  document.querySelectorAll('[data-blindspot]').forEach(fr => {
    const p = fr.querySelector('.player');
    function cycle() {
      fr.classList.remove('bs-sig', 'bs-on'); p && p.classList.remove('compact');
      setTimeout(() => fr.classList.add('bs-sig'), 1800);
      setTimeout(() => { fr.classList.add('bs-on'); p && p.classList.add('compact'); }, 2600);
      setTimeout(() => { fr.classList.remove('bs-on'); p && p.classList.remove('compact'); }, 6600);
      setTimeout(() => fr.classList.remove('bs-sig'), 8200);
    }
    cycle(); if (!reduce) setInterval(cycle, 10500); else { fr.classList.add('bs-sig', 'bs-on'); p && p.classList.add('compact'); }
  });
  /* ---------- car view: 5 s loop, drive to the junction and turn right (heading-up) ---------- */
  document.querySelectorAll('.cv-world').forEach(w => {
    if (w.closest('[data-dash]')) return;   // driven by the dashboard timeline
    const app = w.closest('.app'), chipT = app && app.querySelector('.cv-chip-t');
    const ex = +w.dataset.ex, y0 = +w.dataset.y0, R = +w.dataset.r, Y = 440, D = Y - y0, A = Math.PI / 2 * R, V = 200, PX_M = 40;
    const pose = s => {
      if (s < D) return [ex, Y - s, 0];
      if (s < D + A) { const f = (s - D) / R; return [ex + R - R * Math.cos(f), y0 - R * Math.sin(f), f * 180 / Math.PI]; }
      return [ex + R + (s - D - A), y0 - R, 90];
    };
    const draw = s => { const [x, y, h] = pose(s); w.setAttribute('transform', `translate(${ex} ${Y}) rotate(${-h}) translate(${-x} ${-y})`);
      if (chipT) chipT.textContent = s < D ? `Lane 3 of 3 · turn right in ${Math.max(1, Math.round((D - s) / PX_M))} m` : 'Turning right';
    };
    let t0 = null;
    draw(0);
    if (reduce) return;
    function frame(ts) {
      if (!app.classList.contains('v-car')) { t0 = null; requestAnimationFrame(frame); return; }
      if (t0 === null) t0 = ts;
      const t = ((ts - t0) / 1000) % 5;
      draw(V * t);
      w.classList.toggle('fade', t > 4.55 || t < 0.05);
      requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  });

  /* ---------- Climate: 4 zones, airflow, air quality, comfort, fridge and tray table ---------- */
  const CZ = ['Driver', 'Passenger', 'Rear left', 'Rear right'];
  const clOf = fr => fr._cl || (fr._cl = { sel: 'Driver', t: { Driver: 21.5, Passenger: 21.5, 'Rear left': 22, 'Rear right': 22 }, fan: { Driver: 3, Passenger: 3, 'Rear left': 2, 'Rear right': 2 },
    vent: { Driver: [0, 0], Passenger: [0, 0], 'Rear left': [0, 0], 'Rear right': [0, 0] }, auto: true, ac: true, recirc: false, maxc: false, maxh: false, deff: false, defr: false,
    sync: false, lock: false, mode: 'both', pre: 7 * 60 + 45, fr: 4, frm: 'cool', frOn: true, tray: false, pur: true, pm: 14, keep: 'off', follow: false });
  const tShow = v => v <= 16 ? 'LO' : v >= 28 ? 'HI' : v.toFixed(1);
  const zColor = v => v < 20.5 ? '#9db6e8' : v > 23 ? '#eda57f' : v > 22 ? '#e8bfa4' : '#c3c0e4';
  const autoFan = (C, z) => Math.max(1, Math.min(7, Math.round(2 + Math.abs(C.t[z] - 21.5) * 1.2)));
  function clStep(fr, z, d) {
    const C = clOf(fr); C.maxc = C.maxh = false;
    const v = Math.max(16, Math.min(28, C.t[z] + d * 0.5));
    (C.sync ? CZ : [z]).forEach(k => { if (C.lock && k.startsWith('Rear') && k !== z) return; C.t[k] = v; });
    clFollow(fr); clPaint(fr);
  }
  function clFollow(fr) {
    const C = clOf(fr); if (!C.follow) return;
    const lvl = v => v >= 24 ? '2' : v >= 23 ? '1' : 'Off';
    const w = fr.querySelector('.st-wrap'); if (w) { const S = stOf(w); CZ.forEach(k => { S.s[k].heat = lvl(C.t[k]); if (S.s[k].heat !== 'Off') S.s[k].vent = 'Off'; }); stPaint(w); }
  }
  function clPaint(fr) {
    const C = clOf(fr), scr = fr.querySelector('.cl-pane'); if (!scr) return;
    const z = C.sel, fan = C.auto ? autoFan(C, z) : C.fan[z];
    fr.querySelectorAll('.dock .clim .t').forEach(el => el.textContent = tShow(C.t[el.closest('.clim').classList.contains('r') ? 'Passenger' : 'Driver']) + (C.t[el.closest('.clim').classList.contains('r') ? 'Passenger' : 'Driver'] > 16 && C.t[el.closest('.clim').classList.contains('r') ? 'Passenger' : 'Driver'] < 28 ? '°' : ''));
    const svg = scr.querySelector('.cz-svg');
    CZ.forEach((k, i) => {
      const col = zColor(C.t[k]), f = C.auto ? autoFan(C, k) : C.fan[k];
      svg.querySelector(`[data-czt="${k}"]`).textContent = tShow(C.t[k]) + (C.t[k] > 16 && C.t[k] < 28 ? '°' : '');
      svg.querySelectorAll(`#czg${i} stop`).forEach(s => s.style.setProperty('--zc', col));
      const tint = svg.querySelector(`[data-czg="${k}"]`); tint.style.opacity = Math.min(1, 0.25 + Math.abs(C.t[k] - 21.5) / 4);
      const fl = svg.querySelector(`[data-czf="${k}"]`); fl.style.setProperty('--zc', col); fl.style.setProperty('--fs', (2.6 - f * 0.28).toFixed(2) + 's'); fl.classList.toggle('off', !f);
      svg.querySelector(`[data-czone="${k}"]`).classList.toggle('on', k === z);
    });
    svg.classList.toggle('cl-locked', C.lock); svg.classList.toggle('cl-deff', C.deff); svg.classList.toggle('cl-defr', C.defr);
    scr.querySelector('.cl-zn').textContent = z; scr.querySelector('.cl-vz').textContent = z;
    const tv = scr.querySelector('.cl-t'); tv.textContent = tShow(C.t[z]); tv.style.color = C.t[z] < 20.5 ? '#3e5f9e' : C.t[z] > 22.5 ? '#a8532a' : '';
    scr.querySelector('.cl-u').style.opacity = C.t[z] > 16 && C.t[z] < 28 ? 1 : 0;
    fdPaint(scr.querySelector('.fd'), fan, C.auto);
    const heat = C.t[z] > 22.5 ? 'Heat pump · warming to ' : C.t[z] < 20.5 ? 'A/C · cooling to ' : 'Holding ';
    scr.querySelector('.cl-heat span').textContent = C.maxc ? 'Max cool · all zones' : C.maxh ? 'Max heat · all zones' : heat + tShow(C.t[z]) + (C.t[z] > 16 && C.t[z] < 28 ? '°' : '');
    scr.querySelector('.cl-dot').style.background = C.t[z] > 22.5 || C.maxh ? '#e2895c' : C.t[z] < 20.5 || C.maxc ? '#7fa1e0' : '#7fbf8e';
    ['auto', 'ac', 'recirc', 'maxc', 'maxh', 'deff', 'defr'].forEach(k => scr.querySelector(`[data-cl="${k}"]`).classList.toggle('on', !!C[k]));
    scr.querySelectorAll('[data-cltog]').forEach(g => g.classList.toggle('on', !!C[g.dataset.cltog]));
    scr.querySelectorAll('[data-clmode]').forEach(m => m.classList.toggle('on', m.dataset.clmode === (C.deff ? 'wind' : C.mode)));
    const [vx, vy] = C.vent[z], pad = scr.querySelector('.vent-pad'); pad.style.setProperty('--vx', vx); pad.style.setProperty('--vy', vy); pad.style.setProperty('--vxa', Math.abs(vx));
    fr.querySelectorAll('.dk[data-cldef]').forEach(d => d.classList.toggle('on', C.deff));
    const h = Math.floor(C.pre / 60), m = C.pre % 60; scr.querySelector('[data-clv="pre"]').textContent = String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    scr.querySelector('.cl-pre-tx').textContent = `Warms to ${tShow(C.t.Driver)}° from the grid while plugged in, so your range stays full.`;
    scr.querySelector('[data-clv="fr"]').textContent = C.fr + '°';
    const box = scr.querySelector('.fr-box'); box.dataset.frm = C.frOn ? C.frm : 'off';
    box.querySelector('.fr-t').textContent = C.frOn ? C.fr + '°' : 'Off'; box.querySelector('.fr-m').textContent = !C.frOn ? 'Fridge is off' : C.frm === 'cool' ? 'Cooling' : 'Warming';
    scr.querySelector('.cl-fridge').classList.toggle('off', !C.frOn);
    scr.querySelector('.tray-svg').classList.toggle('tray-out', C.tray);
    scr.querySelector('.tr-st').textContent = C.tray ? 'Table is out' : 'Folded away';
    { const aim = C.trayAim || 'c'; scr.querySelectorAll('[data-trayaim]').forEach(d => d.classList.toggle('on', d.dataset.trayaim === aim)); const tab = scr.querySelector('.tr-tab'); if (tab) tab.style.setProperty('--aim', ({ l: '-22deg', c: '0deg', r: '22deg' })[aim]); tab.style.setProperty('--tx', ({ l: '-18px', c: '0px', r: '18px' })[aim]); const sv = scr.querySelector('.tray-svg'); sv.classList.toggle('aim-l', aim === 'l'); sv.classList.toggle('aim-r', aim === 'r');
      const ar = scr.querySelector('.tr-aimrow'); if (ar) ar.classList.toggle('dim', !C.tray); }
    scr.querySelector('[data-cltray] span:last-child').textContent = C.tray ? 'Fold in' : 'Fold out';
    clAir(fr);
  }
  function clAir(fr) {
    const C = clOf(fr), scr = fr.querySelector('.cl-pane'); if (!scr) return;
    const pm = Math.round(C.pm), out = 22, col = v => v <= 12 ? '#7fbf8e' : v <= 35 ? '#e5b45a' : '#e07a5f';
    const a = scr.querySelector('[data-aq="in"]'), b = scr.querySelector('[data-aq="out"]');
    a.style.setProperty('--p', Math.min(100, pm * 2)); a.style.stroke = col(pm); b.style.setProperty('--p', Math.min(100, out * 2)); b.style.stroke = col(out);
    scr.querySelector('[data-aqv="in"]').textContent = pm; scr.querySelector('[data-aqv="out"]').textContent = out;
    scr.querySelector('.aq-st').textContent = pm <= 12 ? 'Excellent' : pm <= 35 ? 'Good' : 'Poor';
    scr.querySelector('.aq-tx').textContent = C.pur ? (pm <= 8 ? 'Purifier is holding the cabin clean. Filter at 86 %.' : 'Purifier is cleaning the cabin air…') : 'Purifier is off. Outside air comes in as it is.';
  }
  function clPurify(fr) {   // PM2.5 drifts down with the purifier, back up without it
    const C = clOf(fr); clearInterval(fr._clpi);
    fr._clpi = setInterval(() => { const goal = C.pur ? 5 : C.recirc ? 12 : 18; C.pm += (goal - C.pm) * 0.18; if (Math.abs(goal - C.pm) < 0.4) { C.pm = goal; clearInterval(fr._clpi); } clAir(fr); }, 400);
  }
  const KEEP = { off: 'Climate turns off when you lock the car.', pet: 'Holds 21° while you’re away and shows “My pet is fine” on the screen for passers-by.', camp: 'Keeps the cabin comfortable, lights and power on all night. Uses about 1 % of battery per hour.' };
  /* ---------- seat warm–cool: one control, Cool 3 … Off … Warm 3; quick panel from the bottom bar ---------- */
  const wcVal = s => s.heat !== 'Off' ? +s.heat : s.vent !== 'Off' ? -s.vent : 0;
  function wcPaint(fr) {
    const w = fr.querySelector('.st-wrap'); if (!w) return; const S = stOf(w);
    fr.querySelectorAll('.wc').forEach(c => { const n = c.dataset.wc === 'sel' ? S.sel : c.dataset.wc, v = wcVal(S.s[n]);
      c.querySelectorAll('[data-wcv]').forEach(i => { const x = +i.dataset.wcv; i.classList.toggle('on', v === 0 ? x === 0 : (v < 0 ? x < 0 && x >= v : x > 0 && x <= v)); i.classList.toggle('cur', x === v); });
      c.dataset.v = v < 0 ? 'cool' : v > 0 ? 'warm' : 'off';
      const st = c.querySelector('.wc-st'); if (st) st.textContent = v < 0 ? 'Ventilating · ' + -v : v > 0 ? 'Heating · ' + v : 'Off'; });
    const d = wcVal(S.s.Driver);
    fr.querySelectorAll('.dk[data-seatq] .lv').forEach(lv => { lv.dataset.v = d < 0 ? 'cool' : d > 0 ? 'warm' : 'off'; lv.querySelectorAll('b').forEach((b, i) => b.classList.toggle('off', i >= Math.abs(d))); });
  }
  function seatqClick(t) {
    const fr = frameOf(t), q = fr.querySelector('.seatq'); if (!q) return false;
    if (t.closest('[data-seatq]')) { q.classList.toggle('on'); fr.querySelector('[data-seatq]').classList.toggle('on', q.classList.contains('on')); wcPaint(fr); return true; }
    if (t.closest('[data-sqx]') || t.closest('.sq-all') || (q.classList.contains('on') && !t.closest('.seatq'))) { q.classList.remove('on'); fr.querySelector('[data-seatq]').classList.remove('on'); if (t.closest('[data-sqx]')) return true; }
    const wv = t.closest('[data-wcv]');
    if (wv) { const w = fr.querySelector('.st-wrap'), S = stOf(w), c = wv.closest('.wc'), n = c.dataset.wc === 'sel' ? S.sel : c.dataset.wc, x = +wv.dataset.wcv;
      S.s[n].heat = x > 0 ? String(x) : 'Off'; S.s[n].vent = x < 0 ? String(-x) : 'Off'; stPaint(w); return true; }
    return false;
  }
  function clClick(t) {
    if (seatqClick(t) || qcClick(t) || tyClick(t)) return true;
    const scr = t.closest('.cl-pane'), fr = frameOf(t);
    const df = t.closest('.dk[data-cldef]');
    if (df) { const C = clOf(fr); C.deff = !C.deff; if (C.deff) { C.ac = true; } clPaint(fr); toast(fr, C.deff ? 'Front defrost on · full fan to the windscreen' : 'Front defrost off'); return true; }
    if (!scr) return false;
    const C = clOf(fr);
    const zn = t.closest('[data-czone]'); if (zn) { C.sel = zn.dataset.czone; clPaint(fr); return true; }
    const st = t.closest('[data-clstep]');
    if (st) { const [k, d] = st.dataset.clstep.split('|'), n = +d;
      if (k === 't') clStep(fr, C.sel, n);
      if (k === 'pre') { C.pre = (C.pre + n * 15 + 1440) % 1440; clPaint(fr); }
      if (k === 'fr') { const [lo, hi] = C.frm === 'cool' ? [-2, 10] : [35, 55]; C.fr = Math.max(lo, Math.min(hi, C.fr + n)); clPaint(fr); }
      return true; }
    const fb = t.closest('[data-clfan]'); if (fb) { C.auto = false; C.fan[C.sel] = +fb.dataset.clfan; if (C.sync) CZ.forEach(k => C.fan[k] = C.fan[C.sel]); clPaint(fr); return true; }
    const q = t.closest('[data-cl]');
    if (q) { const k = q.dataset.cl;
      if (k === 'sync') { C.sync = !C.sync; if (C.sync) CZ.forEach(z => { if (!(C.lock && z.startsWith('Rear') && !C.sel.startsWith('Rear'))) C.t[z] = C.t[C.sel]; }); clFollow(fr); toast(fr, C.sync ? `All zones set to ${tShow(C.t[C.sel])}°` : 'Zones set separately'); }
      else if (k === 'lock') { C.lock = !C.lock; toast(fr, C.lock ? 'Rear climate locked' : 'Rear passengers can change climate'); }
      else if (k === 'maxc' || k === 'maxh') { const on = !C[k]; if (on && !C._save) C._save = { ...C.t }; C.maxc = C.maxh = false; C[k] = on;
        if (on) { CZ.forEach(z => C.t[z] = k === 'maxc' ? 16 : 28); C.auto = false; CZ.forEach(z => C.fan[z] = 7); if (k === 'maxc') { C.ac = true; C.recirc = true; } }
        else if (C._save) { C.t = C._save; C._save = null; C.auto = true; } clFollow(fr); }
      else { C[k] = !C[k]; if (k === 'recirc' || k === 'ac') clPurify(fr);
        if (k === 'deff') toast(fr, C.deff ? 'Front defrost on · full fan to the windscreen' : 'Front defrost off');
        if (k === 'defr') toast(fr, C.defr ? 'Rear window and mirrors heating for 15 min' : 'Rear defrost off'); }
      clPaint(fr); return true; }
    const md = t.closest('[data-clmode]'); if (md) { C.mode = md.dataset.clmode; if (C.mode !== 'wind') C.deff = false; else C.deff = true; clPaint(fr); return true; }
    const sp = t.closest('.cl-spread div'); if (sp) { const pad = scr.querySelector('.vent-pad'); pad.classList.remove('focus', 'diffuse', 'sweep'); pad.classList.add(sp.textContent.toLowerCase()); return false; }
    const sc = t.closest('[data-clscent]'); if (sc) { scr.querySelectorAll('[data-clscent]').forEach(x => x.classList.toggle('on', x === sc)); toast(fr, sc.querySelector('b').textContent + ' · fragrance on'); return true; }
    const dy = t.closest('[data-clday]'); if (dy) { dy.classList.toggle('on'); return true; }
    const kp = t.closest('[data-clkeep]'); if (kp) { C.keep = kp.dataset.clkeep; scr.querySelector('.cl-keep-tx').textContent = KEEP[C.keep]; return false; }
    const fm = t.closest('.cl-frmode div'); if (fm) { C.frm = fm.textContent === 'Cool' ? 'cool' : 'warm'; C.fr = C.frm === 'cool' ? 4 : 45; clPaint(fr); return false; }
    const tr = t.closest('[data-cltray]'); if (tr) { C.tray = !C.tray; clPaint(fr); return true; }
    const ta = t.closest('[data-trayaim]'); if (ta) { C.trayAim = ta.dataset.trayaim; if (!C.tray) C.tray = true; clPaint(fr); toast(fr, 'Table turned towards ' + ta.textContent.toLowerCase()); return true; }
    return false;
  }
  function clTog(tg) {
    const scr = tg.closest('.cl-pane'); if (!scr) return; const fr = frameOf(tg), C = clOf(fr), on = tg.classList.contains('on');
    if (tg.hasAttribute('data-clpur')) { C.pur = on; clPurify(fr); }
    if (tg.hasAttribute('data-clfrag')) scr.querySelector('.cl-scents').classList.toggle('off', !on);
    if (tg.hasAttribute('data-clfollow')) { C.follow = on; clFollow(fr); toast(fr, on ? 'Seat heating now follows the cabin temperature' : 'Seat heating is set by hand'); }
    if (tg.hasAttribute('data-clpre')) scr.querySelector('.cl-pre').parentElement.classList.toggle('cl-pre-off', !on);
    if (tg.hasAttribute('data-clfr')) { C.frOn = on; clPaint(fr); }
  }
  // fan dial: arc fills 1–7, the fan spins faster; drag or tap along the arc
  function fdPaint(fd, n, auto) {
    const a = Math.PI * (n - 1) / 6, th = fd.querySelector('.fd-th');
    fd.style.setProperty('--p', (n - 1) / 6 * 100); fd.style.setProperty('--fs', (1.9 - n * 0.22).toFixed(2) + 's');
    th.setAttribute('cx', (100 - 78 * Math.cos(a)).toFixed(1)); th.setAttribute('cy', (104 - 78 * Math.sin(a)).toFixed(1));
    fd.querySelectorAll('.fd-tk').forEach(k => k.classList.toggle('on', +k.dataset.fdk <= n));
    fd.classList.toggle('auto', auto); fd.querySelector('.fd-n').textContent = n; fd.querySelector('.fd-l').textContent = auto ? 'Auto' : 'Fan';
  }
  let fdDrag = null;
  function fdAim(e) { const fd = fdDrag, r = fd.querySelector('svg').getBoundingClientRect(), fr = frameOf(fd), C = clOf(fr);
    const x = (e.clientX - r.left) / r.width * 200 - 100, y = 104 - (e.clientY - r.top) / r.height * 124;
    let a = Math.atan2(Math.max(y, 0), x); const n = Math.max(1, Math.min(7, Math.round(7 - a / Math.PI * 6)));
    if (C.auto || C.fan[C.sel] !== n) { C.auto = false; C.maxc = C.maxh = false; C.fan[C.sel] = n; if (C.sync) CZ.forEach(k => C.fan[k] = n); clPaint(fr); } }
  document.addEventListener('pointerdown', e => { const fd = e.target.closest('[data-cldial]'); if (!fd) return; fdDrag = fd; fd.classList.add('drag'); fdAim(e); });
  document.addEventListener('pointermove', e => { if (fdDrag) fdAim(e); });
  document.addEventListener('pointerup', () => { if (fdDrag) { fdDrag.classList.remove('drag'); fdDrag = null; } });
  // aim the vents: drag the dot on the pad
  let vDrag = null;
  function vAim(e) { const pad = vDrag, r = pad.getBoundingClientRect(), fr = frameOf(pad), C = clOf(fr);
    const x = Math.max(-1, Math.min(1, ((e.clientX - r.left) / r.width - 0.5) * 2.4)), y = Math.max(-1, Math.min(1, ((e.clientY - r.top) / r.height - 0.5) * 2.4));
    C.vent[C.sel] = [+x.toFixed(2), +y.toFixed(2)]; pad.style.setProperty('--vx', x); pad.style.setProperty('--vy', y); pad.style.setProperty('--vxa', Math.abs(x)); }
  document.addEventListener('pointerdown', e => { const pad = e.target.closest('[data-vpad]'); if (!pad) return; vDrag = pad; pad.classList.add('drag'); pad.classList.remove('sweep'); vAim(e); });
  document.addEventListener('pointermove', e => { if (vDrag) vAim(e); });
  document.addEventListener('pointerup', () => { if (vDrag) { vDrag.classList.remove('drag'); vDrag = null; } });
  document.querySelectorAll('.frame').forEach(fr => { if (fr.querySelector('.cl-pane')) { clPaint(fr); clPurify(fr); wcPaint(fr); } });
  /* ---------- Quick controls: doors, frunk, boot, windows, mirrors, charge port, sunshades, lights ---------- */
  const DOORN = { dfl: 'driver door', dfr: 'passenger door', drl: 'rear left door', drr: 'rear right door', frunk: 'frunk', boot: 'boot' };
  const qcOf = fr => fr._qc || (fr._qc = { doors: true, lock: true, open: {}, port: false, win: 'closed', wins: { fl: 0, rl: 0, fr: 0, rr: 0 }, wside: 'l', mir: 'out', shade: { l: false, r: false }, lights: 'auto' });
  const WV = { closed: 0, vent: .18, open: 1 };
  /* ---------- Mark 2: the 3D car (et9-3d.js). Mounts when a car view is first on screen; the drawing stays until the model is ready ---------- */
  function c3d(fr, kind, host, st, onPick) {
    if (!host) return; host._st = st;
    const v = host._v3; if (v && v !== 'wait') { v.set(st); return; }
    if (v === 'wait') return;
    if (!window.ET9) { if (!c3d.hooked) { c3d.hooked = true; window.addEventListener('et9-ready', () => document.querySelectorAll('.frame').forEach(f => { lockPaint(f); homePaint(f); qcPaint(f); tyPaint(f); chPaint(f); f.querySelectorAll('[data-drv2]').forEach(dmPaint); }));   /* lock screen first, then Home, then the car pages */ } return; }
    if (false && !host.offsetParent) {   // (no longer waits until on screen: every view is built up front so pages open instantly)
      if (!host._io) { host._io = new IntersectionObserver(es => { if (es.some(e => e.isIntersecting)) { host._io.disconnect(); host._io = null; c3d(fr, kind, host, host._st, onPick); } }); host._io.observe(host); }
      return; }
    host._v3 = 'wait'; host.classList.add('c3d-host');
    ET9.mount(host, { view: kind, orbit: kind === 'home' ? 'free' : false, scene: { home: 'arches', lock: 'meadow', side: 'drive' }[kind], drift: kind === 'lock', onPick, onResize: host._onResize }).then(v3 => { host._v3 = v3; v3.set(host._st); v3.snap(); requestAnimationFrame(() => host.classList.add('c3d-on')); })
      .catch(err => { host._v3 = null; console.warn('3D car not available', err); });
    if (host._onResize) setTimeout(() => host._v3 && host._v3 !== 'wait' && host._onResize(host._v3), 900);
  }
  // Settings › Display › Car colour (stored in this browser; the 3D car repaints everywhere)
  const PAINTN = { ceramic: 'Midnight Ceramic Blue', lavender: 'Lavender silver', cloud: 'Cloud White', black: 'Deep Black', moon: 'New Moon Silver', southern: 'Southern Star Blue', gold: 'Sunlight Gold' };
  function paintSync() { let k = 'lavender'; try { k = localStorage.getItem('nio-paint') || k; } catch (e) {} if (!PAINTN[k]) k = 'lavender';
    document.documentElement.style.setProperty('--paint', { ceramic: '#1d2540', lavender: '#b8b1d2', cloud: '#f2f1f5', black: '#202027', moon: '#a3a5ac', southern: '#33548c', gold: '#c8ad7c' }[k]);   /* the car in the camera feeds takes this colour */
    document.querySelectorAll('.pt-sw').forEach(s => s.classList.toggle('on', s.dataset.paint === k)); document.querySelectorAll('.pt-n').forEach(n => n.textContent = PAINTN[k]); }
  document.addEventListener('click', e => { const sw = e.target.closest('[data-paint]'); if (!sw) return; const k = sw.dataset.paint;
    try { localStorage.setItem('nio-paint', k); } catch (er) {} if (window.ET9) ET9.setPaint(k); paintSync(); toast(frameOf(sw), 'Car colour · ' + PAINTN[k]); });
  paintSync();
  /* ---------- Mark 2 · Home: the car in a lavender garden; Places, Podcasts and Music fold away ---------- */
  const isDark = () => document.documentElement.dataset.theme === 'dark';
  const carState = fr => { const Q = qcOf(fr); return { open: { ...Q.open }, port: Q.port, wins: { ...Q.wins }, mir: Q.mir, shade: { ...Q.shade }, lights: Q.lights }; };
  function homePaint(fr) {
    const hm = fr.querySelector('.hm3'); if (!hm) return;
    const on = !!hm.closest('.scr.on'), slot = hm.querySelector('.hm-mslot'), pl = fr._pl || (fr._pl = fr.querySelector('.ctx .player'));
    if (pl && slot) {
      if (on && pl.parentElement !== slot) { fr._plHome = { p: pl.parentElement, n: pl.nextSibling, compact: pl.classList.contains('compact') }; slot.appendChild(pl); pl.classList.add('compact'); }
      else if (!on && fr._plHome && pl.parentElement === slot) { const h = fr._plHome; h.p.insertBefore(pl, h.n); pl.classList.toggle('compact', h.compact); fr._plHome = null; }
    }
    c3d(fr, 'home', hm.querySelector('.hm-stage'), { dark: isDark(), lights: 'auto' });   // Home shows the car parked and closed, whatever Quick controls is doing
  }
  document.addEventListener('click', e => { const t = e.target.closest('[data-hmtg]'); if (!t) return; const w = t.closest('.hm-w');
    const a = [w.offsetWidth, w.offsetHeight]; w.classList.toggle('min'); const b = [w.offsetWidth, w.offsetHeight];   // smooth: grow/shrink from the old size
    w.animate([{ width: a[0] + 'px', height: a[1] + 'px' }, { width: b[0] + 'px', height: b[1] + 'px' }], { duration: 600, easing: 'cubic-bezier(.2,.8,.2,1)' });
    [...w.children].forEach(c => c.classList.contains('hm-tg') || c.animate([{ opacity: 0 }, { opacity: 1 }], { duration: 420, delay: 160, easing: 'cubic-bezier(.2,.8,.2,1)', fill: 'backwards' }));
    t.querySelector('.ms').textContent = w.classList.contains('min') ? 'expand_less' : 'expand_more'; t.title = w.classList.contains('min') ? 'Open' : 'Fold'; e.stopPropagation(); }, true);

  /* ---------- Mark 2 · lock screen (on load, from the lock icon, and whenever the car locks) ---------- */
  function lockPaint(fr) { const ov = fr.querySelector('[data-lockov]'); if (!ov) return;
    const tm = fr.querySelector('.status .time'); if (tm) ov.querySelector('.lk-time').textContent = tm.textContent;
    const st = ov.querySelector('.lk-stage'); if (ov.classList.contains('on') || st._v3) c3d(fr, 'lock', st, { dark: isDark(), mir: 'fold', lights: 'off' }); }
  function lockShow(fr) { const ov = fr.querySelector('[data-lockov]'); if (!ov) return; ov.style.transform = ''; ov.classList.remove('out'); ov.classList.add('on'); lockPaint(fr); }
  function lockHide(fr) { const ov = fr.querySelector('[data-lockov]'); if (!ov || !ov.classList.contains('on')) return;
    ov.style.transform = ''; ov.classList.add('out'); setTimeout(() => ov.classList.remove('on', 'out'), 600);
    const Q = qcOf(fr); Q.lock = false; Q.mir = 'out'; fr._lastLock = false; qcPaint(fr);
    const hb = fr.querySelector('.dk[data-go="home"]'); if (hb) hb.click();
    setTimeout(() => toast(fr, 'Unlocked · welcome back, Emma'), 350); }
  document.querySelectorAll('[data-lockov]').forEach(ov => ov.addEventListener('click', () => { if (ov.classList.contains('ready')) lockHide(frameOf(ov)); }));   // tap anywhere to unlock, once ready
  // ready = the car, the HDRIs and every car view built (Home, lock, Quick controls, Tyres, Driving); never wait more than 8 s
  function whenAllReady() {
    const done = () => document.querySelectorAll('[data-lockov]').forEach(ov => ov.classList.add('ready'));
    const t0 = performance.now(), check = () => { const hosts = [...document.querySelectorAll('.hm-stage, .lk-stage')];   // lock screen and Home are enough to let you in; the car pages finish building in the background
      if (hosts.length && hosts.every(h => h._v3 && h._v3 !== 'wait')) return requestAnimationFrame(done); if (performance.now() - t0 > 8000) return done(); setTimeout(check, 50); };
    try { (window.ET9 && ET9.ready ? ET9.ready() : Promise.resolve()).then(check, done); } catch (e) { done(); } }
  if (window.ET9) whenAllReady(); else window.addEventListener('et9-ready', whenAllReady, { once: true });
  setTimeout(() => document.querySelectorAll('[data-lockov]').forEach(ov => ov.classList.add('ready')), 8000);   // hard limit: never keep anyone on the lock screen longer than 8 s
  document.addEventListener('click', e => { const b = e.target.closest('[data-lockscr]'); if (!b) return; const fr = frameOf(b), Q = qcOf(fr);
    if (Object.values(Q.open).some(Boolean)) { toast(fr, 'Close the doors, frunk and boot to lock'); return; }
    Q.lock = true; Q.mir = 'fold'; qcPaint(fr); toast(fr, 'Locked · mirrors fold'); });
  setInterval(() => document.querySelectorAll('[data-lockov].on').forEach(ov => { const tm = frameOf(ov).querySelector('.status .time'); if (tm) ov.querySelector('.lk-time').textContent = tm.textContent; }), 1000);
  new MutationObserver(() => document.querySelectorAll('.frame').forEach(fr => { homePaint(fr); lockPaint(fr); fr.querySelectorAll('[data-drv2]').forEach(r => r._dm && dmPaint(r)); qcPaint(fr); })).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

  /* ---------- Mark 2 · the map's car marker is a top-down picture of the 3D car ---------- */
  function egoPaint() { if (!window.ET9) return; ET9.snapshot(40).then(url => document.querySelectorAll('.cv-ego').forEach(im => {
    im.setAttribute('href', url); im.setAttribute('opacity', '1'); const fb = im.parentElement.querySelector('.cv-egofb'); if (fb) fb.style.display = 'none'; })).catch(() => {}); }
  if (window.ET9) { egoPaint(); ET9.onPaint(egoPaint); ET9.preload(); } else window.addEventListener('et9-ready', () => { egoPaint(); ET9.onPaint(egoPaint); }, { once: true });
  document.addEventListener('click', e => { const b = e.target.closest('[data-hazard]'); if (!b) return; const fr = frameOf(b), Q = qcOf(fr); Q.hazard = !Q.hazard; qcPaint(fr); toast(fr, Q.hazard ? 'Hazard lights on' : 'Hazard lights off'); });
  const c3dTap = el => el && el.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  function qcPaint(fr) {
    const Q = qcOf(fr), qc = fr.querySelector('[data-screen="car"] .qc:not(.ty)'); if (!qc) return;
    const svg = qc.querySelector('.ct');
    svg.querySelectorAll('.ct-door').forEach(d => { const k = d.dataset.cp, s = k.endsWith('l') ? 1 : -1; d.style.transform = Q.open[k] ? `rotate(${s * 24}deg)` : ''; d.classList.toggle('open', !!Q.open[k]); });
    svg.querySelectorAll('.ct-dtag').forEach(g => g.classList.toggle('on', !!Q.open[g.dataset.dtag]));
    qc.querySelector('.qc-lockw').classList.toggle('exp', !!Q.doors);
    qc.querySelectorAll('[data-dr]').forEach(r => { const o = !!Q.open[r.dataset.dr]; r.classList.toggle('open', o); r.querySelector('.qc-ds').textContent = o ? 'Open' : 'Closed'; r.querySelector('[data-cp]').textContent = o ? 'Close' : 'Open'; });
    svg.querySelectorAll('.ct-lid').forEach(l => l.classList.toggle('red', l.classList.contains('open')));
    svg.querySelector('.ct-frunk').classList.toggle('open', !!Q.open.frunk); svg.querySelector('.ct-boot').classList.toggle('open', !!Q.open.boot);
    svg.querySelector('.ct-port').classList.toggle('open', Q.port);
    svg.querySelectorAll('.ct-win').forEach(w => { const v = Q.wins[w.dataset.win]; w.classList.remove('v', 'o', 'vent', 'open'); w.style.fillOpacity = (1 - v * .85).toFixed(2); w.classList.toggle('o', v > .02); });
    { const wc = qc.querySelector('.qc-wsec'), lab = v => v <= .02 ? 'Closed' : v >= .98 ? 'Open' : Math.abs(v - .18) < .02 ? 'Vent' : Math.round(v * 100) + ' %';
      wc.classList.toggle('on', !!Q.wcard);
      const vals = Object.values(Q.wins), same = vals.every(v => Math.abs(v - vals[0]) < .01);
      wc.querySelectorAll('[data-wi]').forEach(r => { const k = r.dataset.wi, v = k === 'all' ? (same ? vals[0] : null) : Q.wins[k];
        const sl = r.querySelector('.wi-sl'); if (document.activeElement !== sl) sl.value = Math.round((v === null ? vals.reduce((a, b) => a + b) / 4 : v) * 100);
        sl.style.setProperty('--p', sl.value + '%');
        r.querySelector('.wi-v').textContent = v === null ? 'Mixed' : lab(v);
        r.querySelectorAll('.wi-seg [data-wset]').forEach(b => b.classList.toggle('on', v !== null && Math.abs(v - b.dataset.wset / 100) < .02)); });
      const open = vals.filter(v => v > .02).length;
      qc.querySelector('.qc-wst').textContent = open === 0 ? 'All closed' : same ? 'All ' + lab(vals[0]).toLowerCase() : open + ' open'; }
    svg.querySelectorAll('.ct-mir').forEach((m, i) => m.style.transform = Q.mir === 'fold' ? `rotate(${i ? 70 : -70}deg)` : '');
    svg.querySelectorAll('.ct-fab').forEach(s => s.classList.toggle('open', Q.shade[s.dataset.shade]));
    { const rg = svg.querySelector('.ct-roofg'), any = Q.shade.l || Q.shade.r, recent = Date.now() < (Q.rUntil || 0);
      rg.classList.toggle('show', any || recent); rg.classList.toggle('sun', any);
      clearTimeout(fr._rgT); if (!any && recent) fr._rgT = setTimeout(() => qcPaint(fr), Q.rUntil - Date.now() + 20); }
    svg.classList.toggle('l-on', Q.lights === 'on'); svg.classList.toggle('l-drl', Q.lights === 'auto');
    qc.querySelectorAll('[data-pill]').forEach(p => p.classList.toggle('on', p.dataset.pill === 'port' ? Q.port : !!Q.open[p.dataset.pill]));
    qc.querySelectorAll('[data-hazard]').forEach(b => b.classList.toggle('on', !!Q.hazard));
    qc.querySelectorAll('.qc-btns [data-cp]').forEach(b => b.classList.toggle('on', b.dataset.cp === 'port' ? Q.port : !!Q.open[b.dataset.cp]));
    const sh = Q.shade.l && Q.shade.r ? 'both' : Q.shade.l ? 'l' : Q.shade.r ? 'r' : 'closed';
    const seg = { win: Q.win, mir: Q.mir, shade: sh, lights: Q.lights };
    qc.querySelectorAll('[data-qc]').forEach(s => s.querySelectorAll('div').forEach(d => d.classList.toggle('on', d.dataset.v === seg[s.dataset.qc])));
    const open = Object.keys(Q.open).filter(k => Q.open[k]).map(k => DOORN[k]);
    const lk = qc.querySelector('.qc-lock'); lk.classList.toggle('un', !Q.lock);
    lk.querySelector('.ms').textContent = Q.lock ? 'lock' : 'lock_open';
    lk.querySelector('.qc-lt').textContent = Q.lock ? 'Locked' : 'Unlocked';
    { const all = qc.querySelector('.qc-all'); if (all) { all.querySelector('.ms').textContent = Q.lock ? 'lock_open' : 'lock'; all.lastElementChild.textContent = Q.lock ? 'Locked · tap to unlock' : 'Close all and lock'; all.classList.toggle('locked', Q.lock); } }
    const sub = open.length ? (open.length === 1 ? open[0][0].toUpperCase() + open[0].slice(1) + ' open' : open.length + ' open: ' + open.join(', ')) : (Q.lock ? 'All doors closed' : 'Tap to lock');
    lk.querySelector('.qc-ls').textContent = sub;
    const cs = fr._csEl || (fr._csEl = [...fr.querySelectorAll('.ctx *')].find(e => !e.children.length && /doors closed/i.test(e.textContent)));
    if (cs) cs.textContent = (Q.lock ? 'Locked' : 'Unlocked') + ' · ' + (open.length ? open.length + ' open' : 'all doors closed');
    { const sw = fr.querySelector('.st-wrap'), easy = sw && stOf(sw).easy !== false && ['dfl', 'dfr', 'drl', 'drr'].some(k => Q.open[k]);
      const host = qc.querySelector('.qc-car');
      if (!host._dico) { host._dico = true;   // a door button beside each door (shows open / closed) and a floating hint
        host.insertAdjacentHTML('beforeend', ['dfl', 'dfr', 'drl', 'drr'].map(k => `<div class="qc-dico" data-cp="${k}" data-tap title="${DOORN[k]}"><span class="ms">door_front</span></div>`).join('') + '<div class="qc-hint"><span class="ms">touch_app</span><span>Tap a door to open it</span></div>');
        host._onResize = v => { const L = v.layout(); host.querySelectorAll('.qc-dico').forEach(d => { const k = d.dataset.cp, pt = L.doors[k];
          d.style.top = Math.round(pt.y - 22) + 'px'; d.style.left = Math.round(k[2] === 'l' ? L.left - 56 : L.right + 12) + 'px'; }); host.classList.add('qc-laid'); }; }
      qc.classList.toggle('wv', !!Q.wcard);
      host.querySelectorAll('.qc-dico').forEach(d => { const o = !!Q.open[d.dataset.cp]; d.classList.toggle('open', o); d.querySelector('.ms').textContent = o ? 'door_open' : 'door_front'; });
      c3d(fr, 'qc', qc.querySelector('.qc-car'), { open: Q.wcard ? {} : { ...Q.open }, port: Q.wcard ? false : Q.port, wins: { ...Q.wins }, mir: Q.mir, shade: { ...Q.shade }, lights: Q.lights, hazard: !!Q.hazard, lift: easy && !Q.wcard ? -50 : 0, dark: isDark(), view: Q.wcard ? 'qcwin' + (Q.wview || 'L') : 'qc' },   // while windows are being set, the car is shown with its doors shut, turned to the side being set
        k => { if (k.startsWith('wheel')) return; c3dTap(svg.querySelector(`[data-cp="${k}"]`)); }); }
    if (Q.lock && fr._lastLock === false) { clearTimeout(fr._lkT); fr._lkT = setTimeout(() => { if (qcOf(fr).lock) lockShow(fr); }, 1500); }
    fr._lastLock = Q.lock;
    homePaint(fr); lockPaint(fr);
  }
  function qcClick(t) {
    const qc = t.closest('[data-screen="car"] .qc:not(.ty)'); if (!qc) return false;
    const fr = frameOf(t), Q = qcOf(fr);
    if (t.closest('[data-qcall]') && Q.lock) { Q.lock = false; qcPaint(fr); toast(fr, 'Unlocked'); return true; }   // one button: Close all and lock, or Unlock when locked
    if (t.closest('[data-qcall]')) { Q.open = {}; Q.port = false; Object.keys(Q.wins).forEach(n => Q.wins[n] = 0); Q.shade = { l: false, r: false }; Q.rUntil = Date.now() + 2600; Q.wcard = false;
      Q.lock = true; Q.mir = 'fold'; qcPaint(fr); toast(fr, 'Doors, frunk, boot, windows and sunshades closing · locked');
      setTimeout(() => { if (Q.lock) { Q.mir = 'out'; qcPaint(fr); } }, 1800); return true; }
    if (t.closest('[data-qcdoors]')) { Q.doors = !Q.doors; qcPaint(fr); return true; }
    if (t.closest('[data-qclock]')) {
      if (Q.lock) { Q.lock = false; toast(fr, 'Unlocked'); }
      else if (Object.values(Q.open).some(Boolean)) toast(fr, 'Close the doors, frunk and boot to lock');
      else { Q.lock = true; Q.mir = 'fold'; toast(fr, 'Locked · mirrors fold'); setTimeout(() => { if (Q.lock) { Q.mir = 'out'; qcPaint(fr); } }, 1800); }
      qcPaint(fr); return true; }
    const cp = t.closest('[data-cp]');
    if (cp) { const k = cp.dataset.cp;
      if (Q.wcard && k !== 'mir' && k !== 'shl' && k !== 'shr') Q.wcard = false;   // leave the Windows view: back to the top view so the frunk, boot, port or door is seen opening
      if (k === 'mir') Q.mir = Q.mir === 'fold' ? 'out' : 'fold';
      else if (k === 'port') { Q.port = !Q.port; toast(fr, Q.port ? 'Charge port open · plug in on the left rear' : 'Charge port closed'); }
      else if (k === 'shl' || k === 'shr') { const s = k.slice(2); Q.shade[s] = !Q.shade[s]; }
      else { const sw = fr.querySelector('.st-wrap'), easy = sw && stOf(sw).easy !== false && k.startsWith('d') && !Q.open[k];
        if (!Q.open[k] && Q.lock && k !== 'frunk' && k !== 'boot') { Q.lock = false; toast(fr, 'Unlocked · opening the ' + DOORN[k] + (easy ? ' · body lowers 50 mm' : '')); }
        else if (easy) toast(fr, 'Opening the ' + DOORN[k] + ' · body lowers 50 mm for easy entry');
        else toast(fr, (Q.open[k] ? 'Closing the ' : 'Opening the ') + DOORN[k]);
        Q.open[k] = !Q.open[k]; }
      qcPaint(fr); return true; }
    if (t.closest('[data-wopen]')) { Q.wcard = !Q.wcard; qcPaint(fr); return true; }
    if (t.closest('[data-wclose]')) { Q.wcard = false; qcPaint(fr); return true; }
    const wb = t.closest('[data-wset]'); if (wb) { const k = wb.closest('[data-wi]').dataset.wi, v = +wb.dataset.wset / 100;
      if (k !== 'all') Q.wview = k[1] === 'l' ? 'L' : 'R'; (k === 'all' ? Object.keys(Q.wins) : [k]).forEach(n => Q.wins[n] = v); qcPaint(fr); return true; }
    if (t.closest('.qc-wsec')) return true;
    const ws = t.closest('[data-wside]'); if (ws) { Q.wside = ws.dataset.wside; Q.wUntil = Date.now() + 3500; qcPaint(fr); return true; }
    const sw = t.closest('[data-sw]'); if (sw) { const n = sw.dataset.sw + Q.wside; Q.wins[n] = Q.wins[n] >= 1 ? 0 : 1; Q.wUntil = Date.now() + 3500; qcPaint(fr); return true; }
    const sg = t.closest('[data-qc] div');
    if (sg) { const k = sg.parentElement.dataset.qc, v = sg.dataset.v;
      if (k === 'shade') { Q.shade = { l: v === 'l' || v === 'both', r: v === 'r' || v === 'both' }; Q.rUntil = Date.now() + 2600; } else if (k === 'win') { Object.keys(Q.wins).forEach(n => Q.wins[n] = WV[v]); Q.wUntil = Date.now() + 3500; } else Q[k] = v;
      if (k === 'win') toast(fr, v === 'open' ? 'All windows down' : v === 'vent' ? 'Windows open 2 cm' : 'All windows up');
      qcPaint(fr); return true; }
    return false;
  }
  /* ---------- Tyres: live pressures, slow-leak demo, reset ---------- */
  const TY0 = { fl: 2.9, fr: 2.9, rl: 3.0, rr: 3.0 };
  /* ---------- Car › Charging: plug in, watch the battery fill (the 3D car shows the cable and energy flowing in) ---------- */
  const chOf = fr => fr._ch || (fr._ch = { on: false, pct: 78, done: false });
  const chLimit = fr => { const v = fr.querySelector('.chg-limsl .val'); return v ? parseInt(v.textContent, 10) || 90 : 90; };
  const chKw = (pct, lim) => Math.round(Math.max(18, Math.min(150, 150 - Math.max(0, pct - 60) * 2.6)) * (lim - pct < 2 ? .5 : 1));
  function chPaint(fr) {
    const pg = fr.querySelector('[data-chg]'); if (!pg) return; const CH = chOf(fr), lim = chLimit(fr), pct = Math.round(CH.pct), km = Math.round(CH.pct * 5.36);
    pg.classList.toggle('on', CH.on);
    pg.querySelector('.chg-pct').firstChild.textContent = pct; pg.querySelector('.chg-km').textContent = km + ' km';
    pg.querySelector('.chg-bar').style.setProperty('--p', CH.pct + '%'); pg.querySelector('.chg-bar').style.setProperty('--l', lim + '%');
    const st = pg.querySelector('.chg-st'), sub = pg.querySelector('.chg-sub'), go = pg.querySelector('.chg-go');
    if (CH.on) { const kw = chKw(CH.pct, lim), min = Math.max(1, Math.round((lim - CH.pct) * 60 / kw));
      st.textContent = 'Charging · ' + kw + ' kW'; sub.textContent = min + ' min to ' + lim + ' % · +' + Math.max(0, Math.round((CH.pct - CH.from) * 5.36)) + ' km so far';
      go.querySelector('.ms').textContent = 'power_off'; go.lastElementChild.textContent = 'Stop charging'; }
    else { st.textContent = CH.done ? 'Charged to ' + lim + ' %' : 'Not plugged in'; sub.textContent = CH.done ? 'Unplug when you are ready to go' : (pct >= lim ? 'Already at your ' + lim + ' % limit' : 'Plug in to start charging');
      go.querySelector('.ms').textContent = 'power'; go.lastElementChild.textContent = 'Plug in'; }
    pg.querySelector('.chg-tagt').textContent = CH.on ? 'Charging · left rear port' : 'Charge port · left rear';
    const Q = qcOf(fr);
    c3d(fr, 'chg', pg.querySelector('.chg-car'), { open: {}, wins: { fl: 0, fr: 0, rl: 0, rr: 0 }, port: !!CH.port || Q.port, plug: !!CH.plug, charge: !!CH.fx, lvl: Math.min(1, CH.pct / 100), mir: 'out', shade: { l: false, r: false }, lights: 'off', dark: isDark() });
    // the rest of the screen follows: Home battery card, its folded ring and the lock screen
    fr.querySelectorAll('.hb-big').forEach(e => e.firstChild.textContent = pct); fr.querySelectorAll('.hb-mini b').forEach(e => e.textContent = pct);
    fr.querySelectorAll('.hb-full .bs.num').forEach(e => e.textContent = km + ' km range'); fr.querySelectorAll('.hm-bat').forEach(e => { e.style.setProperty('--bp', CH.pct + '%'); e.classList.toggle('chg', CH.on); });
    fr.querySelectorAll('.lk-info .num').forEach(e => e.textContent = pct + ' % · ' + km + ' km');
  }
  /* the physical sequence: flap opens, the cable glides in and plugs, then the charging glow fades in; stopping runs it backwards */
  function chSeq(fr, on) { const CH = chOf(fr); (fr._chS || []).forEach(clearTimeout); const at = (ms, f) => (fr._chS = fr._chS || []).push(setTimeout(() => { f(); chPaint(fr); }, ms));
    fr._chS = [];
    if (on) { CH.port = true; at(800, () => CH.plug = true); at(2300, () => { CH.fx = true; fr._chT = setTimeout(() => chTick(fr), 600); }); }
    else { CH.fx = false; at(900, () => CH.plug = false); at(2400, () => CH.port = false); }
    chPaint(fr); }
  function chTick(fr) { const CH = chOf(fr); if (!CH.on) return; const lim = chLimit(fr);
    CH.pct = Math.min(lim, CH.pct + chKw(CH.pct, lim) / 150 * .5);   // sped up for the demo: about 2 % a second at full speed
    if (CH.pct >= lim) { CH.on = false; CH.done = true; chSeq(fr, false); toast(fr, 'Charged to ' + lim + ' % · ' + Math.round(CH.pct * 5.36) + ' km'); }
    chPaint(fr); if (CH.on) fr._chT = setTimeout(() => chTick(fr), 500); }
  document.addEventListener('click', e => { const b = e.target.closest('[data-chggo]'); if (!b) return; const fr = frameOf(b), CH = chOf(fr), lim = chLimit(fr);
    clearTimeout(fr._chT);
    if (CH.on) { CH.on = false; CH.done = false; chSeq(fr, false); toast(fr, 'Charging stopped at ' + Math.round(CH.pct) + ' %'); }
    else if (CH.pct >= lim - .5) { toast(fr, 'Already at your ' + lim + ' % limit · raise it to charge more'); }
    else { CH.on = true; CH.done = false; CH.from = CH.pct; chSeq(fr, true); toast(fr, 'Plugging in · charging to ' + lim + ' %'); }
    chPaint(fr); });
  document.addEventListener('pointerup', () => document.querySelectorAll('.frame').forEach(f => f.querySelector('[data-chg]') && setTimeout(() => chPaint(f), 0)));
  function tyPaint(fr) {
    const ty = fr.querySelector('.qc.ty'); if (!ty) return; const P = fr._ty || (fr._ty = { ...TY0 });
    let warn = null;
    Object.keys(P).forEach(k => { const low = P[k] < TY0[k] - 0.3; if (low) warn = k;
      const c = ty.querySelector(`[data-ty="${k}"]`); c.querySelector('.ty-p').textContent = P[k].toFixed(1); c.classList.toggle('warn', low);
      ty.querySelector(`.ct-wh[data-wh="${k}"]`).classList.toggle('warn', low); });
    const st = ty.querySelector('.ty-st'); st.classList.toggle('warn', !!warn);
    if (!fr._tyMsg) { ty.querySelector('.ty-h').textContent = warn ? { fl: 'Front left', fr: 'Front right', rl: 'Rear left', rr: 'Rear right' }[warn] + ' is losing pressure' : 'All tyres OK';
      ty.querySelector('.ty-s').textContent = warn ? 'Slow down and check it at the next stop' : 'Checked today, 13:20'; }
    { const host = ty.querySelector('.qc-car'); host._onResize = host._onResize || (v => { const L = v.layout(), G = 18;
        ty.querySelectorAll('.ty-chip').forEach(c => { const k = c.dataset.ty, w = c.offsetWidth, h = c.offsetHeight, left = k[1] === 'l';
          c.style.right = c.style.bottom = 'auto'; c.style.top = Math.round(L[k].y - h / 2) + 'px';
          c.style.left = Math.round(left ? L.left - G - w : L.right + G) + 'px'; }); host.classList.add('ty-laid'); }); }
    c3d(fr, 'ty', ty.querySelector('.qc-car'), { warn }, k => { const c = k.startsWith('wheel-') && ty.querySelector(`[data-ty="${k.slice(6)}"]`); if (c) c.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.04)' }, { transform: 'scale(1)' }], { duration: 420, easing: 'cubic-bezier(.2,.8,.2,1)' }); });
  }
  function tyClick(t) {
    const ty = t.closest('.qc.ty'); if (!ty) return false; const fr = frameOf(t); tyPaint(fr); const P = fr._ty;
    if (t.closest('[data-tyleak]')) { clearInterval(fr._tyI); fr._tyI = setInterval(() => { P.rr = Math.max(2.3, P.rr - 0.05); tyPaint(fr); if (P.rr <= 2.3) clearInterval(fr._tyI); }, 160); return true; }
    if (t.closest('[data-tyreset]')) { clearInterval(fr._tyI); Object.assign(P, TY0); fr._tyMsg = true; tyPaint(fr);
      ty.querySelector('.ty-h').textContent = 'Learning new pressures'; ty.querySelector('.ty-s').textContent = 'Drive for about 10 minutes';
      setTimeout(() => { fr._tyMsg = false; tyPaint(fr); }, 2600); return true; }
    return false;
  }
  document.querySelectorAll('.frame').forEach(fr => { qcPaint(fr); tyPaint(fr); chPaint(fr); });

  // one live Climate panel: it sits in Car › Climate when that page is open, otherwise on the Climate screen
  function clHome() {
    document.querySelectorAll('.frame').forEach(fr => {
      const pane = fr.querySelector('.cl-pane'), slot = fr.querySelector('.cl-slot'), scr = fr.querySelector('[data-screen="climate"]'); if (!pane || !slot || !scr) return;
      const inCar = slot.closest('.pg.on') && slot.closest('.scr.on');
      const want = inCar ? slot : scr; if (pane.parentElement !== want) want.appendChild(pane);
    });
  }
  document.addEventListener('click', () => setTimeout(clHome, 0));
  clHome();

  // full-width pages: Climate, and Car › Quick controls, Seats, Climate, Tyres; music and battery shrink to a slim strip
  const WIDE_CAR = ['Quick controls', 'Seats', 'Climate', 'Tyres'];
  function wideUpdate() {
    document.querySelectorAll('.frame.proto').forEach(fr => {
      const scr = fr.querySelector('.scr.on'); if (!scr) return; const k = scr.dataset.screen;
      const wide = k !== 'nav' && k !== 'media';   /* every page is full width except Navigation, and Media keeps its Now playing controls */   /* Apps: full width, no music or battery column */
      if (wide) fr.dataset.wide = ''; else delete fr.dataset.wide;
      homePaint(fr);
      { const pg = scr.querySelector('.pg.on'), page = pg && pg.dataset.page, set = (sel, on) => fr.querySelectorAll(sel).forEach(d => d.classList.toggle('on', !!on));
        const q = fr.querySelector('.seatq'), nv = fr.querySelector('.nomiov');
        set('.dk[data-seatq]', (q && q.classList.contains('on')) || (k === 'car' && page === 'Seats'));
        set('.dk[data-cmf="climate"]', k === 'climate' || (k === 'car' && page === 'Climate'));
        set('.dk[data-nomi]', (nv && nv.classList.contains('on')) || (k === 'settings' && page === 'NOMI'));
        const C = fr._cl; set('.dk[data-cldef]', C && C.deff); }
      if (wide) { const art = fr.querySelector('.ctx .player .art'), m = fr.querySelector('[data-cmart]');
        if (art && m) { const img = art.querySelector('img'); m.innerHTML = img ? `<img src="${img.src}" alt="">` : ''; if (!img) m.style.backgroundImage = getComputedStyle(art).backgroundImage; }
        const pl = fr.querySelector('.ctx .player'), pb = fr.querySelector('[data-cmplay] .ms'); if (pl && pb) pb.textContent = pl.classList.contains('playing') ? 'pause' : 'play_arrow'; }
    });
  }
  document.addEventListener('click', e => {
    const cp = e.target.closest('[data-cmplay]'); if (cp) { const pl = frameOf(cp).querySelector('.ctx .player .play'); if (pl) pl.click(); }
    const ca = e.target.closest('[data-cmart]'); if (ca) route(frameOf(ca), 'media');
    setTimeout(wideUpdate, 0);
  });
  wideUpdate();

  /* ---------- Driving: mode dial + live SkyRide side view ---------- */
  const DM = ['Eco', 'Comfort', 'Sport', 'Snow', 'Custom'];
  const DMC = { Eco: '#7fbf8e', Comfort: '#8ea7e6', Sport: '#e2895c', Snow: '#8fc7de', Custom: '#a99fd0' };
  const DMSET = { Eco: { Steering: 'Light', Suspension: 'Standard', Power: 'Gentle', Regeneration: 'High', Traction: 'Normal' },
    Comfort: { Steering: 'Light', Suspension: 'Soft', Power: 'Smooth', Regeneration: 'Standard', Traction: 'Normal' },
    Sport: { Steering: 'Firm', Suspension: 'Firm', Power: 'Sharp', Regeneration: 'High', Traction: 'Sport' },
    Snow: { Steering: 'Light', Suspension: 'Soft', Power: 'Gentle', Regeneration: 'Low', Traction: 'Snow' } };
  const DMD = { Eco: 'Gentle power and strong regeneration for the most range.', Comfort: 'Quiet and balanced. The default for city driving.',
    Sport: 'Quicker response and a tighter, lower body.', Snow: 'Soft power and low regeneration for grip. The car rises for clearance.', Custom: 'Your own mix, saved to Emma’s profile.' };
  const DMR = { Eco: [-10, '+18 km'], Comfort: [0, '±0 km'], Sport: [-15, '−22 km'], Snow: [30, '−10 km'], Custom: [0, '±0 km'] };   // body height in mm; SkyRide allows +40 / −50
  function dmPaint(root) {
    const D = root._dm || (root._dm = { m: 'Comfort', c: { Steering: 'Standard', Suspension: 'Soft', Power: 'Smooth', Regeneration: 'High', Traction: 'Normal' } });
    const i = DM.indexOf(D.m), col = DMC[D.m], set = D.m === 'Custom' ? D.c : DMSET[D.m], [mm0, r] = DMR[D.m], mm = D.rh === undefined || D.rh === 'auto' ? mm0 : +D.rh, h = mm === 0 ? 'Standard' : (mm > 0 ? '+' : '−') + Math.abs(mm) + ' mm';
    root.style.setProperty('--mc', col);
    { const TH = [195, 232.5, 270, 307.5, 345], th = TH[i], P = a => [160 + 96 * Math.cos(a * Math.PI / 180), 138 + 96 * Math.sin(a * Math.PI / 180)];
      const [x1, y1] = P(195), [x2, y2] = P(th + 0.01); root.querySelector('.dm-v').setAttribute('d', `M${x1.toFixed(1)} ${y1.toFixed(1)}A96 96 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`);
      root.querySelector('.dm-capg').style.transform = `rotate(${th - 270}deg)`; }
    root.querySelectorAll('.dm-stop').forEach(s => s.classList.toggle('on', s.dataset.dm === D.m));
    root.querySelector('.dm-n').textContent = D.m; root.querySelector('.dm-d').textContent = DMD[D.m];
    const car = root.querySelector('.dm-car'); car.style.setProperty('--dy', (-mm * .3) + 'px');
    c3d(root.closest('.frame'), 'side', root.querySelector('.dm-c3d'), { lift: mm, lights: isDark() ? 'on' : 'auto', mode: D.m, dark: isDark() });
    root.querySelectorAll('[data-rhv]').forEach(d => d.classList.toggle('on', d.dataset.rhv === String(D.rh === undefined ? 'auto' : D.rh)));
    root.querySelector('.dm-h').textContent = h; root.querySelector('.dm-k').textContent = set.Suspension; root.querySelector('.dm-r').textContent = r;
    root.querySelector('.dm-st').textContent = D.m === 'Custom' ? 'Custom · tap to change' : D.m + ' settings';
    root.querySelector('.dm-set').classList.toggle('locked', D.m !== 'Custom');
    
    root.querySelectorAll('.dm-seg').forEach(s => s.querySelectorAll('div').forEach(d => d.classList.toggle('on', d.dataset.v === set[s.dataset.dk])));
    const chip = (root.closest('.frame') || document).querySelector('.status .chip'); if (chip) chip.lastChild.textContent = D.m;
  }
  document.addEventListener('click', e => {
    const root = e.target.closest('[data-drv2]'); if (!root) return; const D = root._dm || (dmPaint(root), root._dm);
    const st = e.target.closest('[data-dm]'); if (st) { D.m = st.dataset.dm; dmPaint(root); return; }
    const rh = e.target.closest('[data-rhv]'); if (rh) { D.rh = rh.dataset.rhv; setTimeout(() => dmPaint(root), 0); toast(frameOf(root), rh.dataset.rhv === 'auto' ? 'Ride height follows the drive mode' : 'Ride height ' + rh.textContent.toLowerCase() + ' · takes about 2 seconds'); return; }
    const sg = e.target.closest('.dm-seg div'); if (sg && D.m === 'Custom') { D.c[sg.parentElement.dataset.dk] = sg.dataset.v; setTimeout(() => dmPaint(root), 0); return; }
    if (e.target.closest('[data-dmsave]')) { toast(frameOf(root), 'Custom mode saved to Emma’s profile'); }
  });
  let dmDrag = null;
  function dmAim(e) { const svg = dmDrag.querySelector('.dm-dial'), r = svg.getBoundingClientRect(), x = (e.clientX - r.left) / r.width * 320 - 160, y = (e.clientY - r.top) / r.height * 220 - 138;
    let a = Math.atan2(y, x) * 180 / Math.PI; if (a < 0) a += 360; if (a < 180) a = x < 0 ? 195 : 345; a = Math.max(195, Math.min(345, a));
    const i = Math.round((a - 195) / 37.5); if (DM[i] !== dmDrag._dm.m) { dmDrag._dm.m = DM[i]; dmPaint(dmDrag); } }
  document.addEventListener('pointerdown', e => { const k = e.target.closest('[data-dmknob]'); if (!k) return; dmDrag = k.closest('[data-drv2]'); dmDrag.classList.add('dm-drag'); dmAim(e); });
  document.addEventListener('pointermove', e => { if (dmDrag) dmAim(e); });
  document.addEventListener('pointerup', () => { if (dmDrag) dmDrag.classList.remove('dm-drag'); dmDrag = null; });
  document.querySelectorAll('[data-drv2]').forEach(dmPaint);

  document.addEventListener('input', e => { const sl = e.target.closest('.wi-sl'); if (!sl) return; const fr = frameOf(sl), Q = qcOf(fr), k = sl.closest('[data-wi]').dataset.wi, v = +sl.value / 100;
    if (k !== 'all') Q.wview = k[1] === 'l' ? 'L' : 'R'; (k === 'all' ? Object.keys(Q.wins) : [k]).forEach(n => Q.wins[n] = v); sl.style.setProperty('--p', sl.value + '%'); qcPaint(fr); });

  /* ---------- Appearance: Auto (device setting) · Light · Dark; portfolio toggle above the frame ---------- */
  const mq = window.matchMedia ? matchMedia('(prefers-color-scheme: dark)') : null;
  function themeApply(pref, save) {
    const d = document.documentElement, dark = pref === 'dark' || (pref === 'auto' && mq && mq.matches);
    d.dataset.pref = pref; d.dataset.theme = dark ? 'dark' : 'light';
    if (save) { try { localStorage.setItem('nio-theme', pref); } catch (e) {} }
    document.querySelectorAll('[data-theme-set]').forEach(x => x.classList.toggle('on', x.dataset.themeSet === pref));
    document.querySelectorAll('[data-theme-tg]').forEach(b => { b.querySelector('.ms').textContent = dark ? 'light_mode' : 'dark_mode'; b.querySelector('.tt').textContent = dark ? 'Light' : 'Dark'; });
  }
  if (mq) mq.addEventListener('change', () => { if (document.documentElement.dataset.pref === 'auto') themeApply('auto'); });
  document.addEventListener('click', e => {
    const s = e.target.closest('[data-theme-set]'); if (s) { themeApply(s.dataset.themeSet, true); return; }
    if (e.target.closest('[data-theme-tg]')) themeApply(document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark', true);
  });
  themeApply(document.documentElement.dataset.pref || 'auto');

  /* ---------- favourites, Pet Mode, calendar delete, 2048 keys, battery ---------- */
  document.addEventListener('click', e => {
    const fv = e.target.closest('.favb'); if (fv) { const fr = frameOf(fv), F = fr._fav || (fr._fav = new Set()), ti = fr.querySelector('.player .h3').textContent, ar = fr.querySelector('.player .b2').textContent;
      const add = !F.has(ti); add ? F.add(ti) : F.delete(ti); favList(fr); rowsPaint(fr); toast(fr, add ? `Added “${ti}” to Favourites` : `Removed “${ti}” from Favourites`); return; }
    const pt = e.target.closest('[data-pet]'); if (pt) { const fr = frameOf(pt), on = pt.dataset.pet === 'on'; pt.closest('.petw').classList.toggle('on', on);
      if (on) { const Q = qcOf(fr); Q.open = {}; Q.port = false; Object.keys(Q.wins).forEach(n => Q.wins[n] = 0); Q.shade = { l: false, r: false }; Q.wcard = false; Q.lock = true; qcPaint(fr);
        fr.querySelectorAll('.player').forEach(p => setPlaying(p, false)); fr.querySelectorAll('.ytbox.playing').forEach(b => { b.classList.remove('playing'); b.querySelector('iframe').src = 'about:blank'; });
        const C = clOf(fr); C.keep = 'pet'; C.t.Driver = C.t.Passenger = C.t['Rear left'] = C.t['Rear right'] = 21; clPaint(fr);
        toast(fr, 'Pet Mode on · everything closed and locked'); }
      else toast(fr, 'Pet Mode off'); return; }
    const ev = e.target.closest('[data-evi]'); if (ev) { const cw = ev.closest('.calw'); evSheet(cw, +ev.dataset.evi); return; }
    const ed = e.target.closest('[data-evdel]'); if (ed) { const cw = ed.closest('.calw'), i = +ed.dataset.evdel, gone = EVENTS.splice(i, 1)[0]; cw._undo = [i, gone];
      cw.querySelector('.ev-sheet').classList.remove('on'); calDraw(cw); toast(frameOf(cw), `Deleted “${gone.n}”`); return; }
    if (e.target.closest('[data-evx]')) { e.target.closest('.ev-sheet').classList.remove('on'); return; }
  });
  function favList(fr) {
    const F = fr._fav || new Set(); fr.querySelectorAll('[data-screen="media"] .favcard').forEach(c => c.remove());
    if (!F.size) return; const up = [...fr.querySelectorAll('[data-screen="media"] .card.scard')].find(c => /Up next/.test(c.textContent)); if (!up) return;
    const card = document.createElement('div'); card.className = 'card scard favcard';
    card.innerHTML = '<span class="lbl">Favourites</span>' + [...F].map(ti => { const s = SONGS.find(x => x[0] === ti) || [ti, '']; return `<div class="lrow" data-song="${s[0]}|${s[1]}" data-tap><div class="ph cov" style="width:44px;height:44px;border-radius:9px;${s[3] ? `background-image:url(${s[3]})` : ''}"></div><div class="col" style="gap:0;flex:1"><span class="b2" style="color:var(--t1)">${s[0]}</span><span class="bs">${s[1]}</span></div><span class="ms" style="font-size:28px;color:var(--t2)">play_circle</span></div>`; }).join('');
    up.parentElement.insertBefore(card, up); rowsPaint(fr);
  }
  function evSheet(cw, i) {
    const e = EVENTS[i]; if (!e) return; let sh = cw.querySelector('.ev-sheet');
    if (!sh) { sh = document.createElement('div'); sh.className = 'ev-sheet'; cw.appendChild(sh); }
    sh.innerHTML = `<div class="row" style="justify-content:space-between;align-items:center"><span class="lbl">Event</span><div class="sq-x" data-evx data-tap><span class="ms" style="font-size:22px">close</span></div></div><span class="h3">${e.n}</span><span class="bs">${e.t}${e.w ? ' · ' + e.w : ''}</span><div class="btn sec ev-del" data-evdel="${i}" data-tap><span class="ms" style="font-size:22px">delete</span><span>Delete event</span></div>`;
    sh.classList.add('on');
  }
  document.addEventListener('keydown', e => { const m = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' }[e.key]; if (!m) return;
    const w = [...document.querySelectorAll('.g2048')].find(x => x.offsetParent); if (!w) return; e.preventDefault(); g2048Move(w, m); });
  document.querySelectorAll('.frame').forEach(fr => rowsPaint(fr));

  /* ---------- Language: English · Français · Deutsch · Lëtzebuergesch (Settings › System) ---------- */
  const LANGS = { 'English': 'en', 'Français': 'fr', 'Deutsch': 'de', 'Lëtzebuergesch': 'lb' };
  let LANG = 'en'; try { LANG = localStorage.getItem('nio-lang') || 'en'; } catch (e) {}
  const ORIG = new WeakMap(), OUT = new WeakMap();
  const PAT = (window.I18P || []).map(([re, m]) => [new RegExp(re), m]);
  function tr1(k) {
    const d = (window.I18N || {})[LANG] || {}; if (d[k] != null) return d[k];
    for (const [re, m] of PAT) if (re.test(k)) return k.replace(re, m[LANG]);
    return null;
  }
  function tr(s) {
    if (LANG === 'en' || !s) return s; const k = s.replace(/\s+/g, ' ').trim(); if (!k || !/[A-Za-z]/.test(k)) return s;
    let r = tr1(k);
    if (r == null && k.includes(' · ')) { const parts = k.split(' · '), tp = parts.map(p => tr1(p) ?? p); if (tp.some((x, i) => x !== parts[i])) r = tp.join(' · '); }
    return r == null ? s : s.replace(k, r);
  }
  window.nioTr = tr; window.nioLang = () => LANG;
  const skip = n => { const p = n.parentElement; return !p || p.closest('.ms, script, style, [data-notr]'); };
  function trNode(n) {
    if (skip(n)) return; let o = ORIG.get(n);
    if (o == null || (OUT.has(n) && n.nodeValue !== OUT.get(n))) { o = n.nodeValue; ORIG.set(n, o); }
    const v = LANG === 'en' ? o : tr(o); OUT.set(n, v); if (n.nodeValue !== v) n.nodeValue = v;
  }
  function trAttr(el) { ['placeholder', 'aria-label', 'title'].forEach(a => { if (!el.hasAttribute || !el.hasAttribute(a)) return; const k = 'nioO' + a.replace('-', ''); if (el.dataset[k] == null) el.dataset[k] = el.getAttribute(a); el.setAttribute(a, LANG === 'en' ? el.dataset[k] : tr(el.dataset[k])); }); }
  function trTree(root) {
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n; while ((n = w.nextNode())) trNode(n);
    if (root.querySelectorAll) root.querySelectorAll('[placeholder],[aria-label],[title]').forEach(trAttr);
  }
  const MO = new MutationObserver(ms => { for (const m of ms) {
    if (m.type === 'characterData') { if (m.target.nodeValue !== OUT.get(m.target)) trNode(m.target); }
    else m.addedNodes.forEach(n => n.nodeType === 3 ? trNode(n) : n.nodeType === 1 && trTree(n)); } });
  function setLang(l, save) {
    LANG = l; document.documentElement.lang = { en: 'en', fr: 'fr', de: 'de', lb: 'lb' }[l];
    if (save) { try { localStorage.setItem('nio-lang', l); } catch (e) {} }
    document.querySelectorAll('[data-langopt] span').forEach(s => s.classList.toggle('on', LANGS[(ORIG.get(s.firstChild) || s.textContent).trim()] === l));
    document.querySelectorAll('.frame').forEach(trTree);
  }
  document.addEventListener('click', e => { const s = e.target.closest('[data-langopt] span'); if (!s) return; const l = LANGS[s.textContent.trim()]; if (l) setTimeout(() => setLang(l, true), 0); });
  document.querySelectorAll('.frame').forEach(fr => MO.observe(fr, { childList: true, subtree: true, characterData: true }));
  setLang(LANG);

  /* ---------- Brightness: Light only dims (50–100 %), Night has a little headroom (50–115 %) ---------- */
  function brightApply(fr, pct) {
    fr._bright = pct; const dark = document.documentElement.dataset.theme === 'dark';
    const v = dark ? 0.5 + pct / 100 * 0.65 : 0.5 + pct / 100 * 0.5;
    fr.style.filter = Math.abs(v - 1) < 0.005 ? '' : `brightness(${v.toFixed(3)})`;
  }
  window.nioBrightRefresh = () => document.querySelectorAll('.frame').forEach(fr => { const s = fr.querySelector('[data-bright]'); const pct = fr._bright ?? (s ? parseFloat(s.style.getPropertyValue('--v')) || 100 : 100); brightApply(fr, pct); });
  new MutationObserver(() => window.nioBrightRefresh()).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  document.querySelectorAll('.frame').forEach(fr => { const s = fr.querySelector('[data-bright]'); const d = document.documentElement.dataset.theme === 'dark'; const pct = d ? 77 : 100; if (s) s.style.setProperty('--v', pct + '%'); brightApply(fr, pct); });

  // no long-press menus inside the dashboard (text selection, copy/paste, assistant overlays)
  document.addEventListener('contextmenu', e => { if (e.target.closest('.frame') && !e.target.closest('input, textarea')) e.preventDefault(); });
  document.addEventListener('selectstart', e => { if (e.target.closest && e.target.closest('.frame') && !e.target.closest('input, textarea')) e.preventDefault(); });
  document.querySelectorAll('.frame img').forEach(i => i.draggable = false);
})();

/* camera feeds: the car seen at the edge of a view is tinted to the colour chosen in Settings › Display › Car colour */
const camTint = () => document.querySelectorAll('.camv:not([data-tinted])').forEach(c => { c.dataset.tinted = 1; const m = (c.getAttribute('style') || '').match(/img\/camera\/(blindspot-right|left|right)\.jpg(\?v=\d+)?/); if (!m) return;
  const t = document.createElement('i'); t.className = 'camtint'; const u = `img/camera/${m[1]}-car.png${m[2] || ''}`; t.style.webkitMaskImage = t.style.maskImage = `url(${u})`; c.appendChild(t); });
camTint(); new MutationObserver(camTint).observe(document.body, { childList: true, subtree: true });   /* the Camera app builds its grid when opened */
