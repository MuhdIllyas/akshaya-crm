// Kerala coast at dusk with a lighthouse, for the platform-admin login (the
// panel that watches over every centre). Same shape and clip as
// BackwatersScene; colours come from the --lh-* variables set in AuthShell,
// so the drawing works in light and dark.

const Palm = ({ x, base, height, lean = 0, scale = 1 }) => {
  const top = base - height;
  const tx = x + lean;
  const fronds = [
    [-46, -4, -30, -20], [-40, -26, -22, -34], [-8, -40, -2, -30], [30, -30, 18, -36],
    [46, -6, 28, -22], [-30, 14, -22, 2], [32, 16, 24, 2],
  ];
  return (
    <g style={{ stroke: "var(--lh-palm)", fill: "none" }} strokeLinecap="round" strokeLinejoin="round">
      <path d={`M${x} ${base} C${x + lean * 0.2} ${base - height * 0.5} ${tx - lean * 0.1} ${top + height * 0.2} ${tx} ${top}`} strokeWidth={6 * scale} />
      {fronds.map(([ex, ey, cx, cy], i) => (
        <path key={i} d={`M${tx} ${top} Q${tx + cx * scale} ${top + cy * scale} ${tx + ex * scale} ${top + ey * scale}`} strokeWidth={4 * scale} />
      ))}
    </g>
  );
};

// Tower: tapered, red and white bands, lantern room on top.
const Lighthouse = ({ x, base }) => {
  const h = 250;
  const top = base - h;
  const wBase = 46;
  const wTop = 30;
  const at = (t) => {
    // half-width at fraction t from base (0) to top (1)
    const w = wBase + (wTop - wBase) * t;
    return w / 2;
  };
  const bands = [0, 0.2, 0.4, 0.6, 0.8];
  return (
    <g>
      {/* white body */}
      <path d={`M${x - at(0)} ${base} L${x - at(1)} ${top} L${x + at(1)} ${top} L${x + at(0)} ${base} Z`} style={{ fill: "var(--lh-tower)" }} />
      {/* red bands */}
      {bands.map((t, i) => {
        const y1 = base - h * t;
        const y2 = base - h * (t + 0.1);
        return (
          <path
            key={i}
            d={`M${x - at(t)} ${y1} L${x - at(t + 0.1)} ${y2} L${x + at(t + 0.1)} ${y2} L${x + at(t)} ${y1} Z`}
            style={{ fill: "var(--lh-band)" }}
          />
        );
      })}
      {/* gallery and lantern */}
      <rect x={x - 22} y={top - 6} width="44" height="6" rx="1" style={{ fill: "var(--lh-iron)" }} />
      <rect x={x - 13} y={top - 30} width="26" height="24" style={{ fill: "var(--lh-lamp)" }} />
      <path d={`M${x - 13} ${top - 18} H${x + 13} M${x} ${top - 30} V${top - 6}`} style={{ stroke: "var(--lh-iron)" }} strokeWidth="2" />
      <path d={`M${x - 16} ${top - 30} L${x} ${top - 46} L${x + 16} ${top - 30} Z`} style={{ fill: "var(--lh-iron)" }} />
      <circle cx={x} cy={top - 49} r="3" style={{ fill: "var(--lh-iron)" }} />
      {/* door */}
      <path d={`M${x - 7} ${base} V${base - 18} A7 7 0 0 1 ${x + 7} ${base - 18} V${base} Z`} style={{ fill: "var(--lh-iron)" }} />
    </g>
  );
};

