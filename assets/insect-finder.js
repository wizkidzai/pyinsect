// Insect finder for the crop step: a small SSDLite + MobileNetV3 detector (insect_finder_ssdlite.onnx,
// ~13 MB, BSD license) that finds the insect and puts the crop box around it, like
// "Pyinsect model executor Oregon v6.py" (box + 20% margin, square, no crop when the insect
// already fills over half the photo). The person can still move or resize the box before "Check it".
// Needs onnxruntime-web (already on the page as `ort`). The model is downloaded the first time it's used.
//
// The ONNX file: input "image" float32 [1,3,320,320] (RGB 0..1, whole photo stretched to 320x320)
//                outputs "box" [1,4] (x0,y0,x1,y1 as fractions of the photo) and "score" [1] (0..1).
window.PYINSECT_FINDER = {
  url: new URL("../model/insect_finder_ssdlite_v2.onnx", document.currentScript.src).href,
  size: 320,
  minScore: 0.10,   // (tested best) below this: no box is placed (the whole photo is checked)
  margin: 0.20,     // crop = box + 20% on each side
  maxShare: 0.50,   // insect already covers more than half the photo: no crop needed
};

(() => {
  let session = null;

  async function getSession() {
    if (!session) {
      session = fetch(PYINSECT_FINDER.url)
        .then(r => { if (!r.ok) throw new Error(`insect finder: ${r.status}`); return r.arrayBuffer(); })
        .then(buf => ort.InferenceSession.create(buf, { executionProviders: ["wasm"] }))
        .catch(e => { session = null; throw e; });
    }
    return session;
  }

  // img: a loaded <img> (or ImageBitmap). minFrac: smallest box as fractions {w, h} (optional).
  // Returns the crop box as fractions of the photo {x, y, w, h}, or null (check the whole photo).
  window.findInsect = async function (img, minFrac = { w: 0, h: 0 }) {
    const { size, minScore, margin, maxShare } = PYINSECT_FINDER;
    const W = img.naturalWidth || img.width, H = img.naturalHeight || img.height;
    const c = document.createElement("canvas");
    c.width = size; c.height = size;
    const g = c.getContext("2d", { willReadFrequently: true });
    g.imageSmoothingQuality = "high";
    g.drawImage(img, 0, 0, size, size);
    const px = g.getImageData(0, 0, size, size).data, plane = size * size;
    const data = new Float32Array(3 * plane);
    for (let i = 0; i < plane; i++) {
      data[i] = px[i * 4] / 255; data[plane + i] = px[i * 4 + 1] / 255; data[2 * plane + i] = px[i * 4 + 2] / 255;
    }
    const s = await getSession();
    const out = await s.run({ image: new ort.Tensor("float32", data, [1, 3, size, size]) });
    const [x0, y0, x1, y1] = out.box.data, score = out.score.data[0];
    if (score < minScore) return null;
    if ((x1 - x0) * (y1 - y0) > maxShare) return null;
    // square around the box (in photo pixels) + margin, kept inside the photo
    const side = Math.max((x1 - x0) * W, (y1 - y0) * H) * (1 + 2 * margin);
    const cx = (x0 + x1) / 2 * W, cy = (y0 + y1) / 2 * H;
    let w = Math.max(side / W, minFrac.w), h = Math.max(side / H, minFrac.h);
    w = Math.min(w, 1); h = Math.min(h, 1);
    const x = Math.min(Math.max(cx / W - w / 2, 0), 1 - w), y = Math.min(Math.max(cy / H - h / 2, 0), 1 - h);
    return { x, y, w, h, score };
  };
})();
