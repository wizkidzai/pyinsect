'use strict';

/* PyInsect Data Collector
 * Step 1: Start   — the only button
 * Step 2: capture — a burst of PHOTO_TARGET photos (50) in INTERVAL seconds (8) while the turntable
 *         (ESP32-C3 over USB serial) spins continuously and the lighting changes automatically
 * Step 3: send    — the photos are zipped and sent to the computer by themselves
 */

const $ = (sel) => document.querySelector(sel);

const PHOTO_TARGET = 50;      // photos per dataset
const INTERVAL = 8;           // seconds the whole burst takes
const STROBE_MS = 200;        // flashlight stays on this long, then off this long
const INSECT_NAME = 'insect'; // names the files and folder
const MAX_ENCODING = 24;      // photos allowed to wait for JPEG encoding at once (limits phone memory)
const WARMUP_MS = 3000;       // time to put the bug in the ring, and for the camera to focus

// Lighting changes automatically through many levels during the burst.
// ev = exposure compensation (hardware, if the camera supports it); soft = software fallback
// (negative = darker, positive = brighter) used when the camera has no exposure control.
const CAMERA_LIGHTS = [
  { id: 'normal',      label: 'Normal',          ev: 0,    soft: 0 },
  { id: 'dim',         label: 'Dim',             ev: -1,   soft: -0.35 },
  { id: 'dark',        label: 'Dark',            ev: -2,   soft: -0.6 },
  { id: 'bright',      label: 'Bright',          ev: 1,    soft: 0.25 },
  { id: 'verybright',  label: 'Very bright',     ev: 2,    soft: 0.5 },
];
// The flashlight strobes on, off, on, off... through the whole burst, on top of the levels above,
// so every angle and every level gets photos both with and without the flashlight.
// No flashlight (laptop webcam / front camera): the screen glows in different colours and levels.
const SCREEN_LIGHTS = [
  { id: 'white',  label: 'Screen white',  screen: '#ffffff' },
  { id: 'warm',   label: 'Screen warm',   screen: '#ffb867' },
  { id: 'cool',   label: 'Screen cool',   screen: '#8fc2ff' },
  { id: 'dim',    label: 'Screen dim',    screen: '#707070' },
  { id: 'dark',   label: 'Screen dark',   screen: '#242424' },
  { id: 'room',   label: 'Room light',    screen: '#000000' },
];
// After a light change, the camera needs a few frames before the new light shows up in them.
// Photos taken in that gap are labelled "changing" rather than guessed. Counted in real camera
// frames (so it's right at 30 and 60 fps); the ms values are the fallback without frame timing.
const LEVEL_SETTLE_FRAMES = 5, LIGHT_SETTLE_MS = 150;  // new exposure level (or screen colour)
const TORCH_SETTLE_FRAMES = 2, TORCH_SETTLE_MS = 70;   // flashlight on/off only
const state = {
  photos: [],          // { blob, angle, light, flash (0 or 100 %), time }
  stream: null,
  track: null,
  caps: {},
  abort: false,
  running: false,
  wakeLock: null,
  zipBlob: null,
};

/* ------------------------------------------------------------------ */
/* Small helpers                                                       */
/* ------------------------------------------------------------------ */
function show(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.toggle('active', s.id === `screen-${name}`));
  window.scrollTo(0, 0);
}

let toastTimer;
function toast(msg, ms = 3500) {
  const t = $('#toast');
  t.textContent = msg;
  t.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.classList.remove('show'), ms);
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

// Wait `ms`, calling onTick(secondsLeft) and stopping early if the user pressed Stop.
async function wait(ms, onTick) {
  const end = performance.now() + ms;
  while (!state.abort) {
    const left = end - performance.now();
    if (left <= 0) break;
    if (onTick) onTick(Math.ceil(left / 1000));
    await sleep(Math.min(100, left));
  }
}

const fmtStrobe = (ms) => `${+(ms / 1000).toFixed(2)} s`;   // 200 -> "0.2 s", 150 -> "0.15 s"

function fmtDuration(sec) {
  sec = Math.round(sec);
  const h = Math.floor(sec / 3600), m = Math.floor((sec % 3600) / 60), s = sec % 60;
  if (h) return `${h} h ${m} min`;
  return m ? `${m} min${s ? ` ${s} s` : ''}` : `${s} s`;
}

/* ------------------------------------------------------------------ */
/* Turntable over USB serial (Web Serial API, 115200 baud)             */
/* Each command is one line and gets exactly one reply line.           */
/*   R<deg>  rotate (reply when the move finishes)  -> "OK R"          */
/*   S       stop                                    -> "OK S"         */
/*   C<ms>   set ms per full spin                    -> "OK C"         */
/*   V<us>   set speed (signed)                      -> "OK V"         */
/*   T<us>   set stop trim                           -> "OK T"         */
/*   ?       status                    -> "ms=6000 v=100 t=0"          */
/* Lines starting with "#" are log messages and are ignored.           */
/* ------------------------------------------------------------------ */
/* ------------------------------------------------------------------ */
/* WebUSB serial: lets Chrome on Android phones talk to the ESP32.     */
/* Phones have no Web Serial, so this looks like a serial port         */
/* (open / readable / writable / close) but uses USB CDC directly.     */
/* ------------------------------------------------------------------ */
class UsbSerialPort {
  constructor(device) {
    this.device = device;
    this.readable = null;
    this.writable = null;
    this.ctrlIf = null; this.dataIf = null; this.inEp = null; this.outEp = null;
    this.closed = false;
  }

