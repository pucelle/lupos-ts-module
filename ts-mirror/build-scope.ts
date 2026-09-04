import type TS from 'typescript'
import {Analyzer, LuposComponent} from '../analyzer'
import {HTMLNode, TemplateSlotPlaceholder} from '../html-syntax'
import {TemplateBasis, TemplatePart, TemplatePartType} from '../template'
import {MirrorCapability} from './types'
import {buildBinding} from './build-binding'
import {buildProperty} from './build-property'
import {buildEvent} from './build-event'
import {buildElementExpression} from './build-element-expression'
import {LuposKnownInternalBindings} from '../complete-data'
import {MirrorInsertion, RelativeMapping, MirrorCheck} from './insertion-types'


const NAVIGATION_CAPABILITIES: readonly MirrorCapability[] = ['completion', 'definition', 'hover', 'references', 'rename']

/** One component element and the generated instance shared by its properties. */
interface ComponentUse {
	node: HTMLNode
	tagName: string
	component: LuposComponent
	instanceName: string
	constructorValue?: TS.Expression
}


/** Build component, property, binding, and event checks within one lexical scope. */
export function buildScope(parts: TemplatePart[], template: TemplateBasis, analyzer: Analyzer, createIdentifier: () => string) {
	let {helper, sourceFile, valueNodes: values} = template
	let text = ''
	let mappings: RelativeMapping[] = []
	let checkSpans: MirrorInsertion['checks'] = []
	let sourceDiagnosticExclusions: TS.TextSpan[] = []
	// First pass: allocate one generated instance per component element. Even a
	// property-less `<Card />` gets an instance, making template-only imports and
	// local declarations visible to TypeScript's unused-symbol analysis.
	let componentUses: ComponentUse[] = []
	let componentByNode: Map<HTMLNode, ComponentUse> = new Map()

	allocateComponents()

	let propertyParts = parts.filter(part => part.type === TemplatePartType.Property && !!part.mainName)

	// Every binding use needs its own instance and checked update call.
	let bindingParts = parts.filter(part => {
		return part.type === TemplatePartType.Binding
			&& !!part.mainName
			&& /^[$A-Z_a-z][$\w]*$/.test(part.mainName)
			&& (!!LuposKnownInternalBindings[part.mainName] || !!analyzer.getBindingByName(part.mainName, template))
	})

	emitComponents()
	emitProperties()
	emitBindings()
	emitEvents()

	return {
		text,
		mappings,
		checks: checkSpans,
		sourceDiagnosticExclusions,
	}

	/** Append a mapped check and suppress its original diagnostic copy. */
	function appendCheck(check: MirrorCheck, part: TemplatePart) {
		let checkStart = text.length
		text += check.text

		mappings.push(...check.mappings.map(mapping => ({
			...mapping,
			start: mapping.start + checkStart,
			end: mapping.end + checkStart,
		})))

		checkSpans.push({
			start: checkStart,
			end: text.length,
			fallbackStart: check.fallbackStart,
			fallbackEnd: check.fallbackEnd
		})

		let value = template.getPartUniqueValue(part)
		if (value) {
			sourceDiagnosticExclusions.push({
				start: value.getStart(sourceFile),
				length: value.getWidth(sourceFile)
			})
		}
	}


	/** Allocate one instance per component element. */
	function allocateComponents() {
		for (let part of parts) {
			if (part.type !== TemplatePartType.Component && part.type !== TemplatePartType.DynamicComponent) {
				continue
			}

			let tagName = part.node.tagName!
			let component = analyzer.getComponentByTagName(tagName, template)
			if (!component) {
				continue
			}

			let use: ComponentUse = {
				node: part.node,
				tagName,
				component,
				instanceName: createIdentifier(),
				constructorValue: part.type === TemplatePartType.DynamicComponent
					? values[TemplateSlotPlaceholder.getUniqueSlotIndex(tagName)!] : undefined,
			}
			
			componentUses.push(use)
			componentByNode.set(part.node, use)
		}

	}

	/** Emit component constructors and navigation anchors. */
	function emitComponents() {
		for (let use of componentUses) {
			
			// Constructor errors (required arguments, abstract classes, etc.) are mirror
			// artifacts. Only navigation capabilities are mapped for this identifier,
			// so the provider drops such diagnostics while retaining the symbol usage.
			text += `let ${use.instanceName} = new `
			let componentStart = text.length

			text += use.constructorValue
				? `(${sourceFile.text.slice(use.constructorValue.getStart(sourceFile), use.constructorValue.getEnd())})`
				: use.tagName

			let componentEnd = text.length
			text += '();'

			mappings.push({
				start: componentStart,
				end: componentEnd,
				originalStart: use.constructorValue?.getStart(sourceFile) ?? template.localOffsetToGlobal(use.node.nameStart),
				originalEnd: use.constructorValue?.getEnd() ?? template.localOffsetToGlobal(use.node.nameEnd),
				kind: 'symbol-anchor',
				capabilities: NAVIGATION_CAPABILITIES,
			})
		}

	}

	/** Emit property assignments against component or element instances. */
	function emitProperties() {
		let elementsByNode: Map<HTMLNode, string> = new Map()
		for (let part of propertyParts) {
			let component = componentByNode.get(part.node)

			// Match PropertySlotParser: '..' forces the component; '.' prefers an
			// existing component member and otherwise assigns to its attached element.
			let target = component && (part.namePrefix === '..'
				|| helper.types.typeOf(component.component.declaration).getProperty(part.mainName!))
				? component.instanceName : elementsByNode.get(part.node)

			if (!target) {

				// Leave unresolved component tags to the structural component diagnostic.
				if (!component && TemplateSlotPlaceholder.isComponent(part.node.tagName!)) {
					continue
				}

				target = createIdentifier()
				text += `let ${target} = ${buildElementExpression(part.node, template, component?.instanceName)};`
				elementsByNode.set(part.node, target)
			}

			appendCheck(buildProperty(part, template, sourceFile, target), part)
		}

	}

	/** Emit binding updates in attribute order. */
	function emitBindings() {

		let previousBindings: Map<HTMLNode, string> = new Map()

		for (let part of bindingParts) {
			let instanceName = createIdentifier()

			let check = buildBinding(part, template, analyzer, instanceName,
				componentByNode.get(part.node)?.instanceName, previousBindings.get(part.node), createIdentifier)

			appendCheck(check, part)
			previousBindings.set(part.node, instanceName)
		}
	}

	/** Route declared component events to on, and other events to the element. */
	function emitEvents() {
		for (let part of parts) {
			if (part.type !== TemplatePartType.Event || !part.mainName) {
				continue
			}

			let component = componentByNode.get(part.node)
			if (!component && TemplateSlotPlaceholder.isComponent(part.node.tagName!)) {
				continue
			}

			let beComponentEvent = !!component && (part.namePrefix === '@@'
				|| [...template.resolveComponentDeclarations(part.node.tagName!)].some(declaration => {
					let candidate = analyzer.getComponentByDeclaration(declaration)
					return !!candidate && !!analyzer.getComponentEvent(candidate, part.mainName!)
				}))

			appendCheck(buildEvent(part, template, component?.instanceName, beComponentEvent), part)
		}
	}
}
