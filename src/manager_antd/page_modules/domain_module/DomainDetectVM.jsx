/*
 * @Author: huanggang
 * @Date: 2025-09-10 10:37:45
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-09-22 18:41:03
 * @FilePath: /MLC_React/src/domain_module/DomainDetectVM.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */

import HttpIPManager from "../../../api/HttpIPManager";
import NetManager from "../../../api/HttpManagerV1";
import { getSystemInfo } from "../../../utils/SystemInfoUtil";

export class DomainDetectVM {
  constructor(name) {
    this.name = name;
  }

  static requestNSLookupCMDomainInfo = () => {
    const domainGroups = this.getDomainGroups();
    const promises = [];

    for (const groupKey in domainGroups) {
      if (groupKey === "otherDomain") {
        break;
      }

      const group = domainGroups[groupKey];
      for (let i = 0; i < group.length; i++) {
        for (let j = 0; j < group[i].length; j++) {
          const domainObj = group[i][j];
          const domain = Object.keys(domainObj)[0];

          if (domain) {
            const p = this.requestQueryDNSForDomainInfo({
              domain,
              isInput: false,
            })
              .then((info) => {
                domainObj[domain] = info;
              })
              .catch(() => {
                domainObj[domain] = null;
              });
            promises.push(p);
          }
        }
      }
    }

    // 等待所有请求完成后返回最终结构
    return Promise.all(promises).then(() => domainGroups);
  };

  static requestQueryDNSForDomainInfo = async ({
    domain,
    isInput = true,
  } = {}) => {
    if (!domain?.trim()) {
      return isInput
        ? Promise.reject("请输入正确域名，比如：google.com")
        : Promise.reject("-.-");
    }

    try {
      const aRecords = await DomainDetectVM.requestDNSARecords(domain);
      console.info("🍎 域名iP：", domain, "ip地址：", aRecords);
      let output = "";
      if (isInput) {
        output = DomainDetectVM.handelInputLookupDomain01(aRecords, domain);
      } else {
        output = DomainDetectVM.handleLookupDomain01(aRecords, output);
      }
      return output;
    } catch (err) {
      return Promise.reject(err?.message || err || "查询失败");
    }
  };

  // 同源 DoH 查询按阿里、Google 顺序回退；每个服务限时 10 秒，不走业务签名/响应包装。
  static requestDNSARecords = async (domain) => {
    const dnsProviders = [
      `/dns.alidns/resolve?name=${encodeURIComponent(
        domain
      )}&type=A`,
      `/dns.google/resolve?name=${encodeURIComponent(domain)}&type=A`,
    ];
    let lastError = null;

    for (const url of dnsProviders) {
      try {
        const response = await fetch(url, {
          headers: { Accept: "application/dns-json" },
          signal: AbortSignal.timeout(10000),
        });

        if (!response.ok) {
          throw new Error(`DNS HTTP ${response.status}`);
        }

        const data = await response.json();
        if (data.Status !== 0) {
          throw new Error(`DNS 查询失败，状态码 ${data.Status}`);
        }
        const answers = Array.isArray(data.Answer) ? data.Answer : [];
        return answers
          .filter((ans) => ans.type === 1 && ans.data)
          .map((ans) => ans.data);
      } catch (error) {
        lastError = error;
      }
    }

    throw lastError || new Error("DNS 查询失败");
  };

  static requestLookupCMDomainInfo = () => {
    const domainGroups = this.getDomainGroups();
    const promises = [];

    for (const groupKey in domainGroups) {
      if (groupKey === "otherDomain") {
        break;
      }

      const group = domainGroups[groupKey];
      for (let i = 0; i < group.length; i++) {
        for (let j = 0; j < group[i].length; j++) {
          const domainObj = group[i][j];
          const domain = Object.keys(domainObj)[0];

          if (domain) {
            const p = this.requestLookupDomain({ domain, isInput: false })
              .then((info) => {
                domainObj[domain] = info;
              })
              .catch(() => {
                domainObj[domain] = null;
              });
            promises.push(p);
          }
        }
      }
    }

    // 等待所有请求完成后返回最终结构
    return Promise.all(promises).then(() => domainGroups);
  };

