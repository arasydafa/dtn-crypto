/** @type {import('tailwindcss').Config} */
export default {
  presets: [require('@omega-os/ui/tailwind.preset.js')],
  content: [
    './index.html',
    './src/**/*.{ts,tsx}',
    './node_modules/@omega-os/ui/dist/**/*.js',
  ],
};
