import { useEffect, useState, useCallback } from "react";
import type { AllocationItem, GoalPresetId } from "./presets";

export interface Goal {
  id: string;
  name: string;
  presetId: GoalPresetId;
  targetAmount: number;
  years: number;
  monthlySip: number;
  allocation: AllocationItem[]; // resolved at creation, editable
  createdAt: number;
}

export interface PlannerSettings {
  monthlyIncome: number;
  largeCapFundId: string; // "nifty50-if" | "sensex-if"
}

const GOALS_KEY = "zfh.planner.goals.v1";
const SETTINGS_KEY = "zfh.planner.settings.v1";

const DEFAULT_SETTINGS: PlannerSettings = {
  monthlyIncome: 100000,
  largeCapFundId: "nifty50-if",
};

function safeRead<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function safeWrite<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    /* ignore quota errors */
  }
}

// Cross-component sync via storage event + custom event
const STORE_EVENT = "zfh-store-change";

function emitChange() {
  if (typeof window !== "undefined") {
    window.dispatchEvent(new Event(STORE_EVENT));
  }
}

export function useGoals() {
  const [goals, setGoals] = useState<Goal[]>(() => safeRead<Goal[]>(GOALS_KEY, []));

  useEffect(() => {
    const sync = () => setGoals(safeRead<Goal[]>(GOALS_KEY, []));
    window.addEventListener(STORE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(STORE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const persist = useCallback((next: Goal[]) => {
    safeWrite(GOALS_KEY, next);
    setGoals(next);
    emitChange();
  }, []);

  const addGoal = useCallback(
    (g: Omit<Goal, "id" | "createdAt">) => {
      const newGoal: Goal = {
        ...g,
        id: crypto.randomUUID(),
        createdAt: Date.now(),
      };
      persist([...safeRead<Goal[]>(GOALS_KEY, []), newGoal]);
      return newGoal;
    },
    [persist],
  );

  const updateGoal = useCallback(
    (id: string, patch: Partial<Goal>) => {
      const current = safeRead<Goal[]>(GOALS_KEY, []);
      persist(current.map((g) => (g.id === id ? { ...g, ...patch } : g)));
    },
    [persist],
  );

  const deleteGoal = useCallback(
    (id: string) => {
      const current = safeRead<Goal[]>(GOALS_KEY, []);
      persist(current.filter((g) => g.id !== id));
    },
    [persist],
  );

  return { goals, addGoal, updateGoal, deleteGoal };
}

export function useSettings() {
  const [settings, setSettings] = useState<PlannerSettings>(() =>
    safeRead<PlannerSettings>(SETTINGS_KEY, DEFAULT_SETTINGS),
  );

  useEffect(() => {
    const sync = () =>
      setSettings(safeRead<PlannerSettings>(SETTINGS_KEY, DEFAULT_SETTINGS));
    window.addEventListener(STORE_EVENT, sync);
    window.addEventListener("storage", sync);
    return () => {
      window.removeEventListener(STORE_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  const update = useCallback((patch: Partial<PlannerSettings>) => {
    const next = { ...safeRead<PlannerSettings>(SETTINGS_KEY, DEFAULT_SETTINGS), ...patch };
    safeWrite(SETTINGS_KEY, next);
    setSettings(next);
    emitChange();
  }, []);

  return { settings, update };
}
