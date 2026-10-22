import type TS from 'typescript'
import {LuposBinding} from './types'
import {Helper} from '../helper'
import {LUPOS_KNOWN_INTERNAL_BINDING_NAMES_MAP} from '../complete-data/lupos-internal-bindings'


/** Walk and Discover all lupos bindings from a given node and it's children. */
export function analyzeLuposBindings(sourceFile: TS.SourceFile, helper: Helper): LuposBinding[] {
	let bindings: LuposBinding[] = []

	// Only visit root class declarations.
	helper.ts.forEachChild(sourceFile, (node: TS.Node) => {
		if (helper.ts.isClassDeclaration(node)
			&& node.name
			&& (
				helper.class.isImplementedOf(node, 'Binding', 'lupos.html')
				|| LUPOS_KNOWN_INTERNAL_BINDING_NAMES_MAP.has(node.name.text)
			)
		) {
			bindings.push(createLuposBinding(node, helper))
		}
	})

	return bindings
}


/** Can use it to create custom object. */
export function createLuposBinding(node: TS.ClassDeclaration, helper: Helper): LuposBinding {
	let name = node.name!.text
	let sourceFile = node.getSourceFile()

	// `ClassBinding` -> `class`
	if (sourceFile.fileName.includes('/lupos.html/')) {
		name = LUPOS_KNOWN_INTERNAL_BINDING_NAMES_MAP.get(name) || name
	}

	return {
		name,
		nameNode: node.name!,
		declaration: node,
		description: helper.getNodeDescription(node) || '',
		sourceFile,
	}
}