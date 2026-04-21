'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { TabsRoot, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Checkbox } from '@/components/ui/checkbox'
import { Progress } from '@/components/ui/progress'
import { Switch } from '@/components/ui/switch'
import { Slider } from '@/components/ui/slider'
import {
  DialogRoot,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  updateProfile,
  sendEmailChangeLink,
  deleteAccount,
  saveSmartBillIntegration,
  testSmartBillConnection,
  saveSagaSettings,
  savePreferences,
} from './actions'

// ─── Types ───────────────────────────────────────────────────

interface Profile {
  id: string
  full_name: string | null
  phone: string | null
  company_name: string | null
  company_cui: string | null
  company_address: string | null
  preferences: Record<string, unknown> | null
}

interface MonthlyRow {
  month: string
  label: string
  count: number
}

interface SmartBillCreds {
  api_key: string
  username: string
  company_vat_code: string
}

interface SagaCreds {
  export_dbf: boolean
  default_path: string
}

interface Props {
  user: { email: string }
  profile: Profile | null
  currentMonthCount: number
  monthlyHistory: MonthlyRow[]
  smartbillCreds: SmartBillCreds | null
  sagaCreds: SagaCreds | null
}

const PLAN_LIMIT = 20

// ─── Tab 1: Cont ─────────────────────────────────────────────

