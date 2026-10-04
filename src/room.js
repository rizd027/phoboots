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
      const peer = id ? new Peer(id, { debug: 1 }) : new Peer({ debug: 1 });
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
          if (!peer.destroyed && !this.closed) peer.reconnect();
        });
        resolve(peer);
      });
    });
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
    return this.code;
  }

  async join(rawCode) {
    const code = rawCode.trim().toUpperCase();
    await this._open();
    this.myId = this.peer.id;
    this.peer.on('call', (call) => this._answer(call));

    return new Promise((resolve, reject) => {
      let settled = false;
      const fail = (reason) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        this._pendingJoinFail = null;
        this.leave();
        reject(new Error(reason));
      };
      const timer = setTimeout(() => fail('notfound'), 15000);
      this._pendingJoinFail = fail;

      const conn = this.peer.connect(PREFIX + code, { reliable: true });
      conn.on('open', () => conn.send({ type: 'hello', name: this.name }));
      conn.on('data', (msg) => {
        if (!settled) {
          if (msg.type === 'welcome') {
            settled = true;
            clearTimeout(timer);
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
        this._onHostMsg(msg);
      });
      conn.on('close', () => {
        if (settled && !this.closed) this.emit('host-left');
        else fail('notfound');
      });
      conn.on('error', () => fail('net'));
    });
  }

  leave() {
    if (this.closed) return;
    this.closed = true;
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
    conn.on('error', () => this._removeMember(conn.peer));
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
