/* global Alpine */

/**
 * device-card.js
 * Alpine.data component for output / input device cards.
 *
 * Usage:
 *   <div x-data="deviceCard(device, kind, api)">
 *
 * @param {object} device – reactive device object from parent
 * @param {string} kind   – 'sink' | 'source'
 * @param {object} api    – shared methods from archeAudio
 */
document.addEventListener('alpine:init', () => {
  Alpine.data('deviceCard', (device, kind, api) => ({
    get hasPorts()     { return device.ports && device.ports.length > 1; },
    get volPct()       { return api.volPct(device.volume); },
    get fillColor()    { return api.volColor(device); },

    startDrag(event) {
      api.startDrag(event, device, 'device', null);
    },

    toggleMute() {
      api.deviceMute(device, !device.muted);
    },

    makeDefault() {
      api.setDefault(device);
    },

    changePort(event) {
      api.setPort(device.nodeName, event.target.value, kind);
    },
  }));
});
