'use client'

import { Switch } from '@base-ui/react/switch'
import { cn } from '@/lib/utils'

function SwitchRoot({
  className,
  ...props
}: React.ComponentProps<typeof Switch.Root>) {
  return (
    <Switch.Root
      className={cn(
        'group relative inline-flex h-5 w-9 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors outline-none',
        'bg-ie-border data-checked:bg-ie-accent',
        'focus-visible:ring-2 focus-visible:ring-ie-accent/40',
        'disabled:pointer-events-none disabled:opacity-50',
        className
      )}
      {...props}
    >
      <Switch.Thumb
        className={cn(
          'pointer-events-none block size-4 rounded-full bg-white shadow transition-transform',
          'translate-x-0 group-data-checked:translate-x-4'
        )}
      />
    </Switch.Root>
  )
}

export { SwitchRoot as Switch }
