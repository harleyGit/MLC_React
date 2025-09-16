/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2025-09-11 20:24:11
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2025-09-15 16:41:39
 * @FilePath: /MLC_React/src/pages/domain_detect/domain_detect_vm.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import { queryDNS } from "cf-doh";
import HttpIPManager from "../../api/HttpIPManager";
import NetManager from "../../api/HttpManagerV1";
import { getSystemInfo } from "../../utils/SystemInfoUtil";

export default class DomainDetectVM {
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
    } // 等待所有请求完成后返回最终结构
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
      const aRecords = await queryDNS(domain, "A"); //const aaaaRecords = await queryDNS(domain, "AAAA"); // console.info('🍎 域名iP：', aRecords)
      let output = "";
      if (isInput) {
        output = DomainDetectVM.handelInputLookupDomain01(aRecords, domain);
      } else {
        output = DomainDetectVM.handleLookupDomain01(aRecords, output);
      }
      return output;
    } catch (err) {
      return err;
    }
  };

  static handleLookupDomain01(datas, output) {
    if (datas) {
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
    if (datas) {
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

  /* 根据域名查询IP地址 */
  static requestNSLookupDomainInfo = ({} = {}) => {
    // 这里使用跨域解决问题
    const domainURL = `/dns.alidns/resolve?name=${domain}&type=A`;

    return NetManager.getWithURL(domainURL, {
      headers: { Accept: "application/dns-json" },
    }).then((data) => {
      console.log("AliDNS result:", data);
    });
  };

  static fetchDomainLatencyInfo = async ({ domain, callback }) => {
    // 模拟请求延迟信息
    const latency = Math.floor(Math.random() * 100) + "ms";

    // 构造 domainGroups
    const domainGroups = {
      [domain]: { latency },
    };

    // 调用外部传进来的 callback，把数据交给调用方处理
    if (callback) {
      callback(domainGroups);
    }
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

    return NetManager.getWithURL(domainURL, {
      headers: { Accept: "application/dns-json" },
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
    } catch (error) {}
  };

  static requestFetchIP = async ({ updateIPCallBack, errIPCallBack }) => {
    try {
      const data = await NetManager.get("/api");
      // 调用外部传进来的 callback，把数据交给调用方处理
      if (updateIPCallBack) {
        updateIPCallBack(data);
      }
    } catch (error) {
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

  /* 域名信息 */
  static getDomainInfoData = ({ taskId }) => {
    return new Promise((resolve, reject) => {
      const domainInfo = {
        "fusion-gateway-cn.imilab.com": "app",
        "iot-mqtt-cn.imilab.com": "device",
        "app-web-cn.imilab.com": "web",
        "app-web-sg.imilab.com": "SG-appWeb",
        "fusion-gateway-sg.imilab.com": "SG-Gateway",
        // "app-web-cn.imilab.com":"EU-appWeb",
        // "fusion-gateway-fk.imilab.com":"EU-Gateway",
        // "app-web-us.imilab.com":"US-appWeb",
        // "fusion-gateway-us.imilab.com":"US-Gateway",
        "": "",
        "": "",
        "": "",
        "": "",
        "": "",
        "": "",
      };

      resolve(domainInfo);
    });
  };

  static getDomainGroups = () => {
    return {
      txDomain: [
        [
          { "fusion-gateway-cn.imilab.com": "" },
          { "app-web-cn.imilab.com": "" },
        ],
        [{ "iot-mqtt-cn.imilab.com": "" }, { "": "" }],
        [
          { "fusion-gateway-sg.imilab.com": "" },
          { "app-web-sg.imilab.com": "" },
        ],
        [{ "iot-mqtt-sg.imilab.com": "" }, { "": "" }],
        // [{ "app-web-cn.imilab.com": "" }, { "fusion-gateway-fk.imilab.com": "" }],
        // [{ "app-web-us.imilab.com": "" }, { "fusion-gateway-us.imilab.com": "" }],
        // [{ "": "" }, { "": "" }],
      ],
      otherDomain: [
        [{ "www.baidu.com": "" }, { "www.youku.com": "" }],
        [{ "www.zhihu.com": "" }, { "www.iqiyi.com": "" }],
        [{ "www.kugou.com": "" }, { "www.amazon.com": "" }],
        [{ "www.google.com": "" }, { "": "" }],
      ],
    };
  };

  // 定义 domainInfo 常量
  static getDomainInfo = () => {
    return {
      "fusion-gateway-cn.imilab.com": "App",
      "app-web-cn.imilab.com": "Web",
      "iot-mqtt-cn.imilab.com": "Mqtt",
      "fusion-gateway-sg.imilab.com": "SG-App",
      "app-web-sg.imilab.com": "SG-Web",
      "iot-mqtt-sg.imilab.com": "SG-Mqtt",
      // "app-web-cn.imilab.com":"EU-appWeb",
      // "fusion-gateway-fk.imilab.com":"EU-Gateway",
      // "app-web-us.imilab.com":"US-appWeb",
      // "fusion-gateway-us.imilab.com":"US-Gateway",
    };
  };

  // 测试环境变量
  static testEnvironVariable = () => {
    const baseURL = import.meta.env.VITE_API_URL;
    const publicPath = import.meta.env.VITE_PUBLIC_PATH;

    // console.log("🍎 当前环境 API:", baseURL, "公共路径：", publicPath);
  };

  // 公共IP信息
  static fetchPublicNetIP = async ({} = {}) => {
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
}

/*Prod-网关：https://fusion-gateway-cn.imilab.com
      Prod-Mqtt：ssl://iot-mqtt-cn.imilab.com:1883
      Prod-Web：https://app-web-cn.imilab.com
    
      Pre-网关：https://fusion-gateway-cn.imilab.com
      Pre-Mqtt：ssl://iot-mqtt-pre-cn.imilab.com:1883
      Pre-Web：https://app-web-pre-cn.imilab.com
    
      Debug-网关：https://fusion-gateway-debug.imilab.com
      Debug-Mqtt：ssl://iot-mqtt-debug-cn.imilab.com:1883
      Debug-Web：https://app-web-debug-cn.imilab.com
    */
