# Graphene — from the lattice to Dirac cones

English page for NitrousPortfolio. Reuses `styles.css` and `devlog/devlog-article.css` from the repository's `master` branch (included to preview the package). Additional styles are isolated in `devlog/graphene/graphene.css`.

## Integration

Copy the new file `devlog/graphene-tight-binding.html`, the `devlog/graphene/` folder, and `assets/devlog_graphene/` into the corresponding locations in the portfolio. The two existing stylesheets have not been modified.

`devlog.html` is a copy of the repository version inspected, with a single link added under **Physics & Simulation**. If the repository has changed since then, simply add:

```html
<a href="devlog/graphene-tight-binding.html">Graphene — from the lattice to Dirac cones</a>
```

No push or deployment has been performed. Navigation links to the other pages target the portfolio's existing pages; those pages are not included in this package of additions.

## Preview

From the portfolio root:

```sh
python -m http.server 8000
```

Open http://localhost:8000/devlog/graphene-tight-binding.html. Use HTTP rather than opening the page directly with `file://`, so JavaScript modules and JSON data can load correctly.

## Reproduce the results

```sh
python -m pip install -r devlog/graphene/requirements.txt
python devlog/graphene/simulate.py
```

The script has been run and validated with NumPy 2.3.5 and Matplotlib 3.10.8. The simulation is independent of the browser. By default, it writes five PNGs, `bands.csv`, and `results.json` to `assets/devlog_graphene/`. It checks Hermiticity, the spectrum against diagonalization, both Bloch gauges, reciprocal geometry, periodicity, inversion, the Γ/K/K′/M points, and the Dirac slope.

The code displayed in the HTML is a complete copy of the script, readable offline and without JavaScript. After changing the Python script, update this copy:

```python
from pathlib import Path
import html, re
script = Path('devlog/graphene/simulate.py').read_text(encoding='utf-8')
page = Path('devlog/graphene-tight-binding.html')
text = page.read_text(encoding='utf-8')
text = re.sub(r'(<code id="python-source"[^>]*>).*?(</code>)',
              lambda m: m.group(1) + html.escape(script) + m.group(2),
              text, flags=re.S)
page.write_text(text, encoding='utf-8')
```

## Conventions

- `a = 2.46 Å`: triangular lattice constant; `d = a/√3`: C–C distance.
- `a1 = (a, 0)`, `a2 = (a/2, √3 a/2)`, `tauB = (0, a/√3)`.
- `t = 2.7 eV > 0`, hopping amplitude `−t`, zero on-site energy.
- Cell gauge: `f(k) = 1 + exp(−i k·a2) + exp(i k·(a1−a2))`.
- `H_AB = −t f`, `H_BA = −t f*`.
- `K = (4π/(3a), 0)` and `Kprime = −K`.
- Lattice-view coordinates are in units of `a`. In Three.js, the mathematical plane `(x,y)` is represented by `(x,0,−y)`.
- In the band view, horizontal coordinates are `a kx`, `a ky`; height represents `E` in eV, with a visual scaling factor of 0.4.

The finite patch in the explorer is a geometric representation, while the bands belong to an infinite periodic crystal. The pz orbitals are schematic. The `t` control changes only the 3D band visualization; the Python figures and reference values retain `t = 2.7 eV`.

## Browser dependencies

Three.js **r180 / 0.180.0** and OrbitControls are supplied locally, with their MIT license. MathJax **3.2.2**, using its SVG engine, is supplied locally with its Apache 2.0 license. No CDN, npm, compiler, or Python backend is required for hosting. The SVG engine includes the glyphs needed for the equations.

The explorer renders on demand, limits the pixel ratio to 2, and uses instanced meshes. It handles resizing and pauses rendering while off screen. If WebGL is unavailable, the static lattice figure remains visible; the page and Python code remain readable.

## Verification

Python numerical checks passed; the maximum difference between the formula and diagonalization is 1.7763568394002505e-15 eV. JavaScript syntax, file references, anchors, and the embedded Python source were verified. Three.js geometry was verified without a GPU: 162 sites and 217 bonds for 9 × 9 unit cells, bond lengths a/√3, two surfaces each covering reciprocal area 8π²/√3 in a·k units, exact valley vertices, and the effect of changing t.

The Matplotlib images were inspected. Final equation and WebGL rendering in a browser could not be verified in this environment: the available browser blocks the local server.

The English translation covers the article, accessible descriptions, interactive controls, status messages, Python documentation and plot labels, and these instructions. Numerical conventions and calculations are preserved.
