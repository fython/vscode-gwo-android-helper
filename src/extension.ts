import * as vscode from 'vscode';
import { AdbDevicesProvider, AdbDeviceTreeItem } from './devicesprovider';
import { AdbFileSystemProvider } from './fsprovider';
import * as PathQuickPick from './pathquickpick';
import localize from './localize';

export function activate(context: vscode.ExtensionContext) {
	const devicesProvider = new AdbDevicesProvider();
	const adbFsProvider = new AdbFileSystemProvider();
	adbFsProvider.isDebugging = true;

	const refreshAdbDevices = () => devicesProvider.refresh();
	const openDeviceInternalStorage = (item: AdbDeviceTreeItem) => {
		console.log(`openDeviceInternalStorage: id=${item.id}`);
		vscode.workspace.updateWorkspaceFolders(0, null, {
			uri: vscode.Uri.parse(`adbfile:/${item.id}/internal`),
			name: localize('gwo.android.folder.internalStorageTitle', item.label as string),
		});
		vscode.window.showInformationMessage(
			localize('gwo.android.folder.openMessage', item.label as string));
	};
	const openDeviceFolder = (item: AdbDeviceTreeItem) => {
		console.log(`openDeviceFolder: id=${item.id}`);
		const quickPick = vscode.window.createQuickPick();
		PathQuickPick.bind(quickPick, item, (path: string) => {
			vscode.workspace.updateWorkspaceFolders(0, null, {
				uri: vscode.Uri.parse(`adbfile:/${item.id}/root${path}`),
				name: `${path} - ${item.label}`,
			});
			vscode.window.showInformationMessage(
				localize('gwo.android.folder.openMessage', `${item.label}:${path}`));
		});
		quickPick.show();
	};
	const openTerminal = (item: AdbDeviceTreeItem) => {
		console.log(`openTerminal: id=${item.id}`);
		const terminal = vscode.window.createTerminal(
			localize('gwo.android.terminal.title', item.id),
			'adb', ['-s', item.id, 'shell']);
		terminal.show();
	};

	context.subscriptions.push(
		vscode.workspace.registerFileSystemProvider('adbfile', adbFsProvider, { isCaseSensitive: true }),
		vscode.window.registerTreeDataProvider('adbDevices', devicesProvider),
		vscode.commands.registerCommand('adbDevices.refresh', refreshAdbDevices),
		vscode.commands.registerCommand('adbDevices.openDeviceInternalStorage', openDeviceInternalStorage),
		vscode.commands.registerCommand('adbDevices.openDeviceFolder', openDeviceFolder),
		vscode.commands.registerCommand('adbDevices.openTerminal', openTerminal),
	);
}

export function deactivate() {}
