import {ethers, BigNumber, utils} from 'ethers'

const Provider = ethers.providers.Provider
import {formatsByName} from '@siddomains/address-encoder'
import {abi as sidContract} from '@siddomains/sid/build/contracts/SID.json'
import {abi as resolverContract} from '@siddomains/resolver/build/contracts/Resolver.json'
import {abi as reverseRegistrarContract} from '@siddomains/sid/build/contracts/ReverseRegistrar.json'

import {emptyAddress, namehash, labelhash, validateName} from './utils'
import {
    encodeContenthash,
    decodeContenthash,
} from './utils/contents'

function getSidAddress(networkId) {
  const id = parseInt(networkId);
  if ([97].includes(id)) {
    return '0xfFB52185b56603e0fd71De9de4F6f902f05EEA23'
  } else if ([1, 3, 4, 5].includes(id)) {
    return '0x00000000000C2E074eC69A0dFb2997BA6C7d2e1e'
  } else if ([56].includes(id)) {
    return '0x08CEd32a7f3eeC915Ba84415e9C07a7286977956'
  } else if ([421613].includes(id)) {
    return '0x1f70fc8de5669eaa8C9ce72257c94500DC5ff2E4'
  } else if ([42161].includes(id)) {
    return '0x4a067EE58e73ac5E4a43722E008DFdf65B2bF348'
  }
}

function getResolverContract({ address, provider }) {
  return new ethers.Contract(address, resolverContract, provider)
}

function getSIDContract({ address, provider }) {
  return new ethers.Contract(address, sidContract, provider)
}

function getReverseRegistrarContract({ address, provider }) {
  return new ethers.Contract(address, reverseRegistrarContract, provider)
}

async function getAddrWithResolver({name, key, resolverAddr, provider}) {
    try {
        const resolver = new ethers.providers.Resolver(provider, resolverAddr, name)

        const {coinType, encoder} = formatsByName[key]
        const hexCoinType = utils.hexZeroPad(BigNumber.from(coinType).toHexString(), 32)
        const addr = await resolver._fetchBytes('0xf1cb7e06', hexCoinType)
        if (addr === '0x' || !addr) return emptyAddress
        return encoder(Buffer.from(addr.slice(2), 'hex'))
    } catch (e) {
        console.log(e)
        console.warn(
            'Error getting addr on the resolver contract, are you sure the resolver address is a resolver contract?'
        )
        return emptyAddress
    }
}

async function setAddrWithResolver({
  name,
  key,
  address,
  resolverAddr,
  signer,
}) {
  const nh = namehash(name)
  const Resolver = getResolverContract({
    address: resolverAddr,
    provider: signer,
  })
  const { decoder, coinType } = formatsByName[key]
  let addressAsBytes
  if (!address || address === '') {
    addressAsBytes = Buffer.from('')
  } else {
    addressAsBytes = decoder(address)
  }
  return Resolver['setAddr(bytes32,uint256,bytes)'](
    nh,
    coinType,
    addressAsBytes
  )
}

async function getContentWithResolver({ name, resolverAddr, provider }) {
  const nh = namehash(name)
  if (parseInt(resolverAddr, 16) === 0) {
    return emptyAddress
  }
  try {
    const Resolver = getResolverContract({
      address: resolverAddr,
      provider,
    })
    const contentHashSignature = utils
      .solidityKeccak256(['string'], ['contenthash(bytes32)'])
      .slice(0, 10)

    const isContentHashSupported = await Resolver.supportsInterface(
      contentHashSignature
    )

    if (isContentHashSupported) {
      const { protocolType, decoded, error } = decodeContenthash(
        await Resolver.contenthash(nh)
      )
      if (error) {
        console.log('error decoding', error)
        return {
          value: emptyAddress,
          contentType: 'contenthash',
        }
      }
      return {
        value: `${protocolType}://${decoded}`,
        contentType: 'contenthash',
      }
    } else {
      const value = await Resolver.content(nh)
      return {
        value,
        contentType: 'oldcontent',
      }
    }
  } catch (e) {
    const message =
      'Error getting content on the resolver contract, are you sure the resolver address is a resolver contract?'
    console.warn(message, e)
    return { value: message, contentType: 'error' }
  }
}

