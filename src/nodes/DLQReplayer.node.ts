import type { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { getRedis } from '../shared/redis';

export class DLQReplayerNode implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'OpsKit: DLQ Replayer',
    name: 'opsKitDLQReplayer',
    group: ['transform'],
    icon: 'fa:play',
    version: 1,
    description: 'Pop from DLQ and emit items',
    defaults: { name: 'DLQ Replayer' },
    inputs: ['main'],
    outputs: ['main'],
    properties: [
      { displayName: 'Topic', name: 'topic', type: 'string', default: 'default' },
      { displayName: 'Batch Size', name: 'batch', type: 'number', default: 50 }
    ],
    credentials: [{ name: 'opsKitRedisApi', required: true }],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const { client, prefix } = await getRedis(this);
    const topic = this.getNodeParameter('topic', 0) as string;
    const batch = this.getNodeParameter('batch', 0) as number;
    const key = `${prefix}dlq:${topic}`;

    const out: INodeExecutionData[] = [];
    for (let i = 0; i < batch; i++) {
      const raw = await client.rpop(key);
      if (!raw) break;
      const obj = JSON.parse(raw);
      out.push({ json: obj.item });
    }

    await client.quit().catch(() => {});
    return [out.length ? out : items];
  }
}
