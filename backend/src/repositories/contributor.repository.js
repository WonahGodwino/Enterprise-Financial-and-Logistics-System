export class ContributorRepository {
  constructor() {}

  async findMany(filter = {}) {
    // Placeholder: return empty array or implement prisma logic
    console.log('ContributorRepository.findMany called with', filter);
    return [];
  }

  async findById(id) {
    console.log('ContributorRepository.findById', id);
    return null;
  }

  async create(data) {
    console.log('ContributorRepository.create', data);
    return { id: 'mock-contributor', ...data };
  }
}

export default new ContributorRepository();
