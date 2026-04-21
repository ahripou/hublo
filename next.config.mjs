/** @type {import('next').NextConfig} */
const nextConfig = {
    images: {
        // Autorise les URLs d'images servies depuis Supabase Storage.
        // Le host est dérivé de NEXT_PUBLIC_SUPABASE_URL.
        remotePatterns: (() => {
            const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
            if (!supabaseUrl) return [];
            try {
                const { hostname } = new URL(supabaseUrl);
                return [{ protocol: 'https', hostname, pathname: '/storage/v1/object/public/**' }];
            } catch {
                return [];
            }
        })(),
    },
};

export default nextConfig;
