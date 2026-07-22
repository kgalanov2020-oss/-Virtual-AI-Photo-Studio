import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const loginPageUrl = new URL("../app/login/page.tsx", import.meta.url);
const profileRouteUrl = new URL("../app/api/profile/route.ts", import.meta.url);
const agreementPageUrl = new URL("../app/oferta/page.tsx", import.meta.url);
const globalStylesUrl = new URL("../app/globals.css", import.meta.url);

test("registration renders four independent required consents", async () => {
  const loginPage = await readFile(loginPageUrl, "utf8");

  assert.equal(loginPage.match(/type="checkbox"/g)?.length, 4);
  assert.match(loginPage, /checked=\{consents\.personalData\}/);
  assert.match(loginPage, /checked=\{consents\.legalTerms\}/);
  assert.match(loginPage, /checked=\{consents\.privacy\}/);
  assert.match(loginPage, /checked=\{consents\.photoRights\}/);
  assert.match(loginPage, /password\.length < 6 \|\| !allConsentsAccepted/);
});

test("profile API requires every consent and preserves existing timestamps", async () => {
  const profileRoute = await readFile(profileRouteUrl, "utf8");

  assert.match(profileRoute, /body\.consents\?\.legalTerms !== true/);
  assert.match(profileRoute, /body\.consents\.privacy !== true/);
  assert.match(profileRoute, /body\.consents\.personalData !== true/);
  assert.match(profileRoute, /body\.consents\.photoRights !== true/);
  assert.match(
    profileRoute,
    /legal_terms_accepted_at: existingProfile\?\.legal_terms_accepted_at \?\? now/,
  );
  assert.match(
    profileRoute,
    /personal_data_accepted_at: existingProfile\?\.personal_data_accepted_at \?\? now/,
  );
  assert.doesNotMatch(profileRoute, /acceptConsents/);
});

test("agreement updates apply prospectively and preserve paid orders", async () => {
  const agreementPage = await readFile(agreementPageUrl, "utf8");

  assert.match(agreementPage, /в одностороннем порядке/);
  assert.match(agreementPage, /заказам, оформленным после даты её вступления в силу/);
  assert.match(agreementPage, /Изменения не применяются к уже оплаченным заказам/);
  assert.match(agreementPage, /только после получения соответствующего согласия/);
});

test("long account email cannot overflow the mobile viewport", async () => {
  const globalStyles = await readFile(globalStylesUrl, "utf8");

  assert.match(
    globalStyles,
    /\.account-state div\s*\{[^}]*min-width:\s*0;/s,
  );
  assert.match(
    globalStyles,
    /\.account-state strong,\s*\.account-state span\s*\{[^}]*overflow-wrap:\s*anywhere;/s,
  );
});
