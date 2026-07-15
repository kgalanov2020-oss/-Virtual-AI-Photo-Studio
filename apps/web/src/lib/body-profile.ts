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
    "visibly very thin underweight body, very narrow frame, small waist, slender arms and legs, realistic natural proportions",
  thin: "visibly thin slim body, narrow frame and waist, slender arms and legs, realistic natural proportions",
  fitness: "lean fitness body, slim toned waist, lightly defined arms and legs, realistic natural proportions",
  normal:
    "average normal-size body, medium frame and waist, proportionate torso, neither thin nor heavyset, realistic proportions",
  athletic:
    "athletic strong body, developed shoulders and limbs, toned solid silhouette, realistic proportions",
  solid:
    "solid sturdy body, broad torso, moderately substantial waist and limbs, realistic natural proportions",
  large:
    "visibly large heavyset body, broad torso, substantial waist and abdomen, fuller arms and legs, realistic natural proportions",
  full:
    "visibly plus-size full body, wide torso, pronounced waist and abdomen, full arms and legs, realistic natural proportions, respectful flattering styling",
  very_full:
    "visibly very plus-size heavy body, very wide torso, large waist and abdomen, very full arms and legs, realistic natural proportions, respectful flattering styling",
};

const BODY_BUILD_NEGATIVE_PROMPTS: Record<BodyBuild, string> = {
  very_thin: "plus-size, heavyset, broad thick torso, large waist, full arms, full legs",
  thin: "plus-size, heavyset, broad thick torso, large waist, full arms, full legs",
  fitness: "plus-size, heavyset, large abdomen, very bulky body, bodybuilder physique",
  normal: "underweight, extremely thin, plus-size, heavyset, large abdomen, bodybuilder physique",
  athletic: "underweight, frail body, plus-size, large abdomen, soft untoned silhouette",
  solid: "underweight, very thin, narrow frame, very large abdomen, extremely plus-size",
  large: "underweight, thin, slim, lean narrow frame, flat narrow waist, athletic bodybuilder",
  full: "underweight, thin, slim, lean narrow frame, flat waist, athletic bodybuilder",
  very_full: "underweight, thin, slim, lean narrow frame, flat waist, athletic bodybuilder",
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

export function getBodyProfilePrompt(bodyProfile?: BodyProfile | null) {
  if (!bodyProfile) return "";

  return [
    `MANDATORY TARGET BODY PROFILE: target subject height ${bodyProfile.heightCm} cm, weight ${bodyProfile.weightKg} kg, BMI ${bodyProfile.bmi}`,
    getBodyBuildPrompt(bodyProfile.bodyBuild),
    "show this target body size clearly in the torso, waist, abdomen, shoulders, arms and legs",
    "use the reference selfie for face, hair and identity only; do not copy or infer body size from the reference selfie",
    "clothing must naturally fit the target body and must not conceal or visually slim the body",
  ].join("; ");
}

export function getBodyProfileNegativePrompt(bodyProfile?: BodyProfile | null) {
  return bodyProfile ? BODY_BUILD_NEGATIVE_PROMPTS[bodyProfile.bodyBuild] ?? "" : "";
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
