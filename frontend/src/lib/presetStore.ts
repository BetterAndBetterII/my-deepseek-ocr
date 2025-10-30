import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { PresetKey } from "@/lib/presets";

type State = {
  presetKey: PresetKey;
  setPresetKey: (k: PresetKey) => void;
  customPrompt: string;
  setCustomPrompt: (v: string) => void;
};

export const usePresetStore = create<State>()(
  persist(
    (set) => ({
      presetKey: "md",
      setPresetKey: (k) => set({ presetKey: k }),
      customPrompt: "",
      setCustomPrompt: (v) => set({ customPrompt: v }),
    }),
    {
      name: "ocr-preset",
    },
  ),
);
