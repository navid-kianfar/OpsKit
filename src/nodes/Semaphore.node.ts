import type { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { getRedis } from '../shared/redis';
import { loadScript, LUA_SEMAPHORE_ACQUIRE, LUA_SEMAPHORE_RELEASE } from '../shared/lua';

export class SemaphoreNode implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'OpsKit: Semaphore',
    name: 'opsKitSemaphore',
    group: ['transform'],
    icon: 'fa:lock',
    version: 1,
    description: 'Named lock / bounded concurrency',
    defaults: { name: 'Semaphore' },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      { displayName: 'Lock Key', name: 'lockKey', type: 'string', default: 'chat:{{ $json.chat_id }}' },
      { displayName: 'Max Concurrent', name: 'limit', type: 'number', default: 1 },
      { displayName: 'Lease TTL (sec)', name: 'ttlSec', type: 'number', default: 30 },
      { displayName: 'Holder ID (optional)', name: 'holderId', type: 'string', default: '{{$execution.id}}' },
      { displayName: 'Action', name: 'action', type: 'options', default: 'acquire', options: [
        { name: 'Acquire', value: 'acquire' }, { name: 'Release', value: 'release' }
      ]}
    ],
    credentials: [{ name: 'opsKitRedisApi', required: true }],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const { client, prefix } = await getRedis(this);
    const acquire = await loadScript(client, LUA_SEMAPHORE_ACQUIRE);
    const release = await loadScript(client, LUA_SEMAPHORE_RELEASE);
    const out: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      const action = this.getNodeParameter('action', i) as 'acquire'|'release';
      const limit = this.getNodeParameter('limit', i) as number;
      const ttlSec = this.getNodeParameter('ttlSec', i) as number;
      const holderId = (this.getNodeParameter('holderId', i) as string) || `${this.getExecutionId()}_${i}`;
      const lockKey = `${prefix}lock:${this.evaluateExpression(this.getNodeParameter('lockKey', i) as string, i)}`;

      if (action === 'acquire') {
        const ok = await acquire([lockKey], [String(limit), holderId, String(ttlSec)]) as unknown as number;
        if (ok !== 1) throw new Error(`Semaphore limit reached for ${lockKey}`);
        out.push({ json: { ...items[i].json, lock: { acquired: true, key: lockKey, holderId } } });
      } else {
        await release([lockKey], [holderId]);
        out.push({ json: { ...items[i].json, lock: { released: true, key: lockKey, holderId } } });
      }
    }

    await client.quit().catch(() => {});
    return [out];
  }
}
