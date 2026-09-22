import React, { Component } from "react";
import { isMobile } from "../../../utils/SystemInfoUtil";
import TimeUtils from "../../../utils/TimeUtils";
import "./DomainDetectPage.css";
import { DomainDetectVM } from "./DomainDetectVM";
import { MTRTool } from "./mtr_tool/MTRTool";
import { TracerouteTool } from "./traceroute_tool/TracerouteTool";

class DomainDetectPage extends Component {
  // 默认字符串
  defaultTxt = "-.-";

  constructor(props) {
    super(props);
    // 初始化状态
    this.state = {
      domain: "", //输入域名
      ipData: null, //ip信息
      deviceInfo: null, //设备信息
      delayResult: "--", //ping延迟结果
      domainIPs: "未检测", // 当前输入域名的 A 记录，与延迟分别展示。
      domainGroups: DomainDetectVM.getDomainGroups(), //测试的domains
      lookupDomain: "",
      result: "",
      lookupDomainIPs: {},
      mtrDomain: "",
      mtrResult: "",
      isMtrLoading: false,
      tracerouteDomain: "",
      tracerouteResult: "",
      isTracerouteLoading: false,
    };
  }

  componentDidMount() {
    // 获取域名延迟
    this.fillLatencyData();
    // 获取iP信息
    this.fetchIP();
    //获取设备信息
    this.fetchDeviceInfo();
    // DNS 通过同源代理查询，不向浏览器暴露跨域依赖。
    this.getCMDomainLookupInfo();
  }

  getCMDomainLookupInfo = () => {
    DomainDetectVM.requestNSLookupCMDomainInfo()
      .then((resp) => {
        console.log("🍎 获取CMDomainLookupInfo: ", resp);
        // 强制触发组件刷新
        this.setState({ lookupDomainIPs: { ...resp } });
      })
      .catch(() => {});
  };

  // 获取域名延迟-暂时不用，现在使用getCMDomainLookupInfo
  getCMDomainLookupInfoV0 = () => {
    DomainDetectVM.requestLookupCMDomainInfo()
      .then((resp) => {
        // 强制触发组件刷新
        this.setState({ lookupDomainIPs: { ...resp } });
      })
      .catch(() => {});
  };

  getDomainName(domainURL) {
    return DomainDetectVM.getDomainInfo()[domainURL]; // 若不存在则返回 null
  }

  // 遍历所有域名并获取延迟填充
  fillLatencyData = () => {
    DomainDetectVM.requestFillLatencyData({
      delayCallback: this.handleDomainGroups,
    });
  };
  // 定义一个方法专门处理回调
  handleDomainGroups = (domainGroups) => {
    // 强制触发组件刷新
    this.setState({ domainGroups: { ...domainGroups } });
  };

  // 设备信息
  fetchDeviceInfo = () => {
    DomainDetectVM.fetchDeviceInfo({
      systemInfoCallBack: (systemInfo) => {
        //console.log("🍎 设备信息: ", systemInfo);
        this.setState({ deviceInfo: systemInfo });
      },
    });
  };

  fetchIP = () => {
    DomainDetectVM.requestFetchIP({
      updateIPCallBack: (data) => {
        this.setState({ ipData: data });
      },
      errIPCallBack: (errDesc) => {
        this.setState({ error: errDesc });
      },
    });
  };

  // 并行查询浏览器请求延迟与 DNS；输入改变后忽略旧域名的返回值。
  handleCheck = async () => {
    const { domain } = this.state;
    if (!domain.trim()) return;
    this.setState({ delayResult: "检测中", domainIPs: "查询中" });
    DomainDetectVM.requestDomainLatencyInfo({
      domain: domain,
      callback: (result) => {
        if (this.state.domain === domain) this.setState({ delayResult: result });
      },
    });
    try {
      const ips = await DomainDetectVM.requestDNSARecords(MTRTool.normalizeTarget(domain));
      if (this.state.domain === domain) this.setState({ domainIPs: ips.join(", ") || "无 A 记录" });
    } catch (error) {
      if (this.state.domain === domain) this.setState({ domainIPs: error.message || "解析失败" });
    }
  };

  // 处理输入变化
  handleDomainChange = (event) => {
    this.setState({ domain: event.target.value, delayResult: "--", domainIPs: "未检测" });
  };

  handleLookupDomainChange = (e) => {
    this.setState({ lookupDomain: e.target.value });
  };

  handleMTRDomainChange = (e) => {
    this.setState({ mtrDomain: e.target.value });
  };

