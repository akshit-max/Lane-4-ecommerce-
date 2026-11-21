/**
 * LANE4 Storefront Dynamic Catalog Hydration
 * Real-time synchronization of products & categories from the database.
 */

(function () {
  async function hydrateCatalog() {
    const productGrid = document.querySelector('.collection-list.w-dyn-items');
    if (!productGrid) return;

    const isInSubfolder = /\/(product|category|blog|authors|utility-pages|category-blog)\//i.test(window.location.pathname);
    const catMatch = window.location.pathname.match(/\/category\/([a-zA-Z0-9-]+)(?:\.html)?/);
    const currentCatSlug = catMatch ? catMatch[1] : (
      window.location.pathname.includes('/category/') ? document.documentElement.getAttribute('data-wf-item-slug') : null
    );

    try {
      const res = await window.lane4ApiRequest('/products');
      const products = (res && res.data && res.data.products) || (Array.isArray(res && res.data) ? res.data : []);
      if (!products.length) return;

      // Extract existing product slugs in DOM
      const existingSlugs = new Set();
      productGrid.querySelectorAll('a[href*="product/"]').forEach(link => {
        const match = link.getAttribute('href').match(/product\/([a-zA-Z0-9-]+)(?:\.html)?/);
        if (match) existingSlugs.add(match[1]);
      });

      // Filter products if on a category-specific page
      const visibleProducts = currentCatSlug
        ? products.filter(p => (p.categorySlug === currentCatSlug || p.category === currentCatSlug || (p.category && p.category.toLowerCase().replace(/[^a-z0-9]+/g, '-') === currentCatSlug)))
        : products;

      // Append any newly added products from DB
      visibleProducts.forEach(p => {
        if (!p.isPublished || p.isDeleted) return;

        let rawImg = (p.images && p.images[0] && p.images[0].url) || '6424266ea05809dff501d86e/lane4-6dbhNuWa5oI-640x640.jpg';
        let imgUrl = rawImg;
        if (window.LANE4 && window.LANE4.resolveAssetUrl) {
          imgUrl = window.LANE4.resolveAssetUrl(rawImg);
        }
        if (isInSubfolder && !imgUrl.startsWith('http') && !imgUrl.startsWith('/') && !imgUrl.startsWith('../')) {
          imgUrl = '../' + imgUrl;
        }

        const priceText = window.LANE4 ? `${window.LANE4.formatINR(p.salePricePaise || p.regularPricePaise)} INR` : '₹ 1,999.00 INR';
        const linkHref = isInSubfolder ? `../product/${p.slug}.html` : `product/${p.slug}.html`;

        if (!existingSlugs.has(p.slug)) {
          const itemEl = document.createElement('div');
          itemEl.setAttribute('role', 'listitem');
          itemEl.className = 'collection-item w-dyn-item';
          itemEl.setAttribute('data-category', p.categorySlug || p.category || '');
          itemEl.innerHTML = `
            <div style="opacity: 1;" class="shop-product">
              <a href="${linkHref}" class="sp-image-wrapper w-inline-block">
                <img alt="${p.name}" src="${imgUrl}" class="image" style="width:100%;height:100%;object-fit:cover;" />
              </a>
              <div class="sp-content">
                <p class="paragraph-14px">${p.name}</p>
                <p class="paragraph-13px grey">${p.shortDescription || 'Pool-tested performance gear'}</p>
                <p class="paragraph-16px">${priceText}</p>
              </div>
            </div>
          `;
          productGrid.appendChild(itemEl);
          existingSlugs.add(p.slug);
        } else {
          // Ensure existing cards have full opacity in case Webflow animation stalled
          const card = productGrid.querySelector(`a[href*="${p.slug}"]`);
          if (card) {
            const productCard = card.closest('.shop-product');
            if (productCard) productCard.style.opacity = '1';
          }
        }
      });

      // Ensure all cards are visible
      productGrid.querySelectorAll('.shop-product').forEach(el => {
        el.style.opacity = '1';
      });

    } catch (err) {
      console.warn('Could not hydrate dynamic catalog:', err);
    }
  }

  // Real-time category dropdown update
  async function hydrateCategories() {
    const dropdownList = document.querySelector('.dropdown-list .collection-list-wrapper .w-dyn-items');
    if (!dropdownList) return;

    const isInSubfolder = /\/(product|category|blog|authors|utility-pages|category-blog)\//i.test(window.location.pathname);
    const catPrefix = isInSubfolder ? '' : 'category/';

    try {
      const res = await window.lane4ApiRequest('/categories');
      const categories = (res && res.data) || [];
      if (!categories.length) return;

      const existingCatSlugs = new Set();
      dropdownList.querySelectorAll('a[href*="category/"], a[href$=".html"]').forEach(link => {
        const match = link.getAttribute('href').match(/category\/([a-zA-Z0-9-]+)(?:\.html)?/);
        if (match) existingCatSlugs.add(match[1]);
      });

      categories.forEach(cat => {
        if (!existingCatSlugs.has(cat.slug)) {
          const itemEl = document.createElement('div');
          itemEl.setAttribute('role', 'listitem');
          itemEl.className = 'w-dyn-item';
          itemEl.innerHTML = `
            <a href="${catPrefix}${cat.slug}.html" class="shop-dropdown w-inline-block">
              <p class="paragraph-14px">${cat.name}</p>
            </a>
          `;
          dropdownList.appendChild(itemEl);
          existingCatSlugs.add(cat.slug);
        }
      });
    } catch (e) {
      console.warn('Could not hydrate categories:', e);
    }
  }

  document.addEventListener('DOMContentLoaded', () => {
    hydrateCatalog();
    hydrateCategories();
  });
})();
