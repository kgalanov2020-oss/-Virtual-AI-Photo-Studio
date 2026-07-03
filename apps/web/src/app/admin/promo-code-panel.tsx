"use client";

import type { FormEvent } from "react";
import { useEffect, useState } from "react";
import type { PromoCode } from "@/lib/types";

type PromoFormState = {
  code: string;
  credit_amount: string;
  description: string;
  expires_at: string;
  is_active: boolean;
  max_redemptions: string;
  starts_at: string;
};

const initialForm: PromoFormState = {
  code: "",
  credit_amount: "20",
  description: "",
  expires_at: "",
  is_active: true,
  max_redemptions: "",
  starts_at: "",
};

const featuredCampaigns = [
  {
    code: "STUDIO",
    fallbackCreditAmount: 40,
    fallbackDescription: "Outreach для фотостудий: две промо-генерации по 20 фото.",
    fallbackMaxRedemptions: 300,
  },
  {
    code: "START",
    fallbackCreditAmount: 20,
    fallbackDescription: "Стартовый промокод: одна промо-генерация на 20 фото.",
    fallbackMaxRedemptions: 100,
  },
  {
    code: "WELCOME",
    fallbackCreditAmount: 40,
    fallbackDescription: "Приветственный промокод: две промо-генерации по 20 фото.",
    fallbackMaxRedemptions: 100,
  },
  {
    code: "FRIEND",
    fallbackCreditAmount: 60,
    fallbackDescription: "Приведи друга: три промо-генерации по 20 фото.",
    fallbackMaxRedemptions: null,
  },
] as const;

