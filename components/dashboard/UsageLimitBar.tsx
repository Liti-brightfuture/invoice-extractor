import { Progress } from '@/components/ui/progress'

interface UsageLimitBarProps {
  used?: number
  total?: number
}

export function UsageLimitBar({ used = 0, total = 20 }: UsageLimitBarProps) {
  const pct = Math.round((used / total) * 100)

  return (
    <div className="bg-ie-surface border border-ie-border rounded-lg px-[18px] py-[14px] flex items-center gap-4 mt-6">
      <p className="text-[13px] text-ie-muted whitespace-nowrap">
        <span className="text-ie-text font-semibold">
          {used} / {total}
        </span>{' '}
        facturi folosite luna aceasta
      </p>

      <Progress
        value={pct}
        className="flex-1 h-[5px] bg-ie-bg [&>div]:bg-ie-accent"
      />

      <span className="text-[12.5px] text-ie-accent font-medium cursor-pointer whitespace-nowrap hover:underline">
        Upgrade →
      </span>
    </div>
  )
}
