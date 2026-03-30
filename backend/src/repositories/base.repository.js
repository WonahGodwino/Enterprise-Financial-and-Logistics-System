import prisma from '../config/database.js';

export class BaseRepository {
  constructor(model) {
    this.model = model;
    this.prisma = prisma;
  }

  async findById(id, include = {}) {
    return this.model.findUnique({
      where: { id },
      include,
    });
  }

  async findMany(where = {}, include = {}, orderBy = {}, skip = 0, take = 10) {
    return this.model.findMany({
      where,
      include,
      orderBy,
      skip,
      take,
    });
  }

  async create(data) {
    return this.model.create({ data });
  }

  async update(id, data) {
    return this.model.update({
      where: { id },
      data,
    });
  }

  async delete(id) {
    return this.model.delete({ where: { id } });
  }

  async count(where = {}) {
    return this.model.count({ where });
  }
}