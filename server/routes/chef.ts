import express from 'express';
import { AuthenticatedRequest, authenticateToken, isGuestId } from '../middleware/auth.js';
import { supabaseAdmin, isSupabaseConfigured } from '../supabase.js';
import { markChefOrderDeliveredInOdoo } from './odoo.js';
import { stockFridgeFromOrder } from '../lib/fridgeRestock.js';
import { awardPointsForOrder } from '../lib/loyalty.js';

const router = express.Router();
router.use(authenticateToken);
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const NEXT_STATUS: Record<string, string> = {
  pending: 'packing',
  paid: 'packing',
  packing: 'shipping',
  shipping: 'delivered',
  delivering: 'delivered',
};

const emptyDashboard = (message: string, realtime: boolean) => ({
  message,
  adminEnabled: false,
  realtime,
  stats: {
    customers: 0,
    orders: 0,
    revenue: 0,
    products: 0,
    pendingOrders: 0,
  },
  recentOrders: [],
  recentCustomers: [],
  odooFailedOrders: [],
});

function allowedAdminEmails(): string[] {
  return (process.env.CHEF_ADMIN_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

function isChefAdmin(req: AuthenticatedRequest): boolean {
  const admins = allowedAdminEmails();
  if (!admins.length || isGuestId(req.user?.id) || req.user?.isAnonymous) return false;
  return admins.includes((req.user?.email || '').toLowerCase());
}

router.get('/dashboard', async (req: AuthenticatedRequest, res) => {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    return res.json(emptyDashboard('Supabase admin is not configured', false));
  }

  if (!isChefAdmin(req)) {
    return res.json(
      emptyDashboard('CHEF_ADMIN_EMAILS does not include this signed-in account', true)
    );
  }

  const [
    profilesRes,
    ordersRes,
    productsRes,
    allOrdersStatsRes,
    recentOrdersRes,
    recentProfilesRes,
    failedOdooOrdersRes,
  ] = await Promise.all([
    supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }),
    supabaseAdmin
      .from('store_products')
      .select('id', { count: 'exact', head: true })
      .eq('in_stock', true),
    supabaseAdmin.from('orders').select('total_amount,status').limit(10000),
    supabaseAdmin
      .from('orders')
      .select(
        'order_ref,total_amount,status,delivery_address,created_at,odoo_order_ref,odoo_sync_error,odoo_synced_at,profiles(display_name,email)'
      )
      .order('created_at', { ascending: false })
      .limit(8),
    supabaseAdmin
      .from('profiles')
      .select('id,display_name,email,subscription_tier,created_at')
      .order('created_at', { ascending: false })
      .limit(8),
    supabaseAdmin
      .from('orders')
      .select(
        'order_ref,total_amount,status,created_at,odoo_sync_error,odoo_last_sync_attempt_at,profiles(display_name,email)'
      )
      .is('odoo_order_ref', null)
      .not('odoo_sync_error', 'is', null)
      .order('odoo_last_sync_attempt_at', { ascending: false, nullsFirst: false })
      .limit(8),
  ]);

  const queryError =
    profilesRes.error ||
    ordersRes.error ||
    productsRes.error ||
    allOrdersStatsRes.error ||
    recentOrdersRes.error ||
    recentProfilesRes.error ||
    failedOdooOrdersRes.error;
  if (queryError) {
    console.error('[Chef Dashboard Error]', queryError.message);
    return res.status(502).json({ error: 'Failed to load chef dashboard' });
  }

  const recentOrders = (recentOrdersRes.data || []).map((order: any) => {
    const profile = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles;
    return {
      id: order.order_ref || 'ZITY',
      customerName: profile?.display_name || profile?.email?.split('@')[0] || 'Хэрэглэгч',
      customerEmail: profile?.email || '',
      totalAmount: Number(order.total_amount || 0),
      status: order.status || 'paid',
      createdAt: order.created_at ? new Date(order.created_at).toLocaleString('mn-MN') : '',
      address: order.delivery_address || '',
      odooOrderRef: order.odoo_order_ref || '',
      odooSyncError: order.odoo_sync_error || '',
      odooSyncedAt: order.odoo_synced_at
        ? new Date(order.odoo_synced_at).toLocaleString('mn-MN')
        : '',
    };
  });

  const recentCustomers = (recentProfilesRes.data || []).map((profile) => ({
    id: profile.id,
    name: profile.display_name || profile.email?.split('@')[0] || 'Хэрэглэгч',
    email: profile.email || '',
    createdAt: profile.created_at ? new Date(profile.created_at).toLocaleString('mn-MN') : '',
    subscriptionTier: profile.subscription_tier || 'free',
  }));

  const odooFailedOrders = (failedOdooOrdersRes.data || []).map((order: any) => {
    const profile = Array.isArray(order.profiles) ? order.profiles[0] : order.profiles;
    return {
      id: order.order_ref || 'ZITY',
      customerName: profile?.display_name || profile?.email?.split('@')[0] || 'Хэрэглэгч',
      customerEmail: profile?.email || '',
      totalAmount: Number(order.total_amount || 0),
      status: order.status || 'paid',
      createdAt: order.created_at ? new Date(order.created_at).toLocaleString('mn-MN') : '',
      syncError: order.odoo_sync_error || '',
      lastAttemptAt: order.odoo_last_sync_attempt_at
        ? new Date(order.odoo_last_sync_attempt_at).toLocaleString('mn-MN')
        : '',
    };
  });

  const allOrderAmounts = (allOrdersStatsRes.data || []).map((order) =>
    Number(order.total_amount || 0)
  );
  const revenue = allOrderAmounts.reduce((sum, amount) => sum + amount, 0);
  const pendingOrders = (allOrdersStatsRes.data || []).filter((order) =>
    ['pending', 'paid', 'delivering'].includes(order.status || 'paid')
  ).length;

  return res.json({
    realtime: true,
    adminEnabled: true,
    stats: {
      customers: profilesRes.count || 0,
      orders: ordersRes.count || 0,
      revenue,
      products: productsRes.count || 0,
      pendingOrders,
    },
    recentOrders,
    recentCustomers,
    odooFailedOrders,
  });
});

