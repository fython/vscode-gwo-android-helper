import * as vscode from 'vscode';
import { Stats } from 'fs';
import * as adb from './adb';
import * as StreamUtils from './utils/stream';

export const ADB_URI_SCHEME = 'adbfile';

export class AdbUri {
    public deviceId: string;
    public rootType: string;
    public path: string;

    constructor(deviceId: string, rootType: string, path: string) {
        this.deviceId = deviceId;
        this.rootType = rootType;
        if (path.startsWith('/')) {
            this.path = path.substr(1);
        } else {
            this.path = path;
        }
    }

    get fullPath(): string {
        if (this.rootType === 'internal') {
            if (this.path === '') {
                return '/sdcard';
            } else {
                return `/sdcard/${this.path}`;
            }
        } else {
            return `/${this.path}`;
        }
    }

    static fromVSCodeUri(uri: vscode.Uri): AdbUri {
        if (uri.scheme !== ADB_URI_SCHEME) {
            throw new Error(`the scheme of adb uri should be '${ADB_URI_SCHEME}'`);
        }
        const parts = uri.path.split('/');
        if (parts[0] === '') {
            parts.shift();
        }
        const [deviceId, rootType, ...path] = parts;
        return new AdbUri(deviceId, rootType, path.join('/'));
    }
}

export class AdbFileStat implements vscode.FileStat {
    type: vscode.FileType;
    ctime: number;
    mtime: number;
    size: number;
    name: string;
    
    constructor(opts: AdbFileStatOptions) {
        this.type = opts.type;
        this.ctime = opts.ctime ?? Date.now();
        this.mtime = opts.mtime ?? Date.now();
        this.size = opts.size ?? 0;
        this.name = opts.name;
    }

    static fromFsStats(stats: Stats): AdbFileStat {
        return new AdbFileStat({
            type: stats.isFile() ? vscode.FileType.File : vscode.FileType.Directory,
            ctime: stats.ctime?.getTime(),
            mtime: stats.mtime?.getTime(),
            size: stats.isFile() ? stats.size : 0,
            name: '',
        });
    }
}

interface AdbFileStatOptions {
    type: vscode.FileType;
    ctime?: number;
    mtime?: number;
    size?: number;
    name: string;
}

export class AdbFileSystemProvider implements vscode.FileSystemProvider {
    private onDidChangeFileEmitter = new vscode.EventEmitter<vscode.FileChangeEvent[]>();
    readonly onDidChangeFile: vscode.Event<vscode.FileChangeEvent[]> = this.onDidChangeFileEmitter.event;

    public isDebugging: boolean = false;

    watch(uri: vscode.Uri, options: { recursive: boolean; excludes: string[]; }): vscode.Disposable {
        // TODO unimplemented
        return new vscode.Disposable(() => {});
    }

    debugLog(message?: any, ...optionalParams: any[]) {
        if (this.isDebugging) {
            console.log(message, ...optionalParams);
        }
    }

    async stat(uri: vscode.Uri): Promise<vscode.FileStat> {
        const adbUri = AdbUri.fromVSCodeUri(uri);
        this.debugLog('stat:', adbUri);
        try {
            const stats = await adb.stat(adbUri.deviceId, adbUri.fullPath);
            return AdbFileStat.fromFsStats(stats);
        } catch (err) {
            if (err.code === 'ENOENT') {
                throw vscode.FileSystemError.FileNotFound(uri);
            }
            throw err;
        }
    }

    async readDirectory(uri: vscode.Uri): Promise<[string, vscode.FileType][]> {
        const adbUri = AdbUri.fromVSCodeUri(uri);
        this.debugLog('readDirectory:', adbUri);
        const entries = await adb.readDirectory(adbUri.deviceId, adbUri.fullPath);
        return entries.map((entry: adb.AdbEntry) => 
            [entry.name, entry.isFile() ? vscode.FileType.File : vscode.FileType.Directory]);
    }

    async createDirectory(uri: vscode.Uri): Promise<void> {
        const adbUri = AdbUri.fromVSCodeUri(uri);
        this.debugLog('createDirectory:', adbUri);
        return await adb.createDirectory(adbUri.deviceId, adbUri.fullPath);
    }

    async readFile(uri: vscode.Uri): Promise<Uint8Array> {
        const adbUri = AdbUri.fromVSCodeUri(uri);
        this.debugLog('readFile:', adbUri);
        return await adb.readFile(adbUri.deviceId, adbUri.fullPath);
    }

    async writeFile(uri: vscode.Uri, content: Uint8Array, options: { create: boolean; overwrite: boolean; }): Promise<void> {
        const adbUri = AdbUri.fromVSCodeUri(uri);
        this.debugLog('writeFile:', adbUri);
        return await adb.writeFile(adbUri.deviceId, adbUri.fullPath, StreamUtils.toReadable(content));
    }

    async delete(uri: vscode.Uri, options: { recursive: boolean; }): Promise<void> {
        const adbUri = AdbUri.fromVSCodeUri(uri);
        this.debugLog('delete:', adbUri);
        const stats = await this.stat(uri);
        if (stats.type === vscode.FileType.Directory) {
            return await adb.deleteDirectory(adbUri.deviceId, adbUri.fullPath);
        }
        return await adb.deleteFile(adbUri.deviceId, adbUri.fullPath);
    }

    async rename(oldUri: vscode.Uri, newUri: vscode.Uri, options: { overwrite: boolean; }): Promise<void> {
        const oldAdbUri = AdbUri.fromVSCodeUri(oldUri);
        const newAdbUri = AdbUri.fromVSCodeUri(newUri);
        this.debugLog('rename: %s => %s', oldAdbUri, newAdbUri);
        if (oldAdbUri.deviceId !== newAdbUri.deviceId) {
            return await adb.renameAcrossDevices(oldAdbUri.deviceId, newAdbUri.deviceId,
                oldAdbUri.fullPath, newAdbUri.fullPath, options);
        }
        return await adb.renameInSameDevice(oldAdbUri.deviceId, oldAdbUri.fullPath, newAdbUri.fullPath, options);
    }
}