  async open({ baudRate = 115200 } = {}) {
    const d = this.device;
    await d.open();
    if (!d.configuration) await d.selectConfiguration(1);
    // Find the CDC data interface (class 0x0A) with a bulk IN and bulk OUT endpoint.
    for (const iface of d.configuration.interfaces) {
      const alt = iface.alternates.find(a => a.interfaceClass === 0x0a);
      if (!alt) continue;
      const inEp = alt.endpoints.find(e => e.direction === 'in' && e.type === 'bulk');
      const outEp = alt.endpoints.find(e => e.direction === 'out' && e.type === 'bulk');
      if (inEp && outEp) { this.dataIf = iface.interfaceNumber; this.inEp = inEp.endpointNumber; this.outEp = outEp.endpointNumber; }
    }
    const comm = d.configuration.interfaces.find(i => i.alternates.some(a => a.interfaceClass === 0x02));
    this.ctrlIf = comm ? comm.interfaceNumber : null;
    if (this.dataIf === null) {
      await d.close().catch(() => {});
      const e = new Error('That USB device is not the ESP32 turntable. Pick the entry for the ESP32 (often "USB JTAG/serial debug unit").'); e.name = 'NetworkError'; throw e;
    }
    try {
      if (this.ctrlIf !== null) await d.claimInterface(this.ctrlIf);
      await d.claimInterface(this.dataIf);
    } catch (err) {
      await d.close().catch(() => {});
      const e = new Error(err.message); e.name = 'NetworkError'; throw e;
    }
    if (this.ctrlIf !== null) {
      // Line coding (baud rate, 8N1) and DTR+RTS on, like a normal serial terminal.
      const lc = new DataView(new ArrayBuffer(7));
      lc.setUint32(0, baudRate, true); lc.setUint8(4, 0); lc.setUint8(5, 0); lc.setUint8(6, 8);
      try {
        await d.controlTransferOut({ requestType: 'class', recipient: 'interface', request: 0x20, value: 0, index: this.ctrlIf }, lc.buffer);
        await d.controlTransferOut({ requestType: 'class', recipient: 'interface', request: 0x22, value: 0x03, index: this.ctrlIf });
      } catch (_) { /* some boards don't need it */ }
    }
    this.closed = false;
    this.readable = new ReadableStream({
      pull: async (controller) => {
        try {
          const r = await d.transferIn(this.inEp, 512);
          if (r.status === 'stall') await d.clearHalt('in', this.inEp);
          else if (r.data && r.data.byteLength) controller.enqueue(new Uint8Array(r.data.buffer, r.data.byteOffset, r.data.byteLength));
        } catch (err) {
          if (this.closed) controller.close(); else controller.error(err);
        }
      },
      cancel: () => { this.closed = true; },
    });
    this.writable = new WritableStream({
      write: async (chunk) => { await d.transferOut(this.outEp, chunk); },
    });
  }

  async close() {
    this.closed = true;
    const d = this.device;
    try { if (this.ctrlIf !== null) await d.controlTransferOut({ requestType: 'class', recipient: 'interface', request: 0x22, value: 0, index: this.ctrlIf }); } catch (_) {}
    try { await d.releaseInterface(this.dataIf); } catch (_) {}
    try { if (this.ctrlIf !== null) await d.releaseInterface(this.ctrlIf); } catch (_) {}
    try { await d.close(); } catch (_) {}
  }
}

class Turntable {
  constructor() {
    this.port = null;
    this.writer = null;
    this.reader = null;
    this.readDone = null;
    this.waiters = [];
    this.info = { ms: 6000, v: 250, t: 0 };
    this.moving = false;
    this.onchange = () => {};
  }

  get connected() { return !!(this.port && this.writer); }

  // Web Serial on computers; WebUSB on Android phones. Newer Chrome on Android
  // has navigator.serial, but its picker does not list USB boards like the ESP32,
  // so Android always uses WebUSB when it is available.
  static get supported() { return 'serial' in navigator || 'usb' in navigator; }
  static get useWebSerial() {
    const android = /Android/i.test(navigator.userAgent);
    return 'serial' in navigator && !(android && 'usb' in navigator);
  }

  // Reconnect to a port the user already allowed, without showing the picker.
  async autoConnect() {
    if (!Turntable.supported) return false;
    let ports = [];
    try {
      if (Turntable.useWebSerial) ports = await navigator.serial.getPorts();
      else ports = (await navigator.usb.getDevices()).map(d => new UsbSerialPort(d));
    } catch (_) {}
    for (const port of ports) {
      try { await this.connect(port); return true; } catch (_) { await this._cleanup(); }
    }
    return false;
  }

