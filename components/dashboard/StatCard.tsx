import { Card, CardContent } from '@/components/ui/card'
import { cn } from '@/lib/utils'

interface StatCardProps {
  label: string
  value: string | number
  sub: string
  accent?: boolean
}

export function StatCard({ label, value, sub, accent }: StatCardProps) {
  return (
    <Card
      className={cn(
        'rounded-[10px] border shadow-none',
        accent
          ? 'border-ie-accent bg-ie-accent-light'
          : 'border-ie-border bg-ie-surface'
      )}
    >
      <CardContent className="p-[18px_20px]">
        <p
          className={cn(
            'font-[family-name:var(--font-dm-mono)] text-[11px] uppercase tracking-[0.5px] mb-2',
            accent ? 'text-ie-accent/70' : 'text-ie-muted'
          )}
        >
          {label}
        </p>
        <p
          className={cn(
            'text-[24px] font-semibold tracking-[-1px]',
            accent ? 'text-ie-accent' : 'text-ie-text'
          )}
        >
          {value}
        </p>
        <p className={cn('text-[12px] mt-1', accent ? 'text-ie-accent/60' : 'text-ie-muted')}>
          {sub}
        </p>
      </CardContent>
    </Card>
  )
}
