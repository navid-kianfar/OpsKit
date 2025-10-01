import Redis from 'ioredis';
import type { IExecuteFunctions, ILoadOptionsFunctions } from 'n8n-workflow';

type Creds = { host: string; port: number; password?: string; db: number; tls: boolean; ns?: string };

export async function getRedis(thisArg: IExecuteFunctions | ILoadOptionsFunctions) {
    const creds = await thisArg.getCredentials('opsKitRedisApi') as unknown as Creds;

    const client = new Redis({
        host: creds.host,
        port: creds.port,
        password: creds.password || undefined,
        db: creds.db,
        tls: creds.tls ? {} : undefined,
        lazyConnect: false,
    });

    // ensure connection is OK
    await client.ping();

    const ns = (creds.ns || '').trim();
    const prefix = ns ? `n8n:${ns}:` : 'n8n:';
    return { client, prefix };
}