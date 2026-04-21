'use client'

import { useState } from 'react'
import { Navbar } from '@/components/dashboard/Navbar'
import { Sidebar } from '@/components/dashboard/Sidebar'
import { Toaster } from '@/components/ui/sonner'

export function DashboardShell({
  children,
  failedCount = 0,
  usedCount = 0,
  usageTotal = 20,
}: {
  children: React.ReactNode
  failedCount?: number
  usedCount?: number
  usageTotal?: number
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <>
      <div className="flex flex-col h-[100dvh] overflow-hidden">
        <Navbar
          onMenuToggle={() => setSidebarOpen((v) => !v)}
          menuOpen={sidebarOpen}
          usedCount={usedCount}
          usageTotal={usageTotal}
        />
        <div className="flex flex-1 overflow-hidden">
          <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} failedCount={failedCount} />
          <main className="flex-1 p-6 lg:p-8 overflow-y-auto">{children}</main>
        </div>
      </div>
      <Toaster position="bottom-right" richColors />
    </>
  )
}
