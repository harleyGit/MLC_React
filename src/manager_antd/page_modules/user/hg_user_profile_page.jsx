/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-30 21:08:37
 * @LastEditors: Harley harelysoa@qq.com
 * @LastEditTime: 2026-04-18 00:33:56
 * @FilePath: /MLC_React/src/manager_antd/user/hg_user_profile_page.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE

 *   HGUserProfilePage → HGUpdateUserProfilePage 页面传参（class 组件）
*/
import { Button, Card, message, Space, Table } from "antd";
import Input from "antd/es/input/Input";
import React from "react";
import { LogOut } from "../../../logger/hg_logger";
import HGLoading from "../../components/hg_loading";
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
      // cursor 分页映射：pageNum -> cursor
      cursorByPage: {
        1: 0,
      },
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
   * 拉取用户列表（cursor 分页）
   */
  fetchUsers = (pageNum, pageSize, keyword = "") => {
    this.setState({ loading: true });

    const { cursorByPage } = this.state;
    const currentCursor = Number(cursorByPage[pageNum] ?? 0);

    HGUserVM.requestUserInfoDataList({
      pageSize,
      pageNum,
      keyword,
      cursor: currentCursor,
    })
      .then((res) => {
        console.log("获取用户列表成功", res);

        this.setState((prevState) => {
          const nextCursorByPage = { ...prevState.cursorByPage };

          if (res?.hasMore && Number(res?.nextCursor) > 0) {
            nextCursorByPage[pageNum + 1] = Number(res.nextCursor);
          }

          return {
            data: res?.result ?? [],
            pagination: {
              current: pageNum,
              pageSize,
              total: res?.total ?? 0,
            },
            cursorByPage: nextCursorByPage,
          };
        });
      })
      .catch(() => {
        message.error("Failed to fetch user data");
      })
      .finally(() => {
        this.setState({ loading: false });
      });
  };

  /**
   * 表格分页变化
   */
  handleTableChange = (paginationInfo) => {
    const { keyword, pagination } = this.state;
    const pageSizeChanged = paginationInfo.pageSize !== pagination.pageSize;

    if (pageSizeChanged) {
      this.setState(
        {
          cursorByPage: { 1: 0 },
          pagination: {
            ...pagination,
            current: 1,
            pageSize: paginationInfo.pageSize,
          },
        },
        () => {
          this.fetchUsers(1, paginationInfo.pageSize, keyword);
        }
      );
      return;
    }

    this.fetchUsers(paginationInfo.current, paginationInfo.pageSize, keyword);
  };

  /**
   * 搜索
   */
  handleSearch = (value) => {
    // 统一去除首尾空格，避免把纯空白词传给后端。
    const keyword = (value ?? "").trim();
    this.setState(
      {
        keyword,
        cursorByPage: { 1: 0 },
      },
      () => {
        this.fetchUsers(1, this.state.pagination.pageSize, keyword);
      }
    );
  };

  render() {
    const { data, loading, pagination } = this.state;
    LogOut("🍎 用户列表数据：", data);
    return (
      <div className={styles.container}>
        <HGLoading
          fullscreen
          text="正在加载用户列表..."
          visible={loading}
        />
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
        dataIndex: "user_id",
        width: 180,
        render: (text) => {
          return <span>{text}</span>;
        },
      },
      {
        title: "用户名",
        dataIndex: "user_name",
        width: 180,
        render: (text) => {
          return <span>{text ?? "-.-"}</span>;
        },
      },
      {
        title: "手机号",
        dataIndex: "phone",
        width: 80,
        render: (text) => {
          return <span>{text ?? "-.-"}</span>;
        },
      },
      {
        title: "📮邮箱",
        dataIndex: "email",
        width: 80,
        render: (text) => {
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
        render: (text) => {
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
        render: (text) => {
          return <span>{text ?? "-.-"}</span>;
        },
      },
      {
        title: "更新时间",
        dataIndex: "updated_at",
        width: 80,
        render: (text) => {
          return <span>{text ?? "-.-"}</span>;
        },
      },
    ];
  };
}

const HGUserProfilePageWithNavigation = WithNavigation(HGUserProfilePage);

export default HGUserProfilePageWithNavigation;
