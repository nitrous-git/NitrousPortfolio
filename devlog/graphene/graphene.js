import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

const host = document.getElementById('graphene-scene');
const status = document.getElementById('scene-status');
const sqrt3 = Math.sqrt(3);
const a1 = [1, 0], a2 = [0.5, sqrt3 / 2], tau = [0, 1 / sqrt3];
const corners = [
    [4 * Math.PI / 3, 0],
    [2 * Math.PI / 3, 2 * Math.PI / sqrt3],
    [-2 * Math.PI / 3, 2 * Math.PI / sqrt3],
    [-4 * Math.PI / 3, 0],
    [-2 * Math.PI / 3, -2 * Math.PI / sqrt3],
    [2 * Math.PI / 3, -2 * Math.PI / sqrt3]
];

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x0b1014);

const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 200);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.domElement.setAttribute('aria-hidden', 'true');
host.appendChild(renderer.domElement);

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = false;
controls.minDistance = 3;
controls.maxDistance = 60;

scene.add(new THREE.HemisphereLight(0xd6ecff, 0x1d2428, 2.2));

const light = new THREE.DirectionalLight(0xffffff, 2.5);
light.position.set(3, 7, 5);
scene.add(light);

let model = new THREE.Group();
scene.add(model);

let currentView = 'lattice';
let visible = true;
let renderPending = false;

const to3 = (p, h = 0) => new THREE.Vector3(p[0], h, -p[1]);

function render() {
    if (visible && !document.hidden) renderer.render(scene, camera);
}

function requestRender() {
    if (renderPending) return;
    renderPending = true;
    requestAnimationFrame(() => {
        renderPending = false;
        render();
    });
}

controls.addEventListener('change', requestRender);

function clearModel() {
    const geometries = new Set(), materials = new Set(), textures = new Set();

    model.traverse(o => {
        if (o.geometry) geometries.add(o.geometry);
        if (o.material) {
            for (const m of (Array.isArray(o.material) ? o.material : [o.material])) {
                materials.add(m);
                if (m.map) textures.add(m.map);
            }
        }
    });

    geometries.forEach(g => g.dispose());
    materials.forEach(m => m.dispose());
    textures.forEach(t => t.dispose());

    scene.remove(model);
    model = new THREE.Group();
    scene.add(model);
}

function label(text, position, color = '#a7b9c5', scale = 0.65) {
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 128;

    const ctx = canvas.getContext('2d');
    ctx.font = '500 47px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = color;
    ctx.fillText(text, 256, 64);

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: texture, depthTest: false, transparent: true })
    );
    sprite.position.copy(position);
    sprite.scale.set(scale * 4, scale, 1);
    model.add(sprite);

    return sprite;
}

function line(points, color, group = model) {
    const geom = new THREE.BufferGeometry().setFromPoints(points);
    const object = new THREE.Line(geom, new THREE.LineBasicMaterial({ color }));
    group.add(object);
    return object;
}

function arrow(p, q, color, text, offset = [0, 0]) {
    const start = to3(p, 0.16);
    const end = to3(q, 0.16);
    const direction = end.clone().sub(start);
    const length = direction.length();

    model.add(new THREE.ArrowHelper(direction.normalize(), start, length, color, 0.16, 0.085));

    if (text) {
        label(
            text,
            to3([q[0] + offset[0], q[1] + offset[1]], 0.22),
            `#${color.toString(16).padStart(6, '0')}`,
            0.19
        );
    }
}

