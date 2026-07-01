import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const require = createRequire(path.join(root, "apps", "web", "package.json"));
const { createClient } = require("@supabase/supabase-js");
const envPath = path.join(root, "apps", "web", ".env.local");
const catalogPath = path.join(root, "apps", "web", "src", "lib", "studio-catalog.json");

for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
  if (!match) continue;
  process.env[match[1]] = match[2].replace(/^["']|["']$/g, "");
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are required in apps/web/.env.local");
}

const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));
const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { persistSession: false },
});

const negativePrompt = [
  "nsfw, nude, naked, porn, erotic",
  "wrong identity, different person, wrong gender, wrong age, deformed face, bad anatomy, bad eyes",
  "extra limbs, extra fingers, broken hands, missing hands, duplicate person",
  "watermark, readable text, logo, brand mark, cartoon, anime, cgi, 3d render, plastic skin, low quality",
  "cluttered room, messy background, distorted furniture, impossible architecture"
].join(", ");

const photographerDirection = [
  "professional photoshoot posing directed by an experienced portrait photographer",
  "natural editorial body language",
  "relaxed shoulders",
  "hands placed intentionally and elegantly",
  "subtle turn of the torso",
  "weight shifted naturally",
  "beautiful fashionable styling",
  "not stiff, not passport-like"
].join(", ");

const officePoseTemplates = [
  {
    slug: "window-portrait",
    name: "Портрет у окна",
    camera: "портретный объектив 85 мм",
    pose: "стоит у окна, спокойный естественный взгляд",
    prompt: "standing near the main window, natural calm expression, soft daylight on face",
  },
  {
    slug: "desk-seated",
    name: "За рабочим столом",
    camera: "объектив 70 мм, ракурс три четверти",
    pose: "сидит за столом, руки видны рядом с ноутбуком или заметками",
    prompt: "sitting at a desk, hands visible near laptop or notes, attentive work moment",
  },
  {
    slug: "standing-confidence",
    name: "Уверенный портрет стоя",
    camera: "объектив 50 мм, уровень глаз",
    pose: "стоит уверенно, руки расслаблены",
    prompt: "standing confidently with relaxed arms, natural posture, premium background",
  },
  {
    slug: "lounge-chair",
    name: "В кресле",
    camera: "объектив 85 мм, уровень глаз",
    pose: "сидит в дизайнерском кресле, корпус и руки видны",
    prompt: "sitting in a designer lounge chair, hands relaxed, chair shape visible",
  },
  {
    slug: "presentation",
    name: "Момент презентации",
    camera: "объектив 70 мм, боковой ракурс",
    pose: "стоит рядом с экраном или стеной, жест рукой",
    prompt: "standing beside a presentation screen or feature wall, one hand gesturing naturally",
  },
  {
    slug: "walking",
    name: "Кадр в движении",
    camera: "репортажный объектив 50 мм",
    pose: "идёт через пространство, естественное движение рук и шага",
    prompt: "walking naturally through the space, natural movement in arms and legs",
  },
  {
    slug: "coffee-table",
    name: "У журнального столика",
    camera: "объектив 50 мм, ракурс три четверти",
    pose: "сидит или стоит рядом с низким столиком, руки видны",
    prompt: "sitting or standing near a low coffee table, hands visible, premium details nearby",
  },
  {
    slug: "side-profile",
    name: "Расслабленный профиль сидя",
    camera: "объектив 85 мм, боковой ракурс",
    pose: "сидит в полуобороте, спокойный профиль или взгляд в сторону",
    prompt: "relaxed seated side profile or half-turn in a lounge area, looking away calmly, background depth visible",
  },
  {
    slug: "arms-crossed",
    name: "Расслабленно на диване",
    camera: "объектив 50 мм, уровень глаз",
    pose: "сидит расслабленно на диване или кресле, руки полностью видны",
    prompt: "relaxed seated portrait on a sofa or lounge chair, full forearms and hands visible, confident but natural",
  },
  {
    slug: "hero-final",
    name: "Главный hero-кадр",
    camera: "лучший editorial-ракурс, объектив 70 мм",
    pose: "финальная уверенная поза для выбранного интерьера",
    prompt: "signature confident editorial pose for this interior, polished final gallery image",
  },
];

const premiumGymPoseTemplates = [
  {
    slug: "mirror-training",
    name: "У зеркала",
    camera: "объектив 70 мм, ракурс три четверти",
    pose: "стоит у большого зеркала в стильной спортивной одежде, руки расслаблены",
    prompt: "standing near a large gym mirror, stylish athletic outfit, relaxed confident fitness posture",
  },
  {
    slug: "free-weights",
    name: "Зона свободных весов",
    camera: "объектив 50 мм, уровень глаз",
    pose: "стоит рядом с гантелями или стойкой весов, естественная спортивная поза",
    prompt: "standing beside premium dumbbells or weight rack, fashionable fitness styling, natural athletic pose",
  },
  {
    slug: "treadmill-walk",
    name: "Кардио-зона",
    camera: "репортажный объектив 50 мм",
    pose: "идёт или стоит у кардио-зоны, тело в естественном движении",
    prompt: "natural walking moment near premium cardio equipment, body in motion, stylish sportswear",
  },
  {
    slug: "functional-zone",
    name: "Функциональная зона",
    camera: "широкий объектив 35 мм",
    pose: "стоит в функциональной зоне, видна архитектура спортзала",
    prompt: "standing in an open functional training zone, luxury gym architecture clearly visible",
  },
  {
    slug: "stretching-moment",
    name: "Момент растяжки",
    camera: "объектив 70 мм, боковой ракурс",
    pose: "делает спокойную растяжку или разминку, безопасная естественная поза",
    prompt: "calm warm-up or stretching moment, modest fully clothed athletic styling, safe natural fitness pose",
  },
  {
    slug: "training-equipment",
    name: "Сидя у тренажёра",
    camera: "объектив 50 мм, ракурс три четверти",
    pose: "сидит на спортивной тумбе или тренажёрной скамье, руки видны, расслабленный фитнес-образ",
    prompt: "relaxed seated fitness portrait on a gym plyo box or training bench, hands visible, athletic posture, clean fitness-club setting",
  },
  {
    slug: "locker-lounge",
    name: "У lounge-зоны",
    camera: "объектив 70 мм, мягкий свет",
    pose: "стоит у входной или lounge-зоны спортзала, уверенный спокойный образ",
    prompt: "standing near the premium gym entry lounge, confident lifestyle fitness portrait, fashionable sportswear",
  },
  {
    slug: "equipment-detail",
    name: "С деталями тренажёров",
    camera: "объектив 85 мм, глубина резкости",
    pose: "стоит между тренажёрами, часть оборудования на переднем плане",
    prompt: "standing between gym machines with blurred premium equipment in foreground, editorial fitness photo",
  },
  {
    slug: "post-workout",
    name: "После тренировки",
    camera: "объектив 50 мм, естественный свет",
    pose: "сидит расслабленно после тренировки, полотенце или бутылка воды допустимы",
    prompt: "relaxed seated post-workout lifestyle moment, water bottle or towel may be visible, premium fitness-club setting",
  },
  {
    slug: "gym-hero",
    name: "Главный спортивный кадр",
    camera: "лучший editorial-ракурс, объектив 70 мм",
    pose: "уверенная финальная поза в пространстве премиального спортзала",
    prompt: "signature confident editorial fitness pose in the premium gym, stylish modern sportswear, polished final image",
  },
];

const hotelPoseTemplates = [
  {
    slug: "lobby-arrival",
    name: "В lobby-зоне",
    camera: "объектив 70 мм, ракурс три четверти",
    pose: "стоит в lobby-зоне, элегантная вечерняя или smart-casual поза",
    prompt: "standing in the boutique hotel lobby, elegant fashionable outfit, refined arrival moment",
  },
  {
    slug: "velvet-lounge",
    name: "В бархатном кресле",
    camera: "объектив 85 мм, уровень глаз",
    pose: "сидит в lounge-кресле, корпус и руки видны, дорогая спокойная пластика",
    prompt: "seated in a velvet lounge chair, hands visible, refined evening styling, luxury hotel atmosphere",
  },
  {
    slug: "marble-corridor",
    name: "В мраморном холле",
    camera: "репортажный объектив 50 мм",
    pose: "идёт через мраморный холл, естественный шаг и мягкий взгляд",
    prompt: "walking through a marble hotel hall, elegant motion, polished fashion styling",
  },
  {
    slug: "window-curtains",
    name: "У высоких штор",
    camera: "объектив 85 мм, мягкий боковой свет",
    pose: "стоит у высоких штор или окна, вечерний стильный образ",
    prompt: "standing near tall curtains and soft window light, elegant hotel portrait, fashionable outfit",
  },
  {
    slug: "brass-console",
    name: "На lounge-диване",
    camera: "объектив 50 мм, ракурс три четверти",
    pose: "сидит расслабленно на lounge-диване или банкетке, руки видны",
    prompt: "relaxed seated portrait on a hotel lounge sofa or banquette, hands visible, elegant hospitality setting",
  },
  {
    slug: "lounge-conversation",
    name: "Lounge-момент",
    camera: "объектив 70 мм, документальный ракурс",
    pose: "естественный разговорный жест в lounge-зоне, без рабочих предметов",
    prompt: "natural conversation gesture in the hotel lounge, stylish evening-casual wardrobe, relaxed hospitality mood",
  },
  {
    slug: "stair-or-hall",
    name: "Архитектурный проход",
    camera: "широкий объектив 35 мм",
    pose: "стоит или идёт в архитектурном проходе, интерьер хорошо виден",
    prompt: "standing or walking in an elegant hotel architectural passage, full interior context visible",
  },
  {
    slug: "seated-side",
    name: "Боковой lounge-кадр",
    camera: "объектив 70 мм, боковой ракурс",
    pose: "сидит в полуобороте на кресле или диване, стильный вечерний силуэт",
    prompt: "side-angle seated lounge portrait, elegant silhouette, velvet and marble details visible",
  },
  {
    slug: "detail-foreground",
    name: "Через детали интерьера",
    camera: "объектив 85 мм, размытый передний план",
    pose: "стоит за декоративной деталью переднего плана",
    prompt: "portrait through blurred hotel decor foreground, refined fashion styling, warm cinematic light",
  },
  {
    slug: "hotel-hero",
    name: "Главный hotel-кадр",
    camera: "лучший editorial-ракурс, объектив 70 мм",
    pose: "расслабленная финальная поза в атмосфере boutique hotel, сидя или полусидя",
    prompt: "signature polished relaxed seated or half-seated editorial pose in boutique hotel interior, stylish beautiful evening wardrobe",
  },
];

const galleryPoseTemplates = [
  {
    slug: "artwork-view",
    name: "У большой картины",
    camera: "объектив 70 мм, ракурс три четверти",
    pose: "стоит рядом с большой картиной, взгляд на работу или в сторону",
    prompt: "standing beside a large abstract artwork, looking at the art or slightly away, fashionable gallery-opening outfit",
  },
  {
    slug: "gallery-walk",
    name: "Проход по галерее",
    camera: "репортажный объектив 50 мм",
    pose: "идёт через зал галереи, естественное движение рук и шага",
    prompt: "walking through a contemporary gallery hall, natural motion, elegant artistic wardrobe",
  },
  {
    slug: "sculpture-zone",
    name: "У скульптуры",
    camera: "объектив 50 мм, уровень глаз",
    pose: "стоит у скульптуры или арт-объекта, руки расслаблены",
    prompt: "standing near a sculpture or art object, hands relaxed, refined creative outfit",
  },
  {
    slug: "white-wall",
    name: "На фоне белой стены",
    camera: "объектив 85 мм, мягкий музейный свет",
    pose: "стоит на фоне белой стены и трекового света, архитектурная поза",
    prompt: "standing against a clean white gallery wall with museum track lighting, architectural fashion pose",
  },
  {
    slug: "art-object",
    name: "На музейной скамье",
    camera: "объектив 70 мм, боковой ракурс",
    pose: "сидит спокойно на музейной скамье рядом с экспозицией, руки видны",
    prompt: "relaxed seated gallery visitor portrait on a minimal museum bench beside an art installation, hands visible, gallery context clear",
  },
  {
    slug: "corner-room",
    name: "Угловой зал",
    camera: "широкий объектив 35 мм",
    pose: "стоит в угловом зале между двумя работами, интерьер хорошо виден",
    prompt: "standing in a corner gallery room between two large artworks, full space visible",
  },
  {
    slug: "looking-up",
    name: "Взгляд на экспозицию",
    camera: "объектив 85 мм, лёгкий нижний ракурс",
    pose: "смотрит на экспозицию, спокойный интеллектуальный образ",
    prompt: "looking up toward an artwork or installation, sophisticated gallery visitor mood",
  },
  {
    slug: "foreground-art",
    name: "Через арт-объект",
    camera: "объектив 85 мм, размытый передний план",
    pose: "человек частично обрамлён арт-объектом на переднем плане",
    prompt: "portrait framed through blurred sculpture or artwork foreground, stylish gallery atmosphere",
  },
  {
    slug: "track-light",
    name: "Под трековым светом",
    camera: "объектив 70 мм, чистый editorial-свет",
    pose: "стоит под трековым светом, руки видны, спокойная поза",
    prompt: "standing under museum track lights, clean editorial light, hands visible, artistic wardrobe",
  },
  {
    slug: "gallery-hero",
    name: "Главный gallery-кадр",
    camera: "лучший editorial-ракурс, объектив 70 мм",
    pose: "спокойная финальная поза в современной галерее, сидя или стоя рядом с арт-объектом",
    prompt: "signature fashionable relaxed editorial pose in contemporary art gallery, seated or standing beside an art object, gallery-opening atmosphere",
  },
];