  async connect(port) {
    if (!Turntable.supported) {
      throw new Error('This browser cannot use USB. Use Chrome on a computer or an Android phone.');
    }
    if (this.connected) return;
    if (!port) {
      if (Turntable.useWebSerial) port = await navigator.serial.requestPort();
      else port = new UsbSerialPort(await navigator.usb.requestDevice({ filters: [] }));
    }
    try {
      await port.open({ baudRate: 115200 });
    } catch (err) {
      if (['NetworkError', 'InvalidStateError', 'NotReadableError'].includes(err.name)) {
        throw new Error('Could not open the serial port. Close Arduino Serial Monitor/Plotter, other serial tools, and other PyInsect tabs, then reconnect. On a phone, use a USB-C to USB-C cable and unplug/replug the board if it was already connected.');
      }
      throw err;
    }
    this.port = port;
    this.writer = port.writable.getWriter();
    this.readDone = this._readLoop(port);
    this.onchange();

    // The board may still be booting or printing log lines — try a few times.
    await sleep(300);
    let lastErr;
    for (let i = 0; i < 4; i++) {
      try {
        await this.refresh();
        const speedMigrationKey = 'pyinsect-speed-v250-applied';
        let speedMigrationApplied = false;
        try { speedMigrationApplied = localStorage.getItem(speedMigrationKey) === '1'; } catch (_) {}
        if (!speedMigrationApplied) {
          if (this.info.v === 500) {
            await this.command('V250');
            await this.refresh();
          }
          try { localStorage.setItem(speedMigrationKey, '1'); } catch (_) {}
        }
        return;
      } catch (err) { lastErr = err; }
    }
    await this.disconnect();
    throw new Error(`No answer from the turntable on that port. Is the PyInsect firmware uploaded? (${lastErr.message})`);
  }

  async _readLoop(port) {
    let buf = '';
    const decoder = new TextDecoder();
    try {
      this.reader = port.readable.getReader();
      while (true) {
        const { value, done } = await this.reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        let nl;
        while ((nl = buf.search(/[\r\n]/)) >= 0) {
          const line = buf.slice(0, nl).trim();
          buf = buf.slice(nl + 1);
          if (line && !line.startsWith('#')) this._onMessage(line);
        }
      }
    } catch (_) {
      // device unplugged or port closed
    } finally {
      try { this.reader.releaseLock(); } catch (_) {}
      this.reader = null;
      if (this.port === port) {
        await this._cleanup();
        this.onchange();
      }
    }
  }

  async _cleanup() {
    const port = this.port;
    this.port = null;
    this._failAll(new Error('Turntable disconnected'));
    if (this.writer) { try { this.writer.releaseLock(); } catch (_) {} this.writer = null; }
    if (port) { try { await port.close(); } catch (_) {} }
  }

  async disconnect() {
    const port = this.port;
    if (!port) return;
    this.port = null;          // tell the read loop not to clean up again
    if (this.reader) { try { await this.reader.cancel(); } catch (_) {} }
    await this.readDone;
    this.port = port;
    await this._cleanup();
    this.onchange();
  }

  async refresh() {
    const reply = await this.command('?', 1500);
    for (const part of reply.split(/\s+/)) {
      const [k, v] = part.split('=');
      if (k in this.info && !isNaN(+v)) this.info[k] = +v;
    }
    this.onchange();
    return this.info;
  }

  _onMessage(msg) {
    const w = this.waiters.shift();
    if (!w) return;
    clearTimeout(w.timer);
    if (msg.startsWith('ERR')) w.reject(new Error(`Turntable: ${msg}`));
    else w.resolve(msg);
  }

  _failAll(err) {
    for (const w of this.waiters.splice(0)) { clearTimeout(w.timer); w.reject(err); }
  }

  command(cmd, timeoutMs = 4000) {
    if (!this.connected) return Promise.reject(new Error('Turntable not connected'));
    return new Promise((resolve, reject) => {
      const w = { resolve, reject };
      const drop = () => { const i = this.waiters.indexOf(w); if (i >= 0) this.waiters.splice(i, 1); };
      w.timer = setTimeout(() => { drop(); reject(new Error(`Turntable didn't answer "${cmd}"`)); }, timeoutMs);
      this.waiters.push(w);
      this.writer.write(new TextEncoder().encode(cmd + '\n')).catch(err => { drop(); clearTimeout(w.timer); reject(err); });
    });
  }

  // Spin continuously for `ms` milliseconds (reply when it stops).
  spinFor(ms) {
    return this._move(`D${Math.round(ms)}`, ms + 5000);
  }

  rotate(deg) {
    const d = Math.round(deg * 100) / 100;
    return this._move(`R${d}`, (this.info.ms * Math.abs(d)) / 360 + 5000);
  }

  async _move(cmd, timeoutMs) {
    if (this.moving) throw new Error('Turntable is already moving. Wait for it to stop or press Stop.');
    this.moving = true;
    this.onchange();
    try {
      return await this.command(cmd, timeoutMs);
    } finally {
      this.moving = false;
      this.onchange();
    }
  }

