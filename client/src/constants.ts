import React from 'react';
import { Category, BankApp } from './types';
import {
  KhanBankLogo,
  GolomtBankLogo,
  SocialPayLogo,
  StateBankLogo,
  XacBankLogo,
  TDBLogo,
} from './components/BankLogos';

export const CATEGORIES: Category[] = [
  '🥦 Ногоо',
  '🥩 Мах',
  '🥛 Сүү, өндөг',
  '🧂 Амтлагч',
  '🍎 Жимс',
];

export const BANK_APPS: BankApp[] = [
  {
    id: 'khanbank',
    name: 'Хаан Банк',
    icon: '🏦',
    svgLogo: React.createElement(KhanBankLogo),
    color: '#005A36',
    deepLink: 'khanbank://qpay',
  },
  {
    id: 'golomt',
    name: 'Голомт Банк',
    icon: '💳',
    svgLogo: React.createElement(GolomtBankLogo),
    color: '#003366',
    deepLink: 'golomt://qpay',
  },
  {
    id: 'socialpay',
    name: 'SocialPay',
    icon: '📲',
    svgLogo: React.createElement(SocialPayLogo),
    color: '#1B80E4',
    deepLink: 'socialpay://qpay',
  },
  {
    id: 'statebank',
    name: 'Төрийн Банк',
    icon: '🏛️',
    svgLogo: React.createElement(StateBankLogo),
    color: '#8B0000',
    deepLink: 'statebank://qpay',
  },
  {
    id: 'xacbank',
    name: 'Хас Банк',
    icon: '⚡',
    svgLogo: React.createElement(XacBankLogo),
    color: '#F37021',
    deepLink: 'xacbank://qpay',
  },
  {
    id: 'tdbm',
    name: 'ХХБ',
    icon: '🌐',
    svgLogo: React.createElement(TDBLogo),
    color: '#002B49',
    deepLink: 'tdb://qpay',
  },
];

export const WEEK_DAYS = [
  { day: 'Дав', dayEn: 'Mon', date: '04.02' },
  { day: 'Мяг', dayEn: 'Tue', date: '04.03' },
  { day: 'Лха', dayEn: 'Wed', date: '04.04' },
  { day: 'Пүр', dayEn: 'Thu', date: '04.05' },
  { day: 'Баа', dayEn: 'Fri', date: '04.06' },
  { day: 'Бям', dayEn: 'Sat', date: '04.07' },
  { day: 'Ням', dayEn: 'Sun', date: '04.08' },
];
