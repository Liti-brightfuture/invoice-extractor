export type InvoiceErrorCode =
  | 'openai_unavailable'
  | 'openai_parse_error'
  | 'file_corrupt'
  | 'file_too_large'
  | 'anaf_unavailable'
  | 'storage_error'
  | 'unknown'

export interface ClassifiedError {
  error_code: InvoiceErrorCode
  error_message: string
}

const MESSAGES: Record<InvoiceErrorCode, string> = {
  openai_unavailable: 'OpenAI este momentan indisponibil — încearcă în câteva minute',
  openai_parse_error: 'AI-ul nu a putut extrage datele — încearcă cu un model mai puternic',
  file_corrupt:       'Fișierul pare corupt — încearcă să-l re-exporți',
  file_too_large:     'Fișierul depășește limita de 10MB',
  anaf_unavailable:   'ANAF este indisponibil — încearcă în 5 minute',
  storage_error:      'Eroare la citirea fișierului din stocare',
  unknown:            'Eroare necunoscută la procesare',
}

export function classifyError(err: unknown): ClassifiedError {
  const message = err instanceof Error ? err.message : String(err)
  const lower = message.toLowerCase()

  let code: InvoiceErrorCode = 'unknown'

  if (
    lower.includes('rate limit') ||
    lower.includes('429') ||
    lower.includes('service unavailable') ||
    lower.includes('503') ||
    (lower.includes('openai') && (lower.includes('unavailable') || lower.includes('down') || lower.includes('500')))
  ) {
    code = 'openai_unavailable'
  } else if (
    lower.includes('răspuns gol de la openai') ||
    (lower.includes('json') && lower.includes('parse')) ||
    lower.includes('unexpected token') ||
    lower.includes('syntaxerror')
  ) {
    code = 'openai_parse_error'
  } else if (
    lower.includes('storage download') ||
    lower.includes('object not found') ||
    lower.includes('no such key')
  ) {
    code = 'storage_error'
  } else if (
    lower.includes('too large') ||
    lower.includes('payload too large') ||
    lower.includes('413') ||
    lower.includes('depășește limita')
  ) {
    code = 'file_too_large'
  } else if (
    lower.includes('corrupt') ||
    lower.includes('invalid pdf') ||
    lower.includes('bad pdf') ||
    lower.includes('cannot parse') ||
    lower.includes('unexpected end of file')
  ) {
    code = 'file_corrupt'
  } else if (lower.includes('anaf') || lower.includes('webservicesp')) {
    code = 'anaf_unavailable'
  }

  return { error_code: code, error_message: MESSAGES[code] }
}

export function classifyLegacyErrorString(raw: string | null | undefined): ClassifiedError {
  if (!raw) return { error_code: 'unknown', error_message: MESSAGES.unknown }
  return classifyError(raw)
}
