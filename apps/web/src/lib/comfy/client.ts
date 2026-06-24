import businessWorkflow from "./workflows/instantid_business_workflow_api.json";

type ComfyImageOutput = {
  filename: string;
  subfolder?: string;
  type?: string;
};

type ComfyHistory = {
  outputs?: Record<string, { images?: ComfyImageOutput[] }>;
};

type StudioPrompt = {
  prompt: string;
  negativePrompt: string;
  fileNamePrefix: string;
};

export async function generateBusinessPortrait(inputImage: Blob, prompt: StudioPrompt) {
  const comfyUrl = getComfyUrl();
  const inputName = await uploadImageToComfy(comfyUrl, inputImage);
  const workflow = buildWorkflow(inputName, prompt);
  const history = await runComfyWorkflow(comfyUrl, workflow);
  return downloadFirstComfyImage(comfyUrl, history);
}

function getComfyUrl() {
  const comfyUrl = process.env.COMFY_URL?.replace(/\/$/, "");

  if (!comfyUrl) {
    throw new Error("COMFY_URL is not configured.");
  }

  return comfyUrl;
}

async function uploadImageToComfy(comfyUrl: string, inputImage: Blob) {
  const formData = new FormData();
  formData.append("image", inputImage, `selfie-${Date.now()}.jpg`);

  const response = await fetch(`${comfyUrl}/upload/image`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error(`Comfy upload failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { name?: string };

  if (!data.name) {
    throw new Error("Comfy upload did not return an image name.");
  }

  return data.name;
}

async function runComfyWorkflow(comfyUrl: string, workflow: Record<string, unknown>) {
  const response = await fetch(`${comfyUrl}/prompt`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: workflow,
      client_id: crypto.randomUUID(),
    }),
  });

  if (!response.ok) {
    throw new Error(`Comfy prompt failed: ${response.status} ${await response.text()}`);
  }

  const data = (await response.json()) as { prompt_id?: string };

  if (!data.prompt_id) {
    throw new Error("Comfy did not return prompt_id.");
  }

  for (let attempt = 0; attempt < 120; attempt += 1) {
    await sleep(2000);

    const historyResponse = await fetch(`${comfyUrl}/history/${data.prompt_id}`, {
      cache: "no-store",
    });

    if (!historyResponse.ok) {
      continue;
    }

    const historyData = (await historyResponse.json()) as Record<string, ComfyHistory>;
    const history = historyData[data.prompt_id];

    if (history) {
      return history;
    }
  }

  throw new Error("Comfy workflow timed out.");
}

async function downloadFirstComfyImage(comfyUrl: string, history: ComfyHistory) {
  const outputs = history.outputs ?? {};

  for (const output of Object.values(outputs)) {
    const image = output.images?.[0];

    if (!image) continue;

    const imageUrl = new URL(`${comfyUrl}/view`);
    imageUrl.searchParams.set("filename", image.filename);
    imageUrl.searchParams.set("subfolder", image.subfolder ?? "");
    imageUrl.searchParams.set("type", image.type ?? "output");

    const response = await fetch(imageUrl);

    if (!response.ok) {
      throw new Error(`Failed to download image from Comfy: ${response.status}`);
    }

    return {
      fileName: image.filename,
      contentType: response.headers.get("content-type") ?? "image/png",
      bytes: Buffer.from(await response.arrayBuffer()),
    };
  }

  throw new Error("Comfy history has no image output.");
}

function buildWorkflow(inputName: string, prompt: StudioPrompt) {
  const workflow = structuredClone(businessWorkflow) as Record<
    string,
    { inputs: Record<string, unknown> }
  >;

  workflow["13"].inputs.image = inputName;
  workflow["2"].inputs.text = prompt.prompt;
  workflow["3"].inputs.text = prompt.negativePrompt;
  workflow["5"].inputs.seed = Math.floor(Date.now() / 1000);
  workflow["7"].inputs.filename_prefix = prompt.fileNamePrefix;

  return workflow;
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
