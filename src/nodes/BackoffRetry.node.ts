import type { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { jitter } from '../shared/utils';

export class BackoffRetryNode implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'OpsKit: Backoff Retry',
    name: 'opsKitBackoffRetry',
    group: ['transform'],
    icon: 'fa:redo',
    version: 1,
    description: 'Exponential backoff with jitter around a sub-branch',
    defaults: { name: 'Backoff Retry' },
    inputs: ['main'],
    outputs: ['main', 'main'],
    properties: [
      { displayName: 'Max Attempts', name: 'maxAttempts', type: 'number', default: 5 },
      { displayName: 'Base Delay (ms)', name: 'baseDelay', type: 'number', default: 500 },
      { displayName: 'Jitter (%)', name: 'jitterPct', type: 'number', default: 20 },
      { displayName: 'Treat Non-2xx as Failure?', name: 'non2xxFailure', type: 'boolean', default: false }
    ],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const pass: INodeExecutionData[] = [];
    for (let i = 0; i < items.length; i++) {
      const maxAttempts = this.getNodeParameter('maxAttempts', i) as number;
      const baseDelay = this.getNodeParameter('baseDelay', i) as number;
      const jitterPct = this.getNodeParameter('jitterPct', i) as number;

      const meta = (items[i].json as any)._retry ?? { attempts: 0 };
      meta.attempts++;
      (items[i].json as any)._retry = meta;

      if (meta.attempts > 1) {
        const delay = Math.min(60000, Math.floor(jitter(baseDelay * Math.pow(2, meta.attempts - 2), jitterPct/100)));
        await new Promise(r => setTimeout(r, delay));
      }

      if (meta.attempts > maxAttempts) {
        return [[], items.map(x => ({ json: { ...x.json, retry: { gaveUp: true, attempts: meta.attempts } } }))];
      }

      pass.push({ json: items[i].json });
    }
    return [pass, []];
  }
}
