'use client';

import Link from 'next/link';
import { useFormState, useFormStatus } from 'react-dom';

import { registerAction, type AuthFormState } from '../actions';

const initialState: AuthFormState = { error: null };

function SubmitButton() {
    const { pending } = useFormStatus();
    return (
        <button type="submit" className="btn-primary w-full" disabled={pending}>
            {pending ? 'Création…' : 'Créer mon compte'}
        </button>
    );
}

export default function RegisterPage() {
    const [state, formAction] = useFormState(registerAction, initialState);

    return (
        <main className="min-h-screen flex items-center justify-center px-4 py-12">
            <div className="w-full max-w-sm">
                <Link href="/" className="block text-center text-xl font-semibold text-[var(--accent)] mb-6">
                    Hublo.be
                </Link>
                <h1 className="text-2xl font-semibold text-gray-900 mb-6">Créer un compte</h1>

                <form action={formAction} className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label htmlFor="first_name" className="label-field">
                                Prénom
                            </label>
                            <input
                                id="first_name"
                                name="first_name"
                                type="text"
                                autoComplete="given-name"
                                className="input-field"
                            />
                        </div>
                        <div>
                            <label htmlFor="last_name" className="label-field">
                                Nom
                            </label>
                            <input
                                id="last_name"
                                name="last_name"
                                type="text"
                                autoComplete="family-name"
                                className="input-field"
                            />
                        </div>
                    </div>

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
                            autoComplete="new-password"
                            minLength={8}
                            required
                            className="input-field"
                        />
                        <p className="mt-1 text-xs text-gray-500">Au moins 8 caractères.</p>
                    </div>

                    {state.error ? (
                        <p className="text-sm text-red-600" role="alert">
                            {state.error}
                        </p>
                    ) : null}

                    <SubmitButton />
                </form>

                <p className="mt-6 text-sm text-gray-600 text-center">
                    Déjà un compte ?{' '}
                    <Link href="/auth/login" className="text-[var(--accent)] font-medium">
                        Se connecter
                    </Link>
                </p>
            </div>
        </main>
    );
}
