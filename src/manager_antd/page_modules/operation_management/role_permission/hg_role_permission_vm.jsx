/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-05-24
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-10-29
 * @FilePath: /MLC_React/src/manager_antd/page_modules/operation_management/role_permission/hg_role_permission_vm.jsx
 * @Description: 权限管理 ViewModel，管理角色列表、权限分组树、风险等级与提交逻辑
 *
 * 权限模型说明（对齐 RBAC + ABAC 设计）：
 * - 角色是权限的集合，用户通过角色获得权限。
 * - 权限编码统一采用「业务域:资源:操作」，例如 video:submission:publish、iam:role:grant。
 * - 高风险权限（授权、退款、生产部署、回滚）需要额外审批，前端需要显式提示风险等级。
 */
import { HGMANAGER_API } from "../../../api/hg_api_constants";
import HGNet from "../../../net_handle/hg_net_manager_vm";

/**
 * 角色展示样例；页面运行时只使用 IAM 角色接口，不以样例作授权依据。
 */
export const MOCK_ROLE_LIST = [
  {
    label: "平台超级管理员",
    value: "role_super_admin",
    code: "super_admin",
    desc: "平台最高管理角色，可创建角色、分配权限、授权其他管理员。",
  },
  {
    label: "安全管理员",
    value: "role_security_admin",
    code: "security_admin",
    desc: "管理角色授权与安全策略，查看授权审计日志。",
  },
  {
    label: "系统管理员",
    value: "role_system_admin",
    code: "admin",
    desc: "日常后台管理，包含用户、角色、权限等系统配置。",
  },
  {
    label: "系统运维",
    value: "role_system_ops",
    code: "ops_admin",
    desc: "查看系统监控与执行授权运维操作，不含业务数据权限。",
  },
  {
    label: "内容编辑",
    value: "role_content_editor",
    code: "creator",
    desc: "维护课程与文章内容，可发布自有内容。",
  },
  {
    label: "内容审核",
    value: "role_content_reviewer",
    code: "content_reviewer",
    desc: "审核视频、评论与弹幕，不参与内容创作。",
  },
  {
    label: "运营主管",
    value: "role_operation_manager",
    code: "operator",
    desc: "管理活动、推荐位与订单运营，可按授权查看数据。",
  },
  {
    label: "运营专员",
    value: "role_operation_staff",
    code: "operator_staff",
    desc: "执行日常运营配置，不含退款等敏感资金操作。",
  },
];

/**
 * 权限树形数据。
 * 职责：为权限分组面板提供可勾选的权限节点。
 * 约束：仅作为展示名称目录；实际可选权限必须来自服务端登记的权限编码。
 */
