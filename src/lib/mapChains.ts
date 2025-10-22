/**
 * Copyright 2025 Circle Internet Group, Inc.  All rights reserved.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 *
 * SPDX-License-Identifier: Apache-2.0
 */

import type { Chain } from "viem";

type BridgeKitEvm = {
  type: "evm";
  chain: string;
  name?: string;
  title?: string;
  nativeCurrency?: {
    name?: string;
    symbol?: string;
    decimals?: number;
  };
  chainId: number;
  isTestnet?: boolean;
  explorerUrl?: string;
  rpcEndpoints?: readonly string[];
};

function getExplorerUrl(url?: string): string | undefined {
  if (!url) return undefined;
  try {
    const explorerUrl = new URL(url.replace("/tx/{hash}", "/").replace("{hash}", ""));
    return `${explorerUrl.origin}`;
  } catch {
    return url.split("/tx/")[0];
  }
}

function mapChain(bk: BridgeKitEvm): Chain {
  const id = bk.chainId;
  const name = bk.name as string;
  const rpcHttp =
    (bk.rpcEndpoints && bk.rpcEndpoints.length > 0
      ? [...bk.rpcEndpoints]
      : undefined) ?? [`https://rpc.${id}.example`];

  const explorerBase = getExplorerUrl(bk.explorerUrl);

  return {
    id,
    name,
    nativeCurrency: {
      name: bk.nativeCurrency?.name ?? "Ether",
      symbol: bk.nativeCurrency?.symbol ?? "ETH",
      decimals: bk.nativeCurrency?.decimals ?? 18,
    },
    rpcUrls: {
      default: { http: rpcHttp },
      public: { http: rpcHttp },
    },
    blockExplorers: explorerBase
      ? { default: { name: "Explorer", url: explorerBase } }
      : undefined,
    testnet: bk.isTestnet ?? false,
  };
}

export function mapBridgeKitChainsToWagmi(
  chains: readonly any[]
): readonly [Chain, ...Chain[]] {
  const evmOnly = chains.filter(chain => chain?.type === "evm");
  const mapped = evmOnly.map(mapChain);
  if (mapped.length === 0) {
    throw new Error("No EVM chains available from BridgeKit.");
  }
  return [mapped[0], ...mapped.slice(1)] as const;
}