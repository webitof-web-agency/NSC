/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        'roboto': ['Roboto', 'sans-serif'],
      },
      colors: {
        primary: "var(--color-primary)",
        secondary: "var(--color-secondary)",
        third: "var(--color-third)",
        fourth: "var(--color-fourth)",
        primaryAccent: "var(--color-primary-accent)",
        secondaryAccent: "var(--color-secondary-accent)",
        foreground: "var(--color-foreground)",
      },
    },
  },
  plugins: [
    require('@tailwindcss/typography'),
  ],
}