export const MOCK_PERMISSION_TREE = [
  {
    title: "系统管理",
    value: "perm_system",
    children: [
      {
        title: "用户管理",
        value: "perm_system_user",
        children: [
          { title: "查看用户资料", value: "user:profile:read" },
          { title: "禁用用户", value: "user:account:disable" },
        ],
      },
      {
        title: "角色管理",
        value: "perm_system_role",
        children: [
          { title: "读取角色和授权", value: "iam:role:read" },
          { title: "创建角色及管理授权", value: "iam:role:grant" },
        ],
      },
      {
        title: "权限管理",
        value: "perm_system_permission",
        children: [
          { title: "配置角色权限", value: "iam:permission:grant" },
          { title: "审批 IAM 扩权", value: "iam:approval:approve" },
        ],
      },
      {
        title: "安全审计",
        value: "perm_system_audit",
        children: [
          { title: "查看审计日志", value: "iam:audit:read" },
        ],
      },
    ],
  },
  {
    title: "内容管理",
    value: "perm_content",
    children: [
      {
        title: "课程管理",
        value: "perm_content_course",
        children: [
          { title: "课程列表", value: "perm_content_course_list" },
          { title: "课程新增", value: "perm_content_course_add" },
          { title: "课时管理", value: "perm_content_course_lesson" },
          { title: "课程删除", value: "perm_content_course_delete" },
        ],
      },
      {
        title: "文章管理",
        value: "perm_content_article",
        children: [
          { title: "文章列表", value: "perm_content_article_list" },
          { title: "文章发布", value: "perm_content_article_publish" },
        ],
      },
      {
        title: "内容审核",
        value: "perm_content_review",
        children: [
          { title: "审核视频", value: "perm_content_review_video" },
          { title: "审核评论", value: "perm_content_review_comment" },
          { title: "审核弹幕", value: "perm_content_review_danmaku" },
        ],
      },
    ],
  },
  {
    title: "运营管理",
    value: "perm_operation",
    children: [
      {
        title: "订单管理",
        value: "perm_operation_order",
        children: [
          { title: "订单列表", value: "perm_operation_order_list" },
          { title: "订单详情", value: "perm_operation_order_detail" },
          { title: "订单退款", value: "perm_operation_order_refund" },
        ],
      },
      {
        title: "短信管理",
        value: "perm_operation_sms",
        children: [
          { title: "模板管理", value: "perm_operation_sms_template" },
          { title: "发送记录", value: "perm_operation_sms_log" },
        ],
      },
    ],
  },
  {
    title: "运维管理",
    value: "perm_ops",
    children: [
      {
        title: "监控与日志",
        value: "perm_ops_observe",
        children: [
          { title: "查看系统指标", value: "perm_ops_metrics_read" },
          { title: "查看运行日志", value: "perm_ops_logs_read" },
          { title: "查看非敏感配置", value: "perm_ops_config_read" },
        ],
      },
      {
        title: "发布与变更",
        value: "perm_ops_release",
        children: [
          { title: "执行部署", value: "perm_ops_deployment_execute" },
          { title: "数据库迁移", value: "perm_ops_database_migrate" },
          { title: "生产环境回滚", value: "perm_ops_production_rollback" },
        ],
      },
      {
        title: "爬虫任务",
        value: "perm_crawler_task",
        children: [
          { title: "查看任务", value: "perm_crawler_task_read" },
          { title: "创建任务", value: "perm_crawler_task_create" },
          { title: "启停任务", value: "perm_crawler_task_execute" },
        ],
      },
    ],
  },
];

/**
 * 高风险权限关键词表。
 * 职责：按权限编码判断风险等级，用于面板上的风险提示标签。
 * 约束：仅用于展示提示，最终是否允许执行仍由后端权限引擎判定。
 */
const RISK_RULES = [
  {
    keywords: ["grant", "rollback", "migrate", "audit_delete"],
    level: "critical",
    label: "极高",
    tone: "error",
  },
  {
    keywords: ["delete", "refund", "ops:deployment:execute", "assign"],
    level: "high",
    label: "高",
    tone: "warning",
  },
  {
    keywords: ["update", "edit", "publish", "execute", "export"],
    level: "medium",
    label: "中",
    tone: "info",
  },
];

/**
 * 权限管理 ViewModel 类。
 * 职责：封装权限树分组、权限编码转换、风险等级判断、勾选计算与提交。
 */
export default class HGRolePermissionVM {
  /** 按后端游标读取角色；每次最多 100 条，由页面显式加载后续页。 */
  static fetchRoles = (cursor = "0") => HGNet.get(HGMANAGER_API.IAM_ROLE_LIST, { cursor, pageSize: 100 });

  /** 获取权威权限目录和指定角色当前已生效权限，两个字段必须完整返回。 */
  static fetchRolePermissions = (roleId) => HGNet.get(HGMANAGER_API.IAM_PERMISSION_LIST, { roleId });

