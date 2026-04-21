import Link from 'next/link'
import { FileScan, ShieldCheck, GitCompareArrows, FileDown, Upload, Cpu, CheckCircle2, Database, FileCode2, FileSpreadsheet } from 'lucide-react'

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen">
      <Nav />
      <main className="flex-1">
        <Hero />
        <Features />
        <HowItWorks />
        <Integrations />
        <About />
      </main>
      <Footer />
    </div>
  )
}

function Nav() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-ie-border/60 bg-ie-bg/90 backdrop-blur-sm">
      <nav className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <span className="font-semibold text-ie-text tracking-tight">InvoiceExtractor</span>
        <div className="hidden md:flex items-center gap-6 text-sm text-ie-muted">
          <a href="#functionalitati" className="hover:text-ie-text transition-colors">
            Funcționalități
          </a>
          <a href="#cum-functioneaza" className="hover:text-ie-text transition-colors">
            Cum funcționează
          </a>
          <a href="#compatibilitate" className="hover:text-ie-text transition-colors">
            Compatibilitate
          </a>
          <a href="#despre" className="hover:text-ie-text transition-colors">
            Despre
          </a>
        </div>
        <Link
          href="/login"
          className="rounded-lg bg-ie-accent px-4 py-2 text-sm font-medium text-white hover:bg-ie-accent-hover transition-colors"
        >
          Autentificare
        </Link>
      </nav>
    </header>
  )
}

function Hero() {
  return (
    <section className="max-w-6xl mx-auto px-6 py-24 md:py-32 grid md:grid-cols-2 gap-16 items-center">
      <div className="space-y-6">
        <p className="text-sm font-medium text-ie-accent uppercase tracking-wider">
          Automatizare facturi pentru contabili RO
        </p>
        <h1 className="text-4xl md:text-5xl font-semibold leading-tight tracking-tight text-ie-text">
          Extrage, validează și reconciliază facturile automat
        </h1>
        <p className="text-lg text-ie-muted leading-relaxed max-w-md">
          Încarci un PDF sau XML UBL, AI-ul extrage datele și le validează direct cu ANAF.
          Gata de export în Excel sau standard UBL în câteva secunde.
        </p>
        <div className="flex flex-col sm:flex-row gap-3">
          <Link
            href="/login"
            className="inline-flex items-center justify-center rounded-lg bg-ie-accent px-6 py-3 text-sm font-medium text-white hover:bg-ie-accent-hover transition-colors"
          >
            Încearcă aplicația
          </Link>
          <a
            href="#cum-functioneaza"
            className="inline-flex items-center justify-center rounded-lg border border-ie-border px-6 py-3 text-sm font-medium text-ie-text hover:bg-ie-border/40 transition-colors"
          >
            Vezi cum funcționează
          </a>
        </div>
      </div>
      <div className="relative flex justify-center md:justify-end">
        <InvoiceMockup />
      </div>
    </section>
  )
}

function InvoiceMockup() {
  return (
    <div className="relative w-72">
      <div className="absolute top-4 left-4 w-full h-full rounded-xl bg-ie-border/50 rotate-2" />
      <div className="relative bg-ie-surface rounded-xl ring-1 ring-ie-border shadow-lg p-5 space-y-4">
        <div className="flex justify-between items-start">
          <div>
            <p className="text-xs text-ie-muted">Furnizor</p>
            <p className="text-sm font-semibold text-ie-text">SC TechCorp SRL</p>
            <p className="text-xs text-ie-muted mt-0.5">CUI: RO12345678</p>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full bg-ie-green-light px-2.5 py-1 text-xs font-medium text-ie-green">
            <CheckCircle2 className="size-3" />
            ANAF ✓
          </span>
        </div>
        <div className="border-t border-ie-border pt-3 space-y-1.5">
          <div className="flex justify-between text-xs">
            <span className="text-ie-muted">Nr. factură</span>
            <span className="font-mono text-ie-text">INV-2024-0042</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-ie-muted">Data</span>
            <span className="text-ie-text">15 Ian 2024</span>
          </div>
          <div className="flex justify-between text-xs">
            <span className="text-ie-muted">Linii extrase</span>
            <span className="text-ie-text">3 produse</span>
          </div>
        </div>
        <div className="border-t border-ie-border pt-3">
          <div className="flex justify-between items-baseline">
            <span className="text-xs text-ie-muted">Total</span>
            <span className="text-xl font-semibold text-ie-text">2.450,00 RON</span>
          </div>
        </div>
        <div className="flex gap-1.5">
          <span className="rounded-full bg-ie-accent-light px-2 py-0.5 text-xs font-medium text-ie-accent">
            OCR 97%
          </span>
          <span className="rounded-full bg-ie-green-light px-2 py-0.5 text-xs font-medium text-ie-green">
            Reconciliat
          </span>
        </div>
      </div>
    </div>
  )
}

