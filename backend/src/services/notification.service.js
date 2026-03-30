import prisma from '../config/database.js';

export class NotificationService {
  constructor() {}

  async sendAlert(payload) {
    try {
      console.log('NotificationService: sendAlert', payload?.type || 'ALERT', payload?.message || payload);
      return true;
    } catch (err) {
      console.error('NotificationService.sendAlert error', err?.message || err);
      return false;
    }
  }

  async sendHighValueAlert(expense) {
    try {
      // Placeholder: integrate with real notification system (email, slack, etc.)
      console.log('NotificationService: high value alert for expense', expense.id);
      return true;
    } catch (err) {
      console.error('NotificationService.sendHighValueAlert error', err?.message || err);
      return false;
    }
  }

  async sendExpenseUpdate(userId, payload) {
    try {
      const notification = {
        title: payload?.title || 'Expense Notification',
        message: payload?.message || payload?.reason || 'There is an update on an expense record.',
        type: payload?.type || 'EXPENSE_UPDATE',
        category: payload?.category || 'expense',
        read: false,
        data: {
          expenseId: payload?.expenseId || null,
          amount: payload?.amount ?? null,
          item: payload?.item || null,
          completedBy: payload?.completedBy || null,
          approvedBy: payload?.approvedBy || null,
          rejectedBy: payload?.rejectedBy || null,
          requestedBy: payload?.requestedBy || null,
          reason: payload?.reason || null,
        },
      };

      if (userId) {
        await prisma.auditLog.create({
          data: {
            userId,
            action: 'NOTIFICATION',
            entity: 'NOTIFICATION',
            entityId: payload?.expenseId || null,
            newValue: notification,
          },
        });
      }

      console.log('NotificationService: sendExpenseUpdate', userId, notification.type);
      return true;
    } catch (err) {
      console.error('NotificationService.sendExpenseUpdate error', err?.message || err);
      return false;
    }
  }

  async sendIncomeModificationRequest(recipientRoles, payload) {
    try {
      console.log('NotificationService: sendIncomeModificationRequest', recipientRoles, payload);
      return true;
    } catch (err) {
      console.error('NotificationService.sendIncomeModificationRequest error', err?.message || err);
      return false;
    }
  }

