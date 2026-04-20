'use client';

import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';

import { loginAction, type AuthFormState } from '../actions';

const initialState: AuthFormState = { error: null };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <button type="submit" className="btn-primary w-full" disabled={pending}>
            {pending ? 'Connexion…' : 'Se connecter'}
        </button>
    );
}

export default function LoginPage({ searchParams }: { searchParams: { redirect?: string } }) {
    const [state, formAction] = useFormState(loginAction, initialState);

    return (
        <main className="min-h-screen flex items-center justify-center px-4 py-12">
            <div className="w-full max-w-sm">
                <Link href="/" className="block text-center text-xl font-semibold text-[var(--accent)] mb-6">
                    Hublo.be
                </Link>
                <h1 className="text-2xl font-semibold text-gray-900 mb-6">Connexion</h1>

                <form action={formAction} className="space-y-4">
                    {searchParams.redirect ? (
                        <input type="hidden" name="redirect" value={searchParams.redirect} />
                    ) : null}

                    <div>
                        <label htmlFor="email" className="label-field">
                            Email
                        </label>
                        <input
                            id="email"
                            name="email"
                            type="email"
                            autoComplete="email"
                            required
                            className="input-field"
                        />
                    </div>

                    <div>
                        <label htmlFor="password" className="label-field">
                            Mot de passe
                        </label>
                        <input
                            id="password"
                            name="password"
                            type="password"
                            autoComplete="current-password"
                            required
                            className="input-field"
                        />
                    </div>

                    {state.error ? (
                        <p className="text-sm text-red-600" role="alert">
                            {state.error}
                        </p>
                    ) : null}

                    <SubmitButton />
                </form>

                <p className="mt-6 text-sm text-gray-600 text-center">
                    Pas encore de compte ?{' '}
                    <Link href="/auth/register" className="text-[var(--accent)] font-medium">
                        Créer un compte
                    </Link>
                </p>
            </div>
        </main>
    );
}
