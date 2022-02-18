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

export interface Parent extends Tagable, ArtifactCoordinates {}

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
	let lastText = ''
	parser.onopentagstart = function(node: {name: string}) {
		const expectedProperties = FOLDABLE_TAGS.get(tagPath(tagContexts, node.name)) || new Set()
		tagContexts.push(new TagContext(node.name, parser.position, expectedProperties))
	}
	parser.ontext = function(text: string) {
		lastText = text
	}
	parser.onclosetag = function(name: string) {
		if (tagContexts.length == 0) {
			return
		}
		const tagContext = tagContexts.pop() as TagContext
		if (tagContext.name != name) {
			return
		}
		const isFoldableTag = FOLDABLE_TAGS.has(tagPath(tagContexts, name))
		if (isFoldableTag) {
            callbackTag(name, tagContext.startPosition, parser.position, tagContext.properties, callback)
		} else if (tagContexts.length > 0) {
			const parentTagContext = tagContexts[tagContexts.length - 1]
			if (parentTagContext.expectedProperties.has(name)) {
				parentTagContext.properties.set(name, lastText)
			}
		}
	}
	parser.write(text).close()
}

function callbackTag(name: string, start: number, end: number, properties: Map<string, string>, callback: Callback) {
    const tag: Tag = { name, start, end }
    switch (name) {
        case 'parent':
			const parent: Parent = {
				tag,
				groupId: properties.get('groupId'),
				artifactId: properties.get('artifactId'),
				version: properties.get('version'),
			}
			return callback.onParent(parent)
        case 'profile':
			const profile: Profile = {
				tag,
				id: properties.get('id')
			}
			return callback.onProfile(profile)
        case 'extension':
			const extension: Extension = {
				tag,
				groupId: properties.get('groupId'),
				artifactId: properties.get('artifactId'),
				version: properties.get('version'),
			}
			return callback.onExtension(extension)
        case 'dependency':
			const dependency: Dependency = {
				tag,
				groupId: properties.get('groupId'),
				artifactId: properties.get('artifactId'),
				version: properties.get('version'),
				type: properties.get('type'),
				classifier: properties.get('classifier'),
				scope: properties.get('scope'),
			}
			return callback.onDependency(dependency)
        case 'exclusion':
			const exclusion: Exclusion = {
				tag,
				groupId: properties.get('groupId'),
				artifactId: properties.get('artifactId'),
				version: properties.get('version'),
			}
			return callback.onExclusion(exclusion)
        case 'plugin':
			const plugin: Plugin = {
				tag,
				groupId: properties.get('groupId'),
				artifactId: properties.get('artifactId'),
				version: properties.get('version'),
			}
			return callback.onPlugin(plugin)
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
		readonly expectedProperties: Set<string>,
		readonly properties: Map<string, string> = new Map()
    ){}
}

function tagPath(tagContexts: TagContext[], name: string) {
    return tagContexts.map(tagContext => tagContext.name).join('/') + '/' + name
}

const ARTIFACT_COORDINATES_PROPERTIES = new Set(['groupId', 'artifactId', 'version'])
const PROFILE_PROPERTIES = new Set(['id'])
const DEPENDENCY_PROPERTIES = new Set([ ...ARTIFACT_COORDINATES_PROPERTIES, 'type', 'classifier', 'scope' ])
const FOLDABLE_TAGS: Map<string, Set<string>> = new Map()
addProjectFoldableTags(FOLDABLE_TAGS)

function addProjectFoldableTags(tags: Map<string, Set<string>>) {
	const prefix = 'project'

	tags.set(prefix + '/parent', ARTIFACT_COORDINATES_PROPERTIES)
	addModelBaseFoldableTags(tags, prefix)
	tags.set(prefix + '/profiles/profile', PROFILE_PROPERTIES)
	addModelBaseFoldableTags(tags, prefix + '/profiles/profile')
	tags.set(prefix + '/build/extensions/extension', ARTIFACT_COORDINATES_PROPERTIES)
}

function addModelBaseFoldableTags(tags: Map<string, Set<string>>, prefix: string) {
	addDependenciesFoldableTags(tags, prefix)
	addDependenciesFoldableTags(tags, prefix + '/dependencyManagement')
	addPluginsFoldableTags(tags, prefix + '/build')
	addPluginsFoldableTags(tags, prefix + '/build/pluginManagement')
}

function addDependenciesFoldableTags(tags: Map<string, Set<string>>, prefix: string) {
	tags.set(prefix + '/dependencies/dependency', DEPENDENCY_PROPERTIES)
	tags.set(prefix + '/dependencies/dependency/exclusions/exclusion', ARTIFACT_COORDINATES_PROPERTIES)
}

function addPluginsFoldableTags(tags: Map<string, Set<string>>, prefix: string) {
	tags.set(prefix + '/plugins/plugin', ARTIFACT_COORDINATES_PROPERTIES)
	addDependenciesFoldableTags(tags, prefix + '/plugins/plugin')
}
