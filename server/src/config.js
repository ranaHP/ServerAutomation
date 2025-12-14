import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

dotenv.config();

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  webOrigin: process.env.WEB_ORIGIN || 'http://localhost:5173',
  jwtSecret: process.env.JWT_SECRET || 'change-me',
  dbPath: process.env.DATABASE_PATH || path.join(__dirname, '..', 'data', 'releasepilot.db'),
  sshKeyPath: process.env.SSH_PRIVATE_KEY_PATH,
  sshKeyPassphrase: process.env.SSH_PRIVATE_KEY_PASSPHRASE,
  defaultAdminPassword: process.env.DEFAULT_ADMIN_PASSWORD || 'admin123!',
  defaultAdminUsername: process.env.DEFAULT_ADMIN_USERNAME || 'admin'
};

export const allowedPaths = [
  '/home/directfn/app/ntp_releases',
  '/home/directfn/app/ntp_lwapi',
  '/home/directfn/app/ntp_lwapi_gw'
];