const wellnessPoseTemplates = [
  {
    slug: "spa-window",
    name: "У мягкого света",
    camera: "объектив 85 мм, мягкий дневной свет",
    pose: "стоит у мягкого света и натуральных материалов, спокойный образ",
    prompt: "standing near soft daylight in a premium spa lounge, calm fashionable linen or knitwear",
  },
  {
    slug: "wood-slat-wall",
    name: "У деревянной стены",
    camera: "объектив 70 мм, ракурс три четверти",
    pose: "стоит у деревянной или каменной стены, руки расслаблены",
    prompt: "standing near warm wood slats or stone wall, relaxed wellness lifestyle pose, fully clothed stylish outfit",
  },
  {
    slug: "spa-walk",
    name: "Проход по SPA",
    camera: "репортажный объектив 50 мм",
    pose: "идёт через calm-зону, естественный шаг и мягкое выражение",
    prompt: "walking naturally through a calm spa lounge corridor, soft fully clothed knitwear or linen",
  },
  {
    slug: "plant-corner",
    name: "У растений",
    camera: "объектив 85 мм, глубина резкости",
    pose: "стоит рядом с растениями, спокойный lifestyle-образ",
    prompt: "standing beside indoor plants in a wellness lounge, calm premium lifestyle styling",
  },
  {
    slug: "linen-lounge",
    name: "Lounge-зона",
    camera: "объектив 70 мм, уровень глаз",
    pose: "спокойно сидит в lounge-зоне SPA, руки расслаблены",
    prompt: "relaxed seated moment in a spa lounge, hands relaxed, modest fully clothed styling",
  },
  {
    slug: "stone-detail",
    name: "На фоне камня",
    camera: "объектив 85 мм, портретный свет",
    pose: "стоит на фоне каменной текстуры, лицо и одежда читаются",
    prompt: "standing against natural stone texture, soft premium spa light, elegant calm outfit",
  },
  {
    slug: "tea-corner",
    name: "У чайной зоны",
    camera: "объектив 50 мм, ракурс три четверти",
    pose: "сидит рядом с чайной или relaxation-зоной, руки видны",
    prompt: "relaxed seated portrait near a tea or relaxation area, hands visible, calm wellness atmosphere",
  },
  {
    slug: "soft-corridor",
    name: "Мягкий коридор",
    camera: "широкий объектив 35 мм",
    pose: "стоит в мягко освещённом коридоре SPA, интерьер хорошо виден",
    prompt: "standing in a softly lit spa corridor, full interior context visible, peaceful premium look",
  },
  {
    slug: "foreground-plant",
    name: "Через зелень",
    camera: "объектив 85 мм, размытый передний план",
    pose: "человек частично обрамлён зеленью переднего плана",
    prompt: "portrait framed through blurred green plants, calm spa mood, stylish modest wardrobe",
  },
  {
    slug: "spa-hero",
    name: "Главный SPA-кадр",
    camera: "лучший editorial-ракурс, объектив 70 мм",
    pose: "расслабленная финальная поза сидя в wellness-интерьере",
    prompt: "signature calm relaxed seated editorial wellness portrait, beautiful fashionable outfit matching the spa interior",
  },
];

const castlePoseTemplates = [
  {
    slug: "library-window",
    name: "У высокого окна",
    camera: "объектив 85 мм, мягкий боковой свет",
    pose: "стоит у высокого окна библиотеки, классический благородный образ",
    prompt: "standing near a tall castle library window, classic elegant wardrobe, heritage atmosphere",
  },
  {
    slug: "book-wall",
    name: "У книжной стены",
    camera: "объектив 70 мм, уровень глаз",
    pose: "стоит рядом с книжной стеной, руки расслаблены",
    prompt: "standing beside dark carved wood bookshelves, refined classic outfit, hands relaxed",
  },
  {
    slug: "reading-table",
    name: "У читального стола",
    camera: "объектив 50 мм, ракурс три четверти",
    pose: "сидит у старинного читального стола или рядом с ним, спокойная классическая поза",
    prompt: "relaxed seated portrait beside an antique reading table, one hand may rest lightly, classic library mood",
  },
  {
    slug: "stone-arch",
    name: "У каменной арки",
    camera: "широкий объектив 35 мм",
    pose: "стоит у каменной арки, интерьер замка хорошо виден",
    prompt: "standing near a stone arch in the castle library, full interior architecture visible",
  },
  {
    slug: "leather-chair",
    name: "В кожаном кресле",
    camera: "объектив 85 мм, уровень глаз",
    pose: "сидит в кожаном кресле с благородной спокойной пластикой",
    prompt: "seated in a leather reading chair, elegant heritage styling, hands visible",
  },
  {
    slug: "library-walk",
    name: "Проход по библиотеке",
    camera: "репортажный объектив 50 мм",
    pose: "идёт вдоль книжных полок, естественное движение",
    prompt: "walking along castle library shelves, natural motion, classic refined wardrobe",
  },
  {
    slug: "chandelier-light",
    name: "Под люстрой",
    camera: "объектив 70 мм, мягкий верхний свет",
    pose: "стоит под люстрой или тёплым верхним светом",
    prompt: "standing under warm chandelier light, carved wood and books behind, elegant timeless outfit",
  },
  {
    slug: "book-detail",
    name: "С книгой в кадре",
    camera: "объектив 85 мм, размытый передний план",
    pose: "стоит рядом с книгами, книга или полка на переднем плане",
    prompt: "portrait with blurred books in the foreground, classic library atmosphere",
  },
  {
    slug: "balcony-view",
    name: "В глубине зала",
    camera: "телеобъектив вдоль зала",
    pose: "стоит в глубине библиотеки, читается масштаб пространства",
    prompt: "standing deeper inside the castle library hall, depth and scale visible, heritage interior",
  },
  {
    slug: "castle-hero",
    name: "Главный castle-кадр",
    camera: "лучший editorial-ракурс, объектив 70 мм",
    pose: "расслабленная финальная поза сидя в атмосфере библиотеки замка",
    prompt: "signature refined relaxed seated editorial pose in castle library, classic stylish wardrobe matching the interior",
  },
];

const hiTechPoseTemplates = [
  {
    slug: "glass-wall",
    name: "У стеклянной стены",
    camera: "объектив 70 мм, ракурс три четверти",
    pose: "стоит у стеклянной стены, технологичный стильный образ",
    prompt: "standing near a glass wall in a hi-tech lab, sleek fashionable smart-casual wardrobe",
  },
  {
    slug: "light-panel",
    name: "У световой панели",
    camera: "объектив 85 мм, мягкий свет",
    pose: "стоит рядом со световой панелью, руки расслаблены",
    prompt: "standing beside a glowing light panel, clean technical fabrics, sleek innovation styling",
  },
  {
    slug: "innovation-walk",
    name: "Проход по lab-зоне",
    camera: "репортажный объектив 50 мм",
    pose: "идёт через технологичное пространство, естественный шаг",
    prompt: "walking naturally through a futuristic innovation office, sleek modern styling",
  },
  {
    slug: "transparent-screen",
    name: "У прозрачного экрана",
    camera: "объектив 50 мм, уровень глаз",
    pose: "стоит рядом с прозрачным экраном с абстрактной графикой без текста",
    prompt: "standing near a transparent screen with abstract graphics only, one natural gesture",
  },
  {
    slug: "metal-detail",
    name: "Сидя в hi-tech lounge",
    camera: "объектив 85 мм, глубина резкости",
    pose: "сидит в футуристичном lounge-кресле или pod-зоне, руки видны",
    prompt: "relaxed seated portrait in a futuristic lounge chair or pod zone, matte metal and glass details visible, high-tech editorial portrait",
  },
  {
    slug: "pod-zone",
    name: "У рабочей pod-зоны",
    camera: "широкий объектив 35 мм",
    pose: "стоит у технологичной pod-зоны, интерьер хорошо виден",
    prompt: "standing near clean futuristic workstation pods, full hi-tech architecture visible",
  },
  {
    slug: "blue-light",
    name: "В холодном свете",
    camera: "объектив 70 мм, боковой свет",
    pose: "стоит в холодном световом акценте, уверенный спокойный вид",
    prompt: "standing in cool blue-white accent light, sleek innovation-leader styling",
  },
  {
    slug: "screen-gesture",
    name: "Жест у экрана",
    camera: "объектив 70 мм, боковой ракурс",
    pose: "делает естественный жест у экрана или панели, без офисной презентации",
    prompt: "natural gesture near an abstract technology interface, futuristic product-demo mood",
  },
  {
    slug: "lab-depth",
    name: "Глубина пространства",
    camera: "телеобъектив вдоль коридора",
    pose: "стоит в глубине hi-tech коридора, читается перспектива",
    prompt: "standing in the depth of a futuristic corridor, perspective lines and light strips visible",
  },
  {
    slug: "hitech-hero",
    name: "Главный hi-tech кадр",
    camera: "лучший editorial-ракурс, объектив 70 мм",
    pose: "расслабленная финальная поза сидя или полусидя в технологичном интерьере",
    prompt: "signature polished relaxed seated or half-seated editorial pose in premium hi-tech lab, stylish modern wardrobe matching the space",
  },
];

const loftPoseTemplates = [
  {
    slug: "brick-wall",
    name: "У кирпичной стены",
    camera: "объектив 70 мм, ракурс три четверти",
    pose: "стоит у кирпичной стены, стильный городской образ",
    prompt: "standing near exposed brick wall, stylish urban editorial outfit, leather or relaxed blazer",
  },
  {
    slug: "steel-window",
    name: "У steel-окна",
    camera: "объектив 85 мм, боковой свет",
    pose: "стоит у большого окна с чёрными рамами",
    prompt: "standing near black steel framed city window, fashionable city look, natural side light",
  },
  {
    slug: "loft-walk",
    name: "Движение по loft",
    camera: "репортажный объектив 50 мм",
    pose: "идёт через loft-пространство, естественное движение",
    prompt: "walking naturally through an urban loft, exposed brick and concrete visible",
  },
  {
    slug: "leather-chair",
    name: "В кожаном кресле",
    camera: "объектив 85 мм, уровень глаз",
    pose: "сидит в кожаном кресле, руки видны, editorial-настроение",
    prompt: "seated in a leather lounge chair, hands visible, stylish editorial city mood",
  },
  {
    slug: "concrete-corner",
    name: "Бетонный угол",
    camera: "объектив 70 мм, мягкий контраст",
    pose: "стоит в бетонном углу, спокойная уверенная поза",
    prompt: "standing in a polished concrete corner, relaxed confident pose, urban fashion styling",
  },
  {
    slug: "industrial-light",
    name: "Под industrial-светом",
    camera: "объектив 50 мм, уровень глаз",
    pose: "стоит под тёплыми industrial-светильниками",
    prompt: "standing under warm industrial pendant lights, city loft atmosphere, fashionable wardrobe",
  },
  {
    slug: "table-edge",
    name: "На loft-диване",
    camera: "объектив 50 мм, ракурс три четверти",
    pose: "сидит расслабленно на диване или низком кресле в loft-пространстве",
    prompt: "relaxed seated portrait on a sofa or low lounge chair in an urban loft, stylish editorial scene",
  },
  {
    slug: "foreground-beam",
    name: "Через балки",
    camera: "объектив 85 мм, размытый передний план",
    pose: "человек частично обрамлён балкой или стальной деталью",
    prompt: "portrait framed through blurred steel beam foreground, urban editorial atmosphere",
  },
  {
    slug: "city-window-wide",
    name: "Широкий кадр у окна",
    camera: "широкий объектив 35 мм",
    pose: "стоит в открытом пространстве loft рядом с городским окном",
    prompt: "standing in open loft space near city windows, full interior context visible",
  },
  {
    slug: "loft-hero",
    name: "Главный loft-кадр",
    camera: "лучший editorial-ракурс, объектив 70 мм",
    pose: "расслабленная финальная поза сидя или полусидя в городском loft-интерьере",
    prompt: "signature stylish relaxed seated or half-seated editorial pose in urban loft, fashionable city wardrobe matching the space",
  },
];

