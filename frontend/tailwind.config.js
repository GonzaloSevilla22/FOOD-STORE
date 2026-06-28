/** @type {import('tailwindcss').Config} */
export default {
  darkMode: 'class',
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        display: ['"Clash Display"', "Inter", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"],
      },
      colors: {
        brand: {
          50: "#FFF0E6",
          100: "#FFD4B3",
          200: "#FFB380",
          300: "#FF8C4A",
          400: "#FF6B00",
          500: "#E85D00",
          600: "#CC5200",
          700: "#A84300",
          800: "#803200",
          900: "#592400",
        },
        neon: {
          fuchsia: "#FF00FF",
          violet: "#8B5CF6",
          cyan: "#06B6D4",
        },
        surface: {
          dark: "#0A0A0B",
          card: "#18181B",
          border: "#27272A",
          light: "#FAFAFA",
          cardL: "#FFFFFF",
        },
      },
      borderRadius: {
        "2xl": "1rem",
        "3xl": "1.5rem",
        "4xl": "2rem",
      },
      boxShadow: {
        'neon-sm': '0 0 8px rgba(255, 107, 0, 0.3)',
        'neon-md': '0 0 16px rgba(255, 107, 0, 0.4)',
        'neon-lg': '0 0 32px rgba(255, 107, 0, 0.5)',
        'neon-fuchsia': '0 0 16px rgba(255, 0, 255, 0.4)',
      },
    },
  },
  plugins: [],
};
