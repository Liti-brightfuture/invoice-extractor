'use client'

import { useActionState, useState } from 'react'
import { sendMagicLink, signInWithPassword, signUpWithPassword, type AuthActionState } from './actions'
import { TabsRoot, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'

export default function LoginPage() {
  const [mode, setMode] = useState<'password' | 'magic'>('password')
  const [signinState, signinAction, signinPending] = useActionState(signInWithPassword, null)
  const [signupState, signupAction, signupPending] = useActionState(signUpWithPassword, null)
  const [magicState, magicAction, magicPending] = useActionState(sendMagicLink, null)

  return (
    <main className="min-h-screen flex items-center justify-center bg-ie-bg px-4">
      <div className="w-full max-w-sm bg-ie-surface rounded-2xl shadow-sm ring-1 ring-ie-border p-8 space-y-6">
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold text-ie-text">InvoiceExtractor</h1>
          <p className="text-sm text-ie-muted">
            {mode === 'magic'
              ? 'Primește un link de autentificare pe email.'
              : 'Bun venit! Intră în cont sau creează unul nou.'}
          </p>
        </div>

        {mode === 'password' ? (
          <>
            <TabsRoot defaultValue="signin">
              <TabsList>
                <TabsTrigger value="signin">Intră în cont</TabsTrigger>
                <TabsTrigger value="signup">Cont nou</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form action={signinAction} className="space-y-4">
                  <StatusMessage state={signinState} />
                  <Field id="signin-email" name="email" type="email" label="Email" placeholder="tu@exemplu.com" />
                  <Field id="signin-password" name="password" type="password" label="Parolă" placeholder="••••••••" autoComplete="current-password" />
                  <SubmitButton pending={signinPending}>Autentificare</SubmitButton>
                </form>
              </TabsContent>

              <TabsContent value="signup">
                <form action={signupAction} className="space-y-4">
                  <StatusMessage state={signupState} />
                  <Field id="signup-email" name="email" type="email" label="Email" placeholder="tu@exemplu.com" />
                  <Field id="signup-password" name="password" type="password" label="Parolă" placeholder="Min. 8 caractere" autoComplete="new-password" />
                  <SubmitButton pending={signupPending}>Creează cont</SubmitButton>
                </form>
              </TabsContent>
            </TabsRoot>

            <div className="relative my-2">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-ie-border" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-ie-surface px-2 text-ie-muted">sau</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setMode('magic')}
              className="w-full text-sm text-ie-muted hover:text-ie-text transition-colors text-center"
            >
              Trimite-mi un link magic
            </button>
          </>
        ) : (
          <>
            <form action={magicAction} className="space-y-4">
              <StatusMessage state={magicState} />
              <Field id="magic-email" name="email" type="email" label="Email" placeholder="tu@exemplu.com" />
              <SubmitButton pending={magicPending}>Trimite link magic</SubmitButton>
            </form>

            <button
              type="button"
              onClick={() => setMode('password')}
              className="w-full text-sm text-ie-muted hover:text-ie-text transition-colors text-center"
            >
              ← Înapoi la autentificare cu parolă
            </button>
          </>
        )}
      </div>
    </main>
  )
}

function Field({
  id,
  name,
  type,
  label,
  placeholder,
  autoComplete,
}: {
  id: string
  name: string
  type: string
  label: string
  placeholder: string
  autoComplete?: string
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={id} className="block text-sm font-medium text-ie-text">
        {label}
      </label>
      <input
        id={id}
        name={name}
        type={type}
        required
        autoComplete={autoComplete ?? type}
        placeholder={placeholder}
        className="w-full rounded-lg border border-ie-border bg-ie-surface px-3 py-2 text-sm text-ie-text placeholder:text-ie-muted focus:outline-none focus:ring-2 focus:ring-ie-accent/50 focus:border-ie-accent transition-colors"
      />
    </div>
  )
}

function SubmitButton({ pending, children }: { pending: boolean; children: React.ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="w-full rounded-lg bg-ie-accent px-4 py-2 text-sm font-medium text-white hover:bg-ie-accent-hover focus:outline-none focus:ring-2 focus:ring-ie-accent/50 focus:ring-offset-2 transition-colors disabled:opacity-60"
    >
      {pending ? 'Se procesează…' : children}
    </button>
  )
}

function StatusMessage({ state }: { state: AuthActionState }) {
  if (!state) return null
  if (state.message) {
    return (
      <div role="status" className="rounded-lg bg-ie-green-light border border-ie-green/20 p-3 text-sm text-ie-green">
        {state.message}
      </div>
    )
  }
  if (state.error) {
    return (
      <div role="alert" className="rounded-lg bg-red-50 border border-red-200 p-3 text-sm text-red-800">
        {state.error}
      </div>
    )
  }
  return null
}
