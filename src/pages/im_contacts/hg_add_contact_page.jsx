/*
 * @Description: 添加联系人页面（仿微信「添加朋友」）：搜索 → 查找结果 → 申请添加 → 申请人资料，每步为独立整页。
 * 约束：类组件；render 只组装 renderXxx；单输入框精确识别系统 ID / 用户 ID / 自定义 ID / 手机号 / 邮箱；
 *       可图标化的操作一律使用 HGIconPage 图标按钮，文字仅用于标题、说明与无障碍标签；
 *       搜索与申请走真实 VM 请求链，服务端失败不伪造成功关系或联系人资料。
 */
import React from "react";
import HGIconPage from "../../components/hg_icon/hg_icon_page";
import HGAddContactVM, { HG_SEARCH_TYPES } from "./hg_add_contact_vm";
import { ROUTE_PATH } from "../../components/hg_navigation/hg_route_path";
import styles from "./hg_add_contact_page.module.css";

/** 步骤标题，与 hgStep 一一对应；标题是页面标识，无法用图标表达，予以保留。 */
const HG_STEP_TITLES = Object.freeze({
  search: "添加朋友",
  result: "查找结果",
  apply: "申请添加朋友",
  profile: "联系人资料",
});

/** 朋友权限选项：仅供演示本地草稿；当前后端好友申请协议不保存朋友权限。 */
const HG_PERMISSIONS = Object.freeze([
  { key: "all", label: "聊天、朋友圈、微信运动等", hint: "默认开放全部可见范围" },
  { key: "chat_only", label: "仅聊天", hint: "不看对方朋友圈与状态" },
]);

/** 仿微信添加朋友向导；pageNavigator / navigate 由 WithNavigation 注入，用于返回来源页。 */
class HGAddContactPage extends React.Component {
  hgUnmounted = false; // 卸载后忽略异步回调，避免覆盖已销毁页面。

  state = {
    hgStep: "search", // 当前整页：search / result / apply / profile。
    hgKeyword: "", // 搜索输入，trim 后提交；查找方式由内容自动识别。
    hgSearching: false, // 搜索请求进行中，禁用重复提交。
    hgError: "", // 当前整页的错误提示，空串表示无错误。
    hgResult: null, // 归一化后的联系人资料，null 表示尚未命中。
    hgRequestMessage: "", // 验证申请附言。
    hgRemark: "", // 申请页备注本地演示草稿，服务端尚不支持随申请保存。
    hgPermission: "all", // 朋友权限本地演示选择，服务端尚不支持随申请保存。
    hgSending: false, // 申请提交中。
  };

  componentWillUnmount() {
    this.hgUnmounted = true;
  }

  /** 退出页面：优先按导航器返回来源（聊天首页），缺少注入时回退到首页路由。 */
  hgClose = () => {
    const { pageNavigator, navigate } = this.props;
    if (pageNavigator?.back) pageNavigator.back();
    else if (navigate) navigate(ROUTE_PATH.HOME, { replace: true });
  };

  /** 顶栏返回：逐步回退，search / profile 直接离开页面。 */
  hgGoBack = () => {
    const { hgStep } = this.state;
    if (hgStep === "result") {
      this.setState({ hgStep: "search", hgResult: null, hgError: "" });
      return;
    }
    if (hgStep === "apply") {
      this.setState({ hgStep: "result", hgError: "" });
      return;
    }
    this.hgClose();
  };

  /** 重置为初始搜索整页，用于「继续添加联系人」。 */
  hgReset = () => {
    this.setState({
      hgStep: "search", hgKeyword: "", hgError: "", hgResult: null,
      hgRequestMessage: "", hgRemark: "", hgPermission: "all",
    });
  };

  /** 提交精确搜索：只接受服务端返回的真实资料，失败如实提示，不降级为本地假结果。 */
  hgSearch = async (event) => {
    event?.preventDefault?.();
    const { hgKeyword, hgSearching } = this.state;
    if (hgSearching) return;
    const error = HGAddContactVM.validateKeyword(hgKeyword);
    if (error) {
      this.setState({ hgError: error });
      return;
    }
    this.setState({ hgSearching: true, hgError: "" });
    try {
      const raw = await HGAddContactVM.searchContact(hgKeyword.trim());
      if (this.hgUnmounted) return;
      const profile = HGAddContactVM.normalizeProfile(raw, hgKeyword.trim());
      if (!profile.userId) {
        this.setState({ hgError: "服务端未返回有效用户标识，请更换内容后重试" });
        return;
      }
      this.setState({ hgResult: profile, hgStep: "result" });
    } catch {
      if (!this.hgUnmounted) this.setState({ hgError: "未找到该用户，或搜索服务暂不可用；请检查输入后重试" });
    } finally {
      if (!this.hgUnmounted) this.setState({ hgSearching: false });
    }
  };