  stop() { return this.command('S').catch(() => {}); }
}

const turntable = new Turntable();

async function connectTurntable() {
  try {
    await turntable.connect();
    toast('Turntable connected');
    return true;
  } catch (err) {
    if (err.name !== 'NotFoundError') toast(err.message, 6000); // NotFoundError = picker closed
    return false;
  }
}

if (Turntable.supported) {
  const usbApi = Turntable.useWebSerial ? navigator.serial : navigator.usb;
  usbApi.addEventListener('connect', () => { if (!turntable.connected) turntable.autoConnect(); });
}

/* ------------------------------------------------------------------ */
/* Camera + automatic lighting                                         */
/* ------------------------------------------------------------------ */
async function startCamera() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw new Error('Camera not available. Open this page over https:// or localhost.');
  }
  stopCamera();
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 960 }, frameRate: { ideal: 60 } },
  });
  state.stream = stream;
  state.track = stream.getVideoTracks()[0];
  const video = $('#video');
  video.srcObject = stream;
  await video.play();
  const facing = (state.track.getSettings && state.track.getSettings().facingMode) || '';
  state.facingUser = facing === 'user';
  // Some phones only report flashlight support once frames are flowing, so look for up to 1.5 s.
  for (let i = 0; i < 6; i++) {
    await sleep(250);
    state.caps = state.track.getCapabilities ? state.track.getCapabilities() : {};
    if (state.caps.torch) break;
  }
  video.classList.toggle('mirror', state.facingUser);
}

function stopCamera() {
  if (state.stream) state.stream.getTracks().forEach(t => t.stop());
  state.stream = null;
  state.track = null;
  $('#video').srcObject = null;
}

// Sizes the preview so it shows exactly what the photos keep: a box with the photo's shape, as big
// as fits in the free space above the photo count (beside it in landscape) so the bug in the
// middle is never hidden under it.
function layoutPreview() {
  const cam = $('#screen-camera'), box = $('#preview'), video = $('#video');
  const r = $('.panel.run').getBoundingClientRect(), c = cam.getBoundingClientRect();
  if (!c.width || !c.height) return;   // camera screen not showing
  const side = r.width < c.width * 0.9;
  const ph = side ? 0 : Math.max(0, c.bottom - r.top), pw = side ? Math.max(0, c.right - r.left) : 0;
  cam.style.setProperty('--panel-h', `${ph}px`);
  cam.style.setProperty('--panel-w', `${pw}px`);
  const a = video.videoWidth > 16 && video.videoHeight > 16 ? video.videoWidth / video.videoHeight : 4 / 3;
  let w, h;
  if (cam.classList.contains('screenlight')) {   // small preview in the corner; CSS places it
    w = c.width * 0.3; h = w / a;
    box.style.left = box.style.top = '';
  } else {
    const W = c.width - pw, H = c.height - ph;
    if (W / H > a) { h = H; w = H * a; } else { w = W; h = W / a; }
    box.style.left = `${(W - w) / 2}px`;
    box.style.top = `${(H - h) / 2}px`;
  }
  box.style.width = `${w}px`;
  box.style.height = `${h}px`;
  video.style.width = `${w}px`;
  video.style.height = `${h}px`;
  video.style.left = video.style.top = '0';
}
if (window.ResizeObserver) new ResizeObserver(layoutPreview).observe($('.panel.run'));
window.addEventListener('resize', layoutPreview);
$('#video').addEventListener('resize', layoutPreview);   // the camera's picture size became known or changed

// Gives the browser a turn without waiting a whole timer tick (setTimeout(0) can take 4 ms or more).
function yieldNow() {
  return new Promise(resolve => { const c = new MessageChannel(); c.port1.onmessage = () => resolve(); c.port2.postMessage(0); });
}

function autoLights() {
  // Phones often report the flashlight only after frames start flowing — caps are re-read in startCamera.
  return state.caps.torch || state.caps.exposureCompensation || !state.facingUser ? CAMERA_LIGHTS : SCREEN_LIGHTS;
}

// Photos taken while the light is switching: the frame may show the old or the new light.
const CHANGING = { id: 'changing', label: 'Light changing' };

// The id and label saved with a photo, e.g. "dim_flash" / "Dim + flashlight".
function shotLight(light, torch) {
  return torch ? { id: `${light.id}_flash`, label: `${light.label} + flashlight` } : { id: light.id, label: light.label };
}

// Resolves once the hardware has been told to change. The software part is applied per photo.
async function applyLight(light, torch = false) {
  $('#light-overlay').style.background = (light && light.screen) || '#000';
  if (!state.track || (light && light.screen)) return;
  const adv = {};
  if (state.caps.torch) adv.torch = !!torch;
  if (state.caps.exposureCompensation) {
    const { min, max } = state.caps.exposureCompensation;
    adv.exposureCompensation = Math.max(min, Math.min(max, (light && light.ev) || 0));
  }
  if (Object.keys(adv).length) {
    try { await state.track.applyConstraints({ advanced: [adv] }); } catch (_) { /* best effort */ }
  }
}

