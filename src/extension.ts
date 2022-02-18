import * as vscode from 'vscode'
import { Dependency, Exclusion, Extension, Parent, Plugin, process, Profile, Tagable } from './mavenDomProcessor'

const POM_SELECTOR = { language: 'xml', pattern: '**/pom.xml' }

export function activate(context: vscode.ExtensionContext) {
	const provider = new PomFoldingRangeProvider()
	const disposable = vscode.languages.registerFoldingRangeProvider(POM_SELECTOR, provider)
	context.subscriptions.push(disposable)
}

class PomFoldingRangeProvider implements vscode.FoldingRangeProvider {
	provideFoldingRanges(document: vscode.TextDocument, context: vscode.FoldingContext, token: vscode.CancellationToken): vscode.ProviderResult<vscode.FoldingRange[]> {
		//TODO We can use text decorations: decorate start line when region is folded.
		//    Decorations are used by https://github.com/hoovercj/vscode-power-mode
		//    MS sample https://github.com/microsoft/vscode-extension-samples/tree/main/decorator-sample
		const text = document.getText()
		return descriptors(text).map(descriptor => new vscode.FoldingRange(
			document.positionAt(descriptor.start).line,
			document.positionAt(descriptor.end).line,
			vscode.FoldingRangeKind.Region
		))
	}
}

function descriptors(text: string): FoldingDescriptor[] {
	const result: FoldingDescriptor[] = []
	function addDescriptorIfPossible(tagable: Tagable) {
		result.push(new FoldingDescriptor(tagable.tag.start, tagable.tag.end))
	}

	process(text, {
		onParent: function (parent: Parent): void {
			addDescriptorIfPossible(parent)
		},
		onProfile: function (profile: Profile): void {
			addDescriptorIfPossible(profile)
		},
		onExtension: function (extension: Extension): void {
			addDescriptorIfPossible(extension)
		},
		onDependency: function (dependency: Dependency): void {
			addDescriptorIfPossible(dependency)
		},
		onExclusion: function (exclusion: Exclusion): void {
			addDescriptorIfPossible(exclusion)
		},
		onPlugin: function (plugin: Plugin): void {
			addDescriptorIfPossible(plugin)
		}
	})

	return result
}

class FoldingDescriptor {
	constructor(readonly start: number, readonly end: number){}
}
