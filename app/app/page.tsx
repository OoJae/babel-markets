// /app: brand-styled paste flow. The page is the destination of the "Open
// Babel" CTAs on the landing. Nav anchors are prefixed with "/" so they jump
// back to the landing instead of resolving against this page's id-less layout.

import { AppHero } from "../_components/AppHero";
import { AppTrust } from "../_components/AppTrust";
import { BrandPasteBox } from "../_components/BrandPasteBox";
import { Footer } from "../_components/Footer";
import { Nav } from "../_components/Nav";

export default function AppPage() {
  return (
    <>
      <Nav linkBase="/" />
      <AppHero />
      <section className="app-stage" id="agent">
        <BrandPasteBox />
      </section>
      <AppTrust />
      <section className="cta" style={{ paddingTop: 48, paddingBottom: 32 }}>
        <Footer />
      </section>
      <div className="app-foot-strip">
        Testnet only . Non-US wallets only . See compliance banner.
      </div>
    </>
  );
}
