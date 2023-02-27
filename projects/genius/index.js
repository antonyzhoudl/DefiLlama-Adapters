/* Genius staking operates on two models:
*  - Direct staking with GENI token.
*    - Policy: Basic (basicLockedMinersSupply())
*      Lower APR, no penalties for early or late end staking.
*    - Policy: Advanced (advLockedMinersSupply())
*      Higher APR, penalties for early or late end staking.
*  - Debt based staking with deposited collateral
*     Collateral deposits enables GENI borrow.
*     GENI is locked back in the pool when the collateral debt is settled
*     Locked GENI are waiting for collateral to be settled for it.
*     While it's waiting it is generating yield.
*
*  `Staking` and `mining` are used interchangeably in Genius
*
* Genius TVL is the sum of all locked supported collateral in the debt pool
* The list of supported collateral is provided.
*
* */
const sdk = require("@defillama/sdk");
const BigNumber = require("bignumber.js");

const geniusAbi = require("./genius-abi.json");
const stabilityAbi = require("./genius-stability-abi.json");

/* Genius staking contract*/
const GENIUS_CONTRACT = "0x444444444444C1a66F394025Ac839A535246FCc8";
/* Genius stability pool / debt contract*/
const STABILITY_POOL = "0xDCA692d433Fe291ef72c84652Af2fe04DA4B4444";

/* Native currencies and ERC-20 tokens approved for collateral*/
const STABILITY_POOL_COLLATERAL_ADDRESSES = {
  "bsc": {
    "BUSD": "0xe9e7CEA3DedcA5984780Bafc599bD69ADd087D56"
    // "BNB": "0x0000000000000000000000000000000000000000"
  },
  "ethereum": {
    "DAI": "0x6B175474E89094C44Da98b954EedeAC495271d0F"
    // "ETH": "0x0000000000000000000000000000000000000000"
  },
  "avalanche": {
    "USDC": "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E"
    // "AVAX": "0x0000000000000000000000000000000000000000"
  },
  "polygon": {
    "DAI": "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063"
    // "MATIC": "0x0000000000000000000000000000000000000000"
  }
};

async function tvl(_, _1, _2, { api }) {
  const balances = {};
  const chain = api.chain;

  /* collect locked collateral for a token */
  for (const collateral in STABILITY_POOL_COLLATERAL_ADDRESSES[chain]) {
    const { output: decimals } = await sdk.api.erc20.decimals(STABILITY_POOL_COLLATERAL_ADDRESSES[chain][collateral], chain);
    let { output: balance } = await sdk.api.erc20.balanceOf(
      {
        target: STABILITY_POOL_COLLATERAL_ADDRESSES[chain][collateral],
        owner: STABILITY_POOL,
        chain
      });
    balance = await new BigNumber(balance).div(10 ** decimals).toFixed(4);
    // console.log(`[${chain}]: Adding token balance for: ${collateral} of: ${balance}`)
    sdk.util.sumSingleBalance(balances, GENIUS_CONTRACT, parseFloat(balance));
  }

  /* collect locked collateral for a native currency */
  const output = await sdk.api.eth.getBalance({ target: STABILITY_POOL, chain: chain });
  let nativeAmount = await new BigNumber(output.output).div(10 ** 18).toFixed(4);
  // console.log(`[${chain}]: Adding native currency balance: ${nativeAmount}`)
  sdk.util.sumSingleBalance(balances, GENIUS_CONTRACT, parseFloat(nativeAmount));

  return balances;
}

async function staking(_, _1, _2, { api }) {
  const balances = {};
  /* Collect Basic miner locked */
  const basicLockedMinersSupply = await api.call({
    target: GENIUS_CONTRACT,
    abi: geniusAbi.basicLockedSupply
  });
  /* Collect Advanced miner locked */
  const advLockedMinersSupply = await api.call({
    target: GENIUS_CONTRACT,
    abi: geniusAbi.advLockedSupply
  });
  /* Collect settled GENI in stability pool (locked waiting for collateral return) */
  const totalSettledGenitos = await api.call({
    target: STABILITY_POOL,
    abi: stabilityAbi.totalSettledGenitos
  });
  sdk.util.sumSingleBalance(balances, GENIUS_CONTRACT, basicLockedMinersSupply);
  sdk.util.sumSingleBalance(balances, GENIUS_CONTRACT, advLockedMinersSupply);
  sdk.util.sumSingleBalance(balances, GENIUS_CONTRACT, totalSettledGenitos);
  return balances;
}

module.exports = {
  methodology:
`Staking: counts the number of GENI tokens locked in Basic and Advanced miners per chain.
TVL: counts total number of value locked of all collateral tokens and native in the debt pool per chain.
`,
  ethereum: {
    staking,
    tvl
  },
  bsc: {
    staking,
    tvl
  },
  polygon: {
    staking,
    tvl
  },
  avax: {
    staking,
    tvl
  }
};
