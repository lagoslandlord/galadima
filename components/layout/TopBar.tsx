"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/providers/AuthProvider";
import { ROLE_LABELS } from "@/lib/constants";
import { IconMenu, IconBell, IconChevronDown, IconUser, IconLogOut } from "@/components/icons";

const PAGE_TITLES: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/employees": "Employees",
  "/departments": "Departments",
  "/kpis": "KPI Management",
  "/submissions": "Submissions",
   "/alerts": "Escalations",
  "/audit": "Audit Log",
  "/broadcast": "Broadcast Center",
  "/profile": "My Profile",
  "/admin": "Admin",
};

function pageTitle(pathname: string): string {
  const segment = `/${pathname.split("/")[1] || ""}`;
  return PAGE_TITLES[segment] || "Galadima";
}

function initials(name: string): string {
  return name.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]?.toUpperCase()).join("");
}

export default function TopBar({ onMenuClick }: { onMenuClick: () => void }) {
  const pathname = usePathname();
  const router = useRouter();
  const user = useAuth();
  const [menuOpen, setMenuOpen] = useState(false);
  const [unacknowledged, setUnacknowledged] = useState(0);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("click", handleClickOutside);
    return () => document.removeEventListener("click", handleClickOutside);
  }, []);

  useEffect(() => {
    async function loadCount() {
      try {
        const res = await fetch("/api/notifications?limit=1");
        const json = await res.json();
        if (json.success) setUnacknowledged(json.stats.unacknowledged);
      } catch {
        // silent — the bell just won't show a count this cycle
      }
    }
    loadCount();
    const interval = setInterval(loadCount, 60000);
    return () => clearInterval(interval);
  }, []);

  async function handleLogout() {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="app-topbar">
      <button className="topbar-menu-btn" onClick={onMenuClick} aria-label="Open menu">
        <IconMenu />
      </button>

      <h1 className="topbar-title">{pageTitle(pathname)}</h1>

      <div className="topbar-actions">
        <Link href="/alerts" className="icon-btn" aria-label="Alerts">
          <IconBell size={19} />
          {unacknowledged > 0 && <span className="icon-btn-badge">{unacknowledged > 9 ? "9+" : unacknowledged}</span>}
        </Link>

        <div className="user-menu" ref={menuRef}>
          <button className="user-menu-trigger" onClick={() => setMenuOpen((v) => !v)}>
            <span className="user-avatar">{initials(user.name)}</span>
            <span>
              <span className="user-menu-name">{user.name.split(" ")[0]}</span>
              <span className="user-menu-role">{ROLE_LABELS[user.role]}</span>
            </span>
            <IconChevronDown size={16} />
          </button>

          {menuOpen && (
            <div className="user-menu-dropdown">
              <div className="user-menu-dropdown-header">
                <p>{user.name}</p>
                <p>{user.email}</p>
              </div>
              <Link href="/profile" className="user-menu-item" onClick={() => setMenuOpen(false)}>
                <IconUser size={16} /> My Profile
              </Link>
              <button className="user-menu-item" onClick={handleLogout}>
                <IconLogOut size={16} /> Sign out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}