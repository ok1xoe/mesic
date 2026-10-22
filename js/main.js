// Hlavní smyčka (50 Hz), vstup z klávesnice a dotyku, škálování, rekord.
(function (root) {
    'use strict';

    var MV = root.MV;
    var canvas = document.getElementById('screen');
    var ctx = canvas.getContext('2d');
    var scr = new MV.Screen();
    var hi = 0;
    try { hi = parseInt(localStorage.getItem('mesic.hi'), 10) || 0; } catch (e) { hi = 0; }
    var g = MV.newGame(Date.now() & 0xffffff, hi);
    var held = { left: false, right: false, up: false, down: false, fire: false, back: false, act: false };
    var prevState = 'play', savedHi = hi;

    function setBorder(color) {
        var c = MV.PAL[color & 7];
        document.body.style.background = 'rgb(' + c[0] + ',' + c[1] + ',' + c[2] + ')';
    }

    function saveHi() {
        if (g.hi !== savedHi) {
            savedHi = g.hi;
            try { localStorage.setItem('mesic.hi', String(g.hi)); } catch (e) { /* ignorovat */ }
        }
    }

    function toTitle() {
        g.state = 'title';
        setBorder(0);
        MV.sound.startTune();
    }

    function press() {
        MV.sound.unlock();
        if (g.state === 'title') { MV.sound.stopTune(); MV.start(g); setBorder(0); }
        else if (g.state === 'over') { toTitle(); }
    }

    function togglePause() {
        if (g.state === 'play') { prevState = 'play'; g.state = 'paused'; }
        else if (g.state === 'paused') { g.state = prevState; }
    }

    function tick() {
        MV.tick(g, held);
        saveHi();
    }

    function draw() {
        MV.draw(scr, g);
        scr.render(ctx);
    }

    var KEYS = {
        37: 'left', 65: 'left', 39: 'right', 68: 'right', 38: 'up', 87: 'up', 40: 'down', 83: 'down',
        32: 'fire', 90: 'back', 88: 'back', 13: 'act', 69: 'act'
    };

    document.addEventListener('keydown', function (e) {
        var k = KEYS[e.keyCode];
        if (k) {
            e.preventDefault();
            held[k] = true;
            if (!e.repeat && (k === 'fire' || k === 'act' || k === 'up')) { press(); }
        } else if (e.keyCode === 80) {
            togglePause();
        } else if (e.keyCode === 77) {
            if (!MV.sound.toggleMute() && g.state === 'title') { MV.sound.startTune(); }
        }
        MV.sound.unlock();
    });

    document.addEventListener('keyup', function (e) {
        var k = KEYS[e.keyCode];
        if (k) { held[k] = false; }
    });

    Array.prototype.forEach.call(document.querySelectorAll('#touch button'), function (b) {
        var act = b.getAttribute('data-act');
        function down(e) {
            e.preventDefault();
            MV.sound.unlock();
            if (act === 'pause') { togglePause(); return; }
            held[act] = true;
            if (act === 'fire' || act === 'up' || act === 'act') { press(); }
        }
        function up(e) { e.preventDefault(); if (act !== 'pause') { held[act] = false; } }
        b.addEventListener('pointerdown', down);
        b.addEventListener('pointerup', up);
        b.addEventListener('pointercancel', up);
        b.addEventListener('pointerleave', up);
        b.addEventListener('contextmenu', function (e) { e.preventDefault(); });
    });

    canvas.addEventListener('pointerdown', function () {
        if (g.state === 'title' || g.state === 'over') { press(); }
        else if (g.state === 'paused') { togglePause(); }
    });

    document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
            if (g.state === 'play') { prevState = 'play'; g.state = 'paused'; }
            Object.keys(held).forEach(function (k) { held[k] = false; });
        }
    });

    // celočíselné měřítko
    function fit() {
        var touch = window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
        var availH = window.innerHeight - (touch ? 150 : 24);
        var s = Math.min(window.innerWidth / 256, availH / 192);
        s = s >= 1 ? Math.floor(s) : Math.max(0.5, s);
        canvas.style.width = Math.round(256 * s) + 'px';
        canvas.style.height = Math.round(192 * s) + 'px';
    }
    window.addEventListener('resize', fit);
    fit();

    // fixní krok 50 Hz
    var last = 0, acc = 0, STEP = 20;

    function loop(ts) {
        var dt = Math.min(250, ts - last || 0);
        last = ts;
        if (g.state !== 'paused') {
            acc += dt;
            var n = 0;
            while (acc >= STEP && n < 6) { tick(); acc -= STEP; n++; }
            if (n >= 6) { acc = 0; }
        } else {
            acc = 0;
            g.frame++;
        }
        draw();
        requestAnimationFrame(loop);
    }

    MV.app = { g: g, held: held, tick: tick, draw: draw, scr: scr };

    toTitle();
    requestAnimationFrame(loop);
})(typeof window !== 'undefined' ? window : globalThis);
