import * as vscode from 'vscode';
import { AdbDevice } from './adb';
import * as adb from './adb';
import localize from './localize';

export class AdbDevicesProvider implements vscode.TreeDataProvider<AdbDeviceTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<AdbDeviceTreeItem | undefined | null | void> =
        new vscode.EventEmitter<AdbDeviceTreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<AdbDeviceTreeItem | undefined | null | void> = 
        this._onDidChangeTreeData.event;

    constructor() {
        setInterval(() => {
            this.refresh();
        }, 1000 * 30);
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: AdbDeviceTreeItem): vscode.TreeItem {
        return element;
    }

    async getChildren(element?: AdbDeviceTreeItem): Promise<AdbDeviceTreeItem[]> {
        if (element) {
            return [];
        } else {
            const devices = await adb.listDevices();
            return devices.map(device => new AdbDeviceTreeItem(device));
        }
    }
}

function getIconNameByDeviceType(type: string): string {
    switch (type) {
        case 'offline':
            return 'warning';
        default:
            return 'device-mobile';
    }
}

function getLocalizedDeviceType(type: string): string {
    const result = localize('gwo.android.type.' + type);
    if (result.indexOf('%') >= 0) {
        return type;
    }
    return result;
}

export class AdbDeviceTreeItem extends vscode.TreeItem {
    public readonly id: string;
    public type: string;

    constructor(device: AdbDevice) {
        super(device.id, vscode.TreeItemCollapsibleState.None);
        if (device.name?.length ?? 0 > 0) {
            this.label = `${device.name} (${device.id})`;
        }
        this.id = device.id;
        this.type = device.type;
        this.contextValue = 'adbDevice';
        this.description = getLocalizedDeviceType(device.type);
        this.tooltip = device.id;
        this.iconPath = new vscode.ThemeIcon(getIconNameByDeviceType(device.type));
    }
}
