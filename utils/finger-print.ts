import * as crypto from 'crypto'


let salt: string = ''
let index = 0


export function setFingerPrintSalt(theSalt: string) {
	salt = theSalt
}


/** At length 6, 100 ids, have 0.0295% change of collision. */
export function generateFingerPrint(length: number = 6) {
	return crypto.createHash('md5').update(salt + '_' + index++).digest('hex').slice(0, length)
}
