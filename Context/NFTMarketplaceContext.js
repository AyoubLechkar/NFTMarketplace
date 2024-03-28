import React, { useState, useEffect, useContext } from "react";
import Wenb3Modal from "web3modal";
import { ethers } from "ethers";
import Router from "next/router";
import axios from "axios";
import { create as ipfsHttpClient } from "ipfs-http-client";

// const client = ipfsHttpClient("https://ipfs.infura.io:5001/api/v0");

const projectId = "your project id";
const projectSecrtKey = "project secretKey here";
const auth = `Basic${Buffer.from(`${projectId}:${projectSecrtKey}`).toString("base64")}`;
const subdomain = "your subdomain";

const client = ipfsHttpClient({
    host: "infura-ipfs.io",
    port: 5001,
    protocol:"https",
    headers: {
        authorization: auth,
    },
});

// INTERNAL IMPORT
import { NFTMarketplaceAddress, NFTMarketplaceABI } from "./constants";


//---FETCHING SMART CONTRACT
const fetchContract = (signerOrProvider) => 
    new ethers.Contract(
        NFTMarketplaceAddress,
        NFTMarketplaceABI,
        signerOrProvider
    );


    //---CONNECTING WITH SMART CONTRACT
    const connectingWithSmartContract = async()=> {
        try {
            const web3Modal = new Wenb3Modal();
            const connection = await web3Modal.connect();
            const provider = new ethers.providers.Web3Provider(connection);
            const signer = provider.getSigner();
            const contract = fetchContract(signer);
            return contract;
        } catch (error) {
            console.log("something went wrong while connecting with contract");
        }
    };

export const NFTMarketplaceContext = React.createContext();

// import { sign } from "crypto";
// import { createUnparsedSourceFile } from "typescript";