  handleTracerouteDomainChange = (e) => {
    this.setState({ tracerouteDomain: e.target.value });
  };

  getLookupDomain = () => {
    const { lookupDomain } = this.state;
    DomainDetectVM.requestQueryDNSForDomainInfo({
      domain: lookupDomain,
      lookupDomainCallBack: (result) => {
        this.setState({ result: result });
      },
    })
      .then((output) => {
        this.setState({ result: output });
      })
      .catch((errDesc) => {
        this.setState({ result: "查询失败: " + errDesc });
      });
  };

  getMTRInfo = async () => {
    const { mtrDomain } = this.state;
    const domain = MTRTool.normalizeTarget(mtrDomain);

    if (!domain) {
      this.setState({
        mtrResult:
          "查询失败: 请输入正确域名，比如：fusion-gateway-cn.imilab.com",
      });
      return;
    }

    this.setState({
      isMtrLoading: true,
      mtrResult: `正在从服务端执行 mtr ${domain}，请稍候...`,
    });

    try {
      // 浏览器不能执行系统 mtr/ICMP/TTL 探测；这里调用后端 /api/mtr，
      // 服务端执行系统原生 mtr；其 VPN/TUN 与 DNS 会影响结果，不能假定一定是公网直连。
      const report = await MTRTool.requestNativeMTR({
        target: domain,
        count: 36,
      });
      // console.log("🍎 获取MTRInfo: ", report, "text:", report.text);
      // MTR 的 warning 与正文分开返回，不能丢弃权限以外的部分报告/单跳风险提示。
      this.setState({ mtrResult: [report.text, report.warning].filter(Boolean).join("\n\n") });
    } catch (err) {
      this.setState({ mtrResult: "查询失败: " + (err?.message || err) });
    } finally {
      this.setState({ isMtrLoading: false });
    }
  };

  getTracerouteInfo = async () => {
    const domain = TracerouteTool.normalizeTarget(this.state.tracerouteDomain);

    if (!domain) {
      this.setState({
        tracerouteResult:
          "查询失败: 请输入正确域名或 IP，比如：google.com",
      });
      return;
    }

    this.setState({
      isTracerouteLoading: true,
      tracerouteResult: `正在 traceroute ${domain}，请稍候...`,
    });

    try {
      const report = await TracerouteTool.requestTraceroute({ target: domain });
      this.setState({ tracerouteResult: report.text });
    } catch (err) {
      this.setState({
        tracerouteResult: "查询失败: " + (err?.message || err),
      });
    } finally {
      this.setState({ isTracerouteLoading: false });
    }
  };

  render() {
    return (
      <div className="domainDetectPage-scrollable-container">
        {this.IPDomainInfoView()}
        {this.domainTestInfoView()}
        {this.ipInfoView()}
        {this.headerContainer()}
        {this.inputDomainInfoView()}
        {this.inputLookupView()}
        {this.inputMTRView()}
        {this.inputTracerouteView()}
        {this.deviceInfoView()}
      </div>
    );
  }

  /* IP域名 */
  IPDomainInfoView() {
    const { txDomain } = this.state.lookupDomainIPs;
    // console.log("🍎 测试Domains: ", txDomain);

    return txDomain ? (
      <div className="domainDetectPage-domains-container">
        <div className="domainDetectPage-head-container domainDetectPage-ip-card-container domainDetectPage-domains-card">
          {this.headTitleView("以下是创米IP域名")}
          <div className="domainDetectPage-ip-bottom-container">
            {isMobile()
              ? this.domainTestInfoMobileView(txDomain)
              : this.domainTestInfoPCView(txDomain)}
          </div>
        </div>
        <div className="domainDetectPage-head-container domainDetectPage-ip-card-container domainDetectPage-domains-card">
          {/* {this.headTitleView("其他域名延迟ping测试", true)}
          <div className="domainDetectPage-ip-bottom-container">
            {isMobile()
              ? this.domainTestInfoMobileView(otherDomain)
              : this.domainTestInfoPCView(otherDomain)}
          </div> */}
        </div>
      </div>
    ) : (
      <></>
    );
  }

  inputLookupView = () => {
    const { lookupDomain, result } = this.state;
    return (
      <div className="domainDetectPage-head-container domainDetectPage-head-detect-card">
        {this.headTitleView("域名 Lookup (模拟 dig查询域名IP地址)")}
        <div className="domainDetectPage-head-input-container">
          <div className="domainDetectPage-head-input-border">
            <div style={{ width: "80px" }}>域名输入: </div>
            <input
              type="text"
              placeholder="输入域名，例如 google.com"
              value={lookupDomain}
              onChange={this.handleLookupDomainChange} // 输入改变时更新 state
              className="domainDetectPage-head-input"
            />
          </div>
          <button
            className="domainDetectPage-head-detect-btn"
            onClick={this.getLookupDomain}
          >
            域名IP地址查询
          </button>
        </div>
        {!result?.trim() ? (
          <></>
        ) : (
          <pre className="domainDetectPage-lookup-text-normal">{result}</pre>
        )}
      </div>
    );
  };

