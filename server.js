/* Servidor do Ludo Online — Node.js puro, sem dependências.
   Tempo real via Server-Sent Events (SSE) + ações por POST.
   Rodar:  node server.js   (porta = variável PORT ou 3000) */
"use strict";
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');
// Funciona com os arquivos do jogo dentro de /public OU soltos ao lado do server.js
const PUB = fs.existsSync(path.join(__dirname, 'public', 'index.html')) ? path.join(__dirname, 'public') : __dirname;
const R = require(path.join(PUB, 'rules.js'));
const { COLORS } = R;
const PORT = process.env.PORT || 3000;

const rooms = new Map();      // code -> room
const lobby = new Map();      // res  -> {id,name}

const clean = s => String(s || '').replace(/[\u0000-\u001f\u007f-\u009f­​-‏‪-‮⁠-⁯﻿]/g, '').trim().slice(0, 14);
const cleanId = s => String(s || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 40);
function genCode() {
  const a = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; let s;
  do { s = ''; for (let i = 0; i < 4; i++) s += a[crypto.randomInt(a.length)] } while (rooms.has(s));
  return s;
}
function sse(res) {
  res.writeHead(200, { 'Content-Type': 'text/event-stream; charset=utf-8', 'Cache-Control': 'no-cache, no-transform', 'Connection': 'keep-alive', 'X-Accel-Buffering': 'no' });
  res.write('retry: 2000\n\n');
}
const send = (res, obj) => { try { res.write('data: ' + JSON.stringify(obj) + '\n\n') } catch (e) { } };

