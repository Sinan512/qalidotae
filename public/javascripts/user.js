    /* =========================================================================
       GLOBAL STATE & STORE
       ========================================================================= */
    const state = {
      theme: localStorage.getItem('qalid_theme') || 'dark',
      currency: {
        code: 'AED',
        symbol: 'AED',
        name: 'UAE Dirham',
        flag: '🇦🇪',
        rateFromINR: 0.044
      },
      allRates: {},
      supportedCurrencies: [],
      products: [],
      filteredProducts: [],
      cart: JSON.parse(localStorage.getItem('qalid_cart') || '[]'),
      user: null, // Populated via /api/user/me
      activeGender: 'all',
      activeCategory: 'all',
      searchQuery: '',
      sortBy: 'newest',
      selectedProduct: null,
      selectedSize: 'M',
      selectedColor: '',
      selectedQuantity: 1,
      sizingUnit: 'cm',
      lastPlacedOrderNumber: ''
    };

    /* Sizing chart data */
    const sizingData = [
      { size: 'XS', chestCm: '96', shoulderCm: '42', lengthCm: '137', sleeveCm: '58', chestIn: '38', shoulderIn: '16.5', lengthIn: '54', sleeveIn: '23' },
      { size: 'S',  chestCm: '102', shoulderCm: '44', lengthCm: '142', sleeveCm: '60', chestIn: '40', shoulderIn: '17.5', lengthIn: '56', sleeveIn: '23.5' },
      { size: 'M',  chestCm: '108', shoulderCm: '46', lengthCm: '147', sleeveCm: '62', chestIn: '42.5', shoulderIn: '18', lengthIn: '58', sleeveIn: '24.5' },
      { size: 'L',  chestCm: '114', shoulderCm: '48', lengthCm: '152', sleeveCm: '64', chestIn: '45', shoulderIn: '19', lengthIn: '60', sleeveIn: '25' },
      { size: 'XL', chestCm: '120', shoulderCm: '50', lengthCm: '157', sleeveCm: '66', chestIn: '47', shoulderIn: '19.5', lengthIn: '62', sleeveIn: '26' },
      { size: 'XXL', chestCm: '128', shoulderCm: '52', lengthCm: '162', sleeveCm: '68', chestIn: '50.5', shoulderIn: '20.5', lengthIn: '64', sleeveIn: '27' }
    ];

    /* =========================================================================
       INITIALIZATION
       ========================================================================= */
    document.addEventListener('DOMContentLoaded', async () => {
      applyTheme(state.theme);
      lucide.createIcons();
      updateCartBadge();

      // Parallel init: Check user session, GeoIP & Currency, Fetch products
      await Promise.all([
        initGeoCurrency(),
        checkUserSession(),
        fetchProducts()
      ]);
    });

    /* =========================================================================
       THEME ENGINE & DYNAMIC LOGO SWITCHER
       ========================================================================= */
    function applyTheme(theme) {
      state.theme = theme;
      document.documentElement.setAttribute('data-theme', theme);
      localStorage.setItem('qalid_theme', theme);

      const headerLogo = document.getElementById('headerLogoImg');
      const mobileLogo = document.getElementById('mobileDrawerLogoImg');
      const footerLogo = document.getElementById('footerLogoImg');
      const themeLabel = document.getElementById('themeLabel');
      const sunIcon = document.getElementById('themeIconSun');
      const moonIcon = document.getElementById('themeIconMoon');

      const logoSrc = theme === 'dark' ? '/logo-white.png' : '/logo.png';

      if (headerLogo) headerLogo.src = logoSrc;
      if (mobileLogo) mobileLogo.src = logoSrc;
      if (footerLogo) footerLogo.src = '/logo-white.png'; // footer is always dark

      if (theme === 'dark') {
        if (themeLabel) themeLabel.innerText = 'Dark';
        if (sunIcon) sunIcon.style.display = 'none';
        if (moonIcon) moonIcon.style.display = 'inline-block';
      } else {
        if (themeLabel) themeLabel.innerText = 'Light';
        if (sunIcon) sunIcon.style.display = 'inline-block';
        if (moonIcon) moonIcon.style.display = 'none';
      }
      lucide.createIcons();
    }

    function toggleTheme() {
      const newTheme = state.theme === 'dark' ? 'light' : 'dark';
      applyTheme(newTheme);
      showToast(`Switched to ${newTheme.toUpperCase()} atelier theme`, 'success');
    }

    /* =========================================================================
       GEO-LOCATION & FRANKFURTER CURRENCY ENGINE
       ========================================================================= */
    async function initGeoCurrency() {
      try {
        const res = await fetch('/api/geo-currency');
        const data = await res.json();
        if (data.success && data.currency) {
          state.currency = data.currency;
          state.allRates = data.allRates || {};
          state.supportedCurrencies = data.supportedCurrencies || [];

          updateCurrencyUI();
        }
      } catch (err) {
        console.warn('Geo Currency Error:', err);
      }
    }

    function updateCurrencyUI() {
      const topFlag = document.getElementById('topCurrencyFlag');
      const topCode = document.getElementById('topCurrencyCode');
      const mobCode = document.getElementById('mobileCurrencyText');
      const footCurr = document.getElementById('footerCurrencyDisplay');

      if (topFlag) topFlag.innerText = state.currency.flag || '🇦🇪';
      if (topCode) topCode.innerText = state.currency.code;
      if (mobCode) mobCode.innerText = state.currency.code;
      if (footCurr) footCurr.innerText = `${state.currency.code} (${state.currency.flag || '🇦🇪'})`;

      renderProductsGrid();
      renderCart();
    }

    function convertInrToCurrent(priceInINR) {
      const rate = state.currency.rateFromINR || 0.044;
      const converted = priceInINR * rate;
      // If currency is JPY/KRW/INR round to whole number, otherwise 2 decimal places or clean integer
      if (['JPY', 'KRW', 'INR', 'AED', 'SAR', 'QAR'].includes(state.currency.code)) {
        return Math.round(converted);
      }
      return Number(converted.toFixed(2));
    }

    function formatPrice(priceInINR) {
      const converted = convertInrToCurrent(priceInINR);
      return `${state.currency.code} ${converted.toLocaleString()}`;
    }

    function openCurrencyModal() {
      const listContainer = document.getElementById('currencyListContainer');
      const currencies = state.supportedCurrencies.length > 0 ? state.supportedCurrencies : [
        { code: 'INR', symbol: '₹', name: 'Indian Rupee', flag: '🇮🇳', rateFromINR: 1.0 },
        { code: 'AED', symbol: 'AED', name: 'UAE Dirham', flag: '🇦🇪', rateFromINR: 0.044 },
        { code: 'SAR', symbol: 'SAR', name: 'Saudi Riyal', flag: '🇸🇦', rateFromINR: 0.045 },
        { code: 'QAR', symbol: 'QAR', name: 'Qatari Riyal', flag: '🇶🇦', rateFromINR: 0.044 },
        { code: 'KWD', symbol: 'KWD', name: 'Kuwaiti Dinar', flag: '🇰🇼', rateFromINR: 0.0037 },
        { code: 'OMR', symbol: 'OMR', name: 'Omani Rial', flag: '🇴🇲', rateFromINR: 0.0046 },
        { code: 'BHD', symbol: 'BHD', name: 'Bahraini Dinar', flag: '🇧🇭', rateFromINR: 0.0045 },
        { code: 'USD', symbol: '$', name: 'US Dollar', flag: '🇺🇸', rateFromINR: 0.012 },
        { code: 'EUR', symbol: '€', name: 'Euro', flag: '🇪🇺', rateFromINR: 0.011 },
        { code: 'GBP', symbol: '£', name: 'British Pound', flag: '🇬🇧', rateFromINR: 0.0095 }
      ];

      listContainer.innerHTML = currencies.map(c => `
        <div style="display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: var(--radius-sm); background: var(--bg-surface-elevated); border: 1px solid ${c.code === state.currency.code ? 'var(--gold-primary)' : 'var(--border-color)'}; cursor: pointer;" onclick="selectCurrency('${c.code}')">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 1.2rem;">${c.flag || '🌐'}</span>
            <div>
              <div style="font-weight: 600; font-size: 0.88rem;">${c.code} — ${c.name}</div>
            </div>
          </div>
          ${c.code === state.currency.code ? '<i data-lucide="check" style="color: var(--gold-primary); width: 16px; height: 16px;"></i>' : ''}
        </div>
      `).join('');

      openModal('currencyModalOverlay');
      lucide.createIcons();
    }

    function selectCurrency(code) {
      const match = state.supportedCurrencies.find(c => c.code === code);
      if (match) {
        state.currency = match;
      } else {
        state.currency = { code: code, symbol: code, name: code, rateFromINR: state.allRates[code] || 0.012 };
      }
      closeCurrencyModal();
      updateCurrencyUI();
      showToast(`Currency updated to ${state.currency.code}`, 'success');
    }

    function closeCurrencyModal() {
      closeModal('currencyModalOverlay');
    }

    /* =========================================================================
       PRODUCTS CATALOG FETCH & RENDER
       ========================================================================= */
    async function fetchProducts() {
      try {
        const res = await fetch('/api/products');
        const data = await res.json();
        if (data.success && Array.isArray(data.products)) {
          state.products = data.products;
          applyFilters();
        }
      } catch (err) {
        console.error('Fetch Products Error:', err);
      }
    }

    function applyFilters() {
      let list = [...state.products];

      // Gender filter
      if (state.activeGender !== 'all') {
        list = list.filter(p => p.gender === state.activeGender || p.gender === 'unisex');
      }

      // Category filter
      if (state.activeCategory !== 'all') {
        list = list.filter(p => (p.type || '').toLowerCase() === state.activeCategory.toLowerCase());
      }

      // Search filter
      if (state.searchQuery.trim()) {
        const q = state.searchQuery.toLowerCase();
        list = list.filter(p =>
          (p.name || '').toLowerCase().includes(q) ||
          (p.type || '').toLowerCase().includes(q) ||
          (p.description || '').toLowerCase().includes(q)
        );
      }

      // Sort
      if (state.sortBy === 'price_asc') {
        list.sort((a, b) => a.price - b.price);
      } else if (state.sortBy === 'price_desc') {
        list.sort((a, b) => b.price - a.price);
      } else {
        list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
      }

      state.filteredProducts = list;
      renderProductsGrid();
    }

    function renderProductsGrid() {
      const container = document.getElementById('productsGridContainer');
      const subtitle = document.getElementById('productCountSubtitle');
      if (!container) return;

      if (subtitle) {
        subtitle.innerText = `Displaying ${state.filteredProducts.length} master bespoke garment${state.filteredProducts.length === 1 ? '' : 's'}`;
      }

      if (state.filteredProducts.length === 0) {
        container.innerHTML = `
          <div style="grid-column: 1 / -1; text-align: center; padding: 60px 20px; color: var(--text-dim);">
            <i data-lucide="search-x" style="width: 44px; height: 44px; margin: 0 auto 12px;"></i>
            <h3 class="font-serif" style="font-size: 1.6rem; color: var(--text-main); margin-bottom: 6px;">No Garments Matched</h3>
            <p style="font-size: 0.85rem;">Try adjusting your filters, category, or search keywords.</p>
            <button class="btn-gold" style="margin-top: 16px;" onclick="resetFilters()">Reset All Filters</button>
          </div>
        `;
        lucide.createIcons();
        return;
      }

      container.innerHTML = state.filteredProducts.map(product => {
        const frontImg = product.frontImage || '/logo-white.png';
        const backImg = product.backImage || product.frontImage || '/logo-white.png';
        const formattedPrice = formatPrice(product.price);
        const isLowStock = product.totalStock > 0 && product.totalStock <= 5;
        const isOutOfStock = product.totalStock === 0;

        return `
          <article class="product-card" onclick="openProductModal('${product._id}')">
            
            <!-- Media with Auto-Sliding Front & Back on Hover -->
            <div class="product-media-wrap">
              <div class="product-images-slider">
                <img src="${frontImg}" alt="${product.name} Front View" class="product-slide-img" loading="lazy" />
                <img src="${backImg}" alt="${product.name} Back View" class="product-slide-img" loading="lazy" />
              </div>

              <!-- Badges -->
              <div class="card-badges">
                <span class="card-badge gold">${product.gender}</span>
                ${isLowStock ? '<span class="card-badge stock-low">Only ' + product.totalStock + ' Left</span>' : ''}
                ${isOutOfStock ? '<span class="card-badge">Bespoke Order</span>' : ''}
              </div>

              <!-- Slide Dots Indicator -->
              <div class="slide-dots">
                <span class="slide-dot active"></span>
                <span class="slide-dot"></span>
              </div>

              <!-- Quick Hover View Action -->
              <div class="card-quick-actions" onclick="event.stopPropagation()">
                <button class="btn-quick-view" onclick="openProductModal('${product._id}')">
                  <i data-lucide="eye" style="width: 14px; height: 14px;"></i> View Details & Sizes
                </button>
              </div>
            </div>

            <!-- Product Details Summary -->
            <div class="product-content">
              <div class="product-type-gender">${product.type}</div>
              <h3 class="product-title">${product.name}</h3>

              <!-- Available Sizes preview -->
              <div class="product-sizes-preview">
                ${(product.availableSizes || ['XS', 'S', 'M', 'L', 'XL', 'XXL']).map(s => `<span class="size-pill">${s}</span>`).join('')}
              </div>

              <div class="product-footer-row">
                <div class="product-price-box">
                  <span class="price-converted">${formattedPrice}</span>
                  <span class="price-original-sub">Base: ₹${product.price.toLocaleString()} INR</span>
                </div>
                <div style="font-size: 0.75rem; color: var(--gold-primary); display: flex; align-items: center; gap: 4px;">
                  <span>Explore</span>
                  <i data-lucide="arrow-up-right" style="width: 13px; height: 13px;"></i>
                </div>
              </div>
            </div>

          </article>
        `;
      }).join('');

      lucide.createIcons();
    }

    /* Filter Handlers */
    function filterByGender(gender, e) {
      if (e) e.preventDefault();
      state.activeGender = gender;
      document.querySelectorAll('.gender-tab').forEach(t => {
        t.classList.toggle('active', t.innerText.toLowerCase() === gender || (gender === 'all' && t.innerText === 'All'));
      });
      document.querySelectorAll('.nav-link').forEach(link => {
        if (link.innerText.toLowerCase().includes(gender)) link.classList.add('active');
        else link.classList.remove('active');
      });
      applyFilters();
      const catEl = document.getElementById('catalogSection');
      if (catEl) catEl.scrollIntoView({ behavior: 'smooth' });
    }

    function filterByType(type, e) {
      if (e) e.preventDefault();
      state.activeCategory = type;
      document.querySelectorAll('.filter-chip').forEach(c => {
        c.classList.toggle('active', c.innerText.toLowerCase().includes(type.toLowerCase()) || (type === 'all' && c.innerText === 'All Garments'));
      });
      applyFilters();
    }

    function handleSearchInput() {
      state.searchQuery = document.getElementById('catalogSearchInput').value;
      applyFilters();
    }

    function focusSearch() {
      const inp = document.getElementById('catalogSearchInput');
      if (inp) {
        inp.focus();
        inp.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }

    function handleSortChange() {
      state.sortBy = document.getElementById('sortSelect').value;
      applyFilters();
    }

    function resetFilters() {
      state.activeGender = 'all';
      state.activeCategory = 'all';
      state.searchQuery = '';
      const inp = document.getElementById('catalogSearchInput');
      if (inp) inp.value = '';
      document.querySelectorAll('.gender-tab').forEach((t, i) => t.classList.toggle('active', i === 0));
      document.querySelectorAll('.filter-chip').forEach((c, i) => c.classList.toggle('active', i === 0));
      applyFilters();
    }

    /* =========================================================================
       PRODUCT DETAILS MODAL & SIZE PICKER
       ========================================================================= */
    function openProductModal(productId) {
      const product = state.products.find(p => p._id === productId);
      if (!product) return;

      state.selectedProduct = product;
      state.selectedSize = (product.availableSizes && product.availableSizes[0]) || 'M';
      state.selectedColor = (product.availableColours && product.availableColours[0]) || '';
      state.selectedQuantity = 1;

      const frontImg = product.frontImage || '/logo-white.png';
      const backImg = product.backImage || product.frontImage || '/logo-white.png';

      const content = document.getElementById('productDetailContent');
      content.innerHTML = `
        <!-- Left: Gallery Switcher & Zoom View -->
        <div class="detail-gallery">
          <div class="detail-main-img-wrap" id="detailMainImgWrap" title="Hover to zoom in">
            <img src="${frontImg}" alt="${product.name}" class="detail-main-img" id="detailMainImg" />
          </div>
          <div class="detail-thumbnails">
            <div class="detail-thumb active" onclick="switchDetailImage('${frontImg}', this)">
              <img src="${frontImg}" alt="Front Thumbnail" />
            </div>
            <div class="detail-thumb" onclick="switchDetailImage('${backImg}', this)">
              <img src="${backImg}" alt="Back Thumbnail" />
            </div>
          </div>
        </div>

        <!-- Right: Info & Controls -->
        <div class="detail-info">
          <div class="detail-tag">${product.type} • ${product.gender.toUpperCase()}</div>
          <h2 class="detail-name">${product.name}</h2>

          <div class="detail-price-row">
            <span class="detail-price-main">${formatPrice(product.price)}</span>
            <span class="detail-price-inr">(Base: ₹${product.price.toLocaleString()} INR)</span>
          </div>

          <!-- Sizing Selection -->
          <div>
            <div class="detail-section-label">
              <span>Select Size: <strong style="color: var(--gold-primary);" id="selectedSizeLabel">${state.selectedSize}</strong></span>
              <span class="size-guide-trigger" onclick="openSizeGuideModal()"><i data-lucide="ruler" style="width: 12px; height: 12px;"></i> Size Guide & Info</span>
            </div>
            <div class="size-selector-grid">
              ${(product.availableSizes || ['XS', 'S', 'M', 'L', 'XL', 'XXL']).map(s => `
                <button class="size-btn ${s === state.selectedSize ? 'active' : ''}" onclick="selectDetailSize('${s}', this)">${s}</button>
              `).join('')}
            </div>
          </div>

          <!-- Color Selection if available -->
          ${(product.availableColours && product.availableColours.length > 0) ? `
            <div>
              <div class="detail-section-label">Available Colors</div>
              <div class="color-swatches">
                ${product.availableColours.map((col, idx) => `
                  <button class="color-chip ${idx === 0 ? 'active' : ''}" onclick="selectDetailColor('${col}', this)">${col}</button>
                `).join('')}
              </div>
            </div>
          ` : ''}

          <!-- Stock & Description -->
          <div class="detail-desc">
            ${product.description || 'Masterfully constructed with hand-knotted stitching, bespoke neck piping, and comfortable breathable drape tailored for royal occasions.'}
          </div>

          <!-- Quantity Stepper -->
          <div class="qty-row">
            <span style="font-size: 0.85rem; font-weight: 600; text-transform: uppercase; color: var(--text-secondary);">Quantity:</span>
            <div class="qty-stepper">
              <button class="qty-btn" onclick="changeDetailQty(-1)"><i data-lucide="minus"></i></button>
              <span class="qty-display" id="detailQtyDisplay">1</span>
              <button class="qty-btn" onclick="changeDetailQty(1)"><i data-lucide="plus"></i></button>
            </div>
            <span style="font-size: 0.78rem; color: var(--text-dim);">${product.totalStock} garments in stock</span>
          </div>

          <!-- Action Buttons -->
          <div class="detail-actions">
            <button class="btn-gold" style="justify-content: center; width: 100%; padding: 14px; font-size: 0.9rem;" onclick="addToCartFromModal()">
              <i data-lucide="shopping-bag"></i> Add to Shopping Bag
            </button>
            <button class="btn-buy-cod" onclick="instantBuyCodFromModal()">
              <i data-lucide="banknote"></i> Buy Now (Cash On Delivery)
            </button>
            <div class="cod-guarantee-note">
              <i data-lucide="shield-check" style="width: 14px; height: 14px; color: var(--gold-primary);"></i>
              <span>Cash On Delivery • Complimentary Worldwide Express • 7-Day Fit Guarantee</span>
            </div>
          </div>

        </div>
      `;

      openModal('productModalOverlay');
      lucide.createIcons();
    }

    function switchDetailImage(src, thumbEl) {
      const mainImg = document.getElementById('detailMainImg');
      if (mainImg) mainImg.src = src;
      document.querySelectorAll('.detail-thumb').forEach(t => t.classList.remove('active'));
      if (thumbEl) thumbEl.classList.add('active');
    }

    function selectDetailSize(size, btnEl) {
      state.selectedSize = size;
      const lbl = document.getElementById('selectedSizeLabel');
      if (lbl) lbl.innerText = size;
      document.querySelectorAll('.size-btn').forEach(b => b.classList.remove('active'));
      if (btnEl) btnEl.classList.add('active');
    }

    function selectDetailColor(color, btnEl) {
      state.selectedColor = color;
      document.querySelectorAll('.color-chip').forEach(b => b.classList.remove('active'));
      if (btnEl) btnEl.classList.add('active');
    }

    function changeDetailQty(delta) {
      const max = state.selectedProduct ? state.selectedProduct.totalStock : 10;
      state.selectedQuantity = Math.max(1, Math.min(max || 10, state.selectedQuantity + delta));
      const disp = document.getElementById('detailQtyDisplay');
      if (disp) disp.innerText = state.selectedQuantity;
    }

    function closeProductModal() {
      closeModal('productModalOverlay');
    }

    /* =========================================================================
       SIZE GUIDE & SIZING INFORMATION
       ========================================================================= */
    function openSizeGuideModal() {
      renderSizeGuide();
      openModal('sizeGuideModalOverlay');
    }

    function closeSizeGuideModal() {
      closeModal('sizeGuideModalOverlay');
    }

    function toggleSizingUnit(unit) {
      state.sizingUnit = unit;
      document.getElementById('unitBtnCm').classList.toggle('active', unit === 'cm');
      document.getElementById('unitBtnIn').classList.toggle('active', unit === 'in');
      renderSizeGuide();
    }

    function renderSizeGuide() {
      const table = document.getElementById('sizeGuideTable');
      if (!table) return;

      const isCm = state.sizingUnit === 'cm';
      const u = isCm ? 'cm' : 'in';

      table.innerHTML = `
        <thead>
          <tr>
            <th>Size</th>
            <th>Chest (${u})</th>
            <th>Shoulder (${u})</th>
            <th>Garment Length (${u})</th>
            <th>Sleeve (${u})</th>
          </tr>
        </thead>
        <tbody>
          ${sizingData.map(row => `
            <tr>
              <td><strong>${row.size}</strong></td>
              <td>${isCm ? row.chestCm : row.chestIn} ${u}</td>
              <td>${isCm ? row.shoulderCm : row.shoulderIn} ${u}</td>
              <td>${isCm ? row.lengthCm : row.lengthIn} ${u}</td>
              <td>${isCm ? row.sleeveCm : row.sleeveIn} ${u}</td>
            </tr>
          `).join('')}
        </tbody>
      `;
    }

    /* =========================================================================
       GUEST CART & LOCALSTORAGE PERSISTENCE
       ========================================================================= */
    function addToCart(product, size, color, quantity) {
      const existingIdx = state.cart.findIndex(item =>
        item.productId === product._id && item.selectedSize === size && item.color === color
      );

      if (existingIdx !== -1) {
        state.cart[existingIdx].quantity += quantity;
      } else {
        state.cart.push({
          productId: product._id,
          productName: product.name,
          productType: product.type,
          price: product.price, // INR base
          image: product.frontImage,
          selectedSize: size || 'M',
          color: color || '',
          quantity: quantity || 1
        });
      }

      saveCart();
      updateCartBadge();
      showToast(`Added "${product.name}" (${size}) to bag`, 'success');
    }

    function addToCartFromModal() {
      if (!state.selectedProduct) return;
      addToCart(state.selectedProduct, state.selectedSize, state.selectedColor, state.selectedQuantity);
      closeProductModal();
      openCartDrawer();
    }

    function instantBuyCodFromModal() {
      if (!state.selectedProduct) return;
      addToCart(state.selectedProduct, state.selectedSize, state.selectedColor, state.selectedQuantity);
      closeProductModal();
      startCheckoutFlow();
    }

    function saveCart() {
      localStorage.setItem('qalid_cart', JSON.stringify(state.cart));
    }

    function updateCartBadge() {
      const badge = document.getElementById('cartCountBadge');
      const totalCount = state.cart.reduce((acc, i) => acc + i.quantity, 0);
      if (badge) badge.innerText = totalCount;
    }

    function openCartDrawer() {
      renderCart();
      openModal('cartDrawerOverlay');
    }

    function closeCartDrawer() {
      closeModal('cartDrawerOverlay');
    }

    function renderCart() {
      const container = document.getElementById('cartItemsContainer');
      const subtotalText = document.getElementById('cartSubtotalText');
      const totalText = document.getElementById('cartTotalText');
      const summarySection = document.getElementById('cartSummarySection');

      if (!container) return;

      if (state.cart.length === 0) {
        container.innerHTML = `
          <div class="cart-empty-state">
            <i data-lucide="shopping-bag" style="width: 48px; height: 48px;"></i>
            <div style="font-weight: 600; color: var(--text-main); font-size: 1.1rem;">Your shopping bag is empty</div>
            <p style="font-size: 0.82rem;">Discover our handmade collection and add bespoke thobes or abayas.</p>
            <button class="btn-gold" style="margin-top: 12px;" onclick="closeCartDrawer()">Explore Atelier</button>
          </div>
        `;
        if (summarySection) summarySection.style.display = 'none';
        lucide.createIcons();
        return;
      }

      if (summarySection) summarySection.style.display = 'flex';

      let inrSubtotal = 0;

      container.innerHTML = state.cart.map((item, idx) => {
        const itemTotalInr = item.price * item.quantity;
        inrSubtotal += itemTotalInr;

        return `
          <div class="cart-item-card">
            <img src="${item.image || '/logo-white.png'}" alt="${item.productName}" class="cart-item-thumb" />
            <div class="cart-item-details">
              <div>
                <div class="cart-item-name">${item.productName}</div>
                <div class="cart-item-meta">${item.productType} • Size: <strong style="color: var(--gold-primary);">${item.selectedSize}</strong> ${item.color ? '• ' + item.color : ''}</div>
              </div>
              <div class="cart-item-footer">
                <div class="qty-stepper" style="transform: scale(0.85); transform-origin: left;">
                  <button class="qty-btn" onclick="updateCartItemQty(${idx}, -1)"><i data-lucide="minus"></i></button>
                  <span class="qty-display">${item.quantity}</span>
                  <button class="qty-btn" onclick="updateCartItemQty(${idx}, 1)"><i data-lucide="plus"></i></button>
                </div>
                <div style="text-align: right;">
                  <div class="cart-item-price">${formatPrice(itemTotalInr)}</div>
                </div>
                <button class="cart-remove-btn" onclick="removeCartItem(${idx})" title="Remove Garment">
                  <i data-lucide="trash-2" style="width: 16px; height: 16px;"></i>
                </button>
              </div>
            </div>
          </div>
        `;
      }).join('');

      if (subtotalText) subtotalText.innerText = formatPrice(inrSubtotal);
      if (totalText) totalText.innerText = formatPrice(inrSubtotal);

      lucide.createIcons();
    }

    function updateCartItemQty(idx, delta) {
      if (!state.cart[idx]) return;
      state.cart[idx].quantity += delta;
      if (state.cart[idx].quantity <= 0) {
        state.cart.splice(idx, 1);
      }
      saveCart();
      updateCartBadge();
      renderCart();
    }

    function removeCartItem(idx) {
      state.cart.splice(idx, 1);
      saveCart();
      updateCartBadge();
      renderCart();
      showToast('Item removed from bag', 'info');
    }

    /* =========================================================================
       CHECKOUT FLOW & GUEST-TO-CUSTOMER CONVERSION
       ========================================================================= */
    function startCheckoutFlow() {
      if (state.cart.length === 0) {
        showToast('Your bag is empty.', 'error');
        return;
      }
      closeCartDrawer();

      // If user is NOT logged in, open Auth Modal with direct signup/login prompt
      if (!state.user) {
        openAuthModal('register');
        showToast('Please sign in or register your delivery details to place your Cash On Delivery order.', 'info');
      } else {
        openCheckoutModal();
      }
    }

    function openCheckoutModal() {
      if (!state.user) return;

      document.getElementById('checkoutClientName').innerText = state.user.fullName || 'Client';
      
      const addr = [
        state.user.housename,
        state.user.place,
        state.user.landmark ? `Landmark: ${state.user.landmark}` : '',
        state.user.city,
        state.user.postalCode ? `Postal: ${state.user.postalCode}` : '',
        state.user.country || 'UAE',
        `Phone: ${state.user.phoneNumber || state.user.whatsappNumber || 'Not set'}`
      ].filter(Boolean).join(', ');

      document.getElementById('checkoutAddressText').innerText = addr || 'Address on file';

      // Items list in checkout
      let totalInr = 0;
      const itemsContainer = document.getElementById('checkoutOrderItemsList');
      itemsContainer.innerHTML = state.cart.map(i => {
        totalInr += i.price * i.quantity;
        return `
          <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-bottom: 1px solid var(--border-color); font-size: 0.85rem;">
            <div>
              <strong>${i.productName}</strong> <span style="color: var(--text-dim);">(${i.selectedSize}, x${i.quantity})</span>
            </div>
            <div style="font-weight: 600; color: var(--gold-primary);">${formatPrice(i.price * i.quantity)}</div>
          </div>
        `;
      }).join('');

      document.getElementById('checkoutTotalAmountText').innerText = formatPrice(totalInr);

      openModal('checkoutModalOverlay');
    }

    function closeCheckoutModal() {
      closeModal('checkoutModalOverlay');
    }

    async function placeCodOrder() {
      if (!state.user) {
        openAuthModal('signin');
        return;
      }

      if (state.cart.length === 0) {
        showToast('Your bag is empty.', 'error');
        return;
      }

      const btn = document.getElementById('placeOrderBtn');
      const shippingNotes = document.getElementById('checkoutShippingNotes').value.trim();

      try {
        btn.disabled = true;
        btn.innerHTML = '<i data-lucide="loader-2" class="spin"></i> Placing Cash On Delivery Order...';
        lucide.createIcons();

        const payload = {
          items: state.cart.map(item => ({
            productId: item.productId,
            selectedSize: item.selectedSize,
            quantity: item.quantity,
            color: item.color
          })),
          shippingNotes: shippingNotes
        };

        const res = await fetch('/api/orders', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        const data = await res.json();

        if (data.success && data.order) {
          state.lastPlacedOrderNumber = data.order.orderNumber;
          // Clear cart
          state.cart = [];
          saveCart();
          updateCartBadge();

          closeCheckoutModal();
          openOrderSuccessModal(data.order);
        } else {
          showToast(data.message || 'Failed to place order. Please try again.', 'error');
        }
      } catch (err) {
        showToast('Network error placing order: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.innerHTML = '<i data-lucide="check-circle-2"></i> Confirm Order with Cash On Delivery';
        lucide.createIcons();
      }
    }

    function openOrderSuccessModal(order) {
      document.getElementById('successOrderNumber').innerText = order.orderNumber || order._id;
      openModal('orderSuccessModalOverlay');
      lucide.createIcons();
    }

    function closeOrderSuccessModal() {
      closeModal('orderSuccessModalOverlay');
    }

    function trackPlacedOrder() {
      closeOrderSuccessModal();
      openTrackOrderModal(null, state.lastPlacedOrderNumber);
    }

    /* =========================================================================
       ORDER TRACKING (PUBLIC & USER PORTAL)
       ========================================================================= */
    function openTrackOrderModal(e, prefillOrderNum) {
      if (e) e.preventDefault();
      const inp = document.getElementById('trackOrderInput');
      if (inp) {
        inp.value = prefillOrderNum || '';
        if (prefillOrderNum) {
          executeOrderTracking();
        }
      }
      openModal('trackingModalOverlay');
    }

    function closeTrackOrderModal() {
      closeModal('trackingModalOverlay');
    }

    async function executeOrderTracking() {
      const inp = document.getElementById('trackOrderInput');
      const orderNum = inp ? inp.value.trim() : '';
      const resultContainer = document.getElementById('trackingResultContainer');

      if (!orderNum) {
        showToast('Please enter an Order Number.', 'error');
        return;
      }

      resultContainer.innerHTML = `
        <div style="text-align: center; padding: 30px; color: var(--text-dim);">
          <i data-lucide="loader-2" class="spin" style="width: 28px; height: 28px; margin: 0 auto 8px;"></i>
          <div>Locating order telemetry...</div>
        </div>
      `;
      lucide.createIcons();

      try {
        const res = await fetch(`/api/orders/track/${encodeURIComponent(orderNum)}`);
        const data = await res.json();

        if (data.success && data.order) {
          const o = data.order;
          const itemsHtml = (o.items || []).map(item => `
            <div style="display: flex; gap: 10px; align-items: center; padding: 6px 0;">
              ${item.productImage ? `<img src="${item.productImage}" style="width: 36px; height: 46px; object-fit: cover; border-radius: 3px;">` : ''}
              <div>
                <div style="font-weight: 600; font-size: 0.85rem;">${item.productName}</div>
                <div style="font-size: 0.75rem; color: var(--text-dim);">Size: ${item.selectedSize} • Qty: ${item.quantity}</div>
              </div>
            </div>
          `).join('');

          resultContainer.innerHTML = `
            <div style="background: var(--bg-surface-elevated); padding: 18px; border-radius: var(--radius-md); border: 1px solid var(--border-color); margin-bottom: 20px;">
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                <span style="color: var(--text-dim); font-size: 0.85rem;">Order Number:</span>
                <strong style="color: var(--gold-primary); font-family: monospace;">${o.orderNumber}</strong>
              </div>
              <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
                <span style="color: var(--text-dim); font-size: 0.85rem;">Current Status:</span>
                <span class="badge ${getStatusClass(o.status)}" style="text-transform: uppercase;">${o.status}</span>
              </div>
              <div style="display: flex; justify-content: space-between;">
                <span style="color: var(--text-dim); font-size: 0.85rem;">Payment Method:</span>
                <strong style="color: #10b981;">${o.paymentMode || 'Cash On Delivery'}</strong>
              </div>
            </div>

            <!-- Visual Progress Timeline -->
            <h4 style="font-size: 0.85rem; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 12px;">Delivery Progression</h4>
            <div class="timeline-wrap">
              ${(o.timeline || []).map((stage, idx) => `
                <div class="timeline-item ${stage.completed ? 'completed' : ''} ${stage.isError ? 'error' : ''}">
                  <div class="timeline-node">
                    ${stage.completed ? '<i data-lucide="check" style="width: 14px; height: 14px;"></i>' : (idx + 1)}
                  </div>
                  <div class="timeline-content">
                    <div class="timeline-title">${stage.label}</div>
                    <div class="timeline-desc">${stage.desc}</div>
                  </div>
                </div>
              `).join('')}
            </div>

            <!-- Ordered Items Breakdown -->
            <div style="margin-top: 20px; padding-top: 14px; border-top: 1px solid var(--border-color);">
              <h4 style="font-size: 0.82rem; text-transform: uppercase; color: var(--text-secondary); margin-bottom: 8px;">Garments in this Package</h4>
              ${itemsHtml}
            </div>
          `;
          lucide.createIcons();
        } else {
          resultContainer.innerHTML = `
            <div style="text-align: center; padding: 30px; color: var(--text-dim); background: var(--bg-surface-elevated); border-radius: var(--radius-sm);">
              <i data-lucide="alert-circle" style="width: 32px; height: 32px; color: #ef4444; margin: 0 auto 8px;"></i>
              <div style="font-weight: 600; color: var(--text-main);">${data.message || 'No order found with this Order Number.'}</div>
              <p style="font-size: 0.78rem; margin-top: 4px;">Please verify your order confirmation reference.</p>
            </div>
          `;
          lucide.createIcons();
        }
      } catch (err) {
        resultContainer.innerHTML = `<div style="color: #ef4444; text-align: center; padding: 20px;">Error tracking order: ${err.message}</div>`;
      }
    }

    function getStatusClass(status) {
      if (status === 'delivery success') return 'badge-success';
      if (status === 'order confirmed' || status === 'delivery ongoing') return 'badge-info';
      if (status === 'order rejected' || status === 'order cancelled') return 'badge-danger';
      return 'badge-gold';
    }

    /* =========================================================================
       USER AUTHENTICATION & SESSION MANAGEMENT
       ========================================================================= */
    async function checkUserSession() {
      try {
        const res = await fetch('/api/user/me');
        const data = await res.json();
        if (data.success && data.isAuthenticated && data.user) {
          state.user = data.user;
          updateUserUI();
        } else {
          state.user = null;
        }
      } catch (err) {
        console.warn('Session check error:', err);
      }
    }

    function updateUserUI() {
      const accBtn = document.getElementById('accountBtn');
      if (accBtn) {
        if (state.user) {
          accBtn.title = `Logged in as ${state.user.fullName}`;
          accBtn.style.color = 'var(--gold-primary)';
        } else {
          accBtn.title = 'Sign In / Register';
          accBtn.style.color = 'var(--text-main)';
        }
      }
    }

    function handleAccountClick() {
      if (!state.user) {
        openAuthModal('signin');
      } else {
        openProfileModal();
      }
    }

    function openAuthModal(tab) {
      switchAuthTab(tab || 'signin');
      openModal('authModalOverlay');
    }

    function closeAuthModal() {
      closeModal('authModalOverlay');
    }

    function switchAuthTab(tab) {
      const tabSign = document.getElementById('tabSignIn');
      const tabReg = document.getElementById('tabRegister');
      const signForm = document.getElementById('signInForm');
      const regForm = document.getElementById('registerForm');

      if (tab === 'register') {
        tabSign.classList.remove('active');
        tabReg.classList.add('active');
        signForm.style.display = 'none';
        regForm.style.display = 'block';
      } else {
        tabSign.classList.add('active');
        tabReg.classList.remove('active');
        signForm.style.display = 'block';
        regForm.style.display = 'none';
      }
    }

    async function handleSignInSubmit(e) {
      e.preventDefault();
      const email = document.getElementById('loginEmail').value.trim();
      const password = document.getElementById('loginPassword').value.trim();
      const btn = document.getElementById('loginSubmitBtn');

      try {
        btn.disabled = true;
        btn.innerText = 'Signing In...';
        const res = await fetch('/api/user/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        if (data.success && data.user) {
          state.user = data.user;
          updateUserUI();
          closeAuthModal();
          showToast(`Welcome back, ${data.user.fullName}!`, 'success');

          // If user had items in cart and wanted to checkout, open checkout modal
          if (state.cart.length > 0) {
            openCheckoutModal();
          }
        } else {
          showToast(data.message || 'Invalid email or password.', 'error');
        }
      } catch (err) {
        showToast('Login error: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.innerText = 'Sign In & Continue';
      }
    }

    async function handleRegisterSubmit(e) {
      e.preventDefault();
      const btn = document.getElementById('regSubmitBtn');

      const payload = {
        fullName: document.getElementById('regFullName').value.trim(),
        email: document.getElementById('regEmail').value.trim(),
        password: document.getElementById('regPassword').value.trim(),
        gender: document.getElementById('regGender').value,
        phoneNumber: document.getElementById('regPhone').value.trim(),
        whatsappNumber: document.getElementById('regWhatsapp').value.trim(),
        housename: document.getElementById('regHousename').value.trim(),
        place: document.getElementById('regPlace').value.trim(),
        landmark: document.getElementById('regLandmark').value.trim(),
        city: document.getElementById('regCity').value.trim(),
        country: document.getElementById('regCountry').value.trim(),
        postalCode: document.getElementById('regPostalCode').value.trim()
      };

      try {
        btn.disabled = true;
        btn.innerText = 'Creating Account...';
        const res = await fetch('/api/user/signup', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success && data.user) {
          state.user = data.user;
          updateUserUI();
          closeAuthModal();
          showToast(`Welcome to Qalidotae Atelier, ${data.user.fullName}!`, 'success');

          // Immediately advance to checkout
          if (state.cart.length > 0) {
            openCheckoutModal();
          }
        } else {
          showToast(data.message || 'Registration failed.', 'error');
        }
      } catch (err) {
        showToast('Registration error: ' + err.message, 'error');
      } finally {
        btn.disabled = false;
        btn.innerText = 'Create Account & Proceed';
      }
    }

    async function handleLogout() {
      try {
        await fetch('/api/user/logout', { method: 'POST' });
        state.user = null;
        updateUserUI();
        closeProfileModal();
        showToast('Signed out successfully.', 'info');
      } catch (err) {
        showToast('Error logging out.', 'error');
      }
    }

    /* =========================================================================
       USER PROFILE & MY ORDERS
       ========================================================================= */
    function openProfileModal() {
      if (!state.user) return;

      document.getElementById('profileHeaderName').innerText = state.user.fullName || 'Client';
      document.getElementById('profileHeaderEmail').innerText = state.user.email || '';

      // Prefill address form
      document.getElementById('profFullName').value = state.user.fullName || '';
      document.getElementById('profPhone').value = state.user.phoneNumber || '';
      document.getElementById('profWhatsapp').value = state.user.whatsappNumber || '';
      document.getElementById('profHousename').value = state.user.housename || '';
      document.getElementById('profPlace').value = state.user.place || '';
      document.getElementById('profCity').value = state.user.city || '';
      document.getElementById('profCountry').value = state.user.country || '';

      switchProfileTab('orders');
      fetchMyOrders();
      openModal('profileModalOverlay');
    }

    function closeProfileModal() {
      closeModal('profileModalOverlay');
    }

    function switchProfileTab(tab) {
      const tabOrd = document.getElementById('profileTabOrders');
      const tabAddr = document.getElementById('profileTabAddress');
      const ordContent = document.getElementById('myOrdersTabContent');
      const addrContent = document.getElementById('myAddressTabContent');

      if (tab === 'address') {
        tabOrd.classList.remove('active');
        tabAddr.classList.add('active');
        ordContent.style.display = 'none';
        addrContent.style.display = 'block';
      } else {
        tabOrd.classList.add('active');
        tabAddr.classList.remove('active');
        ordContent.style.display = 'block';
        addrContent.style.display = 'none';
      }
    }

    async function fetchMyOrders() {
      const container = document.getElementById('myOrdersListContainer');
      container.innerHTML = '<div style="text-align: center; padding: 20px;"><i data-lucide="loader-2" class="spin"></i> Loading orders...</div>';
      lucide.createIcons();

      try {
        const res = await fetch('/api/orders/my-orders');
        const data = await res.json();
        if (data.success && Array.isArray(data.orders)) {
          if (data.orders.length === 0) {
            container.innerHTML = '<div style="text-align: center; padding: 30px; color: var(--text-dim);">You have not placed any orders yet.</div>';
            return;
          }

          container.innerHTML = data.orders.map(o => {
            const itemsList = Array.isArray(o.items) ? o.items : [];
            const dateStr = new Date(o.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });

            return `
              <div style="background: var(--bg-surface-elevated); padding: 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-color); margin-bottom: 12px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                  <div>
                    <strong style="color: var(--gold-primary); font-family: monospace;">${o.orderNumber || o._id}</strong>
                    <div style="font-size: 0.75rem; color: var(--text-dim);">${dateStr}</div>
                  </div>
                  <div>
                    <span class="badge ${getStatusClass(o.status)}">${o.status}</span>
                  </div>
                </div>

                <div style="font-size: 0.85rem; color: var(--text-main); margin-bottom: 8px;">
                  ${itemsList.map(item => `
                    <div>• ${item.productId ? item.productId.name : 'Atelier Garment'} (${item.selectedSize}, x${item.quantity})</div>
                  `).join('')}
                </div>

                <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 8px; border-top: 1px solid var(--border-color); font-size: 0.85rem;">
                  <span>Total: <strong>${formatPrice(o.totalPrice)}</strong> (${o.paymentMode || 'Cash On Delivery'})</span>
                  <div style="display: flex; gap: 8px;">
                    <button class="btn-outline" style="padding: 4px 10px; font-size: 0.72rem;" onclick="closeProfileModal(); openTrackOrderModal(null, '${o.orderNumber}')">
                      Track
                    </button>
                    ${o.status === 'order pending' ? `
                      <button class="btn-outline" style="padding: 4px 10px; font-size: 0.72rem; color: #ef4444; border-color: rgba(239,68,68,0.3);" onclick="cancelUserOrder('${o._id}')">
                        Cancel
                      </button>
                    ` : ''}
                  </div>
                </div>
              </div>
            `;
          }).join('');
          lucide.createIcons();
        }
      } catch (err) {
        container.innerHTML = '<div style="color: #ef4444;">Error loading orders.</div>';
      }
    }

    async function cancelUserOrder(orderId) {
      if (!confirm('Are you sure you wish to cancel this pending order?')) return;
      try {
        const res = await fetch(`/api/orders/${orderId}/cancel`, { method: 'POST' });
        const data = await res.json();
        if (data.success) {
          showToast('Order cancelled successfully.', 'success');
          fetchMyOrders();
        } else {
          showToast(data.message || 'Could not cancel order.', 'error');
        }
      } catch (err) {
        showToast('Error cancelling order: ' + err.message, 'error');
      }
    }

    async function handleProfileUpdate(e) {
      e.preventDefault();
      const payload = {
        fullName: document.getElementById('profFullName').value.trim(),
        phoneNumber: document.getElementById('profPhone').value.trim(),
        whatsappNumber: document.getElementById('profWhatsapp').value.trim(),
        housename: document.getElementById('profHousename').value.trim(),
        place: document.getElementById('profPlace').value.trim(),
        city: document.getElementById('profCity').value.trim(),
        country: document.getElementById('profCountry').value.trim()
      };

      try {
        const res = await fetch('/api/user/profile', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });
        const data = await res.json();
        if (data.success && data.user) {
          state.user = data.user;
          showToast('Shipping address updated successfully.', 'success');
        }
      } catch (err) {
        showToast('Failed to update address: ' + err.message, 'error');
      }
    }

    /* =========================================================================
       MODAL UTILS & TOASTS
       ========================================================================= */
    function openModal(id) {
      const modal = document.getElementById(id);
      if (modal) {
        modal.classList.add('active');
        document.body.style.overflow = 'hidden';
      }
    }

    function closeModal(id) {
      const modal = document.getElementById(id);
      if (modal) {
        modal.classList.remove('active');
        document.body.style.overflow = '';
      }
    }

    function toggleMobileNav() {
      const overlay = document.getElementById('mobileNavOverlay');
      if (overlay) {
        overlay.classList.toggle('active');
      }
    }

    function showToast(msg, type = 'info') {
      const container = document.getElementById('toastContainer');
      if (!container) return;

      const toast = document.createElement('div');
      toast.className = 'toast-msg';

      let iconName = 'info';
      let borderCol = 'var(--gold-primary)';
      if (type === 'success') { iconName = 'check-circle'; borderCol = '#10b981'; }
      if (type === 'error') { iconName = 'alert-triangle'; borderCol = '#ef4444'; }

      toast.style.borderColor = borderCol;
      toast.innerHTML = `<i data-lucide="${iconName}" style="width: 18px; height: 18px;"></i> <span>${msg}</span>`;
      container.appendChild(toast);
      lucide.createIcons();

      setTimeout(() => {
        toast.style.opacity = '0';
        toast.style.transition = 'opacity 0.3s ease';
        setTimeout(() => toast.remove(), 300);
      }, 4000);
    }

    function handleNewsletterSubmit(e) {
      e.preventDefault();
      showToast('Thank you for subscribing to the Qalidotae Private Gazette.', 'success');
      e.target.reset();
    }