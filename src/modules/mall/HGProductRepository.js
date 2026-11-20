/**
 * 商城商品仓库
 * 职责：mall_products 表的商品列表与详情缓存。
 * 关键约束：
 * 1. 商品价格、库存、优惠随时可变，本地数据只用于列表快速展示；
 * 2. 下单必须重新请求 Go 后端计算价格与库存，禁止用本地缓存价格生成最终订单；
 * 3. 批量写入合并为单个事务，避免逐条 put 造成大量小事务。
 */

import { HGBaseRepository } from "../../infrastructure/database/HGBaseRepository";
import { HG_STORES } from "../../infrastructure/database/HGDatabaseSchema";
import { hgLocalDataService } from "../../infrastructure/storage/HGLocalDataService";
import { hgIsRecordFresh } from "../../infrastructure/storage/HGCachePolicy";

class HGProductRepository extends HGBaseRepository {
  constructor() {
    super(HG_STORES.PRODUCTS);
  }

  // 批量保存商品缓存（单事务写入），记录 cached_at 供 TTL 判断
  async saveProducts(products) {
    if (!Array.isArray(products) || products.length === 0) {
      return;
    }

    const cachedAt = Date.now();

    await this.execute("readwrite", (store) => {
      for (const product of products) {
        if (!product?.product_id) {
          continue;
        }
        store.put({ ...product, cached_at: cachedAt });
      }
      // 多条 put 共享同一事务，无需返回单个 request
      return null;
    });

    hgLocalDataService.notifyChange(HG_STORES.PRODUCTS);
  }

  // 读取单个商品缓存；新鲜度由调用方结合 hgIsRecordFresh 判断
  async getProduct(productId) {
    return this.get(productId);
  }

  // 判断商品缓存整体是否仍在 TTL 有效期内
  // 简化实现：以任意一条记录的 cached_at 近似整表新鲜度，精确校验由服务端版本号承担
  async isCacheFresh(sampleProductId) {
    const sample = sampleProductId
      ? await this.get(sampleProductId)
      : (await this.getAll())[0];

    return hgIsRecordFresh(sample, HG_STORES.PRODUCTS);
  }

  // 读取全部商品缓存（商品表规模可控，列表场景可接受）
  async getAllProducts() {
    return this.getAll();
  }

  // 清空商品缓存（配额不足时优先清理可重新下载的商品数据）
  async clearAll() {
    const result = await this.clear();
    hgLocalDataService.notifyChange(HG_STORES.PRODUCTS, { broadcast: false });
    return result;
  }
}

export const hgProductRepository = new HGProductRepository();