/* ---------- salas ---------- */
function onlineIds(room) { return new Set([...room.clients.values()].map(c => c.id)) }
function nameOf(room, id) { for (const c of room.clients.values()) if (c.id === id) return c.name; for (const k of COLORS) if (room.g.seats[k].id === id) return room.g.seats[k].name; return '' }
function view(room, id) {
  const g = JSON.parse(JSON.stringify(room.g)); const on = onlineIds(room);
  for (const c of COLORS) { const s = g.seats[c]; g.seats[c] = { t: s.t, name: s.name || '', on: s.id ? on.has(s.id) : false, me: !!s.id && s.id === id } }
  return { g, host: room.hostId === id, code: room.code, hostName: nameOf(room, room.hostId), spectators: room.clients.size };
}
function sendChat(room, c, name, e) {
  room.chatId = (room.chatId || 0) + 1;
  for (const res of room.clients.keys()) send(res, { chat: { id: room.chatId, c: c || null, name: name || '', e } });
}
const pick = a => a[Math.floor(Math.random() * a.length)];
function botReact(room) {                     // os bots também reagem com emojis
  const g = room.g, mv = g.mv; if (!mv) return;
  const bot = c => g.seats[c] && g.seats[c].t === 'c';
  if (g.phase === 'over' && bot(g.winner)) return setTimeout(() => sendChat(room, g.winner, '', 16), 600);
  if (!mv.cap || !mv.cap.length) return;
  if (bot(mv.c) && Math.random() < .7) setTimeout(() => sendChat(room, mv.c, '', pick([1, 2, 14])), 700);
  const v = mv.cap[0][0]; if (bot(v) && Math.random() < .7) setTimeout(() => sendChat(room, v, '', pick([5, 6, 7])), 1300);
}
function broadcast(room) {
  room.g.v++;
  for (const [res, c] of room.clients) send(res, view(room, c.id));
  lobbyBroadcast(); schedule(room);
}
function seatOf(room, id) { return COLORS.find(c => room.g.seats[c].id === id) }
function pickHost(room) {
  const on = onlineIds(room);
  if (on.has(room.hostId)) return;
  const seated = COLORS.map(c => room.g.seats[c].id).find(id => id && on.has(id));
  const any = [...on][0];
  if (seated || any) room.hostId = seated || any;
}
function autoPlays(room, c) {
  const s = room.g.seats[c]; if (s.t === 'c') return true;
  return s.t === 'h' && !onlineIds(room).has(s.id);            // jogador caiu: o servidor joga por ele
}
function schedule(room) {
  clearTimeout(room.timer); const g = room.g; if (g.phase !== 'play') return;
  const wait = Math.max(0, room.animUntil - Date.now()), auto = autoPlays(room, g.turn);
  const extra = g.seats[g.turn].t === 'h' ? 3000 : 0;
  if (g.st === 'roll' && auto) room.timer = setTimeout(() => act(room, { t: 'roll' }), wait + 700 + extra);
  else if (g.st === 'move') {
    const distinct = new Set(g.movable.map(i => g.pcs[g.turn][i]));
    if (auto) room.timer = setTimeout(() => act(room, { t: 'move', p: R.cpuPick(g) }), wait + 900);
    else if (distinct.size === 1) room.timer = setTimeout(() => act(room, { t: 'move', p: g.movable[0] }), wait + 850);
  } else if (g.st === 'pass') room.timer = setTimeout(() => { R.nextTurn(room.g); broadcast(room) }, wait + 1400);
}
function act(room, a) {
  const g = room.g; if (g.phase !== 'play') return false;
  if (a.t === 'roll' && g.st === 'roll') R.doRoll(g);
  else if (a.t === 'move' && g.st === 'move' && g.movable.includes(a.p)) {
    R.doMove(g, a.p); botReact(room); room.animUntil = Date.now() + g.mv.path.length * 140 + (g.mv.cap.length ? 450 : 0) + 150;
  } else return false;
  broadcast(room); return true;
}
function handleAct(room, id, name, a) {
  const g = room.g, isHost = room.hostId === id, on = onlineIds(room);
  if (!a || typeof a.t !== 'string') return 'ação inválida';
  if (a.t === 'seat') {
    if (!COLORS.includes(a.c)) return 'cor inválida';
    const s = g.seats[a.c];
    if (g.phase === 'lobby') {
      const free = s.t === 'o' || (s.t === 'h' && !on.has(s.id));
      if (!free) return 'lugar ocupado';
      for (const c of COLORS) if (g.seats[c].t === 'h' && g.seats[c].id === id) g.seats[c] = { t: 'o' };
      g.seats[a.c] = { t: 'h', id, name };
    } else {
      if (seatOf(room, id)) return 'você já está jogando';
      if (!(g.act.includes(a.c) && s.t === 'h' && !on.has(s.id))) return 'lugar ocupado';
      s.id = id; s.name = name;
    }
    broadcast(room); return null;
  }
  if (a.t === 'unseat') { if (g.phase !== 'lobby') return 'partida em andamento'; const c = seatOf(room, id); if (c) g.seats[c] = { t: 'o' }; broadcast(room); return null }
  if (a.t === 'set') {
    if (!isHost) return 'só o anfitrião';
    if (g.phase !== 'lobby' || !COLORS.includes(a.c) || !['o', 'c', 'x'].includes(a.v)) return 'inválido';
    const s = g.seats[a.c]; if (s.t === 'h' && on.has(s.id)) return 'lugar ocupado';
    g.seats[a.c] = { t: a.v }; broadcast(room); return null;
  }
  if (a.t === 'start') {
    if (!isHost) return 'só o anfitrião'; if (g.phase !== 'lobby') return 'já começou';
    if (COLORS.filter(c => g.seats[c].t === 'c' || (g.seats[c].t === 'h' && g.seats[c].id)).length < 2) return 'precisa de 2 jogadores';
    R.startGame(g); room.animUntil = 0; broadcast(room); return null;
  }
  if (a.t === 'again') { if (!isHost) return 'só o anfitrião'; if (g.phase !== 'over') return 'inválido'; g.phase = 'lobby'; g.pcs = R.fresh(); g.mv = null; g.dice = 0; broadcast(room); return null }
  if (a.t === 'emo') {
    const e = Number(a.e); if (!Number.isInteger(e) || e < 0 || e >= R.EMOJIS.length) return 'emoji inválido';
    room.lastEmo = room.lastEmo || new Map(); const now = Date.now();
    if (now - (room.lastEmo.get(id) || 0) < 1200) return 'calma! espere um pouco';
    room.lastEmo.set(id, now); sendChat(room, seatOf(room, id), name, e); return null;
  }
  if (a.t === 'roll' || a.t === 'move') {
    if (g.phase !== 'play' || g.seats[g.turn].id !== id) return 'não é sua vez';
    return act(room, { t: a.t, p: Number(a.p) }) ? null : 'jogada inválida';
  }
  return 'ação desconhecida';
}