const FEATURES = [
  {
    icon: FileScan,
    title: 'OCR cu AI',
    description:
      'Extragere automată din PDF, PNG sau XML UBL cu precizie ridicată, fără configurare manuală.',
  },
  {
    icon: ShieldCheck,
    title: 'Validare ANAF',
    description:
      'Verificare instantanee a furnizorilor direct prin API-ul ANAF, inclusiv statut TVA.',
  },
  {
    icon: GitCompareArrows,
    title: 'Reconciliere automată',
    description:
      'Potrivire cu extrasul de cont bancar și alertă pentru discrepanțe sau duplicate.',
  },
  {
    icon: FileDown,
    title: 'Export UBL / Excel',
    description:
      'Generare fișiere XML UBL standard și rapoarte Excel gata de importat în orice ERP.',
  },
]

function Features() {
  return (
    <section id="functionalitati" className="bg-ie-surface border-y border-ie-border">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12 space-y-2">
          <h2 className="text-3xl font-semibold text-ie-text">Tot ce îți trebuie pentru facturi</h2>
          <p className="text-ie-muted max-w-xl mx-auto">
            De la extragere la validare și export, totul într-un singur loc.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {FEATURES.map(({ icon: Icon, title, description }) => (
            <div
              key={title}
              className="flex flex-col gap-3 p-5 rounded-xl bg-ie-bg ring-1 ring-ie-border hover:ring-ie-accent/30 transition-all"
            >
              <div className="size-9 rounded-lg bg-ie-accent-light flex items-center justify-center">
                <Icon className="size-4 text-ie-accent" />
              </div>
              <h3 className="font-semibold text-ie-text text-sm">{title}</h3>
              <p className="text-sm text-ie-muted leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

const STEPS = [
  {
    number: '1',
    icon: Upload,
    title: 'Încarci factura',
    description: 'PDF, PNG, JPEG sau XML UBL. Drag & drop sau import ZIP cu mai multe fișiere.',
  },
  {
    number: '2',
    icon: Cpu,
    title: 'AI extrage și validează',
    description: 'Modelul AI detectează câmpurile cheie și le validează automat cu ANAF.',
  },
  {
    number: '3',
    icon: CheckCircle2,
    title: 'Reconciliezi și exporți',
    description: 'Compari cu banca, confirmi și exporți în formatul dorit. Gata.',
  },
]

function HowItWorks() {
  return (
    <section id="cum-functioneaza" className="max-w-6xl mx-auto px-6 py-20">
      <div className="text-center mb-14 space-y-2">
        <h2 className="text-3xl font-semibold text-ie-text">Cum funcționează</h2>
        <p className="text-ie-muted">Trei pași, câteva secunde.</p>
      </div>
      <div className="grid md:grid-cols-3 gap-10">
        {STEPS.map(({ number, icon: Icon, title, description }) => (
          <div key={number} className="flex flex-col items-center text-center gap-4">
            <div className="relative">
              <div className="size-16 rounded-2xl bg-ie-accent-light flex items-center justify-center ring-1 ring-ie-accent/20">
                <Icon className="size-6 text-ie-accent" />
              </div>
              <span className="absolute -top-2 -right-2 size-6 rounded-full bg-ie-accent text-white text-xs font-bold flex items-center justify-center">
                {number}
              </span>
            </div>
            <div>
              <h3 className="font-semibold text-ie-text mb-1">{title}</h3>
              <p className="text-sm text-ie-muted leading-relaxed max-w-[220px] mx-auto">
                {description}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  )
}

const INTEGRATIONS = [
  {
    icon: FileDown,
    name: 'SmartBill',
    format: 'JSON API v2',
    description: 'Export direct în formatul nativ SmartBill — facturi furnizori gata de importat.',
  },
  {
    icon: Database,
    name: 'Saga',
    format: 'DBF format',
    description: 'Fișier DBF III compatibil cu modulul de intrări facturi furnizori din Saga.',
  },
  {
    icon: FileCode2,
    name: 'WinMentor',
    format: 'XML import',
    description: 'XML structurat pentru importul facturilor de intrare în WinMentor.',
  },
  {
    icon: FileSpreadsheet,
    name: 'Excel / CSV',
    format: '.xlsx standard',
    description: 'Raport Excel cu toate câmpurile extrase, gata de prelucrat în orice aplicație.',
  },
]

function Integrations() {
  return (
    <section id="compatibilitate" className="bg-ie-surface border-y border-ie-border">
      <div className="max-w-6xl mx-auto px-6 py-20">
        <div className="text-center mb-12 space-y-2">
          <h2 className="text-3xl font-semibold text-ie-text">
            Compatibil cu softurile tale de contabilitate
          </h2>
          <p className="text-ie-muted max-w-xl mx-auto">
            Exportă direct în formatul nativ al aplicației pe care o folosești deja. Fără conversii
            manuale.
          </p>
        </div>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {INTEGRATIONS.map(({ icon: Icon, name, format, description }) => (
            <div
              key={name}
              className="flex flex-col gap-3 p-5 rounded-xl bg-ie-bg ring-1 ring-ie-border hover:ring-ie-accent/30 transition-all"
            >
              <div className="flex items-center gap-3">
                <div className="size-9 rounded-lg bg-ie-accent-light flex items-center justify-center shrink-0">
                  <Icon className="size-4 text-ie-accent" />
                </div>
                <div>
                  <p className="font-semibold text-ie-text text-sm leading-tight">{name}</p>
                  <p className="text-xs text-ie-muted">{format}</p>
                </div>
              </div>
              <p className="text-sm text-ie-muted leading-relaxed">{description}</p>
            </div>
          ))}
        </div>
        <p className="text-center text-xs text-ie-muted mt-8">
          Export standard{' '}
          <span className="font-medium text-ie-text">UBL e-Factura</span> inclus — formatul oficial
          ANAF acceptat de toate platformele.
        </p>
      </div>
    </section>
  )
}

function About() {
  return (
    <section id="despre" className="bg-ie-accent-light border-y border-ie-accent/10">
      <div className="max-w-3xl mx-auto px-6 py-16 text-center space-y-5">
        <span className="inline-block rounded-full bg-ie-accent/10 px-3 py-1 text-xs font-medium text-ie-accent uppercase tracking-wider">
          Proiect de licență
        </span>
        <h2 className="text-2xl font-semibold text-ie-text">Despre InvoiceExtractor</h2>
        <p className="text-ie-muted leading-relaxed max-w-xl mx-auto">
          InvoiceExtractor este un proiect de licență în curs de validare academică. Interfața și
          funcționalitățile pot evolua pe măsura ce primim feedback. Dacă dorești să testezi
          aplicația, creează un cont gratuit — feedback-ul tău ajută direct la validarea proiectului.
        </p>
        <Link
          href="/login"
          className="inline-flex items-center justify-center rounded-lg bg-ie-accent px-6 py-3 text-sm font-medium text-white hover:bg-ie-accent-hover transition-colors"
        >
          Încearcă gratuit
        </Link>
      </div>
    </section>
  )
}

function Footer() {
  return (
    <footer className="border-t border-ie-border">
      <div className="max-w-6xl mx-auto px-6 py-8 flex flex-col sm:flex-row justify-between items-center gap-4 text-sm text-ie-muted">
        <span>© 2026 InvoiceExtractor — Proiect de licență</span>
        <a href="mailto:litescudud@gmail.com" className="hover:text-ie-text transition-colors">
          litescudud@gmail.com
        </a>
      </div>
    </footer>
  )
}
