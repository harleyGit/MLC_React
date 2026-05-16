const DEFAULT_STORAGE_VERSION = 1;
const memoryCache = new Map();

/**
 * 通用本地存储工具：封装 localStorage 的序列化、版本校验、过期控制和内存缓存。
 * 约束：只存可安全落到浏览器端的数据，token、密码等敏感信息不应通过该工具持久化。
 */
export default class HGStorage {
  /**
   * 保存任意可序列化数据。
   * @param {string} key 存储 key，必须稳定且唯一。
   * @param {*} value 需要保存的数据，需可被 JSON.stringify 序列化。
   * @param {Object} options 存储配置。
   * @param {number} [options.version=1] 数据结构版本。
   * @param {number} [options.maxAge] 最大有效期，单位毫秒；不传则不过期。
   * @returns {*|null} 保存成功返回原始数据，失败返回 null。
   */
  static setItem(key, value, options = {}) {
    if (!key) {
      return null;
    }

    const storageValue = this.buildStorageValue(value, options);
    memoryCache.set(key, storageValue);

    try {
      window.localStorage.setItem(key, JSON.stringify(storageValue));
      return value;
    } catch (error) {
      console.warn("保存本地数据失败:", key, error);
      memoryCache.delete(key);
      return null;
    }
  }

  /**
   * 读取本地缓存数据。
   * @param {string} key 存储 key。
   * @param {Object} options 读取配置。
   * @param {number} [options.version=1] 期望的数据结构版本。
   * @returns {*|null} 缓存不存在、过期、格式异常或读取失败时返回 null。
   */
  static getItem(key, options = {}) {
    if (!key) {
      return null;
    }

    const cachedValue = memoryCache.get(key);
    if (cachedValue) {
      if (this.isValidStorageValue(cachedValue, options)) {
        return cachedValue.value;
      }
      this.removeItem(key);
      return null;
    }

    try {
      const rawValue = window.localStorage.getItem(key);
      if (!rawValue) {
        return null;
      }

      const storageValue = JSON.parse(rawValue);
      if (!this.isValidStorageValue(storageValue, options)) {
        this.removeItem(key);
        return null;
      }

      memoryCache.set(key, storageValue);
      return storageValue.value;
    } catch (error) {
      console.warn("读取本地数据失败:", key, error);
      this.removeItem(key);
      return null;
    }
  }

  /**
   * 删除指定本地缓存。
   * @param {string} key 存储 key。
   */
  static removeItem(key) {
    if (!key) {
      return;
    }

    memoryCache.delete(key);
    try {
      window.localStorage.removeItem(key);
    } catch (error) {
      console.warn("删除本地数据失败:", key, error);
    }
  }

  /**
   * 构造统一存储结构。
   * @param {*} value 原始业务数据。
   * @param {Object} options 存储配置。
   * @returns {{version: number, savedAt: number, maxAge: number|null, value: *}} 标准存储对象。
   */
  static buildStorageValue(value, options = {}) {
    const { version = DEFAULT_STORAGE_VERSION, maxAge = null } = options;
    return {
      version,
      savedAt: Date.now(),
      maxAge: Number.isFinite(maxAge) ? maxAge : null,
      value,
    };
  }

  /**
   * 校验缓存结构、版本和有效期。
   * @param {Object} storageValue 解析后的标准存储对象。
   * @param {Object} options 读取配置。
   * @returns {boolean} 缓存是否可用。
   */
  static isValidStorageValue(storageValue, options = {}) {
    const { version = DEFAULT_STORAGE_VERSION } = options;
    if (!storageValue || typeof storageValue !== "object") {
      return false;
    }
    if (storageValue.version !== version) {
      return false;
    }
    if (!Number.isFinite(storageValue.savedAt)) {
      return false;
    }
    if (storageValue.maxAge !== null && !Number.isFinite(storageValue.maxAge)) {
      return false;
    }
    if (storageValue.maxAge === null) {
      return true;
    }
    return Date.now() - storageValue.savedAt <= storageValue.maxAge;
  }
}