/* ---------- lista de espera ---------- */
let lobbyT = null;
function lobbyState() {
  const list = [];
  for (const r of rooms.values()) {
    if (!r.clients.size) continue; const g = r.g;
    list.push({ code: r.code, host: nameOf(r, r.hostId) || 'Jogador', ph: g.phase,
      free: g.phase === 'lobby' ? COLORS.filter(c => g.seats[c].t === 'o').length : 0,
      pl: COLORS.filter(c => g.seats[c].t === 'h' || g.seats[c].t === 'c').map(c => g.seats[c].t === 'c' ? 'CPU' : (g.seats[c].name || 'Jogador')),
      at: r.created });
  }
  list.sort((a, b) => b.at - a.at);
  const inRoom = new Map(); for (const r of rooms.values()) for (const c of r.clients.values()) inRoom.set(c.id, r);
  const seen = new Set(), online = [];
  for (const c of lobby.values()) {
    if (seen.has(c.id)) continue; seen.add(c.id); const r = inRoom.get(c.id);
    online.push({ name: c.name || 'Jogador', st: r ? (r.g.phase === 'play' ? 'jogando' : 'sala ' + r.code) : 'livre' });
  }
  return { rooms: list.slice(0, 50), online: online.slice(0, 100) };
}
function lobbyBroadcast() {
  if (lobbyT) return;
  lobbyT = setTimeout(() => { lobbyT = null; const st = lobbyState(); for (const res of lobby.keys()) send(res, st) }, 200);
}

/* ---------- HTTP ---------- */
const MIME = { '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.m4a': 'audio/mp4', '.wav': 'audio/wav', '.html': 'text/html; charset=utf-8', '.js': 'application/javascript; charset=utf-8', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.json': 'application/json' };
function readBody(req) {
  return new Promise((ok, no) => {
    let b = ''; req.on('data', d => { b += d; if (b.length > 10000) { no(new Error('grande')); req.destroy() } });
    req.on('end', () => { try { ok(JSON.parse(b || '{}')) } catch (e) { no(e) } });
  });
}
const json = (res, code, obj) => { res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(obj)) };

