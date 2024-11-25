
/** `K => V[]` Map Struct. */
export class ListMap<K, V> {

	protected map: Map<K, V[]> = new Map()

	/** Iterate all keys. */
	keys(): Iterable<K> {
		return this.map.keys()
	}

	/** Iterate all values in list type. */
	valueLists(): Iterable<V[]> {
		return this.map.values()
	}

	/** Iterate all values. */
	*values(): Iterable<V> {
		for (let list of this.map.values()) {
			yield* list
		}
	}

	/** Iterate each key and associated value list. */
	entries(): Iterable<[K, V[]]> {
		return this.map.entries()
	}

	/** Iterate each key and each associated value after flatted. */
	*flatEntries(): Iterable<[K, V]> {
		for (let [key, values] of this.map.entries()) {
			for (let value of values) {
				yield [key, value]
			}
		}
	}

	/** Has specified key and value pair existed. */
	has(k: K, v: V): boolean {
		return !!this.map.get(k)?.includes(v)
	}

	/** Has specified key existed. */
	hasOf(k: K): boolean {
		return this.map.has(k)
	}

	/** Get the count of values by associated key. */
	countOf(k: K) {
		return this.map.get(k)?.length || 0
	}

	/** Get the count of all the keys. */
	keyCount(): number {
		return this.map.size
	}

	/** 
	 * Add a key and a value.
	 * Note it will not validate whether value exist,
	 * and will add value repeatedly although it exists.
	 */
	add(k: K, v: V) {
		let values = this.map.get(k)
		if (!values) {
			values = [v]
			this.map.set(k, values)
		}
		else {
			values.push(v)
		}
	}

	/** 
	 * Add a key and several values.
	 * Note it will not validate whether value exist,
	 * and will add value repeatedly although it exists.
	 */
	addSeveral(k: K, vs: V[]) {
		if (vs.length === 0) {
			return
		}

		let values = this.map.get(k)
		if (!values) {
			values = [...vs]
			this.map.set(k, values)
		}
		else {
			values.push(...vs)
		}
	}

	/** 
	 * Add a key and a value.
	 * Note it will validate whether value exist, and ignore if value exists.
	 */
	addIf(k: K, v: V) {
		let values = this.map.get(k)
		if (!values) {
			values = [v]
			this.map.set(k, values)
		}
		else if (!values.includes(v)) {
			values.push(v)
		}
	}

	/** 
	 * Add a key and a value.
	 * Note it will validate whether value exist, and ignore if value exists.
	 */
	addSeveralIf(k: K, vs: V[]) {
		if (vs.length === 0) {
			return
		}

		let values = this.map.get(k)
		if (!values) {
			values = []
			this.map.set(k, values)
		}

		for (let v of vs) {
			if (!values.includes(v)) {
				values.push(v)
			}
		}
	}

	/** Get value list by associated key. */
	get(k: K): V[] | undefined {
		return this.map.get(k)
	}

	/** Set and replace whole value list by associated key. */
	set(k: K, list: V[]) {
		return this.map.set(k, list)
	}

	/** Delete a key value pair. */
	delete(k: K, v: V) {
		let values = this.map.get(k)
		if (values) {
			let index = values.indexOf(v)
			if (index > -1) {
				values.splice(index, 1)
				
				if (values.length === 0) {
					this.map.delete(k)
				}
			}
		}
	}

	/** Delete all values by associated key. */
	deleteOf(k: K) {
		this.map.delete(k)
	}

	/** Clear all the data. */
	clear() {
		this.map = new Map()
	}
}


/** 
 * `K1 -> K2 -> V` Map Struct.
 * Index each value by a pair of keys.
 */
export class PairKeysMap<K1, K2, V> {

	private map: Map<K1, Map<K2, V>> = new Map()

	/** Iterate first keys. */
	firstKeys(): Iterable<K1> {
		return this.map.keys()
	}

	/** Iterate associated secondary keys after known first key. */
	*secondKeysOf(k1: K1): Iterable<K2> {
		let sub = this.map.get(k1)
		if (sub) {
			yield* sub.keys()
		}
	}

