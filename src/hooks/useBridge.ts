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

import { useState } from "react";
import { BridgeKit, type BridgeResult, type BridgeParams as BridgeKitParams, type EstimateResult } from "@circle-fin/bridge-kit";
import type { ViemAdapter } from "@circle-fin/adapter-viem-v2";
import type { SolanaAdapter } from "@circle-fin/adapter-solana";

export type SupportedChain = string;

export interface BridgeParams {
  fromChain: SupportedChain;
  toChain: SupportedChain;
  amount: string;
  recipientAddress?: string;
  fromAdapter: ViemAdapter | SolanaAdapter;
  toAdapter: ViemAdapter | SolanaAdapter;
}

export function useBridge() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<BridgeResult | null>(null);
  
  const [isEstimating, setIsEstimating] = useState(false);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [estimateData, setEstimateData] = useState<EstimateResult | null>(null);

  function clear() {
    setError(null);
    setData(null);
    setIsLoading(false);
    setEstimateError(null);
    setEstimateData(null);
    setIsEstimating(false);
  }

  async function bridge(
    params: BridgeParams,
    options?: { onEvent?: (_evt: Record<string, unknown>) => void }
  ) {
    setIsLoading(true);
    setError(null);
    setData(null);

    try {
      const kit = new BridgeKit();
      const handler = (payload: Record<string, unknown>) => options?.onEvent?.(payload);
      kit.on("*", handler);

      try {
        const bridgeParams: BridgeKitParams = {
          from: { 
            adapter: params.fromAdapter, 
            chain: params.fromChain as BridgeKitParams['from']['chain']
          },
          to: params.recipientAddress 
            ? { 
                adapter: params.toAdapter, 
                chain: params.toChain as BridgeKitParams['to']['chain'],
                recipientAddress: params.recipientAddress
              }
            : { 
                adapter: params.toAdapter, 
                chain: params.toChain as BridgeKitParams['to']['chain']
              },
          amount: params.amount,
        };
        
        const result = await kit.bridge(bridgeParams);

        setData(result);
        return { ok: true, data: result };
      } finally {
        kit.off("*", handler);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Bridge failed";
      setError(message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }

  async function retry(
    failedResult: BridgeResult,
    params: BridgeParams,
    options?: { onEvent?: (_evt: Record<string, unknown>) => void }
  ) {
    setIsLoading(true);
    setError(null);

    try {
      const kit = new BridgeKit();
      const handler = (payload: Record<string, unknown>) => options?.onEvent?.(payload);
      kit.on("*", handler);

      try {
        const result = await kit.retry(failedResult, {
          from: params.fromAdapter,
          to: params.toAdapter,
        });

        setData(result);
        return { ok: true, data: result };
      } finally {
        kit.off("*", handler);
      }
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Retry failed";
      setError(message);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }

  async function estimate(params: BridgeParams) {
    setIsEstimating(true);
    setEstimateError(null);
    setEstimateData(null);

    try {
      const kit = new BridgeKit();
      
      const bridgeParams: BridgeKitParams = {
        from: { 
          adapter: params.fromAdapter, 
          chain: params.fromChain as BridgeKitParams['from']['chain']
        },
        to: params.recipientAddress 
          ? { 
              adapter: params.toAdapter, 
              chain: params.toChain as BridgeKitParams['to']['chain'],
              recipientAddress: params.recipientAddress
            }
          : { 
              adapter: params.toAdapter, 
              chain: params.toChain as BridgeKitParams['to']['chain']
            },
        amount: params.amount,
      };
      
      const result = await kit.estimate(bridgeParams);
      
      setEstimateData(result);
      return { ok: true, data: result };
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : "Estimate failed";
      setEstimateError(message);
      throw error;
    } finally {
      setIsEstimating(false);
    }
  }

  return { 
    bridge, 
    retry, 
    estimate,
    isLoading, 
    error, 
    data, 
    isEstimating,
    estimateError,
    estimateData,
    clear 
  };
}