// Software brightness, only for cameras with no exposure control, so the dataset still has dark/bright photos.
function softLevel(light) {
  return state.caps.exposureCompensation || light.screen ? 0 : (light.soft || 0);
}
function applySoft(ctx, w, h, level) {
  if (!level) return;
  ctx.fillStyle = level < 0 ? `rgba(0,0,0,${-level})` : `rgba(255,255,255,${level})`;
  ctx.fillRect(0, 0, w, h);
}

async function keepScreenOn(on) {
  try {
    if (on && state.wakeLock && !state.wakeLock.released) return;   // already held
    if (on && 'wakeLock' in navigator) state.wakeLock = await navigator.wakeLock.request('screen');
    else if (!on && state.wakeLock) { await state.wakeLock.release(); state.wakeLock = null; }
  } catch (_) {}
}

/* ------------------------------------------------------------------ */
/* Step 1: capture run                                                 */
/* ------------------------------------------------------------------ */
function hud(text) { $('#hud-sub').textContent = text; }
function hudProgress(done, total) {
  $('#hud-count').textContent = `Photos taken: ${done} / ${total}`;
  $('#hud-bar').style.width = `${total ? Math.min(100, (100 * done) / total) : 0}%`;
}

async function runCapture() {
  if (state.running) return;
  // Pressing the button is what lets the browser show the serial-port picker.
  if (!turntable.connected && Turntable.supported) await connectTurntable();
  let useTurntable = turntable.connected;
  if (!useTurntable && !confirm('The turntable is not connected.\n\nTake the photos anyway, without spinning?')) return;

  try { if (!document.fullscreenElement) await document.documentElement.requestFullscreen(); } catch (_) {}
  state.running = true;
  state.abort = false;
  clearPhotos();
  $('#screen-camera').classList.remove('screenlight');
  show('camera');
  hud('Starting camera…');
  hudProgress(0, PHOTO_TARGET);
  await keepScreenOn(true);

  let spun = 0;          // degrees the turntable turned during the burst
  let spin = null;       // promise for the continuous spin
  let lighting = null;   // promise for the loop that changes the light and strobes the flashlight
  let lightingDone = false;
  try {
    await startCamera();
    const lights = autoLights();
    $('#screen-camera').classList.toggle('screenlight', !!lights[0].screen);
    layoutPreview();
    await applyLight(lights[0]);
    await wait(WARMUP_MS, (s) => hud(`Put the bug in the ring… ${s}`));
    // The turntable cable may have come loose while the camera was starting.
    if (useTurntable && !turntable.connected) {
      await turntable.autoConnect();
      if (!turntable.connected) {
        if (!confirm('The turntable got disconnected.\n\nTake the photos anyway, without spinning?')) { state.abort = true; throw new Error('stopped'); }
        useTurntable = false;
      }
    }
    if (state.abort) throw new Error('stopped');

    const video = $('#video');
    // The camera can briefly report a tiny placeholder size (2×2) before real frames arrive.
    // Wait for the real size, or every photo would be a few pixels.
    for (let t = 0; video.videoWidth <= 16 && t < 60 && !state.abort; t++) await sleep(50);
    if (state.abort) throw new Error('stopped');
    if (video.videoWidth <= 16) throw new Error('The camera did not start properly. Please try again.');
    const durationMs = INTERVAL * 1000;
    const gapMs = durationMs / PHOTO_TARGET;        // 160 ms for 50 photos in 8 s
    const lightMs = durationMs / lights.length;     // each lighting gets an equal slice of the burst
    const strobe = !!state.caps.torch && !lights[0].screen;
    let shown = { light: lights[0], torch: false };  // the light the frames really show (photo labels)
    let pending = null;   // a light change the frames may not show yet: { want, readyFrame, readyAt }
    const hasFrameTiming = !!video.requestVideoFrameCallback;
    // Turns a pending change into the photo label once enough camera frames have arrived.
    const settle = () => {
      if (pending && (hasFrameTiming ? frames >= pending.readyFrame : performance.now() >= pending.readyAt)) {
        shown = pending.want;
        pending = null;
      }
    };

    // Count how many different frames the camera really delivers.
    let frames = 0, counting = true;
    if (hasFrameTiming) {
      const onFrame = () => { if (counting) { frames++; video.requestVideoFrameCallback(onFrame); } };
      video.requestVideoFrameCallback(onFrame);
    }

    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    const encoding = [];

    if (useTurntable) spin = turntable.spinFor(durationMs);
    const t0 = performance.now();

    // Runs beside the photo loop so the burst stays on time: one camera change at a time, on
    // schedule, never waiting for a change to show up before making the next one. The strobe runs on
    // its own clock: it doesn't depend on the number of photos, the burst time or the exposure levels.
    // From the moment a change is asked for until enough frames have arrived to show it, photos are
    // labelled "changing" — never with a light the frames might not show. An exposure change keeps
    // its longer wait even if the flashlight switches again meanwhile.
    lighting = (async () => {
      let cur = shown;   // what the camera was last told
      let levelReadyFrame = 0, levelReadyAt = 0;
      while (!lightingDone && !state.abort) {
        const elapsed = performance.now() - t0;
        const level = Math.min(lights.length - 1, Math.floor(elapsed / lightMs));
        const want = {
          light: lights[level],
          torch: strobe && Math.floor(elapsed / STROBE_MS) % 2 === 0,
        };
        if (want.light === cur.light && want.torch === cur.torch) { await sleep(2); continue; }
        const levelChange = want.light !== cur.light, torchChange = want.torch !== cur.torch;
        // A level change only needs time to show when the camera or screen does it; the software
        // brightness (cameras without exposure control) is applied to each photo directly.
        const visible = torchChange || (levelChange && (!!state.caps.exposureCompensation || !!want.light.screen));
        if (visible) pending = { want, readyFrame: Infinity, readyAt: Infinity };
        await applyLight(want.light, want.torch);
        cur = want;
        const now = performance.now();
        if (!visible) { if (!pending) shown = want; continue; }
        if (levelChange) { levelReadyFrame = frames + LEVEL_SETTLE_FRAMES; levelReadyAt = now + LIGHT_SETTLE_MS; }
        pending = { want, readyFrame: Math.max(levelReadyFrame, frames + TORCH_SETTLE_FRAMES), readyAt: Math.max(levelReadyAt, now + TORCH_SETTLE_MS) };
      }
    })();

    let encodingNow = 0;   // photos still being turned into JPEGs
    for (let i = 0; i < PHOTO_TARGET && !state.abort; i++) {
      const due = t0 + i * gapMs;
      const early = due - performance.now();
      // Always give the browser a turn, even when behind schedule, so the flashlight strobe,
      // the on-screen counter and the JPEG encoding keep running.
      await (early > 1 ? sleep(early) : yieldNow());
      // Too many photos waiting to be encoded uses a lot of phone memory: let them catch up.
      while (encodingNow >= MAX_ENCODING && !state.abort) await sleep(2);
      // The turntable spins for exactly the burst time. If the phone can't keep up, stop on time
      // with fewer photos rather than take photos after the spin with wrong angles.
      if (performance.now() - t0 > durationMs) break;

      const elapsed = performance.now() - t0;
      settle();
      const { light, torch } = shown;
      const shot = pending ? CHANGING : shotLight(light, torch);

      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      applySoft(ctx, canvas.width, canvas.height, softLevel(light));
      const angle = useTurntable ? Math.round(((elapsed / turntable.info.ms) * 360 % 360) * 10) / 10 : 0;
      const photo = { blob: null, angle, light: shot.id, flash: torch ? 100 : 0, time: new Date() };
      state.photos.push(photo);
      // toBlob copies the canvas now and encodes in the background, so the next photo isn't delayed.
      encodingNow++;
      encoding.push(new Promise(res => canvas.toBlob(b => {
        encodingNow--;
        if (b) photo.blob = b;
        res();
      }, 'image/jpeg', 0.85)));

      hudProgress(i + 1, PHOTO_TARGET);
      hud(`${Math.max(0, (durationMs - elapsed) / 1000).toFixed(1)} s left`);
    }
    const burstMs = performance.now() - t0;
    counting = false;
    hudProgress(state.photos.length, PHOTO_TARGET);
    hud('Saving photos…');
    lightingDone = true;
    await lighting;
    applyLight(null);

    await Promise.all(encoding);
    state.photos = state.photos.filter(p => p.blob);
    if (spin) {
      hud('Turntable finishing its spin…');
      await spin;
      spun = (durationMs / turntable.info.ms) * 360;
      const back = Math.ceil(spun / 360 - 1e-6) * 360 - spun;
      if (!state.abort && back > 0.5) {
        hud('Returning to start…');
        await turntable.rotate(back);
      }
    }
  } catch (err) {
    if (!state.abort) toast(err.message || String(err), 6000);
  } finally {
    if (spin) spin.catch(() => {});
    if (useTurntable && state.abort) await turntable.stop();
    lightingDone = true;
    if (lighting) await lighting.catch(() => {});
    await applyLight(null);   // flashlight off, after the strobe loop has stopped so it can't turn it back on
    stopCamera();
    try { if (document.fullscreenElement) await document.exitFullscreen(); } catch (_) {}
    await keepScreenOn(false);
    state.running = false;
  }

  if (state.photos.length && !state.abort) autoSend();
  else show('intro');
}