  /** 从结果页进入申请表单，并按微信习惯预填一句验证附言。 */
  hgOpenApply = () => {
    this.setState((state) => ({
      hgStep: "apply",
      hgError: "",
      hgRequestMessage: state.hgRequestMessage || "你好，我想添加你为联系人",
    }));
  };

  /** 发送申请：仅真实资料可以提交，服务端确认成功后才进入结果页。 */
  hgSubmitApply = async () => {
    const { hgResult, hgRequestMessage, hgSending } = this.state;
    if (hgSending || !hgResult) return;
    this.setState({ hgSending: true, hgError: "" });
    try {
      await HGAddContactVM.sendFriendRequest(hgResult.userId, hgRequestMessage.trim());
      if (this.hgUnmounted) return;
      this.setState({ hgStep: "profile" });
    } catch {
      if (!this.hgUnmounted) this.setState({ hgError: "申请发送失败，请稍后重试" });
    } finally {
      if (!this.hgUnmounted) this.setState({ hgSending: false });
    }
  };

  /** 关系状态文案：已是好友 / 申请待处理时不重复发送申请。 */
  hgRelationHint = (friendStatus) => {
    if (friendStatus === "friend") return "对方已是你的联系人，无需重复添加";
    if (friendStatus === "outgoing_pending") return "你已向对方发送过申请，等待对方验证";
    if (friendStatus === "incoming_pending") return "对方已向你发起申请，可前往通讯录处理";
    return "";
  };

  /** 通用图标按钮：文字只作为 aria-label / title，不在按钮内渲染文本。 */
  renderIconButton(type, label, onClick, variantClass = "", disabled = false, iconSize = 20) {
    return (
      <button
        type="button"
        className={`${styles.iconBtn} ${variantClass}`}
        aria-label={label}
        title={label}
        onClick={onClick}
        disabled={disabled}
      >
        <HGIconPage type={type} style={{ fontSize: iconSize, color: "inherit" }} />
      </button>
    );
  }

  /** 主操作：大圆形图标 + 辅助说明小字，按钮本体不含文字。 */
  renderAction(iconType, label, onClick, variantClass, disabled = false) {
    return (
      <div className={styles.actionItem}>
        {this.renderIconButton(iconType, label, onClick, variantClass, disabled, 26)}
        <span className={styles.actionCaption}>{label}</span>
      </div>
    );
  }

  /** 整页顶栏：左侧返回、右侧回聊天均为图标，中间保留页面标题文字。 */
  renderHeader() {
    return (
      <header className={styles.pageHeader}>
        {this.renderIconButton("arrow-left", "返回", this.hgGoBack)}
        <h1 className={styles.headerTitle}>{HG_STEP_TITLES[this.state.hgStep]}</h1>
        {this.renderIconButton("home", "返回聊天", this.hgClose)}
      </header>
    );
  }

  /** 头像：沿用通讯录模块的取色与首字规则，尺寸由调用方指定。 */
  renderAvatar(profile, sizeClass) {
    const seed = profile?.userId || profile?.publicId || "?";
    return (
      <span
        className={`${styles.avatar} ${sizeClass}`}
        style={{ backgroundColor: HGAddContactVM.getAvatarColor(seed) }}
        aria-hidden="true"
      >
        {HGAddContactVM.getAvatarText(profile)}
      </span>
    );
  }

  /** 当前整页的错误提示；无错误时不占位。 */
  renderError() {
    if (!this.state.hgError) return null;
    return <p className={styles.errorText} role="alert">{this.state.hgError}</p>;
  }

