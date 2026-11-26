/**
 * LANE4 Storefront Dynamic Catalog Hydration
 * Real-time synchronization of products & categories from the database.
 */

(function () {
  const STATIC_CATEGORY_SLUGS = new Set([
    'accessories',
    'fins-and-flippers',
    'goggles',
    'hand-bands',
    'racing-caps',
    'swimwear',
    'training-gear'
  ]);

  function escapeHtml(str) {
    return String(str == null ? '' : str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function humanizeSlug(slug) {
    return String(slug || '')
      .replace(/[-_]+/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
      .trim();
  }

  function getCategoryPrefix() {
    if (window.location.protocol !== 'file:') return '/category/';
    const pathname = window.location.pathname || '/';
    if (/\/category\//i.test(pathname)) return '';
    if (/\/(product|blog|authors|utility-pages|category-blog)\//i.test(pathname)) return '../category/';
    return 'category/';
  }

  function buildCategoryHref(slug, catPrefix) {
    if (!slug) return `${catPrefix}detail.html`;
    if (STATIC_CATEGORY_SLUGS.has(slug)) {
      return `${catPrefix}${slug}.html`;
    }
    return `${catPrefix}detail.html?slug=${encodeURIComponent(slug)}`;
  }

  function resolveProductImageUrl(p, isInSubfolder) {
    const rawImg = (p.images && p.images[0] && (p.images[0].secureUrl || p.images[0].url)) ||
      '6424266ea05809dff501d86e/lane4-6dbhNuWa5oI-640x640.jpg';
    let imgUrl = rawImg;
    if (window.LANE4 && window.LANE4.resolveAssetUrl) {
      imgUrl = window.LANE4.resolveAssetUrl(rawImg);
    }
    if (isInSubfolder && !imgUrl.startsWith('http') && !imgUrl.startsWith('/') && !imgUrl.startsWith('../')) {
      imgUrl = '../' + imgUrl;
    }
    return imgUrl;
  }

  function formatProductPriceHtml(p) {
    const regularPrice = p.regularPricePaise || 0;
    const hasSale = p.salePricePaise && p.salePricePaise > 0 && p.salePricePaise < regularPrice;
    if (hasSale) {
      const saleFormatted = window.LANE4 ? `${window.LANE4.formatINR(p.salePricePaise)} INR` : `₹ ${(p.salePricePaise / 100).toFixed(2)} INR`;
      const regFormatted = window.LANE4 ? `${window.LANE4.formatINR(regularPrice)} INR` : `₹ ${(regularPrice / 100).toFixed(2)} INR`;
      return `${saleFormatted} <span style="font-size:12px;text-decoration:line-through;color:#94a3b8;font-weight:normal;margin-left:6px;">${regFormatted}</span>`;
    }
    const primaryVal = regularPrice > 0 ? regularPrice : (p.salePricePaise || 0);
    return window.LANE4 ? `${window.LANE4.formatINR(primaryVal)} INR` : `₹ ${(primaryVal / 100).toFixed(2)} INR`;
  }

  function buildProductHref(slug, isInSubfolder) {
    if (window.location.protocol !== 'file:') return `/product/${slug}.html`;
    return isInSubfolder ? `../product/${slug}.html` : `product/${slug}.html`;
  }

  function createShopProductItem(p, isInSubfolder, itemClass = 'w-dyn-item') {
    const imgUrl = resolveProductImageUrl(p, isInSubfolder);
    const priceHtml = formatProductPriceHtml(p);
    const linkHref = buildProductHref(p.slug, isInSubfolder);

    const itemEl = document.createElement('div');
    itemEl.setAttribute('role', 'listitem');
    itemEl.className = itemClass;
    itemEl.setAttribute('data-category', p.categorySlug || p.category || '');
    itemEl.innerHTML = `
      <div style="opacity: 1;" class="shop-product">
        <a href="${linkHref}" class="sp-image-wrapper w-inline-block">
          <img alt="${escapeHtml(p.name)}" src="${escapeHtml(imgUrl)}" class="image" style="width:100%;height:100%;object-fit:cover;" />
        </a>
        <div class="sp-content">
          <p class="paragraph-14px">${escapeHtml(p.name)}</p>
          <p class="paragraph-13px grey">${escapeHtml(p.shortDescription || 'Pool-tested performance gear')}</p>
          <p class="paragraph-16px">${priceHtml}</p>
        </div>
      </div>
    `;
    return itemEl;
  }

  function revealCategoryPageSections() {
    document.querySelectorAll('.hs-content, .collection-list-categories, .category-row .cr-grid, .collection-list-wrapper-category, .categories-cta, .sp-grid').forEach(el => {
      el.style.opacity = '1';
    });
  }

  function buildSubcategoryHref(parentSlug, subSlug, catPrefix) {
    if (window.location.protocol !== 'file:') {
      return `/category/${encodeURIComponent(parentSlug)}/${encodeURIComponent(subSlug)}`;
    }
    return `${catPrefix}detail.html?slug=${encodeURIComponent(parentSlug)}&sub=${encodeURIComponent(subSlug)}`;
  }

  function renderSubcategoryBar(parentCat, activeSubSlug) {
    const categoriesBar = document.querySelector('.categories');
    if (!categoriesBar || !parentCat || !Array.isArray(parentCat.subcategories) || !parentCat.subcategories.length) {
      return;
    }

    const existing = document.getElementById('lane4-subcategory-bar');
    if (existing) existing.remove();

    const catPrefix = getCategoryPrefix();
    const normalizedSub = (activeSubSlug || '').toLowerCase().trim();
    const isAllActive = !normalizedSub;

    const bar = document.createElement('div');
    bar.id = 'lane4-subcategory-bar';
    bar.style.cssText = 'display:flex;flex-wrap:wrap;align-items:center;gap:20px;padding:12px 0;border-bottom:1px solid #000000;margin-top:0;font-family:Generalsans,sans-serif;';

    const label = document.createElement('span');
    label.textContent = 'SUBCATEGORIES:';
    label.style.cssText = 'font-size:11px;font-weight:500;letter-spacing:0.8px;text-transform:uppercase;color:#64748b;margin-right:4px;';
    bar.appendChild(label);

    function makeSubLink(text, href, isCurrent) {
      const a = document.createElement('a');
      a.href = href;
      a.textContent = text;
      a.style.cssText = `font-size:14px;line-height:1.4;text-decoration:none;padding:4px 0;border-bottom:2px solid ${isCurrent ? '#000000' : 'transparent'};color:${isCurrent ? '#000000' : '#64748b'};font-weight:${isCurrent ? '500' : '400'};transition:color 0.15s ease,border-color 0.15s ease;`;
      return a;
    }

    bar.appendChild(makeSubLink(`All ${parentCat.name || humanizeSlug(parentCat.slug)}`, buildCategoryHref(parentCat.slug, catPrefix), isAllActive));

    parentCat.subcategories.forEach(sub => {
      if (!sub || !sub.slug) return;
      const isCurrent = normalizedSub === String(sub.slug).toLowerCase().trim();
      bar.appendChild(makeSubLink(sub.name || humanizeSlug(sub.slug), buildSubcategoryHref(parentCat.slug, sub.slug, catPrefix), isCurrent));
    });

    categoriesBar.insertAdjacentElement('afterend', bar);
  }

  function applyCategoryMeta(slug, cat, subCat) {
    const baseName = (cat && cat.name) || humanizeSlug(slug);
    const subName = subCat && (subCat.name || humanizeSlug(subCat.slug));
    const displayName = subName ? `${baseName} / ${subName}` : baseName;
    const displayDesc = subName
      ? `Browse ${subName} under ${baseName}.`
      : ((cat && cat.description) || `Explore our ${baseName} swimming collection.`);

    const sectionHeading = document.querySelector('.category-row .title-h2, .category-row h2, .category-title');
    if (sectionHeading && displayName) sectionHeading.textContent = subName || baseName;

    const sectionDesc = document.querySelector('.category-row .cr-paragraph .paragraph-16px, .category-description');
    if (sectionDesc && displayDesc) sectionDesc.textContent = displayDesc;

    const breadcrumbActive = document.querySelector('.breadcrumbs a.w--current, .breadcrumbs a:last-child');
    if (breadcrumbActive && displayName) {
      const inner = breadcrumbActive.querySelector('div, p') || breadcrumbActive;
      inner.textContent = displayName;
      breadcrumbActive.setAttribute('href', window.location.pathname + window.location.search);
    }

    if (displayName) {
      document.title = `${displayName} | Swimming Gear | The Lane4 Performance Store`;
    }
    revealCategoryPageSections();
  }

  function ensureDiscoverSectionOnCategoryPage() {
    let discoverGrid = document.querySelector('.collection-list-product.w-dyn-items');
    if (discoverGrid) return discoverGrid;

    const categorySection = document.querySelector('.category-row')?.closest('.section');
    if (!categorySection || !categorySection.parentNode) return null;

    const sectionEl = document.createElement('div');
    sectionEl.className = 'section';
    sectionEl.id = 'lane4-discover-other-section';
    sectionEl.innerHTML = `
      <div class="container">
        <div class="sp-grid" style="opacity: 1;">
          <div class="cr-grid-column"><div class="paragraph-20px">MORE</div></div>
          <div class="cr-grid-column-2"><h2 class="title-h2 black mb">Discover other products</h2></div>
          <div class="cr-grid-column-3"><div class="cr-paragraph"><div class="paragraph-16px">More performance swim gear, hand-picked for swimmers across India.</div></div></div>
        </div>
        <div class="w-dyn-list">
          <div role="list" class="collection-list-product w-dyn-items"></div>
        </div>
      </div>
    `;
    categorySection.parentNode.insertBefore(sectionEl, categorySection.nextSibling);
    return sectionEl.querySelector('.collection-list-product.w-dyn-items');
  }

  function renderCategoryEmptyState(productGrid, isInSubfolder) {
    const shopHref = window.location.protocol !== 'file:' ? '/shop.html' : (isInSubfolder ? '../shop.html' : 'shop.html');
    const emptyEl = document.createElement('div');
    emptyEl.style.cssText = 'text-align:center;padding:48px 20px;grid-column:1/-1;color:#525252;font-size:14px;width:100%;border:1px solid #e5e5e5;background:#fafafa;border-radius:0px;';
    emptyEl.innerHTML = `
      <p style="font-weight:500;font-size:16px;color:#111111;margin-bottom:8px;letter-spacing:0.2px;">No products under this category</p>
      <p style="margin:0;color:#64748b;">New gear is on the way. Discover other products below or explore our complete collection in the <a href="${shopHref}" style="color:#111111;text-decoration:underline;font-weight:500;">Shop</a>.</p>
    `;
    productGrid.appendChild(emptyEl);
  }

  async function hydrateCatalog() {
    const isInSubfolder = /\/(product|category|blog|authors|utility-pages|category-blog)\//i.test(window.location.pathname);
    const subCatMatch = window.location.pathname.match(/\/category\/([a-zA-Z0-9_-]+)\/([a-zA-Z0-9_-]+)(?:\.html?)?/i);
    const catMatch = window.location.pathname.match(/\/category\/([a-zA-Z0-9_-]+)(?:\.html?)?/i);
    const searchParams = new URLSearchParams(window.location.search);
    const queryCatSlug = searchParams.get('slug');
    const querySubSlug = searchParams.get('sub');
    const docSlug = document.documentElement.getAttribute('data-wf-item-slug');

    const rawSingleCat = (catMatch && catMatch[1] !== 'detail' && catMatch[1] !== 'index') ? catMatch[1] : null;
    const parentCatSlug = subCatMatch ? subCatMatch[1] : (rawSingleCat || queryCatSlug || (window.location.pathname.includes('/category/') && docSlug !== 'detail' ? docSlug : null));
    const subCatSlug = subCatMatch ? subCatMatch[2] : (querySubSlug || null);
    const currentCatSlug = subCatSlug || parentCatSlug;
    const isCategoryPage = window.location.pathname.includes('/category/');
    let categoryNotFound = false;

    if (parentCatSlug || currentCatSlug) {
      applyCategoryMeta(parentCatSlug || currentCatSlug, null, subCatSlug ? { slug: subCatSlug } : null);
      try {
        window.lane4ApiRequest(`/categories/${encodeURIComponent(parentCatSlug || currentCatSlug)}`).then(catRes => {
          if (catRes && catRes.data) {
            const matchedSub = subCatSlug && Array.isArray(catRes.data.subcategories)
              ? catRes.data.subcategories.find(s => String(s.slug || '').toLowerCase() === subCatSlug.toLowerCase()) || { slug: subCatSlug }
              : null;
            applyCategoryMeta(parentCatSlug || currentCatSlug, catRes.data, matchedSub);
            if (isCategoryPage) {
              renderSubcategoryBar(catRes.data, subCatSlug);
            }
          }
        }).catch((err) => {
          const isGenericDetail = /\/category\/detail/i.test(window.location.pathname) ||
            docSlug === 'detail' ||
            (isCategoryPage && !STATIC_CATEGORY_SLUGS.has(String(parentCatSlug || '').toLowerCase()));
          if (isGenericDetail && err && /not found|404/i.test(String(err.message || ''))) {
            categoryNotFound = true;
            document.title = '404 — Category Not Found | The Lane4 Performance Store';
            const metaRobots = document.createElement('meta');
            metaRobots.name = 'robots';
            metaRobots.content = 'noindex';
            document.head.appendChild(metaRobots);
            const hero = document.querySelector('.hero-shop') || document.querySelector('.section');
            if (hero) {
              hero.innerHTML = `
                <div style="max-width:540px;margin:48px auto;padding:44px 28px;border:1px solid #dcdcdc;background:#fafafa;text-align:center;font-family:'Generalsans','General Sans',sans-serif;">
                  <div style="font-size:11px;font-weight:500;letter-spacing:1.2px;text-transform:uppercase;color:#64748b;margin-bottom:10px;">Error 404</div>
                  <h1 class="title-h1" style="margin:0 0 12px;font-size:32px;line-height:1.15;font-weight:500;color:#111111;">Category Not Found</h1>
                  <p style="font-size:14.5px;line-height:1.6;color:#555555;margin:0 0 24px;">This category is unavailable or has been removed from our catalog.</p>
                  <a href="/shop.html" style="display:inline-flex;align-items:center;justify-content:center;min-height:44px;padding:12px 24px;background:#000000;color:#ffffff;text-decoration:none;font-size:12px;font-weight:500;letter-spacing:0.8px;text-transform:uppercase;">Browse Shop</a>
                </div>
              `;
            }
            const catRowSec = document.querySelector('.category-row')?.closest('.section');
            if (catRowSec) catRowSec.style.display = 'none';
            const discSec = document.getElementById('lane4-discover-other-section');
            if (discSec) discSec.style.display = 'none';
            const ctaSec = document.querySelector('.categories-cta')?.closest('.section');
            if (ctaSec) ctaSec.style.display = 'none';
          }
        });
      } catch (_) {}
    }

    try {
      const res = await window.lane4ApiRequest('/products');
      if (categoryNotFound) return;
      const products = (res && res.data && res.data.products) || (Array.isArray(res && res.data) ? res.data : []);

      const productMap = new Map();
      products.forEach(p => {
        if (p.slug) productMap.set(p.slug.toLowerCase(), p);
        if (p.name) productMap.set(p.name.toLowerCase().trim(), p);
      });

      function normalizeSlugStr(val) {
        return String(val || '').toLowerCase().trim().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
      }

      function matchesCat(p) {
        if (!currentCatSlug) return true;
        const cleanP = normalizeSlugStr(p.categorySlug || p.category);
        const cleanSub = normalizeSlugStr(p.subcategorySlug || p.subcategory);

        if (subCatSlug) {
          const cleanParentTarget = normalizeSlugStr(parentCatSlug);
          const cleanSubTarget = normalizeSlugStr(subCatSlug);
          const subOk = cleanSub && (cleanSub === cleanSubTarget || cleanSub + 's' === cleanSubTarget || cleanSubTarget + 's' === cleanSub || cleanSub.replace(/s$/, '') === cleanSubTarget.replace(/s$/, ''));
          if (!subOk) return false;
          if (cleanParentTarget && cleanP) {
            return cleanP === cleanParentTarget || cleanP + 's' === cleanParentTarget || cleanParentTarget + 's' === cleanP || cleanP.replace(/s$/, '') === cleanParentTarget.replace(/s$/, '');
          }
          return true;
        }

        const cleanT = normalizeSlugStr(currentCatSlug);
        if (cleanP === cleanT || cleanSub === cleanT) return true;
        if (cleanP + 's' === cleanT || cleanT + 's' === cleanP) return true;
        if (cleanSub + 's' === cleanT || cleanT + 's' === cleanSub) return true;
        if (cleanP.replace(/s$/, '') === cleanT.replace(/s$/, '')) return true;
        if (cleanSub && cleanSub.replace(/s$/, '') === cleanT.replace(/s$/, '')) return true;
        return false;
      }

      // If on a category page, ensure "Discover other products" section exists when other products are available
      if (currentCatSlug) {
        ensureDiscoverSectionOnCategoryPage();
      }

      // Find all product grids across storefront (Shop grid, Category grid, and "Discover other products")
      const allGrids = document.querySelectorAll(
        '.collection-list-category.w-dyn-items, .collection-list.w-dyn-items, .collection-list-wrapper-category .w-dyn-items, .collection-list-product.w-dyn-items'
      );
      if (!allGrids.length) return;

      allGrids.forEach(productGrid => {
        const isDiscoverOtherGrid = productGrid.classList.contains('collection-list-product');
        const isCategoryGrid = Boolean(currentCatSlug) && (
          productGrid.classList.contains('collection-list-category') ||
          Boolean(productGrid.closest('.collection-list-wrapper-category'))
        );

        // 1. Live update any existing cards in the grid (e.g. Discover Other Products or static catalog cards)
        const matchedProductSlugsInGrid = new Set();
        const existingItems = productGrid.querySelectorAll('.w-dyn-item, .collection-item');

        existingItems.forEach(item => {
          const link = item.querySelector('a[href*="product/"], a[href$=".html"]');
          if (!link) return;
          const href = link.getAttribute('href') || '';
          const match = href.match(/product\/([a-zA-Z0-9_-]+)(?:\.html)?/i) || href.match(/([a-zA-Z0-9_-]+)\.html/i);
          const slug = match ? match[1].toLowerCase() : null;
          const titleEl = item.querySelector('.paragraph-14px, .product-title, .sp-content .paragraph-14px');
          const name = titleEl ? titleEl.textContent.trim().toLowerCase() : '';

          const p = (slug && productMap.get(slug)) || (name && productMap.get(name));

          // If this is a category grid, remove hardcoded mismatched template products
          if (isCategoryGrid && (!p || !matchesCat(p))) {
            item.remove();
            return;
          }

          if (p) {
            matchedProductSlugsInGrid.add(p.slug.toLowerCase());

            if (p.isPublished === false || p.isDeleted === true) {
              item.style.display = 'none';
              return;
            }

            item.style.display = '';
            item.style.opacity = '1';

            const imgUrl = resolveProductImageUrl(p, isInSubfolder);
            const imgEl = item.querySelector('img');
            if (imgEl && imgUrl) {
              imgEl.src = imgUrl;
              imgEl.alt = p.name;
              if (imgEl.hasAttribute('srcset')) imgEl.removeAttribute('srcset');
              imgEl.style.opacity = '1';
            }

            if (titleEl && p.name) titleEl.textContent = p.name;

            const shortDescEl = item.querySelector('.paragraph-13px.grey, .paragraph-13px');
            if (shortDescEl) shortDescEl.textContent = p.shortDescription || 'Multiple options available';

            const priceEl = item.querySelector('.paragraph-16px, [data-wf-sku-bindings*="f_price_"]');
            if (priceEl) priceEl.innerHTML = formatProductPriceHtml(p);

            const linkHref = buildProductHref(p.slug, isInSubfolder);
            if (link) link.setAttribute('href', linkHref);
          }
        });

        // 2. Populate empty Discover Other Products grid dynamically (e.g. on category/detail.html)
        if (isDiscoverOtherGrid && productGrid.children.length === 0) {
          const published = products.filter(p => p.isPublished !== false && !p.isDeleted);
          const otherProducts = currentCatSlug
            ? published.filter(p => !matchesCat(p))
            : published;
          const picks = (otherProducts.length ? otherProducts : published).slice(0, 4);

          if (picks.length) {
            picks.forEach(p => {
              productGrid.appendChild(createShopProductItem(p, isInSubfolder));
            });
          } else {
            const discoverSection = productGrid.closest('#lane4-discover-other-section');
            if (discoverSection) discoverSection.style.display = 'none';
          }
        }

        // 3. Append newly created products that belong here (Shop or Category grid)
        if (!isDiscoverOtherGrid) {
          const eligibleProducts = isCategoryGrid
            ? products.filter(p => p.isPublished !== false && !p.isDeleted && matchesCat(p))
            : products.filter(p => p.isPublished !== false && !p.isDeleted);

          eligibleProducts.forEach(p => {
            if (matchedProductSlugsInGrid.has(p.slug.toLowerCase())) return;

            let itemEl;
            if (isCategoryGrid) {
              const imgUrl = resolveProductImageUrl(p, isInSubfolder);
              const priceHtml = formatProductPriceHtml(p);
              const linkHref = buildProductHref(p.slug, isInSubfolder);

              itemEl = document.createElement('div');
              itemEl.setAttribute('role', 'listitem');
              itemEl.className = 'w-dyn-item';
              itemEl.setAttribute('data-category', p.categorySlug || p.category || '');
              itemEl.innerHTML = `
                <div class="cr-grid">
                  <div class="product-card" style="opacity: 1;">
                    <a href="${linkHref}" class="sp-image-wrapper w-inline-block">
                      <img alt="${escapeHtml(p.name)}" src="${escapeHtml(imgUrl)}" class="image" style="width:100%;height:100%;object-fit:cover;" />
                    </a>
                    <div class="product-text-wrapper">
                      <div class="paragraph-14px">${escapeHtml(p.name)}</div>
                      <div class="paragraph-13px grey">${escapeHtml(p.shortDescription || 'Pool-tested performance gear')}</div>
                      <div class="paragraph-16px">${priceHtml}</div>
                    </div>
                  </div>
                </div>
              `;
            } else {
              itemEl = createShopProductItem(p, isInSubfolder, 'collection-item w-dyn-item');
            }
            productGrid.appendChild(itemEl);
            matchedProductSlugsInGrid.add(p.slug.toLowerCase());
          });

          // Empty state on category pages
          if (isCategoryGrid && productGrid.children.length === 0) {
            renderCategoryEmptyState(productGrid, isInSubfolder);
          }
        }

        // Ensure all cards are visible
        productGrid.querySelectorAll('.shop-product, .product-card').forEach(el => {
          el.style.opacity = '1';
        });
      });

    } catch (err) {
      console.warn('Could not hydrate dynamic catalog:', err);
    }
  }

  // Real-time category dropdown & category pill bar update
  async function hydrateCategories() {
    const dropdownList = document.querySelector('.dropdown-list .collection-list-wrapper .w-dyn-items');
    const categoryBarList = document.querySelector('.collection-list-categories.w-dyn-items');
    if (!dropdownList && !categoryBarList) return;

    const catPrefix = getCategoryPrefix();
    const queryCatSlug = new URLSearchParams(window.location.search).get('slug');
    const catMatch = window.location.pathname.match(/\/category\/([a-zA-Z0-9_-]+)(?:\.html?)?/i);
    const activeSlug = (catMatch && catMatch[1] !== 'detail' && catMatch[1] !== 'index') ? catMatch[1] : queryCatSlug;

    function collectExistingSlugs(container) {
      const slugs = new Set();
      if (!container) return slugs;
      container.querySelectorAll('a[href]').forEach(link => {
        const href = link.getAttribute('href') || '';
        const slugParam = href.match(/[?&]slug=([a-zA-Z0-9-]+)/);
        if (slugParam) {
          slugs.add(slugParam[1].toLowerCase());
          return;
        }
        const m = href.match(/(?:^|\/)([a-zA-Z0-9-]+)(?:\.html)?$/);
        if (m && m[1] !== 'detail' && m[1] !== 'shop') {
          slugs.add(m[1].toLowerCase());
        }
      });
      return slugs;
    }

    try {
      const res = await window.lane4ApiRequest('/categories');
      const categories = (res && res.data) || [];
      if (!categories.length) return;

      if (dropdownList) {
        const existingDropdownSlugs = collectExistingSlugs(dropdownList);
        categories.forEach(cat => {
          const slugKey = (cat.slug || '').toLowerCase();
          if (!slugKey || existingDropdownSlugs.has(slugKey)) return;
          const itemEl = document.createElement('div');
          itemEl.setAttribute('role', 'listitem');
          itemEl.className = 'w-dyn-item';
          itemEl.innerHTML = `
            <a href="${buildCategoryHref(cat.slug, catPrefix)}" class="shop-dropdown w-inline-block">
              <p class="paragraph-14px">${escapeHtml(cat.name)}</p>
            </a>
          `;
          dropdownList.appendChild(itemEl);
          existingDropdownSlugs.add(slugKey);
        });
      }

      function hrefMatchesSlug(linkEl, slugKey) {
        const href = (linkEl.getAttribute('href') || '').toLowerCase();
        const slugParam = href.match(/[?&]slug=([a-z0-9_-]+)/i);
        if (slugParam) return slugParam[1].toLowerCase() === slugKey;
        const m = href.match(/(?:^|\/)([a-z0-9_-]+)(?:\.html)?$/i);
        return Boolean(m && m[1].toLowerCase() === slugKey);
      }

      if (categoryBarList) {
        if (activeSlug) {
          const activeKey = activeSlug.toLowerCase();
          categoryBarList.querySelectorAll('a.w--current').forEach(a => {
            if (!hrefMatchesSlug(a, activeKey)) {
              a.classList.remove('w--current');
            }
          });
        }
        const existingBarSlugs = collectExistingSlugs(categoryBarList);
        categories.forEach(cat => {
          const slugKey = (cat.slug || '').toLowerCase();
          if (!slugKey) return;
          const isCurrent = activeSlug && activeSlug.toLowerCase() === slugKey;
          if (existingBarSlugs.has(slugKey)) {
            if (isCurrent) {
              categoryBarList.querySelectorAll('a[href]').forEach(a => {
                if (hrefMatchesSlug(a, slugKey)) {
                  a.classList.add('w--current');
                }
              });
            }
            return;
          }
          const itemEl = document.createElement('div');
          itemEl.setAttribute('role', 'listitem');
          itemEl.className = 'w-dyn-item';
          itemEl.innerHTML = `
            <a href="${buildCategoryHref(cat.slug, catPrefix)}" class="categories-link w-inline-block${isCurrent ? ' w--current' : ''}"><p>${escapeHtml(cat.name)}</p></a>
          `;
          categoryBarList.appendChild(itemEl);
          existingBarSlugs.add(slugKey);
        });
      }
    } catch (e) {
      console.warn('Could not hydrate categories:', e);
    }
  }

  function runCatalogHydration() {
    hydrateCatalog();
    hydrateCategories();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runCatalogHydration);
  } else {
    runCatalogHydration();
  }
})();
