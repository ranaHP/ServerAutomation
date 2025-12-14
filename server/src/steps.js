import { allowedPaths } from './config.js';

function assertSafePath(p) {
  if (!p.startsWith('/')) throw new Error('Paths must be absolute');
  if (/[;|`\n]/.test(p)) throw new Error('Invalid characters in path');
  if (!allowedPaths.some((base) => p.startsWith(base))) throw new Error('Path not allowed');
}

export function buildDeploySteps({ releaseDir, serverDir, backupBase }) {
  [releaseDir, serverDir, backupBase].forEach(assertSafePath);
  const ts = '$(date +%Y%m%d_%H%M%S)';
  const backupPath = `${backupBase}/${ts}/custom-plugins`;
  return [
    { key: 'stop', name: 'Stop server', commands: [`cd /home/directfn/app/ntp_lwapi_gw && ./stop_server.sh`] },
    { key: 'compare', name: 'Compare release and server jars', commands: [
      `echo "Release JARs:" && find ${releaseDir} -maxdepth 1 -type f -name "*.jar" -printf "%f\n" | sort`,
      `echo "Server JARs:" && find ${serverDir} -maxdepth 1 -type f -name "*.jar" -printf "%f\n" | sort`
    ] },
    { key: 'backup', name: 'Backup matching JARs', commands: [
      `mkdir -p ${backupPath}`,
      `for f in $(find ${releaseDir} -maxdepth 1 -type f -name "*.jar" -printf "%f\n"); do if [ -f ${serverDir}/$f ]; then cp -p ${serverDir}/$f ${backupPath}/; fi; done`,
      `ls -lh ${backupPath} || true`
    ], summary: backupPath },
    { key: 'replace', name: 'Replace JARs', commands: [
      `cp -p ${releaseDir}/*.jar ${serverDir}/`,
      `ls -lh ${serverDir}/*.jar`
    ] },
    { key: 'start', name: 'Start server', commands: [`cd /home/directfn/app/ntp_lwapi_gw && ./start_server.sh`] },
    { key: 'status', name: 'Status check', commands: [`cd /home/directfn/app && ./status.sh`] },
    { key: 'smoke', name: 'Smoke test', commands: [`curl -s -X POST http://localhost:9090/api/light/Auth/Login -H 'Content-Type: application/json' -d '{"user":"demo"}'`] }
  ];
}

export function buildRollbackSteps({ backupBase, serverDir, rollbackBackupTs }) {
  [backupBase, serverDir].forEach(assertSafePath);
  const backupPath = `${backupBase}/${rollbackBackupTs}/custom-plugins`;
  return [
    { key: 'stop', name: 'Stop server', commands: [`cd /home/directfn/app/ntp_lwapi_gw && ./stop_server.sh`] },
    { key: 'precheck', name: 'Precheck backup contents', commands: [`ls -lh ${backupPath}`] },
    { key: 'safety_backup', name: 'Safety backup current jars', optional: true, commands: [
      `mkdir -p ${backupBase}/$(date +%Y%m%d_%H%M%S)/pre-rollback/custom-plugins`,
      `cp -p ${serverDir}/*.jar ${backupBase}/$(date +%Y%m%d_%H%M%S)/pre-rollback/custom-plugins/`
    ] },
    { key: 'restore', name: 'Restore from backup', commands: [
      `cp -p ${backupPath}/*.jar ${serverDir}/`,
      `ls -lh ${serverDir}/*.jar`
    ] },
    { key: 'start', name: 'Start server', commands: [`cd /home/directfn/app/ntp_lwapi_gw && ./start_server.sh`] },
    { key: 'status', name: 'Status check', commands: [`cd /home/directfn/app && ./status.sh`] },
    { key: 'smoke', name: 'Smoke test', commands: [`curl -s -X POST http://localhost:9090/api/light/Auth/Login -H 'Content-Type: application/json' -d '{"user":"demo"}'`] }
  ];
}