  inputMTRView = () => {
    const { mtrDomain, mtrResult, isMtrLoading } = this.state;
    return (
      <div className="domainDetectPage-head-container domainDetectPage-head-detect-card">
        {this.headTitleView("域名 MTR (服务端原生 mtr命令)")}
        <details className="domainDetectPage-lookup-text-normal">
          <summary>MTR 结果说明与 macOS 权限配置</summary>
          <p>探测从服务端发出；本地开发时就是运行 Vite 的电脑。多个域名出现相同或类似跳点，可能是共享出口、VPN/TUN 或 Fake-IP 代理代答，不代表目标网站的公网路径相同。获取直连结果需在允许的网络环境中关闭服务端隧道/Fake-IP，并确认系统 DNS 已恢复；仅关闭浏览器代理不一定有效。</p>
          <p>若提示 Failure to open IPv4/IPv6 sockets，可由管理员在运行诊断服务的 Mac 终端执行以下命令。示例仅适用于可信的 Apple Silicon Homebrew mtr 0.96 安装，先确认路径和版本。4755 会让 mtr-packet 以 root 权限运行；不要对任意程序授权，也不要以 root 启动 Vite。升级后需重新检查。</p>
          <pre>{`sudo chown root:wheel /opt/homebrew/Cellar/mtr/0.96/sbin/mtr-packet
sudo chmod 4755 /opt/homebrew/Cellar/mtr/0.96/sbin/mtr-packet

# 授权后以普通用户验证，不加 sudo
/opt/homebrew/sbin/mtr --report --json --no-dns --report-cycles 1 baidu.com`}</pre>
        </details>
        <div className="domainDetectPage-head-input-container">
          <div className="domainDetectPage-head-input-border">
            <div style={{ width: "80px" }}>域名输入: </div>
            <input
              type="text"
              placeholder="输入域名，例如 fusion-gateway-cn.imilab.com"
              value={mtrDomain}
              onChange={this.handleMTRDomainChange} // 输入改变时更新 MTR 查询域名
              className="domainDetectPage-head-input"
            />
          </div>
          <button
            className="domainDetectPage-head-detect-btn"
            onClick={this.getMTRInfo}
            disabled={isMtrLoading}
          >
            {isMtrLoading ? "MTR查询中..." : "MTR查询"}
          </button>
        </div>
        {!mtrResult?.trim() ? (
          <></>
        ) : (
          <pre className="domainDetectPage-lookup-text-normal">{mtrResult}</pre>
        )}
      </div>
    );
  };

  inputTracerouteView = () => {
    const { tracerouteDomain, tracerouteResult, isTracerouteLoading } =
      this.state;
    return (
      <div className="domainDetectPage-head-container domainDetectPage-head-detect-card">
        {this.headTitleView("域名 Traceroute (服务端原生 traceroute/tracert命令)")}
        <div className="domainDetectPage-head-input-container">
          <div className="domainDetectPage-head-input-border">
            <div style={{ width: "80px" }}>域名输入: </div>
            <input
              type="text"
              placeholder="输入域名或 IP，例如 google.com"
              value={tracerouteDomain}
              onChange={this.handleTracerouteDomainChange}
              className="domainDetectPage-head-input"
            />
          </div>
          <button
            className="domainDetectPage-head-detect-btn"
            onClick={this.getTracerouteInfo}
            disabled={isTracerouteLoading}
          >
            {isTracerouteLoading ? "Traceroute查询中..." : "Traceroute查询"}
          </button>
        </div>
        {!tracerouteResult?.trim() ? (
          <></>
        ) : (
          <pre className="domainDetectPage-lookup-text-normal">
            {tracerouteResult}
          </pre>
        )}
      </div>
    );
  };

