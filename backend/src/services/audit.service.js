import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export class AuditService {
  constructor() {}

  async log({ userId, action, entity, entityId, oldValue = null, newValue = null, details = null, ipAddress = null, userAgent = null }) {
    try {
      await prisma.auditLog.create({
        data: {
          userId: userId || null,
          action: action || 'UNKNOWN',
          entity: entity || null,
          entityId: entityId || null,
          oldValue: oldValue ? JSON.stringify(oldValue) : null,
          newValue: newValue ? JSON.stringify(newValue) : null,
          ipAddress: ipAddress || null,
          userAgent: userAgent || null,
        }
      });
    } catch (error) {
      // Don't let audit failures break primary flow; log for debugging
      console.error('AuditService.log error:', error?.message || error);
    }
  }
}

// default export an instance for files that import the default
export default new AuditService();
