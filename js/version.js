const metadataRequestCache = new Map();

function getVersionMetadataUrl(moduleUrl = import.meta.url) {
  // Resolve relative to this module so static hosting base paths work independently of the current page URL format.
  const metadataUrl = new URL('../version.json', moduleUrl);
  // Query parameter avoids stale cached metadata after a new deploy.
  metadataUrl.searchParams.set('v', String(Date.now()));
  return metadataUrl;
}

function normalizeVersionMetadata(payload) {
  if (!payload || typeof payload !== 'object') {
    return null;
  }

  const version = typeof payload.version === 'string' ? payload.version.trim() : '';
  const deployedAt = typeof payload.deployedAt === 'string' ? payload.deployedAt.trim() : '';
  const commit = typeof payload.commit === 'string' ? payload.commit.trim() : '';

  if (!version || !deployedAt) {
    return null;
  }

  return {
    version,
    deployedAt,
    commit,
  };
}

export async function loadDeploymentMetadata({
  fetchImpl = globalThis.fetch,
  moduleUrl = import.meta.url,
} = {}) {
  if (typeof fetchImpl !== 'function') {
    return null;
  }

  const cacheKey = String(moduleUrl);
  if (!metadataRequestCache.has(cacheKey)) {
    const requestPromise = (async () => {
      const response = await fetchImpl(getVersionMetadataUrl(moduleUrl), { cache: 'no-store' });
      if (!response.ok) {
        return null;
      }

      return normalizeVersionMetadata(await response.json());
    })().catch(() => null);

    metadataRequestCache.set(cacheKey, requestPromise);
  }

  try {
    const metadata = await metadataRequestCache.get(cacheKey);
    if (!metadata) {
      return null;
    }

    return metadata;
  } catch {
    return null;
  }
}
