// Minimal 2D-canvas shim for JSDOM. The real canvas isn't available in the
// sandbox (no Chromium, no native `canvas` module), so we no-op every draw
// call. This is sufficient because the game's logic (positions, stamps,
// state) is decoupled from what actually gets rendered; the tests assert
// against state, not pixels.
//
// Caveats this implies for perf measurements: drawing cost (gradients, fills)
// is zero here. Microbenchmarks measure JS overhead only — see notes in
// test/perf.bench.js.

function makeGradient() {
  return { addColorStop() {} };
}

function makeCtx(canvas) {
  const ctx = {
    canvas,
    globalCompositeOperation: 'source-over',
    globalAlpha: 1,
    fillStyle: '#000',
    strokeStyle: '#000',
    lineWidth: 1,
    lineCap: 'butt',
    lineJoin: 'miter',
    font: '10px sans-serif',
    textBaseline: 'alphabetic',
    textAlign: 'start',
    shadowColor: 'transparent',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
    imageSmoothingEnabled: true,
    filter: 'none',
    save() {}, restore() {},
    translate() {}, rotate() {}, scale() {},
    setTransform() {}, resetTransform() {}, transform() {},
    fillRect() {}, clearRect() {}, strokeRect() {},
    beginPath() {}, closePath() {},
    moveTo() {}, lineTo() {},
    arc() {}, ellipse() {}, rect() {},
    quadraticCurveTo() {}, bezierCurveTo() {},
    fill() {}, stroke() {}, clip() {},
    fillText() {}, strokeText() {},
    measureText(s) { return { width: (s ? String(s).length : 0) * 6 }; },
    createLinearGradient: makeGradient,
    createRadialGradient: makeGradient,
    createPattern() { return null; },
    drawImage() {},
    getImageData(x, y, w, h) {
      return { data: new Uint8ClampedArray(Math.max(0, w * h * 4)), width: w, height: h };
    },
    putImageData() {},
    createImageData(w, h) {
      return { data: new Uint8ClampedArray(w * h * 4), width: w, height: h };
    },
    setLineDash() {},
    getLineDash() { return []; },
    isPointInPath() { return false; },
  };
  return ctx;
}

export function installCanvasShim(window) {
  const HTMLCanvasElement = window.HTMLCanvasElement;
  HTMLCanvasElement.prototype.getContext = function () {
    if (!this.__shimCtx) this.__shimCtx = makeCtx(this);
    return this.__shimCtx;
  };
  // The game's canvases use CSS `width:100%;height:100%` to fill their
  // container, which in a real browser yields a getBoundingClientRect equal
  // to the viewport. JSDOM has no layout engine, so we approximate by
  // returning the window's inner dimensions for every canvas — close enough
  // for the tests, and matches the production sizing path through resize().
  HTMLCanvasElement.prototype.getBoundingClientRect = function () {
    const win = this.ownerDocument && this.ownerDocument.defaultView;
    const w = win ? win.innerWidth : this.width;
    const h = win ? win.innerHeight : this.height;
    return { left: 0, top: 0, right: w, bottom: h, width: w, height: h, x: 0, y: 0 };
  };
}
