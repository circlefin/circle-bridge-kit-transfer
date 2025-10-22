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
import { BridgeKit } from "@circle-fin/bridge-kit";

export type SupportedChain = string;

export interface BridgeParams {
  fromChain: SupportedChain;
  toChain: SupportedChain;
  amount: string;
  fromAdapter: any;
  toAdapter: any;
}

export function useBridge() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [data, setData] = useState<any>(null);

  function clear() {
    setError(null);
    setData(null);
    setIsLoading(false);
  }

  async function bridge(params: BridgeParams, options?: { onEvent?: (evt: any) => void }) {
    setIsLoading(true);
    setError(null);
    setData(null);

    try {
      if (!params.fromAdapter) throw new Error("Missing fromAdapter.");
      if (!params.toAdapter) throw new Error("Missing toAdapter.");

      const kit = new BridgeKit();
      const handler = (payload: any) => options?.onEvent?.(payload);
      kit.on("*", handler);

      try {
        const result = await kit.bridge({
          from: { adapter: params.fromAdapter, chain: params.fromChain as any },
          to: { adapter: params.toAdapter, chain: params.toChain as any },
          amount: params.amount,
        });

        setData(result);
        return { ok: true, data: result };
      } finally {
        kit.off("*", handler);
      }
    } catch (error: any) {
      setError(error?.message ?? "Bridge failed");
      throw error;
    } finally {
      setIsLoading(false);
    }
  }

  return { bridge, isLoading, error, data, clear };
}