import type { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { getRedis } from '../shared/redis';
import { loadScript, LUA_IDEMPOTENCY } from '../shared/lua';

export class IdempotencyNode implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'OpsKit: Idempotency',
    name: 'opsKitIdempotency',
    group: ['transform'],
    icon: 'fa:clone',
    version: 1,
    description: 'Drop/allow duplicates with TTL',
    defaults: { name: 'Idempotency' },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      { displayName: 'Key', name: 'key', type: 'string', default: '{{ $json.message_id }}' },
      { displayName: 'TTL (sec)', name: 'ttlSec', type: 'number', default: 86400 },
      { displayName: 'Prefix', name: 'prefixKey', type: 'string', default: 'idem:' }
    ],
    credentials: [{ name: 'opsKitRedisApi', required: true }],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const { client, prefix } = await getRedis(this);
    const fx = await loadScript(client, LUA_IDEMPOTENCY);

    const out: INodeExecutionData[] = [];
    for (let i = 0; i < items.length; i++) {
      const k = this.evaluateExpression(this.getNodeParameter('key', i) as string, i);
      const pref = this.getNodeParameter('prefixKey', i) as string;
      const ttl = this.getNodeParameter('ttlSec', i) as number;

      const key = `${prefix}${pref}${k}`;
      const ok = await fx([key], [String(ttl)]) as unknown as number;
      if (ok === 1) out.push({ json: { ...items[i].json, idempotency: { accepted: true, key } } });
    }

    await client.quit().catch(() => {});
    return [out];
  }
}
