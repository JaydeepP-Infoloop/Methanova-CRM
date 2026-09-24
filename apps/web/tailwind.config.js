import methanova from "@methanova/config/tailwind.preset.js";

/** @type {import('tailwindcss').Config} */
export default {
  presets: [methanova],
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: { extend: {} },
  plugins: [],
};
