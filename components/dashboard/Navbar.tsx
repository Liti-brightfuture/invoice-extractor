'use client'

import { useState } from 'react'
import { Menu, X } from 'lucide-react'

interface NavbarProps {
  onMenuToggle?: () => void
  menuOpen?: boolean
  usedCount?: number
  usageTotal?: number
}

export function Navbar({ onMenuToggle, menuOpen, usedCount = 0, usageTotal = 20 }: NavbarProps) {
  return (
    <nav className="flex items-center justify-between px-4 sm:px-8 py-[18px] bg-ie-surface border-b border-ie-border sticky top-0 z-10">
      <div className="flex items-center gap-3">
        {/* Hamburger — vizibil doar pe mobile */}
        <button
          onClick={onMenuToggle}
          className="lg:hidden p-1 -ml-1 text-ie-muted hover:text-ie-text transition-colors"
          aria-label="Toggle menu"
        >
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>

        {/* Logo */}
        <div className="flex items-center gap-2 font-[family-name:var(--font-dm-mono)] text-[15px] font-medium">
          <span className="w-2 h-2 rounded-full bg-ie-accent shrink-0" />
          InvoiceExtractor
        </div>
      </div>

      <div className="flex items-center gap-3 sm:gap-4">
        <p className="hidden sm:block text-[13px] text-ie-muted">
          Plan <span className="text-ie-text font-medium">Free</span> · {usedCount} din {usageTotal} facturi
        </p>
        <span className="font-[family-name:var(--font-dm-mono)] text-[11px] bg-ie-accent-light text-ie-accent px-[10px] py-1 rounded-full">
          BETA
        </span>
      </div>
    </nav>
  )
}
