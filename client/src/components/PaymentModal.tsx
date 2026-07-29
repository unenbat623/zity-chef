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

export const PaymentModal: React.FC = () => {
  const { paymentModalState, closePaymentModal, t } = useApp();
  const { toastSuccess } = useToast();
  const [method, setMethod] = useState<PaymentMethod>('qpay');
  const [selectedBank, setSelectedBank] = useState<string>('khanbank');
  const [timeLeft, setTimeLeft] = useState<number>(300); // 5 minutes
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [isSuccess, setIsSuccess] = useState<boolean>(false);

  useEffect(() => {
    if (!paymentModalState) {
      setIsSuccess(false);
      setIsProcessing(false);
      setTimeLeft(300);
      return;
    }

    const timer = setInterval(() => {
      setTimeLeft((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [paymentModalState]);

  if (!paymentModalState) return null;

  const { amount, title, onSuccess } = paymentModalState;

  const formatTimer = (seconds: number) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  const handleSimulatePayment = () => {
    setIsProcessing(true);
    setTimeout(() => {
      setIsProcessing(false);
      setIsSuccess(true);
      toastSuccess(
        'Төлбөр амжилттай бүртгэжлээлаа! 💳',
        `₮${amount.toLocaleString()} гүйцэтгэлийг баталгаажууллаа.`
      );
      setTimeout(() => {
        if (onSuccess) onSuccess();
        closePaymentModal();
      }, 1800);
    }, 1500);
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
                Secure QPay Checkout
              </span>
              <h2 className="text-xl font-bold mt-1">{title}</h2>
            </div>
            <button
              onClick={closePaymentModal}
              aria-label="Хаах"
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
                <div className="w-16 h-16 bg-mint/20 text-mint rounded-full flex items-center justify-center mb-4 animate-bounce">
                  <CheckCircle2 size={40} />
                </div>
                <h3 className="text-xl font-bold text-pestle-text mb-2">{t('paymentSuccess')}</h3>
                <p className="text-xs text-gray-400">Гүйцэтгэлийг баталгаажууллаа</p>
              </motion.div>
            ) : (
              <>
                {/* Total Amount Pill */}
                <div className="bg-pestle-bg p-4 rounded-2xl border border-pestle-border/60 flex justify-between items-center">
                  <div>
                    <span className="text-xs text-gray-400 font-medium">{t('payAmount')}</span>
                    <div className="text-2xl font-black text-mango">₮{amount.toLocaleString()}</div>
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
                <div className="flex bg-pestle-bg p-1 rounded-xl border border-pestle-border text-xs font-bold">
                  <button
                    onClick={() => setMethod('qpay')}
                    className={`flex-1 py-2 rounded-lg transition-all ${
                      method === 'qpay'
                        ? 'bg-mango text-white shadow-sm'
                        : 'text-gray-400 hover:text-pestle-text'
                    }`}
                  >
                    QPay QR
                  </button>
                  <button
                    onClick={() => setMethod('socialpay')}
                    className={`flex-1 py-2 rounded-lg transition-all ${
                      method === 'socialpay'
                        ? 'bg-mango text-white shadow-sm'
                        : 'text-gray-400 hover:text-pestle-text'
                    }`}
                  >
                    SocialPay
                  </button>
                  <button
                    onClick={() => setMethod('card')}
                    className={`flex-1 py-2 rounded-lg transition-all ${
                      method === 'card'
                        ? 'bg-mango text-white shadow-sm'
                        : 'text-gray-400 hover:text-pestle-text'
                    }`}
                  >
                    Card
                  </button>
                </div>

                {/* QR Code Container */}
                {method === 'qpay' && (
                  <div className="flex flex-col items-center justify-center p-4 bg-white rounded-2xl border border-pestle-border relative shadow-inner">
                    {/* Render visual QR Code pattern */}
                    <div className="w-44 h-44 bg-slate-900 rounded-xl p-3 flex flex-col justify-between items-center relative overflow-hidden shadow-lg">
                      <div className="grid grid-cols-6 gap-1 w-full h-full p-2 bg-white rounded-lg">
                        {Array.from({ length: 36 }).map((_, i) => (
                          <div
                            key={i}
                            className={`rounded-[2px] ${
                              (i % 2 === 0 && i % 3 === 0) ||
                              i === 0 ||
                              i === 5 ||
                              i === 30 ||
                              i === 35
                                ? 'bg-slate-900'
                                : 'bg-transparent'
                            }`}
                          />
                        ))}
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <div className="w-10 h-10 bg-mango rounded-xl flex items-center justify-center text-white font-extrabold shadow-md">
                          Z
                        </div>
                      </div>
                    </div>
                    <p className="text-[11px] text-gray-500 font-semibold mt-3 text-center">
                      Банкны апп-аараа QR кодыг уншуулна уу
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
                              ? 'border-mango bg-mango/10 font-bold text-mango shadow-sm ring-1 ring-mango/20'
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
                      SocialPay-ээр шилжүүлэх
                    </h4>
                    <p className="text-xs text-gray-500">
                      Утасны дугаараар шууд холбогдон төлбөр тооцоог хийнэ.
                    </p>
                  </div>
                )}

                {method === 'card' && (
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Картын дугаар (4000 0000 0000 0000)"
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

                {/* Simulate Payment Action Button */}
                <button
                  onClick={handleSimulatePayment}
                  disabled={isProcessing}
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
                        {t('confirmPay')} (₮{amount.toLocaleString()})
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
