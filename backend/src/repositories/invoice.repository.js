import prisma from '../config/database.js';
import { BaseRepository } from './base.repository.js';

export class InvoiceRepository extends BaseRepository {
  constructor() {
    super(prisma.invoice);
  }

  async findByInvoiceNumber(invoiceNumber, include = {}) {
    return this.model.findUnique({
      where: { invoiceNumber },
      include,
    });
  }

  async createWithItems(data) {
    return this.model.create({
      data,
      include: {
        customer: true,
        subsidiary: true,
        items: true,
      },
    });
  }
}