function buildLattice() {
    clearModel();

    const extent = Number(document.getElementById('extent').value);
    document.getElementById('extent-value').textContent = `${2 * extent + 1} × ${2 * extent + 1} unit cells`;

    const count = (2 * extent + 1) ** 2;

    const sphere = new THREE.SphereGeometry(0.105, 16, 10);
    const materialA = new THREE.MeshStandardMaterial({ color: 0x73c8dd, roughness: 0.45, metalness: 0.15 });
    const materialB = new THREE.MeshStandardMaterial({ color: 0xedae73, roughness: 0.5, metalness: 0.1 });

    const sitesA = new THREE.InstancedMesh(sphere, materialA, count);
    const sitesB = new THREE.InstancedMesh(sphere, materialB, count);

    const dummy = new THREE.Object3D();
    const cells = new Map();
    let index = 0;

    for (let n = -extent; n <= extent; n++) {
        for (let m = -extent; m <= extent; m++) {
            const r = [n + m / 2, m * sqrt3 / 2];
            cells.set(`${n},${m}`, r);

            dummy.position.copy(to3(r));
            dummy.updateMatrix();
            sitesA.setMatrixAt(index, dummy.matrix);

            dummy.position.copy(to3([r[0] + tau[0], r[1] + tau[1]]));
            dummy.updateMatrix();
            sitesB.setMatrixAt(index, dummy.matrix);

            index++;
        }
    }

    model.add(sitesA, sitesB);

    const bondVertices = [];
    for (let n = -extent; n <= extent; n++) {
        for (let m = -extent; m <= extent; m++) {
            const r = cells.get(`${n},${m}`);
            for (const [dn, dm] of [[0, 0], [0, -1], [1, -1]]) {
                const other = cells.get(`${n + dn},${m + dm}`);
                if (other) {
                    bondVertices.push(
                        ...to3(r).toArray(),
                        ...to3([other[0] + tau[0], other[1] + tau[1]]).toArray()
                    );
                }
            }
        }
    }

    const bonds = new THREE.BufferGeometry();
    bonds.setAttribute('position', new THREE.Float32BufferAttribute(bondVertices, 3));
    model.add(new THREE.LineSegments(bonds, new THREE.LineBasicMaterial({ color: 0x485a66 })));

    if (document.getElementById('show-vectors').checked) {
        line(
            [[0, 0], [1, 0], [1.5, sqrt3 / 2], [0.5, sqrt3 / 2], [0, 0]].map(p => to3(p, 0.14)),
            0xc7db9c
        );

        arrow([0, 0], a1, 0xc7db9c, 'a₁', [0.04, -0.20]);
        arrow([0, 0], a2, 0xc7db9c, 'a₂', [-0.17, 0.17]);
        arrow([0, 0], tau, 0xeeeeee, 'δ₁', [0.06, 0.18]);
        arrow([0, 0], [-0.5, -1 / (2 * sqrt3)], 0xeeeeee, 'δ₂', [-0.16, -0.14]);
        arrow([0, 0], [0.5, -1 / (2 * sqrt3)], 0xeeeeee, 'δ₃', [0.18, -0.14]);

        label('A', to3([-0.23, 0.07], 0.2), '#73c8dd', 0.16);
        label('B', to3([0.23, 1 / sqrt3], 0.2), '#edae73', 0.16);
    }

    // Local axes in a clear part of the finite patch.
    const origin = [-extent * 1.5 - 0.5, -extent * sqrt3 / 2 - 0.6];
    arrow(origin, [origin[0] + 1, origin[1]], 0x6d899b, 'x', [0.18, 0]);
    arrow(origin, [origin[0], origin[1] + 1], 0x6d899b, 'y', [-0.18, 0.12]);

    if (document.getElementById('show-orbitals').checked) {
        const lobes = new THREE.InstancedMesh(
            new THREE.SphereGeometry(0.13, 12, 8),
            new THREE.MeshStandardMaterial({
                color: 0x9c8dcd,
                transparent: true,
                opacity: 0.45,
                depthWrite: false
            }),
            count * 4
        );

        let l = 0;
        for (const r of cells.values()) {
            for (const offset of [[0, 0], tau]) {
                for (const h of [-0.3, 0.3]) {
                    dummy.position.copy(to3([r[0] + offset[0], r[1] + offset[1]], h));
                    dummy.scale.set(0.75, 1.6, 0.75);
                    dummy.updateMatrix();
                    lobes.setMatrixAt(l++, dummy.matrix);
                }
            }
        }

        model.add(lobes);
    }

    requestRender();
}

function fMagnitude(x, y) {
    const c = Math.cos(x / 2), phase = sqrt3 * y / 2;
    return Math.hypot(1 + 2 * c * Math.cos(phase), -2 * c * Math.sin(phase));
}

