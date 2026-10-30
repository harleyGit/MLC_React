import HGNet from "../../../net_handle/hg_net_manager_vm";
import { hgBuildRegionLabel, hgFindCity, hgFindProvince } from "./hg_region_data";

/** 单用户地址上限，与后端 ErrHGAddressLimit 保持一致。 */
export const ADDRESS_MAX_COUNT = 20;

/** 字段长度上限，与后端 hgValidAddress 的字符数校验保持一致。 */
export const ADDRESS_FIELD_LIMIT = Object.freeze({
  receiverName: 64,
  detailAddress: 512,
});

/** 中国大陆手机号，与后端 hgPhonePattern 保持一致。 */
const HG_PHONE_PATTERN = /^1[3-9]\d{9}$/;

/**
 * 收货地址页 VM：负责地址接口调用、表单校验和页面初始状态。
 * 约束：地址归属由服务端按登录身份隔离，前端不缓存地址数据，也不把展示文案当作归属依据。
 */
export default class HGAddressBookVM {
  /**
   * 读取本人收货地址列表。
   * @returns {Promise<Array<Object>>} 地址数组，服务端最多返回 20 条。
   * @throws {Error} 请求失败或响应结构异常时抛出。
   */
  static listAddresses() {
    return HGNet.getAddressList()
      .then((response) => {
        if (!Array.isArray(response)) {
          throw new Error("收货地址列表响应异常");
        }
        return HGAddressBookVM.sortAddresses(response);
      })
  }

  /**
   * 新增本人收货地址。
   * @param {Object} addressInput 后端 HGAddressInput 字段。
   * @returns {Promise<Object>} 新建后的地址对象。
   */
  static createAddress(addressInput) {
    return HGNet.createAddress(addressInput);
  }

  /**
   * 全量修改本人收货地址，默认状态由独立的设置默认接口维护。
   * @param {number|string} addressId 地址主键。
   * @param {Object} addressInput 后端 HGAddressInput 字段。
   * @returns {Promise<boolean>} 服务端确认结果。
   */
  static updateAddress(addressId, addressInput) {
    return HGNet.updateAddress(addressId, addressInput);
  }

  /**
   * 删除本人收货地址。
   * @param {number|string} addressId 地址主键。
   * @returns {Promise<boolean>} 服务端确认结果。
   */
  static deleteAddress(addressId) {
    return HGNet.deleteAddress(addressId);
  }

  /**
   * 设置本人默认收货地址，默认地址每人最多一条，由服务端保证。
   * @param {number|string} addressId 地址主键。
   * @returns {Promise<boolean>} 服务端确认结果。
   */
  static setDefaultAddress(addressId) {
    return HGNet.setDefaultAddress(addressId);
  }

  /**
   * 默认地址置顶，其余按主键倒序，与后端列表顺序保持一致。
   * @param {Array<Object>} addressList 服务端返回的地址数组。
   * @returns {Array<Object>} 排序后的新数组，不修改入参。
   */
  static sortAddresses(addressList) {
    return [...addressList].sort((left, right) => {
      if (Boolean(left.isDefault) !== Boolean(right.isDefault)) {
        return left.isDefault ? -1 : 1;
      }
      return Number(right.id) - Number(left.id);
    });
  }

  /**
   * 构造空白表单。
   * @returns {Object} 新建地址弹窗的初始表单值。
   */
  static createEmptyForm() {
    return {
      receiverName: "",
      receiverPhone: "",
      provinceCode: "",
      cityCode: "",
      detailAddress: "",
      setDefault: false,
    };
  }

  /**
   * 把地址对象映射为弹窗表单值。
   * @param {Object|null} address 地址对象；null 表示新建。
   * @returns {Object} 表单值。
   */
  static addressToForm(address) {
    if (!address) {
      return HGAddressBookVM.createEmptyForm();
    }
    return {
      receiverName: address.receiverName ?? "",
      receiverPhone: address.receiverPhone ?? "",
      provinceCode: address.provinceCode ?? "",
      cityCode: address.cityCode ?? "",
      detailAddress: address.detailAddress ?? "",
      // 已有默认地址不重复提交设置默认，避免多一次无意义写请求。
      setDefault: false,
    };
  }

