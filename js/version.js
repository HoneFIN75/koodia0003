function getVersionMetadataUrl(locationObject = window.location) {
  // Relative URL keeps the request under the same static hosting base path (also when app is served from a subpath).
  const metadataUrl = new URL('./version.json', locationObject.href);
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
  locationObject = globalThis.window?.location,
} = {}) {
  if (typeof fetchImpl !== 'function' || !locationObject?.href) {
    return null;
  }

  try {
    const response = await fetchImpl(getVersionMetadataUrl(locationObject), { cache: 'no-store' });
    if (!response.ok) {
      return null;
    }

    return normalizeVersionMetadata(await response.json());
  } catch {
    return null;
  }
}
