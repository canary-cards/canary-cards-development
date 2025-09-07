import { Routes as RouterRoutes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Onboarding from "./pages/Onboarding";
import About from "./pages/About";
import ContactUs from "./pages/ContactUs";
import FAQ from "./pages/FAQ";
import PaymentSuccess from "./pages/PaymentSuccess";
import PaymentReturn from "./pages/PaymentReturn";
import PaymentRefunded from "./pages/PaymentRefunded";
import Share from "./pages/Share";
import NotFound from "./pages/NotFound";

const Routes = () => {
  return (
    <RouterRoutes>
      <Route path="/" element={<Index />} />
      <Route path="/onboarding" element={<Onboarding />} />
      <Route path="/about" element={<About />} />
      <Route path="/contact" element={<ContactUs />} />
      <Route path="/faq" element={<FAQ />} />
      <Route path="/payment/success" element={<PaymentSuccess />} />
      <Route path="/payment/return" element={<PaymentReturn />} />
      <Route path="/payment/refunded" element={<PaymentRefunded />} />
      <Route path="/share/:shareId" element={<Share />} />
      <Route path="*" element={<NotFound />} />
    </RouterRoutes>
  );
};

export default Routes;