const LighthouseScene = ({ className = "" }) => {
  const lx = 470; // lighthouse x
  const ground = 452;
  const lampY = ground - 250 - 18;
  return (
    <svg
      className={className}
      viewBox="0 0 640 720"
      preserveAspectRatio="xMinYMid slice"
      role="img"
      aria-label="Illustration of a Kerala coastal lighthouse at dusk"
    >
      <defs>
        <clipPath id="lh-wave">
          <path d="M120 0 H640 V720 H140 C96 660 108 590 158 540 C226 472 214 380 150 318 C90 260 64 170 92 96 C104 60 116 30 120 0 Z" />
        </clipPath>
        <linearGradient id="lh-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--lh-sky-top)" }} />
          <stop offset="0.65" style={{ stopColor: "var(--lh-sky-mid)" }} />
          <stop offset="1" style={{ stopColor: "var(--lh-sky-bottom)" }} />
        </linearGradient>
        <linearGradient id="lh-sea" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--lh-sea-top)" }} />
          <stop offset="1" style={{ stopColor: "var(--lh-sea-bottom)" }} />
        </linearGradient>
        <linearGradient id="lh-beam" x1="1" y1="0" x2="0" y2="0">
          <stop offset="0" style={{ stopColor: "var(--lh-beam)", stopOpacity: 0.55 }} />
          <stop offset="1" style={{ stopColor: "var(--lh-beam)", stopOpacity: 0 }} />
        </linearGradient>
      </defs>

      <g clipPath="url(#lh-wave)">
        <rect width="640" height="720" fill="url(#lh-sky)" />

        {/* evening stars */}
        <g style={{ fill: "var(--lh-star)" }}>
          {[[200, 70], [260, 130], [330, 60], [400, 110], [560, 70], [610, 150], [300, 200], [180, 180]].map(([cx, cy], i) => (
            <circle key={i} cx={cx} cy={cy} r={i % 3 === 0 ? 1.8 : 1.2} />
          ))}
        </g>

        {/* setting sun on the horizon */}
        <circle cx="250" cy="430" r="46" style={{ fill: "var(--lh-sun)" }} />

        {/* sea */}
        <rect x="90" y="430" width="550" height="290" fill="url(#lh-sea)" />
        <path d="M150 446 H350" style={{ stroke: "var(--lh-sun)" }} strokeWidth="3" strokeLinecap="round" opacity="0.7" />
        <path d="M185 470 H320" style={{ stroke: "var(--lh-sun)" }} strokeWidth="3" strokeLinecap="round" opacity="0.5" />
        <path d="M215 494 H290" style={{ stroke: "var(--lh-sun)" }} strokeWidth="3" strokeLinecap="round" opacity="0.35" />

        {/* light beams sweeping out to sea */}
        <g className="lh-beams" style={{ transformOrigin: `${lx}px ${lampY}px` }}>
          <path d={`M${lx} ${lampY - 6} L120 ${lampY - 110} L120 ${lampY + 40} L${lx} ${lampY + 6} Z`} fill="url(#lh-beam)" />
        </g>

        {/* rocky headland */}
        <path d={`M330 ${ground + 6} C380 ${ground - 18} 420 ${ground - 26} 470 ${ground - 22} C530 ${ground - 18} 590 ${ground - 30} 640 ${ground - 34} V720 H330 Z`} style={{ fill: "var(--lh-land)" }} />
        <path d={`M300 ${ground + 30} C350 ${ground + 4} 400 ${ground + 8} 450 ${ground + 18} C520 ${ground + 30} 580 ${ground + 22} 640 ${ground + 18} V720 H300 Z`} style={{ fill: "var(--lh-land-near)" }} />

        <Lighthouse x={lx} base={ground - 20} />

        <Palm x={560} base={ground - 24} height={150} lean={22} scale={1} />
        <Palm x={612} base={ground - 28} height={200} lean={-12} scale={1.25} />
        <Palm x={392} base={ground - 16} height={95} lean={-14} scale={0.7} />

        {/* waves on the rocks */}
        <g style={{ stroke: "var(--lh-foam)" }} strokeWidth="2.5" strokeLinecap="round" fill="none">
          <path d="M318 494 q14 -8 28 0 t28 0" />
          <path d="M250 530 q14 -8 28 0 t28 0" />
          <path d="M200 568 q14 -8 28 0" />
        </g>
      </g>

      <path
        d="M84 0 C80 30 68 60 56 96 C28 170 54 260 114 318 C178 380 190 472 122 540 C72 590 60 660 104 720"
        fill="none"
        style={{ stroke: "var(--scene-dash)" }}
        strokeWidth="2"
        strokeDasharray="7 8"
      />

      <style>{`
        @keyframes lhSweep { 0%, 100% { transform: rotate(-4deg); } 50% { transform: rotate(5deg); } }
        .lh-beams { animation: lhSweep 7s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) { .lh-beams { animation: none; } }
      `}</style>
    </svg>
  );
};

export default LighthouseScene;