  /**
   * 校验表单并生成后端请求体。
   * 约束：校验口径与后端一致，后端仍会再次校验，前端错误只用于提前提示。
   * @param {Object} form 弹窗表单值。
   * @returns {{errors: Object, addressInput: Object|null}} 字段错误与请求体；有错误时请求体为 null。
   */
  static validateForm(form) {
    const errors = {};
    const receiverName = String(form?.receiverName ?? "").trim();
    const receiverPhone = String(form?.receiverPhone ?? "").trim();
    const detailAddress = String(form?.detailAddress ?? "").trim();
    const province = hgFindProvince(form?.provinceCode);
    const city = hgFindCity(form?.provinceCode, form?.cityCode);

    if (!receiverName) {
      errors.receiverName = "请填写收件人姓名";
    } else if (receiverName.length > ADDRESS_FIELD_LIMIT.receiverName) {
      errors.receiverName = `收件人姓名最多 ${ADDRESS_FIELD_LIMIT.receiverName} 个字符`;
    }

    if (!receiverPhone) {
      errors.receiverPhone = "请填写手机号";
    } else if (!HG_PHONE_PATTERN.test(receiverPhone)) {
      errors.receiverPhone = "请输入 11 位中国大陆手机号";
    }

    if (!province) {
      errors.region = "请选择所在省份";
    } else if (!city) {
      errors.region = "请选择所在城市";
    }

    if (!detailAddress) {
      errors.detailAddress = "请填写详细地址";
    } else if (detailAddress.length > ADDRESS_FIELD_LIMIT.detailAddress) {
      errors.detailAddress = `详细地址最多 ${ADDRESS_FIELD_LIMIT.detailAddress} 个字符`;
    }

    if (Object.keys(errors).length > 0) {
      return { errors, addressInput: null };
    }

    return {
      errors,
      addressInput: {
        receiverName,
        receiverPhone,
        region: hgBuildRegionLabel(province, city),
        provinceCode: province.code,
        cityCode: city.code,
        detailAddress,
      },
    };
  }

  /**
   * 手机号中间四位脱敏，列表展示不直接暴露完整号码。
   * @param {string} phone 手机号。
   * @returns {string} 脱敏后的手机号；非 11 位号码原样返回。
   */
  static maskPhone(phone) {
    const phoneText = String(phone ?? "");
    if (!HG_PHONE_PATTERN.test(phoneText)) {
      return phoneText;
    }
    return `${phoneText.slice(0, 3)}****${phoneText.slice(7)}`;
  }

  /**
   * 把接口错误转换为页面提示文案。
   * @param {Object} error 请求层抛出的错误对象。
   * @returns {string} 面向用户的提示。
   */
  static errorMessage(error) {
    if (error?.message && error.type === "BIZ_ERROR") {
      return error.message;
    }
    if (error?.status === 404) {
      return "收货地址不存在，可能已被其他设备删除";
    }
    return error?.message || "收货地址请求失败，请稍后重试";
  }

  /**
   * 创建页面初始状态。
   * @returns {Object} 页面 class state 初始对象。
   */
  static createInitialState() {
    return {
      addresses: [], // 本人地址列表；默认地址置顶。
      loading: false, // 列表请求中。
      error: "", // 列表或写操作错误文案。
      resetKey: 0, // 列表重置版本，变化时清除 HGCollectionView 的高度测量缓存。
      formVisible: false, // 新建/编辑弹窗是否可见。
      editingAddress: null, // 正在编辑的地址；null 表示新建。
      formSubmitting: false, // 弹窗提交中，阻止重复提交。
      deletingAddress: null, // 待确认删除的地址；null 表示没有删除确认框。
      deleting: false, // 删除请求中。
      defaultingId: null, // 正在设置默认的地址主键，用于按钮禁用。
    };
  }
}
