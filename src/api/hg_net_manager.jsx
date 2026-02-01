import NetManager from "./HttpManagerV1";

class HGNetManager {
  constructor(baseURL = "http://localhost:8080") {
    this.baseURL = baseURL;
  }

  /**
   * 拼接完整 URL
   * @param {string} path - 接口路径，如 "/api/user/login"
   */
  getFullURL(path) {
    // 避免重复斜杠
    if (path.startsWith("/")) {
      return `${this.baseURL}${path}`;
    } else {
      return `${this.baseURL}/${path}`;
    }
  }

  /**
   * GET 请求
   * @param {string} path - 接口相对路径
   * @param {Object} options - 额外配置
   */
  get(path, params = {}) {
    /*
    query = new URLSearchParams({
      phone: "17681317668",
      code: "1234",
    }).toString();
  
    query结果为： "phone=17681317668&code=1234"
    */
    const query = new URLSearchParams(params).toString();
    const url = query
      ? `${this.getFullURL(path)}?${query}`
      : this.getFullURL(path);
    return NetManager.getWithURL(url);
  }

  /**
   * POST 请求
   * @param {string} path - 接口相对路径
   * @param {Object} body - 请求体
   * @param {Object} options - 额外配置
   */
  post(path, body, options = {}) {
    const url = this.getFullURL(path);
    return NetManager.postWithURL(url, body, options);
  }

  /**
   * PUT 请求
   * @param {string} path
   * @param {Object} body
   * @param {Object} options
   */
  put(path, body, options = {}) {
    const url = this.getFullURL(path);
    return NetManager.putWithURL(url, body, options);
  }

  /**
   * DELETE 请求
   * @param {string} path
   * @param {Object} options
   */
  delete(path, options = {}) {
    const url = this.getFullURL(path);
    return NetManager.deleteWithURL(url, options);
  }
}

export default HGNetManager;

/**
 *
 
HGNet.get('/api/user/list', {
  params: {
    page: 1,
    pageSize: 10
  },
  headers: {
    Authorization: `Bearer ${localStorage.getItem('token')}`
  }
});


很好，这里我**完全照你刚才的 GET 用法风格**，把 **POST / PUT / DELETE** 的 `options` 用法 **逐一、对称、工程化**地给你列出来。
你可以直接照抄用，不是伪代码。

> 统一约定（和你现在一致）

```js
options = {
  params: {},   // URL query（主要给 GET / DELETE 用）
  headers: {},  // 请求头
}
```

---

## 一、POST：`post(path, body, options = {})`

### 场景 1：登录（最常见）

```js
HGNet.post(
  '/api/login',
  {
    username: 'admin',
    password: '123456'
  },
  {
    headers: {
      'Content-Type': 'application/json'
    }
  }
)
.then(res => {
  console.log('登录成功', res);
});
```

---

### 场景 2：POST + params + headers（真实项目）

```js
HGNet.post(
  '/api/user/create',
  {
    name: 'Tom',
    age: 18
  },
  {
    params: {
      inviteCode: 'ABC123'
    },
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`
    }
  }
);
```

👉 实际请求效果：

```
POST http://localhost:8080/api/user/create?inviteCode=ABC123
```

---

## 二、PUT：`put(path, body, options = {})`

### 场景：更新用户信息

```js
HGNet.put(
  '/api/profile',
  {
    nickname: 'Harley',
    avatar: 'https://xxx.com/a.png'
  },
  {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`
    }
  }
)
.then(res => {
  console.log('更新成功', res);
});
```

---

### PUT + params（有些后端会这样设计）

```js
HGNet.put(
  '/api/order',
  {
    status: 'CANCEL'
  },
  {
    params: {
      orderId: 10001
    },
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`
    }
  }
);
```

👉 实际请求：

```
PUT /api/order?orderId=10001
```

---

## 三、DELETE：`delete(path, options = {})`

### 场景 1：REST 风格（最推荐）

```js
HGNet.delete(
  '/api/order/10001',
  {
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`
    }
  }
)
.then(() => {
  console.log('删除成功');
});
```

---

### 场景 2：DELETE + params（后端不是 REST 风格时）

```js
HGNet.delete(
  '/api/order',
  {
    params: {
      id: 10001
    },
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`
    }
  }
);
```

👉 实际请求：

```
DELETE /api/order?id=10001
```

---

## 四、四种方法的最终统一用法（记住这个就够）

```js
// GET
HGNet.get(path, { params, headers });

// POST
HGNet.post(path, body, { params, headers });

// PUT
HGNet.put(path, body, { params, headers });

// DELETE
HGNet.delete(path, { params, headers });
```

---

## 五、一个完整 React 示例（真实工程写法）

```jsx
HGNet.post(
  '/api/comment',
  { content: '写得很好' },
  {
    params: { articleId: 88 },
    headers: {
      Authorization: `Bearer ${localStorage.getItem('token')}`
    }
  }
)
.then(res => {
  console.log('评论成功', res);
});
```





*/