const server = http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://x'); const q = u.searchParams;
  if (u.pathname.startsWith('/api/')) {          // libera o aplicativo Android a falar com o servidor
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    if (req.method === 'OPTIONS') { res.writeHead(204, { 'Access-Control-Max-Age': '86400' }); return res.end() }
  }
  try {
    if (req.method === 'GET' && u.pathname === '/api/lobby') {
      sse(res); const me = { id: cleanId(q.get('id')), name: clean(q.get('name')) };
      lobby.set(res, me); send(res, lobbyState()); lobbyBroadcast();
      req.on('close', () => { lobby.delete(res); lobbyBroadcast() });
      return;
    }
    if (req.method === 'GET' && u.pathname === '/api/stream') {
      const code = String(q.get('code') || '').toUpperCase(), id = cleanId(q.get('id')), name = clean(q.get('name')) || 'Jogador';
      const room = rooms.get(code);
      sse(res);
      if (!room || !id) { send(res, { err: 'Sala não encontrada' }); return res.end() }
      room.clients.set(res, { id, name }); room.empty = 0;
      // atualiza o nome e senta automaticamente no 1º lugar livre
      const mine = seatOf(room, id); if (mine) room.g.seats[mine].name = name;
      else if (room.g.phase === 'lobby') { const f = COLORS.find(c => room.g.seats[c].t === 'o'); if (f) room.g.seats[f] = { t: 'h', id, name } }
      pickHost(room); broadcast(room);
      req.on('close', () => {
        room.clients.delete(res);
        if (!room.clients.size) room.empty = Date.now();
        setTimeout(() => {
          if (!rooms.has(room.code)) return; const on = onlineIds(room);
          if (on.has(id)) return;
          if (room.g.phase === 'lobby') { const c = seatOf(room, id); if (c) room.g.seats[c] = { t: 'o' } }
          pickHost(room); broadcast(room);
        }, 6000);
        broadcast(room);
      });
      return;
    }
    if (req.method === 'POST' && u.pathname === '/api/create') {
      const b = await readBody(req); const id = cleanId(b.id), name = clean(b.name) || 'Jogador';
      if (!id) return json(res, 400, { err: 'id' });
      const code = genCode(); const g = R.newGame('online'); g.seats.blue = { t: 'h', id, name };
      rooms.set(code, { code, g, clients: new Map(), hostId: id, timer: null, animUntil: 0, created: Date.now(), empty: Date.now() });
      lobbyBroadcast(); return json(res, 200, { code });
    }
    if (req.method === 'POST' && u.pathname === '/api/act') {
      const b = await readBody(req); const room = rooms.get(String(b.code || '').toUpperCase());
      if (!room) return json(res, 404, { err: 'Sala não encontrada' });
      const id = cleanId(b.id); const err = handleAct(room, id, clean(b.name) || nameOf(room, id) || 'Jogador', b.a);
      return json(res, err ? 400 : 200, err ? { err } : { ok: true });
    }
    if (req.method === 'GET' && u.pathname === '/health') return json(res, 200, { ok: true, rooms: rooms.size, lobby: lobby.size });
    if (req.method === 'GET' || req.method === 'HEAD') {
      let p = u.pathname === '/' ? '/index.html' : decodeURIComponent(u.pathname);
      if (p.split('/').some(x => x.startsWith('.')) || /^\/(android|node_modules)\//.test(p) || /\.(jks|py|md)$/.test(p)) { res.writeHead(404); return res.end('não encontrado') }
      const f = path.normalize(path.join(PUB, p));
      if (!f.startsWith(PUB)) { res.writeHead(403); return res.end() }
      return fs.stat(f, (e, st) => {
        if (e || !st.isFile()) { res.writeHead(404); return res.end('não encontrado') }
        const type = MIME[path.extname(f).toLowerCase()] || 'application/octet-stream';
        const isAudio = type.startsWith('audio/');
        const head = { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Cache-Control': isAudio ? 'public, max-age=86400' : 'no-cache' };
        const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || '');
        if (m) {                                   // pedaços do arquivo (o iPhone exige isso para tocar áudio)
          let start = m[1] === '' ? st.size - Number(m[2]) : Number(m[1]);
          let end = m[1] !== '' && m[2] !== '' ? Number(m[2]) : st.size - 1;
          if (start < 0) start = 0; if (end >= st.size) end = st.size - 1;
          if (start > end) { res.writeHead(416, { 'Content-Range': `bytes */${st.size}` }); return res.end() }
          res.writeHead(206, Object.assign(head, { 'Content-Range': `bytes ${start}-${end}/${st.size}`, 'Content-Length': end - start + 1 }));
          return fs.createReadStream(f, { start, end }).pipe(res);
        }
        res.writeHead(200, Object.assign(head, { 'Content-Length': st.size }));
        if (req.method === 'HEAD') return res.end();
        fs.createReadStream(f).pipe(res);
      });
    }
    res.writeHead(405); res.end();
  } catch (e) { json(res, 400, { err: 'requisição inválida' }) }
});

// mantém as conexões vivas e limpa salas abandonadas
setInterval(() => {
  for (const res of lobby.keys()) { try { res.write(': ping\n\n') } catch (e) { } }
  for (const r of rooms.values()) {
    for (const res of r.clients.keys()) { try { res.write(': ping\n\n') } catch (e) { } }
    if (!r.clients.size && r.empty && Date.now() - r.empty > 20 * 60 * 1000) { clearTimeout(r.timer); rooms.delete(r.code); lobbyBroadcast() }
  }
}, 15000);

server.listen(PORT, () => console.log('Ludo Online rodando na porta ' + PORT));
