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

import { ModeToggle } from "./mode-toggle";
import Logo from "@/assets/logo.svg?react";

interface SiteHeaderProps {
  title: string;
}

export function SiteHeader(props: SiteHeaderProps) {
  return (
    <header className="flex px-4 py-2 shadow-md items-center bg-card">
      <h1 className="me-auto flex items-center gap-2 font-semibold text-lg">
        <Logo className="h-8 w-8" />
        <span>{props.title}</span>
      </h1>
      <ModeToggle />
    </header>
  );
}