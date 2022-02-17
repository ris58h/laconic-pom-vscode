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

const FOLDABLE_TAG_PROPERTIES: Map<string, Set<string>> = new Map()
FOLDABLE_TAG_PROPERTIES.set('project/parent', new Set(['groupId', 'artifactId', 'version']))

class TagContext {
	constructor(
		readonly name: string,
		readonly startPosition: number,
		readonly properties: Map<string, string> = new Map(),
	){}
}

function extractRegions(text: string): Region[] {
	const result: Region[] = []
	const parser = new MySAXParser()
	const tagContexts: TagContext[] = []
	let lastText = ''
	parser.onopentagstart = function(node: {name: string}) {
		// console.log('onopentagstart: ', node.name)
		// console.log('position: ', parser.position)
		tagContexts.push(new TagContext(node.name, parser.position))
	}
	parser.ontext = function(text: string) {
		lastText = text
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
		const isFoldableTag = FOLDABLE_TAG_PROPERTIES.has(tagPath(tagContexts, tagContext.name))
		if (isFoldableTag) {
			result.push(new Region(tagContext.startPosition, parser.position))
			console.log('tagContext: ', tagContext)
			console.log('properties: ', tagContext.properties)
		} else if (tagContexts.length > 0) {
			const parentExpectedProps = FOLDABLE_TAG_PROPERTIES.get(tagPath(tagContexts))
			if (parentExpectedProps && parentExpectedProps.has(tagContext.name)) {
				const parentTagContext = tagContexts[tagContexts.length - 1]
				parentTagContext.properties.set(tagContext.name, lastText)
			}
		}
	}
	parser.write(text).close()
	return result
}

function tagPath(tagContexts: TagContext[], name?: string) {
	const path = tagContexts.map(tagContext => tagContext.name).join('/')
	return name ? (path + '/' + name) : path
}
