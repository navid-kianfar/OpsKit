import type { IExecuteFunctions, INodeExecutionData, INodeType, INodeTypeDescription } from 'n8n-workflow';
import { getRedis } from '../shared/redis';
import { loadScript, LUA_CIRCUIT_UPDATE } from '../shared/lua';

export class CircuitBreakerNode implements INodeType {
  description: INodeTypeDescription = {
    displayName: 'OpsKit: Circuit Breaker',
    name: 'opsKitCircuitBreaker',
    group: ['transform'],
    icon: 'fa:bolt',
    version: 1,
    description: 'Open/half/closed by failure rate',
    defaults: { name: 'Circuit Breaker' },
    inputs: ['main'],
    outputs: ['main', 'main'],
    properties: [
      { displayName: 'Name', name: 'name', type: 'string', default: 'openai' },
      { displayName: 'Window (sec)', name: 'windowSec', type: 'number', default: 60 },
      { displayName: 'Open Threshold (0..1)', name: 'threshold', type: 'number', default: 0.3 },
      { displayName: 'Half-open After (sec)', name: 'halfAfterSec', type: 'number', default: 30 },
      { displayName: 'Mode', name: 'mode', type: 'options', default: 'evaluate', options: [
        { name: 'Evaluate (check state)', value: 'evaluate' },
        { name: 'Record Success', value: 'success' },
        { name: 'Record Failure', value: 'failure' }
      ] }
    ],
    credentials: [{ name: 'opsKitRedisApi', required: true }],
  };

  async execute(this: IExecuteFunctions): Promise<INodeExecutionData[][]> {
    const items = this.getInputData();
    const { client, prefix } = await getRedis(this);
    const update = await loadScript(client, LUA_CIRCUIT_UPDATE);

    const pass: INodeExecutionData[] = [];
    const fb: INodeExecutionData[] = [];

    for (let i = 0; i < items.length; i++) {
      const name = this.getNodeParameter('name', i) as string;
      const windowSec = this.getNodeParameter('windowSec', i) as number;
      const threshold = this.getNodeParameter('threshold', i) as number;
      const halfAfter = this.getNodeParameter('halfAfterSec', i) as number;
      const mode = this.getNodeParameter('mode', i) as 'evaluate'|'success'|'failure';

      const key = `${prefix}cb:${name}`;
      const action = mode === 'evaluate' ? 'noop' : (mode === 'success' ? 'inc_success' : 'inc_failure');
      const res = await update([key], [action, String(windowSec), String(threshold), String(halfAfter)]) as unknown as [string, string, string];
      const state = res[0] as string;

      const enriched = { ...items[i].json, circuit: { name, state } };

      if (mode === 'evaluate') {
        if (state === 'open') fb.push({ json: enriched });
        else pass.push({ json: enriched });
      } else {
        pass.push({ json: enriched });
      }
    }

    await client.quit().catch(() => {});
    return [pass, fb];
  }
}
