import { useState, useEffect } from "react";
import { BridgeKit, type ChainDefinition, KitError } from "@circle-fin/bridge-kit";
import { ThemeProvider } from "@/components/theme-provider";
import { SiteHeader } from "@/components/app/site-header";
import { ProgressSteps } from "@/components/app/progress-step";
import { TransferLog } from "@/components/app/transfer-log";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { ArrowLeftRight } from "lucide-react";
import { formatBalance } from "@/lib/utils";

import { useSwitchChain } from "wagmi";
import { ConnectButton } from "@rainbow-me/rainbowkit";

import { useBridge } from "@/hooks/useBridge";
import { useUsdcBalance } from "@/hooks/useUsdcBalance";
import { useProgress } from "@/hooks/useProgress";
import { useSolanaWallet } from "@/hooks/useSolanaWallet";
import { useEvmAdapter } from "@/hooks/useEvmAdapter";

import type { SupportedChain } from "@/hooks/useBridge";

export default function App() {
  const [chains, setChains] = useState<ChainDefinition[]>([]);
  const [sourceChain, setSourceChain] = useState<SupportedChain>("Arc_Testnet");
  const [destinationChain, setDestinationChain] = useState<SupportedChain>("");
  const [amount, setAmount] = useState<string>("0");
  const [useDifferentAddress, setUseDifferentAddress] = useState<boolean>(false);
  const [recipientAddress, setRecipientAddress] = useState<string>("");

  const [success, setSuccess] = useState(false);
  const [successAmount, setSuccessAmount] = useState<string | null>(null);
  const [successSourceChain, setSuccessSourceChain] = useState<string | null>(null);
  const [successDestinationChain, setSuccessDestinationChain] = useState<string | null>(null);
  const [failed, setFailed] = useState(false);

  const { bridge, retry, estimate, isLoading, error, isEstimating, clear } = useBridge();
  const { currentStep, logs, addLog, handleEvent, setCurrentStep, reset } = useProgress();

  const {
    adapter: solAdapter,
    address: solAddress,
    connect: connectSol,
    disconnect: disconnectSol,
    hasWallet: hasSolanaWallet,
  } = useSolanaWallet();
  const { evmAdapter, evmAddress } = useEvmAdapter();

  const solWalletConnected = !!solAddress;
  const evmWalletConnected = !!evmAddress;

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const kit = new BridgeKit();
        const allChains = await kit.getSupportedChains();
        const testnets = allChains.filter((chain) => chain.isTestnet === true);
        if (!cancelled) setChains(testnets);
      } catch (error) {
        console.error("Failed to load chains", error);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const chainNames = Object.fromEntries(chains.map((item) => [item.chain, item.name ?? item.chain]));

  const swapChains = () => {
    setSourceChain(destinationChain);
    setDestinationChain(sourceChain);
  };

  const sourceBalance = useUsdcBalance(sourceChain, {
    solAdapter,
    solAddress,
    evmAdapter,
    evmAddress,
  });

  async function handleSolConnect() {
    try {
      await connectSol();
      await sourceBalance.refresh();
    } catch (error) {
      console.error("Failed to connect Solana wallet", error);
    }
  }

  const { switchChainAsync } = useSwitchChain();

  const isSol = (chain: string) => chain.toLowerCase().includes("solana");

  const getAdapters = () => {
    const fromAdapter = isSol(sourceChain) ? solAdapter : evmAdapter;
    const toAdapter = isSol(destinationChain) ? solAdapter : evmAdapter;

    if (!fromAdapter || !toAdapter) {
      throw new Error("Wallet adapters not initialized. Please connect both wallets.");
    }

    return { fromAdapter, toAdapter };
  };

  const onSubmit = async () => {
    if (!amount || Number(amount) <= 0) return;
    setSuccess(false);
    setFailed(false);
    reset();
    setCurrentStep("approving");
    addLog("Bridge started");
    addLog("Approving USDC transfer...");

    try {
      const destination = chains.find((item) => item.chain === destinationChain);

      // Auto-switch to destination network if it's an EVM chain
      const destChainId =
        destination && !isSol(destination.chain) && "chainId" in destination ? destination.chainId : undefined;

      if (destChainId) {
        try {
          await switchChainAsync({ chainId: destChainId });
        } catch (error) {
          console.warn("User rejected network switch", error);
          return;
        }
      }

      const onBridgeEvent = async (evt: Record<string, unknown>) => {
        handleEvent(evt);

        // Auto-switch to destination network when mint step starts
        const values = evt.values as { state?: string } | undefined;

        if (destChainId && evt.method === "mint" && values?.state === "pending") {
          try {
            await switchChainAsync({ chainId: destChainId });
          } catch (error: unknown) {
            console.warn("Unexpected error switching network", error);
          }
        }
      };

      const { fromAdapter, toAdapter } = getAdapters();

      const response = await bridge(
        {
          fromChain: sourceChain,
          toChain: destinationChain,
          amount,
          recipientAddress: useDifferentAddress ? recipientAddress : undefined,
          fromAdapter,
          toAdapter,
        },
        { onEvent: onBridgeEvent }
      );

      if (!response) return;

      const hasErrorStep = response.data.steps.some((step) => step.state === "error");

      if (response.ok && !hasErrorStep && response.data.state === "success") {
        setSuccess(true);
        setSuccessAmount(amount);
        setSuccessSourceChain(sourceChain);
        setSuccessDestinationChain(destinationChain);
        await sourceBalance.refresh();
        setAmount("");
      } else {
        const errorStep = response.data.steps.find((step) => step.state === "error");
        const error = errorStep?.error;
        const isRecoverableError =
          error instanceof KitError && (error.recoverability === "RETRYABLE" || error.recoverability === "RESUMABLE");

        if (isRecoverableError && errorStep?.name === "mint") {
          addLog(`${errorStep.name} step failed: ${errorStep.errorMessage}`);
          addLog("Retrying transfer...");

          try {
            const retryRes = await retry(
              response.data,
              {
                fromChain: sourceChain,
                toChain: destinationChain,
                amount,
                fromAdapter,
                toAdapter,
              },
              { onEvent: onBridgeEvent }
            );

            if (!retryRes) {
              throw new Error("Retry returned no result");
            }

            if (retryRes.ok && retryRes.data.state === "success") {
              setSuccess(true);
              setSuccessAmount(amount);
              setSuccessSourceChain(sourceChain);
              setSuccessDestinationChain(destinationChain);
              await sourceBalance.refresh();
              setAmount("");
              addLog("Transfer completed successfully after retry");
              return;
            }
          } catch (retryError) {
            console.error("Retry error", retryError);
            const retryMsg = retryError instanceof Error ? retryError.message : "Retry failed";
            addLog(`Retry failed: ${retryMsg}`);
          }
        }

        throw new Error(errorStep?.errorMessage || "Bridge failed");
      }
    } catch (error) {
      console.error("Bridge error", error);
      setFailed(true);
      const msg = error instanceof Error ? error.message : "Bridge operation failed";
      addLog(`Error: ${msg}`);
    }
  };

  const onEstimate = async () => {
    if (!amount || Number(amount) <= 0) return;

    try {
      const { fromAdapter, toAdapter } = getAdapters();

      const result = await estimate({
        fromChain: sourceChain,
        toChain: destinationChain,
        amount,
        recipientAddress: useDifferentAddress ? recipientAddress : undefined,
        fromAdapter,
        toAdapter,
      });

      if (result?.ok && result.data) {
        const estimate = result.data;
        addLog(
          `Estimating ${estimate.amount} ${estimate.token} from ${estimate.source.chain} to ${estimate.destination.chain}`,
          false
        );

        addLog("Gas Fees:", false);
        if (estimate.gasFees && estimate.gasFees.length > 0) {
          estimate.gasFees.forEach((fee) => {
            addLog(`  ${fee.name} (${fee.blockchain}): ${fee.fees?.fee || "N/A"} ${fee.token}`, false);
          });
        } else {
          addLog("  No gas fees found", false);
        }

        addLog("Other Fees:", false);
        if (estimate.fees && estimate.fees.length > 0) {
          estimate.fees.forEach((fee) => {
            addLog(`  ${fee.type}: ${fee.amount || "Free"} ${fee.token}`, false);
          });
        } else {
          addLog("  No service fees found", false);
        }
      }
    } catch (error) {
      console.error("Estimate error", error);
      const msg = error instanceof Error ? error.message : "Estimate failed";
      addLog(`Estimate error: ${msg}`, false);
    }
  };

  const showReset = success || failed || !!error;

  const isFormDisabled =
    sourceBalance.loading || Number(amount) <= 0 || Number(amount) > Number(sourceBalance.balance || 0);

  const resetAll = async () => {
    reset();
    clear?.();
    setAmount("0");
    setUseDifferentAddress(false);
    setRecipientAddress("");
    setSuccess(false);
    setSuccessAmount(null);
    setSuccessSourceChain(null);
    setSuccessDestinationChain(null);
    setFailed(false);
    setSourceChain("Arc_Testnet");
    setDestinationChain("");
  };

  return (
    <ThemeProvider defaultTheme="dark" storageKey="vite-ui-theme">
      <>
        <SiteHeader title="Circle Bridge Kit" />
        <main className="flex flex-1 flex-col items-center p-4">
          <p className="text-sm text-muted-foreground italic max-w-xl mb-4">
            Ideally, you should only have one active EVM wallet and one active Solana wallet on your browser. Multiple
            active EVM wallets may result in unexpected behavior.
          </p>
          <div className="grid grid-cols-2 justify-items-center">
            <ConnectButton label="Connect EVM Wallet" chainStatus="none" accountStatus="address" showBalance={false} />
            {solAddress ? (
              <>
                <Button
                  onClick={disconnectSol}
                  size="lg"
                  style={{ fontWeight: 700, fontSize: "1em" }}
                  variant="outline"
                  className="bg-white"
                >
                  Disconnect Solana Wallet
                </Button>
                <p
                  className="col-start-2 text-xs text-muted-foreground cursor-pointer hover:underline mt-2"
                  onClick={() => navigator.clipboard.writeText(solAddress)}
                >
                  {solAddress.slice(0, 6)}…{solAddress.slice(-6)} (click to copy)
                </p>
              </>
            ) : !hasSolanaWallet ? (
              <div className="flex flex-col items-center gap-2">
                <Button disabled size="lg" style={{ fontWeight: 700, fontSize: "1em" }} variant="outline">
                  No Solana Wallet Detected
                </Button>
                <p className="text-xs text-muted-foreground text-center max-w-[200px]">
                  Install{" "}
                  <a
                    href="https://phantom.app/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground"
                  >
                    Phantom
                  </a>
                  ,{" "}
                  <a
                    href="https://solflare.com/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-foreground"
                  >
                    Solflare
                  </a>
                  , or another Solana wallet
                </p>
              </div>
            ) : (
              <Button onClick={handleSolConnect} size="lg" style={{ fontWeight: 700, fontSize: "1em" }}>
                Connect Solana Wallet
              </Button>
            )}
          </div>
          {(evmAddress || solAddress) && (
            <p className="text-sm text-muted-foreground italic max-w-xl mt-3">
              For reliability, it’s best to disconnect directly from your wallet UI after use.
            </p>
          )}
          <Card className="w-full max-w-xl mt-4">
            <CardHeader>
              <CardTitle className="text-center">Cross-Chain USDC Transfer</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-6">
                <div className="flex justify-between gap-4 items-center">
                  <Field className="flex-[1_0_0]">
                    <FieldLabel htmlFor="sourceChain">Source Chain</FieldLabel>
                    <Select
                      name="sourceChain"
                      value={sourceChain}
                      onValueChange={(value) => setSourceChain(value as SupportedChain)}
                    >
                      <SelectTrigger id="sourceChain" className="w-full">
                        <SelectValue placeholder="Select source chain" />
                      </SelectTrigger>
                      <SelectContent>
                        {chains.map((item) => {
                          const isSol = item.chain.toLowerCase().includes("solana");
                          const isEvm = !isSol;
                          const isUnavailable =
                            (isSol && !solWalletConnected) ||
                            (isEvm && !evmWalletConnected) ||
                            item.chain === destinationChain;
                          return (
                            <SelectItem key={item.chain} value={item.chain} disabled={isUnavailable}>
                              {item.name ?? item.chain}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </Field>

                  <Button type="button" variant="outline" onClick={swapChains}>
                    <ArrowLeftRight className="ml-2" />
                    <span>Switch</span>
                  </Button>

                  <Field className="flex-[1_0_0]">
                    <FieldLabel htmlFor="destinationChain">Destination Chain</FieldLabel>
                    <Select
                      name="destinationChain"
                      value={destinationChain}
                      onValueChange={(value) => setDestinationChain(value as SupportedChain)}
                    >
                      <SelectTrigger id="destinationChain" className="w-full">
                        <SelectValue placeholder="Select destination chain" />
                      </SelectTrigger>
                      <SelectContent>
                        {chains.map((item) => {
                          const isSol = item.chain.toLowerCase().includes("solana");
                          const isEvm = !isSol;
                          const isUnavailable =
                            (isSol && !solWalletConnected) ||
                            (isEvm && !evmWalletConnected) ||
                            item.chain === sourceChain;
                          return (
                            <SelectItem key={item.chain} value={item.chain} disabled={isUnavailable}>
                              {item.name ?? item.chain}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  </Field>
                </div>

                <Field>
                  <FieldLabel htmlFor="amount">Amount (USDC)</FieldLabel>
                  <Input
                    id="amount"
                    type="number"
                    value={amount}
                    onChange={(evt) => setAmount(evt.target.value)}
                    placeholder="Enter amount"
                    min="0"
                    max={parseFloat(sourceBalance.balance || "0")}
                    step="any"
                  />
                  <p className="text-sm text-muted-foreground">
                    {sourceBalance.loading
                      ? "Loading balance…"
                      : `${formatBalance(sourceBalance.balance)} USDC available`}
                  </p>
                </Field>

                <div className="flex items-center space-x-2">
                  <Switch
                    id="recipientSwitch"
                    checked={useDifferentAddress}
                    onCheckedChange={setUseDifferentAddress}
                    thumbClassName="!bg-white dark:data-[state=unchecked]:!bg-foreground dark:data-[state=checked]:!bg-primary-foreground"
                  />
                  <FieldLabel htmlFor="recipientSwitch">Use different recipient address</FieldLabel>
                </div>

                {useDifferentAddress && (
                  <Field>
                    <FieldLabel htmlFor="recipientAddress">Recipient Address</FieldLabel>
                    <Input
                      id="recipientAddress"
                      type="text"
                      value={recipientAddress}
                      onChange={(evt) => setRecipientAddress(evt.target.value)}
                      placeholder="Enter recipient address"
                    />
                  </Field>
                )}

                {success && successSourceChain && successDestinationChain && (
                  <p className="text-sm rounded border px-3 py-2 border-success-foreground bg-success">
                    Successfully bridged{" "}
                    <span className="font-semibold">
                      {Number(successAmount ?? 0).toLocaleString(undefined, {
                        maximumFractionDigits: 2,
                      })}
                    </span>{" "}
                    USDC from{" "}
                    <span className="font-semibold">{chainNames[successSourceChain] ?? successSourceChain}</span> to{" "}
                    <span className="font-semibold">
                      {chainNames[successDestinationChain] ?? successDestinationChain}
                    </span>
                    .
                  </p>
                )}

                <ProgressSteps currentStep={currentStep} />
                <TransferLog logs={logs} />

                <div className="flex justify-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={onEstimate}
                    disabled={isEstimating || isLoading || isFormDisabled}
                  >
                    {isEstimating ? "Estimating…" : "Estimate"}
                  </Button>

                  <Button type="button" onClick={onSubmit} disabled={isLoading || isFormDisabled}>
                    {isLoading ? "Bridging…" : "Bridge"}
                  </Button>

                  {showReset && (
                    <Button type="button" variant="outline" onClick={resetAll}>
                      Reset
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>
        </main>
      </>
    </ThemeProvider>
  );
}
