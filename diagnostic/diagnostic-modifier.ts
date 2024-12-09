import type * as TS from 'typescript'
import {ts} from '../../core'
import {Helper} from '../helper'


// Where to find diagnostic codes:
// https://github.com/microsoft/TypeScript/blob/v5.6.3/src/compiler/diagnosticMessages.json


/** It helps to modify all the diagnostics of a source file. */
export class SourceFileDiagnosticModifier {

	readonly startDiagnostics: TS.Diagnostic[]
	readonly sourceFile: TS.SourceFile
	readonly helper: Helper

	protected diagnosticByStart: Map<number, TS.Diagnostic> = new Map()
	protected addedDiagnostics: TS.Diagnostic[] = []
	protected addedStartIndices: Set<number> = new Set()
	protected removedStartIndices: Set<number> = new Set()

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
				this.diagnosticByStart.set(diag.start, diag)
			}
		}
	}

	/** Add a never read diagnostic. */
	addNeverRead(node: TS.Node, message: string) {
		this.add(node.getStart(), node.getText().length, 6133, message)
	}

	/** Add a missing import diagnostic. */
	addMissingImport(start: number, length: number, message: string) {
		this.add(start, length, 2304, message)
	}

	/** Add a custom diagnostic. */
	addCustom(start: number, length: number, message: string) {
		this.add(start, length, 0, message)
	}

	/** Add a missing import diagnostic. */
	protected add(start: number, length: number, code: number, message: string) {
		if (this.addedStartIndices.has(start)) {
			return
		}

		let diag: TS.Diagnostic = {
			category: ts.DiagnosticCategory.Error,
			code,
			messageText: message,
			file: this.sourceFile,
			start,
			length,
		}

		this.addedDiagnostics.push(diag)
		this.addedStartIndices.add(start)
		this.diagnosticByStart.set(start, diag)
	}


	/** Add usage of a import specifier node, remove it's diagnostic. */
	removeNeverRead(node: TS.Node) {

		// If all imported members are not read,
		// diagnostic located at import declaration.
		if (ts.isImportSpecifier(node)) {
			let importDecl = node.parent.parent.parent

			if (ts.isImportDeclaration(importDecl)) {
				let start = importDecl.getStart()
				let diag = this.diagnosticByStart.get(start)

				if (diag && diag.code === 6133) {
					this.remove(importDecl, [6133])

					// Note not return here, all imports, and specified
					// import diagnostics exist at the same time.
				}
			}
		}

		// Diagnostic normally locate at declaration identifier.
		node = this.helper.getIdentifier(node) ?? node

		this.remove(node, [6133, 6196])
	}

	/** For binding multiple parameters `:bind=${a, b}`. */
	removeUnusedComma(node: TS.Expression) {
		this.remove(node, [2695])
	}

	/** Remove diagnostic at specified node and code in limited codes. */
	protected remove(node: TS.Node, codes: number[]) {
		let start = node.getStart()

		if (this.removedStartIndices.has(start)) {
			return
		}

		let diag = this.diagnosticByStart.get(start)

		if (diag && diag.start === start && codes.includes(diag.code)) {
			this.removedStartIndices.add(start)
		}
	}
}
