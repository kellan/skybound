// Skybound island art — single source of truth, shared by the game
// (index.html) and the workbench (island-lab.html) via a classic script tag
// (an ES module would break opening the files over file://).
//
// Everything renders in blob-local space: the island's center is (0,0) and
// the baseline blob radius is 36. Callers place and size islands with a
// canvas transform (translate to center, scale by radius/36).
//
// Common parameters:
//   t    — seconds, drives animation
//   br   — breeze strength 0..1; 0 freezes all idle motion
//   blob — the anchor object returned by drawBlob (radius, verts, shoulders,
//          surfaceAnchor, topX/topY, bottomY)
//   opts.makeRng — seeded-rng factory (seed => () => [0,1)); defaults to a
//          small LCG. The game injects its mulberry32 so island silhouettes
//          match what its saves have always shown.
(function () {

  // Tiny deterministic RNG seeded by integer (default when the caller
  // doesn't inject one).
  function defaultMakeRng(seed) {
    let s = seed | 0;
    return () => {
      s = (s * 1664525 + 1013904223) | 0;
      return ((s >>> 0) % 100000) / 100000;
    };
  }

  function drawBlob(ctx, t, br, opts = {}) {
    const seed = opts.seed ?? 311;
    const radius = opts.radius ?? 36;
    const volcanic = opts.volcanic === true;
    const rocky = opts.rocky === true;
    const mk = opts.makeRng || defaultMakeRng;
    const r = mk(seed);
    const points = 14;
    const verts = [];
    for (let k = 0; k < points; k++) {
      const ang = (k / points) * Math.PI * 2;
      const wobble = 0.75 + r() * 0.45;
      verts.push({
        x: Math.cos(ang) * radius * wobble,
        y: Math.sin(ang) * radius * wobble,
        wobble
      });
    }
    // shadow
    ctx.beginPath();
    for (let k = 0; k < verts.length; k++) {
      const v = verts[k];
      if (k === 0) ctx.moveTo(v.x, v.y + 8);
      else ctx.lineTo(v.x, v.y + 8);
    }
    ctx.closePath();
    ctx.fillStyle = 'rgba(20, 30, 40, 0.4)';
    ctx.fill();
    // body
    ctx.beginPath();
    for (let k = 0; k < verts.length; k++) {
      const v = verts[k];
      if (k === 0) ctx.moveTo(v.x, v.y);
      else ctx.lineTo(v.x, v.y);
    }
    ctx.closePath();
    const grad = ctx.createLinearGradient(0, -radius, 0, radius);
    if (volcanic) {
      grad.addColorStop(0, '#5a3a2a');
      grad.addColorStop(0.55, '#3a2018');
      grad.addColorStop(1, '#1a0c08');
    } else if (rocky) {
      grad.addColorStop(0, '#a8b0aa');
      grad.addColorStop(0.55, '#6e766e');
      grad.addColorStop(1, '#42463e');
    } else {
      grad.addColorStop(0, '#6b8a5a');
      grad.addColorStop(0.55, '#4d6a40');
      grad.addColorStop(1, '#3a4a2e');
    }
    ctx.fillStyle = grad;
    ctx.fill();
    ctx.strokeStyle = 'rgba(20, 25, 15, 0.7)';
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Highlight (a small lighter patch in the upper-left — also where any
    // "on-top" modifier anchors). Suppressed when a modifier sits there.
    if (!opts.skipHighlight) {
      ctx.beginPath();
      ctx.arc(-radius * 0.2, -radius * 0.2, radius * 0.18, 0, Math.PI * 2);
      ctx.fillStyle = volcanic ? 'rgba(255,140,80,0.45)'
                    : rocky    ? 'rgba(220, 224, 218, 0.55)'
                               : 'rgba(220, 210, 160, 0.5)';
      ctx.fill();
    }

    // Volcanic lava cracks on the underside
    if (volcanic) {
      ctx.strokeStyle = 'rgba(255,110,40,0.8)';
      ctx.lineWidth = 0.9;
      const rc = mk(seed + 17);
      for (let k = 0; k < 4; k++) {
        const a1 = Math.PI * (0.15 + rc() * 0.7); // bottom half angles
        const a2 = a1 + (rc() * 0.4 + 0.1);
        ctx.beginPath();
        ctx.moveTo(Math.cos(a1) * radius * 0.4, Math.sin(a1) * radius * 0.4);
        ctx.quadraticCurveTo(
          Math.cos((a1 + a2) / 2) * radius * 0.7, Math.sin((a1 + a2) / 2) * radius * 0.7 + 1,
          Math.cos(a2) * radius * 0.95, Math.sin(a2) * radius * 0.95
        );
        ctx.stroke();
      }
    }

    // Surface anchors for modifier placement. topY = highest visible point
    // along the blob's top edge; leftSide / rightSide are the shoulder points
    // mine/dock can attach to.
    let topVert = verts[0];
    for (const v of verts) if (v.y < topVert.y) topVert = v;
    return {
      radius,
      verts,
      topY: topVert.y,
      topX: topVert.x,
      // Where on the visible "deck" of the island top-anchored modifiers sit
      // (the same spot the original highlight occupied). Reads as a clearing
      // or plateau on the upper-left of the blob.
      surfaceAnchor: { x: -radius * 0.2, y: -radius * 0.2 },
      leftShoulder:  { x: -radius * 0.75, y: -radius * 0.15 },
      rightShoulder: {  x: radius * 0.75, y: -radius * 0.15 },
      bottomY: radius * 0.95,
    };
  }

  // ---------- Name-modifier draw functions ----------
  // Each takes (ctx, t, br, blob) where `blob` is the result returned by
  // drawBlob. Modifiers are sorted into slots so two modifiers don't overlap:
  //   center: castle / spire / volcano / wyvern / sword — on top
  //   side:   mine / dock — on left or right shoulder
  //   wings:  banner wings — on both shoulders
  //   aura:   sun halo, wet sheen — behind/under the blob
  //   peri:   overgrown trees + vines — along the rim
  //
  // If two modifiers want the same slot, the second one is shifted to its
  // fallback position (center → right of center; side → opposite side).
  function modCastle(ctx, t, br, blob, opts = {}) {
    // Small keep sitting on the upper-left surface (where the highlight was).
    const a = opts.anchor || blob.surfaceAnchor;
    const s = opts.scale ?? 1;
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.scale(s, s);
    // Tower body
    ctx.fillStyle = '#cabd99';
    ctx.fillRect(-4, -10, 8, 10);
    ctx.strokeStyle = '#2a2417';
    ctx.lineWidth = 0.7;
    ctx.strokeRect(-4, -10, 8, 10);
    // Crenellations
    for (const cx of [-3.6, -1.8, 0, 1.8]) {
      ctx.fillStyle = '#cabd99';
      ctx.fillRect(cx, -12, 1.4, 2);
      ctx.strokeRect(cx, -12, 1.4, 2);
    }
    // Stone seams
    ctx.strokeStyle = 'rgba(40,30,20,0.45)';
    ctx.lineWidth = 0.3;
    for (let i = 1; i < 3; i++) {
      ctx.beginPath();
      ctx.moveTo(-4, -i * 3);
      ctx.lineTo(4, -i * 3);
      ctx.stroke();
    }
    // Arched door
    ctx.fillStyle = '#2a1f12';
    ctx.beginPath();
    ctx.moveTo(-1.1, 0);
    ctx.lineTo(-1.1, -2.4);
    ctx.quadraticCurveTo(0, -3.6, 1.1, -2.4);
    ctx.lineTo(1.1, 0);
    ctx.closePath();
    ctx.fill();
    // Window slit
    ctx.fillStyle = '#3a2810';
    ctx.fillRect(-0.7, -7, 1.4, 1.6);
    // Pennant
    const flutter = Math.sin(t * 4) * 0.4 * br;
    ctx.strokeStyle = '#2a2417';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(0, -16);
    ctx.stroke();
    ctx.fillStyle = '#c9342c';
    ctx.beginPath();
    ctx.moveTo(0, -16);
    ctx.lineTo(4 + flutter, -15.4);
    ctx.lineTo(2.6, -14.4);
    ctx.lineTo(4 - flutter, -13.4);
    ctx.lineTo(0, -14);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function modDock(ctx, t, br, blob, opts = {}) {
    // Wooden fishing dock + rod; wet sheen on underside (separate, in aura).
    const side = opts.side ?? 1; // +1 right, -1 left
    const sh = side > 0 ? blob.rightShoulder : blob.leftShoulder;
    ctx.save();
    ctx.translate(sh.x, sh.y);
    ctx.scale(side, 1);
    // Plank
    ctx.fillStyle = '#a07238';
    ctx.fillRect(0, -1.6, 13, 2.4);
    ctx.strokeStyle = '#2a2417';
    ctx.lineWidth = 0.6;
    ctx.strokeRect(0, -1.6, 13, 2.4);
    // Plank seams
    ctx.strokeStyle = 'rgba(40,25,15,0.6)';
    ctx.lineWidth = 0.3;
    for (const dx of [4, 7, 10]) {
      ctx.beginPath();
      ctx.moveTo(dx, -1.6);
      ctx.lineTo(dx, 0.8);
      ctx.stroke();
    }
    // Rod
    ctx.strokeStyle = '#3a2a18';
    ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(11, -2);
    ctx.lineTo(18, -8);
    ctx.stroke();
    // Line drooping down with bobbing tip
    const bob = Math.sin(t * 1.6) * 0.6 * br;
    ctx.strokeStyle = '#2a2417';
    ctx.lineWidth = 0.35;
    ctx.beginPath();
    ctx.moveTo(18, -8);
    ctx.quadraticCurveTo(19, -2 + bob, 19 + bob * 0.3, 6);
    ctx.stroke();
    // Bob
    ctx.fillStyle = '#c9342c';
    ctx.beginPath();
    ctx.arc(19 + bob * 0.3, 6, 0.7, 0, Math.PI * 2);
    ctx.fill();
    // Bucket
    ctx.fillStyle = '#5a3a20';
    ctx.fillRect(2, -3.4, 2.5, 1.8);
    ctx.strokeStyle = '#2a2417';
    ctx.lineWidth = 0.4;
    ctx.strokeRect(2, -3.4, 2.5, 1.8);
    ctx.restore();
  }

  function modWetSheen(ctx, t, br, blob) {
    // Blue luminous rim along the underside of the blob.
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const grad = ctx.createRadialGradient(0, blob.bottomY * 0.4, 0, 0, blob.bottomY * 0.4, blob.radius * 1.5);
    grad.addColorStop(0, 'rgba(120,200,240,0)');
    grad.addColorStop(0.6, 'rgba(80,160,220,0.05)');
    grad.addColorStop(0.85, 'rgba(80,180,240,0.28)');
    grad.addColorStop(1, 'rgba(80,180,240,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(0, blob.bottomY * 0.4, blob.radius * 1.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function modPeaks(ctx, t, br, blob, opts = {}) {
    // Two sharp gray peaks rising from the surface anchor.
    const a = opts.anchor || blob.surfaceAnchor;
    const tall = opts.tall ?? 14;
    const wide = opts.wide ?? 7;
    const drawPeak = (px, py, ph, pw) => {
      ctx.beginPath();
      ctx.moveTo(px - pw, py);
      ctx.lineTo(px - pw * 0.2, py - ph);
      ctx.lineTo(px + pw * 0.1, py - ph * 0.7);
      ctx.lineTo(px + pw * 0.5, py - ph * 0.85);
      ctx.lineTo(px + pw, py);
      ctx.closePath();
      const pg = ctx.createLinearGradient(px, py - ph, px, py);
      pg.addColorStop(0, '#9aa3a8');
      pg.addColorStop(1, '#5a635a');
      ctx.fillStyle = pg;
      ctx.fill();
      ctx.strokeStyle = '#2a2417';
      ctx.lineWidth = 0.6;
      ctx.stroke();
      // Snow cap
      ctx.beginPath();
      ctx.moveTo(px - pw * 0.32, py - ph * 0.74);
      ctx.lineTo(px - pw * 0.18, py - ph);
      ctx.lineTo(px + pw * 0.06, py - ph * 0.74);
      ctx.closePath();
      ctx.fillStyle = '#f4ecd6';
      ctx.fill();
    };
    drawPeak(a.x - 2, a.y, tall, wide);
    drawPeak(a.x + 4, a.y, tall * 0.7, wide * 0.7);
  }

  function modWyvernPeak(ctx, t, br, blob, opts = {}) {
    // A peak with a wyvern silhouette perched on it, anchored to the surface.
    const ember = opts.ember === true;
    const a = opts.anchor || blob.surfaceAnchor;
    // Peak
    ctx.beginPath();
    ctx.moveTo(a.x - 7, a.y);
    ctx.lineTo(a.x - 1.5, a.y - 12);
    ctx.lineTo(a.x + 0.8, a.y - 7);
    ctx.lineTo(a.x + 7, a.y);
    ctx.closePath();
    const pg = ctx.createLinearGradient(a.x, a.y - 12, a.x, a.y);
    pg.addColorStop(0, '#6a5040');
    pg.addColorStop(1, '#3a2a22');
    ctx.fillStyle = pg;
    ctx.fill();
    ctx.strokeStyle = '#2a2417';
    ctx.lineWidth = 0.6;
    ctx.stroke();
    // Wyvern perched at peak tip
    const wx = a.x - 1.5, wy = a.y - 12;
    const flap = Math.sin(t * 3.5) * 0.6 * br;
    ctx.save();
    ctx.translate(wx, wy);
    // Ember glow halo
    if (ember && br > 0.05) {
      const eg = ctx.createRadialGradient(0, -3, 0, 0, -3, 14);
      eg.addColorStop(0, `rgba(255,140,40,${0.45 * br})`);
      eg.addColorStop(1, 'rgba(255,140,40,0)');
      ctx.fillStyle = eg;
      ctx.beginPath();
      ctx.arc(0, -3, 14, 0, Math.PI * 2);
      ctx.fill();
    }
    // Body
    ctx.fillStyle = ember ? '#5a1a10' : '#2a1f18';
    ctx.beginPath();
    ctx.ellipse(0, -2, 3.6, 1.8, 0, 0, Math.PI * 2);
    ctx.fill();
    // Head + neck
    ctx.beginPath();
    ctx.moveTo(2.2, -2.5);
    ctx.quadraticCurveTo(5, -4, 6, -5.5);
    ctx.lineTo(5, -4);
    ctx.quadraticCurveTo(4, -2.5, 2.5, -1.8);
    ctx.closePath();
    ctx.fill();
    // Tail
    ctx.beginPath();
    ctx.moveTo(-2.5, -1.8);
    ctx.quadraticCurveTo(-6, -1, -8, -3);
    ctx.lineWidth = 0.9;
    ctx.strokeStyle = ember ? '#5a1a10' : '#2a1f18';
    ctx.stroke();
    // Wings (bat-like, raised)
    ctx.fillStyle = ember ? '#7a2818' : '#3a2820';
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(1, 1);
      ctx.beginPath();
      const wingH = 7 + flap;
      ctx.moveTo(0, -3);
      ctx.quadraticCurveTo(side * 4, -3 - wingH, side * 8, -1 - wingH * 0.4);
      ctx.quadraticCurveTo(side * 5, -3, side * 1, -3);
      ctx.closePath();
      ctx.fill();
      // Wing finger
      ctx.strokeStyle = ember ? '#3a0a08' : '#1a1008';
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      ctx.moveTo(side * 1, -3);
      ctx.lineTo(side * 7, -1 - wingH * 0.4);
      ctx.stroke();
      ctx.restore();
    }
    // Eye
    ctx.fillStyle = ember ? '#ffe080' : '#e6c060';
    ctx.beginPath();
    ctx.arc(4.4, -4.4, 0.4, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function modBellyWings(ctx, t, br, blob) {
    // Big feathered wings sprouting from underneath the island, like the
    // whole rock is a flying creature.
    const flap = Math.sin(t * 1.8) * 0.22 * br;
    for (const side of [-1, 1]) {
      ctx.save();
      // Anchor on the lower-side of the blob
      ctx.translate(blob.radius * 0.35 * side, blob.radius * 0.45);
      ctx.scale(side, 1);
      ctx.rotate(0.45 + flap);

      const wingW = blob.radius * 1.05;
      const wingH = blob.radius * 0.6;

      // Wing membrane / feathered shape
      ctx.beginPath();
      ctx.moveTo(0, -2);
      ctx.quadraticCurveTo(wingW * 0.35, -wingH * 0.35, wingW * 0.78, -wingH * 0.08);
      ctx.lineTo(wingW * 0.95, wingH * 0.05);
      // Scalloped trailing edge (primary feather tips)
      const feathers = 6;
      for (let i = 0; i < feathers; i++) {
        const f0 = i / feathers;
        const f1 = (i + 1) / feathers;
        const peakX = wingW * (0.95 - f0 * 0.85);
        const peakY = wingH * (0.05 + f0 * 0.5);
        const valleyX = wingW * (0.95 - f1 * 0.85);
        const valleyY = wingH * (0.05 + f1 * 0.5);
        ctx.quadraticCurveTo(
          peakX - wingW * 0.04, peakY + wingH * 0.16,
          valleyX, valleyY
        );
      }
      ctx.lineTo(wingW * 0.12, wingH * 0.35);
      ctx.quadraticCurveTo(wingW * 0.04, wingH * 0.15, 0, -2);
      ctx.closePath();

      const wg = ctx.createLinearGradient(0, -wingH * 0.4, wingW * 0.5, wingH * 0.5);
      wg.addColorStop(0, '#fefdf6');
      wg.addColorStop(0.5, '#e8e2cc');
      wg.addColorStop(1, '#9ea58e');
      ctx.fillStyle = wg;
      ctx.fill();
      ctx.strokeStyle = '#2a2417';
      ctx.lineWidth = 0.6;
      ctx.stroke();

      // Feather shafts radiating from the shoulder
      ctx.strokeStyle = 'rgba(60,45,25,0.55)';
      ctx.lineWidth = 0.4;
      for (let i = 0; i < 6; i++) {
        const f = i / 5;
        const tipX = wingW * (0.2 + f * 0.7);
        const tipY = wingH * (0.05 + f * 0.45);
        ctx.beginPath();
        ctx.moveTo(wingW * 0.05, -wingH * 0.05);
        ctx.quadraticCurveTo(tipX * 0.55, tipY * 0.4, tipX, tipY);
        ctx.stroke();
      }
      // Shoulder bone shading
      ctx.fillStyle = 'rgba(60,45,25,0.35)';
      ctx.beginPath();
      ctx.ellipse(wingW * 0.06, -wingH * 0.05, 2.4, 1.4, 0.3, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  function modSunHalo(ctx, t, br, blob) {
    // Soft glowing sun disk behind the island. Pulses gently with breeze.
    const pulse = 1 + Math.sin(t * 0.8) * 0.04 * br;
    ctx.save();
    ctx.globalCompositeOperation = 'lighter';
    const R = blob.radius * 1.55 * pulse;
    const grad = ctx.createRadialGradient(-blob.radius * 0.1, -blob.radius * 0.25, 0,
                                          -blob.radius * 0.1, -blob.radius * 0.25, R);
    grad.addColorStop(0, 'rgba(255,235,140,0.7)');
    grad.addColorStop(0.5, 'rgba(255,200,100,0.32)');
    grad.addColorStop(1, 'rgba(255,180,80,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(-blob.radius * 0.1, -blob.radius * 0.25, R, 0, Math.PI * 2);
    ctx.fill();
    // Rays
    ctx.strokeStyle = 'rgba(255,220,140,0.6)';
    ctx.lineWidth = 0.7;
    const cx = -blob.radius * 0.1, cy = -blob.radius * 0.25;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + t * 0.05;
      const r1 = blob.radius * 0.9, r2 = blob.radius * 1.15;
      ctx.beginPath();
      ctx.moveTo(cx + Math.cos(a) * r1, cy + Math.sin(a) * r1);
      ctx.lineTo(cx + Math.cos(a) * r2, cy + Math.sin(a) * r2);
      ctx.stroke();
    }
    ctx.restore();
  }

  function modMine(ctx, t, br, blob, opts = {}) {
    // Mine adit with timber frame, hanging lantern, rails coming out, a
    // minecart full of ore, and an ore tailings heap.
    const side = opts.side ?? -1;
    const sh = side < 0 ? blob.leftShoulder : blob.rightShoulder;
    ctx.save();
    ctx.translate(sh.x, sh.y + 7);
    ctx.scale(side, 1);
    // Lantern glow halo (behind everything)
    if (br > 0.05) {
      const glow = ctx.createRadialGradient(-3.5, -4.5, 0, -3.5, -4.5, 7);
      glow.addColorStop(0, `rgba(255,200,110,${0.7 * br})`);
      glow.addColorStop(1, 'rgba(255,200,110,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(-3.5, -4.5, 7, 0, Math.PI * 2);
      ctx.fill();
    }
    // Dark interior (bigger adit)
    ctx.fillStyle = '#0a0805';
    ctx.beginPath();
    ctx.moveTo(-7, 0.5);
    ctx.lineTo(-7, -6);
    ctx.quadraticCurveTo(-3.5, -10, 0, -6);
    ctx.lineTo(0, 0.5);
    ctx.closePath();
    ctx.fill();
    // Thicker timber frame
    ctx.strokeStyle = '#6b4423';
    ctx.lineWidth = 1.8;
    ctx.beginPath();
    ctx.moveTo(-7.2, 0.5);
    ctx.lineTo(-7.2, -6);
    ctx.quadraticCurveTo(-3.5, -10.2, 0.2, -6);
    ctx.lineTo(0.2, 0.5);
    ctx.stroke();
    // Cross-beam (header)
    ctx.beginPath();
    ctx.moveTo(-7.6, -6);
    ctx.lineTo(0.6, -6);
    ctx.lineWidth = 1.6;
    ctx.stroke();
    // Plank/grain marks
    ctx.strokeStyle = 'rgba(40,25,10,0.6)';
    ctx.lineWidth = 0.4;
    for (let dy = -1; dy >= -5; dy -= 1.6) {
      ctx.beginPath();
      ctx.moveTo(-7.6, dy);
      ctx.lineTo(-6.6, dy);
      ctx.moveTo(-0.4, dy);
      ctx.lineTo(0.6, dy);
      ctx.stroke();
    }
    // Hanging lantern inside
    ctx.strokeStyle = '#2a1410';
    ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(-3.5, -6);
    ctx.lineTo(-3.5, -5);
    ctx.stroke();
    ctx.fillStyle = '#ffd048';
    ctx.beginPath();
    ctx.arc(-3.5, -4.2, 1.1, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#2a1410';
    ctx.lineWidth = 0.4;
    ctx.stroke();
    // Rails coming out
    ctx.strokeStyle = '#3a2818';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(-6, 0.5); ctx.lineTo(7, 1);
    ctx.moveTo(-6, 1.5); ctx.lineTo(7, 2);
    ctx.stroke();
    // Rail ties
    ctx.fillStyle = '#3a2818';
    for (let dx = -5; dx < 7; dx += 1.6) {
      ctx.fillRect(dx, 0.3, 0.4, 1.6);
    }
    // Minecart
    ctx.fillStyle = '#7a3a2a';
    ctx.fillRect(2, -3.5, 4.5, 3.5);
    ctx.strokeStyle = '#2a1410';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(2, -3.5, 4.5, 3.5);
    // Ore in cart
    ctx.fillStyle = '#caa46a';
    ctx.beginPath();
    ctx.arc(3, -3.4, 0.7, 0, Math.PI * 2);
    ctx.arc(4.5, -3.7, 0.8, 0, Math.PI * 2);
    ctx.arc(5.6, -3.4, 0.6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#e6b03a';
    ctx.beginPath();
    ctx.arc(3.5, -3.6, 0.3, 0, Math.PI * 2);
    ctx.arc(5, -3.9, 0.3, 0, Math.PI * 2);
    ctx.fill();
    // Wheels
    ctx.fillStyle = '#1a1208';
    ctx.beginPath();
    ctx.arc(3, 0.5, 0.9, 0, Math.PI * 2);
    ctx.arc(5.5, 0.5, 0.9, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#5a4030';
    ctx.beginPath();
    ctx.arc(3, 0.5, 0.3, 0, Math.PI * 2);
    ctx.arc(5.5, 0.5, 0.3, 0, Math.PI * 2);
    ctx.fill();
    // Tailings heap further out
    ctx.fillStyle = '#6a4a30';
    ctx.beginPath();
    ctx.ellipse(9.5, 2, 3.6, 1.6, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3a2418';
    ctx.lineWidth = 0.4;
    ctx.stroke();
    // Bright ore chunks on the heap
    ctx.fillStyle = '#e6b03a';
    for (const [dx, dy] of [[8.4, 1.4], [9.6, 1.2], [10.6, 1.8], [9.2, 2.4]]) {
      ctx.beginPath();
      ctx.arc(dx, dy, 0.55, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  function modSeashellTower(ctx, t, br, blob, opts = {}) {
    // Architectural tower with horizontal shell-like spiral bands.
    // Anchored on the surface so it sits within the silhouette.
    const a = opts.anchor || blob.surfaceAnchor;
    ctx.save();
    ctx.translate(a.x, a.y);
    // Tapered body — straight tower lines, not organic curves
    ctx.beginPath();
    ctx.moveTo(-4, 0);
    ctx.lineTo(-2.4, -13);
    ctx.lineTo(2.4, -13);
    ctx.lineTo(4, 0);
    ctx.closePath();
    const tg = ctx.createLinearGradient(-4, 0, 4, 0);
    tg.addColorStop(0, '#caa46a');
    tg.addColorStop(0.5, '#f4d6a8');
    tg.addColorStop(1, '#caa46a');
    ctx.fillStyle = tg;
    ctx.fill();
    ctx.strokeStyle = '#3a2418';
    ctx.lineWidth = 0.6;
    ctx.stroke();
    // Spiral shell bands — horizontal curves wrapping the tower
    ctx.strokeStyle = 'rgba(80,40,20,0.65)';
    ctx.lineWidth = 0.5;
    for (let i = 1; i <= 4; i++) {
      const y = -i * 2.6;
      const xR = 4 - (i / 4) * 1.6;
      ctx.beginPath();
      ctx.moveTo(-xR, y);
      ctx.quadraticCurveTo(0, y + 0.5, xR, y);
      ctx.stroke();
      // Tiny tick mark on one side suggests the spiral wrap continuation
      ctx.beginPath();
      ctx.moveTo(xR, y);
      ctx.lineTo(xR - 0.6, y + 0.6);
      ctx.stroke();
    }
    // Conical roof
    ctx.beginPath();
    ctx.moveTo(-2.8, -13);
    ctx.lineTo(0, -18);
    ctx.lineTo(2.8, -13);
    ctx.closePath();
    ctx.fillStyle = '#9a4438';
    ctx.fill();
    ctx.strokeStyle = '#2a1410';
    ctx.lineWidth = 0.5;
    ctx.stroke();
    // Finial pearl
    ctx.fillStyle = '#f4d6a8';
    ctx.beginPath();
    ctx.arc(0, -18.4, 0.7, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#3a2418';
    ctx.lineWidth = 0.4;
    ctx.stroke();
    // Door at base
    ctx.fillStyle = '#2a1f12';
    ctx.beginPath();
    ctx.moveTo(-1, 0);
    ctx.lineTo(-1, -2.2);
    ctx.quadraticCurveTo(0, -3, 1, -2.2);
    ctx.lineTo(1, 0);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function modVolcano(ctx, t, br, blob, opts = {}) {
    // Cone + smoke plume + lava-glow rim, anchored to the surface.
    const a = opts.anchor || blob.surfaceAnchor;
    const scale = opts.scale ?? 1;
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.scale(scale, scale);
    // Cone
    ctx.beginPath();
    ctx.moveTo(-8, 0);
    ctx.lineTo(-2.5, -10);
    ctx.lineTo(2.5, -10);
    ctx.lineTo(8, 0);
    ctx.closePath();
    const cg = ctx.createLinearGradient(0, -10, 0, 0);
    cg.addColorStop(0, '#3a2a22');
    cg.addColorStop(1, '#1a120a');
    ctx.fillStyle = cg;
    ctx.fill();
    ctx.strokeStyle = '#1a0c08';
    ctx.lineWidth = 0.6;
    ctx.stroke();
    // Crater rim
    ctx.fillStyle = '#ff7a30';
    ctx.beginPath();
    ctx.ellipse(0, -10, 2.5, 0.9, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#ffd048';
    ctx.beginPath();
    ctx.ellipse(0, -10, 1.4, 0.5, 0, 0, Math.PI * 2);
    ctx.fill();
    // Lava drips
    ctx.strokeStyle = '#ff5020';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(-1, -9.5); ctx.lineTo(-2.5, -3.5);
    ctx.moveTo(1.4, -9.5); ctx.lineTo(3, -3);
    ctx.stroke();
    // Smoke plume
    if (br > 0.05) {
      ctx.save();
      ctx.globalAlpha = 0.55 * br;
      for (let i = 0; i < 3; i++) {
        const ph = (t * 0.6 + i / 3) % 1;
        const py = -10 - ph * 18;
        const pr = 1.4 + ph * 3;
        const px = Math.sin((ph + i) * 4) * 1.4;
        ctx.fillStyle = `rgba(60,55,55,${0.7 - ph * 0.5})`;
        ctx.beginPath();
        ctx.arc(px, py, pr, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    ctx.restore();
  }

  function modOvergrown(ctx, t, br, blob, opts = {}) {
    // Dense overgrown cluster — a tight grove of skeletal trees with
    // brambles wrapping them and a cluster of dead red flowers around the
    // base. Concentrated, not spread along the rim.
    const a = opts.anchor || blob.surfaceAnchor;
    const seed = opts.seed ?? 7;
    const r = (opts.makeRng || defaultMakeRng)(seed + 31);
    const sway = Math.sin(t * 1.2) * 0.05 * br;
    // Cluster of 5 twisted dead trees, tightly packed near the surface anchor
    const trees = [
      { dx: -7,  dy:  3,  h: 12, lean:  0.4 },
      { dx: -2,  dy:  1,  h: 17, lean: -0.3 },
      { dx:  3,  dy:  2,  h: 14, lean:  0.2 },
      { dx:  8,  dy:  4,  h: 11, lean: -0.4 },
      { dx:  0,  dy:  5,  h:  9, lean:  0.1 },
    ];
    for (const tr of trees) {
      ctx.save();
      ctx.translate(a.x + tr.dx, a.y + tr.dy);
      ctx.rotate(sway + tr.lean * 0.2 + (r() - 0.5) * 0.1);
      // Gnarled black trunk
      ctx.strokeStyle = '#0e0a06';
      ctx.lineWidth = 1.3;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(1.6, -tr.h * 0.4, -1.2, -tr.h * 0.7);
      ctx.quadraticCurveTo(-2.4, -tr.h * 0.95, 0.4, -tr.h);
      ctx.stroke();
      // Skeletal branches — short, sharp, asymmetric
      ctx.lineWidth = 0.6;
      const branches = [
        [0.5, -tr.h * 0.45, -1.2, -tr.h * 0.4 - 2.6],
        [-0.6, -tr.h * 0.6,  2.5, -tr.h * 0.55],
        [-0.9, -tr.h * 0.78, -3,  -tr.h * 0.85],
        [0.2, -tr.h * 0.9,   2.2, -tr.h * 1.02],
      ];
      for (const [x1, y1, x2, y2] of branches) {
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.quadraticCurveTo((x1 + x2) / 2 - 0.5, (y1 + y2) / 2, x2, y2);
        // Thorn off the branch
        const tx = (x1 + x2) / 2;
        const ty = (y1 + y2) / 2;
        ctx.moveTo(tx, ty);
        ctx.lineTo(tx + (x2 < x1 ? -0.9 : 0.9), ty - 0.6);
        ctx.stroke();
      }
      // Very sparse dark leaves
      ctx.fillStyle = '#1c2818';
      for (let i = 0; i < 2; i++) {
        const lx = (r() - 0.5) * 4.5;
        const ly = -tr.h * (0.7 + r() * 0.3);
        ctx.beginPath();
        ctx.ellipse(lx, ly, 1.4, 0.7, r() * Math.PI, 0, Math.PI * 2);
        ctx.fill();
      }
      ctx.restore();
    }
    // Brambles ringing the cluster base — curved strokes with thorn barbs
    ctx.save();
    ctx.translate(a.x, a.y);
    ctx.strokeStyle = '#2a2018';
    ctx.lineWidth = 0.7;
    for (let i = 0; i < 16; i++) {
      const ang = (i / 16) * Math.PI * 2;
      const r1 = 5 + r() * 2;
      const r2 = r1 + 2.5 + r() * 1.5;
      const yBias = 3; // sit around the lower half of the cluster
      const x1 = Math.cos(ang) * r1;
      const y1 = Math.sin(ang) * r1 * 0.65 + yBias;
      const x2 = Math.cos(ang) * r2;
      const y2 = Math.sin(ang) * r2 * 0.65 + yBias;
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(
        (x1 + x2) / 2 + (r() - 0.5) * 1.6,
        (y1 + y2) / 2 + (r() - 0.5) * 1.6,
        x2, y2
      );
      ctx.stroke();
      // Thorn barb
      const mx = (x1 + x2) / 2;
      const my = (y1 + y2) / 2;
      ctx.beginPath();
      ctx.moveTo(mx, my);
      ctx.lineTo(mx + Math.cos(ang) * 1.4, my + Math.sin(ang) * 1.4 - 0.4);
      ctx.stroke();
    }
    ctx.restore();
    // Cluster of dead red flowers at the base
    for (const [dx, dy] of [[-5, 6], [-1, 7], [3, 6.5], [6, 7], [9, 6]]) {
      const fx = a.x + dx, fy = a.y + dy;
      ctx.fillStyle = '#a82838';
      ctx.beginPath();
      ctx.arc(fx, fy, 1.0, 0, Math.PI * 2);
      ctx.fill();
      // Dark center
      ctx.fillStyle = '#3a1418';
      ctx.beginPath();
      ctx.arc(fx, fy, 0.35, 0, Math.PI * 2);
      ctx.fill();
      // Tiny stem
      ctx.strokeStyle = '#2a2018';
      ctx.lineWidth = 0.4;
      ctx.beginPath();
      ctx.moveTo(fx, fy + 1);
      ctx.lineTo(fx, fy + 2.4);
      ctx.stroke();
    }
  }

  function modWarBanner(ctx, t, br, blob, opts = {}) {
    // Heraldic standard — pole with a rectangular banner bearing crossed
    // swords. Reads as martial without looking like a flag on a pin.
    const a = opts.anchor || blob.surfaceAnchor;
    ctx.save();
    ctx.translate(a.x, a.y);
    // Stone footing
    ctx.fillStyle = '#7a7568';
    ctx.fillRect(-3, -1, 6, 2);
    ctx.strokeStyle = '#2a2417';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(-3, -1, 6, 2);
    // Stone block detail
    ctx.beginPath();
    ctx.moveTo(0, -1);
    ctx.lineTo(0, 1);
    ctx.stroke();
    // Pole
    ctx.strokeStyle = '#3a2a18';
    ctx.lineWidth = 1.3;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(0, -1);
    ctx.lineTo(0, -15);
    ctx.stroke();
    // Spear-tip finial
    ctx.fillStyle = '#cfd6dc';
    ctx.beginPath();
    ctx.moveTo(0, -17);
    ctx.lineTo(-0.8, -15);
    ctx.lineTo(0.8, -15);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#2a2417';
    ctx.lineWidth = 0.4;
    ctx.stroke();
    // Crossbeam the banner hangs from
    ctx.strokeStyle = '#3a2a18';
    ctx.lineWidth = 0.9;
    ctx.beginPath();
    ctx.moveTo(-0.5, -13);
    ctx.lineTo(7, -13);
    ctx.stroke();
    // Rectangular banner, bottom hem flutters slightly
    const flutter = Math.sin(t * 3) * 0.4 * br;
    ctx.fillStyle = '#7a2018';
    ctx.beginPath();
    ctx.moveTo(0, -13);
    ctx.lineTo(7, -13);
    ctx.lineTo(7, -6.5);
    ctx.lineTo(5 + flutter, -5.4);
    ctx.lineTo(2 - flutter * 0.5, -6.4);
    ctx.lineTo(0, -5.8);
    ctx.closePath();
    ctx.fill();
    ctx.strokeStyle = '#3a0a08';
    ctx.lineWidth = 0.4;
    ctx.stroke();
    // Gold trim along top
    ctx.strokeStyle = '#e6b03a';
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0.4, -12.2);
    ctx.lineTo(6.6, -12.2);
    ctx.stroke();
    // Crossed swords emblem
    ctx.strokeStyle = '#f0e8d0';
    ctx.lineWidth = 0.8;
    ctx.lineCap = 'round';
    ctx.beginPath();
    ctx.moveTo(1.6, -11); ctx.lineTo(5.4, -7.6);
    ctx.moveTo(5.4, -11); ctx.lineTo(1.6, -7.6);
    ctx.stroke();
    // Sword pommels (small dots at hilt ends)
    ctx.fillStyle = '#e6b03a';
    ctx.beginPath();
    ctx.arc(1.6, -11, 0.5, 0, Math.PI * 2);
    ctx.arc(5.4, -11, 0.5, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function modLighthouse(ctx, t, br, blob, opts = {}) {
    // From the kid's sketch: a tall thin striped tower with a pointed top
    // and fixed beam lines radiating outward (plus a soft sweeping beam).
    const a = opts.anchor || blob.surfaceAnchor;
    ctx.save();
    ctx.translate(a.x, a.y);
    // Narrow base block
    ctx.fillStyle = '#d8d3c0';
    ctx.fillRect(-2.6, -1, 5.2, 1.6);
    ctx.strokeStyle = '#2a2417';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(-2.6, -1, 5.2, 1.6);
    // Tower shaft — alternating red/white stripes
    const tw = 3.6, th = 17;
    const stripes = 6;
    for (let i = 0; i < stripes; i++) {
      const y = -1 - (i + 1) * (th / stripes);
      ctx.fillStyle = (i % 2 === 0) ? '#c9342c' : '#f4ecd6';
      ctx.fillRect(-tw / 2, y, tw, th / stripes + 0.3);
    }
    ctx.strokeStyle = '#2a2417';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(-tw / 2, -1 - th, tw, th);
    // Lamp housing — small box at the top of the shaft
    const lampY = -1 - th;
    ctx.fillStyle = '#f8e89a';
    ctx.fillRect(-tw / 2 + 0.2, lampY - 2.2, tw - 0.4, 2.2);
    ctx.strokeStyle = '#2a2417';
    ctx.lineWidth = 0.5;
    ctx.strokeRect(-tw / 2 + 0.2, lampY - 2.2, tw - 0.4, 2.2);
    // Pointed top (matches the sketch — pointed, not domed)
    ctx.fillStyle = '#3a3022';
    ctx.beginPath();
    ctx.moveTo(-tw / 2 - 0.2, lampY - 2.2);
    ctx.lineTo(0, lampY - 6);
    ctx.lineTo(tw / 2 + 0.2, lampY - 2.2);
    ctx.closePath();
    ctx.fill();
    ctx.stroke();
    // Lamp center (bright dot inside housing)
    ctx.fillStyle = '#fff4a8';
    ctx.beginPath();
    ctx.arc(0, lampY - 1.1, 0.7, 0, Math.PI * 2);
    ctx.fill();
    // Fixed radiating beam lines, matching the sketch — five rays fanning
    // out from the lamp, brightness pulses gently.
    if (br > 0.05) {
      const pulse = 0.55 + 0.45 * (0.5 + 0.5 * Math.sin(t * 2));
      ctx.strokeStyle = `rgba(255,232,140,${0.75 * br * pulse})`;
      ctx.lineWidth = 0.7;
      ctx.lineCap = 'round';
      const cx = 0, cy = lampY - 1.1;
      const rays = [
        [-1.4, 0],   // left horizontal
        [-1.0, -0.7], // upper-left
        [0,    -1],  // straight up
        [1.0,  -0.7], // upper-right
        [1.4,  0],   // right horizontal
      ];
      for (const [dx, dy] of rays) {
        const len = 10;
        ctx.beginPath();
        ctx.moveTo(cx + dx * 2, cy + dy * 2);
        ctx.lineTo(cx + dx * len, cy + dy * len);
        ctx.stroke();
      }
      // Soft halo around the lamp
      const glow = ctx.createRadialGradient(cx, cy, 0, cx, cy, 6);
      glow.addColorStop(0, `rgba(255,232,140,${0.55 * br * pulse})`);
      glow.addColorStop(1, 'rgba(255,232,140,0)');
      ctx.fillStyle = glow;
      ctx.beginPath();
      ctx.arc(cx, cy, 6, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }

  // ---------- Master draw function for name-modifier cards ----------
  // Draws auras under the blob, then the blob itself, then surface- and
  // side-anchored modifiers. Top-anchored modifiers sit at blob.surfaceAnchor
  // (the upper-left "deck spot" where the highlight used to be).
  function drawNamedIsland(ctx, t, br, seed, mods, opts = {}) {
    mods = mods || [];
    const has = m => mods.includes(m);
    const volcanic = has('asha');
    const rocky = has('crag') || has('reach');

    // Sol + spire/watch promotes to a lighthouse (kid's request).
    const lighthouseCombo = has('sol') && (has('spire') || has('watch'));

    // A "top-anchored" modifier replaces the highlight on the blob.
    const hasTopMod = lighthouseCombo
      || has('keep') || has('crest')
      || has('spire') || has('watch')
      || has('asha')
      || has('wyn') || has('pyre')
      || has('crag') || has('reach')
      || has('helm') || has('mel');

    // Auras and big things drawn behind the blob need a stub reference
    // (radius/shoulders only) before drawBlob runs.
    const stub = {
      radius: 36,
      topY: -30, bottomY: 34,
      leftShoulder: { x: -27, y: -5 },
      rightShoulder: { x: 27, y: -5 },
    };
    if (has('sol'))  modSunHalo(ctx, t, br, stub);
    if (has('tide')) modWetSheen(ctx, t, br, stub);
    if (has('wing') || has('aer')) modBellyWings(ctx, t, br, stub);

    // The blob itself.
    const blob = drawBlob(ctx, t, br, { seed, volcanic, rocky, skipHighlight: hasTopMod, makeRng: opts.makeRng });

    // Top-anchored modifier. Combinations are handled explicitly:
    //   sol + spire → lighthouse (combo)
    //   asha + keep → volcano at anchor, castle offset down-right and shrunk
    //   wyn/pyre (+ optional crag) → wyvern-on-peak (peak is part of mod)
    //   crag/reach alone → bare peaks
    //   single top mod → its own drawer at anchor
    if (lighthouseCombo) {
      modLighthouse(ctx, t, br, blob);
    } else if (has('asha') && (has('keep') || has('crest'))) {
      modVolcano(ctx, t, br, blob);
      const anchor = {
        x: blob.surfaceAnchor.x + 13,
        y: blob.surfaceAnchor.y + 5,
      };
      modCastle(ctx, t, br, blob, { anchor, scale: 0.7 });
    } else if (has('wyn') || has('pyre')) {
      modWyvernPeak(ctx, t, br, blob, { ember: has('pyre') });
    } else if (has('asha')) {
      modVolcano(ctx, t, br, blob);
    } else if (has('crag') || has('reach')) {
      modPeaks(ctx, t, br, blob);
    } else if (has('keep') || has('crest')) {
      modCastle(ctx, t, br, blob);
    } else if (has('spire') || has('watch')) {
      modSeashellTower(ctx, t, br, blob);
    } else if (has('helm') || has('mel')) {
      modWarBanner(ctx, t, br, blob);
    }

    // Side-anchored modifiers (mine on left, dock on right).
    if (has('glen') || has('dell')) modMine(ctx, t, br, blob, { side: -1 });
    if (has('tide')) modDock(ctx, t, br, blob, { side: 1 });

    // Overgrown cluster anchored on the surface (drawn last so brambles
    // can wrap any nearby props).
    if (has('hollow') || has('thorn')) modOvergrown(ctx, t, br, blob, { seed, makeRng: opts.makeRng });
  }


  window.SkyboundIslands = {
    drawBlob,
    drawNamedIsland,
    MODS: {
      castle: modCastle,
      dock: modDock,
      wetSheen: modWetSheen,
      peaks: modPeaks,
      wyvernPeak: modWyvernPeak,
      bellyWings: modBellyWings,
      sunHalo: modSunHalo,
      mine: modMine,
      seashellTower: modSeashellTower,
      volcano: modVolcano,
      overgrown: modOvergrown,
      warBanner: modWarBanner,
      lighthouse: modLighthouse,
    },
  };
})();
