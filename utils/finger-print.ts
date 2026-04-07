import * as crypto from 'crypto'


let salt: string = ''
let index = 0


export function setFingerPrintSalt(theSalt: string) {
	salt = theSalt
}


export function generateFingerPrint(length: number) {
	return crypto.createHash('md5').update(salt + '_' + index).digest('hex').slice(0, length)
}
