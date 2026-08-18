import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, CheckCircle2, QrCode, ShieldCheck, RefreshCw, AlertTriangle } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from './Toast';
import { BANK_APPS } from '../constants';
import {
  createQpayInvoice,
  checkQpayPayment,
  type QpayInvoice,
  type QpayCreateError,
} from '../services/qpayService';
import { useEscapeClose } from '../hooks/useEscapeClose';
import { useScrollLock } from '../hooks/useScrollLock';

const INVOICE_TTL_SECONDS = 300; // 5 minutes

/**
 * QPay-only checkout. The card / SocialPay / Apple Pay / PayPal tabs that used
 * to sit next to it were pure simulations — a setTimeout that "confirmed" the
 * payment and placed a real order without any money moving — so they are gone
 * until a real processor is wired up. QPay works end-to-end: simulated against
 * the dev server, real invoices in production.
 */
export const PaymentModal: React.FC = () => {
  const { paymentModalState, closePaymentModal, formatPrice, t } = useApp();
  const { toastSuccess } = useToast();
  const [selectedBank, setSelectedBank] = useState<string>('khanbank');
  const [timeLeft, setTimeLeft] = useState<number>(INVOICE_TTL_SECONDS);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [invoice, setInvoice] = useState<QpayInvoice | null>(null);
  const [invoiceError, setInvoiceError] = useState<QpayCreateError | null>(null);
  // Bumped to re-create the invoice (manual retry, or the 5-minute expiry).
  const [invoiceNonce, setInvoiceNonce] = useState<number>(0);

  useEffect(() => {
    if (!paymentModalState) {
      setIsSuccess(false);
      setIsProcessing(false);
      setTimeLeft(INVOICE_TTL_SECONDS);
      setInvoice(null);
      setInvoiceError(null);
      setInvoiceNonce(0);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [paymentModalState]);

  // Create the invoice (real or simulated).
  useEffect(() => {
    if (!paymentModalState) return;
    let active = true;
    setInvoice(null);
    setInvoiceError(null);
    setTimeLeft(INVOICE_TTL_SECONDS);
    createQpayInvoice(
      paymentModalState.amount,
      paymentModalState.title,
      undefined,
      paymentModalState.plan
    ).then((result) => {
      if (!active) return;
      setInvoice(result.invoice);
      setInvoiceError(result.error);
    });
    return () => {
      active = false;
    };
  }, [paymentModalState, invoiceNonce]);

  // A QPay invoice is only valid for a few minutes — when the countdown runs
  // out, issue a fresh one instead of leaving a dead QR on screen.
  useEffect(() => {
    if (timeLeft === 0 && invoice && !isSuccess) {
      setInvoiceNonce((n) => n + 1);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [timeLeft]);

  // Poll for payment completion once an invoice exists.
  useEffect(() => {
    if (!invoice || isSuccess || !paymentModalState) return;
    const id = setInterval(async () => {
      const paid = await checkQpayPayment(invoice.invoiceId);
      if (paid) {
        clearInterval(id);
        handleSuccess(invoice.invoiceId);
      }
    }, 3000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice, isSuccess]);

  useEscapeClose(
    closePaymentModal,
    Boolean(paymentModalState) && !isSuccess && !isProcessing
  );
  useScrollLock(Boolean(paymentModalState));

  if (!paymentModalState) return null;

  const { title, onSuccess } = paymentModalState;
  // Subscriptions are priced by the server; show its figure when it differs.
  const amount = invoice?.amount ?? paymentModalState.amount;

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  function handleSuccess(invoiceId: string) {
    setIsProcessing(false);
    setIsSuccess(true);
    toastSuccess(
      t('pay_successToastTitle'),
      t('pay_successToastBody', { n: amount.toLocaleString() })
    );
    setTimeout(() => {
      if (onSuccess) onSuccess('qpay', invoiceId);
      closePaymentModal();
    }, 1800);
  }

  const handlePay = async () => {
    if (!invoice) return;
    setIsProcessing(true);
    const paid = await checkQpayPayment(invoice.invoiceId);
    setIsProcessing(false);
    if (paid) handleSuccess(invoice.invoiceId);
    else toastSuccess(t('pay_pendingToastTitle'), t('pay_pendingToastBody'));
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        // Backdrop dismisses, but not mid-transaction — a stray tap used to be
        // able to close the sheet while a payment was being confirmed.
        onClick={() => {
          if (!isProcessing && !isSuccess) closePaymentModal();
        }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        className="fixed inset-0 bg-black/70 backdrop-blur-md z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4"
      >
        <motion.div
          initial={{ scale: 0.9, y: 30, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.9, y: 30, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 240 }}
          onClick={(e) => e.stopPropagation()}
          className="bg-pestle-card border border-pestle-border/80 w-full max-w-sm rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col max-h-[92dvh]"
        >
          {/* Mobile Bottom-Sheet Pull Bar */}
          <div className="w-12 h-1.5 bg-gray-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 sm:hidden shrink-0" />
          {/* Header */}
          <div className="bg-gradient-to-r from-mango to-amber-500 p-4 sm:p-5 text-white flex justify-between items-center gap-3 relative overflow-hidden shrink-0">
            <div className="absolute right-[-20px] top-[-20px] opacity-10 pointer-events-none">
              <QrCode size={120} />
            </div>
            <div className="min-w-0 relative z-10">
              <span className="text-[10px] font-extrabold uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded-full">
                {t('pay_secureCheckout')}
              </span>
              <h2 className="text-lg sm:text-xl font-bold mt-1 leading-snug line-clamp-2">{title}</h2>
            </div>
            <button
              onClick={closePaymentModal}
              aria-label={t('close')}
              className="w-8 h-8 shrink-0 relative z-10 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          {/* The body scrolls: the QR + six bank tiles + CTA are taller than a
              phone in landscape, and used to run off the screen edge with no
              way to reach the pay button. */}
          <div className="p-4 sm:p-5 pb-sheet-safe sm:pb-5 flex-1 min-h-0 overflow-y-auto overscroll-contain space-y-5">
            {isSuccess ? (
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                className="py-10 text-center flex flex-col items-center justify-center"
              >
                <div className="w-16 h-16 bg-mint/20 text-mint-ink rounded-full flex items-center justify-center mb-4 animate-bounce">
                  <CheckCircle2 size={40} />
                </div>
                <h3 className="text-xl font-bold text-pestle-text mb-2">{t('paymentSuccess')}</h3>
                <p className="text-xs text-gray-400">{t('pay_transactionConfirmed')}</p>
              </motion.div>
            ) : invoiceError ? (
              // The invoice could not be created — say why, instead of the
              // skeleton spinning forever with a permanently disabled button.
              <div className="py-8 text-center flex flex-col items-center justify-center gap-4">
                <div className="w-14 h-14 bg-red-500/10 text-red-500 rounded-full flex items-center justify-center">
                  <AlertTriangle size={28} />
                </div>
                <p className="text-sm font-semibold text-pestle-text max-w-[26ch]">
                  {invoiceError === 'SIGN_IN_REQUIRED'
                    ? t('pay_errSignIn')
                    : t('pay_errUnavailable')}
                </p>
                {invoiceError !== 'SIGN_IN_REQUIRED' && (
                  <button
                    onClick={() => setInvoiceNonce((n) => n + 1)}
                    className="btn-primary py-2.5 px-6 text-xs flex items-center gap-2"
                  >
                    <RefreshCw size={14} />
                    <span>{t('pay_retry')}</span>
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Total Amount Pill */}
                <div className="bg-pestle-bg p-4 rounded-2xl border border-pestle-border/60 flex justify-between items-center gap-3">
                  <div className="min-w-0">
                    <span className="text-xs text-gray-400 font-medium">{t('payAmount')}</span>
                    <div className="text-xl sm:text-2xl font-black text-mango-ink tabular-nums break-words">
                      {formatPrice(amount)}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-gray-400 font-medium">
                      {t('timeRemaining')}
                    </span>
                    <div className="text-xs font-mono font-bold text-red-500">
                      {formatTimer(timeLeft)}
                    </div>
                  </div>
                </div>

                {/* QR Code */}
                <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-pestle-border relative shadow-inner">
                  {invoice?.qrImage ? (
                    <img
                      src={invoice.qrImage}
                      alt={t('pay_qrAlt')}
                      className="w-44 h-44 rounded-xl object-contain bg-white"
                    />
                  ) : (
                    // Loading placeholder while the invoice is being created.
                    <div className="w-44 h-44 bg-slate-900 rounded-xl p-3 flex items-center justify-center relative overflow-hidden shadow-lg">
                      <div className="w-10 h-10 bg-mango rounded-xl flex items-center justify-center text-white font-extrabold shadow-md animate-pulse">
                        Z
                      </div>
                    </div>
                  )}
                  <p className="text-[11px] text-gray-500 font-semibold mt-3 text-center">
                    {invoice?.simulated ? t('pay_demoHint') : t('pay_scanQrHint')}
                  </p>
                </div>

                {/* Bank Apps Selector */}
                <div>
                  <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
                    {t('selectBank')}
                  </span>
                  <div className="grid grid-cols-3 gap-2">
                    {BANK_APPS.map((bank) => (
                      <button
                        key={bank.id}
                        onClick={() => setSelectedBank(bank.id)}
                        aria-pressed={selectedBank === bank.id}
                        className={`p-2.5 rounded-xl border flex flex-col items-center gap-1.5 text-center transition-all ${
                          selectedBank === bank.id
                            ? 'border-mango bg-mango/10 font-bold text-mango-ink shadow-sm ring-1 ring-mango/20'
                            : 'border-pestle-border bg-pestle-bg text-pestle-text hover:border-gray-300 hover:shadow-sm'
                        }`}
                      >
                        <span className="flex-shrink-0">{bank.svgLogo}</span>
                        <span className="text-[10px] font-semibold leading-tight line-clamp-1">
                          {bank.name}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Payment Action Button */}
                <button
                  onClick={handlePay}
                  disabled={isProcessing || !invoice}
                  className="w-full btn-primary py-3.5 flex items-center justify-center gap-2 shadow-lg shadow-mango/20 disabled:opacity-50"
                >
                  {isProcessing ? (
                    <>
                      <RefreshCw size={18} className="animate-spin" />
                      <span>{t('simulatingPayment')}</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={18} />
                      <span>
                        {t('confirmPay')} ({formatPrice(amount)})
                      </span>
                    </>
                  )}
                </button>
              </>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
