import type * as TS from 'typescript'
import {ScopeTree} from '../scope'
import {HTMLRoot, TemplateSlotPlaceholder} from '../html-syntax'
import {PositionMapper} from '../utils'
import {Helper} from '../helper'
import {TemplatePart} from './parts-parser'


// This is no shared way to generate templates from a single source file,
// because in server, it generates all template directly,
// but in transformer, a template may be splitted to several html trees.


/** 
 * Handle a template of a source file.
 * You should extend it to generate part.
 */
export abstract class TemplateBasis {

	readonly tagName: 'html' | 'svg' | 'css'
	readonly node: TS.TemplateLiteral
	readonly scopeTree: ScopeTree
	readonly helper: Helper
	readonly globalStart: number
	readonly globalEnd: number

	readonly sourceFile: TS.SourceFile
	readonly component: TS.ClassDeclaration | undefined
	readonly fileName: string
	readonly root: HTMLRoot
	readonly valueNodes: TS.Expression[]

	/** Contents of the template string, Has substitutions replaced to `$LUPOS_SLOT_INDEX_\D$`. */
	readonly content: string

	/** Map virtual document offset to original offset in whole ts document. */
	readonly positionMapper: PositionMapper

	constructor(
		tagName: 'html' | 'svg' | 'css',
		node: TS.TemplateLiteral,
		content: string,
		root: HTMLRoot,
		valueNodes: TS.Expression[],
		positionMapper: PositionMapper,
		scopeTree: ScopeTree,
		helper: Helper
	) {
		this.tagName = tagName
		this.node = node
		this.scopeTree = scopeTree
		this.helper = helper

		this.component = helper.findOutward(node, helper.ts.isClassDeclaration)!
		this.sourceFile = node.getSourceFile()
		this.fileName = node.getSourceFile().fileName
		this.globalStart = node.getStart() + 1
		this.globalEnd = node.getEnd() - 1

		this.valueNodes = valueNodes
		this.content = content
		this.positionMapper = positionMapper
		this.root = root
	}

	/** Get imported or declared within current source file by name. */
	getReferenceByName(name: string): TS.Node | undefined {
		let importedOrDeclared = this.scopeTree.getReferenceByName(name, this.node)
		return importedOrDeclared
	}

	/** 
	 * Try resolve component declarations by component tag name.
	 * `tagName` can be a dynamic component interpolation.
	 */
	*resolveComponentDeclarations(tagName: string): Iterable<TS.ClassDeclaration> {
		let isNamedComponent = TemplateSlotPlaceholder.isNamedComponent(tagName)
		let isDynamicComponent = TemplateSlotPlaceholder.isDynamicComponent(tagName)

		if (!isNamedComponent && !isDynamicComponent) {
			return
		}

		// Resolve class declarations directly.
		if (isNamedComponent) {
			let ref = this.scopeTree.getReferenceByName(tagName, this.node)
			if (!ref) {
				return
			}

			let decls = this.helper.symbol.resolveDeclarations(ref, this.helper.ts.isClassDeclaration)
			if (decls) {
				yield* decls
			}
		}

		// Resolve instance type of constructor interface.
		else {
			let ref = this.valueNodes[TemplateSlotPlaceholder.getUniqueSlotIndex(tagName)!]
			let decls = this.helper.symbol.resolveDeclarations(ref, this.helper.ts.isClassDeclaration)
			if (decls && decls.length > 0) {
				yield* decls
				return
			}

			let typeNode = this.helper.types.getTypeNode(ref, false)
			if (typeNode) {
				yield* this.helper.symbol.resolveInstanceDeclarations(typeNode)
				return
			}
		}
	}

	/** Analyze part value type. */
	getPartValueType(part: TemplatePart): TS.Type {
		if (part.strings && part.valueIndices) {
			return this.helper.typeChecker.getStringType()
		}
		else if (part.strings) {
			return this.helper.typeChecker.getStringLiteralType(part.strings[0].text)
		}
		else if (part.valueIndices) {
			let valueNode = this.valueNodes[part.valueIndices[0].index]
			return this.helper.types.typeOf(valueNode)
		}
		else {
			return this.helper.typeChecker.getBooleanType()
		}
	}


	/** Convert template offset to local offset. */
	templateOffsetToLocal(templateOffset: number): number {
		return templateOffset
	}

	/** Convert local offset to template offset. */
	localOffsetToTemplate(localOffset: number): number {
		return localOffset
	}

	/** Convert global offset to local offset. */
	globalOffsetToLocal(globalOffset: number): number {
		return this.positionMapper.backMap(globalOffset)
	}

	/** Convert local offset to global offset. */
	localOffsetToGlobal(localOffset: number): number {
		return this.positionMapper.map(localOffset)
	}
}