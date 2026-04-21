'use client'

import { Slider } from '@base-ui/react/slider'
import { cn } from '@/lib/utils'

interface SliderProps {
  min?: number
  max?: number
  step?: number
  value?: number
  defaultValue?: number
  onValueChange?: (value: number) => void
  label?: string
  className?: string
  disabled?: boolean
}

function SliderRoot({
  min = 0,
  max = 100,
  step = 1,
  value,
  defaultValue,
  onValueChange,
  label,
  className,
  disabled,
}: SliderProps) {
  return (
    <Slider.Root
      min={min}
      max={max}
      step={step}
      value={value}
      defaultValue={defaultValue}
      onValueChange={(val) => {
          const v = Array.isArray(val) ? val[0] : val
          if (typeof v === 'number') onValueChange?.(v)
        }}
      disabled={disabled}
      className={cn('flex flex-col gap-3 w-full', className)}
    >
      {label && (
        <div className="flex items-center justify-between">
          <Slider.Label className="text-sm font-medium text-ie-text">
            {label}
          </Slider.Label>
          <Slider.Value className="text-sm text-ie-muted tabular-nums" />
        </div>
      )}
      <Slider.Control className="relative flex items-center h-5 w-full touch-none select-none">
        <Slider.Track className="relative h-1.5 w-full grow rounded-full bg-ie-border">
          <Slider.Indicator className="absolute h-full rounded-full bg-ie-accent" />
          <Slider.Thumb
            className={cn(
              'block size-4 rounded-full border-2 border-ie-accent bg-white shadow transition-colors outline-none',
              'focus-visible:ring-2 focus-visible:ring-ie-accent/40',
              'disabled:pointer-events-none disabled:opacity-50'
            )}
          />
        </Slider.Track>
      </Slider.Control>
    </Slider.Root>
  )
}

export { SliderRoot as Slider }
