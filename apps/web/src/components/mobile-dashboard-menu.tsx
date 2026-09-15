"use client";

import { useState } from "react";
import Link from "next/link";

export type DashboardMenuItem = { href: string; label: string; count?: number };

type MobileDashboardMenuProps = {
  items: DashboardMenuItem[];
  name: string;
  role: string;
  companyName: string;
  onSignOut: () => void;
};

export function MobileDashboardMenu({ items, name, role, companyName, onSignOut }: MobileDashboardMenuProps) {
  const [isOpen, setIsOpen] = useState(false);
  const initials = name.split(" ").map((part) => part[0]).join("").slice(0, 2).toUpperCase();

  return <div className="mobile-dashboard-menu">
    <button className="mobile-menu-toggle" type="button" aria-label="Open dashboard menu" aria-controls="mobile-dashboard-navigation" aria-expanded={isOpen} onClick={() => setIsOpen(true)}>
      <span aria-hidden="true">☰</span>
    </button>
    {isOpen && <>
      <button className="mobile-menu-backdrop" type="button" aria-label="Close dashboard menu" onClick={() => setIsOpen(false)} />
      <aside className="mobile-menu-panel" id="mobile-dashboard-navigation" aria-label="Dashboard menu">
        <div className="mobile-menu-header"><div><span className="brand-mark">e</span><strong>engplatform<span>2</span></strong></div><button className="mobile-menu-close" type="button" aria-label="Close dashboard menu" onClick={() => setIsOpen(false)}>×</button></div>
        <div className="mobile-menu-user"><span className="avatar">{initials}</span><div><strong>{name}</strong><span>{role.replaceAll("_", " ")}</span></div></div>
        <nav className="mobile-menu-links" aria-label="Mobile dashboard navigation">{items.map((item) => <Link href={item.href} key={item.href} onClick={() => setIsOpen(false)}>{item.label}{item.count ? <span className="count">{item.count}</span> : null}</Link>)}</nav>
        <div className="mobile-menu-footer"><p>{companyName}</p><button className="sign-out" type="button" onClick={onSignOut}>Sign out</button></div>
      </aside>
    </>}
  </div>;
}
