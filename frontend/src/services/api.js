import axios from 'axios';

const apiHost = import.meta.env.DEV ? window.location.hostname : '';
const apiBaseUrl = import.meta.env.DEV ? `http://${apiHost}:5000/api` : '/api';

const api = axios.create({
  baseURL: apiBaseUrl,
});

const GET_CACHE_TTL_MS = 2 * 60 * 1000;
const apiCache = new Map();

const stableStringify = (value) => {
  if (!value || typeof value !== 'object') {
    return String(value ?? '');
  }

  if (Array.isArray(value)) {
    return `[${value.map(stableStringify).join(',')}]`;
  }

  return `{${Object.keys(value)
    .sort()
    .map((key) => `${key}:${stableStringify(value[key])}`)
    .join(',')}}`;
};

const getCacheKey = (config) => {
  const method = (config.method || 'get').toLowerCase();
  const params = stableStringify(config.params);
  return `${method}:${config.baseURL || ''}:${config.url || ''}:${params}`;
};

const readCachedResponse = (key) => {
  const memoryHit = apiCache.get(key);
  if (memoryHit && Date.now() - memoryHit.createdAt < GET_CACHE_TTL_MS) {
    return memoryHit.data;
  }

  if (memoryHit) {
    apiCache.delete(key);
  }

  try {
    const stored = sessionStorage.getItem(`api-cache:${key}`);
    if (!stored) return null;

    const parsed = JSON.parse(stored);
    if (Date.now() - parsed.createdAt >= GET_CACHE_TTL_MS) {
      sessionStorage.removeItem(`api-cache:${key}`);
      return null;
    }

    apiCache.set(key, parsed);
    return parsed.data;
  } catch {
    return null;
  }
};

const writeCachedResponse = (key, data) => {
  const entry = { createdAt: Date.now(), data };
  apiCache.set(key, entry);

  try {
    sessionStorage.setItem(`api-cache:${key}`, JSON.stringify(entry));
  } catch {
    // Storage can fail on quota/private-mode; in-memory cache still works.
  }
};

const clearGetCache = () => {
  apiCache.clear();

  try {
    Object.keys(sessionStorage)
      .filter((key) => key.startsWith('api-cache:'))
      .forEach((key) => sessionStorage.removeItem(key));
  } catch {
    // Ignore storage access failures.
  }
};

// Interceptor to inject bearer auth token
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('alight_token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }

    if ((config.method || 'get').toLowerCase() === 'get' && config.cache !== false) {
      const cacheKey = getCacheKey(config);
      const cachedData = readCachedResponse(cacheKey);

      config.metadata = { ...(config.metadata || {}), cacheKey };

      if (cachedData) {
        config.adapter = () =>
          Promise.resolve({
            data: cachedData,
            status: 200,
            statusText: 'OK',
            headers: { 'x-cache': 'frontend' },
            config,
            request: null,
          });
      }
    }

    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Redirect to login only when a session is missing, invalid, or expired.
api.interceptors.response.use(
  (response) => {
    const method = (response.config.method || 'get').toLowerCase();

    if (method === 'get' && response.config.metadata?.cacheKey && response.headers?.['x-cache'] !== 'frontend') {
      writeCachedResponse(response.config.metadata.cacheKey, response.data);
    }

    if (method !== 'get') {
      clearGetCache();
    }

    return response;
  },
  (error) => {
    if (error.response && error.response.status === 401) {
      localStorage.removeItem('alight_token');
      localStorage.removeItem('alight_user');
      clearGetCache();

      if (!window.location.pathname.endsWith('/login')) {
        window.location.replace('/login');
      }
    }
    return Promise.reject(error);
  }
);

export default api;
