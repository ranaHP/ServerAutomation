import fs from 'fs';
import path from 'path';
import YAML from 'yaml';
import { logger } from './logger.js';

const inventoryPath = path.join(process.cwd(), 'server', 'inventory', 'servers.yml');

export function loadInventory() {
  try {
    const content = fs.readFileSync(inventoryPath, 'utf-8');
    return YAML.parse(content);
  } catch (err) {
    logger.error({ err }, 'Failed to load inventory');
    return { groups: {} };
  }
}

export function findServer(group, name) {
  const inv = loadInventory();
  const groupServers = inv.groups?.[group] || [];
  return groupServers.find((s) => s.name === name);
}
