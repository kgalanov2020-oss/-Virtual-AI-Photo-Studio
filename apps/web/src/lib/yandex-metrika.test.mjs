import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import {
  buildYandexMetrikaInitScript,
  dispatchYandexGoal,
  normalizeYandexMetrikaId,
} from "./yandex-metrika-core.mjs";

const layoutUrl = new URL("../app/layout.tsx", import.meta.url);
const loginUrl = new URL("../app/login/page.tsx", import.meta.url);
const checkoutUrl = new URL("../app/checkout/[jobId]/page.tsx", import.meta.url);

test("accepts only a numeric public counter ID", () => {
  assert.equal(normalizeYandexMetrikaId(" 12345678 "), "12345678");
  assert.equal(normalizeYandexMetrikaId("0"), null);
  assert.equal(normalizeYandexMetrikaId("123;alert(1)"), null);
});

test("builds a safe standard Metrika initialization snippet", () => {
  const script = buildYandexMetrikaInitScript("12345678");

  assert.match(script, /https:\/\/mc\.yandex\.ru\/metrika\/tag\.js/);
  assert.match(script, /ym\(12345678,"init"/);
  assert.match(script, /ssr:true/);
  assert.match(script, /ecommerce:"dataLayer"/);
  assert.match(script, /webvisor:false/);
  assert.equal(buildYandexMetrikaInitScript("not-a-number"), "");
});

test("dispatches a compact reachGoal call only for a valid counter and goal", () => {
  const calls = [];
  const target = { ym: (...args) => calls.push(args) };

  assert.equal(
    dispatchYandexGoal({
      counterId: "12345678",
      goal: "payment_success",
      params: { value: 999, missing: null },
      target,
    }),
    true,
  );
  assert.deepEqual(calls, [[12345678, "reachGoal", "payment_success", { value: 999 }]]);
  assert.equal(
    dispatchYandexGoal({ counterId: "bad", goal: "payment_success", target }),
    false,
  );
  assert.equal(
    dispatchYandexGoal({ counterId: "12345678", goal: "invalid goal", target }),
    false,
  );
});

test("wires the public counter and verified conversion goals into the client", async () => {
  const [layout, login, checkout] = await Promise.all([
    readFile(layoutUrl, "utf8"),
    readFile(loginUrl, "utf8"),
    readFile(checkoutUrl, "utf8"),
  ]);

  assert.match(layout, /NEXT_PUBLIC_YANDEX_METRIKA_ID/);
  assert.match(layout, /buildYandexMetrikaInitScript/);
  assert.doesNotMatch(layout, /from ["']next\/script["']/);
  assert.doesNotMatch(layout, /strategy=["']afterInteractive["']/);

  const headSource = layout.slice(layout.indexOf("<head>"), layout.indexOf("</head>"));
  assert.match(headSource, /<script[\s\S]*id="yandex-metrika"[\s\S]*type="text\/javascript"/);
  assert.match(login, /trackYandexRegistrationOnce\(data\.user\.id\)/);
  assert.match(login, /data\.user\?\.identities\?\.length/);
  assert.match(checkout, /paymentSuccessGoal/);
  assert.match(checkout, /trackYandexGoal\("payment_success"/);
  assert.match(checkout, /order_price: goal\.value/);
});
