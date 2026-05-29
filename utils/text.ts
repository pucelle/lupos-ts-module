/** Trim text by removing all whitespaces close to `\r\n`. */
export function trimText(text: string) {
	return text.replace(/\s*[\r\n]\s*/g, '')
}


/** Trim a text list. */
export function trimTextList(texts: string[]): string[] {
	if (texts.length === 0) {
		return texts
	}

	for (let i = 0; i < texts.length; i++) {
		texts[i] = trimText(texts[i])
	}

	return texts
}
