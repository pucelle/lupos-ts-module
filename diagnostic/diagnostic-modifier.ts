import type * as TS from 'typescript'
import {Helper} from '../helper'
import {PairKeysMap} from '../utils'
import {DiagnosticCode} from './codes'


/** It helps to modify all the diagnostics of a source file. */
export class DiagnosticModifier {
	readonly helper: Helper

	protected startDiagnostics!: TS.Diagnostic[]
	protected sourceFile!: TS.SourceFile

	protected diagnosticsByStartAndCode: PairKeysMap<number, number, TS.Diagnostic> = new PairKeysMap()
	protected added: TS.Diagnostic[] = []
	protected deleted: TS.Diagnostic[] = []

	constructor(helper: Helper) {
		this.helper = helper
	}

	/** Initialize before visit a new source file. */
	setStart(startDiagnostics: TS.Diagnostic[], sourceFile: TS.SourceFile) {
		this.startDiagnostics = startDiagnostics
		this.sourceFile = sourceFile

		for (let diag of this.startDiagnostics) {
			if (diag.start !== undefined) {
				this.diagnosticsByStartAndCode.set(diag.start, diag.code, diag)
			}
		}
	}

	/** Add a diagnostic object. */
	addDiagnostic(diag: TS.Diagnostic) {
		if (diag.start === undefined) {
			return
		}

		if (this.diagnosticsByStartAndCode.has(diag.start, diag.code)) {
			return
		}

		this.added.push(diag)
		this.diagnosticsByStartAndCode.set(diag.start, diag.code, diag)
	}

	/** Add a diagnostic by parameters. */
	add(start: number, length: number, code: DiagnosticCode, message: string, category: TS.DiagnosticCategory = this.helper.ts.DiagnosticCategory.Error) {
		if (this.diagnosticsByStartAndCode.has(start, code)) {
			return
		}

		let diag: TS.Diagnostic = {
			category,
			code,
			messageText: message,
			file: this.sourceFile,
			start,
			length,
		}

		this.added.push(diag)
		this.diagnosticsByStartAndCode.set(start, code, diag)
	}

	/** 
	 * Add usage of a import specifier node, delete it's diagnostic.
	 * It will try to extend node and test if diagnostic located on whole import statement.
	 */
	deleteNeverReadFromNodeExtended(node: TS.Node) {

		// If all imported members are not read,
		// diagnostic located at import declaration.
		if (this.helper.ts.isImportSpecifier(node)) {
			let importDecl = node.parent.parent.parent

			if (this.helper.ts.isImportDeclaration(importDecl)) {
				let start = importDecl.getStart()
				let diag = this.diagnosticsByStartAndCode.get(start, 6133)
				if (diag) {
					this.deleteOfNode(importDecl, [6133])

					// Note not return here, all imports, and specified
					// import diagnostics exist at the same time.
				}
			}
		}

		// Diagnostic normally locate at declaration identifier.
		node = this.helper.getIdentifier(node) ?? node

		this.deleteOfNode(node, [6133, 6196])
	}

	/** For binding multiple parameters `:bind=${a, b}`. */
	deleteOfNode(node: TS.Node, codes: DiagnosticCode[]) {
		let start = node.getStart()

		for (let code of codes) {
			let diag = this.diagnosticsByStartAndCode.get(start, code)
			if (diag) {
				this.diagnosticsByStartAndCode.delete(start, code)
				this.deleted.push(diag)
			}
		}
	}

	/** Get all diagnostics after modified. */
	getModified() {
		let diags = this.startDiagnostics.filter(diag => !this.deleted.includes(diag))
		return [...diags, ...this.added]
	}
}
