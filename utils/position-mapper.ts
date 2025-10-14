export class PositionMapper {

	private fromTo: {from: number, to: number}[] = []
	private indexCache: number = 0

	/** Normally add a local and a global offset. */
	add(from: number, to: number) {
		this.fromTo.push({from, to})
	}

	/** 
	 * Normally map a local offset to a global offset.
	 * Map continuously when `from` increase each time.
	 */
	mapInOrder(from: number): number {
		if (this.fromTo.length === 0) {
			return from
		}

		let index = this.findIndexInOrder(from)
		let diff = this.fromTo[index].to - this.fromTo[index].from

		return from + diff
	}

	private findIndexInOrder(from: number) {
		let index = this.indexCache

		if (this.fromTo[index].from <= from) {

			// Cache available.
			if (index === this.fromTo.length - 1
				|| this.fromTo[index + 1].from > from
			) {
				return index
			}
			
			// Cache expire, but can look after to find cache.
			for (let i = index + 1; i < this.fromTo.length - 1; i++) {
				if (this.fromTo[i + 1].from > from) {
					return this.indexCache = i
				}
			}
		}

		// Find from start position.
		return this.indexCache = this.findIndex(from)
	}

	/** Normally map a local offset to a global offset. */
	map(from: number): number {
		if (this.fromTo.length === 0) {
			return from
		}

		let index = this.findIndex(from)
		let diff = this.fromTo[index].to - this.fromTo[index].from

		return from + diff
	}

	private findIndex(from: number) {
		for (let i = 0; i < this.fromTo.length - 1; i++) {
			if (this.fromTo[i + 1].from > from) {
				return i
			}
		}

		return this.fromTo.length - 1
	}

	/** Normally map a global offset to a local offset. */
	backMap(to: number): number {
		if (this.fromTo.length === 0) {
			return to
		}

		let index = this.backFindIndex(to)
		let diff = this.fromTo[index].to - this.fromTo[index].from

		return to - diff
	}

	private backFindIndex(to: number) {
		for (let i = 0; i < this.fromTo.length - 1; i++) {
			if (this.fromTo[i + 1].to > to) {
				return i
			}
		}

		return this.fromTo.length - 1
	}
}