// Simple email service stub
import dotenv from 'dotenv';
dotenv.config();

const EmailService = {
  async sendWelcomeEmail(to, { name, role, loginUrl } = {}) {
    console.log(`Stub: sendWelcomeEmail to=${to}, name=${name}, role=${role}, loginUrl=${loginUrl}`);
    return { success: true };
  },

  async sendPasswordReset(to, { token, resetUrl } = {}) {
    console.log(`Stub: sendPasswordReset to=${to}, token=${token}, resetUrl=${resetUrl}`);
    return { success: true };
  }
};

export default EmailService;
