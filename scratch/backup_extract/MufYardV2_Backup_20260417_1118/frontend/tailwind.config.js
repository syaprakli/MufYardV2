/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                primary: {
                    DEFAULT: 'var(--primary)',
                    light: 'var(--primary-light)',
                },
                secondary: 'var(--secondary)',
                accent: 'var(--accent)',
                background: 'var(--background)',
                foreground: 'var(--foreground)',
                card: 'var(--card)',
                muted: 'var(--muted)',
                border: 'var(--border)',
                success: 'var(--success)',
                warning: 'var(--warning)',
                error: 'var(--error)',
                info: 'var(--info)',
            },
            fontFamily: {
                sans: ['Inter', 'sans-serif'],
                outfit: ['Outfit', 'sans-serif'],
            },
            borderRadius: {
                lg: 'var(--radius-lg)',
                md: 'var(--radius)',
                sm: 'var(--radius-sm)',
            },
        },
    },
    plugins: [],
}
