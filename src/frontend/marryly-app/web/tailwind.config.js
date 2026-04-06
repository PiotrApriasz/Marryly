import { themeExtensions } from './src/styles/theme.js';

export default {
    content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
    theme: {
        extend: themeExtensions,
    },
    plugins: [],
};
