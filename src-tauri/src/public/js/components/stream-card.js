/* global Alpine */

/**
 * stream-card.js
 * Alpine.data component for playback / recording stream cards.
 *
 * Usage:
 *   <div x-data="streamCard(stream, kind, sinks, sources, api)">
 *
 * @param {object} stream   – reactive stream object from parent
 * @param {string} kind     – 'sink-input' | 'source-output'
 * @param {array}  sinks    – reactive sink list (for routing)
 * @param {array}  sources  – reactive source list (for routing)
 * @param {object} api      – shared methods from archeAudio (mute, drag, etc.)
 */
document.addEventListener('alpine:init', () => {
  Alpine.data('streamCard', (stream, kind, sinks, sources, api) => ({
    get targets()   { return kind === 'sink-input' ? sinks : sources; },
    get isSink()    { return kind === 'sink-input'; },

    appIcon(name) { return api.appIcon(name); },
    volPct(vol)   { return api.volPct(vol); },

    startDrag(event) {
      api.startDrag(event, stream, 'stream', kind);
    },

    toggleMute() {
      api.streamMute(stream.id, !stream.muted, kind);
    },

    route(event) {
      console.log('[route]', { streamId: stream.id, targetName: event.target.value, kind });
      api.moveStream(stream.id, event.target.value, kind); // string, sin parseInt
    },

    matchesSink(target) {
      return this.isSink
          ? target.nodeName === stream.sinkName
          : target.id === stream.sourceIndex;
    },
  }));
});
