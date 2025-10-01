import { ICredentialType, INodeProperties, Icon} from 'n8n-workflow';

export class OpsKitRedisApi implements ICredentialType {
  name = 'opsKitRedisApi';
  displayName = 'OpsKit Redis';
    icon = 'file:redis.svg' as any;
  //   icon = { light: 'file:redis.svg', dark: 'file:redis.svg' };
  //   icon: Icon = {
  //       light: { type: 'file', filePath: 'redis.svg' },
  //       dark:  { type: 'file', filePath: 'redis.svg' },
  //   };
  properties: INodeProperties[] = [
    { displayName: 'Host', name: 'host', type: 'string', default: 'localhost' },
    { displayName: 'Port', name: 'port', type: 'number', default: 6379 },
    { displayName: 'Password', name: 'password', type: 'string', typeOptions: { password: true }, default: '' },
    { displayName: 'DB', name: 'db', type: 'number', default: 0 },
    { displayName: 'TLS', name: 'tls', type: 'boolean', default: false },
    { displayName: 'Namespace (optional)', name: 'ns', type: 'string', default: '' }
  ];
}
