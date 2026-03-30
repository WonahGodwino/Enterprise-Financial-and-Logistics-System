import crypto from 'crypto';
import Redis from 'ioredis';

class CacheMiddleware {
  constructor() {
    this.defaultTTL = 300;
    this.enabled = false;
    this.redis = null;
    this.redisConfigured = process.env.CACHE_ENABLED !== 'false';
    this.redisDisabledReason = null;
    this.hasLoggedDisable = false;
    this.lastRedisErrorLogAt = 0;
    this.redisErrorLogIntervalMs = 60000;

    if (!this.redisConfigured) {
      this.redisDisabledReason = 'Cache disabled via CACHE_ENABLED=false';
      return;
    }

    const redisUrl = process.env.REDIS_URL;
    const redisOptions = redisUrl
      ? {
          url: redisUrl,
          password: process.env.REDIS_PASSWORD,
          retryStrategy: (times) => (times <= 3 ? Math.min(times * 200, 1000) : null),
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          connectTimeout: 2000,
        }
      : {
          host: process.env.REDIS_HOST || 'localhost',
          port: Number(process.env.REDIS_PORT || 6379),
          password: process.env.REDIS_PASSWORD,
          retryStrategy: (times) => (times <= 3 ? Math.min(times * 200, 1000) : null),
          maxRetriesPerRequest: 1,
          enableOfflineQueue: false,
          connectTimeout: 2000,
        };

    this.redis = new Redis(redisOptions);

    this.redis.on('error', (err) => {
      this.logRedisError(err);
      this.disableRedis(`Redis unavailable (${err?.code || 'connection error'})`);
    });

    this.redis.on('ready', () => {
      this.enabled = true;
      this.redisDisabledReason = null;
      this.hasLoggedDisable = false;
    });

    this.redis.on('close', () => {
      this.enabled = false;
    });
  }

  disableRedis(reason) {
    this.enabled = false;
    this.redisDisabledReason = reason;

    if (!this.hasLoggedDisable) {
      console.warn(`Cache disabled: ${reason}. Requests will continue without cache.`);
      this.hasLoggedDisable = true;
    }

    if (this.redis) {
      this.redis.removeAllListeners();
      this.redis.disconnect();
      this.redis = null;
    }
  }

  logRedisError(err) {
    const now = Date.now();
    if (now - this.lastRedisErrorLogAt >= this.redisErrorLogIntervalMs) {
      const nestedError = Array.isArray(err?.errors) && err.errors.length > 0 ? err.errors[0] : null;
      const errorCode = err?.code || nestedError?.code || 'REDIS_ERROR';
      const errorAddress = nestedError?.address;
      const errorPort = nestedError?.port;
      const location = errorAddress && errorPort ? ` ${errorAddress}:${errorPort}` : '';
      const errorMessage = err?.message || nestedError?.message || String(err);

      console.error(`Redis cache error [${errorCode}]${location}: ${errorMessage}`);
      this.lastRedisErrorLogAt = now;
    }
  }

  generateKey(req) {
    const payload = {
      method: req.method,
      path: req.baseUrl ? `${req.baseUrl}${req.path}` : req.path,
      query: req.query,
      params: req.params,
      user: req.user?.id || 'anonymous',
    };

    const hash = crypto
      .createHash('sha256')
      .update(JSON.stringify(payload))
      .digest('hex');

    return `cache:${hash}`;
  }

  cache(options = {}) {
    const {
      ttl = this.defaultTTL,
      keyGenerator = (req) => this.generateKey(req),
      condition = (req) => req.method === 'GET',
      tags = [],
    } = options;

    return async (req, res, next) => {
      if (!this.enabled || !this.redis || !condition(req)) {
        return next();
      }

      const key = keyGenerator(req);

      try {
        const cached = await this.redis.get(key);
        if (cached) {
          const data = JSON.parse(cached);
          return res.json({
            ...data,
            _cached: true,
          });
        }

        const originalJson = res.json.bind(res);

        res.json = (body) => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            const responseBody = {
              ...body,
              _cachedAt: new Date().toISOString(),
            };

            const resolvedTags = typeof tags === 'function' ? tags(req, responseBody) : tags;
            const normalizedTags = Array.isArray(resolvedTags)
              ? resolvedTags.filter(Boolean).map((tag) => String(tag).trim())
              : [];

            this.redis
              .setex(key, ttl, JSON.stringify(responseBody))
              .catch((err) => console.error('Cache set error:', err?.message || err));

            if (normalizedTags.length > 0) {
              normalizedTags.forEach((tag) => {
                const tagKey = `cache:tag:${tag}`;
                this.redis
                  .multi()
                  .sadd(tagKey, key)
                  .expire(tagKey, Math.max(ttl * 4, 300))
                  .exec()
                  .catch((err) => console.error('Cache tag index error:', err?.message || err));
              });
            }

            return originalJson(responseBody);
          }

          return originalJson(body);
        };

        return next();
      } catch (error) {
        console.error('Cache middleware error:', error?.message || error);
        return next();
      }
    };
  }

  async clearPattern(pattern) {
    if (!this.enabled || !this.redis) return;

    try {
      const keys = await this.redis.keys(pattern);
      if (keys.length > 0) {
        await this.redis.del(keys);
      }
    } catch (error) {
      console.error('Cache clear error:', error?.message || error);
    }
  }

  async clearUserCache(userId) {
    await this.clearPattern(`cache:*${userId}*`);
  }

  async invalidateTags(tags = []) {
    if (!this.enabled || !this.redis) return;

    const normalizedTags = Array.isArray(tags)
      ? tags.filter(Boolean).map((tag) => String(tag).trim())
      : [];

    if (normalizedTags.length === 0) return;

    try {
      for (const tag of normalizedTags) {
        const tagKey = `cache:tag:${tag}`;
        const keys = await this.redis.smembers(tagKey);

        if (keys.length > 0) {
          await this.redis.del(...keys);
        }

        await this.redis.del(tagKey);
      }
    } catch (error) {
      console.error('Cache invalidate tags error:', error?.message || error);
    }
  }

  async clearAll() {
    await this.clearPattern('cache:*');
  }

  async getStats() {
    if (!this.redis) {
      return {
        totalKeys: 0,
        enabled: false,
        reason: this.redisDisabledReason,
      };
    }

    try {
      const keys = await this.redis.keys('cache:*');
      const info = await this.redis.info('memory');

      return {
        totalKeys: keys.length,
        memory: info,
        enabled: this.enabled,
      };
    } catch (error) {
      return {
        totalKeys: 0,
        enabled: this.enabled,
        error: error.message,
      };
    }
  }
}

export const cacheManager = new CacheMiddleware();

export const cacheMiddleware = (ttl = 300, options = {}) =>
  cacheManager.cache({ ...options, ttl });

export default cacheManager;
