import SiteHeader from './SiteHeader.jsx';
import PageFooter from './PageFooter.jsx';
import { cx } from '../utils/classNames.js';

export default function CatalogPageLayout({
  active = '',
  searchContent = null,
  showCatalogNav = true,
  showSearch = true,
  showUploadLink = true,
  showFooter = true,
  wrapperClassName = '',
  contentClassName = '',
  mainClassName = '',
  contentId,
  children,
}) {
  const contentProps = contentId ? { id: contentId } : {};
  const pageWrapperClassName = cx(
    'page-wrapper',
    !showCatalogNav && 'page-wrapper--without-catalog-nav',
    !showSearch && 'page-wrapper--without-search',
    wrapperClassName,
  );

  return (
    <div className={pageWrapperClassName}>
      <SiteHeader
        active={active}
        searchContent={searchContent}
        showCatalogNav={showCatalogNav}
        showSearch={showSearch}
        showUploadLink={showUploadLink}
      />

      <div className={cx('content-wrapper', contentClassName)} {...contentProps}>
        <main className={cx('main-content', mainClassName)}>
          {children}
        </main>
      </div>

      {showFooter ? <PageFooter /> : null}
    </div>
  );
}
