export const jwtConfig = {
  secret: process.env.JWT_SECRET || 'your-secret-key',
  expiresIn: '24h',
  refreshExpiresIn: '7d',
};

export const bcryptConfig = {
  saltRounds: 10,
};