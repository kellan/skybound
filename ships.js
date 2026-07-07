// Skybound ship art — single source of truth, shared by the game
// (index.html) and the workbench (ship-lab.html) via a classic script tag
// (an ES module would break opening the files over file://).
//
// Every drawer renders at (0,0) facing +X: (ctx2d, t, speed01) where t is
// seconds and speed01 is the 0..1 normalized effort/speed. Two view classes:
//   topdown: caller rotates ctx by heading before drawing.
//   profile: never rotated; caller flips x by sticky facing — except ships
//            in OWN_FACING, which receive facingLeft as a 4th arg and
//            animate their own turn.
(function () {
  function drawShipSloop(ctx, t, speed) {
    ctx.beginPath();
    ctx.moveTo(14, 0);
    ctx.lineTo(-8, -7);
    ctx.lineTo(-5, 0);
    ctx.lineTo(-8, 7);
    ctx.closePath();
    ctx.fillStyle = '#c9622e';
    ctx.fill();
    ctx.strokeStyle = '#2a2417';
    ctx.lineWidth = 1.2;
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(2, 0);
    ctx.lineTo(-4, -9);
    ctx.lineTo(-2, 0);
    ctx.closePath();
    ctx.fillStyle = '#f2e8d0';
    ctx.fill();
    ctx.stroke();
  }

  function drawShipButterfly(ctx, t, speed) {
    const flapsPerSec = 8 + speed * 2;
    const flap = 0.12 + 0.88 * Math.abs(Math.sin(t * flapsPerSec * Math.PI));
    const orange = '#e07020', black = '#1a1410', cream = '#f8f0e0';

    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(1, side);
      ctx.scale(1, flap);
      // Hindwing (behind)
      ctx.beginPath();
      ctx.moveTo(-1, -1);
      ctx.bezierCurveTo(-2, -6, -8, -9, -10, -6);
      ctx.bezierCurveTo(-11, -3, -9, -0.5, -6, 0);
      ctx.bezierCurveTo(-3, 0, -1.5, -0.5, -1, -1);
      ctx.closePath();
      ctx.fillStyle = black; ctx.fill();
      ctx.beginPath();
      ctx.moveTo(-1.5, -1.4);
      ctx.bezierCurveTo(-3, -5.5, -7, -7.5, -8.7, -5.5);
      ctx.bezierCurveTo(-9.5, -3, -8, -1.3, -5.5, -1);
      ctx.bezierCurveTo(-3, -1, -2, -1.3, -1.5, -1.4);
      ctx.closePath();
      ctx.fillStyle = orange; ctx.fill();
      ctx.strokeStyle = black; ctx.lineWidth = 0.35;
      ctx.beginPath();
      ctx.moveTo(-2, -1); ctx.quadraticCurveTo(-4, -3, -7, -5.5);
      ctx.moveTo(-2, -1.5); ctx.quadraticCurveTo(-5, -3, -8.5, -4);
      ctx.stroke();
      ctx.fillStyle = cream;
      for (const [px, py] of [[-7, -7.5], [-9.5, -5], [-7.5, -2]]) {
        ctx.beginPath(); ctx.arc(px, py, 0.4, 0, Math.PI * 2); ctx.fill();
      }
      // Forewing
      ctx.beginPath();
      ctx.moveTo(3, -0.5);
      ctx.bezierCurveTo(6, -7, 3, -14, -3, -13.5);
      ctx.bezierCurveTo(-7, -11, -7, -7, -6, -4);
      ctx.bezierCurveTo(-4, -2, -1, -1, 3, -0.5);
      ctx.closePath();
      ctx.fillStyle = black; ctx.fill();
      ctx.beginPath();
      ctx.moveTo(2.7, -1);
      ctx.bezierCurveTo(5, -7, 2.5, -12.5, -2.5, -12);
      ctx.bezierCurveTo(-6, -10, -6, -7, -5, -4.5);
      ctx.bezierCurveTo(-3.5, -3, -1, -2, 2.7, -1);
      ctx.closePath();
      ctx.fillStyle = orange; ctx.fill();
      ctx.strokeStyle = black; ctx.lineWidth = 0.4;
      ctx.beginPath();
      ctx.moveTo(2, -1.5); ctx.quadraticCurveTo(0, -6, -1.8, -11);
      ctx.moveTo(0.5, -2); ctx.quadraticCurveTo(-2.5, -6, -4, -10);
      ctx.moveTo(-1.5, -2.5); ctx.quadraticCurveTo(-3.5, -5, -5.2, -7);
      ctx.stroke();
      ctx.fillStyle = cream;
      for (const [px, py] of [[-3, -12.5], [-1, -13], [-5, -10], [-6, -7], [-6, -4.5]]) {
        ctx.beginPath(); ctx.arc(px, py, 0.55, 0, Math.PI * 2); ctx.fill();
      }
      ctx.restore();
    }
    // Body + head + antennae
    ctx.beginPath();
    ctx.ellipse(2, 0, 7, 1.8, 0, 0, Math.PI * 2);
    ctx.fillStyle = black; ctx.fill();
    ctx.beginPath(); ctx.arc(8, 0, 2, 0, Math.PI * 2); ctx.fill();
    ctx.strokeStyle = black; ctx.lineWidth = 0.7;
    ctx.beginPath();
    ctx.moveTo(8, -1); ctx.quadraticCurveTo(12, -4, 11, -6);
    ctx.moveTo(8, 1); ctx.quadraticCurveTo(12, 4, 11, 6);
    ctx.stroke();
  }

  function drawShipSeaTurtle(ctx, t, speed) {
    // Top-down sea turtle: teal palette, long front flippers, scute pattern.
    const paddleRate = 1.2 + speed * 0.5;
    const teal      = '#3a7a92';
    const tealLight = '#4a8aa0';
    const tealDeep  = '#2a5a72';
    const ink       = '#2a2417';

    const frontSwing = Math.sin(t * paddleRate);
    const rearSwing  = Math.sin(t * paddleRate + Math.PI);

    // Front flippers — long paddle, swept back, big stroke.
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(3, 5.5 * side);
      const base = side * 0.4;
      ctx.rotate(base + frontSwing * 0.55 * side);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(5, -2 * side, 9.5, -1.2 * side);
      ctx.quadraticCurveTo(11, 0, 9.5, 1.6 * side);
      ctx.quadraticCurveTo(5, 2.4 * side, 0, 1.4 * side);
      ctx.closePath();
      ctx.fillStyle = tealDeep; ctx.fill();
      ctx.strokeStyle = ink; ctx.lineWidth = 0.7; ctx.stroke();
      ctx.restore();
    }
    // Rear flippers — short, swept further back.
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.translate(-7, 4.5 * side);
      const base = side * 1.6;
      ctx.rotate(base + rearSwing * 0.35 * side);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.quadraticCurveTo(3, -1.4 * side, 5, -0.6 * side);
      ctx.quadraticCurveTo(5.5, 0.4 * side, 4.5, 1.4 * side);
      ctx.quadraticCurveTo(2.5, 1.6 * side, 0, 1.2 * side);
      ctx.closePath();
      ctx.fillStyle = tealDeep; ctx.fill();
      ctx.strokeStyle = ink; ctx.lineWidth = 0.6; ctx.stroke();
      ctx.restore();
    }
    // Shell — teardrop, widest about 1/3 from front.
    ctx.beginPath();
    ctx.moveTo(11, 0);
    ctx.bezierCurveTo(11, -5, 4, -7.5, -2, -7);
    ctx.bezierCurveTo(-9, -6, -11, -3, -10.5, 0);
    ctx.bezierCurveTo(-11, 3, -9, 6, -2, 7);
    ctx.bezierCurveTo(4, 7.5, 11, 5, 11, 0);
    ctx.closePath();
    ctx.fillStyle = tealLight; ctx.fill();
    ctx.strokeStyle = ink; ctx.lineWidth = 1; ctx.stroke();
    // Scute pattern: 5 vertebral + 4 costal pairs (cross-bars + side ribs)
    ctx.strokeStyle = 'rgba(42,36,23,0.55)'; ctx.lineWidth = 0.5;
    for (const x of [7, 3, -1, -5, -9]) {
      const halfH = Math.max(0, 6 - Math.abs(x + 1) * 0.55);
      ctx.beginPath();
      ctx.moveTo(x, -halfH); ctx.lineTo(x, halfH);
      ctx.stroke();
    }
    for (const side of [-1, 1]) {
      for (const x of [8, 4, 0, -4, -8]) {
        const rim = Math.max(2, 6.5 - Math.abs(x + 1) * 0.45) * side;
        ctx.beginPath();
        ctx.moveTo(x, 0.5 * side);
        ctx.quadraticCurveTo(x - 0.5, rim * 0.7, x - 1, rim);
        ctx.stroke();
      }
    }
    // Central ridge highlight
    ctx.strokeStyle = 'rgba(255, 248, 224, 0.35)'; ctx.lineWidth = 0.8;
    ctx.beginPath(); ctx.moveTo(10, 0); ctx.lineTo(-10, 0); ctx.stroke();
    // Head — small wedge with two top eyes
    ctx.beginPath();
    ctx.moveTo(11, -2.2);
    ctx.quadraticCurveTo(15, -1.6, 15.5, 0);
    ctx.quadraticCurveTo(15, 1.6, 11, 2.2);
    ctx.closePath();
    ctx.fillStyle = teal; ctx.fill();
    ctx.strokeStyle = ink; ctx.lineWidth = 0.7; ctx.stroke();
    ctx.fillStyle = ink;
    ctx.beginPath(); ctx.arc(13.2, -1.1, 0.45, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(13.2,  1.1, 0.45, 0, Math.PI * 2); ctx.fill();
    // Tail stub
    ctx.beginPath();
    ctx.moveTo(-10.5, -0.8); ctx.lineTo(-13, 0); ctx.lineTo(-10.5, 0.8);
    ctx.closePath();
    ctx.fillStyle = teal; ctx.fill();
    ctx.strokeStyle = ink; ctx.lineWidth = 0.5; ctx.stroke();
  }

  function drawShipManta(ctx, t, speed) {
    const wingPhase = Math.sin(t * (1.0 + speed * 0.5));
    // Body
    ctx.beginPath();
    ctx.moveTo(11, 0);
    ctx.quadraticCurveTo(8, -3, 2, -2.2);
    ctx.lineTo(-10, -1);
    ctx.lineTo(-10, 1);
    ctx.lineTo(2, 2.2);
    ctx.quadraticCurveTo(8, 3, 11, 0);
    ctx.closePath();
    ctx.fillStyle = '#3e556d'; ctx.fill();
    ctx.strokeStyle = '#2a2417'; ctx.lineWidth = 0.8; ctx.stroke();
    // Wings
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(1, side);
      const tip = -11 + wingPhase * 3;
      ctx.beginPath();
      ctx.moveTo(8, -1);
      ctx.bezierCurveTo(4, -3, -2, tip, -9, -9 + wingPhase * 2);
      ctx.bezierCurveTo(-5, -5, -2, -3, -8, -1);
      ctx.closePath();
      ctx.fillStyle = '#536e88'; ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    // Cephalic horns
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(1, side);
      ctx.beginPath();
      ctx.moveTo(10, -1);
      ctx.quadraticCurveTo(14, -2.5, 13, -0.5);
      ctx.closePath();
      ctx.fillStyle = '#3e556d'; ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    // Whip tail
    ctx.beginPath();
    ctx.moveTo(-9, 0);
    ctx.quadraticCurveTo(-15, Math.sin(t * 1.0) * 1.6, -22, Math.sin(t * 1.0 + 1) * 2);
    ctx.lineWidth = 0.9; ctx.stroke();
    // Eyes
    for (const side of [-1, 1]) {
      ctx.beginPath();
      ctx.arc(8, side * 1.2, 0.55, 0, Math.PI * 2);
      ctx.fillStyle = '#f2e8d0'; ctx.fill();
    }
  }

  function drawShipJellyfish(ctx, t, speed) {
    const pulse = 1 + Math.sin(t * 2.2) * 0.09;
    const len = 7 + speed * 16;
    const wigAmp = 0.7 + speed * 1.4;
    const wigRate = 1.8 + speed * 1.6;

    function backX(y) {
      const k = y / 8;
      return 1.6 - 1.8 * (1 - k * k);
    }

    // Tendrils streaming behind
    ctx.strokeStyle = 'rgba(120, 70, 130, 0.85)';
    ctx.lineCap = 'round'; ctx.lineWidth = 1.1;
    const tendrils = 5;
    for (let i = 0; i < tendrils; i++) {
      const ty = (i - (tendrils - 1) / 2) * 2.6;
      const tx = backX(ty) * pulse;
      const sy = ty * pulse;
      const wig = Math.sin(t * wigRate + i * 0.8) * wigAmp;
      ctx.beginPath();
      ctx.moveTo(tx, sy);
      ctx.bezierCurveTo(
        tx - len * 0.35, sy + wig * 1.1,
        tx - len * 0.75, sy + wig * 1.7,
        tx - len,        sy + wig * 2.2
      );
      ctx.stroke();
    }
    ctx.lineCap = 'butt';

    // Bell
    ctx.save();
    ctx.scale(pulse, pulse);
    ctx.beginPath();
    ctx.ellipse(2, 0, 10, 8, 0, -Math.PI / 2, Math.PI / 2);
    ctx.bezierCurveTo(0, 5, 0, -5, 2, -8);
    ctx.closePath();
    const grad = ctx.createRadialGradient(4, -2, 0, 4, -2, 14);
    grad.addColorStop(0, 'rgba(245, 210, 230, 0.92)');
    grad.addColorStop(1, 'rgba(180, 130, 180, 0.78)');
    ctx.fillStyle = grad; ctx.fill();
    ctx.strokeStyle = 'rgba(80, 40, 80, 0.55)';
    ctx.lineWidth = 0.9; ctx.stroke();
    ctx.strokeStyle = 'rgba(120, 70, 130, 0.4)';
    ctx.lineWidth = 0.6;
    for (let i = -1; i <= 1; i++) {
      const a = i * 0.45;
      ctx.beginPath();
      ctx.moveTo(2, 0);
      ctx.lineTo(2 + Math.cos(a) * 10, Math.sin(a) * 8);
      ctx.stroke();
    }
    ctx.restore();
    // Highlight
    ctx.beginPath();
    ctx.ellipse(6, -3, 2, 1.2, -0.5, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.55)'; ctx.fill();
  }

  // Per-canvas animation state for the wind serpent. WeakMap so the game's
  // main canvas and each hangar preview canvas keep independent state.
  const wsStateMap = new WeakMap();

  function drawShipWindSerpent(ctx, t, speed, facingLeft = false) {
    // Profile view. Turning is animated as: bunch up onto the head,
    // invisibly flip facing while bunched, then extend out in the new
    // direction. Preserves "up" (horn + eye stay on top) throughout.
    const segs = 7;
    const segLen = 4.2;
    const amp = 3.2;
    const target = facingLeft ? Math.PI : 0;

    let st = wsStateMap.get(ctx);
    if (!st) {
      st = { facing: target, bunch: 0, lastT: t };
      wsStateMap.set(ctx, st);
    }
    const dt = Math.min(0.1, Math.max(0, t - st.lastT));
    st.lastT = t;

    // Animation: target reached when bunch goes 0 → 1 → 0.
    // bunchRate = 2.0 → ~0.5s bunch + ~0.5s extend = ~1.0s total turn.
    const bunchRate = 2.0;
    if (st.facing !== target) {
      st.bunch += bunchRate * dt;
      if (st.bunch >= 1) { st.bunch = 1; st.facing = target; }
    } else if (st.bunch > 0) {
      st.bunch -= bunchRate * dt;
      if (st.bunch < 0) st.bunch = 0;
    }

    const bunch = st.bunch;
    const facing = st.facing;           // 0 (right) or π (left), no in-between
    const trailAng = facing + Math.PI;  // body extends opposite of facing

    // While bunching, segment length shrinks and wiggle dampens. A small
    // per-segment coil rotation makes the body curl as it compresses.
    const effSegLen = segLen * (1 - bunch * 0.92);
    const effAmp = amp * (1 - bunch * 0.6);
    const coilAmount = bunch * Math.PI * 0.5;
    const coilSign = facing === 0 ? -1 : 1;

    const wigRate = 2.6 + speed * 1;
    const points = [];
    let x = 0, y = 0;
    for (let i = 0; i < segs; i++) {
      const along = i / (segs - 1);
      const segTrail = trailAng + coilSign * coilAmount * along;
      const wig = Math.sin(t * wigRate - i * 0.9) * effAmp * along;
      const perpX = -Math.sin(segTrail);
      const perpY =  Math.cos(segTrail);
      points.push({ x: x + perpX * wig, y: y + perpY * wig, r: 4.6 - along * 3.6 });
      x += effSegLen * Math.cos(segTrail);
      y += effSegLen * Math.sin(segTrail);
    }

    // Center on COM so the head doesn't drift relative to the camera.
    let cmx = 0, cmy = 0;
    for (const p of points) { cmx += p.x; cmy += p.y; }
    cmx /= segs; cmy /= segs;
    for (const p of points) { p.x -= cmx; p.y -= cmy; }

    // Body — tail first so head draws on top.
    ctx.strokeStyle = '#2a2417'; ctx.lineWidth = 0.8;
    for (let i = segs - 1; i >= 1; i--) {
      const p = points[i];
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = '#8a4eb0'; ctx.fill();
      ctx.stroke();
    }

    // Head + winglets — flipped along x for left-facing, never rotated, so
    // the horn and eye stay on top.
    const head = points[0];
    ctx.save();
    ctx.translate(head.x, head.y);
    if (facing === Math.PI) ctx.scale(-1, 1);
    const wingFlap = Math.sin(t * (5.5 + speed * 1.5)) * 0.45;
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(1, side);
      ctx.rotate(-0.35 + wingFlap);
      ctx.beginPath();
      ctx.moveTo(-2, 0);
      ctx.quadraticCurveTo(-5, -9, -12, -7);
      ctx.quadraticCurveTo(-7, -3, -3, -1);
      ctx.closePath();
      ctx.fillStyle = '#b07cd0'; ctx.fill(); ctx.stroke();
      ctx.restore();
    }
    ctx.beginPath();
    ctx.moveTo(5, 0);
    ctx.quadraticCurveTo(3, -4, -3, -3);
    ctx.lineTo(-3, 3);
    ctx.quadraticCurveTo(3, 4, 5, 0);
    ctx.closePath();
    ctx.fillStyle = '#8a4eb0'; ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-1, -3); ctx.lineTo(-3, -6); ctx.lineTo(0, -4);
    ctx.closePath();
    ctx.fillStyle = '#f2e8d0'; ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.arc(1.5, -1, 0.8, 0, Math.PI * 2);
    ctx.fillStyle = '#f2e8d0'; ctx.fill();
    ctx.beginPath();
    ctx.arc(2, -1, 0.4, 0, Math.PI * 2);
    ctx.fillStyle = '#2a2417'; ctx.fill();
    ctx.restore();
  }

  function drawShipWyvern(ctx, t, speed) {
    const flap = Math.sin(t * 2.8);
    const tailSwish = Math.sin(t * 1.9 + 0.5);
    const bodyFill = '#7a4a9a', bodyDark = '#54306a';

    // Far wing (behind)
    ctx.save();
    ctx.translate(-1, -1);
    ctx.rotate(-1.2 + flap * 0.35);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(-1, -10);
    ctx.quadraticCurveTo(-5, -8, -7, -5);
    ctx.quadraticCurveTo(-8, -3, -7, -1);
    ctx.quadraticCurveTo(-3, -0.5, 0, 0);
    ctx.closePath();
    ctx.fillStyle = bodyDark; ctx.fill();
    ctx.strokeStyle = '#2a2417'; ctx.lineWidth = 0.6; ctx.stroke();
    ctx.restore();

    // Tail
    ctx.strokeStyle = '#2a2417'; ctx.lineWidth = 0.8;
    ctx.beginPath();
    ctx.moveTo(-5, 0);
    ctx.quadraticCurveTo(-12, tailSwish * 2, -17, tailSwish * 4);
    ctx.quadraticCurveTo(-12, tailSwish * 2 + 0.8, -5, 1);
    ctx.closePath();
    ctx.fillStyle = bodyFill; ctx.fill(); ctx.stroke();
    ctx.save();
    ctx.translate(-17, tailSwish * 4);
    ctx.rotate(tailSwish * 0.4 + Math.PI);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(2.5, -1.8); ctx.lineTo(1.5, 0); ctx.lineTo(2.5, 1.8);
    ctx.closePath();
    ctx.fillStyle = bodyFill; ctx.fill(); ctx.stroke();
    ctx.restore();

    // Body
    ctx.beginPath(); ctx.ellipse(-1, 0, 6, 3, 0, 0, Math.PI * 2);
    ctx.fillStyle = bodyFill; ctx.fill();
    ctx.lineWidth = 1; ctx.stroke();

    // Legs
    ctx.beginPath();
    ctx.moveTo(-1, 2); ctx.lineTo(0, 6); ctx.lineTo(2, 6);
    ctx.lineWidth = 1.4; ctx.stroke();
    ctx.lineWidth = 0.5;
    ctx.beginPath();
    ctx.moveTo(0, 6); ctx.lineTo(-1, 6.8);
    ctx.moveTo(1, 6); ctx.lineTo(1, 6.8);
    ctx.moveTo(2, 6); ctx.lineTo(3, 6.8);
    ctx.stroke();

    // Neck
    ctx.beginPath();
    ctx.moveTo(4, -1); ctx.quadraticCurveTo(8, -5, 11, -4);
    ctx.lineTo(11, -1); ctx.quadraticCurveTo(8, 0.5, 4, 1.5);
    ctx.closePath();
    ctx.fillStyle = bodyFill; ctx.fill();
    ctx.lineWidth = 0.9; ctx.stroke();

    // Head
    ctx.save();
    ctx.translate(11, -3);
    ctx.beginPath();
    ctx.moveTo(0, -1); ctx.lineTo(5, 0); ctx.lineTo(5, 2); ctx.lineTo(0, 2.5);
    ctx.quadraticCurveTo(-1.5, 0.7, 0, -1);
    ctx.closePath();
    ctx.fillStyle = bodyFill; ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, -0.8); ctx.lineTo(-2, -3.5); ctx.lineTo(1.5, -1.5);
    ctx.closePath();
    ctx.fillStyle = '#f2e8d0'; ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.arc(2, 0.5, 0.7, 0, Math.PI * 2);
    ctx.fillStyle = '#f5d040'; ctx.fill();
    ctx.beginPath(); ctx.arc(2.3, 0.5, 0.3, 0, Math.PI * 2);
    ctx.fillStyle = '#2a2417'; ctx.fill();
    ctx.beginPath(); ctx.arc(4.5, 1.4, 0.3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    // Near wing (in front)
    ctx.save();
    ctx.translate(1, -1);
    ctx.rotate(-1.0 - flap * 0.35);
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(0, -12);
    ctx.quadraticCurveTo(-5, -9, -7, -6);
    ctx.quadraticCurveTo(-9, -3, -8, -1);
    ctx.quadraticCurveTo(-4, -0.5, 0, 0);
    ctx.closePath();
    ctx.fillStyle = bodyFill; ctx.fill();
    ctx.strokeStyle = '#2a2417'; ctx.lineWidth = 0.8; ctx.stroke();
    ctx.strokeStyle = 'rgba(42,36,23,0.55)'; ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(0, 0); ctx.lineTo(0, -12);
    ctx.moveTo(0, 0); ctx.lineTo(-7, -6);
    ctx.moveTo(0, 0); ctx.lineTo(-8, -1);
    ctx.stroke();
    ctx.restore();
  }

  function drawShipCloudGalleon(ctx, t, speed) {
    const w = 9;
    // Cloud
    ctx.fillStyle = '#ffffff';
    ctx.strokeStyle = 'rgba(80, 110, 140, 0.55)';
    ctx.lineWidth = 0.6;
    ctx.beginPath();
    ctx.arc(-5, 6.5, 3, 0, Math.PI * 2);
    ctx.arc(0, 7, 3.6, 0, Math.PI * 2);
    ctx.arc(5, 6.5, 3, 0, Math.PI * 2);
    ctx.fill(); ctx.stroke();
    ctx.save();
    ctx.globalAlpha = 0.18; ctx.fillStyle = '#5a6a7c';
    ctx.beginPath(); ctx.ellipse(0, 10, 7, 1.2, 0, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // Bowl hull
    ctx.beginPath();
    ctx.moveTo(-w, -2.8); ctx.lineTo(-w, 0.8);
    ctx.quadraticCurveTo(-w * 0.6, 4.4, 0, 4.6);
    ctx.quadraticCurveTo(w * 0.6, 4.4, w * 0.85, 1.2);
    ctx.lineTo(w * 1.15, -1.6); ctx.lineTo(-w, -2.8);
    ctx.closePath();
    ctx.fillStyle = '#a06030'; ctx.fill();
    ctx.strokeStyle = '#2a2417'; ctx.lineWidth = 1; ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-w, -2.8); ctx.lineTo(w * 0.7, -2.8);
    ctx.lineWidth = 0.7; ctx.stroke();
    ctx.strokeStyle = 'rgba(42,36,23,0.35)'; ctx.lineWidth = 0.4;
    ctx.beginPath();
    ctx.moveTo(-w + 0.6, 0); ctx.quadraticCurveTo(0, 2.8, w * 0.85, 0);
    ctx.stroke();

    // Mast + sail
    ctx.strokeStyle = '#2a2417'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(0, -2.8); ctx.lineTo(0, -11); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-3, -10); ctx.lineTo(3, -10);
    ctx.lineTo(3, -3.5); ctx.lineTo(-3, -3.5);
    ctx.closePath();
    ctx.fillStyle = '#f2e8d0'; ctx.fill();
    ctx.lineWidth = 0.6; ctx.stroke();

    // Crow's nest
    ctx.beginPath(); ctx.rect(-2.2, -13, 4.4, 2);
    ctx.fillStyle = '#a06030'; ctx.fill();
    ctx.strokeStyle = '#2a2417'; ctx.lineWidth = 0.5; ctx.stroke();
    for (const dx of [-2, -1, 0, 1, 2]) {
      ctx.beginPath();
      ctx.moveTo(dx, -13); ctx.lineTo(dx, -14.6);
      ctx.stroke();
    }

    // Big flapping wings
    const flapRate = 4 + speed * 2;
    const flap = 0.3 + 0.7 * (0.5 + 0.5 * Math.sin(t * flapRate));
    for (const side of [-1, 1]) {
      ctx.save();
      ctx.scale(1, side);
      ctx.translate(-2, -1);
      ctx.scale(1, flap);
      ctx.beginPath();
      ctx.moveTo(0, 0);
      ctx.bezierCurveTo(2, -10, -8, -14, -10, -6);
      ctx.bezierCurveTo(-6, -3, -2, -1, 0, 0);
      ctx.closePath();
      ctx.fillStyle = '#f0e0c0'; ctx.fill();
      ctx.strokeStyle = '#2a2417'; ctx.lineWidth = 0.6; ctx.stroke();
      ctx.strokeStyle = 'rgba(42,36,23,0.4)'; ctx.lineWidth = 0.4;
      ctx.beginPath();
      ctx.moveTo(0, 0); ctx.lineTo(-6, -8);
      ctx.moveTo(0, 0); ctx.lineTo(-10, -6);
      ctx.stroke();
      ctx.restore();
    }
  }

  window.SkyboundShips = {
    DRAWERS: {
      sloop:        drawShipSloop,
      butterfly:    drawShipButterfly,
      seaTurtle:    drawShipSeaTurtle,
      manta:        drawShipManta,
      jellyfish:    drawShipJellyfish,
      wyvern:       drawShipWyvern,
      cloudGalleon: drawShipCloudGalleon,
      windSerpent:  drawShipWindSerpent,
    },
    VIEWS: {
      sloop: 'topdown', butterfly: 'topdown', seaTurtle: 'topdown',
      manta: 'topdown', jellyfish: 'topdown',
      wyvern: 'profile', cloudGalleon: 'profile', windSerpent: 'profile',
    },
    // Profile ships that animate their own facing transition (instead of an
    // instant flip-x in the caller). They receive facingLeft as the 4th arg.
    OWN_FACING: { windSerpent: true },
    CATALOG: [
      { id: 'sloop',        name: 'Sloop' },
      { id: 'butterfly',    name: 'Butterfly' },
      { id: 'seaTurtle',    name: 'Sea turtle' },
      { id: 'manta',        name: 'Manta ray' },
      { id: 'jellyfish',    name: 'Jellyfish' },
      { id: 'wyvern',       name: 'Wyvern' },
      { id: 'cloudGalleon', name: 'Cloud galleon' },
      { id: 'windSerpent',  name: 'Wind serpent' },
    ],
  };
})();