  /** 将后端目录合并到展示树；不允许 mock 中不存在于服务端的编码进入可提交集合。 */
  static buildCatalogTree = (items) => {
    if (!Array.isArray(items)) throw new Error("权限目录格式无效");
    const catalog = new Map();
    items.forEach((item) => {
      if (typeof item?.code !== "string" || !/^[a-z][a-z0-9_]*:[a-z][a-z0-9_]*:[a-z][a-z0-9_]*$/.test(item.code) || catalog.has(item.code)) {
        throw new Error("权限目录包含无效编码");
      }
      catalog.set(item.code, item.description || item.code);
    });
    const matched = new Set();
    const tree = MOCK_PERMISSION_TREE.map((domain) => ({
      ...domain,
      children: domain.children.map((resource) => ({
        ...resource,
        children: resource.children.filter((item) => {
          const code = HGRolePermissionVM.toPermissionCode(item.value);
          if (!catalog.has(code)) return false;
          matched.add(code);
          return true;
        }).map((item) => ({ ...item, value: HGRolePermissionVM.toPermissionCode(item.value) })),
      })).filter((resource) => resource.children.length > 0),
    })).filter((domain) => domain.children.length > 0);

    // 新权限由后端登记后即可展示；不依赖前端版本发布才能被看到。
    catalog.forEach((description, code) => {
      if (matched.has(code)) return;
      const [domainCode, resourceCode] = code.split(":");
      const domainValue = domainCode === "iam" || domainCode === "user" ? "perm_system" : `catalog_${domainCode}`;
      let domain = tree.find((node) => node.value === domainValue);
      if (!domain) {
        domain = { title: domainCode.toUpperCase(), value: domainValue, children: [] };
        tree.push(domain);
      }
      const resourceValue = domainValue === "perm_system" && domainCode === "user"
        ? "perm_system_user"
        : domainValue === "perm_system" && resourceCode === "role"
          ? "perm_system_role"
          : `catalog_${domainCode}_${resourceCode}`;
      let resource = domain.children.find((node) => node.value === resourceValue);
      if (!resource) {
        resource = { title: resourceCode, value: resourceValue, children: [] };
        domain.children.push(resource);
      }
      resource.children.push({ title: description, value: code });
    });
    return tree;
  };
  /**
   * 将权限树转换为「业务域 → 资源 → 权限项」三层分组结构。
   * @param {Array} tree 原始权限树。
   * @returns {Array} 分组结构数组。
   */
  static buildPermissionGroups = (tree = []) => {
    return tree.map((domain) => ({
      key: String(domain.value),
      title: domain.title,
      children: (domain.children || []).map((resource) => ({
        key: String(resource.value),
        title: resource.title,
        items: (resource.children || []).map((item) => ({
          key: String(item.value),
          title: item.title,
          code: HGRolePermissionVM.toPermissionCode(item.value),
          risk: HGRolePermissionVM.getRiskLevel(item.value),
        })),
      })),
    }));
  };

  /**
   * 将旧展示值转换为权限编码；后端三段编码原样保留。
   * @param {string} value 权限值，如 perm_ops_metrics_read 或 iam:role:read。
   * @returns {string} 权限编码。
   */
  static toPermissionCode = (value) => {
    if (String(value || "").includes(":")) return String(value);
    return String(value || "")
      .replace(/^perm_/, "")
      .split("_")
      .filter(Boolean)
      .join(":");
  };

  /**
   * 判断权限风险等级。
   * @param {string} value 权限值。
   * @returns {{level: string, label: string, tone: string}} 风险等级信息。
   */
  static getRiskLevel = (value) => {
    const code = HGRolePermissionVM.toPermissionCode(value);
    const matched = RISK_RULES.find((rule) =>
      rule.keywords.some((keyword) => code === keyword || code.split(":").includes(keyword))
    );
    if (matched) {
      return { level: matched.level, label: matched.label, tone: matched.tone };
    }
    return { level: "low", label: "低", tone: "neutral" };
  };

  /**
   * 收集权限树中的全部叶子权限值。
   * @param {Array} tree 原始权限树。
   * @returns {Array<string>} 叶子权限值数组。
   */
  static collectLeafValues = (tree = MOCK_PERMISSION_TREE) => {
    const result = [];
    tree.forEach((domain) => {
      (domain.children || []).forEach((resource) => {
        (resource.children || []).forEach((item) => {
          result.push(String(item.value));
        });
      });
    });
    return result;
  };