  static requestLookupDomain = ({ domain, isInput = true } = {}) => {
    if (!domain?.trim()) {
      return isInput
        ? Promise.reject("请输入正确域名，比如：google.com")
        : Promise.reject("-.-");
    }

    const domainURL = `/dns.alidns/resolve?name=${domain}&type=A`;
    // `https://dns.alidns.com/resolve?name=${domain}&type=A`
    // const domainURL =  `https://cloudflare-dns.com/dns-query?name=${domain}&type=A`

    // DNS 返回原始 JSON，不适用业务接口的 code/result 协议或鉴权头。
    return fetch(domainURL, {
      headers: { Accept: "application/dns-json" },
      signal: AbortSignal.timeout(10000),
    })
      .then((response) => {
        if (!response.ok) throw new Error(`DNS HTTP ${response.status}`);
        return response.json();
      })
      .then((data) => {
        console.log("🍎 looup 结果da ta:", data);
        let output = "";
        if (isInput) {
          output = DomainDetectVM.handelInputLookupDomain(data, domain);
        } else {
          output = DomainDetectVM.handleLookupDomain(data, output);
        }
        return output;
      })
      .catch((err) => {
        const errDesc = "查询失败: " + err.message;
        return Promise.reject(errDesc);
      });
  };

  static fetchDeviceInfo = async ({ systemInfoCallBack }) => {
    try {
      const deviceInfo = await getSystemInfo();
      // console.log("🍎 设备信息: ", deviceInfo);
      if (systemInfoCallBack) {
        systemInfoCallBack(deviceInfo);
      }
    } catch {
      // 设备信息不可用时保留页面占位，不阻断其他诊断。
    }
  };

  static requestFetchIP = async ({ updateIPCallBack, errIPCallBack }) => {
    try {
      const data = await NetManager.get("/api");
      // 调用外部传进来的 callback，把数据交给调用方处理
      if (updateIPCallBack) {
        updateIPCallBack(data);
      }
    } catch {
      if (errIPCallBack) {
        errIPCallBack("获取 IP 失败");
      }
    }
  };

  // 遍历所有域名并获取延迟填充
  static requestFillLatencyData = async ({ delayCallback }) => {
    const domainGroups = this.getDomainGroups(); // 拿到初始结构

    for (const groupKey in domainGroups) {
      const group = domainGroups[groupKey];

      for (let i = 0; i < group.length; i++) {
        for (let j = 0; j < group[i].length; j++) {
          const domainObj = group[i][j];
          const domain = Object.keys(domainObj)[0];

          if (domain) {
            // const result = await HttpIPManager.latecyPingInfo(
            //   "https://" + domain
            // );
            // domainObj[domain] = result || "-.-";
            // // 强制触发组件刷新
            // this.setState({ domainGroups: { ...domainGroups } });
            await this.requestDomainLatencyInfo({
              domain,
              callback: (result) => {
                let delayValue = result || "-.-";
                if (delayValue != "-.-") {
                  delayValue = " 网络正常，延时" + delayValue + "毫秒";
                }
                domainObj[domain] = delayValue;
                // console.log("🍎 延迟信息: ", delayValue);
                // 调用外部传进来的 callback，把数据交给调用方处理
                if (delayCallback) {
                  delayCallback(domainGroups);
                }
              },
            });
          }
        }
      }
    }
    /*{ ...domainGroups }：是用展开运算符创建一个 domainGroups 的浅拷贝对象
     * const original = { a: 1, b: 2 };
     * 意思是将原始对象的所有 key 和 value 复制到一个新对象里。
     * const copy = { ...original }; // copy = { a: 1, b: 2 }
     */
  };

  //获取域名延迟
  static requestDomainLatencyInfo = async ({ domain, callback }) => {
    try {
      // const result = await HttpIPManager.latecyPingInfo("https://" + domain); // 这种获取域名的ping消息不太准确
      const result = await HttpIPManager.latecyPingInfoV1(domain);
      // console.log("🍎 =======域名延迟信息：", result);
      // console.log("🧪 fetchDomainLatencyInfo 被调用: ", domain);
      // 如果提供了回调函数，调用它
      if (typeof callback === "function") {
        callback(result.time);
      }
      return result.time; // 也可以直接 return 提供链式调用或 await
    } catch (e) {
      console.error("❌ 获取延迟失败：", e);
      if (typeof callback === "function") {
        callback(null, e); // 也可以回传错误
      }
    }
  };

