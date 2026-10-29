function makePhoneWalk(stage, photos, picks, url, logo, onOpen) {
    const canvas = document.createElement('canvas');
    canvas.className = 'phone-webgl';
    stage.append(canvas);
    const context = canvas.getContext('webgl', { alpha: false, antialias: true, preserveDrawingBuffer: true });
    if (!context)
        throw Error('WebGL unavailable');
    const gl = context;
    const shader = (type, src) => { const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s); if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
        throw Error(gl.getShaderInfoLog(s) || 'shader'); return s; };
    const program = gl.createProgram();
    gl.attachShader(program, shader(gl.VERTEX_SHADER, 'attribute vec4 p;attribute vec2 uv;varying vec2 v;void main(){gl_Position=p;v=uv;}'));
    gl.attachShader(program, shader(gl.FRAGMENT_SHADER, 'precision mediump float;varying vec2 v;uniform sampler2D image;void main(){gl_FragColor=texture2D(image,v);}'));
    gl.linkProgram(program);
    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        canvas.remove();
        throw Error('WebGL program unavailable');
    }
    gl.useProgram(program);
    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    const pos = gl.getAttribLocation(program, 'p'), uv = gl.getAttribLocation(program, 'uv');
    gl.enableVertexAttribArray(pos);
    gl.enableVertexAttribArray(uv);
    gl.vertexAttribPointer(pos, 4, gl.FLOAT, false, 24, 0);
    gl.vertexAttribPointer(uv, 2, gl.FLOAT, false, 24, 16);
    gl.enable(gl.DEPTH_TEST);
    gl.depthFunc(gl.LEQUAL);
    gl.clearColor(.965, .949, .918, 1);
    let camera = 0;
    let width = 390, height = 740, hw = 220, Z = 1;
    const FOCAL = 820, CY = .46, FS = 1.5;
    const objects = [];
    function texture(source) {
        const t = gl.createTexture();
        gl.bindTexture(gl.TEXTURE_2D, t);
        gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, 1);
        const src = source;
        const sw = src.naturalWidth || src.width || 1024, sh = src.naturalHeight || src.height || 1024;
        const pot = (n) => Math.min(2048, Math.pow(2, Math.ceil(Math.log2(Math.max(1, n)))));
        const c = document.createElement('canvas');
        c.width = pot(sw);
        c.height = pot(sh);
        c.getContext('2d').drawImage(source, 0, 0, c.width, c.height);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
        gl.generateMipmap(gl.TEXTURE_2D);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        const ext = gl.getExtension('EXT_texture_filter_anisotropic');
        if (ext)
            gl.texParameterf(gl.TEXTURE_2D, ext.TEXTURE_MAX_ANISOTROPY_EXT, Math.min(4, gl.getParameter(ext.MAX_TEXTURE_MAX_ANISOTROPY_EXT)));
        return t;
    }
    function painted(kind) { const c = document.createElement('canvas'); c.width = 1024; c.height = 1024; const x = c.getContext('2d'); x.fillStyle = kind === 'floor' ? '#dbceb6' : kind === 'wood' ? '#4a3823' : kind === 'mat' ? '#fbf7ee' : '#eee4d3'; x.fillRect(0, 0, 1024, 1024); if (kind === 'wall' || kind === 'floor') {
        x.strokeStyle = kind === 'floor' ? '#b9a88b' : '#dfd2bc';
        x.lineWidth = 2;
        for (let i = 0; i < 1024; i += 128) {
            x.beginPath();
            x.moveTo(0, i);
            x.lineTo(1024, i);
            x.stroke();
        }
        if (kind === 'wall')
            for (let i = 0; i < 1024; i += 256) {
                x.beginPath();
                x.moveTo(i, 0);
                x.lineTo(i, 1024);
                x.stroke();
            }
    } return texture(c); }
    const wall = painted('wall'), floor = painted('floor'), wood = painted('wood'), mat = painted('mat');
    function quad(points, t) { objects.push({ points, texture: t }); }
    function side(s, y0, y1, z0, z1, t, x = hw * s) { quad([[x, y0, z0], [x, y0, z1], [x, y1, z1], [x, y1, z0]], t); }
    function back(z, w, h, t) { quad([[-w / 2, -h / 2, z], [w / 2, -h / 2, z], [w / 2, h / 2, z], [-w / 2, h / 2, z]], t); }
    const frameImages = Array.from(stage.querySelectorAll('.frame .mat img'));
    const images = picks.map((i, k) => { const im = new Image(); im.crossOrigin = 'anonymous'; im.src = frameImages[k]?.src || url(photos[i].id); return im; });
    const waitImage = (im) => im.decode().catch(() => { });
    // Gate styles: same proportions as the approved desktop 3D gate (frame 4.8%, dot 17.8% at 50.6% / 33.3%, brand gold #A07E3C).
    const gateStyle = document.createElement('style');
    gateStyle.textContent = `.webgl-gate{top:46%!important;border:0!important;display:block!important;border-radius:0;container-type:inline-size}
.webgl-gate::before{content:'';position:absolute;inset:0;box-sizing:border-box;border:4.8cqw solid #A07E3C}
.webgl-gate-dot{position:absolute;left:50.6%;top:33.3%;width:17.8%;aspect-ratio:1;border-radius:50%;background:#A07E3C;transform:translate(-50%,-50%);margin:0}
.webgl-gate-tag{position:absolute;left:0;right:0;top:68%;text-align:center;font:italic 7cqw Georgia,serif!important;color:#a07e3c;white-space:nowrap}`;
    stage.append(gateStyle);
    const entrance = document.createElement('div');
    entrance.className = 'webgl-gate';
    // Gate = the logo mark at the approved desktop-gate proportions (frame 4.8%, dot 17.8% at 50.6% / 33.3%).
    const gateDot = document.createElement('div');
    gateDot.className = 'webgl-gate-dot';
    entrance.append(gateDot);
    const gateTag = document.createElement('div');
    gateTag.className = 'webgl-gate-tag';
    gateTag.textContent = 'Light. Framed.';
    entrance.append(gateTag);
    stage.append(entrance);
    const end = document.createElement('div');
    end.className = 'webgl-end';
    const brand = document.createElement('img');
    brand.src = logo;
    brand.alt = 'YitzFisch logo';
    brand.style.width = '18%';
    end.append(brand);
    const menu = document.createElement('nav');
    menu.setAttribute('aria-label', 'Back wall menu');
    [['Gallery', 'gallery'], ['Shabbat Shalom', 'shabbat'], ['Prints', 'prints'], ['About', 'about']].forEach(([label, id]) => { const link = document.createElement('a'); link.href = '#' + id; link.textContent = label; link.addEventListener('click', e => { e.preventDefault(); const target = document.getElementById(id); const sc = stage.closest('.site-scroll'); if (target && sc)
        sc.scrollTo({ top: target.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop, behavior: 'instant' }); }); menu.append(link); });
    end.append(menu);
    stage.append(end);
    const endTexture = wall;
    const photoTextures = new Map();
    function build() {
        objects.length = 0;
        side(-1, -height * .55, height * .55, 700, -4400, wall);
        side(1, -height * .55, height * .55, -4400, 700, wall);
        quad([[-hw, height * .55, 700], [hw, height * .55, 700], [hw, height * .55, -4400], [-hw, height * .55, -4400]], floor);
        quad([[-hw, -height * .55, -4400], [hw, -height * .55, -4400], [hw, -height * .55, 700], [-hw, -height * .55, 700]], wall);
        back(-4400, hw * 2, height * 1.1, endTexture);
        images.forEach((im, i) => {
            const pair = Math.floor(i / 2), s = i % 2 === 0 ? -1 : 1, z = -(1150 + pair * 580);
            const h = (pair % 2 === 0 ? 336 : 264) * FS, w = (pair % 2 === 0 ? 264 : 336) * FS, x = s * (hw - 10);
            // One physical plane with non-overlapping rings: all four frame edges stay visible.
            function ring(yi, zi, yt, zt, t) { const y0 = -h / 2 + yi, y1 = h / 2 - yi, z0 = z - w / 2 + zi, z1 = z + w / 2 - zi; side(s, y0, y0 + yt, z0, z1, t, x); side(s, y1 - yt, y1, z0, z1, t, x); side(s, y0 + yt, y1 - yt, z0, z0 + zt, t, x); side(s, y0 + yt, y1 - yt, z1 - zt, z1, t, x); }
            ring(0, 0, 10, 28, wood);
            ring(10, 28, 15, 18, mat);
            if (im.naturalWidth)
                side(s, -h / 2 + 25, h / 2 - 25, z - w / 2 + 46, z + w / 2 - 46, (photoTextures.get(im) || (() => { const t = texture(im); photoTextures.set(im, t); return t; })()), x);
        });
    }
    const hits = images.map((im, i) => { const button = document.createElement('button'); button.className = 'corridor-photo-hit'; button.type = 'button'; button.setAttribute('aria-label', 'Open photograph: ' + photos[picks[i]].t); let sx = 0, sy = 0; button.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; }); button.addEventListener('click', e => { if (e.detail === 0 || Math.hypot(e.clientX - sx, e.clientY - sy) < 18)
        onOpen(picks[i]); }); stage.append(button); return button; });
    function updateHits() { hits.forEach((button, i) => { const pair = Math.floor(i / 2), s = i % 2 === 0 ? -1 : 1, z = -(1150 + pair * 580), h = (pair % 2 === 0 ? 336 : 264) * FS, w = (pair % 2 === 0 ? 264 : 336) * FS, x = s * (hw - 10); const points = [[x, -h / 2, z - w / 2], [x, -h / 2, z + w / 2], [x, h / 2, z + w / 2], [x, h / 2, z - w / 2]]; const projected = points.map(([x, y, z]) => { const d = 820 - z - camera; return [width / 2 + FOCAL * Z * x / d, height * CY + FOCAL * Z * y / d, d]; }); if (projected.some(p => p[2] < 100) || camera >= 4399) {
        button.hidden = true;
        return;
    } const xs = projected.map(p => p[0]), ys = projected.map(p => p[1]), left = Math.min(...xs), top = Math.min(...ys), bw = Math.max(...xs) - left, bh = Math.max(...ys) - top; button.hidden = left > width || left + bw < 0 || top > height || top + bh < 0; button.style.left = left + 'px'; button.style.top = top + 'px'; button.style.width = bw + 'px'; button.style.height = bh + 'px'; button.style.clipPath = 'polygon(' + projected.map(p => ((p[0] - left) / bw * 100) + '% ' + ((p[1] - top) / bh * 100) + '%').join(',') + ')'; }); }
    function resize() { const r = stage.getBoundingClientRect(); width = r.width; height = r.height; hw = Math.min(430, Math.max(220, width * .75)); const d = Math.min(window.devicePixelRatio || 1, 2.5); canvas.width = Math.round(width * d); canvas.height = Math.round(height * d); gl.viewport(0, 0, canvas.width, canvas.height); build(); draw(camera); }
    function draw(value) { camera = value; updateHits(); canvas.style.visibility = camera >= 4399 ? 'hidden' : 'visible'; stage.classList.toggle('webgl-arrived', camera >= 4399); const gateDist = 1240 - camera; const gateSize = hw * 1.86; entrance.style.width = gateSize + 'px'; entrance.style.height = gateSize + 'px'; entrance.style.transform = 'translate(-50%,-50%) scale(' + (FOCAL * Z / Math.max(1, gateDist)) + ')'; entrance.style.visibility = gateDist > 50 ? 'visible' : 'hidden'; end.style.opacity = String(Math.min(1, Math.max(0, (camera - 600) / 500))); const dist = 820 + 4400 - camera; end.style.width = (hw * 2) + 'px'; end.style.height = (height * 1.1) + 'px'; end.style.transform = 'translate(-50%,-50%) scale(' + (FOCAL * Z / dist) + ')'; end.style.pointerEvents = camera >= 3500 ? 'auto' : 'none'; gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT); const coords = [[0, 1], [1, 1], [1, 0], [0, 0]], order = [0, 1, 2, 0, 2, 3], f = 820 * Z / (height / 2), aspect = width / height, n = 48, far = 12000, A = (far + n) / (far - n), B = -2 * far * n / (far - n); objects.forEach(o => { const zs = o.points.map(p => p[2]); if (Math.max(...zs) - Math.min(...zs) < 400 && Math.max(...zs) - Math.min(...zs) > 0 && 820 - (zs.reduce((a, b) => a + b, 0) / 4) - camera < 100)
        return; const vertices = []; for (const i of order) {
        const [x, y, z] = o.points[i], d = 820 - z - camera;
        vertices.push(x * f / aspect, -y * f + 2 * (.5 - CY) * d, A * d + B, d, ...coords[i]);
    } gl.bindTexture(gl.TEXTURE_2D, o.texture); gl.bufferData(gl.ARRAY_BUFFER, new Float32Array(vertices), gl.DYNAMIC_DRAW); gl.drawArrays(gl.TRIANGLES, 0, 6); }); }
    resize();
    new ResizeObserver(resize).observe(stage);
    Promise.all(images.map(waitImage)).then(() => { build(); draw(camera); });
    canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); canvas.style.display = 'none'; });
    return { draw, ready: Promise.all(images.map(waitImage)) };
}

