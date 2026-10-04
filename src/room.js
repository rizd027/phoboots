// Multi-user room over WebRTC using PeerJS (free public broker, no backend needed).
//
// Topology:
//  - The HOST owns the peer id `phoboots-v1-<CODE>` and is the source of truth for the
//    shared session state. Guests connect a data channel to the host (star topology).
//  - Video/audio streams use a full mesh: every pair of members calls each other once.
//  - Events (countdown, photos, ...) are relayed by the host to everyone else.
import Peer from 'peerjs';
import { MAX_MEMBERS } from './config.js';

const PREFIX = 'phoboots-v1-';
const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ'; // no I / O to avoid confusion
const BUSY_PHASES = ['shoot', 'pick', 'style', 'done'];

export function generateCode(len = 5) {
  let s = '';
  const arr = crypto.getRandomValues(new Uint32Array(len));
  for (const n of arr) s += ALPHABET[n % ALPHABET.length];
  return s;
}

export class Room {
  constructor({ name, stream, solo = false }) {
    this.name = (name || 'Guest').slice(0, 20);
    this.stream = stream;
    this.solo = solo;
    this.peer = null;
    this.isHost = false;
    this.code = null;
    this.myId = null;
    this.members = []; // [{ id, name, idx, host }]
    this.state = {};
    this.conns = new Map(); // host: guestId -> DataConnection
    this.hostConn = null; // guest: connection to host
    this.calls = new Map(); // peerId -> MediaConnection
    this.streams = new Map(); // peerId -> MediaStream
    this.listeners = {};
    this.closed = false;
    this._recovering = false;
    this._hbTimer = null;
  }

  on(evt, fn) {
    (this.listeners[evt] ||= []).push(fn);
    return this;
  }

  emit(evt, ...args) {
    (this.listeners[evt] || []).forEach((fn) => {
      try {
        fn(...args);
      } catch (e) {
        console.error(e);
      }
    });
  }

  /* ---------------- lifecycle ---------------- */

  _open(id) {
    return new Promise((resolve, reject) => {
      // 3-second ping interval to keep cellular CGNAT NAT mapping active
      const peer = id ? new Peer(id, { debug: 1, pingInterval: 3000 }) : new Peer({ debug: 1, pingInterval: 3000 });
      const onErr = (e) => {
        peer.destroy();
        reject(e);
      };
      peer.once('error', onErr);
      peer.once('open', () => {
        peer.off('error', onErr);
        this.peer = peer;
        peer.on('error', (e) => this._onPeerError(e));
        peer.on('disconnected', () => {
          if (!peer.destroyed && !this.closed) {
            if (this.isHost) {
              this._recoverHost();
            } else {
              try { peer.reconnect(); } catch {}
            }
          }
        });
        resolve(peer);
      });
    });
  }

  async _recoverHost() {
    if (this.closed || !this.isHost || this._recovering) return;
    this._recovering = true;
    this.emit('status', 'reconnecting');
    console.log('[room] Cellular connection drop detected, recovering host room:', this.code);

    try {
      if (this.peer && !this.peer.destroyed) {
        try {
          this.peer.reconnect();
          await new Promise((res, rej) => {
            const onOpen = () => { cleanup(); res(); };
            const onErr = (e) => { cleanup(); rej(e); };
            const cleanup = () => {
              this.peer?.off('open', onOpen);
              this.peer?.off('error', onErr);
            };
            this.peer.once('open', onOpen);
            this.peer.once('error', onErr);
            setTimeout(() => { cleanup(); rej(new Error('timeout')); }, 3000);
          });
          this._recovering = false;
          this.emit('status', 'ready');
          console.log('[room] Host reconnected successfully via reconnect()');
          return;
        } catch (err) {
          console.warn('[room] Quick reconnect failed, re-opening clean peer:', err);
        }
      }

      try { this.peer?.destroy(); } catch {}
      // Give broker 1.5s to clear previous socket session so ID-TAKEN is avoided
      await new Promise((r) => setTimeout(r, 1500));
      if (this.closed) return;

      await this._open(PREFIX + this.code);
      this.myId = this.peer.id;
      this.peer.on('connection', (conn) => this._onGuestConn(conn));
      this.peer.on('call', (call) => this._answer(call));
      this.emit('status', 'ready');
      console.log('[room] Host room re-opened successfully with ID:', PREFIX + this.code);
    } catch (e) {
      console.error('[room] Host recovery error:', e);
      if (!this.closed) {
        setTimeout(() => {
          this._recovering = false;
          this._recoverHost();
        }, 2000);
        return;
      }
    }
    this._recovering = false;
  }

