'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { createClient } from '@/lib/supabase/server';

export async function register(formData: FormData) {
  const email = formData.get('email') as string;
  const password = formData.get('password') as string;
  const firstName = (formData.get('first_name') as string)?.trim() || null;
  const lastName = (formData.get('last_name') as string)?.trim() || null;

  const supabase = createClient();
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { first_name: firstName, last_name: lastName } },
  });

  if (error) {
    redirect(`/auth/register?error=${encodeURIComponent(error.message)}`);
  }

  if (!data.session) {
    // La confirmation d'email est activée — l'utilisateur n'est pas connecté tant qu'il n'a pas cliqué.
    redirect('/auth/register?pending=1');
  }

  revalidatePath('/', 'layout');
  redirect('/client');
}