const photoURLs = {"1rrzCKnxK0G7nwSL0a8ZVUa0Sa6BhlPbP.webp": "./img/1rrzCKnxK0G7nwSL0a8ZVUa0Sa6BhlPbP.webp", "ss-hanukkah-doorway.webp": "./img/ss-hanukkah-doorway.webp", "132TEjaqItWoTdTM2xcwBgJ7VvidkQ-5K.webp": "./img/132TEjaqItWoTdTM2xcwBgJ7VvidkQ-5K.webp", "ss-father-son-crossing.webp": "./img/ss-father-son-crossing.webp", "ss-woman-black-cloak.webp": "./img/ss-woman-black-cloak.webp", "12hjgNH5yftP7YFUb1GGG992k5HWRkMyx.webp": "./img/12hjgNH5yftP7YFUb1GGG992k5HWRkMyx.webp", "1Tc6pGc5mlAQS0QDdyD8IeRQtsMJljwQZ.webp": "./img/1Tc6pGc5mlAQS0QDdyD8IeRQtsMJljwQZ.webp", "1pWZoVnBod2TTXowqAGygvYPaMb1USy9C.webp": "./img/1pWZoVnBod2TTXowqAGygvYPaMb1USy9C.webp", "ss-tallis-walking.webp": "./img/ss-tallis-walking.webp", "1zxRq4oZLys4TGuhxfhJenrgaM__qR0ut.webp": "./img/1zxRq4oZLys4TGuhxfhJenrgaM__qR0ut.webp", "ss-hanukkah-family-bikes.webp": "./img/ss-hanukkah-family-bikes.webp", "ss-carpenter-meah-shearim.webp": "./img/ss-carpenter-meah-shearim.webp", "ss-boy-snacks-posters.webp": "./img/ss-boy-snacks-posters.webp", "ss-hanukkah-lighting-bending.webp": "./img/ss-hanukkah-lighting-bending.webp", "ss-hanukkah-lantern-chair.webp": "./img/ss-hanukkah-lantern-chair.webp", "ss-blue-hour-alley.webp": "./img/ss-blue-hour-alley.webp", "1Yh5gYOd9_rd2837akjahVwcAr7a0eAw_.webp": "./img/1Yh5gYOd9_rd2837akjahVwcAr7a0eAw_.webp", "1-ccYcSsI3EImzPwRvn51Ml0MOofViLdO.webp": "./img/1-ccYcSsI3EImzPwRvn51Ml0MOofViLdO.webp", "ss-budapest-parliament.webp": "./img/ss-budapest-parliament.webp", "1GBRARdUM-Mf8HBxmowBb7mnFJbJqIA6V.webp": "./img/1GBRARdUM-Mf8HBxmowBb7mnFJbJqIA6V.webp", "ss-hanukkah-window-grate.webp": "./img/ss-hanukkah-window-grate.webp", "ss-two-boys-talking.webp": "./img/ss-two-boys-talking.webp", "1Z630MR2893y7lvK5bK62mP3FOLSloRBq.webp": "./img/1Z630MR2893y7lvK5bK62mP3FOLSloRBq.webp", "ss-two-boys-arm.webp": "./img/ss-two-boys-arm.webp", "ss-children-running-deutch-pharmacy.webp": "./img/ss-children-running-deutch-pharmacy.webp", "gallery.webp": "./img/gallery.webp", "1XagLrXSLeYel9ejRYftRiP48wb6TW3SI.webp": "./img/1XagLrXSLeYel9ejRYftRiP48wb6TW3SI.webp", "129t1vsTX7d5KLivujF11ZqzStQBgWmav.webp": "./img/129t1vsTX7d5KLivujF11ZqzStQBgWmav.webp", "ss-boy-gold-bekishe.webp": "./img/ss-boy-gold-bekishe.webp", "ss-market-guitar.webp": "./img/ss-market-guitar.webp", "ss-purim-three.webp": "./img/ss-purim-three.webp", "1zSDU7b5pgKLYaCRSweSG7sTU-epE_4G6.webp": "./img/1zSDU7b5pgKLYaCRSweSG7sTU-epE_4G6.webp", "ss-father-stroller.webp": "./img/ss-father-stroller.webp", "1F7O4EviHa8eHSYmWi-vCrxqlvVi4T4YW.webp": "./img/1F7O4EviHa8eHSYmWi-vCrxqlvVi4T4YW.webp", "ss-jerusalem-hillside.webp": "./img/ss-jerusalem-hillside.webp"};
function initSite(root) {
    const siteHeight = window.innerHeight;
    const document = new Proxy(window.document, { get(target, key) { if (key === 'getElementById')
            return (id) => root.parentElement.querySelector('[id="' + id + '"]'); if (key === 'querySelector')
            return (q) => root.querySelector(q); if (key === 'querySelectorAll')
            return (q) => root.querySelectorAll(q); const v = Reflect.get(target, key); return typeof v === 'function' ? v.bind(target) : v; } });
    // ─────────────────────────────────────────────
    // ONE copy of the wordmark PNG serves all three places it appears (nav, back wall,
    // footer). It used to be pasted into the file three times, which made the HTML
    // itself ~90KB bigger than it needed to be — and the HTML has to arrive before
    // anything at all can start loading.
    // ─────────────────────────────────────────────
    (function () {
        var src = (document.querySelector('#nav .logo-img') || {}).src;
        if (!src)
            return;
        var slots = document.querySelectorAll('img[data-logo]');
        for (var i = 0; i < slots.length; i++)
            slots[i].src = src;
    })();
    // ─────────────────────────────────────────────
    // ALWAYS start at the entrance — never mid-corridor
    // ─────────────────────────────────────────────
    if ('scrollRestoration' in history)
        history.scrollRestoration = 'manual';
    if (!location.hash)
        root.parentElement.scrollTo(0, 0);
    window.addEventListener('pageshow', e => {
        if (e.persisted && !location.hash) {
            root.parentElement.scrollTo(0, 0);
        }
    });
    // ─────────────────────────────────────────────
    // PHOTOS — read from the Google Sheet CMS (Photos tab, published as CSV).
    // If the sheet is slow, empty, or unreachable, the FALLBACK list below is used
    // instead, so the site can never open blank.
    // ─────────────────────────────────────────────
    const SHEET_CSV = './photos.csv';
    const SHEET_TIMEOUT = 2500; // ms to wait for the sheet before falling back
    // Snapshot of the current library. Still Drive IDs for now; once the sheet has real
    // rows and the JPGs are in /img, this list is only a safety net.
    const FALLBACK = [
        { id: '132TEjaqItWoTdTM2xcwBgJ7VvidkQ-5K', t: 'Golden Hour', l: 'Jerusalem' },
        { id: '1zxRq4oZLys4TGuhxfhJenrgaM__qR0ut', t: 'Moment', l: 'Jerusalem' },
        { id: '1-ccYcSsI3EImzPwRvn51Ml0MOofViLdO', t: 'End of Day', l: 'Jerusalem' },
        { id: '129t1vsTX7d5KLivujF11ZqzStQBgWmav', t: 'Prayer', l: 'Western Wall' },
        { id: '1Z630MR2893y7lvK5bK62mP3FOLSloRBq', t: 'Stillness', l: 'Jerusalem' },
        { id: '1F7O4EviHa8eHSYmWi-vCrxqlvVi4T4YW', t: 'The Light', l: 'Old City' },
        { id: '1Yh5gYOd9_rd2837akjahVwcAr7a0eAw_', t: 'Passage', l: 'Jerusalem' },
        { id: '1rrzCKnxK0G7nwSL0a8ZVUa0Sa6BhlPbP', t: 'Silhouette', l: 'Jerusalem' },
        { id: '1Tc6pGc5mlAQS0QDdyD8IeRQtsMJljwQZ', t: 'Shadow & Stone', l: 'Old City' },
        { id: '1MaOoVQTLxNYvz4kOJq8BuaZCLEH5F7VG', t: 'The Alley', l: 'Jerusalem' },
        { id: '1pWZoVnBod2TTXowqAGygvYPaMb1USy9C', t: 'Sunrise', l: 'Jerusalem' },
        { id: '1eENwpC3KltsYLpDaPeRM-vNiGVXT0vP2', t: 'Morning', l: 'Old City' },
        { id: '1GBRARdUM-Mf8HBxmowBb7mnFJbJqIA6V', t: 'The Gate', l: 'Jerusalem' },
        { id: '1zSDU7b5pgKLYaCRSweSG7sTU-epE_4G6', t: 'Last Light', l: 'Western Wall' },
        { id: '12hjgNH5yftP7YFUb1GGG992k5HWRkMyx', t: 'Gathering', l: 'Jerusalem' },
        { id: '1XagLrXSLeYel9ejRYftRiP48wb6TW3SI', t: 'The Walk II', l: 'Old City' },
    ];
    // Which photos go where. These are indices into PHOTOS. The sheet overrides them
    // (corridor / series / print / portrait columns); these are the fallback picks.
    let PHOTOS = FALLBACK;
    let CORRIDOR_PICKS = [0, 3, 8, 1, 13, 5, 10, 11, 6, 2];
    let SHABBAT_PICKS = [13, 3, 11, 10, 14];
    let PRINT_PICKS = [0, 3, 13];
    let PORTRAIT_PICK = 11; // index into PHOTOS (fallback only)
    let PORTRAIT_ID = null; // set from the sheet's portrait row, which stays out of the gallery
    // ── RESOLUTION KNOB ──────────────────────────────────────────────
    // Width (px) every on-page photo is requested at: corridor frames, gallery,
    // series strip, prints. NOT the full-screen lightbox (that stays sharp below).
    // Lower = lighter/faster. It can only ever look slightly soft, never pixely,
    // as long as it stays at/above the size each photo is shown at on screen.
    //   ~440 = light & fast (recommended)   520 = original   600+ = extra crisp
    const IMGW = window.innerWidth < 640 ? 360 : 480;
    const DIMS = {};
    // ── IMAGE SOURCE ─────────────────────────────────────────────────
    // `id` is whatever the sheet's `file` column holds. A filename (anything with a dot,
    // e.g. golden-hour.jpg) is served from /img through the Netlify Image CDN, resized on
    // the fly. A bare Google Drive ID (no dot) still goes to Drive, so old rows keep
    // working during the move. Once every row is a filename, the Drive line can be deleted.
    const url = (id, w) => photoURLs[id.includes('.') ? id : id + '.webp'];
    const EMAIL = 'info@yitzfisch.com';
    // every print inquiry carries the image number so an order is never ambiguous
    const inquiryLink = p => {
        const ref = p.no ? p.no + ' · ' + p.t : p.t;
        return 'mailto:' + EMAIL + '?subject=' + encodeURIComponent('Print inquiry: ' + ref) +
            '&body=' + encodeURIComponent('Hi Yitz,\n\nI am interested in a print of ' + ref + '.\n\nThank you');
    };
    // ─────────────────────────────────────────────
    // GOOGLE SHEET → PHOTOS
    // ─────────────────────────────────────────────
    // Minimal CSV parser that respects quoted cells (titles with commas, line breaks).
    function parseCSV(text) {
        const rows = [];
        let row = [], cell = '', q = false;
        for (let i = 0; i < text.length; i++) {
            const c = text[i], n = text[i + 1];
            if (q) {
                if (c === '"' && n === '"') {
                    cell += '"';
                    i++;
                }
                else if (c === '"')
                    q = false;
                else
                    cell += c;
            }
            else if (c === '"')
                q = true;
            else if (c === ',') {
                row.push(cell);
                cell = '';
            }
            else if (c === '\n' || c === '\r') {
                if (c === '\r' && n === '\n')
                    i++;
                row.push(cell);
                rows.push(row);
                row = [];
                cell = '';
            }
            else
                cell += c;
        }
        if (cell !== '' || row.length) {
            row.push(cell);
            rows.push(row);
        }
        return rows;
    }
    // Turn the Photos tab into PHOTOS + the pick lists. Returns false if nothing usable.
    // The sheet may have intro rows above the header and a legend below the data; we scan
    // for the row whose first cell is `file` (or legacy `file_id`) and read until a row with
    // no filename in it.
    function applySheet(csv) {
        const rows = parseCSV(csv);
        const norm = s => String(s || '').trim().toLowerCase();
        let hi = rows.findIndex(r => r.some(c => norm(c) === 'file' || norm(c) === 'file_id'));
        if (hi < 0)
            return false;
        const head = rows[hi].map(norm);
        const col = name => head.indexOf(name);
        const cFile = col('file') >= 0 ? col('file') : col('file_id');
        const cTitle = col('title'), cLoc = col('location'), cAlbum = col('album');
        const cCorr = col('corridor') >= 0 ? col('corridor') : col('featured');
        const cSeries = col('series'), cPort = col('portrait'), cOrder = col('order');
        const cPrint = col('print') >= 0 ? col('print') : col('print_available');
        const cNo = col('id') >= 0 ? col('id') : col('no'), cCap = col('caption'), cKw = col('keywords');
        const list = [];
        for (let r = hi + 1; r < rows.length; r++) {
            const row = rows[r];
            const file = String(row[cFile] || '').trim();
            if (!file)
                break; // first empty file cell = end of data
            if (/^(#|\/\/|legend|example)/i.test(file))
                break;
            // a number ranks the photo in that list; a plain "yes" also counts, ranked by sheet order
            const num = c => {
                if (c < 0)
                    return null;
                const v = parseFloat(row[c]);
                if (!isNaN(v))
                    return v;
                return /^(y|yes|x|true)$/i.test(String(row[c] || '').trim()) ? 1000 + r : null;
            };
            const yes = c => c >= 0 && /^(y|yes|x|true|1)$/i.test(String(row[c] || '').trim());
            list.push({
                id: file,
                t: String(cTitle >= 0 ? row[cTitle] || '' : '').trim() || file.replace(/\.[^.]+$/, ''),
                l: String(cLoc >= 0 ? row[cLoc] || '' : (cAlbum >= 0 ? row[cAlbum] || '' : '')).trim() || 'Jerusalem',
                album: String(cAlbum >= 0 ? row[cAlbum] || '' : '').trim(),
                no: String(cNo >= 0 ? row[cNo] || '' : '').trim(),
                cap: String(cCap >= 0 ? row[cCap] || '' : '').trim(),
                kw: String(cKw >= 0 ? row[cKw] || '' : '').trim(),
                corridor: num(cCorr), series: num(cSeries), print: num(cPrint),
                portrait: yes(cPort), order: num(cOrder)
            });
        }
        // the portrait row is Yitz himself, not a gallery piece: pull it out
        const portRow = list.find(p => p.portrait);
        const gallery = list.filter(p => !p.portrait);
        if (gallery.length < 4)
            return false; // need at least the four opening corridor frames
        list.length = 0;
        gallery.forEach(p => list.push(p));
        // gallery order: `order` column if present, else sheet order
        list.forEach((p, i) => { p._i = i; });
        list.sort((a, b) => (a.order ?? 1e9) - (b.order ?? 1e9) || a._i - b._i);
        const ranked = key => list.map((p, i) => ({ i, v: p[key] }))
            .filter(x => x.v !== null).sort((a, b) => a.v - b.v).map(x => x.i);
        const corr = ranked('corridor'), ser = ranked('series'), pr = ranked('print');
        PHOTOS = list;
        // corridor needs exactly 10: numbered rows first, then the rest of the gallery in order,
        // then wrap around if the whole library is smaller than 10
        const pool = corr.concat(list.map((_, i) => i).filter(i => corr.indexOf(i) < 0));
        CORRIDOR_PICKS = [];
        for (let k = 0; k < 10; k++)
            CORRIDOR_PICKS.push(pool[k % pool.length]);
        SHABBAT_PICKS = ser;
        PRINT_PICKS = (pr.length ? pr : CORRIDOR_PICKS).slice(0, 3);
        PORTRAIT_ID = portRow ? portRow.id : null;
        PORTRAIT_PICK = CORRIDOR_PICKS[0];
        return true;
    }
    function loadSheet() {
        if (!SHEET_CSV || !window.fetch)
            return Promise.resolve(false);
        const ctrl = window.AbortController ? new AbortController() : null;
        const timer = setTimeout(() => ctrl && ctrl.abort(), SHEET_TIMEOUT);
        return Promise.resolve({ ok: true, text: () => Promise.resolve("id,file,title,caption,album,series,corridor,print,order,keywords,portrait\r\nYF-001,132TEjaqItWoTdTM2xcwBgJ7VvidkQ-5K.webp,Kotel at Dusk,\"The plaza empties slowly. The light goes first, then the people.\",Jerusalem,,1,1,1,\"western wall, kotel, dome of the rock, old city, dusk, jerusalem skyline\",\r\nYF-002,1zxRq4oZLys4TGuhxfhJenrgaM__qR0ut.webp,Shabbos Morning,\"Three on their way to shul, the street still asleep.\",Jerusalem,,2,,2,\"old city, shabbat morning, chassidic, bekishe, cobblestones\",\r\nYF-003,1-ccYcSsI3EImzPwRvn51Ml0MOofViLdO.webp,Reading the Walls,Every poster is news to someone.,Jerusalem,,3,,3,\"meah shearim, pashkevil, posters, wall, reading\",\r\nYF-004,129t1vsTX7d5KLivujF11ZqzStQBgWmav.webp,Empty Street,\"Late afternoon, the shutters down, the dust still warm.\",Jerusalem,,4,2,4,\"meah shearim, empty street, afternoon light, shutters\",\r\nYF-005,1Z630MR2893y7lvK5bK62mP3FOLSloRBq.webp,Boy and Shadow,He walks with his shadow for company.,Jerusalem,,5,,5,\"boy, yellow vest, shadow, stone wall, posters\",\r\nYF-006,1F7O4EviHa8eHSYmWi-vCrxqlvVi4T4YW.webp,Father and Son,\"Small steps, matched.\",Jerusalem,,6,,6,\"father, son, shtreimel, street, walking\",\r\nYF-007,1Yh5gYOd9_rd2837akjahVwcAr7a0eAw_.webp,The Narrow Street,\"Gold against stone, a Jerusalem Shabbos in one frame.\",Jerusalem,,7,,7,\"bekishe, gold, narrow street, posters, old city\",\r\nYF-008,1rrzCKnxK0G7nwSL0a8ZVUa0Sa6BhlPbP.webp,Brothers,Arm in arm across the plaza.,Jerusalem,,8,,8,\"brothers, boys, plaza, walking, grey vests\",\r\nYF-009,1Tc6pGc5mlAQS0QDdyD8IeRQtsMJljwQZ.webp,Errands,\"Friday morning, a bag in each hand and a child in tow.\",Jerusalem,,9,,9,\"errands, friday, father, child, street\",\r\nYF-010,1pWZoVnBod2TTXowqAGygvYPaMb1USy9C.webp,Sign of the Times,\"One man, one street, a hundred signs.\",Jerusalem,,10,,10,\"street sign, meah shearim, man, alley\",\r\nYF-011,1GBRARdUM-Mf8HBxmowBb7mnFJbJqIA6V.webp,The Gate,\"Arms wide, as if the street were his.\",Jerusalem,,,,11,\"man, beard, open arms, street, welcome\",\r\nYF-012,1zSDU7b5pgKLYaCRSweSG7sTU-epE_4G6.webp,Last Light,The Kotel from the other side of the day.,Jerusalem,,,3,12,\"western wall, kotel, evening, plaza, jerusalem\",\r\nYF-013,12hjgNH5yftP7YFUb1GGG992k5HWRkMyx.webp,Gathering,\"Shabbos afternoon, everyone walking the same direction.\",Jerusalem,,,,13,\"shabbat, walking, street, crowd, afternoon\",\r\nYF-014,1XagLrXSLeYel9ejRYftRiP48wb6TW3SI.webp,The Walk,\"A long path, a short cut, and a man in no hurry.\",Jerusalem,,,,14,\"path, trees, walking, man, outskirts\",\r\nYF-015,ss-carpenter-meah-shearim.webp,\"\u05de\u05b0\u05e9\u05bb\u05c1\u05d6\u05b8\u05bc\u05e8, \u05de\u05b7\u05e2\u05b2\u05e9\u05b5\u05c2\u05d4 \u05d7\u05b9\u05e9\u05b5\u05c1\u05d1\",\"A craftsman at his bench in the Old City, and a passer-by who had to look twice.\",Jerusalem,1,,,15,\"carpenter, workshop, old city, craftsman, arch\",\r\nYF-016,ss-father-stroller.webp,\u05d1\u05b7\u05bc\u05e2\u05b2\u05d3\u05d5\u05b9 \u05d5\u05bc\u05d1\u05b0\u05e2\u05b7\u05d3 \u05d1\u05b5\u05bc\u05d9\u05ea\u05d5\u05b9,\"Father and daughter, Friday morning in Geula.\",Jerusalem,2,,,16,\"father, stroller, baby, geula, street\",\r\nYF-017,ss-woman-black-cloak.webp,\u05d1\u05b0\u05bc\u05db\u05b8\u05dc \u05e7\u05b9\u05d3\u05b6\u05e9\u05c1 \u05dc\u05b9\u05d0 \u05ea\u05b4\u05d2\u05b8\u05bc\u05e2,She passes like a shadow with somewhere to be.,Jerusalem,3,,,17,\"woman, black cloak, street, meah shearim, walking\",\r\nYF-018,ss-boy-snacks-posters.webp,\u05d5\u05b7\u05d0\u05b2\u05db\u05b7\u05dc\u05b0\u05ea\u05b6\u05bc\u05dd \u05e9\u05b8\u05c1\u05dd \u05dc\u05b4\u05e4\u05b0\u05e0\u05b5\u05d9,A bag of something good and a wall full of words.,Jerusalem,4,,,18,\"boy, snacks, posters, meah shearim, walking\",\r\nYF-019,ss-budapest-parliament.webp,\u05d5\u05b7\u05d9\u05b7\u05bc\u05d1\u05b0\u05d3\u05b5\u05bc\u05dc \u05d1\u05b5\u05bc\u05d9\u05df \u05d4\u05b7\u05de\u05b7\u05bc\u05d9\u05b4\u05dd,\"Budapest, the Danube holding its breath.\",Europe,5,,,19,\"budapest, parliament, danube, reflection, blue hour\",\r\nYF-020,ss-children-running-deutch-pharmacy.webp,\u05d5\u05b7\u05ea\u05b4\u05bc\u05de\u05b8\u05bc\u05dc\u05b5\u05d0 \u05d4\u05b8\u05d0\u05b8\u05e8\u05b6\u05e5 \u05d0\u05b9\u05ea\u05b8\u05dd,The street fills with children before it fills with light.,Jerusalem,6,,,20,\"children, running, street, geula, pharmacy sign\",\r\nYF-021,ss-hanukkah-lighting-bending.webp,\u05d0\u05d5\u05b9\u05e8 \u05d7\u05b8\u05d3\u05b8\u05e9\u05c1 \u05e2\u05b7\u05dc \u05e6\u05b4\u05d9\u05bc\u05d5\u05b9\u05df,\"Bent toward the flame, Meah Shearim, first night.\",Hanukkah,7,,,21,\"hanukkah, menorah, candles, night, meah shearim\",\r\nYF-022,ss-hanukkah-lantern-chair.webp,,\"Half an hour with the lights, as the halacha asks. She brought a chair.\",Hanukkah,8,,,22,\"hanukkah, lantern, chair, night, alley\",\r\nYF-023,ss-blue-hour-alley.webp,\u05d0\u05b6\u05dc\u05b8\u05bc\u05d0 \u05dc\u05b4\u05e8\u05b0\u05d0\u05d5\u05b9\u05ea\u05b8\u05dd \u05d1\u05b4\u05bc\u05dc\u05b0\u05d1\u05b8\u05d3...,Only to look at them. Two men do exactly that.,Hanukkah,9,,,23,\"hanukkah, blue hour, alley, candles, men talking\",\r\nYF-024,ss-father-son-crossing.webp,\u05dc\u05b9\u05d0 \u05d9\u05d5\u05bc\u05db\u05b7\u05dc \u05d4\u05b7\u05e0\u05b7\u05bc\u05e2\u05b7\u05e8 \u05dc\u05b7\u05e2\u05b2\u05d6\u05b9\u05d1 \u05d0\u05b6\u05ea \u05d0\u05b8\u05d1\u05b4\u05d9\u05d5,\"A hand on the shoulder, crossing together.\",Jerusalem,10,,,24,\"father, son, crossing, posters, shtreimel\",\r\nYF-025,ss-two-boys-arm.webp,\u05d5\u05b7\u05d9\u05b4\u05bc\u05e7\u05b7\u05bc\u05d7 \u05d0\u05b6\u05ea \u05e9\u05b0\u05c1\u05e0\u05b5\u05d9 \u05d1\u05b8\u05e0\u05b8\u05d9\u05d5,\"Two brothers, one bag of chips, the whole street ahead.\",Jerusalem,11,,,25,\"brothers, boys, arm around, posters, meah shearim\",\r\nYF-026,ss-hanukkah-family-bikes.webp,\u05d6\u05b9\u05d0\u05ea \u05d7\u05b2\u05e0\u05bb\u05db\u05b8\u05bc\u05d4,A family gathered round a small fire between the bicycles.,Hanukkah,12,,,26,\"hanukkah, family, candles, bicycles, alley\",\r\nYF-027,ss-hanukkah-doorway.webp,\u05d5\u05b7\u05d9\u05b0\u05d4\u05b4\u05d9 \u05d0\u05d5\u05b9\u05e8 \u05d1\u05b7\u05bc\u05de\u05b8\u05bc\u05e7\u05d5\u05b9\u05dd,\"The door opens, the light is already there.\",Hanukkah,13,,,27,\"hanukkah, doorway, menorah, man, night\",\r\nYF-028,ss-hanukkah-window-grate.webp,\u05ea\u05b7\u05bc\u05ea\u05b4\u05bc\u05d9\u05e8 \u05e6\u05b0\u05e8\u05d5\u05bc\u05e8\u05b8\u05d4,\"Flames behind bars, and a face behind the flames.\",Hanukkah,14,,,28,\"hanukkah, window, grate, candles, reflection\",\r\nYF-029,ss-jerusalem-hillside.webp,\u05d0\u05b5\u05ea \u05d0\u05b6\u05e8\u05b6\u05e5 \u05de\u05b0\u05d2\u05bb\u05e8\u05b5\u05d9\u05d4\u05b6\u05dd,\"Stone on stone up the hill, the way Jerusalem has always been built.\",Jerusalem,15,,,29,\"jerusalem, hillside, houses, cypress, mount of olives\",\r\nYF-030,ss-market-guitar.webp,To sing the song of Shabbos,\"Machane Yehuda, Friday afternoon, and a guitar that will not let anyone leave.\",Jerusalem,16,,,30,\"machane yehuda, market, guitar, friday, music\",\r\nYF-031,ss-boy-gold-bekishe.webp,\u05de\u05b4\u05e7\u05b0\u05e9\u05b8\u05c1\u05d4 \u05d6\u05b8\u05d4\u05b8\u05d1 \u05e2\u05b7\u05d3 \u05d9\u05b0\u05e8\u05b5\u05db\u05b8\u05d4\u05bc \u05e2\u05b7\u05d3 \u05e4\u05b4\u05bc\u05e8\u05b0\u05d7\u05b8\u05d4\u05bc,\"Gold, hammered out, from the hem to the hat.\",Jerusalem,17,,,31,\"bekishe, gold, shtreimel, boy, morning light, geula\",\r\nYF-032,ss-purim-three.webp,\u05e4\u05d5\u05e8\u05d9\u05dd \u05de\u05e9\u05dc\u05e9,Three generations of Purim crossing the street in step.,Jerusalem,18,,,32,\"purim, costumes, crossing, family, joy\",\r\nYF-033,ss-tallis-walking.webp,\u05d5\u05bc\u05d1\u05b7\u05e9\u05b0\u05bc\u05c1\u05d1\u05b4\u05e2\u05b4\u05ea \u05d9\u05b5\u05e6\u05b5\u05d0 \u05dc\u05b7\u05d7\u05b8\u05e4\u05b0\u05e9\u05b4\u05c1\u05d9,\"Tallis over the shoulders, home from shul, nobody waiting.\",Jerusalem,19,,,33,\"tallis, walking, shabbat morning, street, posters\",\r\nYF-034,ss-two-boys-talking.webp,\u05d5\u05b7\u05d9\u05b9\u05bc\u05d0\u05de\u05b0\u05e8\u05d5\u05bc \u05d0\u05b4\u05d9\u05e9\u05c1 \u05d0\u05b6\u05dc \u05d0\u05b8\u05d7\u05b4\u05d9\u05d5...,\"Mid-sentence, mid-street, Geula at golden hour.\",Jerusalem,20,,,34,\"boys, talking, geula, golden hour, street\",\r\n") })
            .then(r => r.ok ? r.text() : '')
            .then(t => { clearTimeout(timer); return t ? applySheet(t) : false; })
            .catch(() => { clearTimeout(timer); return false; });
    }
    // retry images once if Drive hiccups (rate limits / slow network)
    function withRetry(img) {
        img.addEventListener('error', () => {
            if (img.dataset.r)
                return;
            img.dataset.r = '1';
            const src = img.src;
            setTimeout(() => { img.src = ''; img.src = src; }, 1500);
        });
    }
    // tap-guard: ignore taps that were really scrolls. Tolerances are a little generous so a
    // real tap on the moving 3D corridor still registers, while a scroll-drag still won't.
    function onTap(el, fn) {
        let sx = 0, sy = 0, sc = 0;
        el.addEventListener('pointerdown', e => { sx = e.clientX; sy = e.clientY; sc = root.parentElement.scrollTop; }, { passive: true });
        el.addEventListener('click', e => {
            if (Math.hypot(e.clientX - sx, e.clientY - sy) > 18)
                return;
            if (Math.abs(root.parentElement.scrollTop - sc) > 16)
                return;
            fn(e);
        });
    }
    // ─────────────────────────────────────────────
    // 3D CORRIDOR — smooth interpolated camera
    // ─────────────────────────────────────────────
    const DEPTH = 4400;
    const GATE_Z = -420;
    const PERSP = 820; // must match the CSS perspective on .scene
    const world = document.getElementById('world');
    const gate = document.getElementById('gate');
    const hint = document.getElementById('hint');
    const backwall = document.getElementById('backwall');
    const walk = document.getElementById('walk');
    const stage = document.querySelector('.stage');
    const nav = document.getElementById('nav');
    let HW = 0, VH = 0, stageH = 0;
    let phoneRenderer = null;
    const frames = [];
    function setDims(img, srcUrl) {
        const d = DIMS[srcUrl];
        if (d && d[0] && d[1]) {
            img.setAttribute('width', d[0]);
            img.setAttribute('height', d[1]);
        }
    }
    function buildCorridor() {
        CORRIDOR_PICKS.forEach((pi, i) => {
            const p = PHOTOS[pi];
            const pair = Math.floor(i / 2);
            const side = (i % 2 === 0) ? -1 : 1;
            const portrait = pair % 2 === 0;
            const el = document.createElement('div');
            el.className = 'frame';
            el.style.width = (portrait ? 264 : 336) + 'px';
            el.style.height = (portrait ? 336 : 264) + 'px';
            const mat = document.createElement('div');
            mat.className = 'mat';
            const img = document.createElement('img');
            const u = url(p.id);
            img.src = u;
            setDims(img, u);
            img.alt = p.t;
            img.decoding = 'async';
            if (pair < 2)
                img.fetchPriority = 'high';
            withRetry(img);
            mat.appendChild(img);
            el.appendChild(mat);
            const glow = document.createElement('div');
            glow.className = 'glow';
            el.appendChild(glow);
            const plate = document.createElement('div');
            plate.className = 'plate';
            plate.textContent = p.t;
            el.appendChild(plate);
            onTap(el, () => openLb(PHOTOS, pi));
            world.appendChild(el);
            frames.push({ el, z: -(1150 + pair * 580), side, vis: null });
        });
    }
    function layout() {
        // Measure the REAL stage box. On mobile, siteHeight/innerWidth can briefly
        // report a tiny or zero value while the page is loading (especially behind the loader
        // overlay). If the corridor were sized off that, every wall/floor/gate collapses into a
        // small cluster in the center of the screen — the "tiny diorama" glitch. The floors
        // below make that impossible, and ResizeObserver (see start) re-runs this the instant
        // the stage reports its true size.
        const rect = stage.getBoundingClientRect();
        VH = Math.max(rect.height || 0, siteHeight || 0, siteHeight || 0, 360);
        const VW = Math.max(rect.width || 0, window.innerWidth || 0, document.documentElement.clientWidth || 0, 320);
        stageH = stage.offsetHeight || VH;
        HW = Math.min(430, Math.max(220, VW * 0.42));
        const wallH = VH * 2.6; // oversized: walls always reach past top & bottom of screen
        const span = DEPTH + 1600;
        const setP = (id, w, h, transform) => {
            const el = document.getElementById(id);
            el.style.width = w + 'px';
            el.style.height = h + 'px';
            el.style.transform = transform;
        };
        setP('wallL', span, wallH, 'translate(-50%,-50%) translate3d(' + (-HW) + 'px,0,' + (-span / 2 + 400) + 'px) rotateY(90deg)');
        setP('wallR', span, wallH, 'translate(-50%,-50%) translate3d(' + (HW) + 'px,0,' + (-span / 2 + 400) + 'px) rotateY(-90deg)');
        setP('floor', HW * 2 + 8, span, 'translate(-50%,-50%) translate3d(0,' + (VH * 0.55) + 'px,' + (-span / 2 + 400) + 'px) rotateX(90deg)');
        setP('ceil', HW * 2 + 8, span, 'translate(-50%,-50%) translate3d(0,' + (-VH * 0.55) + 'px,' + (-span / 2 + 400) + 'px) rotateX(-90deg)');
        const S = Math.min(640, HW * 1.86, VH * 0.84);
        gate.style.width = S + 'px';
        gate.style.height = S + 'px';
        gate.style.borderWidth = Math.max(18, S * 0.048) + 'px';
        gate.style.transform = 'translate(-50%,-50%) translateZ(' + GATE_Z + 'px)';
        backwall.style.width = (HW * 2) + 'px';
        backwall.style.height = (VH * 1.4) + 'px';
        backwall.style.transform = 'translate(-50%,-50%) translateZ(' + (-(DEPTH + 560)) + 'px)';
        frames.forEach(f => {
            f.el.style.transform =
                'translate(-50%,-50%) translate3d(' + (f.side * (HW - 6)) + 'px,-14px,' + f.z + 'px) rotateY(' + (f.side === -1 ? 90 : -90) + 'deg)';
        });
    }
    const clamp = (v, a, b) => Math.min(b, Math.max(a, v));
    const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    // camera: target follows scroll, actual position eases toward it.
    // every intermediate position is rendered — fast flicks still walk
    // smoothly through the gate and past every frame. nothing pops.
    let cam = 0, targetZ = 0, lastCam = -1;
    let lbWarmed = false; // big lightbox images are warmed only AFTER the walk
    function readScroll() {
        const total = Math.max(1, walk.offsetHeight - stageH);
        const container = root.parentElement;
        const walkStart = walk.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
        const p = clamp((container.scrollTop - walkStart) / total, 0, 1);
        const eased = p;
        targetZ = eased * DEPTH;
        cam = targetZ;
        render(cam);
        lastCam = cam;
        hint.style.visibility = p > 0.02 ? 'hidden' : 'visible';
        // only turn on the frosted-glass nav once the walk is finished. blurring it over the
        // moving corridor forces the phone to re-blur every frame = the jank/jumping.
        const walkDone = p >= 0.999;
        if (inWalk === walkDone)
            lastCam = -1; // sway state changed: force one clean render
        inWalk = !walkDone;
        nav.classList.toggle('scrolled', walkDone);
        if (walkDone && !lbWarmed) {
            lbWarmed = true;
            if (window.requestIdleCallback)
                requestIdleCallback(warmLightbox);
            else
                setTimeout(warmLightbox, 300);
        }
    }
    // ── IDLE SWAY + MOUSE TILT ───────────────────────────────────────
    // When the visitor stops scrolling the corridor used to freeze into a still image.
    // Now the camera breathes: a slow figure-eight drift of a few px, plus (desktop only)
    // a gentle lean toward the mouse. Amplitudes are deliberately tiny so photos stay
    // readable and nothing feels like a screensaver. Off under prefers-reduced-motion.
    const SWAY = { x: 0, y: 0, z: 0, tilt: 0 };
    let tiltX = 0, tiltY = 0, tiltTX = 0, tiltTY = 0;
    let inWalk = true; // only animate while the corridor is on screen
    if (window.matchMedia('(hover:hover) and (pointer:fine)').matches) {
        window.addEventListener('mousemove', e => {
            tiltTX = (e.clientX / window.innerWidth - 0.5) * 2; // -1 .. 1
            tiltTY = (e.clientY / siteHeight - 0.5) * 2;
        }, { passive: true });
        window.addEventListener('mouseleave', () => { tiltTX = 0; tiltTY = 0; });
    }
    function render(camZ, now) {
        stage.classList.toggle('walk-started', camZ > 180);
        if (phoneRenderer)
            phoneRenderer.draw(camZ);
        let sx = 0, sy = 0, sz = 0, ry = 0, rx = 0;
        if (false) {
            const t = (now || performance.now()) / 1000;
            sx = Math.sin(t * 0.55) * SWAY.x;
            sy = Math.sin(t * 0.83 + 1.3) * SWAY.y;
            sz = Math.sin(t * 0.37 + 0.6) * SWAY.z;
            tiltX += (tiltTX - tiltX) * 0.04; // slow ease so the lean never snaps
            tiltY += (tiltTY - tiltY) * 0.04;
            ry = -tiltX * SWAY.tilt;
            rx = tiltY * SWAY.tilt * 0.6;
        }
        world.style.transform =
            'rotateX(' + rx.toFixed(2) + 'deg) rotateY(' + ry.toFixed(2) + 'deg) ' +
                'translate3d(' + sx.toFixed(1) + 'px,' + sy.toFixed(1) + 'px,' + Math.round(camZ + sz) + 'px)';
        // gate: stays solid until it is truly behind the camera plane.
        // it only disappears just before crossing the camera, by which point its
        // frame and logo have already swept past every edge of the screen —
        // a full pass-through, never cut off mid-screen.
        gate.style.visibility = (GATE_Z + camZ >= PERSP - 24) ? 'hidden' : 'visible';
        // frames: solid always; removed only once fully behind you
        frames.forEach(f => {
            const vis = (-f.z - camZ < -280) ? 'hidden' : 'visible';
            if (vis !== f.vis) {
                f.el.style.visibility = vis;
                f.vis = vis;
            }
        });
        backwall.classList.toggle('live', camZ >= DEPTH * 0.82);
    }
    function tick(now) {
        const d = targetZ - cam;
        if (REDUCED || window.innerWidth < 640) {
            cam = targetZ;
        }
        else {
            cam += Math.abs(d) < 0.1 ? d : d * 0.14;
        }
        // sway means every frame is a new frame while the corridor is on screen; once the
        // visitor is past it we go back to rendering only when the camera actually moves
        const swaying = false;
        if (swaying || cam !== lastCam) {
            render(cam, now);
            lastCam = cam;
        }
        requestAnimationFrame(tick);
    }
    // ─────────────────────────────────────────────
    // SECTIONS
    // ─────────────────────────────────────────────
    let lbList = [], lbIdx = 0;
    function buildGallery() {
        const m = document.getElementById('masonry');
        PHOTOS.forEach((p, i) => {
            if (p.series !== null)
                return;
            const d = document.createElement('div');
            d.className = 'm-item';
            const img = document.createElement('img');
            const u = url(p.id);
            img.src = u;
            setDims(img, u);
            const focal = { 'Kotel at Dusk': '35% 50%', 'Last Light': '45% 50%', 'Gathering': '50% 50%', 'The Walk': '62% 50%' };
            img.style.objectPosition = focal[p.t] || '50% 50%';
            img.alt = p.t + (p.kw ? ' — ' + p.kw : '') + ' - photography by Yitz Fisch';
            img.loading = 'lazy';
            img.decoding = 'async';
            withRetry(img);
            // the gallery is no longer pre-downloaded in full, so each photo reports its own
            // real proportions as it arrives — that replaces the reserved 4/5 box with the truth
            img.addEventListener('load', () => {
                if (!img.getAttribute('width') && img.naturalWidth) {
                    img.setAttribute('width', img.naturalWidth);
                    img.setAttribute('height', img.naturalHeight);
                }
            }, { once: true });
            const cap = document.createElement('div');
            cap.className = 'cap';
            cap.innerHTML = '<b></b><span></span>';
            cap.querySelector('b').textContent = p.t;
            cap.querySelector('span').textContent = p.l;
            d.appendChild(img);
            onTap(d, () => { const gallery = PHOTOS.filter(x => x.series === null); openLb(gallery, gallery.indexOf(p), false); });
            m.appendChild(d);
        });
    }
    function buildStrip() {
        const s = document.getElementById('strip');
        SHABBAT_PICKS.forEach((pi, i) => {
            const p = PHOTOS[pi];
            const d = document.createElement('div');
            d.className = 's-item';
            const img = document.createElement('img');
            const u = url(p.id);
            img.src = u;
            setDims(img, u);
            img.alt = p.t;
            img.loading = 'lazy';
            img.decoding = 'async';
            withRetry(img);
            d.appendChild(img);
            const cap = document.createElement('div');
            cap.className = 'series-caption';
            const title = document.createElement('b');
            title.textContent = /^ss-/.test(p.t) ? '' : p.t;
            const desc = document.createElement('p');
            desc.textContent = p.cap || '';
            cap.append(title, desc);
            d.appendChild(cap);
            onTap(d, () => openLb(SHABBAT_PICKS.map(x => PHOTOS[x]), i));
            s.appendChild(d);
        });
    }
    function buildPrints() {
        const g = document.getElementById('printsGrid');
        PRINT_PICKS.forEach(pi => {
            const p = PHOTOS[pi];
            const c = document.createElement('div');
            c.className = 'p-card';
            const img = document.createElement('img');
            const u = url(p.id);
            img.src = u;
            setDims(img, u);
            img.alt = p.t;
            img.loading = 'lazy';
            img.decoding = 'async';
            withRetry(img);
            const b = document.createElement('b');
            b.textContent = p.t;
            const ed = document.createElement('span');
            ed.className = 'ed';
            ed.textContent = 'Fine Art Print · Edition of 25';
            const a = document.createElement('a');
            a.className = 'btn-gold';
            a.textContent = 'Inquire';
            a.href = inquiryLink(p);
            c.appendChild(img);
            c.appendChild(b);
            c.appendChild(ed);
            c.appendChild(a);
            g.appendChild(c);
        });
    }
    function buildAbout() {
        const img = document.getElementById('portrait');
        const u = url(PORTRAIT_ID || PHOTOS[PORTRAIT_PICK].id, 800);
        img.src = u;
        setDims(img, u);
        withRetry(img);
    }
    // lightbox
    const lb = document.getElementById('lb');
    const lbImg = document.getElementById('lbImg');
    root.parentElement.appendChild(lb);
    document.getElementById('lbX').setAttribute('aria-label', 'Close photograph');
    document.getElementById('lbP').setAttribute('aria-label', 'Previous photograph');
    document.getElementById('lbN').setAttribute('aria-label', 'Next photograph');
    function openLb(list, i, showInfo = true) {
        lb.classList.toggle('photo-only', !showInfo);
        lbList = list;
        lbIdx = i;
        renderLb();
        lb.classList.add('open');
        document.body.style.overflow = 'hidden';
    }
    function renderLb() {
        const p = lbList[lbIdx];
        lbImg.src = url(p.id, window.innerWidth < 640 ? 1000 : 1400);
        lbImg.alt = p.t;
        document.getElementById('lbT').textContent = p.t;
        document.getElementById('lbL').textContent = p.l;
        document.getElementById('lbC').textContent = p.cap || '';
        const a = document.getElementById('lbNo');
        a.textContent = p.no ? 'No. ' + p.no + ' · Inquire about a print' : '';
        a.href = p.no ? inquiryLink(p) : '#';
    }
    function closeLb() {
        lb.classList.remove('open');
        document.body.style.overflow = '';
    }
    document.getElementById('lbX').addEventListener('click', closeLb);
    document.getElementById('lbP').addEventListener('click', e => { e.stopPropagation(); lbIdx = (lbIdx - 1 + lbList.length) % lbList.length; renderLb(); });
    document.getElementById('lbN').addEventListener('click', e => { e.stopPropagation(); lbIdx = (lbIdx + 1) % lbList.length; renderLb(); });
    lb.addEventListener('click', e => { if (e.target === lb)
        closeLb(); });
    document.addEventListener('keydown', e => {
        if (!lb.classList.contains('open'))
            return;
        if (e.key === 'Escape')
            closeLb();
        if (e.key === 'ArrowLeft')
            document.getElementById('lbP').click();
        if (e.key === 'ArrowRight')
            document.getElementById('lbN').click();
    });
    // ─────────────────────────────────────────────
    // INIT — the site does not open until every photo is downloaded AND decoded.
    // no lazy loading, no pop-in, no flicker: the whole gallery is in memory
    // before the first frame is painted.
    // ─────────────────────────────────────────────
    const loader = document.getElementById('loader');
    const ldFill = document.getElementById('ldFill');
    const ldPct = document.getElementById('ldPct');
    function preloadAll(urls, onProg) {
        let done = 0;
        const total = urls.length;
        function loadOne(srcUrl, attempt) {
            return new Promise(res => {
                const im = new Image();
                im.onload = () => {
                    DIMS[srcUrl] = [im.naturalWidth, im.naturalHeight]; // remember real size for width/height attrs
                    // decode() guarantees the pixels are ready — not just downloaded —
                    // so nothing ever paints in mid-scroll
                    const d = im.decode ? im.decode().catch(() => { }) : Promise.resolve();
                    d.then(() => res(true));
                };
                im.onerror = () => {
                    if (attempt < 2) { // Drive hiccup: retry up to twice with backoff
                        setTimeout(() => loadOne(srcUrl, attempt + 1).then(res), 900 * (attempt + 1));
                    }
                    else
                        res(false);
                };
                im.src = srcUrl;
            });
        }
        let i = 0;
        function worker() {
            if (i >= total)
                return Promise.resolve();
            const srcUrl = urls[i++];
            return loadOne(srcUrl, 0).then(() => {
                done++;
                onProg(done / total);
                return worker();
            });
        }
        const lanes = [];
        for (let k = 0; k < Math.min(6, total); k++)
            lanes.push(worker());
        const all = Promise.all(lanes);
        // Never trap a visitor on the loader. 3.5s is the longest a first-time visitor will
        // wait before deciding a site is broken; past that the site opens regardless and the
        // remaining photographs continue arriving behind it.
        const failsafe = new Promise(r => setTimeout(r, 3500));
        return Promise.race([all, failsafe]);
    }
    function start() {
        buildCorridor();
        buildGallery();
        buildStrip();
        buildPrints();
        buildAbout();
        root.querySelectorAll('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
            const id = a.getAttribute('href').slice(1);
            const target = id === 'top' ? walk : document.getElementById(id);
            if (!target)
                return;
            e.preventDefault();
            const sc = root.parentElement;
            const y = target.getBoundingClientRect().top - sc.getBoundingClientRect().top + sc.scrollTop;
            sc.scrollTo({ top: y, behavior: 'instant' });
        }));
        layout();
        readScroll();
        cam = targetZ; // land exactly where the page loads (top, or #hash target)
        render(cam);
        tick();
        root.parentElement.addEventListener('scroll', readScroll, { passive: true });
        // Handle touch inside the entrance explicitly, so the outer viewer cannot take its scroll.
        // Flicks keep gliding after the finger lifts: track the swipe velocity and let it decay
        // on release, matching the natural momentum of the rest of the page.
        const scroller = root.parentElement;
        let touchY = 0, walkAnimation = 0, glideAnimation = 0, swipeV = 0, lastMoveT = 0;
        const stopGlide = () => { cancelAnimationFrame(glideAnimation); glideAnimation = 0; swipeV = 0; };
        stage.addEventListener('touchstart', (e) => { if (e.touches.length !== 1)
            return; touchY = e.touches[0].clientY; swipeV = 0; lastMoveT = 0; cancelAnimationFrame(walkAnimation); stopGlide(); }, { passive: true });
        stage.addEventListener('touchmove', (e) => {
            if (e.touches.length !== 1)
                return;
            const y = e.touches[0].clientY, delta = touchY - y;
            touchY = y;
            const now = performance.now();
            if (lastMoveT) {
                const dt = now - lastMoveT;
                if (dt > 90)
                    swipeV = 0; // finger paused: no stored momentum
                else if (dt > 0)
                    swipeV = swipeV * 0.6 + (delta / dt) * 0.4; // smoothed px/ms
            }
            lastMoveT = now;
            const atTop = scroller.scrollTop <= 0;
            if (delta < 0 && atTop) {
                swipeV = 0;
                return;
            }
            e.preventDefault();
            scroller.scrollTop += delta;
            readScroll();
        }, { passive: false });
        stage.addEventListener('touchend', () => {
            if (!lastMoveT || performance.now() - lastMoveT > 90)
                return; // finger was resting, not flicking
            let v = clamp(swipeV, -3.5, 3.5);
            swipeV = 0;
            if (Math.abs(v) < 0.08)
                return;
            let prev = performance.now();
            const glide = (now) => {
                const dt = Math.min(32, now - prev);
                prev = now;
                v *= Math.pow(0.95, dt / 16.7); // friction: a hard flick glides ~1.2s
                const delta = v * dt;
                const maxTop = scroller.scrollHeight - scroller.clientHeight;
                if (Math.abs(v) < 0.04 || (delta < 0 && scroller.scrollTop <= 0) || (delta > 0 && scroller.scrollTop >= maxTop))
                    return;
                scroller.scrollTop += delta;
                readScroll();
                glideAnimation = requestAnimationFrame(glide);
            };
            glideAnimation = requestAnimationFrame(glide);
        }, { passive: true });
        const controls = document.createElement('div');
        controls.className = 'walk-controls';
        const play = document.createElement('button');
        play.type = 'button';
        play.textContent = 'Walk in';
        const status = document.createElement('span');
        status.textContent = 'or swipe up';
        controls.append(play, status);
        stage.appendChild(controls);
        play.addEventListener('click', () => {
            stopGlide();
            if (play.textContent === 'Pause') {
                cancelAnimationFrame(walkAnimation);
                play.textContent = 'Continue walk';
                return;
            }
            const end = walk.offsetHeight - stage.offsetHeight + walk.offsetTop;
            if (scroller.scrollTop >= end - 5)
                scroller.scrollTop = 0;
            const start = scroller.scrollTop;
            const began = performance.now(), duration = Math.max(2500, 5000 * (1 - start / Math.max(end, 1)));
            play.textContent = 'Pause';
            const step = (now) => { const p = Math.min(1, (now - began) / duration); scroller.scrollTop = start + (end - start) * p; readScroll(); status.textContent = Math.round(p * 100) + '%'; if (p < 1)
                walkAnimation = requestAnimationFrame(step);
            else {
                play.textContent = 'Walk again';
                scroller.scrollTop = end;
                status.textContent = 'Scroll for photos';
            } };
            walkAnimation = requestAnimationFrame(step);
        });
        const relayout = () => { layout(); readScroll(); render(cam); };
        // Keep the corridor locked to the stage's true size. A ResizeObserver fires the
        // instant the stage gets — or changes — its real dimensions, so even if the very first
        // measurement was off, it self-corrects before anything is visible, and on orientation
        // changes too. This is what prevents the intermittent "tiny centered box" render.
        if (window.ResizeObserver) {
            const ro = new ResizeObserver(relayout);
            ro.observe(stage);
        }
        // Belt-and-suspenders re-measures for environments without a clean ResizeObserver pass.
        window.addEventListener('load', relayout);
        window.addEventListener('pageshow', relayout); // bfcache / back-forward
        window.addEventListener('orientationchange', () => setTimeout(relayout, 80));
        // Reveal only after two frames + a final re-measure, so the FIRST thing the visitor
        // sees is already sized correctly. Just before revealing, verify the corridor really
        // rendered in 3D; if a browser flattened it, switch to the clean 2D entrance so the
        // page is never shown broken.
        requestAnimationFrame(() => requestAnimationFrame(() => {
            relayout();
            // Mobile GPUs and embedded browsers can report valid 3D geometry while
            // painting only fragments. Use the predictable flat entrance on touch phones.
            if (/Android/i.test(navigator.userAgent) || window.matchMedia('(pointer:coarse)').matches || window.innerWidth < 760 || REDUCED || corridorFlattened())
                enable2D();
            relayout();
            document.body.classList.remove('loading');
            loader.classList.add('done');
            setTimeout(() => loader.remove(), 600);
            warmRest();
        }));
    }
    // A working side wall (rotateY 90°, running the length of the corridor) projects to a
    // box hundreds of px wide. If transform-style:preserve-3d is flattened, that same wall
    // collapses edge-on to a near-zero-width sliver. Measuring its rendered width is a
    // reliable, device-accurate test for the flattening bug.
    function corridorFlattened() {
        try {
            const r = document.getElementById('wallL').getBoundingClientRect();
            return r.width < 30;
        }
        catch (e) {
            return false;
        }
    }
    // Clean fallback entrance — used only if the 3D corridor can't render on this browser.
    function enable2D() {
        if (document.body.classList.contains('no3d'))
            return;
        document.body.classList.add('no3d');
        const src = (document.querySelector('.bw-logo') || document.querySelector('.nav-brand .logo-img') || {}).src || '';
        const hero = document.createElement('div');
        hero.className = 'hero2d';
        const img = document.createElement('img');
        img.className = 'logo-img';
        img.src = src;
        img.alt = 'YitzFisch';
        const tag = document.createElement('div');
        tag.className = 'h2-tag';
        tag.textContent = 'Light. Framed.';
        document.body.classList.add('phonewalk');
        try {
            phoneRenderer = makePhoneWalk(stage, PHOTOS, CORRIDOR_PICKS, url, src, (pi) => openLb(PHOTOS, pi));
        }
        catch (e) {
            stage.querySelectorAll('.phone-webgl,.webgl-end').forEach(el => el.remove());
            document.body.classList.remove('phonewalk');
            hero.append(img, tag);
            const enter = document.createElement('button');
            enter.className = 'h2-enter';
            enter.textContent = 'Enter the gallery';
            enter.onclick = () => document.getElementById('gallery').scrollIntoView();
            hero.append(enter);
            stage.appendChild(hero);
        }
    }
    // ─── THE OPENING ONLY ────────────────────────────────────────────────────────
    // This used to wait for all 21 photographs — every corridor frame, the whole gallery,
    // the series strip, the prints and the portrait — to download AND decode from Google
    // Drive before the site was allowed to appear. On a phone that is a long time to stare
    // at a percentage, and if Drive throttled even one request the visitor sat there until
    // the failsafe fired.
    //
    // Now it waits only for the four photographs that are actually on screen when the
    // corridor opens. Everything below is lazy-loaded by the browser as the visitor scrolls
    // (buildGallery / buildStrip / buildPrints already set loading='lazy'), and the deeper
    // corridor frames plus the portrait are warmed in the background the instant the site
    // is revealed — long before anyone scrolls far enough to see them.
    // The sheet is fetched first (it decides WHICH four photographs those are). It is a
    // few KB and usually back in well under a second; if it is not back in SHEET_TIMEOUT
    // the FALLBACK list is used and the opening proceeds exactly as before.
    loadSheet().then(() => {
        const PRELOAD_URLS = CORRIDOR_PICKS.slice(0, 4).map(i => url(PHOTOS[i].id));
        return preloadAll(PRELOAD_URLS, p => {
            const pct = Math.round(p * 100);
            ldFill.style.width = pct + '%';
            ldPct.textContent = pct + '%';
        });
    }).then(start);
    // mobile: ignore tiny height changes from the browser address bar —
    // they were causing the mid-scroll "jump/static" glitches
    let lastW = window.innerWidth, lastH = siteHeight;
    window.addEventListener('resize', () => {
        const dw = Math.abs(window.innerWidth - lastW);
        const dh = Math.abs(siteHeight - lastH);
        if (dw > 0 || dh > 160) {
            lastW = window.innerWidth;
            lastH = siteHeight;
            layout();
            readScroll();
        }
    });
    // The site is open; now quietly fetch the rest of the corridor and the portrait in the
    // background, one at a time so the connection stays free for whatever the visitor is
    // actually looking at. By the time they have walked the corridor these are all cached.
    function warmRest() {
        const rest = CORRIDOR_PICKS.slice(4).map(i => url(PHOTOS[i].id))
            .concat([url(PORTRAIT_ID || PHOTOS[PORTRAIT_PICK].id, 800)]);
        let k = 0;
        (function next() {
            if (k >= rest.length)
                return;
            const im = new Image();
            im.onload = im.onerror = () => setTimeout(next, 90);
            im.src = rest[k++];
        })();
    }
    // after the site is live, quietly pre-cache the full-size lightbox versions
    // so tapping any photo opens instantly too
    function warmLightbox() {
        const w = window.innerWidth < 640 ? 1000 : 1400;
        let k = 0;
        (function next() {
            if (k >= PHOTOS.length)
                return;
            const im = new Image();
            im.onload = im.onerror = () => setTimeout(next, 120);
            im.src = url(PHOTOS[k++].id, w);
        })();
    }
}

initSite(document.getElementById("site-root"));
