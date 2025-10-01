import type { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { getRedis } from '../shared/redis';

export class DeadLetterNode implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'OpsKit: Dead Letter',
    name: 'opsKitDeadLetter',
    group: ['transform'],
    icon: 'fa:archive',
    version: 1,
    description: 'Push failed item to Redis list for later replay',
    defaults: { name: 'Dead Letter' },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      { displayName: 'Topic', name: 'topic', type: 'string', default: 'default' },
      { displayName: 'Max Items', name: 'maxItems', type: 'number', default: 10000, description: 'Trim to keep list bounded' }
    ],
    credentials: [{ name: 'opsKitRedisApi', required: true }],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const { client, prefix } = await getRedis(this);
    const topic = this.getNodeParameter('topic', 0) as string;
    const maxItems = this.getNodeParameter('maxItems', 0) as number;
    const key = `${prefix}dlq:${topic}`;

    for (const it of items) {
      const payload = JSON.stringify({ ts: Date.now(), item: it.json });
      await client.lpush(key, payload);
    }
    await client.ltrim(key, 0, maxItems - 1);

    await client.quit().catch(() => {});
    return [items];
  }
}