  _startHeartbeat() {
    this._stopHeartbeat();
    this._hbTimer = setInterval(() => {
      if (this.closed) return;
      if (this.isHost) {
        if (!this.peer || this.peer.disconnected || this.peer.destroyed) {
          this._recoverHost();
        } else if (this.conns.size > 0) {
          this._broadcast({ type: 'hb' });
        }
      }
    }, 3500);
  }

  _stopHeartbeat() {
    if (this._hbTimer) {
      clearInterval(this._hbTimer);
      this._hbTimer = null;
    }
  }

  async create(initialState) {
    this.isHost = true;
    this.state = { ...initialState };

    if (this.solo) {
      this.myId = 'me';
      this.code = 'SOLO';
      this.members = [{ id: 'me', name: this.name, idx: 0, host: true }];
      return this.code;
    }

    let lastErr;
    for (let attempt = 0; attempt < 6; attempt++) {
      const code = generateCode();
      try {
        await this._open(PREFIX + code);
        this.code = code;
        break;
      } catch (e) {
        lastErr = e;
        if (e?.type !== 'unavailable-id') throw e;
      }
    }
    if (!this.code) throw lastErr || new Error('net');

    this.myId = this.peer.id;
    this.members = [{ id: this.myId, name: this.name, idx: 0, host: true }];
    this.peer.on('connection', (conn) => this._onGuestConn(conn));
    this.peer.on('call', (call) => this._answer(call));
    this._startHeartbeat();
    this.emit('status', 'ready');
    return this.code;
  }

