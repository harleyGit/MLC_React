import assert from "node:assert/strict";
import { Buffer } from "node:buffer";
import { test } from "node:test";
import { build } from "esbuild";

// Vite 工程的源码使用省略扩展名的导入；测试在内存中打包后用 Node 执行，不写入构建产物。
const bundle = await build({
  stdin: {
    contents: [
      'export { HGBaseRepository } from "./HGBaseRepository.js";',
      'export { hgCloseDatabase } from "./HGDatabase.js";'
    ].join("\n"),
    resolveDir: new URL(".", import.meta.url).pathname,
    sourcefile: "HGDatabaseTestEntry.js"
  },
  bundle: true,
  platform: "node",
  format: "esm",
  write: false
});
const code = Buffer.from(bundle.outputFiles[0].text).toString("base64");
let moduleId = 0;

// 每个用例重新实例化模块，隔离模块级数据库连接单例。
async function loadDatabaseModule() {
  moduleId += 1;
  return import(`data:text/javascript;base64,${code}#${moduleId}`);
}

// 只模拟本组用例需要的 IndexedDB 升级、提交及请求顺序；不替代真实浏览器兼容性测试。
function createDatabaseMock(initialVersion = 0) {
  let version = initialVersion;
  const stores = new Map();
  const connections = [];
  const pendingOpens = [];
  let blockNextOpen = false;
  let delayNextOpen = false;

  const database = {
    objectStoreNames: { contains: (name) => stores.has(name) },
    createObjectStore(name, { keyPath }) {
      const records = new Map();
      const indexes = new Set();
      const store = {
        keyPath,
        indexNames: { contains: (indexName) => indexes.has(indexName) },
        createIndex: (indexName) => indexes.add(indexName),
        put(value) {
          const key = Array.isArray(keyPath) ? keyPath.map((field) => value[field]) : value[keyPath];
          const request = {};
          queueMicrotask(() => {
            records.set(JSON.stringify(key), value);
            request.result = key;
            request.onsuccess?.();
          });
          return request;
        },
        get(key) {
          const request = {};
          queueMicrotask(() => {
            request.result = records.get(JSON.stringify(key));
            request.onsuccess?.();
          });
          return request;
        },
        records
      };
      stores.set(name, store);
      return store;
    },
    transaction(storeName) {
      if (database.closed) throw new Error("数据库已关闭");
      const tx = {
        objectStore: (name) => stores.get(name),
        abort() {
          queueMicrotask(() => tx.onabort?.());
        }
      };
      if (!stores.has(storeName)) throw new Error("不存在的表");
      // 在所有已入队请求回调后提交，验证 Repository 不在单个请求成功时提前返回。
      queueMicrotask(() => queueMicrotask(() => tx.oncomplete?.()));
      return tx;
    },
    close() {
      database.closed = true;
    },
    closed: false
  };

  const indexedDB = {
    open(_name, requestedVersion) {
      const request = { result: database };
      const complete = () => {
        if (version < requestedVersion) {
          let aborted = false;
          const tx = {
            objectStore: (name) => stores.get(name),
            abort() {
              aborted = true;
              request.onerror?.();
            }
          };
          request.transaction = tx;
          request.onupgradeneeded?.({ oldVersion: version });
          if (aborted || database.closed) return;
          version = requestedVersion;
        }
        connections.push(database);
        request.onsuccess?.();
      };
      if (blockNextOpen) {
        blockNextOpen = false;
        queueMicrotask(() => request.onblocked?.());
        pendingOpens.push(complete);
      } else if (delayNextOpen) {
        delayNextOpen = false;
        pendingOpens.push(complete);
      } else {
        queueMicrotask(complete);
      }
      return request;
    }
  };
  return {
    indexedDB,
    database,
    stores,
    connections,
    pendingOpens,
    blockOnce: () => { blockNextOpen = true; },
    delayOnce: () => { delayNextOpen = true; },
    getVersion: () => version
  };
}

