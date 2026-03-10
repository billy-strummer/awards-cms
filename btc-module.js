const btcModule = {
  _symbol: 'COINBASE:BTCUSD',
  _interval: 'D',
  _style: '1',
  _theme: 'dark',

  _watchlistSymbols: [
    { symbol: 'COINBASE:BTCUSD', name: 'Bitcoin', icon: 'bi-currency-bitcoin', color: 'text-warning' },
    { symbol: 'COINBASE:ETHUSD', name: 'Ethereum', icon: 'bi-diamond', color: 'text-primary' },
    { symbol: 'COINBASE:SOLUSD', name: 'Solana', icon: 'bi-circle', color: 'text-info' },
    { symbol: 'COINBASE:XRPUSD', name: 'XRP', icon: 'bi-circle', color: 'text-secondary' },
    { symbol: 'FX:GBPUSD', name: 'GBP/USD', icon: 'bi-currency-pound', color: 'text-success' },
    { symbol: 'FX:EURUSD', name: 'EUR/USD', icon: 'bi-currency-euro', color: 'text-info' },
    { symbol: 'TVC:GOLD', name: 'Gold', icon: 'bi-gem', color: 'text-warning' },
    { symbol: 'SP:SPX', name: 'S&P 500', icon: 'bi-graph-up', color: 'text-success' },
    { symbol: 'TVC:DXY', name: 'US Dollar Index', icon: 'bi-currency-dollar', color: 'text-primary' },
    { symbol: 'NASDAQ:AAPL', name: 'Apple', icon: 'bi-apple', color: 'text-secondary' },
  ],

  _marketData: [
    { label: 'Crypto Total Market', key: 'CRYPTOCAP:TOTAL', color: 'warning' },
    { label: 'BTC Dominance', key: 'CRYPTOCAP:BTC.D', color: 'primary' },
    { label: 'FTSE 100', key: 'TVC:UKX', color: 'info' },
    { label: 'Dow Jones', key: 'DJ:DJI', color: 'success' },
    { label: 'Nasdaq', key: 'NASDAQ:NDX', color: 'danger' },
    { label: 'Crude Oil', key: 'TVC:USOIL', color: 'dark' },
  ],

  init() {
    this.createChart();
    this.renderWatchlist();
    this.renderMarketOverview();
  },

  createChart() {
    const container = document.getElementById('tradingview_chart');
    if (!container) return;
    container.innerHTML = '';

    const self = this;
    const buildWidget = () => {
      new TradingView.widget({
        container_id: 'tradingview_chart',
        width: '100%',
        height: 700,
        symbol: self._symbol,
        interval: self._interval,
        timezone: 'Europe/London',
        theme: self._theme,
        style: self._style,
        locale: 'en',
        allow_symbol_change: true,
        studies: ['STD;SMA', 'STD;RSI', 'STD;MACD'],
        hide_side_toolbar: false,
        save_image: true,
        details: true,
        calendar: true,
      });
    };

    // Load tv.js once, then create widget
    if (window.TradingView && window.TradingView.widget) {
      buildWidget();
    } else {
      const script = document.createElement('script');
      script.src = 'https://s3.tradingview.com/tv.js';
      script.onload = buildWidget;
      document.head.appendChild(script);
    }
  },

  switchSymbol(symbol, btn) {
    this._symbol = symbol;
    document.querySelectorAll('.btc-symbol-btn').forEach((b) => {
      b.classList.remove('active');
      if (!btn && b.getAttribute('onclick') && b.getAttribute('onclick').includes("'" + symbol + "'")) {
        b.classList.add('active');
      }
    });
    if (btn) btn.classList.add('active');
    this.createChart();
  },

  switchInterval(interval, btn) {
    this._interval = interval;
    document.querySelectorAll('.btc-interval-btn').forEach((b) => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    this.createChart();
  },

  switchStyle(style, btn) {
    this._style = style;
    document.querySelectorAll('.btc-style-btn').forEach((b) => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    this.createChart();
  },

  switchTheme(theme, btn) {
    this._theme = theme;
    document.querySelectorAll('.btc-theme-btn').forEach((b) => b.classList.remove('active'));
    if (btn) btn.classList.add('active');
    this.createChart();
  },

  _sidebarOpen: true,

  toggleSidebar() {
    const chartCol = document.getElementById('btcChartCol');
    const sidebarCol = document.getElementById('btcSidebarCol');
    const toggleBtn = document.getElementById('btcToggleSidebar');
    if (!chartCol || !sidebarCol) return;

    this._sidebarOpen = !this._sidebarOpen;

    if (this._sidebarOpen) {
      chartCol.className = 'col-lg-9';
      sidebarCol.style.display = '';
      toggleBtn.classList.remove('active');
    } else {
      chartCol.className = 'col-lg-12';
      sidebarCol.style.display = 'none';
      toggleBtn.classList.add('active');
    }

    // Recreate chart to fit new width
    this.createChart();
  },

  switchAndRenderWatchlist(symbol) {
    this.switchSymbol(symbol);
    this.renderWatchlist();
    this.renderMarketOverview();
  },

  renderWatchlist() {
    const el = document.getElementById('btcWatchlist');
    if (!el) return;
    el.innerHTML = this._watchlistSymbols
      .map((s) => {
        const isActive = s.symbol === this._symbol;
        return `<div class="d-flex align-items-center px-3 py-2 border-bottom ${isActive ? 'bg-primary bg-opacity-10' : ''}"
                   style="cursor:pointer;" data-action="btcModule.switchAndRenderWatchlist" data-id="${s.symbol}"
                   onmouseenter="this.style.backgroundColor='var(--bs-light)'" onmouseleave="this.style.backgroundColor='${isActive ? 'var(--bs-primary-bg-subtle)' : ''}'">
        <i class="bi ${s.icon} ${s.color} me-2"></i>
        <div class="flex-grow-1">
          <div class="fw-semibold small">${s.name}</div>
          <div class="text-muted" style="font-size:0.7rem">${s.symbol}</div>
        </div>
        ${isActive ? '<i class="bi bi-caret-right-fill text-primary"></i>' : ''}
      </div>`;
      })
      .join('');
  },

  renderMarketOverview() {
    const el = document.getElementById('btcMarketOverview');
    if (!el) return;
    el.innerHTML = this._marketData
      .map(
        (m) => `
      <div class="d-flex justify-content-between align-items-center py-2 px-1 border-bottom small"
           class="u-pointer" data-action="btcModule.switchAndRenderWatchlist" data-id="${m.key}">
        <span class="fw-semibold">${m.label}</span>
        <span class="badge bg-${m.color} bg-opacity-25 text-${m.color}">${m.key.split(':')[1]}</span>
      </div>
    `
      )
      .join('');
  },
};
window.btcModule = btcModule;

const btcTab = document.getElementById('bitcoin-tab');
if (btcTab) {
  btcTab.addEventListener('shown.bs.tab', function () {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    btcModule.init();
  });
}