  async join(rawCode) {
    const code = rawCode.trim().toUpperCase();
    await this._open();
    this.myId = this.peer.id;
    this.peer.on('call', (call) => this._answer(call));

    const MAX_RETRIES = 3;
    let attempt = 0;

    return new Promise((resolve, reject) => {
      let settled = false;
      let activeConn = null;
      let retryTimer = null;

      const fail = (reason) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        clearTimeout(retryTimer);
        this._pendingJoinFail = null;
        this.leave();
        reject(new Error(reason));
      };
      const timer = setTimeout(() => fail('notfound'), 22000);

      const tryConnect = () => {
        if (settled || this.closed) return;
        attempt++;

        if (activeConn) {
          try { activeConn.close(); } catch {}
          activeConn = null;
        }

        this._pendingJoinFail = (reason) => {
          if (reason === 'notfound' && attempt < MAX_RETRIES && !settled && !this.closed) {
            console.log(`[join] Host peer not found on attempt ${attempt}, retrying in 1.5s...`);
            retryTimer = setTimeout(tryConnect, 1500);
          } else {
            fail(reason);
          }
        };

        const conn = this.peer.connect(PREFIX + code, { reliable: true });
        activeConn = conn;

        conn.on('open', () => {
          conn.send({ type: 'hello', name: this.name });
        });

        conn.on('data', (msg) => {
          if (!settled) {
            if (msg.type === 'welcome') {
              settled = true;
              clearTimeout(timer);
              clearTimeout(retryTimer);
              this._pendingJoinFail = null;
              this.code = code;
              this.hostConn = conn;
              this.state = msg.state;
              this._setMembers(msg.members);
              resolve();
            } else if (msg.type === 'reject') {
              fail(msg.reason);
            }
            return;
          }
          if (msg.type === 'hb') return;
          this._onHostMsg(msg);
        });

        conn.on('close', () => {
          if (settled && !this.closed) {
            this.emit('host-left');
          } else if (!settled && attempt < MAX_RETRIES && !this.closed) {
            retryTimer = setTimeout(tryConnect, 1500);
          } else if (!settled) {
            fail('notfound');
          }
        });

        conn.on('error', (err) => {
          console.warn('[join conn err]', err);
          if (!settled && attempt < MAX_RETRIES && !this.closed) {
            retryTimer = setTimeout(tryConnect, 1500);
          } else if (!settled) {
            fail('net');
          }
        });
      };

      tryConnect();
    });
  }

  leave() {
    if (this.closed) return;
    this.closed = true;
    this._stopHeartbeat();
    this.calls.forEach((c) => c.close());
    this.conns.forEach((c) => c.close());
    this.hostConn?.close();
    this.peer?.destroy();
    this.calls.clear();
    this.conns.clear();
    this.streams.clear();
  }

  _onPeerError(e) {
    if (e.type === 'peer-unavailable') {
      if (this._pendingJoinFail) this._pendingJoinFail('notfound');
      return; // a member we tried to call is gone — ignore
    }
    if (this.isHost && !this.closed && ['network', 'server-error', 'socket-error', 'socket-closed', 'disconnected'].includes(e.type)) {
      this._recoverHost();
      return;
    }
    if (['network', 'server-error', 'socket-error', 'socket-closed'].includes(e.type)) {
      this.emit('net-error', e);
    }
    console.warn('[peer]', e.type, e);
  }

  /* ---------------- host side ---------------- */

  _onGuestConn(conn) {
    conn.on('data', (msg) => {
      if (msg.type === 'hello') {
        if (this.members.length >= MAX_MEMBERS) return this._reject(conn, 'full');
        if (BUSY_PHASES.includes(this.state.phase)) return this._reject(conn, 'busy');
        const used = new Set(this.members.map((m) => m.idx));
        let idx = 0;
        while (used.has(idx)) idx++;
        const member = { id: conn.peer, name: String(msg.name || 'Guest').slice(0, 20), idx, host: false };
        this.conns.set(conn.peer, conn);
        this.members = [...this.members, member];
        conn.send({ type: 'welcome', state: this.state, members: this.members });
        this._broadcast({ type: 'members', members: this.members }, conn.peer);
        this._setMembers(this.members);
        this.emit('joined', member);
      } else if (msg.type === 'patch') {
        this.setState(msg.patch);
      } else if (msg.type === 'event') {
        const relayed = { ...msg, from: conn.peer };
        this._broadcast(relayed, conn.peer);
        this.emit('event', msg.ev, msg.data, conn.peer);
      }
    });
    conn.on('close', () => this._removeMember(conn.peer));
    conn.on('error', (err) => console.warn('[guest conn err]', conn.peer, err));
  }

  _reject(conn, reason) {
    conn.send({ type: 'reject', reason });
    setTimeout(() => conn.close(), 600);
  }

  _removeMember(id) {
    const m = this.members.find((x) => x.id === id);
    if (!m) return;
    this.conns.delete(id);
    this.members = this.members.filter((x) => x.id !== id);
    this._broadcast({ type: 'members', members: this.members });
    this._setMembers(this.members);
    this.emit('left', m);
  }

  _broadcast(msg, exceptId) {
    this.conns.forEach((conn, id) => {
      if (id !== exceptId && conn.open) conn.send(msg);
    });
  }

  /* ---------------- guest side ---------------- */

  _onHostMsg(msg) {
    if (msg.type === 'state') {
      this.state = msg.state;
      this.emit('state', this.state);
    } else if (msg.type === 'members') {
      const before = new Set(this.members.map((m) => m.id));
      const after = new Set(msg.members.map((m) => m.id));
      msg.members.filter((m) => !before.has(m.id)).forEach((m) => this.emit('joined', m));
      this.members.filter((m) => !after.has(m.id)).forEach((m) => this.emit('left', m));
      this._setMembers(msg.members);
    } else if (msg.type === 'event') {
      this.emit('event', msg.ev, msg.data, msg.from);
    }
  }

  /* ---------------- shared ---------------- */

  _setMembers(list) {
    this.members = [...list].sort((a, b) => a.idx - b.idx);
    const ids = new Set(this.members.map((m) => m.id));

    // drop media of people who left
    for (const [id, call] of this.calls) {
      if (!ids.has(id)) {
        call.close();
        this.calls.delete(id);
        this.streams.delete(id);
        this.emit('stream-gone', id);
      }
    }
    // call new members (only the lexicographically smaller id calls → no duplicates)
    if (!this.solo && this.stream) {
      for (const m of this.members) {
        if (m.id === this.myId || this.calls.has(m.id)) continue;
        if (this.myId < m.id) this._wireCall(this.peer.call(m.id, this.stream));
      }
    }
    this.emit('members', this.members);
  }

  _answer(call) {
    call.answer(this.stream);
    this._wireCall(call);
  }

  _wireCall(call) {
    if (!call) return;
    this.calls.set(call.peer, call);
    call.on('stream', (s) => {
      this.streams.set(call.peer, s);
      this.emit('stream', call.peer, s);
    });
    call.on('close', () => {
      if (this.calls.get(call.peer) === call) {
        this.calls.delete(call.peer);
        this.streams.delete(call.peer);
        this.emit('stream-gone', call.peer);
      }
    });
  }

  /** Patch the shared state. Any member may call this; the host is authoritative. */
  setState(patch) {
    if (this.isHost) {
      this.state = { ...this.state, ...patch };
      this._broadcast({ type: 'state', state: this.state });
      this.emit('state', this.state);
    } else {
      this.state = { ...this.state, ...patch }; // optimistic
      this.hostConn?.open && this.hostConn.send({ type: 'patch', patch });
      this.emit('state', this.state);
    }
  }

  /** Send an event to everyone in the room (including yourself). */
  send(ev, data = {}) {
    const msg = { type: 'event', ev, data, from: this.myId };
    if (this.isHost) this._broadcast(msg);
    else this.hostConn?.open && this.hostConn.send(msg);
    this.emit('event', ev, data, this.myId);
  }
}
