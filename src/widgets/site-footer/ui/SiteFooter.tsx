import { isDemoMode } from "../../../shared/config/index.ts";
import { Brand } from "../../../shared/ui/brand/index.ts";

type SiteFooterProps = {
  onCatalog: () => void;
};

export default function SiteFooter({ onCatalog }: SiteFooterProps) {
  return (
    <footer className="site-footer">
      <div className="footer-inner">
        <button
          type="button"
          className="brand-button footer-brand"
          onClick={onCatalog}
          aria-label="NEW STYLE — каталог"
        >
          <Brand />
        </button>
        <span>
          {isDemoMode
            ? "Деморежим · тестовые данные"
            : "Каталог для вашего бизнеса"}
        </span>
        <span className="footer-copyright">
          © {new Date().getFullYear()} NEW STYLE
        </span>
      </div>
    </footer>
  );
}
