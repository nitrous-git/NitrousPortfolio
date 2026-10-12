"""Monolayer graphene, orthogonal nearest-neighbor tight binding.
Run: python devlog/graphene/simulate.py
Units: lengths in Å, k in Å⁻¹, energies in eV. No web backend required.
"""
from pathlib import Path
import argparse
import json
import numpy as np
import matplotlib

matplotlib.use("Agg")

import matplotlib.pyplot as plt
from matplotlib.path import Path as MplPath

A = 2.46
T = 2.7
HBAR_EV_S = 6.582119569e-16
SQRT3 = np.sqrt(3.0)
A1 = A * np.array([1.0, 0.0])
A2 = A * np.array([0.5, SQRT3 / 2])
TAU_B = np.array([0.0, A / SQRT3])
DELTA = np.array([TAU_B, TAU_B - A2, TAU_B + A1 - A2])
B1 = 2 * np.pi / A * np.array([1.0, -1.0 / SQRT3])
B2 = 2 * np.pi / A * np.array([0.0, 2.0 / SQRT3])
GAMMA = np.zeros(2)
K = np.array([4 * np.pi / (3 * A), 0.0])
KP = -K
M = (B1 + B2) / 2
BZ = np.array([
    [4 * np.pi / (3 * A), 0],
    [2 * np.pi / (3 * A), 2 * np.pi / (SQRT3 * A)],
    [-2 * np.pi / (3 * A), 2 * np.pi / (SQRT3 * A)],
    [-4 * np.pi / (3 * A), 0],
    [-2 * np.pi / (3 * A), -2 * np.pi / (SQRT3 * A)],
    [2 * np.pi / (3 * A), -2 * np.pi / (SQRT3 * A)],
])


def structure_factor(k):
    """f(k) in the cell gauge; accepts (..., 2)."""
    k = np.asarray(k)
    return 1 + np.exp(-1j * (k @ A2)) + np.exp(1j * (k @ (A1 - A2)))


def hamiltonian(k, t=T, epsilon0=0.0):
    f = structure_factor(k)
    h = np.zeros(f.shape + (2, 2), dtype=complex)
    h[..., 0, 0] = h[..., 1, 1] = epsilon0
    h[..., 0, 1] = -t * f
    h[..., 1, 0] = -t * f.conj()
    return h


def energies(k, t=T):
    positive = t * np.abs(structure_factor(k))
    return np.stack((-positive, positive), axis=-1)


def symmetry_path(samples=250):
    points = [GAMMA, K, M, GAMMA]
    pieces = [
        np.linspace(p, q, samples, endpoint=False)
        for p, q in zip(points[:-1], points[1:])
    ]
    k = np.concatenate(pieces + [np.array([GAMMA])])
    s = np.r_[0, np.cumsum(np.linalg.norm(np.diff(k, axis=0), axis=1))]
    return k, s, s[[0, samples, 2 * samples, 3 * samples]]


def validate():
    rng = np.random.default_rng(42)
    k = rng.uniform(-2, 2, (200, 2))
    h = hamiltonian(k)

    assert np.allclose(h, h.conj().swapaxes(-1, -2))
    assert np.allclose(np.linalg.eigvalsh(h), energies(k), atol=1e-12)
    assert np.allclose(np.linalg.norm(DELTA, axis=1), A / SQRT3)
    assert np.allclose(
        np.array([A1, A2]) @ np.array([B1, B2]).T, 2 * np.pi * np.eye(2)
    )

    f_atom = np.exp(1j * (k @ DELTA.T)).sum(axis=-1)
    assert np.allclose(f_atom, np.exp(1j * (k @ TAU_B)) * structure_factor(k))

    assert np.allclose(energies(k + B1), energies(k))
    assert np.allclose(energies(k + B2), energies(k))
    assert np.allclose(energies(-k), energies(k))

    for name, point, expected in [
        ("Gamma", GAMMA, 3 * T),
        ("K", K, 0),
        ("Kprime", KP, 0),
        ("M", M, T),
    ]:
        assert np.isclose(energies(point)[1], expected, atol=1e-12), name

    c = SQRT3 * A / 2
    for xi in [-1, 1]:
        q = np.array([1e-7, -2e-7])
        approx = c * (-xi * q[0] + 1j * q[1])
        assert np.allclose(structure_factor(xi * K + q), approx, atol=1e-12)

    # Isotropic slope in the small-q limit; excludes the degeneracy itself.
    angles = np.linspace(0, 2 * np.pi, 100, endpoint=False)
    q = 1e-5 * np.column_stack((np.cos(angles), np.sin(angles)))
    slope = energies(K + q)[:, 1] / np.linalg.norm(q, axis=1)
    assert np.allclose(slope, c * T, rtol=1e-5)

    return {
        "a_angstrom": A,
        "d_CC_angstrom": A / SQRT3,
        "t_eV": T,
        "v_F_m_s": c * T * 1e-10 / HBAR_EV_S,
        "points_eV": {
            n: energies(p).tolist()
            for n, p in [("Gamma", GAMMA), ("K", K), ("Kprime", KP), ("M", M)]
        },
        "eigensolver_max_error_eV": float(
            np.max(np.abs(np.linalg.eigvalsh(h) - energies(k)))
        ),
        "validation": "passed",
    }


