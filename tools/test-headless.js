// Headless test v Node: načte skutečné skripty s atrapou DOM, ověří svět (řešitelnost),
// přehraje bota přes herní smyčku (moduly vozítkem i astronautem), kontroluje NaN a přechody stavů.
// Použití: node tools/test-headless.js [adresář-pro-PNG]
'use strict';
var fs = require('fs');
var path = require('path');
var vm = require('vm');
var zlib = require('zlib');
var root = path.join(__dirname, '..');
var outDir = process.argv[2] || null;
if (outDir) { fs.mkdirSync(outDir, { recursive: true }); }

var lastImg = null;
var ctxStub = {
    createImageData: function (w, h) { return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h }; },
    putImageData: function (img) { lastImg = img; }
};
var canvasStub = { getContext: function () { return ctxStub; }, addEventListener: function () { }, style: {} };
var listeners = {};
global.window = global;
global.innerWidth = 1024; global.innerHeight = 768;
global.matchMedia = function () { return { matches: false }; };
global.addEventListener = function () { };
global.document = {
    getElementById: function () { return canvasStub; },
    querySelectorAll: function () { return []; },
    addEventListener: function (t, f) { (listeners[t] = listeners[t] || []).push(f); },
    body: { style: {} }, hidden: false
};
global.localStorage = { getItem: function () { return null; }, setItem: function () { } };
global.requestAnimationFrame = function () { };
global.setInterval = function () { return 0; };
global.clearInterval = function () { };

['sprites', 'font', 'gfx', 'sound', 'game', 'render', 'main'].forEach(function (f) {
    vm.runInThisContext(fs.readFileSync(path.join(root, 'js', f + '.js'), 'utf8'), { filename: f + '.js' });
});
var MV = global.MV;
var fails = 0;
function check(c, msg) { if (!c) { console.log('  CHYBA: ' + msg); fails++; } }
function ok(msg) { console.log('  ok: ' + msg); }

