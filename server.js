'use strict';
// CodeCall — tiny dependency-free signaling server.
// - Serves the app (public/index.html)
// - Keeps "rooms" keyed by a 5-character call code (max 2 members: host + caller)
// - Relays WebRTC signaling messages between the two peers via SSE + POST
// The actual audio flows peer-to-peer (WebRTC); this server only does the handshake.

const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const rooms = new Map(); // code -> { code, host: res|null, caller: res|null }

function sseHeaders(res) {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
  });
  res.write('retry: 2000\n\n');
}

function sendEvent(res, event, data) {
  try {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
  } catch (_) { /* socket already closed */ }
}

function safePing(res) {
  try { res.write(': ping\n\n'); } catch (_) { /* ignore */ }
}

function cleanup(room) {
  if (!room.host && !room.caller) rooms.delete(room.code);
}

const server = http.createServer((req, res) => {
  // ---- static app ----
  if (req.method === 'GET' && (req.url === '/' || req.url === '/index.html')) {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(path.join(__dirname, 'public', 'index.html')).pipe(res);
    return;
  }

  // ---- open the signaling stream for a room ----
  if (req.method === 'GET' && req.url.startsWith('/stream?')) {
    const params = new URLSearchParams(req.url.split('?')[1]);
    const code = (params.get('code') || '').toUpperCase();
    const role = params.get('role');
    if (!/^[A-Z2-9]{5}$/.test(code) || (role !== 'host' && role !== 'caller')) {
      res.writeHead(400); res.end('bad request'); return;
    }

    let room = rooms.get(code);

    if (role === 'host') {
      // Starting a call: reserve the code (or re-take an abandoned room).
      if (room && room.host) { res.writeHead(409); res.end('code busy'); return; }
      if (!room) { room = { code, host: null, caller: null }; rooms.set(code, room); }
      room.host = res;
      sseHeaders(res);
      sendEvent(res, 'joined', { role });
      res.on('close', () => {
        if (room.host === res) {
          room.host = null;
          if (room.caller) sendEvent(room.caller, 'peer-left', {});
          cleanup(room);
        }
      });
      return;
    }

    // role === 'caller'
    if (!room || !room.host) { res.writeHead(404); res.end('code not found'); return; }
    if (room.caller) { res.writeHead(409); res.end('call already in progress'); return; }
    room.caller = res;
    sseHeaders(res);
    sendEvent(res, 'joined', { role });
    sendEvent(room.host, 'peer-joined', {});
    res.on('close', () => {
      if (room.caller === res) {
        room.caller = null;
        if (room.host) sendEvent(room.host, 'peer-left', {});
        cleanup(room);
      }
    });
    return;
  }

  // ---- relay a signaling message to the other member of the room ----
  if (req.method === 'POST' && req.url === '/signal') {
    let body = '';
    req.on('data', (c) => { body += c; if (body.length > 1e6) req.destroy(); });
    req.on('end', () => {
      let msg;
      try { msg = JSON.parse(body); } catch (_) { res.writeHead(400); res.end('bad json'); return; }
      const room = rooms.get(String(msg.code || '').toUpperCase());
      if (!room) { res.writeHead(404); res.end('no room'); return; }
      const target = msg.from === 'host' ? room.caller : room.host;
      if (!target) { res.writeHead(404); res.end('peer gone'); return; }
      sendEvent(target, 'signal', { from: msg.from, data: msg.data });
      res.writeHead(200); res.end('ok');
    });
    return;
  }

  res.writeHead(404); res.end('not found');
});

// Keep SSE connections alive through proxies / NAT.
setInterval(() => {
  for (const room of rooms.values()) {
    if (room.host) safePing(room.host);
    if (room.caller) safePing(room.caller);
  }
}, 25000).unref();

server.listen(PORT, () => {
  console.log(`CodeCall is running → http://localhost:${PORT}`);
  console.log('On the same Wi-Fi, others can join at http://<your-ip>:' + PORT);
});