def style():
    plt.rcParams.update({
        "figure.facecolor": "#111111",
        "axes.facecolor": "#111111",
        "text.color": "#dddddd",
        "axes.labelcolor": "#bbbbbb",
        "xtick.color": "#999999",
        "ytick.color": "#999999",
        "axes.edgecolor": "#444444",
        "grid.color": "#333333",
        "font.family": "DejaVu Sans",
        "font.size": 11,
        "savefig.facecolor": "#111111",
    })


def save(fig, output, name):
    fig.savefig(output / (name + ".png"), dpi=180, bbox_inches="tight")
    plt.close(fig)


def plot_lattice(output):
    fig, ax = plt.subplots(figsize=(10, 5.2))

    cells = {
        (n, m): n * A1 + m * A2
        for n in range(-4, 5)
        for m in range(-4, 5)
    }

    for (n, m), r in cells.items():
        for offset in [(0, 0), (0, -1), (1, -1)]:
            key = (n + offset[0], m + offset[1])
            if key in cells:
                end = cells[key] + TAU_B
                ax.plot(*np.array([r, end]).T, color="#424950", lw=1.3, zorder=1)

    points = np.array(list(cells.values()))
    ax.scatter(*points.T, s=35, color="#73c8dd", label="Sublattice A", zorder=2)
    ax.scatter(*(points + TAU_B).T, s=35, color="#edae73", label="Sublattice B", zorder=2)

    cell = np.array([GAMMA, A1, A1 + A2, A2, GAMMA])
    ax.plot(*cell.T, "--", color="#c7db9c", lw=1.7, label="Primitive cell")

    for i, d in enumerate(DELTA):
        ax.annotate(
            "",
            xy=d,
            xytext=GAMMA,
            arrowprops={"arrowstyle": "->", "color": "#eeeeee", "lw": 1.8},
        )
        ax.text(*(d * 0.6 + [0.12, 0.08]), rf"$\delta_{i+1}$", color="white")

    for label, v in [(r"$a_1$", A1), (r"$a_2$", A2)]:
        ax.annotate(
            "",
            xy=v,
            xytext=[0, 0],
            arrowprops={"arrowstyle": "->", "color": "#c7db9c"},
        )
        ax.text(*(v * 0.52 + [0.08, 0.15]), label, color="#c7db9c")

    ax.set(
        xlim=(-6.5, 6.5),
        ylim=(-3.9, 4.5),
        xlabel="x (Å)",
        ylabel="y (Å)",
        title="Real-space lattice • two sites per cell, three neighbors per site",
    )
    ax.set_aspect("equal")
    ax.legend(
        loc="upper right",
        facecolor="#111111",
        edgecolor="#333333",
        fontsize=9,
    )

    save(fig, output, "lattice")


def plot_bands(output):
    k, s, ticks = symmetry_path()
    e = energies(k)

    fig, ax = plt.subplots(figsize=(10, 5.5))
    ax.plot(s, e[:, 1], color="#73c8dd", lw=2, label=r"$E_+$ · conduction")
    ax.plot(s, e[:, 0], color="#edae73", lw=2, label=r"$E_-$ · valence")

    for tick in ticks:
        ax.axvline(tick, color="#333333", lw=0.8)

    ax.axhline(0, color="#777777", ls="--", lw=0.8)
    ax.set(
        xticks=ticks,
        xticklabels=[r"$\Gamma$", "K", "M", r"$\Gamma$"],
        ylabel="E (eV)",
        xlabel="Cumulative distance in reciprocal space (Å⁻¹)",
        title="Band diagram • Γ → K → M → Γ",
    )
    ax.legend(frameon=False)
    ax.set_xlim(s[0], s[-1])

    save(fig, output, "bands")

    np.savetxt(
        output / "bands.csv",
        np.column_stack((s, k, e)),
        delimiter=",",
        header="path_Ainv,kx_Ainv,ky_Ainv,Eminus_eV,Eplus_eV",
        comments="",
    )