export function PromoCodePanel() {
  const [adminToken, setAdminToken] = useState("");
  const [form, setForm] = useState<PromoFormState>(initialForm);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [promoCodes, setPromoCodes] = useState<PromoCode[]>([]);

  useEffect(() => {
    const savedToken = window.localStorage.getItem("outreach_admin_token") ?? "";
    setAdminToken(savedToken);
    if (savedToken) {
      void loadPromoCodes(savedToken);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function loadPromoCodes(tokenOverride?: string) {
    const token = (tokenOverride ?? adminToken).trim();
    if (!token) {
      setMessage("Введите админ-токен.");
      return;
    }

    setIsLoading(true);
    setMessage("");
    window.localStorage.setItem("outreach_admin_token", token);

    try {
      const response = await fetch("/api/admin/promo-codes", {
        headers: { "x-outreach-token": token },
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Не удалось загрузить промокоды.");
      }

      setPromoCodes(payload.promoCodes ?? []);
      setMessage(`Загружено промокодов: ${(payload.promoCodes ?? []).length}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось загрузить промокоды.");
    } finally {
      setIsLoading(false);
    }
  }

  async function createPromoCode(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const token = adminToken.trim();
    if (!token) {
      setMessage("Введите админ-токен.");
      return;
    }

    setIsSaving(true);
    setMessage("");
    window.localStorage.setItem("outreach_admin_token", token);

    try {
      const response = await fetch("/api/admin/promo-codes", {
        body: JSON.stringify({
          code: form.code,
          credit_amount: Number(form.credit_amount),
          description: form.description,
          expires_at: form.expires_at || null,
          is_active: form.is_active,
          max_redemptions: form.max_redemptions ? Number(form.max_redemptions) : null,
          starts_at: form.starts_at || null,
        }),
        headers: {
          "content-type": "application/json",
          "x-outreach-token": token,
        },
        method: "POST",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Не удалось создать промокод.");
      }

      setPromoCodes((current) => [payload.promoCode, ...current]);
      setForm(initialForm);
      setMessage(`Промокод ${payload.promoCode.code} создан.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Не удалось создать промокод.");
    } finally {
      setIsSaving(false);
    }
  }

  async function togglePromoCode(promoCode: PromoCode) {
    const token = adminToken.trim();
    if (!token) {
      setMessage("Введите админ-токен.");
      return;
    }

    const nextActive = !promoCode.is_active;
    setPromoCodes((current) =>
      current.map((item) => (item.id === promoCode.id ? { ...item, is_active: nextActive } : item)),
    );

    try {
      const response = await fetch("/api/admin/promo-codes", {
        body: JSON.stringify({ id: promoCode.id, is_active: nextActive }),
        headers: {
          "content-type": "application/json",
          "x-outreach-token": token,
        },
        method: "PATCH",
      });
      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload.error ?? "Не удалось обновить промокод.");
      }

      setPromoCodes((current) =>
        current.map((item) => (item.id === promoCode.id ? payload.promoCode : item)),
      );
      setMessage(nextActive ? `${promoCode.code} включён.` : `${promoCode.code} отключён.`);
    } catch (error) {
      setPromoCodes((current) =>
        current.map((item) =>
          item.id === promoCode.id ? { ...item, is_active: promoCode.is_active } : item,
        ),
      );
      setMessage(error instanceof Error ? error.message : "Не удалось обновить промокод.");
    }
  }

  return (
    <div className="admin-promo-panel">
      <div className="admin-promo-list" aria-label="Действующие промокампании">
        {featuredCampaigns.map((campaign) => {
          const promoCode = promoCodes.find((item) => item.code === campaign.code);
          const creditAmount = promoCode?.credit_amount ?? campaign.fallbackCreditAmount;
          const maxRedemptions = promoCode?.max_redemptions ?? campaign.fallbackMaxRedemptions;
          const redeemedCount = promoCode?.redeemed_count ?? 0;
          const isLoaded = Boolean(promoCode);

          return (
            <div key={campaign.code}>
              <div className="admin-promo-card-head">
                <strong>{campaign.code}</strong>
                <span
                  className={
                    promoCode?.is_active === false
                      ? "outreach-status-pill is-stop"
                      : "outreach-status-pill is-auto"
                  }
                >
                  {promoCode?.is_active === false ? "Отключён" : "Активен"}
                </span>
              </div>
              <b>{creditAmount} фото начисляет</b>
              <span>{promoCode?.description ?? campaign.fallbackDescription}</span>
              <small>
                Применения: {isLoaded ? redeemedCount : "0"}
                {maxRedemptions ? ` / ${maxRedemptions}` : " / без общего лимита"}
              </small>
              {promoCode ? <small>Период: {formatPromoPeriod(promoCode)}</small> : null}
            </div>
          );
        })}
      </div>

      <div className="admin-token-inline">
        <label>
          <span>Админ-токен</span>
          <input
            onChange={(event) => setAdminToken(event.target.value)}
            placeholder="OUTREACH_ADMIN_TOKEN"
            type="password"
            value={adminToken}
          />
        </label>
        <button className="button button-secondary" disabled={isLoading} onClick={() => loadPromoCodes()}>
          {isLoading ? "Загрузка..." : "Загрузить промокоды"}
        </button>
      </div>

      {message ? <div className="upload-message">{message}</div> : null}

      <form className="admin-promo-form" onSubmit={createPromoCode}>
        <label>
          <span>Название промокода</span>
          <input
            onChange={(event) =>
              setForm((current) => ({
                ...current,
                code: event.target.value.replace(/\s+/g, "").toUpperCase(),
              }))
            }
            placeholder="BIRTHDAY"
            required
            value={form.code}
          />
        </label>
        <label>
          <span>Сколько фото начислить</span>
          <input
            max="120"
            min="1"
            onChange={(event) =>
              setForm((current) => ({ ...current, credit_amount: event.target.value }))
            }
            required
            type="number"
            value={form.credit_amount}
          />
        </label>
        <label>
          <span>Лимит применений</span>
          <input
            min="1"
            onChange={(event) =>
              setForm((current) => ({ ...current, max_redemptions: event.target.value }))
            }
            placeholder="Пусто = без лимита"
            type="number"
            value={form.max_redemptions}
          />
        </label>
        <label>
          <span>Активен с</span>
          <input
            onChange={(event) =>
              setForm((current) => ({ ...current, starts_at: event.target.value }))
            }
            type="datetime-local"
            value={form.starts_at}
          />
        </label>
        <label>
          <span>Активен до</span>
          <input
            onChange={(event) =>
              setForm((current) => ({ ...current, expires_at: event.target.value }))
            }
            type="datetime-local"
            value={form.expires_at}
          />
        </label>
        <label className="admin-promo-form-wide">
          <span>Описание</span>
          <input
            onChange={(event) =>
              setForm((current) => ({ ...current, description: event.target.value }))
            }
            placeholder="Например: промокод для рассылки фотостудиям"
            value={form.description}
          />
        </label>
        <label className="admin-promo-checkbox">
          <input
            checked={form.is_active}
            onChange={(event) =>
              setForm((current) => ({ ...current, is_active: event.target.checked }))
            }
            type="checkbox"
          />
          <span>Сразу активировать</span>
        </label>
        <button className="button button-primary" disabled={isSaving} type="submit">
          {isSaving ? "Создаём..." : "Создать промокод"}
        </button>
      </form>

      <div className="admin-promo-table-wrap">
        <table className="admin-promo-table">
          <thead>
            <tr>
              <th>Код</th>
              <th>Фото</th>
              <th>Применения</th>
              <th>Период</th>
              <th>Статус</th>
              <th>Действие</th>
            </tr>
          </thead>
          <tbody>
            {promoCodes.length > 0 ? (
              promoCodes.map((promoCode) => (
                <tr key={promoCode.id}>
                  <td>
                    <strong>{promoCode.code}</strong>
                    {promoCode.description ? <small>{promoCode.description}</small> : null}
                  </td>
                  <td>{promoCode.credit_amount}</td>
                  <td>
                    {promoCode.redeemed_count}
                    {promoCode.max_redemptions ? ` / ${promoCode.max_redemptions}` : " / без лимита"}
                  </td>
                  <td>{formatPromoPeriod(promoCode)}</td>
                  <td>
                    <span
                      className={
                        promoCode.is_active
                          ? "outreach-status-pill is-auto"
                          : "outreach-status-pill is-stop"
                      }
                    >
                      {promoCode.is_active ? "Активен" : "Отключён"}
                    </span>
                  </td>
                  <td>
                    <button
                      className="outreach-send-button"
                      onClick={() => togglePromoCode(promoCode)}
                      type="button"
                    >
                      {promoCode.is_active ? "Отключить" : "Включить"}
                    </button>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={6}>Введите токен и загрузите промокоды.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function formatPromoPeriod(promoCode: PromoCode) {
  const startsAt = promoCode.starts_at ? formatDate(promoCode.starts_at) : "сейчас";
  const expiresAt = promoCode.expires_at ? formatDate(promoCode.expires_at) : "без срока";
  return `${startsAt} - ${expiresAt}`;
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  }).format(new Date(value));
}
