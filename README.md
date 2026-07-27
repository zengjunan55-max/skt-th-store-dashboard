# SKT-TH-店铺看板

这是一个可直接部署到 GitHub Pages / Cloudflare Pages 的静态看板目录。

## 根目录文件

- `index.html`
- `store-trend-data-stores.js`
- `store-trend-data-main.js`
- `store-trend-data-inner.js`
- `store-trend-data-outer.js`
- `store-trend-data-brand.js`
- `product-trend-data-main.js`
- `product-trend-data-inner.js`
- `product-trend-data-outer.js`
- `product-trend-data-brand.js`
- `.nojekyll`

这些文件需要保持在同一层级，部署时不要拆开。

## tools 目录

`tools/` 中保留了本地数据生成脚本，便于后续刷新数据后重新替换根目录中的数据文件：

- `tools/build_dashboard_data.py`
- `tools/build_product_trend_data.py`
- `tools/refresh_server.py`

## 部署建议

推荐使用 Cloudflare Pages 连接 GitHub 仓库进行部署。

构建配置：

- Framework preset: `None`
- Build command: 留空
- Build output directory: `/`
