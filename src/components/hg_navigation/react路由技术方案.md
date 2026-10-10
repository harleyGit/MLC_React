核心目标是：

```text
业务页面
   ↓
PageNavigator.open()
   ↓
页面注册中心 PageRegistry
   ↓
Router
   ↓
目标 Page
   ↓
params
   ↓
业务处理
   ↓
result / callback
   ↓
原页面
```

下面给出一套可以直接放进生产 React 工程的方案。

---

# 1. 最终 API

业务代码最终只使用：

```js
this.props.pageNavigator.open({
  page: PAGE.WALLET_RECHARGE,

  params: {
    source: 'wallet',
    skuId: '10001',
  },

  onSuccess: this.handleRechargeSuccess,

  onCancel: this.handleRechargeCancel,

  onError: this.handleRechargeError,
});
```

目标页面：

```js
this.props.pageNavigation.finishSuccess({
  orderId: 'ORDER123',
});
```

或者：

```js
this.props.pageNavigation.finishCancel();
```

这样形成：

```text
WalletPage
   │
   │ open()
   ▼
WalletRechargePage
   │
   │ finishSuccess()
   ▼
WalletPage.onSuccess()
```

---

# 2. 推荐目录

建议：

```text
src/
├── navigation/
│   ├── PageNavigator.js
│   ├── PageRegistry.js
│   ├── NavigationContext.js
│   ├── NavigationProvider.js
│   ├── navigationConstants.js
│   └── index.js
│
│
└── routes/
    └── routePath.js
```

职责非常明确：

| 文件 | 职责 |
|---|---|
| `PageNavigator` | 对外提供页面跳转 API |
| `PageRegistry` | page → route/component |
| `NavigationContext` | 页面接收导航参数和 callback |
| `NavigationProvider` | 注入导航能力 |
| `navigationConstants` | 导航动作/结果定义 |
| `navigation.js` | 某个页面自己的参数、结果契约 |

---

# 3. PageRegistry

不要让业务代码同时传：

```js
route
component
```

否则容易出现：

```js
route: '/wallet/recharge',
component: OtherPage
```

这种配置错误。

所以生产环境建议：

> **业务代码只传 `page`，路由和组件由 Registry 管理。**

### `PageRegistry.js`

```js
import WalletPage from '@/pages/wallet/WalletPage';
import WalletRechargePage from '@/pages/wallet/WalletRechargePage';
import OrderDetailPage from '@/pages/order/OrderDetailPage';

export const PAGE = Object.freeze({
  WALLET: 'wallet',
  WALLET_RECHARGE: 'wallet.recharge',
  ORDER_DETAIL: 'order.detail',
});

const PAGE_REGISTRY = Object.freeze({
  [PAGE.WALLET]: {
    route: '/wallet',
    component: WalletPage,
  },

  [PAGE.WALLET_RECHARGE]: {
    route: '/wallet/recharge',
    component: WalletRechargePage,
  },

  [PAGE.ORDER_DETAIL]: {
    route: '/order/detail',
    component: OrderDetailPage,
  },
});

export const getPageConfig = (page) => {
  const config = PAGE_REGISTRY[page];

  if (!config) {
    throw new Error(`Unknown page: ${page}`);
  }

  return config;
};
```

这里 `PAGE` 就相当于工程自己的：

```text
页面枚举
```

以后不要到处写：

```js
'/wallet/recharge'
```

而是：

```js
PAGE.WALLET_RECHARGE
```

---

# 4. NavigationContext

这里是整个设计的关键。

目标页面需要知道：

```text
我是谁
谁打开我的
传了什么参数
成功后通知谁
取消后通知谁
怎么关闭自己
```

因此定义：

### `NavigationContext.js`

```js
import React, { createContext, useContext } from 'react';

const NavigationContext = createContext(null);

export const NavigationProvider = ({
  children,
  value,
}) => {
  return (
    <NavigationContext.Provider value={value}>
      {children}
    </NavigationContext.Provider>
  );
};

export const usePageNavigation = () => {
  const context = useContext(NavigationContext);

  if (!context) {
    throw new Error(
      'usePageNavigation must be used inside NavigationProvider'
    );
  }

  return context;
};

export default NavigationContext;
```

---

# 5. PageNavigator

这是业务页面真正使用的 API。

### `PageNavigator.js`

