// Minimal backup service stub
const BackupService = {
  async listBackups() {
    return [];
  },

  async createBackup({ type, description, createdBy } = {}) {
    console.log(`Stub: createBackup type=${type}, createdBy=${createdBy}`);
    return { id: 'stub-backup-id', type, description, size: 0, createdBy };
  },

  async getBackup(id) {
    return null;
  },

  async restoreBackup(id) {
    console.log(`Stub: restoreBackup id=${id}`);
    return { success: true };
  },

  async deleteBackup(id) {
    console.log(`Stub: deleteBackup id=${id}`);
    return { success: true };
  }
};

export default BackupService;
