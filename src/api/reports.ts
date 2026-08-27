import cron from 'node-cron';
import * as TelegramBotModule from 'node-telegram-bot-api';
const TelegramBot = (TelegramBotModule as any).default || TelegramBotModule;
import db from '../db/db';
import { sendWhatsAppMessage } from './whatsapp';

function getSettings() {
  const settings = db.prepare('SELECT * FROM settings').all() as any[];
  return settings.reduce((acc: any, curr: any) => {
    acc[curr.key] = curr.value;
    return acc;
  }, {});
}

async function sendTelegramMessage(token: string, chatId: string, message: string) {
  try {
    const bot = new TelegramBot(token, { polling: false });
    await bot.sendMessage(chatId, message, { parse_mode: 'HTML' });
  } catch (error) {
    console.error('Telegram Error:', error);
  }
}

function buildReportData(period: 'daily' | 'weekly' | 'monthly', start: string, end: string) {
  const sales = db.prepare("SELECT SUM(total) as total_sales FROM sales WHERE date >= ? AND date <= ? AND status = 'completed'").get(start, end) as any;
  const profitQuery = db.prepare(`SELECT SUM(si.line_total - (si.qty * si.cost_price_at_sale)) as gross_profit FROM sale_items si JOIN sales s ON si.sale_id = s.id WHERE s.date >= ? AND s.date <= ? AND s.status = 'completed'`).get(start, end) as any;
  const expenses = db.prepare("SELECT SUM(amount) as total_expenses FROM expenses WHERE date >= ? AND date <= ?").get(start, end) as any;

  const totalSales = sales.total_sales || 0;
  const grossProfit = profitQuery.gross_profit || 0;
  const totalExpenses = expenses.total_expenses || 0;
  const netProfit = grossProfit - totalExpenses;
  const title = period === 'daily' ? 'يومي' : period === 'weekly' ? 'أسبوعي' : 'شهري';

  return { title, start, end, totalSales, grossProfit, totalExpenses, netProfit };
}

function formatReportTelegram(data: ReturnType<typeof buildReportData>) {
  return `📊 <b>تقرير ${data.title} - Hosainy Store</b>
📅 من: ${data.start}
إلى: ${data.end}

💰 <b>المبيعات:</b> ${data.totalSales} ج.م
📈 <b>الربح الإجمالي:</b> ${data.grossProfit} ج.م
💸 <b>المصروفات:</b> ${data.totalExpenses} ج.م
-------------
💳 <b>صافي الربح:</b> ${data.netProfit} ج.م`;
}

function formatReportWhatsApp(data: ReturnType<typeof buildReportData>) {
  return `📊 *تقرير ${data.title} - Hosainy Store*
📅 من: ${data.start}
إلى: ${data.end}

💰 *المبيعات:* ${data.totalSales} ج.م
📈 *الربح الإجمالي:* ${data.grossProfit} ج.م
💸 *المصروفات:* ${data.totalExpenses} ج.م
-------------
💳 *صافي الربح:* ${data.netProfit} ج.م`;
}

async function dispatchReport(settings: any, period: 'daily' | 'weekly' | 'monthly', start: string, end: string) {
  const data = buildReportData(period, start, end);
  if (settings.telegram_bot_token && settings.telegram_chat_id) {
    await sendTelegramMessage(settings.telegram_bot_token, settings.telegram_chat_id, formatReportTelegram(data));
  }
  if (settings.whatsapp_number) {
    await sendWhatsAppMessage(settings.whatsapp_number, formatReportWhatsApp(data));
  }
}

export async function processReports() {
  const settings = getSettings();
  const hasTelegram = !!(settings.telegram_bot_token && settings.telegram_chat_id);
  const hasWhatsApp = !!settings.whatsapp_number;
  if (!hasTelegram && !hasWhatsApp) return;

  const today = new Date();
  const todayStr = today.toISOString().split('T')[0];

  // Daily Report (Sent for yesterday, checked today)
  if (settings.report_daily === '1') {
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);
    const dateStr = yesterday.toISOString().split('T')[0];
    
    const logged = db.prepare('SELECT id FROM report_logs WHERE report_type = ? AND report_date = ?').get('daily', dateStr);
    if (!logged) {
      await dispatchReport(settings, 'daily', dateStr, dateStr);
      db.prepare('INSERT INTO report_logs (report_type, report_date) VALUES (?, ?)').run('daily', dateStr);
    }
  }

  // Weekly (Check if today is Saturday, send for past 7 days)
  if (settings.report_weekly === '1' && today.getDay() === 6) { // 6 = Saturday
    const lastSat = new Date(today);
    lastSat.setDate(lastSat.getDate() - 7);
    const startStr = lastSat.toISOString().split('T')[0];
    const endStr = new Date(today.getTime() - 86400000).toISOString().split('T')[0]; // Friday
    
    const logged = db.prepare('SELECT id FROM report_logs WHERE report_type = ? AND report_date = ?').get('weekly', endStr);
    if (!logged) {
      await dispatchReport(settings, 'weekly', startStr, endStr);
      db.prepare('INSERT INTO report_logs (report_type, report_date) VALUES (?, ?)').run('weekly', endStr);
    }
  }
  
  // Monthly (Check if today is 1st of month, send for last month)
  if (settings.report_monthly === '1' && today.getDate() === 1) {
    const lastMonth = new Date(today);
    lastMonth.setMonth(lastMonth.getMonth() - 1);
    const year = lastMonth.getFullYear();
    const month = String(lastMonth.getMonth() + 1).padStart(2, '0');
    
    // Start of last month
    const startStr = `${year}-${month}-01`;
    
    // End of last month
    const endOfLastMonth = new Date(year, lastMonth.getMonth() + 1, 0);
    const endStr = endOfLastMonth.toISOString().split('T')[0];

    const logged = db.prepare('SELECT id FROM report_logs WHERE report_type = ? AND report_date = ?').get('monthly', endStr);
    if (!logged) {
      await dispatchReport(settings, 'monthly', startStr, endStr);
      db.prepare('INSERT INTO report_logs (report_type, report_date) VALUES (?, ?)').run('monthly', endStr);
    }
  }
}

export function initCronJobs() {
  // Check immediately on startup (with error protection)
  try {
    processReports();
  } catch (e) {
    console.error('Reports check failed on startup:', e);
  }
  
  // And check every hour
  cron.schedule('0 * * * *', () => {
    try {
      processReports();
    } catch (e) {
      console.error('Reports cron job failed:', e);
    }
  });
}
