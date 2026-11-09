/* ============================================================
 * service-worker.js —— 离线缓存
 * 只缓存静态资源，不做任何网络请求转发业务数据
 * 所有路径使用相对路径（./ 开头），适配 GitHub Pages 子目录部署
 * ============================================================ */

// 缓存名称：版本号变化后会触发旧缓存清理
var CACHE_NAME = 'cashflow-pwa-v1';

// 需要预缓存的静态资源列表（全部为相对路径）
var PRECACHE_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './css/style.css',
  './js/engine.js',
  './js/storage.js',
  './js/ui.js',
  './js/app.js',
  './icons/icon-192.png',
  './icons/icon-512.png'
];

// 安装阶段：预缓存所有静态资源
self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(function () {
      // 安装完成后立即激活，不必等待旧 SW 控制的页面关闭
      return self.skipWaiting();
    })
  );
});

// 激活阶段：清理旧版本缓存
self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys.map(function (key) {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
          return null;
        })
      );
    }).then(function () {
      // 让新 SW 立即接管页面
      return self.clients.claim();
    })
  );
});

// 请求拦截：缓存优先（Cache First），缓存未命中才请求网络
// 本应用完全离线可用，网络请求仅作为静态资源更新的兜底
self.addEventListener('fetch', function (event) {
  // 只处理同源 GET 请求
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;
      return fetch(event.request).then(function (response) {
        // 只缓存成功的同源响应
        if (response && response.ok && response.url.indexOf(self.location.origin) === 0) {
          var clone = response.clone();
          caches.open(CACHE_NAME).then(function (cache) {
            cache.put(event.request, clone);
          });
        }
        return response;
      }).catch(function () {
        // 页面导航请求离线失败时，回退到缓存的首页
        if (event.request.mode === 'navigate') {
          return caches.match('./index.html');
        }
        return undefined;
      });
    })
  );
});
