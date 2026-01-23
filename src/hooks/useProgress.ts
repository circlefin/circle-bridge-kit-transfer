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

export type StepKey =
  | "idle"
  | "approving"
  | "burning"
  | "waiting-attestation"
  | "minting"
  | "completed"
  | "error";

function now() {
  return new Date().toLocaleTimeString();
}

export function useProgress() {
  const [currentStep, setCurrentStep] = useState<StepKey>("idle");
  const [logs, setLogs] = useState<string[]>([]);

  function addLog(line: string, includeTimestamp = true) {
    setLogs((prev) => [...prev, includeTimestamp ? `[${now()}] ${line}` : line]);
  }

  function reset() {
    setCurrentStep("idle");
    setLogs([]);
  }

  function handleEvent(msg: any) {
    const method: string | undefined = msg?.method;
    const state: string | undefined = msg?.values?.state;
    const txHash: string | undefined = msg?.values?.txHash;

    if (!method) return;

    if (method === "approve") {
      if (state === "success") {
        addLog(`USDC Approval Tx:\n${txHash}`);
        setCurrentStep("burning");
        addLog("Burning USDC...");
      } else if (state === "error") {
        addLog("❌ Approval failed");
        setCurrentStep("error");
      }
    } else if (method === "burn") {
      if (state === "success") {
        addLog(`Burn Tx:\n${txHash}`);
        setCurrentStep("waiting-attestation");
        addLog("Waiting for attestation...");
      } else if (state === "error") {
        addLog("❌ Burn failed");
        setCurrentStep("error");
      }
    } else if (method === "fetchAttestation") {
      if (state === "success") {
        addLog("Attestation retrieved!");
        setCurrentStep("minting");
        addLog("Minting USDC...");
      } else {
        addLog("Waiting for attestation...");
        setCurrentStep("waiting-attestation");
      }
    } else if (method === "mint") {
      if (state === "success") {
        addLog(`Mint Tx:\n${txHash}`);
        addLog("Transfer completed successfully.");
        setCurrentStep("completed");
      } else if (state === "error") {
        addLog("❌ Mint failed");
        setCurrentStep("error");
      }
    }
  }

  return { currentStep, logs, addLog, handleEvent, reset, setCurrentStep };
}