def reciprocal_grid(n):
    x = np.linspace(-K[0] * 1.06, K[0] * 1.06, n)
    y = np.linspace(-B2[1] / 2 * 1.06, B2[1] / 2 * 1.06, n)
    xx, yy = np.meshgrid(x, y)
    kk = np.stack((xx, yy), axis=-1)
    inside = MplPath(np.vstack((BZ, BZ[0]))).contains_points(
        kk.reshape(-1, 2), radius=1e-10
    ).reshape(xx.shape)
    ep = energies(kk)[..., 1]
    return xx, yy, np.where(inside, ep, np.nan)


def plot_maps(output, n):
    xx, yy, ep = reciprocal_grid(n)

    fig, ax = plt.subplots(figsize=(9, 6.4))
    im = ax.pcolormesh(xx, yy, ep, cmap="viridis", shading="auto", vmin=0, vmax=3 * T)

    edge = np.vstack((BZ, BZ[0]))
    ax.plot(*edge.T, color="#cccccc", lw=1)
    ax.plot(*np.array([GAMMA, K, M, GAMMA]).T, "w--", lw=1.3, label="Γ → K → M → Γ")

    for name, p in [("Γ", GAMMA), ("K", K), ("K′", KP), ("M", M)]:
        ax.annotate(
            name,
            p,
            xytext=(6, 8),
            textcoords="offset points",
            color="white",
        )

    ax.set_aspect("equal")
    ax.set(
        xlabel="kx (Å⁻¹)",
        ylabel="ky (Å⁻¹)",
        title="First Brillouin zone • E₊(kx, ky)",
    )
    fig.colorbar(im, ax=ax, label="E₊ (eV)")

    save(fig, output, "energy-map")

    fig = plt.figure(figsize=(10, 7))
    ax = fig.add_subplot(111, projection="3d")
    ax.plot_surface(
        xx, yy, ep, color="#73c8dd", alpha=0.85, linewidth=0, rcount=110, ccount=110
    )
    ax.plot_surface(
        xx, yy, -ep, color="#edae73", alpha=0.85, linewidth=0, rcount=110, ccount=110
    )
    ax.plot(edge[:, 0], edge[:, 1], np.zeros(len(edge)), color="#999999", lw=1)
    ax.set(
        xlabel="kx (Å⁻¹)",
        ylabel="ky (Å⁻¹)",
        zlabel="E (eV)",
        title="π and π* bands • first Brillouin zone",
    )
    ax.view_init(elev=24, azim=-58)
    ax.set_box_aspect((1.3, 1, 0.85))

    fig.text(0.88, 0.77, "E (eV)", color="#bbbbbb", fontsize=11)

    for axis in [ax.xaxis, ax.yaxis, ax.zaxis]:
        axis.pane.fill = False

    save(fig, output, "dispersion-3d")


def plot_dirac(output):
    q = np.linspace(-0.18, 0.18, 501)
    exact = energies(K + np.column_stack((q, np.zeros_like(q))))
    linear = SQRT3 * A * T / 2 * np.abs(q)

    fig, ax = plt.subplots(figsize=(10, 5))
    ax.plot(q, exact[:, 1], color="#73c8dd", label="Exact tight binding")
    ax.plot(q, exact[:, 0], color="#73c8dd")
    ax.plot(q, linear, "--", color="#edae73", label="Dirac approximation")
    ax.plot(q, -linear, "--", color="#edae73")
    ax.set(
        xlabel="qx around K (Å⁻¹), qy = 0",
        ylabel="E (eV)",
        title="Low-energy limit • ℏvF slope and nonlinear corrections",
    )
    ax.grid(alpha=0.4)
    ax.legend(frameon=False)

    save(fig, output, "dirac-limit")


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path(__file__).resolve().parents[2] / "assets/devlog_graphene",
    )
    parser.add_argument("--grid", type=int, default=361)
    args = parser.parse_args()

    if args.grid < 51:
        parser.error("--grid must be at least 51")

    metrics = validate()
    args.output.mkdir(parents=True, exist_ok=True)
    style()

    plot_lattice(args.output)
    plot_bands(args.output)
    plot_maps(args.output, args.grid)
    plot_dirac(args.output)

    (args.output / "results.json").write_text(
        json.dumps(metrics, indent=2, ensure_ascii=False) + "\n",
        encoding="utf-8",
    )
    print(json.dumps(metrics, indent=2, ensure_ascii=False))


if __name__ == "__main__":
    main()