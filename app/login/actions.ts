'use server'

import { createClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'

export type AuthActionState = { error?: string; message?: string } | null

export async function sendMagicLink(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = formData.get('email') as string
  if (!email) return { error: 'Adresa de email este obligatorie.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })

  if (error) return { error: error.message }
  return { message: 'Verifică emailul — ți-am trimis link-ul de autentificare.' }
}

export async function signInWithPassword(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) return { error: 'Email și parola sunt obligatorii.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signInWithPassword({ email, password })

  if (error) {
    if (error.message.toLowerCase().includes('invalid login credentials')) {
      return { error: 'Email sau parolă incorecte.' }
    }
    return { error: error.message }
  }

  redirect('/dashboard')
}

export async function signUpWithPassword(
  _prev: AuthActionState,
  formData: FormData
): Promise<AuthActionState> {
  const email = formData.get('email') as string
  const password = formData.get('password') as string

  if (!email || !password) return { error: 'Email și parola sunt obligatorii.' }
  if (password.length < 8) return { error: 'Parola trebuie să aibă cel puțin 8 caractere.' }

  const supabase = await createClient()
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL}/auth/callback`,
    },
  })

  if (error) return { error: error.message }
  return { message: 'Ți-am trimis un email de confirmare. Verifică inbox-ul.' }
}