export const NFTMarketplaceProvider = ({ children }) => {
    const titleData = "Discover, collect, and sell NFTs";

    const checkContract = async()=> {
        const contract = await connectingWithSmartContract();
        console.log(contract);
    };

    // ------USESTATE
    const [currentAccount, setCurrentAccount] = useState("");

    //----CHECK IF WALLET IS CONNECTED
    const checkIfWalletConnected = async()=> {
        try {
            if(!window.ethereum) return console.log("Install Metamask");

            const accounts = await window.ethereum.request({
                method: "eth_accounts",
            });

            if(accounts.length){
                setCurrentAccount(accounts[0])
            } else {
                console.log("No Account Found");
            }
        } catch (error) {
            console.log("Something went wrong while connecting to wallet");
        }
    };

    useState(() => {
        checkIfWalletConnected();
    }, []);

    //---CONNECT WALLET FUNCTION
    const connectWallet = async()=> {
        try {
            if(!window.ethereum) return console.log("Install Metamask");

            const accounts = await window.ethereum.request({
                method: "eth_requestAccounts",
            });
            
            setCurrentAccount(accounts[0]);
            // window.location.reload();
        } catch (error) {
            console.log("Error while connecting to wallet");
        }
    };

    //---UPLOAD TO IPFS FUNCTION
    const uploadToPinata = async (file) => {
        if (file) {
            try {
                const formData = new FormData();
                formData.append("file", file);
                
                const resFile = await axios({
                    method: "post",
                    url: "https://api.pinata.cloud/pinning/pinFileTolPFS",
                    data: formData,
                    headers: {
                        pinata_api_key: `2862f665563ac63b43d0`,
                        pinata_secret_api_key: `6549564d8a2e3341488deae43b22c0cc0b3eca48520a9e85bab475e59da5c034`, 
                        "Content-Type": "multipart/form-data",
                    },
                });
                const ImgHash = `https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`; 

                return ImgHash;
                //const signer = contract.connect(provider.getSigner()); 
                // const signer = contract.connect(provider.getSigner()); 
                // signer.add(account, ImgHash);
            } catch (error) {
                alert("Unable to upload image to Pinata");
            }
        }
    };

    //---CREATE NFT FUNCTION
    const createNFT = async(formInput, fileUrl, router) => {
        
            const {name, description, price} = formInput;

            if(!name || !description || !price || !fileUrl)
                return console.log("Data Is Missing");

                const data = JSON.stringify({name, description, image: fileUrl});

                try {
                    const added = await client.add(data);

                    const url = `https://infura-ipfs.io/ipfs/${added.path}`;

                    await createSale(url, price);
                } catch (error) {
                    
                }
    };

    //---- CREATE SALE FUNCTION
    const createSale = async(url, formInputPrice, isResselling, id) => {
        try {
            
            const price = ethers.utils.parseUnits(formInputPrice, "ether");
            const contract = await connectingWithSmartContract()

            const listingPrice = await contract.getListingPrice();

            const transaction = !isResselling 
                ? await contract.createToken(url , price, {
                        value: listingPrice.toString(),
                    }) 
                : await contract.reSellToken(url, price, {
                        value: listingPrice.toString(),
                    });

                    await transaction.wait();
        } catch (error) {
            console.log("error while creating sale");
        }
    };

    //---- FETCH NFTS FUNCTION
    const fetchNFTs = async () => {
        try {
            const provider = new ethers.providers.JsonRpcProvider();
            const contract = fetchContract(provider);

            const data = await contract.fetchMarketItems();
            // console.log(data);

            const items = await Promise.all(
                data.map(
                    async ({ tokenId, seller, owner, price: unformattedPrice }) => {
                        const tokenURI = await contract.tokenURI(tokenId);
                        
                        const {
                            data: {image, name, description},
                        } = await axios.get(tokenURI);
                        const price = ethers.utils.formatUnits(
                            unformattedPrice.toString(),
                            "ether"
                        );

                        return {
                            price,
                            tokenId: tokenId.toNumber(),
                            seller,
                            owner,
                            image,
                            name,
                            description,
                            tokenURI,
                        };
                    }
                )
            );
            return items;
        } catch (error) {
            console.log("Error while fetching NFTs");
        }
    };

    //---- FETCH MY NFT OR LISTED NFTS FUNCTION
    const fetchMyNFTsOrListedNFTs = async(type) => {
        try {
            const contract = await connectingWithSmartContract();

            const data = 
                type == "fetchItemsListed" 
                    ? await contract.fetchItemsListed()
                    : await contract.fetchMyNFT();

                    const items = await Promise.all(
                        data.map(async ({tokenId, seller, owner, price: unformattedPrice}) => {
                            const tokenURI = await contract.tokenURI(tokenId);
                            const {
                                data: {image, name, description}
                            } = await axios.get(tokenURI);
                            const price = ethers.utils.formatUnits(
                                unformattedPrice.toString(),
                                "ether"
                            );

                            return {
                                price,
                                tokenId: tokenId.toNumber(),
                                seller,
                                owner,
                                image,
                                name,
                                desccription,
                                tokenURI,
                            };
                        }
                    )
                );
                return items;
        } catch (error) {
            console.log("Error while fetching listed NFTs");
        }
    };

    //---- BUY NFTs FUNCTION
    const buyNFT = async (nft) => {
        try {
            const contract = await connectingWithSmartContract();
            const price = ethers.utils.parseUnits(nft.price.toString(), "ether");

            const transaction = await contract.createMarketSale(nft.tokenId, {
                value: price,
            });

            await transaction.wait();
        } catch (error) {
            console.log("Error while buying nfts");
        }
    };

    return (
        <NFTMarketplaceContext.Provider 
        value={{ 
            // checkContract,
            checkIfWalletConnected,
            connectWallet,
            uploadToPinata,
            createNFT,
            fetchNFTs,
            fetchMyNFTsOrListedNFTs,
            buyNFT,
            currentAccount,
            titleData,
            }}
        >
            {children}
        </NFTMarketplaceContext.Provider>
    )
}


// const NFTMarketplaceContext = () => {
//     return <div>NFTMarketplaceContext</div>;
// };

// export default NFTMarketplaceContext;
