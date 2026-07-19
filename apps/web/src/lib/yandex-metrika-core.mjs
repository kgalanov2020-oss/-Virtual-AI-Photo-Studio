const goalPattern = /^[a-z][a-z0-9_]{0,63}$/;

export function normalizeYandexMetrikaId(value) {
  const normalized = String(value ?? "").trim();
  return /^[1-9]\d*$/.test(normalized) ? normalized : null;
}

export function buildYandexMetrikaInitScript(counterId) {
  const normalizedId = normalizeYandexMetrikaId(counterId);
  if (!normalizedId) return "";

  return `(function(m,e,t,r,i,k,a){
  m[i]=m[i]||function(){(m[i].a=m[i].a||[]).push(arguments)};
  m[i].l=1*new Date();
  for (var j=0;j<document.scripts.length;j++){if(document.scripts[j].src===r){return;}}
  k=e.createElement(t),a=e.getElementsByTagName(t)[0],k.async=1,k.src=r,a.parentNode.insertBefore(k,a)
})(window,document,"script","https://mc.yandex.ru/metrika/tag.js","ym");
ym(${normalizedId},"init",{ssr:true,clickmap:true,ecommerce:"dataLayer",referrer:document.referrer,url:location.href,accurateTrackBounce:true,trackLinks:true,webvisor:false});`;
}

export function dispatchYandexGoal({ counterId, goal, params = {}, target }) {
  const normalizedId = normalizeYandexMetrikaId(counterId);
  const normalizedGoal = String(goal ?? "").trim();

  if (!normalizedId || !goalPattern.test(normalizedGoal) || typeof target?.ym !== "function") {
    return false;
  }

  const compactParams = Object.fromEntries(
    Object.entries(params).filter(([, value]) => value !== undefined && value !== null),
  );
  target.ym(Number(normalizedId), "reachGoal", normalizedGoal, compactParams);
  return true;
}