  async sendExpenseModificationRequest(recipientRoles, payload) {
    try {
      const roles = Array.isArray(recipientRoles) ? recipientRoles : [recipientRoles];
      const recipients = await prisma.user.findMany({
        where: { isActive: true, role: { in: roles } },
        select: { id: true },
      });

      const item = payload?.item || payload?.expenseCategory || 'an expense';
      const requester = payload?.requestedBy || 'A user';
      const amountFormatted = payload?.amount != null
        ? `NGN ${Number(payload.amount).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
        : null;

      const message = amountFormatted
        ? `${requester} has requested to modify ${item} (${amountFormatted}). Reason: ${payload?.reason || 'No reason provided.'}`
        : `${requester} has submitted a modification request for ${item}. Reason: ${payload?.reason || 'No reason provided.'}`;

      await Promise.all(recipients.map((person) =>
        this.sendExpenseUpdate(person.id, {
          title: 'Expense Modification Request',
          message,
          type: 'EXPENSE_MODIFICATION_REQUEST',
          category: 'expense',
          expenseId: payload?.expenseId || null,
          item,
          reason: payload?.reason || null,
          requestedBy: requester,
        })
      ));

      console.log(`NotificationService: sendExpenseModificationRequest → notified ${recipients.length} recipient(s)`);
      return true;
    } catch (err) {
      console.error('NotificationService.sendExpenseModificationRequest error', err?.message || err);
      return false;
    }
  }

  async sendExpenseCompletedWithoutReceiptAlert({ expense, completedBy }) {
    try {
      const expenseItem = expense?.description || expense?.details || expense?.expenseCategory || 'unspecified expense';
      const amount = Number(expense?.amount || 0).toLocaleString('en-NG', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      });

      const actorName = completedBy?.fullName || completedBy?.email || 'Unknown user';

      const audience = await prisma.user.findMany({
        where: {
          isActive: true,
          OR: [
            { id: expense?.createdById || '' },
            { role: { in: ['CEO', 'SUPER_ADMIN'] } },
          ],
        },
        select: {
          id: true,
          fullName: true,
          email: true,
          role: true,
        },
      });

      const recipients = Array.from(
        new Map([
          ...audience.map((person) => [person.id, person]),
          ...(completedBy?.id
            ? [[completedBy.id, {
              id: completedBy.id,
              fullName: completedBy.fullName,
              email: completedBy.email,
              role: completedBy.role,
            }]]
            : []),
        ]).values()
      );

      const broadcastMessage = `User ${actorName} has completed an expense of NGN ${amount} for ${expenseItem} without receipt.`;
      const actorMessage = `You have close an expenses of NGN ${amount} for ${expenseItem} without receipt.`;

      await Promise.all(recipients.map((person) => this.sendExpenseUpdate(person.id, {
        type: 'EXPENSE_COMPLETED_WITHOUT_RECEIPT',
        expenseId: expense?.id,
        message: person.id === completedBy?.id ? actorMessage : broadcastMessage,
        amount: expense?.amount,
        item: expenseItem,
        completedBy: actorName,
      })));

      await prisma.auditLog.create({
        data: {
          userId: completedBy?.id || null,
          action: 'EXPENSE_COMPLETED_WITHOUT_RECEIPT_ALERT',
          entity: 'EXPENSE',
          entityId: expense?.id || null,
          newValue: {
            type: 'EXPENSE_COMPLETED_WITHOUT_RECEIPT',
            recipients: recipients.map((person) => ({
              id: person.id,
              role: person.role,
              fullName: person.fullName,
            })),
            message: broadcastMessage,
            actorMessage,
            amount: expense?.amount,
            item: expenseItem,
          },
        },
      });

      console.log('NotificationService: sendExpenseCompletedWithoutReceiptAlert', {
        expenseId: expense?.id,
        recipients: recipients.length,
      });

      return true;
    } catch (err) {
      console.error('NotificationService.sendExpenseCompletedWithoutReceiptAlert error', err?.message || err);
      return false;
    }
  }

  /**
   * Send a vehicle status workflow notification to one or more users.
   * @param {string|string[]} userIds – single userId or array
   * @param {object} payload – notification payload
   */
  async sendVehicleStatusNotification(userIds, payload) {
    try {
      const ids = Array.isArray(userIds) ? userIds : [userIds];
      const notification = {
        title: payload?.title || 'Vehicle Status Update',
        message: payload?.message || 'There is an update on a vehicle status request.',
        type: payload?.type || 'VEHICLE_STATUS_UPDATE',
        category: 'vehicle',
        read: false,
        data: {
          requestId: payload?.requestId || null,
          vehicleId: payload?.vehicleId || null,
          vehicleReg: payload?.vehicleReg || null,
          targetStatus: payload?.targetStatus || null,
          requestedBy: payload?.requestedBy || null,
          reviewedBy: payload?.reviewedBy || null,
          reason: payload?.reason || null,
        },
      };

      await Promise.all(
        ids.filter(Boolean).map((uid) =>
          prisma.auditLog.create({
            data: {
              userId: uid,
              action: 'NOTIFICATION',
              entity: 'NOTIFICATION',
              entityId: payload?.requestId || null,
              newValue: notification,
            },
          })
        )
      );

      console.log(`NotificationService: sendVehicleStatusNotification → ${ids.length} recipient(s)`);
      return true;
    } catch (err) {
      console.error('NotificationService.sendVehicleStatusNotification error', err?.message || err);
      return false;
    }
  }

  async sendLargeExpenseWithoutReceiptAlert(expense, actor) {
    try {
      const recipients = await prisma.$queryRaw`
        SELECT id, "fullName", email, role::text as role
        FROM "User"
        WHERE role::text IN ('CEO', 'SUPER_ADMIN')
          AND "isActive" = true
      `;

      const actorName = actor?.fullName || actor?.email || actor?.id || 'Unknown User';
      const expenseDate = expense?.expenseDate ? new Date(expense.expenseDate).toISOString().slice(0, 10) : null;

      const payload = {
        type: 'LARGE_EXPENSE_NO_RECEIPT',
        message: 'Large expense was submitted without a receipt',
        recipients,
        details: {
          expenseId: expense?.id,
          amount: expense?.amount,
          expenseType: expense?.expenseType,
          expenseCategory: expense?.expenseCategory,
          description: expense?.description || expense?.details || null,
          enteredBy: actorName,
          enteredById: actor?.id || null,
          expenseDate,
          createdAt: expense?.createdAt || new Date().toISOString(),
        },
      };

      await prisma.auditLog.create({
        data: {
          userId: actor?.id || null,
          action: 'LARGE_EXPENSE_WITHOUT_RECEIPT_ALERT',
          entity: 'EXPENSE',
          entityId: expense?.id || null,
          newValue: payload,
        },
      });

      console.log('NotificationService: large expense without receipt alert', payload);
      return true;
    } catch (err) {
      console.error('NotificationService.sendLargeExpenseWithoutReceiptAlert error', err?.message || err);
      return false;
    }
  }
}

export default new NotificationService();