const penthousePoseTemplates = [
  {
    slug: "panoramic-window",
    name: "У панорамного окна",
    camera: "объектив 85 мм, мягкий дневной свет",
    pose: "стоит у панорамного окна, премиальный lifestyle-образ",
    prompt: "standing near panoramic city window, elegant premium lifestyle outfit, soft daylight",
  },
  {
    slug: "sofa-lounge",
    name: "В lounge-зоне",
    camera: "объектив 70 мм, уровень глаз",
    pose: "сидит или стоит у дизайнерского дивана, руки видны",
    prompt: "seated or standing near designer sofa, hands visible, upscale private-event look",
  },
  {
    slug: "penthouse-walk",
    name: "Движение по пентхаусу",
    camera: "репортажный объектив 50 мм",
    pose: "идёт через пентхаус, естественный шаг и спокойный взгляд",
    prompt: "walking naturally through luxury penthouse living area, refined elegant wardrobe",
  },
  {
    slug: "stone-wall",
    name: "На фоне stone wall",
    camera: "объектив 85 мм, мягкий контраст",
    pose: "стоит на фоне каменной стены или арт-объекта",
    prompt: "standing against warm stone wall or art feature, elegant fashion styling",
  },
  {
    slug: "bar-corner",
    name: "Сидя у bar-зоны",
    camera: "объектив 50 мм, ракурс три четверти",
    pose: "сидит расслабленно у bar-зоны или консоли, руки видны",
    prompt: "relaxed seated portrait beside a penthouse bar or console, hands visible, stylish evening-casual wardrobe, private residence mood",
  },
  {
    slug: "city-view-side",
    name: "Профиль на город",
    camera: "объектив 85 мм, боковой ракурс",
    pose: "полуоборот или профиль на фоне городского вида",
    prompt: "side profile or half-turn with city skyline behind, premium lifestyle mood",
  },
  {
    slug: "dining-zone",
    name: "У dining-зоны",
    camera: "широкий объектив 35 мм",
    pose: "стоит у dining-зоны, пространство и материалы хорошо видны",
    prompt: "standing near elegant dining zone, full penthouse architecture visible, private lifestyle atmosphere",
  },
  {
    slug: "foreground-detail",
    name: "Через детали",
    camera: "объектив 85 мм, размытый передний план",
    pose: "человек обрамлён декоративной деталью переднего плана",
    prompt: "portrait through blurred luxury decor foreground, stone, brass and fabric details visible",
  },
  {
    slug: "evening-light",
    name: "В вечернем свете",
    camera: "объектив 70 мм, тёплый вечерний свет",
    pose: "сидит или полусидит в мягком вечернем свете пентхауса",
    prompt: "relaxed seated or half-seated portrait in warm evening penthouse light, elegant fashionable wardrobe, calm premium expression",
  },
  {
    slug: "penthouse-hero",
    name: "Главный penthouse-кадр",
    camera: "лучший editorial-ракурс, объектив 70 мм",
    pose: "уверенная финальная поза в luxury penthouse",
    prompt: "signature polished editorial pose in luxury penthouse, beautiful stylish wardrobe matching the interior",
  },
];

const boardroomPoseTemplates = [
  {
    slug: "table-head",
    name: "Во главе стола",
    camera: "объектив 70 мм, ракурс три четверти",
    pose: "стоит или сидит во главе переговорного стола, руки видны",
    prompt: "standing or seated at the head of a boardroom table, hands visible, formal business wardrobe",
  },
  {
    slug: "glass-wall",
    name: "У стеклянной стены",
    camera: "объектив 85 мм, боковой свет",
    pose: "стоит у стеклянной стены переговорной, строгий деловой образ",
    prompt: "standing near boardroom glass wall, polished corporate suit, city view behind",
  },
  {
    slug: "presentation-wall",
    name: "У presentation wall",
    camera: "объектив 70 мм, боковой ракурс",
    pose: "стоит рядом с презентационной стеной, естественный жест рукой",
    prompt: "standing beside a presentation wall with abstract unbranded graphics, one natural hand gesture",
  },
  {
    slug: "boardroom-walk",
    name: "Проход в переговорной",
    camera: "репортажный объектив 50 мм",
    pose: "идёт вдоль переговорного стола, естественное движение",
    prompt: "walking along the boardroom table, natural executive movement, formal business wardrobe",
  },
  {
    slug: "chair-side",
    name: "У кресла",
    camera: "объектив 70 мм, уровень глаз",
    pose: "сидит расслабленно в кожаном кресле переговорной, руки видны",
    prompt: "relaxed seated portrait in a leather conference chair, hands visible, polished leadership portrait",
  },
  {
    slug: "table-detail",
    name: "С деталями стола",
    camera: "объектив 85 мм, размытый передний план",
    pose: "человек обрамлён передним планом переговорного стола",
    prompt: "portrait framed through blurred boardroom table foreground, hands and suit visible",
  },
  {
    slug: "wood-panel",
    name: "У wood panel",
    camera: "объектив 85 мм, мягкий контраст",
    pose: "стоит на фоне деревянных панелей, строгая спокойная поза",
    prompt: "standing against warm wood panels, formal elegant suit, calm executive posture",
  },
  {
    slug: "meeting-gesture",
    name: "Деловой жест",
    camera: "объектив 50 мм, ракурс три четверти",
    pose: "делает естественный деловой жест рядом со столом",
    prompt: "natural business conversation gesture beside the conference table, no exaggerated pose",
  },
  {
    slug: "boardroom-wide",
    name: "Широкий boardroom-кадр",
    camera: "широкий объектив 35 мм",
    pose: "стоит в переговорной так, чтобы была видна архитектура пространства",
    prompt: "standing in the boardroom with full table, glass and wood architecture visible",
  },
  {
    slug: "boardroom-hero",
    name: "Главный boardroom-кадр",
    camera: "лучший editorial-ракурс, объектив 70 мм",
    pose: "уверенная финальная поза в строгом деловом интерьере",
    prompt: "signature polished executive editorial pose in premium boardroom, formal stylish wardrobe",
  },
];

const yachtMarinaPoseTemplates = [
  { slug: "deck-rail", name: "У борта яхты", camera: "объектив 70 мм, мягкий дневной свет", pose: "стоит у борта яхты, одна рука на перилах", prompt: "standing by the yacht rail with one hand on polished chrome rail, marina and sea behind, elegant resort posture" },
  { slug: "stern-lounge", name: "В lounge-зоне палубы", camera: "объектив 85 мм, уровень глаз", pose: "сидит расслабленно на палубной lounge-зоне, руки видны", prompt: "relaxed seated portrait on yacht deck lounge seating, hands visible, calm premium resort mood" },
  { slug: "marina-walk", name: "Прогулка по марине", camera: "репортажный объектив 50 мм", pose: "идёт по причалу марины, естественный шаг", prompt: "walking along marina dock beside yachts, natural stride, elegant nautical lifestyle styling" },
  { slug: "helm-moment", name: "У штурвала", camera: "объектив 50 мм, ракурс три четверти", pose: "стоит у штурвала или навигационной зоны, спокойная уверенность", prompt: "standing at yacht helm or navigation area, confident calm posture, polished nautical details" },
  { slug: "bow-wind", name: "На носу яхты", camera: "объектив 70 мм, боковой ракурс", pose: "стоит на носу яхты, лёгкое движение одежды от ветра", prompt: "standing on yacht bow with subtle wind in clothing, sea horizon, premium travel editorial" },
  { slug: "steps-seated", name: "На ступенях палубы", camera: "объектив 85 мм, мягкий портрет", pose: "сидит на ступенях палубы, корпус и руки видны", prompt: "seated on yacht deck steps, hands relaxed, elegant resort wardrobe, white deck details" },
  { slug: "rope-detail", name: "С деталями канатов", camera: "объектив 85 мм, размытый передний план", pose: "стоит рядом с канатами и палубными деталями", prompt: "portrait framed with blurred nautical ropes and deck hardware, marina lifestyle atmosphere" },
  { slug: "marina-cafe-side", name: "У marina lounge", camera: "объектив 70 мм, тёплый свет", pose: "сидит или стоит у lounge-зоны марины", prompt: "standing or seated near marina lounge area, yachts in background, refined coastal styling" },
  { slug: "sunset-profile", name: "Профиль на море", camera: "объектив 85 мм, закатный боковой свет", pose: "полуоборот или профиль на фоне воды", prompt: "side profile or half-turn with sea and sunset light behind, elegant calm expression" },
  { slug: "yacht-hero", name: "Главный яхтенный кадр", camera: "лучший editorial-ракурс, объектив 70 мм", pose: "уверенная финальная поза на яхте или причале", prompt: "signature polished yacht lifestyle editorial pose, luxury marina and yacht architecture clearly visible" },
];

const beachClubPoseTemplates = [
  { slug: "cabana-entry", name: "У кабаны", camera: "объектив 70 мм, мягкое солнце", pose: "стоит у beach cabana, расслабленная курортная поза", prompt: "standing at elegant beach cabana entrance, tasteful beachwear, linen beach shirt or light sundress, sandals, pale sand and ocean behind, no blazer, no suit" },
  { slug: "sunbed-seated", name: "На шезлонге", camera: "объектив 85 мм, уровень глаз", pose: "сидит на шезлонге, руки видны, без пляжной откровенности", prompt: "seated on designer beach club sunbed, hands visible, tasteful linen resortwear or kaftan cover-up, upscale beach atmosphere, no formal jacket" },
  { slug: "shore-walk", name: "Прогулка у воды", camera: "репортажный объектив 50 мм", pose: "идёт вдоль линии воды, естественный шаг", prompt: "walking along shoreline near beach club, natural movement, relaxed beachwear, resort shorts or flowing summer dress, ocean horizon, no business outfit" },
  { slug: "umbrella-shadow", name: "Под зонтом", camera: "объектив 70 мм, мягкая тень", pose: "стоит под большим кремовым зонтом, спокойный взгляд", prompt: "standing under cream beach umbrella in soft shade, refined beach club resortwear, sandals, straw hat or sunglasses, no blazer, no suit" },
  { slug: "beach-table", name: "У beach table", camera: "объектив 50 мм, ракурс три четверти", pose: "сидит у низкого столика beach club, руки видны", prompt: "seated near low beach club table, hands visible, elegant summer beachwear, linen shirt, kaftan or sundress, resort cafe moment" },
  { slug: "deck-path", name: "На деревянном настиле", camera: "широкий объектив 35 мм", pose: "идёт по деревянному настилу между шезлонгами", prompt: "walking on wooden deck path between sunbeds and cabanas, beach club architecture visible, tasteful beachwear, sandals, no office shoes" },
  { slug: "ocean-profile", name: "Профиль на океан", camera: "объектив 85 мм, боковой свет", pose: "полуоборот к океану, волосы и одежда слегка двигаются", prompt: "side profile looking toward ocean, subtle wind in hair or light beach fabric, premium summer editorial, no corporate styling" },
  { slug: "bar-counter", name: "У beach bar", camera: "объектив 70 мм, тёплый свет", pose: "стоит у стойки beach bar, естественный жест рукой", prompt: "standing at elegant beach bar counter, natural hand gesture, stylish beach vacation outfit, linen resortwear, no formal jacket" },
  { slug: "palm-background", name: "На фоне пальм", camera: "объектив 85 мм, мягкая глубина", pose: "стоит на фоне пальм и светлого песка", prompt: "standing with palms and pale sand behind, clean resort portrait, tasteful beachwear, soft depth of field, no business suit" },
  { slug: "beach-hero", name: "Главный beach club кадр", camera: "лучший editorial-ракурс, объектив 70 мм", pose: "финальная relaxed premium поза в beach club", prompt: "signature elegant beach club editorial pose, relaxed confident resort lifestyle atmosphere, location-appropriate beachwear, no blazer, no suit" },
];

const metropolisStreetPoseTemplates = [
  { slug: "crosswalk-step", name: "На переходе", camera: "репортажный объектив 50 мм", pose: "идёт по городскому переходу, естественный шаг", prompt: "walking across modern city crosswalk, glass buildings behind, confident street editorial movement" },
  { slug: "glass-facade", name: "У стеклянного фасада", camera: "объектив 70 мм, отражения", pose: "стоит у стеклянного фасада, отражения города рядом", prompt: "standing beside reflective glass facade, city reflections, stylish urban outfit" },
  { slug: "curb-portrait", name: "У края улицы", camera: "объектив 85 мм, уровень глаз", pose: "стоит у края тротуара, спокойный городской портрет", prompt: "standing at curbside with urban depth behind, calm editorial expression, no traffic logos" },
  { slug: "street-corner", name: "На углу здания", camera: "объектив 70 мм, ракурс три четверти", pose: "опирается плечом или рукой на архитектурный угол", prompt: "lightly leaning on modern building corner, relaxed city fashion pose" },
  { slug: "coffee-to-go", name: "Городской момент", camera: "объектив 50 мм, документальный стиль", pose: "идёт с кофе или телефоном в руке, естественно", prompt: "natural city moment walking with coffee cup or phone, polished street style, no readable brands" },
  { slug: "metro-entrance", name: "У входа метро", camera: "широкий объектив 35 мм", pose: "стоит рядом с городским входом или лестницей, видна среда", prompt: "standing near modern transit entrance or stairs, urban architecture visible, editorial city look" },
  { slug: "taxi-light", name: "С городским светом", camera: "объектив 85 мм, боковой свет", pose: "полуоборот на фоне огней и машин", prompt: "half-turn portrait with blurred city lights and traffic color accents, fashionable street mood" },
  { slug: "building-steps", name: "На ступенях", camera: "объектив 70 мм, уровень глаз", pose: "сидит на широких городских ступенях, руки видны", prompt: "seated on clean city building steps, hands visible, editorial street style" },
  { slug: "avenue-wide", name: "Широкая авеню", camera: "широкий объектив 35 мм", pose: "стоит в городской перспективе, полный контекст улицы", prompt: "standing in wide avenue perspective, full city scale visible, person integrated into metropolis" },
  { slug: "metropolis-hero", name: "Главный city кадр", camera: "лучший editorial-ракурс, объектив 70 мм", pose: "уверенная fashion-поза на улице мегаполиса", prompt: "signature confident metropolis street editorial pose, strong city depth and stylish wardrobe" },
];

