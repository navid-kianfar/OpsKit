import { createClient, RedisClientType } from 'redis';
import type { IExecuteFunctions, ILoadOptionsFunctions } from 'n8n-workflow';

type Creds = {
  host: string; port: number; password?: string; db: number; tls: boolean; ns?: string;
};

export async function getRedis(thisArg: IExecuteFunctions | ILoadOptionsFunctions) {
  const creds = await thisArg.getCredentials('opsKitRedisApi') as unknown as Creds;
  const url = `${creds.tls ? 'rediss' : 'redis'}://${creds.host}:${creds.port}`;
  const client: RedisClientType = createClient({
    url,
    database: creds.db,
    password: creds.password || undefined,
    socket: creds.tls ? { tls: true } : undefined,
  });
  if (!client.isOpen) await client.connect();
  const ns = (creds.ns || '').trim();
  const prefix = ns ? `n8n:${ns}:` : 'n8n:';
  return { client, prefix };
}