$('#capture').addEventListener('click', runCapture);
/* ------------------------------------------------------------------ */
/* Step 3: send to the computer, by itself                             */
/* ------------------------------------------------------------------ */
function cleanName(raw) {
  return raw.trim().replace(/\s+/g, '_').replace(/[^A-Za-z0-9_-]/g, '').slice(0, 60);
}

// yyyy_mm_dd_hh_mm_ss in the phone's local time
function stamp(d) {
  const p = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}_${p(d.getMonth() + 1)}_${p(d.getDate())}_${p(d.getHours())}_${p(d.getMinutes())}_${p(d.getSeconds())}`;
}
// Photo file: <insect_name>_top_nofilter_<flash_intensity_percentage>_<photo_serial_number>_yyyy_mm_dd_hh_mm_ss.jpg
// The flashlight is either on (100) or off (0). width = digits in the serial number, so 1000 photos still sort in order.
function fileNameFor(insect, p, i, width = Math.max(3, String(state.photos.length).length)) {
  const n = String(i + 1).padStart(width, '0');
  return `${insect}_top_nofilter_${p.flash}_${n}_${stamp(p.time)}.jpg`;
}
// Folder (and .zip): <insect_name>_yyyy_mm_dd_hh_mm_ss, the time of the first photo
function folderFor(insect, photos) {
  return `${insect}_${stamp(photos[0].time)}`;
}

async function buildZip() {
  if (typeof JSZip === 'undefined') throw new Error('Zip library failed to load. Open the app once with internet.');
  const folder = folderFor(INSECT_NAME, state.photos);
  if (state.zipBlob) return { blob: state.zipBlob, folder };
  const zip = new JSZip();
  const dir = zip.folder(folder);
  const rows = [['file', 'insect', 'angle_deg', 'lighting', 'flash_pct', 'captured_at']];
  state.photos.forEach((p, i) => {
    const name = fileNameFor(INSECT_NAME, p, i);
    dir.file(name, p.blob);
    rows.push([name, INSECT_NAME, p.angle, p.light, p.flash, p.time.toISOString()]);
  });
  dir.file('labels.csv', rows.map(r => r.join(',')).join('\n') + '\n');
  state.zipBlob = await zip.generateAsync({ type: 'blob', compression: 'STORE' });
  return { blob: state.zipBlob, folder };
}

function clearPhotos() {
  state.photos = [];
  state.zipBlob = null;
}

// The computer is looked for first over the USB cable (adb reverse), then on the hotspot or Wi-Fi.
// When this page itself comes from the computer (/collect/), the same address is used.
const USB_RIG = 'http://localhost:8100';
const saved = (k, d) => { try { return localStorage.getItem(k) || d; } catch (e) { return d; } };
const save = (k, v) => { try { localStorage.setItem(k, v); } catch (e) { /* private mode: fine */ } };

// The live site is https and the computer on the hotspot is http. Chrome allows that only for requests
// marked as going to the local network, after the person taps Allow.
const localFetch = (url, options = {}) =>
  fetch(url, /^http:\/\/(localhost|127\.)/.test(url) ? options : { ...options, targetAddressSpace: 'local' });

// "192.168.43.7:8090" -> "http://192.168.43.7:8090"
function hotspotBase() {
  const v = saved('pyinsect-hotspot-addr', '').replace(/^https?:\/\//, '').replace(/\/.*$/, '');
  if (!v) return null;
  return 'http://' + (/:\d+$/.test(v) ? v : `${v}:8090`);
}
// Only asks "does anything answer there?" (no-cors), so the computer needs no special permission settings for it.
async function reachable(base) {
  try {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 3000);
    await localFetch(`${base}/api/import`, { mode: 'no-cors', cache: 'no-store', signal: ctl.signal });
    clearTimeout(t);
    return true;
  } catch (e) { return false; }
}
// ---- Find the computers on the hotspot ----
// A web page can't read Wi-Fi names, so it looks at the network the phone is on: it asks the phone for its own
// address, then asks every address next to it whether a PyInsect computer answers on port 8090.
const RIG_PORT = 8090;
async function phoneSubnets() {
  const found = new Set();
  let stream = null;
  try { stream = await navigator.mediaDevices.getUserMedia({ video: true }); } catch (e) { /* no camera permission: fine */ }
  try {
    const pc = new RTCPeerConnection({ iceServers: [] });
    pc.createDataChannel('x');
    await new Promise(res => {
      const done = () => res();
      pc.onicecandidate = e => {
        if (!e.candidate) return done();
        const ip = (e.candidate.candidate.split(' ')[4] || '');
        const m = /^(\d{1,3}\.\d{1,3}\.\d{1,3})\.\d{1,3}$/.exec(ip);
        if (m && !ip.startsWith('127.')) found.add(m[1]);
      };
      pc.createOffer().then(o => pc.setLocalDescription(o)).catch(done);
      setTimeout(done, 2500);
    });
    pc.close();
  } catch (e) { /* use the guesses below */ }
  if (stream) stream.getTracks().forEach(t => t.stop());
  const last = saved('pyinsect-last-subnet', '');
  if (last) found.add(last);
  if (found.size <= 1) ['192.168.43', '192.168.49', '192.168.137', '192.168.0', '192.168.1', '172.20.10', '10.42.0'].forEach(s => found.add(s));
  return [...found];
}
async function whoIs(ip, ms = 1500) {
  try {
    const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), ms);
    const r = await localFetch(`http://${ip}:${RIG_PORT}/api/whoami`, { signal: ctl.signal });
    clearTimeout(t);
    const j = await r.json();
    return j && j.app === 'pyinsect-rig' ? { ip, name: j.name || ip } : null;
  } catch (e) { return null; }
}
// While Chrome is asking "Allow local network?", a quick search would give up before the answer.
// So the first time, make one patient request and wait for the person to choose.
async function askLocalNetwork(ip) {
  try {
    const p = await navigator.permissions.query({ name: 'local-network-access' });
    if (p.state === 'prompt') await whoIs(ip, 30000);
  } catch (e) { /* this browser doesn't ask */ }
}
async function scanForComputers(onProgress) {
  const subnets = await phoneSubnets(), ips = [];
  for (const s of subnets) for (let i = 1; i < 255; i++) ips.push(`${s}.${i}`);
  const found = [];
  let next = 0, done = 0;
  const worker = async () => {
    while (next < ips.length && !found.length) {   // stop at the first computer that answers
      const ip = ips[next++];
      const r = await whoIs(ip);
      if (r) found.push(r);
      onProgress && onProgress(++done, ips.length, subnets);
    }
  };
  await Promise.all(Array.from({ length: 48 }, worker));
  return found.slice(0, 1);
}