```js
import React from 'react';
import { getPageConfig } from './PageRegistry';
import { NavigationProvider } from './NavigationContext';

class PageNavigator {
  constructor(router) {
    this.router = router;
  }

  open = ({
    page,
    params = {},
    onSuccess,
    onCancel,
    onError,
  }) => {
    const config = getPageConfig(page);

    const navigation = {
      page,
      params,

      success: (result) => {
        onSuccess?.(result);
      },

      cancel: (result) => {
        onCancel?.(result);
      },

      error: (error) => {
        onError?.(error);
      },

      back: () => {
        this.router.back();
      },
    };

    this.router.push({
      path: config.route,

      render: () => (
        <NavigationProvider value={navigation}>
          <config.component />
        </NavigationProvider>
      ),
    });
  };

  back = () => {
    this.router.back();
  };
}

export default PageNavigator;
```

这里的 `router.push()` 是一个抽象示意。

**生产工程中不要强绑定某一个 Router API。**

可以进一步抽象 RouterAdapter。

---

# 6. RouterAdapter

这是为了防止未来换 Router。

例如：

```text
PageNavigator
      ↓
RouterAdapter
      ↓
React Router
```

而不是：

```text
PageNavigator
      ↓
React Router API
```

### `RouterAdapter.js`

```js
class RouterAdapter {
  constructor(router) {
    this.router = router;
  }

  push = (route, state) => {
    this.router.navigate(route, {
      state,
    });
  };

  back = () => {
    this.router.back();
  };
}

export default RouterAdapter;
```

于是：

```text
业务
 ↓
PageNavigator
 ↓
RouterAdapter
 ↓
React Router
```

未来如果改成其他 Router，只需要修改：

```text
RouterAdapter
```

---

# 7. 一个更适合生产的版本

上面的 callback 直接存在 navigation 对象里还有一个问题：

```js
onSuccess
onCancel
onError
```

属于**内存对象**。

所以我建议实际生产版本把导航拆成两层：

```text
URL
+
Navigation Session
```

例如：

```text
URL

/wallet/recharge?source=wallet&skuId=10001
```

同时内存中：

```js
NavigationSession {
  sessionId,
  onSuccess,
  onCancel,
  onError
}
```

这样可以避免把 callback 塞进 URL。

---

# 8. NavigationSessionManager

### `NavigationSessionManager.js`

```js
class NavigationSessionManager {
  sessions = new Map();

  create = ({
    onSuccess,
    onCancel,
    onError,
  }) => {
    const sessionId = crypto.randomUUID();

    this.sessions.set(sessionId, {
      onSuccess,
      onCancel,
      onError,
    });

    return sessionId;
  };

  get = (sessionId) => {
    return this.sessions.get(sessionId);
  };

  remove = (sessionId) => {
    this.sessions.delete(sessionId);
  };

  success = (sessionId, result) => {
    const session = this.sessions.get(sessionId);

    session?.onSuccess?.(result);

    this.remove(sessionId);
  };

  cancel = (sessionId, result) => {
    const session = this.sessions.get(sessionId);

    session?.onCancel?.(result);

    this.remove(sessionId);
  };

  error = (sessionId, error) => {
    const session = this.sessions.get(sessionId);

    session?.onError?.(error);

    this.remove(sessionId);
  };
}

export default NavigationSessionManager;
```

---

# 9. PageNavigator 最终版

推荐生产工程采用这个模式。

```js
import { getPageConfig } from './PageRegistry';
import NavigationSessionManager from './NavigationSessionManager';

class PageNavigator {
  constructor(router) {
    this.router = router;
    this.sessions = new NavigationSessionManager();
  }

  open = ({
    page,
    params = {},
    onSuccess,
    onCancel,
    onError,
  }) => {
    const config = getPageConfig(page);

    const sessionId = this.sessions.create({
      onSuccess,
      onCancel,
      onError,
    });

    const searchParams = new URLSearchParams({
      ...params,
      __navigationSessionId: sessionId,
    });

    this.router.push(
      `${config.route}?${searchParams.toString()}`
    );
  };

  success = (sessionId, result) => {
    this.sessions.success(sessionId, result);

    this.router.back();
  };

  cancel = (sessionId, result) => {
    this.sessions.cancel(sessionId, result);

    this.router.back();
  };

  error = (sessionId, error) => {
    this.sessions.error(sessionId, error);
  };

  back = () => {
    this.router.back();
  };
}

export default PageNavigator;
```

