export type BodyBuild =
  | "very_thin"
  | "thin"
  | "fitness"
  | "normal"
  | "athletic"
  | "solid"
  | "large"
  | "full"
  | "very_full";

export type BodyProfile = {
  heightCm: number;
  weightKg: number;
  bmi: number;
  bodyBuild: BodyBuild;
};

export const BODY_BUILD_LABELS: Record<BodyBuild, string> = {
  very_thin: "Очень худое телосложение",
  thin: "Худое телосложение",
  fitness: "Фитнес телосложение",
  normal: "Нормальное телосложение",
  athletic: "Спортивное телосложение",
  solid: "Плотное телосложение",
  large: "Крупное телосложение",
  full: "Полное телосложение",
  very_full: "Очень полное телосложение",
};

const BODY_BUILD_PROMPTS: Record<BodyBuild, string> = {
  very_thin:
    "very thin underweight body build, narrow frame, realistic natural proportions, do not exaggerate",
  thin: "thin body build, slim narrow silhouette, realistic natural proportions",
  fitness: "lean fitness body build, slim toned silhouette, realistic natural proportions",
  normal: "average normal body build, natural balanced silhouette, realistic proportions",
  athletic: "athletic strong body build, toned solid silhouette, realistic proportions",
  solid: "solid sturdy body build, slightly dense silhouette, realistic natural proportions",
  large: "large body build, broad frame, realistic natural proportions",
  full: "plus-size full body build, realistic natural proportions, respectful flattering styling",
  very_full:
    "very plus-size full body build, realistic natural proportions, respectful flattering styling",
};

export function calculateBodyProfile(heightCm: number, weightKg: number): BodyProfile | null {
  if (!isValidHeight(heightCm) || !isValidWeight(weightKg)) {
    return null;
  }

  const heightM = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);

  return {
    heightCm,
    weightKg,
    bmi: roundBmi(bmi),
    bodyBuild: getBodyBuildFromBmi(bmi),
  };
}

export function getBodyBuildPrompt(bodyBuild?: BodyBuild | null) {
  return bodyBuild ? BODY_BUILD_PROMPTS[bodyBuild] ?? "" : "";
}

export function isValidHeight(heightCm: number) {
  return Number.isFinite(heightCm) && heightCm >= 120 && heightCm <= 230;
}

export function isValidWeight(weightKg: number) {
  return Number.isFinite(weightKg) && weightKg >= 30 && weightKg <= 250;
}

function getBodyBuildFromBmi(bmi: number): BodyBuild {
  if (bmi < 16) return "very_thin";
  if (bmi < 18.5) return "thin";
  if (bmi < 21) return "fitness";
  if (bmi < 25) return "normal";
  if (bmi < 27.5) return "athletic";
  if (bmi < 30) return "solid";
  if (bmi < 35) return "large";
  if (bmi < 40) return "full";
  return "very_full";
}

function roundBmi(value: number) {
  return Math.round(value * 10) / 10;
}