// One box per computer, with a tick on the one the photos go to.
function showComputer(name) {
  const b = document.createElement('div');
  b.className = 'computer';
  b.textContent = `✓ ${name}`;
  $('#rig-list').replaceChildren(b);
}

// Returns the address to send to, or null when no computer answers.
async function findRig() {
  if (location.pathname.startsWith('/collect')) { showComputer('This computer'); return ''; }
  if (await reachable(USB_RIG)) { showComputer('Computer on the USB cable'); return USB_RIG; }
  const last = hotspotBase();
  if (last && await reachable(last)) { showComputer(saved('pyinsect-computer-name', 'Computer')); return last; }
  await askLocalNetwork((saved('pyinsect-last-subnet', '') || '192.168.43') + '.1');
  const [c] = await scanForComputers((d, n) => { if (d % 16 === 0) $('#save-status').textContent = `Looking for computers… ${Math.round(100 * d / n)}%`; });
  if (!c) return null;
  save('pyinsect-hotspot-addr', `${c.ip}:${RIG_PORT}`);
  save('pyinsect-computer-name', c.name);
  save('pyinsect-last-subnet', c.ip.replace(/\.\d+$/, ''));
  showComputer(c.name);
  return `http://${c.ip}:${RIG_PORT}`;
}

const RETRY_MS = 5000;     // wait between tries when no computer answers
const DONE_MS = 4000;      // how long "Sent" stays before going back to Start
let sendRun = 0;           // changes when this send is over, so an old loop stops

