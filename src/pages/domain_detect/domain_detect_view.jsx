/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2025-09-11 20:23:52
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2025-09-15 14:16:01
 * @FilePath: /MLC_React/src/pages/domain_detect/domain_detect_view.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import React from "react";
import DomainDetectVM from "./domain_detect_vm";
import "./domain_detect.css";
import { isMobile } from "./../../utils/SystemInfoUtil";
import TimeUtils from '../../utils/TimeUtils';

class DomainDetectView extends React.Component {
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
        domainGroups: DomainDetectVM.getDomainGroups(), //测试的domains
        lookupDomain: "",
        result: "",
        lookupDomainIPs: {},
      };
    }
  
    componentDidMount() {
      // 获取域名延迟
      this.fillLatencyData();
      // 获取iP信息
      this.fetchIP();
      //获取设备信息
      this.fetchDeviceInfo();
      this.getCMDomainLookupInfo();
  
      DomainDetectVM.testEnvironVariable();
    }
  
    getCMDomainLookupInfo = () => {
      DomainDetectVM.requestLookupCMDomainInfo()
        .then((resp) => {
          // 强制触发组件刷新
          this.setState({ lookupDomainIPs: { ...resp } });
        })
        .catch((err) => {});
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
  
    handleCheck = async () => {
      const { domain } = this.state;
      DomainDetectVM.requestDomainLatencyInfo({
        domain: domain,
        callback: (result) => {
          console.log("🍎 ping域名:", domain, "ping 延迟：", result);
          this.setState({ delayResult: result }); // 你可以根据逻辑更新 result
        },
      });
    };
  
    // 处理输入变化
    handleDomainChange = (event) => {
      this.setState({ domain: event.target.value });
    };
  
    handleLookupDomainChange = (e) => {
      this.setState({ lookupDomain: e.target.value });
    };
  
    getLookupDomain = () => {
      const { lookupDomain } = this.state;
      DomainDetectVM.requestLookupDomain({
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
  
    render() {
      return (
        <div className="domainDetectPage-scrollable-container">
          {this.IPDomainInfoView()}
          {this.domainTestInfoView()}
          {this.ipInfoView()}
          {this.headerContainer()}
          {this.inputDomainInfoView()}
          {this.inputLookupView()}
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
          {this.headTitleView("域名 Lookup (模拟 nslookup)")}
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
            domainArr.map((rowItem, rowIndex) => {
              const leftItem = rowItem[0];
              const key0 = Object.keys(leftItem)[0]; // 返回对象的键名数组
              const value0 = leftItem[key0];
              return this.domianCellMobileView({
                isUserDelegate: false,
                title: this.getDomainName(key0) || key0,
                value: value0,
              });
            })}
          {domainArr.map((rowItem, rowIndex) => {
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
      // console.log("🍎 ipdata: ", ipData);
  
      const defaultStr = "-.-";
      const createTime = ipData?.data?.AsnInfo?.CreateTime || defaultStr;
      // 取出 Address，如果为空则给默认值 “——”
      const address = ipData?.data?.AsnInfo?.Address || defaultStr;
      const frontISP = ipData?.data?.AsnInfo?.FrontISP || defaultStr;
      const ipStr = ipData?.data?.AsnInfo?.IP || defaultStr;
  
      const timeStr = TimeUtils.formatDateTimeWithWeekday(createTime);
      const lastIpStr = ipStr + " " + frontISP + "\n" + address;
      const ldnsStr = "获取失败（递归LDNS）";
      const userLDNS =
        "202.96.209.5;202.96.209.133" + "\n（面向用户LDNS）🍎 只能通过服务器获取";
  
      const localIPArr = [
        [{ "探测时间：": timeStr }, { "公网出口IP：": lastIpStr }],
        // [{ "LDNS：": ldnsStr }, { "LDNS：": userLDNS }],
      ];
  
      if (!ipData) {
        return <div />;
      }
  
      return (
        <div className="domainDetectPage-head-container domainDetectPage-ip-card-container">
          {this.headTitleView("以下是您的IP相关信息")}
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
      const { domain, delayResult } = this.state;
  
      if (!domain) {
        return <></>;
      }
      const delayTxt =
        "网络正常，延时" + (delayResult || this.defaultTxt) + "毫秒";
  
      const inputInfoArr = [
        [{ "域名：": domain || this.defaultTxt }, { "加载延时：": delayTxt }],
        [{ "域名解析IP：": "获取失败，请重试" }, { "": "" }],
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
  
  export default DomainDetectView;
  