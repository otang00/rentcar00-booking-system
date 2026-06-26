#!/usr/bin/env node
// `public.cars.image_url` 의 현재 값을 원문 주소로 보고 내려받아 Supabase Storage 로 미러링한다.
// 추가 차량 반영 뒤 다시 필요할 때만 수동 실행한다. 자세한 사용법은 docs/references/CAR_IMAGE_MIRROR_SCRIPT.md 참고.
const path = require('path');
const { getSupabaseAdmin, hasSupabaseConfig, resolveSupabaseUrl } = require('./ims-sync/lib/supabase-admin');

const BUCKET = process.env.CAR_IMAGE_BUCKET || 'car-images';
const PREFIX = process.env.CAR_IMAGE_PREFIX || 'cars';
const LIMIT = Number(process.env.CAR_IMAGE_MIRROR_LIMIT || 0);
const FORCE = process.env.CAR_IMAGE_MIRROR_FORCE === 'true';
const DRY_RUN = process.env.CAR_IMAGE_MIRROR_DRY_RUN === 'true';

function isSupabaseStorageUrl(url = '') {
  return /\/storage\/v1\/object\/public\//.test(String(url));
}

function sanitizeFileName(value) {
  return String(value || '')
    .trim()
    .replace(/[^a-zA-Z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '') || 'car';
}

function inferExtension({ contentType = '', url = '' } = {}) {
  const type = String(contentType).toLowerCase();
  if (type.includes('png')) return 'png';
  if (type.includes('webp')) return 'webp';
  if (type.includes('gif')) return 'gif';
  if (type.includes('jpeg') || type.includes('jpg')) return 'jpg';

  try {
    const pathname = new URL(url).pathname;
    const ext = path.extname(pathname).replace('.', '').toLowerCase();
    if (ext) return ext;
  } catch (_) {}

  return 'jpg';
}

async function ensureBucket(supabase) {
  const { data, error } = await supabase.storage.listBuckets();
  if (error) throw error;

  const existing = (data || []).find((bucket) => bucket.name === BUCKET || bucket.id === BUCKET);
  if (existing) return existing;

  const { data: created, error: createError } = await supabase.storage.createBucket(BUCKET, {
    public: true,
    fileSizeLimit: '10MB',
  });
  if (createError) throw createError;
  return created;
}

async function fetchCarsToMirror(supabase) {
  const { data, error } = await supabase
    .from('cars')
    .select('id,source_car_id,car_number,image_url,metadata')
    .not('image_url', 'is', null)
    .order('source_car_id', { ascending: true });

  if (error) throw error;

  let rows = (data || []).filter((row) => String(row.image_url || '').trim());
  if (!FORCE) {
    rows = rows.filter((row) => !isSupabaseStorageUrl(row.image_url));
  }
  if (LIMIT > 0) {
    rows = rows.slice(0, LIMIT);
  }
  return rows;
}

async function downloadImage(url) {
  const response = await fetch(url, {
    headers: {
      'User-Agent': 'rentcar00-booking-system/car-image-mirror',
      Accept: 'image/*,*/*;q=0.8',
    },
  });

  if (!response.ok) {
    throw new Error(`download failed: HTTP ${response.status}`);
  }

  const arrayBuffer = await response.arrayBuffer();
  const contentType = response.headers.get('content-type') || 'application/octet-stream';
  return {
    buffer: Buffer.from(arrayBuffer),
    contentType,
  };
}

async function uploadImage(supabase, row, blob) {
  const ext = inferExtension({ contentType: blob.contentType, url: row.image_url });
  const safeCarNumber = sanitizeFileName(row.car_number);
  const objectPath = `${PREFIX}/${row.source_car_id}/${safeCarNumber}.${ext}`;

  if (DRY_RUN) {
    return {
      objectPath,
      publicUrl: `${resolveSupabaseUrl()}/storage/v1/object/public/${BUCKET}/${objectPath}`,
    };
  }

  const { error } = await supabase.storage
    .from(BUCKET)
    .upload(objectPath, blob.buffer, {
      contentType: blob.contentType,
      upsert: true,
      cacheControl: '31536000',
    });

  if (error) throw error;

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(objectPath);
  return {
    objectPath,
    publicUrl: data.publicUrl,
  };
}

async function updateCarImage(supabase, row, uploadResult) {
  const metadata = {
    ...(row.metadata || {}),
    image_mirror: {
      mirrored_at: new Date().toISOString(),
      bucket: BUCKET,
      object_path: uploadResult.objectPath,
    },
  };

  if (DRY_RUN) return;

  const { error } = await supabase
    .from('cars')
    .update({
      image_url: uploadResult.publicUrl,
      metadata,
    })
    .eq('id', row.id);

  if (error) throw error;
}

async function main() {
  if (!hasSupabaseConfig()) {
    throw new Error('SUPABASE_URL or SUPABASE_PROJECT_REF and SUPABASE_SERVICE_ROLE_KEY are required');
  }

  const supabase = getSupabaseAdmin();
  await ensureBucket(supabase);
  const rows = await fetchCarsToMirror(supabase);

  const summary = {
    bucket: BUCKET,
    prefix: PREFIX,
    dryRun: DRY_RUN,
    force: FORCE,
    targetCount: rows.length,
    mirroredCount: 0,
    failedCount: 0,
    failures: [],
  };

  for (const row of rows) {
    try {
      const blob = await downloadImage(row.image_url);
      const uploadResult = await uploadImage(supabase, row, blob);
      await updateCarImage(supabase, row, uploadResult);
      summary.mirroredCount += 1;
      console.log(`[mirror] ok source_car_id=${row.source_car_id} -> ${uploadResult.objectPath}`);
    } catch (error) {
      summary.failedCount += 1;
      summary.failures.push({
        source_car_id: row.source_car_id,
        image_url: row.image_url,
        error: error.message,
      });
      console.error(`[mirror] fail source_car_id=${row.source_car_id}: ${error.message}`);
    }
  }

  console.log(JSON.stringify(summary, null, 2));

  if (summary.failedCount > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error('[mirror-car-images] failed');
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
