import { SAXParser } from 'sax-ts'

export interface Callback {
    onParent(parent: Parent): void

    onProfile(profile: Profile): void

    onExtension(extension: Extension): void

    onDependency(dependency: Dependency): void

    onExclusion(exclusion: Exclusion): void

    onPlugin(plugin: Plugin): void
}

export interface Tagable {
    tag: Tag
}

export interface Tag {
    name: string,
    start: number,
    end: number
}

export interface ArtifactCoordinates {
    readonly groupId?: string,
    readonly artifactId?: string,
    readonly version?: string
}

export interface Parent extends Tagable, ArtifactCoordinates {
    readonly relativePath?: string
}

export interface Profile extends Tagable {
    readonly id?: string
}

export interface Extension extends Tagable, ArtifactCoordinates {}

export interface Dependency extends Tagable, ArtifactCoordinates {
    readonly type?: string,
    readonly classifier?: string,
    readonly scope?: string
}

export interface Exclusion extends Tagable, ArtifactCoordinates {}

export interface Plugin extends Tagable, ArtifactCoordinates {}

export function process(text: string, callback: Callback): void {
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
		const isFoldableTag = FOLDABLE_TAGS.has(tagPath(tagContexts, name))
		if (isFoldableTag) {
			// console.log('tagContext: ', tagContext)
            callbackTag(name, tagContext.startPosition, parser.position, callback)
		}
	}
	parser.write(text).close()
}

function callbackTag(name: string, start: number, end: number, callback: Callback) {
    const tag: Tag = { name, start, end }
    switch (name) {
        case 'parent': return callback.onParent({tag})
        case 'profile': return callback.onProfile({tag})
        case 'extension': return callback.onExtension({tag})
        case 'dependency': return callback.onDependency({tag})
        case 'exclusion': return callback.onExclusion({tag})
        case 'plugin': return callback.onPlugin({tag})
    }
}

class MySAXParser extends SAXParser {
	public position: number = 0

	constructor() {
        super(true, { position: true })
    }
}

class TagContext {
    constructor(
        readonly name: string,
        readonly startPosition: number,
    ){}
}

function tagPath(tagContexts: TagContext[], name: string) {
    return tagContexts.map(tagContext => tagContext.name).join('/') + '/' + name
}

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