function finishSend() {
  sendRun++;
  keepScreenOn(false);
  clearPhotos();
  show('intro');
}

async function autoSend() {
  const run = ++sendRun;
  $('#send-title').textContent = 'Sending';
  $('#send-pill').textContent = 'Auto sends';
  $('#rig-list').replaceChildren();
  $('#save-status').textContent = 'Packing photos…';
  $('#save-zip').hidden = true;
  show('send');
  await keepScreenOn(true);
  while (run === sendRun) {
    try {
      const { blob, folder } = await buildZip();
      $('#save-status').textContent = 'Looking for computers…';
      const base = await findRig();
      if (run !== sendRun) return;
      if (base === null) throw new Error('No computer found. Plug in the USB cable, or put the phone and computer on the same hotspot.');
      $('#save-status').textContent = 'Sending the photos…';
      const res = await localFetch(`${base}/api/import?name=${INSECT_NAME}&filename=${encodeURIComponent(folder)}.zip`,
        { method: 'POST', body: blob });
      const j = await res.json().catch(() => ({ error: `The computer answered ${res.status} but it is not the Training Rig.` }));
      if (!res.ok) throw new Error(j.error || 'The computer refused the photos.');
      if (run !== sendRun) return;
      const n = Object.values(j.added || {}).reduce((x, y) => x + y, 0);
      $('#send-title').textContent = 'Sent';
      $('#send-pill').textContent = '✓ Sent';
      $('#save-status').textContent = `${n} photos are on the computer.`;
      $('#save-zip').hidden = true;
      await sleep(DONE_MS);
      if (run === sendRun) finishSend();
      return;
    } catch (err) {
      if (run !== sendRun) return;
      $('#rig-list').replaceChildren();
      // A browser's own network error ("Failed to fetch") doesn't help anyone.
      const why = err instanceof TypeError ? 'The connection to the computer broke.' : err.message;
      $('#save-status').textContent = `${why} Trying again…`;
      $('#save-zip').hidden = !state.photos.length;
      await sleep(RETRY_MS);
    }
  }
}

$('#save-zip').addEventListener('click', async () => {
  const { blob, folder } = await buildZip();
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${folder}.zip`;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(a.href), 30000);
  toast(`Saved ${folder}.zip to Downloads.`, 5000);
  finishSend();
});

/* ------------------------------------------------------------------ */
turntable.autoConnect();

// Keep a copy of this page on the phone, so it opens with no internet.
if ('serviceWorker' in navigator) navigator.serviceWorker.register('sw.js').catch(() => {});
