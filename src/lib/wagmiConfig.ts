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

import { createConfig, http } from "wagmi";
import { injected } from "wagmi/connectors";
import { BridgeKit } from "@circle-fin/bridge-kit";
import { mapBridgeKitChainsToWagmi } from "./mapChains";

export async function createWagmiConfig() {
  const kit = new BridgeKit();
  const bridgeKitChains = await kit.getSupportedChains();
  const wagmiChains = mapBridgeKitChainsToWagmi(bridgeKitChains);
  const transports = Object.fromEntries(wagmiChains.map((c) => [c.id, http()]));
  return createConfig({
    chains: wagmiChains,
    connectors: [
      injected({
        shimDisconnect: true,
      }),
    ],
    transports,
  });
}