// ── POST /api/chef/orders/:id/status ─────────────────────────────────────────
router.post('/orders/:id/status', async (req: AuthenticatedRequest, res) => {
  if (!isSupabaseConfigured || !supabaseAdmin) {
    return res.status(503).json({ ok: false, message: 'Supabase admin is not configured' });
  }
  if (!isChefAdmin(req)) {
    return res.status(403).json({ ok: false, message: 'CHEF_ADMIN_REQUIRED' });
  }

  const orderId = String(req.params.id || '').trim();
  const requestedStatus = String(req.body?.status || '')
    .trim()
    .toLowerCase();
  if (!orderId || !requestedStatus) {
    return res.status(400).json({ ok: false, message: 'INVALID_STATUS_REQUEST' });
  }

  const query = supabaseAdmin.from('orders').select('id,order_ref,status');
  const { data: order, error: fetchError } = await (
    UUID_RE.test(orderId)
      ? query.or(`id.eq.${orderId},order_ref.eq.${orderId}`)
      : query.eq('order_ref', orderId)
  ).maybeSingle();
  if (fetchError) {
    console.error('[Chef Order Status Fetch Error]', fetchError.message);
    return res.status(502).json({ ok: false, message: 'Failed to load order' });
  }
  if (!order) return res.status(404).json({ ok: false, message: 'ORDER_NOT_FOUND' });

  const current = String(order.status || 'pending');
  if (['cancelled', 'delivered', 'completed'].includes(current)) {
    return res.status(409).json({ ok: false, message: 'ORDER_STATUS_TERMINAL' });
  }
  if (NEXT_STATUS[current] !== requestedStatus) {
    return res.status(400).json({ ok: false, message: 'INVALID_STATUS_TRANSITION' });
  }

  const { data, error } = await supabaseAdmin
    .from('orders')
    .update({ status: requestedStatus })
    .eq('id', order.id)
    .select('order_ref,status')
    .single();
  if (error) {
    console.error('[Chef Order Status Update Error]', error.message);
    return res.status(502).json({ ok: false, message: 'Failed to update order status' });
  }

  // The operator's "delivered" is what actually ships the goods. Odoo never
  // heard about this transition, so its delivery orders stayed in Ready for
  // ever and its on-hand quantities never moved. Fire-and-forget: the status
  // change in Chef already succeeded and must not be undone by an Odoo outage.
  if (requestedStatus === 'delivered') {
    // Delivered means the food is in the customer's hands — so it belongs in
    // their fridge, which is where the next recipe suggestion reads from.
    void stockFridgeFromOrder(order.id).catch((err) =>
      console.warn(
        `[fridge restock] ${order.order_ref}: ${err instanceof Error ? err.message : 'failed'}`
      )
    );
    void awardPointsForOrder(order.id).catch((err) =>
      console.warn(`[loyalty] ${order.order_ref}: ${err instanceof Error ? err.message : 'failed'}`)
    );
    void markChefOrderDeliveredInOdoo({ orderKey: order.id }).catch((err) =>
      console.warn(
        `[Odoo delivery] ${order.order_ref}: ${err instanceof Error ? err.message : 'failed'}`
      )
    );
  }

  return res.json({ ok: true, order: { id: data.order_ref, status: data.status } });
});

export default router;
