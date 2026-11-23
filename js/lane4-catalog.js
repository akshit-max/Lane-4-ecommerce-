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
    const queryCatSlug = new URLSearchParams(window.location.search).get('slug');
    const currentCatSlug = (catMatch && catMatch[1] !== 'detail') ? catMatch[1] : (
      queryCatSlug || (window.location.pathname.includes('/category/') ? document.documentElement.getAttribute('data-wf-item-slug') : null)
    );

    if (currentCatSlug) {
      try {
        window.lane4ApiRequest(`/categories/${encodeURIComponent(currentCatSlug)}`).then(catRes => {
          if (catRes && catRes.data) {
            const cat = catRes.data;
            const h1 = document.querySelector('h1, .heading-h1, .category-title');
            if (h1 && cat.name) h1.textContent = cat.name;
            const catDesc = document.querySelector('.paragraph-18px, .category-description');
            if (catDesc && cat.description) catDesc.textContent = cat.description;
            if (cat.name) document.title = `${cat.name} | The Lane4 Performance Store`;
          }
        }).catch(() => {});
      } catch (_) {}
    }

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

      // Real-time synchronization of visible products (both existing cards and newly created products)
      visibleProducts.forEach(p => {
        let rawImg = (p.images && p.images[0] && p.images[0].url) || '6424266ea05809dff501d86e/lane4-6dbhNuWa5oI-640x640.jpg';
        let imgUrl = rawImg;
        if (window.LANE4 && window.LANE4.resolveAssetUrl) {
          imgUrl = window.LANE4.resolveAssetUrl(rawImg);
        }
        if (isInSubfolder && !imgUrl.startsWith('http') && !imgUrl.startsWith('/') && !imgUrl.startsWith('../')) {
          imgUrl = '../' + imgUrl;
        }

        const regularPrice = p.regularPricePaise || 0;
        const hasSale = p.salePricePaise && p.salePricePaise > 0 && p.salePricePaise < regularPrice;
        let priceHtml = '';
        if (hasSale) {
          const saleFormatted = window.LANE4 ? `${window.LANE4.formatINR(p.salePricePaise)} INR` : `₹ ${(p.salePricePaise/100).toFixed(2)} INR`;
          const regFormatted = window.LANE4 ? `${window.LANE4.formatINR(regularPrice)} INR` : `₹ ${(regularPrice/100).toFixed(2)} INR`;
          priceHtml = `${saleFormatted} <span style="font-size:12px;text-decoration:line-through;color:#94a3b8;font-weight:normal;margin-left:6px;">${regFormatted}</span>`;
        } else {
          const primaryVal = regularPrice > 0 ? regularPrice : (p.salePricePaise || 0);
          priceHtml = window.LANE4 ? `${window.LANE4.formatINR(primaryVal)} INR` : `₹ ${(primaryVal/100).toFixed(2)} INR`;
        }
        const linkHref = isInSubfolder ? `../product/${p.slug}.html` : `product/${p.slug}.html`;

        const existingCardLink = productGrid.querySelector(`a[href*="product/${p.slug}"], a[href="${p.slug}.html"]`);

        // If product is unpublished or soft-deleted:
        if (p.isPublished === false || p.isDeleted === true) {
          if (existingCardLink) {
            const wrapper = existingCardLink.closest('.collection-item') || existingCardLink.closest('.w-dyn-item') || existingCardLink.closest('.shop-product');
            if (wrapper) wrapper.style.display = 'none';
          }
          return;
        }

        if (existingCardLink) {
          // Dynamic live update of existing DOM card
          const wrapper = existingCardLink.closest('.collection-item') || existingCardLink.closest('.w-dyn-item') || existingCardLink.closest('.shop-product');
          if (wrapper) wrapper.style.display = '';

          const productCard = existingCardLink.closest('.shop-product') || existingCardLink;
          if (productCard) productCard.style.opacity = '1';

          // Update Title
          const titleEl = productCard.querySelector('.sp-content .paragraph-14px');
          if (titleEl && p.name) titleEl.textContent = p.name;

          // Update Short Description / Tagline
          const shortDescEl = productCard.querySelector('.sp-content .paragraph-13px.grey, .sp-content .paragraph-13px');
          if (shortDescEl) shortDescEl.textContent = p.shortDescription || 'Multiple options available';

          // Update Price (Regular price by default, sale price + strikethrough if on sale)
          const priceEl = productCard.querySelector('.sp-content .paragraph-16px, [data-wf-sku-bindings*="f_price_"]');
          if (priceEl) priceEl.innerHTML = priceHtml;

          // Update Image
          const imgEl = productCard.querySelector('.sp-image-wrapper img');
          if (imgEl && imgUrl) {
            imgEl.src = imgUrl;
            imgEl.alt = p.name;
            if (imgEl.hasAttribute('srcset')) imgEl.removeAttribute('srcset');
          }
        } else {
          // Append newly added product from DB
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
                <p class="paragraph-16px">${priceHtml}</p>
              </div>
            </div>
          `;
          productGrid.appendChild(itemEl);
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