  headTitleView(headTitle, isShow = false) {
    return (
      <div className="domainDetectPage-head-detect-container">
        <div className="domainDetectPage-head-detect-lab">{headTitle}</div>
        {isShow && (
          <div
            className="domainDetectPage-head-detect-ping"
            onClick={() =>
              window.open("https://cloud.feitsui.com/aliyun", "_blank")
            }
          >
            阿里云在线Ping
          </div>
        )}
      </div>
    );
  }
  domainTestInfoView() {
    const { txDomain, otherDomain } = this.state.domainGroups;
    // console.log("🍎 测试Domains: ", txDomain);

    return (
      <div className="domainDetectPage-domains-container">
        <div className="domainDetectPage-head-container domainDetectPage-ip-card-container domainDetectPage-domains-card">
          {this.headTitleView("以下是创米域名延迟ping测试结果")}
          <div className="domainDetectPage-ip-bottom-container">
            {isMobile()
              ? this.domainTestInfoMobileView(txDomain)
              : this.domainTestInfoPCView(txDomain)}
          </div>
        </div>
        <div className="domainDetectPage-head-container domainDetectPage-ip-card-container domainDetectPage-domains-card">
          {this.headTitleView("其他域名延迟ping测试结果", true)}
          <div className="domainDetectPage-ip-bottom-container">
            {isMobile()
              ? this.domainTestInfoMobileView(otherDomain)
              : this.domainTestInfoPCView(otherDomain)}
          </div>
        </div>
      </div>
    );
  }
  domainTestInfoPCView(domainArr) {
    return domainArr.map((rowItem, rowIndex) => {
      const leftItem = rowItem[0];
      const rightItem = rowItem[1];
      const key0 = Object.keys(leftItem)[0]; // 返回对象的键名数组
      const key1 = Object.keys(rightItem)[0];
      const value0 = leftItem[key0];
      const value1 = rightItem[key1];
      // console.log(
      //   "🍎 leftItem: ",
      //   leftItem,
      //   "rightItem",
      //   rightItem,
      //   "\nkey0: ",
      //   key0,
      //   "value0",
      //   value0,
      //   "\nkey1: ",
      //   key1,
      //   "value1",
      //   value1
      // );
      return this.deviceInfoCell0(rowIndex, key0, value0, key1, value1);
    });
  }
  domainTestInfoMobileView(domainArr) {
    return (
      <>
        {domainArr &&
          domainArr.map((rowItem) => {
            const leftItem = rowItem[0];
            const key0 = Object.keys(leftItem)[0]; // 返回对象的键名数组
            const value0 = leftItem[key0];
            return this.domianCellMobileView({
              isUserDelegate: false,
              title: this.getDomainName(key0) || key0,
              value: value0,
            });
          })}
        {domainArr.map((rowItem) => {
          const rightItem = rowItem[1];
          const key1 = Object.keys(rightItem)[0];
          const value1 = rightItem[key1];
          return this.domianCellMobileView({
            isUserDelegate: false,
            title: this.getDomainName(key1) || key1,
            value: value1,
          });
        })}
      </>
    );
  }
  domianCellMobileView({ isUserDelegate = false, title, value }) {
    return (
      <div key={title} className="domainDetectPage-mobile-domain-info-cell">
        <div className="domainDetectPage-device-info-cell-left-title">
          {title}
        </div>
        <div
          className={`${
            isUserDelegate
              ? "domainDetectPage-device-info-cell-left-delegate"
              : "domainDetectPage-device-info-cell-left-value"
          }`}
        >
          {value}
        </div>
      </div>
    );
  }

  //IP信息
  ipInfoView() {
    const { ipData, error } = this.state;
    console.log("🍎 ipdata: ", ipData);

    const defaultStr = "-.-";
    const createTime = ipData?.data?.AsnInfo?.CreateTime || defaultStr;
    // 取出 Address，如果为空则给默认值 “——”
    const address = ipData?.data?.AsnInfo?.Address || defaultStr;
    const frontISP = ipData?.data?.AsnInfo?.FrontISP || defaultStr;
    const ipStr = ipData?.data?.AsnInfo?.IP || defaultStr;

    const timeStr = TimeUtils.formatDateTimeWithWeekday(createTime);
    const lastIpStr = ipStr + " " + frontISP + "\n" + address;

    const localIPArr = [
      [{ "探测时间：": timeStr }, { "公网出口IP：": lastIpStr }],
    ];

    if (!ipData) {
      return error ? <div role="alert">{error}</div> : <div />;
    }

    return (
      <div className="domainDetectPage-head-container domainDetectPage-ip-card-container">
        {this.headTitleView("公网出口 IP 信息（代理服务器视角）")}
        <div className="domainDetectPage-ip-bottom-container">
          {isMobile()
            ? this.domainTestInfoMobileView(localIPArr)
            : this.domainTestInfoPCView(localIPArr)}
        </div>
      </div>
    );
  }

