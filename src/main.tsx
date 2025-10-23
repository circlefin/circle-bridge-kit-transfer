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

import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider } from "wagmi";
import { lightTheme, RainbowKitProvider } from "@rainbow-me/rainbowkit";

import { createWagmiConfig } from "./lib/wagmiConfig";
import App from "./App";
import "./index.css";
import "@rainbow-me/rainbowkit/styles.css";

const root = createRoot(document.getElementById("root")!);

(async () => {
  try {
    const config = await createWagmiConfig();
    const queryClient = new QueryClient();

    root.render(
      <StrictMode>
        <WagmiProvider config={config}>
          <QueryClientProvider client={queryClient}>
            <RainbowKitProvider
              modalSize="compact"
              theme={lightTheme({
                accentColor: "var(--color-gumdrop-400)",
                accentColorForeground: "var(--color-white)",
                fontStack: "system",
                borderRadius: "medium",
              })}
            >
              <App />
            </RainbowKitProvider>
          </QueryClientProvider>
        </WagmiProvider>
      </StrictMode>
    );
  } catch (error) {
    console.error("[wagmi bootstrap] failed:", error);
    root.render(
      <StrictMode>
        <div>Failed to initialize wallet support. Check console for details.</div>
      </StrictMode>
    );
  }
})();