---

# 10. 目标页面如何获取参数

目标页面不要直接研究 Router。

例如：

```js
class WalletRechargePage extends React.Component {
  render() {
    const {
      params,
      navigation,
    } = this.props;

    return (
      <RechargePanel
        skuId={params.skuId}
        source={params.source}
        onSuccess={this.handleSuccess}
      />
    );
  }
}
```

但是更推荐统一封装成：

```js
const navigation = usePageNavigation();
```

类组件可以通过 HOC：

```js
const withPageNavigation = (Component) => {
  return (props) => (
    <NavigationContext.Consumer>
      {(navigation) => (
        <Component
          {...props}
          pageNavigation={navigation}
        />
      )}
    </NavigationContext.Consumer>
  );
};
```

然后：

```js
export default withPageNavigation(
  WalletRechargePage
);
```

---

# 11. 目标页面最终写法

类组件：

```js
class WalletRechargePage extends React.Component {

  handleSuccess = (order) => {
    this.props.pageNavigation.success({
      orderId: order.orderId,
      amount: order.amount,
    });
  };

  handleCancel = () => {
    this.props.pageNavigation.cancel();
  };

  render() {
    const {
      params,
    } = this.props.pageNavigation;

    return (
      <RechargePanel
        skuId={params.skuId}
        source={params.source}
        onSuccess={this.handleSuccess}
        onCancel={this.handleCancel}
      />
    );
  }
}
```

---

# 12. 原页面

例如钱包：

```js
class WalletPage extends React.Component {

  handleRecharge = () => {
    this.props.pageNavigator.open({
      page: PAGE.WALLET_RECHARGE,

      params: {
        source: 'wallet',
        skuId: '10001',
      },

      onSuccess: this.handleRechargeSuccess,

      onCancel: this.handleRechargeCancel,

      onError: this.handleRechargeError,
    });
  };

  handleRechargeSuccess = (result) => {
    console.log('充值成功', result);

    this.refreshWallet();
  };

  handleRechargeCancel = () => {
    console.log('用户取消充值');
  };

  handleRechargeError = (error) => {
    console.error(error);
  };
}
```

业务代码非常干净。

---

# 13. 参数和 Result 必须定义契约

复杂工程一定不要随便传：

```js
params: {
  xxx: xxx,
  aaa: aaa,
  foo: foo,
}
```

建议每个页面定义：

```text
navigation.js
```

例如：

```js
export const WALLET_RECHARGE_PARAMS = {
  source: 'string',
  skuId: 'string',
};

export const WALLET_RECHARGE_RESULT = {
  orderId: 'string',
  amount: 'number',
};
```

更进一步可以使用 PropTypes / Zod 等进行运行时校验。

如果你的工程目前是 JavaScript，我建议：

```text
第一阶段：约定 + JSDoc
第二阶段：Zod
第三阶段：如果未来迁移 TS，再做静态类型
```

不要为了导航系统强行引入 TypeScript。

---

# 14. 推荐使用 JSDoc

例如：

```js
/**
 * @typedef {Object} WalletRechargeParams
 * @property {string} source
 * @property {string} skuId
 */

/**
 * @typedef {Object} WalletRechargeResult
 * @property {string} orderId
 * @property {number} amount
 */
```

然后：

```js
/**
 * @param {{
 *   page: string,
 *   params: WalletRechargeParams,
 *   onSuccess?: (result: WalletRechargeResult) => void,
 *   onCancel?: () => void,
 *   onError?: (error: Error) => void,
 * }} options
 */
open(options) {}
```

这样 VS Code 就能提供参数提示。

---

# 15. 不建议让 PageNavigator 承担业务逻辑

这是架构边界，非常重要。

不要：

```js
PageNavigator.openRecharge()
PageNavigator.openOrder()
PageNavigator.openPayment()
PageNavigator.openLogin()
```

这样最后会变成：

```text
PageNavigator
   ↓
1000 行业务代码
```

应该保持：

```js
pageNavigator.open({
  page: PAGE.WALLET_RECHARGE,
  params,
  callbacks,
});
```

Navigator 只负责：

```text
导航
参数
Session
生命周期
返回结果
```

而：

```text
充值
支付
订单
登录
```

