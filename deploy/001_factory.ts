import "@nomiclabs/hardhat-ethers";
import { parseUnits } from "ethers/lib/utils";
import "hardhat-deploy";
import { DeployFunction } from "hardhat-deploy/types";
import { HardhatRuntimeEnvironment } from "hardhat/types";

/*
 * Deploy a test ERC-20 token to be used as an underlying token in the Vault contract
 * This is skipped if the network is tagged as "production" in hardhat.config.ts
 */
const func: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
	const { deployments, getNamedAccounts } = hre;
	const { deploy, execute } = deployments;
	const namedAccounts = await getNamedAccounts();
	const { deployer } = namedAccounts;

	console.log(`Deployer: ${deployer}`);

	// // Hack for deployment on live network
	// if (hre.network.live) {
	// 	return;
	// }

	// Get tokens we are using for the current network
	const underlyingTokens = UnderlyingTokens.filter((details) => {
		return details.networks.includes(hre.network.name);
	});

	console.log("Underlying tokens: ", underlyingTokens);

	// For all tokens in ths list,
	for (const tokenDetails of underlyingTokens) {
		console.log("Deploying token: ", tokenDetails.deploymentName);

		// If there is a named account in hardhat.config.ts, use that. Don't deploy anything.
		if (namedAccounts[tokenDetails.deploymentName]) {
			console.log(
				"Using named account for token: ",
				tokenDetails.deploymentName
			);
			continue;
		}

		// Otherwise, deploy the token
		const constructorArguments = [
			tokenDetails.name,
			tokenDetails.symbol,
			tokenDetails.decimals
		];

		const underlying = await deploy(tokenDetails.deploymentName, {
			contract: "Token",
			from: deployer,
			args: constructorArguments,
			log: true,
			autoMine: true, // speed up deployment on local network (ganache, hardhat), no effect on live networks,
			skipIfAlreadyDeployed: true
		});

		// Mint some tokens if not production network
		if (underlying.newlyDeployed && tokenDetails.mock) {
			console.log(`${tokenDetails.symbol} deployed at ${underlying.address}`);
			await execute(
				tokenDetails.deploymentName,
				{ from: deployer, log: true },
				"mint",
				deployer,
				parseUnits(tokenDetails.mintAmount, tokenDetails.decimals)
			);
			console.log(
				`Minted ${tokenDetails.mintAmount} ${tokenDetails.symbol} to deployer`
			);
			const { faucet } = await getNamedAccounts();

			await execute(
				tokenDetails.deploymentName,
				{ from: deployer, log: true },
				"mint",
				faucet,
				parseUnits(tokenDetails.mintAmount, tokenDetails.decimals)
			);

			for (const testAccount of TestAccounts) {
				await execute(
					tokenDetails.deploymentName,
					{ from: deployer, log: true },
					"mint",
					testAccount.address,
					parseUnits(testAccount.prefundAmount, tokenDetails.decimals)
				);
			}
		}

		if (underlying.newlyDeployed) {
			if (hre.network.live) {
				// Verify
				setTimeout(async () => {
					await hre.run("verify:verify", {
						address: underlying.address,
						constructorArguments
					});
				}, 10000);
			}
		}
	}
};

export default func;
func.tags = ["factory"];
