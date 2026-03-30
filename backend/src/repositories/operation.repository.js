import prisma from '../config/database.js';
import { BaseRepository } from './base.repository.js';

export class OperationRepository extends BaseRepository {
  constructor() {
    super(prisma.dailyOperation);
  }

  async findByVehicleAndDate(vehicleId, date) {
    return this.model.findUnique({
      where: {
        vehicleId_operationDate: {
          vehicleId,
          operationDate: date,
        },
      },
    });
  }

  async getVehiclePerformance(vehicleId, startDate, endDate) {
    const operations = await this.model.findMany({
      where: {
        vehicleId,
        operationDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      orderBy: {
        operationDate: 'asc',
      },
    });

    const totalIncome = operations.reduce((sum, op) => sum + op.income, 0);
    const totalDistance = operations.reduce((sum, op) => sum + op.distanceCovered, 0);
    
    return {
      operations,
      totalIncome,
      totalDistance,
      averageIncomePerDay: totalIncome / operations.length || 0,
      averageDistancePerDay: totalDistance / operations.length || 0,
    };
  }

  async getRevenueBySubsidiary(startDate, endDate) {
    return this.model.groupBy({
      by: ['vehicleId'],
      where: {
        operationDate: {
          gte: startDate,
          lte: endDate,
        },
      },
      _sum: {
        income: true,
        distanceCovered: true,
      },
      _count: true,
    });
  }
}