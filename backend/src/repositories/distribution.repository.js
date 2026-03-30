export class DistributionRepository {
  constructor() {}

  async create(data) {
    console.log('DistributionRepository.create', data);
    return { id: 'mock-distribution', ...data };
  }

  async findById(id, opts = {}) {
    console.log('DistributionRepository.findById', id, opts);
    return { id, status: 'APPROVED', details: [] };
  }

  async updateDetail(id, data) {
    console.log('DistributionRepository.updateDetail', id, data);
    return { id, ...data };
  }

  async update(id, data) {
    console.log('DistributionRepository.update', id, data);
    return { id, ...data };
  }
}

export default new DistributionRepository();