const desertDunesPoseTemplates = [
  { slug: "ridge-stand", name: "На гребне дюны", camera: "объектив 70 мм, закатный свет", pose: "стоит на гребне дюны, силуэт и ткань читаются", prompt: "standing on dune ridge at golden hour, fabric movement, cinematic desert editorial" },
  { slug: "sand-walk", name: "Шаг по песку", camera: "репортажный объектив 50 мм", pose: "идёт по песку, естественный след и движение", prompt: "walking across soft sand with natural footprints, elegant desert outfit, wind shaped dunes" },
  { slug: "seated-dune", name: "Сидя на дюне", camera: "объектив 85 мм, мягкий свет", pose: "сидит на склоне дюны, руки видны", prompt: "seated on dune slope, hands visible, flowing linen or safari styling, calm expression" },
  { slug: "wind-scarf", name: "Ветер и ткань", camera: "объектив 70 мм, боковой ракурс", pose: "держит шарф или край одежды, лёгкое движение ветра", prompt: "holding scarf or coat edge in desert wind, graceful editorial movement" },
  { slug: "desert-profile", name: "Профиль на горизонт", camera: "объектив 85 мм, боковой свет", pose: "профиль или полуоборот на открытый горизонт", prompt: "side profile looking toward open desert horizon, golden light, minimal landscape" },
  { slug: "low-dune-angle", name: "Низкий ракурс дюн", camera: "широкий объектив 35 мм, низкая точка", pose: "стоит выше камеры на линии дюны", prompt: "low-angle wide photo from dune line, person above camera, dramatic sand curves" },
  { slug: "sand-texture", name: "С текстурой песка", camera: "объектив 85 мм, размытый передний план", pose: "стоит за мягким передним планом песка", prompt: "portrait framed through blurred sand texture foreground, warm desert tones" },
  { slug: "sun-backlight", name: "Контровой свет", camera: "объектив 70 мм, контровой свет", pose: "стоит в мягком контровом свете, расслабленная поза", prompt: "standing in soft backlight, desert glow around silhouette, elegant fully clothed styling" },
  { slug: "wide-solitude", name: "Общий кадр пустыни", camera: "широкий объектив 35 мм", pose: "стоит далеко среди барханов, локация доминирует", prompt: "wide environmental desert shot, person small in frame, dunes dominate, cinematic scale" },
  { slug: "desert-hero", name: "Главный desert кадр", camera: "лучший fashion-ракурс, объектив 70 мм", pose: "финальная кинематографичная поза среди дюн", prompt: "signature desert fashion editorial pose, flowing fabric, golden dunes, premium atmosphere" },
];

const luxuryGaragePoseTemplates = [
  { slug: "car-front", name: "У передней части авто", camera: "объектив 70 мм, низкий мягкий ракурс", pose: "стоит рядом с передней частью автомобиля, руки расслаблены", prompt: "standing beside front quarter of luxury car, relaxed confident posture, no logos" },
  { slug: "driver-door", name: "У двери авто", camera: "объектив 50 мм, ракурс три четверти", pose: "стоит у открытой двери автомобиля, естественный жест", prompt: "standing by open car door, one hand near door frame, polished automotive editorial" },
  { slug: "garage-walk", name: "Проход через гараж", camera: "репортажный объектив 50 мм", pose: "идёт между авто, естественный шаг", prompt: "walking through luxury garage between premium cars, cinematic warm lighting" },
  { slug: "hood-lean", name: "Лёгкая опора на авто", camera: "объектив 70 мм, уровень глаз", pose: "слегка опирается на край капота, без сидения на машине", prompt: "lightly leaning on edge of car hood, respectful luxury car pose, hands visible" },
  { slug: "tool-wall", name: "У стены с деталями", camera: "объектив 85 мм, мягкая глубина", pose: "стоит на фоне аккуратной automotive wall", prompt: "standing near clean automotive tool wall or display, premium garage details" },
  { slug: "leather-seat", name: "У салона", camera: "объектив 85 мм, детальный ракурс", pose: "находится рядом с открытым салоном, руки видны", prompt: "portrait near open car interior with leather seat details, stylish city luxury outfit" },
  { slug: "car-reflection", name: "В отражениях кузова", camera: "объектив 70 мм, боковой свет", pose: "полуоборот рядом с глянцевым кузовом", prompt: "half-turn portrait beside reflective car paint, garage lights creating elegant reflections" },
  { slug: "ramp-wide", name: "Широкий гаражный кадр", camera: "широкий объектив 35 мм", pose: "стоит в пространстве гаража, видны авто и архитектура", prompt: "standing in luxury garage wide frame, multiple cars and architecture visible" },
  { slug: "seated-bench", name: "На leather bench", camera: "объектив 70 мм, уровень глаз", pose: "сидит на lounge-скамье гаража, руки видны", prompt: "seated on leather lounge bench inside luxury garage, hands visible, relaxed automotive lifestyle" },
  { slug: "garage-hero", name: "Главный auto кадр", camera: "лучший editorial-ракурс, объектив 70 мм", pose: "финальная уверенная поза в luxury garage", prompt: "signature luxury automotive editorial pose, premium cars and garage lighting clearly visible" },
];

const pitLanePoseTemplates = [
  { slug: "bike-side", name: "Рядом с мотоциклом", camera: "объектив 70 мм, ракурс три четверти", pose: "стоит рядом с гоночным мотоциклом, руки расслаблены", prompt: "standing beside matte racing motorcycle in pit lane, no logos, confident motorsport posture" },
  { slug: "garage-bay", name: "У бокса", camera: "объектив 50 мм, документальный ракурс", pose: "стоит у открытого бокса pit lane, техника на фоне", prompt: "standing at open pit garage bay, tools and bike silhouettes behind, racing editorial atmosphere" },
  { slug: "pit-walk", name: "Проход по pit lane", camera: "репортажный объектив 50 мм", pose: "идёт вдоль pit lane, естественный шаг", prompt: "walking along pit lane markings, natural movement, motorsport jacket, cinematic track mood" },
  { slug: "helmet-hold", name: "С шлемом в руках", camera: "объектив 70 мм, уровень глаз", pose: "держит шлем в руках у корпуса, лицо открыто", prompt: "holding a racing helmet at waist level, face visible, fully clothed motorsport styling" },
  { slug: "pit-wall", name: "У pit wall", camera: "объектив 85 мм, боковой свет", pose: "стоит у pit wall, взгляд в сторону трассы", prompt: "standing near pit wall looking toward track, focused calm expression, racing environment" },
  { slug: "mechanic-table", name: "У рабочей стойки", camera: "объектив 70 мм, ракурс три четверти", pose: "стоит у аккуратной рабочей стойки с деталями, без стола как офис", prompt: "standing at clean racing workbench with tools and parts, natural hand placement, motorsport context" },
  { slug: "track-entry", name: "На выезде к треку", camera: "широкий объектив 35 мм", pose: "стоит у выезда на трассу, видна линия pit lane", prompt: "standing at pit lane exit with track line visible, wide motorsport architecture context" },
  { slug: "bike-detail-frame", name: "Через детали байка", camera: "объектив 85 мм, передний план", pose: "портрет через размытые детали мотоцикла", prompt: "portrait framed through blurred motorcycle handlebar or wheel foreground, racing garage depth" },
  { slug: "seated-pit-box", name: "На pit stool", camera: "объектив 70 мм, уровень глаз", pose: "сидит на pit stool или технической тумбе, руки видны", prompt: "seated on pit stool or equipment case, hands visible, stylish motorsport outfit, safe editorial pose" },
  { slug: "racing-hero", name: "Главный racing кадр", camera: "лучший editorial-ракурс, объектив 70 мм", pose: "финальная собранная поза в pit lane", prompt: "signature motorsport pit lane editorial pose, dynamic racing atmosphere, no logos" },
];

const privateJetPoseTemplates = [
  { slug: "cabin-seat", name: "В кресле бизнес-джета", camera: "объектив 70 мм, уровень глаз", pose: "сидит в кожаном кресле, руки видны", prompt: "seated in cream leather private jet chair, hands visible, elegant travel wardrobe" },
  { slug: "aisle-stand", name: "В проходе салона", camera: "объектив 50 мм, ракурс три четверти", pose: "стоит в узком проходе салона, спокойная осанка", prompt: "standing in private jet cabin aisle, oval windows and polished panels visible" },
  { slug: "window-side", name: "У овального окна", camera: "объектив 85 мм, мягкий свет", pose: "сидит или стоит у овального окна, взгляд в сторону", prompt: "seated or standing by oval airplane window, soft daylight on face, quiet luxury travel mood" },
  { slug: "boarding-steps", name: "На трапе", camera: "объектив 70 мм, открытый ракурс", pose: "стоит на трапе у бизнес-джета, естественный шаг", prompt: "standing or stepping on private jet stairs, aircraft exterior detail, premium travel editorial" },
  { slug: "table-moment", name: "У складного столика", camera: "объектив 50 мм, документальный стиль", pose: "сидит у компактного столика, руки видны", prompt: "seated at private jet fold-out table, hands visible, refined travel business moment" },
  { slug: "cabin-walk", name: "Движение по салону", camera: "репортажный объектив 50 мм", pose: "идёт по проходу салона, естественное движение", prompt: "walking through compact jet cabin, natural movement, premium cabin details" },
  { slug: "seat-profile", name: "Профиль в кресле", camera: "объектив 85 мм, боковой свет", pose: "сидит в профиль или полуобороте у окна", prompt: "side profile seated in jet chair near oval window, calm confident expression" },
  { slug: "luggage-detail", name: "С travel-деталями", camera: "объектив 70 мм, мягкая глубина", pose: "стоит рядом с аккуратным carry-on luggage", prompt: "standing near discreet carry-on luggage inside jet cabin, polished travel styling" },
  { slug: "galley-corner", name: "У galley-зоны", camera: "объектив 70 мм, ракурс три четверти", pose: "стоит у compact galley, руки расслаблены", prompt: "standing near private jet galley corner, polished wood and leather details visible" },
  { slug: "jet-hero", name: "Главный jet кадр", camera: "лучший editorial-ракурс, объектив 70 мм", pose: "финальная premium travel поза в бизнес-джете", prompt: "signature private jet editorial travel pose, cabin luxury and aviation context clearly visible" },
];

const vipAirportPoseTemplates = [
  { slug: "lounge-chair", name: "В VIP lounge", camera: "объектив 70 мм, уровень глаз", pose: "сидит в lounge-кресле аэропорта, руки видны", prompt: "seated in VIP airport lounge chair, hands visible, runway windows behind" },
  { slug: "runway-window", name: "У окна на runway", camera: "объектив 85 мм, боковой свет", pose: "стоит у панорамного окна, взгляд на runway", prompt: "standing by panoramic airport window looking toward runway, refined travel outfit" },
  { slug: "terminal-walk", name: "Проход через терминал", camera: "репортажный объектив 50 мм", pose: "идёт через VIP terminal с ручной кладью", prompt: "walking through VIP terminal with discreet carry-on luggage, natural stride, premium travel mood" },
  { slug: "checkin-counter", name: "У VIP counter", camera: "объектив 70 мм, ракурс три четверти", pose: "стоит у стойки VIP terminal, естественный жест", prompt: "standing beside private check-in counter, natural hand gesture, no readable signs" },
  { slug: "sofa-waiting", name: "Ожидание рейса", camera: "объектив 85 мм, мягкий свет", pose: "сидит на sofa-зоне ожидания, спокойная поза", prompt: "seated on VIP lounge sofa waiting for flight, hands visible, elegant travel wardrobe" },
  { slug: "jet-bridge-view", name: "У выхода", camera: "широкий объектив 35 мм", pose: "стоит у выхода или glass corridor, видна архитектура", prompt: "standing near private terminal boarding corridor, glass architecture and runway depth visible" },
  { slug: "luggage-handle", name: "С чемоданом", camera: "объектив 70 мм, уровень глаз", pose: "держит ручку чемодана, расслабленная travel-поза", prompt: "holding suitcase handle naturally, refined airport styling, polished travel portrait" },
  { slug: "coffee-lounge", name: "Lounge coffee moment", camera: "объектив 50 мм, документальный стиль", pose: "сидит с чашкой кофе в lounge, руки видны", prompt: "seated with coffee cup in VIP lounge, hands visible, calm pre-flight lifestyle moment" },
  { slug: "terminal-wide", name: "Широкий VIP terminal", camera: "широкий объектив 35 мм", pose: "стоит далеко внутри терминала, локация доминирует", prompt: "wide VIP airport terminal shot, person smaller in frame, architecture and runway windows dominate" },
  { slug: "vip-airport-hero", name: "Главный airport кадр", camera: "лучший editorial-ракурс, объектив 70 мм", pose: "финальная travel-поза в VIP terminal", prompt: "signature VIP airport terminal editorial pose, premium travel atmosphere clear" },
];

const cityRooftopPoseTemplates = [
  { slug: "glass-rail", name: "У стеклянного борта", camera: "объектив 70 мм, вечерний свет", pose: "стоит у glass railing, город за спиной", prompt: "standing by rooftop glass railing with city skyline behind, elegant evening city outfit" },
  { slug: "lounge-sofa", name: "На rooftop sofa", camera: "объектив 85 мм, уровень глаз", pose: "сидит на rooftop lounge sofa, руки видны", prompt: "seated on rooftop lounge sofa, hands visible, skyline and terrace lights behind" },
  { slug: "terrace-walk", name: "Проход по террасе", camera: "репортажный объектив 50 мм", pose: "идёт по террасе rooftop, естественный шаг", prompt: "walking across rooftop terrace, natural movement, city lights and glass rails visible" },
  { slug: "skyline-profile", name: "Профиль на skyline", camera: "объектив 85 мм, боковой свет", pose: "профиль или полуоборот на фоне города", prompt: "side profile against skyline, evening light, confident calm expression" },
  { slug: "bar-table", name: "У rooftop bar", camera: "объектив 50 мм, ракурс три четверти", pose: "стоит у bar table, естественный жест рукой", prompt: "standing near rooftop bar table, one natural hand gesture, premium nightlife atmosphere" },
  { slug: "city-backlight", name: "Контровой city light", camera: "объектив 70 мм, контровой свет", pose: "стоит в мягком контровом свете города", prompt: "standing in soft backlight from city glow, elegant evening wardrobe, rooftop depth" },
  { slug: "corner-view", name: "В углу террасы", camera: "широкий объектив 35 мм", pose: "стоит в углу rooftop, виден масштаб площадки", prompt: "standing at rooftop terrace corner, wide skyline and furniture context visible" },
  { slug: "railing-lean", name: "Лёгкая опора", camera: "объектив 70 мм, уровень глаз", pose: "слегка опирается на перила, руки видны", prompt: "lightly leaning on glass railing, hands visible, relaxed confident rooftop posture" },
  { slug: "night-lounge", name: "В вечернем lounge", camera: "объектив 85 мм, тёплый свет", pose: "сидит расслабленно в lounge-зоне ночью", prompt: "relaxed seated portrait in rooftop lounge at night, warm terrace lights, city bokeh" },
  { slug: "rooftop-hero", name: "Главный rooftop кадр", camera: "лучший editorial-ракурс, объектив 70 мм", pose: "финальная поза на rooftop с видом на город", prompt: "signature city rooftop editorial pose, skyline and premium terrace atmosphere clearly visible" },
];

