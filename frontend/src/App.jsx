import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import { RequireAuth, RequireRole, RequireActiveRetailer } from './components/RouteGuards';

// Layouts
import AdminLayout from './layouts/AdminLayout';
import PublicLayout from './layouts/PublicLayout';
import RetailerLayout from './layouts/RetailerLayout';

// Public Pages
import Home from './pages/public/Home';

// Auth Pages
import SharedLogin from './pages/auth/SharedLogin';
import RetailerSignup from './pages/auth/RetailerSignup';
import AdminLogin from './pages/admin/AdminLogin';

// Admin Portal Pages
import Dashboard from './pages/Dashboard';
import ScraperMonitoring from './pages/ScraperMonitoring';
import SupplierManagement from './pages/SupplierManagement';
import SKUCatalogue from './pages/SKUCatalogue';
import ProductLogs from './pages/ProductLogs';
import ReviewQueue from './pages/ReviewQueue';
import SubscriberManagement from './pages/admin/SubscriberManagement';
import DailyDealsPreview from './pages/admin/DailyDealsPreview';
import AdminSettings from './pages/admin/AdminSettings';

// Retailer Portal Pages
import RetailerDashboard from './pages/retailer/Dashboard';
import ProductDetail from './pages/retailer/ProductDetail';
import SavedProducts from './pages/retailer/SavedProducts';
import Account from './pages/retailer/Account';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route element={<PublicLayout />}>
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<SharedLogin />} />
            <Route path="/signup" element={<RetailerSignup />} />
            <Route path="/register" element={<Navigate to="/signup" replace />} />
          </Route>

          {/* Admin Dedicated Auth Link */}
          <Route path="/admin/login" element={<SharedLogin />} />

          {/* Admin Portal (Kept completely intact) */}
          <Route path="/admin" element={
            <RequireRole allowedRoles={['admin', 'manager']}>
              <AdminLayout />
            </RequireRole>
          }>
            <Route index element={<Dashboard />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="scraper-runs" element={<ScraperMonitoring />} />
            <Route path="suppliers" element={<SupplierManagement />} />
            <Route path="catalogue" element={<SKUCatalogue />} />
            <Route path="products" element={<ProductLogs />} />
            <Route path="review-queue" element={<ReviewQueue />} />
            <Route path="subscribers" element={<SubscriberManagement />} />
            <Route path="daily-deals" element={<DailyDealsPreview />} />
            <Route path="settings" element={<AdminSettings />} />
          </Route>

          {/* Retailer Portal Shell */}
          <Route path="/app" element={
            <RequireRole allowedRoles={['retailer']}>
              <RequireActiveRetailer>
                <RetailerLayout />
              </RequireActiveRetailer>
            </RequireRole>
          }>
            <Route index element={<RetailerDashboard />} />
            <Route path="product/:id" element={<ProductDetail />} />
            <Route path="favourites" element={<SavedProducts />} />
            <Route path="saved" element={<Navigate to="/app/favourites" replace />} />
            <Route path="account" element={<Account />} />
            <Route path="subscription" element={<Account />} />
          </Route>

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;
