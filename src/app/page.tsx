import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import Sidebar from "@/components/layout/Sidebar";
import Main from "@/components/layout/Main";

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-gray-100">
      {/* Header - logo, naviation, search bar */}
      <Header />
      <div className="flex-grow flex flex-col md:flex-row max-w-7xl mx-auto w-full px-4 sm:px-6 lg:px-8 py-6 gap-6">
        {/* Sidofält - Ligor */}
        <Sidebar />
        {/* Huvudinnehåll - kommande matcher/tabeller */}
        <Main />
      </div>
      {/* Footer - kontakt/ social media/ copyright */}
      <Footer />
    </div>
  );
}
