import {ethers} from 'ethers'
import {validate as ensValidate} from '@ensdomains/ens-validation'
import toArray from 'lodash.toarray'
import {
    isEncodedLabelhash,
    isDecrypted,
    decodeLabelhash,
    encodeLabelhash,
    labelhash,
} from './labelhash'
import {
    encodeContenthash,
    decodeContenthash,
    isValidContenthash,
} from './contents'
import ensNamehash from '@ensdomains/eth-ens-namehash'
import {namehash} from './namehash'
import whitelist from "../constants/whitelist";

//import { checkLabelHash } from '../updaters/preImageDB'

const uniq = (a, param) =>
    a.filter(
        (item, pos) =>
            a.map((mapItem) => mapItem[param]).indexOf(item[param]) === pos
    )

const checkLabels = (...labelHashes) => labelHashes.map((hash) => null)

function getEnsStartBlock(networkId) {
    switch (networkId) {
        case 1:
        case '1':
            return 3327417
        case 3:
        case '3':
            return 25409
        default:
            return 0
    }
}

// export const checkLabels = (...labelHashes) =>
//   labelHashes.map(labelHash => checkLabelHash(labelHash) || null)

const mergeLabels = (labels1, labels2) =>
    labels1.map((label, index) => (label ? label : labels2[index]))

function validateLabelLength(name) {
    if (!name) {
        return false
    }
    const len = toArray(name).length
    if (len < 3 || len > 512) {
        return false
    }
    let normalizedValue
    try {
        normalizedValue = ensNamehash.normalize(name)
    } catch (e) {
        normalizedValue = name
    }
    if (normalizedValue.length < 3 || normalizedValue.length > 512) {
        return false
    }
    return true
}

function validateDomains(value, tld) {
    const isNotEns = tld?.toLowerCase() !== 'eth'
    // black list
    // ASCII中的十进制: 0-44, 46-47, 58-94, 96, 123-127;
    // unicode: \u200b, \u200c, \u200d, \ufeff
    const blackList =
        // eslint-disable-next-line no-control-regex
        /[\u0000-\u002c\u002e-\u002f\u003a-\u0040\u005b-\u005e\u0060\u007b-\u007f\u200b\u200c\u200d\ufeff]/g
    if (isNotEns && blackList.test(value)) {
        return false
    } else if (!ensValidate(value)) {
        return false
    }
    return true
}

function validateName(name) {
    if (!name) {
        throw new Error('Invalid name');
    }
    const labelArr = name.split('.');
    let domain = name;
    let suffix = '';
    if (labelArr.length > 1) {
        domain = labelArr.slice(0, labelArr.length - 1).join('.');
        suffix = labelArr[labelArr.length - 1];
    }
    if (labelArr.length === 3 && suffix.toLowerCase() === 'bnb' && labelArr[1].toLowerCase() === 'eth') {
        domain = labelArr[0]
    }
    const hasEmptyLabels = labelArr.filter((e) => e.length < 1).length > 0
    if (hasEmptyLabels) throw new Error('Domain cannot have empty labels');
    if (!validateLabelLength(domain) && !whitelist.includes(name.toLowerCase())) {
        throw new Error('Invalid name');
    }
    if (!validateDomains(domain, suffix)) throw new Error('Invalid name');
    const normalizedArray = labelArr.map((label) => {
        return isEncodedLabelhash(label) ? label : ensNamehash.normalize(label)
    })
    try {
        return normalizedArray.join('.')
    } catch (e) {
        throw e
    }
}

function normalize(name) {
    const nameArray = name.split('.')
    const normalizedArray = nameArray.map((label) => {
        return isEncodedLabelhash(label) ? label : ensNamehash.normalize(label)
    })
    return normalizedArray.join('.')
}

function isLabelValid(name) {
    try {
        validateName(name)
        if (name.indexOf('.') === -1) {
            return true
        }
    } catch (e) {
        console.log(e)
        return false
    }
}

const parseSearchTerm = (term, validTld) => {
    let regex = /[^.]+$/

    try {
        validateName(term)
    } catch (e) {
        return 'invalid'
    }

    if (term.indexOf('.') !== -1) {
        const termArray = term.split('.')
        const tld = term.match(regex) ? term.match(regex)[0] : ''
        if (validTld) {
            if (tld === 'bnb' && termArray[termArray.length - 2].length < 3) {
                return 'short'
            }
            return 'supported'
        }

        return 'unsupported'
    } else if (ethers.utils.isAddress(term)) {
        return 'address'
    } else {
        //check if the search term is actually a tld
        if (validTld) {
            return 'tld'
        }
        return 'search'
    }
}

const emptyAddress = '0x0000000000000000000000000000000000000000'

export {
    // general utils
    uniq,
    emptyAddress,
    getEnsStartBlock,
    checkLabels,
    mergeLabels,
    // name validation
    validateName,
    parseSearchTerm,
    isLabelValid,
    // labelhash utils
    labelhash,
    isEncodedLabelhash,
    isDecrypted,
    decodeLabelhash,
    encodeLabelhash,
    // namehash utils
    namehash,
    normalize,
    // contents utils
    encodeContenthash,
    decodeContenthash,
    isValidContenthash,
}