  /**
   * 展开父节点勾选值：后端可能返回父级权限，需展开为其下所有叶子权限。
   * @param {Array} tree 原始权限树。
   * @param {Array<string>} values 已选权限值（可能包含父节点）。
   * @returns {Array<string>} 只含叶子权限的数组。
   */
  static normalizeSelectedValues = (tree = MOCK_PERMISSION_TREE, values = []) => {
    const normalized = new Set();
    const visit = (node, covered) => {
      const isCovered = covered || values.includes(String(node.value));
      if (node.children && node.children.length > 0) {
        node.children.forEach((child) => visit(child, isCovered));
        return;
      }
      if (isCovered) {
        normalized.add(String(node.value));
      }
    };
    tree.forEach((node) => visit(node, false));
    return Array.from(normalized);
  };

  /**
   * 统计某个权限分组下已选中的权限数量。
   * @param {Object} group 分组节点（业务域）。
   * @param {Array<string>} selectedValues 已选权限值。
   * @returns {number} 已选数量。
   */
  static countGroupSelected = (group, selectedValues = []) => {
    return (group.children || []).reduce((total, resource) => {
      return (
        total +
        (resource.items || []).filter((item) => selectedValues.includes(item.key))
          .length
      );
    }, 0);
  };

  /**
   * 统计某个权限分组下的权限总数。
   * @param {Object} group 分组节点（业务域）。
   * @returns {number} 权限总数。
   */
  static countGroupTotal = (group) => {
    return (group.children || []).reduce(
      (total, resource) => total + (resource.items || []).length,
      0
    );
  };

  /**
   * 判断某个权限分组是否已全选。
   * @param {Object} group 分组节点（业务域）。
   * @param {Array<string>} selectedValues 已选权限值。
   * @returns {boolean} 是否全选。
   */
  static isGroupAllSelected = (group, selectedValues = []) => {
    const total = HGRolePermissionVM.countGroupTotal(group);
    return total > 0 && HGRolePermissionVM.countGroupSelected(group, selectedValues) === total;
  };

  /**
   * 统计已选权限中的高风险数量，用于顶部风险提示。
   * @param {Array<string>} selectedValues 已选权限值。
   * @returns {{high: number, total: number}} 高风险数量与已选总数。
   */
  static countRisk = (selectedValues = []) => {
    return selectedValues.reduce(
      (acc, value) => {
        const risk = HGRolePermissionVM.getRiskLevel(value);
        const next = { ...acc, total: acc.total + 1 };
        if (risk.level === "critical" || risk.level === "high") {
          next.high = acc.high + 1;
        }
        return next;
      },
      { high: 0, total: 0 }
    );
  };

  /**
   * 角色标识徽标底色：按角色 ID 哈希取固定色，保证视觉稳定。
   * @param {string} roleId 角色 ID。
   * @returns {string} 十六进制颜色值。
   */
  static getRoleBadgeColor = (roleId) => {
    const palette = [
      "#3370ff",
      "#00b42a",
      "#ff7d00",
      "#722ed1",
      "#14c0cc",
      "#f53f3f",
      "#f7ba1e",
      "#f77eb9",
    ];
    const text = String(roleId || "");
    let hash = 0;
    for (let i = 0; i < text.length; i += 1) {
      hash = (hash * 31 + text.charCodeAt(i)) % 100000;
    }
    return palette[hash % palette.length];
  };

  /**
   * 将页面值转换为后端审批申请协议，MFA 仅用于本次请求。
   * @param {Object} values 页面收集的值 {roleId, permissionValues}。
   * @returns {Object} 提交到后端的数据结构。
   */
  static transformSubmitData = (values = {}) => ({
    roleId: values.roleId,
    permissions: values.permissionValues || [],
    mfaCode: values.mfaCode || "",
  });

  /**
   * 向后端申请角色权限全量替换，返回 pending 而非已生效结果。
   * @param {Object} data 提交数据。
   * @returns {Promise<Object>} 审批申请结果。
   */
  static submitRolePermission = (data) => HGNet.post(HGMANAGER_API.IAM_ROLE_PERMISSIONS, data);
}
