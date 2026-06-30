type GeminiStudioPrompt = {
  prompt: string;
  negativePrompt: string;
  fileNamePrefix: string;
  width?: number;
  height?: number;
};

type GeminiPart = {
  text?: string;
  inlineData?: {
    mimeType?: string;
    data?: string;
  };
  inline_data?: {
    mime_type?: string;
    data?: string;
  };
};

type GeminiResponse = {
  candidates?: Array<{
    finishReason?: string;
    safetyRatings?: Array<{
      category?: string;
      probability?: string;
    }>;
    content?: {
      parts?: GeminiPart[];
    };
  }>;
  error?: {
    message?: string;
    status?: string;
  };
};

type GeminiInteractionResponse = {
  output_image?: {
    data?: string;
    mime_type?: string;
    mimeType?: string;
  };
  image?: {
    data?: string;
    mime_type?: string;
    mimeType?: string;
  };
  images?: Array<{
    data?: string;
    mime_type?: string;
    mimeType?: string;
  }>;
  output?: Array<{
    type?: string;
    data?: string;
    mime_type?: string;
    mimeType?: string;
    text?: string;
    image?: {
      data?: string;
      mime_type?: string;
      mimeType?: string;
    };
    inlineData?: {
      data?: string;
      mimeType?: string;
    };
    inline_data?: {
      data?: string;
      mime_type?: string;
    };
  }>;
  error?: {
    message?: string;
    status?: string;
  };
};

const MAX_GEMINI_ATTEMPTS = 3;
const RETRYABLE_STATUS_CODES = new Set([500, 502, 503, 504]);

export async function generateGeminiStudioPhoto(inputImage: Blob, prompt: GeminiStudioPrompt) {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    throw new Error("GEMINI_API_KEY is not configured.");
  }

  const model = normalizeGeminiImageModel(process.env.GEMINI_IMAGE_MODEL);
  const endpoint = "https://generativelanguage.googleapis.com/v1beta/interactions";
  const inputBytes = Buffer.from(await inputImage.arrayBuffer());
  const mimeType = inputImage.type || "image/jpeg";

  for (let attempt = 1; attempt <= MAX_GEMINI_ATTEMPTS; attempt += 1) {
    const body = JSON.stringify({
      model,
      input: [
        {
          type: "text",
          text: buildImagePrompt(prompt, attempt),
        },
        {
          type: "image",
          mime_type: mimeType,
          data: inputBytes.toString("base64"),
        },
      ],
      response_format: {
        type: "image",
        mime_type: "image/jpeg",
        aspect_ratio: getAspectRatio(prompt),
        image_size: "1K",
      },
    });

    const response = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-goog-api-key": apiKey,
      },
      body,
    });
    const responseText = await response.text();

    if (!response.ok) {
      if (isRetryableResponse(response.status, responseText) && attempt < MAX_GEMINI_ATTEMPTS) {
        await sleep(attempt * 1500);
        continue;
      }

      throw new Error(`Gemini image generation failed: ${response.status} ${responseText}`);
    }

    const data = JSON.parse(responseText) as GeminiInteractionResponse & GeminiResponse;
    const interactionImage = findInteractionImage(data);
    const parts = data.candidates?.flatMap((candidate) => candidate.content?.parts ?? []) ?? [];
    const imagePart = parts.find((part) => part.inlineData?.data || part.inline_data?.data);
    const base64Image =
      interactionImage?.data ?? imagePart?.inlineData?.data ?? imagePart?.inline_data?.data;
    if (base64Image) {
      return {
        fileName: `${prompt.fileNamePrefix}.jpg`,
        contentType: "image/jpeg",
        bytes: Buffer.from(base64Image, "base64"),
      };
    }

    if (attempt < MAX_GEMINI_ATTEMPTS) {
      await sleep(attempt * 1500);
      continue;
    }

    const textResponse = parts
      .map((part) => part.text)
      .filter(Boolean)
      .join(" ");
    const finishReasons = data.candidates
      ?.map((candidate) => candidate.finishReason)
      .filter(Boolean)
      .join(", ");
    const safetyRatings = data.candidates
      ?.flatMap((candidate) => candidate.safetyRatings ?? [])
      .map((rating) => `${rating.category}:${rating.probability}`)
      .filter(Boolean)
      .join(", ");

    throw new Error(
      [
        "Gemini не вернул изображение.",
        textResponse ? `Response: ${textResponse}` : "",
        finishReasons ? `Finish reason: ${finishReasons}` : "",
        safetyRatings ? `Safety: ${safetyRatings}` : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
  }

  throw new Error("Gemini не вернул изображение.");
}

