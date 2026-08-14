import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  CheckCircle2,
  QrCode,
  CreditCard,
  ExternalLink,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import { useToast } from './Toast';
import { MOCK_BANK_APPS } from '../constants';
import { PaymentMethod } from '../types';
import { createQpayInvoice, checkQpayPayment, type QpayInvoice } from '../services/qpayService';

export const PaymentModal: React.FC = () => {
  const { paymentModalState, closePaymentModal, formatPrice, t } = useApp();
  const { toastSuccess } = useToast();
  const [method, setMethod] = useState<PaymentMethod>('card');
  const [selectedBank, setSelectedBank] = useState<string>('khanbank');
  const [timeLeft, setTimeLeft] = useState<number>(300); // 5 minutes
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);
  const [invoice, setInvoice] = useState<QpayInvoice | null>(null);

  useEffect(() => {
    if (!paymentModalState) {
      setIsSuccess(false);
      setIsProcessing(false);
      setTimeLeft(300);
      setInvoice(null);
      return;
    }

    setMethod(paymentModalState.preferredMethod || 'card');
    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [paymentModalState]);

  // Create a QPay invoice when the QPay tab is active (real or simulated).
  useEffect(() => {
    if (!paymentModalState || method !== 'qpay') return;
    let active = true;
    setInvoice(null);
    createQpayInvoice(paymentModalState.amount, paymentModalState.title).then((inv) => {
      if (active) setInvoice(inv);
    });
    return () => {
      active = false;
    };
  }, [paymentModalState, method]);

  // Poll for payment completion once an invoice exists.
  useEffect(() => {
    if (!invoice || isSuccess || !paymentModalState) return;
    const id = setInterval(async () => {
      const paid = await checkQpayPayment(invoice.invoiceId);
      if (paid) {
        clearInterval(id);
        handleSuccess();
      }
    }, 3000);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoice, isSuccess]);

  if (!paymentModalState) return null;

  const { amount, title, onSuccess } = paymentModalState;

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  function orderPaymentMethod(): 'qpay' | 'socialpay' | 'card' {
    if (method === 'qpay' || method === 'socialpay') return method;
    return 'card';
  }

  function handleSuccess() {
    setIsProcessing(false);
    setIsSuccess(true);
    toastSuccess(
      t('pay_successToastTitle'),
      t('pay_successToastBody', { n: amount.toLocaleString() })
    );
    setTimeout(() => {
      if (onSuccess) onSuccess(orderPaymentMethod());
      closePaymentModal();
    }, 1800);
  }

  const handlePay = async () => {
    if (method === 'qpay' && invoice) {
      setIsProcessing(true);
      const paid = await checkQpayPayment(invoice.invoiceId);
      setIsProcessing(false);
      if (paid) handleSuccess();
      else
        toastSuccess(
          t('pay_pendingToastTitle'),
          t('pay_pendingToastBody')
        );
      return;
    }
    // SocialPay / Card — simulated confirmation.
    setIsProcessing(true);
    setTimeout(() => handleSuccess(), 1500);
  };

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/70 backdrop-blur-md z-[200] flex items-center justify-center p-4"
      >
        <motion.div
          initial={{ scale: 0.9, y: 30, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          exit={{ scale: 0.9, y: 30, opacity: 0 }}
          transition={{ type: 'spring', damping: 25, stiffness: 240 }}
          className="bg-pestle-card border border-pestle-border/80 w-full max-w-sm rounded-t-[32px] sm:rounded-[32px] shadow-2xl overflow-hidden flex flex-col"
        >
          {/* Mobile Bottom-Sheet Pull Bar */}
          <div className="w-12 h-1.5 bg-gray-300 dark:bg-slate-700 rounded-full mx-auto mt-2.5 sm:hidden" />
          {/* Header */}
          <div className="bg-gradient-to-r from-mango to-amber-500 p-5 text-white flex justify-between items-center relative overflow-hidden">
            <div className="absolute right-[-20px] top-[-20px] opacity-10 pointer-events-none">
              <QrCode size={120} />
            </div>
            <div>
              <span className="text-[10px] font-extrabold uppercase tracking-widest bg-white/20 px-2 py-0.5 rounded-full">
                {t('pay_secureCheckout')}
              </span>
              <h2 className="text-xl font-bold mt-1">{title}</h2>
            </div>
            <button
              onClick={closePaymentModal}
              aria-label={t('close')}
              className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center hover:bg-white/30 transition-colors"
            >
              <X size={18} />
            </button>
          </div>

          <div className="p-5 flex-1 space-y-5">
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
            ) : (
              <>
                {/* Total Amount Pill */}
                <div className="bg-pestle-bg p-4 rounded-2xl border border-pestle-border/60 flex justify-between items-center">
                  <div>
                    <span className="text-xs text-gray-400 font-medium">{t('payAmount')}</span>
                    <div className="text-2xl font-black text-mango-ink">{formatPrice(amount)}</div>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] text-gray-400 font-medium">
                      {t('timeRemaining')}
                    </span>
                    <div className="text-xs font-mono font-bold text-red-500">
                      {formatTimer(timeLeft)}
                    </div>
                  </div>
                </div>

                {/* Tabs for Payment Method */}
                <div className="grid grid-cols-5 bg-pestle-bg p-1 rounded-xl border border-pestle-border text-[10px] font-extrabold gap-1">
                  <button
                    onClick={() => setMethod('card')}
                    className={`py-2 rounded-lg transition-all ${
                      method === 'card' || method === 'stripe'
                        ? 'bg-mango text-white shadow-sm'
                        : 'text-gray-400 hover:text-pestle-text'
                    }`}
                  >
                    💳 {t('pay_cardTab')}
                  </button>
                  <button
                    onClick={() => setMethod('socialpay')}
                    className={`py-2 rounded-lg transition-all ${
                      method === 'socialpay'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-400 hover:text-pestle-text'
                    }`}
                  >
                    SP
                  </button>
                  <button
                    onClick={() => setMethod('applepay')}
                    className={`py-2 rounded-lg transition-all ${
                      method === 'applepay'
                        ? 'bg-black text-white shadow-sm'
                        : 'text-gray-400 hover:text-pestle-text'
                    }`}
                  >
                    🍎 {t('applePayTitle')}
                  </button>
                  <button
                    onClick={() => setMethod('paypal')}
                    className={`py-2 rounded-lg transition-all ${
                      method === 'paypal'
                        ? 'bg-blue-600 text-white shadow-sm'
                        : 'text-gray-400 hover:text-pestle-text'
                    }`}
                  >
                    🅿️ PayPal
                  </button>
                  <button
                    onClick={() => setMethod('qpay')}
                    className={`py-2 rounded-lg transition-all ${
                      method === 'qpay'
                        ? 'bg-mango text-white shadow-sm'
                        : 'text-gray-400 hover:text-pestle-text'
                    }`}
                  >
                    🇲🇳 QPay QR
                  </button>
                </div>

                {/* QR Code Container */}
                {method === 'qpay' && (
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
                      {invoice?.simulated
                        ? t('pay_demoHint')
                        : t('pay_scanQrHint')}
                    </p>
                  </div>
                )}

                {/* Bank Apps Selector */}
                {method === 'qpay' && (
                  <div>
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider block mb-2">
                      {t('selectBank')}
                    </span>
                    <div className="grid grid-cols-3 gap-2">
                      {MOCK_BANK_APPS.map((bank) => (
                        <button
                          key={bank.id}
                          onClick={() => setSelectedBank(bank.id)}
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
                )}

                {method === 'socialpay' && (
                  <div className="p-6 text-center bg-blue-500/10 border border-blue-500/20 rounded-2xl">
                    <div className="w-12 h-12 bg-blue-500 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold shadow-md">
                      SP
                    </div>
                    <h4 className="font-bold text-sm text-pestle-text mb-1">
                      {t('pay_socialpayTitle')}
                    </h4>
                    <p className="text-xs text-gray-500">
                      {t('pay_socialpayDesc')}
                    </p>
                  </div>
                )}

                {method === 'card' && (
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder={t('pay_cardNumberPlaceholder')}
                      className="w-full bg-pestle-bg border border-pestle-border rounded-xl px-4 py-2.5 text-xs font-mono text-pestle-text focus:outline-none focus:border-mango"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        placeholder="MM/YY"
                        className="w-1/2 bg-pestle-bg border border-pestle-border rounded-xl px-4 py-2.5 text-xs font-mono text-pestle-text focus:outline-none focus:border-mango"
                      />
                      <input
                        type="password"
                        placeholder="CVC"
                        className="w-1/2 bg-pestle-bg border border-pestle-border rounded-xl px-4 py-2.5 text-xs font-mono text-pestle-text focus:outline-none focus:border-mango"
                      />
                    </div>
                  </div>
                )}

                {method === 'applepay' && (
                  <div className="p-6 text-center bg-black/10 dark:bg-white/10 border border-pestle-border rounded-2xl">
                    <div className="w-12 h-12 bg-black text-white rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold shadow-md">
                      
                    </div>
                    <h4 className="font-bold text-sm text-pestle-text mb-1">{t('applePayTitle')}</h4>
                    <p className="text-xs text-gray-500">{t('pay_applePayDesc')}</p>
                  </div>
                )}

                {method === 'paypal' && (
                  <div className="p-6 text-center bg-blue-500/10 border border-blue-500/20 rounded-2xl">
                    <div className="w-12 h-12 bg-blue-600 text-white rounded-full flex items-center justify-center mx-auto mb-3 text-xl font-bold shadow-md">
                      P
                    </div>
                    <h4 className="font-bold text-sm text-pestle-text mb-1">{t('pay_paypalTitle')}</h4>
                    <p className="text-xs text-gray-500">{t('pay_paypalDesc')}</p>
                  </div>
                )}

                {/* Payment Action Button */}
                <button
                  onClick={handlePay}
                  disabled={isProcessing || (method === 'qpay' && !invoice)}
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
