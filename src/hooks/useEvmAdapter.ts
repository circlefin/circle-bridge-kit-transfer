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

import { useEffect, useRef, useState } from "react";
import { useAccount, useConnectorClient } from "wagmi";
import { createAdapterFromProvider } from "@circle-fin/adapter-viem-v2";

export function useEvmAdapter() {
  const { address } = useAccount();
  const { data: client } = useConnectorClient();
  const [adapter, setAdapter] = useState<any | null>(null);

  const lastProviderRef = useRef<any>(null);
  const lastAddressRef = useRef<string | null>(null);

  function pickProvider(): any | null {
    const provider = (client as any)?.transport?.value?.provider;
    if (provider) return provider;

    const eth = (globalThis as any)?.ethereum;
    if (!eth) return null;
    if (Array.isArray(eth.providers) && eth.providers.length > 0) {
      const phantom = eth.providers.find((provider: any) => provider?.isPhantom);
      return phantom ?? eth.providers[0];
    }
    return eth;
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const provider = pickProvider();
      if (!provider || !address) {
        if (!cancelled) {
          setAdapter(null);
          lastProviderRef.current = null;
          lastAddressRef.current = null;
        }
        return;
      }
      const providerChanged = provider !== lastProviderRef.current;
      if (providerChanged) {
        const adapter = await createAdapterFromProvider({ provider });
        if (!cancelled) {
          setAdapter(adapter);
          lastProviderRef.current = provider;
        }
      }
      if (!cancelled) {
        lastAddressRef.current = address;
      }
    })();
  }, [client, address]);

  return { evmAdapter: adapter, evmAddress: address ?? null };
}