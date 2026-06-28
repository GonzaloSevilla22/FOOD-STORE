import { create } from "zustand";

interface ThemeStoreState {
  dark: boolean;
  toggle: () => void;
  setDark: (dark: boolean) => void;
}

export const useThemeStore = create<ThemeStoreState>((set) => ({
  dark: localStorage.getItem("theme") === "dark",
  toggle: () =>
    set((state) => {
      const next = !state.dark;
      localStorage.setItem("theme", next ? "dark" : "light");
      return { dark: next };
    }),
  setDark: (dark: boolean) => {
    localStorage.setItem("theme", dark ? "dark" : "light");
    set({ dark });
  },
}));
