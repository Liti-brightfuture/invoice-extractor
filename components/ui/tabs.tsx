'use client'

import { Tabs } from '@base-ui/react/tabs'
import { cn } from '@/lib/utils'

function TabsRoot({
  className,
  ...props
}: React.ComponentProps<typeof Tabs.Root>) {
  return (
    <Tabs.Root
      className={cn('flex flex-col', className)}
      {...props}
    />
  )
}

function TabsList({
  className,
  ...props
}: React.ComponentProps<typeof Tabs.List>) {
  return (
    <Tabs.List
      className={cn(
        'flex border-b border-ie-border mb-6 gap-0',
        className
      )}
      {...props}
    />
  )
}

function TabsTrigger({
  className,
  ...props
}: React.ComponentProps<typeof Tabs.Tab>) {
  return (
    <Tabs.Tab
      className={cn(
        'relative px-4 py-2.5 text-[13.5px] font-medium transition-colors outline-none cursor-pointer',
        'text-ie-muted hover:text-ie-text',
        'data-selected:text-ie-accent',
        'after:absolute after:bottom-0 after:left-0 after:right-0 after:h-0.5 after:bg-ie-accent after:scale-x-0 after:transition-transform',
        'data-selected:after:scale-x-100',
        className
      )}
      {...props}
    />
  )
}

function TabsContent({
  className,
  ...props
}: React.ComponentProps<typeof Tabs.Panel>) {
  return (
    <Tabs.Panel
      className={cn('outline-none', className)}
      {...props}
    />
  )
}

export { TabsRoot, TabsList, TabsTrigger, TabsContent }
