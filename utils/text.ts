/** Trim text by removing `\r\n\t` and spaces in the front and end of each line. */
export function trimText(text: string) {
	return text.trim().replace(/\s*[\r\n]\s*/g, '')
}


/** Trim a text list. */
export function trimTextList(texts: string[]): string[] {
	if (texts.length === 0) {
		return texts
	}

	texts[0] = texts[0].trimStart()
	texts[texts.length - 1] = texts[texts.length - 1].trimEnd()

	for (let i = 0; i < texts.length; i++) {
		texts[i] = texts[i].replace(/\s*[\r\n]\s*/g, '')
	}

	return texts
}
