/* Thesis scroll page: scroll-driven d3 scenes.
   Every scene is a pure function of scroll progress p in [0,1]: update(p) redraws the state,
   so scrolling (or swiping) back and forth scrubs the animation in both directions. */
(function () {
  'use strict';

  var d3 = window.d3;
  var root = document.documentElement;
  if (!d3) { root.classList.remove('js'); return; }

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var clamp = function (x, a, b) { a = a === undefined ? 0 : a; b = b === undefined ? 1 : b; return Math.min(b, Math.max(a, x)); };
  var seg = function (p, a, b) { return clamp((p - a) / (b - a)); };
  var lerp = function (a, b, t) { return a + (b - a) * t; };
  var eio = d3.easeCubicInOut;
  var VAR = { read: 'var(--read)', write: 'var(--write)', run: 'var(--run)', error: 'var(--err)', ask: 'var(--ask)', final: 'var(--fg)' };

  /* small seeded PRNG so the "illustrative" data is the same on every load */
  function rng(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  /* ---------------------------------------------------------------- i18n (text inside visualizations) */
  var lang = root.dataset.lang === 'es' ? 'es' : 'en';
  var I18N = {
    en: {
      alt_problem: 'Two students hand in identical work, but one struggled through many attempts while the other pasted an AI answer.',
      alt_analyze: 'Rows of learner action sequences unfold from a single final-product square into visible trial and error, then group into three patterns.',
      alt_understand: 'Traces from a Jupyter notebook flow into a learner context, which lets an AI tutor answer with a hint instead of the solution.',
      alt_support: 'Two lanes compare a student’s own effort over a session: it fades with an answer machine and is sustained with well-timed nudges; the AI’s support fades as the learner gains confidence.',
      stuA: 'Student A', stuB: 'Student B',
      pathA: 'Tries, fails, tries again', pathB: 'Asks an AI, pastes the answer',
      same: 'Same result', lens: 'Only the process tells the story',
      finalLbl: 'Final product', noteAnalyze: 'Illustrative example, not real data',
      read: 'Read / plan', write: 'Write code', run: 'Run', error: 'Error', ask: 'Ask AI',
      g0: 'Plan first', g1: 'Trial and error', g2: 'Delegate to AI',
      nb: 'Jupyter notebook', cx: 'Learner context', tutor: 'AI tutor',
      m_runs: 'Runs', m_err: 'Errors', m_edit: 'Edits',
      hint: 'A hint, not the answer',
      q: 'Why does this keep failing?',
      a: 'You’ve run this cell 3 times and hit the same KeyError. What columns does your data actually have?',
      noteUnderstand: 'Simplified illustration',
      laneV: 'Answer machine', laneG: 'Guided conversation',
      leffort: 'Student’s own effort', lans: 'Full answer from AI', lnudge: 'Nudge (hint, question, encouragement)', lsupport: 'AI support level',
      endV: 'Depends on the answers', endG: 'Keeps thinking for themselves',
      supA: 'Needs more help', supB: 'Gains confidence quickly',
      time: 'time in the session →', noteSupport: 'Conceptual illustration'
    },
    es: {
      alt_problem: 'Dos estudiantes entregan trabajos idénticos, pero uno pasó por muchos intentos y la otra pegó la respuesta de una IA.',
      alt_analyze: 'Filas con las secuencias de acciones de cada estudiante se despliegan desde un cuadrito de resultado final hasta mostrar el ensayo y error, y luego se agrupan en tres patrones.',
      alt_understand: 'Los rastros de un notebook de Jupyter fluyen hacia un contexto del estudiante, lo que permite que un tutor de IA responda con una pista en lugar de la solución.',
      alt_support: 'Dos carriles comparan el esfuerzo propio del estudiante durante una sesión: se apaga con una máquina de respuestas y se mantiene con empujoncitos a tiempo; el apoyo de la IA se retira conforme cada estudiante gana confianza.',
      stuA: 'Estudiante A', stuB: 'Estudiante B',
      pathA: 'Prueba, falla, vuelve a intentar', pathB: 'Le pide la respuesta a una IA y la pega',
      same: 'Mismo resultado', lens: 'Solo el proceso cuenta la historia',
      finalLbl: 'Resultado final', noteAnalyze: 'Ejemplo ilustrativo, no son datos reales',
      read: 'Leer / planear', write: 'Escribir código', run: 'Ejecutar', error: 'Error', ask: 'Preguntar a la IA',
      g0: 'Planean primero', g1: 'Ensayo y error', g2: 'Delegan a la IA',
      nb: 'Notebook de Jupyter', cx: 'Contexto del estudiante', tutor: 'Tutor de IA',
      m_runs: 'Ejecuciones', m_err: 'Errores', m_edit: 'Ediciones',
      hint: 'Una pista, no la respuesta',
      q: '¿Por qué me sigue fallando?',
      a: 'Ya corriste esta celda 3 veces y sale el mismo KeyError. ¿Qué columnas tiene realmente tu tabla?',
      noteUnderstand: 'Ilustración simplificada',
      laneV: 'Máquina de respuestas', laneG: 'Conversación guiada',
      leffort: 'Esfuerzo propio del estudiante', lans: 'Respuesta completa de la IA', lnudge: 'Empujoncito (pista, pregunta, ánimo)', lsupport: 'Nivel de apoyo de la IA',
      endV: 'Depende de las respuestas', endG: 'Sigue pensando por sí mismo',
      supA: 'Necesita más ayuda', supB: 'Gana confianza rápido',
      time: 'tiempo en la sesión →', noteSupport: 'Ilustración conceptual'
    }
  };
  var T = function (k) { return I18N[lang][k]; };

  /* ---------------------------------------------------------------- shared helpers */
  function mkSvg(el, W, H, altKey) {
    var host = d3.select(el);
    host.selectAll('svg,.overlay').remove();
    el.setAttribute('aria-label', T(altKey));
    return host.append('svg').attr('width', W).attr('height', H).attr('viewBox', '0 0 ' + W + ' ' + H)
      .attr('aria-hidden', 'true').style('display', 'block').style('overflow', 'visible');
  }

  function makeTx(texts) {
    return function (g, key, x, y, o) {
      o = o || {};
      var s = g.append('text').attr('x', x).attr('y', y)
        .attr('text-anchor', o.anchor || 'start')
        .style('font-size', (o.size || 12) + 'px')
        .style('font-weight', o.weight || 500)
        .style('fill', o.fill || 'var(--muted)')
        .style('font-family', o.mono ? 'var(--mono)' : 'var(--sans)')
        .style('text-transform', o.upper ? 'uppercase' : null)
        .style('letter-spacing', o.ls || null)
        .text(T(key));
      texts.push({ s: s, key: key });
      return s;
    };
  }

  /* legend that wraps to several lines and re-measures when the language changes */
  function makeLegend(g, items, W, fs, lineH) {
    var els = items.map(function (it) {
      var e = g.append('g');
      it.icon(e.append('g'));
      var t = e.append('text').attr('x', it.iconW + 6).attr('y', 4)
        .style('font-size', fs + 'px').style('fill', 'var(--muted)').style('font-family', 'var(--sans)').style('font-weight', 500);
      return { e: e, t: t, it: it };
    });
    function layout() {
      var x = 0, y = 0, x0 = 0;
      els.forEach(function (o) {
        o.t.text(T(o.it.key));
        var w = o.it.iconW + 6 + o.t.node().getComputedTextLength() + 16;
        if (x + w - 16 > W - 16 && x > x0) { x = x0; y += lineH; }
        o.e.attr('transform', 'translate(' + x + ',' + y + ')');
        x += w;
      });
    }
    layout();
    return { els: els, layout: layout };
  }

  function wireRelang(texts, extra) {
    return function () {
      texts.forEach(function (o) { o.s.text(T(o.key)); });
      if (extra) extra();
    };
  }

  /* ================================================================ SCENE 0 · the problem */
  function vizProblem(el, W, H) {
    var svg = mkSvg(el, W, H, 'alt_problem');
    var texts = [], tx = makeTx(texts);
    var narrow = W < 520, fs = narrow ? 11 : 12.5;
    var docW = narrow ? 44 : 64, docH = Math.round(docW * 1.28);
    var xDoc = W - docW - 4;
    var laneY = [H * 0.27, H * 0.73];
    var amp = Math.min(H * 0.14, 58);
    var xs = 6, xe = xDoc - (narrow ? 12 : 22);
    var r = rng(7);

    var A_TYPES = ['read', 'write', 'run', 'error', 'write', 'run', 'error', 'write', 'run', 'error', 'write', 'run'];
    var nA = A_TYPES.length;
    var ptsA = d3.range(nA).map(function (i) {
      var f = i / (nA - 1), first = i === 0, last = i === nA - 1;
      var back = (!last && !first && i % 3 === 2) ? -(0.03 + r() * 0.02) * (xe - xs) : 0;
      return [xs + 10 + (xe - xs - 10) * f + back, laneY[0] + (last ? 0 : (r() * 2 - 1) * amp * (first ? 0.3 : 1))];
    });
    var line = d3.line().curve(d3.curveCatmullRom.alpha(0.6));

    var defs = svg.append('defs');
    var clipA = defs.append('clipPath').attr('id', 'pv-clipA').append('rect').attr('x', 0).attr('y', 0).attr('height', H).attr('width', 0);
    var clipB = defs.append('clipPath').attr('id', 'pv-clipB').append('rect').attr('x', 0).attr('y', 0).attr('height', H).attr('width', 0);

    // lane guides
    laneY.forEach(function (y) {
      svg.append('line').attr('x1', xs).attr('x2', xe).attr('y1', y).attr('y2', y).style('stroke', 'var(--line)').style('stroke-dasharray', '2 5').style('opacity', 0.7);
    });

    var gA = svg.append('g').attr('clip-path', 'url(#pv-clipA)');
    gA.append('path').attr('d', line(ptsA)).style('fill', 'none').style('stroke', 'var(--fg)').style('stroke-width', 2);
    gA.selectAll('circle').data(ptsA).join('circle').attr('cx', function (d) { return d[0]; }).attr('cy', function (d) { return d[1]; })
      .attr('r', narrow ? 4 : 5).style('fill', function (d, i) { return VAR[A_TYPES[i]]; })
      .style('stroke', 'var(--bg)').style('stroke-width', 1.5);

    var gB = svg.append('g').attr('clip-path', 'url(#pv-clipB)');
    gB.append('line').attr('x1', xs + 10).attr('x2', xe).attr('y1', laneY[1]).attr('y2', laneY[1])
      .style('stroke', 'var(--muted)').style('stroke-width', 2).style('stroke-dasharray', '5 6');
    [['ask', xs + 10], ['write', xs + 10 + (narrow ? 22 : 34)]].forEach(function (d) {
      gB.append('circle').attr('cx', d[1]).attr('cy', laneY[1]).attr('r', narrow ? 4 : 5)
        .style('fill', VAR[d[0]]).style('stroke', 'var(--bg)').style('stroke-width', 1.5);
    });
    gB.append('circle').attr('cx', xe).attr('cy', laneY[1]).attr('r', narrow ? 4 : 5).style('fill', 'var(--muted)').style('stroke', 'var(--bg)').style('stroke-width', 1.5);

    var names = svg.append('g');
    tx(names, 'stuA', xs, laneY[0] - amp - 12, { mono: 1, size: 11, weight: 700, upper: 1, ls: '.06em' });
    tx(names, 'stuB', xs, laneY[1] - amp - 12, { mono: 1, size: 11, weight: 700, upper: 1, ls: '.06em' });
    var pathLbl = svg.append('g');
    tx(pathLbl, 'pathA', xs, laneY[0] + amp + 22, { size: fs, weight: 600, fill: 'var(--fg)' });
    tx(pathLbl, 'pathB', xs, laneY[1] + 26, { size: fs, weight: 600, fill: 'var(--fg)' });

    // identical final documents
    var docs = svg.append('g');
    laneY.forEach(function (cy) {
      var g = docs.append('g').attr('transform', 'translate(' + xDoc + ',' + (cy - docH / 2) + ')');
      g.append('rect').attr('width', docW).attr('height', docH).attr('rx', 5).style('fill', 'var(--panel)').style('stroke', 'var(--fg)').style('stroke-width', 1.6);
      [0.2, 0.34, 0.48, 0.62].forEach(function (f, i) {
        g.append('rect').attr('x', docW * 0.16).attr('y', docH * f).attr('width', docW * (i === 3 ? 0.4 : 0.68)).attr('height', 3.5).attr('rx', 1.75).style('fill', 'var(--line)');
      });
      g.append('circle').attr('cx', docW - 3).attr('cy', docH - 3).attr('r', 9).style('fill', 'var(--run)');
      g.append('path').attr('d', 'M-4,0 l3,3.2 l5.5,-6.4').attr('transform', 'translate(' + (docW - 3) + ',' + (docH - 3) + ')').style('fill', 'none').style('stroke', '#fff').style('stroke-width', 2).style('stroke-linecap', 'round').style('stroke-linejoin', 'round');
    });
    var eq = svg.append('g');
    eq.append('text').attr('x', xDoc + docW / 2).attr('y', H / 2).attr('text-anchor', 'middle').attr('dominant-baseline', 'central')
      .style('font-size', '30px').style('font-weight', 800).style('fill', 'var(--accent)').text('=');
    tx(eq, 'same', W - 4, H / 2 + 26, { anchor: 'end', size: fs, weight: 700, fill: 'var(--accent)' });

    var lens = tx(svg, 'lens', (xs + xe) / 2, H / 2 + 6, { anchor: 'middle', size: fs + 3, weight: 800, fill: 'var(--accent)' });

    function update(p) {
      var out = seg(p, 0.78, 0.92);
      docs.attr('opacity', seg(p, 0, 0.14) * (1 - 0.65 * out));
      eq.attr('opacity', seg(p, 0.1, 0.24) * (1 - out));
      clipA.attr('width', (xe + 12) * eio(seg(p, 0.36, 0.62)));
      clipB.attr('width', (xe + 12) * eio(seg(p, 0.4, 0.54)));
      names.attr('opacity', seg(p, 0.34, 0.44));
      pathLbl.attr('opacity', seg(p, 0.62, 0.74));
      lens.attr('opacity', seg(p, 0.8, 0.95));
    }
    return { update: update, relang: wireRelang(texts) };
  }

  /* ================================================================ SCENE 1 · observe / analyze */
  function vizAnalyze(el, W, H) {
    var svg = mkSvg(el, W, H, 'alt_analyze');
    var texts = [], tx = makeTx(texts);
    var narrow = W < 520, fs = narrow ? 10.5 : 12;
    var r = rng(23);

    var gen = {
      plan: function () { var s = [], nr = 2 + Math.floor(r() * 3), i; for (i = 0; i < nr; i++) s.push('read'); s.push('write', 'write', 'run'); if (r() < 0.6) s.push('error', 'write', 'run'); s.push('write', 'run'); return s; },
      trial: function () { var s = [], reps = 5 + Math.floor(r() * 2), i; if (r() < 0.5) s.push('read'); for (i = 0; i < reps; i++) s.push('write', 'run', 'error'); s.push('write', 'run'); return s; },
      delegate: function () { var s = ['ask']; if (r() < 0.5) s.push('ask'); s.push('write', 'run'); if (r() < 0.4) s.push('ask'); return s; }
    };
    var archs = ['plan', 'trial', 'delegate'];
    var rows = [];
    archs.forEach(function (a, ai) { d3.range(5).forEach(function () { rows.push({ arch: ai, seq: gen[a]().concat('final') }); }); });
    var order = d3.shuffler(rng(5))(d3.range(rows.length));
    order.forEach(function (ri, pos) { rows[ri].flatIdx = pos; });
    archs.forEach(function (a, ai) { rows.filter(function (x) { return x.arch === ai; }).forEach(function (x, i) { x.gIdx = i; }); });
    var n = rows.length, Lmax = d3.max(rows, function (x) { return x.seq.length; });

    var x0 = 8, x1 = W - 8;
    var cw = Math.min(narrow ? 16 : 38, (x1 - x0) / Lmax);
    var topPad = 26, legendRows = narrow ? 2 : 1, lineH = 18, legendH = legendRows * lineH + 8;
    var chartTop = topPad, chartBot = H - legendH - 6, availH = chartBot - chartTop;
    var flatPitch = Math.min(availH / n, narrow ? 26 : 34);
    var gh = 20, gap = 8;
    var grpPitch = Math.min(flatPitch, (availH - 3 * gh - 2 * gap) / n);
    var ch = Math.max(4, Math.min(narrow ? 16 : 22, Math.min(flatPitch, grpPitch) * 0.72));
    var flatOff = (availH - flatPitch * n) / 2;
    var grpTotal = 3 * gh + 2 * gap + n * grpPitch, grpOff = (availH - grpTotal) / 2;
    rows.forEach(function (rw) {
      rw.yFlat = chartTop + flatOff + rw.flatIdx * flatPitch + flatPitch / 2;
      rw.yGrp = chartTop + grpOff + rw.arch * (gh + 5 * grpPitch + gap) + gh + rw.gIdx * grpPitch + grpPitch / 2;
    });

    // annotations
    var topLbl = tx(svg, 'finalLbl', x1, chartTop - 10, { anchor: 'end', mono: 1, size: 10.5, weight: 700, upper: 1, ls: '.06em', fill: 'var(--fg)' });
    var note = tx(svg, 'noteAnalyze', x0, chartTop - 10, { size: 10.5, fill: 'var(--muted)' });

    // group labels + hairlines
    var groups = svg.append('g');
    archs.forEach(function (a, ai) {
      var gy = chartTop + grpOff + ai * (gh + 5 * grpPitch + gap);
      tx(groups, 'g' + ai, x0, gy + gh - 6, { mono: 1, size: 11, weight: 700, upper: 1, ls: '.06em', fill: 'var(--accent)' });
      groups.append('line').attr('x1', x0).attr('x2', x1).attr('y1', gy + gh - 2).attr('y2', gy + gh - 2).style('stroke', 'var(--line)');
    });

    // rows of cells
    var rowLayer = svg.append('g');
    rows.forEach(function (rw) {
      rw.g = rowLayer.append('g');
      rw.cells = rw.g.selectAll('rect').data(rw.seq).join('rect')
        .attr('x', function (d, j) { return x1 - (rw.seq.length - j) * cw + 1; })
        .attr('y', -ch / 2).attr('width', cw - 2).attr('height', ch).attr('rx', 2)
        .style('fill', function (d) { return VAR[d]; });
      rw.cellNodes = rw.cells.nodes();
    });

    // legend
    var sq = function (c) { return function (g) { g.append('rect').attr('x', 0).attr('y', -5).attr('width', 10).attr('height', 10).attr('rx', 2).style('fill', VAR[c]); }; };
    var legendG = svg.append('g').attr('transform', 'translate(' + x0 + ',' + (chartBot + 16) + ')');
    var legend = makeLegend(legendG, [
      { key: 'read', icon: sq('read'), iconW: 10 }, { key: 'write', icon: sq('write'), iconW: 10 },
      { key: 'run', icon: sq('run'), iconW: 10 }, { key: 'error', icon: sq('error'), iconW: 10 }, { key: 'ask', icon: sq('ask'), iconW: 10 }
    ], W - 2 * x0, fs, lineH);

    function update(p) {
      var appear = seg(p, 0, 0.16), u = seg(p, 0.3, 0.66), g = eio(seg(p, 0.7, 0.92));
      rows.forEach(function (rw) {
        var op = clamp(appear * 1.6 - (rw.flatIdx / n) * 0.6);
        rw.g.attr('transform', 'translate(0,' + lerp(rw.yFlat, rw.yGrp, g) + ')');
        var len = rw.seq.length;
        for (var j = 0; j < len; j++) {
          var o = j === len - 1 ? op : clamp((u - (0.55 * (len - 1 - j) / (Lmax - 1) + 0.3 * (rw.flatIdx / n))) / 0.1);
          var node = rw.cellNodes[j];
          node.setAttribute('opacity', o);
          node.setAttribute('transform', 'translate(' + ((1 - o) * 10) + ',0)');
        }
      });
      topLbl.attr('opacity', seg(p, 0, 0.1) * (1 - seg(p, 0.3, 0.42)));
      note.attr('opacity', seg(p, 0, 0.1));
      legendG.attr('opacity', seg(p, 0.3, 0.45));
      groups.attr('opacity', seg(p, 0.8, 0.95));
    }
    return { update: update, relang: wireRelang(texts, legend.layout) };
  }

  /* ================================================================ SCENE 2 · understand (JELAI) */
  function vizUnderstand(el, W, H) {
    var svg = mkSvg(el, W, H, 'alt_understand');
    var host = d3.select(el);
    var texts = [], tx = makeTx(texts);
    var vertical = W < 560;
    var fs = vertical ? 10.5 : 11.5;

    var B = vertical
      ? (function () {
          var nbH = H * 0.32, chH = H * 0.36, cxH = Math.min(96, H * 0.24), gapH = H - nbH - chH;
          return { nb: { x: 0, y: 0, w: W, h: nbH }, cx: { x: W * 0.06, y: nbH + (gapH - cxH) / 2, w: W * 0.88, h: cxH }, ch: { x: 0, y: H - chH, w: W, h: chH } };
        })()
      : (function () {
          var hh = Math.min(H * 0.88, 420), top = (H - hh) / 2, cxh = Math.min(hh * 0.68, 250);
          return { nb: { x: 0, y: top, w: W * 0.33, h: hh }, cx: { x: W * 0.375, y: top + (hh - cxh) / 2, w: W * 0.26, h: cxh }, ch: { x: W * 0.68, y: top, w: W * 0.32, h: hh } };
        })();

    var panel = function (b) {
      return svg.append('rect').attr('x', b.x).attr('y', b.y).attr('width', b.w).attr('height', b.h).attr('rx', 10)
        .style('fill', 'var(--panel)').style('stroke', 'var(--line)').style('stroke-width', 1.5).style('transition', 'stroke .3s');
    };
    var pNB = panel(B.nb), pCX = panel(B.cx), pCH = panel(B.ch);
    var title = { mono: 1, size: 10.5, weight: 700, upper: 1, ls: '.08em' };
    tx(svg, 'nb', B.nb.x + 12, B.nb.y + 17, title);
    tx(svg, 'cx', B.cx.x + 12, B.cx.y + 17, title);
    if (!vertical) tx(svg, 'noteUnderstand', W / 2, B.nb.y + B.nb.h + 22, { anchor: 'middle', size: 10.5 });

    // connectors
    var nb2cx = vertical ? [[B.cx.x + B.cx.w / 2, B.nb.y + B.nb.h], [B.cx.x + B.cx.w / 2, B.cx.y]] : [[B.nb.x + B.nb.w, B.nb.y + B.nb.h / 2], [B.cx.x, B.cx.y + B.cx.h / 2]];
    var cx2ch = vertical ? [[B.cx.x + B.cx.w / 2, B.cx.y + B.cx.h], [B.cx.x + B.cx.w / 2, B.ch.y]] : [[B.cx.x + B.cx.w, B.cx.y + B.cx.h / 2], [B.ch.x, B.ch.y + B.ch.h / 2]];
    [nb2cx, cx2ch].forEach(function (c) {
      svg.append('line').attr('x1', c[0][0]).attr('y1', c[0][1]).attr('x2', c[1][0]).attr('y2', c[1][1])
        .style('stroke', 'var(--line)').style('stroke-width', 2).style('stroke-dasharray', '3 5');
    });

    // notebook cells
    var nbTop = B.nb.y + 26, nbAvail = B.nb.h - 26 - 8, cg = vertical ? 4 : 7;
    var cellH = (nbAvail - 3 * cg) / 4;
    var codeRnd = rng(3);
    var cells = d3.range(4).map(function (i) {
      var y = nbTop + i * (cellH + cg), x = B.nb.x + 8, w = B.nb.w - 16;
      var g = svg.append('g');
      var rect = g.append('rect').attr('x', x).attr('y', y).attr('width', w).attr('height', cellH).attr('rx', 5)
        .style('fill', 'var(--panel2)').style('stroke', 'var(--line)');
      var strip = g.append('rect').attr('x', x).attr('y', y).attr('width', 4).attr('height', cellH).attr('rx', 2).style('fill', 'var(--line)');
      var dot = g.append('circle').attr('cx', x + w - 14).attr('cy', y + cellH / 2).attr('r', 4.5).style('fill', 'transparent');
      g.append('text').attr('x', x + 12).attr('y', y + cellH / 2 + 3.5).style('font-family', 'var(--mono)').style('font-size', '9.5px').style('fill', 'var(--muted)').text('In [' + (i + 1) + ']');
      var bx = x + (vertical ? 52 : 58), bw = w - (bx - x) - 28;
      var two = cellH >= 26;
      [0, 1].slice(0, two ? 2 : 1).forEach(function (k) {
        g.append('rect').attr('x', bx).attr('y', two ? y + cellH / 2 - 8 + k * 11 : y + cellH / 2 - 2.5).attr('width', bw * (0.45 + codeRnd() * 0.5)).attr('height', 5).attr('rx', 2.5).style('fill', 'var(--line)');
      });
      return { rect: rect, strip: strip, dot: dot, cy: y + cellH / 2, xr: x + w - 6 };
    });

    // events leaving the notebook
    var EV = [
      { t: 0.04, c: 0, type: 'run' }, { t: 0.11, c: 1, type: 'run' },
      { t: 0.18, c: 2, type: 'error' }, { t: 0.25, c: 2, type: 'edit' },
      { t: 0.31, c: 2, type: 'error' }, { t: 0.38, c: 2, type: 'edit' }, { t: 0.44, c: 2, type: 'error' }
    ];
    var col = { run: 'var(--run)', error: 'var(--err)', edit: 'var(--write)' };
    var tgt = nb2cx[1];
    EV.forEach(function (e) { e.x0 = cells[e.c].xr; e.y0 = cells[e.c].cy; e.x1 = tgt[0]; e.y1 = tgt[1]; });
    var pLayer = svg.append('g');
    EV.forEach(function (e) { e.sel = pLayer.append('circle').attr('r', 3.6).style('fill', col[e.type]).style('stroke', 'var(--bg)').style('stroke-width', 1).attr('opacity', 0); });

    // context box: three metrics + recurring-error chip
    var metrics = [{ key: 'm_runs', c: 'run', type: 'run' }, { key: 'm_err', c: 'err', type: 'error' }, { key: 'm_edit', c: 'write', type: 'edit' }];
    var ctx = svg.append('g');
    var rowH = vertical ? 16 : 40, cxTop = B.cx.y + (vertical ? 30 : 44);
    var labW = vertical ? 78 : 0;
    metrics.forEach(function (m, i) {
      var y = cxTop + i * rowH;
      var tw = vertical ? B.cx.w - 12 - labW - 34 : B.cx.w - 24;
      var tx0 = vertical ? B.cx.x + 12 + labW : B.cx.x + 12;
      var ty = vertical ? y - 3.5 : y + 10;
      tx(ctx, m.key, B.cx.x + 12, vertical ? y + 3 : y, { size: fs, fill: 'var(--fg)', weight: 600 });
      ctx.append('rect').attr('x', tx0).attr('y', ty).attr('width', tw).attr('height', 7).attr('rx', 3.5).style('fill', 'var(--panel2)');
      m.bar = ctx.append('rect').attr('x', tx0).attr('y', ty).attr('width', 0).attr('height', 7).attr('rx', 3.5).style('fill', 'var(--' + m.c + ')');
      m.tw = tw;
      m.num = ctx.append('text').attr('x', B.cx.x + B.cx.w - 12).attr('y', vertical ? y + 3 : y)
        .attr('text-anchor', 'end').style('font-family', 'var(--mono)').style('font-size', '11px').style('font-weight', 700).style('fill', 'var(--fg)').text('0');
    });
    var chip = ctx.append('text').attr('x', vertical ? B.cx.x + B.cx.w - 12 : B.cx.x + 12).attr('y', vertical ? B.cx.y + 17 : B.cx.y + B.cx.h - 14)
      .attr('text-anchor', vertical ? 'end' : 'start').style('font-family', 'var(--mono)').style('font-size', '11px').style('font-weight', 700).style('fill', 'var(--err)').text('KeyError × 0');

    // context -> tutor pulses
    var pulses = d3.range(3).map(function (i) {
      return { d: i * 0.025, sel: svg.append('circle').attr('r', 4).style('fill', 'var(--ask)').style('stroke', 'var(--bg)').attr('opacity', 0) };
    });

    // chat (HTML overlay so text wraps naturally); position it relative to where the svg actually sits
    var sr = svg.node().getBoundingClientRect(), hr = el.getBoundingClientRect();
    var svgOff = { x: sr.left - hr.left, y: sr.top - hr.top };
    var ov = host.append('div').attr('class', 'overlay')
      .style('left', (svgOff.x + B.ch.x) + 'px').style('top', (svgOff.y + B.ch.y) + 'px').style('width', B.ch.w + 'px').style('height', B.ch.h + 'px');
    var chat = ov.append('div').attr('class', 'chat' + (vertical ? ' compact' : '')).style('position', 'absolute').style('inset', 0);
    chat.html('<div class="chat-head"><span data-k="tutor"></span>' + (vertical ? '<span class="chat-badge" data-k="hint"></span>' : '') + '</div>' +
      '<div class="bubble student" data-k="q"></div><div class="bubble tutor" data-k="a"></div>' +
      (vertical ? '' : '<div class="chat-badge inflow" data-k="hint"></div>'));
    var elStudent = chat.select('.student').node(), elTutor = chat.select('.tutor').node(), elBadge = chat.select('.chat-badge').node();
    function fillChat() { chat.selectAll('[data-k]').each(function () { this.textContent = T(this.dataset.k); }); }
    fillChat();

    function update(p) {
      // notebook state
      cells.forEach(function (c, ci) {
        var past = EV.filter(function (e) { return e.c === ci && e.t <= p; });
        var last = past[past.length - 1];
        var color = last ? col[last.type] : 'var(--line)';
        var fl = last ? 1 - seg(p, last.t, last.t + 0.06) : 0;
        c.strip.style('fill', color);
        c.dot.style('fill', last ? color : 'transparent');
        c.rect.style('stroke', fl > 0.05 ? 'var(--accent)' : 'var(--line)').style('stroke-width', 1 + fl * 1.5);
      });
      // traces travelling to the context box
      EV.forEach(function (e) {
        var k = seg(p, e.t, e.t + 0.09), kk = eio(k);
        e.sel.attr('cx', lerp(e.x0, e.x1, kk)).attr('cy', lerp(e.y0, e.y1, kk)).attr('opacity', k > 0 && k < 1 ? 1 : 0);
      });
      // context metrics (fractional counts, so bars grow smoothly)
      var errCount = 0;
      metrics.forEach(function (m) {
        var cnt = 0;
        EV.forEach(function (e) { if (e.type === m.type) cnt += eio(seg(p, e.t + 0.02, e.t + 0.09)); });
        if (m.type === 'error') errCount = cnt;
        m.bar.attr('width', m.tw * Math.min(1, cnt / 4));
        m.num.text(Math.round(cnt));
      });
      ctx.attr('opacity', seg(p, 0.06, 0.18));
      chip.text('KeyError × ' + Math.round(errCount)).attr('opacity', seg(errCount, 0.6, 1.4));
      // context -> tutor
      pulses.forEach(function (o) {
        var k = seg(p, 0.66 + o.d, 0.76 + o.d), kk = eio(k);
        o.sel.attr('cx', lerp(cx2ch[0][0], cx2ch[1][0], kk)).attr('cy', lerp(cx2ch[0][1], cx2ch[1][1], kk)).attr('opacity', k > 0 && k < 1 ? 1 : 0);
      });
      // guide: highlight the panel that the current beat is about
      pNB.style('stroke', p < 0.33 ? 'var(--accent)' : 'var(--line)');
      pCX.style('stroke', p >= 0.33 && p < 0.66 ? 'var(--accent)' : 'var(--line)');
      pCH.style('stroke', p >= 0.66 ? 'var(--accent)' : 'var(--line)');
      // chat
      var a = seg(p, 0.68, 0.75), b = seg(p, 0.77, 0.87), c = seg(p, 0.88, 0.96);
      elStudent.style.opacity = a; elStudent.style.transform = 'translateY(' + ((1 - a) * 8) + 'px)';
      elTutor.style.opacity = b; elTutor.style.transform = 'translateY(' + ((1 - b) * 8) + 'px)';
      elBadge.style.opacity = c;
    }
    return { update: update, relang: wireRelang(texts, fillChat) };
  }

  /* ================================================================ SCENE 3 · accompany / support */
  function vizSupport(el, W, H) {
    var svg = mkSvg(el, W, H, 'alt_support');
    var texts = [], tx = makeTx(texts);
    var narrow = W < 520, fs = narrow ? 10.5 : 12;
    var x0 = 10, x1 = W - 10, pw = x1 - x0;
    var legendRows = narrow ? 3 : 2, lineH = 17;
    var legendBlock = legendRows * lineH + 24, gapL = 22;
    var lh = (H - 6 - legendBlock - gapL) / 2;
    var laneTop = [6, 6 + lh + gapL];
    var yTop = function (i) { return laneTop[i] + 24; };
    var yBot = function (i) { return laneTop[i] + lh - 4; };
    var Y = function (i, v) { return yBot(i) - (yBot(i) - yTop(i)) * clamp(v) * 0.94; };

    var g = function (t, m, s) { return Math.exp(-Math.pow(t - m, 2) / (2 * s * s)); };
    var effV = function (t) { return clamp(0.66 * Math.exp(-3.3 * t) + 0.07 + 0.025 * Math.sin(41 * t)); };
    var effG = function (t) { return clamp(0.30 + 0.42 * (1 - Math.exp(-2.6 * t)) + 0.025 * Math.sin(31 * t) - 0.18 * g(t, 0.30, 0.05) - 0.20 * g(t, 0.62, 0.05) + 0.12 * g(t, 0.37, 0.06) + 0.13 * g(t, 0.69, 0.06)); };
    var supA = function (t) { return 0.88 * Math.exp(-1.7 * t) + 0.10; };
    var supB = function (t) { return 0.58 * Math.exp(-4.4 * t) + 0.05; };
    var ts = d3.range(0, 1.0001, 1 / 100);
    var X = function (t) { return x0 + t * pw; };

    var defs = svg.append('defs');
    var clips = [0, 1, 2].map(function (i) {
      return defs.append('clipPath').attr('id', 'sp-c' + i).append('rect').attr('x', x0 - 6).attr('y', 0).attr('height', H).attr('width', 0);
    });
    clips[2].attr('y', laneTop[1]).attr('height', lh + 4);

    // lane frames
    [0, 1].forEach(function (i) {
      svg.append('line').attr('x1', x0).attr('x2', x1).attr('y1', yBot(i)).attr('y2', yBot(i)).style('stroke', 'var(--line)').style('stroke-width', 1.5);
    });
    tx(svg, 'laneV', x0, laneTop[0] + 12, { mono: 1, size: 11, weight: 700, upper: 1, ls: '.06em', fill: 'var(--fg)' });
    tx(svg, 'laneG', x0, laneTop[1] + 12, { mono: 1, size: 11, weight: 700, upper: 1, ls: '.06em', fill: 'var(--fg)' });
    tx(svg, 'noteSupport', x1, laneTop[0] + 12, { anchor: 'end', size: 10.5 });
    tx(svg, 'time', x1, yBot(1) + 14, { anchor: 'end', size: 10.5 });

    var curve = function (i, f, cls) {
      var gr = svg.append('g');
      var area = d3.area().x(X).y0(yBot(i)).y1(function (t) { return Y(i, f(t)); });
      var ln = d3.line().x(X).y(function (t) { return Y(i, f(t)); });
      gr.append('path').attr('d', area(ts)).style('fill', 'var(--accent)').style('opacity', 0.14).attr('clip-path', 'url(#sp-c' + i + ')');
      gr.append('path').attr('d', ln(ts)).style('fill', 'none').style('stroke', 'var(--accent)').style('stroke-width', 2.6).style('stroke-linejoin', 'round').attr('clip-path', 'url(#sp-c' + i + ')');
      return gr;
    };
    var lane1 = curve(0, effV), lane2 = curve(1, effG);

    // lane 1: the AI hands over full answers
    var ansT = [0.06, 0.26, 0.46, 0.66, 0.86];
    var answers = svg.append('g');
    ansT.forEach(function (t) {
      var m = answers.append('g').attr('transform', 'translate(' + X(t) + ',' + (yTop(0) + 2) + ')');
      m.append('rect').attr('x', -5).attr('y', 0).attr('width', 10).attr('height', 10).attr('rx', 2).style('fill', 'var(--muted)');
      m.datum(t);
    });
    tx(svg, 'endV', x1, Y(0, effV(1)) - 24, { anchor: 'end', size: fs, weight: 600, fill: 'var(--fg)' });

    // lane 2: nudges, each placed just after the dips
    var nudgeT = [0.05, 0.34, 0.66];
    var nudges = svg.append('g');
    var bub = 'M-7,-5 h14 a2,2 0 0 1 2,2 v7 a2,2 0 0 1 -2,2 h-7 l-3.5,3.5 v-3.5 h-3.5 a2,2 0 0 1 -2,-2 v-7 a2,2 0 0 1 2,-2 z';
    nudgeT.forEach(function (t) {
      var m = nudges.append('g').datum(t);
      m.append('line').attr('x1', X(t)).attr('x2', X(t)).attr('y1', yTop(1) + 12).attr('y2', Y(1, effG(t)) - 3).style('stroke', 'var(--ask)').style('stroke-dasharray', '2 3').style('opacity', 0.7);
      m.append('path').attr('d', bub).attr('transform', 'translate(' + X(t) + ',' + (yTop(1) + 4) + ')').style('fill', 'var(--ask)');
    });
    var endG = tx(svg, 'endG', x1, Y(1, effG(1)) - 24, { anchor: 'end', size: fs, weight: 600, fill: 'var(--fg)' });

    // lane 2, beat 3: how much support the AI gives fades differently for each learner
    var sup = svg.append('g');
    var lnS = function (f, dash) {
      return sup.append('path').attr('d', d3.line().x(X).y(function (t) { return Y(1, f(t)); })(ts))
        .style('fill', 'none').style('stroke', 'var(--ask)').style('stroke-width', 2.2).style('stroke-dasharray', dash || null).attr('clip-path', 'url(#sp-c2)');
    };
    lnS(supA); lnS(supB, '5 4');
    var labA = tx(sup, 'supA', X(0.2) + 8, Y(1, supA(0.2)) - 8, { size: fs - 0.5, weight: 700, fill: 'var(--ask)' });
    var labB = tx(sup, 'supB', X(0.2) + 8, Y(1, supB(0.2)) - 8, { size: fs - 0.5, weight: 700, fill: 'var(--ask)' });

    // legend
    var legendG = svg.append('g').attr('transform', 'translate(' + x0 + ',' + (H - legendRows * lineH + lineH / 2 - 2) + ')');
    var legend = makeLegend(legendG, [
      { key: 'leffort', iconW: 16, icon: function (e) { e.append('rect').attr('x', 0).attr('y', -1).attr('width', 16).attr('height', 5).attr('rx', 2).style('fill', 'var(--accent)'); } },
      { key: 'lans', iconW: 10, icon: function (e) { e.append('rect').attr('x', 0).attr('y', -5).attr('width', 10).attr('height', 10).attr('rx', 2).style('fill', 'var(--muted)'); } },
      { key: 'lnudge', iconW: 14, icon: function (e) { e.append('path').attr('d', bub).attr('transform', 'translate(7,0) scale(.85)').style('fill', 'var(--ask)'); } },
      { key: 'lsupport', iconW: 18, icon: function (e) { e.append('line').attr('x1', 0).attr('x2', 18).attr('y1', 0).attr('y2', 0).style('stroke', 'var(--ask)').style('stroke-width', 2.2).style('stroke-dasharray', '5 3'); } }
    ], W - 2 * x0, fs, lineH);

    function update(p) {
      var k1 = eio(seg(p, 0.02, 0.30)), k2 = eio(seg(p, 0.36, 0.62)), k3 = eio(seg(p, 0.68, 0.92));
      var w = function (k) { return (pw + 12) * k; };
      clips[0].attr('width', w(k1)); clips[1].attr('width', w(k2)); clips[2].attr('width', w(k3));
      // lane 1 and lane-2 effort recede when the next idea takes over
      var dim1 = 1 - 0.72 * seg(p, 0.66, 0.78);
      lane1.attr('opacity', dim1); answers.attr('opacity', dim1);
      // clip is shared by curve and area, so hide lane 1 curves via clip width only
      var dim2 = 1 - 0.55 * seg(p, 0.70, 0.82);
      lane2.attr('opacity', dim2); nudges.attr('opacity', dim2);
      answers.selectAll('g').each(function (t) { this.setAttribute('opacity', clamp((k1 - t) * 25)); });
      nudges.selectAll('g').each(function (t) { this.setAttribute('opacity', clamp((k2 - t) * 25)); });
      texts.forEach(function (o) {
        if (o.key === 'endV') o.s.attr('opacity', seg(p, 0.22, 0.30) * dim1);
        if (o.key === 'endG') o.s.attr('opacity', seg(p, 0.56, 0.64) * (1 - seg(p, 0.68, 0.76)));
      });
      sup.attr('opacity', k3 > 0 ? 1 : 0);
      labA.attr('opacity', seg(p, 0.82, 0.9)); labB.attr('opacity', seg(p, 0.82, 0.9));
      // legend entries appear when they become relevant
      var lv = [seg(p, 0, 0.06), k1 > 0 ? 1 : 0, k2 > 0 ? 1 : 0, k3 > 0 ? 1 : 0];
      legend.els.forEach(function (o, i) { o.e.attr('opacity', lv[i]); });
    }
    return { update: update, relang: wireRelang(texts, legend.layout) };
  }

  /* ================================================================ scroll engine */
  var FACTORY = { problem: vizProblem, analyze: vizAnalyze, understand: vizUnderstand, support: vizSupport };
  var header = document.getElementById('hdr');
  var progressBar = document.getElementById('progress');
  var HDR = function () { return header.offsetHeight; };

  var scenes = Array.prototype.map.call(document.querySelectorAll('.scene'), function (sec) {
    var s = {
      sec: sec, id: sec.dataset.scene, sticky: sec.querySelector('.scene-sticky'), vizEl: sec.querySelector('.scene-viz'),
      beats: Array.prototype.slice.call(sec.querySelectorAll('.beat')), dotsEl: sec.querySelector('.beat-dots'),
      cur: 0, last: -1, viz: null, W: 0, H: 0, beatIdx: -1
    };
    s.dots = s.beats.map(function () { var i = document.createElement('i'); s.dotsEl.appendChild(i); return i; });
    return s;
  });

  function progressOf(s) {
    var r = s.sec.getBoundingClientRect();
    var span = r.height - s.sticky.offsetHeight;
    return span > 0 ? clamp((HDR() - r.top) / span) : 0;
  }

  function setBeat(s) {
    var idx = Math.min(s.beats.length - 1, Math.floor(s.cur * s.beats.length));
    if (idx === s.beatIdx) return;
    s.beatIdx = idx;
    s.beats.forEach(function (b, i) { b.classList.toggle('on', i === idx); });
    s.dots.forEach(function (d, i) { d.classList.toggle('on', i === idx); });
  }

  function build(s) {
    var rect = s.vizEl.getBoundingClientRect();
    var cs = getComputedStyle(s.vizEl);
    var W = Math.round(rect.width), H = Math.round(s.vizEl.clientHeight - parseFloat(cs.paddingTop) - parseFloat(cs.paddingBottom));
    if (W < 120 || H < 160) return;
    if (W === s.W && H === s.H && s.viz) return;
    s.W = W; s.H = H;
    s.viz = FACTORY[s.id](s.vizEl, W, H);
    s.last = -1;
    request();
  }

  var scheduled = false;
  function request() { if (!scheduled) { scheduled = true; requestAnimationFrame(frame); } }

  var stageEls = Array.prototype.slice.call(document.querySelectorAll('.stage'));
  var stageLinks = Array.prototype.slice.call(document.querySelectorAll('.stages a'));

  function frame() {
    scheduled = false;
    var more = false, vh = window.innerHeight;
    scenes.forEach(function (s) {
      var r = s.sec.getBoundingClientRect();
      if (r.bottom < -vh || r.top > 2 * vh) return;
      if (!s.viz) build(s);
      var target = progressOf(s), d = target - s.cur;
      if (reduce || Math.abs(d) < 0.0006) { s.cur = target; } else { s.cur += d * 0.18; more = true; }
      if (s.viz && Math.abs(s.cur - s.last) > 1e-5) { s.viz.update(s.cur); s.last = s.cur; }
      setBeat(s);
    });
    var mid = vh * 0.55, active = null;
    stageEls.forEach(function (st) { var r = st.getBoundingClientRect(); if (r.top <= mid && r.bottom > mid) active = st.dataset.stageId; });
    stageLinks.forEach(function (a) { a.classList.toggle('on', a.dataset.stage === active); });
    var total = document.documentElement.scrollHeight - vh;
    progressBar.style.transform = 'scaleX(' + (total > 0 ? clamp(window.scrollY / total) : 0) + ')';
    if (more) request();
  }

  window.addEventListener('scroll', request, { passive: true });
  window.addEventListener('resize', function () { request(); });
  if ('ResizeObserver' in window) {
    var t = null;
    var ro = new ResizeObserver(function () { clearTimeout(t); t = setTimeout(function () { scenes.forEach(build); request(); }, 120); });
    scenes.forEach(function (s) { ro.observe(s.vizEl); });
  }

  /* ---------------------------------------------------------------- language toggle */
  var TITLES = {
    en: 'Sequences in Data to Represent Learning Processes | Manuel Valle Torre',
    es: 'Secuencias en datos para representar procesos de aprendizaje | Manuel Valle Torre'
  };
  var DESCS = {
    en: 'A scroll-driven visual tour of a PhD thesis on making learning processes visible in the age of AI.',
    es: 'Un recorrido visual, con animaciones al hacer scroll, por una tesis doctoral sobre cómo ver y apoyar la forma en que aprendemos en tiempos de inteligencia artificial.'
  };
  var langBtns = document.querySelectorAll('[data-set-lang]');
  function applyLang(l, persist) {
    lang = l === 'es' ? 'es' : 'en';
    root.dataset.lang = lang; root.lang = lang;
    document.title = TITLES[lang];
    var md = document.querySelector('meta[name="description"]'); if (md) md.setAttribute('content', DESCS[lang]);
    langBtns.forEach(function (b) { b.setAttribute('aria-pressed', String(b.dataset.setLang === lang)); });
    document.querySelectorAll('[data-alt-en]').forEach(function (i) { i.alt = lang === 'es' ? i.dataset.altEs : i.dataset.altEn; });
    scenes.forEach(function (s) { if (s.viz) { s.viz.relang(); s.vizEl.setAttribute('aria-label', T('alt_' + s.id)); } });
    if (persist) {
      try { localStorage.setItem('thesis-lang', lang); } catch (e) {}
      var url = new URL(location.href);
      if (lang === 'es') url.searchParams.set('lang', 'es'); else url.searchParams.delete('lang');
      history.replaceState(null, '', url);
    }
    request();
  }
  langBtns.forEach(function (b) { b.addEventListener('click', function () { applyLang(b.dataset.setLang, true); }); });
  applyLang(lang, false);

  // first paint: build what is on screen, then start with the current scroll position
  scenes.forEach(function (s) { s.vizEl.setAttribute('role', 'img'); });
  requestAnimationFrame(function () {
    scenes.forEach(function (s) { build(s); s.cur = progressOf(s); });
    request();
  });
  window.addEventListener('load', function () { scenes.forEach(build); request(); });
})();
