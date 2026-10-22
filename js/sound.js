// Zvuky přes WebAudio – "beeper" (čtvercová vlna), melodie na titulní obrazovce.
(function (root) {
    'use strict';

    var MV = root.MV = root.MV || {};

    var ac = null, muted = false, tuneTimer = null, tuneStep = 0;

    try {
        var AC = root.AudioContext || root.webkitAudioContext;
        if (AC) { ac = new AC(); }
    } catch (e) { ac = null; }

    function unlock() {
        if (ac && ac.state === 'suspended') { try { ac.resume(); } catch (e) { /* ignorovat */ } }
    }

    function beep(freq, dur, slideTo, vol, delay) {
        if (!ac || muted) { return; }
        try {
            var t0 = ac.currentTime + (delay || 0);
            var o = ac.createOscillator(), g = ac.createGain();
            o.type = 'square';
            o.frequency.setValueAtTime(freq, t0);
            if (slideTo) { o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur); }
            g.gain.setValueAtTime(vol || 0.04, t0);
            g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
            o.connect(g); g.connect(ac.destination);
            o.start(t0); o.stop(t0 + dur + 0.02);
        } catch (e) { /* ignorovat */ }
    }

    var TUNE = [
        262, 0, 330, 392, 0, 523, 392, 0, 349, 0, 440, 523, 0, 698, 523, 0,
        294, 0, 370, 440, 0, 587, 440, 0, 330, 392, 330, 262, 0, 0, 0, 0
    ];
    var BASS = [65, 0, 0, 0, 65, 0, 0, 0, 87, 0, 0, 0, 87, 0, 0, 0, 73, 0, 0, 0, 73, 0, 0, 0, 65, 0, 0, 0, 98, 0, 0, 0];

    MV.sound = {
        unlock: unlock,
        toggleMute: function () { muted = !muted; if (muted) { MV.sound.stopTune(); } return muted; },
        isMuted: function () { return muted; },
        jump: function () { beep(180, 0.2, 520, 0.035); },
        shoot: function () { beep(1500, 0.06, 400, 0.025); },
        shootBack: function () { beep(1000, 0.07, 250, 0.025); },
        hit: function () { beep(240, 0.25, 60, 0.06); },
        boom: function () { beep(160, 0.3, 40, 0.05); },
        thrust: function () { beep(90, 0.05, 70, 0.02); },
        pick: function () { beep(660, 0.06, 0, 0.05); beep(990, 0.08, 0, 0.05, 0.06); },
        gem: function () { beep(1100, 0.06, 0, 0.05); beep(1480, 0.06, 0, 0.05, 0.06); beep(1760, 0.1, 0, 0.05, 0.12); },
        board: function () { beep(500, 0.06, 0, 0.04); beep(380, 0.08, 0, 0.04, 0.07); },
        deliver: function () { [392, 523, 659, 784].forEach(function (f, i) { beep(f, 0.12, 0, 0.05, i * 0.09); }); },
        built: function () { [523, 659, 784, 1047, 784, 1047, 1319].forEach(function (f, i) { beep(f, 0.14, 0, 0.05, i * 0.12); }); },
        die: function () { beep(700, 0.8, 40, 0.05); },
        over: function () { [392, 330, 262, 196].forEach(function (f, i) { beep(f, 0.25, 0, 0.05, i * 0.22); }); },
        startTune: function () {
            if (tuneTimer || !ac) { return; }
            tuneTimer = setInterval(function () {
                var n = TUNE[tuneStep % TUNE.length], b = BASS[tuneStep % BASS.length];
                if (n) { beep(n, 0.12, 0, 0.025); }
                if (b) { beep(b * 2, 0.3, 0, 0.03); }
                tuneStep++;
            }, 150);
        },
        stopTune: function () { if (tuneTimer) { clearInterval(tuneTimer); tuneTimer = null; } tuneStep = 0; }
    };
})(typeof window !== 'undefined' ? window : globalThis);
