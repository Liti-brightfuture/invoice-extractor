import { createClient } from '@/lib/supabase/server'
import { History } from 'lucide-react'
import type { AuditLog as AuditLogType } from '@/types/invoice'

const ACTION_LABELS: Record<string, string> = {
  reprocess: 'Re-procesare AI',
  manual_edit: 'Editare manuală',
  mark_validated: 'Validat manual',
}

interface Props {
  invoiceId: string
}

export async function AuditLog({ invoiceId }: Props) {
  const supabase = await createClient()

  const { data: logs } = await supabase
    .from('audit_logs')
    .select('*')
    .eq('invoice_id', invoiceId)
    .order('created_at', { ascending: false })

  if (!logs || logs.length === 0) return null

  return (
    <div className="bg-ie-surface border border-ie-border rounded-xl overflow-hidden">
      <div className="px-5 py-3 border-b border-ie-border bg-ie-bg flex items-center gap-2">
        <History size={13} className="text-ie-muted" />
        <p className="font-[family-name:var(--font-dm-mono)] text-[10.5px] text-ie-muted uppercase tracking-[0.6px]">
          Istoric modificări
        </p>
      </div>
      <div className="divide-y divide-ie-border">
        {(logs as AuditLogType[]).map((log) => (
          <AuditEntry key={log.id} log={log} />
        ))}
      </div>
    </div>
  )
}

function AuditEntry({ log }: { log: AuditLogType }) {
  const label = ACTION_LABELS[log.action] ?? log.action
  const date = new Date(log.created_at).toLocaleString('ro-RO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })

  return (
    <details className="group px-5 py-3">
      <summary className="flex items-center justify-between cursor-pointer list-none">
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-medium text-ie-text">{label}</span>
        </div>
        <span className="text-[12px] text-ie-muted font-[family-name:var(--font-dm-mono)]">{date}</span>
      </summary>
      {(log.old_values || log.new_values) && (
        <div className="mt-2 grid grid-cols-2 gap-2 text-[11px]">
          {log.old_values && (
            <div>
              <p className="text-ie-muted mb-1 uppercase tracking-[0.4px]">Înainte</p>
              <pre className="bg-ie-bg border border-ie-border rounded px-2 py-1.5 overflow-x-auto text-ie-muted whitespace-pre-wrap break-all">
                {JSON.stringify(log.old_values, null, 2)}
              </pre>
            </div>
          )}
          {log.new_values && (
            <div>
              <p className="text-ie-muted mb-1 uppercase tracking-[0.4px]">După</p>
              <pre className="bg-ie-bg border border-ie-border rounded px-2 py-1.5 overflow-x-auto text-ie-muted whitespace-pre-wrap break-all">
                {JSON.stringify(log.new_values, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </details>
  )
}
