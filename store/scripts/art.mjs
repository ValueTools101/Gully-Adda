/** Original Gully Adda artwork as SVG strings (CC0, made for this project). */
export const C = {
  cream: '#FFF4DC', ink: '#2B1B17', saffron: '#FF9933', mustard: '#F2C14E', maroon: '#7A1F3D',
  pink: '#E84A8A', teal: '#1FA2A6', leaf: '#3E9E4F', sky: '#3B7DD8', red: '#E53935',
};

function pips(cx, cy, s, n) {
  const p = { 1: [[0, 0]], 2: [[-1, -1], [1, 1]], 3: [[-1, -1], [0, 0], [1, 1]], 4: [[-1, -1], [1, -1], [-1, 1], [1, 1]], 5: [[-1, -1], [1, -1], [0, 0], [-1, 1], [1, 1]], 6: [[-1, -1], [1, -1], [-1, 0], [1, 0], [-1, 1], [1, 1]] }[n];
  return p.map(([x, y]) => `<circle cx="${cx + x * s * 0.25}" cy="${cy + y * s * 0.25}" r="${s * 0.085}" fill="${C.ink}"/>`).join('');
}

export function die(cx, cy, s, n, rot = 0, fill = '#fff') {
  return `<g transform="rotate(${rot} ${cx} ${cy})">
    <rect x="${cx - s / 2 + s * 0.06}" y="${cy - s / 2 + s * 0.08}" width="${s}" height="${s}" rx="${s * 0.2}" fill="${C.ink}"/>
    <rect x="${cx - s / 2}" y="${cy - s / 2}" width="${s}" height="${s}" rx="${s * 0.2}" fill="${fill}" stroke="${C.ink}" stroke-width="${s * 0.06}"/>
    ${pips(cx, cy, s, n)}</g>`;
}

export function kite(cx, cy, s, rot = -12) {
  const h = s, w = s * 0.78;
  return `<g transform="rotate(${rot} ${cx} ${cy})">
    <path d="M${cx} ${cy + h * 0.5} q ${-s * 0.15} ${s * 0.35} ${s * 0.05} ${s * 0.6} t ${-s * 0.05} ${s * 0.5}" fill="none" stroke="${C.ink}" stroke-width="${s * 0.03}" stroke-linecap="round"/>
    <polygon points="${cx},${cy - h / 2 + s * 0.05} ${cx + w / 2 + s * 0.04},${cy + s * 0.05} ${cx},${cy + h / 2 + s * 0.05} ${cx - w / 2 + s * 0.04},${cy + s * 0.05}" fill="${C.ink}"/>
    <polygon points="${cx},${cy - h / 2} ${cx + w / 2},${cy} ${cx},${cy + h / 2} ${cx - w / 2},${cy}" fill="${C.pink}" stroke="${C.ink}" stroke-width="${s * 0.05}" stroke-linejoin="round"/>
    <polygon points="${cx},${cy - h / 2} ${cx + w / 2},${cy} ${cx},${cy}" fill="${C.mustard}" stroke="${C.ink}" stroke-width="${s * 0.035}" stroke-linejoin="round"/>
    <polygon points="${cx},${cy} ${cx - w / 2},${cy} ${cx},${cy + h / 2}" fill="${C.teal}" stroke="${C.ink}" stroke-width="${s * 0.035}" stroke-linejoin="round"/>
    <polygon points="${cx},${cy + h / 2} ${cx - s * 0.1},${cy + h / 2 + s * 0.14} ${cx + s * 0.1},${cy + h / 2 + s * 0.14}" fill="${C.saffron}" stroke="${C.ink}" stroke-width="${s * 0.03}"/>
  </g>`;
}

function sunburst(cx, cy, r, n, color, opacity = 0.35) {
  let d = '';
  for (let i = 0; i < n; i++) {
    const a1 = (i * 2 * Math.PI) / n, a2 = a1 + Math.PI / n;
    d += `M${cx} ${cy} L${cx + r * Math.cos(a1)} ${cy + r * Math.sin(a1)} L${cx + r * Math.cos(a2)} ${cy + r * Math.sin(a2)} Z `;
  }
  return `<path d="${d}" fill="${color}" opacity="${opacity}"/>`;
}

/** App icon (square, full-bleed background). `safe` shrinks content for adaptive icons. */
export function iconSvg(size = 1024, { background = true, safe = 1 } = {}) {
  const s = size, k = safe;
  const cx = s / 2, cy = s / 2;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${s}" height="${s}" viewBox="0 0 ${s} ${s}">
    ${background ? `<rect width="${s}" height="${s}" fill="${C.saffron}"/>${sunburst(cx, cy, s, 18, C.mustard, 0.55)}` : ''}
    <g transform="translate(${cx} ${cy}) scale(${k}) translate(${-cx} ${-cy})">
      <circle cx="${cx}" cy="${cy}" r="${s * 0.36}" fill="${C.cream}" stroke="${C.ink}" stroke-width="${s * 0.025}"/>
      ${kite(cx - s * 0.08, cy - s * 0.08, s * 0.42)}
      ${die(cx + s * 0.13, cy + s * 0.14, s * 0.24, 6, 12)}
    </g>
  </svg>`;
}

export function featureSvg() {
  const w = 1024, h = 500;
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}">
    <rect width="${w}" height="${h}" fill="${C.saffron}"/>
    ${sunburst(780, 250, 900, 26, C.mustard, 0.5)}
    <rect x="20" y="20" width="${w - 40}" height="${h - 40}" rx="28" fill="none" stroke="${C.ink}" stroke-width="6" stroke-dasharray="18 12"/>
    ${kite(820, 190, 230, 14)}
    ${die(700, 360, 110, 6, -14)}
    ${die(880, 390, 80, 3, 18, '#FFF59D')}
    <g font-family="'Baloo 2', 'Arial Black', sans-serif" font-weight="800">
      <text x="64" y="215" font-size="128" fill="${C.ink}">Gully</text>
      <text x="58" y="209" font-size="128" fill="${C.maroon}">Gully</text>
      <text x="64" y="335" font-size="128" fill="${C.ink}">Adda</text>
      <text x="58" y="329" font-size="128" fill="${C.cream}">Adda</text>
    </g>
    <rect x="60" y="370" width="470" height="62" rx="31" fill="${C.pink}" stroke="${C.ink}" stroke-width="5"/>
    <text x="295" y="413" text-anchor="middle" font-family="'Poppins', Arial, sans-serif" font-weight="700" font-size="30" fill="#fff">90s RETRO ADDA GAMES</text>
  </svg>`;
}

export function splashSvg() {
  return iconSvg(800, { background: false, safe: 1 });
}