const fineDiningPoseTemplates = [
  { slug: "restaurant-table", name: "За столом fine dining", camera: "объектив 70 мм, мягкий вечерний свет", pose: "сидит за сервированным столом, руки видны", prompt: "seated at elegant fine dining table, hands visible, white tablecloth and refined setting, no readable menu" },
  { slug: "bar-counter", name: "У барной стойки", camera: "объектив 85 мм, тёплый свет", pose: "стоит или сидит у marble bar, спокойная вечерняя поза", prompt: "standing or seated at marble restaurant bar, elegant dinner outfit, warm pendant lights" },
  { slug: "host-stand", name: "У входа ресторана", camera: "объектив 70 мм, ракурс три четверти", pose: "стоит у entrance или host-зоны, собранный образ", prompt: "standing near fine dining restaurant entrance or host area, polished evening styling" },
  { slug: "table-gesture", name: "Естественный жест", camera: "объектив 50 мм, документальный стиль", pose: "сидит за столом и делает естественный жест рукой", prompt: "seated at table with natural hand gesture during conversation, elegant restaurant atmosphere" },
  { slug: "wine-wall", name: "У wine wall", camera: "объектив 85 мм, мягкая глубина", pose: "стоит у wine wall или декоративной стены, руки расслаблены", prompt: "standing near wine display wall or decorative restaurant wall, no labels readable, refined evening mood" },
  { slug: "banquette", name: "На banquette seating", camera: "объектив 70 мм, уровень глаз", pose: "сидит на banquette-диване, корпус и руки видны", prompt: "seated on restaurant banquette, hands visible, velvet seating and table settings nearby" },
  { slug: "dining-walk", name: "Проход между столами", camera: "репортажный объектив 50 мм", pose: "идёт между столами, естественный шаг", prompt: "walking between fine dining tables, natural movement, warm hospitality lighting" },
  { slug: "window-dinner", name: "У окна ресторана", camera: "объектив 85 мм, боковой свет", pose: "сидит или стоит у окна ресторана, вечерний профиль", prompt: "side profile near restaurant window, evening ambience, elegant dinner outfit" },
  { slug: "restaurant-wide", name: "Широкий ресторанный кадр", camera: "широкий объектив 35 мм", pose: "стоит внутри зала, видна архитектура ресторана", prompt: "wide shot inside fine dining room, person integrated into elegant tables and lighting" },
  { slug: "dining-hero", name: "Главный fine dining кадр", camera: "лучший editorial-ракурс, объектив 70 мм", pose: "финальная элегантная поза в ресторане", prompt: "signature fine dining editorial pose, refined evening restaurant atmosphere clear" },
];

const golfClubPoseTemplates = [
  { slug: "clubhouse-steps", name: "У clubhouse", camera: "объектив 70 мм, дневной свет", pose: "стоит у clubhouse, аккуратная спортивная осанка", prompt: "standing near premium golf clubhouse, refined country club outfit, green fairway behind" },
  { slug: "fairway-walk", name: "Прогулка по fairway", camera: "репортажный объектив 50 мм", pose: "идёт по fairway, естественный шаг", prompt: "walking across golf fairway, natural movement, elegant golf lifestyle wardrobe" },
  { slug: "golf-cart", name: "У golf cart", camera: "объектив 70 мм, ракурс три четверти", pose: "стоит или сидит рядом с golf cart, руки видны", prompt: "standing or seated beside golf cart, hands visible, country club atmosphere" },
  { slug: "club-hold", name: "С клюшкой", camera: "объектив 85 мм, мягкая глубина", pose: "держит клюшку спокойно, без активного замаха", prompt: "holding golf club calmly, no swing action, polished sport luxury portrait" },
  { slug: "green-edge", name: "У green", camera: "широкий объектив 35 мм", pose: "стоит у green, поле и landscape видны", prompt: "standing near putting green, trimmed grass and landscape visible, refined golf setting" },
  { slug: "terrace-seated", name: "На террасе клуба", camera: "объектив 70 мм, уровень глаз", pose: "сидит на террасе clubhouse, руки видны", prompt: "seated on clubhouse terrace, hands visible, fairway view, relaxed country club lifestyle" },
  { slug: "tree-line", name: "У линии деревьев", camera: "объектив 85 мм, боковой свет", pose: "полуоборот на фоне деревьев и поля", prompt: "half-turn portrait by tree line and fairway, soft daylight, elegant golf outfit" },
  { slug: "bunker-edge", name: "У bunker edge", camera: "объектив 70 мм, ракурс три четверти", pose: "стоит рядом с песчаным bunker, аккуратно и спокойно", prompt: "standing near sand bunker edge, clean composed posture, golf landscape context" },
  { slug: "wide-course", name: "Широкий кадр поля", camera: "широкий объектив 35 мм", pose: "стоит далеко на поле, локация доминирует", prompt: "wide golf course environmental shot, person smaller in frame, fairway and clubhouse scale visible" },
  { slug: "golf-hero", name: "Главный golf кадр", camera: "лучший editorial-ракурс, объектив 70 мм", pose: "финальная sport luxury поза в гольф-клубе", prompt: "signature premium golf club editorial pose, stylish sport luxury atmosphere" },
];

const italianVillaPoseTemplates = [
  { slug: "stone-arch", name: "У каменной арки", camera: "объектив 70 мм, мягкий свет", pose: "стоит у каменной арки виллы, спокойная осанка", prompt: "standing under Italian villa stone arch, Mediterranean light, elegant vacation wardrobe" },
  { slug: "garden-walk", name: "Прогулка по саду", camera: "репортажный объектив 50 мм", pose: "идёт по садовой дорожке, естественный шаг", prompt: "walking through villa garden path, cypress trees and terrace visible, natural movement" },
  { slug: "terrace-seated", name: "На террасе виллы", camera: "объектив 85 мм, уровень глаз", pose: "сидит на terrace seating, руки видны", prompt: "seated on Italian villa terrace seating, hands visible, refined Mediterranean styling" },
  { slug: "fountain-side", name: "У фонтана", camera: "объектив 70 мм, ракурс три четверти", pose: "стоит у фонтана или stone basin, расслабленно", prompt: "standing near stone fountain or basin, relaxed elegant posture, villa garden atmosphere" },
  { slug: "cypress-profile", name: "Профиль у кипарисов", camera: "объектив 85 мм, боковой свет", pose: "профиль или полуоборот на фоне кипарисов", prompt: "side profile with cypress trees and terracotta walls, warm Mediterranean light" },
  { slug: "staircase", name: "На лестнице виллы", camera: "объектив 70 мм, уровень глаз", pose: "стоит или сидит на каменных ступенях, руки видны", prompt: "standing or seated on villa stone staircase, hands visible, elegant vacation editorial" },
  { slug: "olive-grove", name: "У olive trees", camera: "широкий объектив 35 мм", pose: "стоит среди зелени сада, видна локация", prompt: "standing among olive trees and sculptural garden greenery, villa context visible" },
  { slug: "doorway", name: "В doorway виллы", camera: "объектив 85 мм, мягкая глубина", pose: "стоит в doorway или у wooden door, спокойный взгляд", prompt: "standing in villa doorway near wooden door, refined Mediterranean fashion styling" },
  { slug: "garden-wide", name: "Широкий садовый кадр", camera: "широкий объектив 35 мм", pose: "стоит далеко в саду виллы, архитектура и сад доминируют", prompt: "wide villa garden shot, person smaller in frame, stone arches and cypress trees dominate" },
  { slug: "villa-hero", name: "Главный villa кадр", camera: "лучший editorial-ракурс, объектив 70 мм", pose: "финальная элегантная поза в саду итальянской виллы", prompt: "signature Italian villa garden editorial pose, elegant Mediterranean atmosphere" },
];

const parisStreetPoseTemplates = [
  { slug: "cafe-table", name: "У столика кафе", camera: "объектив 70 мм, дневной свет", pose: "сидит у маленького столика кафе, руки видны", prompt: "seated at small Parisian cafe table, hands visible, elegant European street atmosphere" },
  { slug: "cobblestone-walk", name: "По брусчатке", camera: "репортажный объектив 50 мм", pose: "идёт по европейской улице, естественный шаг", prompt: "walking on cobblestone European street, natural movement, chic city outfit" },
  { slug: "building-corner", name: "У фасада", camera: "объектив 85 мм, мягкая глубина", pose: "стоит у каменного фасада или витрины", prompt: "standing by Parisian stone facade or boutique window, refined effortless styling" },
  { slug: "balcony-street", name: "Под балконами", camera: "широкий объектив 35 мм", pose: "стоит на улице под wrought iron balconies", prompt: "standing beneath wrought iron balconies, European street architecture visible" },
  { slug: "newspaper-moment", name: "Кафейный момент", camera: "объектив 50 мм, документальный стиль", pose: "сидит у кафе с чашкой или журналом, естественно", prompt: "seated at cafe with coffee cup or magazine, natural editorial moment, no readable text" },
  { slug: "crosswalk-paris", name: "Переход улицы", camera: "репортажный объектив 50 мм", pose: "переходит улицу, движение пальто или шарфа", prompt: "crossing Parisian street, coat or scarf movement, chic European editorial" },
  { slug: "archway", name: "В арке квартала", camera: "объектив 70 мм, ракурс три четверти", pose: "стоит в небольшой арке или passage, спокойная поза", prompt: "standing in European passage archway, elegant half-turn, stone details visible" },
  { slug: "street-lamp", name: "У фонаря", camera: "объектив 85 мм, боковой свет", pose: "полуоборот у street lamp, мягкий свет", prompt: "half-turn near classic street lamp, soft Parisian light, refined city portrait" },
  { slug: "avenue-wide", name: "Широкий квартал", camera: "широкий объектив 35 мм", pose: "стоит в перспективе европейского квартала", prompt: "wide European quarter street perspective, person integrated into cafe and stone facade environment" },
  { slug: "paris-hero", name: "Главный Paris кадр", camera: "лучший editorial-ракурс, объектив 70 мм", pose: "финальная chic-поза на парижской улице", prompt: "signature Paris street editorial pose, chic effortless European style" },
];

const tokyoNeonPoseTemplates = [
  { slug: "neon-crosswalk", name: "На неоновом переходе", camera: "репортажный объектив 50 мм", pose: "идёт по мокрому переходу, отражения вокруг", prompt: "walking across wet neon crosswalk, colorful reflections, Tokyo night street fashion" },
  { slug: "alley-light", name: "В неоновой alley", camera: "объектив 70 мм, цветной свет", pose: "стоит в узкой alley, свет витрин вокруг", prompt: "standing in compact neon-lit alley, colorful signs without readable text, stylish night outfit" },
  { slug: "vending-wall", name: "У light wall", camera: "объектив 85 мм, мягкая глубина", pose: "стоит у светящейся стены или витрины, спокойный взгляд", prompt: "standing near glowing vending or shop light wall, no readable text, cinematic colored lighting" },
  { slug: "umbrella-night", name: "С зонтом ночью", camera: "объектив 70 мм, боковой свет", pose: "держит зонт в дождливой ночной улице", prompt: "holding umbrella on rainy neon street, wet pavement reflections, elegant street-fashion pose" },
  { slug: "station-exit", name: "У выхода станции", camera: "широкий объектив 35 мм", pose: "стоит у station exit, городская глубина видна", prompt: "standing near Tokyo station exit, neon urban depth, clean no-readable-sign environment" },
  { slug: "railing-lean", name: "У городских перил", camera: "объектив 70 мм, уровень глаз", pose: "слегка опирается на городские перила, руки видны", prompt: "lightly leaning on urban railing, hands visible, neon bokeh behind" },
  { slug: "night-phone", name: "Ночной street moment", camera: "объектив 50 мм, документальный стиль", pose: "идёт с телефоном в руке, естественно", prompt: "walking with phone in hand at night, natural city moment, neon reflections" },
  { slug: "shopfront-profile", name: "Профиль у витрины", camera: "объектив 85 мм, боковой цветной свет", pose: "профиль или полуоборот у яркой витрины", prompt: "side profile near bright shopfront, colored light on face, no readable text" },
  { slug: "neon-wide", name: "Широкий Tokyo кадр", camera: "широкий объектив 35 мм", pose: "стоит среди неоновой улицы, локация доминирует", prompt: "wide Tokyo neon street shot, person smaller in frame, wet pavement and lights dominate" },
  { slug: "tokyo-hero", name: "Главный neon кадр", camera: "лучший cinematic-ракурс, объектив 70 мм", pose: "финальная уверенная поза на неоновой улице", prompt: "signature Tokyo neon night editorial pose, cinematic street fashion atmosphere" },
];

