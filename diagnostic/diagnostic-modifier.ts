import type * as TS from 'typescript'
import {Helper} from '../helper'
import {PairKeysMap} from '../utils'


// Where to find diagnostic codes:
// https://github.com/microsoft/TypeScript/blob/v5.6.3/src/compiler/diagnosticMessages.json


/** It helps to modify all the diagnostics of a source file. */
export class DiagnosticModifier {

	readonly startDiagnostics: TS.Diagnostic[]
	readonly sourceFile: TS.SourceFile
	readonly helper: Helper

	protected diagnosticsByStartAndCode: PairKeysMap<number, number, TS.Diagnostic> = new PairKeysMap()
	protected added: TS.Diagnostic[] = []
	protected deleted: TS.Diagnostic[] = []

	constructor(startDiagnostics: TS.Diagnostic[], sourceFile: TS.SourceFile, helper: Helper) {
		this.startDiagnostics = startDiagnostics
		this.sourceFile = sourceFile
		this.helper = helper
		this.initialize()
	}

	/** Initialize before visit a new source file. */
	protected initialize() {
		for (let diag of this.startDiagnostics) {
			if (diag.start !== undefined) {
				this.diagnosticsByStartAndCode.set(diag.start, diag.code, diag)
			}
		}
	}


	/** Add a never read diagnostic. */
	addNeverRead(node: TS.Node, message: string) {
		this.addByParameters(node.getStart(), node.getText().length, 6133, message, this.helper.ts.DiagnosticCategory.Error)
	}

	/** Add a missing import diagnostic. */
	addMissingImport(start: number, length: number, message: string) {
		this.addByParameters(start, length, 2304, message, this.helper.ts.DiagnosticCategory.Error)
	}

	/** Add a missing import diagnostic. */
	addMustBeComponent(start: number, length: number, message: string) {
		this.addByParameters(start, length, 2322, message, this.helper.ts.DiagnosticCategory.Error)
	}

	/** Add a custom diagnostic with code `0`. */
	addCustom(start: number, length: number, message: string, category: TS.DiagnosticCategory.Error = this.helper.ts.DiagnosticCategory.Error) {
		this.addByParameters(start, length, 0, message, category)
	}

	/** Add a diagnostic by parameters. */
	protected addByParameters(start: number, length: number, code: number, message: string, category: TS.DiagnosticCategory.Error) {
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

	/** Add a missing import diagnostic. */
	add(diag: TS.Diagnostic) {
		if (diag.start === undefined) {
			return
		}

		if (this.diagnosticsByStartAndCode.has(diag.start, diag.code)) {
			return
		}

		this.added.push(diag)
		this.diagnosticsByStartAndCode.set(diag.start, diag.code, diag)
	}


	/** Add usage of a import specifier node, delete it's diagnostic. */
	deleteNeverRead(node: TS.Node) {

		// If all imported members are not read,
		// diagnostic located at import declaration.
		if (this.helper.ts.isImportSpecifier(node)) {
			let importDecl = node.parent.parent.parent

			if (this.helper.ts.isImportDeclaration(importDecl)) {
				let start = importDecl.getStart()
				let diag = this.diagnosticsByStartAndCode.get(start, 6133)
				if (diag) {
					this.delete(importDecl, [6133])

					// Note not return here, all imports, and specified
					// import diagnostics exist at the same time.
				}
			}
		}

		// Diagnostic normally locate at declaration identifier.
		node = this.helper.getIdentifier(node) ?? node

		this.delete(node, [6133, 6196])
	}

	/** For binding multiple parameters `:bind=${a, b}`. */
	deleteUnusedComma(node: TS.Expression) {
		this.delete(node, [2695])
	}

	/** Delete diagnostic at specified node and code in limited codes. */
	protected delete(node: TS.Node, codes: number[]) {
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
