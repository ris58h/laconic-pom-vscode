import * as vscode from 'vscode'
import { SAXParser } from 'sax-ts'

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
		const regions = extractRegions(text)
		return regions.map(region => new vscode.FoldingRange(
			document.positionAt(region.start).line,
			document.positionAt(region.end).line,
			vscode.FoldingRangeKind.Region
		))
	}
}

class Region {
	constructor(readonly start: number, readonly end: number){}
}

class MySAXParser extends SAXParser {
	public position: number = 0

	constructor() {
        super(true, { position: true })
    }
}

//TODO refactor the code below
const FOLDABLE_TAGS: Set<string> = new Set()
addProjectFoldableTags(FOLDABLE_TAGS)

function addProjectFoldableTags(tags: Set<string>) {
	const prefix = 'project'

	tags.add(prefix + '/parent')
	addModelBaseFoldableTags(tags, prefix)
	tags.add(prefix + '/profiles/profile')
	addModelBaseFoldableTags(tags, prefix + '/profiles/profile')
	tags.add(prefix + '/build/extensions/extension')
}

function addModelBaseFoldableTags(tags: Set<string>, prefix: string) {
	addDependenciesFoldableTags(tags, prefix)
	addDependenciesFoldableTags(tags, prefix + '/dependencyManagement')
	addPluginsFoldableTags(tags, prefix + '/build')
	addPluginsFoldableTags(tags, prefix + '/build/pluginManagement')
}

function addDependenciesFoldableTags(tags: Set<string>, prefix: string) {
	tags.add(prefix + '/dependencies/dependency')
	tags.add(prefix + '/dependencies/dependency/exclusions/exclusion')
}

function addPluginsFoldableTags(tags: Set<string>, prefix: string) {
	tags.add(prefix + '/plugins/plugin')
	addDependenciesFoldableTags(tags, prefix + '/plugins/plugin')
}

class TagContext {
	constructor(
		readonly name: string,
		readonly startPosition: number,
	){}
}

function extractRegions(text: string): Region[] {
	const result: Region[] = []
	const parser = new MySAXParser()
	const tagContexts: TagContext[] = []
	parser.onopentagstart = function(node: {name: string}) {
		// console.log('onopentagstart: ', node.name)
		// console.log('position: ', parser.position)
		tagContexts.push(new TagContext(node.name, parser.position))
	}
	parser.onclosetag = function(name: string) {
		// console.log('onclosetag: ', name)
		// console.log('position: ', parser.position)
		if (tagContexts.length == 0) {
			return
		}
		const tagContext = tagContexts.pop() as TagContext
		if (tagContext.name != name) {
			return
		}
		const isFoldableTag = FOLDABLE_TAGS.has(tagPath(tagContexts, tagContext.name))
		if (isFoldableTag) {
			result.push(new Region(tagContext.startPosition, parser.position))
			console.log('tagContext: ', tagContext)
		}
	}
	parser.write(text).close()
	return result
}

function tagPath(tagContexts: TagContext[], name: string) {
	return tagContexts.map(tagContext => tagContext.name).join('/') + '/' + name
}
