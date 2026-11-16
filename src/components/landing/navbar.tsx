"use client";

import { useState, useEffect } from "react";
import { Menu, X } from "lucide-react";
import { ImpactGraphLogo } from "./logo";
import { ThemeToggle } from "@/components/theme-toggle";

interface NavbarProps {
  user?: {
    id: string;
    name: string;
    email: string;
  } | null;
}

export function Navbar({ user }: NavbarProps) {
  const [scrolled, setScrolled] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    function handleScroll() {
      setScrolled(window.scrollY > 16);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navLinks = [
    { label: "Features", href: "#features" },
    { label: "How It Works", href: "#how-it-works" },
    { label: "Docs", href: "#docs" },
  ];

  const primaryCtaHref = user ? "/dashboard" : "/api/auth/google";
  const primaryCtaLabel = user ? "Dashboard →" : "Get Started →";

  return (
    <header
      className={`sticky top-0 z-50 w-full transition-all duration-200 ${
        scrolled
          ? "border-b border-[var(--border-subtle)] bg-[var(--surface-primary)]/95 backdrop-blur-md shadow-sm"
          : "border-b border-[var(--border-subtle)]/60 bg-[var(--surface-primary)]"
      }`}
    >
      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
        {/* Brand Logo & Wordmark */}
        <ImpactGraphLogo href="/" />

        {/* Desktop Navigation Links & Controls */}
        <nav aria-label="Primary navigation" className="hidden md:flex items-center gap-7">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              className="text-[14px] font-medium text-[var(--text-secondary)] transition-colors hover:text-[var(--text-primary)]"
            >
              {link.label}
            </a>
          ))}

          {/* Theme Toggle */}
          <div className="pl-1">
            <ThemeToggle />
          </div>

          {/* Primary CTA */}
          <a
            href={primaryCtaHref}
            className="inline-flex items-center justify-center rounded-full bg-[var(--accent-coral)] px-4 py-2 text-[13px] font-bold text-[var(--accent-text)] transition-transform hover:scale-[1.02] active:scale-[0.98] shadow-sm hover:brightness-105"
          >
            {primaryCtaLabel}
          </a>
        </nav>

        {/* Mobile Controls */}
        <div className="flex md:hidden items-center gap-2">
          <ThemeToggle />
          <button
            type="button"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle menu"
            aria-expanded={mobileMenuOpen}
            className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[var(--surface-primary)] text-[var(--text-primary)]"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-[var(--border-subtle)] bg-[var(--surface-primary)] px-4 py-4 space-y-3 shadow-lg">
          <nav className="flex flex-col space-y-2">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg px-3 py-2 text-[14px] font-medium text-[var(--text-secondary)] hover:bg-[var(--surface-secondary)] hover:text-[var(--text-primary)]"
              >
                {link.label}
              </a>
            ))}
          </nav>
          <div className="pt-2 border-t border-[var(--border-subtle)]">
            <a
              href={primaryCtaHref}
              onClick={() => setMobileMenuOpen(false)}
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent-coral)] py-2.5 text-[14px] font-bold text-[var(--accent-text)] shadow-sm"
            >
              {primaryCtaLabel}
            </a>
          </div>
        </div>
      )}
    </header>
  );
}