const newYorkStreetPoseTemplates = [
  { slug: "fire-escape", name: "У fire escape", camera: "объектив 70 мм, городской свет", pose: "стоит у кирпичного фасада с fire escape", prompt: "standing by brick building with fire escape, New York editorial street style" },
  { slug: "crosswalk-ny", name: "На crosswalk", camera: "репортажный объектив 50 мм", pose: "идёт по улице Нью-Йорка, естественный шаг", prompt: "walking across New York crosswalk, strong city perspective, fashion editorial movement" },
  { slug: "stoop-seated", name: "На stoop", camera: "объектив 85 мм, уровень глаз", pose: "сидит на городских ступенях stoop, руки видны", prompt: "seated on New York stoop steps, hands visible, bold street fashion outfit" },
  { slug: "yellow-accent", name: "С taxi-акцентом", camera: "объектив 70 мм, боковой ракурс", pose: "полуоборот на фоне городского yellow-акцента", prompt: "half-turn portrait with muted yellow taxi-like color accent blurred behind, no logos" },
  { slug: "sidewalk-cafe", name: "У sidewalk cafe", camera: "объектив 50 мм, документальный стиль", pose: "стоит или сидит у sidewalk cafe, естественно", prompt: "standing or seated near sidewalk cafe, natural editorial city moment, no readable text" },
  { slug: "subway-stairs", name: "У subway stairs", camera: "широкий объектив 35 мм", pose: "стоит у subway stairs или railing, городской контекст", prompt: "standing near subway stairs or railing, New York street architecture visible, no readable signs" },
  { slug: "brick-wall", name: "У кирпичной стены", camera: "объектив 85 мм, мягкая глубина", pose: "опирается плечом на brick wall, спокойный взгляд", prompt: "lightly leaning shoulder against brick wall, confident editorial street portrait" },
  { slug: "avenue-walk", name: "По avenue", camera: "репортажный объектив 50 мм", pose: "идёт по avenue, одежда в движении", prompt: "walking down city avenue, coat movement, strong editorial street fashion" },
  { slug: "ny-wide", name: "Широкий NY кадр", camera: "широкий объектив 35 мм", pose: "стоит в плотной городской перспективе", prompt: "wide New York street environmental shot, person integrated into brick, crosswalk and city depth" },
  { slug: "ny-hero", name: "Главный NY editorial кадр", camera: "лучший editorial-ракурс, объектив 70 мм", pose: "финальная fashion-поза на улице Нью-Йорка", prompt: "signature New York editorial street pose, bold city fashion and urban rhythm" },
];

const modernEditorialStudioPoseTemplates = [
  { slug: "seamless-chair", name: "У дизайнерского стула", camera: "объектив 85 мм, мягкий студийный свет", pose: "сидит или стоит рядом с дизайнерским стулом, руки расслаблены", prompt: "near sculptural designer chair on seamless cyclorama, clean studio composition, relaxed confident editorial pose" },
  { slug: "fabric-backdrop", name: "У тканевого фона", camera: "объектив 70 мм, ракурс три четверти", pose: "полуоборот у мягкого тканевого backdrop, плечи расслаблены", prompt: "half-turn near neutral fabric backdrop, soft folds visible, minimalist premium fashion portrait" },
  { slug: "softbox-edge", name: "У softbox-света", camera: "объектив 50 мм, уровень глаз", pose: "стоит у края большого softbox, красивый боковой свет", prompt: "standing near large softbox edge, clean side light on face, professional studio set visible" },
  { slug: "floor-seated", name: "Расслабленная посадка", camera: "объектив 70 мм, низкий спокойный ракурс", pose: "сидит на полу или низком кубе, естественная fashion-поза", prompt: "relaxed seated pose on low cube or studio floor, elegant hands, premium editorial body language" },
  { slug: "cyclorama-walk", name: "Движение по циклораме", camera: "репортажный объектив 50 мм", pose: "идёт по циклораме, лёгкое движение одежды", prompt: "walking across seamless cyclorama, subtle outfit movement, clean editorial studio motion shot" },
  { slug: "standing-minimal", name: "Минималистичный портрет", camera: "объектив 85 мм, мягкая глубина", pose: "стоит спокойно, руки видны, лёгкий поворот корпуса", prompt: "minimal standing studio portrait, hands visible, slight torso turn, clean premium neutral background" },
  { slug: "mirrorless-set", name: "У съёмочного сета", camera: "объектив 50 мм, backstage editorial", pose: "стоит рядом со студийным оборудованием без логотипов", prompt: "near studio equipment without logos, backstage editorial mood, softbox stands blurred in background" },
  { slug: "profile-studio", name: "Профиль в студии", camera: "объектив 85 мм, боковой свет", pose: "профиль или полуоборот, мягкая линия лица", prompt: "side profile studio portrait, soft side light, clean modern set, elegant facial contour" },
  { slug: "wide-studio-set", name: "Широкий студийный кадр", camera: "широкий объектив 35 мм", pose: "стоит внутри всей студийной постановки, интерьер доминирует", prompt: "wide full studio set shot, person smaller in frame, cyclorama, chair, fabric backdrop and lights visible" },
  { slug: "studio-hero", name: "Главный studio кадр", camera: "лучший editorial-ракурс, объектив 70 мм", pose: "финальная fashion-поза в современной студии", prompt: "signature modern editorial studio portrait, refined fashion styling, high-end magazine photoshoot atmosphere" },
];

const musicRecordingStudioPoseTemplates = [
  { slug: "mixing-console", name: "У микшерного пульта", camera: "объектив 70 мм, тёплый студийный свет", pose: "сидит или стоит у микшерного пульта, руки естественно видны", prompt: "near large mixing console, hands visible, warm recording studio lights, creative producer portrait" },
  { slug: "studio-mic", name: "У студийного микрофона", camera: "объектив 85 мм, мягкая глубина", pose: "стоит у микрофона, не поёт, спокойный уверенный взгляд", prompt: "standing by studio microphone, not singing, calm confident expression, acoustic panels behind" },
  { slug: "vocal-booth", name: "В vocal booth", camera: "объектив 70 мм, стекло и отражения", pose: "полуоборот в вокальной кабине, руки расслаблены", prompt: "inside glass vocal booth, subtle reflections, relaxed half-turn, premium music studio atmosphere" },
  { slug: "sofa-listening", name: "Прослушивание на диване", camera: "объектив 50 мм, lifestyle-ракурс", pose: "сидит на диване студии, слушает трек, расслабленная посадка", prompt: "seated on recording studio sofa, listening moment, relaxed hands, warm lamps and acoustic walls visible" },
  { slug: "headphones-moment", name: "С наушниками", camera: "объектив 85 мм, крупный editorial", pose: "держит студийные наушники в руке или на шее", prompt: "holding studio headphones in hand or around neck, stylish creative editorial portrait, no logos" },
  { slug: "producer-standing", name: "Producer portrait", camera: "объектив 50 мм, уровень глаз", pose: "стоит у оборудования, корпус чуть повернут", prompt: "standing near studio racks and console, slight torso turn, confident artist-producer portrait" },
  { slug: "piano-corner", name: "У музыкального угла", camera: "объектив 70 мм, мягкий боковой свет", pose: "стоит у клавиш или музыкального угла, без игры", prompt: "near keyboard or musical corner, not playing, warm creative room light, elegant pose" },
  { slug: "control-room", name: "В control room", camera: "широкий объектив 35 мм", pose: "стоит в control room, пространство студии хорошо видно", prompt: "in recording studio control room, wide view of console, panels, lights, person integrated into space" },
  { slug: "doorway-studio", name: "В проходе студии", camera: "объектив 50 мм, документальный стиль", pose: "идёт между комнатами студии, естественный шаг", prompt: "walking between recording studio rooms, natural step, glass doors and warm acoustic panels visible" },
  { slug: "music-hero", name: "Главный music кадр", camera: "лучший creative editorial-ракурс, объектив 70 мм", pose: "финальная уверенная поза в студии звукозаписи", prompt: "signature music recording studio editorial portrait, stylish creative outfit, cinematic warm atmosphere" },
];

const privateCinemaPoseTemplates = [
  { slug: "cinema-seat", name: "В lounge-кресле", camera: "объектив 85 мм, тёплый экранный свет", pose: "сидит в мягком кресле кинозала, руки расслаблены", prompt: "seated in luxury private cinema lounge chair, hands relaxed, subtle projection glow, premium screening room mood" },
  { slug: "aisle-light", name: "У подсветки прохода", camera: "объектив 70 мм, ракурс три четверти", pose: "стоит у подсвеченного прохода, корпус слегка повернут", prompt: "standing near illuminated cinema aisle steps, dark acoustic panels around, elegant cinematic portrait" },
  { slug: "screen-glow", name: "На фоне экрана", camera: "объектив 50 мм, мягкий контровой свет", pose: "стоит или сидит на фоне большого экрана", prompt: "portrait with large private cinema screen glow in background, no readable text, refined evening styling" },
  { slug: "side-sofa", name: "Боковой lounge-кадр", camera: "объектив 70 мм, боковой ракурс", pose: "сидит в полуобороте, кресла и интерьер видны", prompt: "side-angle seated lounge portrait inside private cinema, plush seating and warm aisle lights visible" },
  { slug: "back-row", name: "В верхнем ряду", camera: "объектив 70 мм, уровень глаз", pose: "стоит у верхнего ряда кресел, руки расслаблены", prompt: "standing by back row of private cinema seats, warm aisle lights, dark acoustic wall panels visible" },
  { slug: "low-table", name: "У lounge-столика", camera: "объектив 50 мм, lifestyle-ракурс", pose: "сидит рядом с низким столиком, руки естественно видны", prompt: "seated near low lounge table in private cinema, hands visible, refined relaxed evening mood" },
  { slug: "curtain-edge", name: "У тёмной шторы", camera: "объектив 85 мм, боковой свет", pose: "полуоборот у тёмной шторы или панели", prompt: "half-turn near dark curtain or acoustic panel, soft screen glow, elegant cinematic portrait" },
  { slug: "wide-theater", name: "Широкий кадр кинозала", camera: "широкий объектив 35 мм", pose: "стоит внутри кинозала, пространство доминирует", prompt: "wide environmental private cinema shot, person smaller in frame, screen, seats and aisle lights dominate" },
  { slug: "cinema-arrival", name: "Вход в кинозал", camera: "репортажный объектив 50 мм", pose: "идёт в зал, естественный шаг", prompt: "walking into luxury private cinema room, natural motion, warm premium theater lights" },
  { slug: "cinema-hero", name: "Главный cinema кадр", camera: "лучший cinematic-ракурс, объектив 70 мм", pose: "финальная уверенная поза в приватном кинозале", prompt: "signature private cinema editorial portrait, premium dark lounge atmosphere, polished final image" },
];

const blackPhotoStudioPoseTemplates = [
  { slug: "seamless-cyclorama", name: "На чёрной циклораме", camera: "объектив 85 мм, направленный студийный свет", pose: "стоит на чёрной циклораме, корпус слегка повернут, руки видны", prompt: "standing on black seamless cyclorama, slight torso turn, hands visible, dramatic clean fashion light" },
  { slug: "softbox-edge", name: "У большого softbox", camera: "объектив 70 мм, боковой softbox-свет", pose: "стоит рядом с большим softbox, лицо в мягком боковом свете", prompt: "near large softbox edge, clean side light on face, black studio equipment visible" },
  { slug: "posing-cube", name: "С posing cube", camera: "объектив 50 мм, низкий editorial-ракурс", pose: "сидит или опирается на чёрный куб, руки естественно расположены", prompt: "seated or leaning on black posing cube, elegant hands, minimal fashion editorial set" },
  { slug: "spotlight-center", name: "В пятне света", camera: "объектив 85 мм, контрастный spotlight", pose: "стоит в центре пятна света, уверенная спокойная поза", prompt: "standing in centered spotlight on dark cyclorama, strong controlled shadows, high-fashion mood" },
  { slug: "floor-reflection", name: "У отражающего пола", camera: "объектив 70 мм, низкий ракурс", pose: "стоит или сидит низко, видны отражения на тёмном полу", prompt: "near subtle glossy dark floor reflection, full styling visible, minimal black studio portrait" },
  { slug: "light-stand", name: "Backstage fashion", camera: "объектив 50 мм, backstage editorial", pose: "стоит рядом со стойками света, не перекрывая лицо", prompt: "standing near light stands and studio cart, backstage fashion editorial mood, no logos" },
  { slug: "profile-shadow", name: "Профиль и тень", camera: "объектив 85 мм, резкий боковой свет", pose: "профиль или полуоборот, выразительная тень на фоне", prompt: "side profile or half-turn with sharp shadow on black cyclorama, sculpted facial contour" },
  { slug: "wide-studio", name: "Широкий кадр студии", camera: "широкий объектив 35 мм", pose: "стоит внутри всей чёрной студии, оборудование и фон видны", prompt: "wide environmental black photo studio shot, person smaller in frame, cyclorama and lights dominate" },
  { slug: "equipment-detail", name: "Через студийные детали", camera: "объектив 85 мм, размытый передний план", pose: "портрет через размытые стойки или световое оборудование", prompt: "portrait framed through blurred studio equipment, black cyclorama, premium fashion lighting depth" },
  { slug: "black-studio-hero", name: "Главный black studio кадр", camera: "лучший fashion-ракурс, объектив 70 мм", pose: "финальная сильная fashion-поза в чёрной студии", prompt: "signature black minimal photo studio fashion portrait, strong light, clean uncluttered final image" },
];

