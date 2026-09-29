/* Thesis "maguey" page: a single illustration that grows as you scroll.
   update(p) is a pure function of scroll progress, so it scrubs in both directions. */
(function () {
  'use strict';

  var d3 = window.d3;
  var root = document.documentElement;
  if (!d3) { root.classList.remove('js'); return; }

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var clamp = function (x, a, b) { a = a === undefined ? 0 : a; b = b === undefined ? 1 : b; return Math.min(b, Math.max(a, x)); };
  var seg = function (p, a, b) { return clamp((p - a) / (b - a)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var eio = d3.easeCubicInOut, eo = d3.easeCubicOut;
  var VAR = { read: 'var(--read)', write: 'var(--write)', run: 'var(--run)', error: 'var(--err)', ask: 'var(--ask)' };

  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ------------------------------------------------------------ the drawing (fixed coordinates, scaled by CSS) */
  var CX = 400, GY = 780, BY = 776, QTOP = 70, QH = BY - QTOP;
  var svg = d3.select('#art');
  var defs = svg.append('defs');

  var glow = defs.append('radialGradient').attr('id', 'glow');
  glow.append('stop').attr('offset', '0%').style('stop-color', 'var(--accent)').style('stop-opacity', 0.55);
  glow.append('stop').attr('offset', '100%').style('stop-color', 'var(--accent)').style('stop-opacity', 0);
  var clipRect = defs.append('clipPath').attr('id', 'qclip').append('rect').attr('x', 0).attr('y', 0).attr('width', 800).attr('height', 1000);

  // ground
  // the soil fades out at the sides so it reads as ground, not as a box
  var fade = function (id, color) {
    var g = defs.append('linearGradient').attr('id', id).attr('gradientUnits', 'userSpaceOnUse').attr('x1', 70).attr('x2', 730).attr('y1', 0).attr('y2', 0);
    [[0, 0], [0.16, 1], [0.84, 1], [1, 0]].forEach(function (s) { g.append('stop').attr('offset', s[0]).style('stop-color', color).style('stop-opacity', s[1]); });
  };
  fade('soilFade', 'var(--panel2)'); fade('lineFade', 'var(--line)');
  svg.append('rect').attr('x', 0).attr('y', GY).attr('width', 800).attr('height', 1000 - GY).style('fill', 'url(#soilFade)');
  svg.append('line').attr('x1', 0).attr('x2', 800).attr('y1', GY).attr('y2', GY).style('stroke', 'url(#lineFade)').style('stroke-width', 2);

  /* --- underground: the invisible process (a sequence of small steps) feeding the heart of the plant --- */
  var under = svg.append('g');
  var N = 26, cell = 17, gap = 5, sy = 918;
  var x0 = CX - (N * (cell + gap) - gap) / 2;
  var HEART = { x: CX, y: 838 };
  var cycle = ['write', 'run', 'error'];
  var types = d3.range(N).map(function (i) { return i < 3 || i % 7 === 0 ? 'read' : (i === N - 1 ? 'run' : cycle[(i - 3) % 3]); });
  var cells = d3.range(N).map(function (i) {
    return { i: i, x: x0 + i * (cell + gap) + cell / 2, type: types[i] };
  });

  var traceG = under.append('g');
  cells.forEach(function (c) {
    var d = 'M' + c.x + ',' + (sy - 6) + ' Q' + lerp(c.x, CX, 0.3) + ',' + (HEART.y + 60) + ' ' + HEART.x + ',' + (HEART.y + 14);
    c.path = traceG.append('path').attr('d', d).style('fill', 'none').style('stroke', 'var(--line)').style('stroke-width', 1.5);
    c.len = c.path.node().getTotalLength();
    c.dot = under.append('circle').attr('r', 4.5).style('fill', VAR[c.type]).style('stroke', 'var(--bg)').style('stroke-width', 1.2).attr('opacity', 0);
  });
  var glowC = under.append('circle').attr('cx', HEART.x).attr('cy', HEART.y).attr('r', 78).attr('fill', 'url(#glow)').attr('opacity', 0);
  var rings = [24, 34, 44, 54].map(function (r) {
    return under.append('circle').attr('cx', HEART.x).attr('cy', HEART.y).attr('r', r).style('fill', 'none').style('stroke', 'var(--accent)').style('stroke-width', 2).attr('opacity', 0);
  });
  var heart = under.append('circle').attr('cx', HEART.x).attr('cy', HEART.y).attr('r', 13).style('fill', 'var(--accent)');
  var stripG = under.append('g');
  cells.forEach(function (c) {
    c.rect = stripG.append('rect').attr('x', c.x - cell / 2).attr('y', sy).attr('width', cell).attr('height', cell).attr('rx', 3).style('fill', VAR[c.type]);
  });

  /* --- the quiote (flower stalk): real, and a dashed "ghost" of the finished result --- */
  var stemX = function (t) { return CX + 8 * Math.sin(t * 3.2); };
  var stemY = function (t) { return BY - QH * t; };
  var half = function (t) { return lerp(7, 2.2, t); };
  var ts = d3.range(0, 1.0001, 0.02);
  var stemPath = d3.line()(ts.map(function (t) { return [stemX(t) - half(t), stemY(t)]; }).concat(ts.slice().reverse().map(function (t) { return [stemX(t) + half(t), stemY(t)]; }))) + 'Z';
  var rq = rng(5);
  var branches = d3.range(9).map(function (j) {
    var t = 0.6 + j * 0.043, side = j % 2 ? 1 : -1, len = lerp(128, 40, j / 8);
    var bx = stemX(t), by = stemY(t), ex = bx + side * len, ey = by - len * 0.5;
    return { d: 'M' + bx + ',' + by + ' Q' + (bx + side * len * 0.55) + ',' + (by - len * 0.02) + ' ' + ex + ',' + ey, ex: ex, ey: ey, side: side };
  });
  var tops = { ex: stemX(1), ey: stemY(1) };
  var flowers = [];
  branches.concat([tops]).forEach(function (b, k) {
    var n = k === branches.length ? 5 : 4;
    for (var m = 0; m < n; m++) {
      flowers.push({ x: b.ex + (rq() - 0.5) * 16, y: b.ey + m * 8 - 4 + (rq() - 0.5) * 4, rx: 6 + rq() * 2.5, ry: 8 + rq() * 3 });
    }
  });

  function drawQuiote(g, ghost) {
    var stem = g.append('path').attr('d', stemPath);
    var br = g.append('g');
    branches.forEach(function (b) { br.append('path').attr('d', b.d).style('fill', 'none').style('stroke-width', ghost ? 1.5 : 3.2).style('stroke-linecap', 'round'); });
    var fl = g.append('g');
    flowers.forEach(function (f) { fl.append('ellipse').attr('cx', f.x).attr('cy', f.y).attr('rx', f.rx).attr('ry', f.ry); });
    if (ghost) {
      [stem, br.selectAll('path'), fl.selectAll('ellipse')].forEach(function (s) { s.style('fill', 'none').style('stroke', 'var(--muted)').style('stroke-width', 1.5).style('stroke-dasharray', '4 5'); });
    } else {
      stem.style('fill', 'var(--stem)');
      br.selectAll('path').style('stroke', 'var(--stem)');
      fl.selectAll('ellipse').style('fill', 'var(--bloom)');
    }
    return { fl: fl };
  }
  var ghost = svg.append('g').attr('opacity', 0);
  drawQuiote(ghost, true);
  var real = svg.append('g').attr('clip-path', 'url(#qclip)');
  var realParts = drawQuiote(real, false);
  var blooms = realParts.fl;

  /* --- the rosette of leaves: one leaf per step of the sequence --- */
  var rl = rng(11), NL = 26;
  var leaves = svg.append('g').attr('transform', 'translate(' + CX + ',' + BY + ')');
  var leafData = d3.range(NL).map(function (i) {
    var f = i / (NL - 1), side = i % 2 ? 1 : -1;
    var spread = lerp(82, 6, Math.pow(f, 0.8)), th = (side * (spread + (rl() - 0.5) * 8)) * Math.PI / 180;
    var L = lerp(255, 118, Math.pow(f, 0.9)) * (0.92 + rl() * 0.16), w = lerp(30, 15, f) * (0.9 + rl() * 0.2);
    var droop = Math.max(0, Math.abs(th * 180 / Math.PI) - 40) / 40 * 58 * (L / 255);
    var tip = [Math.sin(th) * L, -Math.cos(th) * L + droop], mid = [tip[0] * 0.5, tip[1] * 0.5 - droop * 0.2];
    var nl = Math.hypot(tip[0], tip[1]), n = [-tip[1] / nl, tip[0] / nl];
    var c1 = [mid[0] + n[0] * w, mid[1] + n[1] * w], c2 = [mid[0] - n[0] * w, mid[1] - n[1] * w];
    return { f: f, d: 'M0,0 Q' + c1 + ' ' + tip + ' Q' + c2 + ' 0,0Z', rib: 'M0,0 L' + [tip[0] * 0.9, tip[1] * 0.9 + 0], tone: f < 0.34 ? 'var(--leaf-a)' : f < 0.67 ? 'var(--leaf-b)' : 'var(--leaf-c)' };
  });
  leafData.forEach(function (l) {
    l.g = leaves.append('g');
    l.g.append('path').attr('d', l.d).style('fill', l.tone);
    l.g.append('path').attr('d', l.rib).style('fill', 'none').style('stroke', 'var(--bg)').style('stroke-opacity', 0.28).style('stroke-width', 1.4);
  });

  /* --- the stake (support) --- */
  var stake = svg.append('g').attr('opacity', 0);
  var stakeX = CX + 32;
  var stakeRect = stake.append('rect').attr('x', stakeX - 2.5).attr('width', 5).attr('rx', 2.5).style('fill', 'var(--ask)');
  var ties = d3.range(1, 5).map(function (m) {
    var y = BY - m * 95, t = (BY - y) / QH;
    var line = stake.append('line').attr('x1', stemX(t) + half(t)).attr('x2', stakeX).attr('y1', y).attr('y2', y).style('stroke', 'var(--ask)').style('stroke-width', 2.6).style('stroke-linecap', 'round');
    return { y: y, line: line };
  });

  /* ------------------------------------------------------------ scroll -> picture */
  var last = null;
  function update(p) {
    var a0 = seg(p, 0.10, 0.18), kL = seg(p, 0.18, 0.42), kT = seg(p, 0.44, 0.68), kG = eio(seg(p, 0.70, 0.90)), kB = seg(p, 0.90, 0.98);
    var early = p < 0.5;

    under.attr('opacity', seg(p, 0.14, 0.22));

    ghost.attr('opacity', 0.6 * a0 * (1 - seg(kG, 0.85, 1)));
    real.attr('opacity', early ? 1 - a0 : seg(p, 0.70, 0.73));
    clipRect.attr('y', early ? 0 : lerp(BY, QTOP - 30, kG));
    blooms.attr('opacity', early ? 1 : kB);

    // leaves and their matching steps in the sequence
    leafData.forEach(function (l, i) {
      var s = eo(seg(kL, (i / NL) * 0.8, (i / NL) * 0.8 + 0.2));
      l.g.attr('transform', 'scale(' + s + ')').attr('opacity', s);
      cells[i].rect.attr('opacity', s);
    });

    // traces flowing into the heart
    var arrived = 0;
    cells.forEach(function (c, i) {
      var u = eio(seg(kT, (i / N) * 0.7, (i / N) * 0.7 + 0.3));
      c.path.attr('opacity', seg(kT, 0, 0.1));
      if (u >= 1) arrived++;
      if (u > 0 && u < 1) {
        var pt = c.path.node().getPointAtLength(u * c.len);
        c.dot.attr('cx', pt.x).attr('cy', pt.y).attr('opacity', 1);
      } else c.dot.attr('opacity', 0);
    });
    var A = arrived / N;
    glowC.attr('opacity', seg(kT, 0, 0.3) * (1 - 0.6 * seg(p, 0.7, 0.8)));
    heart.attr('r', 13 + 7 * A);
    rings.forEach(function (r, j) { r.attr('opacity', seg(kT, 0.25 + 0.15 * j, 0.4 + 0.15 * j) * (1 - 0.5 * seg(p, 0.7, 0.8))); });

    // stake: rises with the stem, then lets go
    var top = Math.min(lerp(BY, QTOP, kG) + 30, BY - 360);
    stake.attr('opacity', seg(p, 0.70, 0.73) * (1 - seg(p, 0.86, 0.93)));
    stakeRect.attr('y', top).attr('height', BY - top);
    ties.forEach(function (t) { t.line.attr('opacity', t.y > top + 8 ? 1 : 0); });
    last = p;
  }

  /* ------------------------------------------------------------ scroll engine */
  var header = document.getElementById('hdr');
  var story = document.getElementById('story');
  var sticky = story.querySelector('.sticky');
  var acts = Array.prototype.slice.call(story.querySelectorAll('.act'));
  var dotsEl = story.querySelector('.dots');
  var dots = acts.map(function () { var i = document.createElement('i'); dotsEl.appendChild(i); return i; });
  var progressBar = document.getElementById('progress');
  var stageLinks = Array.prototype.slice.call(document.querySelectorAll('.stages a'));
  var BOUNDS = [0, 0.16, 0.44, 0.70, 0.90];
  var cur = 0, actIdx = -1, scheduled = false;

  function target() {
    var r = story.getBoundingClientRect(), span = r.height - sticky.offsetHeight;
    return span > 0 ? clamp((header.offsetHeight - r.top) / span) : 0;
  }
  function request() { if (!scheduled) { scheduled = true; requestAnimationFrame(frame); } }
  function frame() {
    scheduled = false;
    var t = target(), d = t - cur, more = false;
    if (reduce || Math.abs(d) < 0.0006) cur = t; else { cur += d * 0.16; more = true; }
    if (last === null || Math.abs(cur - last) > 1e-5) update(cur);
    var idx = 0; BOUNDS.forEach(function (b, i) { if (cur >= b) idx = i; });
    if (idx !== actIdx) {
      actIdx = idx;
      acts.forEach(function (a, i) { a.classList.toggle('on', i === idx); });
      dots.forEach(function (x, i) { x.classList.toggle('on', i === idx); });
    }
    stageLinks.forEach(function (a) { a.classList.toggle('on', Number(a.dataset.stage) === idx && idx >= 1 && idx <= 3); });
    var total = document.documentElement.scrollHeight - window.innerHeight;
    progressBar.style.transform = 'scaleX(' + (total > 0 ? clamp(window.scrollY / total) : 0) + ')';
    if (more) request();
  }
  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', request);

  stageLinks.forEach(function (a) {
    a.addEventListener('click', function (e) {
      e.preventDefault();
      var r = story.getBoundingClientRect(), span = r.height - sticky.offsetHeight;
      var y = window.scrollY + r.top - header.offsetHeight + Number(a.dataset.p) * span;
      window.scrollTo({ top: y, behavior: reduce ? 'auto' : 'smooth' });
    });
  });

  /* ------------------------------------------------------------ language */
  var TITLES = { en: 'Sequences in Data to Represent Learning Processes | Manuel Valle Torre', es: 'Secuencias en datos para representar procesos de aprendizaje | Manuel Valle Torre' };
  var DESCS = {
    en: 'A short, calm visual story of a PhD thesis: a maguey that grows, and the learning process nobody sees.',
    es: 'Una historia visual breve y tranquila de una tesis doctoral: un maguey que crece y el proceso de aprendizaje que nadie ve.'
  };
  var ALT = {
    en: 'A maguey grows as you scroll. First only the tall flower stalk is visible; then the hidden growth beneath it appears, a sequence of small steps feeding the heart of the plant; finally a stake supports the young stalk until it can stand alone and bloom.',
    es: 'Un maguey crece mientras haces scroll. Primero solo se ve el quiote; luego aparece el crecimiento oculto bajo la tierra, una secuencia de pasos pequeños que alimenta el corazón de la planta; al final una estaca sostiene el tallo joven hasta que puede sostenerse solo y florecer.'
  };
  var langBtns = document.querySelectorAll('[data-set-lang]');
  function applyLang(l, persist) {
    var lang = l === 'es' ? 'es' : 'en';
    root.dataset.lang = lang; root.lang = lang;
    document.title = TITLES[lang];
    var md = document.querySelector('meta[name="description"]'); if (md) md.setAttribute('content', DESCS[lang]);
    langBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.setLang === lang)); });
    svg.attr('aria-label', ALT[lang]);
    if (persist) {
      try { localStorage.setItem('thesis-lang', lang); } catch (e) {}
      var url = new URL(location.href);
      if (lang === 'es') url.searchParams.set('lang', 'es'); else url.searchParams.delete('lang');
      history.replaceState(null, '', url);
    }
  }
  langBtns.forEach(function (b) { b.addEventListener('click', function () { applyLang(b.dataset.setLang, true); }); });
  applyLang(root.dataset.lang, false);

  cur = target(); update(cur); request();
})();
