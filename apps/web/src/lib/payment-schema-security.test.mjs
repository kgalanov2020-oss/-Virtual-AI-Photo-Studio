import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migration0013Url = new URL(
  "../../../../supabase/migrations/0013_yookassa_payment_settlement.sql",
  import.meta.url,
);
const migration0014Url = new URL(
  "../../../../supabase/migrations/0014_harden_client_write_permissions.sql",
  import.meta.url,
);
const migration0015Url = new URL(
  "../../../../supabase/migrations/0015_payment_success_conversion_outbox.sql",
  import.meta.url,
);
const checkoutRouteUrl = new URL(
  "../app/api/payments/create-checkout/route.ts",
  import.meta.url,
);
const uploadPageUrl = new URL("../app/upload/page.tsx", import.meta.url);
const loginPageUrl = new URL("../app/login/page.tsx", import.meta.url);
const generationPageUrl = new URL("../app/generation/[jobId]/page.tsx", import.meta.url);
const promoRouteUrl = new URL("../app/api/promo-codes/redeem/route.ts", import.meta.url);
const jobRouteUrl = new URL("../app/api/jobs/[jobId]/route.ts", import.meta.url);
const approveRouteUrl = new URL("../app/api/jobs/[jobId]/approve/route.ts", import.meta.url);
const runpodRouteUrl = new URL("../app/api/jobs/[jobId]/runpod/route.ts", import.meta.url);
const paymentSettlementUrl = new URL("payment-settlement.ts", import.meta.url);
const confirmRouteUrl = new URL("../app/api/payments/confirm/route.ts", import.meta.url);
const webhookRouteUrl = new URL("../app/api/payments/yookassa-webhook/route.ts", import.meta.url);
const checkoutPageUrl = new URL("../app/checkout/[jobId]/page.tsx", import.meta.url);

function extractSqlFunction(sql, functionName) {
  const start = sql.indexOf(`create or replace function public.${functionName}`);
  assert.notEqual(start, -1, `missing SQL function ${functionName}`);
  const end = sql.indexOf("\n$$;", start);
  assert.notEqual(end, -1, `unterminated SQL function ${functionName}`);
  return sql.slice(start, end + 4);
}

test("payment schema serializes one active attempt and persists the provider key", async () => {
  const [sql, route] = await Promise.all([
    readFile(migration0013Url, "utf8"),
    readFile(checkoutRouteUrl, "utf8"),
  ]);

  assert.match(sql, /orders_one_active_yookassa_attempt_uidx/);
  assert.match(sql, /where provider = 'yookassa'[\s\S]*is_active_payment_attempt/);
  assert.match(sql, /from public\.jobs[\s\S]*for update/);
  assert.match(sql, /provider_idempotence_key text/);
  assert.match(route, /"Idempotence-Key": idempotenceKey/);
  assert.doesNotMatch(route, /crypto\.randomUUID\(\)/);
});

test("settlement and photo-credit updates are atomic database operations", async () => {
  const sql = await readFile(migration0013Url, "utf8");

  assert.match(sql, /create or replace function public\.settle_yookassa_payment/);
  assert.match(sql, /duplicate_succeeded_payment_credited/);
  assert.match(sql, /create or replace function public\.consume_user_photo_credit/);
  assert.match(sql, /free_images_remaining = free_images_remaining - 1/);
  assert.match(sql, /and free_images_remaining > 0/);
  assert.match(sql, /create or replace function public\.record_generated_image_with_credit/);
  assert.match(sql, /from public\.jobs[\s\S]*for update/);
  assert.match(sql, /insert into public\.generated_images/);
  assert.match(sql, /create or replace function public\.grant_user_photo_credits/);
  assert.match(
    sql,
    /free_images_remaining = public\.user_profiles\.free_images_remaining \+ excluded\.free_images_remaining/,
  );
  assert.match(sql, /from public, anon, authenticated/);
  assert.match(sql, /to service_role/);
});

