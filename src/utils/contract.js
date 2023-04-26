import {Contract} from "ethers";
import sidContract from '@siddomains/sid-contracts/build/contracts/SID.json'
import resolverContract from '@siddomains/sid-contracts/build/contracts/Resolver.json'
import reverseRegistrarContract from '@siddomains/sid-contracts/build/contracts/ReverseRegistrar.json'

export function getResolverContract({address, provider}) {
    return new Contract(address, resolverContract, provider)
}

export function getSIDContract({address, provider}) {
    return new Contract(address, sidContract, provider)
}

export function getReverseRegistrarContract({address, provider}) {
    return new Contract(address, reverseRegistrarContract, provider)
}
