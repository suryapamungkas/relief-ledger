import { Routes, Route, Navigate } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { Home } from "@/pages/Home";
import { CampaignDetail } from "@/pages/CampaignDetail";
import { MyDonations } from "@/pages/MyDonations";
import { Organizer } from "@/pages/Organizer";
import { Verifier } from "@/pages/Verifier";
import { Admin } from "@/pages/Admin";
import { About } from "@/pages/About";

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/campaign/:id" element={<CampaignDetail />} />
        <Route path="/me" element={<MyDonations />} />
        <Route path="/organizer" element={<Organizer />} />
        <Route path="/verifier" element={<Verifier />} />
        <Route path="/admin" element={<Admin />} />
        <Route path="/about" element={<About />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Layout>
  );
}
