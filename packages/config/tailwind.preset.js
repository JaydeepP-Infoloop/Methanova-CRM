/** @type {import('tailwindcss').Config} */
export default {
  theme: {
    extend: {
      colors: {
        methanova: {
          green: "#1B5E3B",
          greenDark: "#123F28",
          greenTint: "#EAF2ED",
          gold: "#C4A35A",
          goldTint: "#FAF3E5",
        },
        // Aliases onto the existing slate/brand scale so screens stop inventing
        // one-off surface/text colours. Hex values stay in one place above.
        surface: "#f8fafc", // slate-50
        surfaceElevated: "#ffffff",
        borderDefault: "#e2e8f0", // slate-200
        textPrimary: "#0f172a", // slate-900
        textSecondary: "#64748b", // slate-500
        textMuted: "#94a3b8", // slate-400
        danger: "#e11d48",
        warning: "#d97706",
        success: "#047857",
        info: "#0284c7",
      },
      boxShadow: {
        overlay: "0 20px 25px -5px rgb(15 23 42 / 0.1), 0 8px 10px -6px rgb(15 23 42 / 0.1)",
      },
    },
  },
};
