"use client";

import { useEffect, useRef, useState } from "react";
import { signOut } from "next-auth/react";
import { Logo } from "./Logo";
import { ThemeToggle } from "./ThemeToggle";

interface HeaderUser {
  name: string | null;
  email: string | null;
  image: string | null;
}

const NAV_LINKS = [
  { href: "/app", label: "首頁" },
  { href: "/app/generate", label: "產生圖片" },
  { href: "/app/images", label: "圖庫" },
  { href: "/app/style-presets", label: "風格指令" },
];

export function Header({ user }: { user: HeaderUser | null }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const initial = user?.name?.trim()?.[0]?.toUpperCase() ?? "?";

  return (
    <header className="app-header">
      <div className="app-header-inner">
        <a href={user ? "/app" : "/"} className="app-header-logo">
          <Logo />
        </a>

        {user && (
          <nav className="app-header-nav">
            {NAV_LINKS.map((link) => (
              <a key={link.href} href={link.href}>
                {link.label}
              </a>
            ))}
          </nav>
        )}

        <div className="app-header-right">
          <ThemeToggle />
          {user ? (
            <div className="user-menu" ref={menuRef}>
              <button
                type="button"
                className="avatar-button"
                onClick={() => setMenuOpen((open) => !open)}
                aria-haspopup="menu"
                aria-expanded={menuOpen}
              >
                {user.image ? (
                  <img className="avatar-image" src={user.image} alt={user.name ?? "使用者頭像"} />
                ) : (
                  <span className="avatar-fallback">{initial}</span>
                )}
              </button>
              {menuOpen && (
                <div className="user-menu-dropdown" role="menu">
                  <div className="user-menu-info">
                    <strong>{user.name ?? "使用者"}</strong>
                    {user.email && <p>{user.email}</p>}
                  </div>
                  <button type="button" className="user-menu-item" onClick={() => signOut({ callbackUrl: "/" })}>
                    登出
                  </button>
                </div>
              )}
            </div>
          ) : (
            <a href="/api/auth/signin?callbackUrl=/app">
              <button type="button">登入</button>
            </a>
          )}
        </div>
      </div>
    </header>
  );
}
