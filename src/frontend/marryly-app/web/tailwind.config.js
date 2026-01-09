export default {
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
        extend: {
            colors: {
                paper: "#F5F1E8",
                sand: "#E9E4DC",
                ink: "#1F1F1F",
                muted: "#9A9A9A",
                gold: "#C9A24D",
                accent: "#F5EFE6",
                overlay: "rgba(31, 31, 31, 0.4)",
            },
            fontFamily: {
                serif: ["Playfair Display", "serif"],
                sans: ["Inter", "system-ui", "sans-serif"],
                script: ["Playfair Display", "serif"],
            },
            borderRadius: {
                xl: "1rem",
                "2xl": "1.5rem",
            },
            keyframes: {
                fadeIn: {
                    '0%': { opacity: '0' },
                    '100%': { opacity: '1' },
                },
                slideDown: {
                    '0%': { transform: 'translateY(-10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                slideUp: {
                    '0%': { transform: 'translateY(10px)', opacity: '0' },
                    '100%': { transform: 'translateY(0)', opacity: '1' },
                },
                scaleIn: {
                    '0%': { transform: 'scale(0.95)', opacity: '0' },
                    '100%': { transform: 'scale(1)', opacity: '1' },
                },
            },
            animation: {
                fadeIn: 'fadeIn 0.6s ease-out',
                slideDown: 'slideDown 0.4s ease-out',
                slideUp: 'slideUp 0.6s ease-out',
                scaleIn: 'scaleIn 0.5s ease-out',
            },
            spacing: {
                '18': '4.5rem',
                '22': '5.5rem',
                '88': '22rem',
                '100': '25rem',
            },
        },
    },
    plugins: [],
};