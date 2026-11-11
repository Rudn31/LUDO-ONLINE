/* Regras do Ludo — usadas pelo servidor (Node) e pelo navegador (modo local) */
(function (root) {
  "use strict";
  const COLORS = ['blue', 'green', 'red', 'yellow'];           // ordem horária
  const PT = { blue: 'Azul', green: 'Verde', red: 'Vermelho', yellow: 'Amarelo' };
  const START = { blue: 0, green: 14, red: 28, yellow: 42 };
  const SAFE = new Set([0, 14, 28, 42]);
  const HOME = 61;                                              // 0..55 trilha, 56..60 corredor, 61 casa
  const TRACK = (() => {
    const t = [];
    for (let c = 0; c <= 5; c++) t.push([6, c]); t.push([5, 5]);
    for (let r = 5; r >= 0; r--) t.push([r, 6]); t.push([0, 7]);
    for (let r = 0; r <= 5; r++) t.push([r, 8]); t.push([5, 9]);
    for (let c = 9; c <= 14; c++) t.push([6, c]); t.push([7, 14]);
    for (let c = 14; c >= 9; c--) t.push([8, c]); t.push([9, 9]);
    for (let r = 9; r <= 14; r++) t.push([r, 8]); t.push([14, 7]);
    for (let r = 14; r >= 9; r--) t.push([r, 6]); t.push([9, 5]);
    for (let c = 5; c >= 0; c--) t.push([8, c]); t.push([7, 0]);
    return t;
  })();
  const LANE = {
    blue: [1, 2, 3, 4, 5].map(c => [7, c]), green: [1, 2, 3, 4, 5].map(r => [r, 7]),
    red: [13, 12, 11, 10, 9].map(c => [7, c]), yellow: [13, 12, 11, 10, 9].map(r => [r, 7])
  };
  const absIdx = (c, p) => (START[c] + p) % 56;
  const cellRC = (c, p) => p <= 55 ? TRACK[absIdx(c, p)] : LANE[c][p - 56];
  const fresh = () => ({ blue: [-1, -1, -1, -1], green: [-1, -1, -1, -1], red: [-1, -1, -1, -1], yellow: [-1, -1, -1, -1] });

  function seatName(g, c) {
    const s = g.seats[c]; if (!s) return PT[c];
    if (s.t === 'c') return PT[c] + ' 🤖';
    if (g.mode === 'online') return s.name || PT[c];
    return PT[c];
  }
  function newGame(mode) {
    const seats = {}; COLORS.forEach(c => seats[c] = mode === 'local' ? { t: 'h' } : { t: 'o' });
    return { v: 0, mode, phase: 'lobby', seats, turn: 'blue', st: 'roll', dice: 0, rollId: 0, six: 0, pcs: fresh(),
      movable: [], mv: null, mvId: 0, msg: '', winner: null, act: COLORS.slice() };
  }
  function playable(g, c) { const s = g.seats[c]; return s.t === 'c' || (s.t === 'h' && (g.mode === 'local' || !!s.id)); }
  function startGame(g) {
    g.act = COLORS.filter(c => playable(g, c));
    g.pcs = fresh(); g.turn = g.act[Math.floor(Math.random() * g.act.length)]; g.st = 'roll'; g.six = 0; g.dice = 0;
    g.phase = 'play'; g.winner = null; g.mv = null; g.movable = []; g.msg = seatName(g, g.turn) + ' começa!';
  }
  function movableOf(g, c, d) {
    const r = []; g.pcs[c].forEach((p, i) => { if (p === -1) { if (d === 6) r.push(i) } else if (p !== HOME && p + d <= HOME) r.push(i) });
    return r;
  }
  function doRoll(g) {
    const d = 1 + Math.floor(Math.random() * 6); g.dice = d; g.rollId++; const nm = seatName(g, g.turn);
    if (d === 6) { g.six++; if (g.six >= 3) { g.st = 'pass'; g.movable = []; g.msg = nm + ': três 6 seguidos, passa a vez!'; return } } else g.six = 0;
    g.movable = movableOf(g, g.turn, d);
    if (!g.movable.length) { g.st = 'pass'; g.msg = `${nm} tirou ${d}, sem jogadas` } else { g.st = 'move'; g.msg = `${nm} tirou ${d}` }
  }
  function nextTurn(g) { const i = g.act.indexOf(g.turn); g.turn = g.act[(i + 1) % g.act.length]; g.st = 'roll'; g.six = 0; g.movable = [] }
  function doMove(g, i) {
    const c = g.turn, d = g.dice, from = g.pcs[c][i], nm = seatName(g, c);
    const to = from === -1 ? 0 : from + d; const path = [];
    if (from === -1) path.push(0); else for (let k = from + 1; k <= to; k++) path.push(k);
    g.pcs[c][i] = to; const cap = [];
    if (to <= 55) {
      const a = absIdx(c, to);
      if (!SAFE.has(a)) for (const oc of g.act) {
        if (oc === c) continue;
        g.pcs[oc].forEach((p, j) => { if (p >= 0 && p <= 55 && absIdx(oc, p) === a) { cap.push([oc, j]); g.pcs[oc][j] = -1 } });
      }
    }
    g.mv = { id: ++g.mvId, c, p: i, path, cap };
    g.msg = cap.length ? `${nm} capturou ${cap.map(x => PT[x[0]]).join(', ')}!` : to === HOME ? `${nm} levou uma peça pra casa!` : g.msg;
    if (g.pcs[c].every(p => p === HOME)) { g.phase = 'over'; g.winner = c; g.movable = []; g.msg = nm + ' venceu!'; return }
    const extra = d === 6 || cap.length > 0 || to === HOME;
    if (extra) { g.st = 'roll'; g.movable = []; if (d !== 6) g.six = 0; if (!cap.length && to !== HOME) g.msg = `${nm} tirou 6, joga de novo` }
    else nextTurn(g);
  }
  function cpuPick(g) {
    const c = g.turn, d = g.dice; let best = g.movable[0], bs = -1e9;
    for (const i of g.movable) {
      const from = g.pcs[c][i], to = from === -1 ? 0 : from + d; let s = to * .3 + Math.random() * 2;
      if (to === HOME) s += 100; if (from === -1) s += 60; if (from <= 55 && to > 55) s += 40;
      if (to <= 55) {
        const a = absIdx(c, to);
        if (SAFE.has(a)) s += 20;
        else for (const oc of g.act) {
          if (oc === c) continue;
          g.pcs[oc].forEach(p => { if (p < 0 || p > 55) return; const ao = absIdx(oc, p); if (ao === a) s += 80; const dist = (a - ao + 56) % 56; if (dist >= 1 && dist <= 6) s -= 14 });
        }
      }
      if (from >= 0 && from <= 55 && !SAFE.has(absIdx(c, from))) {
        const af = absIdx(c, from);
        for (const oc of g.act) { if (oc === c) continue; g.pcs[oc].forEach(p => { if (p < 0 || p > 55) return; const dist = (af - absIdx(oc, p) + 56) % 56; if (dist >= 1 && dist <= 6) s += 10 }) }
      }
      if (s > bs) { bs = s; best = i }
    }
    return best;
  }
  // Chat só com emojis: os jogadores mandam o NÚMERO do emoji desta lista
  const EMOJIS = ['😀', '😂', '😎', '😍', '😮', '😢', '😭', '😡', '🤔', '😴', '👍', '👎', '👏', '🙏', '🔥', '🎲', '🏆', '💀'];
  const R = { EMOJIS, COLORS, PT, START, SAFE, HOME, TRACK, LANE, absIdx, cellRC, fresh, seatName, newGame, startGame, movableOf, doRoll, doMove, nextTurn, cpuPick };
  if (typeof module !== 'undefined' && module.exports) module.exports = R; else root.LudoRules = R;
})(this);