全部属于业务 Page。

---

# 16. 页面之间不要直接互相调用

不推荐：

```js
WalletPage
   ↓
WalletRechargePage.someMethod()
```

也不推荐：

```js
WalletRechargePage
   ↓
WalletPage.refreshWallet()
```

应该：

```text
WalletPage
     │
     │ open
     ▼
WalletRechargePage
     │
     │ result
     ▼
WalletPage
     │
     └── refreshWallet()
```

即：

> **父页面负责业务决策，子页面只负责返回结果。**

这是整个设计能够长期维护的关键。

---

# 17. 最终完整调用关系

```text
┌──────────────────────────┐
│       WalletPage         │
│                          │
│ pageNavigator.open()     │
└────────────┬─────────────┘
             │
             │ PAGE.WALLET_RECHARGE
             │ params
             │ callbacks
             ▼
┌──────────────────────────┐
│      PageNavigator       │
│                          │
│  1. 查询 PageRegistry    │
│  2. 创建 Session         │
│  3. 生成 URL              │
│  4. Router.push()        │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│  WalletRechargePage      │
│                          │
│ params                   │
│ pageNavigation.success() │
│ pageNavigation.cancel()  │
└────────────┬─────────────┘
             │
             │ result
             ▼
┌──────────────────────────┐
│     NavigationSession    │
│                          │
│ onSuccess(result)        │
└────────────┬─────────────┘
             │
             ▼
┌──────────────────────────┐
│       WalletPage         │
│                          │
│ refreshWallet()          │
└──────────────────────────┘
```

---

# 18. 最终 API 建议

我建议你的工程最终只暴露这几个 API：

```js
pageNavigator.open()
pageNavigator.back()

pageNavigation.success()
pageNavigation.cancel()
pageNavigation.error()
```

业务代码：

```js
this.props.pageNavigator.open({
  page: PAGE.WALLET_RECHARGE,

  params: {
    source: 'wallet',
    skuId: '10001',
  },

  onSuccess: (result) => {
    this.refreshWallet(result);
  },
});
```

目标页面：

```js
this.props.pageNavigation.success({
  orderId: order.id,
});
```

---

## 19. 生产级方案的几个硬规则

建议直接写进工程规范：

### Rule 1：业务代码禁止直接使用 route

```js
// ❌
navigate('/wallet/recharge');

// ✅
pageNavigator.open({
  page: PAGE.WALLET_RECHARGE,
});
```

### Rule 2：页面必须通过 Registry 注册

```js
PAGE.WALLET_RECHARGE
    ↓
PageRegistry
    ↓
route + component
```

### Rule 3：URL 只保存可序列化参数

```text
string
number
boolean
JSON
```

不要放：

```text
function
class instance
DOM
React component
```

### Rule 4：callback 只能存在 NavigationSession

```text
URL ≠ callback
```

### Rule 5：子页面通过 Result 返回结果

```text
子页面 → result → 父页面
```

而不是直接操作父页面。

### Rule 6：Navigator 不包含业务逻辑

```text
Navigator = Infrastructure
Page = Business
```

### Rule 7：页面输入输出必须有契约

```text
PageParams
PageResult
```

---

## 20. 我最推荐的最终架构

如果这是一个**中大型 React 老工程逐步治理**，我会采用：

```text
                    ┌─────────────────┐
                    │  PageRegistry   │
                    │ page → route    │
                    │       component │
                    └────────┬────────┘
                             │
                             ▼
┌────────────┐       ┌─────────────────┐
│ Business   │ open  │ PageNavigator   │
│ Page       ├──────►│                 │
└─────▲──────┘       │ SessionManager  │
      │               └────────┬────────┘
      │                        │
      │ result                 │ Router
      │                        ▼
      │               ┌─────────────────┐
      │               │ Target Page     │
      │               │                 │
      └───────────────┤ params          │
                      │ navigation      │
                      └─────────────────┘
```

这套方案的核心不是“把 `navigate()` 换个名字”，而是建立一个**页面间通信协议**：

```text
Page
 ├── Input：params
 ├── Lifecycle：open / cancel / error
 └── Output：result
```

这样以后你的**充值、支付、订单、商品选择、地址选择、登录授权、WebView、复杂表单**都可以统一处理，而且类组件、函数组件都能使用同一套导航协议。