	/** Iterate all associated values after known first key. */
	*secondValuesOf(k1: K1): Iterable<V> {
		let sub = this.map.get(k1)
		if (sub) {
			yield* sub.values()
		}
	}

	/** Iterate all the values existed. */
	*values(): Iterable<V> {
		for (let secondary of this.map.values()) {
			yield* secondary.values()
		}
	}

	/** Iterate first key and associated secondary map. */
	entries(): Iterable<[K1, Map<K2, V>]> {
		return this.map.entries()
	}

	/** Iterate each key pairs and each value after flatted. */
	*flatEntries(): Iterable<[K1, K2, V]> {
		for (let [k1, sub] of this.map.entries()) {
			for (let [k2, v] of sub.entries()) {
				yield [k1, k2, v]
			}
		}
	}

	/** Iterate secondary key and associated value after known first key. */
	*secondEntriesOf(k1: K1): Iterable<[K2, V]> {
		let sub = this.map.get(k1)
		if (sub) {
			yield* sub.entries()
		}
	}

	/** Has associated value by key pair. */
	has(k1: K1, k2: K2): boolean {
		let sub = this.map.get(k1)
		if (!sub) {
			return false
		}

		return sub.has(k2)
	}

	/** Has secondary map existed for first key. */
	hasFirstKey(k1: K1): boolean {
		return this.map.has(k1)
	}
	
	/** Get the count of all the first keys. */
	firstKeyCount(): number {
		return this.map.size
	}

	/** Get the secondary key count by first key. */
	secondKeyCountOf(k1: K1) {
		return this.map.get(k1)?.size || 0
	}

	/** Get associated value by key pair. */
	get(k1: K1, k2: K2): V | undefined {
		let sub = this.map.get(k1)
		if (!sub) {
			return undefined
		}

		return sub.get(k2)
	}

	/** Set key pair and associated value. */
	set(k1: K1, k2: K2, v: V) {
		let sub = this.map.get(k1)
		if (!sub) {
			sub = new Map()
			this.map.set(k1, sub)
		}

		sub.set(k2, v)
	}

	/** Delete associated value by key pair. */
	delete(k1: K1, k2: K2) {
		let sub = this.map.get(k1)
		if (sub) {
			sub.delete(k2)

			if (sub.size === 0) {
				this.map.delete(k1)
			}
		}
	}

	/** Delete all associated secondary keys and values by first key. */
	deleteOf(k1: K1) {
		this.map.delete(k1)
	}

	/** Clear all the data. */
	clear() {
		this.map = new Map()
	}
}


/** 
 * `K1 -> K2 -> V` Map Struct.
 * Index single value by a pair of object keys.
 * Both `K1` and `K2` must be object type.
 */
export class WeakerPairKeysMap<K1 extends object, K2 extends object, V> {

	private map: WeakMap<K1, WeakMap<K2, V>> = new WeakMap();

	/** Has associated value by key pair. */
	has(k1: K1, k2: K2): boolean {
		let sub = this.map.get(k1)
		if (!sub) {
			return false
		}

		return sub.has(k2)
	}

	/** Has secondary map existed for first key. */
	hasSecondOf(k1: K1): boolean {
		return this.map.has(k1)
	}

	/** Get associated value by key pair. */
	get(k1: K1, k2: K2): V | undefined {
		let sub = this.map.get(k1)
		if (!sub) {
			return undefined
		}

		return sub.get(k2)
	}

	/** Set key pair and associated value. */
	set(k1: K1, k2: K2, v: V) {
		let sub = this.map.get(k1)
		if (!sub) {
			sub = new Map()
			this.map.set(k1, sub)
		}

		sub.set(k2, v)
	}

	/** Delete all the associated values by key pair. */
	delete(k1: K1, k2: K2) {
		let sub = this.map.get(k1)
		if (sub) {
			sub.delete(k2)
		}
	}

	/** Delete all associated secondary keys and values by first key. */
	deleteOf(k1: K1) {
		this.map.delete(k1)
	}

	/** Clear all the data. */
	clear() {
		this.map = new WeakMap()
	}
}