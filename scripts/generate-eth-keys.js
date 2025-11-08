/* eslint-env node */
/* eslint-disable no-undef */
const { ethers } = require("ethers");

function gen() {
  const wallet = ethers.Wallet.createRandom();
  return { privateKey: wallet.privateKey, address: wallet.address };
}

const deployer = gen();
const relayer = gen();

console.log(`# Add these lines to .env.local (do NOT commit .env.local). Set file perms: chmod 600 .env.local`);
console.log(`PRIVATE_KEY_DEPLOYER=${deployer.privateKey}`);
console.log(`DEPLOYER_ADDRESS=${deployer.address}`);
console.log(`PRIVATE_KEY_RELAYER=${relayer.privateKey}`);
console.log(`RELAYER_ADDRESS=${relayer.address}`);