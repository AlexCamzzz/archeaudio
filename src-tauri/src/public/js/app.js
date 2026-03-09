/* global Alpine */

/**
 * app.js — ArcheAudio main Alpine component
 *
 * Data flow:
 *  1. On init, fetch all PipeWire state once.
 *  2. Backend emits "audio-changed" via pactl subscribe loop.
 *  3. Handler maps the affected kind → targeted re-fetch.
 *  4. Smart merge prevents slider jitter during interaction.
 */
document.addEventListener('alpine:init', () => {
  Alpine.data('archeAudio', () => ({

    /* ── Tabs ──────────────────────────────────────────────── */
    activeTab: 'playback',
    tabs: [
      { id: 'playback',  label: 'Playback'  },
      { id: 'recording', label: 'Recording' },
      { id: 'output',    label: 'Output'    },
      { id: 'input',     label: 'Input'     },
      { id: 'config',    label: 'Config'    },
    ],

    /* ── Audio state ───────────────────────────────────────── */
    sinks:         [],
    sources:       [],
    sinkInputs:    [],
    sourceOutputs: [],
    cards:         [],

    /* ── UI state ──────────────────────────────────────────── */
    status:      'connecting...',
    toastMsg:    '',
    isDragging:  false,
    activeTheme: 'archeaudio',

    /* ── Theme catalogue (mirrors themes.js for the picker) ── */
    get themeList() { return Object.entries(THEMES).map(([id, t]) => ({ id, ...t })); },

    /* ── Internal timers / tracking ────────────────────────── */
    _lastTouched:  {},
    _vuTimers:     {},
    _volTimers:    {},
    _toastTimer:   null,
    _unlistenFn:   null,
    _fetching:     {},   // per-kind in-flight guard — drops duplicate concurrent fetches
    _dragCooldown: 0,    // suppress backend events for 200ms after drag ends

    /* ── Lifecycle ─────────────────────────────────────────── */
    async init() {
      await this._loadTheme();
      await this._injectUserTheme();
      await this.fetchAll();
      await this._subscribeToEvents();
    },

    async destroy() {
      if (this._unlistenFn) this._unlistenFn();
      // Clear all VU timers so orphaned intervals can't fire against a
      // destroyed component's reactive proxy after navigation away.
      Object.values(this._vuTimers).forEach(t => clearInterval(t));
      this._vuTimers = {};
    },

    /* ── Theme management ──────────────────────────────────── */
    async _loadTheme() {
      try {
        const saved = await window.__TAURI__.core.invoke('load_theme');
        this.activeTheme = saved;
        applyTheme(saved);
      } catch (e) {
        applyTheme('archeaudio');
      }
    },

    async setTheme(id) {
      this.activeTheme = id;
      applyTheme(id);
      try {
        await window.__TAURI__.core.invoke('save_theme', { name: id });
      } catch (e) {
        console.warn('Could not persist theme:', e);
      }
      this._toast(`theme: ${THEMES[id]?.label ?? id}`);
    },

    /* ── User theme injection ──────────────────────────────── */
    async _injectUserTheme() {
      try {
        const css = await window.__TAURI__.core.invoke('get_user_theme');
        if (!css) return;
        const el = document.createElement('style');
        el.id = 'user-theme';
        el.textContent = css;
        document.head.appendChild(el);
      } catch (e) {
        console.warn('No user theme or failed to load:', e);
      }
    },

    /* ── Event subscription (replaces polling) ─────────────── */
    async _subscribeToEvents() {
      try {
        const { listen } = window.__TAURI__.event;
        // Kind map: which kinds affect which fetch functions
        const kindMap = {
          'sink':          () => this._fetchSinks(),
          'sink-input':    () => this._fetchSinkInputs(),
          'source':        () => this._fetchSources(),
          'source-output': () => this._fetchSourceOutputs(),
          'card':          () => this._fetchCards(),
          'server':        () => this.fetchAll(),
        };

        this._unlistenFn = await listen('audio-changed', (event) => {
          if (this.isDragging || Date.now() < this._dragCooldown) return;
          const handler = kindMap[event.payload] ?? (() => this.fetchAll());
          handler();
        });
      } catch (e) {
        // Tauri event API unavailable (e.g. browser dev mode) — fall back to polling.
        console.warn('Event listener unavailable, falling back to polling:', e);
        setInterval(() => { if (!this.isDragging && Date.now() >= this._dragCooldown) this.fetchAll(); }, 4000);
      }
    },

    /* ── Smart list merge ──────────────────────────────────── */
    // Avoids resetting slider positions during active drags by
    // ignoring volume updates from the backend for 8s after a touch.
    _mergeList(local, incoming, namespace) {
      if (!Array.isArray(incoming)) return; // pactl returned bad data, skip
      incoming.forEach(remote => {
        const item     = local.find(i => i.id === remote.id);
        const touchKey = `${namespace}-${remote.id}`;
        const locked   = (Date.now() - (this._lastTouched[touchKey] || 0)) < 8000;

        if (item) {
          if (!locked) item.volume = remote.volume;
          Object.assign(item, {
            muted:       remote.muted,
            isDefault:   remote.isDefault,
            name:        remote.name,
            nodeName:    remote.nodeName,
            ...(remote.corked    !== undefined && { corked:     remote.corked    }),
            ...(remote.appName                 && { appName:    remote.appName   }),
            ...(remote.mediaName               && { mediaName:  remote.mediaName }),
            ...(remote.activePort              && { activePort: remote.activePort }),
            ...(remote.ports                   && { ports:      remote.ports      }),
          });
        } else {
          local.push(remote);
        }
      });

      // Prune removed items
      for (let i = local.length - 1; i >= 0; i--) {
        if (!incoming.find(r => r.id === local[i].id)) local.splice(i, 1);
      }
    },

    /* ── Fetch helpers ─────────────────────────────────────── */
    get _invoke() { return window.__TAURI__.core.invoke; },

    async _fetchSinks() {
      if (this._fetching.sinks) return;
      this._fetching.sinks = true;
      try {
        const data = await this._invoke('get_sinks');
        this._mergeList(this.sinks, data, 'device');
      } finally { this._fetching.sinks = false; }
    },

    async _fetchSources() {
      if (this._fetching.sources) return;
      this._fetching.sources = true;
      try {
        const data = await this._invoke('get_sources');
        this._mergeList(this.sources, data, 'device');
      } finally { this._fetching.sources = false; }
    },

    async _fetchSinkInputs() {
      if (this._fetching.sinkInputs) return;
      this._fetching.sinkInputs = true;
      try {
        const data = await this._invoke('get_sink_inputs');
        this._mergeList(this.sinkInputs, data, 'stream');
        // Await nextTick INSIDE the guard so no second fetch can call
        // _mergeList while Alpine is flushing this DOM update.
        await new Promise(r => this.$nextTick(r));
        this.sinkInputs.forEach(s => {
          if (!s.corked && !s.muted) this._startVU(`vu-${s.id}`);
        });
      } finally { this._fetching.sinkInputs = false; }
    },

    async _fetchSourceOutputs() {
      if (this._fetching.sourceOutputs) return;
      this._fetching.sourceOutputs = true;
      try {
        const data = await this._invoke('get_source_outputs');
        this._mergeList(this.sourceOutputs, data, 'stream');
        await new Promise(r => this.$nextTick(r));
      } finally { this._fetching.sourceOutputs = false; }
    },

    async _fetchCards() {
      if (this._fetching.cards) return;
      this._fetching.cards = true;
      try {
        this.cards = await this._invoke('get_cards');
      } finally { this._fetching.cards = false; }
    },

    async fetchAll() {
      try {
        const [sinks, sources, inputs, outputs, cards] = await Promise.all([
          this._invoke('get_sinks'),
          this._invoke('get_sources'),
          this._invoke('get_sink_inputs'),
          this._invoke('get_source_outputs'),
          this._invoke('get_cards'),
        ]);

        this.status = `${sinks.length} out · ${sources.length} in`;

        this._mergeList(this.sinks,         sinks,   'device');
        this._mergeList(this.sources,       sources, 'device');
        this._mergeList(this.sinkInputs,    inputs,  'stream');
        this._mergeList(this.sourceOutputs, outputs, 'stream');
        this.cards = cards;

        this.$nextTick(() => {
          this.sinkInputs.forEach(s => {
            if (!s.corked && !s.muted) this._startVU(`vu-${s.id}`);
          });
        });
      } catch (e) {
        this.status = 'error';
        console.error('fetchAll failed:', e);
      }
    },

    /* ── VU animation ──────────────────────────────────────── */
    _startVU(elId) {
      // Clear any existing timer for this id before starting fresh.
      // Prevents stale interval accumulation during rapid sink-input
      // churn (e.g. Spotify gapless/crossfade creating new IDs fast).
      if (this._vuTimers[elId]) {
        clearInterval(this._vuTimers[elId]);
        delete this._vuTimers[elId];
      }
      this._vuTimers[elId] = setInterval(() => {
        const el = document.getElementById(elId);
        if (!el) {
          clearInterval(this._vuTimers[elId]);
          delete this._vuTimers[elId];
          return;
        }
        el.querySelectorAll('.vu-bar').forEach(bar => {
          const h   = Math.random() * 14 + 2;
          const pct = h / 16;
          bar.style.height     = h + 'px';
          bar.style.background = pct > 0.85 ? 'var(--red)'    :
              pct > 0.65 ? 'var(--yellow)' : 'var(--green)';
          bar.style.boxShadow  = pct > 0.85 ? 'var(--glow-vu-red)'    :
              pct > 0.65 ? 'var(--glow-vu-yellow)' : 'var(--glow-vu-green)';
        });
      }, 80);
    },

    /* ── Volume helpers (called by child components) ─────────── */
    volPct(vol)   { return Math.min(vol, 150) / 150 * 100; },

    volColor(item) {
      if (item.muted)     return 'var(--text-dim)';
      if (item.isDefault) return 'var(--accent)';
      return 'var(--text-mid)';
    },

    /* ── Drag-to-set volume ────────────────────────────────── */
    startDrag(event, item, type, kind) {
      this.isDragging = true;
      const touchKey  = `${type}-${item.id}`;
      this._lastTouched[touchKey] = Date.now();

      const slider = event.currentTarget;

      const update = (e) => {
        const rect = slider.getBoundingClientRect();
        const pct  = Math.max(0, Math.min((e.clientX - rect.left) / rect.width, 1));
        const v    = Math.round(pct * 150);
        item.volume = v;
        this._lastTouched[touchKey] = Date.now();

        clearTimeout(this._volTimers[item.id]);
        this._volTimers[item.id] = setTimeout(() => {
          type === 'device'
              ? this._invoke('set_volume', { id: item.id, volume: v })
              : this._invoke('set_stream_volume', { id: item.id, volume: v, kind });
        }, 40);
      };

      update(event);
      const onMove = (e) => update(e);
      const onUp   = () => {
        this._dragCooldown = Date.now() + 200; // 40ms debounce + PW round-trip
        this.isDragging    = false;
        window.removeEventListener('mousemove', onMove);
        window.removeEventListener('mouseup',   onUp);
      };
      window.addEventListener('mousemove', onMove);
      window.addEventListener('mouseup',   onUp);
    },

    /* ── Device controls ───────────────────────────────────── */
    async setDefault(item) {
      await this._invoke('set_default', { id: item.id });
      this._toast('default updated');
    },

    async deviceMute(item, mute) {
      item.muted = mute;
      await this._invoke('set_mute', { id: item.id, mute });
    },

    /* ── Stream controls ───────────────────────────────────── */
    async streamMute(id, mute, kind) {
      const list = kind === 'sink-input' ? this.sinkInputs : this.sourceOutputs;
      const item = list.find(s => s.id === id);
      if (item) item.muted = mute;
      await this._invoke('set_stream_mute', { id, mute, kind });
    },

    async moveStream(streamId, targetId, kind) {
      await this._invoke('move_stream', { streamId, targetId, kind });
      this._toast('stream routed');
    },

    /* ── Device port / card profile ────────────────────────── */
    async setPort(deviceName, port, kind) {
      await this._invoke('set_port', { deviceName, port, kind });
      this._toast(`port → ${port}`);
    },

    async setProfile(cardName, profile) {
      await this._invoke('set_profile', { cardName, profile });
      this._toast('profile updated');
    },

    /* ── App icon mapping ──────────────────────────────────── */
    appIcon(name) {
      const MAP = {
        spotify: '🎵', firefox: '🦊', brave: '🦁',
        chromium: '🌐', chrome: '🌐', vlc: '🎬',
        mpv: '▶', discord: '💬', telegram: '✈',
        slack: '💼', zoom: '📹', obs: '🔴', steam: '🎮',
      };
      const k = (name || '').toLowerCase();
      for (const [key, val] of Object.entries(MAP)) {
        if (k.includes(key)) return val;
      }
      return '◈';
    },

    /* ── Toast ─────────────────────────────────────────────── */
    _toast(msg) {
      this.toastMsg = msg;
      clearTimeout(this._toastTimer);
      this._toastTimer = setTimeout(() => { this.toastMsg = ''; }, 2000);
    },

    /* ── Expose api object for child components ─────────────── */
    get api() {
      return {
        appIcon:     this.appIcon.bind(this),
        volPct:      this.volPct.bind(this),
        volColor:    this.volColor.bind(this),
        startDrag:   this.startDrag.bind(this),
        deviceMute:  this.deviceMute.bind(this),
        streamMute:  this.streamMute.bind(this),
        setDefault:  this.setDefault.bind(this),
        moveStream:  this.moveStream.bind(this),
        setPort:     this.setPort.bind(this),
        setProfile:  this.setProfile.bind(this),
      };
    },
  }));
});