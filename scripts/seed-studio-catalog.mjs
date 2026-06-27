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
