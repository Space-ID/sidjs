import {keccak_256 as sha3} from 'js-sha3'
import namehash from '@ensdomains/eth-ens-namehash'

export function encodeLabelhash(hash) {
    if (!hash.startsWith('0x')) {
        throw new Error('Expected label hash to start with 0x')
    }

    if (hash.length !== 66) {
        throw new Error('Expected label hash to have a length of 66')
    }

    return `[${hash.slice(2)}]`
}

export function decodeLabelhash(hash) {
    if (!(hash.startsWith('[') && hash.endsWith(']'))) {
        throw Error(
            'Expected encoded labelhash to start and end with square brackets'
        )
    }

    if (hash.length !== 66) {
        throw Error('Expected encoded labelhash to have a length of 66')
    }

    return `${hash.slice(1, -1)}`
}

export function isEncodedLabelhash(hash) {
    return hash.startsWith('[') && hash.endsWith(']') && hash.length === 66
}

export function isDecrypted(name) {
    const nameArray = name.split('.')
    const decrypted = nameArray.reduce((acc, label) => {
        if (acc === false) return false
        return isEncodedLabelhash(label) ? false : true
    }, true)

    return decrypted
}

export function labelhash(unnormalisedLabelOrLabelhash) {
    return isEncodedLabelhash(unnormalisedLabelOrLabelhash)
        ? '0x' + decodeLabelhash(unnormalisedLabelOrLabelhash)
        : '0x' + sha3(namehash.normalize(unnormalisedLabelOrLabelhash))
}
