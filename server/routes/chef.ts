import express from 'express';
import { AuthenticatedRequest, authenticateToken, isGuestId } from '../middleware/auth.js';
import { supabaseAdmin, isSupabaseConfigured } from '../supabase.js';

const router = express.Router();
router.use(authenticateToken);

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

  const [profilesRes, ordersRes, productsRes, allOrdersStatsRes, recentOrdersRes, recentProfilesRes] = await Promise.all([
    supabaseAdmin.from('profiles').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('orders').select('id', { count: 'exact', head: true }),
    supabaseAdmin.from('store_products').select('id', { count: 'exact', head: true }).eq('in_stock', true),
    supabaseAdmin.from('orders').select('total_amount,status').limit(10000),
    supabaseAdmin
      .from('orders')
      .select(
        'order_ref,total_amount,status,delivery_address,created_at,profiles(display_name,email)'
      )
      .order('created_at', { ascending: false })
      .limit(8),
    supabaseAdmin
      .from('profiles')
      .select('id,display_name,email,subscription_tier,created_at')
      .order('created_at', { ascending: false })
      .limit(8),
  ]);

  const queryError =
    profilesRes.error ||
    ordersRes.error ||
    productsRes.error ||
    allOrdersStatsRes.error ||
    recentOrdersRes.error ||
    recentProfilesRes.error;
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
    };
  });

  const recentCustomers = (recentProfilesRes.data || []).map((profile) => ({
    id: profile.id,
    name: profile.display_name || profile.email?.split('@')[0] || 'Хэрэглэгч',
    email: profile.email || '',
    createdAt: profile.created_at ? new Date(profile.created_at).toLocaleString('mn-MN') : '',
    subscriptionTier: profile.subscription_tier || 'free',
  }));

  const allOrderAmounts = (allOrdersStatsRes.data || []).map((order) => Number(order.total_amount || 0));
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
  });
});

export default router;