  /** 第一整页：按输入自动识别服务端支持的五种精确检索类型。 */
  renderSearchStep() {
    const { hgKeyword, hgSearching } = this.state;
    const detected = HGAddContactVM.getSearchConfig(hgKeyword);
    return (
      <div className={styles.stepPage}>
        <div className={styles.heroBadge}>
          <HGIconPage type="add-user" style={{ fontSize: 34, color: "inherit" }} />
        </div>
        <h2 className={styles.heroTitle}>添加朋友</h2>
        <p className={styles.heroSub}>输入系统 ID、用户 ID、手机号、邮箱或自定义 ID，精确查找用户</p>

        <form className={styles.searchBar} onSubmit={this.hgSearch}>
          <HGIconPage type="search" style={{ fontSize: 20, color: "#9a9a9a" }} />
          <input
            className={styles.searchInput}
            aria-label="查找联系人"
            placeholder="系统 ID / 用户 ID / 手机号 / 邮箱 / 自定义 ID"
            value={hgKeyword}
            maxLength={254}
            onChange={(event) => this.setState({ hgKeyword: event.target.value, hgError: "" })}
          />
          <span className={styles.detectedIcon} title={`当前按${detected.label}查找`} aria-label={`当前按${detected.label}查找`}>
            <HGIconPage type={detected.icon} style={{ fontSize: 18, color: "inherit" }} />
          </span>
          <button
            type="submit"
            className={styles.searchSubmit}
            aria-label="搜索"
            title="搜索"
            disabled={hgSearching || !hgKeyword.trim()}
          >
            <HGIconPage type={hgSearching ? "loading" : "search"} style={{ fontSize: 20, color: "inherit" }} />
          </button>
        </form>
        {this.renderError()}

        <div className={styles.wayRow}>
          {HG_SEARCH_TYPES.map((item) => (
            <span key={item.key} className={styles.wayIcon}
              title={`支持${item.label}精确查找`} aria-label={`支持${item.label}精确查找`}>
              <HGIconPage type={item.icon} style={{ fontSize: 22, color: "inherit" }} />
            </span>
          ))}
        </div>
        <p className={styles.wayHint}>五种方式均以真实接口返回的资料为准；手机号和邮箱不会展示在结果中</p>
      </div>
    );
  }

  /** 第二整页：展示服务端命中的联系人，主操作为圆形添加图标按钮。 */
  renderResultStep() {
    const { hgResult } = this.state;
    if (!hgResult) return null;
    const name = HGAddContactVM.getDisplayName(hgResult);
    const hint = this.hgRelationHint(hgResult.friendStatus);
    const canAdd = hgResult.friendStatus === "none";
    return (
      <div className={styles.stepPage}>
        <div className={styles.resultHero}>
          {this.renderAvatar(hgResult, styles.avatarHero)}
          <div className={styles.resultNameRow}>
            <strong className={styles.resultName}>{name}</strong>
          </div>
          <p className={styles.resultMeta}>{hgResult.username || hgResult.publicId || "未设置账号"}</p>
          {hgResult.region && <p className={styles.resultMeta}>{hgResult.region}</p>}
          {hgResult.signature && <p className={styles.resultSignature}>{hgResult.signature}</p>}
        </div>
        {hint && (
          <div className={styles.relationHint}>
            <HGIconPage type="emotion" style={{ fontSize: 16, color: "inherit" }} />
            <span>{hint}</span>
          </div>
        )}
        <div className={styles.actionRow}>
          {this.renderAction("add-user", canAdd ? "添加到通讯录" : "暂不可添加", this.hgOpenApply, styles.primaryIconBtn, !canAdd)}
          {this.renderAction("arrow-left", "重新查找", this.hgGoBack, styles.ghostIconBtn)}
        </div>
      </div>
    );
  }

  /** 第三整页：微信式验证申请表单，字段头用图标 + 文字说明，提交为圆形图标按钮。 */
  renderApplyStep() {
    const { hgResult, hgRequestMessage, hgRemark, hgPermission, hgSending } = this.state;
    if (!hgResult) return null;
    const name = HGAddContactVM.getDisplayName(hgResult);
    return (
      <div className={styles.stepPage}>
        <div className={styles.applyTarget}>
          {this.renderAvatar(hgResult, styles.avatarMedium)}
          <div className={styles.applyTargetInfo}>
            <strong className={styles.applyTargetName}>{name}</strong>
            <p className={styles.applyTargetMeta}>{hgResult.username || hgResult.publicId || "未设置账号"}</p>
          </div>
        </div>

        <div className={styles.formCard}>
          <div className={styles.fieldHead}>
            <HGIconPage type="edit" style={{ fontSize: 18, color: "inherit" }} />
            <span>验证附言</span>
          </div>
          <p className={styles.fieldHint}>你需要发送验证申请，等对方通过</p>
          <textarea
            className={styles.textarea}
            aria-label="验证附言"
            rows={3}
            maxLength={128}
            value={hgRequestMessage}
            placeholder="填写验证附言（可选）"
            onChange={(event) => this.setState({ hgRequestMessage: event.target.value })}
          />
          <div className={styles.fieldHead}>
            <HGIconPage type="card" style={{ fontSize: 18, color: "inherit" }} />
            <span>设置备注</span>
          </div>
          <input
            className={styles.textInput}
            aria-label="设置备注"
            maxLength={32}
            value={hgRemark}
            placeholder="仅自己可见，留空显示对方昵称"
            onChange={(event) => this.setState({ hgRemark: event.target.value })}
          />
          <p className={styles.fieldHint}>备注与朋友权限仅用于本页演示，不会随申请提交或保存；真实申请只发送验证附言。</p>
        </div>

        <div className={styles.formCard}>
          <div className={styles.fieldHead}>
            <HGIconPage type="lock" style={{ fontSize: 18, color: "inherit" }} />
            <span>朋友权限</span>
          </div>
          {HG_PERMISSIONS.map((item) => (
            <label key={item.key} className={styles.radioRow}>
              <input
                type="radio"
                name="hg-permission"
                value={item.key}
                checked={hgPermission === item.key}
                onChange={() => this.setState({ hgPermission: item.key })}
              />
              <span className={styles.radioMain}>
                <span className={styles.radioLabel}>{item.label}</span>
                <span className={styles.radioHint}>{item.hint}</span>
              </span>
            </label>
          ))}
        </div>

        {this.renderError()}
        <div className={styles.actionRow}>
          {this.renderAction(
            "check",
            hgSending ? "发送中" : "发送申请",
            this.hgSubmitApply,
            styles.primaryIconBtn,
            hgSending,
          )}
          {this.renderAction("arrow-left", "返回", this.hgGoBack, styles.ghostIconBtn)}
        </div>
      </div>
    );
  }

