import fs from 'fs';
import { Client } from 'ssh2';
import { config } from './config.js';

export function runRemoteCommands(server, commands, onData) {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    conn
      .on('ready', () => {
        const command = commands.join(' && ');
        conn.exec(command, (err, stream) => {
          if (err) {
            conn.end();
            return reject(err);
          }
          stream
            .on('close', (code) => {
              conn.end();
              resolve(code ?? 0);
            })
            .on('data', (data) => onData('info', data.toString()))
            .stderr.on('data', (data) => onData('error', data.toString()));
        });
      })
      .on('error', reject)
      .connect({
        host: server.host,
        port: server.port || 22,
        username: server.user,
        privateKey: fs.readFileSync(config.sshKeyPath),
        passphrase: config.sshKeyPassphrase || undefined
      });
  });
}
