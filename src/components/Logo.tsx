export function Logo() {
  return (
    <span className="logo">
      <svg className="logo-mark" width="28" height="28" viewBox="0 0 32 32" aria-hidden="true">
        <defs>
          <linearGradient id="logo-badge-gradient" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#4f46e5" />
            <stop offset="1" stopColor="#a855f7" />
          </linearGradient>
        </defs>
        <rect width="32" height="32" rx="9" fill="url(#logo-badge-gradient)" />
        <path
          d="M16 6.5L18 13L24.5 15L18 17L16 23.5L14 17L7.5 15L14 13L16 6.5Z"
          fill="#fff"
        />
        <circle cx="23.5" cy="8" r="1.8" fill="#fff" fillOpacity="0.85" />
      </svg>
      <span className="logo-text">Image Magic</span>
    </span>
  );
}