  /** 第四整页：真实检索资料和服务端确认的申请结果；未保存的表单草稿仍明确标注。 */
  renderProfileStep() {
    const { hgResult, hgRequestMessage, hgRemark, hgPermission } = this.state;
    if (!hgResult) return null;
    const name = HGAddContactVM.getDisplayName(hgResult);
    const permission = HG_PERMISSIONS.find((item) => item.key === hgPermission);
    const rows = [
      { label: "账号", icon: "user", value: hgResult.username || hgResult.publicId || "未设置" },
      { label: "系统 ID", icon: "card", value: hgResult.publicId || "未设置" },
      { label: "地区", icon: "home", value: hgResult.region || "未填写" },
      { label: "个性签名", icon: "edit", value: hgResult.signature || "暂无签名" },
      { label: "来源", icon: "search", value: hgResult.source },
      { label: "验证附言", icon: "mail", value: hgRequestMessage.trim() || "未填写" },
      { label: "备注", icon: "plus", value: `${hgRemark.trim() || "未设置"}（仅预览，未保存）` },
      { label: "朋友权限", icon: "lock", value: `${permission ? permission.label : "未设置"}（仅预览，未保存）` },
    ];
    return (
      <div className={styles.stepPage}>
        <div className={styles.profileHero}>
          {this.renderAvatar(hgResult, styles.avatarHero)}
          <div className={styles.resultNameRow}>
            <strong className={styles.resultName}>{name}</strong>
          </div>
          <p className={styles.resultMeta}>{hgResult.username || hgResult.publicId || "未设置账号"}</p>
          {hgResult.signature && <p className={styles.resultSignature}>{hgResult.signature}</p>}
        </div>

        <div className={styles.statusBar} role="status">
          <HGIconPage type="check" style={{ fontSize: 18, color: "inherit" }} />
          <span>好友申请已提交；最终关系状态以通讯录为准</span>
        </div>

        <div className={styles.infoCard}>
          {rows.map((row) => (
            <div key={row.label} className={styles.infoRow}>
              <span className={styles.infoIcon} title={row.label} aria-label={row.label}>
                <HGIconPage type={row.icon} style={{ fontSize: 18, color: "inherit" }} />
              </span>
              <span className={styles.infoValue}>{row.value}</span>
            </div>
          ))}
        </div>

        <div className={styles.actionRow}>
          {this.renderAction("plus", "继续添加", this.hgReset, styles.ghostIconBtn)}
          {this.renderAction("home", "返回聊天", this.hgClose, styles.ghostIconBtn)}
        </div>
      </div>
    );
  }

  render() {
    const { hgStep } = this.state;
    return (
      <div className={styles.pageRoot}>
        {this.renderHeader()}
        <main className={styles.pageContent}>
          {hgStep === "search" && this.renderSearchStep()}
          {hgStep === "result" && this.renderResultStep()}
          {hgStep === "apply" && this.renderApplyStep()}
          {hgStep === "profile" && this.renderProfileStep()}
        </main>
      </div>
    );
  }
}

export default HGAddContactPage;
