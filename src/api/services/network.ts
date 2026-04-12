import os from 'os';

const EXCLUDE_IFACE = /^(utun|awdl|llw|bridge|vmnet|veth|lo|docker|tun|tap)/;

export interface LanInterfaceInfo {
  name: string;
  address: string;
}

export function listLanInterfaces(): LanInterfaceInfo[] {
  const ifaces = os.networkInterfaces();
  const result: LanInterfaceInfo[] = [];

  for (const [name, addrs] of Object.entries(ifaces)) {
    if (EXCLUDE_IFACE.test(name)) continue;
    for (const addr of addrs ?? []) {
      if (addr.family === 'IPv4' && !addr.internal) {
        result.push({ name, address: addr.address });
      }
    }
  }

  return result;
}
