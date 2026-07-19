export type YooKassaPayment = {
  id: string;
  status?: string;
  paid?: boolean;
  amount?: {
    value?: string;
    currency?: string;
  };
  confirmation?: {
    confirmation_url?: string;
  };
  metadata?: {
    job_id?: string;
    user_id?: string;
    product_code?: string;
    target_image_count?: string;
    email?: string;
  };
};

export type ExpectedYooKassaPayment = {
  paymentId: string;
  jobId: string;
  userId: string;
  amountCents: number;
  currency: string;
  productCode: string;
  targetImageCount: number;
};

export class YooKassaVerificationError extends Error {
  code: string;
  constructor(code: string, message: string);
}

export function parseYooKassaAmountToCents(value?: string): number;

export function assertYooKassaPaymentMatches(
  payment: YooKassaPayment,
  expected: ExpectedYooKassaPayment,
): YooKassaPayment;

export function retrieveYooKassaPayment(options: {
  shopId: string;
  secretKey: string;
  paymentId: string;
  fetchImpl?: typeof fetch;
  timeoutMs?: number;
}): Promise<YooKassaPayment>;
