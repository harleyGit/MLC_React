/*
 * @Author: huanggang huanggang@imilab.com
 * @Date: 2025-05-08 18:07:52
 * @LastEditors: huanggang huanggang@imilab.com
 * @LastEditTime: 2025-05-08 18:12:07
 * @FilePath: /app-web/imi-diagnosis/src/utils/timeUtil.js
 * @Description: 这是默认设置,请设置`customMade`, 打开koroFileHeader查看配置 进行设置: https://github.com/OBKoro1/koro1FileHeader/wiki/%E9%85%8D%E7%BD%AE
 */

class TimeUtils {
    // 格式化日期为 "yyyy-MM-dd HH:mm:ss 星期几"
    static formatDateTimeWithWeekday(dateStr) {
      if (dateStr == "-.-") {
        return dateStr
      }
      const date = new Date(dateStr.replace(/-/g, '/')); // 兼容处理 Safari
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
  
      const weekdays = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
      const weekday = weekdays[date.getDay()];
  
      return `${year}-${month}-${day} ${hours}:${minutes}:${seconds} ${weekday}`;
    }
  }
  
  export default TimeUtils;