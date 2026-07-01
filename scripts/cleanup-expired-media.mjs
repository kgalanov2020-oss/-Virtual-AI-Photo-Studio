const retentionDays = Number.parseInt(process.env.PHOTO_RETENTION_DAYS ?? "30", 10);
const batchSize = Number.parseInt(process.env.CLEANUP_BATCH_SIZE ?? "500", 10);
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY before running cleanup.");
}

if (!Number.isFinite(retentionDays) || retentionDays < 1) {
  throw new Error("PHOTO_RETENTION_DAYS must be a positive number.");
}

if (!Number.isFinite(batchSize) || batchSize < 1 || batchSize > 1000) {
  throw new Error("CLEANUP_BATCH_SIZE must be a number from 1 to 1000.");
}

const baseUrl = supabaseUrl.replace(/\/$/, "");
const restUrl = `${baseUrl}/rest/v1`;
const storageUrl = `${baseUrl}/storage/v1`;
const cutoff = new Date(Date.now() - retentionDays * 24 * 60 * 60 * 1000).toISOString();

const jsonHeaders = {
  apikey: serviceRoleKey,
  authorization: `Bearer ${serviceRoleKey}`,
  "content-type": "application/json",
};

console.log(`Cleaning uploaded and generated photos older than ${cutoff}.`);

const selfiesResult = await cleanupTable({
  table: "uploaded_selfies",
  select: "id,file_url",
  bucket: "selfies",
  getPath: (row) => row.file_url,
});

const generatedResult = await cleanupTable({
  table: "generated_images",
  select: "id,image_url",
  bucket: "generated",
  getPath: (row) => getGeneratedStoragePath(row.image_url),
});

console.log(
  JSON.stringify(
    {
      ok: true,
      retentionDays,
      cutoff,
      selfies: selfiesResult,
      generatedImages: generatedResult,
    },
    null,
    2,
  ),
);

async function cleanupTable({ table, select, bucket, getPath }) {
  let deletedRows = 0;
  let deletedFiles = 0;

  while (true) {
    const rows = await fetchExpiredRows(table, select);

    if (rows.length === 0) {
      break;
    }

    const paths = rows.map(getPath).filter(Boolean);

    if (paths.length > 0) {
      await removeStorageObjects(bucket, paths);
      deletedFiles += paths.length;
    }

    await deleteRows(table, rows.map((row) => row.id));
    deletedRows += rows.length;
    console.log(`Deleted ${rows.length} expired rows from ${table}.`);
  }

  return { deletedRows, deletedFiles };
}

async function fetchExpiredRows(table, select) {
  const url = new URL(`${restUrl}/${table}`);
  url.searchParams.set("select", select);
  url.searchParams.set("created_at", `lt.${cutoff}`);
  url.searchParams.set("order", "created_at.asc");
  url.searchParams.set("limit", String(batchSize));

  const response = await fetch(url, {
    headers: jsonHeaders,
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch expired rows from ${table}: ${await response.text()}`);
  }

  return response.json();
}

async function removeStorageObjects(bucket, paths) {
  const response = await fetch(`${storageUrl}/object/${bucket}`, {
    method: "DELETE",
    headers: jsonHeaders,
    body: JSON.stringify({ prefixes: paths }),
  });

  if (!response.ok) {
    throw new Error(`Failed to remove files from ${bucket}: ${await response.text()}`);
  }
}

async function deleteRows(table, ids) {
  if (ids.length === 0) {
    return;
  }

  const url = new URL(`${restUrl}/${table}`);
  url.searchParams.set("id", `in.(${ids.join(",")})`);

  const response = await fetch(url, {
    method: "DELETE",
    headers: {
      ...jsonHeaders,
      prefer: "return=minimal",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to delete expired rows from ${table}: ${await response.text()}`);
  }
}

function getGeneratedStoragePath(url) {
  if (!url) {
    return null;
  }

  const marker = "/storage/v1/object/public/generated/";
  const index = url.indexOf(marker);

  if (index === -1) {
    return null;
  }

  return decodeURIComponent(url.slice(index + marker.length).split("?")[0] ?? "");
}
