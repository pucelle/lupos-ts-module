import type * as TS from 'typescript'
import {LuposBinding} from './types'
import {Helper, KnownInternalBindingNamesMap} from '../../lupos-ts-module'


/** Walk and Discover all lupos bindings from a given node and it's children. */
export function analyzeLuposBindings(sourceFile: TS.SourceFile, helper: Helper): LuposBinding[] {
	let bindings: LuposBinding[] = []

	// Only visit root class declarations.
	helper.ts.forEachChild(sourceFile, (node: TS.Node) => {
		if (helper.ts.isClassDeclaration(node)
			&& node.name
			&& (
				helper.class.isDerivedOf(node, 'Binding', '@pucelle/lupos.js')
				|| KnownInternalBindingNamesMap.has(node.name.text)
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
	if (sourceFile.fileName.includes('/lupos.js/')) {
		name = KnownInternalBindingNamesMap.get(name) || name
	}

	return {
		name,
		nameNode: node.name!,
		declaration: node,
		type: helper.types.typeOf(node),
		description: helper.getNodeDescription(node) || '',
		sourceFile,
	}
}