function buildBands() {
    clearModel();

    const t = Number(document.getElementById('hopping').value);
    document.getElementById('hopping-value').textContent = `${t.toFixed(2)} eV`;
    document.getElementById('band-scale').textContent =
        `Γ: ±${(3 * t).toFixed(2)} eV · M: ±${t.toFixed(2)} eV`;

    // Barycentric subdivision of the six Γ-K-K triangles: exact BZ corners included.
    const resolution = 30;
    const vertex = (sector, i, j) => [
        (i * corners[sector][0] + j * corners[(sector + 1) % 6][0]) / resolution,
        (i * corners[sector][1] + j * corners[(sector + 1) % 6][1]) / resolution
    ];

    for (const sign of [1, -1]) {
        const positions = [];

        function triangle(p, q, r) {
            for (const v of [p, q, r]) {
                positions.push(v[0], sign * t * fMagnitude(...v) * 0.4, -v[1]);
            }
        }

        for (let s = 0; s < 6; s++) {
            for (let i = 0; i < resolution; i++) {
                for (let j = 0; j < resolution - i; j++) {
                    triangle(vertex(s, i, j), vertex(s, i + 1, j), vertex(s, i, j + 1));
                    if (i + j < resolution - 1) {
                        triangle(vertex(s, i + 1, j), vertex(s, i + 1, j + 1), vertex(s, i, j + 1));
                    }
                }
            }
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
        geometry.computeVertexNormals();

        model.add(new THREE.Mesh(
            geometry,
            new THREE.MeshStandardMaterial({
                color: sign > 0 ? 0x73c8dd : 0xedae73,
                side: THREE.DoubleSide,
                roughness: 0.55,
                metalness: 0.05,
                transparent: true,
                opacity: 0.87,
                depthWrite: true
            })
        ));
    }

    line([...corners, corners[0]].map(p => to3(p)), 0x929da7);

    const k = corners[0], m = [Math.PI, Math.PI / sqrt3];
    line([[0, 0], k, m, [0, 0]].map(p => to3(p, 0.035)), 0xffffff);

    for (const [text, p] of [['Γ', [0, 0]], ['K', k], ['K′', corners[3]], ['M', m]]) {
        label(text, to3([p[0] + 0.2, p[1] + 0.2], 0.15), '#dddddd', 0.24);
    }

    arrow([-5, -4], [-3.5, -4], 0x6d899b, 'a kx', [0.3, 0]);
    arrow([-5, -4], [-5, -2.5], 0x6d899b, 'a ky', [-0.3, 0.25]);

    const energyOrigin = to3([-5, -4]);
    line(
        [
            energyOrigin.clone().add(new THREE.Vector3(0, -5, 0)),
            energyOrigin.clone().add(new THREE.Vector3(0, 5, 0))
        ],
        0x6d899b
    );

    for (const e of [-8, -4, 0, 4, 8]) {
        label(
            String(e),
            energyOrigin.clone().add(new THREE.Vector3(-0.35, e * 0.4, 0)),
            '#8da3b3',
            0.19
        );
    }

    label('E (eV)', energyOrigin.clone().add(new THREE.Vector3(0, 5.35, 0)), '#8da3b3', 0.26);

    requestRender();
}

function resetCamera(top = false) {
    const size = currentView === 'lattice'
        ? Math.max(8, Number(document.getElementById('extent').value) * 2.5)
        : 15;

    controls.target.set(0, 0, 0);
    camera.up.set(0, top ? 0 : 1, top ? -1 : 0);
    camera.position.set(
        top ? 0 : size * 0.45,
        top ? size * 1.15 : size * 0.7,
        top ? 0.001 : size * 0.8
    );
    camera.lookAt(controls.target);
    controls.update();
    requestRender();
}

function switchView(view) {
    currentView = view;

    document.querySelectorAll('.view-button').forEach(button => {
        const active = button.dataset.view === view;
        button.classList.toggle('active', active);
        button.setAttribute('aria-pressed', String(active));
    });

    document.getElementById('lattice-controls').hidden = view !== 'lattice';
    document.getElementById('bands-controls').hidden = view !== 'bands';

    document.getElementById('viewer-tag').textContent = view === 'lattice'
        ? 'Real space · coordinates in units of a'
        : 'Reciprocal space · a kx, a ky · energy in eV';

    document.getElementById('viewer-caption').textContent = view === 'lattice'
        ? 'A: cyan · B: orange · Cell: green · Drag: rotate · Scroll / pinch: zoom · Right-click / two fingers: pan'
        : 'Conduction: cyan · Valence: orange · Outline: first Brillouin zone · White path: Γ → K → M → Γ · Height represents E (eV).';

    if (view === 'lattice') buildLattice();
    else buildBands();

    resetCamera();
}

function resize() {
    const width = host.clientWidth, height = host.clientHeight;
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
    renderer.setSize(width, height, false);
    requestRender();
}

const resizeObserver = new ResizeObserver(resize);
resizeObserver.observe(host);

const intersectionObserver = new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible) requestRender();
});
intersectionObserver.observe(host);

document.addEventListener('visibilitychange', () => {
    if (!document.hidden) requestRender();
});

document.querySelectorAll('.view-button').forEach(button =>
    button.addEventListener('click', () => switchView(button.dataset.view))
);

for (const id of ['show-vectors', 'show-orbitals']) {
    document.getElementById(id).addEventListener('change', buildLattice);
}

document.getElementById('extent').addEventListener('input', () => {
    buildLattice();
    resetCamera();
});

document.getElementById('hopping').addEventListener('input', buildBands);

document.getElementById('top-view').addEventListener('click', () => resetCamera(true));
document.getElementById('reset-view').addEventListener('click', () => resetCamera());

renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    status.classList.remove('ready');
    status.textContent = 'Graphics context interrupted. Reload the page to restart the 3D view.';
});

window.addEventListener('pagehide', event => {
    if (event.persisted) return;
    resizeObserver.disconnect();
    intersectionObserver.disconnect();
    controls.dispose();
    clearModel();
    renderer.dispose();
}, { once: true });

switchView('lattice');
resize();
host.classList.add('interactive');
status.classList.add('ready');