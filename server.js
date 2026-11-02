// Servidor do Impostor na Nave: serve o jogo e repassa mensagens entre jogadores (WebSocket).
const http = require('http'), fs = require('fs'), path = require('path');
const { WebSocketServer } = require('ws');

const page = path.join(__dirname, 'public', 'index.html');
const srv = http.createServer((req, res) => {
  if (req.url === '/healthz') { res.end('ok'); return; }
  res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-cache' });
  res.end(fs.readFileSync(page));
});
const wss = new WebSocketServer({ server: srv, maxPayload: 4096 });

const NAME = /^[a-z0-9][a-z0-9_.-]{0,47}$/;
const TOPICS = new Set(['start', 'kill', 'task', 'meet', 'vote', 'chat']);
const CAP = { lobby: 300, game: 8 };
const rooms = new Map();            // nome -> { m: Map(peer -> conexão), t: timer }
let seq = 0;

const send = (c, o) => { if (c.ws.readyState === 1) c.ws.send(JSON.stringify(o)); };

function snap(name) {               // reenvia a lista de pessoas (agrupa até 20 vezes por segundo)
  const R = rooms.get(name);
  if (!R || R.t) return;
  R.t = setTimeout(() => {
    R.t = 0;
    const peers = [...R.m.values()].map(c => ({ peer: c.peer, presence: c.pres[name] || {} }));
    const msg = JSON.stringify({ t: 'peers', room: name, peers });
    R.m.forEach(c => c.ws.readyState === 1 && c.ws.send(msg));
  }, 50);
}
function join(c, name) {
  if (c.rooms.has(name)) return;
  if (name !== 'lobby' && (!NAME.test(name))) return;
  let R = rooms.get(name);
  if (!R) { R = { m: new Map(), t: 0 }; rooms.set(name, R); }
  if (R.m.size >= (name === 'lobby' ? CAP.lobby : CAP.game)) return;
  R.m.set(c.peer, c); c.rooms.add(name); c.pres[name] = {};
  snap(name);
}
function leave(c, name) {
  const R = rooms.get(name);
  if (!R || !c.rooms.has(name)) return;
  R.m.delete(c.peer); c.rooms.delete(name); delete c.pres[name];
  if (!R.m.size) { clearTimeout(R.t); rooms.delete(name); } else snap(name);
}

wss.on('connection', ws => {
  const c = { ws, peer: 'u' + (++seq).toString(36) + Math.random().toString(36).slice(2, 6), rooms: new Set(), pres: {}, n: 0, alive: true };
  const tick = setInterval(() => { c.n = 0; }, 1000);
  ws.on('pong', () => { c.alive = true; });
  send(c, { t: 'hello', peer: c.peer });
  join(c, 'lobby');
  ws.on('message', raw => {
    if (++c.n > 100) return;        // limite de mensagens por segundo
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (!m || typeof m.room !== 'string') return;
    const name = m.room;
    if (m.t === 'join') { if (name !== 'lobby') join(c, name); return; }
    if (!c.rooms.has(name)) return;
    if (m.t === 'leave') { if (name !== 'lobby') leave(c, name); return; }
    if (m.t === 'pres' && m.patch && typeof m.patch === 'object') {
      const p = { ...c.pres[name] };
      for (const k of Object.keys(m.patch)) { if (m.patch[k] === null) delete p[k]; else p[k] = m.patch[k]; }
      if (JSON.stringify(p).length > 600) return;
      c.pres[name] = p; snap(name); return;
    }
    if (m.t === 'emit' && TOPICS.has(m.topic) && name !== 'lobby') {
      const out = JSON.stringify({ t: 'msg', room: name, topic: m.topic, data: m.data, peer: c.peer });
      if (out.length > 1200) return;
      rooms.get(name).m.forEach(o => { if (o !== c) o.ws.readyState === 1 && o.ws.send(out); });
    }
  });
  ws.on('close', () => { clearInterval(tick); [...c.rooms].forEach(n => leave(c, n)); });
  ws.on('error', () => {});
});
setInterval(() => wss.clients.forEach(ws => {   // derruba conexões mortas e mantém as vivas
  if (ws.isDead) return ws.terminate();
  ws.isDead = true; ws.ping();
}), 25000);
wss.on('connection', ws => ws.on('pong', () => { ws.isDead = false; }));

srv.listen(process.env.PORT || 3000, () => console.log('Servidor no ar'));
