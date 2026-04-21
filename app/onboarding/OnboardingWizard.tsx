'use client'

import { useState, useCallback } from 'react'
import { useDropzone, FileRejection } from 'react-dropzone'
import { Loader2, Upload, CheckCircle2 } from 'lucide-react'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'
import { createClient } from '@/lib/supabase/client'
import { createInvoiceRecord } from '@/app/dashboard/actions'
import {
  saveSmartBillIntegration,
  saveSagaSettings,
} from '@/app/dashboard/settings/actions'
import { saveCompanyInfo, completeOnboarding } from './actions'

const ALLOWED_MIME = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'application/xml',
  'text/xml',
] as const

const MAX_SIZE = 10 * 1024 * 1024

interface Props {
  userId: string
  initialCompanyName: string
  initialCompanyCui: string
}

function cuiValid(cui: string) {
  const clean = cui.replace(/^RO/i, '').replace(/\s/g, '')
  return /^\d{2,10}$/.test(clean)
}

const STEPS = ['Date firmă', 'Prima factură', 'Integrări']

export function OnboardingWizard({
  userId,
  initialCompanyName,
  initialCompanyCui,
}: Props) {
  const [step, setStep] = useState(0)

  // Step 1
  const [companyName, setCompanyName] = useState(initialCompanyName)
  const [companyCui, setCompanyCui] = useState(initialCompanyCui)
  const [savingCompany, setSavingCompany] = useState(false)

  // Step 2
  const [uploading, setUploading] = useState(false)
  const [uploadedFile, setUploadedFile] = useState<string | null>(null)

  // Step 3 — SmartBill
  const [sbUsername, setSbUsername] = useState('')
  const [sbApiKey, setSbApiKey] = useState('')
  const [sbVat, setSbVat] = useState(initialCompanyCui)
  const [savingSmartBill, setSavingSmartBill] = useState(false)

  // Step 3 — Saga
  const [sagaEnabled, setSagaEnabled] = useState(false)
  const [sagaPath, setSagaPath] = useState('')
  const [savingSaga, setSavingSaga] = useState(false)

  const [completing, setCompleting] = useState(false)

  // ─── Step 1 ──────────────────────────────────────────────────

  async function handleSaveCompany() {
    if (!companyName.trim()) {
      toast.error('Introdu denumirea firmei.')
      return
    }
    if (!cuiValid(companyCui)) {
      toast.error('CUI invalid. Format: RO + 2–10 cifre (ex: RO12345678).')
      return
    }
    setSavingCompany(true)
    const result = await saveCompanyInfo({
      company_name: companyName.trim(),
      company_cui: companyCui.trim(),
    })
    setSavingCompany(false)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    setSbVat(companyCui.trim())
    setStep(1)
  }

  // ─── Step 2 ──────────────────────────────────────────────────

  const handleUpload = useCallback(
    async (file: File) => {
      if (!(ALLOWED_MIME as readonly string[]).includes(file.type)) {
        toast.error('Format neacceptat.')
        return
      }
      setUploading(true)
      try {
        const supabase = createClient()
        const uniqueName = `${userId}/${crypto.randomUUID()}-${file.name}`
        const { error: storageError } = await supabase.storage
          .from('invoices')
          .upload(uniqueName, file, { contentType: file.type, upsert: false })
        if (storageError) throw new Error(storageError.message)
        await createInvoiceRecord(uniqueName, file.name)
        setUploadedFile(file.name)
        toast.success('Factură încărcată!')
      } catch (err) {
        toast.error(err instanceof Error ? err.message : 'Eroare la încărcare.')
      } finally {
        setUploading(false)
      }
    },
    [userId]
  )

  const onDrop = useCallback(
    (accepted: File[], rejected: FileRejection[]) => {
      if (rejected.length > 0) {
        const code = rejected[0].errors[0].code
        if (code === 'file-too-large') toast.error('Fișierul depășește 10MB.')
        else toast.error('Format neacceptat.')
        return
      }
      if (accepted[0]) handleUpload(accepted[0])
    },
    [handleUpload]
  )

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf'],
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
      'application/xml': ['.xml'],
      'text/xml': ['.xml'],
    },
    maxSize: MAX_SIZE,
    multiple: false,
    disabled: uploading || !!uploadedFile,
  })

  // ─── Step 3 ──────────────────────────────────────────────────

  async function handleFinish() {
    setCompleting(true)
    await completeOnboarding()
  }

  async function handleSaveSmartBill() {
    if (!sbUsername || !sbApiKey) {
      toast.error('Username și API key sunt obligatorii.')
      return
    }
    setSavingSmartBill(true)
    const result = await saveSmartBillIntegration({
      api_key: sbApiKey,
      username: sbUsername,
      company_vat_code: sbVat,
    })
    setSavingSmartBill(false)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    toast.success('SmartBill conectat!')
    await handleFinish()
  }

  async function handleSaveSaga() {
    setSavingSaga(true)
    const result = await saveSagaSettings({
      export_dbf: sagaEnabled,
      default_path: sagaPath,
    })
    setSavingSaga(false)
    if (!result.success) {
      toast.error(result.error)
      return
    }
    toast.success('Saga configurat!')
    await handleFinish()
  }

  // ─── Render ───────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-ie-bg flex flex-col items-center justify-center p-4">
      {/* Logo */}
      <div className="mb-8 text-center">
        <h1 className="text-[22px] font-semibold text-ie-text tracking-tight">
          InvoiceExtractor
        </h1>
        <p className="text-sm text-ie-muted mt-1">
          Bun venit! Configurează-ți contul în 3 pași.
        </p>
      </div>

      {/* Progress */}
      <div className="w-full max-w-md mb-6">
        <div className="flex items-center justify-between mb-3">
          {STEPS.map((label, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <div
                className={cn(
                  'w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-semibold border transition-colors',
                  i < step
                    ? 'bg-ie-accent border-ie-accent text-white'
                    : i === step
                      ? 'border-ie-accent text-ie-accent bg-ie-accent-light'
                      : 'border-ie-border text-ie-muted bg-ie-surface'
                )}
              >
                {i < step ? '✓' : i + 1}
              </div>
              <span
                className={cn(
                  'text-xs',
                  i <= step ? 'text-ie-text font-medium' : 'text-ie-muted'
                )}
              >
                {label}
              </span>
            </div>
          ))}
        </div>
        <div className="w-full bg-ie-border rounded-full h-[3px]">
          <div
            className="bg-ie-accent h-[3px] rounded-full transition-all duration-500"
            style={{ width: `${(step / 2) * 100}%` }}
          />
        </div>
      </div>

      {/* Card */}
      <div className="w-full max-w-md bg-ie-surface border border-ie-border rounded-2xl p-6 shadow-sm">
        {/* ── Pasul 1: Date firmă ── */}
        {step === 0 && (
          <div>
            <h2 className="text-[17px] font-semibold mb-1">Date firmă</h2>
            <p className="text-[13px] text-ie-muted mb-5">
              Folosite pentru a recunoaște facturile emise de tine față de cele
              primite.
            </p>
            <div className="space-y-4">
              <div>
                <label className="text-[13px] font-medium text-ie-text block mb-1.5">
                  Denumire firmă
                </label>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveCompany()}
                  placeholder="ex: SC Exemplu SRL"
                  className="w-full border border-ie-border rounded-lg px-3 py-2 text-sm bg-ie-bg focus:outline-none focus:border-ie-accent transition-colors"
                />
              </div>
              <div>
                <label className="text-[13px] font-medium text-ie-text block mb-1.5">
                  CUI firmă
                </label>
                <input
                  type="text"
                  value={companyCui}
                  onChange={(e) => setCompanyCui(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveCompany()}
                  placeholder="ex: RO12345678"
                  className="w-full border border-ie-border rounded-lg px-3 py-2 text-sm bg-ie-bg focus:outline-none focus:border-ie-accent transition-colors"
                />
              </div>
            </div>
            <button
              onClick={handleSaveCompany}
              disabled={savingCompany || !companyName.trim() || !companyCui.trim()}
              className="mt-6 w-full bg-ie-accent hover:bg-ie-accent-hover text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {savingCompany && <Loader2 size={15} className="animate-spin" />}
              Continuă
            </button>
          </div>
        )}

        {/* ── Pasul 2: Prima factură ── */}
        {step === 1 && (
          <div>
            <h2 className="text-[17px] font-semibold mb-1">Prima factură</h2>
            <p className="text-[13px] text-ie-muted mb-4">
              Testează sistemul cu o factură reală. Poți sări peste dacă nu ai
              una acum.
            </p>

            <div className="bg-blue-50 border border-blue-200 rounded-lg px-3.5 py-2.5 text-[12px] text-blue-700 mb-4">
              Acceptăm <strong>PDF</strong>, <strong>PNG</strong>,{' '}
              <strong>JPG</strong> și <strong>XML e-Factura</strong> · max 10MB
            </div>

            {uploadedFile ? (
              <div className="border border-ie-green rounded-xl px-4 py-6 text-center bg-ie-green-light">
                <CheckCircle2
                  size={28}
                  className="mx-auto mb-2 text-ie-green"
                />
                <p className="text-sm font-medium text-ie-green">
                  {uploadedFile}
                </p>
                <p className="text-[12px] text-ie-green mt-0.5">
                  Trimisă la procesare AI
                </p>
              </div>
            ) : (
              <div
                {...getRootProps()}
                className={cn(
                  'border-[1.5px] border-dashed rounded-xl px-6 py-10 text-center cursor-pointer transition-all duration-200 outline-none',
                  isDragActive
                    ? 'border-ie-accent bg-ie-accent-light'
                    : uploading
                      ? 'border-ie-border bg-ie-bg opacity-70 cursor-not-allowed'
                      : 'border-ie-border bg-ie-bg hover:border-ie-accent hover:bg-ie-accent-light'
                )}
              >
                <input {...getInputProps()} />
                <div className="w-10 h-10 mx-auto mb-3 flex items-center justify-center rounded-lg border border-ie-border bg-ie-surface">
                  {uploading ? (
                    <Loader2
                      size={18}
                      className="text-ie-accent animate-spin"
                    />
                  ) : (
                    <Upload size={18} className="text-ie-muted" />
                  )}
                </div>
                <p className="text-[14px] font-medium mb-1">
                  {uploading
                    ? 'Se încarcă...'
                    : isDragActive
                      ? 'Eliberează fișierul'
                      : 'Trage sau click pentru a selecta'}
                </p>
                <p className="text-[12px] text-ie-muted">
                  PDF, PNG, JPG, XML e-Factura · max 10MB
                </p>
              </div>
            )}

            <button
              onClick={() => setStep(2)}
              disabled={uploading}
              className="mt-5 w-full bg-ie-accent hover:bg-ie-accent-hover text-white rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50"
            >
              Continuă
            </button>
            <button
              onClick={() => setStep(2)}
              disabled={uploading}
              className="w-full mt-2 text-[12px] text-ie-muted hover:text-ie-text transition-colors"
            >
              Sari peste acest pas
            </button>
          </div>
        )}

        {/* ── Pasul 3: Integrări ── */}
        {step === 2 && (
          <div>
            <h2 className="text-[17px] font-semibold mb-1">
              Integrări contabile
            </h2>
            <p className="text-[13px] text-ie-muted mb-4">
              Opțional. Conectează software-ul de contabilitate pentru export
              direct.
            </p>

            {/* SmartBill */}
            <div className="border border-ie-border rounded-xl p-4 mb-3">
              <p className="text-[13px] font-semibold mb-3">SmartBill</p>
              <div className="space-y-2.5">
                <input
                  type="text"
                  value={sbUsername}
                  onChange={(e) => setSbUsername(e.target.value)}
                  placeholder="Username SmartBill"
                  className="w-full border border-ie-border rounded-lg px-3 py-2 text-sm bg-ie-bg focus:outline-none focus:border-ie-accent transition-colors"
                />
                <input
                  type="password"
                  value={sbApiKey}
                  onChange={(e) => setSbApiKey(e.target.value)}
                  placeholder="API Key"
                  className="w-full border border-ie-border rounded-lg px-3 py-2 text-sm bg-ie-bg focus:outline-none focus:border-ie-accent transition-colors"
                />
                <input
                  type="text"
                  value={sbVat}
                  onChange={(e) => setSbVat(e.target.value)}
                  placeholder="CUI firmă SmartBill"
                  className="w-full border border-ie-border rounded-lg px-3 py-2 text-sm bg-ie-bg focus:outline-none focus:border-ie-accent transition-colors"
                />
                <button
                  onClick={handleSaveSmartBill}
                  disabled={savingSmartBill || completing || !sbUsername || !sbApiKey}
                  className="w-full bg-ie-accent hover:bg-ie-accent-hover text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {(savingSmartBill || completing) && (
                    <Loader2 size={14} className="animate-spin" />
                  )}
                  Conectează SmartBill și finalizează
                </button>
              </div>
            </div>

            {/* Saga */}
            <div className="border border-ie-border rounded-xl p-4 mb-4">
              <div className="flex items-center justify-between mb-3">
                <p className="text-[13px] font-semibold">Saga</p>
                <button
                  role="switch"
                  aria-checked={sagaEnabled}
                  onClick={() => setSagaEnabled((v) => !v)}
                  className={cn(
                    'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
                    sagaEnabled ? 'bg-ie-accent' : 'bg-ie-border'
                  )}
                >
                  <span
                    className={cn(
                      'inline-block h-3.5 w-3.5 rounded-full bg-white shadow transition-transform',
                      sagaEnabled ? 'translate-x-4' : 'translate-x-1'
                    )}
                  />
                </button>
              </div>
              {sagaEnabled && (
                <div className="space-y-2.5">
                  <input
                    type="text"
                    value={sagaPath}
                    onChange={(e) => setSagaPath(e.target.value)}
                    placeholder="Cale export implicită (opțional)"
                    className="w-full border border-ie-border rounded-lg px-3 py-2 text-sm bg-ie-bg focus:outline-none focus:border-ie-accent transition-colors"
                  />
                  <button
                    onClick={handleSaveSaga}
                    disabled={savingSaga || completing}
                    className="w-full bg-ie-accent hover:bg-ie-accent-hover text-white rounded-lg px-4 py-2 text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {(savingSaga || completing) && (
                      <Loader2 size={14} className="animate-spin" />
                    )}
                    Conectează Saga și finalizează
                  </button>
                </div>
              )}
            </div>

            {/* Finalizare fără integrare */}
            <button
              onClick={handleFinish}
              disabled={completing || savingSmartBill || savingSaga}
              className="w-full border border-ie-border bg-ie-surface hover:bg-ie-bg text-ie-text rounded-lg px-4 py-2.5 text-sm font-medium transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
            >
              {completing && <Loader2 size={14} className="animate-spin" />}
              Finalizează fără integrare
            </button>
          </div>
        )}
      </div>

      <p className="mt-4 text-[12px] text-ie-muted">
        Poți modifica toate setările oricând din{' '}
        <a
          href="/dashboard/settings"
          className="underline hover:text-ie-text transition-colors"
        >
          Setări
        </a>
        .
      </p>
    </div>
  )
}