test("a confirmed provider payment exposes one durable analytics conversion", async () => {
  const [sql, confirmRoute, checkoutRoute, checkoutPage] = await Promise.all([
    readFile(migration0015Url, "utf8"),
    readFile(confirmRouteUrl, "utf8"),
    readFile(checkoutRouteUrl, "utf8"),
    readFile(checkoutPageUrl, "utf8"),
  ]);

  assert.match(sql, /create table if not exists public\.payment_conversion_events/);
  assert.match(sql, /unique \(goal, provider, provider_payment_id\)/);
  assert.match(sql, /after update of status, provider_payment_id on public\.orders/);
  assert.match(sql, /old\.status is distinct from 'paid'/);
  assert.match(sql, /and delivered_at is null/);
  assert.match(sql, /create or replace function public\.ack_payment_success_conversion/);
  assert.match(sql, /revoke all on public\.payment_conversion_events from public, anon, authenticated/);
  assert.match(sql, /grant execute on function public\.claim_payment_success_conversion[\s\S]*to service_role/);
  assert.match(sql, /grant execute on function public\.ack_payment_success_conversion[\s\S]*to service_role/);
  assert.match(confirmRoute, /claimPaymentSuccessGoalBestEffort/);
  assert.match(checkoutRoute, /claimPaymentSuccessGoalBestEffort/);
  assert.match(checkoutPage, /trackYandexGoal\("payment_success"/);
  assert.match(checkoutPage, /order_price: goal\.value/);
  assert.match(checkoutPage, /acknowledgePaymentSuccessGoal/);
  assert.match(checkoutPage, /pollPaymentReturn/);
});

test("payment paths lock job before order and preserve late provider money", async () => {
  const [sql, route, settlementHelper, confirmRoute, webhookRoute] = await Promise.all([
    readFile(migration0013Url, "utf8"),
    readFile(checkoutRouteUrl, "utf8"),
    readFile(paymentSettlementUrl, "utf8"),
    readFile(confirmRouteUrl, "utf8"),
    readFile(webhookRouteUrl, "utf8"),
  ]);
  const settlement = extractSqlFunction(sql, "settle_yookassa_payment");
  const balanceSettlement = extractSqlFunction(sql, "settle_job_from_photo_balance");

  assert.ok(
    settlement.indexOf("from public.jobs") < settlement.indexOf("from public.orders"),
    "settlement must lock job before order",
  );
  assert.match(settlement, /payment_job\.payment_status <> 'paid' and not job_matches_order/);
  assert.match(settlement, /late_provider_payment_after_balance_credited/);
  assert.ok(
    balanceSettlement.indexOf("from public.jobs") < balanceSettlement.indexOf("from public.orders"),
    "photo balance must lock job before order",
  );
  assert.match(balanceSettlement, /status', 'provider_attempt_exists'/);
  assert.match(balanceSettlement, /and status = 'pending'[\s\S]*for update/);
  assert.match(route, /rpc\("settle_job_from_photo_balance"/);
  assert.match(settlementHelper, /job\.payment_status !== "paid" && !jobMatchesOrder/);
  assert.match(webhookRoute, /payment_status, amount_cents, currency, product_code/);
  assert.ok(
    confirmRoute.indexOf('.from("orders")') <
      confirmRoute.indexOf('if (job.payment_status === "paid")'),
    "confirmation must inspect old provider orders before returning an already-paid job",
  );
});

test("promo redemption is a single serialized database transaction", async () => {
  const [sql, route] = await Promise.all([
    readFile(migration0013Url, "utf8"),
    readFile(promoRouteUrl, "utf8"),
  ]);
  const redemption = extractSqlFunction(sql, "redeem_promo_code");

  assert.match(redemption, /from public\.promo_codes[\s\S]*for update/);
  assert.match(redemption, /insert into public\.promo_redemptions/);
  assert.match(redemption, /insert into public\.user_profiles/);
  assert.match(redemption, /set redeemed_count = redeemed_count \+ 1/);
  assert.match(route, /rpc\("redeem_promo_code"/);
  assert.doesNotMatch(route, /from\("promo_redemptions"\)/);
  assert.doesNotMatch(route, /redeemed_count:\s*promoCode\.redeemed_count \+ 1/);
});

test("post-deploy privilege migration removes writes to server-owned fields", async () => {
  const sql = await readFile(migration0014Url, "utf8");

  assert.match(sql, /revoke insert, update, delete on public\.jobs from authenticated/);
  assert.match(sql, /drop policy if exists "Users can update own jobs"/);
  assert.match(sql, /revoke insert, update, delete on public\.user_profiles from authenticated/);
  assert.match(sql, /grant insert \(job_id, user_id, file_url\) on public\.uploaded_selfies/);
  assert.match(sql, /drop policy if exists "Users can update own selfies"/);
  assert.match(sql, /jobs\.status = 'draft'/);
  assert.match(sql, /grant update \(is_favorite\) on public\.generated_images/);
  assert.match(sql, /foreign key \(job_id\) references public\.jobs\(id\) on delete restrict/);
});

test("job deletion preserves all payment audit records", async () => {
  const [sql, route] = await Promise.all([
    readFile(migration0013Url, "utf8"),
    readFile(jobRouteUrl, "utf8"),
  ]);
  const deletion = extractSqlFunction(sql, "delete_job_without_payment_history");

  assert.match(route, /from\("orders"\)/);
  assert.match(route, /job\.payment_status === "paid" \|\| \(paymentOrders\?\.length \?\? 0\) > 0/);
  assert.match(route, /rpc\(\s*"delete_job_without_payment_history"/);
  assert.match(route, /status: 409/);
  assert.ok(
    deletion.indexOf("from public.jobs") < deletion.indexOf("from public.orders"),
    "atomic deletion must lock job before checking orders",
  );
  assert.match(deletion, /return 'payment_history'/);
});

test("protected job actions explicitly reject a missing bearer token", async () => {
  const [approve, runpod] = await Promise.all([
    readFile(approveRouteUrl, "utf8"),
    readFile(runpodRouteUrl, "utf8"),
  ]);

  for (const route of [approve, runpod]) {
    assert.match(route, /const token = readBearerToken\(request\);[\s\S]{0,120}if \(!token\)/);
    assert.match(route, /status: 401/);
    assert.doesNotMatch(route, /throw new Error\("Нет токена пользователя\."\)/);
  }
});

test("browser flows use server routes for server-owned profile and job writes", async () => {
  const [upload, login, generation] = await Promise.all([
    readFile(uploadPageUrl, "utf8"),
    readFile(loginPageUrl, "utf8"),
    readFile(generationPageUrl, "utf8"),
  ]);

  assert.doesNotMatch(upload, /from\("jobs"\)[\s\S]{0,160}\.insert\(/);
  assert.doesNotMatch(upload, /from\("user_profiles"\)[\s\S]{0,160}\.upsert\(/);
  assert.doesNotMatch(login, /from\("user_profiles"\)[\s\S]{0,160}\.upsert\(/);
  assert.doesNotMatch(generation, /from\("jobs"\)[\s\S]{0,160}\.update\(/);
  assert.doesNotMatch(upload, /is_approved:\s*false/);
  assert.match(upload, /fetch\("\/api\/jobs"/);
  assert.match(login, /fetch\("\/api\/profile"/);
});
