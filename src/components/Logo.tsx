export function Logo() {
  return (
    <span className="logo">
      <svg className="logo-mark" width="22" height="22" viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <path
          d="M12 2L13.8 8.2L20 10L13.8 11.8L12 18L10.2 11.8L4 10L10.2 8.2L12 2Z"
          fill="currentColor"
        />
        <circle cx="19" cy="5" r="1.6" fill="currentColor" />
      </svg>
      <span className="logo-text">Image Magic</span>
    </span>
  );
}
