export const PHOTO_STUDIO_SEGMENT = "photo_studio";
export const PHOTO_BOOTH_SEGMENT = "photo_booth_manufacturer";
export const MIXED_SEGMENT = "mixed";

export function normalizeOutreachMode(value) {
  if (value === PHOTO_BOOTH_SEGMENT || value === MIXED_SEGMENT) return value;
  return PHOTO_STUDIO_SEGMENT;
}

export function getLeadSegment(lead) {
  return lead?.raw?.segment === PHOTO_BOOTH_SEGMENT
    ? PHOTO_BOOTH_SEGMENT
    : PHOTO_STUDIO_SEGMENT;
}

export function isLeadEligibleForSegment(lead, segment) {
  if (!lead?.email || lead.status === "sent" || lead.status === "stop") return false;

  if (segment === PHOTO_BOOTH_SEGMENT) {
    return getLeadSegment(lead) === PHOTO_BOOTH_SEGMENT && lead.status === "approved";
  }

  return (
    getLeadSegment(lead) === PHOTO_STUDIO_SEGMENT &&
    (lead.status === "new" || lead.status === "approved")
  );
}

export function selectNextLeads(candidates, mode, lastAutoSegment, limit) {
  const studios = candidates.filter((lead) => isLeadEligibleForSegment(lead, PHOTO_STUDIO_SEGMENT));
  const booths = candidates.filter((lead) => isLeadEligibleForSegment(lead, PHOTO_BOOTH_SEGMENT));

  if (mode === PHOTO_STUDIO_SEGMENT) return studios.slice(0, limit);
  if (mode === PHOTO_BOOTH_SEGMENT) return booths.slice(0, Math.min(limit, 1));

  // A mixed run always sends at most one message. It alternates from the last
  // successful automatic send, but safely falls back when one queue is empty.
  const preferredSegment =
    lastAutoSegment === PHOTO_STUDIO_SEGMENT ? PHOTO_BOOTH_SEGMENT : PHOTO_STUDIO_SEGMENT;
  const preferredQueue = preferredSegment === PHOTO_BOOTH_SEGMENT ? booths : studios;
  const fallbackQueue = preferredSegment === PHOTO_BOOTH_SEGMENT ? studios : booths;
  const nextLead = preferredQueue[0] ?? fallbackQueue[0];

  return nextLead ? [nextLead] : [];
}

export function capSendLimitForMode(limit, mode) {
  const normalizedLimit = Math.max(1, Number(limit) || 1);
  return mode === MIXED_SEGMENT || mode === PHOTO_BOOTH_SEGMENT
    ? 1
    : normalizedLimit;
}

export function getPromoCodeForLead(lead, segment, environment = process.env) {
  if (segment === PHOTO_BOOTH_SEGMENT) {
    return environment.OUTREACH_BOOTH_PROMO_CODE?.trim() || "CABIN";
  }

  return lead?.promo_code || environment.OUTREACH_PROMO_CODE?.trim() || "STUDIO";
}

export function buildOutreachSubject(variables) {
  if (variables.segment === PHOTO_BOOTH_SEGMENT) {
    return `${variables.studio_name}, AI-фотостудия как новый модуль для фотокабин`;
  }

  return `${variables.studio_name}, AI-фотосессии для клиентов`;
}

export function buildOutreachText(variables) {
  if (variables.segment === PHOTO_BOOTH_SEGMENT) {
    return `Здравствуйте, ${variables.studio_name}!

Мы развиваем Virtual AI Photo Studio — сервис, который превращает обычные селфи пользователя в готовую серию профессиональных портретов с выбранным интерьером, одеждой, светом и позами.

Предлагаем обсудить интеграцию сервиса в ваши фотокабины как дополнительный программный модуль. Пользователь сможет сделать или загрузить фото, выбрать стиль и получить AI-фотосессию прямо через интерфейс кабины. Это может дать владельцам кабин новый платный сценарий, увеличить средний чек и выделить оборудование среди обычных решений для печати фото.

Для пилота можем предоставить API или веб-модуль, адаптировать интерфейс под экран кабины и подготовить демонстрационный сценарий без изменений в основной механике оборудования.

Для знакомства даём промокод ${variables.promo_code}. По нему можно бесплатно проверить результат на своих фото.

Будем рады коротко показать рабочий сервис и обсудить тестовую интеграцию.

Сайт: https://virtualphotostudio.ru

С уважением,
Virtual AI Photo Studio

Если предложение неактуально, ответьте "стоп", и мы больше не будем писать.`;
  }

  return `Здравствуйте, ${variables.studio_name}!

Мы сделали Virtual AI Photo Studio - сервис, где клиент загружает обычные селфи, выбирает интерьер и получает серию AI-портретов в готовой локации.

Для фотостудии это может быть простым дополнительным продуктом:
- показать клиенту быстрый пример "до/после";
- дать AI-фотосессию как бонус к пакету;
- предложить недорогой цифровой формат тем, кто пока не готов к полноценной съемке.

Для знакомства даем промокод ${variables.promo_code}. По нему можно бесплатно проверить результат на своих фото.

Сайт: https://virtualphotostudio.ru

Если вам интересно, можем подготовить отдельный промокод для клиентов вашей студии и подобрать интерьеры под ваш стиль.

С уважением,
Virtual AI Photo Studio

Если предложение неактуально, ответьте "стоп", и мы больше не будем писать.`;
}
