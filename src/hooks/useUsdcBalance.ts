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

import { useEffect, useState } from "react";
import type { SupportedChain } from "@/hooks/useBridge";
import { formatUnits } from "viem";
import type { SolanaAdapter } from "@circle-fin/adapter-solana";
import type { ViemAdapter } from "@circle-fin/adapter-viem-v2";

type Params = {
  solAdapter?: SolanaAdapter | null;
  solAddress?: string | null;
  evmAdapter?: ViemAdapter | null;
  evmAddress?: string | null;
};

const isSolana = (chain: string) => chain.toLowerCase().includes("solana");

export function useUsdcBalance(
  chain: SupportedChain,
  { solAdapter, solAddress, evmAdapter, evmAddress }: Params = {}
) {
  const [balance, setBalance] = useState("0");
  const [loading, setLoading] = useState(false);

  async function fetchBalance() {
    setLoading(true);
    try {
      if (isSolana(chain) && solAdapter && solAddress) {
        const action = await solAdapter.prepareAction("usdc.balanceOf", {}, {
          chain: chain as any,
          address: solAddress,
        } as any);
        const raw = await action.execute();
        setBalance(formatUnits(BigInt(raw), 6));
        return;
      }

      if (!isSolana(chain) && evmAdapter && evmAddress) {
        const action = await evmAdapter.prepareAction("usdc.balanceOf", {}, {
          chain: chain as any,
          address: evmAddress,
        } as any);
        const raw = await action.execute();
        setBalance(formatUnits(BigInt(raw), 6));
        return;
      }

      setBalance("0");
    } catch (error) {
      console.warn(`[balance:${chain}]`, error);
      setBalance("0");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      if (cancelled) return;
      await fetchBalance();
    })();
    return () => {
      cancelled = true;
    };
  }, [chain, solAdapter, solAddress, evmAdapter, evmAddress]);

  return {
    balance,
    loading,
    refresh: fetchBalance,
  };
}
