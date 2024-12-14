// Where to find diagnostic codes:
// https://github.com/microsoft/TypeScript/blob/v5.6.3/src/compiler/diagnosticMessages.json


/** Diagnostic code. */
export enum DiagnosticCode {
	Custom = 0,
	MissingImportOrDeclaration = 2304,
	NotAssignable = 2322,
	NotExistOn = 2339,
	UnUsedComma = 2695,
	ValueNeverRead = 6133,
	MissingArgument = 6210,
	NeverRead = 6196,
	ControlTagNotValid = 30000,
	ControlTagMustFollowSpecified = 30001,
	ControlTagMustContainSpecified = 30002,
	ControlTagMustBeContainedIn = 30003,
	ControlTagMustBeLastChild = 30004,
}