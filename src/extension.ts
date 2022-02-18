import * as vscode from 'vscode'
import { ArtifactCoordinates, Dependency, Exclusion, Extension, Parent, Plugin, process, Profile, Tag, Tagable } from './mavenDomProcessor'

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

class FoldingDescriptor {
	constructor(readonly start: number, readonly end: number/*, readonly placeholder: string*/){}
}

function descriptors(text: string): FoldingDescriptor[] {
	const result: FoldingDescriptor[] = []
	function addDescriptorIfPossible(tag: Tag, placeholder?: string) {
		// if (!placeholder) {
		// 	return
		// }
		result.push(new FoldingDescriptor(tag.start, tag.end/*, placeholder*/))
	}

	process(text, {
		onParent: function (parent: Parent): void {
			addDescriptorIfPossible(parent.tag, describeParent(parent))
		},
		onProfile: function (profile: Profile): void {
			addDescriptorIfPossible(profile.tag, describeProfile(profile))
		},
		onExtension: function (extension: Extension): void {
			addDescriptorIfPossible(extension.tag, describeExtension(extension))
		},
		onDependency: function (dependency: Dependency): void {
			addDescriptorIfPossible(dependency.tag, describeDependency(dependency))
		},
		onExclusion: function (exclusion: Exclusion): void {
			addDescriptorIfPossible(exclusion.tag, describeExclusion(exclusion))
		},
		onPlugin: function (plugin: Plugin): void {
			addDescriptorIfPossible(plugin.tag, describePlugin(plugin))
		}
	})

	return result
}

const PART_SEPARATOR = ':'

function hasId(artifactCoordinates: ArtifactCoordinates) {
	return artifactCoordinates.groupId && artifactCoordinates.artifactId
}

function describeParent(parent: Parent): string | undefined {
	if (!hasId(parent)) {
		return
	}
	const version = parent.version;
	if (!version) {
		return
	}
	let sb = ''
	sb += parent.groupId
	sb = appendPartIfNotNull(sb, parent.artifactId)
	appendPartIfNotNull(sb, version)
	return sb
}

function describeProfile(profile: Profile): string | undefined {
	return profile.id;
}

function describeExtension(extension: Extension): string | undefined {
	const artifactId = extension.artifactId
	if (artifactId == null) {
		return
	}
	const groupId = extension.groupId
	let sb = ''
	if (groupId == null) {
		sb += artifactId
	} else {
		sb += groupId + PART_SEPARATOR + artifactId
	}
	appendPartIfNotNull(sb, extension.version);
	return sb
}

function describeDependency(dependency: Dependency): string | undefined {
	if (!hasId(dependency)) {
		return
	}
	let sb = ''
	sb += dependency.groupId
	appendPartIfNotNull(sb, dependency.artifactId)
	appendPartIfNotNull(sb, dependency.type)
	appendPartIfNotNull(sb, dependency.classifier)
	appendPartIfNotNull(sb, dependency.version)
	appendPartIfNotNull(sb, dependency.scope)
	return sb
}

function describeExclusion(exclusion: Exclusion): string | undefined {
	if (!hasId(exclusion)) {
		return
	}
	let sb = ''
	sb += exclusion.groupId
	appendPartIfNotNull(sb, exclusion.artifactId)
	return sb
}

function describePlugin(plugin: Plugin): string | undefined {
	const artifactId = plugin.artifactId
	if (artifactId == null) {
		return
	}
	const groupId = plugin.groupId
	let sb = ''
	if (groupId == null) {
		sb += artifactId
	} else {
		sb += groupId + PART_SEPARATOR + artifactId
	}
	appendPartIfNotNull(sb, plugin.version)
	return sb
}

function appendPartIfNotNull(sb: string, s?: string): string {
	if (!s) {
		return sb
	}
	return sb + PART_SEPARATOR + s
}