const fashionBoutiquePoseTemplates = [
  { slug: "clothing-rail", name: "У fashion-рейла", camera: "объектив 70 мм, витринный свет", pose: "стоит у рейла с одеждой, рука естественно рядом", prompt: "standing by sculptural clothing rail, garments without logos, polished boutique editorial styling" },
  { slug: "mirror-boutique", name: "У зеркала", camera: "объектив 85 мм, мягкая глубина", pose: "полуоборот у большого зеркала, уверенный спокойный взгляд", prompt: "half-turn portrait near large boutique mirror, warm display lighting, premium retail architecture" },
  { slug: "display-table", name: "У display-стола", camera: "объектив 50 мм, ракурс три четверти", pose: "стоит или сидит у display-стола, руки видны", prompt: "near luxury display table with accessories without logos, hands visible, refined fashion retail scene" },
  { slug: "boutique-walk", name: "Проход по concept store", camera: "репортажный объектив 50 мм", pose: "идёт между рейлами, одежда в лёгком движении", prompt: "walking through concept store between rails, natural motion, elegant fashion editorial outfit" },
  { slug: "shelf-accessories", name: "У полки аксессуаров", camera: "объектив 85 мм, мягкая глубина", pose: "стоит рядом с полкой аксессуаров, руки расслаблены", prompt: "standing beside curated accessory shelf, no logos, warm boutique display lighting, refined pose" },
  { slug: "curved-wall", name: "У изогнутой стены", camera: "объектив 70 мм, архитектурный свет", pose: "полуоборот у изогнутой retail-стены", prompt: "half-turn near curved boutique wall, sculptural rails, polished architectural retail composition" },
  { slug: "fitting-lounge", name: "В fitting lounge", camera: "объектив 50 мм, lifestyle-ракурс", pose: "сидит в зоне примерочной или lounge, руки видны", prompt: "seated in boutique fitting lounge, hands visible, mirrors and soft garments around, quiet luxury mood" },
  { slug: "front-display", name: "У центральной витрины", camera: "объектив 70 мм, витринный свет", pose: "стоит у центральной display-зоны", prompt: "standing near central boutique display, warm gallery-like light, elegant fashion editorial styling" },
  { slug: "wide-boutique", name: "Широкий boutique кадр", camera: "широкий объектив 35 мм", pose: "стоит внутри всего пространства бутика", prompt: "wide environmental concept store shot, person smaller in frame, rails, mirrors and display architecture dominate" },
  { slug: "boutique-hero", name: "Главный boutique кадр", camera: "лучший editorial-ракурс, объектив 70 мм", pose: "финальная fashion-поза в премиальном бутике", prompt: "signature fashion boutique editorial portrait, quiet luxury retail interior, polished final image" },
];

const moroccanRiadPoseTemplates = [
  { slug: "courtyard-arch", name: "У арки riad", camera: "объектив 70 мм, тёплый боковой свет", pose: "стоит у резной арки, корпус слегка повернут", prompt: "standing near ornate Moroccan riad arch, carved plaster, warm golden side light, luxury travel portrait" },
  { slug: "fountain-lounge", name: "У фонтана", camera: "объектив 50 мм, courtyard-ракурс", pose: "сидит или стоит у фонтана, руки видны", prompt: "near riad courtyard fountain, zellige tile and lounge cushions visible, relaxed resort editorial pose" },
  { slug: "tile-corner", name: "У плитки zellige", camera: "объектив 85 мм, мягкая глубина", pose: "полуоборот у стены с плиткой, спокойный взгляд", prompt: "half-turn portrait by Moroccan zellige tile wall, ornate texture, warm lantern highlights" },
  { slug: "lantern-corridor", name: "В коридоре с фонарями", camera: "объектив 70 мм, перспективный ракурс", pose: "идёт по арочному коридору, естественный шаг", prompt: "walking through arched riad corridor with lanterns, natural motion, warm luxury travel atmosphere" },
  { slug: "palm-courtyard", name: "В тени пальм", camera: "объектив 85 мм, пятнистый солнечный свет", pose: "стоит в мягкой тени пальм во внутреннем дворике", prompt: "portrait in palm shadows inside riad courtyard, carved arches and plants around, warm sun patches" },
  { slug: "carved-doorway", name: "У резной двери", camera: "объектив 70 мм, архитектурный свет", pose: "стоит у деревянной резной двери, руки расслаблены", prompt: "standing by carved Moroccan wooden doorway, ornate arch, refined resort styling, hands visible" },
  { slug: "low-table", name: "У низкого lounge-стола", camera: "объектив 50 мм, lifestyle-ракурс", pose: "сидит или стоит у низкого стола с фонарями", prompt: "near low riad lounge table with lanterns and cushions, relaxed luxury travel editorial moment" },
  { slug: "rooftop-terrace", name: "На террасе riad", camera: "объектив 70 мм, закатный свет", pose: "стоит на террасе с арками или городским фоном", prompt: "on Moroccan riad rooftop terrace at golden hour, arches and desert-resort atmosphere, elegant stance" },
  { slug: "wide-riad", name: "Широкий кадр riad", camera: "широкий объектив 35 мм", pose: "стоит в центре двора, архитектура доминирует", prompt: "wide environmental Moroccan riad courtyard shot, person smaller in frame, fountain, arches, tile and palms dominate" },
  { slug: "riad-hero", name: "Главный riad кадр", camera: "лучший travel editorial-ракурс, объектив 70 мм", pose: "финальная уверенная поза в тёплом riad-интерьере", prompt: "signature Moroccan riad luxury travel editorial portrait, warm golden light, polished final resort image" },
];

const whiteCycloramaStudioPoseTemplates = [
  { slug: "white-cyclorama", name: "У белой циклорамы", camera: "объектив 70 мм, мягкий high-key свет", pose: "стоит на белой циклораме, корпус слегка повернут, руки видны", prompt: "standing on seamless white cyclorama, slight torso turn, hands visible, clean high-key fashion studio portrait" },
  { slug: "softbox-edge", name: "У softbox-света", camera: "объектив 85 мм, мягкий боковой свет", pose: "стоит рядом с большим softbox, лицо в мягком боковом свете", prompt: "near large softbox edge, soft side light on face, white studio equipment visible, minimal premium set" },
  { slug: "ivory-cubes", name: "У светлых кубов", camera: "объектив 50 мм, ракурс три четверти", pose: "сидит или стоит у светлых posing cubes, руки естественно расположены", prompt: "seated or standing near ivory posing cubes, elegant hands, clean white fashion studio composition" },
  { slug: "minimal-standing", name: "Минималистичный портрет", camera: "объектив 85 мм, уровень глаз", pose: "стоит спокойно, руки видны, чистый фон доминирует", prompt: "minimal standing high-key studio portrait, hands visible, clean white negative space dominates" },
  { slug: "cyclorama-walk", name: "Движение по циклораме", camera: "репортажный объектив 50 мм", pose: "идёт по белой циклораме, лёгкое движение одежды", prompt: "walking across seamless white cyclorama, subtle outfit movement, clean editorial studio motion" },
  { slug: "floor-seated", name: "Низкая посадка", camera: "объектив 70 мм, низкий спокойный ракурс", pose: "сидит на полу или низком кубе, поза естественная и аккуратная", prompt: "relaxed seated pose on white floor or low cube, elegant hands, premium high-key editorial body language" },
  { slug: "reflector-light", name: "У отражателя", camera: "объектив 70 мм, мягкий beauty-свет", pose: "стоит у отражателя или световой стойки, лицо открыто", prompt: "standing near reflector and light stand, open face, bright clean beauty lighting, white studio setting" },
  { slug: "profile-white", name: "Профиль на белом", camera: "объектив 85 мм, боковой свет", pose: "профиль или полуоборот, выразительный силуэт на белом фоне", prompt: "side profile or half-turn against white cyclorama, sculpted soft shadow, refined high-key fashion portrait" },
  { slug: "wide-white-studio", name: "Широкий кадр студии", camera: "широкий объектив 35 мм", pose: "стоит внутри всей белой студии, оборудование и фон видны", prompt: "wide environmental white photo studio shot, person smaller in frame, cyclorama, softboxes and posing cubes dominate" },
  { slug: "white-studio-hero", name: "Главный white studio кадр", camera: "лучший editorial-ракурс, объектив 70 мм", pose: "финальная чистая fashion-поза в белой студии", prompt: "signature white high-key photo studio fashion portrait, clean light, uncluttered polished final image" },
];

const pinkPastelStudioPoseTemplates = [
  { slug: "pink-cyclorama", name: "У розовой циклорамы", camera: "объектив 70 мм, мягкий beauty-свет", pose: "стоит на blush-циклораме, спокойный поворот корпуса", prompt: "standing on blush pink seamless cyclorama, soft beauty lighting, refined pastel fashion portrait" },
  { slug: "sheer-curtains", name: "У мягких штор", camera: "объектив 85 мм, рассеянный оконный свет", pose: "полуоборот у прозрачных штор, руки расслаблены", prompt: "half-turn near sheer pink curtains, diffused window light, delicate beauty editorial mood" },
  { slug: "pink-cubes", name: "У розовых кубов", camera: "объектив 50 мм, ракурс три четверти", pose: "сидит или стоит у розовых posing cubes, руки видны", prompt: "seated or standing near pink posing cubes, hands visible, polished pastel studio styling" },
  { slug: "beauty-close", name: "Beauty-портрет", camera: "объектив 85 мм, мягкая глубина", pose: "стоит близко к камере, лицо открыто, плечи расслаблены", prompt: "soft beauty portrait on pastel pink studio background, relaxed shoulders, clean face light" },
  { slug: "pink-walk", name: "Движение по студии", camera: "репортажный объектив 50 мм", pose: "идёт по розовой студии, лёгкое движение ткани", prompt: "walking across pastel pink studio set, subtle fabric movement, soft editorial fashion moment" },
  { slug: "floor-pose", name: "Низкая fashion-поза", camera: "объектив 70 мм, низкий fashion-ракурс", pose: "сидит на полу или кубе, поза мягкая и элегантная", prompt: "relaxed seated pose on pink floor or cube, elegant hands, tasteful beauty editorial body language" },
  { slug: "softbox-pink", name: "У softbox в розовом сете", camera: "объектив 70 мм, боковой свет", pose: "стоит рядом со студийным светом, лицо не перекрыто", prompt: "near large softbox in pastel pink studio, clean side light on face, professional beauty set visible" },
  { slug: "profile-pink", name: "Профиль в пастели", camera: "объектив 85 мм, мягкий боковой свет", pose: "профиль или полуоборот на розовом фоне", prompt: "side profile or half-turn against blush pink cyclorama, delicate shadow, elegant pastel fashion portrait" },
  { slug: "wide-pink-studio", name: "Широкий pink studio кадр", camera: "широкий объектив 35 мм", pose: "стоит внутри всей розовой студии, шторы и кубы видны", prompt: "wide environmental pastel pink studio shot, person smaller in frame, curtains, softboxes and posing cubes dominate" },
  { slug: "pink-studio-hero", name: "Главный pink studio кадр", camera: "лучший beauty-ракурс, объектив 70 мм", pose: "финальная нежная fashion-поза в розовой студии", prompt: "signature pastel pink beauty studio editorial portrait, soft polished final fashion image" },
];

const powderBlueStudioPoseTemplates = [
  { slug: "blue-cyclorama", name: "У голубой циклорамы", camera: "объектив 70 мм, прохладный мягкий свет", pose: "стоит на светло-голубой циклораме, руки видны", prompt: "standing on pale powder blue seamless cyclorama, hands visible, airy clean editorial studio portrait" },
  { slug: "blue-softbox", name: "У холодного softbox-света", camera: "объектив 85 мм, мягкий боковой свет", pose: "стоит рядом с softbox, лицо в прохладном мягком свете", prompt: "near large softbox edge, cool soft side light on face, powder blue studio equipment visible" },
  { slug: "blue-cubes", name: "У голубых кубов", camera: "объектив 50 мм, ракурс три четверти", pose: "сидит или стоит у голубых и белых posing cubes", prompt: "seated or standing near pale blue and white posing cubes, elegant hands, clean airy studio styling" },
  { slug: "clean-standing", name: "Воздушный портрет", camera: "объектив 85 мм, уровень глаз", pose: "стоит спокойно, лёгкий поворот корпуса, много чистого фона", prompt: "minimal airy standing portrait, slight torso turn, powder blue negative space, polished clean fashion look" },
  { slug: "blue-walk", name: "Движение по голубой студии", camera: "репортажный объектив 50 мм", pose: "идёт по студии, естественный шаг и лёгкое движение одежды", prompt: "walking across powder blue cyclorama, natural step, subtle outfit movement, cool clean editorial mood" },
  { slug: "low-blue-pose", name: "Низкий ракурс", camera: "объектив 70 мм, низкий спокойный ракурс", pose: "сидит на полу или низком кубе, руки элегантно видны", prompt: "relaxed seated pose on pale blue floor or low cube, elegant hands, refined cool studio body language" },
  { slug: "reflector-blue", name: "У отражателя", camera: "объектив 70 мм, soft daylight", pose: "стоит у отражателя, лицо открыто, плечи расслаблены", prompt: "standing near reflector in powder blue studio, open face, cool soft daylight, relaxed shoulders" },
  { slug: "profile-blue", name: "Профиль в голубом", camera: "объектив 85 мм, боковой свет", pose: "профиль или полуоборот на голубом фоне", prompt: "side profile or half-turn against powder blue cyclorama, gentle cool shadow, clean editorial portrait" },
  { slug: "wide-blue-studio", name: "Широкий blue studio кадр", camera: "широкий объектив 35 мм", pose: "стоит внутри всей голубой студии, свет и кубы видны", prompt: "wide environmental powder blue photo studio shot, person smaller in frame, cyclorama, softboxes and cubes dominate" },
  { slug: "blue-studio-hero", name: "Главный blue studio кадр", camera: "лучший clean editorial-ракурс, объектив 70 мм", pose: "финальная воздушная fashion-поза в голубой студии", prompt: "signature powder blue clean studio editorial portrait, airy cool light, polished final image" },
];

