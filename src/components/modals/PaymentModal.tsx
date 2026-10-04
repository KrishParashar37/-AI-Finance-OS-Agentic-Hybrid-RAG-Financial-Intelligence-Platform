import { useState, useEffect } from "react";
import { Modal } from "./Modal";
import { CheckCircle2, CreditCard, Smartphone, Loader2 } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { money } from "@/lib/format";

declare global {
  interface Window {
    Razorpay: any;
  }
}

export function PaymentModal({ open, onClose, amount, itemName, onSuccess }: { open: boolean; onClose: () => void; amount: number; itemName: string; onSuccess: () => void }) {
  const [step, setStep] = useState<"select" | "processing" | "success" | "error">("select");
  const [method, setMethod] = useState<"upi" | "card">("upi");
  const [errorMsg, setErrorMsg] = useState("");

  const loadRazorpay = () => {
    return new Promise((resolve) => {
      if (document.getElementById("razorpay-script") && window.Razorpay) {
        resolve(true);
        return;
      }
      const script = document.createElement("script");
      script.id = "razorpay-script";
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = () => resolve(true);
      script.onerror = () => resolve(false);
      document.body.appendChild(script);
    });
  };

  // Reset state when modal opens
  useEffect(() => {
    if (open) {
      setStep("select");
      setErrorMsg("");
    }
  }, [open]);

  const handlePay = async () => {
    setStep("processing");
    try {
      // 1. Ensure script is loaded
      const isLoaded = await loadRazorpay();
      if (!isLoaded) throw new Error("Razorpay SDK failed to load. Check your internet connection.");

      // 2. Create order on backend
      const res = await fetch("/api/payments/create", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount, receipt: `bill_${Date.now()}` }),
      });
      const order = await res.json();

      if (!res.ok) throw new Error(order.error?.description || order.error || "Failed to create order");

      // 3. Open Razorpay Checkout
      const options = {
        key: "rzp_test_TjlwoF47XqQu32", // Public key
        amount: order.amount,
        currency: order.currency,
        name: "AI Finance OS",
        description: `Payment for ${itemName}`,
        order_id: order.id,
        handler: function (response: any) {
          // Payment Successful
          setStep("success");
          setTimeout(() => {
            onSuccess();
            onClose();
          }, 2000);
        },
        prefill: {
          name: "Test User",
          email: "test@example.com",
          contact: "9999999999",
        },
        theme: {
          color: "#4f46e5", // Indigo-600
        },
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', function (response: any) {
        setStep("error");
        setErrorMsg(response.error.description);
      });
      rzp.open();

    } catch (err: any) {
      setStep("error");
      setErrorMsg(err.message);
    }
  };

  return (
    <Modal open={open} onClose={step === "processing" ? () => {} : onClose} title="Secure Checkout" size="sm">
      <div className="p-4 space-y-6">
        <div className="text-center space-y-1">
          <p className="text-sm text-muted-foreground">Paying for {itemName}</p>
          <p className="text-3xl font-bold">{money(amount)}</p>
        </div>

        <AnimatePresence mode="wait">
          {step === "select" && (
            <motion.div key="select" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm font-medium">Select Payment Method</p>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    onClick={() => setMethod("upi")}
                    className={`flex flex-col items-center justify-center gap-2 p-4 border rounded-xl transition-colors ${method === "upi" ? "border-primary bg-primary/5 text-primary ring-1 ring-primary" : "hover:bg-secondary/50 text-muted-foreground"}`}
                  >
                    <Smartphone className="w-6 h-6" />
                    <span className="text-sm font-medium">UPI / QR</span>
                  </button>
                  <button
                    onClick={() => setMethod("card")}
                    className={`flex flex-col items-center justify-center gap-2 p-4 border rounded-xl transition-colors ${method === "card" ? "border-primary bg-primary/5 text-primary ring-1 ring-primary" : "hover:bg-secondary/50 text-muted-foreground"}`}
                  >
                    <CreditCard className="w-6 h-6" />
                    <span className="text-sm font-medium">Credit Card</span>
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button onClick={handlePay} className="w-full btn btn-primary flex items-center justify-center py-3 text-base">
                  Pay {money(amount)} Securely
                </button>
                <p className="text-xs text-center text-muted-foreground mt-3 flex items-center justify-center gap-1">
                  🔒 Secured by Razorpay
                </p>
              </div>
            </motion.div>
          )}

          {step === "processing" && (
            <motion.div key="processing" initial={{ opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} className="py-8 flex flex-col items-center justify-center space-y-4">
              <div className="relative">
                <div className="absolute inset-0 bg-primary/20 rounded-full blur-xl animate-pulse" />
                <Loader2 className="w-12 h-12 text-primary animate-spin relative" />
              </div>
              <div className="text-center">
                <p className="font-semibold text-lg animate-pulse">Initializing Secure Checkout...</p>
                <p className="text-sm text-muted-foreground">Connecting to Razorpay gateway</p>
              </div>
            </motion.div>
          )}

          {step === "error" && (
            <motion.div key="error" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} className="py-8 flex flex-col items-center justify-center space-y-4">
              <div className="p-3 bg-red-100 text-red-600 rounded-full">
                <CheckCircle2 className="w-8 h-8 rotate-45" /> {/* Exclamation mark equivalent visually */}
              </div>
              <div className="text-center">
                <p className="font-bold text-xl text-red-600">Payment Failed</p>
                <p className="text-sm text-muted-foreground mt-1 max-w-[250px]">{errorMsg || "An unknown error occurred"}</p>
              </div>
              <button onClick={() => setStep("select")} className="btn btn-secondary mt-4">Try Again</button>
            </motion.div>
          )}

          {step === "success" && (
            <motion.div key="success" initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} transition={{ type: "spring" }} className="py-8 flex flex-col items-center justify-center space-y-4">
              <motion.div initial={{ scale: 0 }} animate={{ scale: 1 }} transition={{ delay: 0.2, type: "spring", stiffness: 200 }}>
                <CheckCircle2 className="w-16 h-16 text-emerald-500 drop-shadow-md" />
              </motion.div>
              <div className="text-center">
                <p className="font-bold text-xl text-emerald-600">Payment Successful!</p>
                <p className="text-sm text-muted-foreground">Redirecting...</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </Modal>
  );
}
