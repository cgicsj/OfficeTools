import { tmpdir } from 'node:os';
import path from 'node:path';

type ElectronPathName = 'userData' | string;

export const app = {
  getPath(name: ElectronPathName): string {
    if (name === 'userData') {
      return process.env.OFFICE_TOOLS_TEST_USER_DATA ?? path.join(tmpdir(), 'office-tools-functional-user-data');
    }

    return tmpdir();
  },
  isPackaged: false,
  setPath(): void {},
};