test("新库升级至 v2 后具备文档中的全部表和索引，写入后可读取", async () => {
  const mock = createDatabaseMock();
  globalThis.indexedDB = mock.indexedDB;
  try {
    const { HGBaseRepository } = await loadDatabaseModule();
    const repository = new HGBaseRepository("user_preferences");
    assert.deepEqual(await repository.put({ user_id: "a", key: "theme", value: "dark" }), ["a", "theme"]);
    assert.equal((await repository.get(["a", "theme"])).value, "dark");
    assert.equal(mock.getVersion(), 2);
    assert.equal(mock.stores.size, 13);
    assert.equal(mock.stores.get("im_messages").indexNames.contains("conversation_time"), true);
    assert.equal(mock.stores.get("verification_messages").indexNames.contains("expires_at"), true);
  } finally {
    delete globalThis.indexedDB;
  }
});

test("升级旧版空库时补齐全部表，保留旧库已有记录", async () => {
  const mock = createDatabaseMock(1);
  const users = mock.database.createObjectStore("user_profiles", { keyPath: "user_id" });
  users.records.set(JSON.stringify("a"), { user_id: "a", nickname: "已有数据" });
  globalThis.indexedDB = mock.indexedDB;
  try {
    const { HGBaseRepository } = await loadDatabaseModule();
    const repository = new HGBaseRepository("user_profiles");
    assert.equal((await repository.get("a")).nickname, "已有数据");
    assert.equal(mock.stores.size, 13);
    assert.equal(mock.getVersion(), 2);
  } finally {
    delete globalThis.indexedDB;
  }
});

test("升级被阻塞时返回可识别错误，迟到的升级不会提交", async () => {
  const mock = createDatabaseMock();
  mock.blockOnce();
  globalThis.indexedDB = mock.indexedDB;
  try {
    const { HGBaseRepository } = await loadDatabaseModule();
    const repository = new HGBaseRepository("user_profiles");
    await assert.rejects(repository.get("a"), { code: "OPEN_BLOCKED" });
    mock.pendingOpens.shift()();
    assert.equal(mock.getVersion(), 0);
    assert.equal(mock.connections.length, 0);
  } finally {
    delete globalThis.indexedDB;
  }
});

test("打开期间主动关闭时不会向调用方返回过期连接", async () => {
  const mock = createDatabaseMock();
  mock.delayOnce();
  globalThis.indexedDB = mock.indexedDB;
  try {
    const { HGBaseRepository, hgCloseDatabase } = await loadDatabaseModule();
    const repository = new HGBaseRepository("user_profiles");
    const pending = repository.get("a");
    // 等待 async execute 调用 hgOpenDatabase，避免在测试中人为改变调用顺序。
    await Promise.resolve();
    await hgCloseDatabase();
    mock.pendingOpens.shift()();
    await assert.rejects(pending, { code: "OPEN_FAILED" });
    assert.equal(mock.getVersion(), 0);
  } finally {
    delete globalThis.indexedDB;
  }
});

test("分页参数无效时拒绝查询，避免零限制游标全表扫描", async () => {
  const { HGBaseRepository } = await loadDatabaseModule();
  const repository = new HGBaseRepository("im_messages");
  await assert.rejects(repository.getPageByIndex("conversation_time", null, { limit: 0 }), {
    code: "INVALID_ARGUMENT"
  });
  await assert.rejects(repository.getPageByIndex("conversation_time", null, { limit: 501 }), {
    code: "INVALID_ARGUMENT"
  });
});

test("数据库不可用时明确返回打开失败", async () => {
  delete globalThis.indexedDB;
  const { HGBaseRepository } = await loadDatabaseModule();
  await assert.rejects(new HGBaseRepository("user_profiles").get("a"), {
    code: "OPEN_FAILED"
  });
});

test("事务创建阶段的配额异常也统一包装，不能留下悬挂的 Promise", async () => {
  const mock = createDatabaseMock();
  globalThis.indexedDB = mock.indexedDB;
  try {
    const { HGBaseRepository } = await loadDatabaseModule();
    const repository = new HGBaseRepository("user_profiles");
    await repository.put({ user_id: "a" });
    mock.database.transaction = () => {
      throw new DOMException("磁盘已满", "QuotaExceededError");
    };
    await assert.rejects(repository.get("a"), { code: "QUOTA_EXCEEDED" });
  } finally {
    delete globalThis.indexedDB;
  }
});
