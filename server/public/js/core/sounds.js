const AudioCtx = window.AudioContext || window.webkitAudioContext;
let ctx;
function getCtx() { if (!ctx) ctx = new AudioCtx(); return ctx; }

export function beepSuccess() {
    try {
        const c = getCtx(), o = c.createOscillator(), g = c.createGain();
        o.connect(g); g.connect(c.destination);
        o.frequency.value = 1200; g.gain.value = 0.08;
        o.start(); o.stop(c.currentTime + 0.08);
    } catch (e) { console.warn('AudioContext not supported'); }
}

export function beepError() {
    try {
        const c = getCtx(), o = c.createOscillator(), g = c.createGain();
        o.connect(g); g.connect(c.destination);
        o.frequency.value = 300; g.gain.value = 0.1;
        o.start(); o.stop(c.currentTime + 0.2);
    } catch (e) { console.warn('AudioContext not supported'); }
}

export function beepScan() {
    try {
        const c = getCtx(), o = c.createOscillator(), g = c.createGain();
        o.connect(g); g.connect(c.destination);
        o.frequency.value = 800; g.gain.value = 0.06;
        o.start();
        o.frequency.setValueAtTime(1600, c.currentTime + 0.05);
        o.stop(c.currentTime + 0.1);
    } catch (e) { console.warn('AudioContext not supported'); }
}