  /* 国内企业官网域名信息，保持 Promise 返回方式，与页面名称映射共用同一份配置。 */
  static getDomainInfoData = () => {
    return new Promise((resolve) => {
      const domainInfo = DomainDetectVM.getDomainInfo();

      resolve(domainInfo);
    });
  };

  // txDomain 使用国内企业官网，每行两个域名；空字符串留给 DNS/延迟检测结果回填。
  static getDomainGroups = () => {
    return {
      txDomain: [
        [{ "www.baidu.com": "" }, { "www.tencent.com": "" }],
        [{ "www.alibaba.com": "" }, { "www.jd.com": "" }],
        [{ "www.163.com": "" }, { "www.huawei.com": "" }],
      ],
      otherDomain: [
        [{ "www.baidu.com": "" }, { "www.youku.com": "" }],
        [{ "www.zhihu.com": "" }, { "www.iqiyi.com": "" }],
        [{ "www.kugou.com": "" }, { "www.amazon.com": "" }],
        [{ "www.google.com": "" }, { "": "" }],
      ],
    };
  };

  // 国内企业官网域名与展示名称；键与 txDomain 保持一致。
  static getDomainInfo = () => {
    return {
      "www.baidu.com": "百度",
      "www.tencent.com": "腾讯",
      "www.alibaba.com": "阿里巴巴",
      "www.jd.com": "京东",
      "www.163.com": "网易",
      "www.huawei.com": "华为",
    };
  };

  // 公共IP信息
  static fetchPublicNetIP = async () => {
    try {
      const ip = await HttpIPManager.getPublicIP(); // 等待获取公网 IP
      // console.log("🍎 ip: ", ip);
      this.setState({ ip }); // 成功后更新 state
    } catch (error) {
      this.setState({ error }); // 失败时更新错误状态
    }

    // HttpIPManager.getPublicIP()
    //   .then((ip) => {
    //     // 成功获取 IP 后，更新组件状态
    //     this.setState({ ip });
    //   })
    //   .catch((error) => {
    //     // 获取失败，更新错误状态
    //     this.setState({ error });
    //   });
  };

  static handleLookupDomain(data, output) {
    if (data?.Answer) {
      data.Answer.forEach((ans) => {
        if (ans.type === 1) {
          // 1 = A记录
          output += `[${ans.data}]\n`;
        }
      });
    } else {
      output += "domain not found\n";
    }
    return output;
  }

  static handelInputLookupDomain(data, domain) {
    let output = `Server:\t -.- \nAddress: -.- #53\n\n\n`;
    if (data.Answer) {
      output += `Non-authoritative answer:\n`;
      output += `Name:\t${domain}\n`;
      data.Answer.forEach((ans) => {
        if (ans.type === 1) {
          // 1 = A记录
          output += `Address: ${ans.data}\n`;
        }
      });
    } else {
      output += `*** ${domain} not found\n`;
    }
    return output;
  }

  static handleLookupDomain01(datas, output) {
    if (datas?.length) {
      datas.forEach((ipStr) => {
        // 如果是以 .com 结尾的字符串，直接跳过
        if (typeof ipStr === "string" && ipStr.endsWith(".com.")) {
          return;
        }
        output += `[${ipStr}]\n`;
      });
    } else {
      output += "domain not found\n";
    }
    return output;
  }

  static handelInputLookupDomain01(datas, domain) {
    let output = `Server:\t -.- \nAddress: -.- #53\n\n\n`;
    if (datas?.length) {
      output += `Non-authoritative answer:\n`;
      output += `Name:\t${domain}\n`;
      datas.forEach((ipStr) => {
        if (typeof ipStr === "string" && ipStr.endsWith(".com.")) {
          return;
        }
        output += `Address: ${ipStr}\n`;
      });
    } else {
      output += `*** ${domain} not found\n`;
    }
    return output;
  }
}