const wineCellarPoseTemplates = [
  { slug: "tasting-table", name: "За tasting table", camera: "объектив 70 мм, тёплый подвесной свет", pose: "сидит или стоит у дегустационного стола, руки видны", prompt: "near wooden wine tasting table, hands visible, amber pendant lights, refined private club atmosphere" },
  { slug: "wine-racks", name: "У винных стеллажей", camera: "объектив 85 мм, мягкая глубина", pose: "стоит у стеллажей, корпус слегка повернут", prompt: "standing by wooden wine racks, labels not readable, stone arches, elegant cellar portrait" },
  { slug: "stone-arch", name: "У каменной арки", camera: "объектив 50 мм, архитектурный ракурс", pose: "стоит в каменной арке, интерьер хорошо виден", prompt: "standing under stone arch in wine cellar, warm private club light, full architectural context" },
  { slug: "leather-chair", name: "В кожаном кресле", camera: "объектив 70 мм, боковой ракурс", pose: "сидит в кожаном кресле, расслабленная private-club поза", prompt: "seated in leather tasting chair, relaxed private club pose, wine cellar shelves behind" },
  { slug: "cellar-walk", name: "Проход по винной комнате", camera: "репортажный объектив 50 мм", pose: "идёт вдоль стеллажей, естественный шаг", prompt: "walking along wine racks in refined cellar, natural motion, warm amber lighting, no readable labels" },
  { slug: "candle-table", name: "У свечного света", camera: "объектив 85 мм, мягкая глубина", pose: "сидит или стоит рядом со свечами на столе", prompt: "near candlelit tasting table, warm soft highlights, leather chairs and stone walls visible" },
  { slug: "private-club-corner", name: "Private club corner", camera: "объектив 70 мм, уровень глаз", pose: "стоит в lounge-углу винной комнаты", prompt: "standing in private club corner of wine cellar, leather seating and wooden racks, refined evening styling" },
  { slug: "bottle-foreground", name: "Через детали стеллажей", camera: "объектив 85 мм, размытый передний план", pose: "обрамлён стеллажами или бутылками на переднем плане", prompt: "portrait framed through blurred wine racks and bottles, labels not readable, elegant cellar depth" },
  { slug: "wide-cellar", name: "Широкий cellar кадр", camera: "широкий объектив 35 мм", pose: "стоит в пространстве винной комнаты, архитектура доминирует", prompt: "wide environmental wine cellar shot, person smaller in frame, stone arches, table and racks dominate" },
  { slug: "cellar-hero", name: "Главный wine cellar кадр", camera: "лучший cinematic-ракурс, объектив 70 мм", pose: "финальная уверенная поза в винной комнате", prompt: "signature wine cellar editorial portrait, warm refined tasting room atmosphere, polished final image" },
];

const cyprusVillaPoseTemplates = [
  { slug: "pool-terrace", name: "У бассейна", camera: "объектив 70 мм, солнечный боковой свет", pose: "стоит у бассейна на террасе, корпус слегка повернут", prompt: "standing on sunny Cyprus villa pool terrace, infinity pool and sea horizon visible, bright Mediterranean lifestyle portrait" },
  { slug: "white-arches", name: "У белых арок", camera: "объектив 85 мм, мягкая глубина", pose: "полуоборот у белых каменных арок виллы", prompt: "half-turn portrait near white limestone arches, bougainvillea and sea light, elegant resort villa mood" },
  { slug: "linen-lounge", name: "В lounge-зоне", camera: "объектив 70 мм, ракурс три четверти", pose: "сидит или стоит у светлой lounge-зоны, руки видны", prompt: "near cream outdoor lounge sofa with linen curtains, hands visible, sunny premium villa terrace" },
  { slug: "garden-path", name: "По садовой дорожке", camera: "репортажный объектив 50 мм", pose: "идёт по каменной дорожке виллы, естественный шаг", prompt: "walking along stone garden path at Cyprus villa, palms and white walls around, natural sunny movement" },
  { slug: "sea-balcony", name: "На балконе с морем", camera: "объектив 70 мм, уровень глаз", pose: "стоит у балюстрады или стеклянного ограждения с видом на море", prompt: "standing on villa balcony with sea horizon and bright sky, relaxed Mediterranean resort styling" },
  { slug: "breakfast-terrace", name: "На завтрачной террасе", camera: "объектив 50 мм, lifestyle-ракурс", pose: "сидит или стоит у небольшого стола на террасе", prompt: "near breakfast table on sunny villa terrace, ceramic dishes and linen details, refined vacation lifestyle" },
  { slug: "palm-shadow", name: "В тени пальм", camera: "объектив 85 мм, пятнистый солнечный свет", pose: "стоит в мягкой тени пальм, расслабленная поза", prompt: "portrait in palm shadows near white villa wall, warm sun patches, elegant natural expression" },
  { slug: "villa-steps", name: "На ступенях виллы", camera: "объектив 70 мм, нижний спокойный ракурс", pose: "стоит или сидит на светлых каменных ступенях", prompt: "on white stone villa steps, sea and terrace plants visible, sunny upscale Mediterranean pose" },
  { slug: "wide-villa", name: "Широкий кадр виллы", camera: "широкий объектив 35 мм", pose: "стоит внутри пространства виллы, архитектура и море доминируют", prompt: "wide environmental Cyprus villa shot, person smaller in frame, white architecture, pool, palms and sea dominate" },
  { slug: "villa-hero", name: "Главный Cyprus кадр", camera: "лучший resort editorial-ракурс, объектив 70 мм", pose: "финальная уверенная поза на солнечной вилле", prompt: "signature sunny Cyprus villa editorial portrait, bright Mediterranean light, polished final resort lifestyle image" },
];

const studioPoseTemplates = {
  "modern-office": officePoseTemplates,
  "executive-boardroom": boardroomPoseTemplates,
  "premium-gym": premiumGymPoseTemplates,
  "boutique-hotel": hotelPoseTemplates,
  "castle-library": castlePoseTemplates,
  "hi-tech-lab": hiTechPoseTemplates,
  "urban-loft": loftPoseTemplates,
  "luxury-penthouse": penthousePoseTemplates,
  "art-gallery": galleryPoseTemplates,
  "wellness-spa": wellnessPoseTemplates,
  "yacht-marina": yachtMarinaPoseTemplates,
  "beach-club": beachClubPoseTemplates,
  "metropolis-streets": metropolisStreetPoseTemplates,
  "desert-dunes": desertDunesPoseTemplates,
  "luxury-garage": luxuryGaragePoseTemplates,
  "pit-lane-racing": pitLanePoseTemplates,
  "private-jet": privateJetPoseTemplates,
  "vip-airport-terminal": vipAirportPoseTemplates,
  "city-rooftop": cityRooftopPoseTemplates,
  "fine-dining-restaurant": fineDiningPoseTemplates,
  "golf-club": golfClubPoseTemplates,
  "italian-villa-garden": italianVillaPoseTemplates,
  "paris-street": parisStreetPoseTemplates,
  "tokyo-neon-night": tokyoNeonPoseTemplates,
  "new-york-editorial-street": newYorkStreetPoseTemplates,
  "music-recording-studio": musicRecordingStudioPoseTemplates,
  "cyprus-villa": cyprusVillaPoseTemplates,
  "black-photo-studio": blackPhotoStudioPoseTemplates,
  "fashion-boutique": fashionBoutiquePoseTemplates,
  "moroccan-riad": moroccanRiadPoseTemplates,
  "white-cyclorama-studio": whiteCycloramaStudioPoseTemplates,
  "pink-pastel-studio": pinkPastelStudioPoseTemplates,
  "powder-blue-studio": powderBlueStudioPoseTemplates,
};

const distanceVariants = [
  {
    slug: "close",
    name: "близко",
    camera: "крупнее всего, человек ближе всего к объективу",
    crop: "портрет / грудной кадр",
    prompt: "closest camera distance, person is large in frame, head and shoulders or chest-up, face detail is the priority, professional portrait crop",
  },
  {
    slug: "medium",
    name: "чуть дальше",
    camera: "средняя дистанция, камера немного дальше",
    crop: "по пояс",
    prompt: "medium camera distance, person farther from lens than close-up, waist-up or hips-up framing, both hands can be visible, more interior visible",
  },
  {
    slug: "three-quarter",
    name: "ещё дальше",
    camera: "камера далеко, почти полный рост, много пространства",
    crop: "почти полный рост",
    prompt: "distant camera position, almost full body visible from head to below knees or shoes, person is clearly smaller than in medium shot, strong interior context, floor and furniture visible",
  },
  {
    slug: "wide",
    name: "далеко",
    camera: "самый дальний общий кадр",
    crop: "полный рост / интерьерный кадр",
    prompt: "very wide environmental photo from far away, full body visible, person occupies only a small part of the frame, room architecture dominates the image, lots of floor ceiling walls furniture and depth visible",
  },
];

const activeSlugs = catalog.studios.map((studio) => studio.slug);

const { error: deactivateError } = await supabase
  .from("studios")
  .update({ is_active: false })
  .not("slug", "in", `(${activeSlugs.map((slug) => `"${slug}"`).join(",")})`);

if (deactivateError) {
  throw new Error(`Failed to deactivate old studios: ${deactivateError.message}`);
}

for (const studio of catalog.studios) {
  const { data: studioRow, error: studioError } = await supabase
    .from("studios")
    .upsert(
      {
        slug: studio.slug,
        name: studio.name,
        description: studio.description,
        preview_url: studio.preview_url,
        is_active: true,
      },
      { onConflict: "slug" },
    )
    .select("id")
    .single();

  if (studioError || !studioRow) {
    throw new Error(`Failed to upsert studio ${studio.slug}: ${studioError?.message}`);
  }

  const poseTemplates = studioPoseTemplates[studio.slug] ?? officePoseTemplates;
  const shots = poseTemplates.flatMap((poseTemplate, poseIndex) =>
    distanceVariants.map((distanceVariant, distanceIndex) => {
      const shotNumber = poseIndex * distanceVariants.length + distanceIndex + 1;

      return {
        studio_id: studioRow.id,
        slug: `${poseTemplate.slug}-${distanceVariant.slug}`,
        name: `${String(shotNumber).padStart(2, "0")}. ${poseTemplate.name} - ${distanceVariant.name}`,
        camera_angle: `${poseTemplate.camera}; ${distanceVariant.camera}`,
        pose: poseTemplate.pose,
        crop: distanceVariant.crop,
        prompt: [
          studio.base_prompt,
          studio.wardrobe_prompt ? `wardrobe direction: ${studio.wardrobe_prompt}` : "",
          photographerDirection,
          poseTemplate.prompt,
          distanceVariant.prompt,
          "photorealistic premium editorial photo",
          "the pose must look like a real professional photographer directed the person during a modern photoshoot",
          "elegant natural micro-pose, flattering angle, relaxed confident expression",
          "consistent interior design",
          "realistic daylight",
          "preserve the chosen studio interior clearly",
          "no text, no logos",
        ].join(", "),
        negative_prompt: negativePrompt,
        variations: 1,
        sort_order: -10000 + shotNumber * 10,
      };
    }),
  );

  const currentShotSlugs = shots.map((shot) => shot.slug);
  const { data: staleShots, error: staleShotsError } = await supabase
    .from("studio_shots")
    .select("id")
    .eq("studio_id", studioRow.id)
    .not("slug", "in", `(${currentShotSlugs.map((slug) => `"${slug}"`).join(",")})`);

  if (staleShotsError) {
    throw new Error(`Failed to load stale shots for ${studio.slug}: ${staleShotsError.message}`);
  }

  const staleShotIds = (staleShots ?? []).map((shot) => shot.id);
  if (staleShotIds.length > 0) {
    const { error: staleImagesError } = await supabase
      .from("generated_images")
      .delete()
      .in("studio_shot_id", staleShotIds);

    if (staleImagesError) {
      throw new Error(`Failed to delete stale images for ${studio.slug}: ${staleImagesError.message}`);
    }

    const { error: staleDeleteError } = await supabase
      .from("studio_shots")
      .delete()
      .in("id", staleShotIds);

    if (staleDeleteError) {
      throw new Error(`Failed to delete stale shots for ${studio.slug}: ${staleDeleteError.message}`);
    }
  }

  const { error: shotsError } = await supabase
    .from("studio_shots")
    .upsert(shots, { onConflict: "studio_id,slug" });

  if (shotsError) {
    throw new Error(`Failed to upsert shots for ${studio.slug}: ${shotsError.message}`);
  }

  console.log(`${studio.slug}: ${shots.length} shots`);
}

console.log(`Seeded ${catalog.studios.length} studios with ${officePoseTemplates.length * distanceVariants.length} shots each.`);
