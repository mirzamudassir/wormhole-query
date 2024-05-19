const {
  QueryRequest,
  PerChainQueryRequest,
  EthCallQueryRequest,
  EthCallData,
} = require("@wormhole-foundation/wormhole-query-sdk");
const { QueryProxyMock } = require("@wormhole-foundation/wormhole-query-sdk");
const { QueryResponse } = require("@wormhole-foundation/wormhole-query-sdk");

const axios = require("axios");
require("dotenv").config();

// prepare payloads for each request
const callData1 = {
  to: "0xD1253aFc33386D9F0d546f1e5B105b328Ba1557a", // polygon mumbai
  data: "0x6a952825", // method
};

const callData2 = {
  to: "0x8506F302FBc183E2F911aEa2399146Fc222a11e2", // base sepolia
  data: "0x6a952825", // method
};

// Array of requests
const requests = [
  {
    chainId: process.env.WORMHOLE_MUMBAI_CHAIN_ID,
    rpcUrl: process.env.POLYGON_MUMBAI_RPC,
    callData: callData1,
  },
  {
    chainId: process.env.WORMHOLE_BASE_SEPOLIA_CHAIN_ID,
    rpcUrl: process.env.BASE_SEPOLIA_RPC,
    callData: callData2,
  },
];

(async () => {
  try {
    const aggregatedResults = [];

    for (const requestInfo of requests) {
      const { chainId, rpcUrl, callData } = requestInfo;

      const latestBlock = (
        await axios.post(rpcUrl, {
          method: "eth_getBlockByNumber",
          params: ["latest", false],
          id: chainId,
          jsonrpc: "2.0",
        })
      ).data?.result?.number;

      if (!latestBlock) {
        console.error(`❌ Invalid block returned for Network ${chainId}`);
        continue;
      }

      console.log(
        `Latest Block Network ${chainId}:`,
        latestBlock,
        `(${BigInt(latestBlock)})`
      );

      // Form the query request
      const request = new QueryRequest(0, [
        new PerChainQueryRequest(
          chainId,
          new EthCallQueryRequest(latestBlock, [callData])
        ),
      ]);

      console.log(
        `Query Request Network ${chainId}:`,
        JSON.stringify(request, undefined, 2)
      );

      // prepare request
      const serialized = request.serialize();

      const payload = {
        bytes: Buffer.from(serialized).toString("hex"),
      };

      const headers = {
        "X-API-Key": process.env.WORMHOLE_TESTNET_API_KEY,
      };

      const response = await axios.post(
        process.env.WORMHOLE_TESTNET_PROXY_URL,
        payload,
        { headers }
      );

      console.log("Response:", response.data);
      const mockQueryResponse = QueryResponse.from(response.data.bytes);
      const mockQueryResult =
        mockQueryResponse.responses[0].response.results[0];
      console.log(
        `Query Result: ${mockQueryResult} (${BigInt(mockQueryResult)})`
      );

      aggregatedResults.push(BigInt(mockQueryResult));
    }

    // Log aggregated results
    console.log(
      "Aggregated Results:",
      aggregatedResults.map((result) => `(${result})`).join(", ")
    );
  } catch (error) {
    console.error("Error:", error);
  }
})();