async function setContenthashWithResolver({
  name,
  content,
  resolverAddr,
  signer,
}) {
  let encodedContenthash = content
  if (parseInt(content, 16) !== 0) {
    encodedContenthash = encodeContenthash(content)
  }
  const Resolver = getResolverContract({
    address: resolverAddr,
    provider: signer,
  })
  return Resolver.setContenthash(namehash(name), encodedContenthash)
}

async function getTextWithResolver({ name, key, resolverAddr, provider }) {
  const nh = namehash(name)
  if (parseInt(resolverAddr, 16) === 0) {
    return ''
  }
  try {
    const Resolver = getResolverContract({
      address: resolverAddr,
      provider,
    })
    const addr = await Resolver.text(nh, key)
    return addr
  } catch (e) {
    console.warn(
      'Error getting text record on the resolver contract, are you sure the resolver address is a resolver contract?'
    )
    return ''
  }
}

async function setTextWithResolver({
  name,
  key,
  recordValue,
  resolverAddr,
  signer,
}) {
  const nh = namehash(name)
  return getResolverContract({
    address: resolverAddr,
    provider: signer,
  }).setText(nh, key, recordValue)
}

class Resolver {
  //TODO
  constructor({ address, sid }) {
    this.address = address
    this.sid = sid
  }
  name(name) {
    return new Name({
      name,
      sid: this.sid,
      provider: this.provider,
      signer: this.signer,
      resolver: this.address,
    })
  }
}

class Name {
  constructor(options) {
    const { name, sid, provider, signer, namehash: nh, resolver } = options
    if (options.namehash) {
      this.namehash = nh
    }
    this.sid = sid
    this.sidWithSigner = this.sid.connect(signer)
    this.name = name
    this.namehash = namehash(name)
    this.provider = provider
    this.signer = signer
    this.resolver = resolver
  }

  async getOwner() {
    return this.sid.owner(this.namehash)
  }

  async setOwner(address) {
    if (!address) throw new Error('No newOwner address provided!')
    return this.sidWithSigner.setOwner(this.namehash, address)
  }

    async getResolver() {
        let currentName = this.name;
        let currentNamehash = this.namehash;
        while (true) {
            if (currentName === "" || currentName === ".") {
                return emptyAddress;
            }
            if (!currentName.includes('.')) {
                return emptyAddress;
            }
            const addr = await this.sid.resolver(currentNamehash)
            if (addr !== emptyAddress) {
                const resolver = getResolverContract({address: addr, provider: this.provider})
                if (currentName !== this.name && !(await resolver.supportsInterface("0x9061b923"))) {
                    return emptyAddress;
                }
                return addr
            }
            currentName = currentName.split(".").slice(1).join(".");
            currentNamehash = namehash(currentName);
        }
    }

  async setResolver(address) {
    if (!address) throw new Error('No resolver address provided!')
    return this.sidWithSigner.setResolver(this.namehash, address)
  }

  async getTTL() {
    return this.sid.ttl(this.namehash)
  }

  async getResolverAddr() {
    if (this.resolver) {
      return this.resolver // hardcoded for old resolvers or specific resolvers
    } else {
      return this.getResolver()
    }
  }

    async getAddress(coinId) {
        const resolverAddr = await this.getResolverAddr()
        if (parseInt(resolverAddr, 16) === 0) return emptyAddress
        if (!coinId) {
            const resolver = new ethers.providers.Resolver(this.provider, resolverAddr, this.name)
            const res = await resolver.getAddress()
            return res ? res : emptyAddress
        }

    return getAddrWithResolver({
      name: this.name,
      key: coinId,
      resolverAddr,
      provider: this.provider,
    })
  }

  async setAddress(key, address) {
    if (!key) {
      throw new Error('No coinId provided')
    }

    if (!address) {
      throw new Error('No address provided')
    }
    const resolverAddr = await this.getResolverAddr()
    return setAddrWithResolver({
      name: this.name,
      key,
      address,
      resolverAddr,
      signer: this.signer,
    })
  }

