'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard,
  FileText,
  Clock,
  Download,
  Building2,
  Settings,
  Link2,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const navItems = [
  {
    section: 'Principal',
    items: [
      { label: 'Dashboard', href: '/dashboard', icon: LayoutDashboard },
      { label: 'Facturi', href: '/dashboard/invoices', icon: FileText },
      { label: 'Reconciliere', href: '/dashboard/reconciliation', icon: Link2 },
      { label: 'Furnizori', href: '/dashboard/suppliers', icon: Building2 },
      { label: 'Istoric', href: '/dashboard/history', icon: Clock },
      { label: 'Erori', href: '/dashboard/invoices/failed', icon: XCircle },
    ],
  },
  {
    section: 'Export',
    items: [
      { label: 'Export batch', href: '/dashboard/export', icon: Download },
    ],
  },
  {
    section: 'Cont',
    items: [
      { label: 'Setări', href: '/dashboard/settings', icon: Settings },
    ],
  },
]

interface SidebarProps {
  open?: boolean
  onClose?: () => void
  failedCount?: number
}

export function Sidebar({ open, onClose, failedCount = 0 }: SidebarProps) {
  const pathname = usePathname()

  return (
    <>
      {/* Overlay mobile */}
      {open && (
        <div
          className="fixed inset-0 z-20 bg-black/20 lg:hidden"
          onClick={onClose}
        />
      )}

      <aside
        className={cn(
          'fixed lg:static inset-y-0 left-0 z-30 w-[220px] min-w-[220px] bg-ie-surface border-r border-ie-border flex flex-col py-6 transition-transform duration-200',
          'lg:translate-x-0',
          open ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )}
      >
        {navItems.map((group) => (
          <div key={group.section} className="px-4 mb-2">
            <p className="font-[family-name:var(--font-dm-mono)] text-[10px] text-ie-muted uppercase tracking-[0.8px] px-2 py-2">
              {group.section}
            </p>
            {group.items.map(({ label, href, icon: Icon }) => {
              const active =
                href === '/dashboard/invoices'
                  ? pathname.startsWith(href) && !pathname.startsWith('/dashboard/invoices/failed')
                  : href === '/dashboard/suppliers' || href === '/dashboard/settings' || href === '/dashboard/history'
                  ? pathname.startsWith(href)
                  : pathname === href
              const showBadge = href === '/dashboard/invoices/failed' && failedCount > 0
              return (
                <Link
                  key={href}
                  href={href}
                  onClick={onClose}
                  className={cn(
                    'flex items-center gap-[10px] px-[10px] py-[9px] rounded-md text-[13.5px] transition-all duration-150',
                    active
                      ? 'bg-ie-accent-light text-ie-accent font-medium'
                      : 'text-ie-muted hover:bg-ie-bg hover:text-ie-text'
                  )}
                >
                  <Icon
                    size={15}
                    className={cn('shrink-0', active ? 'opacity-100' : 'opacity-70')}
                  />
                  {label}
                  {showBadge && (
                    <span className="ml-auto text-[10px] font-semibold bg-red-100 text-red-600 px-[6px] py-[2px] rounded-full min-w-[18px] text-center tabular-nums">
                      {failedCount > 99 ? '99+' : failedCount}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        ))}
      </aside>
    </>
  )
}
