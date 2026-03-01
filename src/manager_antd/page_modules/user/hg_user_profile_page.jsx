/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-30 21:08:37
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-03-01 22:25:27
 * @FilePath: /MLC_React/src/manager_antd/user/hg_user_profile_page.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE

 *   HGUserProfilePage → HGUpdateUserProfilePage 页面传参（class 组件）
*/
import { Button, Card, message, Space, Table } from "antd";
import Input from "antd/es/input/Input";
import React from "react";
import { LogOut } from "../../../logger/hg_logger";
import { WithNavigation } from "../../router/hg_naviagion_hook";
import styles from "./hg_user_profile.module.css";
import HGUserVM from "./hg_user_vm";
const { Search } = Input;

class HGUserProfilePage extends React.Component {
  constructor(props) {
    super(props);

    this.state = {
      data: [],
      loading: false,
      keyword: "",
      pagination: {
        current: 1,
        pageSize: 10,
        total: 0,
      },
      count: 0,
      refreshed: false,
    };
  }

  componentDidMount() {
    const { pagination } = this.state;
    this.fetchUsers(pagination.current, pagination.pageSize);
  }

  /**
   * 模拟服务端分页
   */
  fetchUsers = (pageNum, pageSize) => {
    this.setState({ loading: true });

    HGUserVM.requestUserInfoDataList({
      pageSize: pageSize,
      pageNum: pageNum,
    })
      .then((res) => {
        console.log("获取用户列表成功", res);
        // ALL_USERS = res.result;
        this.setState({
          data: res.result,
          result: res?.result ?? [],
          total: res?.total ?? 0,
          pagination: {
            current: res.pageIndex,
            pageSize,
            total: res.total,
          },
        });
      })
      .catch((err) => {
        // console.error("获取用户列表失败", err);
        message.error("Failed to fetch user data");
      })
      .finally(() => {
        this.setState({ loading: false });
      });

    /*setTimeout(() => {
      let filtered = ALL_USERS;

      if (keyword) {
        filtered = ALL_USERS.filter(
          (item) =>
            item.user_name.includes(keyword) ||
            item.email.includes(keyword) ||
            item.phone.includes(keyword)
        );
      }

      const start = (page - 1) * pageSize;
      const end = start + pageSize;

      this.setState({
        data: filtered.slice(start, end),
        loading: false,
        pagination: {
          current: page,
          pageSize,
          total: filtered.length,
        },
      });
    }, 500);
    */
  };

  /**
   * 表格分页变化
   */
  handleTableChange = (paginationInfo) => {
    const { keyword } = this.state;
    this.fetchUsers({
      pageSize: paginationInfo.current,
      pageNum: paginationInfo.pageSize,
      keyword,
    });
  };

  /**
   * 搜索
   */
  handleSearch = (value) => {
    this.setState({ keyword: value });
    this.fetchUsers(1, this.state.pagination.pageSize, value);
  };

  render() {
    const { data, loading, pagination } = this.state;
    LogOut("🍎 用户列表数据：", data);
    return (
      <div className={styles.container}>
        <Card
          title="用户列表"
          extra={
            <Space>
              <Search
                placeholder="Search by name/email/phone"
                allowClear
                onSearch={this.handleSearch}
                style={{ width: 250 }}
              />
              <Button
                type="primary"
                onClick={() => message.info("Add user clicked")}
              >
                Add User
              </Button>
            </Space>
          }
        >
          <Table
            rowKey={(record) => record.userID}
            columns={this.userTableColumns()}
            dataSource={data}
            loading={loading}
            pagination={{
              ...pagination,
              showSizeChanger: true,
              showQuickJumper: true,
            }}
            onChange={this.handleTableChange}
          />
        </Card>
      </div>
    );
  }

  userTableColumns = () => {
    return [
      {
        title: "用户ID",
        dataIndex: "userID",
        width: 180,
        render: (text, record) => {
          return <span>{text}</span>;
        },
      },
      {
        title: "用户名",
        dataIndex: "userName",
        width: 80,
        render: (text, record) => {
          return <span>{text ?? "-.-"}</span>;
        },
      },
      {
        title: "手机号",
        dataIndex: "phone",
        width: 80,
        render: (text, record) => {
          return <span>{text ?? "-.-"}</span>;
        },
      },
      {
        title: "📮邮箱",
        dataIndex: "email",
        width: 80,
        render: (text, record) => {
          return <span>{text ?? "-.-"}</span>;
        },
      },
      {
        title: "手机号",
        dataIndex: "phone",
      },
      {
        title: "Password签名值✍️",
        dataIndex: "passwordHash",
        width: 180,
        render: (text, record) => {
          return <span>{text ?? "-.-"}</span>;
        },
      },
      {
        title: "Salt",
        dataIndex: "salt",
        width: 80,
        render: () => "******",
      },
      {
        title: "创建时间",
        dataIndex: "created_at",
        width: 80,
        render: (text, record) => {
          return <span>{text ?? "-.-"}</span>;
        },
      },
      {
        title: "更新时间",
        dataIndex: "updated_at",
        width: 80,
        render: (text, record) => {
          return <span>{text ?? "-.-"}</span>;
        },
      },
    ];
  };
}

export default WithNavigation(HGUserProfilePage);

/* 参数传递调用方法测试
  componentDidUpdate(prevProps) {
    const prevState = prevProps.location.state;
    const currentState = this.props.location.state;
    console.log(
      "🍎 用户信息页 fromB:",
      currentState?.fromB,
      "preState:",
      prevState
    );
    // 👇 监听 HGUpdateUserProfilePage 回传的数据
    if (currentState?.fromB && prevState !== currentState) {
      this.setState({
        refreshed: true,
        count: currentState.newCount,
      });
    }
  }

  goToUpdateUserProfilePage = () => {
    this.props.navigate(ROUTE_PATH.HOME, {
      state: {
        from: "HGUserProfilePage",
        count: this.state.count,
      },
    });
  };

  render() {
    return (
      <div className={CSStyles.page}>
        <h2>Page HGUserProfilePage</h2>
        <p>count: {this.state.count}</p>
        <p>refreshed: {String(this.state.refreshed)}</p>
        <button onClick={this.goToUpdateUserProfilePage}>
          去 Page HGUpdateUserProfilePage
        </button>
      </div>
    );
  }
*/
