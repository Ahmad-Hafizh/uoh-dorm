import { mkdir, readFile, writeFile, rename } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import type { Store } from './models.ts';
export function dataPath() { return resolve(process.env.DEMO_DATA_FILE || 'demo/data.json'); }
export async function readStore(): Promise<Store> {
    try {
        return JSON.parse(await readFile(dataPath(), 'utf8')) as Store;
    }
    catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'ENOENT')
            throw error;
        return JSON.parse(await readFile(resolve('demo/seed.json'), 'utf8')) as Store;
    }
}
export async function writeStore(store: Store) { const path = dataPath(); await mkdir(dirname(path), { recursive: true }); await writeFile(path + '.tmp', JSON.stringify(store, null, 2)); await rename(path + '.tmp', path); }
// Demo-only single-process storage. Replace this boundary with Prisma when connecting Neon.
const shared = globalThis as typeof globalThis & {
    dormDemoQueue?: Promise<unknown>;
};
export function withStore<T>(operation: (store: Store) => Promise<T>): Promise<T> { const result = (shared.dormDemoQueue ?? Promise.resolve()).then(async () => operation(await readStore())); shared.dormDemoQueue = result.catch(() => undefined); return result; }
