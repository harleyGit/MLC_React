/*
 * @Author: GangHuang harleysor@qq.com
 * @Date: 2026-01-31 16:32:04
 * @LastEditors: GangHuang harleysor@qq.com
 * @LastEditTime: 2026-04-18 11:00:00
 * @FilePath: /MLC_React/src/manager_antd/net_handle/hg_net_manager_vm.jsx
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */
import HGNetManager from "../../api/hg_net_manager";
import { HGMANAGER_API } from "../api/hg_api_constants";

class HGNetManagerVM extends HGNetManager {
  /* 获取当前登录用户信息 */
  getUserProfile = () => {
    return this.get(HGMANAGER_API.PROFILE);
  };

  /* 获取用户列表 */
  getUserDataList = ({ pageSize, pageNum, cursor, keyword }) => {
    const params = { pageSize };

    // 新接口使用 cursor 分页；未传时默认首页 cursor=0。
    params.cursor = Number.isFinite(Number(cursor)) ? Number(cursor) : 0;

    // 兼容保留 pageNum，便于后端或日志侧定位当前前端页码。
    if (Number.isFinite(Number(pageNum))) {
      params.pageNum = Number(pageNum);
    }

    // 仅在有搜索词时携带 keyword，避免 query 出现 keyword=undefined。
    if (keyword) {
      params.keyword = keyword;
    }

    return this.get(HGMANAGER_API.UserList, params);
  };

  /* 登录 */
  postUserLogin = ({ phone, password }) => {
    return this.post(HGMANAGER_API.LOGIN, { phone, password });
  };

  // 发送验证码
  sendCode({ phone }) {
    return this.get(HGMANAGER_API.SEND_CODE, {
      phone,
    });
  }

  // 发送邮箱验证码
  sendEmailCode({ email }) {
    return this.get(HGMANAGER_API.SEND_EMAIL_CODE, {
      email,
    });
  }

  // 注册新用户
  registerNewUser({ userName, phone, code, password }) {
    return this.post(HGMANAGER_API.REGISTER_NEW_USER, {
      userName,
      phone,
      code,
      password,
    });
  }

  // 邮箱注册新用户
  registerNewUserWithEmail({ userName, email, code, password }) {
    return this.post(HGMANAGER_API.REGISTER_WITH_EMAIL, {
      userName,
      email,
      code,
      password,
    });
  }

  // 更新用户资料
  updateUserProfile({ nickname, signature, gender, birth_month, avatar_url }) {
    const body = {};
    if (nickname !== undefined && nickname !== "") {
      body.nickname = nickname;
    }
    if (signature !== undefined && signature !== "") {
      body.signature = signature;
    }
    if (gender !== undefined) {
      body.gender = gender;
    }
    if (birth_month !== undefined && birth_month !== "") {
      body.birth_month = birth_month;
    }
    if (avatar_url !== undefined && avatar_url !== "") {
      body.avatar_url = avatar_url;
    }
    return this.put(HGMANAGER_API.PROFILE_UPDATE, body);
  }

  // 上传头像（二进制流方式）
  uploadAvatar(imageData, ext = "png") {
    // 通过 query 参数传递图片格式
    return this.post(`${HGMANAGER_API.AVATAR_UPLOAD}?ext=${ext}`, imageData, {
      headers: {
        "Content-Type": "application/octet-stream",
      },
    });
  }

  // 获取用户头像
  getAvatar() {
    return this.get(HGMANAGER_API.AVATAR_UPLOAD);
  }

  uploadVideoFile({ file, submissionId, partNumber }) {
    const formData = new FormData();
    if (submissionId) {
      formData.append("submissionId", submissionId);
    }
    formData.append("partNumber", String(partNumber || 1));
    // 小字段先于 file 写入，后端可流式读取 multipart，避免大文件被缓存到临时目录。
    formData.append("file", file);

    return this.post(HGMANAGER_API.VIDEO_UPLOAD_FILE, formData, {
      timeout: 10 * 60 * 1000,
    });
  }

  saveVideoDraft(body) {
    return this.post(HGMANAGER_API.VIDEO_UPLOAD_DRAFT, body);
  }

  submitVideo(body) {
    return this.post(HGMANAGER_API.VIDEO_UPLOAD_SUBMIT, body);
  }

  // 发送忘记密码验证码
  sendResetPasswordCode({ phone }) {
    return this.get(HGMANAGER_API.SEND_RESET_PASSWORD_CODE, {
      phone,
    });
  }

  // 重置密码
  resetPassword({ phone, code, new_password }) {
    return this.post(HGMANAGER_API.RESET_PASSWORD, {
      phone,
      code,
      new_password,
    });
  }
}

// 创建一个默认实例
const HGNet = new HGNetManagerVM();
export default HGNet; // 单例导出
