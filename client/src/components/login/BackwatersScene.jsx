// Kerala backwaters illustration for the login page. Colours come from the
// --scene-* variables in Login.jsx, so the same drawing works in light and dark.

const Palm = ({ x, base, height, lean = 0, scale = 1 }) => {
  const top = base - height;
  const tx = x + lean;
  const fronds = [
    [-46, -4, -30, -20], [-40, -26, -22, -34], [-8, -40, -2, -30], [30, -30, 18, -36],
    [46, -6, 28, -22], [-30, 14, -22, 2], [32, 16, 24, 2],
  ];
  return (
    <g style={{ stroke: "var(--scene-palm)", fill: "none" }} strokeLinecap="round" strokeLinejoin="round">
      <path d={`M${x} ${base} C${x + lean * 0.2} ${base - height * 0.5} ${tx - lean * 0.1} ${top + height * 0.2} ${tx} ${top}`} strokeWidth={6 * scale} />
      {fronds.map(([ex, ey, cx, cy], i) => (
        <path key={i} d={`M${tx} ${top} Q${tx + cx * scale} ${top + cy * scale} ${tx + ex * scale} ${top + ey * scale}`} strokeWidth={4 * scale} />
      ))}
    </g>
  );
};

const BackwatersScene = ({ className = "" }) => (
  <svg
    className={className}
    viewBox="0 0 640 720"
    preserveAspectRatio="xMinYMid slice"
    role="img"
    aria-label="Illustration of Kerala backwaters with palm trees"
  >
    <defs>
      <clipPath id="login-wave">
        <path d="M120 0 H640 V720 H140 C96 660 108 590 158 540 C226 472 214 380 150 318 C90 260 64 170 92 96 C104 60 116 30 120 0 Z" />
      </clipPath>
      <linearGradient id="login-sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style={{ stopColor: "var(--scene-sky-top)" }} />
        <stop offset="1" style={{ stopColor: "var(--scene-sky-bottom)" }} />
      </linearGradient>
      <linearGradient id="login-water" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" style={{ stopColor: "var(--scene-water-top)" }} />
        <stop offset="1" style={{ stopColor: "var(--scene-water-bottom)" }} />
      </linearGradient>
    </defs>

    <g clipPath="url(#login-wave)">
      <rect width="640" height="720" fill="url(#login-sky)" />
      <circle cx="500" cy="190" r="42" style={{ fill: "var(--scene-sun)" }} />
      <path d="M90 360 C170 320 250 330 330 350 C420 300 520 300 640 330 V420 H90 Z" style={{ fill: "var(--scene-hill-far)" }} />
      <path d="M90 400 C200 370 300 390 400 380 C500 365 570 380 640 372 V440 H90 Z" style={{ fill: "var(--scene-hill-near)" }} />
      <rect x="90" y="430" width="550" height="290" fill="url(#login-water)" />

      {/* Reflections */}
      <g opacity="0.22" style={{ fill: "var(--scene-palm)" }}>
        <path d="M90 430 C200 455 300 445 400 450 C500 458 570 446 640 452 V470 H90 Z" />
      </g>

      <Palm x={470} base={440} height={190} lean={-26} scale={1.25} />
      <Palm x={560} base={440} height={150} lean={22} scale={1} />
      <Palm x={610} base={442} height={225} lean={-14} scale={1.35} />
      <Palm x={205} base={432} height={110} lean={16} scale={0.75} />

      {/* Ripples, kept high on the water so they never reach the footer text */}
      <g style={{ stroke: "var(--scene-ripple)" }} strokeWidth="2.5" strokeLinecap="round">
        <path data-ripple d="M240 468 H330" />
        <path data-ripple d="M300 504 H410" />
        <path data-ripple d="M205 545 H290" />
      </g>

    </g>

    <path
      d="M84 0 C80 30 68 60 56 96 C28 170 54 260 114 318 C178 380 190 472 122 540 C72 590 60 660 104 720"
      fill="none"
      style={{ stroke: "var(--scene-dash)" }}
      strokeWidth="2"
      strokeDasharray="7 8"
    />
  </svg>
);

export default BackwatersScene;
