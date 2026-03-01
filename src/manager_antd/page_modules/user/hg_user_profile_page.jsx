/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-30 21:08:37
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-02-07 17:28:13
 * @FilePath: /MLC_React/src/manager_antd/user/hg_user_profile_page.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE

 *   HGUserProfilePage → HGUpdateUserProfilePage 页面传参（class 组件）
*/
import { Button, Card, message, Space, Table } from "antd";
import Input from "antd/es/input/Input";
import React from "react";
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
  fetchUsers = (page, pageSize, keyword = "") => {
    this.setState({ loading: true });

    HGUserVM.requestUserInfoDataList({pageSize:pageSize, page:page}).then((res) => {
      console.log("获取用户列表成功", res);
      ALL_USERS = res.result;
    }); 

    setTimeout(() => {
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
  };

  /**
   * 表格分页变化
   */
  handleTableChange = (paginationInfo) => {
    const { keyword } = this.state;
    this.fetchUsers(paginationInfo.current, paginationInfo.pageSize, keyword);
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

    const columns = [
      {
        title: "ID",
        dataIndex: "id",
        width: 80,
      },
      {
        title: "User ID",
        dataIndex: "user_id",
      },
      {
        title: "User Name",
        dataIndex: "user_name",
      },
      {
        title: "Email",
        dataIndex: "email",
      },
      {
        title: "Phone",
        dataIndex: "phone",
      },
      {
        title: "Password Hash",
        dataIndex: "password_hash",
        render: () => "******",
      },
      {
        title: "Salt",
        dataIndex: "salt",
        render: () => "******",
      },
      {
        title: "Created At",
        dataIndex: "created_at",
      },
      {
        title: "Updated At",
        dataIndex: "updated_at",
      },
    ];

    return (
      <div className={styles.container}>
        <Card
          title="User Profile List"
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
            rowKey="id"
            columns={columns}
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
