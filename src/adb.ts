import { Stats } from 'fs';
import { Readable } from 'stream';
import * as StreamUtils from './utils/stream';
const Adb = require('@devicefarmer/adbkit');
const concatStream = require('concat-stream');

const client = Adb.createClient();

function timeout(ms: number): Promise<void> {
    return new Promise<void>(async (resolve) => setTimeout(resolve, ms));
}

export interface AdbDevice {
    id: string;
    type: AdbDeviceType;
    name?: string;
}

export interface AdbEntry {
    name: string;
    mode: number;
    size: number;
    mtime: Date;

    isFile(): boolean;
}

export type AdbDeviceType = 'device' | 'unauthorized' | 'offline' | 'fastboot' | 'recovery';

export async function listDevices(): Promise<AdbDevice[]> {
    const devices: AdbDevice[] = await client.listDevices();
    for (const d of devices) {
        if (d.type !== 'unauthorized' && d.type !== 'offline') {
            d.name = await getProp(d.id, 'ro.product.device');
        }
    }
    return devices;
}

export function getProp(device: string, key: string): Promise<string> {
    return client.shell(device, `getprop ${key}`)
        .then(Adb.util.readAll)
        .then((out: Buffer) => out.toString().trim());
}

export function stat(device: string, path: string): Promise<Stats> {
    return client.stat(device, path);
}

export function readDirectory(device: string, path: string): Promise<AdbEntry[]> {
    return client.readdir(device, path);
}

export function readFile(device: string, path: string): Promise<Uint8Array> {
    return new Promise<Uint8Array>(async (resolve, reject) => {
        try {
            const transfer = await client.pull(device, path);
            const writable = concatStream({ encoding: 'uint8array' }, resolve);
            transfer.on('error', reject);
            transfer.pipe(writable);
        } catch (err) {
            reject(err);
        }
    });
}

export async function writeFile(device: string, path: string, stream: Readable, overwrite: boolean = false): Promise<void> {
    let pathExists = false;
    try {
        await client.stat(device, path);
        pathExists = true;
    } catch (ignored) {
        // Ignored
    }
    if (!overwrite && pathExists) {
        throw new Error('file exists');
    }
    return await client.push(device, stream, path);
}

export function createDirectory(device: string, path: string): Promise<void> {
    return client.shell(device, `mkdir "${path}"`)
        .then(() => timeout(200));
}

export async function deleteDirectory(device: string, path: string): Promise<void> {
    const out = await client.shell(device, `rmdir "${path}"`).then(Adb.util.read);
    const msg = out.toString().trim();
    console.log(`shell output: ${msg}`);
    if (msg.endsWith(': Directory not empty')) {
        throw new Error('non-empty directory can\'t be deleted.');
    }
    await timeout(200);
    return;
}

export async function deleteFile(device: string, path: string): Promise<void> {
    await client.shell(device, `rm "${path}"`);
    await timeout(200);
    return;
}

export async function renameInSameDevice(device: string, oldPath: string, newPath: string, options?: { overwrite?: boolean }): Promise<void> {
    let newPathExists = false;
    try {
        await client.stat(device, newPath);
        newPathExists = true;
    } catch (ignored) {
        // Ignored
    }
    if (options?.overwrite !== true && newPathExists) {
        throw new Error('target path already exists');
    }
    await client.shell(device, `mv "${oldPath}" "${newPath}"`);
    await timeout(200);
    return;
}

export async function renameAcrossDevices(oldDevice: string, newDevice: string, oldPath: string, newPath: string, options?: { overwrite?: boolean }): Promise<void> {
    let newPathExists = false;
    let isFile = false;
    try {
        const stat = await client.stat(newDevice, newPath);
        isFile = stat.isFile();
        newPathExists = true;
    } catch (ignored) {
        // Ignored
    }
    if (options?.overwrite !== true && newPathExists) {
        throw new Error('target path already exists');
    }
    if (!isFile) {
        throw new Error('only files are supported to move across devices');
    }
    const oldData = await readFile(oldDevice, oldPath);
    await writeFile(newDevice, newPath, StreamUtils.toReadable(oldData), options?.overwrite === true);
    await deleteFile(oldDevice, oldPath);
}
