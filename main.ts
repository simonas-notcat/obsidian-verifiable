import { App, MarkdownView, Modal, Plugin, PluginManifest, PluginSettingTab, Setting, Notice, TFile } from 'obsidian';
import { getAgent, VeramoAgent } from 'veramo';

// Remember to rename these classes and interfaces!

interface MyPluginSettings {
	apiUrl: string;
	apiKey: string;
	did: string;
}

const DEFAULT_SETTINGS: MyPluginSettings = {
	apiUrl: 'https://hono-veramo.simonas.workers.dev/agent',
	apiKey: 'test123',
	did: 'did:ethr:goerli:0x0293699a82da961f6af8b4877eccfa5d3e78f8394efe728c06d9a1087d8c6e08cc'
}

export default class MyPlugin extends Plugin {
	settings: MyPluginSettings;
	agent: VeramoAgent;
	statusBarItem: HTMLElement;

	constructor(app: App, manifest: PluginManifest) {
		super(app, manifest)
		this.signCurrentNoteCheckCallback = this.signCurrentNoteCheckCallback.bind(this)
		this.signCurrentNote = this.signCurrentNote.bind(this)
		this.openSignModalCheckCallback = this.openSignModalCheckCallback.bind(this)
		this.verifyFile = this.verifyFile.bind(this)
	}

	async onload() {
		await this.loadSettings();

		this.agent = getAgent({ url: this.settings.apiUrl, apiKey: this.settings.apiKey });

		this.statusBarItem = this.addStatusBarItem();

		this.registerEvent(this.app.workspace.on('file-open', this.verifyFile));
		//	this.registerEvent(this.app.workspace.on('editor-change', this.verifyFile));

		this.addCommand({
			id: 'open-sign-modal',
			name: 'Sign current note with ...',
			checkCallback: this.openSignModalCheckCallback
		});

		this.addCommand({
			id: 'sign-current-note',
			name: 'Sign current note',
			checkCallback: this.signCurrentNoteCheckCallback
		})

		this.addSettingTab(new SampleSettingTab(this.app, this));
	}

	async verifyFile(file: TFile) {
		this.statusBarItem.setText('⏳')
		const cache = this.app.metadataCache.getFileCache(file)
		const did = cache?.frontmatter?.did
		const proof = cache?.frontmatter?.proof
		//TODO: check signature
		// fake check
		const verified = proof.length === 86

		setTimeout(() => {
			this.statusBarItem.setText(verified ? '✅' : '❌')
			if (!verified) {
				new Notice('Verification failed', 2000)
			}
		}, 1000)
	}

	signCurrentNoteCheckCallback(checking: boolean) {
		// Conditions to check
		const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (markdownView && this.settings.did) {
			if (checking) {
				return true
			}

			this.signCurrentNote(this.settings.did)
				.catch(e => console.log(e.message))

		}
	}

	async signCurrentNote(did: string) {
		const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (!markdownView) return;

		const identifier = await this.agent.didManagerGet({ did })
		const proof = await this.agent.keyManagerSign({
			data: markdownView?.data,
			keyRef: identifier.keys[0].kid,
		})

		const file = this.app.workspace.getActiveFile()
		if (!file) return

		this.app.fileManager.processFrontMatter(file, frontmatter => {
			frontmatter['did'] = did
			frontmatter['proof'] = proof
		})
		new Notice('Note signed by ' + did, 2000)
	}

	openSignModalCheckCallback(checking: boolean) {
		// Conditions to check
		const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
		if (markdownView) {
			// If checking is true, we're simply "checking" if the command can be run.
			// If checking is false, then we want to actually perform the operation.
			if (!checking) {
				new SignModal(this.app, this.agent).open();
			}

			// This command will only show up in Command Palette when the check function returns true
			return true;
		}
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SignModal extends Modal {
	constructor(app: App, private agent: VeramoAgent) {
		super(app);
	}

	onOpen() {
		const { contentEl } = this;
		contentEl.setText('Loading...');
		this.agent.didManagerFind().then(identifiers => {
			contentEl.setText(identifiers.map(a => a.did).join(' '))
		}).then(res => {
			console.log(res)
		})
			.catch(e => { contentEl.setText(e.message) })
	}

	onClose() {
		const { contentEl } = this;
		contentEl.empty();
	}
}

class SampleSettingTab extends PluginSettingTab {
	plugin: MyPlugin;

	constructor(app: App, plugin: MyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('API url')
			.setDesc('Cloud agent url')
			.addText(text => text
				.setPlaceholder('Enter url')
				.setValue(this.plugin.settings.apiUrl)
				.onChange(async (value) => {
					this.plugin.settings.apiUrl = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('API key')
			.setDesc('Cloud agent API key')
			.addText(text => text
				.setPlaceholder('Enter api key')
				.setValue(this.plugin.settings.apiKey)
				.onChange(async (value) => {
					this.plugin.settings.apiKey = value;
					await this.plugin.saveSettings();
				}));
		new Setting(containerEl)
			.setName('Default DID')
			.setDesc('This DID will be used to sign your notes')
			.addText(text => text
				.setPlaceholder('Enter DID')
				.setValue(this.plugin.settings.did)
				.onChange(async (value) => {
					this.plugin.settings.did = value;
					await this.plugin.saveSettings();
				}));
	}
}
