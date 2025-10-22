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

import { cn } from "@/lib/utils";

const steps = [
  { name: "Approval", statusKey: "approving" },
  { name: "Burn", statusKey: "burning" },
  { name: "Attestation", statusKey: "waiting-attestation" },
  { name: "Mint", statusKey: "minting" },
];

export function ProgressSteps({ currentStep }: { currentStep: string }) {
  const getStepState = (index: number) => {
    const currentIndex = steps.findIndex((step) => step.statusKey === currentStep);

    if (currentStep === "completed") return "completed";
    if (currentStep === "error") return "error"; 
    if (currentIndex === index) return "active";
    if (currentIndex > index) return "done";
    return "pending";
  };

  return (
    <div className="w-full max-w-2xl mx-auto">
      <div className="flex justify-between">
        {steps.map((step, index) => {
          const state = getStepState(index);
          return (
            <div key={step.name} className="flex flex-col items-center w-1/4">
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-colors duration-300",
                  state === "active" && "bg-gumdrop-400 text-white",
                  state === "done" && "bg-apple-400 text-white",
                  state === "completed" && "bg-apple-400 text-white",
                  state === "pending" && "bg-licorice-75 text-licorice-700",
                  state === "error" && "bg-redhot-400 text-white"
                )}
              >
                {index + 1}
              </div>
              <div className="mt-2 text-sm text-center">{step.name}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
