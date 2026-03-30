import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL,
});

export const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // Limit each IP to 100 requests per windowMs
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});

export const authLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // Limit each IP to 5 login attempts per hour
  message: 'Too many login attempts, please try again later.',
  skipSuccessfulRequests: true,
});

export const createRateLimiter = (options) => {
  if (process.env.NODE_ENV === 'production') {
    return rateLimit({
      store: new RedisStore({
        sendCommand: (...args) => redisClient.sendCommand(args),
      }),
      ...options,
    });
  }
  
  return rateLimit(options);
};