export function normalizeYandexMetrikaId(value: unknown): string | null;
export function buildYandexMetrikaInitScript(counterId: unknown): string;
export function dispatchYandexGoal(options: {
  counterId: unknown;
  goal: unknown;
  params?: Record<string, unknown>;
  target?: { ym?: (...args: unknown[]) => void };
}): boolean;