function normalizeGeminiImageModel(model?: string) {
  const value = model?.trim() || "gemini-3.1-flash-image";

  if (value === "gemini-3.1-flash-image-preview") {
    return "gemini-3.1-flash-image";
  }

  return value;
}

function getAspectRatio(prompt: GeminiStudioPrompt) {
  if (prompt.width && prompt.height && prompt.width > prompt.height) {
    return "4:3";
  }

  if (prompt.width && prompt.height && prompt.height > prompt.width) {
    return "3:4";
  }

  return "1:1";
}

function findInteractionImage(data: GeminiInteractionResponse) {
  const directImages = [data.output_image, data.image, ...(data.images ?? [])];

  for (const image of directImages) {
    if (!image?.data) continue;

    return {
      data: image.data,
      mimeType: image.mime_type ?? image.mimeType ?? "image/jpeg",
    };
  }

  for (const part of data.output ?? []) {
    if (part.data && isImageOutput(part)) {
      return {
        data: part.data,
        mimeType: part.mime_type ?? part.mimeType ?? "image/jpeg",
      };
    }

    if (part.image?.data) {
      return {
        data: part.image.data,
        mimeType: part.image.mime_type ?? part.image.mimeType ?? "image/jpeg",
      };
    }

    if (part.inlineData?.data) {
      return {
        data: part.inlineData.data,
        mimeType: part.inlineData.mimeType ?? "image/jpeg",
      };
    }

    if (part.inline_data?.data) {
      return {
        data: part.inline_data.data,
        mimeType: part.inline_data.mime_type ?? "image/jpeg",
      };
    }
  }

  return findNestedImage(data);
}

function isImageOutput(part: { type?: string; mime_type?: string; mimeType?: string }) {
  const mimeType = part.mime_type ?? part.mimeType ?? "";

  return part.type === "image" || part.type === "output_image" || mimeType.startsWith("image/");
}

function findNestedImage(value: unknown): { data: string; mimeType: string } | null {
  if (!value || typeof value !== "object") return null;

  if (Array.isArray(value)) {
    for (const item of value) {
      const image = findNestedImage(item);
      if (image) return image;
    }

    return null;
  }

  const record = value as Record<string, unknown>;
  const mimeType = getString(record.mime_type) ?? getString(record.mimeType);
  const data = getString(record.data) ?? getString(record.b64_json) ?? getString(record.base64);

  if (data && mimeType?.startsWith("image/")) {
    return { data, mimeType };
  }

  for (const nestedValue of Object.values(record)) {
    const image = findNestedImage(nestedValue);
    if (image) return image;
  }

  return null;
}

function getString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function buildImagePrompt(prompt: GeminiStudioPrompt, attempt: number) {
  const framing =
    prompt.width && prompt.height && prompt.width > prompt.height
      ? "Use a horizontal editorial lifestyle photo frame. Show the environment and body language clearly."
      : "Use a natural editorial lifestyle photo frame. Avoid a passport-style crop.";
  const retryGuidance =
    attempt === 1
      ? "Return exactly one generated image. Do not respond with text only."
      : attempt === 2
        ? "If exact likeness is difficult, prioritize creating a realistic editorial lifestyle photo with strong visual resemblance. Return an image, not text."
        : "Create the safest possible photorealistic editorial lifestyle photo inspired by the reference person's appearance and the scene. Return one image only.";

  return [
    "Use the attached selfie only as a visual reference for face shape, hair, age range and general appearance.",
    "Create a new photorealistic editorial lifestyle photo, like a real DSLR magazine photoshoot.",
    "Do not create a cartoon, CGI render, waxy AI portrait, painted image, avatar, over-sharpened image or plastic skin.",
    "Keep natural skin texture, believable eyes, normal face, realistic hands and realistic body proportions.",
    retryGuidance,
    framing,
    "Follow the requested scene literally. If the scene mentions a desk, laptop, coffee, chair, presentation screen, hands, legs, walking or gesture, those objects and body parts must be visible.",
    "Make the image feel alive: natural off-camera gaze, conversation, movement or active pose when appropriate.",
    `Scene request: ${prompt.prompt}`,
    `Avoid: ${prompt.negativePrompt}`,
  ].join("\n");
}

function isRetryableResponse(status: number, responseText: string) {
  if (RETRYABLE_STATUS_CODES.has(status)) return true;
  if (status === 429) return false;

  return /deadline|unavailable|temporar|try again|overloaded/i.test(responseText);
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
