/** Oryens 8090 brand colors. Tailwind v4 prefers @theme in CSS; this supports tooling that expects theme.extend. */
module.exports = {
  content: ['./app/**/*.{js,ts,jsx,tsx}', './components/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'brand-primary': '#10b981',
        'brand-dark': '#020617',
      },
    },
  },
  plugins: [],
};