  async getContent() {
    const resolverAddr = await this.getResolverAddr()
    return getContentWithResolver({
      name: this.name,
      resolverAddr,
      provider: this.provider,
    })
  }

  async setContenthash(content) {
    const resolverAddr = await this.getResolverAddr()
    console.log(content)
    return setContenthashWithResolver({
      name: this.name,
      content,
      resolverAddr,
      signer: this.signer,
    })
  }

  async getText(key) {
    const resolverAddr = await this.getResolverAddr()
    return getTextWithResolver({
      name: this.name,
      key,
      resolverAddr,
      provider: this.provider,
    })
  }

  async setText(key, recordValue) {
    const resolverAddr = await this.getResolverAddr()
    return setTextWithResolver({
      name: this.name,
      key,
      recordValue,
      resolverAddr,
      signer: this.signer,
    })
  }

  async setSubnodeOwner(label, newOwner) {
    const lh = labelhash(label)
    return this.sidWithSigner.setSubnodeOwner(this.namehash, lh, newOwner)
  }

  async setSubnodeRecord(label, newOwner, resolver, ttl = 0) {
    const lh = labelhash(label)
    return this.sidWithSigner.setSubnodeRecord(
      this.namehash,
      lh,
      newOwner,
      resolver,
      ttl
    )
  }

  async createSubdomain(label) {
    const resolverPromise = this.getResolver()
    const ownerPromise = this.getOwner()
    const [resolver, owner] = await Promise.all([resolverPromise, ownerPromise])
    return this.setSubnodeRecord(label, owner, resolver)
  }

  async deleteSubdomain(label) {
    return this.setSubnodeRecord(label, emptyAddress, emptyAddress)
  }
}

export default class SID {
  constructor(options) {
    const { networkId, provider, sidAddress } = options
    let ethersProvider
    if (Provider.isProvider(provider)) {
      //detect ethersProvider
      ethersProvider = provider
    } else {
      ethersProvider = new ethers.providers.Web3Provider(provider)
    }
    this.provider = ethersProvider
    this.signer = ethersProvider.getSigner()
    this.sid = getSIDContract({
      address: sidAddress ? sidAddress : registries[networkId],
      provider: ethersProvider,
    })
  }

  name(name) {
    validateName(name)
    return new Name({
      name,
      sid: this.sid,
      provider: this.provider,
      signer: this.signer,
    })
  }

  resolver(address) {
    return new Resolver({
      sid: this.sid,
      provider: this.provider,
      address: address,
    })
  }

  async getName(address) {
    const reverseNode = `${address.slice(2)}.addr.reverse`
    const resolverAddr = await this.sid.resolver(namehash(reverseNode))
    const res = await this.getNameWithResolver(address, resolverAddr)
    if (!res.name) {
      return res;
    }
    try {
      const addr = await this.name(res.name).getAddress()
      if (addr.toLowerCase() === address.toLowerCase()) {
        return res
      } else {
        return {name: null}
      }
    } catch (e) {
      console.error(e);
      return {name: null}
    }
  }

  async getNameWithResolver(address, resolverAddr) {
    const reverseNode = `${address.slice(2)}.addr.reverse`
    const reverseNamehash = namehash(reverseNode)
    if (parseInt(resolverAddr, 16) === 0) {
      return {
        name: null,
      }
    }

    try {
      const Resolver = getResolverContract({
        address: resolverAddr,
        provider: this.provider,
      })
      const name = await Resolver.name(reverseNamehash)
      return {
        name,
      }
    } catch (e) {
      console.log(`Error getting name for reverse record of ${address}`, e)
    }
  }

  async setReverseRecord(name, overrides) {
    const reverseRegistrarAddr = await this.name('addr.reverse').getOwner(
      'addr.reverse'
    )
    const reverseRegistrar = getReverseRegistrarContract({
      address: reverseRegistrarAddr,
      provider: this.signer,
    })
    return reverseRegistrar.setName(name)
  }
}

export {
  namehash,
  labelhash,
  getSIDContract,
  getResolverContract,
  getSidAddress,
}
