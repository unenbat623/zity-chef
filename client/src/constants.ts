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

const DAY_LABELS_MN = ['Дав', 'Мяг', 'Лха', 'Пүр', 'Баа', 'Бям', 'Ням'];
const DAY_LABELS_EN = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];

export interface WeekDay {
  day: string;
  dayEn: string;
  /** DD.MM, as shown on the day chips. */
  date: string;
  /** True for today, so the planner can open on the right day. */
  isToday: boolean;
}

/**
 * The seven days of the current week, Monday-first. These used to be seven
 * hardcoded April dates, so the planner showed 04.02–04.08 forever regardless
 * of what day it actually was.
 */
export function getWeekDays(from: Date = new Date()): WeekDay[] {
  const monday = new Date(from);
  // getDay(): 0 = Sunday. Shift so Monday starts the week.
  monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
  const todayStamp = new Date(from).toDateString();

  return DAY_LABELS_MN.map((label, idx) => {
    const d = new Date(monday);
    d.setDate(monday.getDate() + idx);
    return {
      day: label,
      dayEn: DAY_LABELS_EN[idx],
      date: `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth() + 1).padStart(2, '0')}`,
      isToday: d.toDateString() === todayStamp,
    };
  });
}
