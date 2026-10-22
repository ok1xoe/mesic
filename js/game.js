// Herní logika (bez DOM): svět, vozítko, astronaut, nepřátelé, moduly, kola.
// Fixní krok 50 Hz. Souřadnice: x vodorovně ve světě, y shora (0..159 je herní plocha).
(function (root) {
    'use strict';

    var MV = root.MV = root.MV || {};

    var PH = 160;               // výška herní plochy
    var BASE_X = 140, PAD_W = 56;
    var GROUND = 130;

    function mulberry(seed) {
        var a = seed >>> 0;
        return function () {
            a = (a + 0x6D2B79F5) | 0;
            var t = Math.imul(a ^ (a >>> 15), 1 | a);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

    // ---------- svět ----------
    function buildWorld(round) {
        var W = Math.min(3600, 2000 + 400 * round);
        var rnd = mulberry(9000 + round * 131);
        var h = new Int16Array(W);
        var p1 = rnd() * 6.28, p2 = rnd() * 6.28, x, i;
        for (x = 0; x < W; x++) { h[x] = Math.round(GROUND + 5 * Math.sin(x / 90 + p1) + 2.5 * Math.sin(x / 31 + p2)); }

        function flatten(cx, half, blend) {
            for (var xx = Math.floor(cx - half - blend); xx <= cx + half + blend; xx++) {
                if (xx < 0 || xx >= W) { continue; }
                var d = Math.abs(xx - cx) - half;
                var f = d <= 0 ? 0 : Math.min(1, d / blend);
                h[xx] = Math.round(GROUND + (h[xx] - GROUND) * f);
            }
        }
        flatten(BASE_X + PAD_W / 2, PAD_W / 2 + 24, 40);

        // moduly
        var kinds = [0, 1, 2];
        for (i = 2; i > 0; i--) { var j = Math.floor(rnd() * (i + 1)); var tmp = kinds[i]; kinds[i] = kinds[j]; kinds[j] = tmp; }
        var pedIdx = Math.floor(rnd() * 3);
        var pedIdx2 = round >= 3 ? (pedIdx + 1 + Math.floor(rnd() * 2)) % 3 : -1;
        var mods = [];
        var fr = [0.3, 0.58, 0.86];
        for (i = 0; i < 3; i++) {
            var mx = Math.round(W * fr[i] + rnd() * W * 0.06);
            flatten(mx, 14, 26);
            var sz = MV.KIND_SIZE[kinds[i]];
            var ped = (i === pedIdx || i === pedIdx2);
            var pedH = ped ? Math.min(85, Math.round(40 + rnd() * 30 + round * 4)) : 0;
            mods.push({
                kind: kinds[i], x: mx, w: sz[0], h: sz[1], ped: ped, pedH: pedH,
                y: h[mx] - pedH - sz[1], state: 'free', fall: false, vy: 0, by: null, homeX: mx, pedY: h[mx]
            });
        }

        // krátery (svislé stěny, nutno přeskočit)
        var craters = [];
        x = 340;
        while (x < W - 220) {
            x += 90 + Math.floor(rnd() * Math.max(40, 130 - 10 * round));
            var cw = 20 + Math.floor(rnd() * (14 + 2 * round));
            if (cw > 44) { cw = 44; }
            if (x + cw > W - 160) { break; }
            var ok = true;
            for (i = 0; i < 3; i++) { if (Math.abs(mods[i].x - (x + cw / 2)) < cw / 2 + 50) { ok = false; } }
            if (!ok) { x += cw + 40; continue; }
            var rim = Math.max(h[x - 1], h[x + cw]);
            var floorY = rim + 9;
            for (i = 0; i < cw; i++) { h[x + i] = floorY; }
            craters.push({ x: x, w: cw, floor: floorY });
            x += cw;
        }

        // drahé kameny
        var gems = [], ng = Math.min(9, 5 + round);
        for (i = 0; i < ng; i++) {
            var gx = 380 + Math.floor(rnd() * (W - 520));
            var gy = Math.max(22, h[gx] - (30 + Math.floor(rnd() * 75)));
            gems.push({ x: gx, y: gy, got: false });
        }

        var stars = [];
        for (i = 0; i < 46; i++) { stars.push({ x: Math.floor(rnd() * 256), y: Math.floor(rnd() * 100) }); }

        return { w: W, h: h, mods: mods, gems: gems, craters: craters, stars: stars, baseX: BASE_X, padW: PAD_W, round: round, phase: rnd() * 5 };
    }

    // ---------- pomocné ----------
    function H(g, x) {
        var h = g.world.h;
        x = Math.floor(x);
        if (x < 0) { x = 0; }
        if (x >= h.length) { x = h.length - 1; }
        return h[x];
    }

    function snd(name) { if (MV.sound && MV.sound[name]) { MV.sound[name](); } }

    function addScore(g, n) {
        g.score += n;
        if (g.score > g.hi) { g.hi = g.score; }
        if (g.score >= g.nextLife) { g.lives = Math.min(g.lives + 1, 8); g.nextLife += 10000; snd('deliver'); }
    }

    function boom(g, x, y, big) { g.fx.push({ x: x, y: y, t: 0, max: big ? 34 : 18 }); snd('boom'); }

    function playerRect(g) {
        if (g.mode === 'rover') { return { x1: g.rover.x - 10, x2: g.rover.x + 10, y1: g.rover.y - 12, y2: g.rover.y + 1 }; }
        return { x1: g.astro.x - 3, x2: g.astro.x + 3, y1: g.astro.y - 11, y2: g.astro.y };
    }

    function playerPos(g) {
        var r = playerRect(g);
        return { x: (r.x1 + r.x2) / 2, y: (r.y1 + r.y2) / 2 };
    }

    function hurt(g, n, ignoreInv) {
        if (g.god) { return; }
        if (!ignoreInv && g.inv > 0) { return; }
        g.energy -= n;
        if (!ignoreInv) { g.inv = 45; }
        snd('hit');
        if (g.energy <= 0) { g.energy = 0; die(g); }
    }

    function die(g) {
        if (g.state !== 'play') { return; }
        var p = playerPos(g);
        g.state = 'dying';
        g.timer = 90;
        g.fx.push({ x: p.x, y: p.y, t: 0, max: 40 });
        g.fx.push({ x: p.x - 8, y: p.y + 2, t: -6, max: 30 });
        g.fx.push({ x: p.x + 8, y: p.y - 2, t: -12, max: 30 });
        if (g.rover.carry !== null) { dropMod(g, g.rover.carry); g.rover.carry = null; }
        if (g.astro.carry !== null) { dropMod(g, g.astro.carry); g.astro.carry = null; }
        snd('die');
    }

    function dropMod(g, idx) {
        var m = g.world.mods[idx];
        m.state = 'free'; m.fall = true; m.vy = 0; m.by = null; m.noPick = 40;
    }

    // ---------- start / kola ----------
    function setupRound(g) {
        var w = buildWorld(g.round);
        g.world = w;
        g.delivered = [];
        g.t = 0;
        g.enemies = []; g.bullets = []; g.fx = [];
        g.tMet = 160; g.tUfo = 420; g.tBug = 300;
        g.tRaid = Math.max(700, 1700 - 140 * g.round);
        respawn(g);
    }

    function respawn(g) {
        var w = g.world;
        var rx = w.baseX + w.padW / 2;
        g.rover = { x: rx, y: H(g, rx), vx: 0, vy: 0, grounded: true, face: 1, lastGY: H(g, rx), cd: 0, carry: null, wheel: 0, jumped: false };
        g.astro = { x: rx, y: H(g, rx) - 20, vx: 0, vy: 0, face: 1, onGround: false, carry: null, cd: 0, thrust: false, anim: 0 };
        g.mode = 'rover';
        g.energy = 100; g.fuel = 100;
        g.inv = 100;
        g.enemies = []; g.bullets = [];
        g.cam = clamp(rx - 128, 0, w.w - 256);
        g.prevAct = true;
        g.tSpawnGrace = 120;
    }

    function startGame(g) {
        g.score = 0; g.lives = 3; g.nextLife = 10000; g.round = 1;
        g.state = 'play';
        setupRound(g);
    }

    function nextRound(g) {
        g.round++;
        g.state = 'play';
        setupRound(g);
    }

    // ---------- vozítko ----------
    function roverStep(g, inp, driven) {
        var r = g.rover;
        var W = g.world.w;
        var dir = driven ? ((inp.right ? 1 : 0) - (inp.left ? 1 : 0)) : 0;
        if (dir) { r.face = dir; }
        if (dir) { r.vx += dir * (r.grounded ? 0.05 : 0.014); }
        else if (r.grounded) { r.vx = r.vx > 0 ? Math.max(0, r.vx - 0.04) : Math.min(0, r.vx + 0.04); }
        r.vx = clamp(r.vx, -1.8, 1.8);

        var nx = r.x + r.vx;
        if (r.vx !== 0) {
            var lead = nx + (r.vx > 0 ? 7 : -7);
            if (r.y - H(g, lead) > 4) { r.vx = 0; nx = r.x; }
        }
        nx = clamp(nx, 12, W - 12);
        r.wheel += Math.abs(nx - r.x) * 0.35;
        r.x = nx;

        var sup = Math.min(H(g, r.x - 7), H(g, r.x + 7));
        if (r.grounded) {
            if (driven && inp.up) {
                r.vy = -1.6; r.grounded = false; r.lastGY = r.y; snd('jump');
            } else if (sup - r.y > 4) {
                r.grounded = false; r.vy = 0; r.lastGY = r.y;
            } else {
                r.y = sup;
            }
        }
        if (!r.grounded) {
            r.vy += 0.07;
            r.y += r.vy;
            if (r.y >= sup) {
                if (r.vy >= 0) {
                    r.y = sup; r.vy = 0; r.grounded = true;
                    if (r.y - r.lastGY > 7) { hurt(g, 6, true); }
                } else {
                    r.y = sup;
                }
            }
        }
        if (!isFinite(r.x) || !isFinite(r.y)) { r.x = g.world.baseX + 28; r.y = H(g, r.x); r.vx = r.vy = 0; }
        if (r.cd > 0) { r.cd--; }
    }

    // ---------- astronaut ----------
    function astroStep(g, inp) {
        var a = g.astro, W = g.world.w;
        var dir = (inp.right ? 1 : 0) - (inp.left ? 1 : 0);
        var heavy = a.carry !== null;
        var vmax = heavy ? 1.0 : 1.3;
        if (dir) { a.face = dir; a.vx += dir * (a.onGround ? 0.08 : 0.05); }
        else { a.vx = a.vx > 0 ? Math.max(0, a.vx - (a.onGround ? 0.06 : 0.01)) : Math.min(0, a.vx + (a.onGround ? 0.06 : 0.01)); }
        a.vx = clamp(a.vx, -vmax, vmax);
        a.vy += 0.035;
        a.thrust = false;
        if (inp.up && g.fuel > 0) {
            a.vy -= heavy ? 0.075 : 0.085;
            g.fuel = Math.max(0, g.fuel - 0.22);
            a.thrust = true;
            if ((g.t % 6) === 0) { snd('thrust'); }
        } else {
            var near = Math.abs(a.x - g.rover.x) < 24 && Math.abs(a.y - g.rover.y) < 30;
            if (a.onGround || near) { g.fuel = Math.min(100, g.fuel + 0.5); }
        }
        if (inp.down) { a.vy += 0.025; }
        a.vy = clamp(a.vy, -1.3, 1.5);
        a.x = clamp(a.x + a.vx, 5, W - 5);
        a.y += a.vy;
        if (a.y < 14) { a.y = 14; if (a.vy < 0) { a.vy = 0; } }
        var gy = H(g, a.x);
        if (a.y >= gy) { a.y = gy; a.vy = 0; a.onGround = true; } else { a.onGround = false; }
        if (a.onGround && dir) { a.anim += 0.2; }
        if (!isFinite(a.x) || !isFinite(a.y)) { a.x = g.rover.x; a.y = g.rover.y - 10; a.vx = a.vy = 0; }
        if (a.cd > 0) { a.cd--; }
    }

    // ---------- akce (vystoupit / nastoupit / pustit) ----------
    function doAct(g) {
        var r = g.rover, a = g.astro;
        if (g.mode === 'rover') {
            g.mode = 'astro';
            a.x = r.x; a.y = r.y - 12; a.vx = 0; a.vy = -0.4; a.face = r.face; a.onGround = false; a.carry = null;
            snd('board');
        } else {
            var near = Math.abs(a.x - r.x) < 18 && Math.abs(a.y - r.y) < 30;
            if (near && (a.carry === null || r.carry === null)) {
                if (a.carry !== null) { r.carry = a.carry; g.world.mods[r.carry].by = 'rover'; a.carry = null; }
                g.mode = 'rover';
                snd('board');
            } else if (a.carry !== null) {
                dropMod(g, a.carry);
                a.carry = null;
            }
        }
    }

    function fire(g, sign) {
        var src = g.mode === 'rover' ? g.rover : g.astro;
        if (src.cd > 0 || g.bullets.length >= 14) { return; }
        var face = src.face * sign;
        var rv = g.mode === 'rover';
        g.bullets.push({ x: src.x + face * (rv ? 13 : 6), y: rv ? src.y - 7 : src.y - 6, vx: face * 4.5, life: 38 });
        src.cd = 9;
        snd(sign > 0 ? 'shoot' : 'shootBack');
    }

    // ---------- moduly a kameny ----------
    function modulesStep(g) {
        var w = g.world, mods = w.mods, r = g.rover, a = g.astro, i;
        for (i = 0; i < mods.length; i++) {
            var m = mods[i];
            if (m.state === 'done') { continue; }
            if (m.state === 'free') {
                if (m.noPick > 0) { m.noPick--; }
                if (m.fall) {
                    m.vy = Math.min(2, m.vy + 0.04);
                    m.y += m.vy;
                    var gy = H(g, m.x);
                    if (m.y + m.h >= gy) { m.y = gy - m.h; m.vy = 0; m.fall = false; }
                }
                // sebrání
                if (m.noPick > 0) { /* právě pustěný */ } else if (g.mode === 'rover' && r.carry === null && Math.abs(m.x - r.x) < 14 && Math.abs((m.y + m.h) - r.y) < 9) {
                    r.carry = i; m.state = 'carried'; m.by = 'rover'; snd('pick');
                } else if (g.mode === 'astro' && a.carry === null &&
                    Math.abs(m.x - a.x) < m.w / 2 + 4 && a.y > m.y - 2 && a.y - 11 < m.y + m.h + 2) {
                    a.carry = i; m.state = 'carried'; m.by = 'astro'; m.fall = false; snd('pick');
                }
            }
            if (m.state === 'carried') {
                if (m.by === 'rover') { m.x = r.x; m.y = r.y - 9 - m.h; }
                else { m.x = a.x; m.y = Math.min(a.y + 2, H(g, a.x) - m.h); }
                // doručení do základny
                if (m.x >= w.baseX + 4 && m.x <= w.baseX + w.padW - 4 && (m.by === 'astro' || g.rover.grounded)) {
                    m.state = 'done'; m.fall = false;
                    if (m.by === 'rover') { r.carry = null; } else { a.carry = null; }
                    m.by = null;
                    g.delivered.push(i);
                    addScore(g, 1000);
                    g.energy = 100;
                    snd('deliver');
                    if (g.delivered.length >= 3) {
                        g.state = 'built'; g.timer = 260;
                        addScore(g, 2000 + 500 * g.round);
                        snd('built');
                    }
                }
            }
        }
        if (g.mode === 'astro') {
            for (i = 0; i < w.gems.length; i++) {
                var gm = w.gems[i];
                if (!gm.got && Math.abs(gm.x - a.x) < 7 && Math.abs(gm.y - (a.y - 5)) < 9) {
                    gm.got = true; addScore(g, 500); g.energy = Math.min(100, g.energy + 6); snd('gem');
                }
            }
        }
    }

    // ---------- nepřátelé ----------
    function spawn(g) {
        if (g.t < g.tSpawnGrace) { return; }
        var r = g.round, rnd = g.rnd, pp = playerPos(g), cam = g.cam, W = g.world.w, n = g.enemies.length;
        var i, side;
        if (--g.tMet <= 0) {
            g.tMet = Math.floor(Math.max(45, 200 - 22 * r) * (0.7 + rnd() * 0.6));
            if (n < 14) {
                g.enemies.push({ t: 'met', x: pp.x + (rnd() * 300 - 130), y: -8, vx: rnd() * 1.0 - 0.5, vy: 0.6 + 0.1 * r + rnd() * 0.4, w: 8, h: 8, hp: 1, pts: 50, age: 0 });
            }
        }
        if (--g.tUfo <= 0) {
            g.tUfo = Math.floor(Math.max(130, 420 - 45 * r) * (0.7 + rnd() * 0.6));
            if (n < 14) {
                side = rnd() < 0.5 ? -1 : 1;
                g.enemies.push({ t: 'ufo', x: side < 0 ? cam - 20 : cam + 276, y: 30 + rnd() * 60, vx: 0, vy: 0, w: 12, h: 5, hp: r >= 3 ? 2 : 1, pts: 100, age: 0 });
            }
        }
        if (--g.tBug <= 0) {
            g.tBug = Math.floor(Math.max(150, 480 - 50 * r) * (0.7 + rnd() * 0.6));
            if (n < 14) {
                side = rnd() < 0.5 ? -1 : 1;
                var bx = clamp(side < 0 ? cam - 12 : cam + 268, 0, W - 1);
                g.enemies.push({ t: 'bug', x: bx, y: H(g, bx) - 3, vx: 0, vy: 0, w: 8, h: 6, hp: 1, pts: 75, age: 0 });
            }
        }
        if (--g.tRaid <= 0) {
            g.tRaid = Math.max(700, 1700 - 140 * r);
            side = rnd() < 0.5 ? -1 : 1;
            var cnt = 3 + Math.min(3, r);
            var yy = 22 + rnd() * 30;
            for (i = 0; i < cnt; i++) {
                g.enemies.push({ t: 'ship', x: side < 0 ? cam - 30 - i * 24 : cam + 286 + i * 24, y: yy, vx: -side * (1.0 + 0.05 * r), vy: 0, w: 10, h: 4, hp: 1, pts: 120, age: 0, cd: 0 });
            }
        }
    }

    function killEnemy(g, e, award) {
        e.dead = true;
        boom(g, e.x, e.y, false);
        if (award) { addScore(g, e.pts); }
    }

    function enemiesStep(g) {
        var pp = playerPos(g), pr = playerRect(g), cam = g.cam, r = g.round, i, e;
        for (i = 0; i < g.enemies.length; i++) {
            e = g.enemies[i];
            e.age++;
            switch (e.t) {
                case 'met':
                    e.x += e.vx; e.y += e.vy;
                    if (e.y >= H(g, e.x) - 3) { e.dead = true; boom(g, e.x, H(g, e.x) - 3, false); }
                    break;
                case 'ufo':
                    var tx = pp.x, ty = pp.y - 4 + Math.sin(e.age / 18) * 14;
                    var dx = tx - e.x, dy = ty - e.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
                    var sp = Math.min(1.3, 0.7 + 0.06 * r);
                    e.vx += (dx / d * sp - e.vx) * 0.04;
                    e.vy += (dy / d * sp - e.vy) * 0.04;
                    e.x += e.vx; e.y += e.vy;
                    e.y = clamp(e.y, 8, H(g, e.x) - 6);
                    if (Math.abs(e.x - pp.x) > 480 || e.age > 1800) { e.dead = true; }
                    break;
                case 'ship':
                    e.x += e.vx;
                    if (e.cd > 0) { e.cd--; }
                    if (e.cd <= 0 && Math.abs(e.x - pp.x) < 12 && e.x > cam && e.x < cam + 256) {
                        g.enemies.push({ t: 'bomb', x: e.x, y: e.y + 4, vx: 0, vy: 0.5, w: 3, h: 5, hp: 1, pts: 25, age: 0 });
                        e.cd = 90;
                    }
                    if ((e.vx > 0 && e.x > cam + 256 + 50) || (e.vx < 0 && e.x < cam - 50)) { if (e.age > 30) { e.dead = true; } }
                    if (e.age > 1500) { e.dead = true; }
                    break;
                case 'bomb':
                    e.vy = Math.min(2.2, e.vy + 0.03);
                    e.y += e.vy;
                    if (e.y >= H(g, e.x) - 2) { e.dead = true; boom(g, e.x, H(g, e.x) - 2, false); }
                    break;
                case 'bug':
                    var dirb = pp.x > e.x ? 1 : -1;
                    e.x += dirb * Math.min(0.9, 0.35 + 0.05 * r);
                    e.x = clamp(e.x, 2, g.world.w - 2);
                    e.y = H(g, e.x) - 3;
                    if (Math.abs(e.x - pp.x) > 480) { e.dead = true; }
                    break;
            }
            if (!isFinite(e.x) || !isFinite(e.y)) { e.dead = true; }
            if (e.dead) { continue; }
            // srážka s hráčem
            if (g.inv <= 0 && e.x + e.w / 2 > pr.x1 && e.x - e.w / 2 < pr.x2 && e.y + e.h / 2 > pr.y1 && e.y - e.h / 2 < pr.y2) {
                var dmg = (g.mode === 'rover' ? 12 : 20) * (e.t === 'bug' ? 0.7 : 1);
                e.dead = true;
                boom(g, e.x, e.y, false);
                hurt(g, Math.round(dmg), false);
                if (g.state !== 'play') { break; }
            }
        }
        g.enemies = g.enemies.filter(function (q) { return !q.dead; });
    }

    function bulletsStep(g) {
        var out = [], i, j;
        for (i = 0; i < g.bullets.length; i++) {
            var b = g.bullets[i];
            b.x += b.vx; b.life--;
            if (b.life <= 0 || b.x < 0 || b.x >= g.world.w || b.y >= H(g, b.x)) { continue; }
            var hit = false;
            for (j = 0; j < g.enemies.length; j++) {
                var e = g.enemies[j];
                if (e.dead) { continue; }
                if (Math.abs(e.x - b.x) < e.w / 2 + 3 && Math.abs(e.y - b.y) < e.h / 2 + 1.5) {
                    e.hp--;
                    hit = true;
                    if (e.hp <= 0) { killEnemy(g, e, true); } else { snd('hit'); }
                    break;
                }
            }
            if (!hit) { out.push(b); }
        }
        g.bullets = out;
        g.enemies = g.enemies.filter(function (q) { return !q.dead; });
    }

    // ---------- tick ----------
    function updateCam(g) {
        var p = playerPos(g), face = g.mode === 'rover' ? g.rover.face : g.astro.face;
        var target = clamp(p.x - 128 + face * 24, 0, g.world.w - 256);
        g.cam += (target - g.cam) * 0.08;
        g.cam = clamp(g.cam, 0, g.world.w - 256);
    }

    function playTick(g, inp) {
        g.t++;
        var actEdge = !!inp.act && !g.prevAct;
        g.prevAct = !!inp.act;
        if (actEdge) { doAct(g); }
        if (g.mode === 'rover') { roverStep(g, inp, true); } else { roverStep(g, inp, false); astroStep(g, inp); }
        if (inp.fire) { fire(g, 1); }
        if (inp.back) { fire(g, -1); }
        if (g.inv > 0) { g.inv--; }
        modulesStep(g);
        if (g.state !== 'play') { return; }
        spawn(g);
        enemiesStep(g);
        bulletsStep(g);
        updateCam(g);
    }

    function fxStep(g) {
        for (var i = 0; i < g.fx.length; i++) { g.fx[i].t++; }
        g.fx = g.fx.filter(function (f) { return f.t < f.max; });
    }

    function tick(g, inp) {
        g.frame++;
        inp = inp || {};
        switch (g.state) {
            case 'play':
                playTick(g, inp);
                break;
            case 'dying':
                fxStep(g);
                modulesStep(g);
                if (--g.timer <= 0) {
                    g.lives--;
                    if (g.lives <= 0) { g.state = 'over'; snd('over'); }
                    else { g.state = 'play'; respawn(g); }
                }
                return;
            case 'built':
                fxStep(g);
                if (g.timer % 20 === 0) {
                    var w = g.world;
                    g.fx.push({ x: w.baseX + 10 + g.rnd() * (w.padW - 20), y: GROUND - 6 - g.rnd() * 26, t: 0, max: 22 });
                }
                if (--g.timer <= 0) { nextRound(g); }
                return;
        }
        if (g.state === 'play') { fxStep(g); }
    }

    MV.newGame = function (seed, hi) {
        var g = {
            rnd: mulberry(seed || 12345), hi: hi || 0, state: 'title', frame: 0, god: false,
            score: 0, lives: 3, nextLife: 10000, round: 1, enemies: [], bullets: [], fx: [], cam: 0, mode: 'rover',
            energy: 100, fuel: 100, inv: 0, t: 0, timer: 0, delivered: [], prevAct: false
        };
        return g;
    };
    MV.start = startGame;
    MV.tick = tick;
    MV.doStart = startGame;
    MV.buildWorld = buildWorld;
    MV.groundAt = H;
    MV.BASE_X = BASE_X; MV.PAD_W = PAD_W; MV.GROUND = GROUND; MV.PH = PH;
})(typeof window !== 'undefined' ? window : globalThis);
