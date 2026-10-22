// Vykreslení do ZX Spectrum framebufferu 256x192 (bitmapa + atributy).
(function (root) {
    'use strict';

    var MV = root.MV = root.MV || {};
    var SPR = MV.SPR;

    function tri(u) { u = u % 2; if (u < 0) { u += 2; } return Math.abs(u - 1); }
    function pad(n, len) { var s = String(n); while (s.length < len) { s = '0' + s; } return s; }
    function clamp(v, a, b) { return v < a ? a : (v > b ? b : v); }

    function line(scr, row, str, ink, x) {
        var px = x === undefined ? Math.floor((256 - MV.textWidth(str, 1)) / 2) : x;
        MV.drawText(scr, px, row * 8 - 1, str, ink, 1);
    }

    function put(scr, x, y, ink) {
        if (x < 0 || x >= 256 || y < 0 || y >= 192) { return; }
        scr.bits[y * 256 + x] = 1;
        var ci = (y >> 3) * 32 + (x >> 3);
        scr.ink[ci] = ink & 7;
        scr.bright[ci] = (ink & 8) ? 1 : 0;
    }

    function drawStars(scr, g, cam) {
        var st = g.world.stars, off = Math.floor(cam * 0.1);
        for (var i = 0; i < st.length; i++) {
            var sx = ((st[i].x - off) % 256 + 256) % 256;
            scr.bits[st[i].y * 256 + sx] = 1;
        }
    }

    function drawEarth(scr) {
        for (var dy = -9; dy <= 9; dy++) {
            for (var dx = -9; dx <= 9; dx++) {
                var d2 = dx * dx + dy * dy;
                if (d2 > 81) { continue; }
                var on = d2 > 56 || ((dx + dy) & 1) === 0 || (dx > -3 && dx < 4 && dy > -4 && dy < 2);
                if (on) { put(scr, 214 + dx, 26 + dy, 13); }
            }
        }
    }

    function mountains(scr, g, cam, par, base, ink, amp1, amp2, f1, f2) {
        var off = Math.floor(cam * par), ph = g.world.phase;
        for (var sx = 0; sx < 256; sx++) {
            var wx = sx + off;
            var top = Math.floor(base - (amp1 * tri(wx / f1 + ph) + amp2 * tri(wx / f2 + ph * 2)));
            for (var y = top; y < 150; y++) {
                if (y === top || (((sx >> 1) + y) & 3) === 0) { put(scr, sx, y, ink); }
            }
        }
    }

    function drawTerrain(scr, g, cam) {
        var h = g.world.h;
        for (var sx = 0; sx < 256; sx++) {
            var wx = cam + sx;
            var top = h[wx < h.length ? wx : h.length - 1];
            for (var y = 159; y >= top; y--) {
                var depth = y - top;
                var on = depth < 2 || ((wx * 37 + y * 91) & 7) < 2;
                var ci = (y >> 3) * 32 + (sx >> 3);
                if (on) { scr.bits[y * 256 + sx] = 1; } else { scr.bits[y * 256 + sx] = 0; }
                scr.ink[ci] = 7;
                scr.bright[ci] = depth < 4 ? 1 : 0;
            }
        }
    }

    function drawBase(scr, g, cam) {
        var w = g.world, bx = w.baseX - cam, gy = MV.GROUND;
        var i, blink = (g.frame >> 4) & 1;
        // plošina
        for (i = 0; i < w.padW; i++) { put(scr, bx + i, gy - 1, 14); put(scr, bx + i, gy - 2, 14); }
        put(scr, bx, gy - 4, blink ? 10 : 12); put(scr, bx, gy - 3, 14);
        put(scr, bx + w.padW - 1, gy - 4, blink ? 12 : 10); put(scr, bx + w.padW - 1, gy - 3, 14);
        // postavené moduly (na sebe)
        var top = gy - 2, cx = bx + w.padW / 2;
        for (i = 0; i < g.delivered.length; i++) {
            var m = w.mods[g.delivered[i]];
            var y = top - m.h;
            var ink = g.state === 'built' && ((g.frame >> 2) & 1) ? 15 : (m.kind === 0 ? 5 : (m.kind === 1 ? 7 : 13));
            scr.sprite(Math.round(cx - m.w / 2), y, SPR.mod[m.kind], ink, false);
            top = y;
        }
    }

    function drawPedestals(scr, g, cam) {
        g.world.mods.forEach(function (m) {
            if (!m.ped) { return; }
            var x = Math.round(m.homeX) - cam;
            for (var y = m.pedY - m.pedH; y < m.pedY; y++) {
                put(scr, x - 1, y, 5); put(scr, x + 1, y, 5);
                if (((y >> 2) & 1) === 0) { put(scr, x, y, 5); }
            }
            for (var d = -4; d <= 4; d++) { put(scr, x + d, m.pedY - m.pedH, 13); }
        });
    }

    function drawMods(scr, g, cam) {
        g.world.mods.forEach(function (m) {
            if (m.state === 'done') { return; }
            var ink = m.kind === 0 ? 14 : (m.kind === 1 ? 10 : 11);
            scr.sprite(Math.round(m.x - m.w / 2) - cam, Math.round(m.y), SPR.mod[m.kind], ink, false);
        });
    }

    function drawGems(scr, g, cam) {
        g.world.gems.forEach(function (gm, i) {
            if (gm.got) { return; }
            var f = ((g.frame >> 3) + i) & 1;
            scr.sprite(Math.round(gm.x) - cam - 3, Math.round(gm.y) - 3, SPR.gem[f], ((g.frame >> 2) + i) & 1 ? 13 : 15, false);
        });
    }

    function drawRover(scr, g, cam) {
        var r = g.rover, h = g.world.h;
        if (g.mode === 'rover' && g.inv > 0 && ((g.frame >> 2) & 1)) { return; }
        var ink = g.mode === 'rover' ? 13 : 12;
        var x = Math.round(r.x) - cam, y = Math.round(r.y);
        var wf = Math.floor(r.wheel) & 1;
        [-7, 7].forEach(function (o) {
            var wxw = Math.round(r.x + o);
            var gy = h[clamp(wxw, 0, h.length - 1)];
            var by = Math.min(Math.max(gy, y), y + 4);
            scr.sprite(wxw - cam - 2, by - 5, SPR.wheel[wf], ink, false);
        });
        scr.sprite(x - 10, y - 10, SPR.roverBody, ink, r.face < 0);
        if (g.mode === 'astro' && ((g.frame >> 4) & 1)) { put(scr, x + (r.face < 0 ? 4 : -4), y - 12, 10); }
    }

    function drawAstro(scr, g, cam) {
        if (g.mode !== 'astro') { return; }
        var a = g.astro;
        if (g.inv > 0 && ((g.frame >> 2) & 1)) { return; }
        var x = Math.round(a.x) - cam, y = Math.round(a.y);
        var f = a.onGround ? (Math.floor(a.anim) & 1) : 1;
        scr.sprite(x - 4, y - 11, SPR.astro[f], 15, a.face < 0);
        if (a.thrust) {
            scr.sprite(a.face > 0 ? x - 5 : x + 3, y - 4, SPR.flame[(g.frame >> 1) & 1], 14, false);
        }
    }

    function drawEnemies(scr, g, cam) {
        g.enemies.forEach(function (e) {
            var f = (e.age >> 3) & 1, spr, ink, flip = false;
            switch (e.t) {
                case 'met': spr = SPR.meteor[f]; ink = 6; break;
                case 'ufo': spr = SPR.ufo[f]; ink = f ? 11 : 13; break;
                case 'ship': spr = SPR.ship[f]; ink = 10; flip = e.vx < 0; break;
                case 'bomb': spr = SPR.bomb; ink = 14; break;
                default: spr = SPR.bug[f]; ink = 12; flip = false;
            }
            scr.sprite(Math.round(e.x - spr[0].length / 2) - cam, Math.round(e.y - spr.length / 2), spr, ink, flip);
        });
    }

    function drawBullets(scr, g, cam) {
        g.bullets.forEach(function (b) {
            var x = Math.round(b.x) - cam, y = Math.round(b.y);
            for (var i = 0; i < 4; i++) { put(scr, x - i * (b.vx > 0 ? 1 : -1), y, 14); }
        });
    }

    function drawFx(scr, g, cam) {
        g.fx.forEach(function (f) {
            if (f.t < 0) { return; }
            var rad = 1 + Math.floor(f.t * 0.5), x = Math.round(f.x) - cam, y = Math.round(f.y);
            var ink = (f.t >> 1) & 1 ? 10 : 14;
            for (var k = 0; k < 10; k++) {
                var ang = k * 0.628 + f.t * 0.1;
                put(scr, x + Math.round(Math.cos(ang) * rad), y + Math.round(Math.sin(ang) * rad), ink);
            }
            if (f.t < f.max * 0.6) { put(scr, x, y, 15); put(scr, x + 1, y, 15); put(scr, x, y + 1, 15); }
        });
    }

    function bar(scr, x, y, w, frac, ink) {
        scr.block(x, y, w, 7, 0, 0, false);
        scr.block(x, y, w, 1, 1, ink, false); scr.block(x, y + 6, w, 1, 1, ink, false);
        scr.block(x, y, 1, 7, 1, ink, false); scr.block(x + w - 1, y, 1, 7, 1, ink, false);
        var f = Math.max(0, Math.min(1, frac));
        scr.block(x + 2, y + 2, Math.floor((w - 4) * f), 3, 1, ink, false);
    }

    function drawHud(scr, g) {
        scr.fillCells(0, 20, 32, 4, 7, 0, 0);
        scr.fillCells(0, 20, 32, 1, 7, 0, 0);
        line(scr, 20, 'ENERGIE', 7, 2);
        scr.fillCells(0, 20, 32, 1, 7, 0, 0);
        scr.fillCells(6, 20, 10, 1, g.energy > 30 ? 4 : 2, 0, 1);
        bar(scr, 48, 161, 72, g.energy / 100, g.energy > 30 ? 12 : 10);
        line(scr, 20, 'PALIVO', 7, 130);
        scr.fillCells(21, 20, 11, 1, g.fuel > 20 ? 5 : 2, 0, 1);
        bar(scr, 170, 161, 80, g.fuel / 100, g.fuel > 20 ? 13 : 10);
        var gems = 0;
        g.world.gems.forEach(function (q) { if (q.got) { gems++; } });
        line(scr, 21, 'KOLO ' + g.round + '  MODULY ' + g.delivered.length + '/3  KAMENY ' + gems + '/' + g.world.gems.length, 6, 2);
        line(scr, 22, 'SKÓRE ' + pad(g.score, 6) + '   REKORD ' + pad(g.hi, 6), 7, 2);
        scr.fillCells(0, 23, 32, 1, 7, 0, 0);
        for (var i = 0; i < Math.min(g.lives, 8); i++) { scr.sprite(4 + i * 10, 184, SPR.life, 15, false); }
        var msg = g.mode === 'astro' ? (g.astro.carry !== null ? 'NESEŠ MODUL' : 'ASTRONAUT') : (g.rover.carry !== null ? 'VEZEŠ MODUL' : 'VOZÍTKO');
        line(scr, 23, msg, 14, 256 - MV.textWidth(msg, 1) - 4);
    }

    function banner(scr, a, b) {
        scr.fillCells(3, 6, 26, 4, 7, 1, 1);
        scr.block(24, 48, 208, 32, 0, 0, false);
        MV.drawText(scr, Math.floor((256 - MV.textWidth(a, 2)) / 2), 52, a, 15, 2);
        line(scr, 9, b, 15);
    }

    function drawPlay(scr, g) {
        scr.clear(0, 7);
        var cam = Math.round(g.cam);
        drawStars(scr, g, cam);
        drawEarth(scr);
        mountains(scr, g, cam, 0.25, 122, 1, 30, 10, 70, 23);
        mountains(scr, g, cam, 0.55, 132, 3, 20, 6, 55, 17);
        drawTerrain(scr, g, cam);
        drawPedestals(scr, g, cam);
        drawBase(scr, g, cam);
        drawGems(scr, g, cam);
        drawMods(scr, g, cam);
        drawEnemies(scr, g, cam);
        drawRover(scr, g, cam);
        drawAstro(scr, g, cam);
        drawBullets(scr, g, cam);
        drawFx(scr, g, cam);
        drawHud(scr, g);
        if (g.state === 'built') {
            line(scr, 6, 'ZÁKLADNA POSTAVENA!', 15);
            line(scr, 8, 'DALŠÍ KOLO: ' + (g.round + 1), 14);
        }
    }

    function drawTitle(scr, g) {
        scr.clear(0, 7);
        var f = g.frame, i;
        for (i = 0; i < 60; i++) { scr.bits[((i * 53 + 7) % 110) * 256 + ((i * 97 + 13) % 256)] = 1; }
        var title = 'MĚSÍČNÍ VOZÍTKO';
        var x = Math.floor((256 - MV.textWidth(title, 2)) / 2);
        var cols = [10, 14, 12, 13, 11, 9];
        for (i = 0; i < title.length; i++) {
            MV.drawText(scr, x + i * 12, 8, title.charAt(i), cols[(i + (f >> 3)) % cols.length], 2);
        }
        line(scr, 4, 'REKORD ' + pad(g.hi, 6), 6);
        // povrch
        for (i = 0; i < 256; i++) {
            var gy = 66 + Math.round(2 * Math.sin((i + f) / 14));
            for (var y = gy; y < 72; y++) { put(scr, i, y, 7); }
        }
        var rx = ((f >> 1) % 300) - 20;
        scr.sprite(rx - 7 - 3, 58, SPR.wheel[(f >> 2) & 1], 15, false);
        scr.sprite(rx + 7 - 3, 58, SPR.wheel[(f >> 2) & 1], 15, false);
        scr.sprite(rx - 10, 49, SPR.roverBody, 15, false);
        scr.sprite(((f >> 2) % 340) - 40, 36, SPR.ufo[(f >> 3) & 1], 11, false);
        scr.sprite(180 + Math.round(10 * Math.sin(f / 20)), 38, SPR.astro[1], 15, false);
        scr.sprite(176 + Math.round(10 * Math.sin(f / 20)), 46, SPR.flame[(f >> 1) & 1], 14, false);
        scr.sprite(24, 40, SPR.gem[(f >> 3) & 1], 13, false);
        line(scr, 10, 'ŠIPKY / A D - JÍZDA A LET', 7);
        line(scr, 11, 'NAHORU / W - SKOK, TRYSKY', 7);
        line(scr, 12, 'MEZERNÍK - STŘELBA VPŘED', 7);
        line(scr, 13, 'Z - STŘELBA DOZADU', 7);
        line(scr, 14, 'ENTER / E - VYSTOUPIT, NASTOUPIT', 7);
        line(scr, 15, '(VENKU ZVEDNEŠ MODUL, E HO PUSTÍ)', 7);
        line(scr, 17, 'PŘENES TŘI MODULY DO ZÁKLADNY', 5);
        line(scr, 18, 'KAMENY SBÍREJ ASTRONAUTEM', 5);
        line(scr, 19, 'POZOR NA KRÁTERY A NEPŘÁTELE', 5);
        line(scr, 20, 'P - PAUZA     M - ZVUK', 6);
        if ((f >> 4) & 1) { line(scr, 22, 'STISKNI MEZERNÍK NEBO KLEPNI', 15); }
    }

    MV.draw = function (scr, g, prevState) {
        if (g.state === 'title') { drawTitle(scr, g); }
        else {
            drawPlay(scr, g);
            if (g.state === 'paused') { banner(scr, 'PAUZA', 'P - POKRAČOVAT'); }
            else if (g.state === 'over') { banner(scr, 'KONEC HRY', 'SKÓRE ' + pad(g.score, 6) + '  MEZERNÍK = MENU'); }
        }
        void prevState;
    };
})(typeof window !== 'undefined' ? window : globalThis);