  //输入域名信息
  inputDomainInfoView() {
    const { domain, delayResult, domainIPs } = this.state;

    if (!domain) {
      return <></>;
    }
    // 只有数值结果才表示测量成功，未检测或失败不能展示“网络正常”。
    const delayTxt = typeof delayResult === "number" && Number.isFinite(delayResult)
      ? `浏览器请求延时 ${delayResult} 毫秒（非 ICMP）`
      : delayResult === "--" ? "未检测" : delayResult === "检测中" ? "检测中" : "检测失败";

    const inputInfoArr = [
      [{ "域名：": domain || this.defaultTxt }, { "加载延时：": delayTxt }],
      [{ "域名解析IP：": domainIPs }, { "": "" }],
    ];

    return (
      <div className="domainDetectPage-head-container domainDetectPage-ip-card-container">
        {this.headTitleView("您输入域名的测试结果")}
        <div className="domainDetectPage-ip-bottom-container">
          {isMobile()
            ? this.domainTestInfoMobileView(inputInfoArr)
            : this.domainTestInfoPCView(inputInfoArr)}
        </div>
      </div>
    );
  }

  //头部组件
  headerContainer() {
    return (
      <div className="domainDetectPage-head-container domainDetectPage-head-detect-card">
        {this.headTitleView("发起检测")}
        <div className="domainDetectPage-head-input-container">
          <div className="domainDetectPage-head-input-border">
            <div style={{ width: "80px" }}>检测域名: </div>
            <input
              type="text"
              placeholder="请输入域名类似： www.baidu.com"
              value={this.state.domain}
              onChange={this.handleDomainChange} // 输入改变时更新 state
              className="domainDetectPage-head-input"
            />
          </div>
          <button
            className="domainDetectPage-head-detect-btn"
            onClick={this.handleCheck}
          >
            提交检测
          </button>
        </div>
      </div>
    );
  }

  // 设备信息内容
  deviceInfoView() {
    const { deviceInfo } = this.state;
    const defaultStr = "-.-";
    const deviceArr = [
      [
        { "操作系统：": deviceInfo?.os || defaultStr },
        { "浏览器：": deviceInfo?.browser || defaultStr },
      ],
      [{ "用户代理：": deviceInfo?.userAgent || defaultStr }, { "": "" }],
      [
        { "Flash版本：": deviceInfo?.flash || defaultStr },
        { "Cookie状态：": deviceInfo?.cookieEnabled || defaultStr },
      ],
      [
        { "JavaScript状态：": deviceInfo?.jsEnabled || defaultStr },
        { "LocalStorage状态：": deviceInfo?.localStorage || defaultStr },
      ],
      [
        { "是否联网：": deviceInfo?.online || defaultStr },
        { "网络类型：": deviceInfo?.networkType || defaultStr },
      ],
      [
        { "下行带宽：": deviceInfo?.downlink || defaultStr },
        { "有效RTT：": deviceInfo?.rtt || defaultStr },
      ],
    ];

    return (
      <div className="domainDetectPage-head-container domainDetectPage-ip-card-container">
        {this.headTitleView("您操作系统相关信息")}
        <div className="domainDetectPage-ip-bottom-container">
          {isMobile()
            ? this.domainTestInfoMobileView(deviceArr)
            : this.domainTestInfoPCView(deviceArr)}
        </div>
      </div>
    );
  }
  deviceInfoCell0(identifier, lfTitle, lfValue, rtTitle, rtValue) {
    let isDelegate = lfTitle == "用户代理：";

    return (
      <div key={identifier} className="domainDetectPage-device-info-cell">
        <div className="domainDetectPage-device-info-cell-left">
          {this.deviceInfoCellContent({
            isUserDelegate: isDelegate,
            title: this.getDomainName(lfTitle) || lfTitle,
            value: lfValue,
          })}
          {this.deviceInfoCellContent({
            isUserDelegate: isDelegate,
            title: this.getDomainName(rtTitle) || rtTitle,
            value: rtValue,
          })}
        </div>
      </div>
    );
  }
  deviceInfoCellContent({ isUserDelegate = false, title, value }) {
    return (
      <React.Fragment>
        <div className="domainDetectPage-device-info-cell-left-title">
          {title}
        </div>
        <div
          className={`${
            isUserDelegate
              ? "domainDetectPage-device-info-cell-left-delegate"
              : "domainDetectPage-device-info-cell-left-value"
          }`}
        >
          {value}
        </div>
      </React.Fragment>
    );
  }
}

export default DomainDetectPage;
