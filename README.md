# CodeCall 📞

A voice call app where every call has a **5-character code**.

- You press **Start a Call** → it asks for mic access, generates a code like `K4XTQ`, and rings.
- The other person opens the app, types the code, and hits **Call** — you're connected.

Audio flows directly between the two browsers via **WebRTC** (peer-to-peer). The tiny
Node server only relays the handshake ("signaling") — no accounts, no dependencies.

## Run locally

```bash
node server.js
```

Then open **http://localhost:3000** (set `PORT` env var to change it).

## Deploy online (e.g. Render)

Works with any platform that runs a Node server and gives you HTTPS (browsers require
HTTPS for mic access):

1. Push this folder to a GitHub repo.
2. On [Render](https://render.com): **New → Web Service**, pick the repo.
3. Build command: *(leave empty)* · Start command: `node server.js`
4. Render sets the `PORT` env var automatically — the server already honors it.
5. Deploy. Share the `https://...` URL.

Railway, Fly.io, or any Node PaaS works the same way (start command `node server.js`).

## How to use

1. Press **Start a Call** — a code appears (e.g. `K4XTQ`).
2. Tell the code to the other person (the URL too, if they're on a different device).
3. The other person types the code and presses **Call**.
4. The host's phone "rings" and you're in a call: timer, mute, hang up.

## Notes

- **Audio only** (no video).
- Two devices on the same Wi-Fi/LAN: always works.
- Across the internet: depends on NAT traversal (public Google STUN servers).
  Most networks work; symmetric NAT may block it.
- Mic access requires `https` or `localhost` (browser security rule).
- Codes are 5 characters from a set without look-alikes (no I, L, O, 0, 1).
- A room frees up automatically when the host cancels or disconnects.
