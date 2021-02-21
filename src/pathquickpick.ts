import * as vscode from 'vscode';
import * as adb from './adb';
import { AdbDeviceTreeItem } from './devicesprovider';
import localize from './localize';

export function bind(box: vscode.QuickPick<PathPickItem>, item: AdbDeviceTreeItem, cb: (path: string) => void) {
    box.title = localize('gwo.android.devices.chooseFolderTitle', item.label as string);
    box.value = '/';
    box.canSelectMany = false;

    const loadAutoComplete = async (path: string) => {
        if (!path.startsWith('/')) {
            path = '/' + path;
        }
        box.busy = true;
        try {
            const dirs = (await adb.readDirectory(item.id, path))
                .filter(entry => !entry.isFile())
                .map(entry => path + (path.endsWith('/') ? '' : '/') + entry.name);
            box.items = [path, ...dirs].map(dir => new PathPickItem(dir));
        } finally {
            box.busy = false;
        }
    };

    box.onDidChangeValue(loadAutoComplete);
    box.onDidChangeSelection((entry: PathPickItem[]) => {
        if (entry.length === 1) {
            if (entry[0].label === box.value) {
                let targetPath = box.value;
                if (targetPath.endsWith('/') && targetPath !== '/') {
                    targetPath = targetPath.substr(0, targetPath.length - 1);
                }
                cb(targetPath);
                box.dispose();
            }
            box.value = entry[0].label + '/';
        }
        loadAutoComplete(box.value);
    });

    loadAutoComplete(box.value);
}

class PathPickItem implements vscode.QuickPickItem {
    constructor(public label: string) {}
}