function AccountTab({
  user,
  profile,
}: Pick<Props, 'user' | 'profile'>) {
  const [isPending, startTransition] = useTransition()

  const [fullName, setFullName] = useState(profile?.full_name ?? '')
  const [phone, setPhone] = useState(profile?.phone ?? '')
  const [companyName, setCompanyName] = useState(profile?.company_name ?? '')
  const [companyCui, setCompanyCui] = useState(profile?.company_cui ?? '')
  const [companyAddress, setCompanyAddress] = useState(profile?.company_address ?? '')

  const [newEmail, setNewEmail] = useState('')
  const [emailDialogOpen, setEmailDialogOpen] = useState(false)

  const handleSaveProfile = () => {
    startTransition(async () => {
      const result = await updateProfile({
        full_name: fullName,
        phone,
        company_name: companyName,
        company_cui: companyCui,
        company_address: companyAddress,
      })
      if (result.success) {
        toast.success('Profil actualizat')
      } else {
        toast.error(result.error)
      }
    })
  }

  const handleEmailChange = () => {
    startTransition(async () => {
      const result = await sendEmailChangeLink(newEmail)
      if (result.success) {
        toast.success('Link de confirmare trimis la noul email')
        setEmailDialogOpen(false)
        setNewEmail('')
      } else {
        toast.error(result.error)
      }
    })
  }

  const handleDeleteAccount = () => {
    startTransition(async () => {
      await deleteAccount()
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Date personale */}
      <Card>
        <CardHeader>
          <CardTitle>Date personale</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="email">Email</Label>
            <Input id="email" value={user.email} readOnly className="bg-ie-bg text-ie-muted cursor-not-allowed" />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="full_name">Nume complet</Label>
              <Input
                id="full_name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Ion Popescu"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="phone">Telefon</Label>
              <Input
                id="phone"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="07xx xxx xxx"
              />
            </div>
          </div>
          <Button
            className="self-start bg-ie-accent hover:bg-ie-accent-hover text-white"
            onClick={handleSaveProfile}
            disabled={isPending}
          >
            Salvează
          </Button>
        </CardContent>
      </Card>

      {/* Date firmă */}
      <Card>
        <CardHeader>
          <CardTitle>Date firmă</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <p className="text-xs text-ie-muted -mt-2">
            Folosite pentru a determina dacă o factură este primită sau emisă.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="company_name">Nume firmă</Label>
              <Input
                id="company_name"
                value={companyName}
                onChange={(e) => setCompanyName(e.target.value)}
                placeholder="SC Exemplu SRL"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="company_cui">CUI propriu</Label>
              <Input
                id="company_cui"
                value={companyCui}
                onChange={(e) => setCompanyCui(e.target.value)}
                placeholder="RO12345678"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="company_address">Adresă</Label>
            <Input
              id="company_address"
              value={companyAddress}
              onChange={(e) => setCompanyAddress(e.target.value)}
              placeholder="Str. Exemplu nr. 1, București"
            />
          </div>
          <Button
            className="self-start bg-ie-accent hover:bg-ie-accent-hover text-white"
            onClick={handleSaveProfile}
            disabled={isPending}
          >
            Salvează
          </Button>
        </CardContent>
      </Card>

      {/* Acțiuni cont */}
      <div className="flex items-center gap-3 pt-2">
        {/* Schimbă email */}
        <DialogRoot open={emailDialogOpen} onOpenChange={setEmailDialogOpen}>
          <DialogTrigger
            render={
              <Button variant="outline">Schimbă email</Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Schimbă adresa de email</DialogTitle>
              <DialogDescription>
                Vei primi un link de confirmare pe noul email.
                Schimbarea devine activă după confirmare.
              </DialogDescription>
            </DialogHeader>
            <div className="flex flex-col gap-1.5 mt-2">
              <Label htmlFor="new_email">Email nou</Label>
              <Input
                id="new_email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="email@nou.ro"
              />
            </div>
            <DialogFooter>
              <DialogClose render={<Button variant="outline">Anulează</Button>} />
              <Button
                className="bg-ie-accent hover:bg-ie-accent-hover text-white"
                onClick={handleEmailChange}
                disabled={isPending || !newEmail}
              >
                Trimite link confirmare
              </Button>
            </DialogFooter>
          </DialogContent>
        </DialogRoot>

        {/* Șterge cont */}
        <DialogRoot>
          <DialogTrigger
            render={
              <Button variant="destructive">Șterge cont</Button>
            }
          />
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Confirmare ștergere cont</DialogTitle>
              <DialogDescription>
                Această acțiune nu poate fi anulată. Contul tău va fi dezactivat
                și vei fi deconectat imediat.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <DialogClose render={<Button variant="outline">Anulează</Button>} />
              <Button
                variant="destructive"
                onClick={handleDeleteAccount}
                disabled={isPending}
              >
                Da, șterge contul
              </Button>
            </DialogFooter>
          </DialogContent>
        </DialogRoot>
      </div>
    </div>
  )
}

// ─── Tab 2: Plan și utilizare ────────────────────────────────

function PlanTab({
  currentMonthCount,
  monthlyHistory,
}: Pick<Props, 'currentMonthCount' | 'monthlyHistory'>) {
  const pct = Math.min(Math.round((currentMonthCount / PLAN_LIMIT) * 100), 100)

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Plan curent</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-ie-text">Free — 20 facturi / lună</span>
            <span className="text-xs font-[family-name:var(--font-dm-mono)] text-ie-muted">
              {currentMonthCount}/{PLAN_LIMIT} folosite
            </span>
          </div>
          <Progress
            value={pct}
            className="h-2"
          />
          <p className="text-xs text-ie-muted">
            {PLAN_LIMIT - currentMonthCount > 0
              ? `Mai ai ${PLAN_LIMIT - currentMonthCount} facturi disponibile luna aceasta.`
              : 'Ai atins limita lunară. Fă upgrade pentru a continua.'}
          </p>
          <a
            href="mailto:contact@invoiceextractor.ro?subject=Upgrade%20plan%20InvoiceExtractor"
            className="self-start inline-flex h-8 items-center gap-1.5 rounded-lg border border-ie-accent bg-transparent px-2.5 text-sm font-medium text-ie-accent transition-colors hover:bg-ie-accent-light"
          >
            Upgrade plan →
          </a>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Istoric consum — ultimele 6 luni</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Lună</TableHead>
                <TableHead className="text-right">Facturi procesate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {monthlyHistory.map((row) => (
                <TableRow key={row.month}>
                  <TableCell className="capitalize">{row.label}</TableCell>
                  <TableCell className="text-right font-[family-name:var(--font-dm-mono)]">
                    {row.count}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Tab 3: Integrări ────────────────────────────────────────

function IntegrationsTab({
  smartbillCreds,
  sagaCreds,
}: Pick<Props, 'smartbillCreds' | 'sagaCreds'>) {
  const [isPending, startTransition] = useTransition()

  const [sbApiKey, setSbApiKey] = useState(smartbillCreds?.api_key ?? '')
  const [sbUsername, setSbUsername] = useState(smartbillCreds?.username ?? '')
  const [sbVat, setSbVat] = useState(smartbillCreds?.company_vat_code ?? '')
  const [sbTestResult, setSbTestResult] = useState<string | null>(null)

  const [sagaExport, setSagaExport] = useState(sagaCreds?.export_dbf ?? false)
  const [sagaPath, setSagaPath] = useState(sagaCreds?.default_path ?? '')

  const handleTestSmartBill = () => {
    setSbTestResult(null)
    startTransition(async () => {
      const result = await testSmartBillConnection(sbApiKey, sbUsername)
      if (result.success && result.data) {
        setSbTestResult(`✓ Conexiune reușită — ${result.data.companyName}`)
        toast.success(`SmartBill: ${result.data.companyName}`)
      } else {
        setSbTestResult(null)
        toast.error((result as { success: false; error: string }).error)
      }
    })
  }

  const handleSaveSmartBill = () => {
    startTransition(async () => {
      const result = await saveSmartBillIntegration({
        api_key: sbApiKey,
        username: sbUsername,
        company_vat_code: sbVat,
      })
      if (result.success) {
        toast.success('SmartBill salvat')
      } else {
        toast.error((result as { success: false; error: string }).error)
      }
    })
  }

  const handleSaveSaga = () => {
    startTransition(async () => {
      const result = await saveSagaSettings({
        export_dbf: sagaExport,
        default_path: sagaPath,
      })
      if (result.success) {
        toast.success('Saga salvat')
      } else {
        toast.error((result as { success: false; error: string }).error)
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      {/* SmartBill */}
      <Card>
        <CardHeader>
          <CardTitle>SmartBill</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sb_username">Username</Label>
              <Input
                id="sb_username"
                value={sbUsername}
                onChange={(e) => setSbUsername(e.target.value)}
                placeholder="user@firma.ro"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="sb_apikey">API Key</Label>
              <Input
                id="sb_apikey"
                type="password"
                value={sbApiKey}
                onChange={(e) => setSbApiKey(e.target.value)}
                placeholder="••••••••"
              />
            </div>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="sb_vat">CUI firmă (SmartBill)</Label>
            <Input
              id="sb_vat"
              value={sbVat}
              onChange={(e) => setSbVat(e.target.value)}
              placeholder="RO12345678"
            />
          </div>
          {sbTestResult && (
            <p className="text-xs text-ie-green font-medium">{sbTestResult}</p>
          )}
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={handleTestSmartBill}
              disabled={isPending || !sbApiKey || !sbUsername}
            >
              Testează conexiunea
            </Button>
            <Button
              className="bg-ie-accent hover:bg-ie-accent-hover text-white"
              onClick={handleSaveSmartBill}
              disabled={isPending || !sbApiKey || !sbUsername}
            >
              Salvează
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Saga */}
      <Card>
        <CardHeader>
          <CardTitle>Saga</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <Switch
              checked={sagaExport}
              onCheckedChange={setSagaExport}
              id="saga_toggle"
            />
            <Label htmlFor="saga_toggle">Export DBF compatibil Saga</Label>
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="saga_path">Cale implicită export</Label>
            <Input
              id="saga_path"
              value={sagaPath}
              onChange={(e) => setSagaPath(e.target.value)}
              placeholder="C:\Contabilitate\Export"
              disabled={!sagaExport}
            />
          </div>
          <Button
            className="self-start bg-ie-accent hover:bg-ie-accent-hover text-white"
            onClick={handleSaveSaga}
            disabled={isPending}
          >
            Salvează
          </Button>
        </CardContent>
      </Card>

      {/* ANAF placeholder */}
      <Card className="opacity-60 pointer-events-none select-none">
        <CardHeader>
          <CardTitle>ANAF e-Factura</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-ie-muted">
            Soon — conectare SPV via OAuth
          </p>
        </CardContent>
      </Card>
    </div>
  )
}

// ─── Tab 4: Preferințe ───────────────────────────────────────

function PreferencesTab({ profile }: Pick<Props, 'profile'>) {
  const [isPending, startTransition] = useTransition()
  const prefs = (profile?.preferences ?? {}) as Record<string, unknown>

  const [threshold, setThreshold] = useState<number>(
    typeof prefs.threshold === 'number' ? prefs.threshold : 85
  )
  const [validateCui, setValidateCui] = useState<boolean>(
    prefs.validate_cui === true
  )
  const [offlineMode, setOfflineMode] = useState<boolean>(
    prefs.offline_mode === true
  )

  const handleSave = () => {
    startTransition(async () => {
      const result = await savePreferences({
        threshold,
        validate_cui: validateCui,
        offline_mode: offlineMode,
        lang: 'ro',
      })
      if (result.success) {
        toast.success('Preferințe salvate')
      } else {
        toast.error((result as { success: false; error: string }).error)
      }
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle>Procesare AI</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-6">
          <div className="flex flex-col gap-3">
            <Slider
              min={70}
              max={95}
              step={1}
              value={threshold}
              onValueChange={setThreshold}
              label="Prag auto-validare"
            />
            <p className="text-xs text-ie-muted">
              Facturile cu scor AI sub {threshold}% vor merge automat în &quot;review&quot; pentru verificare manuală.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <div className="flex items-start gap-3">
              <Checkbox
                id="validate_cui"
                checked={validateCui}
                onCheckedChange={(v) => setValidateCui(v === true)}
                className="mt-0.5"
              />
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="validate_cui">Validează automat CUI la ANAF după extragere</Label>
                <p className="text-xs text-ie-muted">
                  Face un apel la ANAF pentru fiecare CUI nou extras. Poate încetini procesarea.
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <Checkbox
                id="offline_mode"
                checked={offlineMode}
                onCheckedChange={(v) => setOfflineMode(v === true)}
                className="mt-0.5"
              />
              <div className="flex flex-col gap-0.5">
                <Label htmlFor="offline_mode">Permite extragere fără validare ANAF (mod offline)</Label>
                <p className="text-xs text-ie-muted">
                  Factura este procesată chiar dacă ANAF nu este disponibil sau CUI-ul nu poate fi verificat.
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Interfață</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="lang">Limbă interfață</Label>
            <select
              id="lang"
              disabled
              className="h-8 rounded-lg border border-ie-border bg-ie-bg px-2.5 text-sm text-ie-muted cursor-not-allowed"
            >
              <option value="ro">Română</option>
            </select>
            <p className="text-xs text-ie-muted">Alte limbi — în curând.</p>
          </div>
        </CardContent>
      </Card>

      <Button
        className="self-start bg-ie-accent hover:bg-ie-accent-hover text-white"
        onClick={handleSave}
        disabled={isPending}
      >
        Salvează preferințele
      </Button>
    </div>
  )
}

// ─── Main export ─────────────────────────────────────────────

export function SettingsTabs(props: Props) {
  return (
    <TabsRoot defaultValue="cont">
      <TabsList>
        <TabsTrigger value="cont">Cont</TabsTrigger>
        <TabsTrigger value="plan">Plan și utilizare</TabsTrigger>
        <TabsTrigger value="integrations">Integrări</TabsTrigger>
        <TabsTrigger value="preferences">Preferințe procesare</TabsTrigger>
      </TabsList>

      <TabsContent value="cont">
        <AccountTab user={props.user} profile={props.profile} />
      </TabsContent>

      <TabsContent value="plan">
        <PlanTab
          currentMonthCount={props.currentMonthCount}
          monthlyHistory={props.monthlyHistory}
        />
      </TabsContent>

      <TabsContent value="integrations">
        <IntegrationsTab
          smartbillCreds={props.smartbillCreds}
          sagaCreds={props.sagaCreds}
        />
      </TabsContent>

      <TabsContent value="preferences">
        <PreferencesTab profile={props.profile} />
      </TabsContent>
    </TabsRoot>
  )
}
