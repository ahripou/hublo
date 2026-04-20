export function FormError({ message }: { message: string | null | undefined }) {
    if (!message) return null;
    return (
        <p className="text-sm text-red-600" role="alert">
            {message}
        </p>
    );
}

export function FormSuccess({ message }: { message: string | null | undefined }) {
    if (!message) return null;
    return (
        <p className="text-sm text-[var(--accent)]" role="status">
            {message}
        </p>
    );
}