// ---------- PNG ----------
function crc32(buf) {
    var t = crc32.t;
    if (!t) { t = crc32.t = []; for (var n = 0; n < 256; n++) { var c = n; for (var k = 0; k < 8; k++) { c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1; } t[n] = c >>> 0; } }
    var crc = 0xFFFFFFFF;
    for (var i = 0; i < buf.length; i++) { crc = t[(crc ^ buf[i]) & 255] ^ (crc >>> 8); }
    return (crc ^ 0xFFFFFFFF) >>> 0;
}
function chunk(type, data) {
    var len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    var td = Buffer.concat([Buffer.from(type), data]);
    var c = Buffer.alloc(4); c.writeUInt32BE(crc32(td));
    return Buffer.concat([len, td, c]);
}
function savePng(name, img, sc) {
    if (!outDir || !img) { return; }
    var w = img.width * sc, h = img.height * sc, raw = Buffer.alloc((w * 3 + 1) * h);
    for (var y = 0; y < h; y++) {
        raw[y * (w * 3 + 1)] = 0;
        for (var x = 0; x < w; x++) {
            var o = ((Math.floor(y / sc)) * img.width + Math.floor(x / sc)) * 4, p = y * (w * 3 + 1) + 1 + x * 3;
            raw[p] = img.data[o]; raw[p + 1] = img.data[o + 1]; raw[p + 2] = img.data[o + 2];
        }
    }
    var ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
    fs.writeFileSync(path.join(outDir, name + '.png'), Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
}
function snap(name, g) { MV.draw(MV.app.scr, g); MV.app.scr.render(ctxStub); savePng(name, lastImg, 3); }

// ---------- 1) ověření světů ----------
console.log('Svět:');
for (var rd = 1; rd <= 10; rd++) {
    var w = MV.buildWorld(rd), h = w.h, bad = 0, inCr = {};
    w.craters.forEach(function (c) { for (var i = c.x - 1; i <= c.x + c.w; i++) { inCr[i] = 1; } });
    for (var x = 1; x < w.w; x++) { if (!inCr[x] && !inCr[x - 1] && Math.abs(h[x] - h[x - 1]) > 3) { bad++; } }
    check(bad === 0, 'kolo ' + rd + ': prudké stupně mimo krátery: ' + bad);
    var maxw = 0, mingap = 1e9;
    w.craters.forEach(function (c, i) {
        maxw = Math.max(maxw, c.w);
        if (i) { mingap = Math.min(mingap, c.x - (w.craters[i - 1].x + w.craters[i - 1].w)); }
        check(c.floor - Math.min(h[c.x - 1], h[c.x + c.w]) <= 17, 'kolo ' + rd + ': příliš hluboký kráter');
    });
    check(maxw <= 44, 'šířka kráteru ' + maxw);
    check(mingap >= 80, 'mezera mezi krátery ' + mingap);
    w.mods.forEach(function (m) {
        check(!inCr[m.x] && h[m.x] < 140, 'kolo ' + rd + ': modul v kráteru');
        check(m.y >= 20 && m.y + m.h <= h[m.x], 'kolo ' + rd + ': modul mimo plochu');
        check(m.x > w.baseX + w.padW + 40 && m.x < w.w - 20, 'modul mimo dosah');
    });
    w.gems.forEach(function (q) { check(q.y >= 14 && q.y < h[q.x], 'kámen mimo plochu'); });
    check(w.mods.some(function (m) { return m.ped; }), 'kolo ' + rd + ': žádný modul pro astronauta');
    if (rd <= 4) { console.log('  kolo ' + rd + ': šířka ' + w.w + ', kráterů ' + w.craters.length + ', max šířka ' + maxw + ', moduly ' + w.mods.map(function (m) { return m.kind + (m.ped ? 'P' : 'G') + '@' + m.x; }).join(' ')); }
}

// ---------- bot ----------
function sign(v) { return v > 0 ? 1 : (v < 0 ? -1 : 0); }
function makeBot() {
    var st = { stuck: 0, lastX: 0 };
    return function (g) {
        var inp = { left: 0, right: 0, up: 0, down: 0, fire: 0, back: 0, act: 0 };
        if (g.state !== 'play') { return inp; }
        var w = g.world, r = g.rover, a = g.astro, mods = w.mods, i;
        var gunY = g.mode === 'rover' ? r.y - 7 : a.y - 6, me = g.mode === 'rover' ? r : a;
        // střelba
        for (i = 0; i < g.enemies.length; i++) {
            var e = g.enemies[i], dx = e.x - me.x;
            if (Math.abs(e.y - gunY) < 7 && Math.abs(dx) < 120 && Math.abs(dx) > 8) {
                if (dx * me.face > 0) { inp.fire = 1; } else { inp.back = 1; }
            }
        }
        function driveTo(tx, tol) {
            var dx = tx - r.x, d = Math.abs(dx) > tol ? sign(dx) : 0;
            if (d) { if (d > 0) { inp.right = 1; } else { inp.left = 1; } }
            if (r.grounded && (d || Math.abs(r.vx) > 0.3)) {
                var dd = d || sign(r.vx);
                var xf = r.x + dd * 7;
                for (var k = 1; k <= 14; k++) { if (g.world.h[Math.max(0, Math.min(w.w - 1, Math.floor(xf + dd * k)))] - r.y >= 6) { inp.up = 1; break; } }
                if (d && Math.abs(r.vx) < 0.05 && st.stuck++ > 5) { inp.up = 1; }
            }
            if (!d) { st.stuck = 0; }
            return d === 0;
        }
        function flyTo(tx, ty) {
            var dx = tx - a.x;
            if (Math.abs(dx) > 3) { if (dx > 0) { inp.right = 1; } else { inp.left = 1; } }
            if (a.y + a.vy * 14 > ty) { inp.up = 1; }
        }
        var target = null;
        for (i = 0; i < mods.length; i++) { if (mods[i].state === 'free') { target = mods[i]; break; } }
        var baseC = w.baseX + w.padW / 2;
        if (g.mode === 'rover') {
            if (r.carry !== null) { driveTo(baseC, 3); }
            else if (target) {
                if (!target.ped || target.fall === false && target.y + target.h >= g.world.h[target.x] - 1) { driveTo(target.x, 2); }
                else if (driveTo(target.x, 5) && Math.abs(r.vx) < 0.1) { inp.act = (g.t & 1); }
            }
        } else {
            var nearR = Math.abs(a.x - r.x) < 16 && Math.abs(a.y - r.y) < 28;
            if (a.carry !== null) {
                if (nearR) { inp.act = (g.t & 1); }
                else { flyTo(r.x, r.y - 12); }
            } else if (target) {
                if (target.ped && !target.fall) { flyTo(target.x, target.y + target.h + 5); }
                else { inp.act = nearR ? (g.t & 1) : 0; if (!nearR) { flyTo(r.x, r.y - 12); } }
            } else {
                if (nearR) { inp.act = (g.t & 1); } else { flyTo(r.x, r.y - 12); }
            }
        }
        return inp;
    };
}

function runBot(label, god, maxSteps, targetRound, seed) {
    var g = MV.newGame(seed, 0);
    g.god = god;
    MV.start(g);
    var bot = makeBot(), steps = 0, nan = false, roundSteps = {}, last = g.round, startRound = 0, snaps = {};
    var states = {};
    while (steps < maxSteps && g.round < targetRound && g.state !== 'over') {
        var inp = bot(g);
        MV.tick(g, inp);
        steps++;
        states[g.state] = (states[g.state] || 0) + 1;
        var p = g.mode === 'rover' ? g.rover : g.astro;
        if (!isFinite(p.x) || !isFinite(p.y) || !isFinite(g.cam) || !isFinite(g.energy) || !isFinite(g.fuel)) { nan = true; break; }
        g.enemies.forEach(function (e) { if (!isFinite(e.x) || !isFinite(e.y)) { nan = true; } });
        if (steps % 25 === 0) { MV.draw(MV.app.scr, g); }
        if (g.mode === 'astro' && g.astro.carry !== null && !snaps.astro) { snaps.astro = 1; snap(label + '-astro', g); }
        if (g.enemies.length >= 4 && g.state === 'play' && !snaps.enemy && steps > 1500) { snaps.enemy = 1; snap(label + '-enemies', g); }
        if (g.state === 'built' && !snaps.built) { snaps.built = 1; snap(label + '-built', g); }
        if (g.round !== last) { roundSteps[last] = steps - startRound; startRound = steps; last = g.round; }
    }
    check(!nan, label + ': NaN');
    return { g: g, steps: steps, roundSteps: roundSteps, states: states };
}

console.log('Bot s nesmrtelností (hledá řešitelnost kol):');
var res = runBot('god', true, 120000, 5, 7);
console.log('  kol dokončeno: ' + (res.g.round - 1) + ', kroků: ' + res.steps + ', po kolech: ' + JSON.stringify(res.roundSteps) + ', skóre ' + res.g.score);
check(res.g.round >= 5, 'bot má projít alespoň 4 kola (je v kole ' + res.g.round + ', stav ' + res.g.state + ')');

console.log('Bot bez nesmrtelnosti:');
var res2 = runBot('norm', false, 60000, 4, 11);
console.log('  stav ' + res2.g.state + ', kolo ' + res2.g.round + ', životy ' + res2.g.lives + ', kroků ' + res2.steps + ', stavy ' + JSON.stringify(res2.states));

// ---------- přechody stavů ----------
console.log('Stavy:');
var g = MV.app.g;
check(g.state === 'title', 'start v titulní obrazovce');
snap('title', g);
var held = MV.app.held;
// title -> play přes klávesu
listeners.keydown.forEach(function (f) { f({ keyCode: 32, preventDefault: function () { }, repeat: false }); });
check(g.state === 'play', 'mezerník spustí hru');
listeners.keyup.forEach(function (f) { f({ keyCode: 32 }); });
for (var s = 0; s < 400; s++) { MV.app.tick(); if (s % 50 === 0) { MV.app.draw(); } }
snap('play-start', g);
// pauza
listeners.keydown.forEach(function (f) { f({ keyCode: 80, preventDefault: function () { } }); });
check(g.state === 'paused', 'P pauzuje');
MV.app.draw(); snap('paused', g);
listeners.keydown.forEach(function (f) { f({ keyCode: 80, preventDefault: function () { } }); });
check(g.state === 'play', 'P pokračuje');
// visibilitychange
document.hidden = true;
listeners.visibilitychange.forEach(function (f) { f({}); });
check(g.state === 'paused', 'skrytí okna pauzuje');
document.hidden = false;
listeners.keydown.forEach(function (f) { f({ keyCode: 80, preventDefault: function () { } }); });
// play -> dying -> (respawn) -> over: dopadající meteority přímo na hráče
var sawDying = false, guard = 0, lives0 = g.lives;
while (g.state !== 'over' && guard++ < 20000) {
    if (g.state === 'play' && (guard % 20) === 0) {
        var pr = g.mode === 'rover' ? g.rover : g.astro;
        g.inv = 0;
        g.enemies.push({ t: 'met', x: pr.x, y: pr.y - 5, vx: 0, vy: 0.1, w: 8, h: 8, hp: 1, pts: 50, age: 0 });
    }
    MV.app.tick();
    if (g.state === 'dying') { sawDying = true; }
    if (g.state === 'dying' && guard % 7 === 0) { MV.app.draw(); }
}
check(sawDying, 'stav dying nastal');
check(g.state === 'over', 'stav over nastal (po ' + guard + ' krocích)');
check(lives0 === 3, 'tři životy na startu');
MV.app.draw(); snap('over', g);
listeners.keydown.forEach(function (f) { f({ keyCode: 32, preventDefault: function () { }, repeat: false }); });
check(g.state === 'title', 'mezerník po konci vede do titulní obrazovky');
listeners.keyup.forEach(function (f) { f({ keyCode: 32 }); });

// ---------- ruční scénáře: kameny, pustit modul, střelba dozadu ----------
console.log('Scénáře:');
var t = MV.newGame(3, 0); MV.start(t);
var gem = t.world.gems[0];
t.mode = 'astro'; t.astro.x = gem.x; t.astro.y = gem.y + 5; t.astro.vy = 0;
var sc0 = t.score;
MV.tick(t, {});
check(t.score === sc0 + 500 && gem.got, 'astronaut sebere kámen');
t.mode = 'rover'; t.rover.face = 1; t.rover.cd = 0; t.bullets = [];
MV.tick(t, { back: 1 });
check(t.bullets.length === 1 && t.bullets[0].vx < 0, 'střelba dozadu');
t.rover.cd = 0; MV.tick(t, { fire: 1 });
check(t.bullets.some(function (b) { return b.vx > 0; }), 'střelba vpřed');
// pustit modul
var m = t.world.mods.filter(function (q) { return q.ped; })[0];
t.mode = 'astro'; t.astro.x = m.x; t.astro.y = m.y + m.h + 4; t.astro.vy = 0; t.astro.onGround = false;
MV.tick(t, {});
check(t.astro.carry !== null, 'astronaut zvedne modul z podstavce');
MV.tick(t, { act: 1 });
check(t.astro.carry === null && t.world.mods.indexOf(m) >= 0 && m.state === 'free' && m.fall, 'E pustí modul');
for (var q = 0; q < 600 && m.fall; q++) { MV.tick(t, {}); }
check(!m.fall && Math.abs(m.y + m.h - MV.groundAt(t, m.x)) < 1, 'modul dopadne na zem');

console.log(fails ? ('SELHÁNÍ: ' + fails) : 'VŠE V POŘÁDKU');
process.exit(fails ? 1 : 0);
