import { useState, useCallback } from 'react';
import { exec } from 'child_process';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

interface LampConnectionState {
  connected: boolean;
  checking: boolean;
  error: string | null;
}

interface UseLampConnection extends LampConnectionState {
  checkConnection: () => void;
}

// Default bulb IP from main.py
const DEFAULT_BULB_IP = '192.168.1.77';

export function useLampConnection(): UseLampConnection {
  const [state, setState] = useState<LampConnectionState>({
    connected: false,
    checking: false,
    error: null,
  });

  const checkConnection = useCallback(() => {
    setState(prev => ({ ...prev, checking: true, error: null }));

    // Get path to parent directory where Python script lives
    const __dirname = dirname(fileURLToPath(import.meta.url));
    const lampDir = resolve(__dirname, '../../..');

    // Use Python script to discover/check lamp
    const cmd = `cd "${lampDir}" && uv run python -c "
import asyncio
from kasa import Device

async def check():
    try:
        bulb = await Device.connect(host='${DEFAULT_BULB_IP}')
        await bulb.update()
        print('connected' if bulb else 'not found')
    except Exception as e:
        print(f'error:{e}')

asyncio.run(check())
"`;

    exec(cmd, { timeout: 10000 }, (error, stdout, stderr) => {
      if (error) {
        setState({
          connected: false,
          checking: false,
          error: 'Connection failed',
        });
        return;
      }

      const output = stdout.trim().toLowerCase();

      if (output === 'connected') {
        setState({
          connected: true,
          checking: false,
          error: null,
        });
      } else if (output.startsWith('error:')) {
        setState({
          connected: false,
          checking: false,
          error: output.replace('error:', '').substring(0, 30),
        });
      } else {
        setState({
          connected: false,
          checking: false,
          error: 'Lamp not found',
        });
      }
    });
  }, []);

  return {
    ...state,
    checkConnection,
  };
}
